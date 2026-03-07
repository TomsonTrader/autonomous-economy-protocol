import { Router, Request, Response } from "express";
import { ethers } from "ethers";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const REGISTRY_ABI = [
  "function registerAgent(string name, string[] capabilities, string metadataURI) external",
  "function isRegistered(address) view returns (bool)",
];

const TOKEN_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

export function launchpadRouter(contracts: {
  AgentToken: string;
  AgentRegistry: string;
}): Router {
  const router = Router();

  const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY;
  const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";

  // AGT needed: 10 (entry fee) + 5 (buffer) = 15
  const AGT_AMOUNT  = ethers.parseEther("15");
  // ETH needed for gas (~3 txs at ~200k gas each at ~0.05 gwei)
  const ETH_AMOUNT  = ethers.parseEther("0.00006");

  /**
   * POST /api/launchpad/create
   * Body: { name, capabilities: string[], description?, tags? }
   * Response: { address, privateKey, txHash, message }
   *
   * Creates a new agent wallet, funds it with AGT + ETH (from deployer),
   * and registers it on-chain. Returns the private key so the user can
   * operate the agent with the SDK.
   *
   * ⚠️  The private key is returned ONCE and never stored. If lost, the
   *     agent address still exists on-chain but becomes uncontrollable.
   */
  router.post("/create", async (req: Request, res: Response) => {
    if (!PRIVATE_KEY) {
      return res.status(503).json({ error: "Launchpad not configured (missing DEPLOYER_PRIVATE_KEY)" });
    }

    const { name, capabilities } = req.body as {
      name?: string;
      capabilities?: string[];
    };

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "Agent name is required" });
    }
    if (!Array.isArray(capabilities) || capabilities.length === 0) {
      return res.status(400).json({ error: "At least one capability is required" });
    }

    const cleanName = name.trim().slice(0, 64);
    const cleanCaps = capabilities.slice(0, 10).map((c) => String(c).toLowerCase().trim().slice(0, 32));

    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, { batchMaxCount: 5 });
      const deployer = new ethers.Wallet(PRIVATE_KEY, provider);

      // 1. Create new agent wallet
      const agentWallet = ethers.Wallet.createRandom().connect(provider);

      const token    = new ethers.Contract(contracts.AgentToken,    TOKEN_ABI,    deployer);
      const registry = new ethers.Contract(contracts.AgentRegistry, REGISTRY_ABI, agentWallet);

      // 2. Check deployer has enough AGT and ETH
      const [agtBalance, ethBalance] = await Promise.all([
        token.balanceOf(deployer.address) as Promise<bigint>,
        provider.getBalance(deployer.address),
      ]);

      if (agtBalance < AGT_AMOUNT) {
        return res.status(503).json({ error: "Launchpad AGT depleted" });
      }
      if (ethBalance < ETH_AMOUNT + ethers.parseEther("0.00002")) {
        return res.status(503).json({ error: "Launchpad ETH depleted" });
      }

      // 3. Fund new wallet: ETH + AGT from deployer (sequential, explicit nonces)
      let nonce = await provider.getTransactionCount(deployer.address, "latest");

      const ethTx = await deployer.sendTransaction({
        to: agentWallet.address,
        value: ETH_AMOUNT,
        nonce: nonce++,
      });

      const agtTx = await (token as any).transfer(agentWallet.address, AGT_AMOUNT, { nonce: nonce++ });

      // Wait for both funding txs
      await Promise.all([ethTx.wait(), agtTx.wait()]);

      // 4. New wallet approves registry to pull 10 AGT
      const approveTx = await (new ethers.Contract(contracts.AgentToken, TOKEN_ABI, agentWallet) as any)
        .approve(contracts.AgentRegistry, ethers.parseEther("10"));
      await approveTx.wait();

      // 5. Wait for RPC state propagation (Base public RPC can lag ~2 blocks)
      await sleep(5000);

      // 6. Register the agent on-chain
      const regTx = await registry.registerAgent(cleanName, cleanCaps, "");
      const receipt = await regTx.wait();

      return res.json({
        success: true,
        address: agentWallet.address,
        privateKey: agentWallet.privateKey,
        txHash: receipt.hash,
        name: cleanName,
        capabilities: cleanCaps,
        message: "Agent registered on Base Mainnet. Save your private key — it is shown only once.",
      });

    } catch (err: any) {
      console.error("[Launchpad] Error:", err.message);
      return res.status(500).json({ error: err.message || "Registration failed" });
    }
  });

  // GET /api/launchpad/status — check faucet health
  router.get("/status", async (_req: Request, res: Response) => {
    if (!PRIVATE_KEY) {
      return res.json({ available: false, reason: "Not configured" });
    }
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, { batchMaxCount: 5 });
      const deployer = new ethers.Wallet(PRIVATE_KEY, provider);
      const token = new ethers.Contract(contracts.AgentToken, TOKEN_ABI, deployer);
      const [agtBal, ethBal] = await Promise.all([
        token.balanceOf(deployer.address) as Promise<bigint>,
        provider.getBalance(deployer.address),
      ]);
      return res.json({
        available: agtBal >= AGT_AMOUNT && ethBal >= ETH_AMOUNT,
        agtBalance: ethers.formatEther(agtBal),
        ethBalance: ethers.formatEther(ethBal),
      });
    } catch {
      return res.json({ available: false });
    }
  });

  return router;
}
