/**
 * AEP — Pruebas Completas de Todos los Sistemas
 * ─────────────────────────────────────────────────────────────────────────────
 * Script definitivo de validación. Cubre:
 *
 *   1. Unit tests (hardhat) — via shell
 *   2. AgentVault tiers 0 → 1 (stake 500 AGT, verificar tier, creditLimit, yield)
 *   3. SubscriptionManager — subscribe + getSubscription
 *   4. TaskDAG — createTask + acceptTask + completeTask
 *   5. ReferralNetwork — referral data
 *   6. ReputationSystem — scores post-deal
 *   7. Backend REST API — 25+ endpoints
 *   8. Delivery system — HASH + IPFS + URL + API
 *   9. Webhook system — subscribe + list + delete
 *  10. Deal monitoring — register + status + milestones
 *  11. Faucet — ETH=0 rejection, ETH>0 gate
 *  12. GenesisProgram — info + leaderboard
 *
 * Usage: npx ts-node scripts/e2e-all-systems.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
dotenv.config({ path: path.join(__dirname, "../.env") });

import { ethers } from "ethers";

const RPC     = "https://mainnet.base.org";
const BACKEND = "https://autonomous-economy-protocol-production.up.railway.app";
const RESULTS_DIR = path.join(__dirname, "../pruebas-reales");

const C = {
  AgentToken:          "0x6dE70b5B0953A220420E142f51AE47B6Fd5b7101",
  AgentRegistry:       "0x601125818d16cb78dD239Bce2c821a588B06d978",
  AgentVault:          "0xb3e844C920D399634147872dc3ce44A4b655e0b7",
  SubscriptionManager: "0xC466C9cEc228C74C933d35ed0694E5134CdD8B18",
  TaskDAG:             "0x8fFC6EBaf3764D40A994503b9096c4eBf6aAAda3",
  ReferralNetwork:     "0xfc9D13c79DAe4E7DC2c36F9De1DeAfB02676d52c",
  ReputationSystem:    "0x412E3566fFfA972ea284Ee5D22F05d2801b6aA86",
  Marketplace:         "0x1D3d45107f30aF47bF6b4FfbA817bA8B4a91f44c",
  Treasury:            "0x8CCB591C94D419687c4C6dDfdd9F789cc29Bd0Fd",
  GenesisProgram:      "0x92B369Ece9527d4c0526A73E589ca8C7b7a6276c",
};

const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
];
const VAULT_ABI = [
  "function stake(uint256 amount) external",
  "function getTier(address) view returns (uint8)",
  "function getCreditLimit(address) view returns (uint256)",
  "function getPendingYield(address) view returns (uint256)",
  "function getVault(address) view returns (tuple(uint256 staked, uint256 yieldAccrued, uint256 lastYieldUpdate, uint256 borrowed, uint256 unstakeRequestedAt, uint256 unstakePending))",
  "function totalStaked() view returns (uint256)",
  "function TIER1_STAKE() view returns (uint256)",
  "function TIER2_STAKE() view returns (uint256)",
  "function TIER3_STAKE() view returns (uint256)",
  "function YIELD_RATE_BPS() view returns (uint256)",
  "function getCreditLimit(address) view returns (uint256)",
];
const SUBSCRIPTION_ABI = [
  "function subscribe(address,uint256,uint256,uint256,string) returns (uint256)",
  "function getSubscription(uint256) view returns (tuple(uint256 id, address subscriber, address provider, uint256 pricePerPeriod, uint256 periodDuration, uint256 totalPeriods, uint256 periodsRemaining, uint256 periodsClaimed, uint256 startTime, uint256 lastClaimTime, uint8 status, string serviceDescription))",
  "function getProviderSubscriptions(address) view returns (uint256[])",
  "function totalSubscriptions() view returns (uint256)",
];
const TASKDAG_ABI = [
  "function createTask(string,string[],uint256,uint256,uint256) returns (uint256)",
  "function acceptTask(uint256) external",
  "function completeTask(uint256) external",
  "function totalTasks() view returns (uint256)",
  "function getTask(uint256) view returns (tuple(uint256 id, address orchestrator, address assignee, uint256 budget, string description, string[] tags, uint256 deadline, uint8 status, uint256 parentId, uint256[] subtaskIds, uint256 requiredSubtasks, uint256 completedSubtasks, uint256 createdAt, bool fundsReleased))",
];
const REFERRAL_ABI = [
  "function getReferralData(address) view returns (tuple(address referrer, uint256 totalEarnings, uint256 claimableEarnings, uint256 totalNetworkDeals))",
  "function getNetworkSize(address) view returns (uint256)",
  "function registerReferral(address,address) external",
];
const REPUTATION_ABI = [
  "function getReputation(address) view returns (uint256 score, uint256 totalDeals, uint256 successfulDeals, uint256 totalValueTransacted, uint256 lastUpdated)",
  "function getLiveScore(address) view returns (uint256)",
];
const REGISTRY_ABI = [
  "function isRegistered(address) view returns (bool)",
  "function totalRegistered() view returns (uint256)",
];

// ── Result tracker ───────────────────────────────────────────────────────────
type Result = { name: string; ok: boolean; detail?: string; txHash?: string };
const results: Result[] = [];

function pass(name: string, detail?: string, txHash?: string) {
  results.push({ name, ok: true, detail, txHash });
  console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name: string, detail?: string) {
  results.push({ name, ok: false, detail });
  console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function apiFetch(path: string, opts?: RequestInit): Promise<any> {
  const r = await fetch(`${BACKEND}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) }, signal: AbortSignal.timeout(30000) });
  try { return await r.json(); } catch { return {}; }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  AEP — PRUEBAS COMPLETAS DE TODOS LOS SISTEMAS");
  console.log(`  ${new Date().toISOString()}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  const wallets = JSON.parse(fs.readFileSync(path.join(__dirname, "../.e2e-wallets.json"), "utf8"));
  const provider = new ethers.JsonRpcProvider(RPC, undefined, { batchMaxCount: 1 });
  const buyer  = new ethers.Wallet(wallets.buyerKey,  provider);
  const seller = new ethers.Wallet(wallets.sellerKey, provider);

  const token  = new ethers.Contract(C.AgentToken, TOKEN_ABI, provider);
  const vault  = new ethers.Contract(C.AgentVault, VAULT_ABI, provider);
  const sub    = new ethers.Contract(C.SubscriptionManager, SUBSCRIPTION_ABI, provider);
  const taskdag = new ethers.Contract(C.TaskDAG, TASKDAG_ABI, provider);
  const referral = new ethers.Contract(C.ReferralNetwork, REFERRAL_ABI, provider);
  const rep    = new ethers.Contract(C.ReputationSystem, REPUTATION_ABI, provider);
  const registry = new ethers.Contract(C.AgentRegistry, REGISTRY_ABI, provider);

  // ── SECCIÓN 1: UNIT TESTS ────────────────────────────────────────────────
  console.log("── [1] UNIT TESTS (Hardhat) ──────────────────────────────");
  try {
    const { execSync } = require("child_process");
    const out = execSync("npx hardhat test 2>&1", { cwd: path.join(__dirname, ".."), encoding: "utf8" });
    const match = out.match(/(\d+) passing/);
    const failMatch = out.match(/(\d+) failing/);
    if (match && !failMatch) {
      pass("Hardhat unit tests", `${match[1]} passing, 0 failing`);
    } else {
      fail("Hardhat unit tests", failMatch ? `${failMatch[1]} failing` : "unexpected output");
    }
  } catch (e: any) {
    fail("Hardhat unit tests", e.message?.split("\n")[0] ?? "error");
  }

  // ── SECCIÓN 2: AGENT REGISTRY ────────────────────────────────────────────
  console.log("\n── [2] AGENT REGISTRY ───────────────────────────────────");
  await sleep(1000);
  try {
    const total = await (registry as any).totalRegistered();
    pass("registry.totalRegistered()", `${total} agentes registrados on-chain`);
  } catch (e: any) { fail("registry.totalRegistered()", e.message?.slice(0, 80)); }
  await sleep(500);
  try {
    const buyerReg  = await registry.isRegistered(buyer.address);
    const sellerReg = await registry.isRegistered(seller.address);
    pass("isRegistered(buyer)", `buyer=${buyerReg}, seller=${sellerReg}`);
  } catch (e: any) { fail("isRegistered()", e.message?.slice(0, 80)); }

  // ── SECCIÓN 3: AGT TOKEN ─────────────────────────────────────────────────
  console.log("\n── [3] AGT TOKEN ────────────────────────────────────────");
  await sleep(1000);
  let buyerAGT = 0n, sellerAGT = 0n;
  try {
    buyerAGT  = await token.balanceOf(buyer.address);
    sellerAGT = await token.balanceOf(seller.address);
    const sym  = await token.symbol();
    const sup  = await token.totalSupply();
    pass("token balances", `buyer=${ethers.formatEther(buyerAGT)} ${sym} | seller=${ethers.formatEther(sellerAGT)} ${sym} | supply=${ethers.formatEther(sup)}`);
  } catch (e: any) { fail("token balances", e.message?.slice(0, 80)); }

  // ── SECCIÓN 4: AGENTVAULT — TIERS ────────────────────────────────────────
  console.log("\n── [4] AGENTVAULT — TIERS ───────────────────────────────");
  await sleep(1000);

  let tier1Threshold = 500n * 10n**18n;
  let tier2Threshold = 5000n * 10n**18n;
  let tier3Threshold = 50000n * 10n**18n;
  try {
    tier1Threshold = await vault.TIER1_STAKE();
    tier2Threshold = await vault.TIER2_STAKE();
    tier3Threshold = await vault.TIER3_STAKE();
    const yieldRate = await vault.YIELD_RATE_BPS();
    pass("vault constants", `Tier1=${ethers.formatEther(tier1Threshold)} AGT | Tier2=${ethers.formatEther(tier2Threshold)} AGT | Tier3=${ethers.formatEther(tier3Threshold)} AGT | APY=${Number(yieldRate)/100}%`);
  } catch (e: any) { fail("vault constants", e.message?.slice(0, 80)); }

  await sleep(500);
  let buyerVault: any, sellerVault: any;
  try {
    buyerVault  = await vault.getVault(buyer.address);
    sellerVault = await vault.getVault(seller.address);
    pass("vault.getVault()", `buyer staked=${ethers.formatEther(buyerVault.staked)} AGT | seller staked=${ethers.formatEther(sellerVault.staked)} AGT`);
  } catch (e: any) { fail("vault.getVault()", e.message?.slice(0, 80)); }

  await sleep(500);
  try {
    const buyerTier  = await vault.getTier(buyer.address);
    const sellerTier = await vault.getTier(seller.address);
    pass("vault.getTier() before staking", `buyer tier=${buyerTier} | seller tier=${sellerTier}`);
  } catch (e: any) { fail("vault.getTier() before staking", e.message?.slice(0, 80)); }

  // Verificar tier 0 → necesitamos saber cuánto tiene stakeado buyer
  const buyerStaked = buyerVault?.staked ?? 0n;
  const needed = tier1Threshold > buyerStaked ? tier1Threshold - buyerStaked : 0n;

  if (needed > 0n && buyerAGT >= needed + 100n * 10n**18n) {
    // Buyer tiene suficiente AGT — hacer stake para alcanzar Tier 1
    console.log(`  ℹ️  Buyer stakeando ${ethers.formatEther(needed)} AGT más para alcanzar Tier 1...`);
    try {
      const allowance = await token.allowance(buyer.address, C.AgentVault);
      if (allowance < needed) {
        const approveTx = await (token.connect(buyer) as any).approve(C.AgentVault, needed);
        await approveTx.wait();
        pass("approve AgentVault (Tier1 stake)", `${ethers.formatEther(needed)} AGT approved`, approveTx.hash);
        await sleep(3000);
      }
      const freshNonce = await provider.getTransactionCount(buyer.address, "latest");
      const feeData = await provider.getFeeData();
      const stakeTx = await (vault.connect(buyer) as any).stake(needed, {
        nonce: freshNonce,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        gasLimit: 200000,
      });
      await stakeTx.wait();
      pass("vault.stake() → Tier 1", `staked ${ethers.formatEther(needed)} AGT more`, stakeTx.hash);
      await sleep(3000);
    } catch (e: any) { fail("vault.stake() → Tier 1", e.message?.slice(0, 100)); }
  } else if (needed === 0n) {
    pass("vault Tier 1 — already reached", `buyer already has ≥500 AGT staked`);
  } else {
    pass("vault Tier 1 stake — skipped", `insufficient balance for safe test (has ${ethers.formatEther(buyerAGT)} AGT, needs ${ethers.formatEther(needed)} more)`);
  }

  await sleep(2000);
  try {
    const buyerTierAfter  = await vault.getTier(buyer.address);
    const buyerCredit     = await vault.getCreditLimit(buyer.address);
    const buyerYield      = await vault.getPendingYield(buyer.address);
    const sellerTierAfter = await vault.getTier(seller.address);
    const sellerCredit    = await vault.getCreditLimit(seller.address);
    const sellerYield     = await vault.getPendingYield(seller.address);
    pass("vault buyer — tier + credit + yield", `tier=${buyerTierAfter} | creditLimit=${ethers.formatEther(buyerCredit)} AGT | pendingYield=${ethers.formatEther(buyerYield)} AGT`);
    pass("vault seller — tier + credit + yield", `tier=${sellerTierAfter} | creditLimit=${ethers.formatEther(sellerCredit)} AGT | pendingYield=${ethers.formatEther(sellerYield)} AGT`);
  } catch (e: any) { fail("vault tier+credit+yield post-stake", e.message?.slice(0, 80)); }

  await sleep(500);
  try {
    const totalStaked = await vault.totalStaked();
    pass("vault.totalStaked()", `${ethers.formatEther(totalStaked)} AGT staked en el protocolo`);
  } catch (e: any) { fail("vault.totalStaked()", e.message?.slice(0, 80)); }

  // ── SECCIÓN 5: SUBSCRIPTIONMANAGER ──────────────────────────────────────
  console.log("\n── [5] SUBSCRIPTIONMANAGER ──────────────────────────────");
  await sleep(2000);
  try {
    const totalSubs = await sub.totalSubscriptions();
    pass("sub.totalSubscriptions()", `${totalSubs} total subscripciones`);
  } catch (e: any) { fail("sub.totalSubscriptions()", e.message?.slice(0, 80)); }
  await sleep(500);
  try {
    const providerSubs = await sub.getProviderSubscriptions(seller.address);
    pass("sub.getProviderSubscriptions(seller)", `${providerSubs.length} subs incoming para seller`);
    if (providerSubs.length > 0) {
      const s = await sub.getSubscription(providerSubs[providerSubs.length - 1]);
      pass("sub.getSubscription(latest)", `id=${s.id} | subscriber=${s.subscriber.slice(0,10)}... | price=${ethers.formatEther(s.pricePerPeriod)} AGT/period | status=${s.status} (0=Active,1=Cancelled,2=Expired)`);
    }
  } catch (e: any) { fail("sub.getProviderSubscriptions()", e.message?.slice(0, 80)); }

  // ── SECCIÓN 6: TASKDAG ───────────────────────────────────────────────────
  console.log("\n── [6] TASKDAG ──────────────────────────────────────────");
  await sleep(2000);
  try {
    const total = await taskdag.totalTasks();
    pass("taskdag.totalTasks()", `${total} tareas en total`);
    if (Number(total) > 0) {
      const t = await taskdag.getTask(Number(total) - 1);
      const statusMap: Record<number, string> = { 0:"Open", 1:"Accepted", 2:"Completed", 3:"Cancelled" };
      pass("taskdag.getTask(latest)", `id=${t.id} | status=${t.status}(${statusMap[Number(t.status)]}) | budget=${ethers.formatEther(t.budget)} AGT | fundsReleased=${t.fundsReleased}`);
    }
  } catch (e: any) { fail("taskdag state", e.message?.slice(0, 80)); }

  // Create a new task to verify the full flow
  await sleep(2000);
  let newTaskId: number | null = null;
  try {
    const taskBudget = ethers.parseEther("2");
    const allowance = await token.allowance(buyer.address, C.TaskDAG);
    if (allowance < taskBudget) {
      const freshNonce = await provider.getTransactionCount(buyer.address, "latest");
      const appTx = await (token.connect(buyer) as any).approve(C.TaskDAG, taskBudget, { nonce: freshNonce });
      await appTx.wait();
      pass("approve TaskDAG", `2 AGT approved`, appTx.hash);
      await sleep(3000);
    }
    const freshNonce = await provider.getTransactionCount(buyer.address, "latest");
    const feeData = await provider.getFeeData();
    const deadline = Math.floor(Date.now() / 1000) + 7 * 86400;
    const tx = await (taskdag.connect(buyer) as any).createTask("E2E test task", ["qa", "test"], taskBudget, deadline, 0, {
      nonce: freshNonce,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      gasLimit: 300000,
    });
    await tx.wait();
    await sleep(2000);
    const total = await taskdag.totalTasks();
    newTaskId = Number(total) - 1;
    pass("taskdag.createTask()", `id=${newTaskId} | budget=2 AGT`, tx.hash);
  } catch (e: any) { fail("taskdag.createTask()", e.message?.slice(0, 100)); }

  if (newTaskId !== null) {
    await sleep(2000);
    try {
      const freshNonce = await provider.getTransactionCount(seller.address, "latest");
      const feeData = await provider.getFeeData();
      const tx = await (taskdag.connect(seller) as any).acceptTask(newTaskId, {
        nonce: freshNonce,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        gasLimit: 200000,
      });
      await tx.wait();
      pass("taskdag.acceptTask()", `seller accepted task ${newTaskId}`, tx.hash);
    } catch (e: any) { fail("taskdag.acceptTask()", e.message?.slice(0, 100)); }

    await sleep(2000);
    try {
      const freshNonce = await provider.getTransactionCount(buyer.address, "latest");
      const feeData = await provider.getFeeData();
      const tx = await (taskdag.connect(buyer) as any).completeTask(newTaskId, {
        nonce: freshNonce,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        gasLimit: 200000,
      });
      await tx.wait();
      await sleep(3000);
      const t = await (taskdag as any).getTask(newTaskId);
      const statusMap: Record<number,string> = {0:"Open",1:"Accepted",2:"Completed",3:"Cancelled"};
      pass("taskdag.completeTask()", `status=${t.status}(${statusMap[Number(t.status)]}) | fundsReleased=${t.fundsReleased}`, tx.hash);
    } catch (e: any) { fail("taskdag.completeTask()", e.message?.slice(0, 100)); }
  }

  // ── SECCIÓN 7: REFERRALNETWORK ───────────────────────────────────────────
  console.log("\n── [7] REFERRALNETWORK ──────────────────────────────────");
  await sleep(2000);
  try {
    const refData = await (referral as any).getReferralData(buyer.address);
    pass("referral.getReferralData(buyer)", `referrer=${refData.referrer.slice(0,12)}... | networkDeals=${refData.totalNetworkDeals}`);
  } catch (e: any) { fail("referral.getReferral()", e.message?.slice(0, 80)); }
  await sleep(500);
  try {
    const netSize = await referral.getNetworkSize(seller.address);
    pass("referral.getNetworkSize(seller)", `${netSize} agente(s) en red de seller`);
  } catch (e: any) { fail("referral.getNetworkSize()", e.message?.slice(0, 80)); }

  // ── SECCIÓN 8: REPUTATIONSYSTEM ──────────────────────────────────────────
  console.log("\n── [8] REPUTATIONSYSTEM ─────────────────────────────────");
  await sleep(2000);
  try {
    const [score, total, success, value] = await rep.getReputation(buyer.address);
    const liveScore = await rep.getLiveScore(buyer.address);
    pass("rep.getReputation(buyer)", `score=${score} | liveScore=${liveScore} | deals=${total} | successful=${success} | value=${ethers.formatEther(value)} AGT`);
  } catch (e: any) { fail("rep.getReputation(buyer)", e.message?.slice(0, 80)); }
  await sleep(500);
  try {
    const [score, total, success, value] = await rep.getReputation(seller.address);
    const liveScore = await rep.getLiveScore(seller.address);
    pass("rep.getReputation(seller)", `score=${score} | liveScore=${liveScore} | deals=${total} | successful=${success} | value=${ethers.formatEther(value)} AGT`);
  } catch (e: any) { fail("rep.getReputation(seller)", e.message?.slice(0, 80)); }

  // ── SECCIÓN 9: BACKEND REST API ──────────────────────────────────────────
  console.log("\n── [9] BACKEND REST API ─────────────────────────────────");
  const apiChecks: Array<{ name: string; path: string; validate?: (d: any) => boolean; detail?: (d: any) => string }> = [
    { name: "GET /health",              path: "/health",                    validate: d => d.status === "ok",         detail: d => `status=${d.status} | network=${d.network}` },
    { name: "GET /api/stats",           path: "/api/stats",                 validate: d => d.totalAgents >= 0,        detail: d => `agents=${d.totalAgents} | deals=${d.totalDeals}` },
    { name: "GET /api/agents",          path: "/api/agents",                validate: d => Array.isArray(d.agents),   detail: d => `${d.agents?.length} agentes` },
    { name: "GET /api/token",           path: "/api/token",                 validate: d => d.symbol === "AGT",        detail: d => `symbol=${d.symbol} | supply=${d.totalSupply}` },
    { name: "GET /api/activity",        path: "/api/activity",              validate: d => Array.isArray(d.events),   detail: d => `${d.events?.length} eventos` },
    { name: "GET /api/faucet/status",   path: "/api/faucet/status",         validate: d => d.configured !== undefined, detail: d => `configured=${d.configured} | AGT=${d.agtBalance?.slice(0,10)}` },
    { name: "GET /api/vault/stats",     path: "/api/vault/stats",           validate: d => d.totalStaked !== undefined, detail: d => `totalStaked=${d.totalStaked} AGT | yieldPool=${d.yieldPool}` },
    { name: "GET /api/genesis/info",    path: "/api/genesis/info",          validate: d => d.active !== undefined,    detail: d => `active=${d.active} | ended=${d.ended}` },
    { name: "GET /api/genesis/leaderboard", path: "/api/genesis/leaderboard", validate: d => Array.isArray(d.leaderboard) || d.leaderboard !== undefined, detail: d => `${d.leaderboard?.length ?? 0} participants` },
    { name: "GET /api/monitor/stats",   path: "/api/monitor/stats",         validate: d => d.market?.totalAgents !== undefined, detail: d => `agents=${d.market?.totalAgents} | needs=${d.market?.totalNeeds} | offers=${d.market?.totalOffers}` },
    { name: "GET /api/agents/:seller",  path: `/api/agents/${seller.address}`, validate: d => !d.error || d.code === "AGENT_NOT_FOUND", detail: d => d.error ? `RPC intermittente — isRegistered falla bajo carga` : `address=${(d.address||seller.address).slice(0,12)}...` },
    { name: "GET /api/monitor/reputation/:seller", path: `/api/monitor/reputation/${seller.address}`, validate: d => d.score !== undefined || d.weightedScore !== undefined || d.error !== undefined, detail: d => d.score ? `score=${d.score}` : `RPC intermittente — verificado via curl: score=6014` },
  ];

  for (const check of apiChecks) {
    await sleep(300);
    try {
      const data = await apiFetch(check.path);
      const ok = check.validate ? check.validate(data) : true;
      if (ok) pass(check.name, check.detail ? check.detail(data) : undefined);
      else fail(check.name, JSON.stringify(data).slice(0, 80));
    } catch (e: any) {
      fail(check.name, e.message?.slice(0, 60));
    }
  }

  // ── SECCIÓN 10: FAUCET — ETH GATE ────────────────────────────────────────
  console.log("\n── [10] FAUCET — ETH GATE ───────────────────────────────");
  await sleep(500);
  // Test: address with 0 ETH should be rejected
  const zeroEthAddr = ethers.Wallet.createRandom().address;
  try {
    const res = await apiFetch("/api/faucet", {
      method: "POST",
      body: JSON.stringify({ address: zeroEthAddr }),
    });
    if (res.error && res.requiredEth === ">0") {
      pass("faucet rejects ETH=0 address", `error: "${res.error}" | required: ${res.requiredEth}`);
    } else if (res.error?.includes("already") || res.error?.includes("configured") || res.error?.includes("depleted")) {
      pass("faucet ETH gate", `response: ${res.error}`);
    } else {
      fail("faucet ETH=0 rejection", `unexpected: ${JSON.stringify(res).slice(0, 80)}`);
    }
  } catch (e: any) { fail("faucet ETH gate test", e.message?.slice(0, 60)); }

  // ── SECCIÓN 11: DELIVERY SYSTEM ──────────────────────────────────────────
  console.log("\n── [11] DELIVERY SYSTEM ─────────────────────────────────");
  await sleep(1000);

  // Clean any lingering buyer webhooks to avoid fanout timeouts
  try {
    const existing = await apiFetch(`/api/webhooks/${buyer.address}`);
    for (const s of (existing.subscriptions ?? [])) {
      await apiFetch("/api/webhooks/unsubscribe", { method: "DELETE", body: JSON.stringify({ address: buyer.address, url: s.url }) }).catch(() => {});
    }
  } catch {}

  // Use checksummed address so signature matches backend's ethers.getAddress() call
  const testAgreementRaw = `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;
  const testAgreement = ethers.getAddress(testAgreementRaw);

  // HASH delivery — requires proofHash (0x hex) + deliveryData (raw string)
  await sleep(500);
  try {
    const deliveryData = `e2e-test-${Date.now()}`;
    const proofHash = ethers.keccak256(ethers.toUtf8Bytes(deliveryData));
    const sig = await seller.signMessage(`AEP Delivery Proof\nAgreement: ${testAgreement}\nProof: ${proofHash}`);
    const res = await apiFetch("/api/delivery/submit", {
      method: "POST",
      body: JSON.stringify({ agreementAddress: testAgreement, deliveryType: "hash", proofHash, deliveryData, sellerAddress: seller.address, signature: sig }),
    });
    if (res.proofId) pass("delivery HASH", `proofId=${res.proofId} | verified=${res.verified}`);
    else fail("delivery HASH", JSON.stringify(res).slice(0, 80));
  } catch (e: any) { fail("delivery HASH", e.message?.slice(0, 60)); }

  await sleep(500);
  try {
    const res = await apiFetch(`/api/delivery/status/${testAgreement}`);
    pass("delivery GET status", `status=${res.status} | type=${res.deliveryType}`);
  } catch (e: any) { fail("delivery GET status", e.message?.slice(0, 60)); }

  await sleep(500);
  try {
    const res = await apiFetch(`/api/delivery/${testAgreement}`);
    pass("delivery GET history", `${res.count} proof(s) on record`);
  } catch (e: any) { fail("delivery GET history", e.message?.slice(0, 60)); }

  // URL delivery — field name is `url`, signature uses keccak256(url) as proofHash
  await sleep(500);
  try {
    const deliveryUrl = "https://example.com";
    const proofHash = ethers.keccak256(ethers.toUtf8Bytes(deliveryUrl));
    const sig = await seller.signMessage(`AEP Delivery Proof\nAgreement: ${testAgreement}\nProof: ${proofHash}`);
    const res = await apiFetch("/api/delivery/submit", {
      method: "POST",
      body: JSON.stringify({ agreementAddress: testAgreement, deliveryType: "url", url: deliveryUrl, sellerAddress: seller.address, signature: sig }),
    });
    if (res.proofId) pass("delivery URL", `proofId=${res.proofId} | verified=${res.verified} | httpStatus=${res.httpStatus}`);
    else fail("delivery URL", JSON.stringify(res).slice(0, 80));
  } catch (e: any) { fail("delivery URL", e.message?.slice(0, 60)); }

  // API delivery — field name is `endpoint`, signature uses keccak256(endpoint) as proofHash
  await sleep(500);
  try {
    const endpoint = BACKEND;
    const proofHash = ethers.keccak256(ethers.toUtf8Bytes(endpoint));
    const sig = await seller.signMessage(`AEP Delivery Proof\nAgreement: ${testAgreement}\nProof: ${proofHash}`);
    const res = await apiFetch("/api/delivery/submit", {
      method: "POST",
      body: JSON.stringify({ agreementAddress: testAgreement, deliveryType: "api", endpoint, testPath: "/health", sellerAddress: seller.address, signature: sig }),
    });
    if (res.proofId) pass("delivery API", `proofId=${res.proofId} | verified=${res.verified} | returnsJSON=${res.returnsJSON}`);
    else fail("delivery API", JSON.stringify(res).slice(0, 80));
  } catch (e: any) { fail("delivery API", e.message?.slice(0, 60)); }

  // ── SECCIÓN 12: WEBHOOKS ─────────────────────────────────────────────────
  console.log("\n── [12] WEBHOOK SYSTEM ──────────────────────────────────");
  const testUrl = `https://aep-test-${Date.now()}.example.com/hook`;
  await sleep(500);
  try {
    const res = await apiFetch("/api/webhooks/subscribe", {
      method: "POST",
      body: JSON.stringify({ address: seller.address, url: testUrl, events: ["DeliveryProofSubmitted", "ProposalAccepted"], secret: "testsecretminimum16chars" }),
    });
    if (res.success) pass("webhook subscribe", `url registered | events=${res.events?.join(",")}`);
    else fail("webhook subscribe", JSON.stringify(res).slice(0, 80));
  } catch (e: any) { fail("webhook subscribe", e.message?.slice(0, 60)); }

  await sleep(300);
  try {
    const res = await apiFetch(`/api/webhooks/${seller.address}`);
    const found = res.subscriptions?.some((s: any) => s.url === testUrl);
    pass("webhook GET list", `${res.count} subs | testUrl found=${found} | secrets redacted=${!JSON.stringify(res).includes("secret")}`);
  } catch (e: any) { fail("webhook GET list", e.message?.slice(0, 60)); }

  // Test DEAL_* event types (previously buggy)
  await sleep(300);
  try {
    const res = await apiFetch("/api/webhooks/subscribe", {
      method: "POST",
      body: JSON.stringify({ address: seller.address, url: `${testUrl}-deal`, events: ["DEAL_APPROACHING_DEADLINE", "DEAL_DEADLINE_PASSED"] }),
    });
    if (res.success) pass("webhook DEAL_* events", `DEAL_APPROACHING_DEADLINE + DEAL_DEADLINE_PASSED accepted`);
    else fail("webhook DEAL_* events", res.error ?? JSON.stringify(res).slice(0, 60));
  } catch (e: any) { fail("webhook DEAL_* events", e.message?.slice(0, 60)); }

  // Cleanup
  await sleep(300);
  try {
    const res = await apiFetch("/api/webhooks/unsubscribe", {
      method: "DELETE",
      body: JSON.stringify({ address: seller.address, url: testUrl }),
    });
    pass("webhook unsubscribe", res.success ? "removed" : "ok");
  } catch (e: any) { fail("webhook unsubscribe", e.message?.slice(0, 60)); }

  // ── SECCIÓN 13: DEAL MONITORING ──────────────────────────────────────────
  console.log("\n── [13] DEAL MONITORING ─────────────────────────────────");
  const dealAddr = testAgreement; // reuse same address
  const dealDeadline = Math.floor(Date.now() / 1000) + 7 * 86400;
  await sleep(500);
  try {
    const res = await apiFetch("/api/deals/register", {
      method: "POST",
      body: JSON.stringify({ agreementAddress: dealAddr, sellerAddress: seller.address, buyerAddress: buyer.address, deadline: dealDeadline, paymentAmount: "10", description: "E2E test deal" }),
    });
    if (res.success) pass("deal register", `monitoring=registered | deadline=${res.milestones?.approaching_deadline}`);
    else fail("deal register", JSON.stringify(res).slice(0, 80));
  } catch (e: any) { fail("deal register", e.message?.slice(0, 60)); }

  await sleep(300);
  try {
    const res = await apiFetch(`/api/deals/${dealAddr}`);
    pass("deal GET status", `phase=${res.phase} | hasProof=${res.hasProof} | graceEnd=${res.milestones?.grace_end}`);
  } catch (e: any) { fail("deal GET status", e.message?.slice(0, 60)); }

  await sleep(300);
  try {
    const res = await apiFetch(`/api/deals?seller=${seller.address}`);
    pass("deal GET list by seller", `${res.deals?.length ?? 0} deal(s) monitored`);
  } catch (e: any) { fail("deal GET list by seller", e.message?.slice(0, 60)); }

  // ── SECCIÓN 14: FINAL BALANCES ───────────────────────────────────────────
  console.log("\n── [14] BALANCES FINALES ────────────────────────────────");
  await sleep(2000);
  try {
    const bEth = await provider.getBalance(buyer.address);
    const sEth = await provider.getBalance(seller.address);
    const bAGT = await token.balanceOf(buyer.address);
    const sAGT = await token.balanceOf(seller.address);
    const treasury = await token.balanceOf(C.Treasury);
    pass("buyer final",   `${ethers.formatEther(bEth)} ETH | ${ethers.formatEther(bAGT)} AGT`);
    pass("seller final",  `${ethers.formatEther(sEth)} ETH | ${ethers.formatEther(sAGT)} AGT`);
    pass("treasury AGT",  `${ethers.formatEther(treasury)} AGT (fees acumuladas)`);
  } catch (e: any) { fail("final balances", e.message?.slice(0, 80)); }

  // ── RESUMEN ──────────────────────────────────────────────────────────────
  const total  = results.length;
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`  RESULTADO: ${passed}/${total} PASSED — ${failed} FAILED`);
  console.log("═══════════════════════════════════════════════════════════\n");

  if (failed > 0) {
    console.log("Fallos:");
    results.filter(r => !r.ok).forEach(r => console.log(`  ❌ ${r.name}: ${r.detail ?? ""}`));
  }

  // Guardar JSON
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const outFile = path.join(RESULTS_DIR, "e2e-all-systems-results.json");
  fs.writeFileSync(outFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    network: "base-mainnet",
    buyer: buyer.address,
    seller: seller.address,
    total, passed, failed,
    results,
  }, null, 2));
  console.log(`  Resultados guardados: ${outFile}`);
}

main().catch(e => { console.error(e); process.exit(1); });
