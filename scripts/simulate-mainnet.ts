/**
 * AEP Mainnet Simulation — 20 agents via faucet → register → marketplace → negotiate
 * Keys never logged or sent anywhere.
 * Usage: npx ts-node scripts/simulate-mainnet.ts
 */

import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config();

const RPCS = [
  "https://mainnet.base.org",
  "https://base.llamarpc.com",
  "https://base-mainnet.public.blastapi.io",
  "https://1rpc.io/base",
];
const BACKEND     = "https://autonomous-economy-protocol-production.up.railway.app";
const AGENTS_FILE = path.join(__dirname, "../simulation/mainnet-agents.json");

const C = {
  AgentToken:        "0x6dE70b5B0953A220420E142f51AE47B6Fd5b7101",
  AgentRegistry:     "0x601125818d16cb78dD239Bce2c821a588B06d978",
  Marketplace:       "0x1D3d45107f30aF47bF6b4FfbA817bA8B4a91f44c",
  NegotiationEngine: "0xFfD596b2703b635059Bc2b6109a3173F29903D27",
};

const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];
const REGISTRY_ABI = [
  "function registerAgent(string name, string[] capabilities, string metadataURI)",
  "function isRegistered(address) view returns (bool)",
  "function totalRegistered() view returns (uint256)",
];
const MARKET_ABI = [
  "function publishNeed(string description, uint256 budget, uint256 deadline, string[] tags) returns (uint256)",
  "function publishOffer(string description, uint256 price, string[] tags) returns (uint256)",
  "function totalNeeds() view returns (uint256)",
  "function totalOffers() view returns (uint256)",
  "event NeedPublished(uint256 indexed needId, address indexed publisher, uint256 budget, string[] tags)",
  "event OfferPublished(uint256 indexed offerId, address indexed publisher, uint256 price, string[] tags)",
];
const NEGOTIATION_ABI = [
  "function propose(uint256 needId, uint256 offerId, uint256 price, string terms) returns (uint256)",
  "function totalProposals() view returns (uint256)",
];

const ok  = (s: string) => process.stdout.write(`  ✅ ${s}\n`);
const skip = (s: string) => process.stdout.write(`     ⏭  ${s}\n`);
const hdr = (s: string) => console.log(`\n\x1b[1m${s}\x1b[0m`);

const CAP_MAP: Record<string, string[]> = {
  DataProvider:    ["data-ingestion", "stream-processing", "analytics"],
  ComputeProvider: ["gpu-compute", "inference", "training"],
  OracleAgent:     ["price-feeds", "weather-data", "sports-results"],
  LiquidityAgent:  ["market-making", "arbitrage", "rebalancing"],
  AnalyticsAgent:  ["reporting", "forecasting", "dashboards"],
};

const NEEDS = [
  { desc: "Real-time ETH/USD price feed, 99.9% uptime SLA",        budget: 500,  tags: ["oracle", "price-feed"] },
  { desc: "GPU inference for LLM queries, 1000 req/day",            budget: 800,  tags: ["gpu-compute", "inference"] },
  { desc: "Weekly analytics report on on-chain activity",           budget: 300,  tags: ["analytics", "reporting"] },
  { desc: "Market-making for AGT/ETH pair, tight spreads",          budget: 1200, tags: ["liquidity", "market-making"] },
  { desc: "Data pipeline for DeFi protocol metrics",                budget: 600,  tags: ["data-ingestion", "analytics"] },
  { desc: "Weather oracle for prediction market integration",        budget: 400,  tags: ["oracle", "weather"] },
  { desc: "Backtesting compute for trading strategy",               budget: 700,  tags: ["gpu-compute", "training"] },
  { desc: "Daily portfolio rebalancing service",                    budget: 900,  tags: ["rebalancing", "arbitrage"] },
  { desc: "Cross-chain price arbitrage monitoring",                 budget: 550,  tags: ["arbitrage", "price-feed"] },
  { desc: "Social sentiment analysis feed for tokens",              budget: 350,  tags: ["analytics", "data-ingestion"] },
];

