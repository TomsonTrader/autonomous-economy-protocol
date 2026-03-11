/**
 * AEP Demo Agent — Full Deal Cycle Engine
 *
 * Runs 2 wallets (buyer + seller) that orchestrate complete deals every 30 minutes:
 *   seller publishes offer → buyer publishes need → buyer proposes →
 *   seller accepts → buyer funds escrow → buyer confirms delivery → 💰
 *
 * This generates real on-chain events: NeedPublished, OfferPublished,
 * ProposalCreated, ProposalAccepted, AgreementFunded, DeliveryConfirmed.
 *
 * Required Railway env vars:
 *   DEMO_AGENT_KEY    — buyer wallet (funded with ETH + AGT)
 *   DEMO_SELLER_KEY   — seller wallet (one of the simulation agents, has 1005 AGT)
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
const localEnv = require("path").resolve(__dirname, "../.env");
const rootEnv  = require("path").resolve(__dirname, "../../.env");
dotenv.config({ path: fs.existsSync(localEnv) ? localEnv : rootEnv });

import { AgentSDK } from "autonomous-economy-sdk";

// ── Config ─────────────────────────────────────────────────────────────────────

const BUYER_KEY  = process.env.DEMO_AGENT_KEY;
const SELLER_KEY = process.env.DEMO_SELLER_KEY;

if (!BUYER_KEY) { console.error("❌  DEMO_AGENT_KEY is required"); process.exit(1); }
if (!SELLER_KEY) { console.error("❌  DEMO_SELLER_KEY is required — set to any simulation agent key"); process.exit(1); }

const BACKEND = process.env.NEXT_PUBLIC_API_URL ||
  "https://autonomous-economy-protocol-production.up.railway.app";

const DEAL_INTERVAL_MS    = 90 * 60 * 1000; // full deal cycle every 90 min (~$3/month gas)
const PUBLISH_INTERVAL_MS = 20 * 60 * 1000; // standalone publish every 20 min

// ── Deal catalog — matched pairs (buyer need ↔ seller offer) ───────────────────

const DEAL_PAIRS = [
  {
    tags:      ["data", "pricing", "crypto"],
    needDesc:  "Need real-time ETH/BTC/SOL price feed, 5-minute updates, JSON format",
    budget:    "30",
    offerDesc: "Crypto price feed via CoinGecko + Chainlink, 1-minute resolution, 99.9% uptime",
    price:     "25",
  },
  {
    tags:      ["nlp", "sentiment", "analysis"],
    needDesc:  "Need sentiment analysis of last 100 ETH-related tweets — bullish/bearish score",
    budget:    "50",
    offerDesc: "NLP sentiment analysis of social media posts, returns JSON with score and entities",
    price:     "40",
  },
  {
    tags:      ["data", "analytics", "onchain"],
    needDesc:  "Need weekly on-chain analytics report: TVL, volume, active wallets for 5 DeFi protocols",
    budget:    "70",
    offerDesc: "Automated DeFi analytics report — TVL, fees, user count from 20+ protocols, weekly",
    price:     "55",
  },
  {
    tags:      ["security", "audit", "solidity"],
    needDesc:  "Need smart contract prelim security scan — reentrancy, overflow, access control",
    budget:    "120",
    offerDesc: "Smart contract prelim audit — 12 vulnerability patterns, report within 4h",
    price:     "100",
  },
  {
    tags:      ["translation", "nlp", "language"],
    needDesc:  "Need English → Spanish translation of 3,000-word DeFi whitepaper section",
    budget:    "45",
    offerDesc: "Professional EN↔ES↔FR↔DE translation up to 15k characters, preserves formatting",
    price:     "35",
  },
  {
    tags:      ["gpu-compute", "inference", "ml"],
    needDesc:  "Need GPU inference for 500 image classification requests, sub-500ms latency",
    budget:    "80",
    offerDesc: "GPU cluster: ResNet-50 + CLIP inference, top-5 labels with confidence scores",
    price:     "65",
  },
  {
    tags:      ["data", "scraping", "web"],
    needDesc:  "Need structured JSON extraction from 20 DeFi protocol websites — TVL, APY, volume",
    budget:    "40",
    offerDesc: "Web scraping service — structured JSON from any URL, handles JS-rendered pages",
    price:     "32",
  },
  {
    tags:      ["oracle", "price-feed"],
    needDesc:  "Need AGT/ETH oracle price feed updated every 60 seconds with 24h change",
    budget:    "35",
    offerDesc: "High-frequency oracle, 1-second resolution, cryptographic proofs included",
    price:     "28",
  },
];

// Standalone publishes (no matching partner needed)
const SOLO_OFFERS = [
  { desc: "Wallet reputation check — risk score, fraud flags, on-chain history summary", price: "20", tags: ["reputation", "wallet", "risk"] },
  { desc: "GPT-4o content summarization — 3,000 words in, 250-word executive summary out", price: "60", tags: ["llm", "summarize", "content"] },
  { desc: "Cross-chain arbitrage bot monitoring — alerts + profit calculations in real-time", price: "90", tags: ["arbitrage", "defi", "monitoring"] },
];

const SOLO_NEEDS = [
  { desc: "Need portfolio rebalancing strategy for 5 DeFi positions — optimal weights", budget: "55", tags: ["defi", "analytics", "rebalancing"] },
  { desc: "Need Base blockchain transaction indexer for custom ERC-20 token events", budget: "85", tags: ["data", "onchain", "indexing"] },
  { desc: "Need social sentiment feed for AGT token — Twitter + Farcaster + Telegram", budget: "45", tags: ["sentiment", "nlp", "social"] },
];

// ── Logging ────────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] [DemoAgent] ${msg}`);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Faucet ─────────────────────────────────────────────────────────────────────

async function callFaucet(address: string): Promise<void> {
  try {
    const res = await fetch(`${BACKEND}/api/faucet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    const data = await res.json() as { txHash?: string; error?: string };
    if (res.ok) log(`💧 Faucet: 15 AGT → ${address.slice(0, 10)} (tx: ${data.txHash})`);
    else         log(`⚠️  Faucet: ${data.error} (${address.slice(0, 10)})`);
  } catch (e: any) {
    log(`⚠️  Faucet call failed: ${e.message}`);
  }
}

// ── Ensure both agents are registered ─────────────────────────────────────────

async function ensureRegistered(sdk: AgentSDK, name: string, caps: string[]): Promise<void> {
  if (await sdk.isRegistered()) {
    log(`✅ ${name} already registered (${sdk.address.slice(0, 10)})`);
    return;
  }
  log(`📝 ${name} not registered — requesting faucet...`);
  await callFaucet(sdk.address);
  await sleep(15000);
  await sdk.register({ name, capabilities: caps, metadataURI: `ipfs://aep-demo/${name.toLowerCase()}` });
  log(`✅ ${name} registered!`);
  await sleep(5000);
}

// ── Full deal cycle ────────────────────────────────────────────────────────────

async function runDealCycle(
  buyer: AgentSDK,
  seller: AgentSDK,
  pairIdx: number
): Promise<void> {
  const pair = DEAL_PAIRS[pairIdx % DEAL_PAIRS.length];
  const deadline = Math.floor(Date.now() / 1000) + 7 * 24 * 3600; // 7-day TTL
  const midPrice = ((parseFloat(pair.budget) + parseFloat(pair.price)) / 2).toFixed(0);

  log(`\n🔄 Deal cycle — "${pair.tags.join(", ")}"`);

  try {
    // Step 1: Seller publishes offer
    const offerId = await seller.publishOffer({
      description: pair.offerDesc,
      price:       pair.price,
      tags:        pair.tags,
    });
    log(`  🏷️  Offer #${offerId} published by seller @ ${pair.price} AGT`);
    await sleep(8000);

    // Step 2: Buyer publishes matching need
    const needId = await buyer.publishNeed({
      description: pair.needDesc,
      budget:      pair.budget,
      deadline,
      tags:        pair.tags,
    });
    log(`  📋 Need #${needId} published by buyer (budget: ${pair.budget} AGT)`);
    await sleep(8000);

    // Step 3: Buyer proposes (midpoint price)
    const proposalId = await buyer.propose({
      needId,
      offerId,
      price: midPrice,
      terms: "7-day service window, payment released on delivery confirmation",
    });
    log(`  🤝 Proposal #${proposalId} created @ ${midPrice} AGT`);
    await sleep(10000);

    // Step 4: Seller accepts → gets agreement address
    const agreementAddr = await seller.acceptProposal(proposalId);
    log(`  ✅ Proposal #${proposalId} accepted — agreement: ${agreementAddr.slice(0, 10)}`);
    await sleep(10000);

    // Step 5: Buyer funds the escrow
    await buyer.fundAgreement(agreementAddr);
    log(`  💰 Agreement funded (${midPrice} AGT in escrow)`);
    await sleep(15000);

    // Step 6: Buyer confirms delivery → payment released to seller
    await buyer.confirmDelivery(agreementAddr);
    log(`  🎉 Deal #${proposalId} COMPLETE — ${midPrice} AGT paid to seller!`);

  } catch (e: any) {
    log(`  ❌ Deal cycle error: ${e.message}`);
  }
}

// ── Solo publish cycle (keeps marketplace active between deals) ────────────────

async function soloPublishCycle(
  buyer: AgentSDK,
  seller: AgentSDK,
  idx: number
): Promise<void> {
  const deadline = Math.floor(Date.now() / 1000) + 86400; // 24h TTL

  // Alternate offer and need
  if (idx % 2 === 0) {
    const o = SOLO_OFFERS[Math.floor(idx / 2) % SOLO_OFFERS.length];
    try {
      const id = await seller.publishOffer({ description: o.desc, price: o.price, tags: o.tags });
      log(`🏷️  Solo offer #${id}: "${o.desc.slice(0, 55)}…" @ ${o.price} AGT`);
    } catch (e: any) { log(`⚠️  Solo offer error: ${e.message}`); }
  } else {
    const n = SOLO_NEEDS[Math.floor(idx / 2) % SOLO_NEEDS.length];
    try {
      const id = await buyer.publishNeed({ description: n.desc, budget: n.budget, deadline, tags: n.tags });
      log(`📋 Solo need #${id}: "${n.desc.slice(0, 55)}…" budget: ${n.budget} AGT`);
    } catch (e: any) { log(`⚠️  Solo need error: ${e.message}`); }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  log("🤖 AEP Demo Agent (Full Cycle) starting on Base Mainnet...");

  const buyer = new AgentSDK({ privateKey: BUYER_KEY!,  network: "base-mainnet", backendUrl: BACKEND });
  const seller = new AgentSDK({ privateKey: SELLER_KEY!, network: "base-mainnet", backendUrl: BACKEND });

  log(`   Buyer  : ${buyer.address}`);
  log(`   Seller : ${seller.address}`);

  // Ensure both agents are registered
  await ensureRegistered(buyer,  "AEP-Buyer",  ["data", "nlp", "analytics", "defi", "security"]);
  await ensureRegistered(seller, "AEP-Seller", ["data", "nlp", "oracle", "gpu-compute", "translation"]);

  const buyerBal  = await buyer.getBalance();
  const sellerBal = await seller.getBalance();
  log(`   Buyer balance : ${buyerBal} AGT`);
  log(`   Seller balance: ${sellerBal} AGT`);

  let dealIdx   = 0;
  let soloIdx   = 0;

  // ── First cycle immediately ─────────────────────────────────────────────────
  await soloPublishCycle(buyer, seller, soloIdx++);
  await sleep(5000);
  await runDealCycle(buyer, seller, dealIdx++);

  // ── Solo publish every 5 minutes ───────────────────────────────────────────
  const soloTimer = setInterval(async () => {
    await soloPublishCycle(buyer, seller, soloIdx++);
  }, PUBLISH_INTERVAL_MS);

  // ── Full deal cycle every 30 minutes ────────────────────────────────────────
  const dealTimer = setInterval(async () => {
    // Top up seller if low
    const bal = await seller.getBalance();
    if (parseFloat(bal) < 5) {
      log("⚠️  Seller low balance — requesting faucet...");
      await callFaucet(seller.address);
      await sleep(15000);
    }
    await runDealCycle(buyer, seller, dealIdx++);
  }, DEAL_INTERVAL_MS);

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = () => {
    log("🛑 Shutting down gracefully...");
    clearInterval(soloTimer);
    clearInterval(dealTimer);
    buyer.disconnect();
    seller.disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT",  shutdown);

  log(`\n✅ Running! Deal cycle every ${DEAL_INTERVAL_MS / 60000}min | Solo publish every ${PUBLISH_INTERVAL_MS / 60000}min\n`);
}

main().catch((e) => { console.error("💥 Fatal:", e); process.exit(1); });
