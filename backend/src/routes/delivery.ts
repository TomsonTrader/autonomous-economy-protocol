import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import { EventIndexer } from "../services/indexer";
import { WebSocketService } from "../services/websocket";
import { fanoutWebhooks } from "../services/webhookDelivery";
import { apiError, requireAddress } from "../middleware/validate";

/**
 * Delivery Verification System — Multiple Delivery Types
 * ─────────────────────────────────────────────────────────────────────────────
 *  HASH  — generic keccak256 hash of any deliverable
 *  IPFS  — IPFS CID; backend fetches and verifies content hash
 *  URL   — public HTTP URL; backend verifies liveness + content-type
 *  API   — active API endpoint; backend does test call + verifies 2xx JSON
 *
 * All types: seller must sign the canonical proof message with their wallet.
 * On success: buyer gets HTTP webhook (if registered) + WebSocket event.
 *
 * Endpoints:
 *   POST /api/delivery/submit          — seller submits typed proof
 *   GET  /api/delivery/:address        — list proofs for an agreement
 *   GET  /api/delivery/status/:address — latest proof status
 */

const IPFS_GATEWAYS = [
  "https://cloudflare-ipfs.com/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
];

async function fetchIPFS(cid: string): Promise<{ ok: boolean; contentHash?: string; size?: number }> {
  for (const gw of IPFS_GATEWAYS) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10_000);
      const res = await fetch(`${gw}${cid}`, { signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        return { ok: true, contentHash: ethers.keccak256(new Uint8Array(buf)), size: buf.byteLength };
      }
    } catch { /* try next */ }
  }
  return { ok: false };
}

async function verifyURL(url: string): Promise<{ ok: boolean; status?: number; contentType?: string }> {
  for (const method of ["HEAD", "GET"] as const) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8_000);
      const res = await fetch(url, { method, signal: ctrl.signal });
      clearTimeout(t);
      return { ok: res.ok, status: res.status, contentType: res.headers.get("content-type") ?? undefined };
    } catch { /* try GET */ }
  }
  return { ok: false };
}

async function verifyAPI(url: string): Promise<{ ok: boolean; status?: number; isJSON?: boolean }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8_000);
    const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "AEP-Verifier/1.0" }, signal: ctrl.signal });
    clearTimeout(t);
    return { ok: res.ok, status: res.status, isJSON: (res.headers.get("content-type") ?? "").includes("json") };
  } catch {
    return { ok: false };
  }
}

