import { Router } from "express";
import { ethers } from "ethers";
import { BlockchainService } from "../services/blockchain";

export function referralRouter(blockchain: BlockchainService): Router {
  const router = Router();

  // GET /api/referral — protocol-wide referral stats
  // Note: ReferralNetwork has no global totals view — returns contract address + per-agent query instructions
  router.get("/", async (_req, res) => {
    return res.json({
      contract: blockchain.referral
        ? blockchain.deployment.contracts.ReferralNetwork
        : null,
      available: !!blockchain.referral,
      note: "Query individual agent referral data via GET /api/referral/:address",
      endpoints: {
        agentData:       "GET /api/referral/:address",
        networkSize:     "GET /api/referral/:address (includes networkSize field)",
      },
    });
  });

  // GET /api/referral/:address
  router.get("/:address", async (req, res) => {
    try {
      if (!blockchain.referral) return res.json({ found: false });
      const { address } = req.params;
      const [data, networkSize] = await Promise.all([
        blockchain.referral.getReferralData(address),
        blockchain.referral.getNetworkSize(address),
      ]);
      return res.json({
        address,
        referrer:          data.referrer === ethers.ZeroAddress ? null : data.referrer,
        totalEarned:       ethers.formatEther(data.totalEarned),
        claimableEarnings: ethers.formatEther(data.claimableEarnings),
        directReferrals:   Number(data.directReferrals),
        totalNetworkDeals: Number(data.totalNetworkDeals),
        networkSize:       Number(networkSize),
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
