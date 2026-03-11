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

  // GET /api/monitor/leaderboard (alias: /api/reputation/leaderboard)
  router.get("/leaderboard", async (_req: Request, res: Response) => {
    try {
      const agents = await blockchain.registry.getActiveAgents().catch(() => [] as string[]);
      const rows = await Promise.all(
        (agents as string[]).map(async (addr: string) => {
          try {
            const [rep, agent] = await Promise.all([
              blockchain.reputation.getReputation(addr),
              blockchain.registry.getAgent(addr),
            ]);
            return { address: addr, name: agent.name || addr.slice(0, 8) + "...", score: Number(rep[0]), totalDeals: Number(rep[1]) };
          } catch {
            return { address: addr, name: addr.slice(0, 8) + "...", score: 0, totalDeals: 0 };
          }
        })
      );
      rows.sort((a, b) => b.score - a.score);
      rows.forEach((r, i) => Object.assign(r, { rank: i + 1 }));
      res.json({ leaderboard: rows });
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
