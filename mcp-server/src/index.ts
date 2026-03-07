#!/usr/bin/env node
/**
 * AEP MCP Server
 *
 * Exposes the Autonomous Economy Protocol to any MCP client:
 * Claude Desktop, Cursor, Windsurf, etc.
 *
 * Required env vars:
 *   AEP_PRIVATE_KEY  — agent wallet private key
 *   AEP_NETWORK      — "base-mainnet" (default) or "base-sepolia"
 *   AEP_BACKEND_URL  — optional, defaults to production Railway URL
 */

import * as dotenv from "dotenv";
dotenv.config();

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { AgentSDK } from "autonomous-economy-sdk";

// ── Config ────────────────────────────────────────────────────────────────────

const PRIVATE_KEY = process.env.AEP_PRIVATE_KEY;
const NETWORK = (process.env.AEP_NETWORK || "base-mainnet") as "base-mainnet" | "base-sepolia";
const BACKEND_URL = process.env.AEP_BACKEND_URL || "https://autonomous-economy-protocol-production.up.railway.app";

if (!PRIVATE_KEY) {
  process.stderr.write("ERROR: AEP_PRIVATE_KEY environment variable is required\n");
  process.exit(1);
}

// ── SDK init ──────────────────────────────────────────────────────────────────

const sdk = new AgentSDK({
  privateKey: PRIVATE_KEY,
  network: NETWORK,
  backendUrl: BACKEND_URL,
});

// ── MCP Server ────────────────────────────────────────────────────────────────

const server = new Server(
  { name: "aep-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ── Tool definitions ──────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_agent_info",
      description: "Get info about the connected AEP agent: wallet address, AGT balance, reputation score, registration status.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "register_agent",
      description: "Register the agent on-chain in the AEP marketplace. Requires at least 10 AGT for registration fee (use the faucet first if needed).",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Agent name (e.g. 'DataAnalyzer-v1')" },
          capabilities: {
            type: "array",
            items: { type: "string" },
            description: "Capability tags (e.g. ['nlp', 'data', 'analysis'])",
          },
        },
        required: ["name", "capabilities"],
      },
    },
    {
      name: "browse_market",
      description: "Browse the AEP marketplace. Returns recent needs (requests) and offers (services) with tags and prices.",
      inputSchema: {
        type: "object",
        properties: {
          tag: { type: "string", description: "Filter by tag (e.g. 'nlp', 'data', 'defi')" },
          type: {
            type: "string",
            enum: ["needs", "offers", "both"],
            description: "What to browse — needs (buyers), offers (sellers), or both",
          },
        },
        required: [],
      },
    },
    {
      name: "publish_need",
      description: "Publish a need (buy request) to the AEP marketplace. Other agents can respond with proposals.",
      inputSchema: {
        type: "object",
        properties: {
          description: { type: "string", description: "What you need (be specific)" },
          budget: { type: "string", description: "Maximum budget in AGT (e.g. '50')" },
          tags: { type: "array", items: { type: "string" }, description: "Tags to help matching (e.g. ['nlp', 'data'])" },
          deadlineHours: { type: "number", description: "How many hours until deadline (default 24)" },
        },
        required: ["description", "budget", "tags"],
      },
    },
    {
      name: "publish_offer",
      description: "Publish a service offer to the AEP marketplace. Other agents with matching needs can hire you.",
      inputSchema: {
        type: "object",
        properties: {
          description: { type: "string", description: "What service you provide" },
          price: { type: "string", description: "Price in AGT (e.g. '40')" },
          tags: { type: "array", items: { type: "string" }, description: "Service tags" },
        },
        required: ["description", "price", "tags"],
      },
    },
    {
      name: "check_reputation",
      description: "Check the reputation score, deal history, and vault tier of any AEP agent address.",
      inputSchema: {
        type: "object",
        properties: {
          address: { type: "string", description: "Ethereum address to check (0x...)" },
        },
        required: ["address"],
      },
    },
    {
      name: "get_market_stats",
      description: "Get live AEP protocol stats: active agents, total deals, needs/offers counts, AGT staked.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "request_faucet",
      description: "Request 15 AGT from the testnet faucet (base-sepolia only). On mainnet, AGT must be obtained via Uniswap.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "get_season1_info",
      description: "Get Season 1 Agent Genesis Program info: days remaining, total pool, your personal points breakdown.",
      inputSchema: {
        type: "object",
        properties: {
          address: { type: "string", description: "Address to check points for (defaults to connected agent)" },
        },
        required: [],
      },
    },
  ],
}));

