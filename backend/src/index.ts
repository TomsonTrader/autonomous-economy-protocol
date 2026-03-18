import * as dotenv from "dotenv";
// Local dev: load from root .env. Railway/production: env vars injected by platform.
dotenv.config({ path: require("path").join(__dirname, "../../.env") });

import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import http from "http";
import * as path from "path";
import { BlockchainService } from "./services/blockchain";
import { WebSocketService } from "./services/websocket";
import { EventIndexer } from "./services/indexer";
import { ManagedAgentService } from "./services/managedAgents";
import { agentsRouter } from "./routes/agents";
import { marketRouter } from "./routes/market";
import { monitorRouter } from "./routes/monitor";
import { faucetRouter } from "./routes/faucet";
import { vaultRouter } from "./routes/vault";
import { premiumRouter } from "./routes/premium";
import { genesisRouter } from "./routes/genesis";
import { launchpadRouter } from "./routes/launchpad";
import { referralRouter } from "./routes/referral";
import { deliveryRouter } from "./routes/delivery";
import { webhooksRouter } from "./routes/webhooks";
import { dealsRouter } from "./routes/deals";
import { subscriptionsRouter } from "./routes/subscriptions";
import { DealMonitor } from "./services/dealMonitor";

// x402 — HTTP micropayment middleware (Coinbase)
// Loaded with require() to avoid ESM/CJS type conflicts
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { paymentMiddleware, x402ResourceServer } = require("@x402/express") as any;

// AEP Treasury wallet — receives USDC micropayments from premium API calls
const AEP_TREASURY = "0x8CCB591C94D419687c4C6dDfdd9F789cc29Bd0Fd";
// USDC on Base Mainnet
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const PORT = parseInt(process.env.PORT || "3001");

// Prevent unhandled RPC polling errors (eth_getLogs rate-limit, filter expiry)
// from crashing the process — ethers.js v6 doesn't always emit these as provider errors
process.on("unhandledRejection", (reason: any) => {
  const msg: string = reason?.message ?? String(reason);
  if (
    msg.includes("missing response") ||
    msg.includes("maximum") ||
    msg.includes("filter not found") ||
    msg.includes("BAD_DATA")
  ) {
    return; // suppress known public-RPC rate-limit / polling errors
  }
  console.error("[Unhandled Rejection]", reason);
});

