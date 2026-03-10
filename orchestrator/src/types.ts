export interface TaskRequest {
  description: string;
  maxBudget?: string;     // total AGT budget for all subtasks
  timeoutMs?: number;     // ms to wait per deal step
}

export interface SubTask {
  id: string;
  description: string;
  requiredCapability: string;
  budgetAGT: string;
  dependsOn: string[];    // ids of subtasks that must complete first
}

export interface AgentCandidate {
  address: string;
  name: string;
  capabilities: string[];
  reputationScore: number;
  totalDeals: number;
  offerId?: number;
  offerPrice?: string;
}

export interface DealRecord {
  subtaskId: string;
  agentAddress: string;
  proposalId: number;
  agreementAddress?: string;
  status: "pending" | "proposed" | "funded" | "delivered" | "failed";
}

export interface WorkflowResult {
  success: boolean;
  taskDescription: string;
  subtasks: SubTask[];
  deals: DealRecord[];
  totalSpentAGT: string;
  onChainTaskIds: number[];
  durationMs: number;
  summary: string;
}
