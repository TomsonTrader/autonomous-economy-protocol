// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IERC20Burnable is IERC20 {
    function burn(uint256 amount) external;
}

/// @dev Minimal Uniswap V3 SwapRouter02 interface
interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24  fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params)
        external returns (uint256 amountOut);
}

/**
 * @title SuperAgentRegistry
 * @notice AEP Super Agent Registration System — 2-level referral network.
 *
 *  Each agent pays REGISTRATION_FEE (50 USDC) to join. The fee is split:
 *    40 % → Treasury
 *    25 % → Buy-and-burn AGT (swapped via Uniswap, then burned)
 *    25 % → Level-1 referrer (direct recruiter)  — falls to Treasury if none
 *    10 % → Level-2 referrer (recruiter's recruiter) — falls to Treasury if none
 *
 *  Buy-and-burn lifecycle:
 *    Phase 1 (publicBurnEnabled = false): only owner can call executeBuyAndBurn().
 *      Owner executes monthly burns manually using an off-chain Uniswap quoter
 *      to set proper slippage protection. Safe with low pool liquidity.
 *    Phase 2 (publicBurnEnabled = true): anyone can trigger burns.
 *      Enable only when pool liquidity is deep enough (~$10k+) to resist
 *      sandwich attacks. Toggle via setBurnPublic() — one tx, no redeploy.
 *
 * @dev USDC has 6 decimals on Base mainnet.
 *      AGT extends ERC20Burnable → burn(amount) is available.
 *      All token operations use SafeERC20 for maximum compatibility.
 */
