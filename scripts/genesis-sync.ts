/**
 * Genesis Sync Script — syncPoints() for all registered agents on mainnet.
 * Tests the full GenesisProgram v2 flow with real on-chain data.
 */
import { ethers } from "ethers";

const REGISTRY   = "0x601125818d16cb78dD239Bce2c821a588B06d978";
const REPUTATION = "0x412E3566fFfA972ea284Ee5D22F05d2801b6aA86";
const VAULT      = "0xb3e844C920D399634147872dc3ce44A4b655e0b7";
const GENESIS_V2 = "0xf47DE94831E4791a6Bf5E0CCf247Ed0c058129a3";
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY!;

async function main() {
  const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
  const wallet   = new ethers.Wallet(DEPLOYER_KEY, provider);

  const registry = new ethers.Contract(REGISTRY, [
    "function getActiveAgents() view returns (address[])",
    "function getAgent(address) view returns (tuple(string name, string[] capabilities, string metadataURI, uint256 registeredAt, bool active))",
  ], provider);

  const reputation = new ethers.Contract(REPUTATION, [
    "function getReputation(address) view returns (uint256 score, uint256 totalDeals, uint256 successfulDeals, uint256 totalValueTransacted, uint256 lastUpdated)",
  ], provider);

  const vault = new ethers.Contract(VAULT, [
    "function getVault(address) view returns (uint256 staked, uint256 yieldAccrued, uint256 lastYieldUpdate, uint256 borrowed, uint256 unstakeRequestedAt, uint256 unstakePending)",
  ], provider);

  const genesis = new ethers.Contract(GENESIS_V2, [
    "function syncPoints(address agent) external",
    "function getParticipant(address) view returns (uint256 points, bool claimed, uint256 estimatedAGT, uint256 daysLeft)",
    "function seasonInfo() view returns (bool started, bool ended, uint256 start, uint256 end, uint256 participants_, uint256 totalPts, uint256 pool)",
  ], wallet);

  // ── 1. Pre-sync state ─────────────────────────────────────────────────────
  const [agents, seasonInfo, ethBal] = await Promise.all([
    registry.getActiveAgents(),
    genesis.seasonInfo(),
    provider.getBalance(wallet.address),
  ]);

  console.log("\n=== GENESIS V2 — SYNC TEST ===");
  console.log(`Season active:  ${seasonInfo.started && !seasonInfo.ended}`);
  console.log(`Participants:   ${seasonInfo.participants_}`);
  console.log(`Total pts:      ${seasonInfo.totalPts}`);
  console.log(`Deployer ETH:   ${ethers.formatEther(ethBal)} ETH`);
  console.log(`Active agents:  ${agents.length}`);
  console.log("");

  if (!(seasonInfo.started && !seasonInfo.ended)) {
    console.error("Season is not active — aborting.");
    process.exit(1);
  }

  // ── 2. Per-agent state ────────────────────────────────────────────────────
  console.log("=== PRE-SYNC AGENT STATE ===");
  const agentData: Record<string, any> = {};

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  async function retryCall<T>(fn: () => Promise<T>, retries = 3, delayMs = 500): Promise<T> {
    for (let i = 0; i < retries; i++) {
      try { return await fn(); } catch (e: any) {
        if (i < retries - 1) { await sleep(delayMs * (i + 1)); } else throw e;
      }
    }
    throw new Error("unreachable");
  }

  for (const addr of agents as string[]) {
    await sleep(300); // respect public RPC rate limits
    try {
      // Sequential calls — access props immediately to catch deferred ethers v6 decode errors
      const rawAgent    = await retryCall(() => registry.getAgent(addr));
      const rawRep      = await retryCall(() => reputation.getReputation(addr));
      const rawVault    = await retryCall(() => vault.getVault(addr));
      const rawPts      = await retryCall(() => genesis.getParticipant(addr));

      const name       = String(rawAgent.name);
      const deals      = BigInt(rawRep.totalDeals);
      const score      = BigInt(rawRep.score);
      const staked     = BigInt(rawVault.staked);
      const points     = BigInt(rawPts.points);
      const estAGT     = BigInt(rawPts.estimatedAGT);

      agentData[addr] = { name, deals, score, staked, points, estAGT };

      console.log(`${name} (${addr.slice(0,10)}...)`);
      console.log(`  Deals:        ${deals} | Score: ${score}`);
      console.log(`  Staked:       ${ethers.formatEther(staked)} AGT`);
      console.log(`  Genesis pts:  ${points} ${points > 0n ? "(already synced)" : "(needs sync)"}`);
      console.log(`  Estimated AGT:${ethers.formatEther(estAGT)} AGT`);
      console.log("");
    } catch (err: any) {
      console.log(`⚠️  ${addr.slice(0,10)}... — could not read: ${err.message?.slice(0,60)}`);
      agentData[addr] = { name: addr.slice(0,10), deals: 0n, score: 0n, staked: 0n, points: 0n, estAGT: 0n };
    }
  }

  // ── 3. syncPoints() for all agents ───────────────────────────────────────
  console.log("=== RUNNING syncPoints() ===");
  let nonce = await provider.getTransactionCount(wallet.address);

  for (const addr of agents as string[]) {
    try {
      const feeData = await provider.getFeeData();
      const tx = await genesis.syncPoints(addr, {
        nonce: nonce++,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      });
      const receipt = await tx.wait();
      const pts = await genesis.getParticipant(addr);
      const name = agentData[addr].agent.name;
      console.log(`✅ ${name} — ${pts.points} pts | tx: ${tx.hash}`);

      // Decode PointsAwarded events
      const iface = new ethers.Interface([
        "event PointsAwarded(address indexed agent, string action, uint256 points, uint256 total)",
      ]);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed) {
            console.log(`   +${parsed.args.points} pts for "${parsed.args.action}"`);
          }
        } catch { /* not this event */ }
      }
    } catch (err: any) {
      const name = agentData[addr]?.name ?? addr.slice(0, 10);
      const msg = err.message?.slice(0, 80) ?? String(err);
      console.log(`⚠️  ${name} — ${msg}`);
    }
  }

  // ── 4. Post-sync state ────────────────────────────────────────────────────
  console.log("\n=== POST-SYNC STATE ===");
  const finalInfo = await genesis.seasonInfo();
  console.log(`Participants:  ${finalInfo.participants_}`);
  console.log(`Total points:  ${finalInfo.totalPts}`);
  console.log("");

  for (const addr of agents as string[]) {
    let pts = { points: 0n, estimatedAGT: 0n };
    try { const r = await genesis.getParticipant(addr); pts = { points: BigInt(r.points), estimatedAGT: BigInt(r.estimatedAGT) }; } catch { /* ignore */ }
    const name = agentData[addr]?.name ?? addr.slice(0, 10);
    console.log(`  ${name}: ${pts.points} pts | ~${ethers.formatEther(pts.estimatedAGT)} AGT`);
  }

  const finalEth = await provider.getBalance(wallet.address);
  const spent = ethBal - finalEth;
  console.log(`\nGas spent: ${ethers.formatEther(spent)} ETH`);
  console.log("✅ Genesis sync test complete.");
}

main().catch((err) => {
  console.error("💥", err.message);
  process.exit(1);
});
