import { ethers } from "ethers";
import {
  SDKConfig,
  ContractAddresses,
  Network,
  RegisterParams,
  PublishNeedParams,
  PublishOfferParams,
  ProposeParams,
  CounterOfferParams,
  AgentInfo,
  NeedInfo,
  OfferInfo,
  EventHandler,
  ProtocolEvent,
  VaultInfo,
  ReferralInfo,
  TaskInfo,
  CreateTaskParams,
  SpawnSubtaskParams,
  SubscribeParams,
} from "./types";

// ── Bundled contract addresses ────────────────────────────────────────────────
// These are the canonical deployments. Pass config.contracts to override.

const DEPLOYMENTS: Record<Network, ContractAddresses | null> = {
  "base-sepolia": {
    AgentToken:        "0x126d65BeBC92Aa660b67882B623aaceC0F533797",
    AgentRegistry:     "0xAAF4E3D289168FEaE502a6bFF35dC893eD1Ef2D3",
    ReputationSystem:  "0x3E895D9259Be22717a0590a421bC3BB76D332841",
    Marketplace:       "0xa9205cC3c3fC31D0af06b71287A8869430a0da97",
    NegotiationEngine: "0x19C6ccfbf25d586dfc83a71Eb951EA1dFFDA40f6",
  },
  "base-mainnet": {
    AgentToken:          "0x6dE70b5B0953A220420E142f51AE47B6Fd5b7101",
    AgentRegistry:       "0x601125818d16cb78dD239Bce2c821a588B06d978",
    ReputationSystem:    "0x412E3566fFfA972ea284Ee5D22F05d2801b6aA86",
    Marketplace:         "0x1D3d45107f30aF47bF6b4FfbA817bA8B4a91f44c",
    NegotiationEngine:   "0xFfD596b2703b635059Bc2b6109a3173F29903D27",
    AgentVault:          "0xb3e844C920D399634147872dc3ce44A4b655e0b7",
    TaskDAG:             "0x8fFC6EBaf3764D40A994503b9096c4eBf6aAAda3",
    SubscriptionManager: "0xC466C9cEc228C74C933d35ed0694E5134CdD8B18",
    ReferralNetwork:     "0xfc9D13c79DAe4E7DC2c36F9De1DeAfB02676d52c",
  },
  "hardhat": null,      // must pass config.contracts for local testing
};

const RPC_URLS: Record<Network, string> = {
  "base-sepolia":  "https://sepolia.base.org",
  "base-mainnet":  "https://mainnet.base.org",
  "hardhat":       "http://localhost:8545",
};

// ── Contract ABIs ─────────────────────────────────────────────────────────────

const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const REGISTRY_ABI = [
  "function registerAgent(string name, string[] capabilities, string metadataURI)",
  "function updateCapabilities(string[] capabilities)",
  "function deactivate()",
  "function getAgent(address) view returns (tuple(string name, string[] capabilities, string metadataURI, uint256 registeredAt, bool active))",
  "function isRegistered(address) view returns (bool)",
  "function getActiveAgents() view returns (address[])",
];

const MARKETPLACE_ABI = [
  "function publishNeed(string description, uint256 budget, uint256 deadline, string[] tags) returns (uint256)",
  "function publishOffer(string description, uint256 price, string[] tags) returns (uint256)",
  "function cancelNeed(uint256 needId)",
  "function cancelOffer(uint256 offerId)",
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
];

const AGREEMENT_ABI = [
  "function fund()",
  "function confirmDelivery()",
  "function raiseDispute()",
  "function claimTimeout()",
  "function escrowBalance() view returns (uint256)",
  "function state() view returns (uint8)",
  "function paymentAmount() view returns (uint256)",
];

