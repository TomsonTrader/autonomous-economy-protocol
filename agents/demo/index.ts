/**
 * AEP Demo Agent — 24/7 Market Maker
 *
 * A live agent that runs permanently on Base Mainnet, publishing real
 * needs and offers to keep the marketplace active. It negotiates with
 * any agent that responds, completes deals, and builds reputation.
 *
 * This agent is the "heartbeat" of the protocol — it ensures the live
 * stats on the landing page always show real activity.
 *
 * Deploy on Railway as a worker service (separate from the backend).
 * Required env vars:
 *   DEMO_AGENT_KEY  — private key of a funded wallet (0.002+ ETH for gas)
 *
 * The agent calls the faucet on first run to get AGT for registration.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: require("path").resolve(__dirname, "../../.env") });

import { AgentSDK } from "autonomous-economy-sdk";
import { ethers } from "ethers";

// ── Config ────────────────────────────────────────────────────────────────────

const KEY = process.env.DEMO_AGENT_KEY;
if (!KEY) {
  console.error("❌  DEMO_AGENT_KEY env var is required");
  process.exit(1);
}

const BACKEND = process.env.NEXT_PUBLIC_API_URL ||
  "https://autonomous-economy-protocol-production.up.railway.app";

const CYCLE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes between cycles
const PROPOSAL_CHECK_MS = 2 * 60 * 1000; // check for proposals every 2 minutes

// ── Real-world service catalog ─────────────────────────────────────────────────

const OFFERS_CATALOG = [
  { desc: "Sentiment analysis of social media posts — returns JSON with score, entities, topics.", price: "40", tags: ["nlp", "sentiment", "analysis"] },
  { desc: "Real-time ETH/BTC price feed with 1-minute resolution via CoinGecko API.", price: "25", tags: ["data", "pricing", "crypto"] },
  { desc: "GPT-4 content summarization — 2000 words in, 200-word summary out.", price: "60", tags: ["llm", "summarize", "content"] },
  { desc: "Web scraping service — returns structured JSON from any URL.", price: "35", tags: ["scraping", "data", "web"] },
  { desc: "On-chain wallet reputation check — returns score + risk flags.", price: "20", tags: ["reputation", "wallet", "risk"] },
  { desc: "Smart contract audit prelim scan — flags common vulnerabilities.", price: "150", tags: ["security", "audit", "solidity"] },
  { desc: "Language translation EN↔ES↔FR — up to 10k characters.", price: "30", tags: ["translation", "nlp", "language"] },
  { desc: "Image classification — returns top-5 labels with confidence scores.", price: "45", tags: ["vision", "classification", "ml"] },
];

const NEEDS_CATALOG = [
  { desc: "Need ETH/BTC price feed updated every 5 minutes — JSON format.", budget: "30", tags: ["data", "pricing", "crypto"] },
  { desc: "Need sentiment analysis of latest 100 Ethereum tweets.", budget: "50", tags: ["nlp", "sentiment", "twitter"] },
  { desc: "Need smart contract ABI extracted from a Basescan address.", budget: "20", tags: ["solidity", "data", "web3"] },
  { desc: "Need a 500-word blog post about autonomous AI agents in DeFi.", budget: "70", tags: ["content", "writing", "ai"] },
  { desc: "Need wallet risk scoring for 10 addresses — fraud detection.", budget: "40", tags: ["risk", "wallet", "security"] },
  { desc: "Need on-chain transaction classification — DeFi vs CEX vs NFT.", budget: "35", tags: ["data", "analysis", "onchain"] },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(msg: string) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [DemoAgent] ${msg}`);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function callFaucet(address: string): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND}/api/faucet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    const data = await res.json() as { txHash?: string; error?: string };
    if (res.ok) {
      log(`💧 Faucet received 15 AGT — tx: ${data.txHash}`);
      return true;
    }
    log(`⚠️  Faucet: ${data.error}`);
    return false;
  } catch (e: any) {
    log(`⚠️  Faucet call failed: ${e.message}`);
    return false;
  }
}

// ── Main agent loop ───────────────────────────────────────────────────────────

async function main() {
  log("🤖 AEP Demo Agent starting on Base Mainnet...");

  const sdk = new AgentSDK({
    privateKey: KEY!,
    network: "base-mainnet",
    backendUrl: BACKEND,
  });

  log(`   Address: ${sdk.address}`);

  // ── Register if not already registered ──────────────────────────────────────

  const registered = await sdk.isRegistered();
  if (!registered) {
    log("📝 Not registered — requesting faucet AGT...");
    await callFaucet(sdk.address);
    await sleep(15000); // wait for tx to confirm

    log("📝 Registering agent on-chain...");
    try {
      const tx = await sdk.register({
        name: "AEP-MarketMaker",
        capabilities: ["data", "nlp", "analysis", "pricing", "content", "ml"],
        metadataURI: "https://autonomous-economy-protocol-production.up.railway.app/api/agents/" + sdk.address,
      });
      log(`✅ Registered! tx: ${tx}`);
      await sleep(5000);
    } catch (e: any) {
      log(`❌ Registration failed: ${e.message}`);
      process.exit(1);
    }
  } else {
    log("✅ Already registered");
  }

  const rep = await sdk.getReputation();
  const bal = await sdk.getBalance();
  log(`   Balance: ${bal} AGT | Reputation: ${rep.score}`);

  // ── Cycle counters ────────────────────────────────────────────────────────────

  let offerIdx = 0;
  let needIdx = 0;
  let cycleNum = 0;

  // ── Proposal responder (runs every 2 min) ─────────────────────────────────────

  async function checkProposals() {
    try {
      // Get all proposals via backend (less RPC calls than on-chain scan)
      const res = await fetch(`${BACKEND}/api/monitor/activity?limit=50`);
      const data = await res.json() as { events?: { type: string; data: Record<string, unknown>; timestamp: number }[] };
      const recentProposals = (data.events || []).filter(
        (e) => e.type === "ProposalCreated" && Date.now() - e.timestamp < 10 * 60 * 1000
      );

      for (const ev of recentProposals) {
        const proposalId = ev.data.proposalId as number;
        if (proposalId === undefined) continue;

        try {
          const proposal = await sdk.getProposal(proposalId);
          if (Number(proposal.status) !== 0) continue; // not pending

          const price = parseFloat(proposal.price);

          if (proposal.buyer === sdk.address) {
            // We are the buyer — accept if within 20% of budget
            if (price <= parseFloat(proposal.price) * 1.2) {
              log(`🤝 Accepting proposal #${proposalId} as buyer @ ${price} AGT`);
              const agreeAddr = await sdk.acceptProposal(proposalId);
              await sleep(3000);
              await sdk.fundAgreement(agreeAddr);
              await sleep(3000);
              await sdk.confirmDelivery(agreeAddr);
              log(`✅ Deal #${proposalId} completed!`);
            }
          } else if (proposal.seller === sdk.address) {
            // We are the seller — accept if price >= 80% of our listed price
            if (price >= 20) {
              log(`🤝 Accepting proposal #${proposalId} as seller @ ${price} AGT`);
              await sdk.acceptProposal(proposalId);
              log(`✅ Accepted as seller #${proposalId}`);
            } else {
              await sdk.counterOffer(proposalId, String(Math.ceil(price * 1.2)), "Standard service rate");
              log(`🔄 Counter-offered on #${proposalId}`);
            }
          }
        } catch { /* skip individual proposal errors */ }
      }
    } catch (e: any) {
      log(`⚠️  Proposal check error: ${e.message}`);
    }
  }

  // ── Publish cycle (runs every 5 min) ─────────────────────────────────────────

  async function publishCycle() {
    cycleNum++;
    log(`\n── Cycle #${cycleNum} ──`);

    const bal = await sdk.getBalance();
    log(`   Balance: ${bal} AGT`);

    if (parseFloat(bal) < 5) {
      log("⚠️  Low balance — requesting faucet top-up...");
      await callFaucet(sdk.address);
      await sleep(15000);
      return;
    }

    try {
      if (cycleNum % 2 === 0) {
        // Even cycles: publish an offer
        const offer = OFFERS_CATALOG[offerIdx % OFFERS_CATALOG.length];
        offerIdx++;
        const offerId = await sdk.publishOffer({
          description: offer.desc,
          price: offer.price,
          tags: offer.tags,
        });
        log(`🏷️  Published offer #${offerId}: ${offer.desc.slice(0, 60)}... @ ${offer.price} AGT`);
      } else {
        // Odd cycles: publish a need
        const need = NEEDS_CATALOG[needIdx % NEEDS_CATALOG.length];
        needIdx++;
        const needId = await sdk.publishNeed({
          description: need.desc,
          budget: need.budget,
          deadline: Math.floor(Date.now() / 1000) + 86400, // 24h TTL
          tags: need.tags,
        });
        log(`📋 Published need #${needId}: ${need.desc.slice(0, 60)}... budget: ${need.budget} AGT`);
      }
    } catch (e: any) {
      log(`⚠️  Publish error: ${e.message}`);
    }
  }

  // ── Start both loops ───────────────────────────────────────────────────────────

  // Publish immediately on start, then every CYCLE_INTERVAL_MS
  await publishCycle();
  const publishTimer = setInterval(publishCycle, CYCLE_INTERVAL_MS);

  // Check proposals every PROPOSAL_CHECK_MS
  await checkProposals();
  const proposalTimer = setInterval(checkProposals, PROPOSAL_CHECK_MS);

  // ── Graceful shutdown ──────────────────────────────────────────────────────────

  process.on("SIGTERM", () => {
    log("🛑 SIGTERM received — shutting down gracefully");
    clearInterval(publishTimer);
    clearInterval(proposalTimer);
    sdk.disconnect();
    process.exit(0);
  });

  process.on("SIGINT", () => {
    log("🛑 SIGINT — shutting down");
    clearInterval(publishTimer);
    clearInterval(proposalTimer);
    sdk.disconnect();
    process.exit(0);
  });

  log(`\n✅ Demo agent running! Publish every ${CYCLE_INTERVAL_MS / 60000}m, proposals every ${PROPOSAL_CHECK_MS / 60000}m\n`);
}

main().catch((e) => {
  console.error("💥 Fatal error:", e);
  process.exit(1);
});
