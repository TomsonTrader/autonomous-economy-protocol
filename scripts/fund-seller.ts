import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

const SELLER = "0x0a2c62eC6Ff181cAB7150E66Be9ba111dBedCF1f"; // DataProvider-01
const AMOUNT = ethers.parseEther("0.0003");

async function main() {
  const key = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!key) throw new Error("No DEPLOYER_PRIVATE_KEY in .env");
  const provider = new ethers.JsonRpcProvider("https://mainnet.base.org", 8453, { batchMaxCount: 1 });
  const wallet   = new ethers.Wallet(key, provider);
  const bal      = await provider.getBalance(wallet.address);
  console.log(`Deployer: ${wallet.address}`);
  console.log(`Balance:  ${ethers.formatEther(bal)} ETH`);
  const tx = await wallet.sendTransaction({ to: SELLER, value: AMOUNT });
  console.log(`TX: ${tx.hash}`);
  await tx.wait();
  const after = await provider.getBalance(SELLER);
  console.log(`DataProvider-01 balance: ${ethers.formatEther(after)} ETH ✅`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
