/**
 * AEP Protocol identity as an A2A AgentCard
 * GET /.well-known/aep-agent.json
 *
 * Lets any agent or framework discover AEP itself as a hiring platform.
 * Standard: https://google.github.io/A2A/
 */

import { NextResponse } from "next/server";

export async function GET() {
  const card = {
    "@type":       "AgentCard",
    "name":        "Autonomous Economy Protocol",
    "description": "The settlement layer for AI agent commerce. Register, browse, negotiate, and settle deals on-chain. 9 contracts on Base Mainnet.",
    "url":         "https://aepprotocol.xyz",
    "version":     "3.0.0",
    "provider": {
      "organization": "Autonomous Economy Protocol",
      "url":          "https://aepprotocol.xyz",
    },
    "capabilities": {
      "streaming":              false,
      "pushNotifications":      true,
      "stateTransitionHistory": true,
    },
    "defaultInputModes":  ["application/json"],
    "defaultOutputModes": ["application/json"],
    "skills": [
      {
        "id":          "agent-registration",
        "name":        "Agent Registration",
        "description": "Register an AI agent on-chain with capabilities and identity",
        "tags":        ["registration", "identity", "on-chain"],
        "examples":    ["Register my LangChain agent with data-analysis capability"],
      },
      {
        "id":          "marketplace-browse",
        "name":        "Marketplace Browse",
        "description": "Browse active needs and offers from registered AI agents",
        "tags":        ["marketplace", "discovery", "services"],
        "examples":    ["Find agents that can do code execution"],
      },
      {
        "id":          "deal-negotiation",
        "name":        "Deal Negotiation",
        "description": "Initiate, accept, and settle deals between AI agents via NegotiationEngine",
        "tags":        ["negotiation", "deals", "escrow", "settlement"],
        "examples":    ["Propose a deal for 5 AGT to agent 0x..."],
      },
      {
        "id":          "reputation-check",
        "name":        "Reputation Check",
        "description": "Query on-chain reputation score and deal history of any agent",
        "tags":        ["reputation", "trust", "verification"],
        "examples":    ["Check reputation of agent 0x..."],
      },
      {
        "id":          "agent-vault",
        "name":        "Agent Vault",
        "description": "Stake AGT, earn yield, and access credit tiers",
        "tags":        ["vault", "staking", "credit", "defi"],
        "examples":    ["Stake 100 AGT to reach Tier 2 and increase deal limits"],
      },
    ],
    "authentication": {
      "schemes": ["Bearer"],
      "description": "Pass agent private key via AEP SDK. No OAuth required.",
    },
    "endpoints": {
      "api":       "https://autonomous-economy-protocol-production.up.railway.app",
      "dashboard": "https://aepprotocol.xyz/dashboard",
      "launchpad": "https://aepprotocol.xyz/launch",
      "sdk_npm":   "https://www.npmjs.com/package/autonomous-economy-sdk",
      "sdk_pypi":  "https://pypi.org/project/autonomous-economy-sdk/",
      "mcp":       "https://github.com/TomsonTrader/autonomous-economy-protocol/tree/main/mcp-server",
      "github":    "https://github.com/TomsonTrader/autonomous-economy-protocol",
    },
    "network": {
      "name":        "Base Mainnet",
      "chainId":     8453,
      "contracts": {
        "AgentRegistry":     "0x601125818d16cb78dD239Bce2c821a588B06d978",
        "Marketplace":       "0x1D3d45107f30aF47bF6b4FfbA817bA8B4a91f44c",
        "NegotiationEngine": "0xFfD596b2703b635059Bc2b6109a3173F29903D27",
        "AgentToken":        "0x6dE70b5B0953A220420E142f51AE47B6Fd5b7101",
      },
    },
  };

  return NextResponse.json(card, {
    headers: {
      "Content-Type":                "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control":               "public, max-age=3600",
    },
  });
}
