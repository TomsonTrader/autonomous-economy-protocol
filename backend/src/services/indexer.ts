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

  // Backfill from blockchain on startup so events.db survives Railway redeploys
  async backfillFromChain(): Promise<void> {
    const recent = (this.db.prepare("SELECT COUNT(*) as cnt FROM events WHERE timestamp > ?").get(
      Math.floor(Date.now() / 1000) - 7200) as { cnt: number }).cnt;
    if (recent > 0) { console.log(`[Indexer] ${recent} recent events in DB — skipping backfill`); return; }

    console.log("[Indexer] Empty DB — backfilling from blockchain (last 4000 blocks)...");
    const provider = this.blockchain.provider;
    const currentBlock = await provider.getBlockNumber().catch(() => 0);
    if (!currentBlock) return;
    const fromBlock = Math.max(0, currentBlock - 4000);

    const insertIfNew = (type: string, data: object, txHash?: string, blockNumber?: number) => {
      if (txHash) {
        const exists = (this.db.prepare("SELECT 1 FROM events WHERE tx_hash = ? AND type = ?").get(txHash, type));
        if (exists) return;
      }
      this.db.prepare("INSERT INTO events (type, block_number, tx_hash, data) VALUES (?, ?, ?, ?)")
        .run(type, blockNumber ?? null, txHash ?? null, JSON.stringify(data));
    };

    const chunk = 1000;
    for (let start = fromBlock; start < currentBlock; start += chunk) {
      const end = Math.min(start + chunk - 1, currentBlock);
      try {
        const [regEvs, needEvs, offerEvs, propEvs, accEvs] = await Promise.all([
          this.blockchain.registry.queryFilter(this.blockchain.registry.filters.AgentRegistered?.() ?? {}, start, end).catch(() => []),
          this.blockchain.marketplace.queryFilter(this.blockchain.marketplace.filters.NeedPublished?.() ?? {}, start, end).catch(() => []),
          this.blockchain.marketplace.queryFilter(this.blockchain.marketplace.filters.OfferPublished?.() ?? {}, start, end).catch(() => []),
          this.blockchain.engine.queryFilter(this.blockchain.engine.filters.ProposalCreated?.() ?? {}, start, end).catch(() => []),
          this.blockchain.engine.queryFilter(this.blockchain.engine.filters.ProposalAccepted?.() ?? {}, start, end).catch(() => []),
        ]);
        for (const ev of regEvs  as any[]) insertIfNew("AgentRegistered",  { agent: ev.args[0], name: ev.args[1], capabilities: [...ev.args[2]] }, ev.transactionHash, ev.blockNumber);
        for (const ev of needEvs  as any[]) insertIfNew("NeedPublished",   { needId: ev.args[0].toString(), publisher: ev.args[1], budget: ev.args[2].toString(), tags: [...ev.args[3]] }, ev.transactionHash, ev.blockNumber);
        for (const ev of offerEvs as any[]) insertIfNew("OfferPublished",  { offerId: ev.args[0].toString(), publisher: ev.args[1], price: ev.args[2].toString(), tags: [...ev.args[3]] }, ev.transactionHash, ev.blockNumber);
        for (const ev of propEvs  as any[]) insertIfNew("ProposalCreated", { proposalId: ev.args[0].toString(), needId: ev.args[1].toString(), offerId: ev.args[2].toString(), buyer: ev.args[3], seller: ev.args[4], price: ev.args[5].toString() }, ev.transactionHash, ev.blockNumber);
        for (const ev of accEvs   as any[]) insertIfNew("ProposalAccepted",{ proposalId: ev.args[0].toString(), agreementContract: ev.args[1] }, ev.transactionHash, ev.blockNumber);
      } catch { /* skip chunk on error */ }
      await new Promise(r => setTimeout(r, 400));
    }
    const total = (this.db.prepare("SELECT COUNT(*) as cnt FROM events").get() as { cnt: number }).cnt;
    console.log(`[Indexer] Backfill complete — ${total} events in DB`);
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