export function deliveryRouter(indexer: EventIndexer, ws: WebSocketService): Router {
  const router = Router();

  // POST /api/delivery/submit
  router.post("/submit", async (req: Request, res: Response) => {
    const {
      agreementAddress, sellerAddress, signature, buyerAddress,
      deliveryType = "hash",
      proofHash: submittedHash, deliveryData,   // HASH
      cid,                                       // IPFS
      url: deliveryUrl,                          // URL
      endpoint, testPath = "/health",            // API
    } = req.body;

    if (!agreementAddress || !/^0x[0-9a-fA-F]{40}$/.test(agreementAddress))
      return apiError(res, "INVALID_AGREEMENT_ADDRESS", "agreementAddress must be a valid Ethereum address");
    if (!sellerAddress || !/^0x[0-9a-fA-F]{40}$/.test(sellerAddress))
      return apiError(res, "INVALID_SELLER_ADDRESS", "sellerAddress must be a valid Ethereum address");
    if (!signature || typeof signature !== "string")
      return apiError(res, "MISSING_SIGNATURE", "signature is required");
    if (!["hash", "ipfs", "url", "api"].includes(deliveryType))
      return apiError(res, "INVALID_DELIVERY_TYPE", "deliveryType must be hash | ipfs | url | api");

    let proofHash: string;
    let canonicalData: string;
    let verification: Record<string, unknown> = {};

    // ── HASH ────────────────────────────────────────────────────────────────
    if (deliveryType === "hash") {
      if (!submittedHash || !/^0x[0-9a-fA-F]{64}$/.test(submittedHash))
        return apiError(res, "INVALID_PROOF_HASH", "proofHash must be a 0x-prefixed keccak256 hash");
      if (!deliveryData || typeof deliveryData !== "string" || deliveryData.length > 4096)
        return apiError(res, "INVALID_DELIVERY_DATA", "deliveryData must be a string ≤4096 chars");
      if (ethers.keccak256(ethers.toUtf8Bytes(deliveryData)).toLowerCase() !== submittedHash.toLowerCase())
        return apiError(res, "PROOF_HASH_MISMATCH", "proofHash does not match keccak256(deliveryData)");
      proofHash     = submittedHash;
      canonicalData = JSON.stringify({ type: "hash", deliveryData });
      verification  = { verified: true, method: "keccak256" };

    // ── IPFS ─────────────────────────────────────────────────────────────────
    } else if (deliveryType === "ipfs") {
      if (!cid || typeof cid !== "string" || cid.length < 10)
        return apiError(res, "INVALID_CID", "cid must be a valid IPFS CID");
      const r = await fetchIPFS(cid);
      if (!r.ok)
        return apiError(res, "IPFS_UNREACHABLE", `Cannot fetch IPFS content for CID: ${cid}`, 422);
      if (submittedHash && submittedHash !== r.contentHash)
        return apiError(res, "IPFS_HASH_MISMATCH", `Content hash ${r.contentHash} ≠ expected ${submittedHash}`, 422);
      proofHash     = r.contentHash!;
      canonicalData = JSON.stringify({ type: "ipfs", cid });
      verification  = { verified: true, method: "ipfs_fetch", cid, contentHash: r.contentHash, sizeBytes: r.size };

    // ── URL ──────────────────────────────────────────────────────────────────
    } else if (deliveryType === "url") {
      if (!deliveryUrl || typeof deliveryUrl !== "string" || !deliveryUrl.startsWith("http") || deliveryUrl.length > 512)
        return apiError(res, "INVALID_URL", "url must be an http/https URL ≤512 chars");
      const r = await verifyURL(deliveryUrl);
      if (!r.ok)
        return apiError(res, "URL_UNREACHABLE", `URL not reachable (HTTP ${r.status}): ${deliveryUrl}`, 422);
      proofHash     = ethers.keccak256(ethers.toUtf8Bytes(deliveryUrl));
      canonicalData = JSON.stringify({ type: "url", url: deliveryUrl });
      verification  = { verified: true, method: "http_check", url: deliveryUrl, httpStatus: r.status, contentType: r.contentType };

    // ── API ──────────────────────────────────────────────────────────────────
    } else {
      if (!endpoint || typeof endpoint !== "string" || !endpoint.startsWith("http") || endpoint.length > 512)
        return apiError(res, "INVALID_ENDPOINT", "endpoint must be an http/https URL ≤512 chars");
      const testUrl = endpoint.replace(/\/$/, "") + (testPath.startsWith("/") ? testPath : "/" + testPath);
      const r = await verifyAPI(testUrl);
      if (!r.ok)
        return apiError(res, "API_UNREACHABLE", `API test call failed (HTTP ${r.status}): ${testUrl}`, 422);
      proofHash     = ethers.keccak256(ethers.toUtf8Bytes(endpoint));
      canonicalData = JSON.stringify({ type: "api", endpoint, testPath });
      verification  = { verified: true, method: "api_test_call", testUrl, httpStatus: r.status, returnsJSON: r.isJSON };
    }

    // ── Verify seller signature ──────────────────────────────────────────────
    const message = `AEP Delivery Proof\nAgreement: ${ethers.getAddress(agreementAddress)}\nProof: ${proofHash}`;
    let signer: string;
    try { signer = ethers.verifyMessage(message, signature); }
    catch { return apiError(res, "INVALID_SIGNATURE", "Could not recover signer from signature"); }
    if (signer.toLowerCase() !== sellerAddress.toLowerCase())
      return apiError(res, "SIGNATURE_MISMATCH", `Signature by ${signer}, not by ${sellerAddress}`, 401);

    // ── Persist ──────────────────────────────────────────────────────────────
    const proofId = indexer.saveDeliveryProof({
      agreementAddress: ethers.getAddress(agreementAddress),
      sellerAddress:    ethers.getAddress(sellerAddress),
      proofHash, deliveryData: canonicalData, signature, deliveryType,
    });

    const eventData = { proofId, agreementAddress, sellerAddress, proofHash, deliveryType, verification, timestamp: new Date().toISOString() };
    ws.broadcastEvent("DeliveryProofSubmitted", eventData);

    if (buyerAddress && /^0x[0-9a-fA-F]{40}$/.test(buyerAddress)) {
      const subs = indexer.getWebhooksForEvent(buyerAddress, "DeliveryProofSubmitted");
      if (subs.length > 0) {
        fanoutWebhooks(subs, {
          event: "DeliveryProofSubmitted",
          timestamp: new Date().toISOString(),
          data: { ...eventData, message: "Seller submitted a verified delivery proof. Call confirmDelivery() on-chain." },
        }).then(r => { if (r.some(x => x.success)) indexer.markWebhookSent(proofId); }).catch(() => {});
      }
    }

    return res.status(201).json({
      success: true, proofId, deliveryType, agreementAddress, sellerAddress, proofHash,
      verification,
      message: "Delivery proof verified and accepted.",
      nextStep: "Buyer should call AutonomousAgreement.confirmDelivery() on-chain to release payment.",
    });
  });

  // GET /api/delivery/:address
  router.get("/:address", requireAddress("params", "address"), (req: Request, res: Response) => {
    const proofs = indexer.getDeliveryProofs(req.params.address);
    return res.json({ proofs, count: proofs.length });
  });

  // GET /api/delivery/status/:address
  router.get("/status/:address", requireAddress("params", "address"), (req: Request, res: Response) => {
    const latest = indexer.getLatestDeliveryProof(req.params.address);
    if (!latest) return res.json({ agreementAddress: req.params.address, status: "NO_PROOF", message: "No proof submitted yet." });
    return res.json({
      agreementAddress: req.params.address,
      status: "PROOF_SUBMITTED",
      proofId: latest.id,
      deliveryType: latest.delivery_type,
      sellerAddress: latest.seller_address,
      proofHash: latest.proof_hash,
      webhookSent: latest.webhook_sent === 1,
      submittedAt: new Date(latest.created_at * 1000).toISOString(),
    });
  });

  return router;
}
