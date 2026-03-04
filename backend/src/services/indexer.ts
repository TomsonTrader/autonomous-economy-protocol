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
