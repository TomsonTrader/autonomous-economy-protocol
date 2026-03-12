// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IGenesisRegistry {
    function isRegistered(address agent) external view returns (bool);
}

interface IGenesisReputation {
    function getReputation(address agent) external view returns (
        uint256 score, uint256 totalDeals, uint256 successfulDeals,
        uint256 totalValueTransacted, uint256 lastUpdated
    );
}

interface IGenesisVault {
    function getVault(address agent) external view returns (
        uint256 staked, uint256 yieldAccrued, uint256 lastYieldUpdate,
        uint256 borrowed, uint256 unstakeRequestedAt, uint256 unstakePending
    );
}

interface IGenesisReferral {
    function getReferralData(address agent) external view returns (
        address referrer, uint256 totalEarned, uint256 claimableEarnings,
        uint256 directReferrals, uint256 totalNetworkDeals
    );
}

/**
 * @title GenesisProgram v2 — Season 1 Anti-Sybil Airdrop with Vesting
 * @notice Points earned only by real on-chain activity.
 *   100 — register | 200 — first deal | 150 — stake
 *   100 — with referrer | 300 — refer 3+ | 500 — 10+ deals
 *   500 — rep >5000 for 30 days
 * Pool: 50,000,000 AGT (5% of supply).
 * Claim = (pts/total) * pool, capped at 1M AGT per wallet.
 * Vesting: 25% immediate, 75% linear over 180 days.
 * Claim window opens 30 days after season ends (time to build liquidity).
 */
