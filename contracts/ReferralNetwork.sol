// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ReferralNetwork
 * @notice Viral growth engine — agents earn perpetual commissions from their referral tree.
 *
 *         When agent A refers agent B, A earns 1% of every deal B ever makes.
 *         If B refers agent C, B earns 1% and A earns 0.5% of C's deals.
 *
 *         This creates the most powerful retention mechanism:
 *         An agent with a large referral network earns passive income every
 *         time any agent in their tree transacts. Leaving the protocol means
 *         losing ALL of that passive income stream permanently.
 *
 *         Commission structure:
 *         Level 1 (direct referral): 1.0%
 *         Level 2 (referral of referral): 0.5%
 *         Protocol treasury: remaining fees
 */
contract ReferralNetwork {
    IERC20 public immutable token;

    uint256 public constant L1_BPS = 100;  // 1%
    uint256 public constant L2_BPS = 50;   // 0.5%

    struct ReferralData {
        address referrer;          // who referred this agent
        uint256 totalEarned;       // lifetime earnings from referral commissions
        uint256 claimableEarnings; // unclaimed earnings
        uint256 directReferrals;   // number of agents directly referred
        uint256 totalNetworkDeals; // total deals made by entire referral tree
    }

    mapping(address => ReferralData) private referrals;
    mapping(address => address[]) private directReferrees; // referrer → list of their referrees

    address public marketplace;
    address public subscriptionManager;
    address public taskDAG;
    address public treasury;

    event ReferralRegistered(address indexed agent, address indexed referrer);
    event CommissionEarned(address indexed earner, address indexed source, uint256 amount, uint8 level);
    event CommissionClaimed(address indexed agent, uint256 amount);
    event ProtocolContractSet(string contractType, address contractAddress);

    modifier onlyProtocol() {
        require(
            msg.sender == marketplace ||
            msg.sender == subscriptionManager ||
            msg.sender == taskDAG,
            "ReferralNetwork: not authorized"
        );
        _;
    }

    constructor(address _token, address _treasury) {
        token = IERC20(_token);
        treasury = _treasury;
    }

    function setMarketplace(address _marketplace) external {
        require(marketplace == address(0), "ReferralNetwork: already set");
        marketplace = _marketplace;
        emit ProtocolContractSet("marketplace", _marketplace);
    }

    function setSubscriptionManager(address _sub) external {
        require(subscriptionManager == address(0), "ReferralNetwork: already set");
        subscriptionManager = _sub;
        emit ProtocolContractSet("subscriptionManager", _sub);
    }

    function setTaskDAG(address _taskDAG) external {
        require(taskDAG == address(0), "ReferralNetwork: already set");
        taskDAG = _taskDAG;
        emit ProtocolContractSet("taskDAG", _taskDAG);
    }

    /**
     * @notice Register the referrer for a new agent.
     *         Called once when an agent registers, if they have a referral code (address).
     * @param agent    The newly registered agent.
     * @param referrer The agent who referred them (address(0) = no referrer).
     */
    function registerReferral(address agent, address referrer) external {
        require(msg.sender == marketplace || referrals[agent].referrer == address(0), "ReferralNetwork: unauthorized");
        if (referrer == address(0) || referrer == agent) return;
        if (referrals[agent].referrer != address(0)) return; // already set

        referrals[agent].referrer = referrer;
        directReferrees[referrer].push(agent);
        referrals[referrer].directReferrals++;

        emit ReferralRegistered(agent, referrer);
    }

    /**
     * @notice Distribute referral commissions when a deal is executed.
     *         Called by Marketplace/SubscriptionManager/TaskDAG on payment.
     * @param agent       The agent who made the deal (earner's perspective).
     * @param dealValue   Total AGT value of the deal.
     */
    function distributeCommissions(address agent, uint256 dealValue) external onlyProtocol {
        referrals[agent].totalNetworkDeals++;

        address l1Referrer = referrals[agent].referrer;
        if (l1Referrer == address(0)) return;

        // Level 1 commission
        uint256 l1Amount = (dealValue * L1_BPS) / 10_000;
        if (l1Amount > 0) {
            referrals[l1Referrer].claimableEarnings += l1Amount;
            referrals[l1Referrer].totalEarned += l1Amount;
            emit CommissionEarned(l1Referrer, agent, l1Amount, 1);
        }

        // Level 2 commission
        address l2Referrer = referrals[l1Referrer].referrer;
        if (l2Referrer == address(0)) return;

        uint256 l2Amount = (dealValue * L2_BPS) / 10_000;
        if (l2Amount > 0) {
            referrals[l2Referrer].claimableEarnings += l2Amount;
            referrals[l2Referrer].totalEarned += l2Amount;
            emit CommissionEarned(l2Referrer, agent, l2Amount, 2);
        }
    }

    /**
     * @notice Claim accumulated referral commissions.
     *         Funds must have been deposited by the protocol contracts.
     */
    function claimCommissions() external {
        uint256 amount = referrals[msg.sender].claimableEarnings;
        require(amount > 0, "ReferralNetwork: nothing to claim");
        require(token.balanceOf(address(this)) >= amount, "ReferralNetwork: insufficient funds");

        referrals[msg.sender].claimableEarnings = 0;
        token.transfer(msg.sender, amount);

        emit CommissionClaimed(msg.sender, amount);
    }

    /**
     * @notice Deposit funds into the referral pool (called by protocol contracts).
     */
    function depositForCommissions(uint256 amount) external onlyProtocol {
        token.transferFrom(msg.sender, address(this), amount);
    }

    // ── Views ──────────────────────────────────────────────────────────────

    function getReferralData(address agent) external view returns (ReferralData memory) {
        return referrals[agent];
    }

    function getDirectReferrees(address referrer) external view returns (address[] memory) {
        return directReferrees[referrer];
    }

    function getNetworkSize(address referrer) external view returns (uint256 total) {
        address[] memory direct = directReferrees[referrer];
        total = direct.length;
        for (uint256 i = 0; i < direct.length; i++) {
            total += directReferrees[direct[i]].length;
        }
    }

    function getClaimable(address agent) external view returns (uint256) {
        return referrals[agent].claimableEarnings;
    }
}
