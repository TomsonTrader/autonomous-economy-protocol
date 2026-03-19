/**
 * Create Uniswap V3 AGT/USDC pool on Base Mainnet + seed initial liquidity.
 *
 * Token ordering (by address, ascending):
 *   token0 = AGT  0x6dE70b5B0953A220420E142f51AE47B6Fd5b7101 (18 dec)
 *   token1 = USDC 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 (6 dec)
 *
 * Initial price : 0.000001 USDC/AGT  →  FDV ≈ $1,000
 * Fee tier      : 1 % (10 000)
 * Default seed  : 200 M AGT  +  200 USDC  (perfectly balanced at init price)
 *
 * Usage (dry-run — no tx sent):
 *   DRY_RUN=true npx ts-node scripts/deploy/03_uniswap_pool.ts
 *
 * Usage (live):
 *   DEPLOYER_PRIVATE_KEY=0x... npx ts-node scripts/deploy/03_uniswap_pool.ts
 *
 * Override amounts:
 *   AGT_AMOUNT_HUMAN=500000000 USDC_AMOUNT_HUMAN=500 DEPLOYER_PRIVATE_KEY=0x... npx ts-node ...
 */

import { ethers } from "ethers";

// ── Addresses ──────────────────────────────────────────────────────────────────
const AGT_ADDR  = "0x6dE70b5B0953A220420E142f51AE47B6Fd5b7101"; // token0
const USDC_ADDR = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // token1
const NPM_ADDR  = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1"; // NonfungiblePositionManager
const FACTORY   = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";

const FEE          = 10_000; // 1 %
const TICK_SPACING =    200;

// Full-range ticks (nearest multiple of tick spacing)
const TICK_LOWER = -887200;
const TICK_UPPER =  887200;

// ── Initial sqrtPriceX96 ───────────────────────────────────────────────────────
//
// price_raw = USDC_wei / AGT_wei  at  0.000001 USDC per AGT
//           = 1 USDC_wei / 10^18 AGT_wei  =  10^-18
//
// sqrtPriceX96 = sqrt(10^-18) × 2^96
//              = 10^-9 × 79 228 162 514 264 337 593 543 950 336
//              ≈ 79 228 162 514
//
const SQRT_PRICE_X96 = 79_228_162_514n;

// ── ABIs (minimal) ─────────────────────────────────────────────────────────────
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const FACTORY_ABI = [
  "function getPool(address,address,uint24) view returns (address)",
];

const NPM_ABI = [
  "function createAndInitializePoolIfNecessary(address token0,address token1,uint24 fee,uint160 sqrtPriceX96) payable returns (address pool)",
  "function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) returns (uint256 tokenId,uint128 liquidity,uint256 amount0,uint256 amount1)",
];

// ── Config ─────────────────────────────────────────────────────────────────────
const DRY_RUN = process.env.DRY_RUN === "true";

const AGT_AMOUNT_HUMAN  = Number(process.env.AGT_AMOUNT_HUMAN  ?? "200000000"); // 200 M AGT
const USDC_AMOUNT_HUMAN = Number(process.env.USDC_AMOUNT_HUMAN ?? "200");       // 200 USDC

