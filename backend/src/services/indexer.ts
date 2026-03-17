import Database from "better-sqlite3";
import * as path from "path";
import { BlockchainService } from "./blockchain";
import { WebSocketService } from "./websocket";

// DB path: use Railway Volume if configured (DB_PATH=/data/aep.db),
// otherwise fall back to project root so local dev still works.
function resolveDbPath(): string {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  return path.join(__dirname, "../../aep.db");
}

export class EventIndexer {
  private db: Database.Database;
  private blockchain: BlockchainService;
  private ws: WebSocketService;
  private _syncing = false;

  constructor(blockchain: BlockchainService, ws: WebSocketService) {
    this.blockchain = blockchain;
    this.ws = ws;
    this.db = new Database(resolveDbPath());
    this.db.pragma("journal_mode = WAL");   // safe concurrent reads
    this.db.pragma("synchronous = NORMAL"); // faster writes, still crash-safe
    this._initDb();
  }

  // ── Schema ─────────────────────────────────────────────────────────────────

  private _initDb() {
    this.db.exec(`
      -- Raw blockchain events log
      CREATE TABLE IF NOT EXISTS events (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        type         TEXT    NOT NULL,
        block_number INTEGER,
        tx_hash      TEXT,
        data         TEXT    NOT NULL,
        timestamp    INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );
      CREATE INDEX IF NOT EXISTS idx_events_type      ON events(type);
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);

      -- Full snapshots of blockchain state (survives redeploys)
      CREATE TABLE IF NOT EXISTS agents (
        address    TEXT PRIMARY KEY,
        data       TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS needs (
        id         INTEGER PRIMARY KEY,
        data       TEXT    NOT NULL,
        active     INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS offers (
        id         INTEGER PRIMARY KEY,
        data       TEXT    NOT NULL,
        active     INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS proposals (
        id         INTEGER PRIMARY KEY,
        data       TEXT    NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );

      -- Single-row metadata
      CREATE TABLE IF NOT EXISTS meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      -- Faucet anti-sybil: persists funded addresses across Railway restarts
      CREATE TABLE IF NOT EXISTS funded_addresses (
        address    TEXT PRIMARY KEY,
        funded_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );

      -- Delivery proofs: seller-submitted cryptographic proofs of service delivery
      CREATE TABLE IF NOT EXISTS delivery_proofs (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        agreement_address TEXT    NOT NULL,
        seller_address    TEXT    NOT NULL,
        proof_hash        TEXT    NOT NULL,
        delivery_data     TEXT    NOT NULL,
        signature         TEXT    NOT NULL,
        webhook_sent      INTEGER NOT NULL DEFAULT 0,
        created_at        INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );
      CREATE INDEX IF NOT EXISTS idx_delivery_agreement ON delivery_proofs(agreement_address);
      CREATE INDEX IF NOT EXISTS idx_delivery_seller    ON delivery_proofs(seller_address);

      -- Webhook subscriptions: callback URLs registered by agents
      CREATE TABLE IF NOT EXISTS webhook_subscriptions (
        address     TEXT    NOT NULL,
        url         TEXT    NOT NULL,
        secret      TEXT    NOT NULL,
        events      TEXT    NOT NULL DEFAULT '["*"]',
        created_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (address, url)
      );
      CREATE INDEX IF NOT EXISTS idx_webhook_address ON webhook_subscriptions(address);
    `);
  }

  // ── Event log ──────────────────────────────────────────────────────────────

  private saveEvent(type: string, data: Record<string, unknown>, txHash?: string, blockNumber?: number) {
    this.db.prepare(
      "INSERT INTO events (type, block_number, tx_hash, data) VALUES (?, ?, ?, ?)"
    ).run(type, blockNumber ?? null, txHash ?? null, JSON.stringify(data));
    this.ws.broadcastEvent(type, data);
  }

  getRecentEvents(limit = 50, type?: string) {
    const stmt = type
      ? this.db.prepare("SELECT * FROM events WHERE type = ? ORDER BY timestamp DESC LIMIT ?")
      : this.db.prepare("SELECT * FROM events ORDER BY timestamp DESC LIMIT ?");
    const rows = type ? stmt.all(type, limit) : stmt.all(limit);
    return rows.map((row: any) => ({ ...row, data: JSON.parse(row.data) }));
  }

