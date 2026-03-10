import { ethers }        from "ethers";
import { AgentSDK }      from "../../sdk/src/AgentSDK";
import { TaskPlanner }   from "./TaskPlanner";
import { AgentSelector } from "./AgentSelector";
import { SubTask, DealRecord, TaskRequest, WorkflowResult } from "./types";

const ORCHESTRATOR_CAPABILITIES = [
  "orchestration",
  "reasoning",
  "task-planning",
  "deal-management",
];

const RPC_URLS: Record<string, string> = {
  "base-mainnet": "https://mainnet.base.org",
  "base-sepolia": "https://sepolia.base.org",
  "hardhat":      "http://localhost:8545",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class OrchestratorAgent {
  private sdk:      AgentSDK;
  private planner:  TaskPlanner;
  private selector: AgentSelector;
  private log:      (msg: string) => void;

  constructor(
    privateKey: string,
    network: "base-mainnet" | "base-sepolia" | "hardhat" = "base-mainnet",
    logger?: (msg: string) => void
  ) {
    this.sdk      = new AgentSDK({ privateKey, network });
    this.planner  = new TaskPlanner();
    const provider = new ethers.JsonRpcProvider(RPC_URLS[network]);
    this.selector  = new AgentSelector(this.sdk, provider);
    this.log       = logger ?? ((msg) => console.log(`[Orchestrator] ${msg}`));
  }

  get address(): string { return this.sdk.address; }

  async initialize(): Promise<void> {
    const registered = await this.sdk.isRegistered();
    if (!registered) {
      this.log("Registering orchestrator on AEP...");
      await this.sdk.register({
        name:         "AEP-Orchestrator",
        capabilities: ORCHESTRATOR_CAPABILITIES,
        metadataURI:  "https://aepprotocol.xyz/orchestrator",
      });
      this.log(`Registered at ${this.sdk.address}`);
    } else {
      this.log(`Already registered at ${this.sdk.address}`);
    }
  }

  async run(request: TaskRequest): Promise<WorkflowResult> {
    const startMs = Date.now();

    this.log(`\n${"─".repeat(60)}`);
    this.log(`Task: "${request.description}"`);
    this.log(`Budget: ${request.maxBudget ?? "auto"} AGT`);
    this.log("─".repeat(60));

    const subtasks = this.planner.decompose(request.description, request.maxBudget);
    this.log(`\nPlan: ${subtasks.length} subtasks`);
    subtasks.forEach((t, i) =>
      this.log(`  ${i + 1}. [${t.requiredCapability}] ${t.description.substring(0, 70)}`)
    );

    const deals: DealRecord[] = [];
    let totalSpent = 0;

    for (const subtask of subtasks) {
      const result = await this._executeSubtask(subtask, deals);
      if (result) {
        deals.push(result);
        if (result.status !== "failed") totalSpent += parseFloat(subtask.budgetAGT);
      }
    }

    const durationMs = Date.now() - startMs;
    const succeeded  = deals.filter((d) => d.status !== "failed").length;
    const summary    = this._buildSummary(request.description, subtasks, deals, totalSpent);

    this.log(`\n${"═".repeat(60)}`);
    this.log(`Workflow complete: ${succeeded}/${subtasks.length} subtasks`);
    this.log(`Total used: ~${totalSpent} AGT | Duration: ${(durationMs / 1000).toFixed(1)}s`);
    this.log("═".repeat(60));

    return {
      success:         succeeded > 0,
      taskDescription: request.description,
      subtasks,
      deals,
      totalSpentAGT:   totalSpent.toString(),
      onChainTaskIds:  [],
      durationMs,
      summary,
    };
  }

  private async _executeSubtask(
    subtask: SubTask,
    completedDeals: DealRecord[]
  ): Promise<DealRecord | null> {
    this.log(`\n[${subtask.id}] Capability: ${subtask.requiredCapability}`);

    // Check dependencies
    const depsFailed = subtask.dependsOn.filter((dep) => {
      const d = completedDeals.find((x) => x.subtaskId === dep);
      return !d || d.status === "failed";
    });
    if (depsFailed.length > 0) {
      this.log(`  Skipping — dependencies failed: ${depsFailed.join(", ")}`);
      return { subtaskId: subtask.id, agentAddress: "", proposalId: -1, status: "failed" };
    }

    // Find best agent
    const usedAgents = completedDeals.map((d) => d.agentAddress).filter(Boolean);
    const candidate  = await this.selector.findBestAgent(subtask.requiredCapability, usedAgents);

    if (!candidate) {
      this.log(`  No agent found for: ${subtask.requiredCapability}`);
      return { subtaskId: subtask.id, agentAddress: "", proposalId: -1, status: "failed" };
    }

    this.log(`  Agent: ${candidate.name} (${candidate.address.slice(0, 8)}...) rep=${candidate.reputationScore}`);

    // Publish need
    try {
      const needId = await this.sdk.publishNeed({
        description: subtask.description,
        budget:      subtask.budgetAGT,
        deadline:    Math.floor(Date.now() / 1000) + 3600,
        tags:        [subtask.requiredCapability],
      });
      this.log(`  Need #${needId} published`);

      // Find matching offer from the selected agent
      const offer = await this.selector.findAgentOffer(candidate.address, subtask.requiredCapability);

      if (!offer) {
        this.log(`  Agent has no active offer — deal queued (waiting for agent response)`);
        return {
          subtaskId:    subtask.id,
          agentAddress: candidate.address,
          proposalId:   -1,
          status:       "pending",
        };
      }

      this.log(`  Offer #${offer.offerId} found at ${offer.price} AGT — proposing deal`);
      await sleep(2000); // RPC propagation

      const proposalId = await this.sdk.propose({
        needId,
        offerId: offer.offerId,
        price:   subtask.budgetAGT,
        terms:   `Orchestrator task: ${subtask.requiredCapability}`,
      });

      this.log(`  Proposal #${proposalId} created on-chain`);

      return {
        subtaskId:    subtask.id,
        agentAddress: candidate.address,
        proposalId,
        status:       "proposed",
      };
    } catch (e: any) {
      this.log(`  Error: ${e.message?.slice(0, 80)}`);
      return { subtaskId: subtask.id, agentAddress: candidate.address, proposalId: -1, status: "failed" };
    }
  }

  private _buildSummary(task: string, subtasks: SubTask[], deals: DealRecord[], spent: number): string {
    const lines = [
      `Task: "${task}"`,
      `Subtasks: ${subtasks.length} | Active deals: ${deals.filter((d) => d.proposalId >= 0).length}`,
      `Total budget committed: ~${spent} AGT`,
      "",
      "Subtask breakdown:",
      ...subtasks.map((t) => {
        const d      = deals.find((x) => x.subtaskId === t.id);
        const status = d?.status ?? "skipped";
        const agent  = d?.agentAddress ? `${d.agentAddress.slice(0, 8)}...` : "none";
        return `  [${status.toUpperCase().padEnd(8)}] ${t.id}: ${t.requiredCapability} → ${agent}`;
      }),
    ];
    return lines.join("\n");
  }
}
