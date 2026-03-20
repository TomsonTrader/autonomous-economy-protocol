/**
 * Human Operators — AEP Human Branch
 * Routes: POST /register, POST /claim, GET /profile, GET /stats
 *
 * Auth: Supabase Auth JWT passed in Authorization: Bearer <token>
 * The backend uses SUPABASE_SERVICE_KEY (bypasses RLS) for all DB writes.
 * The JWT is verified by calling supabase.auth.getUser(token) — this returns
 * the authenticated user's id and email.
 */

import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import { createClient } from "@supabase/supabase-js";

// ── Supabase admin client (service key — bypasses RLS) ───────────────────────
const SUPABASE_URL         = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

// ── AGT contract (minimal ABI for transfer) ───────────────────────────────────
const AGT_ABI = ["function transfer(address to, uint256 amount) returns (bool)"];
const AGT_CONTRACT = "0x6dE70b5B0953A220420E142f51AE47B6Fd5b7101";

const AIRDROP_AMOUNT_AGT = 500n; // 500 AGT
const AIRDROP_WEI        = AIRDROP_AMOUNT_AGT * 10n ** 18n;
const REFERRAL_BONUS_WEI = 50n  * 10n ** 18n;  // 50 AGT per referral

// ── Helpers ───────────────────────────────────────────────────────────────────
function apiError(res: Response, code: string, message: string, status = 400) {
  return res.status(status).json({ error: { code, message } });
}

function isValidEthAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

/** Extract and verify Supabase JWT from Authorization header */
async function getAuthUser(req: Request): Promise<{ id: string; email: string } | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  try {
    const sb = getSupabase();
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user?.email) return null;
    return { id: data.user.id, email: data.user.email };
  } catch {
    return null;
  }
}

/** Send AGT from deployer wallet to target address */
async function sendAGT(toAddress: string, amountWei: bigint): Promise<string> {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) throw new Error("DEPLOYER_PRIVATE_KEY not set");

  const provider = new ethers.JsonRpcProvider(
    process.env.RPC_URL || "https://mainnet.base.org"
  );
  const signer   = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(AGT_CONTRACT, AGT_ABI, signer);
  const tx: ethers.ContractTransactionResponse = await (contract as any).transfer(toAddress, amountWei);
  await tx.wait(1);
  return tx.hash;
}

