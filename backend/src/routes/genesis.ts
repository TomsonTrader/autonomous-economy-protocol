import { Router } from "express";
import { ethers } from "ethers";
import { BlockchainService } from "../services/blockchain";

export function genesisRouter(blockchain: BlockchainService): Router {
  const router = Router();

  // GET /api/genesis/info — season stats + time remaining
  router.get("/info", async (_req, res) => {
    try {
      if (!blockchain.genesis) {
        return res.json({ active: false, message: "GenesisProgram not deployed on this network" });
      }
      const info = await blockchain.genesis.seasonInfo();
      const now = Math.floor(Date.now() / 1000);
      const end = Number(info.end);
      const start = Number(info.start);
      const daysRemaining = info.started && !info.ended
        ? Math.max(0, Math.ceil((end - now) / 86400))
        : 0;

      return res.json({
        active: info.started && !info.ended,
        started: info.started,
        ended: info.ended,
        pool: ethers.formatEther(info.pool),
        poolRaw: info.pool.toString(),
        start: start,
        end: end,
        daysRemaining,
        totalPoints: info.totalPoints.toString(),
        contract: blockchain.deployment.contracts.GenesisProgram,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/genesis/leaderboard — top 50 participants
  router.get("/leaderboard", async (_req, res) => {
    try {
      if (!blockchain.genesis) {
        return res.json({ leaderboard: [] });
      }
      const [addrs, pts] = await blockchain.genesis.getLeaderboard();

      // Enrich with agent names
      const leaderboard = await Promise.all(
        addrs.map(async (addr: string, i: number) => {
          try {
            const agent = await blockchain.registry.getAgent(addr);
            return {
              rank: i + 1,
              address: addr,
              name: agent.name || addr.slice(0, 8) + "...",
              points: Number(pts[i]),
            };
          } catch {
            return {
              rank: i + 1,
              address: addr,
              name: addr.slice(0, 8) + "...",
              points: Number(pts[i]),
            };
          }
        })
      );

      // Sort by points descending
      leaderboard.sort((a, b) => b.points - a.points);
      leaderboard.forEach((p, i) => { p.rank = i + 1; });

      return res.json({ leaderboard });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/genesis/participant/:address
  router.get("/participant/:address", async (req, res) => {
    try {
      if (!blockchain.genesis) {
        return res.json({ found: false });
      }
      const { address } = req.params;
      const p = await blockchain.genesis.getParticipant(address);
      return res.json({
        address,
        points: Number(p.points),
        breakdown: {
          registration: p.creditedRegistration ? 100 : 0,
          firstDeal:    p.creditedFirstDeal ? 200 : 0,
          stake:        p.creditedStake ? 150 : 0,
          withReferrer: p.creditedWithReferrer ? 100 : 0,
          beReferrer3:  p.creditedBeReferrer3 ? 300 : 0,
          tenDeals:     p.creditedTenDeals ? 500 : 0,
          repSustained: p.creditedRepSustained ? 500 : 0,
        },
        claimed: p.claimed,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
