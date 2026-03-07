import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { DeploymentConfig } from "../types";

// Minimal ABIs for the contracts we need to call
const REGISTRY_ABI = [
  "function getAgent(address) view returns (tuple(string name, string[] capabilities, uint256 registeredAt, bool active))",
  "function isRegistered(address) view returns (bool)",
  "function getActiveAgents() view returns (address[])",
  "function totalRegistered() view returns (uint256)",
  "event AgentRegistered(address indexed agent, string name, string[] capabilities)",
  "event CapabilitiesUpdated(address indexed agent, string[] capabilities)",
];

const MARKETPLACE_ABI = [
  "function getNeed(uint256) view returns (tuple(address publisher, string description, uint256 budget, uint256 deadline, string[] tags, bool active, uint256 createdAt))",
  "function getOffer(uint256) view returns (tuple(address publisher, string description, uint256 price, string[] tags, bool active, uint256 createdAt))",
  "function getMatchingOffers(uint256) view returns (uint256[])",
  "function totalNeeds() view returns (uint256)",
  "function totalOffers() view returns (uint256)",
  "event NeedPublished(uint256 indexed needId, address indexed publisher, uint256 budget, string[] tags)",
  "event OfferPublished(uint256 indexed offerId, address indexed publisher, uint256 price, string[] tags)",
  "event NeedFulfilled(uint256 indexed needId, uint256 indexed offerId)",
];

const NEGOTIATION_ABI = [
  "function getProposal(uint256) view returns (tuple(uint256 needId, uint256 offerId, address buyer, address seller, uint256 price, string terms, uint8 status, uint256 createdAt, uint256 counterDepth, uint256 parentId))",
  "function proposalAgreement(uint256) view returns (address)",
  "function totalProposals() view returns (uint256)",
  "event ProposalCreated(uint256 indexed proposalId, uint256 needId, uint256 offerId, address buyer, address seller, uint256 price)",
  "event ProposalAccepted(uint256 indexed proposalId, address agreementContract)",
  "event CounterOffered(uint256 indexed newProposalId, uint256 indexed parentProposalId, uint256 newPrice)",
  "event ProposalRejected(uint256 indexed proposalId, address indexed by)",
];

const REPUTATION_ABI = [
  "function getReputation(address) view returns (uint256 score, uint256 totalDeals, uint256 successfulDeals, uint256 totalValueTransacted, uint256 lastUpdated)",
];

const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
];

const AGREEMENT_ABI = [
  "event DeliveryConfirmed(address indexed buyer)",
  "event DisputeRaised(address indexed raiser)",
  "event PaymentReleased(address indexed seller, uint256 amount)",
];

const VAULT_ABI = [
  "function getTier(address agent) view returns (uint8)",
  "function getCreditLimit(address agent) view returns (uint256)",
  "function getPendingYield(address agent) view returns (uint256)",
  "function getVault(address agent) view returns (tuple(uint256 staked, uint256 yieldAccrued, uint256 lastYieldUpdate, uint256 borrowed, uint256 unstakeRequestedAt, uint256 unstakePending))",
  "function totalStaked() view returns (uint256)",
  "function yieldPool() view returns (uint256)",
  "event Staked(address indexed agent, uint256 amount, uint8 tier)",
  "event UnstakeRequested(address indexed agent, uint256 amount, uint256 availableAt)",
  "event Unstaked(address indexed agent, uint256 amount)",
  "event YieldClaimed(address indexed agent, uint256 amount)",
  "event Borrowed(address indexed agent, uint256 amount)",
  "event Repaid(address indexed agent, uint256 amount)",
];

const REFERRAL_ABI = [
  "function getReferralData(address agent) view returns (tuple(address referrer, uint256 totalEarned, uint256 claimableEarnings, uint256 directReferrals, uint256 totalNetworkDeals))",
  "function getNetworkSize(address referrer) view returns (uint256)",
  "event ReferralRegistered(address indexed agent, address indexed referrer)",
  "event CommissionEarned(address indexed earner, address indexed source, uint256 amount, uint8 level)",
  "event CommissionClaimed(address indexed agent, uint256 amount)",
];

const TASKDAG_ABI = [
  "function totalTasks() view returns (uint256)",
  "function getTask(uint256 taskId) view returns (tuple(uint256 id, address orchestrator, address assignee, uint256 budget, string description, string[] tags, uint256 deadline, uint8 status, uint256 parentId, uint256[] subtaskIds, uint256 requiredSubtasks, uint256 completedSubtasks, uint256 createdAt, bool fundsReleased))",
  "event TaskCreated(uint256 indexed taskId, address indexed orchestrator, uint256 budget, uint256 parentId)",
  "event SubtaskSpawned(uint256 indexed parentId, uint256 indexed subtaskId, address indexed assignee, uint256 budget)",
  "event TaskCompleted(uint256 indexed taskId, address indexed assignee, uint256 payment)",
  "event TaskCancelled(uint256 indexed taskId)",
];

const SUBSCRIPTION_ABI = [
  "function totalSubscriptions() view returns (uint256)",
  "event SubscriptionCreated(uint256 indexed subId, address indexed subscriber, address indexed provider, uint256 pricePerPeriod, uint256 periodDuration, uint256 totalPeriods)",
  "event PeriodClaimed(uint256 indexed subId, address indexed provider, uint256 amount, uint256 periodsRemaining)",
  "event SubscriptionCancelled(uint256 indexed subId, address indexed by, uint256 refund)",
];

