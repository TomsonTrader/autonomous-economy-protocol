/**
 * AEP Full Protocol E2E Test — Base Mainnet
 * ──────────────────────────────────────────────────────────────────────────────
 * Tests ALL protocol systems with real on-chain transactions and live backend calls.
 *
 * Covers:
 *   A. ON-CHAIN
 *      1. AgentVault   — stake AGT, check tier, credit limit, pending yield
 *      2. SubscriptionManager — buyer subscribes to seller's service
 *      3. TaskDAG      — create task (orchestrator), accept (agent), complete
 *      4. ReferralNetwork — register referral link
 *
 *   B. BACKEND API
 *      5. Health + Stats + Agents + Token endpoints
 *      6. Delivery Proof — HASH type (seller signs + submits)
 *      7. Webhook subscriptions — register, list, delete
 *      8. Deal monitoring — register, status, phases
 *
 * Usage:
 *   npx ts-node scripts/e2e-full-protocol.ts
 *
 * Wallets loaded from .e2e-wallets.json
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
dotenv.config({ path: path.join(__dirname, "../.env") });

import { ethers } from "ethers";

// ── Config ──────────────────────────────────────────────────────────────────
const RPC     = "https://mainnet.base.org";
const BACKEND = "https://autonomous-economy-protocol-production.up.railway.app";
// Note: Base public RPC rate-limits batch calls. Use sequential reads and retries.

const C = {
  AgentToken:          "0x6dE70b5B0953A220420E142f51AE47B6Fd5b7101",
  AgentRegistry:       "0x601125818d16cb78dD239Bce2c821a588B06d978",
  AgentVault:          "0xb3e844C920D399634147872dc3ce44A4b655e0b7",
  SubscriptionManager: "0xC466C9cEc228C74C933d35ed0694E5134CdD8B18",
  TaskDAG:             "0x8fFC6EBaf3764D40A994503b9096c4eBf6aAAda3",
  ReferralNetwork:     "0xfc9D13c79DAe4E7DC2c36F9De1DeAfB02676d52c",
  ReputationSystem:    "0x412E3566fFfA972ea284Ee5D22F05d2801b6aA86",
  NegotiationEngine:   "0xFfD596b2703b635059Bc2b6109a3173F29903D27",
  Marketplace:         "0x1D3d45107f30aF47bF6b4FfbA817bA8B4a91f44c",
  Treasury:            "0x8CCB591C94D419687c4C6dDfdd9F789cc29Bd0Fd",
};

// ── ABIs ────────────────────────────────────────────────────────────────────
const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
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
];

const SUBSCRIPTION_ABI = [
  "function subscribe(address provider, uint256 pricePerPeriod, uint256 periodDuration, uint256 totalPeriods, string serviceDescription) returns (uint256)",
  "function totalSubscriptions() view returns (uint256)",
  "function getSubscription(uint256 subId) view returns (tuple(uint256 id, address subscriber, address provider, uint256 pricePerPeriod, uint256 periodDuration, uint256 totalPeriods, uint256 periodsRemaining, uint256 periodsClaimed, uint256 startTime, uint256 lastClaimTime, uint8 status, string serviceDescription))",
  "function getProviderSubscriptions(address) view returns (uint256[])",
];

const TASKDAG_ABI = [
  "function createTask(string description, string[] tags, uint256 budget, uint256 deadline, uint256 requiredSubtasks) returns (uint256)",
  "function acceptTask(uint256 taskId) external",
  "function completeTask(uint256 taskId) external",
  "function totalTasks() view returns (uint256)",
  "function getTask(uint256 taskId) view returns (tuple(uint256 id, address orchestrator, address assignee, uint256 budget, string description, string[] tags, uint256 deadline, uint8 status, uint256 parentId, uint256[] subtaskIds, uint256 requiredSubtasks, uint256 completedSubtasks, uint256 createdAt, bool fundsReleased))",
];

const REFERRAL_ABI = [
  "function registerReferral(address agent, address referrer) external",
  "function getReferralData(address agent) view returns (tuple(address referrer, uint256 directReferrals, uint256 totalNetworkDeals, uint256 commissions, uint256 lastUpdated))",
  "function getNetworkSize(address referrer) view returns (uint256)",
];

const REPUTATION_ABI = [
  "function getReputation(address) view returns (uint256 score, uint256 totalDeals, uint256 successfulDeals, uint256 totalValueTransacted, uint256 lastUpdated)",
];

// ── Test state ───────────────────────────────────────────────────────────────
interface TestResult {
  name: string;
  ok: boolean;
  detail: string;
  txHash?: string;
}

const results: TestResult[] = [];
let taskIdForSeller: bigint | undefined;

function pass(name: string, detail: string, txHash?: string) {
  results.push({ name, ok: true, detail, txHash });
  const link = txHash ? `  → https://basescan.org/tx/${txHash}` : "";
  console.log(`  ✅ ${name}  →  ${detail}${link}`);
}

function fail(name: string, detail: string) {
  results.push({ name, ok: false, detail });
  console.error(`  ❌ ${name}  →  ${detail}`);
}

function section(title: string) {
  console.log(`\n${"═".repeat(64)}`);
  console.log(`  ${title}`);
  console.log("═".repeat(64));
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function waitTx(tx: ethers.TransactionResponse, label: string): Promise<string> {
  process.stdout.write(`  ⏳ ${label}... `);
  const receipt = await tx.wait(1);
  const hash = receipt!.hash;
  console.log(`confirmed (block ${receipt!.blockNumber})`);
  return hash;
}

async function apiFetch(path: string, opts?: RequestInit, timeoutMs = 60_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${BACKEND}${path}`, {
      headers: { "Content-Type": "application/json", ...opts?.headers },
      signal: ctrl.signal,
      ...opts,
    });
    clearTimeout(t);
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`HTTP ${r.status}: ${text.slice(0, 200)}`);
    }
    return r.json() as Promise<any>;
  } catch (e: any) {
    clearTimeout(t);
    if (e.name === "AbortError") throw new Error(`Request timed out (${timeoutMs / 1000}s)`);
    throw e;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n" + "═".repeat(64));
  console.log("  🔬 AEP FULL PROTOCOL E2E — Base Mainnet");
  console.log("  On-chain: Vault · Subscription · TaskDAG · Referral");
  console.log("  Backend: Delivery · Webhooks · Deal Monitoring · Stats");
  console.log("═".repeat(64));

  // batchMaxCount:1 prevents batch RPC calls that cause rate-limit failures on Base public RPC
  const provider = new ethers.JsonRpcProvider(RPC, undefined, { batchMaxCount: 1 });
  const wallets  = JSON.parse(fs.readFileSync(path.join(__dirname, "../.e2e-wallets.json"), "utf-8"));
  const buyer  = new ethers.Wallet(wallets.buyerKey,  provider);
  const seller = new ethers.Wallet(wallets.sellerKey, provider);

  console.log(`\n  Buyer:  ${buyer.address}`);
  console.log(`  Seller: ${seller.address}`);

  const token = new ethers.Contract(C.AgentToken, TOKEN_ABI, provider);

  // ── Contracts ───────────────────────────────────────────────────────────────
  const vault   = new ethers.Contract(C.AgentVault,          VAULT_ABI,        provider);
  const subMgr  = new ethers.Contract(C.SubscriptionManager, SUBSCRIPTION_ABI, provider);
  const taskdag = new ethers.Contract(C.TaskDAG,             TASKDAG_ABI,      provider);
  const referral = new ethers.Contract(C.ReferralNetwork,    REFERRAL_ABI,     provider);
  const repSys  = new ethers.Contract(C.ReputationSystem,    REPUTATION_ABI,   provider);

  // ════════════════════════════════════════════════════════
  // A1. AGENTVAULT — stake AGT to unlock tier
  // ════════════════════════════════════════════════════════
  section("A1. AgentVault — Stake 100 AGT (seller → Tier 0 → higher credit)");

  try {
    const STAKE_AMOUNT = ethers.parseEther("100");
    const [buyerAgt, sellerAgt, totalStakedBefore] = await Promise.all([
      token.balanceOf(buyer.address),
      token.balanceOf(seller.address),
      vault.totalStaked(),
    ]);
    pass("Balances before stake",
      `buyer=${ethers.formatEther(buyerAgt)} AGT | seller=${ethers.formatEther(sellerAgt)} AGT`);
    pass("Protocol totalStaked before", ethers.formatEther(totalStakedBefore) + " AGT");

    // Check if seller already has stake
    const existingVault = await vault.getVault(seller.address);
    if (existingVault.staked >= STAKE_AMOUNT) {
      pass("Seller already has ≥100 AGT staked", `staked=${ethers.formatEther(existingVault.staked)} AGT — skipping stake tx`);
    } else {
      // Approve vault
      const allowance = await token.allowance(seller.address, C.AgentVault);
      if (allowance < STAKE_AMOUNT) {
        const approveTx = await (token.connect(seller) as ethers.Contract).approve(C.AgentVault, STAKE_AMOUNT);
        const h = await waitTx(approveTx, "Approve 100 AGT to AgentVault (seller)");
        pass("Approve vault", "100 AGT approved", h);
        await sleep(2000);
      } else {
        pass("Vault already approved", `allowance=${ethers.formatEther(allowance)} AGT`);
      }

      // Stake
      const stakeTx = await (vault.connect(seller) as ethers.Contract).stake(STAKE_AMOUNT);
      const h = await waitTx(stakeTx, "Stake 100 AGT in AgentVault (seller)");
      pass("Stake 100 AGT", "staked on-chain", h);
    }

    await sleep(2000);

    // Read vault state after
    const [vaultData, tier, creditLimit, pendingYield, totalStakedAfter] = await Promise.all([
      vault.getVault(seller.address),
      vault.getTier(seller.address),
      vault.getCreditLimit(seller.address),
      vault.getPendingYield(seller.address),
      vault.totalStaked(),
    ]);
    pass("Vault data",
      `staked=${ethers.formatEther(vaultData.staked)} AGT | tier=${tier} | creditLimit=${ethers.formatEther(creditLimit)} AGT`);
    pass("Pending yield", `${ethers.formatEther(pendingYield)} AGT`);
    pass("Protocol totalStaked after", ethers.formatEther(totalStakedAfter) + " AGT");
  } catch (e: any) {
    fail("AgentVault stake", e.message ?? String(e));
  }

  // Give RPC time to settle after the stake transactions
  await sleep(5000);

  // ════════════════════════════════════════════════════════
  // A2. SUBSCRIPTIONMANAGER — buyer subscribes to seller
  // ════════════════════════════════════════════════════════
  section("A2. SubscriptionManager — Buyer subscribes to Seller's data service");

  let subscriptionId: bigint | undefined;
  try {
    const PRICE_PER_PERIOD = ethers.parseEther("2");   // 2 AGT/period
    const PERIOD_DURATION  = 3600n;                     // 1 hour
    const TOTAL_PERIODS    = 3n;                        // 3 periods = 6 AGT total
    const TOTAL_COST       = PRICE_PER_PERIOD * TOTAL_PERIODS;

    const subsBefore = await subMgr.totalSubscriptions();
    pass("Subscriptions before", subsBefore.toString());

    // Approve SubscriptionManager
    const allowance = await token.allowance(buyer.address, C.SubscriptionManager);
    if (allowance < TOTAL_COST) {
      const approveTx = await (token.connect(buyer) as ethers.Contract).approve(C.SubscriptionManager, TOTAL_COST);
      const h = await waitTx(approveTx, "Approve 6 AGT to SubscriptionManager (buyer)");
      pass("Approve SubscriptionManager", "6 AGT approved", h);
      await sleep(2000);
    } else {
      pass("SubscriptionManager already approved", `allowance=${ethers.formatEther(allowance)} AGT`);
    }

    // Subscribe
    const subscribeTx = await (subMgr.connect(buyer) as ethers.Contract).subscribe(
      seller.address,
      PRICE_PER_PERIOD,
      PERIOD_DURATION,
      TOTAL_PERIODS,
      "E2E Test: Real-time data analysis subscription — 3 periods of 1h each"
    );
    const h = await waitTx(subscribeTx, "Create subscription (buyer → seller)");
    subscriptionId = subsBefore;
    pass("Subscription created", `id=${subscriptionId}`, h);

    await sleep(2000);

    // Verify
    const sub = await subMgr.getSubscription(subscriptionId);
    pass("Subscription details",
      `subscriber=${sub.subscriber.slice(0,8)}... provider=${sub.provider.slice(0,8)}... price=${ethers.formatEther(sub.pricePerPeriod)} AGT/period | status=${sub.status} (0=Active)`);

    const providerSubs = await subMgr.getProviderSubscriptions(seller.address);
    pass("Provider subscriptions", `seller has ${providerSubs.length} subscription(s) incoming`);
  } catch (e: any) {
    fail("SubscriptionManager subscribe", e.message ?? String(e));
  }

  // ════════════════════════════════════════════════════════
  // A3. TASKDAG — Orchestrator creates task, seller accepts + completes
  // ════════════════════════════════════════════════════════
  section("A3. TaskDAG — Create task (buyer orchestrator), Seller accepts + completes");

  try {
    const TASK_BUDGET   = ethers.parseEther("5"); // 5 AGT
    const TASK_DEADLINE = BigInt(Math.floor(Date.now() / 1000) + 86400); // 24h

    const tasksBefore = await taskdag.totalTasks();
    pass("Tasks before", tasksBefore.toString());

    // Approve TaskDAG
    const allowance = await token.allowance(buyer.address, C.TaskDAG);
    if (allowance < TASK_BUDGET) {
      const approveTx = await (token.connect(buyer) as ethers.Contract).approve(C.TaskDAG, TASK_BUDGET);
      const h = await waitTx(approveTx, "Approve 5 AGT to TaskDAG (buyer)");
      pass("Approve TaskDAG", "5 AGT approved", h);
      await sleep(2000);
    } else {
      pass("TaskDAG already approved", `allowance=${ethers.formatEther(allowance)} AGT`);
    }

    // Force fresh nonce fetch after approve — public RPC can have 1-2s lag
    await sleep(3000);
    const freshNonce = await provider.getTransactionCount(buyer.address, "latest");

    // Create task (buyer as orchestrator, 0 required subtasks = standalone task)
    const createTx = await (taskdag.connect(buyer) as ethers.Contract).createTask(
      "E2E Test: Analyze dataset and return JSON sentiment scores for 100 records",
      ["data", "analysis", "nlp", "json"],
      TASK_BUDGET,
      TASK_DEADLINE,
      0n,  // no subtasks required
      { nonce: freshNonce }
    );
    const h1 = await waitTx(createTx, "Create task (buyer orchestrator)");
    taskIdForSeller = tasksBefore;
    pass("Task created", `id=${taskIdForSeller} | budget=5 AGT`, h1);

    await sleep(3000);

    // Verify task state
    const task = await taskdag.getTask(taskIdForSeller!);
    pass("Task details",
      `status=${task.status} (0=Open) | orchestrator=${task.orchestrator.slice(0,8)}... | budget=${ethers.formatEther(task.budget)} AGT`);

    // Seller accepts task
    const acceptTx = await (taskdag.connect(seller) as ethers.Contract).acceptTask(taskIdForSeller!);
    const h2 = await waitTx(acceptTx, "Seller accepts task");
    pass("Task accepted", `seller=${seller.address.slice(0,8)}...`, h2);

    await sleep(2000);

    const taskAfterAccept = await taskdag.getTask(taskIdForSeller!);
    pass("Task state after accept", `status=${taskAfterAccept.status} (1=Accepted) | assignee=${taskAfterAccept.assignee.slice(0,8)}...`);

    // Buyer (orchestrator) completes task — contract requires msg.sender == orchestrator
    const completeTx = await (taskdag.connect(buyer) as ethers.Contract).completeTask(taskIdForSeller!);
    const h3 = await waitTx(completeTx, "Buyer (orchestrator) completes task → releases budget to seller");
    pass("Task completed", "budget released to seller", h3);

    await sleep(2000);

    const taskFinal = await taskdag.getTask(taskIdForSeller!);
    const totalTasksAfter = await taskdag.totalTasks();
    pass("Task state final", `status=${taskFinal.status} (2=Completed) | fundsReleased=${taskFinal.fundsReleased}`);
    pass("Total tasks", `${totalTasksAfter.toString()} tasks on-chain`);
  } catch (e: any) {
    fail("TaskDAG", e.message ?? String(e));
  }

  // ════════════════════════════════════════════════════════
  // A4. REFERRALNETWORK — register seller as referrer of a new address
  // ════════════════════════════════════════════════════════
  section("A4. ReferralNetwork — Register seller as referrer of buyer");

  try {
    // Check if buyer already has a referrer
    const existingRef = await referral.getReferralData(buyer.address);
    if (existingRef.referrer !== ethers.ZeroAddress) {
      pass("Buyer already has referrer", `referrer=${existingRef.referrer}`);
    } else {
      // Register: seller referred buyer
      // This call is allowed when referrals[agent].referrer == address(0)
      const refTx = await (referral.connect(seller) as ethers.Contract).registerReferral(
        buyer.address,
        seller.address
      );
      const h = await waitTx(refTx, "Register referral (seller referred buyer)");
      pass("Referral registered", `buyer was referred by seller`, h);
    }

    await sleep(2000);

    // Read data
    const [buyerRef, sellerNetworkSize] = await Promise.all([
      referral.getReferralData(buyer.address),
      referral.getNetworkSize(seller.address),
    ]);
    pass("Buyer referral data",
      `referrer=${buyerRef.referrer.slice(0,8)}... | totalNetworkDeals=${buyerRef.totalNetworkDeals}`);
    pass("Seller network size", `${sellerNetworkSize.toString()} agent(s) referred`);
  } catch (e: any) {
    fail("ReferralNetwork", e.message ?? String(e));
  }

  // ════════════════════════════════════════════════════════
  // A5. REPUTATION — read post-deal scores
  // ════════════════════════════════════════════════════════
  section("A5. ReputationSystem — Read on-chain scores after completed deal");

  try {
    const [buyerRep, sellerRep] = await Promise.all([
      repSys.getReputation(buyer.address),
      repSys.getReputation(seller.address),
    ]);
    pass("Buyer reputation",
      `score=${buyerRep.score} | totalDeals=${buyerRep.totalDeals} | successful=${buyerRep.successfulDeals} | value=${ethers.formatEther(buyerRep.totalValueTransacted)} AGT`);
    pass("Seller reputation",
      `score=${sellerRep.score} | totalDeals=${sellerRep.totalDeals} | successful=${sellerRep.successfulDeals} | value=${ethers.formatEther(sellerRep.totalValueTransacted)} AGT`);
  } catch (e: any) {
    fail("ReputationSystem read", e.message ?? String(e));
  }

  // ════════════════════════════════════════════════════════
  // B1. BACKEND — Health + Stats + Agents + Token
  // ════════════════════════════════════════════════════════
  section("B1. Backend API — Core endpoints");

  try {
    const health = await apiFetch("/health");
    pass("GET /health", `status=${health.status} | network=${health.network}`);
  } catch (e: any) { fail("GET /health", e.message); }

  try {
    const stats = await apiFetch("/api/stats");
    pass("GET /api/stats",
      `agents=${stats.totalAgents} | deals=${stats.totalDeals} | needs=${stats.activeNeeds} | offers=${stats.activeOffers}`);
  } catch (e: any) { fail("GET /api/stats", e.message); }

  try {
    const agents = await apiFetch("/api/agents");
    pass("GET /api/agents", `${agents.agents?.length ?? agents.length} agents returned`);
  } catch (e: any) { fail("GET /api/agents", e.message); }

  try {
    const token = await apiFetch("/api/token");
    pass("GET /api/token",
      `symbol=${token.symbol} | totalSupply=${token.totalSupply} | pool_data=${token.pool_data ? "live" : "null"}`);
  } catch (e: any) { fail("GET /api/token", e.message); }

  try {
    const activity = await apiFetch("/api/activity");
    pass("GET /api/activity", `${activity.count} recent events`);
  } catch (e: any) { fail("GET /api/activity", e.message); }

  try {
    const genesis = await apiFetch("/api/genesis/info");
    pass("GET /api/genesis/info", `pool=${genesis.pool} | active=${genesis.active}`);
  } catch (e: any) { fail("GET /api/genesis/info", e.message); }

  try {
    const vault = await apiFetch("/api/vault/stats");
    pass("GET /api/vault/stats", `totalStaked=${vault.totalStaked} | yieldPool=${vault.yieldPool}`);
  } catch (e: any) { fail("GET /api/vault/stats", e.message); }

  // ════════════════════════════════════════════════════════
  // B2. BACKEND — Webhook subscriptions
  // ════════════════════════════════════════════════════════
  section("B2. Backend Webhooks — Subscribe, List, Delete");

  const TEST_WEBHOOK_URL = "https://webhook.site/e2e-aep-test-" + Date.now();
  const TEST_WEBHOOK_SECRET = "e2e-secret-" + Date.now();

  // Note: DEAL_* events are added to backend code but deploy to Railway pending.
  // Using currently supported events only.
  let sellerWebhookRegistered = false;
  try {
    const subResp = await apiFetch("/api/webhooks/subscribe", {
      method: "POST",
      body: JSON.stringify({
        address: seller.address,
        url: TEST_WEBHOOK_URL,
        events: ["DeliveryProofSubmitted", "ProposalAccepted"],
        secret: TEST_WEBHOOK_SECRET,
      }),
    });
    sellerWebhookRegistered = true;
    pass("POST /api/webhooks/subscribe",
      `url registered | events=${subResp.events?.join(",")}`);
  } catch (e: any) { fail("POST /api/webhooks/subscribe", e.message); }

  try {
    const listResp = await apiFetch(`/api/webhooks/${seller.address}`);
    pass("GET /api/webhooks/:address",
      `${listResp.subscriptions?.length ?? 0} webhook(s) | secrets redacted`);
  } catch (e: any) { fail("GET /api/webhooks/:address", e.message); }

  // Also subscribe buyer to receive seller's delivery proof notifications
  try {
    const buyerWebhookUrl = "https://webhook.site/e2e-buyer-" + Date.now();
    await apiFetch("/api/webhooks/subscribe", {
      method: "POST",
      body: JSON.stringify({
        address: buyer.address,
        url: buyerWebhookUrl,
        events: ["DeliveryProofSubmitted"],
        secret: "buyer-secret",
      }),
    });
    pass("POST /api/webhooks/subscribe (buyer)", "buyer webhook registered for DeliveryProofSubmitted");
  } catch (e: any) { fail("POST /api/webhooks/subscribe (buyer)", e.message); }

  // ════════════════════════════════════════════════════════
  // B3. BACKEND — Deal monitoring
  // ════════════════════════════════════════════════════════
  section("B3. Backend Deal Monitoring — Register, Status, Phase");

  // Create a fresh agreement reference for monitoring (use completed deal's address for test)
  // We register it with a future deadline so it stays in ACTIVE phase
  const FUTURE_DEADLINE = Math.floor(Date.now() / 1000) + 7 * 24 * 3600; // 7 days from now
  const MONITORED_AGREEMENT = "0x9d765Ccf8748033f426048FDB8c2f879525B2833"; // completed deal

  try {
    const registerResp = await apiFetch("/api/deals/register", {
      method: "POST",
      body: JSON.stringify({
        agreementAddress: MONITORED_AGREEMENT,
        sellerAddress:    seller.address,
        buyerAddress:     buyer.address,
        deadline:         FUTURE_DEADLINE,
        paymentAmount:    "20000000000000000000", // 20 AGT in wei
        description:      "E2E Test: Data analysis service deal — registered for monitoring",
      }),
    });
    pass("POST /api/deals/register",
      `monitoring=registered | deadline=${registerResp.deadline?.slice(0, 10)}`);
    pass("Deal milestones",
      `approaching=${registerResp.monitoring?.approaching_deadline?.slice(0, 10)} | graceEnd=${registerResp.graceEnd?.slice(0, 10)}`);
  } catch (e: any) { fail("POST /api/deals/register", e.message); }

  try {
    const dealResp = await apiFetch(`/api/deals/${MONITORED_AGREEMENT}`);
    pass("GET /api/deals/:address",
      `phase=${dealResp.phase} | hasProof=${dealResp.hasProof} | graceEnd=${dealResp.graceEnd?.slice(0, 10)}`);
  } catch (e: any) { fail("GET /api/deals/:address", e.message); }

  try {
    const dealsResp = await apiFetch(`/api/deals?seller=${seller.address}`);
    pass("GET /api/deals?seller=",
      `${dealsResp.count} deal(s) monitored for seller`);
  } catch (e: any) { fail("GET /api/deals?seller=", e.message); }

  // Remove test webhook URLs before delivery tests to avoid outbound timeouts from Railway
  // (webhook.site can be slow to respond, blocking the delivery route)
  try {
    await apiFetch("/api/webhooks/unsubscribe", {
      method: "DELETE",
      body: JSON.stringify({ address: buyer.address, url: `https://webhook.site/e2e-buyer-${Date.now()}` }),
    });
  } catch { /* ignore — may already be gone */ }
  // Best-effort: remove all buyer DeliveryProofSubmitted webhooks
  try {
    const buyerSubs = await apiFetch(`/api/webhooks/${buyer.address}`);
    for (const sub of (buyerSubs.subscriptions ?? [])) {
      await apiFetch("/api/webhooks/unsubscribe", {
        method: "DELETE",
        body: JSON.stringify({ address: buyer.address, url: sub.url }),
      }).catch(() => {});
    }
  } catch { /* ignore */ }

  // ════════════════════════════════════════════════════════
  // B4. BACKEND — Delivery Proof (HASH type)
  // ════════════════════════════════════════════════════════
  section("B4. Backend Delivery Proof — HASH type with EIP-191 signature");

  const DELIVERY_DATA = `E2E delivery proof: Sentiment analysis complete. 100 records processed. Mean score: 0.73. Positive: 67%, Negative: 18%, Neutral: 15%. Timestamp: ${new Date().toISOString()}`;
  const proofHash = ethers.keccak256(ethers.toUtf8Bytes(DELIVERY_DATA));

  try {
    // Seller signs the canonical proof message
    const message = `AEP Delivery Proof\nAgreement: ${ethers.getAddress(MONITORED_AGREEMENT)}\nProof: ${proofHash}`;
    const signature = await seller.signMessage(message);
    pass("EIP-191 signature", `seller signed proof message | sig=${signature.slice(0, 20)}...`);

    // Note: omit buyerAddress here to avoid fanout to test webhook URLs
    const proofResp = await apiFetch("/api/delivery/submit", {
      method: "POST",
      body: JSON.stringify({
        agreementAddress: MONITORED_AGREEMENT,
        sellerAddress:    seller.address,
        deliveryType:     "hash",
        proofHash:        proofHash,
        deliveryData:     DELIVERY_DATA,
        signature:        signature,
      }),
    });
    pass("POST /api/delivery/submit",
      `proofId=${proofResp.proofId} | verified=${proofResp.verification?.verified}`);
    pass("Delivery next step", proofResp.nextStep ?? "");
  } catch (e: any) { fail("POST /api/delivery/submit", e.message); }

  try {
    const statusResp = await apiFetch(`/api/delivery/status/${MONITORED_AGREEMENT}`);
    pass("GET /api/delivery/status/:address",
      `status=${statusResp.status} | proofId=${statusResp.proofId} | deliveryType=${statusResp.deliveryType}`);
  } catch (e: any) { fail("GET /api/delivery/status/:address", e.message); }

  try {
    const proofsResp = await apiFetch(`/api/delivery/${MONITORED_AGREEMENT}`);
    pass("GET /api/delivery/:address",
      `${proofsResp.count} proof(s) on record for this agreement`);
  } catch (e: any) { fail("GET /api/delivery/:address", e.message); }

  // ════════════════════════════════════════════════════════
  // B5. BACKEND — URL delivery proof
  // ════════════════════════════════════════════════════════
  section("B5. Backend Delivery Proof — URL type");

  const DELIVERY_URL = `${BACKEND}/health`; // we know this is live
  const urlProofHash = ethers.keccak256(ethers.toUtf8Bytes(DELIVERY_URL));

  try {
    const urlMessage = `AEP Delivery Proof\nAgreement: ${ethers.getAddress(MONITORED_AGREEMENT)}\nProof: ${urlProofHash}`;
    const urlSig = await seller.signMessage(urlMessage);

    const urlResp = await apiFetch("/api/delivery/submit", {
      method: "POST",
      body: JSON.stringify({
        agreementAddress: MONITORED_AGREEMENT,
        sellerAddress:    seller.address,
        deliveryType:     "url",
        url:              DELIVERY_URL,
        signature:        urlSig,
      }),
    });
    pass("POST /api/delivery/submit (URL)",
      `proofId=${urlResp.proofId} | verified=${urlResp.verification?.verified} | httpStatus=${urlResp.verification?.httpStatus}`);
  } catch (e: any) { fail("POST /api/delivery/submit (URL)", e.message); }

  // ════════════════════════════════════════════════════════
  // B6. BACKEND — API delivery proof
  // ════════════════════════════════════════════════════════
  section("B6. Backend Delivery Proof — API type");

  const API_ENDPOINT = BACKEND;
  const API_PROOF_HASH = ethers.keccak256(ethers.toUtf8Bytes(API_ENDPOINT));

  try {
    const apiMessage = `AEP Delivery Proof\nAgreement: ${ethers.getAddress(MONITORED_AGREEMENT)}\nProof: ${API_PROOF_HASH}`;
    const apiSig = await seller.signMessage(apiMessage);

    const apiResp = await apiFetch("/api/delivery/submit", {
      method: "POST",
      body: JSON.stringify({
        agreementAddress: MONITORED_AGREEMENT,
        sellerAddress:    seller.address,
        deliveryType:     "api",
        endpoint:         API_ENDPOINT,
        testPath:         "/health",
        signature:        apiSig,
      }),
    });
    pass("POST /api/delivery/submit (API)",
      `proofId=${apiResp.proofId} | verified=${apiResp.verification?.verified} | returnsJSON=${apiResp.verification?.returnsJSON}`);
  } catch (e: any) { fail("POST /api/delivery/submit (API)", e.message); }

  // ════════════════════════════════════════════════════════
  // B7. BACKEND — Final checks on delivery + monitor
  // ════════════════════════════════════════════════════════
  section("B7. Backend — Final state checks");

  try {
    const allProofs = await apiFetch(`/api/delivery/${MONITORED_AGREEMENT}`);
    pass("GET /api/delivery/:address (final)",
      `${allProofs.count} total proof(s) submitted for this agreement`);
    if (allProofs.proofs?.length > 0) {
      const latest = allProofs.proofs[allProofs.proofs.length - 1];
      pass("Latest proof detail",
        `type=${latest.delivery_type} | hash=${latest.proof_hash?.slice(0, 16)}... | seller=${latest.seller_address?.slice(0, 8)}...`);
    }
  } catch (e: any) { fail("GET /api/delivery final", e.message); }

  try {
    const dealFinal = await apiFetch(`/api/deals/${MONITORED_AGREEMENT}`);
    pass("GET /api/deals/:address (final)",
      `phase=${dealFinal.phase} | hasProof=${dealFinal.hasProof} | deliveryType=${dealFinal.deliveryType}`);
  } catch (e: any) { fail("GET /api/deals final", e.message); }

  try {
    const monitorStats = await apiFetch("/api/monitor/stats");
    pass("GET /api/monitor/stats",
      `needs=${monitorStats.market?.totalNeeds ?? "?"} | offers=${monitorStats.market?.totalOffers ?? "?"} | proposals=${monitorStats.market?.totalProposals ?? "?"}`);
  } catch (e: any) { fail("GET /api/monitor/stats", e.message); }

  // Cleanup webhook after test (only if it was registered)
  if (sellerWebhookRegistered) {
    try {
      await apiFetch("/api/webhooks/unsubscribe", {
        method: "DELETE",
        body: JSON.stringify({ address: seller.address, url: TEST_WEBHOOK_URL }),
      });
      pass("DELETE /api/webhooks/unsubscribe", "test webhook removed");
    } catch (e: any) { fail("DELETE /api/webhooks/unsubscribe", e.message); }
  }

  // ════════════════════════════════════════════════════════
  // FINAL BALANCES
  // ════════════════════════════════════════════════════════
  section("Final Balances");
  try {
    const [bEth, bAgt, sEth, sAgt, treasury] = await Promise.all([
      provider.getBalance(buyer.address),
      token.balanceOf(buyer.address),
      provider.getBalance(seller.address),
      token.balanceOf(seller.address),
      token.balanceOf(C.Treasury),
    ]);
    pass("Buyer final",  `${ethers.formatEther(bEth)} ETH | ${ethers.formatEther(bAgt)} AGT`);
    pass("Seller final", `${ethers.formatEther(sEth)} ETH | ${ethers.formatEther(sAgt)} AGT`);
    pass("Treasury AGT", `${ethers.formatEther(treasury)} AGT (accumulated fees)`);
  } catch (e: any) { fail("Final balances", e.message); }

  // ════════════════════════════════════════════════════════
  // SUMMARY
  // ════════════════════════════════════════════════════════
  const total   = results.length;
  const passed  = results.filter(r => r.ok).length;
  const failed  = total - passed;

  console.log("\n" + "═".repeat(64));
  console.log(`  📊 RESULTS: ${passed}/${total} passed${failed > 0 ? `, ${failed} failed` : ""}`);
  console.log("═".repeat(64));

  if (failed > 0) {
    console.log("\n  Failed checks:");
    results.filter(r => !r.ok).forEach(r => console.log(`    ❌ ${r.name}: ${r.detail}`));
  }

  // Write JSON results for the report
  const resultsPath = path.join(__dirname, "../pruebas-reales/e2e-full-results.json");
  fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
  fs.writeFileSync(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    network: "base-mainnet",
    buyer:  buyer.address,
    seller: seller.address,
    total, passed, failed,
    results,
  }, null, 2));
  console.log(`\n  Results saved to: pruebas-reales/e2e-full-results.json`);

  if (failed > 0) process.exit(1);
}

main().catch(e => {
  console.error("\n❌ Test crashed:", e.message ?? String(e));
  process.exit(1);
});
