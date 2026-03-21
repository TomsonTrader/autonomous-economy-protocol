/**
 * Super Agent Registry — AEP
 * Routes: GET /stats, GET /profile/:address, GET /referrals/:address, GET /leaderboard
 *
 * Reads directly from the SuperAgentRegistry contract on Base Mainnet.
 * All reads are public — no auth required.
 */

import { Router } from "express";
import { ethers } from "ethers";

const SUPER_AGENT_REGISTRY = "0x32A872839eEcE0477c257f6d2fDf72a42D8F5425";
const RPC = process.env.BASE_MAINNET_RPC || "https://mainnet.base.org";

const ABI = [
  "function totalRegistrations() view returns (uint256)",
  "function totalReferralsPaid() view returns (uint256)",
  "function burnAccumulator() view returns (uint256)",
  "function totalAGTBurned() view returns (uint256)",
  "function publicBurnEnabled() view returns (bool)",
  "function minBurnAmount() view returns (uint256)",
  "function REGISTRATION_FEE() view returns (uint256)",
  "function getAgent(address) view returns (bool registered, address referrer, uint256 registeredAt, uint256 referralEarned)",
  "function getReferralChain(address) view returns (address l1, address l2)",
  "function isRegistered(address) view returns (bool)",
  "function protocolStats() view returns (uint256 registrations, uint256 referralsPaidUsdc, uint256 burnPendingUsdc, uint256 agtBurnedWei)",
  "function agentList(uint256) view returns (address)",
  "event AgentRegistered(address indexed agent, address indexed level1Referrer, address indexed level2Referrer, uint256 fee)",
  "event ReferralPaid(address indexed recipient, address indexed newAgent, uint8 level, uint256 amountUsdc)",
  "event BuyAndBurnExecuted(uint256 usdcSpent, uint256 agtBurned)",
];

function getContract() {
  const provider = new ethers.JsonRpcProvider(RPC, undefined, { batchMaxCount: 5 });
  return new ethers.Contract(SUPER_AGENT_REGISTRY, ABI, provider);
}

// Simple in-memory cache (60s TTL)
const cache: Record<string, { data: unknown; ts: number }> = {};
function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache[key];
  if (hit && Date.now() - hit.ts < ttl * 1000) return Promise.resolve(hit.data as T);
  return fn().then(data => {
    cache[key] = { data, ts: Date.now() };
    return data;
  });
}

