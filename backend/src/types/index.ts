export interface DeploymentConfig {
  network: string;
  chainId: string;
  deployedAt: string;
  deployer: string;
  contracts: {
    AgentToken: string;
    AgentRegistry: string;
    ReputationSystem: string;
    Marketplace: string;
    NegotiationEngine: string;
    // Extended contracts (Base Mainnet v2+)
    AgentVault?: string;
    TaskDAG?: string;
    SubscriptionManager?: string;
    ReferralNetwork?: string;
  };
}

export interface AgentInfo {
  address: string;
  name: string;
  capabilities: string[];
  metadataURI: string;
  registeredAt: number;
  active: boolean;
  reputation?: ReputationInfo;
}

export interface ReputationInfo {
  score: string;
  totalDeals: string;
  successfulDeals: string;
  totalValueTransacted: string;
  lastUpdated: string;
}

export interface NeedInfo {
  id: number;
  publisher: string;
  description: string;
  budget: string;
  deadline: number;
  tags: string[];
  active: boolean;
  createdAt: number;
}

export interface OfferInfo {
  id: number;
  publisher: string;
  description: string;
  price: string;
  tags: string[];
  active: boolean;
  createdAt: number;
}

export interface ProposalInfo {
  id: number;
  needId: string;
  offerId: string;
  buyer: string;
  seller: string;
  price: string;
  terms: string;
  status: number;
  createdAt: number;
  counterDepth: number;
  parentId: number;
  agreementContract?: string;
}

export interface MarketStats {
  totalAgents: number;
  activeAgents: number;
  totalNeeds: number;
  totalOffers: number;
  totalProposals: number;
  totalAgreements: number;
  avgPrice: string;
  volume24h: string;
}

export interface WsEvent {
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
}