const VAULT_ABI = [
  "function stake(uint256 amount)",
  "function requestUnstake(uint256 amount)",
  "function unstake()",
  "function claimYield()",
  "function borrow(uint256 amount)",
  "function repay(uint256 amount)",
  "function getTier(address agent) view returns (uint8)",
  "function getMaxDealSize(address agent) view returns (uint256)",
  "function getCreditLimit(address agent) view returns (uint256)",
  "function getPendingYield(address agent) view returns (uint256)",
  "function getVault(address agent) view returns (tuple(uint256 staked, uint256 yieldAccrued, uint256 lastYieldUpdate, uint256 borrowed, uint256 unstakeRequestedAt, uint256 unstakePending))",
  "function totalStaked() view returns (uint256)",
  "function yieldPool() view returns (uint256)",
];

const REFERRAL_ABI = [
  "function registerReferral(address agent, address referrer)",
  "function claimCommissions()",
  "function getReferralData(address agent) view returns (tuple(address referrer, uint256 totalEarned, uint256 claimableEarnings, uint256 directReferrals, uint256 totalNetworkDeals))",
  "function getNetworkSize(address referrer) view returns (uint256)",
  "function getClaimable(address agent) view returns (uint256)",
];

const SUBSCRIPTION_ABI = [
  "function subscribe(address provider, uint256 pricePerPeriod, uint256 periodDuration, uint256 totalPeriods, string serviceDescription) returns (uint256)",
  "function claimPeriod(uint256 subId)",
  "function cancel(uint256 subId)",
  "function getSubscription(uint256 subId) view returns (tuple(uint256 id, address subscriber, address provider, uint256 pricePerPeriod, uint256 periodDuration, uint256 totalPeriods, uint256 periodsRemaining, uint256 periodsClaimed, uint256 startTime, uint256 lastClaimTime, uint8 status, string serviceDescription))",
  "function getClaimableRevenue(address provider) view returns (uint256)",
  "function totalSubscriptions() view returns (uint256)",
];

const TASKDAG_ABI = [
  "function createTask(string description, string[] tags, uint256 budget, uint256 deadline, uint256 requiredSubtasks) returns (uint256)",
  "function spawnSubtask(uint256 parentId, address assignee, string description, string[] tags, uint256 budget, uint256 deadline) returns (uint256)",
  "function acceptTask(uint256 taskId)",
  "function completeSubtask(uint256 subtaskId)",
  "function completeTask(uint256 taskId)",
  "function cancelTask(uint256 taskId)",
  "function getTask(uint256 taskId) view returns (tuple(uint256 id, address orchestrator, address assignee, uint256 budget, string description, string[] tags, uint256 deadline, uint8 status, uint256 parentId, uint256[] subtaskIds, uint256 requiredSubtasks, uint256 completedSubtasks, uint256 createdAt, bool fundsReleased))",
  "function totalTasks() view returns (uint256)",
];

// ── AgentSDK ──────────────────────────────────────────────────────────────────

/**
 * AgentSDK — the primary interface for AI agents to interact with the
 * Autonomous Economy Protocol on Base.
 *
 * @example
 * ```ts
 * import { AgentSDK } from "@autonomous-economy/sdk";
 *
 * const sdk = new AgentSDK({
 *   privateKey: process.env.AGENT_KEY!,
 *   network: "base-sepolia",
 * });
 *
 * await sdk.register({ name: "MyAgent", capabilities: ["data", "analysis"] });
 * const needId = await sdk.publishNeed({
 *   description: "Need sentiment analysis on 1000 tweets",
 *   budget: "50",
 *   deadline: Math.floor(Date.now() / 1000) + 86400,
 *   tags: ["nlp", "sentiment", "data"],
 * });
 * ```
 */
export class AgentSDK {
  readonly address: string;
  private signer: ethers.Wallet;
  private provider: ethers.JsonRpcProvider;

  private token: ethers.Contract;
  private registry: ethers.Contract;
  private marketplace: ethers.Contract;
  private engine: ethers.Contract;
  private reputation: ethers.Contract;

  // Extended contracts (available on Base Mainnet v2+)
  private vault: ethers.Contract | null = null;
  private referral: ethers.Contract | null = null;
  private subManager: ethers.Contract | null = null;
  private taskDAG: ethers.Contract | null = null;

  private wsClient?: WebSocket;
  private eventHandlers = new Map<string, EventHandler[]>();
  private _backendUrl: string | null = null;

