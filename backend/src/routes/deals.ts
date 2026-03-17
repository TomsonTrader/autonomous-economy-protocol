import { Router, Request, Response } from "express";
import { EventIndexer } from "../services/indexer";
import { apiError, requireAddress } from "../middleware/validate";

/**
 * Deal Registry + Monitoring
 * ─────────────────────────────────────────────────────────────────────────────
 * After a deal is accepted on-chain (AutonomousAgreement deployed), agents
 * register it here so the DealMonitor service watches its deadline and sends
 * webhook alerts at critical moments (approaching deadline, grace period over).
 *
 * Endpoints:
 *   POST   /api/deals/register         — register a deal for monitoring
 *   DELETE /api/deals/:address         — unregister a deal
 *   GET    /api/deals/:address         — get deal monitoring status
 *   GET    /api/deals                  — list all monitored deals
 */
export function dealsRouter(indexer: EventIndexer): Router {
  const router = Router();

  // ── POST /api/deals/register ───────────────────────────────────────────────
  // Body: {
  //   agreementAddress : string  (0x… — the AutonomousAgreement contract)
  //   sellerAddress    : string  (0x…)
  //   buyerAddress     : string  (0x…)
  //   deadline         : number  (Unix timestamp — must match on-chain)
  //   paymentAmount    : string? (AGT wei, for display)
  //   description      : string? (deal summary, ≤256 chars)
  // }
  router.post("/register", (req: Request, res: Response) => {
    const { agreementAddress, sellerAddress, buyerAddress, deadline, paymentAmount, description } = req.body;

    if (!agreementAddress || !/^0x[0-9a-fA-F]{40}$/.test(agreementAddress))
      return apiError(res, "INVALID_AGREEMENT_ADDRESS", "agreementAddress must be a valid Ethereum address");
    if (!sellerAddress || !/^0x[0-9a-fA-F]{40}$/.test(sellerAddress))
      return apiError(res, "INVALID_SELLER_ADDRESS", "sellerAddress must be a valid Ethereum address");
    if (!buyerAddress || !/^0x[0-9a-fA-F]{40}$/.test(buyerAddress))
      return apiError(res, "INVALID_BUYER_ADDRESS", "buyerAddress must be a valid Ethereum address");

    const dl = Number(deadline);
    if (!deadline || !Number.isFinite(dl) || dl < Math.floor(Date.now() / 1000) - 7 * 24 * 3600)
      return apiError(res, "INVALID_DEADLINE", "deadline must be a valid Unix timestamp (not more than 7 days in the past)");

    if (description && typeof description === "string" && description.length > 256)
      return apiError(res, "DESCRIPTION_TOO_LONG", "description must be ≤256 chars");

    indexer.registerDeal({
      agreementAddress,
      sellerAddress,
      buyerAddress,
      deadline: dl,
      paymentAmount: paymentAmount ? String(paymentAmount) : "0",
      description:   description ? String(description).slice(0, 256) : "",
    });

    const graceEnd = dl + 7 * 24 * 3600;
    return res.status(201).json({
      success: true,
      agreementAddress,
      sellerAddress,
      buyerAddress,
      deadline:   new Date(dl * 1000).toISOString(),
      graceEnd:   new Date(graceEnd * 1000).toISOString(),
      monitoring: {
        approaching_deadline:  new Date((dl - 24 * 3600) * 1000).toISOString(),
        deadline_passed:       new Date(dl * 1000).toISOString(),
        grace_period_ending:   new Date((graceEnd - 6 * 3600) * 1000).toISOString(),
        auto_claim_available:  new Date(graceEnd * 1000).toISOString(),
      },
      message: "Deal registered for monitoring. Webhook alerts will fire at deadline milestones.",
    });
  });

  // ── DELETE /api/deals/:address ─────────────────────────────────────────────
  router.delete("/:address", requireAddress("params", "address"), (req: Request, res: Response) => {
    const deal = indexer.getMonitoredDeal(req.params.address);
    if (!deal) return apiError(res, "DEAL_NOT_FOUND", "Deal is not registered for monitoring", 404);
    indexer.unregisterDeal(req.params.address);
    return res.json({ success: true, message: "Deal removed from monitoring." });
  });

  // ── GET /api/deals/:address ────────────────────────────────────────────────
  router.get("/:address", requireAddress("params", "address"), (req: Request, res: Response) => {
    const deal = indexer.getMonitoredDeal(req.params.address);
    if (!deal) return apiError(res, "DEAL_NOT_FOUND", "Deal is not registered for monitoring", 404);

    const now      = Math.floor(Date.now() / 1000);
    const graceEnd = deal.deadline + 7 * 24 * 3600;
    const latestProof = indexer.getLatestDeliveryProof(req.params.address);

    let phase: string;
    if (now < deal.deadline - 24 * 3600)         phase = "ACTIVE";
    else if (now < deal.deadline)                 phase = "APPROACHING_DEADLINE";
    else if (now < graceEnd)                      phase = "IN_GRACE_PERIOD";
    else                                          phase = "AUTO_CLAIM_AVAILABLE";

    return res.json({
      ...deal,
      deadline:    new Date(deal.deadline * 1000).toISOString(),
      graceEnd:    new Date(graceEnd * 1000).toISOString(),
      phase,
      hasProof:    !!latestProof,
      deliveryType: latestProof?.delivery_type ?? null,
      proofSubmittedAt: latestProof ? new Date(latestProof.created_at * 1000).toISOString() : null,
    });
  });

  // ── GET /api/deals ─────────────────────────────────────────────────────────
  router.get("/", (req: Request, res: Response) => {
    const { seller, buyer } = req.query as Record<string, string>;
    let deals = indexer.getMonitoredDeals();

    if (seller && /^0x[0-9a-fA-F]{40}$/.test(seller))
      deals = deals.filter(d => d.sellerAddress.toLowerCase() === seller.toLowerCase());
    if (buyer && /^0x[0-9a-fA-F]{40}$/.test(buyer))
      deals = deals.filter(d => d.buyerAddress.toLowerCase() === buyer.toLowerCase());

    const now = Math.floor(Date.now() / 1000);
    const enriched = deals.map(d => {
      const graceEnd = d.deadline + 7 * 24 * 3600;
      let phase: string;
      if (now < d.deadline - 24 * 3600)         phase = "ACTIVE";
      else if (now < d.deadline)                 phase = "APPROACHING_DEADLINE";
      else if (now < graceEnd)                   phase = "IN_GRACE_PERIOD";
      else                                       phase = "AUTO_CLAIM_AVAILABLE";
      return { ...d, deadline: new Date(d.deadline * 1000).toISOString(), graceEnd: new Date(graceEnd * 1000).toISOString(), phase };
    });

    return res.json({ deals: enriched, count: enriched.length });
  });

  return router;
}
