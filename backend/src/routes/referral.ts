import { Router } from "express";
import { ethers } from "ethers";
import { BlockchainService } from "../services/blockchain";

export function referralRouter(blockchain: BlockchainService): Router {
  const router = Router();

  // GET /api/referral — protocol-wide referral stats
  router.get("/", async (_req, res) => {
    try {
      if (!blockchain.referral) return res.json({ found: false });
      const [totalReferrals, totalRewards] = await Promise.all([
        blockchain.referral.totalReferrals().catch(() => 0n),
        blockchain.referral.totalRewardsDistributed().catch(() => 0n),
      ]);
      return res.json({
        totalReferrals:        Number(totalReferrals),
        totalRewardsDistributed: ethers.formatEther(totalRewards),
        contract:              blockchain.deployment.contracts.ReferralNetwork,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
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
