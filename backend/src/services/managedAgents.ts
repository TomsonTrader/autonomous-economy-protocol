import { AgentSDK } from "autonomous-economy-sdk";
import * as fs from "fs";

interface ManagedAgentConfig {
  address: string;
  privateKey: string;
  template: string;
  name: string;
  ownerAddress?: string | null;
  createdAt: number;
}

const TEMPLATE_OFFERS: Record<string, { desc: string; price: string; tags: string[] }[]> = {
  "data-provider": [
    { desc: "Real-time DeFi TVL and volume analytics — 20 protocols, JSON format, updated every minute", price: "25", tags: ["data", "analytics", "onchain"] },
    { desc: "On-chain wallet activity report — tx history, token flows, risk score", price: "30", tags: ["data", "analytics", "wallet"] },
  ],
  "content-agent": [
    { desc: "AI-powered content generation — blog posts, summaries, technical docs up to 3,000 words", price: "40", tags: ["content", "nlp"] },
    { desc: "Professional EN/ES/FR translation, DeFi terminology aware, up to 10k characters", price: "35", tags: ["translation", "nlp"] },
  ],
  "oracle-agent": [
    { desc: "Crypto price oracle — ETH/BTC/SOL/AGT feeds, 1-minute resolution, cryptographic proofs", price: "20", tags: ["pricing", "oracle"] },
    { desc: "DeFi yield oracle — APY/APR across 30 protocols, updated every 5 minutes", price: "25", tags: ["pricing", "oracle", "market"] },
  ],
  "audit-bot": [
    { desc: "Smart contract prelim audit — reentrancy, overflow, access control, 12 vulnerability patterns", price: "100", tags: ["security", "audit", "solidity"] },
    { desc: "ERC-20 token security scan — mint authority, blacklist functions, ownership risks", price: "75", tags: ["security", "audit"] },
  ],
};

const TEMPLATE_NEEDS: Record<string, { desc: string; budget: string; tags: string[] }[]> = {
  "data-provider": [
    { desc: "Need GPU inference capacity for batch image classification — 1000 requests/hour", budget: "60", tags: ["gpu-compute", "inference"] },
  ],
  "content-agent": [
    { desc: "Need real-time ETH/BTC price feed with 5-minute resolution", budget: "30", tags: ["pricing", "oracle"] },
  ],
  "oracle-agent": [
    { desc: "Need NLP sentiment analysis of last 200 crypto tweets — bullish/bearish score", budget: "45", tags: ["nlp", "sentiment"] },
  ],
  "audit-bot": [
    { desc: "Need on-chain data analytics for 5 DeFi protocols — TVL, volume, user count", budget: "55", tags: ["data", "analytics"] },
  ],
};

export class ManagedAgentService {
  private agents: { sdk: AgentSDK; config: ManagedAgentConfig }[] = [];
  private timers: ReturnType<typeof setInterval>[] = [];
  private backendUrl: string;

  constructor(backendUrl: string) {
    this.backendUrl = backendUrl;
  }

  async start(configPath: string): Promise<void> {
    if (!fs.existsSync(configPath)) {
      console.log("[ManagedAgents] No managed-agents.json found — skipping");
      return;
    }

    let configs: ManagedAgentConfig[] = [];
    try {
      configs = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch {
      console.warn("[ManagedAgents] Failed to parse managed-agents.json");
      return;
    }

    if (!Array.isArray(configs) || configs.length === 0) {
      console.log("[ManagedAgents] No managed agents configured");
      return;
    }

    console.log(`[ManagedAgents] Loading ${configs.length} managed agent(s)...`);

    for (const config of configs) {
      try {
        const sdk = new AgentSDK({
          privateKey:  config.privateKey,
          network:     "base-mainnet",
          backendUrl:  this.backendUrl,
        });
        this.agents.push({ sdk, config });
        this.startAgentLoop(sdk, config);
        console.log(`[ManagedAgents] Started: ${config.name} (${config.template}) @ ${config.address}`);
      } catch (e: any) {
        console.warn(`[ManagedAgents] Failed to start ${config.name}: ${e.message}`);
      }
    }
  }

  private startAgentLoop(sdk: AgentSDK, config: ManagedAgentConfig): void {
    const offers = TEMPLATE_OFFERS[config.template] ?? TEMPLATE_OFFERS["data-provider"];
    const needs  = TEMPLATE_NEEDS[config.template]  ?? TEMPLATE_NEEDS["data-provider"];

    let cycle = 0;

    const run = async () => {
      const offer    = offers[cycle % offers.length];
      const need     = needs[cycle % needs.length];
      const deadline = Math.floor(Date.now() / 1000) + 86400;

      try {
        await sdk.publishOffer({ description: offer.desc, price: offer.price, tags: offer.tags });
        console.log(`[ManagedAgents] ${config.name} published offer @ ${offer.price} AGT`);
      } catch (e: any) {
        console.warn(`[ManagedAgents] ${config.name} offer error: ${e.message}`);
      }

      // Small delay between offer and need to avoid nonce issues
      await new Promise(r => setTimeout(r, 5000));

      try {
        await sdk.publishNeed({ description: need.desc, budget: need.budget, deadline, tags: need.tags });
        console.log(`[ManagedAgents] ${config.name} published need (budget: ${need.budget} AGT)`);
      } catch (e: any) {
        console.warn(`[ManagedAgents] ${config.name} need error: ${e.message}`);
      }

      cycle++;
    };

    // First run after 2 minutes (let backend settle), then every 30 minutes
    const initialDelay = setTimeout(run, 2 * 60 * 1000);
    const timer        = setInterval(run, 30 * 60 * 1000);

    // Store interval timer for cleanup; timeout cleans up itself
    this.timers.push(timer);
    // Clear the initial timeout if stop() is called before it fires
    this.timers.push(initialDelay as unknown as ReturnType<typeof setInterval>);
  }

  stop(): void {
    this.timers.forEach(t => clearInterval(t));
    this.timers = [];
    this.agents.forEach(({ sdk }) => {
      if (typeof (sdk as any).disconnect === "function") {
        (sdk as any).disconnect();
      }
    });
    this.agents = [];
  }
}
