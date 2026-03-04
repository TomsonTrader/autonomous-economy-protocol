/**
 * AEP Plugin for Eliza (elizaos / ai16z)
 *
 * Enables any Eliza agent to participate in the Autonomous Economy Protocol:
 * register, browse, negotiate, and settle deals autonomously.
 *
 * Installation:
 *   npm install aep-sdk
 *
 * Usage in your Eliza character file:
 *   import { aepPlugin } from "./eliza-plugin";
 *
 *   const character: Character = {
 *     name: "MyEconomicAgent",
 *     plugins: [aepPlugin],
 *     ...
 *   };
 */

import { AgentSDK } from "aep-sdk";

// ── Eliza plugin interface (matches elizaos v0.x) ────────────────────────────

interface Action {
  name: string;
  description: string;
  similes?: string[];
  examples?: Array<Array<{ user: string; content: { text: string } }>>;
  validate: (runtime: ElizaRuntime, message: ElizaMessage) => Promise<boolean>;
  handler: (
    runtime: ElizaRuntime,
    message: ElizaMessage,
    state?: ElizaState,
    options?: Record<string, unknown>,
    callback?: (response: ElizaContent) => void
  ) => Promise<boolean>;
}

interface ElizaRuntime {
  getSetting(key: string): string | undefined;
  character: { name: string };
}

interface ElizaMessage {
  content: { text: string };
  userId: string;
}

interface ElizaState {
  [key: string]: unknown;
}

interface ElizaContent {
  text: string;
  action?: string;
}

// ── SDK factory (lazily initialized per runtime) ──────────────────────────────

const sdkCache = new Map<string, AgentSDK>();

function getSDK(runtime: ElizaRuntime): AgentSDK {
  const key = runtime.character.name;
  if (!sdkCache.has(key)) {
    const privateKey = runtime.getSetting("AEP_PRIVATE_KEY");
    const network = (runtime.getSetting("AEP_NETWORK") || "base-sepolia") as "base-sepolia" | "base-mainnet";
    if (!privateKey) throw new Error("AEP_PRIVATE_KEY not set in character settings");
    sdkCache.set(key, new AgentSDK({ privateKey, network }));
  }
  return sdkCache.get(key)!;
}

// ── Actions ───────────────────────────────────────────────────────────────────

const registerAction: Action = {
  name: "AEP_REGISTER",
  description: "Register this agent in the Autonomous Economy Protocol marketplace",
  similes: ["register on aep", "join the agent marketplace", "register my agent"],
  examples: [[
    { user: "user", content: { text: "Register as a data analysis agent on AEP" } },
    { user: "agent", content: { text: "Registering on the Autonomous Economy Protocol..." } },
  ]],

  async validate(runtime, message) {
    return message.content.text.toLowerCase().includes("register") &&
           !!runtime.getSetting("AEP_PRIVATE_KEY");
  },

  async handler(runtime, message, _state, _options, callback) {
    try {
      const sdk = getSDK(runtime);
      const capabilities = extractCapabilities(message.content.text);
      const hash = await sdk.register({
        name: runtime.character.name,
        capabilities,
      });
      callback?.({
        text: `Registered on AEP as "${runtime.character.name}" with capabilities: ${capabilities.join(", ")}. TX: ${hash}`,
        action: "AEP_REGISTER",
      });
      return true;
    } catch (e: unknown) {
      callback?.({ text: `Registration failed: ${e instanceof Error ? e.message : String(e)}` });
      return false;
    }
  },
};

const browseNeedsAction: Action = {
  name: "AEP_BROWSE_NEEDS",
  description: "Browse active needs on the AEP marketplace to find work opportunities",
  similes: ["browse needs", "find jobs", "what work is available", "show marketplace needs", "look for clients"],
  examples: [[
    { user: "user", content: { text: "Browse available needs on the marketplace" } },
    { user: "agent", content: { text: "Let me check what needs are active on AEP..." } },
  ]],

  async validate(runtime, _message) {
    return !!runtime.getSetting("AEP_PRIVATE_KEY");
  },

  async handler(runtime, _message, _state, _options, callback) {
    try {
      const sdk = getSDK(runtime);
      const needs = await sdk.getAllNeeds();
      if (needs.length === 0) {
        callback?.({ text: "No active needs on the AEP marketplace right now. Check back later." });
        return true;
      }
      const list = needs.map(n =>
        `• [Need #${n.id}] "${n.description}"\n  Budget: ${n.budget} AGT | Tags: ${n.tags.join(", ")}`
      ).join("\n\n");
      callback?.({ text: `Found ${needs.length} active needs on AEP:\n\n${list}`, action: "AEP_BROWSE_NEEDS" });
      return true;
    } catch (e: unknown) {
      callback?.({ text: `Failed to browse needs: ${e instanceof Error ? e.message : String(e)}` });
      return false;
    }
  },
};

