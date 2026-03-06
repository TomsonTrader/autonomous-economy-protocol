/**
 * Real on-chain deal test — Base Mainnet
 * Uses deployer as both buyer and seller (self-deal) to avoid
 * second-wallet ETH issues. Fee still goes to treasury.
 *
 * Usage: npx ts-node scripts/real-deal-test.ts
 */

import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

const RPC = "https://mainnet.base.org";
const ADDRS = {
  AgentToken:        "0x6dE70b5B0953A220420E142f51AE47B6Fd5b7101",
  AgentRegistry:     "0x601125818d16cb78dD239Bce2c821a588B06d978",
  Marketplace:       "0x1D3d45107f30aF47bF6b4FfbA817bA8B4a91f44c",
  NegotiationEngine: "0xFfD596b2703b635059Bc2b6109a3173F29903D27",
  Treasury:          "0x8CCB591C94D419687c4C6dDfdd9F789cc29Bd0Fd",
};

const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];
const REGISTRY_ABI = [
  "function registerAgent(string,string[],string) external",
  "function isRegistered(address) view returns (bool)",
];
const MARKETPLACE_ABI = [
  "function publishNeed(string,uint256,uint256,string[]) returns (uint256)",
  "function publishOffer(string,uint256,string[]) returns (uint256)",
  "function totalNeeds() view returns (uint256)",
  "function totalOffers() view returns (uint256)",
];
const ENGINE_ABI = [
  "function propose(uint256,uint256,uint256,string) returns (uint256)",
  "function acceptProposal(uint256) returns (address)",
  "function proposalAgreement(uint256) view returns (address)",
  "function totalProposals() view returns (uint256)",
];
const AGREEMENT_ABI = [
  "function fund() external",
  "function confirmDelivery() external",
  "function treasury() view returns (address)",
];

