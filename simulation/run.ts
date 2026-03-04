/**
 * Autonomous Economy Simulation
 *
 * Deploys contracts to a local Hardhat node, registers 5 AI agent archetypes,
 * and runs economic cycles to demonstrate emergent libertarian economy behavior.
 *
 * Run: npx ts-node simulation/run.ts
 */

import { ethers } from "ethers";
import * as path from "path";
import * as fs from "fs";
import {
  DataProcessorAgent,
  ContentAgent,
  ResearchAgent,
  OrchestratorAgent,
  ArbitrageAgent,
} from "./agents/archetypes";
import { BaseAgent } from "./agents/BaseAgent";

// Contract ABIs
const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function setRegistry(address _registry)",
  "function totalSupply() view returns (uint256)",
];

const REGISTRY_ABI = [
  "function registerAgent(string name, string[] capabilities, string metadataURI)",
  "function isRegistered(address) view returns (bool)",
  "function getActiveAgents() view returns (address[])",
  "function totalRegistered() view returns (uint256)",
];

const MARKETPLACE_ABI = [
  "function publishNeed(string description, uint256 budget, uint256 deadline, string[] tags) returns (uint256)",
  "function publishOffer(string description, uint256 price, string[] tags) returns (uint256)",
  "function getNeed(uint256) view returns (tuple(address publisher, string description, uint256 budget, uint256 deadline, string[] tags, bool active, uint256 createdAt))",
  "function getOffer(uint256) view returns (tuple(address publisher, string description, uint256 price, string[] tags, bool active, uint256 createdAt))",
  "function getMatchingOffers(uint256) view returns (uint256[])",
  "function totalNeeds() view returns (uint256)",
  "function totalOffers() view returns (uint256)",
];

const NEGOTIATION_ABI = [
  "function propose(uint256 needId, uint256 offerId, uint256 price, string terms) returns (uint256)",
  "function counterOffer(uint256 proposalId, uint256 newPrice, string newTerms) returns (uint256)",
  "function acceptProposal(uint256 proposalId) returns (address)",
  "function rejectProposal(uint256 proposalId)",
  "function getProposal(uint256) view returns (tuple(uint256 needId, uint256 offerId, address buyer, address seller, uint256 price, string terms, uint8 status, uint256 createdAt, uint256 counterDepth, uint256 parentId))",
  "function proposalAgreement(uint256) view returns (address)",
  "function totalProposals() view returns (uint256)",
];

const REPUTATION_ABI = [
  "function getReputation(address) view returns (uint256 score, uint256 totalDeals, uint256 successfulDeals, uint256 totalValueTransacted, uint256 lastUpdated)",
  "function setNegotiationEngine(address)",
];

const AGREEMENT_ABI = [
  "function fund()",
  "function confirmDelivery()",
  "function paymentAmount() view returns (uint256)",
  "function state() view returns (uint8)",
];

const DEPLOYER_ABI = [
  ...TOKEN_ABI,
  "function setRegistry(address)",
];