const GENESIS_ABI = [
  "function seasonInfo() view returns (bool started, bool ended, uint256 pool, uint256 start, uint256 end, uint256 totalPoints)",
  "function getParticipant(address agent) view returns (tuple(uint256 points, bool creditedRegistration, bool creditedFirstDeal, bool creditedStake, bool creditedWithReferrer, bool creditedBeReferrer3, bool creditedTenDeals, bool creditedRepSustained, uint256 repAboveThresholdSince, bool claimed))",
  "function getLeaderboard() view returns (address[] memory agents, uint256[] memory points)",
];

export class BlockchainService {
  provider: ethers.JsonRpcProvider;
  registry: ethers.Contract;
  marketplace: ethers.Contract;
  engine: ethers.Contract;
  reputation: ethers.Contract;
  token: ethers.Contract;
  vault: ethers.Contract | null = null;
  referral: ethers.Contract | null = null;
  taskDAG: ethers.Contract | null = null;
  subscription: ethers.Contract | null = null;
  genesis: ethers.Contract | null = null;
  deployment: DeploymentConfig;

  constructor() {
    const network = process.env.NETWORK || "hardhat";
    const rpcUrl =
      network === "base-mainnet"
        ? process.env.BASE_MAINNET_RPC || "https://mainnet.base.org"
        : network === "base-sepolia"
        ? process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org"
        : "http://localhost:8545";

    this.provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
      polling: true,
      pollingInterval: 12000, // 12s — matches Base block time, reduces filter churn
      batchMaxCount: 5,       // Base public RPC rejects batches > 10; keep well under
    });
    // Suppress "filter not found" errors from ethers.js polling on remote RPCs
    this.provider.on("error", (err: any) => {
      const msg: string = err?.error?.message ?? err?.message ?? "";
      if (msg.includes("filter not found")) return;
    });

    // Load deployment addresses
    const deploymentPath = path.join(
      __dirname,
      "../../../deployments",
      `${network}.json`
    );

    if (!fs.existsSync(deploymentPath)) {
      throw new Error(
        `No deployment found for network '${network}'. Run deploy script first.`
      );
    }

    this.deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
    const { contracts } = this.deployment;

    this.registry    = new ethers.Contract(contracts.AgentRegistry, REGISTRY_ABI, this.provider);
    this.marketplace = new ethers.Contract(contracts.Marketplace, MARKETPLACE_ABI, this.provider);
    this.engine      = new ethers.Contract(contracts.NegotiationEngine, NEGOTIATION_ABI, this.provider);
    this.reputation  = new ethers.Contract(contracts.ReputationSystem, REPUTATION_ABI, this.provider);
    this.token       = new ethers.Contract(contracts.AgentToken, TOKEN_ABI, this.provider);

    if (contracts.AgentVault)
      this.vault = new ethers.Contract(contracts.AgentVault, VAULT_ABI, this.provider);
    if (contracts.ReferralNetwork)
      this.referral = new ethers.Contract(contracts.ReferralNetwork, REFERRAL_ABI, this.provider);
    if (contracts.TaskDAG)
      this.taskDAG = new ethers.Contract(contracts.TaskDAG, TASKDAG_ABI, this.provider);
    if (contracts.SubscriptionManager)
      this.subscription = new ethers.Contract(contracts.SubscriptionManager, SUBSCRIPTION_ABI, this.provider);
    if (contracts.GenesisProgram)
      this.genesis = new ethers.Contract(contracts.GenesisProgram, GENESIS_ABI, this.provider);
  }

  async getAgentInfo(address: string) {
    const [agent, reputation, balance] = await Promise.allSettled([
      this.registry.getAgent(address),
      this.reputation.getReputation(address),
      this.token.balanceOf(address),
    ]);

    const agentData = agent.status === "fulfilled" ? agent.value : null;
    const repData   = reputation.status === "fulfilled" ? reputation.value : null;
    const bal       = balance.status === "fulfilled" ? balance.value : 0n;

    const [score, totalDeals, successfulDeals, totalValueTransacted, lastUpdated] =
      repData ? repData : [0n, 0n, 0n, 0n, 0n];

    return {
      address,
      name:          agentData?.name ?? "Unknown",
      capabilities:  agentData?.capabilities ?? [],
      metadataURI:   agentData?.metadataURI ?? "",
      registeredAt:  Number(agentData?.registeredAt ?? 0),
      active:        agentData?.active ?? false,
      reputation: {
        score:                score.toString(),
        totalDeals:           totalDeals.toString(),
        successfulDeals:      successfulDeals.toString(),
        totalValueTransacted: ethers.formatEther(totalValueTransacted),
        lastUpdated:          lastUpdated.toString(),
      },
      balance: ethers.formatEther(bal),
    };
  }

  async getNeed(needId: number) {
    const need = await this.marketplace.getNeed(needId);
    return {
      id: needId,
      publisher: need.publisher,
      description: need.description,
      budget: ethers.formatEther(need.budget),
      deadline: Number(need.deadline),
      tags: need.tags,
      active: need.active,
      createdAt: Number(need.createdAt),
    };
  }

  async getOffer(offerId: number) {
    const offer = await this.marketplace.getOffer(offerId);
    return {
      id: offerId,
      publisher: offer.publisher,
      description: offer.description,
      price: ethers.formatEther(offer.price),
      tags: offer.tags,
      active: offer.active,
      createdAt: Number(offer.createdAt),
    };
  }

  async getMarketStats() {
    const [totalNeeds, totalOffers, totalProposals, activeAgents] = await Promise.all([
      this.marketplace.totalNeeds(),
      this.marketplace.totalOffers(),
      this.engine.totalProposals(),
      this.registry.getActiveAgents(),
    ]);

    return {
      totalAgents: Number(activeAgents.length),
      activeAgents: Number(activeAgents.length),
      totalNeeds: Number(totalNeeds),
      totalOffers: Number(totalOffers),
      totalProposals: Number(totalProposals),
    };
  }
}
