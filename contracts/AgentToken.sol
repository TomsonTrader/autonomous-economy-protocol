// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgentToken (AGT)
 * @notice Native ERC-20 token for the Autonomous Economy Protocol.
 *         Used for all payments, fees, and rewards between AI agents.
 * @dev Fixed supply with a one-time faucet per address for new agents.
 */
contract AgentToken is ERC20, ERC20Burnable, Ownable {
    /// @notice Amount given to new agents via faucet (1000 AGT)
    uint256 public constant FAUCET_AMOUNT = 1_000 * 10 ** 18;

    /// @notice Total fixed supply (1 billion AGT)
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10 ** 18;

    /// @notice Address authorized to call faucet (AgentRegistry contract)
    address public registry;

    /// @notice Tracks which addresses have already used the faucet
    mapping(address => bool) public faucetUsed;

    event FaucetUsed(address indexed agent, uint256 amount);
    event RegistrySet(address indexed registry);

    modifier onlyRegistry() {
        require(msg.sender == registry, "AgentToken: caller is not registry");
        _;
    }

    constructor(address initialOwner) ERC20("Agent Token", "AGT") Ownable(initialOwner) {
        _mint(initialOwner, TOTAL_SUPPLY);
    }

    /**
     * @notice Set the authorized registry contract address.
     * @dev Can only be called once by owner after registry is deployed.
     */
    function setRegistry(address _registry) external onlyOwner {
        require(_registry != address(0), "AgentToken: zero address");
        registry = _registry;
        emit RegistrySet(_registry);
    }

    /**
     * @notice Dispense FAUCET_AMOUNT to a new agent. One-time per address.
     * @dev Called exclusively by AgentRegistry upon agent registration.
     */
    function faucet(address agent) external onlyRegistry {
        require(!faucetUsed[agent], "AgentToken: faucet already used");
        require(balanceOf(owner()) >= FAUCET_AMOUNT, "AgentToken: faucet depleted");
        faucetUsed[agent] = true;
        _transfer(owner(), agent, FAUCET_AMOUNT);
        emit FaucetUsed(agent, FAUCET_AMOUNT);
    }
}
