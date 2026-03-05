import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkName = network.name;
  const feeRecipient = process.env.FEE_RECIPIENT || deployer.address;

  console.log(`\n🚀 Deploying Autonomous Economy Protocol v2 to ${networkName}`);
  console.log(`   Deployer:      ${deployer.address}`);
  console.log(`   Fee Recipient: ${feeRecipient}`);
  console.log(`   Balance:       ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  const deployments: Record<string, string> = {};
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const deploy = async (name: string, ...args: unknown[]) => {
    const feeData = await ethers.provider.getFeeData();
    const Factory = await ethers.getContractFactory(name);
    const contract = await Factory.deploy(...args, {
      maxFeePerGas: feeData.maxFeePerGas ? feeData.maxFeePerGas * 2n : undefined,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? feeData.maxPriorityFeePerGas * 2n : undefined,
    });
    await contract.waitForDeployment();
    const addr = await contract.getAddress();
    deployments[name] = addr;
    console.log(`   ✅ ${name.padEnd(22)} ${addr}`);
    await sleep(3000); // wait 3s between deployments to avoid nonce issues
    return contract;
  };

  // ── Core contracts ────────────────────────────────────────────────────────
  console.log("── Core ─────────────────────────────────────────────────────");
  const agentToken    = await deploy("AgentToken", deployer.address);
  const agentRegistry = await deploy("AgentRegistry", deployments.AgentToken);
  const reputation    = await deploy("ReputationSystem");
  const marketplace   = await deploy("Marketplace", deployments.AgentRegistry, feeRecipient);
  const engine        = await deploy("NegotiationEngine", deployments.AgentRegistry, deployments.Marketplace, deployments.ReputationSystem);

  // ── v2 Extension contracts ─────────────────────────────────────────────────
  console.log("\n── v2 Extensions ────────────────────────────────────────────");
  const agentVault    = await deploy("AgentVault", deployments.AgentToken, deployments.ReputationSystem);
  const taskDAG       = await deploy("TaskDAG", deployments.AgentToken, deployments.AgentRegistry);
  const subManager    = await deploy("SubscriptionManager", deployments.AgentToken, deployments.AgentRegistry);
  const referral      = await deploy("ReferralNetwork", deployments.AgentToken, feeRecipient);

  // ── Wire up ───────────────────────────────────────────────────────────────
  console.log("\n── Wiring contracts ─────────────────────────────────────────");

  const wire = async (label: string, tx: any) => {
    const feeData = await ethers.provider.getFeeData();
    const sent = await tx({
      maxFeePerGas: feeData.maxFeePerGas ? feeData.maxFeePerGas * 2n : undefined,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? feeData.maxPriorityFeePerGas * 2n : undefined,
    });
    await sent.wait();
    console.log(`   ${label}`);
    await sleep(3000);
  };

  await wire("AgentToken → AgentRegistry linked",          (o: any) => agentToken.setRegistry(deployments.AgentRegistry, o));
  await wire("ReputationSystem → NegotiationEngine linked",(o: any) => reputation.setNegotiationEngine(deployments.NegotiationEngine, o));
  await wire("AgentVault → Marketplace linked",            (o: any) => agentVault.setMarketplace(deployments.Marketplace, o));
  await wire("ReferralNetwork → Marketplace linked",       (o: any) => referral.setMarketplace(deployments.Marketplace, o));
  await wire("ReferralNetwork → SubscriptionManager linked",(o: any) => referral.setSubscriptionManager(deployments.SubscriptionManager, o));
  await wire("ReferralNetwork → TaskDAG linked",           (o: any) => referral.setTaskDAG(deployments.TaskDAG, o));

  // ── Save deployments ──────────────────────────────────────────────────────
  const deploymentsDir = path.join(__dirname, "../../deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });

  const deploymentData = {
    network: networkName,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: deployments,
  };

  fs.writeFileSync(
    path.join(deploymentsDir, `${networkName}.json`),
    JSON.stringify(deploymentData, null, 2)
  );

  console.log(`\n✨ All ${Object.keys(deployments).length} contracts deployed!`);
  console.log(`📄 Saved to deployments/${networkName}.json`);

  console.log("\n📋 Add to your .env:");
  for (const [name, addr] of Object.entries(deployments)) {
    const key = name.replace(/([A-Z])/g, "_$1").toUpperCase().replace(/^_/, "");
    console.log(`   ${key}_ADDRESS=${addr}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
