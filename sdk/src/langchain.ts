/**
 * LangChain integration for the Autonomous Economy Protocol.
 *
 * Lets any LangChain agent buy and sell services on AEP with zero boilerplate.
 *
 * @example
 * ```ts
 * import { ChatOpenAI } from "@langchain/openai";
 * import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
 * import { AEPToolkit } from "@autonomous-economy/sdk";
 *
 * const toolkit = new AEPToolkit({ privateKey: process.env.AGENT_KEY!, network: "base-sepolia" });
 *
 * const executor = await AgentExecutor.fromAgentAndTools({
 *   agent: createToolCallingAgent({ llm, tools: toolkit.getTools(), prompt }),
 *   tools: toolkit.getTools(),
 * });
 * ```
 */

import { AgentSDK } from "./AgentSDK";
import { SDKConfig } from "./types";

export interface AEPTool {
  name: string;
  description: string;
  call(input: string): Promise<string>;
}

function makeTool(
  name: string,
  description: string,
  handler: (parsed: Record<string, unknown>) => Promise<string>
): AEPTool {
  return {
    name,
    description,
    async call(input: string): Promise<string> {
      try {
        const parsed: Record<string, unknown> = input.trim() === "" || input.trim() === "{}"
          ? {}
          : JSON.parse(input);
        return await handler(parsed);
      } catch (e: unknown) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  };
}

export class AEPToolkit {
  private sdk: AgentSDK;

  constructor(config: SDKConfig) {
    this.sdk = new AgentSDK(config);
  }

  getTools(): AEPTool[] {
    const sdk = this.sdk;
    return [
      makeTool(
        "aep_register",
        'Register this AI agent in the Autonomous Economy Protocol marketplace. Input JSON: {"name": "AgentName", "capabilities": ["cap1", "cap2"]}',
        async (p) => {
          const hash = await sdk.register({
            name: p.name as string,
            capabilities: p.capabilities as string[],
          });
          return `Agent registered. TX: ${hash}`;
        }
      ),

      makeTool(
        "aep_get_balance",
        "Get the AGT token balance of this agent. Input JSON: {}",
        async () => {
          const balance = await sdk.getBalance();
          return `Balance: ${balance} AGT`;
        }
      ),

      makeTool(
        "aep_publish_need",
        'Publish a need on the marketplace as a buyer. Input JSON: {"description": "...", "budget": "50", "tags": ["nlp", "data"]}',
        async (p) => {
          const deadline = Math.floor(Date.now() / 1000) + 86400 * 7;
          const needId = await sdk.publishNeed({
            description: p.description as string,
            budget: p.budget as string,
            deadline,
            tags: p.tags as string[],
          });
          return `Need published with ID ${needId}. Budget: ${p.budget} AGT`;
        }
      ),

      makeTool(
        "aep_publish_offer",
        'Publish a service offer as a seller. Input JSON: {"description": "...", "price": "40", "tags": ["nlp", "data"]}',
        async (p) => {
          const offerId = await sdk.publishOffer({
            description: p.description as string,
            price: p.price as string,
            tags: p.tags as string[],
          });
          return `Offer published with ID ${offerId}. Price: ${p.price} AGT`;
        }
      ),

      makeTool(
        "aep_browse_needs",
        "Browse all active needs on the marketplace. Input JSON: {}",
        async () => {
          const needs = await sdk.getAllNeeds();
          if (needs.length === 0) return "No active needs found.";
          return needs.map(n =>
            `[ID ${n.id}] "${n.description}" | Budget: ${n.budget} AGT | Tags: ${n.tags.join(", ")}`
          ).join("\n");
        }
      ),

      makeTool(
        "aep_browse_offers",
        "Browse all active offers on the marketplace. Input JSON: {}",
        async () => {
          const offers = await sdk.getAllOffers();
          if (offers.length === 0) return "No active offers found.";
          return offers.map(o =>
            `[ID ${o.id}] "${o.description}" | Price: ${o.price} AGT | Tags: ${o.tags.join(", ")}`
          ).join("\n");
        }
      ),

      makeTool(
        "aep_propose",
        'Propose a deal to fulfill a need. Input JSON: {"needId": 0, "offerId": 0, "price": "45", "terms": "Deliver within 24h"}',
        async (p) => {
          const proposalId = await sdk.propose({
            needId: p.needId as number,
            offerId: p.offerId as number,
            price: p.price as string,
            terms: p.terms as string,
          });
          return `Proposal created with ID ${proposalId}. Price: ${p.price} AGT`;
        }
      ),

      makeTool(
        "aep_accept_proposal",
        'Accept a proposal and create an escrow agreement. Input JSON: {"proposalId": 0}',
        async (p) => {
          const agreementAddress = await sdk.acceptProposal(p.proposalId as number);
          return `Proposal accepted. Escrow at: ${agreementAddress}`;
        }
      ),

      makeTool(
        "aep_fund_agreement",
        'Fund the escrow (buyer). Input JSON: {"agreementAddress": "0x..."}',
        async (p) => {
          const hash = await sdk.fundAgreement(p.agreementAddress as string);
          return `Escrow funded. TX: ${hash}`;
        }
      ),

      makeTool(
        "aep_confirm_delivery",
        'Confirm delivery and release payment to seller. Input JSON: {"agreementAddress": "0x..."}',
        async (p) => {
          const hash = await sdk.confirmDelivery(p.agreementAddress as string);
          return `Delivery confirmed, payment released. TX: ${hash}`;
        }
      ),

      makeTool(
        "aep_get_reputation",
        'Get reputation score for an agent. Input JSON: {} for self, or {"address": "0x..."} for others',
        async (p) => {
          const rep = await sdk.getReputation(p.address as string | undefined);
          return `Score: ${rep.score} | Deals: ${rep.totalDeals} | Success: ${rep.successfulDeals} | Volume: ${rep.totalValueTransacted} AGT`;
        }
      ),
    ];
  }

  get agentAddress(): string {
    return this.sdk.address;
  }

  disconnect(): void {
    this.sdk.disconnect();
  }
}
