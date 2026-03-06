import * as dotenv from "dotenv";
// Local dev: load from root .env. Railway/production: env vars injected by platform.
dotenv.config({ path: require("path").join(__dirname, "../../.env") });

import express from "express";
import cors from "cors";
import http from "http";
import { BlockchainService } from "./services/blockchain";
import { WebSocketService } from "./services/websocket";
import { EventIndexer } from "./services/indexer";
import { agentsRouter } from "./routes/agents";
import { marketRouter } from "./routes/market";
import { monitorRouter } from "./routes/monitor";
import { faucetRouter } from "./routes/faucet";
import { vaultRouter } from "./routes/vault";
import { premiumRouter } from "./routes/premium";

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
  app.use(cors());
  app.use(express.json());

  // Create HTTP server (needed for WebSocket)
  const server = http.createServer(app);

  // WebSocket service
  const wsService = new WebSocketService(server);
  console.log("✅ WebSocket server ready at /ws");

  // Event indexer
  const indexer = new EventIndexer(blockchain, wsService);
  await indexer.startListening();

  // Routes
  app.use("/api/agents", agentsRouter(blockchain));
  app.use("/api/market", marketRouter(blockchain));
  app.use("/api/monitor", monitorRouter(blockchain, indexer));
  app.use("/api/reputation", monitorRouter(blockchain, indexer));
  app.use("/api/faucet", faucetRouter(blockchain.deployment.contracts));
  app.use("/api/vault", vaultRouter(blockchain));

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

  // Health check
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      network: blockchain.deployment.network,
      wsClients: wsService.clientCount,
      timestamp: new Date().toISOString(),
    });
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
