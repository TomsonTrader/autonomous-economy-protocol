import { Router, Request, Response } from "express";
import { BlockchainService } from "../services/blockchain";
import { EventIndexer } from "../services/indexer";
import { requireAddress, apiError, parseBlockchainError } from "../middleware/validate";

export function agentsRouter(blockchain: BlockchainService, indexer: EventIndexer): Router {
  const router = Router();

  // GET /api/agents?capability=data&limit=50
  router.get("/", async (req: Request, res: Response) => {
    try {
      const capability = req.query.capability as string | undefined;
      const limit = parseInt(req.query.limit as string) || 100;

      // Always read from SQLite — always fast, always available
      let agents = indexer.getStoredAgents();

      if (capability) {
        agents = agents.filter((a: any) =>
          (a.capabilities as string[])?.some((c: string) =>
            c.toLowerCase().includes(capability.toLowerCase())
          )
        );
      }

      res.json({ agents: agents.slice(0, limit), total: agents.length });
    } catch (err: any) {
      const e = parseBlockchainError(err);
      res.status(e.status).json({ error: true, code: e.code, message: e.message });
    }
  });

  // GET /api/agents/:address
  router.get("/:address", requireAddress("params", "address"), async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      const isRegistered = await blockchain.registry.isRegistered(address).catch(() => false);
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