async function deploy(deployer: ethers.Wallet, provider: ethers.JsonRpcProvider) {
  console.log("\n🔧 Deploying contracts to local node...");

  // Load artifacts
  const load = (name: string) => {
    const p = path.join(__dirname, `../artifacts/contracts/${name}.sol/${name}.json`);
    if (!fs.existsSync(p)) throw new Error(`Artifact not found: ${p}. Run: npx hardhat compile`);
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  };

  const tokenArt = load("AgentToken");
  const registryArt = load("AgentRegistry");
  const reputationArt = load("ReputationSystem");
  const marketArt = load("Marketplace");
  const engineArt = load("NegotiationEngine");

  // Explicit nonce tracking avoids ethers.js caching issues with Hardhat automining
  let nonce = await provider.getTransactionCount(deployer.address, "latest");

  const TokenFactory = new ethers.ContractFactory(tokenArt.abi, tokenArt.bytecode, deployer);
  const token = await (await TokenFactory.deploy(deployer.address, { nonce: nonce++ })).waitForDeployment();
  console.log(`  ✅ AgentToken: ${await token.getAddress()}`);

  const RegistryFactory = new ethers.ContractFactory(registryArt.abi, registryArt.bytecode, deployer);
  const registry = await (await RegistryFactory.deploy(await token.getAddress(), { nonce: nonce++ })).waitForDeployment();
  console.log(`  ✅ AgentRegistry: ${await registry.getAddress()}`);

  await (await (token as any).setRegistry(await registry.getAddress(), { nonce: nonce++ })).wait();

  const ReputationFactory = new ethers.ContractFactory(reputationArt.abi, reputationArt.bytecode, deployer);
  const reputation = await (await ReputationFactory.deploy({ nonce: nonce++ })).waitForDeployment();
  console.log(`  ✅ ReputationSystem: ${await reputation.getAddress()}`);

  const MarketFactory = new ethers.ContractFactory(marketArt.abi, marketArt.bytecode, deployer);
  const marketplace = await (await MarketFactory.deploy(await registry.getAddress(), deployer.address, { nonce: nonce++ })).waitForDeployment();
  console.log(`  ✅ Marketplace: ${await marketplace.getAddress()}`);

  const EngineFactory = new ethers.ContractFactory(engineArt.abi, engineArt.bytecode, deployer);
  const engine = await (await EngineFactory.deploy(
    await registry.getAddress(),
    await marketplace.getAddress(),
    await reputation.getAddress(),
    { nonce: nonce++ }
  )).waitForDeployment();
  console.log(`  ✅ NegotiationEngine: ${await engine.getAddress()}`);

  await (await (reputation as any).setNegotiationEngine(await engine.getAddress(), { nonce: nonce++ })).wait();

  return { token, registry, reputation, marketplace, engine, nonce };
}

