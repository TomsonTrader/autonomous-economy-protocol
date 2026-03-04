// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ReputationSystem.sol";

/**
 * @title AgentVault
 * @notice The financial backbone of every AI agent.
 *
 *         Three core mechanisms that create lock-in:
 *
 *         1. STAKING TIERS — stake AGT to unlock access to higher-value deals.
 *            An agent at Tier 3 cannot leave without losing access to its income sources.
 *
 *         2. REPUTATION CREDIT — borrow AGT against your on-chain reputation score.
 *            Reputation becomes real capital. Leaving the protocol means losing the credit line.
 *
 *         3. YIELD — staked AGT earns yield from protocol fees.
 *            Passive income that disappears the moment you unstake.
 *
 *         Tiers:
 *         ┌────────┬──────────────┬──────────────────────────────────────┐
 *         │ Tier 0 │    0 AGT     │ Basic access (<500 AGT deals)        │
 *         │ Tier 1 │  500 AGT     │ Standard deals (<5,000 AGT)          │
 *         │ Tier 2 │ 5,000 AGT    │ Premium deals (<50,000 AGT)          │
 *         │ Tier 3 │ 50,000 AGT   │ Institutional deals (unlimited)      │
 *         └────────┴──────────────┴──────────────────────────────────────┘
 */