  getEventStats() {
    const counts = this.db
      .prepare("SELECT type, COUNT(*) as count FROM events GROUP BY type")
      .all() as Array<{ type: string; count: number }>;
    return Object.fromEntries(counts.map(r => [r.type, r.count]));
  }

  // ── Snapshot reads (always fast, from SQLite) ──────────────────────────────

  getStoredAgents(): any[] {
    return (this.db.prepare("SELECT data FROM agents ORDER BY updated_at DESC").all() as any[])
      .map(r => JSON.parse(r.data));
  }

  getStoredNeeds(activeOnly = false): any[] {
    const sql = activeOnly
      ? "SELECT data FROM needs WHERE active = 1 ORDER BY id DESC"
      : "SELECT data FROM needs ORDER BY id DESC";
    return (this.db.prepare(sql).all() as any[]).map(r => JSON.parse(r.data));
  }

  getStoredOffers(activeOnly = false): any[] {
    const sql = activeOnly
      ? "SELECT data FROM offers WHERE active = 1 ORDER BY id DESC"
      : "SELECT data FROM offers ORDER BY id DESC";
    return (this.db.prepare(sql).all() as any[]).map(r => JSON.parse(r.data));
  }

  getStoredProposals(): any[] {
    return (this.db.prepare("SELECT data FROM proposals ORDER BY id DESC").all() as any[])
      .map(r => JSON.parse(r.data));
  }

  getStoredStats() {
    const agents    = (this.db.prepare("SELECT COUNT(*) as n FROM agents").get() as any).n;
    const needs     = (this.db.prepare("SELECT COUNT(*) as n FROM needs WHERE active=1").get() as any).n;
    const offers    = (this.db.prepare("SELECT COUNT(*) as n FROM offers WHERE active=1").get() as any).n;
    const proposals = (this.db.prepare("SELECT COUNT(*) as n FROM proposals").get() as any).n;
    const lastSync  = (this.db.prepare("SELECT value FROM meta WHERE key='last_sync'").get() as any)?.value ?? null;
    return { agents, needs, offers, proposals, lastSync };
  }

  // ── Full sync from blockchain → SQLite ─────────────────────────────────────

