// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AgentToken.sol";

/**
 * @title AgentRegistry
 * @notice Decentralized registry for AI agents joining the economy.
 *         Any address (controlled by an AI agent) can register, paying a small
 *         AGT entry fee and receiving welcome tokens in return.
 */
contract AgentRegistry {
    AgentToken public immutable token;

    /// @notice Entry fee to register (10 AGT) — prevents spam
    uint256 public constant ENTRY_FEE = 10 * 10 ** 18;

    struct Agent {
        string name;
        string[] capabilities;
        string metadataURI;
        uint256 registeredAt;
        bool active;
    }

    mapping(address => Agent) private agents;
    address[] private agentList;

    event AgentRegistered(address indexed agent, string name, string[] capabilities);
    event AgentDeactivated(address indexed agent);
    event CapabilitiesUpdated(address indexed agent, string[] capabilities);

    constructor(address _token) {
        token = AgentToken(_token);
    }

    /**
     * @notice Register as a new agent in the economy.
     * @param name       Human-readable name for the agent.
     * @param capabilities Array of capability tags (e.g. ["data", "analysis"]).
     * @param metadataURI  Optional URI pointing to extended agent metadata.
     * @dev Requires prior approval of ENTRY_FEE AGT to this contract.
     *      Welcome tokens (1000 AGT) are automatically dispensed via faucet.
     */
    function registerAgent(
        string calldata name,
        string[] calldata capabilities,
        string calldata metadataURI
    ) external {
        require(!agents[msg.sender].active, "AgentRegistry: already registered");
        require(bytes(name).length > 0, "AgentRegistry: name required");
        require(capabilities.length > 0, "AgentRegistry: at least one capability required");

        // Collect entry fee
        bool ok = token.transferFrom(msg.sender, address(this), ENTRY_FEE);
        require(ok, "AgentRegistry: fee transfer failed");

        // Register agent
        agents[msg.sender] = Agent({
            name: name,
            capabilities: capabilities,
            metadataURI: metadataURI,
            registeredAt: block.timestamp,
            active: true
        });
        agentList.push(msg.sender);

        // Dispense welcome tokens
        token.faucet(msg.sender);

        emit AgentRegistered(msg.sender, name, capabilities);
    }

    /**
     * @notice Update the calling agent's capability list.
     */
    function updateCapabilities(string[] calldata capabilities) external {
        require(agents[msg.sender].active, "AgentRegistry: not registered");
        require(capabilities.length > 0, "AgentRegistry: at least one capability required");
        agents[msg.sender].capabilities = capabilities;
        emit CapabilitiesUpdated(msg.sender, capabilities);
    }

    /**
     * @notice Deactivate the calling agent (voluntary exit).
     */
    function deactivate() external {
        require(agents[msg.sender].active, "AgentRegistry: not registered");
        agents[msg.sender].active = false;
        emit AgentDeactivated(msg.sender);
    }

    // ── Views ──────────────────────────────────────────────────────────────

    function getAgent(address agent) external view returns (Agent memory) {
        return agents[agent];
    }

    function isRegistered(address agent) external view returns (bool) {
        return agents[agent].active;
    }

    function getAllAgents() external view returns (address[] memory) {
        return agentList;
    }

    function getActiveAgents() external view returns (address[] memory) {
        uint256 count;
        for (uint256 i = 0; i < agentList.length; i++) {
            if (agents[agentList[i]].active) count++;
        }
        address[] memory active = new address[](count);
        uint256 idx;
        for (uint256 i = 0; i < agentList.length; i++) {
            if (agents[agentList[i]].active) {
                active[idx++] = agentList[i];
            }
        }
        return active;
    }

    function totalRegistered() external view returns (uint256) {
        return agentList.length;
    }
}
