import { Router, Request, Response } from "express";
import * as crypto from "crypto";
import { EventIndexer } from "../services/indexer";
import { apiError, requireAddress } from "../middleware/validate";

/**
 * Webhook Subscription Management
 * ─────────────────────────────────────────────────────────────────────────────
 * Agents register a callback URL to receive HTTP POST notifications when
 * events relevant to their address occur (e.g. DeliveryProofSubmitted).
 *
 * Each subscription has a HMAC secret. The backend signs every outbound
 * payload with `X-AEP-Signature: sha256=<hmac>` so receivers can verify
 * the payload came from AEP.
 *
 * Endpoints:
 *   POST   /api/webhooks/subscribe      — register a callback URL
 *   DELETE /api/webhooks/unsubscribe    — remove a callback URL
 *   GET    /api/webhooks/:address       — list subscriptions for an address
 *
 * Supported event types:
 *   "*"                      — all events (default)
 *   "DeliveryProofSubmitted" — seller submitted a delivery proof
 *   "ProposalCreated"        — new proposal for buyer
 *   "ProposalAccepted"       — proposal accepted
 *   "AgentRegistered"        — new agent on the protocol
 */
export function webhooksRouter(indexer: EventIndexer): Router {
  const router = Router();

  const ALLOWED_EVENTS = new Set([
    "*",
    "DeliveryProofSubmitted",
    "ProposalCreated",
    "ProposalAccepted",
    "CounterOffered",
    "AgentRegistered",
    "NeedPublished",
    "OfferPublished",
    "Staked",
    "TaskCreated",
    "TaskCompleted",
  ]);

  // ── POST /api/webhooks/subscribe ──────────────────────────────────────────
  // Body: {
  //   address : string    (0x… — the agent address to watch)
  //   url     : string    (HTTPS callback URL, max 512 chars)
  //   events  : string[]  (optional — defaults to ["*"])
  //   secret  : string    (optional — auto-generated if not provided)
  // }
  router.post("/subscribe", async (req: Request, res: Response) => {
    const { address, url, events, secret } = req.body;

    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address))
      return apiError(res, "INVALID_ADDRESS", "address must be a valid Ethereum address");

    if (!url || typeof url !== "string" || url.length > 512)
      return apiError(res, "INVALID_URL", "url must be a string of max 512 chars");

    // Allow http for local dev, require https in production
    if (process.env.NODE_ENV === "production" && !url.startsWith("https://"))
      return apiError(res, "INSECURE_URL", "url must use HTTPS in production");

    // Validate event types
    const eventList: string[] = Array.isArray(events) && events.length > 0 ? events : ["*"];
    for (const ev of eventList) {
      if (!ALLOWED_EVENTS.has(ev))
        return apiError(res, "INVALID_EVENT_TYPE", `Unknown event type: "${ev}". Allowed: ${[...ALLOWED_EVENTS].join(", ")}`);
    }

    // Use provided secret or generate a secure random one
    const hmacSecret: string = (typeof secret === "string" && secret.length >= 16)
      ? secret
      : crypto.randomBytes(32).toString("hex");

    indexer.saveWebhookSubscription(address, url, hmacSecret, eventList);

    return res.status(201).json({
      success: true,
      address,
      url,
      events: eventList,
      secret: hmacSecret,
      message: "Webhook registered. Include X-AEP-Signature verification in your receiver.",
      signingNote: "Each POST will include: X-AEP-Signature: sha256=<hmac-sha256-hex>, verify with your secret.",
    });
  });

  // ── DELETE /api/webhooks/unsubscribe ──────────────────────────────────────
  // Body: { address: string, url: string }
  router.delete("/unsubscribe", (req: Request, res: Response) => {
    const { address, url } = req.body;

    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address))
      return apiError(res, "INVALID_ADDRESS", "address must be a valid Ethereum address");

    if (!url || typeof url !== "string")
      return apiError(res, "INVALID_URL", "url is required");

    const removed = indexer.deleteWebhookSubscription(address, url);
    if (!removed) {
      return apiError(res, "SUBSCRIPTION_NOT_FOUND", "No subscription found for that address + url pair", 404);
    }

    return res.json({ success: true, message: "Webhook subscription removed." });
  });

  // ── GET /api/webhooks/:address — list subscriptions ───────────────────────
  router.get("/:address", requireAddress("params", "address"), (req: Request, res: Response) => {
    const subs = indexer.getWebhookSubscriptions(req.params.address);
    // Never expose secrets in GET responses
    const safe = subs.map(s => ({ url: s.url, events: s.events, createdAt: new Date(s.created_at * 1000).toISOString() }));
    return res.json({ subscriptions: safe, count: safe.length });
  });

  return router;
}
