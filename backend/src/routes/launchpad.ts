import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

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

const VALID_TEMPLATES: Record<string, string[]> = {
  "data-provider":  ["data", "analytics", "onchain"],
  "content-agent":  ["content", "nlp", "translation"],
  "oracle-agent":   ["pricing", "oracle", "market"],
  "audit-bot":      ["security", "audit", "solidity"],
};

// In-memory daily rate limit for managed launches
let managedDailyCount = 0;
let managedDayStart   = Date.now();
const MANAGED_DAILY_MAX = 10;

function checkManagedRateLimit(): boolean {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  if (now - managedDayStart > dayMs) {
    managedDayStart   = now;
    managedDailyCount = 0;
  }
  if (managedDailyCount >= MANAGED_DAILY_MAX) return false;
  managedDailyCount++;
  return true;
}

// Resolve managed-agents.json path: Railway uses /app, local uses repo root
function getManagedAgentsPath(): string {
  // Try Railway production path first (/app is the Railway working dir)
  const railwayPath = "/app/managed-agents.json";
  const repoPath    = path.join(__dirname, "../../../managed-agents.json");
  // Use repo path in dev, Railway path in prod (when /app exists)
  if (fs.existsSync("/app") && process.env.RAILWAY_ENVIRONMENT) {
    return railwayPath;
  }
  return repoPath;
}

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
  // DEPRECATED — use POST /api/faucet + MetaMask flow instead
  router.post("/create", async (_req: Request, res: Response) => {
    return res.status(410).json({
      error: "This endpoint is deprecated. Use the /launch page with MetaMask — the protocol no longer funds agent wallets with ETH.",
    });
  });

  router.post("/create_disabled", async (req: Request, res: Response) => {
    if (!PRIVATE_KEY) {
      return res.status(503).json({ error: "Launchpad not configured (missing DEPLOYER_PRIVATE_KEY)" });
    }

    const { name, capabilities, referrer } = req.body as {
      name?: string;
      capabilities?: string[];
      referrer?: string;
    };

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "Agent name is required" });
    }
    if (!Array.isArray(capabilities) || capabilities.length === 0) {
      return res.status(400).json({ error: "At least one capability is required" });
    }

    const cleanName = name.trim().slice(0, 64);
    const cleanCaps = capabilities.slice(0, 10).map((c) => String(c).toLowerCase().trim().slice(0, 32));
    const cleanReferrer = referrer && /^0x[0-9a-fA-F]{40}$/.test(referrer) ? referrer : undefined;

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
      // If referrer provided, register it on ReferralNetwork after registration
      const regTx = await registry.registerAgent(cleanName, cleanCaps, "");
      const receipt = await regTx.wait();

      return res.json({
        success: true,
        address: agentWallet.address,
        privateKey: agentWallet.privateKey,
        txHash: receipt.hash,
        name: cleanName,
        referrer: cleanReferrer || null,
        capabilities: cleanCaps,
        message: "Agent registered on Base Mainnet. Save your private key — it is shown only once.",
      });

    } catch (err: any) {
      console.error("[Launchpad] Error:", err.message);
      return res.status(500).json({ error: err.message || "Registration failed" });
    }
  });

  // POST /api/launchpad/managed
  // Body: { template, name, ownerAddress? }
  // Creates a new agent wallet, funds it, registers on-chain, saves config, and returns the address.
  router.post("/managed", async (req: Request, res: Response) => {
    if (!PRIVATE_KEY) {
      return res.status(503).json({ error: "Launchpad not configured (missing DEPLOYER_PRIVATE_KEY)" });
    }

    // Rate limit: max 10 per day globally
    if (!checkManagedRateLimit()) {
      return res.status(429).json({ error: "Daily managed agent limit reached. Try again tomorrow." });
    }

    const { template, name, ownerAddress } = req.body as {
      template?: string;
      name?: string;
      ownerAddress?: string;
    };

    // Validate template
    if (!template || !VALID_TEMPLATES[template]) {
      return res.status(400).json({ error: "Invalid template. Choose: data-provider, content-agent, oracle-agent, audit-bot" });
    }

    // Validate name
    if (!name || typeof name !== "string" || name.trim().length < 2 || name.trim().length > 64) {
      return res.status(400).json({ error: "Agent name must be 2–64 characters" });
    }

    const cleanName    = name.trim();
    const capabilities = VALID_TEMPLATES[template];
    const cleanOwner   = ownerAddress && /^0x[0-9a-fA-F]{40}$/.test(ownerAddress) ? ownerAddress : undefined;

    // ETH for gas (covers ~5 txs) and AGT for registration + operations
    const MANAGED_ETH = ethers.parseEther("0.0001");
    const MANAGED_AGT = ethers.parseEther("15");

    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, { batchMaxCount: 5 });
      const deployer  = new ethers.Wallet(PRIVATE_KEY, provider);

      // 1. Create new agent wallet
      const agentWallet = ethers.Wallet.createRandom().connect(provider);

      const deployerToken = new ethers.Contract(contracts.AgentToken, TOKEN_ABI, deployer);

      // 2. Check deployer balances
      const [agtBal, ethBal] = await Promise.all([
        deployerToken.balanceOf(deployer.address) as Promise<bigint>,
        provider.getBalance(deployer.address),
      ]);
      if ((agtBal as bigint) < MANAGED_AGT) {
        return res.status(503).json({ error: "Launchpad AGT depleted — try again later" });
      }
      if ((ethBal as bigint) < MANAGED_ETH + ethers.parseEther("0.0001")) {
        return res.status(503).json({ error: "Launchpad ETH depleted — try again later" });
      }

      // 3. Fund agent wallet: ETH + AGT (sequential nonces)
      let deployerNonce = await provider.getTransactionCount(deployer.address, "latest");

      const ethFundTx = await deployer.sendTransaction({
        to: agentWallet.address,
        value: MANAGED_ETH,
        nonce: deployerNonce++,
      });

      const agtFundTx = await (deployerToken as any).transfer(
        agentWallet.address,
        MANAGED_AGT,
        { nonce: deployerNonce++ }
      );

      await Promise.all([ethFundTx.wait(), agtFundTx.wait()]);
      console.log(`[Launchpad/Managed] Funded ${agentWallet.address} with ETH + AGT`);

      // 4. Agent wallet approves AgentRegistry to pull 10 AGT
      const agentToken = new ethers.Contract(contracts.AgentToken, TOKEN_ABI, agentWallet);
      const approveTx  = await (agentToken as any).approve(
        contracts.AgentRegistry,
        ethers.parseEther("10")
      );
      await approveTx.wait();

      // 5. Wait for RPC propagation
      await sleep(4000);

      // 6. Register agent on-chain
      const registry = new ethers.Contract(contracts.AgentRegistry, REGISTRY_ABI, agentWallet);
      const regTx    = await registry.registerAgent(cleanName, capabilities, "");
      const receipt  = await regTx.wait();

      console.log(`[Launchpad/Managed] Registered ${cleanName} (${template}) at ${agentWallet.address}`);

      // 7. Persist config to managed-agents.json
      const configPath = getManagedAgentsPath();
      let existing: unknown[] = [];
      if (fs.existsSync(configPath)) {
        try {
          existing = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        } catch {
          existing = [];
        }
      }
      existing.push({
        address:      agentWallet.address,
        privateKey:   agentWallet.privateKey,
        template,
        name:         cleanName,
        ownerAddress: cleanOwner || null,
        createdAt:    Math.floor(Date.now() / 1000),
      });
      fs.writeFileSync(configPath, JSON.stringify(existing, null, 2), "utf-8");

      return res.json({
        success:  true,
        address:  agentWallet.address,
        txHash:   receipt.hash,
        template,
        name:     cleanName,
      });

    } catch (err: any) {
      console.error("[Launchpad/Managed] Error:", err.message);
      return res.status(500).json({ error: err.message || "Managed launch failed" });
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