  async syncFromChain(): Promise<void> {
    if (this._syncing) return;
    this._syncing = true;
    console.log("[DataStore] Starting full sync from blockchain...");

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    try {
      // ── Agents ──────────────────────────────────────────────────────────────
      let addresses: string[] = [];
      for (let attempt = 0; attempt < 3; attempt++) {
        try { addresses = await this.blockchain.registry.getActiveAgents(); break; }
        catch { await sleep(1500 * (attempt + 1)); }
      }

      const upsertAgent = this.db.prepare(
        "INSERT INTO agents (address, data, updated_at) VALUES (?, ?, strftime('%s','now')) ON CONFLICT(address) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at"
      );

      for (let i = 0; i < addresses.length; i += 4) {
        const batch = addresses.slice(i, i + 4);
        const results = await Promise.allSettled(
          batch.map(addr => this.blockchain.getAgentInfo(addr))
        );
        for (const r of results) {
          if (r.status === "fulfilled") {
            upsertAgent.run(r.value.address, JSON.stringify(r.value));
          }
        }
        if (i + 4 < addresses.length) await sleep(300);
      }
      console.log(`[DataStore] Synced ${addresses.length} agents`);

      // ── Needs ──────────────────────────────────────────────────────────────
      let totalNeeds = 0;
      for (let attempt = 0; attempt < 3; attempt++) {
        try { totalNeeds = Number(await this.blockchain.marketplace.totalNeeds()); break; }
        catch { await sleep(1000); }
      }

      const upsertNeed = this.db.prepare(
        "INSERT INTO needs (id, data, active, updated_at) VALUES (?, ?, ?, strftime('%s','now')) ON CONFLICT(id) DO UPDATE SET data=excluded.data, active=excluded.active, updated_at=excluded.updated_at"
      );

      for (let i = 0; i < totalNeeds; i++) {
        try {
          const need = await this.blockchain.getNeed(i);
          upsertNeed.run(i, JSON.stringify(need), need.active ? 1 : 0);
        } catch { /* skip */ }
        if (i > 0 && i % 10 === 0) await sleep(200);
      }
      console.log(`[DataStore] Synced ${totalNeeds} needs`);

      // ── Offers ─────────────────────────────────────────────────────────────
      let totalOffers = 0;
      for (let attempt = 0; attempt < 3; attempt++) {
        try { totalOffers = Number(await this.blockchain.marketplace.totalOffers()); break; }
        catch { await sleep(1000); }
      }

      const upsertOffer = this.db.prepare(
        "INSERT INTO offers (id, data, active, updated_at) VALUES (?, ?, ?, strftime('%s','now')) ON CONFLICT(id) DO UPDATE SET data=excluded.data, active=excluded.active, updated_at=excluded.updated_at"
      );

      for (let i = 0; i < totalOffers; i++) {
        try {
          const offer = await this.blockchain.getOffer(i);
          upsertOffer.run(i, JSON.stringify(offer), offer.active ? 1 : 0);
        } catch { /* skip */ }
        if (i > 0 && i % 10 === 0) await sleep(200);
      }
      console.log(`[DataStore] Synced ${totalOffers} offers`);

      // ── Proposals ──────────────────────────────────────────────────────────
      let totalProposals = 0;
      for (let attempt = 0; attempt < 3; attempt++) {
        try { totalProposals = Number(await this.blockchain.engine.totalProposals()); break; }
        catch { await sleep(1000); }
      }

      const upsertProposal = this.db.prepare(
        "INSERT INTO proposals (id, data, updated_at) VALUES (?, ?, strftime('%s','now')) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at"
      );

      for (let i = 0; i < totalProposals; i++) {
        try {
          const proposal = await this.blockchain.getProposal(i);
          if (proposal) upsertProposal.run(i, JSON.stringify(proposal));
        } catch { /* skip */ }
        if (i > 0 && i % 10 === 0) await sleep(200);
      }
      console.log(`[DataStore] Synced ${totalProposals} proposals`);

      // Mark last sync time
      this.db.prepare("INSERT INTO meta (key,value) VALUES ('last_sync',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
        .run(new Date().toISOString());

      const stats = this.getStoredStats();
      console.log(`[DataStore] Sync complete — agents:${stats.agents} needs:${stats.needs} offers:${stats.offers} proposals:${stats.proposals}`);

    } catch (e: any) {
      console.warn("[DataStore] Sync error:", e.message);
    } finally {
      this._syncing = false;
    }
  }

  // ── Blockchain event listeners ─────────────────────────────────────────────

  async startListening() {
    const { registry, marketplace, engine } = this.blockchain;
    console.log("[Indexer] Starting event listeners...");

    registry.on("AgentRegistered", (agent: string, name: string, capabilities: string[], event: { log: { transactionHash: string; blockNumber: number } }) => {
      console.log(`[Event] AgentRegistered: ${name} (${agent})`);
      this.saveEvent("AgentRegistered", { agent, name, capabilities }, event.log.transactionHash, event.log.blockNumber);
      // Re-sync this agent into snapshot
      this.blockchain.getAgentInfo(agent).then(info => {
        this.db.prepare("INSERT INTO agents (address, data, updated_at) VALUES (?, ?, strftime('%s','now')) ON CONFLICT(address) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at")
          .run(agent, JSON.stringify(info));
      }).catch(() => {});
    });

    marketplace.on("NeedPublished", (needId: bigint, publisher: string, budget: bigint, tags: string[], event: { log: { transactionHash: string; blockNumber: number } }) => {
      console.log(`[Event] NeedPublished: #${needId} by ${publisher}`);
      const data = { needId: needId.toString(), publisher, budget: budget.toString(), tags };
      this.saveEvent("NeedPublished", data, event.log.transactionHash, event.log.blockNumber);
      // Sync need into snapshot
      const id = Number(needId);
      this.blockchain.getNeed(id).then(need => {
        this.db.prepare("INSERT INTO needs (id, data, active, updated_at) VALUES (?, ?, ?, strftime('%s','now')) ON CONFLICT(id) DO UPDATE SET data=excluded.data, active=excluded.active, updated_at=excluded.updated_at")
          .run(id, JSON.stringify(need), need.active ? 1 : 0);
      }).catch(() => {});
    });

    marketplace.on("OfferPublished", (offerId: bigint, publisher: string, price: bigint, tags: string[], event: { log: { transactionHash: string; blockNumber: number } }) => {
      console.log(`[Event] OfferPublished: #${offerId} by ${publisher}`);
      const data = { offerId: offerId.toString(), publisher, price: price.toString(), tags };
      this.saveEvent("OfferPublished", data, event.log.transactionHash, event.log.blockNumber);
      // Sync offer into snapshot
      const id = Number(offerId);
      this.blockchain.getOffer(id).then(offer => {
        this.db.prepare("INSERT INTO offers (id, data, active, updated_at) VALUES (?, ?, ?, strftime('%s','now')) ON CONFLICT(id) DO UPDATE SET data=excluded.data, active=excluded.active, updated_at=excluded.updated_at")
          .run(id, JSON.stringify(offer), offer.active ? 1 : 0);
      }).catch(() => {});
    });

    engine.on("ProposalCreated", (proposalId: bigint, needId: bigint, offerId: bigint, buyer: string, seller: string, price: bigint, event: { log: { transactionHash: string; blockNumber: number } }) => {
      console.log(`[Event] ProposalCreated: #${proposalId} ${buyer} → ${seller}`);
      const data = { proposalId: proposalId.toString(), needId: needId.toString(), offerId: offerId.toString(), buyer, seller, price: price.toString() };
      this.saveEvent("ProposalCreated", data, event.log.transactionHash, event.log.blockNumber);
      const id = Number(proposalId);
      this.blockchain.getProposal(id).then(p => {
        if (p) this.db.prepare("INSERT INTO proposals (id, data, updated_at) VALUES (?, ?, strftime('%s','now')) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at")
          .run(id, JSON.stringify(p));
      }).catch(() => {});
    });

    engine.on("ProposalAccepted", (proposalId: bigint, agreementContract: string, event: { log: { transactionHash: string; blockNumber: number } }) => {
      console.log(`[Event] ProposalAccepted: #${proposalId} → ${agreementContract}`);
      this.saveEvent("ProposalAccepted", { proposalId: proposalId.toString(), agreementContract }, event.log.transactionHash, event.log.blockNumber);
      // Update proposal snapshot
      const id = Number(proposalId);
      this.blockchain.getProposal(id).then(p => {
        if (p) this.db.prepare("INSERT INTO proposals (id, data, updated_at) VALUES (?, ?, strftime('%s','now')) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at")
          .run(id, JSON.stringify(p));
      }).catch(() => {});
    });

    engine.on("CounterOffered", (newProposalId: bigint, parentProposalId: bigint, newPrice: bigint, event: { log: { transactionHash: string; blockNumber: number } }) => {
      this.saveEvent("CounterOffered", {
        newProposalId: newProposalId.toString(),
        parentProposalId: parentProposalId.toString(),
        newPrice: newPrice.toString(),
      }, event.log.transactionHash, event.log.blockNumber);
    });

    const { vault, referral, taskDAG, subscription } = this.blockchain;

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

    if (referral) {
      referral.on("ReferralRegistered", (agent: string, referrerAddr: string, event: any) => {
        this.saveEvent("ReferralRegistered", { agent, referrer: referrerAddr }, event.log.transactionHash, event.log.blockNumber);
      });
      referral.on("CommissionEarned", (earner: string, source: string, amount: bigint, level: number, event: any) => {
        this.saveEvent("CommissionEarned", { earner, source, amount: amount.toString(), level }, event.log.transactionHash, event.log.blockNumber);
      });
    }

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

    if (subscription) {
      subscription.on("SubscriptionCreated", (subId: bigint, subscriber: string, provider: string, pricePerPeriod: bigint, periodDuration: bigint, totalPeriods: bigint, event: any) => {
        this.saveEvent("SubscriptionCreated", { subId: subId.toString(), subscriber, provider, pricePerPeriod: pricePerPeriod.toString(), periodDuration: periodDuration.toString(), totalPeriods: totalPeriods.toString() }, event.log.transactionHash, event.log.blockNumber);
      });
      subscription.on("PeriodClaimed", (subId: bigint, provider: string, amount: bigint, periodsRemaining: bigint, event: any) => {
        this.saveEvent("PeriodClaimed", { subId: subId.toString(), provider, amount: amount.toString(), periodsRemaining: periodsRemaining.toString() }, event.log.transactionHash, event.log.blockNumber);
      });
    }

    // Suppress "filter not found" polling noise
    for (const contract of [registry, marketplace, engine]) {
      (contract.provider as any)?.on?.("error", (err: any) => {
        const msg: string = err?.error?.message ?? err?.message ?? "";
        if (msg.includes("filter not found")) return;
        console.error("[Indexer] Provider error:", msg);
      });
    }

    console.log("[Indexer] Listening for on-chain events...");
  }

  // ── Faucet funded-address store (SQLite-backed, survives Railway restarts) ──

  isFunded(address: string): boolean {
    const row = this.db.prepare("SELECT 1 FROM funded_addresses WHERE address = ?").get(address.toLowerCase());
    return !!row;
  }

  markFunded(address: string): void {
    this.db.prepare(
      "INSERT OR IGNORE INTO funded_addresses (address) VALUES (?)"
    ).run(address.toLowerCase());
  }

  unmarkFunded(address: string): void {
    this.db.prepare("DELETE FROM funded_addresses WHERE address = ?").run(address.toLowerCase());
  }

  fundedCount(): number {
    return (this.db.prepare("SELECT COUNT(*) as cnt FROM funded_addresses").get() as { cnt: number }).cnt;
  }

  // ── Delivery proofs ────────────────────────────────────────────────────────

  saveDeliveryProof(proof: {
    agreementAddress: string;
    sellerAddress: string;
    proofHash: string;
    deliveryData: string;
    signature: string;
  }): number {
    const result = this.db.prepare(`
      INSERT INTO delivery_proofs (agreement_address, seller_address, proof_hash, delivery_data, signature)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      proof.agreementAddress.toLowerCase(),
      proof.sellerAddress.toLowerCase(),
      proof.proofHash,
      proof.deliveryData,
      proof.signature
    );
    return result.lastInsertRowid as number;
  }

  markWebhookSent(id: number): void {
    this.db.prepare("UPDATE delivery_proofs SET webhook_sent = 1 WHERE id = ?").run(id);
  }

  getDeliveryProofs(agreementAddress: string): any[] {
    return (this.db.prepare(
      "SELECT * FROM delivery_proofs WHERE agreement_address = ? ORDER BY created_at DESC"
    ).all(agreementAddress.toLowerCase()) as any[]);
  }

  getLatestDeliveryProof(agreementAddress: string): any | null {
    return this.db.prepare(
      "SELECT * FROM delivery_proofs WHERE agreement_address = ? ORDER BY created_at DESC LIMIT 1"
    ).get(agreementAddress.toLowerCase()) ?? null;
  }

  // ── Webhook subscriptions ──────────────────────────────────────────────────

  saveWebhookSubscription(address: string, url: string, secret: string, events: string[]): void {
    this.db.prepare(`
      INSERT INTO webhook_subscriptions (address, url, secret, events)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(address, url) DO UPDATE SET secret=excluded.secret, events=excluded.events
    `).run(address.toLowerCase(), url, secret, JSON.stringify(events));
  }

  deleteWebhookSubscription(address: string, url: string): boolean {
    const result = this.db.prepare(
      "DELETE FROM webhook_subscriptions WHERE address = ? AND url = ?"
    ).run(address.toLowerCase(), url);
    return result.changes > 0;
  }

  getWebhookSubscriptions(address: string): Array<{ url: string; events: string[]; created_at: number }> {
    return (this.db.prepare(
      "SELECT url, events, created_at FROM webhook_subscriptions WHERE address = ?"
    ).all(address.toLowerCase()) as any[]).map(r => ({ ...r, events: JSON.parse(r.events) }));
  }

  getWebhooksForEvent(targetAddress: string, eventType: string): Array<{ url: string; secret: string }> {
    return (this.db.prepare(
      "SELECT url, secret FROM webhook_subscriptions WHERE address = ?"
    ).all(targetAddress.toLowerCase()) as any[]).filter(r => {
      const events: string[] = JSON.parse(r.events);
      return events.includes("*") || events.includes(eventType);
    });
  }

  // ── Legacy backfill (events only — kept for compatibility) ─────────────────
  async backfillFromChain(): Promise<void> {
    const recent = (this.db.prepare("SELECT COUNT(*) as cnt FROM events WHERE timestamp > ?").get(
      Math.floor(Date.now() / 1000) - 7200) as { cnt: number }).cnt;
    if (recent > 0) {
      console.log(`[Indexer] ${recent} recent events in DB`);
      return;
    }
    // If events table is also empty, full sync handles everything
    console.log("[Indexer] No recent events — full sync will populate DB");
  }
}