contract AgentVault {
    IERC20 public immutable token;
    ReputationSystem public immutable reputation;

    // ── Tier config ────────────────────────────────────────────────────────
    uint256 public constant TIER1_STAKE = 500 * 10 ** 18;
    uint256 public constant TIER2_STAKE = 5_000 * 10 ** 18;
    uint256 public constant TIER3_STAKE = 50_000 * 10 ** 18;

    uint256 public constant TIER0_MAX_DEAL = 500 * 10 ** 18;
    uint256 public constant TIER1_MAX_DEAL = 5_000 * 10 ** 18;
    uint256 public constant TIER2_MAX_DEAL = 50_000 * 10 ** 18;
    // Tier 3: unlimited

    // ── Yield config ───────────────────────────────────────────────────────
    /// @notice Annual yield rate in BPS (500 = 5%)
    uint256 public constant YIELD_RATE_BPS = 500;
    uint256 public constant SECONDS_PER_YEAR = 365 days;

    // ── Credit config ──────────────────────────────────────────────────────
    /// @notice Credit per reputation point: score 10000 → 10000 * 1e18 / CREDIT_DIVISOR
    uint256 public constant CREDIT_DIVISOR = 10; // score 10000 = 1000 AGT credit

    // ── Cooldown ───────────────────────────────────────────────────────────
    uint256 public constant UNSTAKE_COOLDOWN = 7 days;

    struct VaultData {
        uint256 staked;           // AGT currently staked
        uint256 yieldAccrued;     // unclaimed yield
        uint256 lastYieldUpdate;  // last time yield was computed
        uint256 borrowed;         // AGT currently borrowed against reputation
        uint256 unstakeRequestedAt; // timestamp of unstake request (cooldown)
        uint256 unstakePending;   // amount pending unstake
    }

    mapping(address => VaultData) private vaults;

    // Protocol fee pool — receives fees from marketplace, distributes as yield
    uint256 public yieldPool;

    address public marketplace; // allowed to deposit fees

    event Staked(address indexed agent, uint256 amount, uint8 tier);
    event UnstakeRequested(address indexed agent, uint256 amount, uint256 availableAt);
    event Unstaked(address indexed agent, uint256 amount);
    event YieldClaimed(address indexed agent, uint256 amount);
    event Borrowed(address indexed agent, uint256 amount);
    event Repaid(address indexed agent, uint256 amount);
    event FeeDeposited(uint256 amount);
    event MarketplaceSet(address indexed marketplace);

    constructor(address _token, address _reputation) {
        token = IERC20(_token);
        reputation = ReputationSystem(_reputation);
    }

    function setMarketplace(address _marketplace) external {
        require(marketplace == address(0), "AgentVault: already set");
        marketplace = _marketplace;
        emit MarketplaceSet(_marketplace);
    }

    // ── Staking ────────────────────────────────────────────────────────────

    /**
     * @notice Stake AGT to unlock higher deal tiers.
     *         The higher your stake, the more exclusive the deals you can access.
     */
    function stake(uint256 amount) external {
        require(amount > 0, "AgentVault: zero amount");
        _updateYield(msg.sender);

        bool ok = token.transferFrom(msg.sender, address(this), amount);
        require(ok, "AgentVault: transfer failed");

        vaults[msg.sender].staked += amount;

        emit Staked(msg.sender, amount, getTier(msg.sender));
    }

    /**
     * @notice Request unstake. Starts a 7-day cooldown.
     *         During cooldown the tokens are still counted for tier purposes.
     */
    function requestUnstake(uint256 amount) external {
        VaultData storage v = vaults[msg.sender];
        require(amount > 0 && amount <= v.staked, "AgentVault: invalid amount");
        require(v.borrowed == 0, "AgentVault: repay debt first");
        require(v.unstakePending == 0, "AgentVault: unstake already pending");

        _updateYield(msg.sender);

        v.staked -= amount;
        v.unstakePending = amount;
        v.unstakeRequestedAt = block.timestamp;

        emit UnstakeRequested(msg.sender, amount, block.timestamp + UNSTAKE_COOLDOWN);
    }

    /**
     * @notice Claim unstaked tokens after cooldown period.
     */
    function unstake() external {
        VaultData storage v = vaults[msg.sender];
        require(v.unstakePending > 0, "AgentVault: nothing pending");
        require(
            block.timestamp >= v.unstakeRequestedAt + UNSTAKE_COOLDOWN,
            "AgentVault: cooldown not elapsed"
        );

        uint256 amount = v.unstakePending;
        v.unstakePending = 0;
        v.unstakeRequestedAt = 0;

        token.transfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    // ── Yield ──────────────────────────────────────────────────────────────

    /**
     * @notice Claim accrued yield on staked AGT.
     */
    function claimYield() external {
        _updateYield(msg.sender);
        VaultData storage v = vaults[msg.sender];
        uint256 amount = v.yieldAccrued;
        require(amount > 0, "AgentVault: no yield");
        require(yieldPool >= amount, "AgentVault: pool depleted");

        v.yieldAccrued = 0;
        yieldPool -= amount;
        token.transfer(msg.sender, amount);

        emit YieldClaimed(msg.sender, amount);
    }

    /**
     * @notice Deposit protocol fees into yield pool. Called by Marketplace.
     */
    function depositFee(uint256 amount) external {
        require(msg.sender == marketplace, "AgentVault: not marketplace");
        bool ok = token.transferFrom(msg.sender, address(this), amount);
        require(ok, "AgentVault: fee transfer failed");
        yieldPool += amount;
        emit FeeDeposited(amount);
    }

    // ── Reputation Credit ──────────────────────────────────────────────────

    /**
     * @notice Borrow AGT against your reputation score. No collateral needed —
     *         your on-chain track record IS the collateral.
     *         Credit limit = reputation_score * (1e18 / CREDIT_DIVISOR)
     */
    function borrow(uint256 amount) external {
        uint256 creditLimit = getCreditLimit(msg.sender);
        VaultData storage v = vaults[msg.sender];
        require(v.borrowed + amount <= creditLimit, "AgentVault: exceeds credit limit");
        require(yieldPool + token.balanceOf(address(this)) - totalStaked() >= amount, "AgentVault: insufficient liquidity");

        v.borrowed += amount;
        token.transfer(msg.sender, amount);

        emit Borrowed(msg.sender, amount);
    }

    /**
     * @notice Repay borrowed AGT.
     */
    function repay(uint256 amount) external {
        VaultData storage v = vaults[msg.sender];
        require(amount <= v.borrowed, "AgentVault: overpayment");

        bool ok = token.transferFrom(msg.sender, address(this), amount);
        require(ok, "AgentVault: transfer failed");

        v.borrowed -= amount;
        emit Repaid(msg.sender, amount);
    }

    // ── Views ──────────────────────────────────────────────────────────────

    function getTier(address agent) public view returns (uint8) {
        uint256 s = vaults[agent].staked + vaults[agent].unstakePending;
        if (s >= TIER3_STAKE) return 3;
        if (s >= TIER2_STAKE) return 2;
        if (s >= TIER1_STAKE) return 1;
        return 0;
    }

    function getMaxDealSize(address agent) external view returns (uint256) {
        uint8 tier = getTier(agent);
        if (tier == 0) return TIER0_MAX_DEAL;
        if (tier == 1) return TIER1_MAX_DEAL;
        if (tier == 2) return TIER2_MAX_DEAL;
        return type(uint256).max; // Tier 3: unlimited
    }

    function getCreditLimit(address agent) public view returns (uint256) {
        uint256 score = reputation.getLiveScore(agent);
        // score 10000 → 1000 AGT credit line
        return (score * 10 ** 18) / CREDIT_DIVISOR;
    }

    function getPendingYield(address agent) external view returns (uint256) {
        VaultData memory v = vaults[agent];
        if (v.staked == 0 || v.lastYieldUpdate == 0) return v.yieldAccrued;
        uint256 elapsed = block.timestamp - v.lastYieldUpdate;
        uint256 newYield = (v.staked * YIELD_RATE_BPS * elapsed) / (10_000 * SECONDS_PER_YEAR);
        return v.yieldAccrued + newYield;
    }

    function getVault(address agent) external view returns (VaultData memory) {
        return vaults[agent];
    }

    function totalStaked() public view returns (uint256) {
        return token.balanceOf(address(this)) - yieldPool;
    }

    // ── Internal ───────────────────────────────────────────────────────────

    function _updateYield(address agent) internal {
        VaultData storage v = vaults[agent];
        if (v.staked == 0) {
            v.lastYieldUpdate = block.timestamp;
            return;
        }
        uint256 elapsed = block.timestamp - v.lastYieldUpdate;
        uint256 newYield = (v.staked * YIELD_RATE_BPS * elapsed) / (10_000 * SECONDS_PER_YEAR);
        v.yieldAccrued += newYield;
        v.lastYieldUpdate = block.timestamp;
    }
}
