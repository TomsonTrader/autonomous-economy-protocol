import { Router, Request, Response } from "express";
import { BlockchainService } from "../services/blockchain";
import { EventIndexer } from "../services/indexer";

export function monitorRouter(blockchain: BlockchainService, indexer: EventIndexer): Router {
  const router = Router();

  // GET /api/monitor/activity?limit=50&type=ProposalAccepted
  router.get("/activity", async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const type = req.query.type as string | undefined;
      const events = indexer.getRecentEvents(limit, type);
      res.json({ events, total: events.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/monitor/stats
  router.get("/stats", async (req: Request, res: Response) => {
    try {
      const [marketStats, eventStats] = await Promise.all([
        blockchain.getMarketStats(),
        Promise.resolve(indexer.getEventStats()),
      ]);
      res.json({
        market: marketStats,
        events: eventStats,
        network: blockchain.deployment.network,
        deployedAt: blockchain.deployment.deployedAt,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/reputation/:address
  router.get("/reputation/:address", async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      const [score, totalDeals, successfulDeals, totalValueTransacted, lastUpdated] =
        await blockchain.reputation.getReputation(address);
      res.json({
        address,
        score: score.toString(),
        totalDeals: totalDeals.toString(),
        successfulDeals: successfulDeals.toString(),
        totalValueTransacted: totalValueTransacted.toString(),
        lastUpdated: lastUpdated.toString(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
