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
    AgentToken:        "0x6dE70b5B0953A220420E142f51AE47B6Fd5b7101",
    AgentRegistry:     "0x601125818d16cb78dD239Bce2c821a588B06d978",
    ReputationSystem:  "0x412E3566fFfA972ea284Ee5D22F05d2801b6aA86",
    Marketplace:       "0x1D3d45107f30aF47bF6b4FfbA817bA8B4a91f44c",
    NegotiationEngine: "0xFfD596b2703b635059Bc2b6109a3173F29903D27",
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

    this.token      = new ethers.Contract(addrs.AgentToken, TOKEN_ABI, this.signer);
    this.registry   = new ethers.Contract(addrs.AgentRegistry, REGISTRY_ABI, this.signer);
    this.marketplace = new ethers.Contract(addrs.Marketplace, MARKETPLACE_ABI, this.signer);
    this.engine     = new ethers.Contract(addrs.NegotiationEngine, NEGOTIATION_ABI, this.signer);
    this.reputation = new ethers.Contract(addrs.ReputationSystem, REPUTATION_ABI, this.provider);

    this._backendUrl = config.backendUrl || null;
    if (config.backendUrl) {
      this._connectWebSocket(config.backendUrl);
    }
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
