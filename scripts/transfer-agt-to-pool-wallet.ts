/**
 * Transfer AGT to pool wallet
 * Sends 500M AGT from deployer to the new secure wallet for Uniswap pool creation
 *
 * Run: DEPLOYER_KEY=0x... npx ts-node scripts/transfer-agt-to-pool-wallet.ts
 */

import { ethers } from "ethers";

const RECIPIENT = "0x68103C893704dbFeFd842aAC5ed2DCdE9e82c313";
const AGT_ADDRESS = "0x6dE70b5B0953A220420E142f51AE47B6Fd5b7101";
const AMOUNT = ethers.parseUnits("500000000", 18); // 500M AGT

const AGT_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

async function main() {
  const key = process.env.DEPLOYER_KEY;
  if (!key) {
    console.error("DEPLOYER_KEY env var required");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
  const wallet = new ethers.Wallet(key, provider);

  console.log("Sender:    ", wallet.address);
  console.log("Recipient: ", RECIPIENT);
  console.log("Amount:     500,000,000 AGT");

  const agt = new ethers.Contract(AGT_ADDRESS, AGT_ABI, wallet);

  const balance = await agt.balanceOf(wallet.address);
  console.log("Sender AGT balance:", ethers.formatUnits(balance, 18));

  if (balance < AMOUNT) {
    console.error("Insufficient AGT balance");
    process.exit(1);
  }

  const ethBal = await provider.getBalance(wallet.address);
  console.log("Sender ETH balance:", ethers.formatEther(ethBal), "ETH");

  console.log("\nSending...");
  const tx = await agt.transfer(RECIPIENT, AMOUNT);
  console.log("Tx hash:", tx.hash);
  console.log("Waiting for confirmation...");
  await tx.wait();

  const newBal = await agt.balanceOf(RECIPIENT);
  console.log("Done! Recipient AGT balance:", ethers.formatUnits(newBal, 18));
  console.log("Basescan: https://basescan.org/tx/" + tx.hash);
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
