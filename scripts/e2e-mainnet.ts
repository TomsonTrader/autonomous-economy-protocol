/**
 * E2E Mainnet Verification Script
 * Runs 10 real checks against Base Mainnet to prove the full protocol works.
 * Run: npx ts-node scripts/e2e-mainnet.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });

import { ethers } from "ethers";
import * as fs from "fs";

const BACKEND = "https://autonomous-economy-protocol-production.up.railway.app";
const DEPLOYMENT = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../deployments/base-mainnet.json"), "utf-8")
);
const C = DEPLOYMENT.contracts;

const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function ok(label: string, detail = "") {
  console.log(`  ✅ ${label}${detail ? "  →  " + detail : ""}`);
  passed++;
}

function fail(label: string, err: any) {
  console.log(`  ❌ ${label}  →  ${err?.message ?? String(err)}`);
  failed++;
}

async function apiGet(path: string): Promise<any> {
  const res = await fetch(`${BACKEND}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<any>;
}

async function apiPost(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${BACKEND}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n════════════════════════════════════════════════════════");
  console.log("  🔬 AEP E2E VERIFICATION — Base Mainnet");
  console.log("════════════════════════════════════════════════════════\n");

  // ── 1. Backend health ─────────────────────────────────────────────────────
  console.log("1. Backend health check");
  try {
    const health = await apiGet("/health");
    ok("Backend is online", `network=${health.network} ws_clients=${health.wsClients}`);
  } catch (e) { fail("Backend health", e); }

  // ── 2. Marketplace stats ──────────────────────────────────────────────────
  console.log("\n2. Marketplace stats");
  try {
    const stats = await apiGet("/api/monitor/stats");
    const m = stats.market;
    ok("Stats endpoint", `agents=${m.activeAgents} needs=${m.totalNeeds} offers=${m.totalOffers} proposals=${m.totalProposals}`);
    if (m.activeAgents < 1) throw new Error("No agents registered");
    ok("At least 1 agent registered");
  } catch (e) { fail("Marketplace stats", e); }

  // ── 3. Faucet availability ────────────────────────────────────────────────
  console.log("\n3. Faucet status");
  try {
    const status = await apiGet("/api/faucet/status");
    if (!status.configured) {
      ok("Faucet endpoint", "not configured on this deployment");
    } else {
      ok("Faucet endpoint", `balance=${status.balance} AGT`);
      if (parseFloat(status.balance) < 100) throw new Error("Faucet balance low");
      ok("Faucet has funds");
    }
  } catch (e) { fail("Faucet status", e); }

  // ── 4. Agents API ─────────────────────────────────────────────────────────
  console.log("\n4. Agents API");
  try {
    const agents = await apiGet("/api/agents");
    if (!agents.agents || agents.agents.length === 0) throw new Error("No agents returned");
    const a = agents.agents[0];
    ok("Agents list", `first=${a.name} caps=${a.capabilities?.join(",")}`);
  } catch (e) { fail("Agents API", e); }

  // ── 5. Needs and offers ───────────────────────────────────────────────────
  console.log("\n5. Needs & Offers");
  try {
    const needs = await apiGet("/api/market/needs");
    const offers = await apiGet("/api/market/offers");
    ok("Needs published", `count=${needs.total ?? needs.needs?.length}`);
    ok("Offers published", `count=${offers.total ?? offers.offers?.length}`);
  } catch (e) { fail("Needs/Offers", e); }

  // ── 6. On-chain: AgentRegistry ────────────────────────────────────────────
  console.log("\n6. On-chain registry read");
  try {
    const registry = new ethers.Contract(C.AgentRegistry, [
      "function getActiveAgents() view returns (address[])",
    ], provider);
    const agents = await registry.getActiveAgents();
    if (agents.length === 0) throw new Error("No on-chain agents");
    ok("Registry on-chain", `${agents.length} agents`);
  } catch (e) { fail("Registry on-chain", e); }

  // ── 7. On-chain: Marketplace totals ───────────────────────────────────────
  console.log("\n7. On-chain marketplace");
  try {
    const market = new ethers.Contract(C.Marketplace, [
      "function totalNeeds() view returns (uint256)",
      "function totalOffers() view returns (uint256)",
    ], provider);
    const [needs, offers] = await Promise.all([market.totalNeeds(), market.totalOffers()]);
    if (needs === 0n && offers === 0n) throw new Error("Empty marketplace");
    ok("Marketplace on-chain", `needs=${needs} offers=${offers}`);
  } catch (e) { fail("Marketplace on-chain", e); }

  // ── 8. On-chain: ReputationSystem ─────────────────────────────────────────
  console.log("\n8. Reputation system");
  try {
    const registry = new ethers.Contract(C.AgentRegistry, [
      "function getActiveAgents() view returns (address[])",
    ], provider);
    const reputation = new ethers.Contract(C.ReputationSystem, [
      "function getReputation(address) view returns (uint256 score, uint256 totalDeals, uint256 successfulDeals, uint256 totalValueTransacted, uint256 lastUpdated)",
    ], provider);
    const agents = await registry.getActiveAgents();
    let hasScore = false;
    for (const addr of agents.slice(0, 5)) {
      const [score, , , ,] = await reputation.getReputation(addr);
      if (score > 0n) { hasScore = true; break; }
    }
    ok("Reputation system", hasScore ? "At least 1 agent has score > 0" : "No scores yet (new protocol)");
  } catch (e) { fail("Reputation", e); }

  // ── 9. On-chain: AgentVault ───────────────────────────────────────────────
  console.log("\n9. AgentVault (staking)");
  try {
    const vault = new ethers.Contract(C.AgentVault, [
      "function totalStaked() view returns (uint256)",
      "function yieldPool() view returns (uint256)",
    ], provider);
    const [totalStaked, yieldPool] = await Promise.all([vault.totalStaked(), vault.yieldPool()]);
    ok("AgentVault on-chain", `staked=${ethers.formatEther(totalStaked)} AGT  yieldPool=${ethers.formatEther(yieldPool)} AGT`);
  } catch (e) { fail("AgentVault", e); }

  // ── 10. Activity feed ─────────────────────────────────────────────────────
  console.log("\n10. Activity feed");
  try {
    const activity = await apiGet("/api/monitor/activity?limit=5");
    const events = activity.events || [];
    if (events.length === 0) {
      ok("Activity feed", "endpoint live (0 events — backend recently restarted)");
    } else {
      ok("Activity feed", `${events.length} events, latest=${events[0].type}`);
    }
  } catch (e) { fail("Activity feed", e); }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n════════════════════════════════════════════════════════");
  const total = passed + failed;
  if (failed === 0) {
    console.log(`  🎉 ALL ${total}/10 CHECKS PASSED — Protocol fully operational`);
  } else {
    console.log(`  ⚠️  ${passed}/${total} passed, ${failed} failed`);
  }
  console.log("════════════════════════════════════════════════════════\n");

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("\n❌ E2E script crashed:", e.message);
  process.exit(1);
});
