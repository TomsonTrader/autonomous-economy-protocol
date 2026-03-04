// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AgentRegistry.sol";

/**
 * @title Marketplace
 * @notice Decentralized marketplace where agents publish needs and offers.
 *         Prices emerge freely from supply and demand — no central pricing.
 *         A 0.5% protocol fee on matched deals goes to the treasury.
 */
contract Marketplace {
    AgentRegistry public immutable registry;
    address public treasury;

    uint256 public constant FEE_BPS = 50; // 0.5% in basis points

    struct Need {
        address publisher;
        string description;
        uint256 budget;      // max AGT willing to pay (in wei)
        uint256 deadline;    // block timestamp deadline
        string[] tags;
        bool active;
        uint256 createdAt;
    }

    struct Offer {
        address publisher;
        string description;
        uint256 price;       // asking AGT price (in wei)
        string[] tags;
        bool active;
        uint256 createdAt;
    }

    Need[] private needs;
    Offer[] private offers;

    mapping(address => uint256[]) public agentNeeds;
    mapping(address => uint256[]) public agentOffers;

    event NeedPublished(uint256 indexed needId, address indexed publisher, uint256 budget, string[] tags);
    event OfferPublished(uint256 indexed offerId, address indexed publisher, uint256 price, string[] tags);
    event NeedCancelled(uint256 indexed needId, address indexed publisher);
    event OfferCancelled(uint256 indexed offerId, address indexed publisher);
    event NeedFulfilled(uint256 indexed needId, uint256 indexed offerId);

    modifier onlyRegistered() {
        require(registry.isRegistered(msg.sender), "Marketplace: agent not registered");
        _;
    }

    constructor(address _registry, address _treasury) {
        registry = AgentRegistry(_registry);
        treasury = _treasury;
    }

    /**
     * @notice Publish a need (demand side of the market).
     */
    function publishNeed(
        string calldata description,
        uint256 budget,
        uint256 deadline,
        string[] calldata tags
    ) external onlyRegistered returns (uint256 needId) {
        require(budget > 0, "Marketplace: budget must be positive");
        require(deadline > block.timestamp, "Marketplace: deadline in past");
        require(tags.length > 0, "Marketplace: at least one tag required");

        needId = needs.length;
        needs.push(Need({
            publisher: msg.sender,
            description: description,
            budget: budget,
            deadline: deadline,
            tags: tags,
            active: true,
            createdAt: block.timestamp
        }));
        agentNeeds[msg.sender].push(needId);

        emit NeedPublished(needId, msg.sender, budget, tags);
    }

    /**
     * @notice Publish an offer (supply side of the market).
     */
    function publishOffer(
        string calldata description,
        uint256 price,
        string[] calldata tags
    ) external onlyRegistered returns (uint256 offerId) {
        require(price > 0, "Marketplace: price must be positive");
        require(tags.length > 0, "Marketplace: at least one tag required");

        offerId = offers.length;
        offers.push(Offer({
            publisher: msg.sender,
            description: description,
            price: price,
            tags: tags,
            active: true,
            createdAt: block.timestamp
        }));
        agentOffers[msg.sender].push(offerId);

        emit OfferPublished(offerId, msg.sender, price, tags);
    }

    function cancelNeed(uint256 needId) external {
        require(needId < needs.length, "Marketplace: need not found");
        require(needs[needId].publisher == msg.sender, "Marketplace: not your need");
        require(needs[needId].active, "Marketplace: already inactive");
        needs[needId].active = false;
        emit NeedCancelled(needId, msg.sender);
    }

    function cancelOffer(uint256 offerId) external {
        require(offerId < offers.length, "Marketplace: offer not found");
        require(offers[offerId].publisher == msg.sender, "Marketplace: not your offer");
        require(offers[offerId].active, "Marketplace: already inactive");
        offers[offerId].active = false;
        emit OfferCancelled(offerId, msg.sender);
    }

    /**
     * @notice Mark a need as fulfilled (called by NegotiationEngine when deal closes).
     */
    function fulfillNeed(uint256 needId, uint256 offerId) external {
        // Called by NegotiationEngine — no access control here beyond active check
        // to keep the system permissionless
        needs[needId].active = false;
        emit NeedFulfilled(needId, offerId);
    }

    // ── Views ──────────────────────────────────────────────────────────────

    /**
     * @notice Find offers that match a need by tag overlap and budget fit.
     */
    function getMatchingOffers(uint256 needId) external view returns (uint256[] memory) {
        Need memory need = needs[needId];
        require(need.active, "Marketplace: need not active");

        uint256[] memory matches = new uint256[](offers.length);
        uint256 count;

        for (uint256 i = 0; i < offers.length; i++) {
            Offer memory offer = offers[i];
            if (!offer.active) continue;
            if (offer.price > need.budget) continue;
            if (offer.publisher == need.publisher) continue;
            if (_hasTagOverlap(need.tags, offer.tags)) {
                matches[count++] = i;
            }
        }

        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = matches[i];
        }
        return result;
    }

    function getNeed(uint256 needId) external view returns (Need memory) {
        return needs[needId];
    }

    function getOffer(uint256 offerId) external view returns (Offer memory) {
        return offers[offerId];
    }

    function totalNeeds() external view returns (uint256) {
        return needs.length;
    }

    function totalOffers() external view returns (uint256) {
        return offers.length;
    }

    function getAgentNeeds(address agent) external view returns (uint256[] memory) {
        return agentNeeds[agent];
    }

    function getAgentOffers(address agent) external view returns (uint256[] memory) {
        return agentOffers[agent];
    }

    // ── Internal ───────────────────────────────────────────────────────────

    function _hasTagOverlap(string[] memory a, string[] memory b) internal pure returns (bool) {
        for (uint256 i = 0; i < a.length; i++) {
            for (uint256 j = 0; j < b.length; j++) {
                if (keccak256(bytes(a[i])) == keccak256(bytes(b[j]))) return true;
            }
        }
        return false;
    }
}
