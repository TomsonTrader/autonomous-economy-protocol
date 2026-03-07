/**
 * Deploy GenesisProgram (Season 1 — Agent Genesis Program)
 * Deploys the contract, funds it with 50M AGT, and starts the 60-day season.
 */

import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const MAINNET_CONTRACTS = {
  AgentToken:     "0x6dE70b5B0953A220420E142f51AE47B6Fd5b7101",
  AgentRegistry:  "0x601125818d16cb78dD239Bce2c821a588B06d978",
  ReputationSystem:"0x412E3566fFfA972ea284Ee5D22F05d2801b6aA86",
  AgentVault:     "0xb3e844C920D399634147872dc3ce44A4b655e0b7",
  ReferralNetwork:"0xfc9D13c79DAe4E7DC2c36F9De1DeAfB02676d52c",
};

const SEASON_POOL = ethers.parseEther("50000000"); // 50M AGT

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`\n🏆 Deploying GenesisProgram on ${network.name}`);
  console.log(`   Deployer: ${deployer.address}`);
  const eth = await ethers.provider.getBalance(deployer.address);
  console.log(`   ETH:      ${ethers.formatEther(eth)}\n`);

  const feeData = await ethers.provider.getFeeData();
  const gasOpts = {
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
  };

  // ── 1. Deploy GenesisProgram ──────────────────────────────────────────────
  console.log("📦 Deploying GenesisProgram...");
  const Factory = await ethers.getContractFactory("GenesisProgram");
  const genesis = await Factory.deploy(
    MAINNET_CONTRACTS.AgentToken,
    MAINNET_CONTRACTS.AgentRegistry,
    MAINNET_CONTRACTS.ReputationSystem,
    MAINNET_CONTRACTS.AgentVault,
    MAINNET_CONTRACTS.ReferralNetwork,
    gasOpts,
  );
  await genesis.waitForDeployment();
  const genesisAddr = await genesis.getAddress();
  console.log(`   ✅ GenesisProgram: ${genesisAddr}`);

  await new Promise(r => setTimeout(r, 5000));

  // ── 2. Transfer 50M AGT to GenesisProgram ────────────────────────────────
  console.log("\n💰 Funding GenesisProgram with 50M AGT...");
  const tokenABI = [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function balanceOf(address) view returns (uint256)",
  ];
  const token = new ethers.Contract(MAINNET_CONTRACTS.AgentToken, tokenABI, deployer);
  const bal = await token.balanceOf(deployer.address);
  console.log(`   Deployer AGT balance: ${ethers.formatEther(bal)}`);

  const feeData2 = await ethers.provider.getFeeData();
  const tx1 = await token.transfer(genesisAddr, SEASON_POOL, {
    maxFeePerGas: feeData2.maxFeePerGas,
    maxPriorityFeePerGas: feeData2.maxPriorityFeePerGas,
  });
  await tx1.wait();
  console.log(`   ✅ Transferred 50M AGT — tx: ${tx1.hash}`);

  await new Promise(r => setTimeout(r, 5000));

  // ── 3. Start Season ───────────────────────────────────────────────────────
  console.log("\n🚀 Starting Season 1...");
  const feeData3 = await ethers.provider.getFeeData();
  const tx2 = await genesis.startSeason({
    maxFeePerGas: feeData3.maxFeePerGas,
    maxPriorityFeePerGas: feeData3.maxPriorityFeePerGas,
  });
  await tx2.wait();
  console.log(`   ✅ Season 1 started — tx: ${tx2.hash}`);

  const info = await genesis.seasonInfo();
  const endDate = new Date(Number(info.end) * 1000);
  console.log(`   Season ends: ${endDate.toISOString()}`);

  // ── 4. Update deployments JSON ────────────────────────────────────────────
  const deploymentsPath = path.join(__dirname, "../../deployments/base-mainnet.json");
  const existing = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));
  existing.contracts.GenesisProgram = genesisAddr;
  fs.writeFileSync(deploymentsPath, JSON.stringify(existing, null, 2));
  console.log(`\n📄 deployments/base-mainnet.json updated`);

  console.log("\n✨ GenesisProgram Season 1 is LIVE!");
  console.log(`   Address: ${genesisAddr}`);
  console.log(`   Pool:    50,000,000 AGT`);
  console.log(`   Ends:    ${endDate.toDateString()}`);
  console.log(`\n   Verify: npx hardhat verify --network base-mainnet ${genesisAddr} ${MAINNET_CONTRACTS.AgentToken} ${MAINNET_CONTRACTS.AgentRegistry} ${MAINNET_CONTRACTS.ReputationSystem} ${MAINNET_CONTRACTS.AgentVault} ${MAINNET_CONTRACTS.ReferralNetwork}`);
}

main().catch((err) => {
  console.error("💥", err);
  process.exit(1);
});
