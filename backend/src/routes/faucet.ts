import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

const TOKEN_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

const REGISTRY_ABI = [
  "function isRegistered(address) view returns (bool)",
];

// ── Persistent funded set — survives Railway restarts ─────────────────────────
function getFundedPath(): string {
  // Railway production: /app is the working dir
  if (fs.existsSync("/app") && process.env.RAILWAY_ENVIRONMENT) {
    return "/app/funded-addresses.json";
  }
  return path.join(__dirname, "../../../funded-addresses.json");
}

function loadFunded(): Set<string> {
  try {
    const raw = fs.readFileSync(getFundedPath(), "utf-8");
    const arr: string[] = JSON.parse(raw);
    return new Set(arr.map(a => a.toLowerCase()));
  } catch {
    return new Set();
  }
}

function saveFunded(funded: Set<string>): void {
  try {
    fs.writeFileSync(getFundedPath(), JSON.stringify([...funded], null, 0), "utf-8");
  } catch (e: any) {
    console.error("[Faucet] Failed to persist funded set:", e.message);
  }
}

// Load from disk at module init — survives server restarts
const funded = loadFunded();
console.log(`[Faucet] Loaded ${funded.size} previously funded addresses from disk`);

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
        const tx = await token.transfer(to, amount, { nonce: _nonce++ });
        await tx.wait();
        resolve(tx.hash);
      } catch (e: any) {
        // On error reset nonce so next call re-fetches it
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

export function faucetRouter(deploymentContracts: { AgentToken: string; AgentRegistry: string }): Router {
  const router = Router();
  const FAUCET_AMOUNT = ethers.parseEther("15"); // 10 entry fee + 5 buffer

  router.post("/", async (req: Request, res: Response) => {
    const { address } = req.body as { address?: string };

    if (!address || !ethers.isAddress(address)) {
      return res.status(400).json({ error: "Invalid address" });
    }

    const normalized = address.toLowerCase();

    // Check 1: in-memory + file-backed funded set
    if (funded.has(normalized)) {
      return res.status(429).json({ error: "Address already funded" });
    }

    const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY || process.env.DEMO_AGENT_KEY;
    if (!PRIVATE_KEY) {
      return res.status(503).json({ error: "Faucet not configured" });
    }

    try {
      const { wallet, token } = await getWallet(deploymentContracts.AgentToken);

      // Check 2: requester must have ETH on Base — filters throwaway wallets
      const MIN_ETH = ethers.parseEther("0.0001");
      const requesterEth: bigint = await wallet.provider!.getBalance(address);
      if (requesterEth < MIN_ETH) {
        return res.status(403).json({
          error: "Wallet must have at least 0.0001 ETH on Base to receive AGT. Add a small amount of ETH first.",
          requiredEth: "0.0001",
          currentEth: ethers.formatEther(requesterEth),
        });
      }

      // Check 3: on-chain anti-sybil — deny if already registered
      const registry = new ethers.Contract(deploymentContracts.AgentRegistry, REGISTRY_ABI, wallet.provider!);
      const alreadyRegistered = (await registry.isRegistered(address)) as boolean;
      if (alreadyRegistered) {
        // Mark funded so we skip the on-chain call next time
        funded.add(normalized);
        saveFunded(funded);
        return res.status(429).json({ error: "Address already registered on-chain" });
      }

      // Check 4: faucet balance
      const balance: bigint = await token.balanceOf(wallet.address);
      if (balance < FAUCET_AMOUNT) {
        return res.status(503).json({ error: "Faucet depleted" });
      }

      // Mark as funded BEFORE sending — prevents concurrent double-spend
      funded.add(normalized);
      saveFunded(funded);

      const txHash = await sendQueued(address, FAUCET_AMOUNT, deploymentContracts.AgentToken);

      return res.json({
        success: true,
        txHash,
        amount: "15",
        message: "15 AGT sent. Use 10 to register, keep 5 as buffer.",
      });
    } catch (err: any) {
      // Rollback only if the error is NOT a duplicate check
      if (funded.has(normalized)) {
        funded.delete(normalized);
        saveFunded(funded);
      }
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
