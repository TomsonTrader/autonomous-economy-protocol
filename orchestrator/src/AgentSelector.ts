import { ethers } from "ethers";
import { AgentSDK } from "../../sdk/src/AgentSDK";
import { AgentCandidate } from "./types";

const REGISTRY_ABI = [
  "function getAgent(address) view returns (tuple(string name, string[] capabilities, string metadataURI, uint256 registeredAt, bool active))",
  "function isRegistered(address) view returns (bool)",
];

const REGISTRY_ADDRESS = "0x601125818d16cb78dD239Bce2c821a588B06d978"; // Base Mainnet

export class AgentSelector {
  private registry: ethers.Contract;

  constructor(private sdk: AgentSDK, private provider: ethers.Provider) {
    this.registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);
  }

  async findBestAgent(
    requiredCapability: string,
    exclude: string[] = []
  ): Promise<AgentCandidate | null> {
    const addresses = await this.sdk.getActiveAgents();
    const candidates: AgentCandidate[] = [];

    for (const addr of addresses) {
      if (exclude.includes(addr)) continue;
      try {
        const info = await this.registry.getAgent(addr);
        if (!info.active) continue;

        const caps = (info.capabilities as string[]).map((c) => c.toLowerCase());
        const matches =
          caps.includes(requiredCapability) ||
          caps.some((c) => c.includes(requiredCapability.split("-")[0]));
        if (!matches) continue;

        const rep = await this.sdk.getReputation(addr);
        candidates.push({
          address:         addr,
          name:            info.name as string,
          capabilities:    info.capabilities as string[],
          reputationScore: parseFloat(rep.score),
          totalDeals:      parseInt(rep.totalDeals),
        });
      } catch { /* skip */ }
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) =>
      b.reputationScore !== a.reputationScore
        ? b.reputationScore - a.reputationScore
        : b.totalDeals - a.totalDeals
    );
    return candidates[0];
  }

  async findAgentOffer(
    agentAddress: string,
    capability: string
  ): Promise<{ offerId: number; price: string } | null> {
    const offers = await this.sdk.getAllOffers();
    const matching = offers.filter(
      (o) =>
        o.publisher.toLowerCase() === agentAddress.toLowerCase() &&
        o.active &&
        (o.tags?.some((t: string) => t.toLowerCase().includes(capability.split("-")[0])) ||
          o.description.toLowerCase().includes(capability.split("-")[0]))
    );
    if (matching.length === 0) return null;
    return { offerId: matching[0].id, price: matching[0].price };
  }
}
