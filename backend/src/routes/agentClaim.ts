/**
 * Agent Airdrop Claims — AEP
 *
 * Routes:
 *   POST /api/agent/claim          — wallet path (RainbowKit/any EVM wallet)
 *   POST /api/agent/claim-superagent — Super Agent auto-claim (registered on-chain)
 *
 * Anti-sybil:
 *   - wallet path:      EIP-191 signature + balance > 0 + nonce >= 1 + 1 claim/wallet
 *   - superagent path:  EIP-191 signature + registered in SuperAgentRegistry + 1 claim/wallet
 *
 * Tracking: Supabase table `agent_airdrops`
 *   CREATE TABLE IF NOT EXISTS agent_airdrops (
 *     wallet     TEXT PRIMARY KEY,
 *     type       TEXT NOT NULL,   -- 'wallet' | 'superagent'
 *     tx_hash    TEXT,
 *     created_at TIMESTAMPTZ DEFAULT NOW()
 *   );
 */

import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import { createClient } from "@supabase/supabase-js";

// ── Supabase ──────────────────────────────────────────────────────────────────
function getSupabase() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set");
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── AGT transfer ──────────────────────────────────────────────────────────────
const AGT_ABI      = ["function transfer(address to, uint256 amount) returns (bool)"];
const AGT_CONTRACT = "0x6dE70b5B0953A220420E142f51AE47B6Fd5b7101";
const AIRDROP_WEI  = 500n * 10n ** 18n; // 500 AGT

// ── SuperAgentRegistry ABI (minimal) ─────────────────────────────────────────
const SA_ABI      = ["function getAgent(address) view returns (bool registered, address referrer, uint256 registeredAt, uint256 referralEarned)"];
const SA_CONTRACT = "0x32A872839eEcE0477c257f6d2fDf72a42D8F5425";

function getProvider() {
  return new ethers.JsonRpcProvider(process.env.RPC_URL || "https://mainnet.base.org");
}

async function sendAGT(to: string): Promise<string> {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY not set");
  const signer   = new ethers.Wallet(pk, getProvider());
  const contract = new ethers.Contract(AGT_CONTRACT, AGT_ABI, signer);
  const tx: ethers.ContractTransactionResponse = await (contract as any).transfer(to, AIRDROP_WEI);
  await tx.wait(1);
  return tx.hash;
}

function apiError(res: Response, code: string, message: string, status = 400) {
  return res.status(status).json({ error: { code, message } });
}

// ── Signature verification ────────────────────────────────────────────────────
// Expected message: "AEP airdrop claim: <wallet_lowercase> <timestamp_seconds>"
// Timestamp must be within 5 minutes to prevent replay attacks.
function verifyClaimSignature(wallet: string, message: string, signature: string): boolean {
  try {
    const recovered = ethers.verifyMessage(message, signature).toLowerCase();
    if (recovered !== wallet.toLowerCase()) return false;

    // Parse timestamp from message and check freshness (5 min window)
    const parts = message.split(" ");
    const ts    = parseInt(parts[parts.length - 1], 10);
    if (isNaN(ts)) return false;
    const age = Math.floor(Date.now() / 1000) - ts;
    return age >= 0 && age <= 300; // 0-300 seconds
  } catch {
    return false;
  }
}

// ── Already claimed? ──────────────────────────────────────────────────────────
async function isAlreadyClaimed(wallet: string): Promise<boolean> {
  try {
    const sb = getSupabase();
    const { data } = await sb
      .from("agent_airdrops")
      .select("wallet")
      .eq("wallet", wallet.toLowerCase())
      .maybeSingle();
    return !!data;
  } catch {
    return false; // DB error — don't block, log below
  }
}

async function recordClaim(wallet: string, type: string, txHash: string) {
  const sb = getSupabase();
  await sb.from("agent_airdrops").upsert({
    wallet:    wallet.toLowerCase(),
    type,
    tx_hash:   txHash,
    created_at: new Date().toISOString(),
  }, { onConflict: "wallet" });
}

