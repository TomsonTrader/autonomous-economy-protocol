import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import { BlockchainService } from "../services/blockchain";
import { EventIndexer } from "../services/indexer";

/**
 * Premium analytics endpoints — protected by x402 micropayments.
 * Each request costs 0.001 USDC, paid by the AI agent to AEP treasury.
 *
 * These routes are registered AFTER the x402 paymentMiddleware in index.ts,
 * so they are only reached when payment has been verified by the facilitator.
 */
export function premiumRouter(blockchain: BlockchainService, indexer: EventIndexer): Router {
  const router = Router();

  /**
   * GET /api/market/premium/insights
   * Returns rich market analytics: top agents by rep, price bands, deal velocity.
   * Costs 0.001 USDC per call via x402.
   */
  router.get("/insights", async (_req: Request, res: Response) => {
    try {
      // Parallel: market stats + recent deal events
      const [marketStats, recentEvents] = await Promise.all([
        blockchain.getMarketStats(),
        Promise.resolve(indexer.getRecentEvents(200)),
      ]);

      // Deal velocity (last 24 h)
      const cutoff = Date.now() - 86_400_000;
      const recentDeals = recentEvents.filter(
        (e) => e.type === "DeliveryConfirmed" && e.timestamp > cutoff
      );

      // Price insights from offers
      const offerEvents = recentEvents.filter((e) => e.type === "OfferPublished");
      const prices = offerEvents
        .map((e) => parseFloat(e.data?.price ?? "0"))
        .filter((p) => p > 0);
      const priceInsights =
        prices.length > 0
          ? {
              min: Math.min(...prices).toFixed(4),
              max: Math.max(...prices).toFixed(4),
              avg: (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(4),
              samples: prices.length,
            }
          : null;

      // Top active agents by totalDeals (from registry)
      const addresses = await blockchain.registry.getActiveAgents();
      const repResults = await Promise.allSettled(
        (addresses as string[]).slice(0, 20).map(async (addr: string) => {
          const rep = await blockchain.reputation.getReputation(addr);
          return {
            address: addr,
            totalDeals: Number(rep.totalDeals),
            successfulDeals: Number(rep.successfulDeals),
            score: Number(rep.score),
            volume: ethers.formatEther(rep.totalValueTransacted),
          };
        })
      );
      const topAgents = repResults
        .filter(
          (r): r is PromiseFulfilledResult<{
            address: string;
            totalDeals: number;
            successfulDeals: number;
            score: number;
            volume: string;
          }> => r.status === "fulfilled"
        )
        .map((r) => r.value)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      res.json({
        market: marketStats,
        priceInsights,
        dealVelocity: {
          last24h: recentDeals.length,
        },
        topAgents,
        generatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
