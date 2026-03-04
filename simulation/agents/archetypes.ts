import { ethers } from "ethers";
import { BaseAgent, AgentConfig } from "./BaseAgent";

// ── DataProcessorAgent ────────────────────────────────────────────────────────

/**
 * Specializes in data processing. Publishes offers and actively seeks
 * raw data needs from other agents. Prices based on data volume.
 */
export class DataProcessorAgent extends BaseAgent {
  private offerPrice = 80; // Starting price in AGT

  constructor(config: AgentConfig) {
    super(config);
  }

  async cycle(cycleNum: number): Promise<void> {
    await this.updateBalance();

    if (cycleNum === 1) {
      // Publish processing offer
      await this.publishOffer(
        "High-performance data analysis and processing pipeline. Supports CSV, JSON, Parquet formats.",
        this.offerPrice.toString(),
        ["data", "analysis", "processing"]
      );

      // Also express a need for raw datasets
      await this.publishNeed(
        "Need raw sensor data or financial datasets for training optimization models.",
        "50",
        ["data", "raw", "sensor"]
      );
    }

    if (cycleNum === 2) {
      const totalProposals = await this.contracts.engine.totalProposals();
      for (let i = 0; i < Number(totalProposals); i++) {
        const proposal = await this.contracts.engine.getProposal(i);
        const price = Number(ethers.formatEther(proposal.price));
        const status = Number(proposal.status);
        if (status !== 0) continue; // skip non-pending

        if (proposal.buyer === this.address) {
          // We're the buyer — accept if within budget
          if (price <= 50) {
            const agreementAddr = await this.acceptProposal(i);
            await this.fundAndConfirm(agreementAddr, ethers.formatEther(proposal.price));
          } else {
            await this.counterOffer(i, "45", "Reduced price for bulk data");
          }
        } else if (proposal.seller === this.address) {
          // We're the seller — accept if price meets our floor
          if (price >= 60) {
            await this.acceptProposal(i);
            this.log(`✅ Accepted offer as seller @ ${price} AGT`);
          } else {
            await this.counterOffer(i, this.offerPrice.toString(), "Data processing standard rate");
          }
        }
      }
    }

    if (cycleNum === 3) {
      // Accept any pending seller proposals that arrived this cycle
      const totalProposals = await this.contracts.engine.totalProposals();
      for (let i = 0; i < Number(totalProposals); i++) {
        const proposal = await this.contracts.engine.getProposal(i);
        if (proposal.seller === this.address && Number(proposal.status) === 0) {
          const price = Number(ethers.formatEther(proposal.price));
          if (price >= 60) {
            await this.acceptProposal(i);
            this.log(`✅ Accepted as seller @ ${price} AGT`);
          } else {
            await this.counterOffer(i, this.offerPrice.toString(), "Standard data rate");
          }
        }
      }

      // Adjust price based on competition
      const totalOffers = await this.contracts.marketplace.totalOffers();
      const competitorOffers = [];
      for (let i = 0; i < Number(totalOffers); i++) {
        const offer = await this.contracts.marketplace.getOffer(i);
        if (offer.active && offer.publisher !== this.address) {
          const hasDatatag = offer.tags.some(
            (t: string) => t === "data" || t === "analysis"
          );
          if (hasDatatag) competitorOffers.push(Number(ethers.formatEther(offer.price)));
        }
      }

      if (competitorOffers.length > 0) {
        const avgCompetitor = competitorOffers.reduce((a, b) => a + b, 0) / competitorOffers.length;
        this.offerPrice = Math.max(30, Math.floor(avgCompetitor * 0.9));
        this.log(`📊 Market avg competitor price: ${avgCompetitor.toFixed(1)} AGT. Adjusting to ${this.offerPrice} AGT`);
      }
    }

    await this.updateReputation();
    this.log(`💼 Balance: ${parseFloat(this.state.balance).toFixed(1)} AGT | Reputation: ${this.state.reputationScore}`);
  }
}

// ── ContentAgent ───────────────────────────────────────────────────────────────

/**
 * Generates content and creative outputs. High-value service with
 * premium pricing. Negotiates hard on price.
 */
export class ContentAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super(config);
  }

  async cycle(cycleNum: number): Promise<void> {
    await this.updateBalance();

    if (cycleNum === 1) {
      await this.publishOffer(
        "AI content generation: blog posts, summaries, technical docs, marketing copy. Fast turnaround.",
        "120",
        ["content", "writing", "creative"]
      );

      await this.publishNeed(
        "Need structured prompts or content briefs to generate specialized content.",
        "30",
        ["prompts", "briefs", "content"]
      );
    }

    if (cycleNum === 2) {
      // Look for any proposals from buyers for our content offer
      const totalProposals = await this.contracts.engine.totalProposals();
      for (let i = 0; i < Number(totalProposals); i++) {
        const proposal = await this.contracts.engine.getProposal(i);
        if (
          proposal.seller === this.address &&
          Number(proposal.status) === 0
        ) {
          const price = Number(ethers.formatEther(proposal.price));
          if (price >= 90) {
            // Accept — good enough price
            const agreementAddr = await this.acceptProposal(i);
          } else {
            // Counter at minimum 100 AGT
            await this.counterOffer(i, "100", "Content quality guarantee — minimum 100 AGT");
          }
        }
      }
    }

    if (cycleNum === 3) {
      // Publish a premium offer at higher price after reputation builds
      if (this.state.reputationScore > 0) {
        await this.publishOffer(
          "PREMIUM content: Long-form reports, whitepapers, research synthesis. Reputation-backed quality.",
          "200",
          ["content", "premium", "research"]
        );
        this.log(`🌟 Published premium offer at 200 AGT (reputation: ${this.state.reputationScore})`);
      }
    }

    await this.updateReputation();
    this.log(`💼 Balance: ${parseFloat(this.state.balance).toFixed(1)} AGT | Deals: ${this.state.totalDeals}`);
  }
}

