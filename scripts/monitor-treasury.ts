/**
 * AEP Treasury & Activity Monitor
 * Watches protocol fees, deal activity, and agent registrations in real time.
 *
 * Usage: npx ts-node scripts/monitor-treasury.ts
 */

import { ethers } from "ethers";

const RPC = "https://mainnet.base.org";
const TREASURY = "0x8CCB591C94D419687c4C6dDfdd9F789cc29Bd0Fd";

const CONTRACTS = {
  AgentToken:      "0x83b99074e9EE48Faf50e19d6B763dD029cAaF7Ed",
  AgentRegistry:   "0x63b427a39e2e07587CF13b2AecBaEcDD4D20bf23",
  Marketplace:     "0xc8Dc4a3686887d27d845666d0a7664E995b3F3Ae",
  NegotiationEngine: "0x5B3529d0fC4aB779D24D605d6549134F9a5853c2",
};

const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];
const REGISTRY_ABI = [
  "function totalAgents() view returns (uint256)",
  "event AgentRegistered(address indexed agent, string[] capabilities)",
];
const MARKETPLACE_ABI = [
  "function totalNeeds() view returns (uint256)",
  "function totalOffers() view returns (uint256)",
  "event NeedPublished(uint256 indexed id, address indexed requester, uint256 maxBudget)",
  "event OfferPublished(uint256 indexed id, address indexed provider, uint256 pricePerUnit)",
];
const NEGOTIATION_ABI = [
  "event ProposalCreated(uint256 indexed proposalId, address indexed requester, address indexed provider, uint256 price)",
  "event ProposalAccepted(uint256 indexed proposalId, address agreement)",
];

function clear() { process.stdout.write('\x1Bc'); }
function dim(s: string) { return `\x1b[2m${s}\x1b[0m`; }
function green(s: string) { return `\x1b[32m${s}\x1b[0m`; }
function blue(s: string) { return `\x1b[34m${s}\x1b[0m`; }
function yellow(s: string) { return `\x1b[33m${s}\x1b[0m`; }
function bold(s: string) { return `\x1b[1m${s}\x1b[0m`; }

const events: string[] = [];
function logEvent(msg: string) {
  const ts = new Date().toLocaleTimeString();
  events.unshift(`${dim(ts)} ${msg}`);
  if (events.length > 10) events.pop();
}

async function fetchStats(provider: ethers.JsonRpcProvider) {
  const token    = new ethers.Contract(CONTRACTS.AgentToken,    TOKEN_ABI,    provider);
  const registry = new ethers.Contract(CONTRACTS.AgentRegistry, REGISTRY_ABI, provider);
  const market   = new ethers.Contract(CONTRACTS.Marketplace,   MARKETPLACE_ABI, provider);

  const [treasuryAGT, ethBal, totalAgents, totalNeeds, totalOffers, totalSupply, block] = await Promise.all([
    token.balanceOf(TREASURY),
    provider.getBalance(TREASURY),
    registry.totalAgents().catch(() => 0n),
    market.totalNeeds().catch(() => 0n),
    market.totalOffers().catch(() => 0n),
    token.totalSupply(),
    provider.getBlockNumber(),
  ]);

  return { treasuryAGT, ethBal, totalAgents, totalNeeds, totalOffers, totalSupply, block };
}

function render(stats: any) {
  clear();
  console.log(bold("╔═══════════════════════════════════════════════════╗"));
  console.log(bold("║     AEP — TREASURY & ACTIVITY MONITOR             ║"));
  console.log(bold("║     Base Mainnet (chainId 8453)                   ║"));
  console.log(bold("╚═══════════════════════════════════════════════════╝"));
  console.log();
  console.log(blue("  TREASURY") + dim(` (${TREASURY.slice(0,6)}...${TREASURY.slice(-4)})`));
  console.log(`  AGT:    ${green(parseFloat(ethers.formatEther(stats.treasuryAGT)).toFixed(4))} AGT`);
  console.log(`  ETH:    ${green(parseFloat(ethers.formatEther(stats.ethBal)).toFixed(6))} ETH`);
  console.log(`  Block:  ${dim("#" + stats.block)}`);
  console.log();
  console.log(blue("  PROTOCOL STATS"));
  console.log(`  Agents:  ${yellow(stats.totalAgents.toString())}`);
  console.log(`  Needs:   ${yellow(stats.totalNeeds.toString())}`);
  console.log(`  Offers:  ${yellow(stats.totalOffers.toString())}`);
  console.log(`  Supply:  ${dim(parseFloat(ethers.formatEther(stats.totalSupply)).toLocaleString())} AGT`);
  console.log();
  console.log(blue("  LIVE EVENTS"));
  if (events.length === 0) {
    console.log(dim("  Waiting for on-chain activity..."));
  } else {
    events.forEach(e => console.log("  " + e));
  }
  console.log();
  console.log(dim(`  Refreshing every 10s · ${new Date().toLocaleTimeString()} · Ctrl+C to stop`));
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);

  // Subscribe to events
  const registry = new ethers.Contract(CONTRACTS.AgentRegistry,    REGISTRY_ABI,    provider);
  const market   = new ethers.Contract(CONTRACTS.Marketplace,       MARKETPLACE_ABI, provider);
  const engine   = new ethers.Contract(CONTRACTS.NegotiationEngine, NEGOTIATION_ABI, provider);
  const token    = new ethers.Contract(CONTRACTS.AgentToken,        TOKEN_ABI,       provider);

  registry.on("AgentRegistered", (agent: string, caps: string[]) => {
    logEvent(green("🤖 New agent: ") + agent.slice(0,10) + "... [" + caps.slice(0,2).join(", ") + "]");
  });
  market.on("NeedPublished", (id: bigint, requester: string, budget: bigint) => {
    logEvent(yellow("📢 Need #" + id + ": ") + ethers.formatEther(budget) + " AGT max");
  });
  market.on("OfferPublished", (id: bigint, provider: string, price: bigint) => {
    logEvent(blue("💼 Offer #" + id + ": ") + ethers.formatEther(price) + " AGT/unit");
  });
  engine.on("ProposalCreated", (id: bigint, req: string, prov: string, price: bigint) => {
    logEvent(yellow("🤝 Proposal #" + id + ": ") + ethers.formatEther(price) + " AGT");
  });
  engine.on("ProposalAccepted", (id: bigint, agreement: string) => {
    logEvent(green("✅ Deal #" + id + " closed → ") + agreement.slice(0,10) + "...");
  });
  token.on("Transfer", (from: string, to: string, value: bigint) => {
    if (to.toLowerCase() === TREASURY.toLowerCase()) {
      logEvent(green("💰 FEE received: ") + ethers.formatEther(value) + " AGT → treasury");
    }
  });

  // Poll and render
  async function refresh() {
    try {
      const stats = await fetchStats(provider);
      render(stats);
    } catch (e: any) {
      console.error("RPC error:", e.message);
    }
  }

  await refresh();
  setInterval(refresh, 10_000);
}

main().catch(console.error);
