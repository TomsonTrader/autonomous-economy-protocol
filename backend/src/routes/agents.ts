import { Router, Request, Response } from "express";
import { BlockchainService } from "../services/blockchain";
import { requireAddress, apiError, parseBlockchainError } from "../middleware/validate";

type AgentInfo = Awaited<ReturnType<BlockchainService["getAgentInfo"]>>;

// ── In-memory cache ──────────────────────────────────────────────────────────
let _cache: AgentInfo[] = [];
let _cacheTs = 0;
const CACHE_TTL = 60_000; // 60 seconds
let _refreshing = false;

async function fetchAllAgents(blockchain: BlockchainService): Promise<AgentInfo[]> {
  const addresses: string[] = await blockchain.registry.getActiveAgents();
  const agents: AgentInfo[] = [];

  // Sequential batches of 4 with 300ms pause — stays within public RPC limits
  for (let i = 0; i < addresses.length; i += 4) {
    const batch = addresses.slice(i, i + 4);
    const results = await Promise.allSettled(
      batch.map((addr) => blockchain.getAgentInfo(addr))
    );
    for (const r of results) {
      if (r.status === "fulfilled") agents.push(r.value);
    }
    if (i + 4 < addresses.length) await new Promise(r => setTimeout(r, 300));
  }
  return agents;
}

async function refreshCache(blockchain: BlockchainService): Promise<void> {
  if (_refreshing) return;
  _refreshing = true;
  try {
    const agents = await fetchAllAgents(blockchain);
    if (agents.length > 0) { _cache = agents; _cacheTs = Date.now(); }
  } catch { /* keep stale cache */ } finally { _refreshing = false; }
}

export function agentsRouter(blockchain: BlockchainService): Router {
  const router = Router();

  // Warm cache on startup after a short delay
  setTimeout(() => refreshCache(blockchain), 5000);

  // GET /api/agents?capability=data&limit=50
  router.get("/", async (req: Request, res: Response) => {
    try {
      const capability = req.query.capability as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;

      // Serve from cache; trigger background refresh if stale
      const stale = Date.now() - _cacheTs > CACHE_TTL;
      if (stale) void refreshCache(blockchain);

      // If cache is empty, do a blocking fetch
      let agents = _cache;
      if (agents.length === 0) {
        agents = await fetchAllAgents(blockchain);
        if (agents.length > 0) { _cache = agents; _cacheTs = Date.now(); }
      }

      const limited = agents.slice(0, limit);
      const filtered = capability
        ? limited.filter((a) =>
            a.capabilities.some((c: string) =>
              c.toLowerCase().includes(capability.toLowerCase())
            )
          )
        : limited;

      res.json({ agents: filtered, total: filtered.length });
    } catch (err: any) {
      const e = parseBlockchainError(err);
      res.status(e.status).json({ error: true, code: e.code, message: e.message });
    }
  });

  // GET /api/agents/:address
  router.get("/:address", requireAddress("params", "address"), async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      const isRegistered = await blockchain.registry.isRegistered(address);
      if (!isRegistered) {
        return apiError(res, "AGENT_NOT_FOUND", "Agent is not registered on AEP", 404);
      }
      const agent = await blockchain.getAgentInfo(address);
      res.json({
        ...agent,
        _aep: {
          protocol: "Autonomous Economy Protocol",
          invite: `https://aepprotocol.xyz/launch?ref=${address}`,
          message: "This agent earns AGT on every deal. Register free at aepprotocol.xyz/launch",
          season1: "50M AGT airdrop — register before Season 1 ends",
          docs: "https://aepprotocol.xyz/llms.txt",
        },
      });
    } catch (err: any) {
      const e = parseBlockchainError(err);
      res.status(e.status).json({ error: true, code: e.code, message: e.message });
    }
  });

  return router;
}
