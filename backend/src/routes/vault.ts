import { Router } from "express";
import { ethers } from "ethers";
import { BlockchainService } from "../services/blockchain";

export function vaultRouter(blockchain: BlockchainService): Router {
  const router = Router();

  /**
   * GET /api/vault  (alias for /api/vault/stats)
   */
  router.get("/", async (_req, res) => {
    try {
      if (!blockchain.vault) {
        return res.status(503).json({ error: "AgentVault not available on this network" });
      }
      const [totalStaked, yieldPool] = await Promise.all([
        blockchain.vault.totalStaked().catch(() => 0n),
        blockchain.vault.yieldPool().catch(() => 0n),
      ]);
      return res.json({
        totalStaked: ethers.formatEther(totalStaked),
        yieldPool:   ethers.formatEther(yieldPool),
        contract:    blockchain.deployment.contracts.AgentVault,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/vault/stats
   * Returns protocol-wide vault statistics.
   */
  router.get("/stats", async (_req, res) => {
    try {
      if (!blockchain.vault) {
        return res.status(503).json({ error: "AgentVault not available on this network" });
      }
      const vault = blockchain.vault;
      const [totalStaked, yieldPool] = await Promise.all([
        vault.totalStaked(),
        vault.yieldPool(),
      ]);
      return res.json({
        totalStaked: ethers.formatEther(totalStaked),
        yieldPool:   ethers.formatEther(yieldPool),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/vault/:address
   * Returns staking tier, credit limit, pending yield, and debt for an agent.
   */
  router.get("/:address", async (req, res) => {
    try {
      const { address } = req.params;
      if (!ethers.isAddress(address)) {
        return res.status(400).json({ error: "Invalid address" });
      }
      if (!blockchain.vault) {
        return res.status(503).json({ error: "AgentVault not available on this network" });
      }
      const vault = blockchain.vault;
      const [vaultData, tier, creditLimit, pendingYield] = await Promise.all([
        vault.getVault(address).catch(() => ({ staked: 0n, unstakePending: 0n, borrowed: 0n, yieldAccrued: 0n, lastYieldUpdate: 0n, unstakeRequestedAt: 0n })),
        vault.getTier(address).catch(() => 0n),
        vault.getCreditLimit(address).catch(() => 0n),
        vault.getPendingYield(address).catch(() => 0n),
      ]);
      return res.json({
        address,
        staked:         ethers.formatEther(vaultData.staked ?? 0n),
        tier:           Number(tier),
        unstakePending: ethers.formatEther(vaultData.unstakePending ?? 0n),
        borrowed:       ethers.formatEther(vaultData.borrowed ?? 0n),
        creditLimit:    ethers.formatEther(creditLimit),
        pendingYield:   ethers.formatEther(pendingYield),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
