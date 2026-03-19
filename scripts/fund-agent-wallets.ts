/**
 * Fund 20 agent wallets with 0.00005 ETH each from deployer
 * Usage: DEPLOYER_KEY=0x... npx ts-node scripts/fund-agent-wallets.ts
 */

import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config();

const RPC      = "https://mainnet.base.org";
const AGENTS   = path.join(__dirname, "../simulation/mainnet-agents.json");
const AMOUNT   = ethers.parseEther("0.00005"); // ~$0.125 each × 20 = 0.001 ETH total

async function main() {
  const key = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!key) throw new Error("Set DEPLOYER_PRIVATE_KEY in .env");

  const provider = new ethers.JsonRpcProvider(RPC, 8453, { batchMaxCount: 1 });
  const deployer = new ethers.Wallet(key, provider);

  const bal = await provider.getBalance(deployer.address);
  console.log(`\nDeployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(bal)} ETH\n`);

  const agents = JSON.parse(fs.readFileSync(AGENTS, "utf8"));
  let nonce = await provider.getTransactionCount(deployer.address);

  for (const agent of agents) {
    const tx = await deployer.sendTransaction({
      to:    agent.address,
      value: AMOUNT,
      nonce: nonce++,
    });
    console.log(`  ✅ ${agent.name.padEnd(22)} ${agent.address} — tx: ${tx.hash}`);
    await tx.wait();
  }

  const balAfter = await provider.getBalance(deployer.address);
  console.log(`\nDeployer balance after: ${ethers.formatEther(balAfter)} ETH`);
  console.log(`\n✅ Done — ${agents.length} wallets funded with ${ethers.formatEther(AMOUNT)} ETH each\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
