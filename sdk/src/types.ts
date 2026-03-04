export type Network = "base-sepolia" | "base-mainnet" | "hardhat";

export interface SDKConfig {
  /** Agent's private key (signs transactions) */
  privateKey: string;
  /** Target network */
  network: Network;
  /** Backend API URL for read-heavy operations */
  backendUrl?: string;
  /** Optional: override RPC URL */
  rpcUrl?: string;
}

export interface RegisterParams {
  name: string;
  capabilities: string[];
  metadataURI?: string;
}

export interface PublishNeedParams {
  description: string;
  /** Budget in AGT (e.g. "100" for 100 AGT) */
  budget: string;
  /** Unix timestamp deadline */
  deadline: number;
  tags: string[];
}

export interface PublishOfferParams {
  description: string;
  /** Price in AGT (e.g. "80" for 80 AGT) */
  price: string;
  tags: string[];
}

export interface ProposeParams {
  needId: number;
  offerId: number;
  /** Price in AGT */
  price: string;
  terms: string;
}

export interface CounterOfferParams {
  proposalId: number;
  /** New price in AGT */
  newPrice: string;
  newTerms: string;
}

export interface AgentInfo {
  address: string;
  name: string;
  capabilities: string[];
  metadataURI: string;
  registeredAt: number;
  active: boolean;
  reputation: ReputationInfo;
  balance: string;
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

export type EventHandler = (data: Record<string, unknown>) => void;

export type ProtocolEvent =
  | "AgentRegistered"
  | "NeedPublished"
  | "OfferPublished"
  | "ProposalCreated"
  | "CounterOffered"
  | "ProposalAccepted"
  | "ProposalRejected"
  | "DeliveryConfirmed"
  | "DisputeRaised"
  | "PaymentReleased";
