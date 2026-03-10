import { Router, Request, Response } from "express";
import { BlockchainService } from "../services/blockchain";
import { requireAddress, apiError, parseBlockchainError } from "../middleware/validate";

export function agentsRouter(blockchain: BlockchainService): Router {
  const router = Router();

  // GET /api/agents?capability=data&limit=20
  router.get("/", async (req: Request, res: Response) => {
    try {
      const capability = req.query.capability as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;

      const addresses = await blockchain.registry.getActiveAgents();
      const results = await Promise.allSettled(
        addresses.slice(0, limit).map((addr: string) => blockchain.getAgentInfo(addr))
      );
      const agents = results
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof blockchain.getAgentInfo>>> => r.status === "fulfilled")
        .map((r) => r.value);

      const filtered = capability
        ? agents.filter((a) =>
            a.capabilities.some((c: string) =>
              c.toLowerCase().includes(capability.toLowerCase())
            )
          )
        : agents;

      res.json({ agents: filtered, total: filtered.length });
    } catch (err: any) {
      const e = parseBlockchainError(err); res.status(e.status).json({ error: true, code: e.code, message: e.message });
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
      res.json(agent);
    } catch (err: any) {
      const e = parseBlockchainError(err); res.status(e.status).json({ error: true, code: e.code, message: e.message });
    }
  });

  return router;
}