const OFFERS = [
  { desc: "High-frequency ETH/USD oracle, 1s resolution",          price: 450,  tags: ["oracle", "price-feed"] },
  { desc: "GPU cluster: 8xA100, sub-100ms inference latency",       price: 750,  tags: ["gpu-compute", "inference"] },
  { desc: "Automated weekly DeFi analytics with charts",            price: 280,  tags: ["analytics", "reporting"] },
  { desc: "Professional market-making, 0.1% spread guarantee",      price: 1100, tags: ["liquidity", "market-making"] },
  { desc: "Real-time on-chain data streaming, 50+ protocols",       price: 500,  tags: ["data-ingestion", "stream-processing"] },
  { desc: "Multi-source weather oracle with cryptographic proofs",  price: 380,  tags: ["oracle", "weather"] },
  { desc: "Distributed GPU farm, 10k GPU-hours/month",              price: 650,  tags: ["gpu-compute", "training"] },
  { desc: "Autonomous portfolio rebalancing, 24/7 uptime",          price: 850,  tags: ["rebalancing", "arbitrage"] },
  { desc: "Cross-DEX arbitrage bot, profit-sharing model",          price: 500,  tags: ["arbitrage", "price-feed"] },
  { desc: "Real-time NLP sentiment analysis, 100+ tokens",          price: 320,  tags: ["analytics", "data-ingestion"] },
];

async function requestFaucet(address: string): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res  = await fetch(`${BACKEND}/api/faucet`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ address }),
    });
    const data = await res.json() as any;
    if (data.success) return;
    if (data.error === "Address already funded") return; // ok
    if (attempt < 3) {
      process.stdout.write(`     ⚠️  faucet attempt ${attempt} failed (${data.error}), retrying in 8s…\n`);
      await new Promise(r => setTimeout(r, 8000));
      continue;
    }
    throw new Error(data.error || "faucet failed");
  }
}

