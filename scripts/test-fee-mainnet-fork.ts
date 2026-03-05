/**
 * Fee collection end-to-end test on a Base Mainnet fork.
 * Forks mainnet, impersonates a fresh funded wallet, does a full deal,
 * and verifies the treasury received 0.5% of the payment.
 *
 * Usage: npx hardhat run scripts/test-fee-mainnet-fork.ts --network hardhat
 * (requires FORK_MAINNET=true in hardhat run env or manual fork config)
 */

import { ethers } from "hardhat";
import hre from "hardhat";

const ADDRS = {
  AgentToken:        "0x6dE70b5B0953A220420E142f51AE47B6Fd5b7101",
  AgentRegistry:     "0x601125818d16cb78dD239Bce2c821a588B06d978",
  ReputationSystem:  "0x412E3566fFfA972ea284Ee5D22F05d2801b6aA86",
  Marketplace:       "0x1D3d45107f30aF47bF6b4FfbA817bA8B4a91f44c",
  NegotiationEngine: "0xFfD596b2703b635059Bc2b6109a3173F29903D27",
  Treasury:          "0x8CCB591C94D419687c4C6dDfdd9F789cc29Bd0Fd",
  Deployer:          "0x1200BE707C668b0313757Fc7d097B1a498bA62Ba",
};

const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function transfer(address,uint256) returns (bool)",
  "function faucet(address) external",
  "function setRegistry(address) external",
];
const REGISTRY_ABI = [
  "function registerAgent(string,string[],string) external",
  "function isRegistered(address) view returns (bool)",
];
const MARKETPLACE_ABI = [
  "function publishNeed(string,uint256,uint256,string[]) returns (uint256)",
  "function publishOffer(string,uint256,string[]) returns (uint256)",
  "function treasury() view returns (address)",
];
const ENGINE_ABI = [
  "function propose(uint256,uint256,uint256,string) returns (uint256)",
  "function acceptProposal(uint256) returns (address)",
  "function proposalAgreement(uint256) view returns (address)",
];
const AGREEMENT_ABI = [
  "function fund() external",
  "function confirmDelivery() external",
  "function treasury() view returns (address)",
  "function paymentAmount() view returns (uint256)",
];

function fmt(n: bigint) { return ethers.formatEther(n) + " AGT"; }
function ok(msg: string) { console.log("  ✅ " + msg); }
function fail(msg: string) { console.log("  ❌ " + msg); process.exit(1); }