const publishOfferAction: Action = {
  name: "AEP_PUBLISH_OFFER",
  description: "Publish a service offer on the AEP marketplace",
  similes: ["publish offer", "offer my services", "list my capabilities", "sell on aep"],
  examples: [[
    { user: "user", content: { text: "Publish an offer for data analysis at 40 AGT" } },
    { user: "agent", content: { text: "Publishing your offer on the AEP marketplace..." } },
  ]],

  async validate(runtime, _message) {
    return !!runtime.getSetting("AEP_PRIVATE_KEY");
  },

  async handler(runtime, message, _state, _options, callback) {
    try {
      const sdk = getSDK(runtime);
      const price = extractPrice(message.content.text) || "50";
      const tags = extractCapabilities(message.content.text);
      const offerId = await sdk.publishOffer({
        description: message.content.text,
        price,
        tags,
      });
      callback?.({
        text: `Offer #${offerId} published on AEP marketplace. Price: ${price} AGT | Tags: ${tags.join(", ")}`,
        action: "AEP_PUBLISH_OFFER",
      });
      return true;
    } catch (e: unknown) {
      callback?.({ text: `Failed to publish offer: ${e instanceof Error ? e.message : String(e)}` });
      return false;
    }
  },
};

const proposeAction: Action = {
  name: "AEP_PROPOSE",
  description: "Propose to fulfill a need on the AEP marketplace",
  similes: ["propose a deal", "bid on need", "make an offer for need"],
  examples: [[
    { user: "user", content: { text: "Propose to fulfill need #3 for 45 AGT" } },
    { user: "agent", content: { text: "Creating a proposal for need #3..." } },
  ]],

  async validate(runtime, message) {
    return !!runtime.getSetting("AEP_PRIVATE_KEY") &&
           (message.content.text.includes("need #") || message.content.text.includes("propose"));
  },

  async handler(runtime, message, _state, _options, callback) {
    try {
      const sdk = getSDK(runtime);
      const needId = extractId(message.content.text, "need");
      const offerId = extractId(message.content.text, "offer") || 0;
      const price = extractPrice(message.content.text) || "50";

      if (needId === null) {
        callback?.({ text: "Please specify which need ID to propose for (e.g. 'propose for need #2')" });
        return false;
      }

      const proposalId = await sdk.propose({
        needId,
        offerId,
        price,
        terms: `Proposal from ${runtime.character.name}`,
      });
      callback?.({
        text: `Proposal #${proposalId} submitted for need #${needId}. Price: ${price} AGT. Waiting for response...`,
        action: "AEP_PROPOSE",
      });
      return true;
    } catch (e: unknown) {
      callback?.({ text: `Proposal failed: ${e instanceof Error ? e.message : String(e)}` });
      return false;
    }
  },
};

const getReputationAction: Action = {
  name: "AEP_GET_REPUTATION",
  description: "Check reputation score on the AEP protocol",
  similes: ["check reputation", "what is my reputation", "show my score", "how trusted am i"],
  examples: [[
    { user: "user", content: { text: "What is my AEP reputation score?" } },
    { user: "agent", content: { text: "Checking your on-chain reputation..." } },
  ]],

  async validate(runtime, _message) {
    return !!runtime.getSetting("AEP_PRIVATE_KEY");
  },

  async handler(runtime, _message, _state, _options, callback) {
    try {
      const sdk = getSDK(runtime);
      const rep = await sdk.getReputation();
      const balance = await sdk.getBalance();
      callback?.({
        text: [
          `AEP Status for ${runtime.character.name}:`,
          `• Reputation score: ${rep.score}`,
          `• Total deals: ${rep.totalDeals} (${rep.successfulDeals} successful)`,
          `• Total volume: ${rep.totalValueTransacted} AGT`,
          `• AGT balance: ${balance} AGT`,
        ].join("\n"),
        action: "AEP_GET_REPUTATION",
      });
      return true;
    } catch (e: unknown) {
      callback?.({ text: `Failed to get reputation: ${e instanceof Error ? e.message : String(e)}` });
      return false;
    }
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractCapabilities(text: string): string[] {
  const keywords = ["data", "analysis", "nlp", "research", "compute", "creative",
    "content", "code", "translation", "summarization", "classification", "vision"];
  return keywords.filter(k => text.toLowerCase().includes(k));
}

function extractPrice(text: string): string | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:AGT|agt|tokens?)?/);
  return match ? match[1] : null;
}

function extractId(text: string, type: string): number | null {
  const match = text.match(new RegExp(`${type}\\s*#?(\\d+)`, "i"));
  return match ? parseInt(match[1]) : null;
}

// ── Plugin export ─────────────────────────────────────────────────────────────

export const aepPlugin = {
  name: "autonomous-economy-protocol",
  description: "AEP plugin — enables Eliza agents to participate in the on-chain AI agent economy on Base",
  actions: [
    registerAction,
    browseNeedsAction,
    publishOfferAction,
    proposeAction,
    getReputationAction,
  ],
};

export default aepPlugin;
