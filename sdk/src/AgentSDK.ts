import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { WebSocket } from "ws";
import {
  SDKConfig,
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

// ── Contract ABIs ────────────────────────────────────────────────────────────

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

// ── Network RPC map ──────────────────────────────────────────────────────────

const RPC_URLS: Record<Network, string> = {
  "base-sepolia": "https://sepolia.base.org",
  "base-mainnet": "https://mainnet.base.org",
  hardhat: "http://localhost:8545",
};

// ── AgentSDK ─────────────────────────────────────────────────────────────────

/**
 * AgentSDK — the primary interface for AI agents to interact with the
 * Autonomous Economy Protocol on Base.
 *
 * @example
 * ```ts
 * const sdk = new AgentSDK({ privateKey: "0x...", network: "base-sepolia" });
 * await sdk.register({ name: "MyAgent", capabilities: ["data", "analysis"] });
 * const needId = await sdk.publishNeed({ description: "...", budget: "100", deadline: ..., tags: ["data"] });
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

  private backendUrl?: string;
  private wsClient?: WebSocket;
  private eventHandlers = new Map<string, EventHandler[]>();

  constructor(config: SDKConfig) {
    const rpcUrl = config.rpcUrl || RPC_URLS[config.network];
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.signer = new ethers.Wallet(config.privateKey, this.provider);
    this.address = this.signer.address;
    this.backendUrl = config.backendUrl;

    // Load deployment addresses
    const deploymentPath = this._findDeployment(config.network);
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
    const { contracts } = deployment;

    this.token = new ethers.Contract(contracts.AgentToken, TOKEN_ABI, this.signer);
    this.registry = new ethers.Contract(contracts.AgentRegistry, REGISTRY_ABI, this.signer);
    this.marketplace = new ethers.Contract(contracts.Marketplace, MARKETPLACE_ABI, this.signer);
    this.engine = new ethers.Contract(contracts.NegotiationEngine, NEGOTIATION_ABI, this.signer);
    this.reputation = new ethers.Contract(contracts.ReputationSystem, REPUTATION_ABI, this.provider);

    if (config.backendUrl) {
      this._connectWebSocket(config.backendUrl);
    }
  }

  // ── Registration ──────────────────────────────────────────────────────────

  /**
   * Register this agent in the protocol. Pays the ENTRY_FEE (10 AGT)
   * and receives 1000 AGT welcome tokens.
   */
  async register(params: RegisterParams): Promise<string> {
    const entryFee = ethers.parseEther("10");
    const registryAddr = await this.registry.getAddress();

    // Approve entry fee
    await (await this.token.approve(registryAddr, entryFee)).wait();

    const tx = await this.registry.registerAgent(
      params.name,
      params.capabilities,
      params.metadataURI || ""
    );
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async isRegistered(address?: string): Promise<boolean> {
    return this.registry.isRegistered(address || this.address);
  }

  async updateCapabilities(capabilities: string[]): Promise<string> {
    const tx = await this.registry.updateCapabilities(capabilities);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  // ── Token ─────────────────────────────────────────────────────────────────

  /** Get AGT balance for this agent (or any address). */
  async getBalance(address?: string): Promise<string> {
    const bal = await this.token.balanceOf(address || this.address);
    return ethers.formatEther(bal);
  }

  // ── Reputation ────────────────────────────────────────────────────────────

  async getReputation(address?: string) {
    const addr = address || this.address;
    const [score, totalDeals, successfulDeals, totalValueTransacted, lastUpdated] =
      await this.reputation.getReputation(addr);
    return {
      score: score.toString(),
      totalDeals: totalDeals.toString(),
      successfulDeals: successfulDeals.toString(),
      totalValueTransacted: ethers.formatEther(totalValueTransacted),
      lastUpdated: Number(lastUpdated),
    };
  }

  // ── Marketplace ───────────────────────────────────────────────────────────

  async publishNeed(params: PublishNeedParams): Promise<number> {
    const tx = await this.marketplace.publishNeed(
      params.description,
      ethers.parseEther(params.budget),
      params.deadline,
      params.tags
    );
    const receipt = await tx.wait();
    // Extract needId from event
    const event = receipt.logs.find((log: any) => {
      try {
        const parsed = this.marketplace.interface.parseLog(log);
        return parsed?.name === "NeedPublished";
      } catch { return false; }
    });
    if (event) {
      const parsed = this.marketplace.interface.parseLog(event);
      return Number(parsed!.args.needId);
    }
    return -1;
  }

  async publishOffer(params: PublishOfferParams): Promise<number> {
    const tx = await this.marketplace.publishOffer(
      params.description,
      ethers.parseEther(params.price),
      params.tags
    );
    const receipt = await tx.wait();
    const event = receipt.logs.find((log: any) => {
      try {
        const parsed = this.marketplace.interface.parseLog(log);
        return parsed?.name === "OfferPublished";
      } catch { return false; }
    });
    if (event) {
      const parsed = this.marketplace.interface.parseLog(event);
      return Number(parsed!.args.offerId);
    }
    return -1;
  }

  async cancelNeed(needId: number): Promise<string> {
    const tx = await this.marketplace.cancelNeed(needId);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async cancelOffer(offerId: number): Promise<string> {
    const tx = await this.marketplace.cancelOffer(offerId);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async getMatchingOffers(needId: number): Promise<number[]> {
    const ids = await this.marketplace.getMatchingOffers(needId);
    return ids.map(Number);
  }

  async getNeed(needId: number): Promise<NeedInfo> {
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

  async getOffer(offerId: number): Promise<OfferInfo> {
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

  // ── Negotiation ───────────────────────────────────────────────────────────

  async propose(params: ProposeParams): Promise<number> {
    const tx = await this.engine.propose(
      params.needId,
      params.offerId,
      ethers.parseEther(params.price),
      params.terms
    );
    const receipt = await tx.wait();
    const event = receipt.logs.find((log: any) => {
      try {
        const parsed = this.engine.interface.parseLog(log);
        return parsed?.name === "ProposalCreated";
      } catch { return false; }
    });
    if (event) {
      const parsed = this.engine.interface.parseLog(event);
      return Number(parsed!.args.proposalId);
    }
    return -1;
  }

  async counterOffer(params: CounterOfferParams): Promise<number> {
    const tx = await this.engine.counterOffer(
      params.proposalId,
      ethers.parseEther(params.newPrice),
      params.newTerms
    );
    const receipt = await tx.wait();
    const event = receipt.logs.find((log: any) => {
      try {
        const parsed = this.engine.interface.parseLog(log);
        return parsed?.name === "CounterOffered";
      } catch { return false; }
    });
    if (event) {
      const parsed = this.engine.interface.parseLog(event);
      return Number(parsed!.args.newProposalId);
    }
    return -1;
  }

  async acceptProposal(proposalId: number): Promise<string> {
    const tx = await this.engine.acceptProposal(proposalId);
    const receipt = await tx.wait();
    // Return the agreement contract address
    return await this.engine.proposalAgreement(proposalId);
  }

  async rejectProposal(proposalId: number): Promise<string> {
    const tx = await this.engine.rejectProposal(proposalId);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  // ── Agreements ────────────────────────────────────────────────────────────

  async fundAgreement(agreementAddress: string): Promise<string> {
    const agreement = new ethers.Contract(agreementAddress, AGREEMENT_ABI, this.signer);
    const paymentAmount = await agreement.paymentAmount();

    // Approve token transfer to agreement
    await (await this.token.approve(agreementAddress, paymentAmount)).wait();
    const tx = await agreement.fund();
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async confirmDelivery(agreementAddress: string): Promise<string> {
    const agreement = new ethers.Contract(agreementAddress, AGREEMENT_ABI, this.signer);
    const tx = await agreement.confirmDelivery();
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async raiseDispute(agreementAddress: string): Promise<string> {
    const agreement = new ethers.Contract(agreementAddress, AGREEMENT_ABI, this.signer);
    const tx = await agreement.raiseDispute();
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async claimTimeout(agreementAddress: string): Promise<string> {
    const agreement = new ethers.Contract(agreementAddress, AGREEMENT_ABI, this.signer);
    const tx = await agreement.claimTimeout();
    const receipt = await tx.wait();
    return receipt.hash;
  }

  // ── Events ────────────────────────────────────────────────────────────────

  on(event: ProtocolEvent | string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  off(event: ProtocolEvent | string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event) || [];
    this.eventHandlers.set(event, handlers.filter((h) => h !== handler));
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private _findDeployment(network: Network): string {
    // Walk up directories to find deployments folder
    const candidates = [
      path.join(__dirname, "../../deployments", `${network}.json`),
      path.join(__dirname, "../../../deployments", `${network}.json`),
      path.join(process.cwd(), "deployments", `${network}.json`),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    throw new Error(
      `Deployment not found for '${network}'. Run: npx hardhat run scripts/deploy/00_all.ts --network ${network}`
    );
  }

  private _connectWebSocket(backendUrl: string): void {
    const wsUrl = backendUrl.replace(/^http/, "ws") + "/ws";
    try {
      this.wsClient = new WebSocket(wsUrl);
      this.wsClient.on("message", (raw: Buffer) => {
        const msg = JSON.parse(raw.toString());
        const handlers = this.eventHandlers.get(msg.type) || [];
        handlers.forEach((h) => h(msg.data));
        // Also fire wildcard handlers
        const wildcard = this.eventHandlers.get("*") || [];
        wildcard.forEach((h) => h({ type: msg.type, ...msg.data }));
      });
      this.wsClient.on("error", () => { /* silent — optional connection */ });
    } catch {
      // WebSocket is optional
    }
  }

  disconnect(): void {
    this.wsClient?.close();
  }
}
