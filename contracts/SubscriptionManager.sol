// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./AgentRegistry.sol";

/**
 * @title SubscriptionManager
 * @notice Recurring payment contracts between AI agents.
 *
 *         An agent can subscribe to another agent's services with automatic
 *         periodic payments. The subscriber deposits funds upfront; the provider
 *         can claim each period's payment after it's due.
 *
 *         Lock-in mechanics:
 *         - Provider: has predictable income stream, doesn't want to lose subscriber
 *         - Subscriber: has guaranteed access to service, built-in reliability
 *         - Both: switching cost = losing established relationship + reputation signal
 *
 *         Use cases:
 *         - Daily data feeds
 *         - Weekly research reports
 *         - Continuous monitoring services
 *         - Ongoing content generation
 */
contract SubscriptionManager {
    IERC20 public immutable token;
    AgentRegistry public immutable registry;

    enum SubscriptionStatus { Active, Paused, Cancelled, Expired }

    struct Subscription {
        uint256 id;
        address subscriber;
        address provider;
        uint256 pricePerPeriod;    // AGT per period
        uint256 periodDuration;    // seconds per period (e.g. 1 days, 7 days)
        uint256 totalPeriods;      // total periods subscribed
        uint256 periodsRemaining;
        uint256 periodsClaimed;
        uint256 startTime;
        uint256 lastClaimTime;
        SubscriptionStatus status;
        string serviceDescription;
    }

    Subscription[] private subscriptions;

    // Track subscriptions by participant
    mapping(address => uint256[]) public providerSubscriptions;
    mapping(address => uint256[]) public subscriberSubscriptions;

    event SubscriptionCreated(
        uint256 indexed subId,
        address indexed subscriber,
        address indexed provider,
        uint256 pricePerPeriod,
        uint256 periodDuration,
        uint256 totalPeriods
    );
    event PeriodClaimed(uint256 indexed subId, address indexed provider, uint256 amount, uint256 periodsRemaining);
    event SubscriptionCancelled(uint256 indexed subId, address indexed by, uint256 refund);
    event SubscriptionPaused(uint256 indexed subId);
    event SubscriptionResumed(uint256 indexed subId);

    modifier onlyRegistered() {
        require(registry.isRegistered(msg.sender), "SubscriptionManager: not registered");
        _;
    }

    constructor(address _token, address _registry) {
        token = IERC20(_token);
        registry = AgentRegistry(_registry);
    }

    /**
     * @notice Create a subscription. Subscriber deposits total payment upfront.
     * @param provider         Agent who will provide the service.
     * @param pricePerPeriod   AGT paid each period.
     * @param periodDuration   Duration of each period in seconds.
     * @param totalPeriods     Number of periods to subscribe.
     * @param serviceDescription  Human-readable description of the service.
     */
    function subscribe(
        address provider,
        uint256 pricePerPeriod,
        uint256 periodDuration,
        uint256 totalPeriods,
        string calldata serviceDescription
    ) external onlyRegistered returns (uint256 subId) {
        require(provider != msg.sender, "SubscriptionManager: self-subscription");
        require(registry.isRegistered(provider), "SubscriptionManager: provider not registered");
        require(pricePerPeriod > 0, "SubscriptionManager: zero price");
        require(periodDuration >= 1 hours, "SubscriptionManager: period too short");
        require(totalPeriods > 0 && totalPeriods <= 365, "SubscriptionManager: invalid periods");

        uint256 totalCost = pricePerPeriod * totalPeriods;
        bool ok = token.transferFrom(msg.sender, address(this), totalCost);
        require(ok, "SubscriptionManager: deposit failed");

        subId = subscriptions.length;
        subscriptions.push(Subscription({
            id: subId,
            subscriber: msg.sender,
            provider: provider,
            pricePerPeriod: pricePerPeriod,
            periodDuration: periodDuration,
            totalPeriods: totalPeriods,
            periodsRemaining: totalPeriods,
            periodsClaimed: 0,
            startTime: block.timestamp,
            lastClaimTime: block.timestamp,
            status: SubscriptionStatus.Active,
            serviceDescription: serviceDescription
        }));

        providerSubscriptions[provider].push(subId);
        subscriberSubscriptions[msg.sender].push(subId);

        emit SubscriptionCreated(subId, msg.sender, provider, pricePerPeriod, periodDuration, totalPeriods);
    }

    /**
     * @notice Provider claims payment for all elapsed periods since last claim.
     *         Can claim multiple periods at once if several have elapsed.
     */
    function claimPeriod(uint256 subId) external {
        Subscription storage sub = subscriptions[subId];
        require(sub.provider == msg.sender, "SubscriptionManager: not provider");
        require(sub.status == SubscriptionStatus.Active, "SubscriptionManager: not active");
        require(sub.periodsRemaining > 0, "SubscriptionManager: fully claimed");

        uint256 elapsed = block.timestamp - sub.lastClaimTime;
        uint256 periodsElapsed = elapsed / sub.periodDuration;
        require(periodsElapsed > 0, "SubscriptionManager: period not elapsed");

        uint256 claimable = periodsElapsed < sub.periodsRemaining
            ? periodsElapsed
            : sub.periodsRemaining;

        uint256 payment = claimable * sub.pricePerPeriod;
        sub.periodsRemaining -= claimable;
        sub.periodsClaimed += claimable;
        sub.lastClaimTime += claimable * sub.periodDuration;

        if (sub.periodsRemaining == 0) {
            sub.status = SubscriptionStatus.Expired;
        }

        token.transfer(msg.sender, payment);
        emit PeriodClaimed(subId, msg.sender, payment, sub.periodsRemaining);
    }

    /**
     * @notice Subscriber cancels and gets refund for unclaimed periods.
     */
    function cancel(uint256 subId) external {
        Subscription storage sub = subscriptions[subId];
        require(sub.subscriber == msg.sender, "SubscriptionManager: not subscriber");
        require(sub.status == SubscriptionStatus.Active || sub.status == SubscriptionStatus.Paused, "SubscriptionManager: not cancellable");

        // Provider keeps any elapsed but unclaimed periods
        uint256 elapsed = block.timestamp - sub.lastClaimTime;
        uint256 providerOwed = (elapsed / sub.periodDuration) * sub.pricePerPeriod;
        uint256 providerPeriods = elapsed / sub.periodDuration;
        if (providerPeriods > sub.periodsRemaining) providerPeriods = sub.periodsRemaining;
        providerOwed = providerPeriods * sub.pricePerPeriod;

        uint256 subscriberRefund = (sub.periodsRemaining - providerPeriods) * sub.pricePerPeriod;

        sub.status = SubscriptionStatus.Cancelled;
        sub.periodsRemaining = 0;

        if (providerOwed > 0) token.transfer(sub.provider, providerOwed);
        if (subscriberRefund > 0) token.transfer(sub.subscriber, subscriberRefund);

        emit SubscriptionCancelled(subId, msg.sender, subscriberRefund);
    }

    // ── Views ──────────────────────────────────────────────────────────────

    function getSubscription(uint256 subId) external view returns (Subscription memory) {
        return subscriptions[subId];
    }

    function getProviderSubscriptions(address provider) external view returns (uint256[] memory) {
        return providerSubscriptions[provider];
    }

    function getSubscriberSubscriptions(address subscriber) external view returns (uint256[] memory) {
        return subscriberSubscriptions[subscriber];
    }

    /**
     * @notice Returns how much a provider can claim right now across all their subscriptions.
     */
    function getClaimableRevenue(address provider) external view returns (uint256 total) {
        uint256[] memory subs = providerSubscriptions[provider];
        for (uint256 i = 0; i < subs.length; i++) {
            Subscription memory sub = subscriptions[subs[i]];
            if (sub.status != SubscriptionStatus.Active) continue;
            uint256 elapsed = block.timestamp - sub.lastClaimTime;
            uint256 periods = elapsed / sub.periodDuration;
            if (periods > sub.periodsRemaining) periods = sub.periodsRemaining;
            total += periods * sub.pricePerPeriod;
        }
    }

    function totalSubscriptions() external view returns (uint256) {
        return subscriptions.length;
    }
}