const AGT_AMOUNT  = ethers.parseEther(AGT_AMOUNT_HUMAN.toString());
const USDC_AMOUNT = BigInt(Math.round(USDC_AMOUNT_HUMAN * 1_000_000)); // 6 dec

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY;
  if (!DEPLOYER_KEY && !DRY_RUN) {
    throw new Error("Set DEPLOYER_PRIVATE_KEY or run with DRY_RUN=true");
  }

  const provider = new ethers.JsonRpcProvider("https://mainnet.base.org", undefined, {
    staticNetwork: true,
    batchMaxCount: 5,
  });

  const wallet = DRY_RUN
    ? ethers.Wallet.createRandom().connect(provider)
    : new ethers.Wallet(DEPLOYER_KEY!, provider);

  const agt  = new ethers.Contract(AGT_ADDR,  ERC20_ABI, wallet);
  const usdc = new ethers.Contract(USDC_ADDR, ERC20_ABI, wallet);
  const npm  = new ethers.Contract(NPM_ADDR,  NPM_ABI,   wallet);
  const factory = new ethers.Contract(FACTORY, FACTORY_ABI, provider);

  console.log("\n=== UNISWAP V3 AGT/USDC POOL SETUP ===");
  console.log(`Mode           : ${DRY_RUN ? "DRY RUN (no transactions)" : "LIVE — Base Mainnet"}`);
  console.log(`Wallet         : ${wallet.address}`);
  console.log(`AGT  seed      : ${AGT_AMOUNT_HUMAN.toLocaleString()} AGT`);
  console.log(`USDC seed      : ${USDC_AMOUNT_HUMAN} USDC`);
  console.log(`Init price     : 0.000001 USDC/AGT  (FDV ≈ $1,000)`);
  console.log(`Fee tier       : 1% (10000)`);
  console.log("");

  // ── 1. Balances ──────────────────────────────────────────────────────────────
  const [agtBal, usdcBal, ethBal] = await Promise.all([
    agt.balanceOf(wallet.address),
    usdc.balanceOf(wallet.address),
    provider.getBalance(wallet.address),
  ]);

  console.log("=== WALLET BALANCES ===");
  console.log(`ETH  : ${ethers.formatEther(ethBal)} ETH`);
  console.log(`AGT  : ${Number(ethers.formatEther(agtBal)).toLocaleString()} AGT`);
  console.log(`USDC : ${(Number(usdcBal) / 1e6).toFixed(2)} USDC`);
  console.log("");

  if (!DRY_RUN) {
    if (agtBal < AGT_AMOUNT)
      throw new Error(`Insufficient AGT — need ${AGT_AMOUNT_HUMAN.toLocaleString()}, have ${ethers.formatEther(agtBal)}`);
    if (usdcBal < USDC_AMOUNT)
      throw new Error(`Insufficient USDC — need ${USDC_AMOUNT_HUMAN}, have ${(Number(usdcBal) / 1e6).toFixed(2)}`);
    if (ethBal < ethers.parseEther("0.005"))
      throw new Error(`Need ≥ 0.005 ETH for gas, have ${ethers.formatEther(ethBal)}`);
  }

  // ── 2. Check if pool exists ──────────────────────────────────────────────────
  const existingPool = await factory.getPool(AGT_ADDR, USDC_ADDR, FEE);
  const poolExists   = existingPool !== ethers.ZeroAddress;

  console.log("=== POOL STATUS ===");
  if (poolExists) {
    console.log(`Pool already exists: ${existingPool}`);
    console.log("Will add liquidity to existing pool.");
  } else {
    console.log("Pool does not exist — will create + initialize.");
  }
  console.log("");

  if (DRY_RUN) {
    console.log("=== DRY RUN COMPLETE ===");
    console.log("No transactions sent. To run live:");
    console.log("  DEPLOYER_PRIVATE_KEY=0x... npx ts-node scripts/deploy/03_uniswap_pool.ts");
    if (!poolExists) {
      console.log("\nStep 1: createAndInitializePoolIfNecessary()");
      console.log(`  sqrtPriceX96 = ${SQRT_PRICE_X96}`);
    }
    console.log("\nStep 2: Approve AGT + USDC for PositionManager");
    console.log("Step 3: mint() full-range position");
    console.log(`  tickLower = ${TICK_LOWER}, tickUpper = ${TICK_UPPER}`);
    return;
  }

  // ── 3. Create pool if needed ─────────────────────────────────────────────────
  let poolAddress = existingPool;

  if (!poolExists) {
    console.log("=== STEP 1: CREATE + INITIALIZE POOL ===");
    const feeData = await provider.getFeeData();
    const createTx = await npm.createAndInitializePoolIfNecessary(
      AGT_ADDR, USDC_ADDR, FEE, SQRT_PRICE_X96,
      { maxFeePerGas: feeData.maxFeePerGas, maxPriorityFeePerGas: feeData.maxPriorityFeePerGas }
    );
    const createReceipt = await createTx.wait();
    poolAddress = await factory.getPool(AGT_ADDR, USDC_ADDR, FEE);
    console.log(`✅ Pool created: ${poolAddress}  (tx: ${createTx.hash})`);
    console.log("");
  }

  // ── 4. Approve tokens ────────────────────────────────────────────────────────
  console.log("=== STEP 2: APPROVE TOKENS ===");
  for (const [label, token, amount] of [
    ["AGT",  agt,  AGT_AMOUNT],
    ["USDC", usdc, USDC_AMOUNT],
  ] as const) {
    const allowance = await token.allowance(wallet.address, NPM_ADDR);
    if (allowance < amount) {
      const feeData = await provider.getFeeData();
      const tx = await token.approve(NPM_ADDR, ethers.MaxUint256, {
        maxFeePerGas: feeData.maxFeePerGas, maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      });
      await tx.wait();
      console.log(`✅ ${label} approved  (tx: ${tx.hash})`);
    } else {
      console.log(`✅ ${label} already approved`);
    }
  }
  console.log("");

  // ── 5. Mint full-range position ──────────────────────────────────────────────
  console.log("=== STEP 3: MINT FULL-RANGE POSITION ===");
  const deadline = Math.floor(Date.now() / 1000) + 20 * 60; // 20 min

  const mintParams = {
    token0:           AGT_ADDR,
    token1:           USDC_ADDR,
    fee:              FEE,
    tickLower:        TICK_LOWER,
    tickUpper:        TICK_UPPER,
    amount0Desired:   AGT_AMOUNT,
    amount1Desired:   USDC_AMOUNT,
    amount0Min:       0n,  // slippage ok for seed tx — no front-runners on new pool
    amount1Min:       0n,
    recipient:        wallet.address,
    deadline,
  };

  const feeData = await provider.getFeeData();
  const mintTx = await npm.mint(mintParams, {
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
  });
  const mintReceipt = await mintTx.wait();

  // Parse mint return values from events (IncreaseLiquidity)
  const iface = new ethers.Interface([
    "event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
  ]);
  let tokenId = "?", liq = "?", deposited0 = "?", deposited1 = "?";
  for (const log of mintReceipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed) {
        tokenId    = parsed.args.tokenId.toString();
        liq        = parsed.args.liquidity.toString();
        deposited0 = ethers.formatEther(parsed.args.amount0);
        deposited1 = (Number(parsed.args.amount1) / 1e6).toFixed(2);
      }
    } catch { /* other events */ }
  }

  console.log(`✅ Position minted!  (tx: ${mintTx.hash})`);
  console.log(`   NFT tokenId  : ${tokenId}`);
  console.log(`   Liquidity    : ${liq}`);
  console.log(`   AGT deposited: ${deposited0}`);
  console.log(`   USDC deposited: ${deposited1} USDC`);
  console.log("");

  // ── 6. Summary ───────────────────────────────────────────────────────────────
  const finalEth = await provider.getBalance(wallet.address);
  const gasSpent = ethBal - finalEth;
  console.log("=== POOL LIVE ===");
  console.log(`Pool address  : ${poolAddress}`);
  console.log(`Price         : 0.000001 USDC/AGT  (1 USDC = 1,000,000 AGT)`);
  console.log(`Uniswap URL   : https://app.uniswap.org/explore/pools/base/${poolAddress}`);
  console.log(`Gas spent     : ${ethers.formatEther(gasSpent)} ETH`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Embed swap widget in landing page (see dashboard/web/)");
  console.log("  2. Submit to CoinGecko / CoinMarketCap");
  console.log("  3. Announce on Farcaster + ai16z Discord");
}

main().catch((err) => {
  console.error("💥", err.message);
  process.exit(1);
});