// ── ResearchAgent ──────────────────────────────────────────────────────────────

/**
 * Specializes in research and information retrieval. Aggressive buyer —
 * always seeking information, sells research reports at moderate prices.
 */
export class ResearchAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super(config);
  }

  async cycle(cycleNum: number): Promise<void> {
    await this.updateBalance();

    if (cycleNum === 1) {
      // Research agent is hungry for information
      await this.publishNeed(
        "Need processed data analysis on market trends. Willing to pay competitive rates.",
        "90",
        ["data", "analysis", "market"]
      );
      await this.publishNeed(
        "Need content synthesis on AI economics and agent behavior.",
        "40",
        ["content", "ai", "research"]
      );

      // Also sells research outputs
      await this.publishOffer(
        "Structured research reports: literature review, fact extraction, competitor analysis.",
        "70",
        ["research", "analysis", "reports"]
      );
    }

    if (cycleNum === 2) {
      // Actively seek matching offers for our needs
      const totalNeeds = Number(this.state.publishedNeeds.length);
      for (const needId of this.state.publishedNeeds) {
        const matchingIds = await this.contracts.marketplace.getMatchingOffers(needId);
        for (const offerId of matchingIds) {
          const offer = await this.contracts.marketplace.getOffer(offerId);
          if (!offer.active) continue;
          const price = ethers.formatEther(offer.price);
          const need = await this.contracts.marketplace.getNeed(needId);
          const budget = ethers.formatEther(need.budget);

          if (Number(price) <= Number(budget)) {
            // Propose at offer price
            try {
              await this.propose(needId, Number(offerId), price, "Research collaboration — standard terms");
            } catch (e: any) {
              if (!e.message?.includes("need not active")) {
                this.log(`⚠️  Proposal failed: ${e.message?.slice(0, 60)}`);
              }
            }
          }
        }
      }
    }

    if (cycleNum === 3) {
      const totalProposals = await this.contracts.engine.totalProposals();
      for (let i = 0; i < Number(totalProposals); i++) {
        const proposal = await this.contracts.engine.getProposal(i);
        const status = Number(proposal.status);

        if (proposal.seller === this.address && status === 0) {
          // Accept any remaining pending proposals on our offers
          await this.acceptProposal(i);
        } else if (proposal.buyer === this.address && status === 1) {
          // We're the buyer and proposal was accepted — fund & confirm!
          const agreementAddr = await this.contracts.engine.proposalAgreement(i);
          if (agreementAddr && agreementAddr !== "0x0000000000000000000000000000000000000000") {
            try {
              await this.fundAndConfirm(agreementAddr, ethers.formatEther(proposal.price));
            } catch (e: any) {
              if (!e.message?.includes("already")) this.log(`⚠️  Funding error: ${e.message?.slice(0, 60)}`);
            }
          }
        }
      }
    }

    await this.updateReputation();
    this.log(`💼 Balance: ${parseFloat(this.state.balance).toFixed(1)} AGT | Active proposals: ${this.state.activeProposals.length}`);
  }
}

// ── OrchestratorAgent ──────────────────────────────────────────────────────────

/**
 * Decomposes complex tasks and coordinates between agents. Acts as a
 * marketplace aggregator — buys cheap, packages, resells at higher value.
 */
