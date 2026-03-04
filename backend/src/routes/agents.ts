import { Router, Request, Response } from "express";
import { BlockchainService } from "../services/blockchain";

export function agentsRouter(blockchain: BlockchainService): Router {
  const router = Router();

  // GET /api/agents?capability=data&limit=20
  router.get("/", async (req: Request, res: Response) => {
    try {
      const capability = req.query.capability as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;

      const addresses = await blockchain.registry.getActiveAgents();
      const agents = await Promise.all(
        addresses.slice(0, limit).map((addr: string) => blockchain.getAgentInfo(addr))
      );

      const filtered = capability
        ? agents.filter((a) =>
            a.capabilities.some((c: string) =>
              c.toLowerCase().includes(capability.toLowerCase())
            )
          )
        : agents;

      res.json({ agents: filtered, total: filtered.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/agents/:address
  router.get("/:address", async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      const isRegistered = await blockchain.registry.isRegistered(address);
      if (!isRegistered) {
        return res.status(404).json({ error: "Agent not found" });
      }
      const agent = await blockchain.getAgentInfo(address);
      res.json(agent);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
