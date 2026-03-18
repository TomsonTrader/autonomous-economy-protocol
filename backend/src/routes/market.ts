import { Router, Request, Response } from "express";
import { BlockchainService } from "../services/blockchain";
import { EventIndexer } from "../services/indexer";
import { ethers } from "ethers";

export function marketRouter(blockchain: BlockchainService, indexer: EventIndexer): Router {
  const router = Router();

  // GET /api/market/needs?tag=data&maxBudget=100&activeOnly=true
  router.get("/needs", (req: Request, res: Response) => {
    try {
      const tag       = req.query.tag as string | undefined;
      const maxBudget = req.query.maxBudget as string | undefined;
      const activeOnly = req.query.activeOnly !== "false"; // default true

      let needs = indexer.getStoredNeeds(activeOnly);

      if (tag) needs = needs.filter((n: any) =>
        (n.tags as string[])?.some(t => t.toLowerCase().includes(tag.toLowerCase()))
      );
      if (maxBudget) {
        try {
          const max = ethers.parseEther(maxBudget);
          needs = needs.filter((n: any) => { try { return ethers.parseEther(n.budget) <= max; } catch { return true; } });
        } catch { /* ignore bad param */ }
      }

      res.json({ needs, total: needs.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/market/offers?tag=data&maxPrice=100&activeOnly=true
  router.get("/offers", (req: Request, res: Response) => {
    try {
      const tag      = req.query.tag as string | undefined;
      const maxPrice = req.query.maxPrice as string | undefined;
      const activeOnly = req.query.activeOnly !== "false"; // default true

      let offers = indexer.getStoredOffers(activeOnly);

      if (tag) offers = offers.filter((o: any) =>
        (o.tags as string[])?.some(t => t.toLowerCase().includes(tag.toLowerCase()))
      );
      if (maxPrice) {
        try {
          const max = ethers.parseEther(maxPrice);
          offers = offers.filter((o: any) => { try { return ethers.parseEther(o.price) <= max; } catch { return true; } });
        } catch { /* ignore bad param */ }
      }

      res.json({ offers, total: offers.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/market/proposals
  router.get("/proposals", (_req: Request, res: Response) => {
    try {
      const proposals = indexer.getStoredProposals();
      res.json({ proposals, total: proposals.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/market/deals — funded deals from event index
  router.get("/deals", (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt((req.query.limit as string) ?? "") || 50, 200);
      const events = indexer.getRecentEvents(limit, "DealFunded");
      const deals = events.map((e: any) => ({
        agreementAddress: e.data.agreementAddress ?? e.data.agreement ?? null,
        proposalId:       e.data.proposalId       ?? null,
        buyer:            e.data.buyer            ?? null,
        seller:           e.data.seller           ?? null,
        amount:           e.data.amount           ?? null,
        txHash:           e.tx_hash,
        blockNumber:      e.block_number,
        timestamp:        e.timestamp,
      }));
      res.json({ deals, total: deals.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/market/needs/:id/matching-offers
  router.get("/needs/:id/matching-offers", async (req: Request, res: Response) => {
    try {
      const needId = parseInt(req.params.id);
      const matchingIds = await blockchain.marketplace.getMatchingOffers(needId);
      const offers = await Promise.all(
        (matchingIds as bigint[]).map((id) => blockchain.getOffer(Number(id)))
      );
      res.json({ offers, total: offers.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/market/needs/:id
  router.get("/needs/:id", async (req: Request, res: Response) => {
    try {
      const need = await blockchain.getNeed(parseInt(req.params.id));
      res.json(need);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/market/offers/:id
  router.get("/offers/:id", async (req: Request, res: Response) => {
    try {
      const offer = await blockchain.getOffer(parseInt(req.params.id));
      res.json(offer);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
