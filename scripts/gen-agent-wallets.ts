/**
 * Generate 20 mainnet agent wallets and save to simulation/mainnet-agents.json
 * Usage: npx ts-node scripts/gen-agent-wallets.ts
 */

import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

const COUNT = 20;
const OUT   = path.join(__dirname, "../simulation/mainnet-agents.json");

const ARCHETYPES = [
  "DataProvider",
  "ComputeProvider",
  "OracleAgent",
  "LiquidityAgent",
  "AnalyticsAgent",
];

function main() {
  const agents = [];

  for (let i = 0; i < COUNT; i++) {
    const wallet    = ethers.Wallet.createRandom();
    const archetype = ARCHETYPES[i % ARCHETYPES.length];
    const idx       = Math.floor(i / ARCHETYPES.length) + 1;

    agents.push({
      index:      i,
      name:       `${archetype}-${String(i + 1).padStart(2, "0")}`,
      archetype,
      address:    wallet.address,
      privateKey: wallet.privateKey,
      mnemonic:   wallet.mnemonic?.phrase ?? null,
    });
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(agents, null, 2));

  console.log(`\n✅ Generated ${COUNT} wallets → ${OUT}\n`);
  console.log("Addresses:");
  agents.forEach(a => console.log(`  [${a.index.toString().padStart(2)}] ${a.name.padEnd(22)} ${a.address}`));
  console.log();
}

main();
