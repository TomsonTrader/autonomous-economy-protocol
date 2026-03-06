/**
 * Mainnet Seed Script
 * Seeds AEP Base Mainnet with 3 agents, needs, offers, and one completed deal.
 * Uses the AgentSDK which handles approve+register sequentially.
 * Run: npx ts-node scripts/seed-mainnet.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });

import { ethers } from "ethers";
import * as fs from "fs";
import { AgentSDK } from "../sdk/src/AgentSDK";

const DEPLOYMENT = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../deployments/base-mainnet.json"), "utf-8")
);
const C = DEPLOYMENT.contracts;

const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];
const AGREEMENT_ABI = [
  "function fund()",
  "function confirmDelivery()",
  "function paymentAmount() view returns (uint256)",
];


const AGT  = (n: number) => ethers.parseEther(String(n));
const fmt  = (n: bigint) => parseFloat(ethers.formatEther(n)).toFixed(1);
const log  = (msg: string) => console.log(msg);
const step = (msg: string) => process.stdout.write(`  ${msg}... `);
const ok   = (hash: string) => console.log(`✅ ${hash.slice(0, 12)}...`);

// Deterministic seed wallets
const SEED_KEYS = [1, 2, 3].map((i) =>
  ethers.keccak256(ethers.toUtf8Bytes(`aep-seed-v3-${i}`))
);

// Nonce tracker — fetches once from "pending" state, increments locally
const nonceMap: Record<string, number> = {};
async function nonce(w: ethers.Wallet | ethers.HDNodeWallet): Promise<number> {
  if (nonceMap[w.address] === undefined) {
    nonceMap[w.address] = await w.provider!.getTransactionCount(w.address, "pending");
  }
  return nonceMap[w.address]++;
}

async function main() {
  const provider  = new ethers.JsonRpcProvider("https://mainnet.base.org");
  const deployer  = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);
  const token     = new ethers.Contract(C.AgentToken, TOKEN_ABI, deployer);

  log("\n════════════════════════════════════════════");
  log("  🌱 AEP MAINNET SEED — Base Mainnet");
  log("════════════════════════════════════════════");
  log(`  Deployer: ${deployer.address}`);
  log(`  ETH: ${ethers.formatEther(await provider.getBalance(deployer.address))}`);
  log(`  AGT: ${fmt(await token.balanceOf(deployer.address))}`);
  log("");

  const agents = [
    { key: SEED_KEYS[0], name: "DataProcessor-1", caps: ["data", "processing", "analytics"] },
    { key: SEED_KEYS[1], name: "ResearchAgent-1",  caps: ["research", "analysis", "reports"] },
    { key: SEED_KEYS[2], name: "ContentAgent-1",   caps: ["content", "writing", "nlp"] },
  ];

  // ── 1. Fund seed wallets ────────────────────────────────────────────────
  log("── 1. Fund agents ───────────────────────────────────────");
  for (const a of agents) {
    const wallet = new ethers.Wallet(a.key, provider);
    const ethBal = await provider.getBalance(wallet.address);
    const agtBal: bigint = await token.balanceOf(wallet.address);

    if (ethBal < ethers.parseEther("0.00002")) {
      step(`ETH → ${a.name}`);
      const t = await deployer.sendTransaction({ to: wallet.address, value: ethers.parseEther("0.00003"), nonce: await nonce(deployer) });
      await t.wait(1);
      ok(t.hash);
    }

    if (agtBal < AGT(15)) {
      step(`AGT → ${a.name}`);
      const t = await token.transfer(wallet.address, AGT(25), { nonce: await nonce(deployer) });
      await t.wait(1);
      ok(t.hash);
    }

    if (ethBal >= ethers.parseEther("0.00002") && agtBal >= AGT(15)) {
      log(`  ${a.name} already funded`);
    }
  }

  // ── 2. Register via SDK ────────────────────────────────────────────────
  log("\n── 2. Register agents ───────────────────────────────────");
  const sdks: AgentSDK[] = [];
  for (const a of agents) {
    const sdk = new AgentSDK({ privateKey: a.key, network: "base-mainnet" });
    sdks.push(sdk);

    await new Promise((r) => setTimeout(r, 5000)); // avoid RPC rate limit
    let isReg = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      try { isReg = await sdk.isRegistered(); break; }
      catch { await new Promise((r) => setTimeout(r, 5000 * (attempt + 1))); }
    }
    if (isReg) {
      log(`  ${a.name} already registered`);
      continue;
    }
    step(`Register ${a.name}`);
    const hash = await sdk.register({ name: a.name, capabilities: a.caps });
    ok(hash);
    await new Promise((r) => setTimeout(r, 2000));
  }

  const [dataSDK, researchSDK, contentSDK] = sdks;

  // ── 3. Publish needs & offers ─────────────────────────────────────────
  log("\n── 3. Publish needs & offers ────────────────────────────");
  const deadline = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;

  step("Need: Market analysis 80 AGT (ResearchAgent)");
  const needId = await researchSDK.publishNeed({
    description: "Market analysis dataset — Q1 2026",
    budget: "80",
    deadline,
    tags: ["data", "analytics"],
  });
  ok(String(needId));

  step("Offer: Analytics pipeline 70 AGT (DataProcessor)");
  const offerId = await dataSDK.publishOffer({
    description: "Processed analytics pipeline — Base chain data",
    price: "70",
    tags: ["data", "processing", "analytics"],
  });
  ok(String(offerId));

  step("Offer: Copywriting 50 AGT (ContentAgent)");
  const offerId2 = await contentSDK.publishOffer({
    description: "Technical documentation & copywriting",
    price: "50",
    tags: ["content", "writing", "nlp"],
  });
  ok(String(offerId2));

  log(`  needId=${needId}  offerId=${offerId}`);

  // ── 4. Negotiate & complete deal ─────────────────────────────────────
  log("\n── 4. Execute deal end-to-end ───────────────────────────");

  step("Propose 75 AGT (ResearchAgent → DataProcessor)");
  const proposalId = await researchSDK.propose({
    needId,
    offerId,
    price: "75",
    terms: "Delivery 48h, standard terms",
  });
  ok(String(proposalId));
  log(`  proposalId=${proposalId}`);

  await new Promise((r) => setTimeout(r, 6000)); // let all RPC nodes sync

  step("Accept proposal (DataProcessor)");
  await dataSDK.acceptProposal(proposalId);
  // Poll for agreement address — public RPC may lag after accept
  const engineRead2 = new ethers.Contract(C.NegotiationEngine,
    ["function proposalAgreement(uint256) view returns (address)"], provider);
  let agreementAddr = ethers.ZeroAddress;
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    agreementAddr = await engineRead2.proposalAgreement(proposalId);
    if (agreementAddr !== ethers.ZeroAddress) break;
  }
  ok(agreementAddr);
  log(`  Agreement: ${agreementAddr.slice(0, 12)}...`);

  if (agreementAddr !== ethers.ZeroAddress) {
    const researchWallet = new ethers.Wallet(SEED_KEYS[1], provider);
    const agreement = new ethers.Contract(agreementAddr, AGREEMENT_ABI, researchWallet);
    const payAmount: bigint = await agreement.paymentAmount();
    log(`  Payment: ${fmt(payAmount)} AGT`);

    step("Fund escrow");
    const fundHash = await researchSDK.fundAgreement(agreementAddr);
    ok(fundHash);

    step("Confirm delivery");
    const confirmHash = await researchSDK.confirmDelivery(agreementAddr);
    ok(confirmHash);

    log(`\n  💰 Deal complete — ${fmt(payAmount)} AGT transferred on-chain`);
  } else {
    log("  ⚠️  Agreement address not found after polling — deal skipped");
  }

  // ── Summary ───────────────────────────────────────────────────────────
  const marketRead = new ethers.Contract(C.Marketplace, ["function totalNeeds() view returns (uint256)", "function totalOffers() view returns (uint256)"], provider);
  const finalNeeds: bigint  = await marketRead.totalNeeds();
  const finalOffers: bigint = await marketRead.totalOffers();
  log("\n════════════════════════════════════════════");
  log("  🎉 SEED COMPLETE");
  log(`  Agents: 3 | Needs: ${finalNeeds} | Offers: ${finalOffers} | Deals: 1`);
  log("════════════════════════════════════════════\n");
}

main().catch((e) => {
  console.error("\n❌ Seed failed:", e.message);
  if (e.info) console.error("  Info:", JSON.stringify(e.info, null, 2).slice(0, 300));
  process.exit(1);
});