export function superAgentRouter(): Router {
  const router = Router();

  // ── GET /api/super-agent/stats ────────────────────────────────────────────
  router.get("/stats", async (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=60");
    try {
      const data = await cached("stats", 60, async () => {
        const c = getContract();
        const [regs, referralsPaid, burnPending, agtBurned, burnEnabled, fee] =
          await Promise.all([
            c.totalRegistrations(),
            c.totalReferralsPaid(),
            c.burnAccumulator(),
            c.totalAGTBurned(),
            c.publicBurnEnabled(),
            c.REGISTRATION_FEE(),
          ]);
        return {
          totalRegistrations:  Number(regs),
          totalReferralsPaid:  (Number(referralsPaid) / 1e6).toFixed(2),    // USDC
          burnPendingUsdc:     (Number(burnPending)   / 1e6).toFixed(2),
          totalAGTBurned:      ethers.formatEther(agtBurned),
          publicBurnEnabled:   burnEnabled,
          registrationFeeUsdc: (Number(fee) / 1e6).toFixed(2),
          contract:            SUPER_AGENT_REGISTRY,
        };
      });
      res.json({ stats: data });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/super-agent/profile/:address ─────────────────────────────────
  router.get("/profile/:address", async (req, res) => {
    const addr = req.params.address?.toLowerCase();
    if (!addr || !/^0x[0-9a-f]{40}$/.test(addr)) {
      return res.status(400).json({ error: "Invalid address" });
    }

    try {
      const data = await cached(`profile:${addr}`, 30, async () => {
        const c = getContract();

        let agentData: any, chain: any;
        try {
          [agentData, chain] = await Promise.all([
            c.getAgent(addr),
            c.getReferralChain(addr),
          ]);
        } catch {
          return null; // not registered — contract reverts for unknown addresses
        }

        const [registered, referrer, registeredAt, referralEarned] = agentData;

        if (!registered) return null;

        // Fetch recent events — who this agent recruited
        const filter = c.filters.AgentRegistered(null, addr, null);
        let directRecruits: string[] = [];
        try {
          const logs = await c.queryFilter(filter, -50000); // last ~50k blocks
          directRecruits = logs.map((l: any) => l.args[0].toLowerCase());
        } catch { /* non-fatal */ }

        // Level 2 recruits (registered through direct recruits)
        const filter2 = c.filters.AgentRegistered(null, null, addr);
        let l2Recruits: string[] = [];
        try {
          const logs2 = await c.queryFilter(filter2, -50000);
          l2Recruits = logs2.map((l: any) => l.args[0].toLowerCase());
        } catch { /* non-fatal */ }

        return {
          address:        addr,
          registered,
          registeredAt:   Number(registeredAt),
          referrer:       referrer === ethers.ZeroAddress ? null : referrer.toLowerCase(),
          referralChain: {
            l1: chain[0] === ethers.ZeroAddress ? null : chain[0].toLowerCase(),
            l2: chain[1] === ethers.ZeroAddress ? null : chain[1].toLowerCase(),
          },
          earnings: {
            totalUsdcEarned:    (Number(referralEarned) / 1e6).toFixed(2),
            directRecruits:     directRecruits.length,
            level2Recruits:     l2Recruits.length,
            totalNetworkSize:   directRecruits.length + l2Recruits.length,
          },
          recruits: {
            direct: directRecruits.slice(0, 20),
            level2: l2Recruits.slice(0, 20),
          },
        };
      });

      if (!data) return res.status(404).json({ error: "Address not registered as Super Agent" });
      res.json({ profile: data });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/super-agent/check/:address ───────────────────────────────────
  router.get("/check/:address", async (req, res) => {
    const addr = req.params.address?.toLowerCase();
    if (!addr || !/^0x[0-9a-f]{40}$/.test(addr)) {
      return res.status(400).json({ error: "Invalid address" });
    }
    try {
      const c = getContract();
      const isReg = await c.isRegistered(addr);
      res.json({ address: addr, registered: isReg });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/super-agent/leaderboard ──────────────────────────────────────
  // Top 20 by referral earnings — reads from AgentRegistered events
  router.get("/leaderboard", async (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=120");
    try {
      const data = await cached("leaderboard", 120, async () => {
        const c = getContract();

        // Get total registrations to know how many to fetch
        const total = Number(await c.totalRegistrations());
        if (total === 0) return [];

        // Fetch up to 50 agents (gas-efficient: paginate agentList)
        const fetchCount = Math.min(total, 50);
        const addrs: string[] = [];
        for (let i = 0; i < fetchCount; i++) {
          try {
            const a = await c.agentList(i);
            addrs.push(a.toLowerCase());
          } catch { break; }
        }

        // Fetch earnings for each
        const profiles = await Promise.allSettled(
          addrs.map(async (addr) => {
            const [agentData, chain] = await Promise.all([
              c.getAgent(addr),
              c.getReferralChain(addr),
            ]);
            const [, referrer, registeredAt, referralEarned] = agentData;
            return {
              address:      addr,
              registeredAt: Number(registeredAt),
              referrer:     referrer === ethers.ZeroAddress ? null : referrer.toLowerCase(),
              hasL2:        chain[1] !== ethers.ZeroAddress,
              earnedUsdc:   Number(referralEarned) / 1e6,
            };
          })
        );

        return profiles
          .filter(p => p.status === "fulfilled")
          .map(p => (p as PromiseFulfilledResult<any>).value)
          .sort((a, b) => b.earnedUsdc - a.earnedUsdc)
          .slice(0, 20);
      });

      res.json({ leaderboard: data });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
