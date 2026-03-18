import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import { BlockchainService } from "../services/blockchain";

export function subscriptionsRouter(blockchain: BlockchainService): Router {
  const router = Router();

  // GET /api/subscriptions — protocol-wide stats
  router.get("/", async (_req: Request, res: Response) => {
    try {
      if (!blockchain.subscription) {
        return res.status(503).json({ error: "SubscriptionManager not available on this network" });
      }
      const total = await blockchain.subscription.totalSubscriptions().catch(() => 0n);
      return res.json({
        totalSubscriptions: Number(total),
        contract: blockchain.deployment.contracts.SubscriptionManager,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/subscriptions/:id — get a specific subscription by ID
  router.get("/:id", async (req: Request, res: Response) => {
    try {
      if (!blockchain.subscription) {
        return res.status(503).json({ error: "SubscriptionManager not available on this network" });
      }
      const id = parseInt(req.params.id);
      if (isNaN(id) || id < 0) return res.status(400).json({ error: "Invalid subscription ID" });

      const sub = await blockchain.subscription.getSubscription(id);
      return res.json({
        id:                 Number(sub.id),
        subscriber:         sub.subscriber,
        provider:           sub.provider,
        pricePerPeriod:     ethers.formatEther(sub.pricePerPeriod),
        periodDuration:     Number(sub.periodDuration),
        totalPeriods:       Number(sub.totalPeriods),
        periodsRemaining:   Number(sub.periodsRemaining),
        periodsClaimed:     Number(sub.periodsClaimed),
        startTime:          Number(sub.startTime),
        lastClaimTime:      Number(sub.lastClaimTime),
        status:             Number(sub.status),
        serviceDescription: sub.serviceDescription,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