// ── Router ────────────────────────────────────────────────────────────────────
export function humanRouter(): Router {
  const router = Router();

  // ── POST /api/human/register ─────────────────────────────────────────────────
  // Creates a human_profiles row for the authenticated Supabase user.
  // Body (optional): { display_name, source, referred_by }
  router.post("/register", async (req, res) => {
    try {
      const user = await getAuthUser(req);
      if (!user) return apiError(res, "UNAUTHORIZED", "Valid Supabase auth token required", 401);

      const { display_name, source, referred_by } = req.body ?? {};
      const sb = getSupabase();

      // Check if profile already exists
      const { data: existing } = await sb
        .from("human_profiles")
        .select("id, referral_code")
        .eq("id", user.id)
        .maybeSingle();

      if (existing) {
        return res.json({ success: true, created: false, profile: existing });
      }

      // Validate referred_by code (if provided)
      let validReferredBy: string | null = null;
      if (referred_by && typeof referred_by === "string" && referred_by.length <= 16) {
        const { data: referrer } = await sb
          .from("human_profiles")
          .select("id")
          .eq("referral_code", referred_by.trim())
          .maybeSingle();
        if (referrer) validReferredBy = referred_by.trim();
      }

      const { data: profile, error } = await sb
        .from("human_profiles")
        .insert({
          id:           user.id,
          email:        user.email,
          display_name: display_name?.trim() || null,
          source:       source?.trim() || null,
          referred_by:  validReferredBy,
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({ success: true, created: true, profile });
    } catch (e: any) {
      console.error("[Human] register error:", e.message);
      return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: e.message } });
    }
  });

  // ── POST /api/human/claim ─────────────────────────────────────────────────────
  // Sends 500 AGT to the wallet provided. One-time per user.
  // Body: { wallet: "0x..." }
  router.post("/claim", async (req, res) => {
    try {
      const user = await getAuthUser(req);
      if (!user) return apiError(res, "UNAUTHORIZED", "Valid Supabase auth token required", 401);

      const { wallet } = req.body ?? {};
      if (!wallet || !isValidEthAddress(wallet)) {
        return apiError(res, "INVALID_WALLET", "Valid Ethereum wallet address required");
      }
      const walletLc = wallet.toLowerCase();

      const sb = getSupabase();

      // Load profile
      const { data: profile, error: profileErr } = await sb
        .from("human_profiles")
        .select("id, airdrop_claimed, wallet, referred_by")
        .eq("id", user.id)
        .maybeSingle();

      if (profileErr) throw profileErr;
      if (!profile) return apiError(res, "PROFILE_NOT_FOUND", "Register first via POST /api/human/register", 404);
      if (profile.airdrop_claimed) {
        return apiError(res, "ALREADY_CLAIMED", "Airdrop already claimed for this account");
      }

      // Anti-sybil: check wallet not used by another account
      const { data: walletTaken } = await sb
        .from("human_profiles")
        .select("id")
        .eq("wallet", walletLc)
        .neq("id", user.id)
        .maybeSingle();

      if (walletTaken) {
        return apiError(res, "WALLET_TAKEN", "This wallet address is already linked to another account");
      }

      // Send 500 AGT
      const txHash = await sendAGT(wallet, AIRDROP_WEI);

      // Update profile: mark claimed + set wallet
      await sb.from("human_profiles").update({
        wallet:          walletLc,
        airdrop_claimed: true,
        airdrop_tx_hash: txHash,
        last_seen:       new Date().toISOString(),
      }).eq("id", user.id);

      // Referral bonus — send 50 AGT to referrer if they exist and have a wallet
      let referralTxHash: string | null = null;
      if (profile.referred_by) {
        try {
          const { data: referrer } = await sb
            .from("human_profiles")
            .select("wallet")
            .eq("referral_code", profile.referred_by)
            .maybeSingle();

          if (referrer?.wallet) {
            referralTxHash = await sendAGT(referrer.wallet, REFERRAL_BONUS_WEI);
          }
        } catch (refErr: any) {
          // Referral bonus failure is non-fatal — log and continue
          console.warn("[Human] Referral bonus failed:", refErr.message);
        }
      }

      return res.json({
        success:           true,
        airdrop_amount:    "500",
        tx_hash:           txHash,
        referral_tx_hash:  referralTxHash,
        message:           "500 AGT sent to your wallet. Welcome to AEP!",
      });
    } catch (e: any) {
      console.error("[Human] claim error:", e.message);
      return res.status(500).json({ error: { code: "CLAIM_FAILED", message: e.message } });
    }
  });

  // ── GET /api/human/profile ────────────────────────────────────────────────────
  // Returns the authenticated user's profile.
  router.get("/profile", async (req, res) => {
    try {
      const user = await getAuthUser(req);
      if (!user) return apiError(res, "UNAUTHORIZED", "Valid Supabase auth token required", 401);

      const sb = getSupabase();
      const { data, error } = await sb
        .from("human_profiles")
        .select("id, email, wallet, display_name, referral_code, referred_by, airdrop_claimed, airdrop_tx_hash, airdrop_amount, source, created_at, last_seen")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return apiError(res, "PROFILE_NOT_FOUND", "Profile not found", 404);

      // Update last_seen (fire-and-forget)
      void sb.from("human_profiles").update({ last_seen: new Date().toISOString() }).eq("id", user.id);

      return res.json({ profile: data });
    } catch (e: any) {
      return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: e.message } });
    }
  });

  // ── GET /api/human/stats ──────────────────────────────────────────────────────
  // Public stats — no auth required.
  router.get("/stats", async (_req, res) => {
    try {
      res.setHeader("Cache-Control", "public, max-age=60");
      const sb = getSupabase();
      const { data, error } = await sb.from("human_stats").select("*").single();
      if (error) throw error;
      return res.json({ stats: data });
    } catch (e: any) {
      // Fallback: raw count query
      try {
        const sb = getSupabase();
        const { count } = await sb.from("human_profiles").select("*", { count: "exact", head: true });
        return res.json({ stats: { total_humans: count ?? 0 } });
      } catch {
        return res.json({ stats: { total_humans: 0 } });
      }
    }
  });

  return router;
}
