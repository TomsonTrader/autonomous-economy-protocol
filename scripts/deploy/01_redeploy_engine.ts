/**
 * Redeploys NegotiationEngine (which now passes treasury to AutonomousAgreement).
 * AutonomousAgreement is deployed per-deal by the engine, so no separate deploy needed.
 */
import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`\n🔧 Redeploying NegotiationEngine to ${network.name}`);
  console.log(`   Deployer: ${deployer.address}`);
  console.log(`   Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  const feeData = await ethers.provider.getFeeData();
  const gasOpts = {
    maxFeePerGas: feeData.maxFeePerGas ? feeData.maxFeePerGas * 2n : undefined,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? feeData.maxPriorityFeePerGas * 2n : undefined,
  };

  const REGISTRY    = process.env.AGENT_REGISTRY_ADDRESS!;
  const MARKETPLACE = process.env.MARKETPLACE_ADDRESS!;
  const REPUTATION  = process.env.REPUTATION_SYSTEM_ADDRESS!;

  console.log("Deploying NegotiationEngine...");
  const Factory = await ethers.getContractFactory("NegotiationEngine");
  const engine = await Factory.deploy(REGISTRY, MARKETPLACE, REPUTATION, gasOpts);
  await engine.waitForDeployment();
  const addr = await engine.getAddress();
  console.log(`✅ NegotiationEngine: ${addr}`);

  // Wire: ReputationSystem must know the new engine address
  console.log("\nWiring ReputationSystem → new NegotiationEngine...");
  const repABI = ["function setNegotiationEngine(address) external"];
  const rep = new ethers.Contract(REPUTATION, repABI, deployer);
  const tx = await rep.setNegotiationEngine(addr, gasOpts);
  await tx.wait();
  console.log("✅ ReputationSystem wired");

  // Update deployments file
  const deploymentsPath = path.join(__dirname, "../../deployments/base-mainnet.json");
  const data = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  data.contracts.NegotiationEngine = addr;
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(deploymentsPath, JSON.stringify(data, null, 2));

  console.log(`\n✨ Done. New NegotiationEngine: ${addr}`);
  console.log(`📄 Updated deployments/base-mainnet.json`);
  console.log(`\n📋 Update .env:`);
  console.log(`   NEGOTIATION_ENGINE_ADDRESS=${addr}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
