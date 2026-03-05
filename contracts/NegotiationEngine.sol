// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AgentRegistry.sol";
import "./Marketplace.sol";
import "./ReputationSystem.sol";
import "./AutonomousAgreement.sol";

/**
 * @title NegotiationEngine
 * @notice On-chain negotiation between agents: propose, counter-offer, accept or reject.
 *         When a proposal is accepted an AutonomousAgreement contract is deployed automatically.
 *         Max 5 counter-offers per negotiation chain. Proposals expire in 24 hours.
 */
contract NegotiationEngine {
    AgentRegistry public immutable registry;
    Marketplace public immutable marketplace;
    ReputationSystem public immutable reputation;

    uint256 public constant PROPOSAL_TTL = 24 hours;
    uint256 public constant MAX_COUNTERS = 5;

    enum ProposalStatus { Pending, Accepted, Rejected, Expired, Countered }

    struct Proposal {
        uint256 needId;
        uint256 offerId;
        address buyer;        // need publisher
        address seller;       // offer publisher
        uint256 price;        // agreed/proposed price in AGT wei
        string terms;
        ProposalStatus status;
        uint256 createdAt;
        uint256 counterDepth; // how deep in the chain (0 = original)
        uint256 parentId;     // 0 if original proposal
    }

    Proposal[] private proposals;

    /// @notice Track deployed agreement contracts per proposal
    mapping(uint256 => address) public proposalAgreement;

    event ProposalCreated(uint256 indexed proposalId, uint256 needId, uint256 offerId, address buyer, address seller, uint256 price);
    event CounterOffered(uint256 indexed newProposalId, uint256 indexed parentProposalId, uint256 newPrice);
    event ProposalAccepted(uint256 indexed proposalId, address agreementContract);
    event ProposalRejected(uint256 indexed proposalId, address indexed by);

    modifier onlyRegistered() {
        require(registry.isRegistered(msg.sender), "NegotiationEngine: not registered");
        _;
    }

    constructor(address _registry, address _marketplace, address _reputation) {
        registry = AgentRegistry(_registry);
        marketplace = Marketplace(_marketplace);
        reputation = ReputationSystem(_reputation);
    }

    /**
     * @notice Create a new proposal linking a need with an offer at a given price.
     * @dev Buyer initiates — they must be the need publisher.
     */
    function propose(
        uint256 needId,
        uint256 offerId,
        uint256 price,
        string calldata terms
    ) external onlyRegistered returns (uint256 proposalId) {
        Marketplace.Need memory need = marketplace.getNeed(needId);
        Marketplace.Offer memory offer = marketplace.getOffer(offerId);

        require(need.active, "NegotiationEngine: need not active");
        require(offer.active, "NegotiationEngine: offer not active");
        require(need.publisher == msg.sender, "NegotiationEngine: only need publisher can propose");
        require(price > 0, "NegotiationEngine: price must be positive");
        require(price <= need.budget, "NegotiationEngine: price exceeds budget");

        proposalId = proposals.length;
        proposals.push(Proposal({
            needId: needId,
            offerId: offerId,
            buyer: msg.sender,
            seller: offer.publisher,
            price: price,
            terms: terms,
            status: ProposalStatus.Pending,
            createdAt: block.timestamp,
            counterDepth: 0,
            parentId: 0
        }));

        emit ProposalCreated(proposalId, needId, offerId, msg.sender, offer.publisher, price);
    }

    /**
     * @notice Submit a counter-offer to an existing pending proposal.
     * @dev Either party can counter. Max MAX_COUNTERS deep.
     */
    function counterOffer(
        uint256 proposalId,
        uint256 newPrice,
        string calldata newTerms
    ) external onlyRegistered returns (uint256 newProposalId) {
        Proposal storage parent = proposals[proposalId];

        require(parent.status == ProposalStatus.Pending, "NegotiationEngine: proposal not pending");
        require(!_isExpired(parent), "NegotiationEngine: proposal expired");
        require(
            msg.sender == parent.buyer || msg.sender == parent.seller,
            "NegotiationEngine: not a party"
        );
        require(parent.counterDepth < MAX_COUNTERS, "NegotiationEngine: max counter-offers reached");
        require(newPrice > 0, "NegotiationEngine: price must be positive");

        // Mark parent as countered
        parent.status = ProposalStatus.Countered;

        newProposalId = proposals.length;
        proposals.push(Proposal({
            needId: parent.needId,
            offerId: parent.offerId,
            buyer: parent.buyer,
            seller: parent.seller,
            price: newPrice,
            terms: newTerms,
            status: ProposalStatus.Pending,
            createdAt: block.timestamp,
            counterDepth: parent.counterDepth + 1,
            parentId: proposalId
        }));

        emit CounterOffered(newProposalId, proposalId, newPrice);
    }

    /**
     * @notice Accept a pending proposal → deploys an AutonomousAgreement.
     * @dev Only the non-initiating party can accept (seller accepts buyer's proposal and vice versa).
     */
    function acceptProposal(uint256 proposalId) external onlyRegistered returns (address agreement) {
        Proposal storage proposal = proposals[proposalId];

        require(proposal.status == ProposalStatus.Pending, "NegotiationEngine: proposal not pending");
        require(!_isExpired(proposal), "NegotiationEngine: proposal expired");
        require(
            msg.sender == proposal.buyer || msg.sender == proposal.seller,
            "NegotiationEngine: not a party"
        );

        proposal.status = ProposalStatus.Accepted;

        // Deploy AutonomousAgreement for this deal
        Marketplace.Need memory need = marketplace.getNeed(proposal.needId);

        agreement = address(new AutonomousAgreement(
            proposal.buyer,
            proposal.seller,
            proposal.price,
            proposal.terms,
            need.deadline,
            address(registry.token()),
            address(reputation),
            marketplace.treasury()
        ));

        // Authorize the agreement to record reputation outcomes
        reputation.authorizeContract(agreement);

        // Mark the need as fulfilled
        marketplace.fulfillNeed(proposal.needId, proposal.offerId);

        proposalAgreement[proposalId] = agreement;

        emit ProposalAccepted(proposalId, agreement);
    }

    /**
     * @notice Reject a pending proposal.
     */
    function rejectProposal(uint256 proposalId) external onlyRegistered {
        Proposal storage proposal = proposals[proposalId];

        require(proposal.status == ProposalStatus.Pending, "NegotiationEngine: proposal not pending");
        require(
            msg.sender == proposal.buyer || msg.sender == proposal.seller,
            "NegotiationEngine: not a party"
        );

        proposal.status = ProposalStatus.Rejected;

        emit ProposalRejected(proposalId, msg.sender);
    }

    // ── Views ──────────────────────────────────────────────────────────────

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return proposals[proposalId];
    }

    function totalProposals() external view returns (uint256) {
        return proposals.length;
    }

    function _isExpired(Proposal storage p) internal view returns (bool) {
        return block.timestamp > p.createdAt + PROPOSAL_TTL;
    }
}
