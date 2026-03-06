import { Router, Request, Response } from "express";
import { BlockchainService } from "../services/blockchain";
import { ethers } from "ethers";

export function marketRouter(blockchain: BlockchainService): Router {
  const router = Router();

  // GET /api/market/needs?tag=data&maxBudget=100
  router.get("/needs", async (req: Request, res: Response) => {
    try {
      const tag = req.query.tag as string | undefined;
      const maxBudget = req.query.maxBudget ? ethers.parseEther(req.query.maxBudget as string) : undefined;
      const total = Number(await blockchain.marketplace.totalNeeds());

      const needs = [];
      for (let i = 0; i < total; i++) {
        try {
          const need = await blockchain.getNeed(i);
          if (!need.active) continue;
          if (tag && !need.tags.some((t: string) => t.toLowerCase().includes(tag.toLowerCase()))) continue;
          if (maxBudget && ethers.parseEther(need.budget) > maxBudget) continue;
          needs.push(need);
        } catch { /* skip corrupted entries */ }
      }

      res.json({ needs, total: needs.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/market/offers?tag=data&maxPrice=100
  router.get("/offers", async (req: Request, res: Response) => {
    try {
      const tag = req.query.tag as string | undefined;
      const maxPrice = req.query.maxPrice ? ethers.parseEther(req.query.maxPrice as string) : undefined;
      const total = Number(await blockchain.marketplace.totalOffers());

      const offers = [];
      for (let i = 0; i < total; i++) {
        try {
          const offer = await blockchain.getOffer(i);
          if (!offer.active) continue;
          if (tag && !offer.tags.some((t: string) => t.toLowerCase().includes(tag.toLowerCase()))) continue;
          if (maxPrice && ethers.parseEther(offer.price) > maxPrice) continue;
          offers.push(offer);
        } catch { /* skip corrupted entries */ }
      }

      res.json({ offers, total: offers.length });
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