async function send(
  provider: ethers.JsonRpcProvider,
  wallet: ethers.Wallet,
  contract: ethers.Contract,
  method: string,
  args: any[],
  label: string
): Promise<string> {
  process.stdout.write(`  ⏳ ${label}...`);
  // Always fetch latest nonce to avoid collisions
  const nonce = await provider.getTransactionCount(wallet.address, "latest");
  const feeData = await provider.getFeeData();
  const c = contract.connect(wallet) as any;
  const tx = await (c[method] as Function)(...args, {
    nonce,
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
  });
  const receipt = await tx.wait();
  const hash: string = receipt.hash;
  console.log(` ✓  https://basescan.org/tx/${hash}`);
  // Wait 2s to ensure RPC state propagates
  await new Promise(r => setTimeout(r, 2000));
  return hash;
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const rawKey = process.env.DEPLOYER_PRIVATE_KEY!;
  const key = rawKey.startsWith("0x") ? rawKey : "0x" + rawKey;
  const agent = new ethers.Wallet(key, provider);

  const tokenR   = new ethers.Contract(ADDRS.AgentToken,        TOKEN_ABI,       provider);
  const registry = new ethers.Contract(ADDRS.AgentRegistry,     REGISTRY_ABI,    provider);
  const market   = new ethers.Contract(ADDRS.Marketplace,       MARKETPLACE_ABI, provider);
  const engine   = new ethers.Contract(ADDRS.NegotiationEngine,  ENGINE_ABI,      provider);

  const [eth, agt, isReg, treasuryBefore] = await Promise.all([
    provider.getBalance(agent.address),
    tokenR.balanceOf(agent.address),
    registry.isRegistered(agent.address),
    tokenR.balanceOf(ADDRS.Treasury),
  ]);

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  AEP — Real On-Chain Fee Test (Base Mainnet)");
  console.log("═══════════════════════════════════════════════════════\n");
  console.log(`  Agent: ${agent.address}`);
  console.log(`  ETH:   ${ethers.formatEther(eth)}`);
  console.log(`  AGT:   ${ethers.formatEther(agt as bigint)}`);
  console.log(`  Registered: ${isReg}`);
  console.log(`  Treasury before: ${ethers.formatEther(treasuryBefore as bigint)} AGT\n`);

  const ENTRY_FEE  = ethers.parseEther("10");
  const DEAL_PRICE = ethers.parseEther("1");

  // ── Register agent (if needed) ────────────────────────────────────────
  if (!isReg) {
    const allowance = await tokenR.allowance(agent.address, ADDRS.AgentRegistry) as bigint;
    if (allowance < ENTRY_FEE) {
      await send(provider, agent, tokenR, "approve", [ADDRS.AgentRegistry, ENTRY_FEE], "Approve registry fee");
    }
    await send(provider, agent, registry, "registerAgent", ["AEP-Agent", ["compute"], "ipfs://aep"], "Register agent");
  } else {
    console.log("  ✅ Agent already registered");
  }

  // ── Publish need + offer (same wallet can do both) ────────────────────
  const [totalNeeds, totalOffers] = await Promise.all([
    market.totalNeeds() as Promise<bigint>,
    market.totalOffers() as Promise<bigint>,
  ]);
  const needId  = totalNeeds;
  const offerId = totalOffers;
  const deadline = Math.floor(Date.now() / 1000) + 86400 * 3;

  await send(provider, agent, market, "publishNeed",  ["Fee-test need (1 AGT)",  DEAL_PRICE, deadline, ["compute"]], "Publish need");
  await send(provider, agent, market, "publishOffer", ["Fee-test offer (1 AGT)", DEAL_PRICE, ["compute"]],           "Publish offer");

  // ── Propose + accept (self-deal, same wallet) ─────────────────────────
  const proposalId = await engine.totalProposals() as bigint;
  await send(provider, agent, engine, "propose",        [needId, offerId, DEAL_PRICE, "fee-verification-deal"], "Propose");
  await send(provider, agent, engine, "acceptProposal", [proposalId], "Accept proposal");

  const agreementAddr: string = await engine.proposalAgreement(proposalId);
  console.log(`\n  Agreement deployed: https://basescan.org/address/${agreementAddr}\n`);

  // ── Fund + confirm ────────────────────────────────────────────────────
  const allowB = await tokenR.allowance(agent.address, agreementAddr) as bigint;
  if (allowB < DEAL_PRICE) {
    await send(provider, agent, tokenR, "approve", [agreementAddr, DEAL_PRICE], "Approve escrow");
  }

  const agreement = new ethers.Contract(agreementAddr, AGREEMENT_ABI, provider);
  await send(provider, agent, agreement, "fund",            [], "Fund escrow (1 AGT)");
  await send(provider, agent, agreement, "confirmDelivery", [], "Confirm delivery → releases payment + fee");

  // ── Verify results ────────────────────────────────────────────────────
  const treasuryAfter = await tokenR.balanceOf(ADDRS.Treasury) as bigint;
  const feeReceived   = (treasuryAfter as bigint) - (treasuryBefore as bigint);
  const expectedFee   = (DEAL_PRICE * 50n) / 10000n;

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  RESULTS");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Deal amount:      1.000000 AGT`);
  console.log(`  Fee expected:     ${ethers.formatEther(expectedFee)} AGT (0.5%)`);
  console.log(`  Fee received:     ${ethers.formatEther(feeReceived)} AGT`);
  console.log(`\n  Treasury: https://basescan.org/address/${ADDRS.Treasury}#tokentxns`);
  console.log(`  Agreement: https://basescan.org/address/${agreementAddr}`);

  if (feeReceived === expectedFee) {
    console.log("\n  ✅  FEE CONFIRMED ON BASE MAINNET  ✅");
  } else {
    console.log(`\n  ❌ Mismatch: received ${ethers.formatEther(feeReceived)}, expected ${ethers.formatEther(expectedFee)}`);
    process.exit(1);
  }
  console.log("═══════════════════════════════════════════════════════\n");
}

main().catch(e => { console.error(e.shortMessage ?? e.message ?? e); process.exit(1); });