export class OrchestratorAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super(config);
  }

  async cycle(cycleNum: number): Promise<void> {
    await this.updateBalance();

    if (cycleNum === 1) {
      // Sell orchestration as a service
      await this.publishOffer(
        "End-to-end task orchestration: I decompose complex tasks, coordinate multiple agents, deliver integrated results.",
        "150",
        ["orchestration", "coordination", "multi-agent"]
      );

      // Need specialized sub-services to fulfill tasks
      await this.publishNeed(
        "Need data processing sub-service for orchestrated pipeline execution.",
        "70",
        ["data", "processing", "pipeline"]
      );
    }

    if (cycleNum === 2) {
      // Buy cheap processing and bundle it
      for (const needId of this.state.publishedNeeds) {
        const matchingIds = await this.contracts.marketplace.getMatchingOffers(needId);
        for (const offerId of matchingIds) {
          const offer = await this.contracts.marketplace.getOffer(offerId);
          if (!offer.active) continue;
          const price = Number(ethers.formatEther(offer.price));
          if (price < 70) {
            try {
              await this.propose(needId, Number(offerId), ethers.formatEther(offer.price), "Orchestrator pipeline — bulk purchase");
              break;
            } catch {}
          }
        }
      }
    }

    if (cycleNum === 3) {
      // Respond to proposals on our orchestration offer
      const totalProposals = await this.contracts.engine.totalProposals();
      for (let i = 0; i < Number(totalProposals); i++) {
        const proposal = await this.contracts.engine.getProposal(i);
        if (
          proposal.seller === this.address &&
          Number(proposal.status) === 0
        ) {
          const price = Number(ethers.formatEther(proposal.price));
          if (price >= 130) {
            await this.acceptProposal(i);
          } else {
            await this.counterOffer(i, "140", "Orchestration overhead included");
          }
        }
      }
    }

    await this.updateReputation();
    this.log(`💼 Balance: ${parseFloat(this.state.balance).toFixed(1)} AGT | Completed: ${this.state.completedDeals}`);
  }
}

// ── ArbitrageAgent ─────────────────────────────────────────────────────────────

/**
 * Pure market efficiency agent. Scans for price discrepancies,
 * buys underpriced offers, resells at market rate. Creates liquidity.
 */
export class ArbitrageAgent extends BaseAgent {
  private knownPrices: Map<string, number[]> = new Map();

  constructor(config: AgentConfig) {
    super(config);
  }

  async cycle(cycleNum: number): Promise<void> {
    await this.updateBalance();

    if (cycleNum === 1) {
      // Scan the entire market and catalog prices by tag
      const totalOffers = Number(await this.contracts.marketplace.totalOffers());
      for (let i = 0; i < totalOffers; i++) {
        const offer = await this.contracts.marketplace.getOffer(i);
        if (!offer.active) continue;
        const price = Number(ethers.formatEther(offer.price));
        for (const tag of offer.tags) {
          const prices = this.knownPrices.get(tag) || [];
          prices.push(price);
          this.knownPrices.set(tag, prices);
        }
      }

      this.log(`📊 Market scan complete. Categories: ${[...this.knownPrices.keys()].join(", ")}`);

      // Publish arbitrage offers at slight markup on categories with demand
      const totalNeeds = Number(await this.contracts.marketplace.totalNeeds());
      const needTags = new Map<string, number>();
      for (let i = 0; i < totalNeeds; i++) {
        const need = await this.contracts.marketplace.getNeed(i);
        if (!need.active) continue;
        for (const tag of need.tags) {
          needTags.set(tag, (needTags.get(tag) || 0) + 1);
        }
      }

      // Find tags with high demand but reasonable supply prices
      for (const [tag, count] of needTags.entries()) {
        const prices = this.knownPrices.get(tag) || [];
        if (prices.length > 0 && count >= 1) {
          const minPrice = Math.min(...prices);
          const arbitragePrice = Math.floor(minPrice * 1.15); // 15% markup
          this.log(`💡 Arbitrage opportunity: ${tag} (min: ${minPrice} → sell: ${arbitragePrice} AGT)`);

          await this.publishOffer(
            `Arbitrage service: ${tag} processing at competitive rates. Fast settlement.`,
            arbitragePrice.toString(),
            [tag, "fast", "arbitrage"]
          );
          break; // One offer per cycle
        }
      }
    }

    if (cycleNum === 2) {
      // Find needs we can fulfill profitably from existing cheaper offers
      const totalNeeds = Number(await this.contracts.marketplace.totalNeeds());
      for (let i = 0; i < totalNeeds; i++) {
        const need = await this.contracts.marketplace.getNeed(i);
        if (!need.active || need.publisher === this.address) continue;
        const budget = Number(ethers.formatEther(need.budget));

        // Check if we have an offer in our list that matches
        for (const offerId of this.state.publishedOffers) {
          const offer = await this.contracts.marketplace.getOffer(offerId);
          if (!offer.active) continue;
          const price = Number(ethers.formatEther(offer.price));
          if (price <= budget) {
            try {
              await this.propose(i, offerId, offer.price, "Arbitrage deal — instant settlement");
              break;
            } catch {}
          }
        }
      }
    }

    if (cycleNum === 3) {
      // Report market efficiency metrics
      const totalProposals = Number(await this.contracts.engine.totalProposals());
      let accepted = 0;
      let pending = 0;
      for (let i = 0; i < totalProposals; i++) {
        const proposal = await this.contracts.engine.getProposal(i);
        if (Number(proposal.status) === 1) accepted++;
        if (Number(proposal.status) === 0) pending++;
      }

      this.log(`📈 Market efficiency: ${accepted} accepted / ${totalProposals} total proposals. ${pending} pending.`);
    }

    await this.updateReputation();
    this.log(`💼 Balance: ${parseFloat(this.state.balance).toFixed(1)} AGT | Score: ${this.state.reputationScore}`);
  }
}