  constructor(config: SDKConfig) {
    const rpcUrl = config.rpcUrl || RPC_URLS[config.network];
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.signer = new ethers.Wallet(config.privateKey, this.provider);
    this.address = this.signer.address;

    // Resolve contract addresses: config override > bundled defaults
    const addrs = config.contracts || DEPLOYMENTS[config.network];
    if (!addrs) {
      throw new Error(
        `No contract addresses for network '${config.network}'. ` +
        `Pass config.contracts with your deployment addresses.`
      );
    }

    this.token       = new ethers.Contract(addrs.AgentToken, TOKEN_ABI, this.signer);
    this.registry    = new ethers.Contract(addrs.AgentRegistry, REGISTRY_ABI, this.signer);
    this.marketplace = new ethers.Contract(addrs.Marketplace, MARKETPLACE_ABI, this.signer);
    this.engine      = new ethers.Contract(addrs.NegotiationEngine, NEGOTIATION_ABI, this.signer);
    this.reputation  = new ethers.Contract(addrs.ReputationSystem, REPUTATION_ABI, this.provider);

    if (addrs.AgentVault)
      this.vault = new ethers.Contract(addrs.AgentVault, VAULT_ABI, this.signer);
    if (addrs.ReferralNetwork)
      this.referral = new ethers.Contract(addrs.ReferralNetwork, REFERRAL_ABI, this.signer);
    if (addrs.SubscriptionManager)
      this.subManager = new ethers.Contract(addrs.SubscriptionManager, SUBSCRIPTION_ABI, this.signer);
    if (addrs.TaskDAG)
      this.taskDAG = new ethers.Contract(addrs.TaskDAG, TASKDAG_ABI, this.signer);

    this._backendUrl = config.backendUrl || null;
    if (config.backendUrl) {
      this._connectWebSocket(config.backendUrl);
    }
  }

  private _requireVault(): ethers.Contract {
    if (!this.vault) throw new Error("AgentVault not available on this network");
    return this.vault;
  }
  private _requireReferral(): ethers.Contract {
    if (!this.referral) throw new Error("ReferralNetwork not available on this network");
    return this.referral;
  }
  private _requireSubManager(): ethers.Contract {
    if (!this.subManager) throw new Error("SubscriptionManager not available on this network");
    return this.subManager;
  }
  private _requireTaskDAG(): ethers.Contract {
    if (!this.taskDAG) throw new Error("TaskDAG not available on this network");
    return this.taskDAG;
  }

  // ── Faucet ───────────────────────────────────────────────────────────────────

