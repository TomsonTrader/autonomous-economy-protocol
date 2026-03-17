import { EventIndexer } from "./indexer";
import { WebSocketService } from "./websocket";
import { fanoutWebhooks } from "./webhookDelivery";

/**
 * DealMonitor — Background service that tracks registered AutonomousAgreement deals.
 *
 * Watches deadlines and fires webhook alerts at critical milestones:
 *
 *  • APPROACHING_DEADLINE  — 24h before deadline, seller should deliver
 *  • DEADLINE_PASSED       — deadline is over, seller can submit proof anytime
 *  • GRACE_PERIOD_ENDING   — 6h before grace period ends (7 days after deadline)
 *  • AUTO_CLAIM_AVAILABLE  — grace period over, seller can call claimTimeout() on-chain
 *
 * Runs every 5 minutes. All timestamps are Unix seconds.
 *
 * Integrates with the webhook subscription system (WebhookSubscriptions table)
 * to notify both seller and buyer at the right moments.
 */

const GRACE_PERIOD_SECONDS = 7 * 24 * 3600; // 7 days (matches AutonomousAgreement.sol)
const POLL_INTERVAL_MS     = 5 * 60_000;     // 5 minutes

export interface DealRegistration {
  agreementAddress: string;
  sellerAddress:    string;
  buyerAddress:     string;
  deadline:         number;  // Unix timestamp
  paymentAmount:    string;  // AGT wei string
  description:      string;
  registeredAt:     number;
}

export class DealMonitor {
  private timer: NodeJS.Timeout | null = null;
  private indexer: EventIndexer;
  private ws: WebSocketService;

  constructor(indexer: EventIndexer, ws: WebSocketService) {
    this.indexer = indexer;
    this.ws      = ws;
  }

  start(): void {
    if (this.timer) return;
    console.log("[DealMonitor] Starting — checking deal deadlines every 5 minutes");
    this.timer = setInterval(() => this._check().catch(e => console.warn("[DealMonitor] Error:", e.message)), POLL_INTERVAL_MS);
    // First check after 30s to let everything settle
    setTimeout(() => this._check().catch(() => {}), 30_000);
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  private async _check(): Promise<void> {
    const deals = this.indexer.getMonitoredDeals();
    if (deals.length === 0) return;

    const now = Math.floor(Date.now() / 1000);
    console.log(`[DealMonitor] Checking ${deals.length} registered deal(s)...`);

    for (const deal of deals) {
      const { agreementAddress, sellerAddress, buyerAddress, deadline } = deal;
      const graceEnd = deadline + GRACE_PERIOD_SECONDS;

      // Determine which alert to fire (fire each type only once)
      const lastAlert = this.indexer.getLastDealAlert(agreementAddress);

      const milestones: Array<{ key: string; triggerAt: number; event: string; hoursNotice?: number }> = [
        { key: "approaching_deadline", triggerAt: deadline - 24 * 3600, event: "DEAL_APPROACHING_DEADLINE", hoursNotice: 24 },
        { key: "deadline_passed",      triggerAt: deadline,             event: "DEAL_DEADLINE_PASSED" },
        { key: "grace_ending",         triggerAt: graceEnd - 6 * 3600, event: "DEAL_GRACE_PERIOD_ENDING", hoursNotice: 6 },
        { key: "auto_claim_available", triggerAt: graceEnd,             event: "DEAL_AUTO_CLAIM_AVAILABLE" },
      ];

      for (const m of milestones) {
        if (now >= m.triggerAt && lastAlert !== m.key) {
          await this._fireAlert(deal, m.event, m.key, now, graceEnd, m.hoursNotice);
          break; // fire at most one alert per check cycle per deal
        }
      }

      // Remove deal from monitoring once auto-claim window has been alerted
      if (lastAlert === "auto_claim_available" && now > graceEnd + 3600) {
        this.indexer.unregisterDeal(agreementAddress);
        console.log(`[DealMonitor] Removed fully expired deal: ${agreementAddress}`);
      }
    }
  }

  private async _fireAlert(
    deal: DealRegistration,
    eventName: string,
    alertKey: string,
    now: number,
    graceEnd: number,
    hoursNotice?: number
  ): Promise<void> {
    const { agreementAddress, sellerAddress, buyerAddress, deadline } = deal;
    const hoursToDeadline = Math.round((deadline - now) / 3600);
    const hoursToGrace    = Math.round((graceEnd - now) / 3600);

    const payload = {
      event: eventName,
      timestamp: new Date().toISOString(),
      data: {
        agreementAddress,
        sellerAddress,
        buyerAddress,
        deadline:            new Date(deadline * 1000).toISOString(),
        graceEnd:            new Date(graceEnd * 1000).toISOString(),
        hoursToDeadline:     Math.max(0, hoursToDeadline),
        hoursToGraceEnd:     Math.max(0, hoursToGrace),
        paymentAmount:       deal.paymentAmount,
        description:         deal.description,
        hoursNotice,
        instructions:        _instructions(eventName),
      },
    };

    // WebSocket broadcast
    this.ws.broadcastEvent(eventName, payload.data);

    // Webhook to seller
    const sellerWebhooks = this.indexer.getWebhooksForEvent(sellerAddress, eventName);
    if (sellerWebhooks.length > 0) {
      await fanoutWebhooks(sellerWebhooks, payload).catch(() => {});
    }

    // Webhook to buyer
    const buyerWebhooks = this.indexer.getWebhooksForEvent(buyerAddress, eventName);
    if (buyerWebhooks.length > 0) {
      await fanoutWebhooks(buyerWebhooks, payload).catch(() => {});
    }

    this.indexer.saveDealAlert(agreementAddress, alertKey);
    console.log(`[DealMonitor] ${eventName} fired for ${agreementAddress}`);
  }
}

function _instructions(event: string): string {
  switch (event) {
    case "DEAL_APPROACHING_DEADLINE":
      return "Seller: submit your delivery proof soon via POST /api/delivery/submit";
    case "DEAL_DEADLINE_PASSED":
      return "Seller: submit delivery proof. Buyer: you can raise a dispute until grace period ends.";
    case "DEAL_GRACE_PERIOD_ENDING":
      return "Seller: if no delivery proof was accepted, you can still submit one before grace period ends.";
    case "DEAL_AUTO_CLAIM_AVAILABLE":
      return "Seller: call AutonomousAgreement.claimTimeout() on-chain to claim your payment.";
    default:
      return "";
  }
}