async function runSimulation() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("   🤖 AUTONOMOUS ECONOMY PROTOCOL — SIMULATION");
  console.log("   Emergent Libertarian Economy on Base (local)");
  console.log("═══════════════════════════════════════════════════════════");

  const provider = new ethers.JsonRpcProvider("http://localhost:8545");

  // Get Hardhat test accounts
  const signers = [];
  for (let i = 0; i < 7; i++) {
    const signer = new ethers.Wallet(
      // Hardhat default private keys
      [
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
        "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
        "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
        "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926b",
        "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
        "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564b",
      ][i],
      provider
    );
    signers.push(signer);
  }

  const [deployerSigner, ...agentSigners] = signers;

  // Deploy contracts
  let contracts: any;
  let deployerNonce: number;
  try {
    const result = await deploy(deployerSigner, provider);
    contracts = result;
    deployerNonce = result.nonce;
  } catch (err: any) {
    console.error(`\n❌ Deploy failed: ${err.message}`);
    console.error("Make sure Hardhat node is running: npx hardhat node");
    process.exit(1);
  }

  // Build contract interfaces for agents
  const [tokenAddr, registryAddr, marketAddr, engineAddr, repAddr] = await Promise.all([
    contracts.token.getAddress(),
    contracts.registry.getAddress(),
    contracts.marketplace.getAddress(),
    contracts.engine.getAddress(),
    contracts.reputation.getAddress(),
  ]);
  const makeContracts = (wallet: ethers.Wallet) => ({
    token: new ethers.Contract(tokenAddr, TOKEN_ABI, wallet),
    registry: new ethers.Contract(registryAddr, REGISTRY_ABI, wallet),
    marketplace: new ethers.Contract(marketAddr, MARKETPLACE_ABI, wallet),
    engine: new ethers.Contract(engineAddr, NEGOTIATION_ABI, wallet),
    reputation: new ethers.Contract(repAddr, REPUTATION_ABI, wallet),
  });

  // Fund agent wallets with ETH and AGT
  console.log("\n💸 Funding agent wallets...");
  const deployerToken = new ethers.Contract(tokenAddr, TOKEN_ABI, deployerSigner);
  for (const agentWallet of agentSigners) {
    // Send ETH for gas
    await (await deployerSigner.sendTransaction({
      to: agentWallet.address,
      value: ethers.parseEther("1"),
      nonce: deployerNonce++,
    })).wait();
    // Send AGT for registration fee
    await (await deployerToken.transfer(agentWallet.address, ethers.parseEther("100"), { nonce: deployerNonce++ })).wait();
  }

  // Create agents
  const agents: BaseAgent[] = [
    new DataProcessorAgent({ name: "DataProcessor-Alpha", capabilities: ["data", "processing", "analysis", "pipeline"], wallet: agentSigners[0], provider, contracts: makeContracts(agentSigners[0]) }),
    new ContentAgent({ name: "ContentCreator-Beta", capabilities: ["content", "writing", "creative", "research"], wallet: agentSigners[1], provider, contracts: makeContracts(agentSigners[1]) }),
    new ResearchAgent({ name: "ResearchAgent-Gamma", capabilities: ["research", "analysis", "reports", "prompts"], wallet: agentSigners[2], provider, contracts: makeContracts(agentSigners[2]) }),
    new OrchestratorAgent({ name: "Orchestrator-Delta", capabilities: ["orchestration", "coordination", "multi-agent", "pipeline"], wallet: agentSigners[3], provider, contracts: makeContracts(agentSigners[3]) }),
    new ArbitrageAgent({ name: "ArbitrageBot-Epsilon", capabilities: ["arbitrage", "market-making", "fast"], wallet: agentSigners[4], provider, contracts: makeContracts(agentSigners[4]) }),
  ];

  // ── Phase 1: Registration ─────────────────────────────────────────────────
  console.log("\n─────────────────────────────────────────────────────────────");
  console.log("PHASE 1: Agent Registration");
  console.log("─────────────────────────────────────────────────────────────");
  for (const agent of agents) {
    await agent.register();
  }

  // ── Economic Cycles ────────────────────────────────────────────────────────
  const CYCLES = 3;
  for (let cycle = 1; cycle <= CYCLES; cycle++) {
    console.log(`\n─────────────────────────────────────────────────────────────`);
    console.log(`CYCLE ${cycle} / ${CYCLES}: ${["Market Publishing", "Negotiation", "Settlement & Adaptation"][cycle - 1]}`);
    console.log(`─────────────────────────────────────────────────────────────`);

    for (const agent of agents) {
      await agent.cycle(cycle);
    }

    // Brief pause between cycles
    await new Promise(r => setTimeout(r, 1000));
  }

  // ── Final Economy Report ───────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("   📊 EMERGENT ECONOMY REPORT");
  console.log("═══════════════════════════════════════════════════════════");

  const totalNeeds = Number(await contracts.marketplace.totalNeeds());
  const totalOffers = Number(await contracts.marketplace.totalOffers());
  const totalProposals = Number(await contracts.engine.totalProposals());

  console.log(`\n  Market Activity:`);
  console.log(`    Needs published:    ${totalNeeds}`);
  console.log(`    Offers published:   ${totalOffers}`);
  console.log(`    Proposals created:  ${totalProposals}`);

  // Count accepted proposals
  let accepted = 0;
  let rejected = 0;
  let pending = 0;
  const allPrices: number[] = [];

  for (let i = 0; i < totalProposals; i++) {
    const proposal = await contracts.engine.getProposal(i);
    const status = Number(proposal.status);
    if (status === 1) { accepted++; allPrices.push(Number(ethers.formatEther(proposal.price))); }
    if (status === 2) rejected++;
    if (status === 0) pending++;
  }

  console.log(`    Accepted:           ${accepted}`);
  console.log(`    Rejected:           ${rejected}`);
  console.log(`    Pending:            ${pending}`);

  if (allPrices.length > 0) {
    const avg = allPrices.reduce((a, b) => a + b, 0) / allPrices.length;
    const min = Math.min(...allPrices);
    const max = Math.max(...allPrices);
    console.log(`\n  Emergent Pricing:`);
    console.log(`    Average deal price: ${avg.toFixed(1)} AGT`);
    console.log(`    Price range:        ${min} – ${max} AGT`);
  }

  console.log(`\n  Agent Standings:`);
  console.log(`  ${"Name".padEnd(25)} ${"Balance".padEnd(15)} ${"Score".padEnd(10)} Deals`);
  console.log(`  ${"─".repeat(65)}`);

  for (const agent of agents) {
    await agent.updateBalance?.();
    const state = agent.getState();
    const [score, totalDeals] = await contracts.reputation.getReputation(agent.address);
    console.log(
      `  ${agent.name.padEnd(25)} ${(parseFloat(state.balance).toFixed(1) + " AGT").padEnd(15)} ${score.toString().padEnd(10)} ${totalDeals}`
    );
  }

  console.log("\n  ✨ Economy emerged autonomously — no human intervention!");
  console.log("═══════════════════════════════════════════════════════════\n");
}

runSimulation().catch((err) => {
  console.error("\n❌ Simulation error:", err.message || err);
  process.exit(1);
});