contract SuperAgentRegistry is Ownable, ReentrancyGuard, Pausable {

    using SafeERC20 for IERC20;
    using SafeERC20 for IERC20Burnable;

    // ── Tokens ────────────────────────────────────────────────────────────────
    IERC20         public immutable usdc;
    IERC20Burnable public immutable agt;

    // ── Uniswap V3 ────────────────────────────────────────────────────────────
    ISwapRouter public swapRouter;
    uint24      public poolFee;       // 3000 = 0.3 %, 500 = 0.05 %, 10000 = 1 %
    uint256     public minBurnAmount; // min USDC before triggering a swap (6 dec)

    // ── Burn access control ───────────────────────────────────────────────────
    // Phase 1: false — only owner executes monthly burns (safe with low liquidity)
    // Phase 2: true  — anyone can trigger (enable when pool has $10k+ liquidity)
    bool public publicBurnEnabled = false;

    // ── Treasury ──────────────────────────────────────────────────────────────
    address public treasury;

    // ── Fee constants (basis points, TOTAL_BPS = 100 %) ──────────────────────
    uint256 public constant TOTAL_BPS        = 10_000;
    uint256 public constant REGISTRATION_FEE = 50_000_000; // 50 USDC (6 dec)
    uint256 public constant TREASURY_BPS     = 4_000;      // 40 %
    uint256 public constant BURN_BPS         = 2_500;      // 25 %
    uint256 public constant LEVEL1_BPS       = 2_500;      // 25 %
    uint256 public constant LEVEL2_BPS       = 1_000;      // 10 %
    // Sanity: 4000 + 2500 + 2500 + 1000 = 10000 ✓

    // Max minBurnAmount: 200 USDC — prevents owner locking burn indefinitely
    uint256 public constant MAX_MIN_BURN = 200_000_000; // 200 USDC (6 dec)

    // ── Agent state ───────────────────────────────────────────────────────────
    struct Agent {
        bool    registered;
        address referrer;        // level-1 referrer of this agent
        uint256 registeredAt;
        uint256 referralEarned;  // total USDC earned as a referrer (all time)
    }

    mapping(address => Agent) public agents;
    address[] public agentList;

    // ── Protocol-level counters ───────────────────────────────────────────────
    uint256 public totalRegistrations;
    uint256 public totalReferralsPaid; // cumulative USDC sent to referrers
    uint256 public burnAccumulator;    // USDC sitting here, pending next swap+burn
    uint256 public totalAGTBurned;     // AGT permanently destroyed (wei)

    // ── Events ────────────────────────────────────────────────────────────────
    event AgentRegistered(
        address indexed agent,
        address indexed level1Referrer,
        address indexed level2Referrer,
        uint256 fee
    );
    event ReferralPaid(
        address indexed recipient,
        address indexed newAgent,
        uint8   level,
        uint256 amountUsdc
    );
    event BuyAndBurnExecuted(uint256 usdcSpent, uint256 agtBurned);
    event BurnPublicEnabled();
    event TreasuryUpdated(address indexed newTreasury);
    event RouterUpdated(address indexed newRouter);
    event PoolFeeUpdated(uint24 newFee);
    event MinBurnAmountUpdated(uint256 newMin);

    // ── Constructor ───────────────────────────────────────────────────────────
    constructor(
        address _usdc,
        address _agt,
        address _treasury,
        address _swapRouter,
        uint24  _poolFee
    ) Ownable(msg.sender) {
        require(_usdc       != address(0), "SuperAgent: USDC zero");
        require(_agt        != address(0), "SuperAgent: AGT zero");
        require(_treasury   != address(0), "SuperAgent: Treasury zero");
        require(_swapRouter != address(0), "SuperAgent: Router zero");

        usdc          = IERC20(_usdc);
        agt           = IERC20Burnable(_agt);
        treasury      = _treasury;
        swapRouter    = ISwapRouter(_swapRouter);
        poolFee       = _poolFee;
        minBurnAmount = 10_000_000; // 10 USDC default minimum before executing a swap
    }

    // ── Registration ──────────────────────────────────────────────────────────

    /**
     * @notice Register as a Super Agent. Costs 50 USDC.
     *         Caller must approve this contract for 50 USDC first.
     * @param referrer Address of the agent who referred you (address(0) for none).
     */
    function register(address referrer) external nonReentrant whenNotPaused {
        require(!agents[msg.sender].registered, "SuperAgent: already registered");
        require(msg.sender != referrer,          "SuperAgent: self-referral");

        // Pull USDC from registrant (SafeERC20 — reverts on failure)
        usdc.safeTransferFrom(msg.sender, address(this), REGISTRATION_FEE);

        // ── Resolve referral chain ────────────────────────────────────────────
        // Level 1: must be a registered agent
        address l1 = (referrer != address(0) && agents[referrer].registered)
            ? referrer
            : address(0);

        // Level 2: l1's recruiter — guard against circular referral (A→B→A)
        address l2 = address(0);
        if (l1 != address(0)) {
            address candidate = agents[l1].referrer;
            if (candidate != address(0) && candidate != msg.sender) {
                l2 = candidate;
            }
        }

        // ── Calculate amounts ─────────────────────────────────────────────────
        uint256 burnAmt     = (REGISTRATION_FEE * BURN_BPS)   / TOTAL_BPS; // $12.50
        uint256 l1Amt       = (REGISTRATION_FEE * LEVEL1_BPS) / TOTAL_BPS; // $12.50
        uint256 l2Amt       = (REGISTRATION_FEE * LEVEL2_BPS) / TOTAL_BPS; // $5.00
        // Treasury gets 40% base; gains the cut of any absent referrer level
        uint256 treasuryAmt = REGISTRATION_FEE - burnAmt - l1Amt - l2Amt;  // $20.00

        // ── Store agent (effects before interactions) ─────────────────────────
        agents[msg.sender] = Agent({
            registered:     true,
            referrer:       l1,
            registeredAt:   block.timestamp,
            referralEarned: 0
        });
        agentList.push(msg.sender);
        totalRegistrations++;
        burnAccumulator += burnAmt;

        // ── Distribute referral commissions ───────────────────────────────────
        if (l1 != address(0)) {
            agents[l1].referralEarned += l1Amt;
            totalReferralsPaid        += l1Amt;
            usdc.safeTransfer(l1, l1Amt);
            emit ReferralPaid(l1, msg.sender, 1, l1Amt);
        } else {
            treasuryAmt += l1Amt;
        }

        if (l2 != address(0)) {
            agents[l2].referralEarned += l2Amt;
            totalReferralsPaid        += l2Amt;
            usdc.safeTransfer(l2, l2Amt);
            emit ReferralPaid(l2, msg.sender, 2, l2Amt);
        } else {
            treasuryAmt += l2Amt;
        }

        usdc.safeTransfer(treasury, treasuryAmt);

        emit AgentRegistered(msg.sender, l1, l2, REGISTRATION_FEE);
    }

    // ── Buy-and-Burn ──────────────────────────────────────────────────────────

    /**
     * @notice Swap accumulated USDC for AGT on Uniswap V3 and permanently burn it.
     *
     * Phase 1 (publicBurnEnabled = false): only owner can call.
     *   Owner should use an off-chain Uniswap V3 quoter to compute amountOutMinimum
     *   and execute monthly to avoid sandwich attacks on low-liquidity pools.
     *
     * Phase 2 (publicBurnEnabled = true): anyone can call.
     *   Enable via setBurnPublic() when pool liquidity exceeds ~$10k.
     *
     * @param amountOutMinimum Minimum AGT to receive (slippage protection).
     *                         Compute via Uniswap Quoter off-chain before calling.
     *                         Pass 0 only on testnet / local forks.
     */
    function executeBuyAndBurn(uint256 amountOutMinimum) external nonReentrant whenNotPaused {
        require(publicBurnEnabled || msg.sender == owner(), "SuperAgent: burn not public yet");

        uint256 toSpend = burnAccumulator;
        require(toSpend > 0,              "SuperAgent: nothing to burn");
        require(toSpend >= minBurnAmount, "SuperAgent: accumulator below minimum");

        // Effects before interactions (CEI pattern)
        burnAccumulator = 0;

        // Approve router — reset first to avoid residual allowance issues,
        // then set exact amount needed. forceApprove handles non-standard tokens.
        usdc.forceApprove(address(swapRouter), toSpend);

        // Swap USDC → AGT, receive AGT to this contract
        uint256 agtReceived = swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn:           address(usdc),
                tokenOut:          address(agt),
                fee:               poolFee,
                recipient:         address(this),
                amountIn:          toSpend,
                amountOutMinimum:  amountOutMinimum,
                sqrtPriceLimitX96: 0
            })
        );

        // Revoke any residual USDC allowance for the router
        usdc.forceApprove(address(swapRouter), 0);

        // Burn all received AGT permanently
        agt.burn(agtReceived);
        totalAGTBurned += agtReceived;

        emit BuyAndBurnExecuted(toSpend, agtReceived);
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    /**
     * @notice Open burn execution to the public.
     *         Call when Uniswap pool liquidity exceeds ~$10,000.
     *         This action is irreversible — once public, it cannot be restricted again.
     */
    function setBurnPublic() external onlyOwner {
        require(!publicBurnEnabled, "SuperAgent: already public");
        publicBurnEnabled = true;
        emit BurnPublicEnabled();
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "SuperAgent: zero address");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function setSwapRouter(address _router) external onlyOwner {
        require(_router != address(0), "SuperAgent: zero address");
        swapRouter = ISwapRouter(_router);
        emit RouterUpdated(_router);
    }

    /// @notice Valid Uniswap V3 fee tiers on Base: 500 (0.05%), 3000 (0.3%), 10000 (1%)
    function setPoolFee(uint24 _fee) external onlyOwner {
        poolFee = _fee;
        emit PoolFeeUpdated(_fee);
    }

    /**
     * @notice Set the minimum USDC accumulation before a burn can be triggered.
     * @param _min Capped at MAX_MIN_BURN (200 USDC) to prevent permanent lock.
     */
    function setMinBurnAmount(uint256 _min) external onlyOwner {
        require(_min <= MAX_MIN_BURN, "SuperAgent: min exceeds cap");
        minBurnAmount = _min;
        emit MinBurnAmountUpdated(_min);
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /**
     * @notice Emergency: recover any ERC-20 accidentally sent to this contract.
     *         Cannot drain the burn accumulator — those USDC belong to the protocol.
     */
    function recoverToken(address token, uint256 amount) external onlyOwner {
        if (token == address(usdc)) {
            uint256 free = usdc.balanceOf(address(this)) - burnAccumulator;
            require(amount <= free, "SuperAgent: cannot drain burn accumulator");
        }
        IERC20(token).safeTransfer(owner(), amount);
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    function getAgent(address agent) external view returns (
        bool registered, address referrer, uint256 registeredAt, uint256 referralEarned
    ) {
        Agent storage a = agents[agent];
        return (a.registered, a.referrer, a.registeredAt, a.referralEarned);
    }

    function getReferralChain(address agent) external view returns (address l1, address l2) {
        l1 = agents[agent].referrer;
        l2 = l1 != address(0) ? agents[l1].referrer : address(0);
    }

    function isRegistered(address agent) external view returns (bool) {
        return agents[agent].registered;
    }

    function protocolStats() external view returns (
        uint256 registrations,
        uint256 referralsPaidUsdc,
        uint256 burnPendingUsdc,
        uint256 agtBurnedWei
    ) {
        return (totalRegistrations, totalReferralsPaid, burnAccumulator, totalAGTBurned);
    }
}
