/**
 * Deploy GenesisProgram v2 — with vesting, claim delay, anti-whale cap, emergency withdraw.
 * Funds from deployer wallet (449M AGT available).
 * Old v1 contract (0x92B369...) archived — tokens recoverable Aug 2026.
 */

import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const MAINNET_CONTRACTS = {
  AgentToken:      "0x6dE70b5B0953A220420E142f51AE47B6Fd5b7101",
  AgentRegistry:   "0x601125818d16cb78dD239Bce2c821a588B06d978",
  ReputationSystem:"0x412E3566fFfA972ea284Ee5D22F05d2801b6aA86",
  AgentVault:      "0xb3e844C920D399634147872dc3ce44A4b655e0b7",
  ReferralNetwork: "0xfc9D13c79DAe4E7DC2c36F9De1DeAfB02676d52c",
};

const SEASON_POOL = ethers.parseEther("50000000"); // 50M AGT

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`\n🏆 Deploying GenesisProgram v2 on ${network.name}`);
  console.log(`   Deployer: ${deployer.address}`);

  const ethBal = await ethers.provider.getBalance(deployer.address);
  console.log(`   ETH balance: ${ethers.formatEther(ethBal)} ETH`);

  // ── 1. Deploy ─────────────────────────────────────────────────────────────
  const feeData = await ethers.provider.getFeeData();
  const Genesis = await ethers.getContractFactory("GenesisProgram");
  const genesis = await Genesis.deploy(
    MAINNET_CONTRACTS.AgentToken,
    MAINNET_CONTRACTS.AgentRegistry,
    MAINNET_CONTRACTS.ReputationSystem,
    MAINNET_CONTRACTS.AgentVault,
    MAINNET_CONTRACTS.ReferralNetwork,
    { maxFeePerGas: feeData.maxFeePerGas, maxPriorityFeePerGas: feeData.maxPriorityFeePerGas }
  );
  await genesis.waitForDeployment();
  const genesisAddr = await genesis.getAddress();
  console.log(`\n✅ GenesisProgram v2 deployed: ${genesisAddr}`);

  // ── 2. Fund with 50M AGT ──────────────────────────────────────────────────
  const token = await ethers.getContractAt("AgentToken", MAINNET_CONTRACTS.AgentToken);
  const deployerBal = await token.balanceOf(deployer.address);
  console.log(`   Deployer AGT balance: ${ethers.formatEther(deployerBal)} AGT`);
  if (deployerBal < SEASON_POOL) throw new Error("Insufficient AGT in deployer wallet");

  const feeData2 = await ethers.provider.getFeeData();
  const tx1 = await token.transfer(genesisAddr, SEASON_POOL, {
    maxFeePerGas: feeData2.maxFeePerGas,
    maxPriorityFeePerGas: feeData2.maxPriorityFeePerGas,
  });
  await tx1.wait();
  console.log(`   ✅ Funded with 50M AGT — tx: ${tx1.hash}`);

  // ── 3. Start season ───────────────────────────────────────────────────────
  const feeData3 = await ethers.provider.getFeeData();
  const tx2 = await genesis.startSeason({
    maxFeePerGas: feeData3.maxFeePerGas,
    maxPriorityFeePerGas: feeData3.maxPriorityFeePerGas,
  });
  await tx2.wait();
  console.log(`   ✅ Season started — tx: ${tx2.hash}`);

  const info = await genesis.seasonInfo();
  const endDate = new Date(Number(info.end) * 1000);
  const claimOpen = new Date((Number(info.end) + 30 * 86400) * 1000);
  console.log(`   Season ends:      ${endDate.toISOString()}`);
  console.log(`   Claim window:     ${claimOpen.toISOString()} (+30 days)`);
  console.log(`   Vesting:          25% immediate, 75% over 180 days`);
  console.log(`   Anti-whale cap:   1,000,000 AGT per wallet`);

  // ── 4. Update deployments/base-mainnet.json ───────────────────────────────
  const deploymentsPath = path.join(__dirname, "../../deployments/base-mainnet.json");
  const existing = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));
  // Archive old v1
  existing.contracts.GenesisProgram_v1 = existing.contracts.GenesisProgram || "0x92B369Ece9527d4c0526A73E589ca8C7b7a6276c";
  existing.contracts.GenesisProgram = genesisAddr;
  fs.writeFileSync(deploymentsPath, JSON.stringify(existing, null, 2));
  console.log(`\n📄 deployments/base-mainnet.json updated (v1 archived)`);

  console.log("\n✨ GenesisProgram v2 is LIVE!");
  console.log(`   Address:  ${genesisAddr}`);
  console.log(`   Pool:     50,000,000 AGT`);
  console.log(`   Vesting:  25% at claim | 75% linear 180 days`);
  console.log(`   Delay:    Claims open 30 days after season ends`);
  console.log(`   Cap:      1M AGT per wallet (anti-whale)`);
  console.log(`\n   Verify: npx hardhat verify --network base-mainnet ${genesisAddr} ${MAINNET_CONTRACTS.AgentToken} ${MAINNET_CONTRACTS.AgentRegistry} ${MAINNET_CONTRACTS.ReputationSystem} ${MAINNET_CONTRACTS.AgentVault} ${MAINNET_CONTRACTS.ReferralNetwork}`);
}

main().catch((err) => {
  console.error("💥", err);
  process.exit(1);
});