contract GenesisProgram is Ownable, ReentrancyGuard {

    IERC20 public immutable agt;
    IGenesisRegistry public immutable registry;
    IGenesisReputation public immutable reputation;
    IGenesisVault public immutable vault;
    IGenesisReferral public immutable referral;

    uint256 public constant SEASON_POOL     = 50_000_000 ether;
    uint256 public constant SEASON_DURATION = 60 days;
    uint256 public constant MIN_REP_SCORE   = 5000;
    uint256 public constant MIN_REP_DAYS    = 30 days;

    // Tokenomics protection
    uint256 public constant CLAIM_DELAY     = 30 days;   // after season ends — time to build Uniswap liquidity
    uint256 public constant IMMEDIATE_BPS   = 2500;      // 25% at claim (basis points)
    uint256 public constant VESTING_PERIOD  = 180 days;  // 75% vests linearly over 6 months
    uint256 public constant MAX_CLAIM       = 1_000_000 ether; // anti-whale: 2% of pool per wallet

    // Emergency withdraw timelock (owner safety net)
    uint256 public constant EMERGENCY_TIMELOCK = 7 days;
    uint256 public emergencyWithdrawAt; // 0 = not requested

    uint256 public constant PTS_REGISTER      = 100;
    uint256 public constant PTS_FIRST_DEAL    = 200;
    uint256 public constant PTS_STAKE         = 150;
    uint256 public constant PTS_WITH_REFERRER = 100;
    uint256 public constant PTS_BE_REFERRER3  = 300;
    uint256 public constant PTS_TEN_DEALS     = 500;
    uint256 public constant PTS_REP_SUSTAINED = 500;

    struct Participant {
        uint256 points;
        bool claimed;
        uint256 claimedAt;
        bool creditedRegister;
        bool creditedFirstDeal;
        bool creditedStake;
        bool creditedWithReferrer;
        bool creditedReferrer3;
        bool creditedTenDeals;
        bool creditedRepSustained;
        uint256 repAboveThresholdSince;
    }

    struct VestingSchedule {
        uint256 total;      // 75% of allocation — vests linearly over VESTING_PERIOD
        uint256 released;   // already claimed from vesting
        uint256 startTime;  // when claim() was called (vesting clock starts here)
    }

    mapping(address => Participant) public participants;
    mapping(address => VestingSchedule) public vestingSchedules;
    address[] public participantList;
    uint256 public totalPoints;
    uint256 public seasonStart;
    uint256 public seasonEnd;
    bool public seasonStarted;
    bool public seasonEnded;

    event PointsAwarded(address indexed agent, string action, uint256 points, uint256 total);
    event SeasonStarted(uint256 start, uint256 end, uint256 pool);
    event SeasonEnded(uint256 totalParticipants, uint256 totalPoints);
    event Claimed(address indexed agent, uint256 points, uint256 immediateAgt, uint256 vestedAgt);
    event VestedClaimed(address indexed agent, uint256 amount, uint256 remaining);
    event EmergencyWithdrawRequested(uint256 executeAfter);
    event EmergencyWithdrawExecuted(uint256 amount);

    constructor(
        address _agt, address _registry, address _reputation,
        address _vault, address _referral
    ) Ownable(msg.sender) {
        agt        = IERC20(_agt);
        registry   = IGenesisRegistry(_registry);
        reputation = IGenesisReputation(_reputation);
        vault      = IGenesisVault(_vault);
        referral   = IGenesisReferral(_referral);
    }

    // ── Season lifecycle ─────────────────────────────────────────────────────

    function startSeason() external onlyOwner {
        require(!seasonStarted, "Already started");
        require(agt.balanceOf(address(this)) >= SEASON_POOL, "Fund the contract first");
        seasonStart   = block.timestamp;
        seasonEnd     = block.timestamp + SEASON_DURATION;
        seasonStarted = true;
        emit SeasonStarted(seasonStart, seasonEnd, SEASON_POOL);
    }

    function endSeason() external onlyOwner {
        require(seasonStarted && !seasonEnded, "Invalid state");
        seasonEnded = true;
        emit SeasonEnded(participantList.length, totalPoints);
    }

    /// @notice Recover tokens after season ended + 90 days (standard path)
    function recoverUnclaimed() external onlyOwner {
        require(seasonEnded && block.timestamp > seasonEnd + 90 days, "Too early");
        uint256 balance = agt.balanceOf(address(this));
        require(balance > 0, "Nothing to recover");
        agt.transfer(owner(), balance);
    }

    // ── Emergency withdraw (7-day timelock) ──────────────────────────────────

    function requestEmergencyWithdraw() external onlyOwner {
        emergencyWithdrawAt = block.timestamp + EMERGENCY_TIMELOCK;
        emit EmergencyWithdrawRequested(emergencyWithdrawAt);
    }

    function cancelEmergencyWithdraw() external onlyOwner {
        emergencyWithdrawAt = 0;
    }

    function executeEmergencyWithdraw() external onlyOwner {
        require(emergencyWithdrawAt != 0 && block.timestamp >= emergencyWithdrawAt, "Timelock not expired");
        emergencyWithdrawAt = 0;
        uint256 balance = agt.balanceOf(address(this));
        require(balance > 0, "Nothing to withdraw");
        agt.transfer(owner(), balance);
        emit EmergencyWithdrawExecuted(balance);
    }

    // ── Points ───────────────────────────────────────────────────────────────

    function syncPoints(address agent) external {
        require(seasonStarted && !seasonEnded && block.timestamp <= seasonEnd, "Season not active");
        require(registry.isRegistered(agent), "Not registered");

        Participant storage p = participants[agent];
        if (p.points == 0 && !p.creditedRegister) participantList.push(agent);

        uint256 earned = 0;

        if (!p.creditedRegister) {
            p.creditedRegister = true;
            earned += PTS_REGISTER;
            emit PointsAwarded(agent, "register", PTS_REGISTER, p.points + earned);
        }

        (uint256 repScore, uint256 totalDeals,,,) = reputation.getReputation(agent);

        if (!p.creditedFirstDeal && totalDeals >= 1) {
            p.creditedFirstDeal = true;
            earned += PTS_FIRST_DEAL;
            emit PointsAwarded(agent, "first_deal", PTS_FIRST_DEAL, p.points + earned);
        }

        if (!p.creditedTenDeals && totalDeals >= 10) {
            p.creditedTenDeals = true;
            earned += PTS_TEN_DEALS;
            emit PointsAwarded(agent, "ten_deals", PTS_TEN_DEALS, p.points + earned);
        }

        if (!p.creditedStake) {
            (uint256 staked,,,,,) = vault.getVault(agent);
            if (staked > 0) {
                p.creditedStake = true;
                earned += PTS_STAKE;
                emit PointsAwarded(agent, "stake", PTS_STAKE, p.points + earned);
            }
        }

        (address ref,,,uint256 directReferrals,) = referral.getReferralData(agent);

        if (!p.creditedWithReferrer && ref != address(0)) {
            p.creditedWithReferrer = true;
            earned += PTS_WITH_REFERRER;
            emit PointsAwarded(agent, "with_referrer", PTS_WITH_REFERRER, p.points + earned);
        }

        if (!p.creditedReferrer3 && directReferrals >= 3) {
            p.creditedReferrer3 = true;
            earned += PTS_BE_REFERRER3;
            emit PointsAwarded(agent, "referrer_3", PTS_BE_REFERRER3, p.points + earned);
        }

        if (repScore >= MIN_REP_SCORE) {
            if (p.repAboveThresholdSince == 0) {
                p.repAboveThresholdSince = block.timestamp;
            } else if (!p.creditedRepSustained && block.timestamp >= p.repAboveThresholdSince + MIN_REP_DAYS) {
                p.creditedRepSustained = true;
                earned += PTS_REP_SUSTAINED;
                emit PointsAwarded(agent, "rep_sustained", PTS_REP_SUSTAINED, p.points + earned);
            }
        } else {
            p.repAboveThresholdSince = 0;
        }

        p.points    += earned;
        totalPoints += earned;
    }

    // ── Claims ───────────────────────────────────────────────────────────────

    /**
     * @notice Claim airdrop allocation.
     * 25% transferred immediately; 75% stored in vesting schedule (180 days linear).
     * Window opens CLAIM_DELAY (30 days) after season ends.
     */
    function claim() external nonReentrant {
        require(seasonEnded, "Season not ended yet");
        require(block.timestamp >= seasonEnd + CLAIM_DELAY, "Claim window not open yet");
        Participant storage p = participants[msg.sender];
        require(p.points > 0, "No points earned");
        require(!p.claimed, "Already claimed");

        p.claimed   = true;
        p.claimedAt = block.timestamp;

        uint256 total = (p.points * SEASON_POOL) / totalPoints;
        if (total > MAX_CLAIM) total = MAX_CLAIM; // anti-whale cap

        uint256 immediate = (total * IMMEDIATE_BPS) / 10_000;
        uint256 vested    = total - immediate;

        vestingSchedules[msg.sender] = VestingSchedule({
            total:     vested,
            released:  0,
            startTime: block.timestamp
        });

        require(agt.transfer(msg.sender, immediate), "Transfer failed");
        emit Claimed(msg.sender, p.points, immediate, vested);
    }

    /**
     * @notice Claim the linearly-unlocked portion of vesting schedule.
     * Call as many times as desired; only unlocked amount transfers.
     */
    function claimVested() external nonReentrant {
        VestingSchedule storage v = vestingSchedules[msg.sender];
        require(v.total > 0, "No vesting schedule");

        uint256 elapsed  = block.timestamp - v.startTime;
        uint256 unlocked = elapsed >= VESTING_PERIOD
            ? v.total
            : (v.total * elapsed) / VESTING_PERIOD;

        uint256 claimable = unlocked - v.released;
        require(claimable > 0, "Nothing to claim yet");

        v.released += claimable;
        require(agt.transfer(msg.sender, claimable), "Transfer failed");
        emit VestedClaimed(msg.sender, claimable, v.total - v.released);
    }

    // ── Views ────────────────────────────────────────────────────────────────

    function claimWindowOpen() external view returns (bool) {
        return seasonEnded && block.timestamp >= seasonEnd + CLAIM_DELAY;
    }

    function getParticipant(address agent) external view returns (
        uint256 points, bool claimed, uint256 estimatedAGT, uint256 daysLeft
    ) {
        Participant storage p = participants[agent];
        points       = p.points;
        claimed      = p.claimed;
        uint256 raw  = totalPoints > 0 ? (p.points * SEASON_POOL) / totalPoints : 0;
        estimatedAGT = raw > MAX_CLAIM ? MAX_CLAIM : raw;
        daysLeft     = seasonEnd > block.timestamp ? (seasonEnd - block.timestamp) / 1 days : 0;
    }

    function getVesting(address agent) external view returns (
        uint256 total, uint256 released, uint256 claimable, uint256 startTime
    ) {
        VestingSchedule storage v = vestingSchedules[agent];
        total     = v.total;
        released  = v.released;
        startTime = v.startTime;
        if (v.total > 0 && v.startTime > 0) {
            uint256 elapsed  = block.timestamp - v.startTime;
            uint256 unlocked = elapsed >= VESTING_PERIOD
                ? v.total
                : (v.total * elapsed) / VESTING_PERIOD;
            claimable = unlocked > v.released ? unlocked - v.released : 0;
        }
    }

    function getLeaderboard() external view returns (address[] memory addrs, uint256[] memory pts) {
        uint256 len = participantList.length < 50 ? participantList.length : 50;
        addrs = new address[](len);
        pts   = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            addrs[i] = participantList[i];
            pts[i]   = participants[participantList[i]].points;
        }
    }

    function seasonInfo() external view returns (
        bool started, bool ended, uint256 start, uint256 end,
        uint256 participants_, uint256 totalPts, uint256 pool
    ) {
        started       = seasonStarted;
        ended         = seasonEnded;
        start         = seasonStart;
        end           = seasonEnd;
        participants_ = participantList.length;
        totalPts      = totalPoints;
        pool          = SEASON_POOL;
    }
}