async function main() {
  const provider = new ethers.FallbackProvider(
    RPCS.map((url, i) => ({ provider: new ethers.JsonRpcProvider(url, 8453, { batchMaxCount: 1 }), priority: i + 1, stallTimeout: 4000 })),
    8453, { quorum: 1 }
  );
  const agents   = JSON.parse(fs.readFileSync(AGENTS_FILE, "utf8"));
  const wallets  = agents.map((a: any) => new ethers.Wallet(a.privateKey, provider));

  hdr(`AEP Mainnet Simulation — ${new Date().toISOString()}`);
  console.log(`  Network: Base Mainnet (8453) | Agents: ${agents.length}`);

  // ── Step 1: Faucet → each agent gets 15 AGT ──────────────────────────────
  hdr("Step 1 — Faucet (15 AGT per agent)");
  for (let i = 0; i < agents.length; i++) {
    const bal = await new ethers.Contract(C.AgentToken, TOKEN_ABI, provider as any).balanceOf(wallets[i].address);
    if (bal >= ethers.parseEther("10")) {
      skip(`${agents[i].name} already has ${ethers.formatEther(bal)} AGT`);
      continue;
    }
    await requestFaucet(wallets[i].address);
    ok(`${agents[i].name.padEnd(22)} ← 15 AGT from faucet`);
    await new Promise(r => setTimeout(r, 6000)); // wait for tx to confirm + nonce settle
  }

  // ── Step 2: Approve AgentRegistry to spend AGT ───────────────────────────
  hdr("Step 2 — Approve AGT for AgentRegistry");
  for (let i = 0; i < agents.length; i++) {
    const tok = new ethers.Contract(C.AgentToken, TOKEN_ABI, wallets[i]);
    const tx  = await tok.approve(C.AgentRegistry, ethers.MaxUint256);
    await tx.wait();
    ok(`${agents[i].name.padEnd(22)} approved`);
  }

  // ── Step 3: Register all agents ──────────────────────────────────────────
  hdr("Step 3 — Registering agents");
  for (let i = 0; i < agents.length; i++) {
    const registry = new ethers.Contract(C.AgentRegistry, REGISTRY_ABI, wallets[i]);
    const already  = await registry.isRegistered(wallets[i].address);
    if (already) { skip(`${agents[i].name} already registered`); continue; }

    const caps = CAP_MAP[agents[i].archetype] || ["general"];
    const tx   = await registry.registerAgent(agents[i].name, caps, `ipfs://aep-sim/${agents[i].name.toLowerCase()}`);
    await tx.wait();
    ok(`${agents[i].name.padEnd(22)} registered`);
  }

  // ── Step 4: Approve Marketplace ──────────────────────────────────────────
  hdr("Step 4 — Approve AGT for Marketplace");
  for (let i = 0; i < agents.length; i++) {
    const tok = new ethers.Contract(C.AgentToken, TOKEN_ABI, wallets[i]);
    const tx  = await tok.approve(C.Marketplace, ethers.MaxUint256);
    await tx.wait();
    ok(`${agents[i].name.padEnd(22)} approved`);
  }

  // ── Step 5: Publish needs (agents 0-9) ───────────────────────────────────
  hdr("Step 5 — Publishing needs");
  const deadline = Math.floor(Date.now() / 1000) + 14 * 24 * 3600;
  const mkt      = new ethers.Contract(C.Marketplace, MARKET_ABI, provider as any);
  const needIds: number[]  = [];
  const offerIds: number[] = [];

  for (let i = 0; i < 10; i++) {
    const market  = new ethers.Contract(C.Marketplace, MARKET_ABI, wallets[i]);
    const n       = NEEDS[i];
    const tx      = await market.publishNeed(n.desc, ethers.parseEther(String(n.budget)), deadline, n.tags);
    const receipt = await tx.wait();
    const iface   = new ethers.Interface(MARKET_ABI);
    const log     = receipt.logs.map((l: any) => { try { return iface.parseLog(l); } catch { return null; } }).find((l: any) => l?.name === "NeedPublished");
    const needId  = log ? Number(log.args.needId) : 0;
    needIds.push(needId);
    ok(`${agents[i].name.padEnd(22)} need #${needId}: "${n.desc.slice(0, 48)}"`);
  }

  // ── Step 6: Publish offers (agents 10-19) ────────────────────────────────
  hdr("Step 6 — Publishing offers");
  for (let i = 10; i < 20; i++) {
    const market  = new ethers.Contract(C.Marketplace, MARKET_ABI, wallets[i]);
    const o       = OFFERS[i - 10];
    const tx      = await market.publishOffer(o.desc, ethers.parseEther(String(o.price)), o.tags);
    const receipt = await tx.wait();
    const iface   = new ethers.Interface(MARKET_ABI);
    const log     = receipt.logs.map((l: any) => { try { return iface.parseLog(l); } catch { return null; } }).find((l: any) => l?.name === "OfferPublished");
    const offerId = log ? Number(log.args.offerId) : 0;
    offerIds.push(offerId);
    ok(`${agents[i].name.padEnd(22)} offer #${offerId}: "${o.desc.slice(0, 48)}"`);
  }

  // ── Step 7: Negotiate (5 pairs) ──────────────────────────────────────────
  hdr("Step 7 — Negotiating proposals");

  for (let i = 0; i < 5; i++) {
    const neg    = new ethers.Contract(C.NegotiationEngine, NEGOTIATION_ABI, wallets[i]);
    const price  = ethers.parseEther(String(Math.round((NEEDS[i].budget + OFFERS[i].price) / 2)));
    const tx     = await neg.propose(needIds[i], offerIds[i], price, "30-day term, payment on delivery confirmation");
    await tx.wait();
    ok(`${agents[i].name.padEnd(18)} → ${agents[i + 10].name}: proposal need#${needIds[i]} ↔ offer#${offerIds[i]}`);
  }

  // ── Final stats ───────────────────────────────────────────────────────────
  hdr("On-chain Stats");
  const reg = new ethers.Contract(C.AgentRegistry, REGISTRY_ABI, provider as any);
  const neg = new ethers.Contract(C.NegotiationEngine, NEGOTIATION_ABI, provider as any);

  const [totalAgents, tN, tO, tP] = await Promise.all([
    reg.totalRegistered(),
    mkt.totalNeeds(),
    mkt.totalOffers(),
    neg.totalProposals(),
  ]);

  console.log(`  Agents registered : ${totalAgents}`);
  console.log(`  Needs published   : ${tN}`);
  console.log(`  Offers published  : ${tO}`);
  console.log(`  Proposals made    : ${tP}`);
  console.log(`\n✅ Simulation complete!\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
