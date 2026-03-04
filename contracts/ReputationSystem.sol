// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ReputationSystem
 * @notice Fully decentralized reputation tracking for agents.
 *
 *         Key mechanics:
 *         - Only AutonomousAgreement contracts can record outcomes
 *         - Score is multidimensional: success rate + volume + speed
 *         - DECAY: 1% per day after 30 days of inactivity (permissionless trigger)
 *         - Score is the foundation for AgentVault credit lines
 */
contract ReputationSystem {
    struct ReputationData {
        uint256 totalDeals;
        uint256 successfulDeals;
        uint256 totalValueTransacted; // AGT wei
        uint256 weightedScore;        // 0–10000
        uint256 lastUpdated;          // timestamp of last deal
        uint256 avgCompletionSpeed;   // avg seconds to complete a deal
        uint256 specializations;      // bitmask of proven capability categories
    }

    mapping(address => ReputationData) private reputations;
    mapping(address => bool) public authorizedContracts;

    address public negotiationEngine;

    /// @notice Inactivity threshold before decay starts (30 days)
    uint256 public constant DECAY_GRACE_PERIOD = 30 days;
    /// @notice Decay rate: 100 = 1% per day
    uint256 public constant DECAY_RATE_BPS = 100;

    event OutcomeRecorded(address indexed agent, bool success, uint256 value);
    event ContractAuthorized(address indexed agreementContract);
    event NegotiationEngineSet(address indexed engine);
    event ScoreDecayed(address indexed agent, uint256 oldScore, uint256 newScore);

    modifier onlyAuthorized() {
        require(authorizedContracts[msg.sender], "ReputationSystem: not authorized");
        _;
    }

    modifier onlyEngine() {
        require(msg.sender == negotiationEngine, "ReputationSystem: not engine");
        _;
    }

    function setNegotiationEngine(address _engine) external {
        require(negotiationEngine == address(0), "ReputationSystem: engine already set");
        require(_engine != address(0), "ReputationSystem: zero address");
        negotiationEngine = _engine;
        emit NegotiationEngineSet(_engine);
    }

    function authorizeContract(address agreementContract) external onlyEngine {
        authorizedContracts[agreementContract] = true;
        emit ContractAuthorized(agreementContract);
    }

    /**
     * @notice Record deal outcome. Called by AutonomousAgreement on completion.
     * @param agent      Agent address.
     * @param success    Whether the deal succeeded.
     * @param value      AGT value of the deal (wei).
     * @param startTime  Timestamp when the agreement was funded (for speed score).
     */
    function recordOutcome(
        address agent,
        bool success,
        uint256 value,
        uint256 startTime
    ) external onlyAuthorized {
        ReputationData storage rep = reputations[agent];
        rep.totalDeals++;
        rep.totalValueTransacted += value;
        rep.lastUpdated = block.timestamp;

        if (success) {
            rep.successfulDeals++;
            // Update average speed (exponential moving average)
            uint256 elapsed = block.timestamp > startTime ? block.timestamp - startTime : 1;
            rep.avgCompletionSpeed = rep.avgCompletionSpeed == 0
                ? elapsed
                : (rep.avgCompletionSpeed * 7 + elapsed * 3) / 10;
        }

        rep.weightedScore = _computeScore(rep);
        emit OutcomeRecorded(agent, success, value);
    }

    /**
     * @notice Permissionless decay trigger. Anyone can call this on an inactive agent.
     *         After DECAY_GRACE_PERIOD of inactivity, score drops 1% per elapsed day.
     *         This creates urgency — agents must stay active or lose their score.
     */
    function applyDecay(address agent) external {
        ReputationData storage rep = reputations[agent];
        if (rep.weightedScore == 0 || rep.lastUpdated == 0) return;

        uint256 elapsed = block.timestamp - rep.lastUpdated;
        if (elapsed <= DECAY_GRACE_PERIOD) return;

        uint256 decayDays = (elapsed - DECAY_GRACE_PERIOD) / 1 days;
        if (decayDays == 0) return;

        uint256 oldScore = rep.weightedScore;
        // Apply compound decay: score * (1 - 0.01)^days
        // Approximated as: score * (10000 - days * 100) / 10000, capped at 0
        uint256 decayBps = decayDays * DECAY_RATE_BPS;
        if (decayBps >= 10_000) {
            rep.weightedScore = 0;
        } else {
            rep.weightedScore = (rep.weightedScore * (10_000 - decayBps)) / 10_000;
        }

        emit ScoreDecayed(agent, oldScore, rep.weightedScore);
    }

    /**
     * @notice Returns the LIVE score applying any pending decay without writing state.
     *         Use this for display — always shows current effective score.
     */
    function getLiveScore(address agent) external view returns (uint256) {
        ReputationData memory rep = reputations[agent];
        if (rep.weightedScore == 0 || rep.lastUpdated == 0) return 0;

        uint256 elapsed = block.timestamp - rep.lastUpdated;
        if (elapsed <= DECAY_GRACE_PERIOD) return rep.weightedScore;

        uint256 decayDays = (elapsed - DECAY_GRACE_PERIOD) / 1 days;
        if (decayDays == 0) return rep.weightedScore;

        uint256 decayBps = decayDays * DECAY_RATE_BPS;
        if (decayBps >= 10_000) return 0;
        return (rep.weightedScore * (10_000 - decayBps)) / 10_000;
    }

    // ── Views ──────────────────────────────────────────────────────────────

    function getReputation(address agent)
        external
        view
        returns (
            uint256 score,
            uint256 totalDeals,
            uint256 successfulDeals,
            uint256 totalValueTransacted,
            uint256 lastUpdated
        )
    {
        ReputationData memory rep = reputations[agent];
        return (rep.weightedScore, rep.totalDeals, rep.successfulDeals, rep.totalValueTransacted, rep.lastUpdated);
    }

    function getScore(address agent) external view returns (uint256) {
        return reputations[agent].weightedScore;
    }

    function getFullProfile(address agent) external view returns (ReputationData memory) {
        return reputations[agent];
    }

    // ── Internal ───────────────────────────────────────────────────────────

    function _computeScore(ReputationData memory rep) internal pure returns (uint256) {
        if (rep.totalDeals == 0) return 0;

        // 60% success rate
        uint256 successRate = (rep.successfulDeals * 10_000) / rep.totalDeals;
        uint256 successComponent = (successRate * 60) / 100;

        // 25% volume (each 1000 AGT = 100 pts, max 2500)
        uint256 volumeBonus = (rep.totalValueTransacted / (1_000 * 10 ** 18)) * 100;
        if (volumeBonus > 2_500) volumeBonus = 2_500;
        uint256 volumeComponent = (volumeBonus * 25) / 2_500;

        // 15% speed bonus (faster = better, baseline 24h)
        uint256 speedComponent;
        if (rep.avgCompletionSpeed > 0) {
            uint256 baseline = 24 hours;
            speedComponent = rep.avgCompletionSpeed < baseline
                ? (15 * (baseline - rep.avgCompletionSpeed)) / baseline
                : 0;
        }

        return successComponent + volumeComponent + speedComponent;
    }
}
