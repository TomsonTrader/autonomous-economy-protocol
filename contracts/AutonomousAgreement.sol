// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ReputationSystem.sol";

/**
 * @title AutonomousAgreement
 * @notice Self-executing escrow contract between two AI agents.
 *         Deployed by NegotiationEngine when a proposal is accepted.
 *
 *         Flow:
 *         1. Buyer sends AGT to this contract (fund()).
 *         2. Seller delivers service off-chain / on-chain.
 *         3. Buyer calls confirmDelivery() → payment released to seller.
 *         4. If buyer disputes within DISPUTE_WINDOW → 50/50 split (libertarian resolution).
 *         5. If buyer never confirms after deadline + GRACE_PERIOD → seller claims via claimTimeout().
 */
contract AutonomousAgreement {
    IERC20 public immutable token;
    ReputationSystem public immutable reputation;

    address public immutable buyer;
    address public immutable seller;
    address public immutable treasury;
    uint256 public immutable paymentAmount; // AGT wei
    string public terms;
    uint256 public immutable deadline;

    uint256 public constant FEE_BPS = 50; // 0.5% protocol fee

    uint256 public constant DISPUTE_WINDOW = 72 hours;
    uint256 public constant GRACE_PERIOD = 7 days;

    enum State { Awaiting, Funded, Delivered, Disputed, Completed, Refunded }

    State public state;
    uint256 public fundedAt;
    uint256 public deliveredAt;

    event Funded(address indexed buyer, uint256 amount);
    event DeliveryConfirmed(address indexed buyer);
    event DisputeRaised(address indexed raiser);
    event PaymentReleased(address indexed seller, uint256 amount);
    event DisputeResolved(uint256 buyerAmount, uint256 sellerAmount);
    event TimeoutClaimed(address indexed seller);

    modifier onlyBuyer() {
        require(msg.sender == buyer, "Agreement: caller is not buyer");
        _;
    }

    modifier onlySeller() {
        require(msg.sender == seller, "Agreement: caller is not seller");
        _;
    }

    modifier onlyParty() {
        require(msg.sender == buyer || msg.sender == seller, "Agreement: not a party");
        _;
    }

    constructor(
        address _buyer,
        address _seller,
        uint256 _paymentAmount,
        string memory _terms,
        uint256 _deadline,
        address _agentToken,
        address _reputation,
        address _treasury
    ) {
        buyer = _buyer;
        seller = _seller;
        treasury = _treasury;
        paymentAmount = _paymentAmount;
        terms = _terms;
        deadline = _deadline;
        token = IERC20(_agentToken);
        reputation = ReputationSystem(_reputation);
        state = State.Awaiting;
    }

    /**
     * @notice Buyer funds the escrow by transferring AGT to this contract.
     * @dev Requires prior ERC-20 approval of paymentAmount.
     */
    function fund() external onlyBuyer {
        require(state == State.Awaiting, "Agreement: not awaiting funds");
        bool ok = token.transferFrom(msg.sender, address(this), paymentAmount);
        require(ok, "Agreement: transfer failed");
        state = State.Funded;
        fundedAt = block.timestamp;
        emit Funded(msg.sender, paymentAmount);
    }

    /**
     * @notice Buyer confirms delivery → releases full payment to seller.
     */
    function confirmDelivery() external onlyBuyer {
        require(state == State.Funded, "Agreement: not funded");
        state = State.Completed;

        // Record successful outcome for both parties
        reputation.recordOutcome(seller, true, paymentAmount, fundedAt);
        reputation.recordOutcome(buyer, true, paymentAmount, fundedAt);

        // Deduct 0.5% protocol fee → treasury
        uint256 fee = (paymentAmount * FEE_BPS) / 10_000;
        uint256 sellerAmount = paymentAmount - fee;

        if (fee > 0 && treasury != address(0)) {
            token.transfer(treasury, fee);
        }
        bool ok = token.transfer(seller, sellerAmount);
        require(ok, "Agreement: payment failed");

        emit DeliveryConfirmed(msg.sender);
        emit PaymentReleased(seller, sellerAmount);
    }

    /**
     * @notice Either party raises a dispute.
     *         Libertarian resolution: 50/50 split, no arbitration.
     * @dev Must be raised within DISPUTE_WINDOW after funding.
     */
    function raiseDispute() external onlyParty {
        require(state == State.Funded, "Agreement: not funded");
        require(block.timestamp <= fundedAt + DISPUTE_WINDOW, "Agreement: dispute window closed");

        state = State.Disputed;

        // Record failed outcome for both (dispute = bad for everyone)
        reputation.recordOutcome(buyer, false, paymentAmount, fundedAt);
        reputation.recordOutcome(seller, false, paymentAmount, fundedAt);

        uint256 half = paymentAmount / 2;
        uint256 remainder = paymentAmount - half;

        token.transfer(buyer, half);
        token.transfer(seller, remainder);

        emit DisputeRaised(msg.sender);
        emit DisputeResolved(half, remainder);
    }

    /**
     * @notice Seller claims payment if buyer never confirmed after deadline + grace period.
     */
    function claimTimeout() external onlySeller {
        require(state == State.Funded, "Agreement: not funded");
        require(block.timestamp > deadline + GRACE_PERIOD, "Agreement: grace period not over");

        state = State.Completed;

        reputation.recordOutcome(seller, true, paymentAmount, fundedAt);
        reputation.recordOutcome(buyer, false, paymentAmount, fundedAt);

        uint256 fee = (paymentAmount * FEE_BPS) / 10_000;
        uint256 sellerAmount = paymentAmount - fee;

        if (fee > 0 && treasury != address(0)) {
            token.transfer(treasury, fee);
        }
        bool ok = token.transfer(seller, sellerAmount);
        require(ok, "Agreement: payment failed");

        emit TimeoutClaimed(seller);
        emit PaymentReleased(seller, sellerAmount);
    }

    /**
     * @notice Returns the current balance held in escrow.
     */
    function escrowBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
}
