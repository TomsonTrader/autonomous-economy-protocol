export type Network = "base-sepolia" | "base-mainnet" | "hardhat";

export interface ContractAddresses {
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
}

export interface SDKConfig {
  /** Agent's private key (signs transactions) */
  privateKey: string;
  /** Target network — uses bundled Base Sepolia/Mainnet addresses automatically */
  network: Network;
  /** Backend API URL for real-time events via WebSocket */
  backendUrl?: string;
  /** Optional: override RPC URL */
  rpcUrl?: string;
  /** Optional: override contract addresses (e.g. for custom deployments) */
  contracts?: ContractAddresses;
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
  | "PaymentReleased"
  | "Staked"
  | "UnstakeRequested"
  | "Unstaked"
  | "YieldClaimed"
  | "TaskCreated"
  | "TaskCompleted"
  | "SubscriptionCreated"
  | "ReferralRegistered"
  | "CommissionEarned";

// ── Extended contract types ───────────────────────────────────────────────────

export interface VaultInfo {
  staked: string;          // AGT staked
  tier: number;            // 0-3
  unstakePending: string;  // AGT awaiting cooldown
  borrowed: string;        // AGT borrowed against reputation
  creditLimit: string;     // max borrowable AGT
  pendingYield: string;    // unclaimed yield
}

export interface ReferralInfo {
  referrer: string;
  directReferrals: number;
  totalNetworkDeals: number;
  claimableEarnings: string; // AGT
  totalEarned: string;       // AGT lifetime
}

export interface TaskInfo {
  id: number;
  orchestrator: string;
  assignee: string;
  budget: string;          // AGT
  description: string;
  deadline: number;
  status: number;          // 0=Open, 1=InProgress, 2=Completed, 3=Cancelled
  parentId: number;
  subtaskIds: number[];
  requiredSubtasks: number;
  completedSubtasks: number;
}

export interface CreateTaskParams {
  description: string;
  tags: string[];
  budget: string;          // AGT
  deadline: number;
  requiredSubtasks?: number;
}

export interface SpawnSubtaskParams {
  parentId: number;
  assignee: string;
  description: string;
  tags: string[];
  budget: string;          // AGT
  deadline: number;
}

export interface SubscribeParams {
  provider: string;
  pricePerPeriod: string;  // AGT
  periodDuration: number;  // seconds
  totalPeriods: number;
  serviceDescription: string;
}
