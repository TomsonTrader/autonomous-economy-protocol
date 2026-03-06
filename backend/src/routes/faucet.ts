import { Router, Request, Response } from "express";
import { ethers } from "ethers";

const TOKEN_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

// In-memory set of addresses that already received pre-registration AGT
const funded = new Set<string>();

export function faucetRouter(deploymentContracts: { AgentToken: string }): Router {
  const router = Router();

  const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY;
  const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";
  const FAUCET_AMOUNT = ethers.parseEther("15"); // 10 entry fee + 5 buffer

  router.post("/", async (req: Request, res: Response) => {
    const { address } = req.body as { address?: string };

    if (!address || !ethers.isAddress(address)) {
      return res.status(400).json({ error: "Invalid address" });
    }

    const normalized = address.toLowerCase();

    if (funded.has(normalized)) {
      return res.status(429).json({ error: "Address already funded" });
    }

    if (!PRIVATE_KEY) {
      return res.status(503).json({ error: "Faucet not configured" });
    }

    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
      const token = new ethers.Contract(deploymentContracts.AgentToken, TOKEN_ABI, wallet);

      // Check faucet wallet balance
      const balance: bigint = await token.balanceOf(wallet.address);
      if (balance < FAUCET_AMOUNT) {
        return res.status(503).json({ error: "Faucet depleted" });
      }

      const tx = await token.transfer(address, FAUCET_AMOUNT);
      await tx.wait();

      funded.add(normalized);

      return res.json({
        success: true,
        txHash: tx.hash,
        amount: "15",
        message: "15 AGT sent. Use 10 to register, keep 5 as buffer.",
      });
    } catch (err: any) {
      console.error("[Faucet] Error:", err.message);
      return res.status(500).json({ error: "Faucet transaction failed" });
    }
  });

  router.get("/status", async (_req: Request, res: Response) => {
    if (!PRIVATE_KEY) {
      return res.json({ configured: false });
    }
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
      const token = new ethers.Contract(deploymentContracts.AgentToken, TOKEN_ABI, wallet);
      const balance: bigint = await token.balanceOf(wallet.address);
      return res.json({
        configured: true,
        agtBalance: ethers.formatEther(balance),
        funded: funded.size,
      });
    } catch {
      return res.json({ configured: false });
    }
  });

  return router;
}
