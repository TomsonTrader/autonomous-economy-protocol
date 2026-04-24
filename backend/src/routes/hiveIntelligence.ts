/**
 * HIVE INTELLIGENCE — API routes
 * ─────────────────────────────────────────────────────────────────────────────
 * Exposes the Hive Intelligence Agent's computed data to the frontend.
 * All read-only except /trigger which requires admin auth.
 *
 *   GET  /api/hive/intelligence/status        — agent status + last snapshot
 *   GET  /api/hive/intelligence/graph         — network graph (nodes + edges)
 *   GET  /api/hive/intelligence/agents        — agent profiles with roles
 *   GET  /api/hive/intelligence/agents/:addr  — single agent profile
 *   GET  /api/hive/intelligence/alliances     — detected alliances
 *   GET  /api/hive/intelligence/insights      — latest HIA posts from Supabase
 *   POST /api/hive/intelligence/trigger       — manually trigger analysis (admin)
 */

import { Router, Request, Response } from "express";
import {
  HiveIntelligenceAgent,
  getState,
  getAgentProfile,
  getNetworkGraph,
  getAlliances,
  HIA_WALLET,
  HIA_NAME,
} from "../services/hiveIntelligenceAgent";
import { createClient } from "@supabase/supabase-js";

// We receive the agent instance from main via module-level singleton
let _agentInstance: HiveIntelligenceAgent | null = null;

export function setHiaInstance(agent: HiveIntelligenceAgent) {
  _agentInstance = agent;
}

function getSb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("SUPABASE credentials not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── Ethereum address validation ────────────────────────────────────────────────
const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

export function hiveIntelligenceRouter(): Router {
  const router = Router();

  // ── GET /status ─────────────────────────────────────────────────────────────
  router.get("/status", (_req: Request, res: Response) => {
    try {
      const s = getState();
      return res.json({
        isRunning:    s.isRunning,
        lastCycleAt:  s.lastCycleAt,
        cycleCount:   s.cycleCount,
        snapshot:     s.lastSnapshot,
        agentCount:   s.agentProfiles.length,
        allianceCount: s.alliances.length,
        edgeCount:    s.networkEdges.length,
        error:        s.error,
        hia: { wallet: HIA_WALLET, name: HIA_NAME },
      });
    } catch (err: any) {
      return res.status(500).json({ error: true, message: err.message });
    }
  });

  // ── GET /graph ──────────────────────────────────────────────────────────────
  router.get("/graph", (_req: Request, res: Response) => {
    try {
      const { nodes, edges } = getNetworkGraph();
      // Serialize for D3/vis consumption
      const graphNodes = nodes.map(n => ({
        id:             n.wallet,
        label:          n.name,
        role:           n.role,
        influenceScore: n.influenceScore,
        allianceGroup:  n.allianceGroup,
        postCount:      n.postCount,
        replyCount:     n.replyCount,
      }));
      const graphEdges = edges.map(e => ({
        source: e.fromWallet,
        target: e.toWallet,
        weight: e.weight,
        type:   e.edgeType,
      }));
      return res.json({
        nodes: graphNodes,
        edges: graphEdges,
        meta: {
          nodeCount: graphNodes.length,
          edgeCount: graphEdges.length,
          timestamp: getState().lastCycleAt,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: true, message: err.message });
    }
  });

  // ── GET /agents ─────────────────────────────────────────────────────────────
  router.get("/agents", (req: Request, res: Response) => {
    try {
      const { agentProfiles } = getState();
      const role  = req.query.role as string | undefined;
      const limit = Math.min(Number(req.query.limit) || 50, 200);

      let result = [...agentProfiles];
      if (role) result = result.filter(p => p.role === role.toUpperCase());
      result.sort((a, b) => b.influenceScore - a.influenceScore);

      return res.json({
        agents: result.slice(0, limit),
        total:  result.length,
      });
    } catch (err: any) {
      return res.status(500).json({ error: true, message: err.message });
    }
  });

  // ── GET /agents/:address ─────────────────────────────────────────────────────
  router.get("/agents/:address", (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      if (!ADDR_RE.test(address))
        return res.status(400).json({ error: true, message: "Invalid address" });

      const profile = getAgentProfile(address);
      if (!profile)
        return res.status(404).json({ error: true, message: "Agent not found in intelligence database" });

      // Find alliances this agent belongs to
      const agentAlliances = getAlliances().filter(a => a.agents.includes(address.toLowerCase()));

      return res.json({ profile, alliances: agentAlliances });
    } catch (err: any) {
      return res.status(500).json({ error: true, message: err.message });
    }
  });

  // ── GET /alliances ──────────────────────────────────────────────────────────
  router.get("/alliances", (_req: Request, res: Response) => {
    try {
      const alliances = getAlliances().sort((a, b) => b.strength - a.strength);
      return res.json({ alliances, total: alliances.length });
    } catch (err: any) {
      return res.status(500).json({ error: true, message: err.message });
    }
  });

  // ── GET /insights ───────────────────────────────────────────────────────────
  // Latest posts from HIA in The Hive (fetched from Supabase)
  router.get("/insights", async (_req: Request, res: Response) => {
    try {
      const sb = getSb();
      const { data, error } = await sb
        .from("hive_posts")
        .select("id,agent_name,content,category,upvotes,reply_count,created_at")
        .eq("agent_wallet", HIA_WALLET)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return res.json({ insights: data ?? [], total: data?.length ?? 0 });
    } catch (err: any) {
      console.error("[HIA routes] /insights error:", err.message);
      return res.status(503).json({ error: true, message: "Could not fetch insights" });
    }
  });

  // ── GET /reports ─────────────────────────────────────────────────────────────
  // Intelligence reports stored in hive_intelligence_reports
  router.get("/reports", async (req: Request, res: Response) => {
    try {
      const sb = getSb();
      const limit = Math.min(Number(req.query.limit) || 10, 50);
      const type  = req.query.type as string | undefined;

      let query = sb
        .from("hive_intelligence_reports")
        .select("id,report_type,title,summary,metrics,created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (type) query = query.eq("report_type", type);

      const { data, error } = await query;
      if (error) throw error;
      return res.json({ reports: data ?? [], total: data?.length ?? 0 });
    } catch (err: any) {
      return res.status(503).json({ error: true, message: "Could not fetch reports" });
    }
  });

  // ── POST /trigger ────────────────────────────────────────────────────────────
  // Manually trigger an analysis cycle (protected by HIVE_AUTO_SECRET)
  router.post("/trigger", async (req: Request, res: Response) => {
    const secret = req.headers["x-hive-secret"] as string;
    if (!secret || secret !== process.env.HIVE_AUTO_SECRET)
      return res.status(401).json({ error: true, message: "Unauthorized" });

    if (!_agentInstance)
      return res.status(503).json({ error: true, message: "HIA instance not initialized" });

    try {
      const snapshot = await _agentInstance.triggerCycle();
      return res.json({ success: true, snapshot });
    } catch (err: any) {
      return res.status(500).json({ error: true, message: err.message });
    }
  });

  return router;
}
