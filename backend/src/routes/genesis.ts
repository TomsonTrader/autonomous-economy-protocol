import { Router } from "express";
import { ethers } from "ethers";
import { BlockchainService } from "../services/blockchain";

/** Wrap a promise with a timeout — returns fallback value instead of throwing */
function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 15000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export function genesisRouter(blockchain: BlockchainService): Router {
  const router = Router();

  // GET /api/genesis/info — season stats + time remaining
  router.get("/info", async (_req, res) => {
    try {
      if (!blockchain.genesis) {
        return res.json({ active: false, message: "GenesisProgram not deployed on this network" });
      }
      const [info, genesisBalance] = await Promise.all([
        withTimeout(blockchain.genesis.seasonInfo(), null),
        withTimeout(blockchain.token.balanceOf(blockchain.deployment.contracts.GenesisProgram), 0n),
      ]);

      if (!info) {
        return res.status(503).json({ error: "Genesis contract RPC timeout — try again shortly" });
      }

      const now = Math.floor(Date.now() / 1000);
      const end = Number(info.end);
      const start = Number(info.start);
      const daysRemaining = info.started && !info.ended
        ? Math.max(0, Math.ceil((end - now) / 86400))
        : 0;

      const claimDelay = 30 * 86400; // 30 days
      const claimWindowOpensAt = end + claimDelay;
      const claimWindowOpen = info.ended && now >= claimWindowOpensAt;

      const poolFormatted = ethers.formatEther(genesisBalance);

      return res.json({
        active: info.started && !info.ended,
        started: info.started,
        ended: info.ended,
        pool: poolFormatted,
        poolAGT: Number(poolFormatted),
        participants: Number(info.participants_),
        start,
        end,
        daysRemaining,
        totalPoints: info.totalPts.toString(),
        contract: blockchain.deployment.contracts.GenesisProgram,
        claimWindowOpensAt,
        claimWindowOpen,
        vesting: { immediatePercent: 25, vestedPercent: 75, vestingDays: 180 },
        antiWhaleCap: "1000000",
      });
    } catch (err: any) {
      return res.status(503).json({ error: "Genesis info unavailable: " + err.message });
    }
  });

  // GET /api/genesis/leaderboard — top 50 participants
  router.get("/leaderboard", async (_req, res) => {
    try {
      if (!blockchain.genesis) {
        return res.json({ leaderboard: [] });
      }
      const result = await withTimeout<[string[], bigint[]] | null>(
        blockchain.genesis.getLeaderboard(),
        null
      );

      if (!result) {
        return res.status(503).json({ error: "Leaderboard RPC timeout — try again shortly" });
      }
      const [addrs, pts] = result;

      const leaderboard = await Promise.all(
        addrs.map(async (addr: string, i: number) => {
          const name = await withTimeout(
            blockchain.registry.getAgent(addr).then((a: any) => a.name || addr.slice(0, 8) + "..."),
            addr.slice(0, 8) + "..."
          );
          return { rank: i + 1, address: addr, name, points: Number(pts[i]) };
        })
      );

      leaderboard.sort((a, b) => b.points - a.points);
      leaderboard.forEach((p, i) => { p.rank = i + 1; });

      return res.json({ leaderboard });
    } catch (err: any) {
      return res.status(503).json({ error: "Leaderboard unavailable: " + err.message });
    }
  });

  // GET /api/genesis/participant/:address
  router.get("/participant/:address", async (req, res) => {
    try {
      if (!blockchain.genesis) {
        return res.json({ found: false });
      }
      const { address } = req.params;
      if (!ethers.isAddress(address)) return res.status(400).json({ error: "Invalid address" });

      const p = await withTimeout(blockchain.genesis.getParticipant(address), null);
      if (!p) return res.status(503).json({ error: "Participant lookup RPC timeout" });

      return res.json({
        address,
        points:       Number(p.points),
        estimatedAGT: ethers.formatEther(p.estimatedAGT),
        claimed:      p.claimed,
        daysLeft:     Number(p.daysLeft),
      });
    } catch (err: any) {
      return res.status(503).json({ error: "Participant lookup failed: " + err.message });
    }
  });

  // POST /api/genesis/sync — sync points for any registered agent (backend pays gas)
  router.post("/sync", async (req, res) => {
    try {
      if (!blockchain.genesis) return res.status(400).json({ error: "GenesisProgram not deployed" });
      const { address } = req.body as { address?: string };
      if (!address) return res.status(400).json({ error: "address required" });
      const PRIVATE_KEY = process.env.PRIVATE_KEY;
      if (!PRIVATE_KEY) return res.status(500).json({ error: "Backend signer not configured" });
      const signer = new ethers.Wallet(PRIVATE_KEY, blockchain.provider);
      const genesisAddr = await blockchain.genesis.getAddress();
      const genesisSigner = new ethers.Contract(genesisAddr, ["function syncPoints(address agent) external"], signer);
      const tx = await genesisSigner.syncPoints(address);
      const receipt = await tx.wait();
      return res.json({ txHash: receipt.hash, address });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/genesis/participant/:address/vesting
  router.get("/participant/:address/vesting", async (req, res) => {
    try {
      if (!blockchain.genesis) return res.json({ found: false });
      const { address } = req.params;
      const v = await blockchain.genesis.getVesting(address);
      return res.json({
        address,
        total:     ethers.formatEther(v.total),
        released:  ethers.formatEther(v.released),
        claimable: ethers.formatEther(v.claimable),
        startTime: Number(v.startTime),
        vestingEndsAt: Number(v.startTime) + 180 * 86400,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