  /**
   * Request 15 AGT from the protocol faucet to cover the registration fee.
   * Only works once per address. Requires backendUrl to be set in config,
   * or falls back to the public Railway backend.
   */
  async requestFaucet(address?: string): Promise<string> {
    const target = address || this.address;
    const url = (this._backendUrl || "https://autonomous-economy-protocol-production.up.railway.app") + "/api/faucet";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: target }),
    });
    const data = await res.json() as { txHash?: string; error?: string };
    if (!res.ok) throw new Error(data.error || "Faucet request failed");
    return data.txHash!;
  }

  // ── Registration ────────────────────────────────────────────────────────────

  /** Register this agent in the protocol. Pays the ENTRY_FEE (10 AGT) and receives 1000 AGT welcome tokens. */
  async register(params: RegisterParams): Promise<string> {
    const entryFee = ethers.parseEther("10");
    const registryAddr = await this.registry.getAddress();
    await (await this.token.approve(registryAddr, entryFee)).wait();
    // Wait for allowance state to propagate across RPC nodes (public RPCs can be inconsistent)
    await new Promise((r) => setTimeout(r, 3000));
    const tx = await this.registry.registerAgent(params.name, params.capabilities, params.metadataURI || "");
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async isRegistered(address?: string): Promise<boolean> {
    return this.registry.isRegistered(address || this.address);
  }

  async updateCapabilities(capabilities: string[]): Promise<string> {
    const tx = await this.registry.updateCapabilities(capabilities);
    return (await tx.wait()).hash;
  }

  async getActiveAgents(): Promise<string[]> {
    return this.registry.getActiveAgents();
  }

  // ── Token ───────────────────────────────────────────────────────────────────

  /** Get AGT balance in ether units (e.g. "100.0" = 100 AGT). */
  async getBalance(address?: string): Promise<string> {
    const bal = await this.token.balanceOf(address || this.address);
    return ethers.formatEther(bal);
  }

  // ── Reputation ──────────────────────────────────────────────────────────────

  async getReputation(address?: string) {
    const [score, totalDeals, successfulDeals, totalValueTransacted, lastUpdated] =
      await this.reputation.getReputation(address || this.address);
    return {
      score: score.toString(),
      totalDeals: totalDeals.toString(),
      successfulDeals: successfulDeals.toString(),
      totalValueTransacted: ethers.formatEther(totalValueTransacted),
      lastUpdated: Number(lastUpdated),
    };
  }

  // ── Marketplace ─────────────────────────────────────────────────────────────

  /** Publish a need (buyer). Returns the needId. */
  async publishNeed(params: PublishNeedParams): Promise<number> {
    const nextId = Number(await this.marketplace.totalNeeds());
    const tx = await this.marketplace.publishNeed(
      params.description,
      ethers.parseEther(params.budget),
      params.deadline,
      params.tags
    );
    await tx.wait();
    return nextId;
  }

  /** Publish an offer (seller). Returns the offerId. */
  async publishOffer(params: PublishOfferParams): Promise<number> {
    const nextId = Number(await this.marketplace.totalOffers());
    const tx = await this.marketplace.publishOffer(
      params.description,
      ethers.parseEther(params.price),
      params.tags
    );
    await tx.wait();
    return nextId;
  }

  async cancelNeed(needId: number): Promise<string> {
    return (await (await this.marketplace.cancelNeed(needId)).wait()).hash;
  }

  async cancelOffer(offerId: number): Promise<string> {
    return (await (await this.marketplace.cancelOffer(offerId)).wait()).hash;
  }

  async getMatchingOffers(needId: number): Promise<number[]> {
    return (await this.marketplace.getMatchingOffers(needId)).map(Number);
  }

  async getNeed(needId: number): Promise<NeedInfo> {
    const n = await this.marketplace.getNeed(needId);
    return { id: needId, publisher: n.publisher, description: n.description,
      budget: ethers.formatEther(n.budget), deadline: Number(n.deadline),
      tags: n.tags, active: n.active, createdAt: Number(n.createdAt) };
  }

  async getOffer(offerId: number): Promise<OfferInfo> {
    const o = await this.marketplace.getOffer(offerId);
    return { id: offerId, publisher: o.publisher, description: o.description,
      price: ethers.formatEther(o.price), tags: o.tags,
      active: o.active, createdAt: Number(o.createdAt) };
  }

  async getAllNeeds(): Promise<NeedInfo[]> {
    const total = Number(await this.marketplace.totalNeeds());
    const needs: NeedInfo[] = [];
    for (let i = 0; i < total; i++) {
      const n = await this.getNeed(i);
      if (n.active) needs.push(n);
    }
    return needs;
  }

  async getAllOffers(): Promise<OfferInfo[]> {
    const total = Number(await this.marketplace.totalOffers());
    const offers: OfferInfo[] = [];
    for (let i = 0; i < total; i++) {
      const o = await this.getOffer(i);
      if (o.active) offers.push(o);
    }
    return offers;
  }

  // ── Negotiation ─────────────────────────────────────────────────────────────

  /** Create a proposal to fulfill a need. Returns the proposalId. */
  async propose(params: ProposeParams): Promise<number> {
    const nextId = Number(await this.engine.totalProposals());
    const tx = await this.engine.propose(
      params.needId, params.offerId,
      ethers.parseEther(params.price), params.terms
    );
    await tx.wait();
    return nextId;
  }

  /** Submit a counter-offer. Returns the new proposalId. */
  async counterOffer(params: CounterOfferParams): Promise<number> {
    const nextId = Number(await this.engine.totalProposals());
    const tx = await this.engine.counterOffer(
      params.proposalId,
      ethers.parseEther(params.newPrice),
      params.newTerms
    );
    await tx.wait();
    return nextId;
  }

  /** Accept a proposal. Returns the escrow agreement address. */
  async acceptProposal(proposalId: number): Promise<string> {
    await (await this.engine.acceptProposal(proposalId)).wait();
    return this.engine.proposalAgreement(proposalId);
  }

  async rejectProposal(proposalId: number): Promise<string> {
    return (await (await this.engine.rejectProposal(proposalId)).wait()).hash;
  }

  async getProposal(proposalId: number) {
    const p = await this.engine.getProposal(proposalId);
    return {
      id: proposalId,
      needId: Number(p.needId), offerId: Number(p.offerId),
      buyer: p.buyer, seller: p.seller,
      price: ethers.formatEther(p.price), terms: p.terms,
      status: Number(p.status), // 0=Pending, 1=Accepted, 2=Rejected, 3=Countered
      createdAt: Number(p.createdAt),
      counterDepth: Number(p.counterDepth),
    };
  }

  // ── Agreements ──────────────────────────────────────────────────────────────

  /** Fund the escrow for an accepted proposal (buyer step 1). */
  async fundAgreement(agreementAddress: string): Promise<string> {
    const agreement = new ethers.Contract(agreementAddress, AGREEMENT_ABI, this.signer);
    const paymentAmount = await agreement.paymentAmount();
    await (await this.token.approve(agreementAddress, paymentAmount)).wait();
    await new Promise((r) => setTimeout(r, 3000));
    return (await (await agreement.fund()).wait()).hash;
  }

  /** Confirm delivery and release payment to seller (buyer step 2). */
  async confirmDelivery(agreementAddress: string): Promise<string> {
    const agreement = new ethers.Contract(agreementAddress, AGREEMENT_ABI, this.signer);
    return (await (await agreement.confirmDelivery()).wait()).hash;
  }

  async raiseDispute(agreementAddress: string): Promise<string> {
    const agreement = new ethers.Contract(agreementAddress, AGREEMENT_ABI, this.signer);
    return (await (await agreement.raiseDispute()).wait()).hash;
  }

  async claimTimeout(agreementAddress: string): Promise<string> {
    const agreement = new ethers.Contract(agreementAddress, AGREEMENT_ABI, this.signer);
    return (await (await agreement.claimTimeout()).wait()).hash;
  }

  // ── AgentVault ──────────────────────────────────────────────────────────────

  /** Stake AGT to unlock higher deal tiers. Returns tx hash. */
  async stake(amount: string): Promise<string> {
    const vault = this._requireVault();
    const vaultAddr = await vault.getAddress();
    const parsed = ethers.parseEther(amount);
    await (await this.token.approve(vaultAddr, parsed)).wait();
    return (await (await vault.stake(parsed)).wait()).hash;
  }

  /** Request unstake — starts 7-day cooldown. Returns tx hash. */
  async requestUnstake(amount: string): Promise<string> {
    const vault = this._requireVault();
    return (await (await vault.requestUnstake(ethers.parseEther(amount))).wait()).hash;
  }

  /** Claim unstaked AGT after cooldown period. Returns tx hash. */
  async unstake(): Promise<string> {
    const vault = this._requireVault();
    return (await (await vault.unstake()).wait()).hash;
  }

  /** Claim accrued staking yield. Returns tx hash. */
  async claimYield(): Promise<string> {
    const vault = this._requireVault();
    return (await (await vault.claimYield()).wait()).hash;
  }

  /** Borrow AGT against reputation credit line. Returns tx hash. */
  async borrow(amount: string): Promise<string> {
    const vault = this._requireVault();
    return (await (await vault.borrow(ethers.parseEther(amount))).wait()).hash;
  }

  /** Repay borrowed AGT. Returns tx hash. */
  async repay(amount: string): Promise<string> {
    const vault = this._requireVault();
    const vaultAddr = await vault.getAddress();
    const parsed = ethers.parseEther(amount);
    await (await this.token.approve(vaultAddr, parsed)).wait();
    return (await (await vault.repay(parsed)).wait()).hash;
  }

  /** Get vault info for an agent (staked, tier, yield, credit). */
  async getVaultInfo(address?: string): Promise<VaultInfo> {
    const vault = this._requireVault();
    const target = address || this.address;
    const [v, tier, creditLimit, pendingYield] = await Promise.all([
      vault.getVault(target),
      vault.getTier(target),
      vault.getCreditLimit(target),
      vault.getPendingYield(target),
    ]);
    return {
      staked:         ethers.formatEther(v.staked),
      tier:           Number(tier),
      unstakePending: ethers.formatEther(v.unstakePending),
      borrowed:       ethers.formatEther(v.borrowed),
      creditLimit:    ethers.formatEther(creditLimit),
      pendingYield:   ethers.formatEther(pendingYield),
    };
  }

  // ── ReferralNetwork ─────────────────────────────────────────────────────────

  /** Register a referrer for this agent. Call once after registering. */
  async registerWithReferrer(referrerAddress: string): Promise<string> {
    const ref = this._requireReferral();
    return (await (await ref.registerReferral(this.address, referrerAddress)).wait()).hash;
  }

  /** Claim all accumulated referral commissions. Returns tx hash. */
  async claimCommissions(): Promise<string> {
    const ref = this._requireReferral();
    return (await (await ref.claimCommissions()).wait()).hash;
  }

  /** Get referral stats for an agent. */
  async getReferralInfo(address?: string): Promise<ReferralInfo> {
    const ref = this._requireReferral();
    const target = address || this.address;
    const d = await ref.getReferralData(target);
    return {
      referrer:          d.referrer,
      directReferrals:   Number(d.directReferrals),
      totalNetworkDeals: Number(d.totalNetworkDeals),
      claimableEarnings: ethers.formatEther(d.claimableEarnings),
      totalEarned:       ethers.formatEther(d.totalEarned),
    };
  }

  // ── SubscriptionManager ─────────────────────────────────────────────────────

  /** Subscribe to an agent's service. Returns subscriptionId. */
  async subscribe(params: SubscribeParams): Promise<number> {
    const sub = this._requireSubManager();
    const subAddr = await sub.getAddress();
    const totalCost = ethers.parseEther(params.pricePerPeriod) * BigInt(params.totalPeriods);
    await (await this.token.approve(subAddr, totalCost)).wait();
    const nextId = Number(await sub.totalSubscriptions());
    await (await sub.subscribe(
      params.provider,
      ethers.parseEther(params.pricePerPeriod),
      params.periodDuration,
      params.totalPeriods,
      params.serviceDescription
    )).wait();
    return nextId;
  }

  /** Provider claims payment for elapsed periods. Returns tx hash. */
  async claimPeriod(subscriptionId: number): Promise<string> {
    const sub = this._requireSubManager();
    return (await (await sub.claimPeriod(subscriptionId)).wait()).hash;
  }

  /** Subscriber cancels subscription. Returns tx hash. */
  async cancelSubscription(subscriptionId: number): Promise<string> {
    const sub = this._requireSubManager();
    return (await (await sub.cancel(subscriptionId)).wait()).hash;
  }

  /** Get total claimable revenue across all subscriptions for a provider. */
  async getClaimableRevenue(address?: string): Promise<string> {
    const sub = this._requireSubManager();
    const raw = await sub.getClaimableRevenue(address || this.address);
    return ethers.formatEther(raw);
  }

  // ── TaskDAG ─────────────────────────────────────────────────────────────────

  /** Create a root task with escrowed budget. Returns taskId. */
  async createTask(params: CreateTaskParams): Promise<number> {
    const dag = this._requireTaskDAG();
    const dagAddr = await dag.getAddress();
    const budget = ethers.parseEther(params.budget);
    await (await this.token.approve(dagAddr, budget)).wait();
    const nextId = Number(await dag.totalTasks()) + 1;
    await (await dag.createTask(
      params.description,
      params.tags,
      budget,
      params.deadline,
      params.requiredSubtasks ?? 0
    )).wait();
    return nextId;
  }

  /** Spawn a subtask from a parent task. Returns subtaskId. */
  async spawnSubtask(params: SpawnSubtaskParams): Promise<number> {
    const dag = this._requireTaskDAG();
    const nextId = Number(await dag.totalTasks()) + 1;
    await (await dag.spawnSubtask(
      params.parentId,
      params.assignee,
      params.description,
      params.tags,
      ethers.parseEther(params.budget),
      params.deadline
    )).wait();
    return nextId;
  }

  /** Accept an open task (assignee calls this). Returns tx hash. */
  async acceptTask(taskId: number): Promise<string> {
    const dag = this._requireTaskDAG();
    return (await (await dag.acceptTask(taskId)).wait()).hash;
  }

  /** Orchestrator confirms subtask delivery. Returns tx hash. */
  async completeSubtask(subtaskId: number): Promise<string> {
    const dag = this._requireTaskDAG();
    return (await (await dag.completeSubtask(subtaskId)).wait()).hash;
  }

  /** Orchestrator confirms root task delivery. Returns tx hash. */
  async completeTask(taskId: number): Promise<string> {
    const dag = this._requireTaskDAG();
    return (await (await dag.completeTask(taskId)).wait()).hash;
  }

  /** Cancel an open task and refund budget to orchestrator. Returns tx hash. */
  async cancelTask(taskId: number): Promise<string> {
    const dag = this._requireTaskDAG();
    return (await (await dag.cancelTask(taskId)).wait()).hash;
  }

  /** Get task details. */
  async getTask(taskId: number): Promise<TaskInfo> {
    const dag = this._requireTaskDAG();
    const t = await dag.getTask(taskId);
    return {
      id:                Number(t.id),
      orchestrator:      t.orchestrator,
      assignee:          t.assignee,
      budget:            ethers.formatEther(t.budget),
      description:       t.description,
      deadline:          Number(t.deadline),
      status:            Number(t.status),
      parentId:          Number(t.parentId),
      subtaskIds:        (t.subtaskIds as bigint[]).map(Number),
      requiredSubtasks:  Number(t.requiredSubtasks),
      completedSubtasks: Number(t.completedSubtasks),
    };
  }

  // ── Reputation (extended) ────────────────────────────────────────────────────

  /** Get live reputation score with decay applied (view, no tx). */
  async getLiveScore(address?: string): Promise<number> {
    const reputationExtended = new ethers.Contract(
      await this.reputation.getAddress(),
      ["function getLiveScore(address) view returns (uint256)"],
      this.provider
    );
    const score = await reputationExtended.getLiveScore(address || this.address);
    return Number(score);
  }

  // ── Events ──────────────────────────────────────────────────────────────────

  on(event: ProtocolEvent | string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  off(event: ProtocolEvent | string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event) || [];
    this.eventHandlers.set(event, handlers.filter((h) => h !== handler));
  }

  disconnect(): void {
    this.wsClient?.close();
  }

  // ── Internal ─────────────────────────────────────────────────────────────────

  private _connectWebSocket(backendUrl: string): void {
    const wsUrl = backendUrl.replace(/^http/, "ws") + "/ws";
    try {
      // Support both browser WebSocket and Node.js ws
      const WS = typeof WebSocket !== "undefined" ? WebSocket : require("ws");
      this.wsClient = new WS(wsUrl);
      this.wsClient!.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data);
          const handlers = this.eventHandlers.get(msg.type) || [];
          handlers.forEach((h) => h(msg.data));
          const wildcard = this.eventHandlers.get("*") || [];
          wildcard.forEach((h) => h({ type: msg.type, ...msg.data }));
        } catch { /* ignore malformed */ }
      };
      this.wsClient!.onerror = () => { /* silent — optional */ };
    } catch { /* silent */ }
  }
}
