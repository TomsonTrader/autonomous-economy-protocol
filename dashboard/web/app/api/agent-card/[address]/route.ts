/**
 * AgentCard endpoint — Google A2A format
 * GET /api/agent-card/[address]
 *
 * Returns a standardized AgentCard JSON that any A2A-compatible agent
 * can use to discover and interact with this AEP agent.
 * Spec: https://google.github.io/A2A/
 */

import { NextRequest, NextResponse } from "next/server";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://autonomous-economy-protocol-production.up.railway.app";

export async function GET(
  _req: NextRequest,
  { params }: { params: { address: string } }
) {
  const { address } = params;

  try {
    const [agentRes, repRes] = await Promise.all([
      fetch(`${API}/api/agents/${address}`, { cache: "no-store" }),
      fetch(`${API}/api/agents/${address}/reputation`, { cache: "no-store" }),
    ]);

    if (!agentRes.ok) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const agent = await agentRes.json();
    const rep   = repRes.ok ? await repRes.json() : { score: "0", totalDeals: "0" };

    // Google A2A AgentCard format
    const agentCard = {
      "@type":       "AgentCard",
      "name":        agent.name,
      "description": `AEP agent with capabilities: ${(agent.capabilities ?? []).join(", ")}. Reputation score: ${parseFloat(rep.score ?? "0").toFixed(1)}. Total deals: ${rep.totalDeals ?? 0}.`,
      "url":         `https://aepprotocol.xyz/agent/${address}`,
      "version":     "1.0",
      "capabilities": {
        "streaming":       false,
        "pushNotifications": false,
        "stateTransitionHistory": true,
      },
      "defaultInputModes":  ["text/plain", "application/json"],
      "defaultOutputModes": ["text/plain", "application/json"],
      "skills": (agent.capabilities ?? []).map((cap: string) => ({
        "id":          cap,
        "name":        cap.replace(/-/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
        "description": `${cap} service available via AEP NegotiationEngine`,
        "tags":        [cap, "aep", "base-mainnet", "autonomous"],
        "examples":    [`Hire this agent for ${cap} tasks via AEP marketplace`],
      })),
      "aep": {
        "address":        address,
        "network":        "base-mainnet",
        "chainId":        8453,
        "registry":       "0x601125818d16cb78dD239Bce2c821a588B06d978",
        "marketplace":    "0x1D3d45107f30aF47bF6b4FfbA817bA8B4a91f44c",
        "reputationScore": parseFloat(rep.score ?? "0"),
        "totalDeals":     parseInt(rep.totalDeals ?? "0"),
        "active":         agent.active ?? false,
        "profileUrl":     `https://aepprotocol.xyz/agent/${address}`,
        "sdkDocs":        "https://www.npmjs.com/package/autonomous-economy-sdk",
      },
    };

    return NextResponse.json(agentCard, {
      headers: {
        "Content-Type":                "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control":               "public, max-age=60",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
