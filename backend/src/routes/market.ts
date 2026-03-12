import { Router, Request, Response } from "express";
import { BlockchainService } from "../services/blockchain";
import { ethers } from "ethers";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function retryRpc<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e: any) {
      if (i === attempts - 1) throw e;
      await sleep(1500 * (i + 1));
    }
  }
  throw new Error("unreachable");
}

// ── In-memory cache ──────────────────────────────────────────────────────────
type CachedNeeds  = Awaited<ReturnType<BlockchainService["getNeed"]>>[];
type CachedOffers = Awaited<ReturnType<BlockchainService["getOffer"]>>[];

let _needs: CachedNeeds  = [];
let _offers: CachedOffers = [];
let _needsTs  = 0;
let _offersTs = 0;
const TTL = 90_000; // 90 seconds
let _loadingNeeds  = false;
let _loadingOffers = false;

async function loadAllNeeds(blockchain: BlockchainService): Promise<CachedNeeds> {
  const total = Number(await retryRpc(() => blockchain.marketplace.totalNeeds()));
  const needs: CachedNeeds = [];
  for (let i = 0; i < total; i++) {
    try {
      const need = await retryRpc(() => blockchain.getNeed(i));
      needs.push(need);
    } catch { /* skip */ }
    // small pause every 10 to stay within RPC rate limits
    if (i > 0 && i % 10 === 0) await sleep(200);
  }
  return needs;
}

async function loadAllOffers(blockchain: BlockchainService): Promise<CachedOffers> {
  const total = Number(await retryRpc(() => blockchain.marketplace.totalOffers()));
  const offers: CachedOffers = [];
  for (let i = 0; i < total; i++) {
    try {
      const offer = await retryRpc(() => blockchain.getOffer(i));
      offers.push(offer);
    } catch { /* skip */ }
    if (i > 0 && i % 10 === 0) await sleep(200);
  }
  return offers;
}

async function refreshNeeds(blockchain: BlockchainService): Promise<void> {
  if (_loadingNeeds) return;
  _loadingNeeds = true;
  try {
    const needs = await loadAllNeeds(blockchain);
    if (needs.length > 0) { _needs = needs; _needsTs = Date.now(); }
  } catch { /* keep stale */ } finally { _loadingNeeds = false; }
}

async function refreshOffers(blockchain: BlockchainService): Promise<void> {
  if (_loadingOffers) return;
  _loadingOffers = true;
  try {
    const offers = await loadAllOffers(blockchain);
    if (offers.length > 0) { _offers = offers; _offersTs = Date.now(); }
  } catch { /* keep stale */ } finally { _loadingOffers = false; }
}

export function marketRouter(blockchain: BlockchainService): Router {
  const router = Router();

  // Warm caches on startup — 15s delay for Railway cold-start RPC stability
  setTimeout(() => { void refreshNeeds(blockchain); void refreshOffers(blockchain); }, 15000);

  // GET /api/market/needs?tag=data&maxBudget=100
  router.get("/needs", async (req: Request, res: Response) => {
    try {
      const tag       = req.query.tag as string | undefined;
      const maxBudget = req.query.maxBudget ? (() => { try { return ethers.parseEther(req.query.maxBudget as string); } catch { return undefined; } })() : undefined;

      if (Date.now() - _needsTs > TTL) void refreshNeeds(blockchain);
      let needs = _needs;
      if (needs.length === 0) {
        try { needs = await loadAllNeeds(blockchain); _needs = needs; _needsTs = Date.now(); }
        catch { needs = _needs; } // serve stale on RPC error
      }

      const filtered = needs.filter(n => {
        if (!n.active) return false;
        if (tag && !n.tags.some((t: string) => t.toLowerCase().includes(tag.toLowerCase()))) return false;
        if (maxBudget && ethers.parseEther(n.budget) > maxBudget) return false;
        return true;
      });

      res.json({ needs: filtered, total: filtered.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/market/offers?tag=data&maxPrice=100
  router.get("/offers", async (req: Request, res: Response) => {
    try {
      const tag      = req.query.tag as string | undefined;
      const maxPrice = req.query.maxPrice ? (() => { try { return ethers.parseEther(req.query.maxPrice as string); } catch { return undefined; } })() : undefined;

      if (Date.now() - _offersTs > TTL) void refreshOffers(blockchain);
      let offers = _offers;
      if (offers.length === 0) {
        try { offers = await loadAllOffers(blockchain); _offers = offers; _offersTs = Date.now(); }
        catch { offers = _offers; } // serve stale on RPC error
      }

      const filtered = offers.filter(o => {
        if (!o.active) return false;
        if (tag && !o.tags.some((t: string) => t.toLowerCase().includes(tag.toLowerCase()))) return false;
        if (maxPrice && ethers.parseEther(o.price) > maxPrice) return false;
        return true;
      });

      res.json({ offers: filtered, total: filtered.length });
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
