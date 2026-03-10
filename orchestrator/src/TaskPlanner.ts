import { SubTask } from "./types";

/**
 * Decomposes a high-level task description into SubTasks with capability requirements.
 * Uses keyword matching — replace with LLM call for production use.
 */

const CAPABILITY_KEYWORDS: Record<string, string[]> = {
  "data-analysis":    ["analyze", "data", "statistics", "metrics", "report", "research", "study", "compare"],
  "content-writing":  ["write", "draft", "summarize", "article", "post", "text", "content", "description"],
  "code-execution":   ["code", "script", "program", "implement", "build", "develop", "function", "api"],
  "translation":      ["translate", "language", "spanish", "english", "french", "german", "localize"],
  "web-search":       ["search", "find", "lookup", "web", "internet", "browse", "url", "website"],
  "image-generation": ["image", "picture", "generate", "photo", "design", "visual", "logo", "icon"],
  "reasoning":        ["reason", "think", "solve", "problem", "logic", "decision", "plan", "strategy"],
  "monitoring":       ["monitor", "watch", "track", "alert", "check", "status", "uptime", "ping"],
};

const BUDGET_BY_CAPABILITY: Record<string, string> = {
  "data-analysis":    "5",
  "content-writing":  "3",
  "code-execution":   "8",
  "translation":      "2",
  "web-search":       "1",
  "image-generation": "6",
  "reasoning":        "4",
  "monitoring":       "2",
};

export class TaskPlanner {
  decompose(description: string, totalBudget = "30"): SubTask[] {
    const words = description.toLowerCase().split(/\s+/);
    const detected: string[] = [];

    for (const [cap, keywords] of Object.entries(CAPABILITY_KEYWORDS)) {
      if (keywords.some((k) => words.includes(k) || description.toLowerCase().includes(k))) {
        detected.push(cap);
      }
    }

    // Always include reasoning for orchestration
    if (!detected.includes("reasoning")) detected.unshift("reasoning");

    // Trim to fit budget
    const maxSubtasks = Math.min(detected.length, 4);
    const selected = detected.slice(0, maxSubtasks);

    return selected.map((cap, i) => ({
      id:                  `task-${i + 1}`,
      description:         this._describeSubtask(cap, description),
      requiredCapability:  cap,
      budgetAGT:           BUDGET_BY_CAPABILITY[cap] ?? "2",
      dependsOn:           i === 0 ? [] : [`task-${i}`],
    }));
  }

  private _describeSubtask(capability: string, original: string): string {
    const map: Record<string, string> = {
      "reasoning":        `Plan and structure approach for: ${original}`,
      "web-search":       `Search for relevant information: ${original}`,
      "data-analysis":    `Analyze data related to: ${original}`,
      "content-writing":  `Write output content for: ${original}`,
      "code-execution":   `Implement code solution for: ${original}`,
      "translation":      `Translate content for: ${original}`,
      "image-generation": `Generate visual assets for: ${original}`,
      "monitoring":       `Monitor and report on: ${original}`,
    };
    return map[capability] ?? `Execute ${capability} for: ${original}`;
  }
}