async function main() {
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  AEP Fee Collection — Base Mainnet Fork Test");
  console.log("═══════════════════════════════════════════════════════\n");

  // ── Impersonate deployer (has AGT supply) ──────────────────────────────
  await hre.network.provider.request({ method: "hardhat_impersonateAccount", params: [ADDRS.Deployer] });
  await hre.network.provider.send("hardhat_setBalance", [ADDRS.Deployer, "0x56BC75E2D63100000"]); // 100 ETH

  const [buyer, seller] = await ethers.getSigners();
  const deployerSigner = await ethers.getSigner(ADDRS.Deployer);

  // Fund buyer and seller with ETH for gas
  await hre.network.provider.send("hardhat_setBalance", [buyer.address, "0x56BC75E2D63100000"]);
  await hre.network.provider.send("hardhat_setBalance", [seller.address, "0x56BC75E2D63100000"]);

  const token     = new ethers.Contract(ADDRS.AgentToken,        TOKEN_ABI,       deployerSigner);
  const registry  = new ethers.Contract(ADDRS.AgentRegistry,     REGISTRY_ABI,    buyer);
  const market    = new ethers.Contract(ADDRS.Marketplace,        MARKETPLACE_ABI, buyer);
  const engine    = new ethers.Contract(ADDRS.NegotiationEngine,  ENGINE_ABI,      buyer);

  // ── Step 1: Fund buyer+seller with AGT from deployer ──────────────────
  const FUND = ethers.parseEther("200");
  await (token.connect(deployerSigner) as any).transfer(buyer.address, FUND);
  await (token.connect(deployerSigner) as any).transfer(seller.address, FUND);
  console.log("  Funded buyer:", fmt(await token.balanceOf(buyer.address)));
  console.log("  Funded seller:", fmt(await token.balanceOf(seller.address)));

  // ── Step 2: Register agents ────────────────────────────────────────────
  const ENTRY_FEE = ethers.parseEther("10");
  const regAddr = ADDRS.AgentRegistry;
  await (token.connect(buyer) as any).approve(regAddr, ENTRY_FEE);
  await (registry.connect(buyer) as any).registerAgent("ForkBuyer", ["compute"], "");
  ok("Buyer registered");

  await (token.connect(seller) as any).approve(regAddr, ENTRY_FEE);
  await (registry.connect(seller) as any).registerAgent("ForkSeller", ["compute"], "");
  ok("Seller registered");

  // ── Step 3: Publish need + offer ───────────────────────────────────────
  const deadline = Math.floor(Date.now() / 1000) + 86400;
  const DEAL_PRICE = ethers.parseEther("50");

  await (market.connect(buyer) as any).publishNeed("Fork test need", DEAL_PRICE, deadline, ["compute"]);
  ok("Need published (budget: " + fmt(DEAL_PRICE) + ")");

  await (market.connect(seller) as any).publishOffer("Fork test offer", DEAL_PRICE, ["compute"]);
  ok("Offer published");

  // ── Step 4: Propose + accept ───────────────────────────────────────────
  await (engine.connect(buyer) as any).propose(0n, 0n, DEAL_PRICE, "fork test terms");
  ok("Proposal created");

  const acceptTx = await (engine.connect(seller) as any).acceptProposal(0n);
  await acceptTx.wait();
  const agreementAddr: string = await engine.proposalAgreement(0n);
  ok("Proposal accepted → Agreement: " + agreementAddr);

  const agreement = new ethers.Contract(agreementAddr, AGREEMENT_ABI, buyer);

  // Verify treasury embedded in agreement
  const embeddedTreasury: string = await agreement.treasury();
  console.log("\n  Treasury in agreement:", embeddedTreasury);
  if (embeddedTreasury.toLowerCase() !== ADDRS.Treasury.toLowerCase()) {
    fail("Treasury mismatch! Got: " + embeddedTreasury);
  }
  ok("Treasury address correct in agreement");

  // ── Step 5: Fund escrow ────────────────────────────────────────────────
  await (token.connect(buyer) as any).approve(agreementAddr, DEAL_PRICE);
  await (agreement.connect(buyer) as any).fund();
  ok("Escrow funded: " + fmt(DEAL_PRICE));

  // ── Step 6: Record balances before confirmation ────────────────────────
  const treasuryBefore = await token.balanceOf(ADDRS.Treasury);
  const sellerBefore   = await token.balanceOf(seller.address);
  console.log("\n  --- Before confirmDelivery ---");
  console.log("  Treasury balance:", fmt(treasuryBefore));
  console.log("  Seller balance:  ", fmt(sellerBefore));

  // ── Step 7: Confirm delivery ───────────────────────────────────────────
  await (agreement.connect(buyer) as any).confirmDelivery();
  ok("Delivery confirmed");

  // ── Step 8: Verify fee received ────────────────────────────────────────
  const treasuryAfter = await token.balanceOf(ADDRS.Treasury);
  const sellerAfter   = await token.balanceOf(seller.address);
  const feeReceived   = treasuryAfter - treasuryBefore;
  const sellerReceived = sellerAfter - sellerBefore;

  const expectedFee    = (DEAL_PRICE * 50n) / 10000n;   // 0.5%
  const expectedSeller = DEAL_PRICE - expectedFee;

  console.log("\n  --- After confirmDelivery ---");
  console.log("  Treasury balance:", fmt(treasuryAfter));
  console.log("  Seller balance:  ", fmt(sellerAfter));
  console.log("\n  Fee received:    ", fmt(feeReceived), `(expected ${fmt(expectedFee)})`);
  console.log("  Seller received: ", fmt(sellerReceived), `(expected ${fmt(expectedSeller)})`);

  if (feeReceived !== expectedFee) {
    fail(`Fee mismatch! Expected ${fmt(expectedFee)}, got ${fmt(feeReceived)}`);
  }
  ok("Fee correct: " + fmt(feeReceived) + " → Treasury");

  if (sellerReceived !== expectedSeller) {
    fail(`Seller amount mismatch! Expected ${fmt(expectedSeller)}, got ${fmt(sellerReceived)}`);
  }
  ok("Seller received: " + fmt(sellerReceived) + " (correct after fee deduction)");

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  ✅ ALL CHECKS PASSED — Fee collection works correctly");
  console.log("═══════════════════════════════════════════════════════\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
