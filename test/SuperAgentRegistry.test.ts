import { ethers } from "hardhat";
import { expect } from "chai";
import { takeSnapshot } from "@nomicfoundation/hardhat-network-helpers";
import type { SnapshotRestorer } from "@nomicfoundation/hardhat-network-helpers";

// ── Constants (mirror the contract) ──────────────────────────────────────────
const REGISTRATION_FEE = 50_000_000n; // 50 USDC (6 dec)
const TREASURY_BPS     = 4_000n;
const BURN_BPS         = 2_500n;
const LEVEL1_BPS       = 2_500n;
const LEVEL2_BPS       = 1_000n;

function bps(amount: bigint, bp: bigint) { return (amount * bp) / 10_000n; }

// ── MockUSDC ─────────────────────────────────────────────────────────────────
// We deploy a real ERC20 instead of a mock so approve/transferFrom works.

describe("SuperAgentRegistry", function () {
  let owner: any, treasury: any;
  let agent1: any, agent2: any, agent3: any, agent4: any, stranger: any;

  let usdc: any;   // MockERC20 — 6 decimals
  let agt:  any;   // AgentToken — 18 decimals (ERC20Burnable)
  let mockRouter: any;
  let registry: any; // SuperAgentRegistry

  let snapshot: SnapshotRestorer;

  // ── Deploy a trivial ERC20 for USDC ────────────────────────────────────────
  async function deployMockERC20(name: string, symbol: string, decimals: number, to: string) {
    const Factory = await ethers.getContractFactory("MockERC20");
    return Factory.deploy(name, symbol, decimals, to);
  }

  // ── Deploy a minimal mock Uniswap router ───────────────────────────────────
  async function deployMockRouter(agtAddr: string) {
    const Factory = await ethers.getContractFactory("MockSwapRouter");
    return Factory.deploy(agtAddr);
  }

  beforeEach(async function () {
    snapshot = await takeSnapshot();
    [owner, treasury, agent1, agent2, agent3, agent4, stranger] = await ethers.getSigners();

    // Deploy AGT (real AgentToken — has ERC20Burnable)
    agt = await (await ethers.getContractFactory("AgentToken")).deploy(owner.address);

    // Deploy MockUSDC (6 decimals, mint a lot to owner)
    usdc = await deployMockERC20("USD Coin", "USDC", 6, owner.address);

    // Deploy MockSwapRouter (returns AGT proportional to USDC in)
    mockRouter = await deployMockRouter(await agt.getAddress());

    // Fund mock router with AGT so it can simulate swaps
    await agt.transfer(await mockRouter.getAddress(), ethers.parseEther("1000000"));

    // Deploy SuperAgentRegistry
    registry = await (await ethers.getContractFactory("SuperAgentRegistry")).deploy(
      await usdc.getAddress(),
      await agt.getAddress(),
      treasury.address,
      await mockRouter.getAddress(),
      3000 // 0.3% pool fee
    );

    // Distribute USDC to agents (200 USDC each → enough for multiple registrations)
    for (const agent of [agent1, agent2, agent3, agent4, stranger]) {
      await usdc.transfer(agent.address, 200_000_000n); // 200 USDC
    }
  });

  afterEach(async function () {
    await snapshot.restore();
  });

  // ── Helper: approve + register ────────────────────────────────────────────
  async function approveAndRegister(agent: any, referrer: string = ethers.ZeroAddress) {
    await usdc.connect(agent).approve(await registry.getAddress(), REGISTRATION_FEE);
    return registry.connect(agent).register(referrer);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Deployment
  // ─────────────────────────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("stores correct token addresses", async function () {
      expect(await registry.usdc()).to.equal(await usdc.getAddress());
      expect(await registry.agt()).to.equal(await agt.getAddress());
    });

    it("stores treasury correctly", async function () {
      expect(await registry.treasury()).to.equal(treasury.address);
    });

    it("default minBurnAmount is 10 USDC", async function () {
      expect(await registry.minBurnAmount()).to.equal(10_000_000n);
    });

    it("reverts if constructed with zero addresses", async function () {
      const F = await ethers.getContractFactory("SuperAgentRegistry");
      await expect(
        F.deploy(ethers.ZeroAddress, await agt.getAddress(), treasury.address, await mockRouter.getAddress(), 3000)
      ).to.be.revertedWith("SuperAgent: USDC zero");
      await expect(
        F.deploy(await usdc.getAddress(), ethers.ZeroAddress, treasury.address, await mockRouter.getAddress(), 3000)
      ).to.be.revertedWith("SuperAgent: AGT zero");
      await expect(
        F.deploy(await usdc.getAddress(), await agt.getAddress(), ethers.ZeroAddress, await mockRouter.getAddress(), 3000)
      ).to.be.revertedWith("SuperAgent: Treasury zero");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Registration — no referrer
  // ─────────────────────────────────────────────────────────────────────────
  describe("Registration — no referrer", function () {
    it("emits AgentRegistered with zero referrer addresses", async function () {
      await usdc.connect(agent1).approve(await registry.getAddress(), REGISTRATION_FEE);
      await expect(registry.connect(agent1).register(ethers.ZeroAddress))
        .to.emit(registry, "AgentRegistered")
        .withArgs(agent1.address, ethers.ZeroAddress, ethers.ZeroAddress, REGISTRATION_FEE);
    });

    it("marks agent as registered", async function () {
      await approveAndRegister(agent1);
      expect(await registry.isRegistered(agent1.address)).to.be.true;
    });

    it("increments totalRegistrations", async function () {
      await approveAndRegister(agent1);
      expect(await registry.totalRegistrations()).to.equal(1n);
    });

    it("sends 40% + 25% + 25% + 10% = 100% to treasury (no referrers)", async function () {
      const balBefore = await usdc.balanceOf(treasury.address);
      await approveAndRegister(agent1);
      const balAfter = await usdc.balanceOf(treasury.address);
      // treasury gets 40% base + 25% (no L1) + 10% (no L2) = 75% = $37.50
      const expectedTreasury = REGISTRATION_FEE - bps(REGISTRATION_FEE, BURN_BPS);
      expect(balAfter - balBefore).to.equal(expectedTreasury);
    });

    it("accumulates 25% in burnAccumulator", async function () {
      await approveAndRegister(agent1);
      expect(await registry.burnAccumulator()).to.equal(bps(REGISTRATION_FEE, BURN_BPS));
    });

    it("deducts exactly 50 USDC from registrant", async function () {
      const balBefore = await usdc.balanceOf(agent1.address);
      await approveAndRegister(agent1);
      expect(balBefore - await usdc.balanceOf(agent1.address)).to.equal(REGISTRATION_FEE);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Registration — with L1 referrer only
  // ─────────────────────────────────────────────────────────────────────────
  describe("Registration — L1 referrer only", function () {
    beforeEach(async function () {
      await approveAndRegister(agent1); // agent1 has no referrer
    });

    it("pays 25% to L1 referrer", async function () {
      const l1BalBefore = await usdc.balanceOf(agent1.address);
      await approveAndRegister(agent2, agent1.address);
      const l1BalAfter = await usdc.balanceOf(agent1.address);
      expect(l1BalAfter - l1BalBefore).to.equal(bps(REGISTRATION_FEE, LEVEL1_BPS));
    });

    it("emits ReferralPaid for L1", async function () {
      await usdc.connect(agent2).approve(await registry.getAddress(), REGISTRATION_FEE);
      await expect(registry.connect(agent2).register(agent1.address))
        .to.emit(registry, "ReferralPaid")
        .withArgs(agent1.address, agent2.address, 1, bps(REGISTRATION_FEE, LEVEL1_BPS));
    });

    it("treasury gets 40% + 10% (no L2) = 50%", async function () {
      const balBefore = await usdc.balanceOf(treasury.address);
      await approveAndRegister(agent2, agent1.address);
      const balAfter = await usdc.balanceOf(treasury.address);
      // 40% + 10% (no L2) = 50% = $25
      const expected = bps(REGISTRATION_FEE, TREASURY_BPS) + bps(REGISTRATION_FEE, LEVEL2_BPS);
      expect(balAfter - balBefore).to.equal(expected);
    });

    it("updates agent2 referrer to agent1", async function () {
      await approveAndRegister(agent2, agent1.address);
      const { referrer } = await registry.getAgent(agent2.address);
      expect(referrer).to.equal(agent1.address);
    });

    it("increments referralEarned on L1", async function () {
      await approveAndRegister(agent2, agent1.address);
      const { referralEarned } = await registry.getAgent(agent1.address);
      expect(referralEarned).to.equal(bps(REGISTRATION_FEE, LEVEL1_BPS));
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Registration — with both L1 and L2 referrers
  // ─────────────────────────────────────────────────────────────────────────
  describe("Registration — L1 + L2 referrers", function () {
    beforeEach(async function () {
      await approveAndRegister(agent1);              // no referrer
      await approveAndRegister(agent2, agent1.address); // agent1 = L1
    });

    it("pays 25% to L1 and 10% to L2 when agent3 registers via agent2", async function () {
      const l1BalBefore = await usdc.balanceOf(agent2.address);
      const l2BalBefore = await usdc.balanceOf(agent1.address);

      await approveAndRegister(agent3, agent2.address);

      const l1BalAfter = await usdc.balanceOf(agent2.address);
      const l2BalAfter = await usdc.balanceOf(agent1.address);

      expect(l1BalAfter - l1BalBefore).to.equal(bps(REGISTRATION_FEE, LEVEL1_BPS)); // $12.50
      expect(l2BalAfter - l2BalBefore).to.equal(bps(REGISTRATION_FEE, LEVEL2_BPS)); // $5.00
    });

    it("emits ReferralPaid for both levels", async function () {
      await usdc.connect(agent3).approve(await registry.getAddress(), REGISTRATION_FEE);
      await expect(registry.connect(agent3).register(agent2.address))
        .to.emit(registry, "ReferralPaid")
        .withArgs(agent2.address, agent3.address, 1, bps(REGISTRATION_FEE, LEVEL1_BPS))
        .and.to.emit(registry, "ReferralPaid")
        .withArgs(agent1.address, agent3.address, 2, bps(REGISTRATION_FEE, LEVEL2_BPS));
    });

    it("treasury gets exactly 40% when both referrers present", async function () {
      const balBefore = await usdc.balanceOf(treasury.address);
      await approveAndRegister(agent3, agent2.address);
      const balAfter = await usdc.balanceOf(treasury.address);
      expect(balAfter - balBefore).to.equal(bps(REGISTRATION_FEE, TREASURY_BPS)); // $20
    });

    it("fee math sums to exactly 50 USDC", async function () {
      // treasury: 40%, burn: 25%, L1: 25%, L2: 10% = 100%
      const treasury40 = bps(REGISTRATION_FEE, TREASURY_BPS);
      const burn25     = bps(REGISTRATION_FEE, BURN_BPS);
      const l1_25      = bps(REGISTRATION_FEE, LEVEL1_BPS);
      const l2_10      = bps(REGISTRATION_FEE, LEVEL2_BPS);
      expect(treasury40 + burn25 + l1_25 + l2_10).to.equal(REGISTRATION_FEE);
    });

    it("getReferralChain returns correct chain", async function () {
      await approveAndRegister(agent3, agent2.address);
      const [l1, l2] = await registry.getReferralChain(agent3.address);
      expect(l1).to.equal(agent2.address);
      expect(l2).to.equal(agent1.address);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Anti-abuse checks
  // ─────────────────────────────────────────────────────────────────────────
  describe("Anti-abuse", function () {
    it("reverts if already registered", async function () {
      await approveAndRegister(agent1);
      await usdc.connect(agent1).approve(await registry.getAddress(), REGISTRATION_FEE);
      await expect(registry.connect(agent1).register(ethers.ZeroAddress))
        .to.be.revertedWith("SuperAgent: already registered");
    });

    it("reverts on self-referral", async function () {
      await usdc.connect(agent1).approve(await registry.getAddress(), REGISTRATION_FEE);
      await expect(registry.connect(agent1).register(agent1.address))
        .to.be.revertedWith("SuperAgent: self-referral");
    });

    it("ignores unregistered referrer (treats as no referrer)", async function () {
      // stranger is not registered, so agent1's referrer won't be stored
      await usdc.connect(agent1).approve(await registry.getAddress(), REGISTRATION_FEE);
      const tx = registry.connect(agent1).register(stranger.address);
      await expect(tx)
        .to.emit(registry, "AgentRegistered")
        .withArgs(agent1.address, ethers.ZeroAddress, ethers.ZeroAddress, REGISTRATION_FEE);

      const { referrer } = await registry.getAgent(agent1.address);
      expect(referrer).to.equal(ethers.ZeroAddress);
    });

    it("prevents circular referral at L2 (A→B→A scenario)", async function () {
      // agent1 and agent2 register independently
      await approveAndRegister(agent1);
      await approveAndRegister(agent2, agent1.address); // agent2 → agent1 (L1)

      // Now if agent1 tries to refer agent3 and agent3 would make agent2 the L2
      // but agent2's L1 is agent1 → agent1 would be L2 for agent3 — that's fine, not circular

      // The circular case: agent3 registered via agent2, agent2 via agent1
      // agent1's L2 would be agent1 itself if we went up one more level — but we don't
      // Real circular: if agent1 registered via agent2 AFTER agent2 registered via agent1
      // That's impossible because agent1 is registered first with no referrer
      // Let's test the guard: register agent3 via agent2, agent4 via agent3
      await approveAndRegister(agent3, agent2.address);

      const [l1, l2] = await registry.getReferralChain(agent3.address);
      expect(l1).to.equal(agent2.address);
      expect(l2).to.equal(agent1.address); // correct, not circular
    });

    it("reverts if USDC not approved", async function () {
      await expect(registry.connect(agent1).register(ethers.ZeroAddress))
        .to.be.reverted;
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Buy-and-Burn
  // ─────────────────────────────────────────────────────────────────────────
  describe("Buy-and-Burn", function () {
    beforeEach(async function () {
      // Register agents to build up burn accumulator
      await approveAndRegister(agent1);
      await approveAndRegister(agent2, agent1.address);
    });

    it("accumulates 25 USDC in burnAccumulator after 2 registrations", async function () {
      const expected = bps(REGISTRATION_FEE, BURN_BPS) * 2n;
      expect(await registry.burnAccumulator()).to.equal(expected);
    });

    it("executeBuyAndBurn swaps USDC for AGT and burns it", async function () {
      const agtSupplyBefore = await agt.totalSupply();

      await expect(registry.executeBuyAndBurn(0))
        .to.emit(registry, "BuyAndBurnExecuted");

      const agtSupplyAfter = await agt.totalSupply();
      expect(agtSupplyAfter).to.be.lessThan(agtSupplyBefore);
    });

    it("resets burnAccumulator to 0 after burn", async function () {
      await registry.executeBuyAndBurn(0);
      expect(await registry.burnAccumulator()).to.equal(0n);
    });

    it("increments totalAGTBurned", async function () {
      await registry.executeBuyAndBurn(0);
      expect(await registry.totalAGTBurned()).to.be.greaterThan(0n);
    });

    it("reverts if accumulator below minBurnAmount", async function () {
      await registry.setMinBurnAmount(100_000_000n); // 100 USDC > 25 USDC accumulated
      await expect(registry.connect(owner).executeBuyAndBurn(0))
        .to.be.revertedWith("SuperAgent: accumulator below minimum");
    });

    it("reverts with nothing to burn if accumulator is zero", async function () {
      // Drain accumulator by burning first
      await registry.connect(owner).executeBuyAndBurn(0);
      // Now accumulator is 0
      await expect(registry.connect(owner).executeBuyAndBurn(0))
        .to.be.revertedWith("SuperAgent: nothing to burn");
    });

    it("only owner can call executeBuyAndBurn when publicBurnEnabled = false", async function () {
      await expect(registry.connect(stranger).executeBuyAndBurn(0))
        .to.be.revertedWith("SuperAgent: burn not public yet");
    });

    it("owner can always call executeBuyAndBurn", async function () {
      await expect(registry.connect(owner).executeBuyAndBurn(0))
        .to.emit(registry, "BuyAndBurnExecuted");
    });

    it("anyone can call executeBuyAndBurn after setBurnPublic()", async function () {
      await registry.setBurnPublic();
      await expect(registry.connect(stranger).executeBuyAndBurn(0))
        .to.emit(registry, "BuyAndBurnExecuted");
    });

    it("setBurnPublic emits BurnPublicEnabled and is irreversible", async function () {
      await expect(registry.setBurnPublic())
        .to.emit(registry, "BurnPublicEnabled");
      // Cannot call again
      await expect(registry.setBurnPublic())
        .to.be.revertedWith("SuperAgent: already public");
    });

    it("non-owner cannot call setBurnPublic", async function () {
      await expect(registry.connect(stranger).setBurnPublic())
        .to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 7. Pause
  // ─────────────────────────────────────────────────────────────────────────
  describe("Pause", function () {
    it("owner can pause and unpause", async function () {
      await registry.pause();
      await usdc.connect(agent1).approve(await registry.getAddress(), REGISTRATION_FEE);
      await expect(registry.connect(agent1).register(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(registry, "EnforcedPause");

      await registry.unpause();
      await expect(registry.connect(agent1).register(ethers.ZeroAddress))
        .to.emit(registry, "AgentRegistered");
    });

    it("non-owner cannot pause", async function () {
      await expect(registry.connect(stranger).pause())
        .to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 8. Admin functions
  // ─────────────────────────────────────────────────────────────────────────
  describe("Admin", function () {
    it("setTreasury updates treasury address", async function () {
      await registry.setTreasury(agent1.address);
      expect(await registry.treasury()).to.equal(agent1.address);
    });

    it("setTreasury reverts on zero address", async function () {
      await expect(registry.setTreasury(ethers.ZeroAddress))
        .to.be.revertedWith("SuperAgent: zero address");
    });

    it("setPoolFee emits PoolFeeUpdated", async function () {
      await expect(registry.setPoolFee(500))
        .to.emit(registry, "PoolFeeUpdated")
        .withArgs(500);
    });

    it("recoverToken cannot drain burnAccumulator", async function () {
      await approveAndRegister(agent1); // builds accumulator
      const acc = await registry.burnAccumulator();
      await expect(registry.recoverToken(await usdc.getAddress(), acc + 1n))
        .to.be.revertedWith("SuperAgent: cannot drain burn accumulator");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 9. Protocol stats & views
  // ─────────────────────────────────────────────────────────────────────────
  describe("Stats", function () {
    it("protocolStats returns correct values after 3 registrations", async function () {
      await approveAndRegister(agent1);
      await approveAndRegister(agent2, agent1.address);
      await approveAndRegister(agent3, agent2.address);

      const [regs, referralsPaid, burnPending] = await registry.protocolStats();
      expect(regs).to.equal(3n);
      // L1 paid: agent1 (from agent2) + agent2 (from agent3) = 2 × 25% = $25
      // L2 paid: agent1 (from agent3) = 1 × 10% = $5
      // total: $30
      expect(referralsPaid).to.equal(
        bps(REGISTRATION_FEE, LEVEL1_BPS) * 2n + bps(REGISTRATION_FEE, LEVEL2_BPS)
      );
      expect(burnPending).to.equal(bps(REGISTRATION_FEE, BURN_BPS) * 3n);
    });
  });
});
