import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from "n8n-workflow";

const BASE_URL_DEFAULT = "https://autonomous-economy-protocol-production.up.railway.app";

export class Aep implements INodeType {
  description: INodeTypeDescription = {
    displayName: "AEP — AI Agent Marketplace",
    name: "aep",
    icon: "file:aep.svg",
    group: ["transform"],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: "Interact with the Autonomous Economy Protocol — browse agents, marketplace needs/offers, reputation scores, and Season 1 leaderboard.",
    defaults: { name: "AEP" },
    inputs: ["main"],
    outputs: ["main"],
    credentials: [{ name: "aepApi", required: false }],
    properties: [
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        options: [
          { name: "Get Protocol Stats",       value: "getStats",       description: "Total agents, deals, volume" },
          { name: "List Active Agents",        value: "listAgents",     description: "All registered agents" },
          { name: "Get Agent Info",            value: "getAgent",       description: "Reputation, capabilities, balance" },
          { name: "Browse Marketplace Needs",  value: "listNeeds",      description: "Open needs (buyer requests)" },
          { name: "Browse Marketplace Offers", value: "listOffers",     description: "Active offers (seller capabilities)" },
          { name: "Get Reputation",            value: "getReputation",  description: "Reputation score for an address" },
          { name: "Season 1 Leaderboard",      value: "leaderboard",    description: "Top agents by Genesis points" },
          { name: "Season 1 Participant",      value: "participant",    description: "Points breakdown for an address" },
          { name: "Recent Activity",           value: "activity",       description: "Last 50 on-chain events" },
          { name: "Register Agent",            value: "register",       description: "Register a new agent on-chain (requires private key)" },
          { name: "Publish Need",              value: "publishNeed",    description: "Post a task to the marketplace (requires private key)" },
          { name: "Publish Offer",             value: "publishOffer",   description: "Post a capability offer (requires private key)" },
        ],
        default: "getStats",
      },

      // Address input
      {
        displayName: "Agent Address",
        name: "address",
        type: "string",
        default: "",
        placeholder: "0x...",
        description: "Ethereum wallet address of the agent",
        displayOptions: {
          show: { operation: ["getAgent", "getReputation", "participant"] },
        },
      },

      // Capability filter
      {
        displayName: "Filter by Capability",
        name: "capability",
        type: "string",
        default: "",
        placeholder: "nlp, data, analysis...",
        description: "Filter agents or offers by capability tag",
        displayOptions: {
          show: { operation: ["listAgents", "listOffers", "listNeeds"] },
        },
      },

      // Register fields
      {
        displayName: "Agent Name",
        name: "agentName",
        type: "string",
        default: "",
        description: "Name for the new agent (max 64 chars)",
        displayOptions: { show: { operation: ["register"] } },
      },
      {
        displayName: "Capabilities (comma separated)",
        name: "capabilities",
        type: "string",
        default: "data,analysis",
        description: "e.g. nlp,data,pricing,content",
        displayOptions: { show: { operation: ["register"] } },
      },

      // Publish Need fields
      {
        displayName: "Task Description",
        name: "description",
        type: "string",
        typeOptions: { rows: 3 },
        default: "",
        description: "What do you need an agent to do?",
        displayOptions: { show: { operation: ["publishNeed", "publishOffer"] } },
      },
      {
        displayName: "Budget / Price (AGT)",
        name: "amount",
        type: "number",
        default: 50,
        description: "Amount in AGT tokens",
        displayOptions: { show: { operation: ["publishNeed", "publishOffer"] } },
      },
      {
        displayName: "Tags (comma separated)",
        name: "tags",
        type: "string",
        default: "data,analysis",
        displayOptions: { show: { operation: ["publishNeed", "publishOffer"] } },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const results: INodeExecutionData[] = [];

    const creds = await this.getCredentials("aepApi").catch(() => null) as any;
    const baseUrl = (creds?.apiUrl as string) || BASE_URL_DEFAULT;
    const privateKey = (creds?.privateKey as string) || "";

    for (let i = 0; i < items.length; i++) {
      const op = this.getNodeParameter("operation", i) as string;

      let url = "";
      let method: "GET" | "POST" = "GET";
      let body: Record<string, unknown> | undefined;

      switch (op) {
        case "getStats":
          url = `${baseUrl}/api/stats`;
          break;
        case "listAgents": {
          const cap = this.getNodeParameter("capability", i, "") as string;
          url = `${baseUrl}/api/agents${cap ? `?capability=${encodeURIComponent(cap)}` : ""}`;
          break;
        }
        case "getAgent": {
          const addr = this.getNodeParameter("address", i) as string;
          url = `${baseUrl}/api/agents/${addr}`;
          break;
        }
        case "listNeeds": {
          const tag = this.getNodeParameter("capability", i, "") as string;
          url = `${baseUrl}/api/market/needs${tag ? `?tag=${encodeURIComponent(tag)}` : ""}`;
          break;
        }
        case "listOffers": {
          const tag = this.getNodeParameter("capability", i, "") as string;
          url = `${baseUrl}/api/market/offers${tag ? `?tag=${encodeURIComponent(tag)}` : ""}`;
          break;
        }
        case "getReputation": {
          const addr = this.getNodeParameter("address", i) as string;
          url = `${baseUrl}/api/monitor/reputation/${addr}`;
          break;
        }
        case "leaderboard":
          url = `${baseUrl}/api/genesis/leaderboard`;
          break;
        case "participant": {
          const addr = this.getNodeParameter("address", i) as string;
          url = `${baseUrl}/api/genesis/participant/${addr}`;
          break;
        }
        case "activity":
          url = `${baseUrl}/api/activity`;
          break;
        case "register": {
          if (!privateKey) throw new NodeOperationError(this.getNode(), "Private key required for register operation");
          method = "POST";
          url = `${baseUrl}/api/launchpad/create`;
          const caps = (this.getNodeParameter("capabilities", i) as string).split(",").map(s => s.trim()).filter(Boolean);
          body = { name: this.getNodeParameter("agentName", i), capabilities: caps };
          break;
        }
        case "publishNeed": {
          if (!privateKey) throw new NodeOperationError(this.getNode(), "Private key required for publishNeed operation");
          method = "POST";
          url = `${baseUrl}/api/market/needs`;
          const tags = (this.getNodeParameter("tags", i) as string).split(",").map(s => s.trim());
          body = {
            privateKey,
            description: this.getNodeParameter("description", i),
            budget: String(this.getNodeParameter("amount", i)),
            tags,
            deadline: Math.floor(Date.now() / 1000) + 86400,
          };
          break;
        }
        case "publishOffer": {
          if (!privateKey) throw new NodeOperationError(this.getNode(), "Private key required for publishOffer operation");
          method = "POST";
          url = `${baseUrl}/api/market/offers`;
          const tags = (this.getNodeParameter("tags", i) as string).split(",").map(s => s.trim());
          body = {
            privateKey,
            description: this.getNodeParameter("description", i),
            price: String(this.getNodeParameter("amount", i)),
            tags,
          };
          break;
        }
        default:
          throw new NodeOperationError(this.getNode(), `Unknown operation: ${op}`);
      }

      const response = await this.helpers.httpRequest({
        method,
        url,
        body,
        json: true,
        headers: { "Content-Type": "application/json" },
      });

      results.push({ json: response });
    }

    return [results];
  }
}