// ── Router ────────────────────────────────────────────────────────────────────
export function agentClaimRouter(): Router {
  const router = Router();

  // ── POST /api/agent/claim ─────────────────────────────────────────────────
  // Wallet path: any EVM wallet via RainbowKit/MetaMask/etc.
  // Body: { wallet, signature, message }
  router.post("/claim", async (req: Request, res: Response) => {
    try {
      const { wallet, signature, message } = req.body ?? {};

      if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
        return apiError(res, "INVALID_WALLET", "Valid Ethereum wallet address required");
      }
      if (!signature || !message) {
        return apiError(res, "MISSING_SIGNATURE", "signature and message are required");
      }

      // 1. Verify EIP-191 signature
      if (!verifyClaimSignature(wallet, message, signature)) {
        return apiError(res, "INVALID_SIGNATURE", "Signature is invalid or expired (5 min window)");
      }

      // 2. Check not already claimed
      if (await isAlreadyClaimed(wallet)) {
        return apiError(res, "ALREADY_CLAIMED", "Airdrop already claimed for this wallet");
      }

      const provider = getProvider();

      // 3. Anti-sybil: balance > 0 ETH on Base
      const balance = await provider.getBalance(wallet);
      if (balance === 0n) {
        return apiError(res, "INACTIVE_WALLET", "Wallet must have ETH on Base to claim");
      }

      // 4. Anti-sybil: nonce >= 1 (at least one prior transaction)
      const nonce = await provider.getTransactionCount(wallet);
      if (nonce < 1) {
        return apiError(res, "NEW_WALLET", "Wallet must have at least 1 prior transaction on Base");
      }

      // 5. Send 500 AGT
      const txHash = await sendAGT(wallet);
      await recordClaim(wallet, "wallet", txHash);

      console.log(`[AgentClaim] wallet claim: ${wallet} → tx ${txHash}`);
      return res.json({
        success: true,
        airdrop_amount: "500",
        tx_hash: txHash,
        message: "500 AGT sent to your wallet. Welcome to AEP!",
      });
    } catch (e: any) {
      console.error("[AgentClaim] claim error:", e.message);
      return res.status(500).json({ error: { code: "CLAIM_FAILED", message: e.message } });
    }
  });

  // ── POST /api/agent/claim-superagent ─────────────────────────────────────
  // Super Agent auto-claim: registered in SuperAgentRegistry → 500 AGT free.
  // Body: { wallet, signature, message }
  router.post("/claim-superagent", async (req: Request, res: Response) => {
    try {
      const { wallet, signature, message } = req.body ?? {};

      if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
        return apiError(res, "INVALID_WALLET", "Valid Ethereum wallet address required");
      }
      if (!signature || !message) {
        return apiError(res, "MISSING_SIGNATURE", "signature and message are required");
      }

      // 1. Verify EIP-191 signature
      if (!verifyClaimSignature(wallet, message, signature)) {
        return apiError(res, "INVALID_SIGNATURE", "Signature is invalid or expired (5 min window)");
      }

      // 2. Check not already claimed
      if (await isAlreadyClaimed(wallet)) {
        return apiError(res, "ALREADY_CLAIMED", "Airdrop already claimed for this wallet");
      }

      // 3. Verify registered in SuperAgentRegistry on-chain
      try {
        const contract = new ethers.Contract(SA_CONTRACT, SA_ABI, getProvider());
        const [registered] = await contract.getAgent(wallet);
        if (!registered) {
          return apiError(res, "NOT_SUPER_AGENT", "Wallet is not registered as a Super Agent", 403);
        }
      } catch {
        return apiError(res, "CONTRACT_ERROR", "Could not verify Super Agent status — try again", 500);
      }

      // 4. Send 500 AGT
      const txHash = await sendAGT(wallet);
      await recordClaim(wallet, "superagent", txHash);

      console.log(`[AgentClaim] superagent claim: ${wallet} → tx ${txHash}`);
      return res.json({
        success: true,
        airdrop_amount: "500",
        tx_hash: txHash,
        message: "500 AGT sent. Welcome to the Super Agent program!",
      });
    } catch (e: any) {
      console.error("[AgentClaim] superagent claim error:", e.message);
      return res.status(500).json({ error: { code: "CLAIM_FAILED", message: e.message } });
    }
  });

  // ── GET /api/agent/claim-status/:wallet ──────────────────────────────────
  // Public — check if a wallet has already claimed.
  router.get("/claim-status/:wallet", async (req: Request, res: Response) => {
    try {
      const wallet = req.params.wallet?.toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(wallet)) {
        return apiError(res, "INVALID_WALLET", "Invalid address");
      }
      const claimed = await isAlreadyClaimed(wallet);
      return res.json({ wallet, claimed });
    } catch (e: any) {
      return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: e.message } });
    }
  });

  return router;
}
