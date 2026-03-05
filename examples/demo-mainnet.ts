/**
 * AEP Mainnet Demo
 * Shows two agents registering, negotiating and completing a deal on Base Mainnet.
 *
 * Usage:
 *   AGENT_A_KEY=0x... AGENT_B_KEY=0x... npx ts-node examples/demo-mainnet.ts
 *
 * Both wallets need a small amount of AGT (minted on registration) and ETH for gas.
 * Get AGT by registering — each new agent receives 1000 AGT automatically.
 */

import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

const RPC = "https://mainnet.base.org";
const CONTRACTS = {
  AgentToken:      "0x83b99074e9EE48Faf50e19d6B763dD029cAaF7Ed",
  AgentRegistry:   "0x63b427a39e2e07587CF13b2AecBaEcDD4D20bf23",
  Marketplace:     "0xc8Dc4a3686887d27d845666d0a7664E995b3F3Ae",
  NegotiationEngine: "0x5B3529d0fC4aB779D24D605d6549134F9a5853c2",
};

const REGISTRY_ABI = [
  "function register(string calldata metadataURI, string[] calldata capabilities) external",
  "function isRegistered(address agent) view returns (bool)",
  "function getAgent(address agent) view returns (tuple(address addr, string metadataURI, string[] capabilities, uint256 reputationScore, bool active, uint256 registeredAt))",
];
const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];
const MARKETPLACE_ABI = [
  "function publishNeed(string calldata description, string[] calldata requiredCapabilities, uint256 maxBudget, uint256 deadline) external returns (uint256)",
  "function publishOffer(string calldata description, string[] calldata capabilities, uint256 pricePerUnit, uint256 availableUntil) external returns (uint256)",
  "function totalNeeds() view returns (uint256)",
  "function totalOffers() view returns (uint256)",
];
const NEGOTIATION_ABI = [
  "function propose(address provider, uint256 needId, uint256 offerId, uint256 price, uint256 deadline) external returns (uint256)",
  "function accept(uint256 proposalId) external",
  "function getProposal(uint256 proposalId) view returns (tuple(uint256 id, address requester, address provider, uint256 needId, uint256 offerId, uint256 price, uint256 deadline, uint8 status, uint256 round, address agreement))",
];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const keyA = process.env.AGENT_A_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  const keyB = process.env.AGENT_B_KEY;

  if (!keyA || !keyB) {
    console.error("Set AGENT_A_KEY and AGENT_B_KEY environment variables");
    console.error("Both need ETH on Base Mainnet for gas");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC);
  const walletA = new ethers.Wallet(keyA.startsWith("0x") ? keyA : "0x" + keyA, provider);
  const walletB = new ethers.Wallet(keyB.startsWith("0x") ? keyB : "0x" + keyB, provider);

  const registry  = new ethers.Contract(CONTRACTS.AgentRegistry,    REGISTRY_ABI,    provider);
  const token     = new ethers.Contract(CONTRACTS.AgentToken,        TOKEN_ABI,       provider);
  const market    = new ethers.Contract(CONTRACTS.Marketplace,       MARKETPLACE_ABI, provider);
  const engine    = new ethers.Contract(CONTRACTS.NegotiationEngine, NEGOTIATION_ABI, provider);

  console.log("\n🤖 AEP Mainnet Demo — Base Mainnet (chainId 8453)");
  console.log("═══════════════════════════════════════════════════\n");

  // ── Balances ──────────────────────────────────────────────────────────────
  const [balA, balB] = await Promise.all([
    provider.getBalance(walletA.address),
    provider.getBalance(walletB.address),
  ]);
  console.log(`Agent A: ${walletA.address}  (${ethers.formatEther(balA)} ETH)`);
  console.log(`Agent B: ${walletB.address}  (${ethers.formatEther(balB)} ETH)\n`);

  // ── Step 1: Register ───────────────────────────────────────────────────────
  console.log("STEP 1: Registration");
  for (const [label, wallet, caps] of [
    ["Agent A (Requester)", walletA, ["data", "analysis"]],
    ["Agent B (Provider)",  walletB, ["data", "processing", "pipeline"]],
  ] as [string, ethers.Wallet, string[]][]) {
    const isReg = await registry.isRegistered(wallet.address);
    if (isReg) {
      console.log(`  ✅ ${label} already registered`);
    } else {
      const tx = await registry.connect(wallet).register(
        `ipfs://aep-demo/${wallet.address}`,
        caps,
      );
      await tx.wait();
      console.log(`  ✅ ${label} registered — received 1000 AGT`);
    }
  }

  // ── Step 2: AGT balances ───────────────────────────────────────────────────
  const [agtA, agtB] = await Promise.all([
    token.balanceOf(walletA.address),
    token.balanceOf(walletB.address),
  ]);
  console.log(`\n  AGT balance A: ${ethers.formatEther(agtA)} AGT`);
  console.log(`  AGT balance B: ${ethers.formatEther(agtB)} AGT`);

  // ── Step 3: Publish need + offer ───────────────────────────────────────────
  console.log("\nSTEP 2: Publish Need & Offer");

  const deadline = Math.floor(Date.now() / 1000) + 3600; // 1h from now
  const budget   = ethers.parseEther("10"); // 10 AGT max budget

  // Approve marketplace to spend AGT (for escrow)
  const approveTx = await token.connect(walletA).approve(CONTRACTS.Marketplace, budget);
  await approveTx.wait();

  const needTx = await market.connect(walletA).publishNeed(
    "Process dataset and return summary statistics",
    ["data", "processing"],
    budget,
    deadline,
  );
  await needTx.wait();
  const needId = (await market.totalNeeds()) - 1n;
  console.log(`  ✅ Need #${needId} published — budget: 10 AGT`);

  const offerTx = await market.connect(walletB).publishOffer(
    "Data processing and pipeline automation",
    ["data", "processing", "pipeline"],
    ethers.parseEther("8"), // 8 AGT per unit
    deadline,
  );
  await offerTx.wait();
  const offerId = (await market.totalOffers()) - 1n;
  console.log(`  ✅ Offer #${offerId} published — price: 8 AGT`);

  // ── Step 4: Negotiate ──────────────────────────────────────────────────────
  console.log("\nSTEP 3: Negotiate");

  const proposeTx = await engine.connect(walletA).propose(
    walletB.address,
    needId,
    offerId,
    ethers.parseEther("9"), // counterpropose 9 AGT
    deadline,
  );
  await proposeTx.wait();
  const proposalId = (await engine.getProposal(0n)).id;
  console.log(`  ✅ Proposal #${proposalId} sent — 9 AGT`);

  // Agent B accepts
  await sleep(2000);
  const acceptTx = await engine.connect(walletB).accept(proposalId);
  await acceptTx.wait();
  console.log(`  ✅ Proposal accepted — deal locked at 9 AGT`);

  // ── Result ────────────────────────────────────────────────────────────────
  const proposal = await engine.getProposal(proposalId);
  console.log("\n═══════════════════════════════════════════════════");
  console.log("✨ DEAL COMPLETE on Base Mainnet");
  console.log(`   Agreement contract: ${proposal.agreement}`);
  console.log(`   Price: 9 AGT`);
  console.log(`   View on Basescan: https://basescan.org/address/${proposal.agreement}`);
  console.log("═══════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
