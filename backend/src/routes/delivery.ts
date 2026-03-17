import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import { EventIndexer } from "../services/indexer";
import { WebSocketService } from "../services/websocket";
import { fanoutWebhooks } from "../services/webhookDelivery";
import { apiError, requireAddress } from "../middleware/validate";

/**
 * Delivery Verification System
 * ─────────────────────────────────────────────────────────────────────────────
 * Sellers submit a cryptographic proof that they delivered a service.
 * The backend verifies the signature, stores the proof, and fires webhooks
 * to any callback URLs the buyer has registered.
 *
 * The buyer's agent can then call AutonomousAgreement.confirmDelivery() on-chain.
 *
 * Endpoints:
 *   POST /api/delivery/submit        — seller submits proof
 *   GET  /api/delivery/:address      — list proofs for an agreement
 *   GET  /api/delivery/status/:address — latest proof status
 */
export function deliveryRouter(indexer: EventIndexer, ws: WebSocketService): Router {
  const router = Router();

  // ── POST /api/delivery/submit ──────────────────────────────────────────────
  //
  // Body: {
  //   agreementAddress  : string  (0x…)
  //   sellerAddress     : string  (0x…)
  //   proofHash         : string  (keccak256 of deliveryData, 0x-prefixed hex)
  //   deliveryData      : string  (JSON-serialised delivery result, max 4KB)
  //   signature         : string  (seller signed the message with their wallet)
  //   buyerAddress      : string  (0x…, optional — used to look up buyer webhooks)
  // }
  //
  // Signature message format (EIP-191 personal_sign):
  //   "AEP Delivery Proof\nAgreement: <agreementAddress>\nProof: <proofHash>"
  //
  router.post("/submit", async (req: Request, res: Response) => {
    const { agreementAddress, sellerAddress, proofHash, deliveryData, signature, buyerAddress } = req.body;

    // ── Input validation ────────────────────────────────────────────────────
    if (!agreementAddress || !/^0x[0-9a-fA-F]{40}$/.test(agreementAddress))
      return apiError(res, "INVALID_AGREEMENT_ADDRESS", "agreementAddress must be a valid Ethereum address");

    if (!sellerAddress || !/^0x[0-9a-fA-F]{40}$/.test(sellerAddress))
      return apiError(res, "INVALID_SELLER_ADDRESS", "sellerAddress must be a valid Ethereum address");

    if (!proofHash || !/^0x[0-9a-fA-F]{64}$/.test(proofHash))
      return apiError(res, "INVALID_PROOF_HASH", "proofHash must be a 0x-prefixed 32-byte keccak256 hash");

    if (!deliveryData || typeof deliveryData !== "string" || deliveryData.length > 4096)
      return apiError(res, "INVALID_DELIVERY_DATA", "deliveryData must be a string of max 4096 chars");

    if (!signature || typeof signature !== "string")
      return apiError(res, "MISSING_SIGNATURE", "signature is required");

    // ── Verify signature ────────────────────────────────────────────────────
    // The seller must sign: "AEP Delivery Proof\nAgreement: <addr>\nProof: <hash>"
    // using personal_sign (EIP-191) — compatible with ethers.js + MetaMask.
    const message = `AEP Delivery Proof\nAgreement: ${ethers.getAddress(agreementAddress)}\nProof: ${proofHash}`;
    let recoveredAddress: string;
    try {
      recoveredAddress = ethers.verifyMessage(message, signature);
    } catch {
      return apiError(res, "INVALID_SIGNATURE", "Could not recover signer from signature");
    }

    if (recoveredAddress.toLowerCase() !== sellerAddress.toLowerCase()) {
      return apiError(
        res,
        "SIGNATURE_MISMATCH",
        `Signature was made by ${recoveredAddress}, not by sellerAddress ${sellerAddress}`,
        401
      );
    }

    // ── Verify proofHash matches deliveryData ────────────────────────────────
    const expectedHash = ethers.keccak256(ethers.toUtf8Bytes(deliveryData));
    if (expectedHash.toLowerCase() !== proofHash.toLowerCase()) {
      return apiError(
        res,
        "PROOF_HASH_MISMATCH",
        "proofHash does not match keccak256(deliveryData)"
      );
    }

    // ── Persist proof ────────────────────────────────────────────────────────
    const proofId = indexer.saveDeliveryProof({
      agreementAddress: ethers.getAddress(agreementAddress),
      sellerAddress:    ethers.getAddress(sellerAddress),
      proofHash,
      deliveryData,
      signature,
    });

    // ── Broadcast via WebSocket ──────────────────────────────────────────────
    ws.broadcastEvent("DeliveryProofSubmitted", {
      proofId,
      agreementAddress,
      sellerAddress,
      proofHash,
      timestamp: new Date().toISOString(),
    });

    // ── Fire webhooks to buyer (non-blocking) ────────────────────────────────
    let webhookResults: Array<{ url: string; success: boolean }> = [];
    if (buyerAddress && /^0x[0-9a-fA-F]{40}$/.test(buyerAddress)) {
      const subscribers = indexer.getWebhooksForEvent(buyerAddress, "DeliveryProofSubmitted");
      if (subscribers.length > 0) {
        fanoutWebhooks(subscribers, {
          event: "DeliveryProofSubmitted",
          timestamp: new Date().toISOString(),
          data: {
            proofId,
            agreementAddress,
            sellerAddress,
            proofHash,
            deliveryData,
            message: "Seller has submitted a delivery proof. Review and call confirmDelivery() on-chain.",
          },
        }).then(results => {
          webhookResults = results;
          const sent = results.filter(r => r.success).length;
          if (sent > 0) indexer.markWebhookSent(proofId);
          console.log(`[Delivery] Webhooks fired: ${sent}/${results.length} successful`);
        }).catch(() => {});
      }
    }

    return res.status(201).json({
      success: true,
      proofId,
      agreementAddress,
      sellerAddress,
      proofHash,
      message: "Delivery proof accepted. Buyer has been notified (if webhook registered).",
      nextStep: "Buyer should call AutonomousAgreement.confirmDelivery() on-chain to release payment.",
    });
  });

  // ── GET /api/delivery/:address — all proofs for an agreement ──────────────
  router.get(
    "/:address",
    requireAddress("params", "address"),
    (req: Request, res: Response) => {
      const proofs = indexer.getDeliveryProofs(req.params.address);
      return res.json({ proofs, count: proofs.length });
    }
  );

  // ── GET /api/delivery/status/:address — latest proof summary ──────────────
  router.get(
    "/status/:address",
    requireAddress("params", "address"),
    (req: Request, res: Response) => {
      const latest = indexer.getLatestDeliveryProof(req.params.address);
      if (!latest) {
        return res.json({
          agreementAddress: req.params.address,
          status: "NO_PROOF",
          message: "No delivery proof has been submitted for this agreement yet.",
        });
      }
      return res.json({
        agreementAddress: req.params.address,
        status: "PROOF_SUBMITTED",
        proofId: latest.id,
        sellerAddress: latest.seller_address,
        proofHash: latest.proof_hash,
        webhookSent: latest.webhook_sent === 1,
        submittedAt: new Date(latest.created_at * 1000).toISOString(),
        message: "Delivery proof on file. Awaiting buyer confirmation on-chain.",
      });
    }
  );

  return router;
}
