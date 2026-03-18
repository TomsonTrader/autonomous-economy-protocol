import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import { EventIndexer } from "../services/indexer";

const TOKEN_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

const REGISTRY_ABI = [
  "function isRegistered(address) view returns (bool)",
];

// ── Singleton wallet + nonce counter — avoids nonce collisions ───────────────
let _wallet: ethers.Wallet | null = null;
let _token: ethers.Contract | null = null;
let _nonce = -1;
const _queue: Array<() => void> = [];
let _busy = false;

async function getWallet(contractAddress: string): Promise<{ wallet: ethers.Wallet; token: ethers.Contract }> {
  if (_wallet && _token) return { wallet: _wallet, token: _token };
  const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY || process.env.DEMO_AGENT_KEY;
  if (!PRIVATE_KEY) throw new Error("not configured");
  const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";
  const provider = new ethers.JsonRpcProvider(RPC_URL, 8453, { batchMaxCount: 1 });
  _wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  _token  = new ethers.Contract(contractAddress, TOKEN_ABI, _wallet);
  _nonce  = await provider.getTransactionCount(_wallet.address);
  return { wallet: _wallet, token: _token };
}

// Serial queue: ensures one AGT tx at a time, incrementing nonce locally
async function sendQueued(to: string, amount: bigint, contractAddress: string): Promise<string> {
  return new Promise((resolve, reject) => {
    _queue.push(async () => {
      try {
        const { token } = await getWallet(contractAddress);
        const tx = await (token as any).transfer(to, amount, { nonce: _nonce++ });
        await tx.wait();
        resolve(tx.hash);
      } catch (e: any) {
        _nonce = -1;
        _wallet = null;
        _token  = null;
        reject(e);
      }
    });
    if (!_busy) void drain();
  });
}

async function drain() {
  if (_busy || _queue.length === 0) return;
  _busy = true;
  while (_queue.length > 0) {
    const fn = _queue.shift()!;
    await fn();
  }
  _busy = false;
}

export function faucetRouter(
  deploymentContracts: { AgentToken: string; AgentRegistry: string },
  indexer: EventIndexer
): Router {
  const router = Router();
  const FAUCET_AMOUNT = ethers.parseEther("15"); // 10 entry fee + 5 buffer

  router.post("/", async (req: Request, res: Response) => {
    const { address } = req.body as { address?: string };

    if (!address || !ethers.isAddress(address) || BigInt(address) === 0n) {
      return res.status(400).json({ error: "Invalid address" });
    }

    const normalized = address.toLowerCase();

    // Check 1: SQLite-backed funded set (survives Railway restarts)
    if (indexer.isFunded(normalized)) {
      return res.status(429).json({ error: "Address already funded" });
    }

    const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY || process.env.DEMO_AGENT_KEY;
    if (!PRIVATE_KEY) {
      return res.status(503).json({ error: "Faucet not configured" });
    }

    try {
      const { wallet, token } = await getWallet(deploymentContracts.AgentToken);

      // Check 2: requester must have any ETH on Base — filters empty throwaway wallets
      const requesterEth: bigint = await wallet.provider!.getBalance(address);
      if (requesterEth === 0n) {
        return res.status(403).json({
          error: "Wallet must have some ETH on Base (any amount > 0) to receive AGT.",
          requiredEth: ">0",
          currentEth: "0",
        });
      }

      // Check 3: on-chain anti-sybil — deny if already registered
      const registry = new ethers.Contract(deploymentContracts.AgentRegistry, REGISTRY_ABI, wallet.provider!);
      const alreadyRegistered = (await registry.isRegistered(address)) as boolean;
      if (alreadyRegistered) {
        indexer.markFunded(normalized);
        return res.status(429).json({ error: "Address already registered on-chain" });
      }

      // Check 4: faucet balance
      const balance: bigint = await (token as any).balanceOf(wallet.address);
      if (balance < FAUCET_AMOUNT) {
        return res.status(503).json({ error: "Faucet depleted" });
      }

      // Mark as funded BEFORE sending — prevents concurrent double-spend
      indexer.markFunded(normalized);

      const txHash = await sendQueued(address, FAUCET_AMOUNT, deploymentContracts.AgentToken);

      return res.json({
        success: true,
        txHash,
        amount: "15",
        message: "15 AGT sent. Use 10 to register, keep 5 as buffer.",
      });
    } catch (err: any) {
      indexer.unmarkFunded(normalized);
      console.error("[Faucet] Error:", err.message);
      return res.status(500).json({ error: "Faucet transaction failed" });
    }
  });

  router.get("/status", async (_req: Request, res: Response) => {
    const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY || process.env.DEMO_AGENT_KEY;
    if (!PRIVATE_KEY) {
      return res.json({ configured: false });
    }
    try {
      const { wallet, token } = await getWallet(deploymentContracts.AgentToken);
      const balance: bigint = await (token as any).balanceOf(wallet.address);
      return res.json({
        configured: true,
        agtBalance: ethers.formatEther(balance),
        funded: indexer.fundedCount(),
      });
    } catch {
      return res.json({ configured: false });
    }
  });

  return router;
}
