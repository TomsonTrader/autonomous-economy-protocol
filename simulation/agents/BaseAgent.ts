import { ethers } from "ethers";

export interface AgentConfig {
  name: string;
  capabilities: string[];
  wallet: ethers.Wallet;
  provider: ethers.JsonRpcProvider;
  contracts: {
    token: ethers.Contract;
    registry: ethers.Contract;
    marketplace: ethers.Contract;
    engine: ethers.Contract;
    reputation: ethers.Contract;
  };
}

export interface EconomicState {
  balance: string;
  reputationScore: number;
  totalDeals: number;
  publishedNeeds: number[];
  publishedOffers: number[];
  activeProposals: number[];
  completedDeals: number;
}

/**
 * BaseAgent — abstract AI agent that participates in the Autonomous Economy.
 * Each archetype extends this class with its own strategy.
 */
export abstract class BaseAgent {
  readonly name: string;
  readonly address: string;
  readonly capabilities: string[];

  protected wallet: ethers.Wallet;
  protected contracts: AgentConfig["contracts"];
  protected state: EconomicState;

  protected log: (msg: string) => void;

  private _localNonce: number | undefined;

  constructor(config: AgentConfig) {
    this.name = config.name;
    this.address = config.wallet.address;
    this.capabilities = config.capabilities;
    this.wallet = config.wallet;
    this.contracts = config.contracts;
    this.state = {
      balance: "0",
      reputationScore: 0,
      totalDeals: 0,
      publishedNeeds: [],
      publishedOffers: [],
      activeProposals: [],
      completedDeals: 0,
    };
    this.log = (msg: string) =>
      console.log(`  [${this.name.padEnd(20)}] ${msg}`);
  }

  // Local nonce tracker — avoids ethers.js stale nonce queries with Hardhat automining
  private async nextNonce(): Promise<number> {
    if (this._localNonce === undefined) {
      const provider = this.wallet.provider as ethers.JsonRpcProvider;
      this._localNonce = await provider.getTransactionCount(this.address, "pending");
    }
    return this._localNonce++;
  }

  /**
   * Register the agent in the protocol.
   */
  async register(): Promise<void> {
    const registryAddr = await this.contracts.registry.getAddress();
    const entryFee = ethers.parseEther("10");

    await (await this.contracts.token.approve(registryAddr, entryFee, { nonce: await this.nextNonce() })).wait();
    await (
      await this.contracts.registry.registerAgent(
        this.name,
        this.capabilities,
        "",
        { nonce: await this.nextNonce() }
      )
    ).wait();

    this.log(`✅ Registered with capabilities: [${this.capabilities.join(", ")}]`);
    await this.updateBalance();
  }

  async updateBalance(): Promise<void> {
    const bal = await this.contracts.token.balanceOf(this.address);
    this.state.balance = ethers.formatEther(bal);
  }

  async updateReputation(): Promise<void> {
    const [score, totalDeals] = await this.contracts.reputation.getReputation(this.address);
    this.state.reputationScore = Number(score);
    this.state.totalDeals = Number(totalDeals);
  }

  getState(): EconomicState {
    return { ...this.state };
  }

  /**
   * Execute one economic cycle — each agent decides autonomously what to do.
   */
  abstract cycle(cycleNum: number): Promise<void>;

  // ── Helpers ───────────────────────────────────────────────────────────────

  protected async publishNeed(
    description: string,
    budget: string,
    tags: string[]
  ): Promise<number> {
    const id = Number(await this.contracts.marketplace.totalNeeds());
    const deadline = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
    await (await this.contracts.marketplace.publishNeed(
      description,
      ethers.parseEther(budget),
      deadline,
      tags,
      { nonce: await this.nextNonce() }
    )).wait();
    this.state.publishedNeeds.push(id);
    this.log(`📢 Need #${id}: "${description.slice(0, 50)}" (budget: ${budget} AGT)`);
    return id;
  }

  protected async publishOffer(
    description: string,
    price: string,
    tags: string[]
  ): Promise<number> {
    const id = Number(await this.contracts.marketplace.totalOffers());
    await (await this.contracts.marketplace.publishOffer(
      description,
      ethers.parseEther(price),
      tags,
      { nonce: await this.nextNonce() }
    )).wait();
    this.state.publishedOffers.push(id);
    this.log(`🏷️  Offer #${id}: "${description.slice(0, 50)}" (price: ${price} AGT)`);
    return id;
  }

  protected async propose(
    needId: number,
    offerId: number,
    price: string,
    terms: string
  ): Promise<number> {
    const id = Number(await this.contracts.engine.totalProposals());
    await (await this.contracts.engine.propose(
      needId,
      offerId,
      ethers.parseEther(price),
      terms,
      { nonce: await this.nextNonce() }
    )).wait();
    this.state.activeProposals.push(id);
    this.log(`🤝 Proposal #${id} → need #${needId} / offer #${offerId} @ ${price} AGT`);
    return id;
  }

  protected async acceptProposal(proposalId: number): Promise<string> {
    await (await this.contracts.engine.acceptProposal(proposalId, { nonce: await this.nextNonce() })).wait();
    const agreementAddr = await this.contracts.engine.proposalAgreement(proposalId);
    this.log(`✍️  Accepted proposal #${proposalId} → Agreement: ${agreementAddr}`);
    return agreementAddr;
  }

  protected async counterOffer(
    proposalId: number,
    newPrice: string,
    newTerms: string
  ): Promise<number> {
    const id = Number(await this.contracts.engine.totalProposals());
    await (await this.contracts.engine.counterOffer(
      proposalId,
      ethers.parseEther(newPrice),
      newTerms,
      { nonce: await this.nextNonce() }
    )).wait();
    this.log(`🔄 Counter-offer #${id}: ${newPrice} AGT`);
    return id;
  }

  protected async fundAndConfirm(
    agreementAddr: string,
    paymentAmount: string
  ): Promise<void> {
    await (
      await this.contracts.token.approve(
        agreementAddr,
        ethers.parseEther(paymentAmount),
        { nonce: await this.nextNonce() }
      )
    ).wait();

    const agreementABI = [
      "function fund()",
      "function confirmDelivery()",
      "function paymentAmount() view returns (uint256)",
    ];
    const agreement = new ethers.Contract(
      agreementAddr,
      agreementABI,
      this.wallet
    );
    await (await agreement.fund({ nonce: await this.nextNonce() })).wait();
    this.log(`💰 Funded agreement ${agreementAddr.slice(0, 10)}...`);

    await new Promise((r) => setTimeout(r, 500));

    await (await agreement.confirmDelivery({ nonce: await this.nextNonce() })).wait();
    this.log(`✅ Delivery confirmed! Payment released.`);
    this.state.completedDeals++;
    await this.updateBalance();
  }
}