// ── Tool handlers ─────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args ?? {}) as Record<string, unknown>;

  try {
    switch (name) {
      // ── get_agent_info ────────────────────────────────────────────────────
      case "get_agent_info": {
        const [isReg, balance, rep] = await Promise.allSettled([
          sdk.isRegistered(),
          sdk.getBalance(),
          sdk.getReputation(),
        ]);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              address: sdk.address,
              network: NETWORK,
              registered: isReg.status === "fulfilled" ? isReg.value : false,
              balance: balance.status === "fulfilled" ? balance.value + " AGT" : "error",
              reputation: rep.status === "fulfilled" ? rep.value : null,
            }, null, 2),
          }],
        };
      }

      // ── register_agent ────────────────────────────────────────────────────
      case "register_agent": {
        const tx = await sdk.register({
          name: String(a.name),
          capabilities: a.capabilities as string[],
          metadataURI: "",
        });
        return {
          content: [{ type: "text", text: `Agent registered successfully. Transaction: ${tx}` }],
        };
      }

      // ── browse_market ─────────────────────────────────────────────────────
      case "browse_market": {
        const tag = a.tag ? String(a.tag) : undefined;
        const type = (a.type as string) || "both";
        const results: Record<string, unknown> = {};

        if (type === "needs" || type === "both") {
          const url = tag ? `${BACKEND_URL}/api/market/needs?tag=${tag}` : `${BACKEND_URL}/api/market/needs`;
          const res = await fetch(url);
          results.needs = await res.json();
        }
        if (type === "offers" || type === "both") {
          const url = tag ? `${BACKEND_URL}/api/market/offers?tag=${tag}` : `${BACKEND_URL}/api/market/offers`;
          const res = await fetch(url);
          results.offers = await res.json();
        }
        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      }

      // ── publish_need ──────────────────────────────────────────────────────
      case "publish_need": {
        const hours = typeof a.deadlineHours === "number" ? a.deadlineHours : 24;
        const needId = await sdk.publishNeed({
          description: String(a.description),
          budget: String(a.budget),
          tags: a.tags as string[],
          deadline: Math.floor(Date.now() / 1000) + hours * 3600,
        });
        return {
          content: [{ type: "text", text: `Need #${needId} published. Budget: ${a.budget} AGT. Other agents can now respond with proposals.` }],
        };
      }

      // ── publish_offer ─────────────────────────────────────────────────────
      case "publish_offer": {
        const offerId = await sdk.publishOffer({
          description: String(a.description),
          price: String(a.price),
          tags: a.tags as string[],
        });
        return {
          content: [{ type: "text", text: `Offer #${offerId} published. Price: ${a.price} AGT. Agents with matching needs can now hire you.` }],
        };
      }

      // ── check_reputation ─────────────────────────────────────────────────
      case "check_reputation": {
        const addr = String(a.address);
        const res = await fetch(`${BACKEND_URL}/api/agents/${addr}`);
        const data = await res.json();
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }

      // ── get_market_stats ──────────────────────────────────────────────────
      case "get_market_stats": {
        const res = await fetch(`${BACKEND_URL}/api/monitor/stats`);
        const data = await res.json();
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }

      // ── request_faucet ────────────────────────────────────────────────────
      case "request_faucet": {
        if (NETWORK !== "base-sepolia") {
          return {
            content: [{ type: "text", text: "Faucet only available on base-sepolia. On mainnet, buy AGT on Uniswap: https://app.uniswap.org/swap?outputCurrency=0x6dE70b5B0953A220420E142f51AE47B6Fd5b7101&chain=base" }],
          };
        }
        const res = await fetch(`${BACKEND_URL}/api/faucet`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: sdk.address }),
        });
        const data = await res.json() as { txHash?: string; error?: string };
        return {
          content: [{ type: "text", text: data.txHash ? `Faucet sent 15 AGT. Tx: ${data.txHash}` : `Faucet error: ${data.error}` }],
        };
      }

      // ── get_season1_info ──────────────────────────────────────────────────
      case "get_season1_info": {
        const addr = a.address ? String(a.address) : sdk.address;
        const [infoRes, participantRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/genesis/info`),
          fetch(`${BACKEND_URL}/api/genesis/participant/${addr}`),
        ]);
        const info = await infoRes.json();
        const participant = await participantRes.json();
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ season: info, participant }, null, 2),
          }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err: any) {
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("AEP MCP Server running. Connect from Claude Desktop or any MCP client.\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
