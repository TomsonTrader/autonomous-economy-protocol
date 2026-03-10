/**
 * AEP Orchestrator — Demo
 *
 * Runs a complete multi-agent workflow on Base Mainnet (or Sepolia).
 * The orchestrator:
 *   1. Registers itself on AEP
 *   2. Decomposes a task into subtasks by capability
 *   3. Finds the best-reputation agent for each capability
 *   4. Publishes needs, matches offers, proposes deals
 *   5. Funds agreements on-chain
 *   6. Prints a full workflow report
 *
 * Usage:
 *   ORCHESTRATOR_KEY=0x... NETWORK=base-mainnet npx ts-node src/demo.ts
 */

import * as dotenv from "dotenv";
import { OrchestratorAgent } from "./OrchestratorAgent";

dotenv.config();

const DEMO_TASKS = [
  "Research the current state of AI agent frameworks, analyze adoption trends, and write a summary report",
  "Search for top DeFi protocols on Base, analyze their TVL data, and write a comparison article",
  "Find available code-execution agents, analyze their pricing, and build a cost comparison report",
];

async function main() {
  const privateKey = process.env.ORCHESTRATOR_KEY;
  const network    = (process.env.NETWORK ?? "base-mainnet") as "base-mainnet" | "base-sepolia";
  const taskInput  = process.argv[2] ?? DEMO_TASKS[0];

  if (!privateKey) {
    console.error("Missing ORCHESTRATOR_KEY env var");
    process.exit(1);
  }

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║         AEP Orchestrator — Multi-Agent Workflow          ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`Network: ${network}`);
  console.log(`Task:    "${taskInput}"\n`);

  const orchestrator = new OrchestratorAgent(privateKey, network, (msg) =>
    console.log(msg)
  );

  // Step 1: Initialize (register if needed)
  await orchestrator.initialize();
  console.log(`Address: ${orchestrator.address}\n`);

  // Step 2: Run the workflow
  const result = await orchestrator.run({
    description: taskInput,
    maxBudget:   "30",
    timeoutMs:   90_000,
  });

  // Step 3: Print final report
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║                    WORKFLOW REPORT                      ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(result.summary);
  console.log("\nJSON output:");
  console.log(
    JSON.stringify(
      {
        success:        result.success,
        totalSpentAGT:  result.totalSpentAGT,
        durationMs:     result.durationMs,
        dealsInitiated: result.deals.filter((d) => d.proposalId >= 0).length,
        deals: result.deals.map((d) => ({
          subtask:  d.subtaskId,
          agent:    d.agentAddress.slice(0, 10) + "...",
          status:   d.status,
          proposal: d.proposalId,
        })),
      },
      null,
      2
    )
  );

  process.exit(result.success ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