async function main() {
  console.log("🤖 Autonomous Economy Protocol — Backend starting...");

  // Initialize services
  let blockchain: BlockchainService;
  try {
    blockchain = new BlockchainService();
    console.log(`✅ Connected to ${blockchain.deployment.network}`);
    console.log(`   Contracts: AgentRegistry @ ${blockchain.deployment.contracts.AgentRegistry}`);
  } catch (err: any) {
    console.error(`❌ Blockchain connection failed: ${err.message}`);
    console.error("   Make sure you have deployed contracts and set NETWORK in .env");
    process.exit(1);
  }

  // Express app
  const app = express();
  // Security headers
  app.use(helmet({ contentSecurityPolicy: false }));

  // CORS — allow dashboard + any agent integration
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "https://aepprotocol.xyz,https://autonomous-economy-protocol-1.vercel.app").split(",");
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin) || origin.startsWith("http://localhost")) cb(null, true);
      else cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }));

  // Rate limiting — 200 req/15min per IP (generous for agents)
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false }));
  app.use(express.json());

  // Create HTTP server (needed for WebSocket)
  const server = http.createServer(app);

  // WebSocket service
  const wsService = new WebSocketService(server);
  console.log("✅ WebSocket server ready at /ws");

  // Event indexer
  const indexer = new EventIndexer(blockchain, wsService);
  await indexer.startListening();

  // Full sync: blockchain → SQLite on startup (non-blocking)
  // First sync at 10s to let RPC settle after cold start
  setTimeout(() => indexer.syncFromChain().catch(e => console.warn("[DataStore] Startup sync error:", e.message)), 10_000);

  // Periodic sync every 5 minutes — keeps SQLite fresh without hammering RPC
  setInterval(() => indexer.syncFromChain().catch(() => {}), 5 * 60_000);

  // Managed agents — load persisted configs and start background loops
  const managedAgentConfigPath = path.join(__dirname, "../../../managed-agents.json");
  const managedAgentService = new ManagedAgentService(
    process.env.BACKEND_URL || "https://autonomous-economy-protocol-production.up.railway.app"
  );
  await managedAgentService.start(managedAgentConfigPath);

  // Routes
  app.use("/api/agents", agentsRouter(blockchain, indexer));
  app.use("/api/market", marketRouter(blockchain, indexer));
  app.use("/api/monitor", monitorRouter(blockchain, indexer));
  app.use("/api/reputation", monitorRouter(blockchain, indexer));
  app.use("/api/faucet", faucetRouter(blockchain.deployment.contracts, indexer));
  app.use("/api/vault", vaultRouter(blockchain));
  app.use("/api/genesis", genesisRouter(blockchain));
  app.use("/api/referral",       referralRouter(blockchain));
  app.use("/api/referrals",      referralRouter(blockchain));       // audit-compatible alias
  app.use("/api/subscriptions",  subscriptionsRouter(blockchain));  // SubscriptionManager
  app.use("/api/delivery", deliveryRouter(indexer, wsService));
  app.use("/api/webhooks", webhooksRouter(indexer));
  app.use("/api/deals",    dealsRouter(indexer));
  app.use("/api/launchpad", launchpadRouter(blockchain.deployment.contracts));

  // Deal monitor — watches deadlines and fires webhook alerts
  const dealMonitor = new DealMonitor(indexer, wsService);
  dealMonitor.start();

  // x402 — premium routes gated by USDC micropayments (0.001 USDC / request)
  // Only active on base-mainnet; skipped on other networks to keep dev experience smooth.
  if (blockchain.deployment.network === "base-mainnet") {
    try {
      const resourceServer = new x402ResourceServer("https://x402.org/facilitator");
      const x402Routes = {
        "/api/market/premium": {
          price: "$0.001",
          network: "base-mainnet",
          asset: { address: USDC_BASE, decimals: 6 },
          receiver: AEP_TREASURY,
        },
      };
      app.use(paymentMiddleware(x402Routes, resourceServer));
      app.use("/api/market/premium", premiumRouter(blockchain, indexer));
      console.log("✅ x402 premium routes enabled (/api/market/premium) — 0.001 USDC/request");
    } catch (err: any) {
      console.warn(`⚠️  x402 setup failed (non-fatal): ${err.message}`);
    }
  } else {
    // On non-mainnet: expose premium routes without payment gate (dev/testing)
    app.use("/api/market/premium", premiumRouter(blockchain, indexer));
    console.log("ℹ️  x402 premium routes in dev mode (no payment required)");
  }

  // Root endpoint — API info
  app.get("/", (_req, res) => {
    res.json({
      name: "Autonomous Economy Protocol API",
      version: "2.0.0",
      network: blockchain.deployment.network,
      docs: "https://aepprotocol.xyz",
      github: "https://github.com/TomsonTrader/autonomous-economy-protocol",
      endpoints: ["/api/agents", "/api/market/needs", "/api/market/offers", "/api/market/deals",
                  "/api/stats", "/api/genesis/info", "/api/vault", "/api/reputation/:address",
                  "/api/faucet", "/api/token", "/health"],
    });
  });

  // Health check — available at both /health and /api/health (standard convention)
  const healthHandler = (_req: any, res: any) => res.json({
    status: "ok",
    network: blockchain.deployment.network,
    wsClients: wsService.clientCount,
    timestamp: new Date().toISOString(),
  });
  app.get("/health", healthHandler);
  app.get("/api/health", healthHandler);

  // Public activity feed — last 50 indexed events (for /activity page)
  app.get("/api/activity", async (_req, res) => {
    try {
      const events = indexer.getRecentEvents(50);
      res.json({ events, count: events.length });
    } catch (e: any) {
      res.json({ events: [], count: 0 });
    }
  });

  // Global stats — reads from chain directly so values are always accurate
  app.get("/api/stats", async (_req, res) => {
    try {
      const [agents, totalNeeds, totalOffers] = await Promise.all([
        blockchain.registry.getActiveAgents().catch(() => [] as string[]),
        blockchain.marketplace.totalNeeds().catch(() => 0n),
        blockchain.marketplace.totalOffers().catch(() => 0n),
      ]);
      const eventStats = indexer.getEventStats();
      res.json({
        totalAgents:  (agents as string[]).length,
        totalDeals:   eventStats["DealFunded"] ?? 0,
        totalVolume:  "0",
        activeNeeds:  Number(totalNeeds),
        activeOffers: Number(totalOffers),
        network:      blockchain.deployment.network,
        timestamp:    new Date().toISOString(),
      });
    } catch (e: any) {
      res.json({ totalAgents: 0, totalDeals: 0, totalVolume: "0", error: e.message });
    }
  });

  // Token info + live pool data (GeckoTerminal public API)
  const AGT_CONTRACT = "0x6dE70b5B0953A220420E142f51AE47B6Fd5b7101";
  const POOL_ADDRESS = "0xe72646B25853e6300C80B029D3faCA63fd4e564B";
  let poolCache: { data: unknown; ts: number } | null = null;

  app.get("/api/token", async (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=60");
    const base = {
      name: "Agent Token",
      symbol: "AGT",
      contract: AGT_CONTRACT,
      network: "base",
      chainId: 8453,
      decimals: 18,
      totalSupply: "1000000000",
      pool: POOL_ADDRESS,
      website: "https://aepprotocol.xyz",
      whitepaper: "https://aepprotocol.xyz/whitepaper",
      github: "https://github.com/TomsonTrader/autonomous-economy-protocol",
      twitter: "https://x.com/AEPprotocol",
      basescan: `https://basescan.org/token/${AGT_CONTRACT}`,
      uniswap: `https://app.uniswap.org/explore/pools/base/${POOL_ADDRESS}`,
      dexscreener: `https://dexscreener.com/base/${POOL_ADDRESS}`,
    };

    // Return cached pool data if fresh (<60s)
    if (poolCache && Date.now() - poolCache.ts < 60_000) {
      return res.json({ ...base, pool_data: poolCache.data });
    }

    try {
      const gt = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/base/pools/${POOL_ADDRESS}`,
        { headers: { Accept: "application/json;version=20230302" }, signal: AbortSignal.timeout(5000) }
      );
      if (gt.ok) {
        const json = await gt.json() as { data?: { attributes?: unknown } };
        const attrs = json?.data?.attributes ?? null;
        poolCache = { data: attrs, ts: Date.now() };
        return res.json({ ...base, pool_data: attrs });
      }
    } catch {
      // fall through — return base data only
    }
    res.json({ ...base, pool_data: null });
  });

  // Start server
  server.listen(PORT, () => {
    console.log(`\n🚀 Backend running at http://localhost:${PORT}`);
    console.log(`   WebSocket: ws://localhost:${PORT}/ws`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   API: http://localhost:${PORT}/api/\n`);
  });
}

main().catch(console.error);
