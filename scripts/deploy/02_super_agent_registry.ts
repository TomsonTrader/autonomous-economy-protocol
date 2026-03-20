/**
 * Deploy SuperAgentRegistry to Base Mainnet.
 *
 * Usage:
 *   npx hardhat run scripts/deploy/02_super_agent_registry.ts --network base-mainnet
 *
 * Env vars required (.env):
 *   DEPLOYER_PRIVATE_KEY
 *   BASESCAN_API_KEY    (for verification)
 */

import { ethers, run, network } from "hardhat";
import fs from "fs";
import path from "path";

// ── Addresses ────────────────────────────────────────────────────────────────
const ADDRESSES = {
  "base-mainnet": {
    usdc:        "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    agt:         "0x6dE70b5B0953A220420E142f51AE47B6Fd5b7101",
    treasury:    "0x8CCB591C94D419687c4C6dDfdd9F789cc29Bd0Fd",
    swapRouter:  "0x2626664c2603336E57B271c5C0b26F421741e481", // Uniswap V3 SwapRouter02
    poolFee:     3000,  // 0.3% — change to 500 if AGT/USDC pool uses 0.05%
  },
  "base-sepolia": {
    // Use mock addresses for testnet — deploy MockERC20 + MockSwapRouter first
    usdc:        "", // fill after mock deploy
    agt:         "0x126d65BeBC92Aa660b67882B623aaceC0F533797",
    treasury:    "0xE4e4D612E83252fB0312BE6a5ee25Ef674934E1c",
    swapRouter:  "", // fill after mock deploy
    poolFee:     3000,
  },
};

async function main() {
  const net = network.name as keyof typeof ADDRESSES;
  const cfg = ADDRESSES[net];

  if (!cfg) throw new Error(`No config for network: ${net}`);
  if (!cfg.usdc || !cfg.swapRouter) throw new Error(`Fill usdc / swapRouter for ${net}`);

  const [deployer] = await ethers.getSigners();
  console.log(`\nDeploying SuperAgentRegistry on ${net}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  console.log("Parameters:");
  console.log(`  USDC:       ${cfg.usdc}`);
  console.log(`  AGT:        ${cfg.agt}`);
  console.log(`  Treasury:   ${cfg.treasury}`);
  console.log(`  Router:     ${cfg.swapRouter}`);
  console.log(`  Pool fee:   ${cfg.poolFee} (${cfg.poolFee / 10_000}%)`);
  console.log(`  Reg fee:    50 USDC`);
  console.log(`  Treasury %: 40%`);
  console.log(`  Burn %:     25%`);
  console.log(`  Level 1 %:  25%`);
  console.log(`  Level 2 %:  10%`);

  const Factory = await ethers.getContractFactory("SuperAgentRegistry");
  const contract = await Factory.deploy(
    cfg.usdc,
    cfg.agt,
    cfg.treasury,
    cfg.swapRouter,
    cfg.poolFee
  );
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`\n✅ SuperAgentRegistry deployed: ${address}`);

  // ── Update deployments JSON ───────────────────────────────────────────────
  const deploymentsPath = path.join(__dirname, "../../deployments", `${net}.json`);
  let deployments: any = {};
  if (fs.existsSync(deploymentsPath)) {
    deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));
  }
  deployments.contracts = deployments.contracts || {};
  deployments.contracts["SuperAgentRegistry"] = address;
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log(`Updated ${deploymentsPath}`);

  // ── Verify on Basescan ────────────────────────────────────────────────────
  if (process.env.BASESCAN_API_KEY && net === "base-mainnet") {
    console.log("\nWaiting 15s for Basescan to index...");
    await new Promise(r => setTimeout(r, 15_000));

    try {
      await run("verify:verify", {
        address,
        constructorArguments: [cfg.usdc, cfg.agt, cfg.treasury, cfg.swapRouter, cfg.poolFee],
      });
      console.log("✅ Verified on Basescan");
    } catch (e: any) {
      console.warn("Verification failed (can retry manually):", e.message);
    }
  }

  console.log(`\nBasescan: https://basescan.org/address/${address}`);
}

main().catch(err => { console.error(err); process.exit(1); });
