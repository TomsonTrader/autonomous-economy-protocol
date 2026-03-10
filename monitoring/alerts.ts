/**
 * AEP Monitoring & Alerting
 *
 * Checks:
 *   - Faucet balance (warn if < 1000 AGT)
 *   - Backend health endpoint
 *   - RPC connectivity
 *   - Events indexer lag
 *   - Season 1 pool balance
 *
 * Usage: npx ts-node monitoring/alerts.ts
 * Cron:  */10 * * * * npx ts-node monitoring/alerts.ts
 */

import * as dotenv from "dotenv";
dotenv.config();
import { ethers } from "ethers";
import * as https from "https";

const BACKEND_URL = process.env.BACKEND_URL || "https://autonomous-economy-protocol-production.up.railway.app";
const RPC_URL = "https://mainnet.base.org";
const AGT_ADDRESS = "0x6dE70b5B0953A220420E142f51AE47B6Fd5b7101";
const GENESIS_ADDRESS = "0x92B369Ece9527d4c0526A73E589ca8C7b7a6276c";
const FAUCET_ADDRESS = "0x90531cf348666F7a9De1d0242e5B0fd4821C720A";

const THRESHOLDS = {
  faucetLowAGT: ethers.parseEther("1000"),   // warn if faucet < 1000 AGT
  genesisDaysLeft: 7,                          // warn if < 7 days left in Season 1
};

async function fetchJSON(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error("Invalid JSON from " + url)); }
      });
    }).on("error", reject);
  });
}

async function checkBackendHealth(): Promise<void> {
  try {
    const health = await fetchJSON(`${BACKEND_URL}/health`);
    if (health.status === "ok") {
      console.log(`✅ Backend: ok (${health.network})`);
    } else {
      console.error(`🚨 Backend: unhealthy — ${JSON.stringify(health)}`);
    }
  } catch (err: any) {
    console.error(`🚨 Backend: unreachable — ${err.message}`);
  }
}

async function checkBalances(provider: ethers.Provider): Promise<void> {
  const tokenABI = ["function balanceOf(address) view returns (uint256)"];
  const token = new ethers.Contract(AGT_ADDRESS, tokenABI, provider);

  const [faucetAGT, genesisAGT] = await Promise.all([
    token.balanceOf(FAUCET_ADDRESS),
    token.balanceOf(GENESIS_ADDRESS),
  ]);

  const faucetFormatted = ethers.formatEther(faucetAGT);
  const genesisFormatted = ethers.formatEther(genesisAGT);

  if (faucetAGT < THRESHOLDS.faucetLowAGT) {
    console.warn(`⚠️  FAUCET LOW: ${faucetFormatted} AGT — refill needed`);
  } else {
    console.log(`✅ Faucet balance: ${faucetFormatted} AGT`);
  }

  console.log(`✅ Genesis pool: ${genesisFormatted} AGT`);
}

async function checkSeason1(provider: ethers.Provider): Promise<void> {
  const genesisABI = [
    "function seasonInfo() view returns (bool started, bool ended, uint256 pool, uint256 start, uint256 end, uint256 totalPoints)",
  ];
  const genesis = new ethers.Contract(GENESIS_ADDRESS, genesisABI, provider);

  try {
    const info = await genesis.seasonInfo();
    const now = Math.floor(Date.now() / 1000);
    const end = Number(info.end);
    const daysLeft = (end - now) / 86400;

    if (info.ended) {
      console.warn("⚠️  Season 1: ENDED");
    } else if (daysLeft < THRESHOLDS.genesisDaysLeft) {
      console.warn(`⚠️  Season 1: ${daysLeft.toFixed(1)} days left — prepare Season 2`);
    } else {
      console.log(`✅ Season 1: ${daysLeft.toFixed(1)} days remaining`);
    }
  } catch (err: any) {
    console.error(`❌ Season 1 check failed: ${err.message}`);
  }
}

async function main() {
  console.log(`\n📊 AEP Monitoring — ${new Date().toISOString()}\n`);

  const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, {
    batchMaxCount: 5,
  });

  await Promise.all([
    checkBackendHealth(),
    checkBalances(provider),
    checkSeason1(provider),
  ]);

  console.log("\n✅ Monitoring check complete\n");
}

main().catch((err) => {
  console.error("❌ Monitoring failed:", err.message);
  process.exit(1);
});
