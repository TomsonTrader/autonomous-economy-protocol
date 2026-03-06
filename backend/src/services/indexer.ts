import Database from "better-sqlite3";
import * as path from "path";
import { BlockchainService } from "./blockchain";
import { WebSocketService } from "./websocket";

export class EventIndexer {
  private db: Database.Database;
  private blockchain: BlockchainService;
  private ws: WebSocketService;

  constructor(blockchain: BlockchainService, ws: WebSocketService) {
    this.blockchain = blockchain;
    this.ws = ws;

    const dbPath = path.join(__dirname, "../../events.db");
    this.db = new Database(dbPath);
    this._initDb();
  }

  private _initDb() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        block_number INTEGER,
        tx_hash TEXT,
        data TEXT NOT NULL,
        timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
    `);
  }

  private saveEvent(type: string, data: Record<string, unknown>, txHash?: string, blockNumber?: number) {
    const stmt = this.db.prepare(
      "INSERT INTO events (type, block_number, tx_hash, data) VALUES (?, ?, ?, ?)"
    );
    stmt.run(type, blockNumber ?? null, txHash ?? null, JSON.stringify(data));
    this.ws.broadcastEvent(type, data);
  }

  async startListening() {
    const { registry, marketplace, engine } = this.blockchain;

    console.log("[Indexer] Starting event listeners...");

    registry.on("AgentRegistered", (agent: string, name: string, capabilities: string[], event: { log: { transactionHash: string; blockNumber: number } }) => {
      console.log(`[Event] AgentRegistered: ${name} (${agent})`);
      this.saveEvent("AgentRegistered", { agent, name, capabilities }, event.log.transactionHash, event.log.blockNumber);
    });

    marketplace.on("NeedPublished", (needId: bigint, publisher: string, budget: bigint, tags: string[], event: { log: { transactionHash: string; blockNumber: number } }) => {
      console.log(`[Event] NeedPublished: #${needId} by ${publisher}`);
      this.saveEvent("NeedPublished", {
        needId: needId.toString(),
        publisher,
        budget: budget.toString(),
        tags,
      }, event.log.transactionHash, event.log.blockNumber);
    });

    marketplace.on("OfferPublished", (offerId: bigint, publisher: string, price: bigint, tags: string[], event: { log: { transactionHash: string; blockNumber: number } }) => {
      console.log(`[Event] OfferPublished: #${offerId} by ${publisher}`);
      this.saveEvent("OfferPublished", {
        offerId: offerId.toString(),
        publisher,
        price: price.toString(),
        tags,
      }, event.log.transactionHash, event.log.blockNumber);
    });

    engine.on("ProposalCreated", (proposalId: bigint, needId: bigint, offerId: bigint, buyer: string, seller: string, price: bigint, event: { log: { transactionHash: string; blockNumber: number } }) => {
      console.log(`[Event] ProposalCreated: #${proposalId} ${buyer} → ${seller}`);
      this.saveEvent("ProposalCreated", {
        proposalId: proposalId.toString(),
        needId: needId.toString(),
        offerId: offerId.toString(),
        buyer,
        seller,
        price: price.toString(),
      }, event.log.transactionHash, event.log.blockNumber);
    });

    engine.on("ProposalAccepted", (proposalId: bigint, agreementContract: string, event: { log: { transactionHash: string; blockNumber: number } }) => {
      console.log(`[Event] ProposalAccepted: #${proposalId} → ${agreementContract}`);
      this.saveEvent("ProposalAccepted", {
        proposalId: proposalId.toString(),
        agreementContract,
      }, event.log.transactionHash, event.log.blockNumber);
    });

    engine.on("CounterOffered", (newProposalId: bigint, parentProposalId: bigint, newPrice: bigint, event: { log: { transactionHash: string; blockNumber: number } }) => {
      this.saveEvent("CounterOffered", {
        newProposalId: newProposalId.toString(),
        parentProposalId: parentProposalId.toString(),
        newPrice: newPrice.toString(),
      }, event.log.transactionHash, event.log.blockNumber);
    });

    const { vault, referral, taskDAG, subscription } = this.blockchain;

    // ── AgentVault events ──────────────────────────────────────────────────
    if (vault) {
      vault.on("Staked", (agent: string, amount: bigint, tier: number, event: any) => {
        this.saveEvent("Staked", { agent, amount: amount.toString(), tier }, event.log.transactionHash, event.log.blockNumber);
      });
      vault.on("Unstaked", (agent: string, amount: bigint, event: any) => {
        this.saveEvent("Unstaked", { agent, amount: amount.toString() }, event.log.transactionHash, event.log.blockNumber);
      });
      vault.on("YieldClaimed", (agent: string, amount: bigint, event: any) => {
        this.saveEvent("YieldClaimed", { agent, amount: amount.toString() }, event.log.transactionHash, event.log.blockNumber);
      });
      vault.on("Borrowed", (agent: string, amount: bigint, event: any) => {
        this.saveEvent("Borrowed", { agent, amount: amount.toString() }, event.log.transactionHash, event.log.blockNumber);
      });
    }

    // ── ReferralNetwork events ─────────────────────────────────────────────
    if (referral) {
      referral.on("ReferralRegistered", (agent: string, referrerAddr: string, event: any) => {
        this.saveEvent("ReferralRegistered", { agent, referrer: referrerAddr }, event.log.transactionHash, event.log.blockNumber);
      });
      referral.on("CommissionEarned", (earner: string, source: string, amount: bigint, level: number, event: any) => {
        this.saveEvent("CommissionEarned", { earner, source, amount: amount.toString(), level }, event.log.transactionHash, event.log.blockNumber);
      });
    }

    // ── TaskDAG events ─────────────────────────────────────────────────────
    if (taskDAG) {
      taskDAG.on("TaskCreated", (taskId: bigint, orchestrator: string, budget: bigint, parentId: bigint, event: any) => {
        this.saveEvent("TaskCreated", { taskId: taskId.toString(), orchestrator, budget: budget.toString(), parentId: parentId.toString() }, event.log.transactionHash, event.log.blockNumber);
      });
      taskDAG.on("TaskCompleted", (taskId: bigint, assignee: string, payment: bigint, event: any) => {
        this.saveEvent("TaskCompleted", { taskId: taskId.toString(), assignee, payment: payment.toString() }, event.log.transactionHash, event.log.blockNumber);
      });
      taskDAG.on("SubtaskSpawned", (parentId: bigint, subtaskId: bigint, assignee: string, budget: bigint, event: any) => {
        this.saveEvent("SubtaskSpawned", { parentId: parentId.toString(), subtaskId: subtaskId.toString(), assignee, budget: budget.toString() }, event.log.transactionHash, event.log.blockNumber);
      });
    }

    // ── SubscriptionManager events ─────────────────────────────────────────
    if (subscription) {
      subscription.on("SubscriptionCreated", (subId: bigint, subscriber: string, provider: string, pricePerPeriod: bigint, periodDuration: bigint, totalPeriods: bigint, event: any) => {
        this.saveEvent("SubscriptionCreated", { subId: subId.toString(), subscriber, provider, pricePerPeriod: pricePerPeriod.toString(), periodDuration: periodDuration.toString(), totalPeriods: totalPeriods.toString() }, event.log.transactionHash, event.log.blockNumber);
      });
      subscription.on("PeriodClaimed", (subId: bigint, provider: string, amount: bigint, periodsRemaining: bigint, event: any) => {
        this.saveEvent("PeriodClaimed", { subId: subId.toString(), provider, amount: amount.toString(), periodsRemaining: periodsRemaining.toString() }, event.log.transactionHash, event.log.blockNumber);
      });
    }

    // Suppress "filter not found" polling noise common on remote RPCs
    for (const contract of [registry, marketplace, engine]) {
      (contract.provider as any)?.on?.("error", (err: any) => {
        const msg: string = err?.error?.message ?? err?.message ?? "";
        if (msg.includes("filter not found")) return;
        console.error("[Indexer] Provider error:", msg);
      });
    }

    console.log("[Indexer] Listening for on-chain events...");
  }

  getRecentEvents(limit = 50, type?: string) {
    const stmt = type
      ? this.db.prepare("SELECT * FROM events WHERE type = ? ORDER BY timestamp DESC LIMIT ?")
      : this.db.prepare("SELECT * FROM events ORDER BY timestamp DESC LIMIT ?");

    const rows = type ? stmt.all(type, limit) : stmt.all(limit);
    return rows.map((row: any) => ({
      ...row,
      data: JSON.parse(row.data),
    }));
  }

  getEventStats() {
    const counts = this.db
      .prepare("SELECT type, COUNT(*) as count FROM events GROUP BY type")
      .all() as Array<{ type: string; count: number }>;
    return Object.fromEntries(counts.map((r) => [r.type, r.count]));
  }
}
