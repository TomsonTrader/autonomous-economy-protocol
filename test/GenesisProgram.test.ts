import { ethers } from "hardhat";
import { expect } from "chai";
import { time, takeSnapshot } from "@nomicfoundation/hardhat-network-helpers";
import type { SnapshotRestorer } from "@nomicfoundation/hardhat-network-helpers";

describe("GenesisProgram", function () {
  let owner: any, agent1: any, agent2: any, agent3: any;
  let token: any, registry: any, reputation: any, vault: any, referral: any;
  let genesis: any;
  let snapshot: SnapshotRestorer;

  beforeEach(async function () {
    snapshot = await takeSnapshot();
    [owner, agent1, agent2, agent3] = await ethers.getSigners();

    token      = await (await ethers.getContractFactory("AgentToken")).deploy(owner.address);
    reputation = await (await ethers.getContractFactory("ReputationSystem")).deploy();
    registry   = await (await ethers.getContractFactory("AgentRegistry")).deploy(await token.getAddress());
    await token.setRegistry(await registry.getAddress());
    vault      = await (await ethers.getContractFactory("AgentVault")).deploy(await token.getAddress(), await reputation.getAddress());
    referral   = await (await ethers.getContractFactory("ReferralNetwork")).deploy(await token.getAddress(), owner.address);

    genesis = await (await ethers.getContractFactory("GenesisProgram")).deploy(
      await token.getAddress(),
      await registry.getAddress(),
      await reputation.getAddress(),
      await vault.getAddress(),
      await referral.getAddress()
    );

    // Fund genesis with 50M AGT and start season
    await token.transfer(await genesis.getAddress(), ethers.parseEther("50000000"));
    await genesis.startSeason();

    // Give agents tokens for registration + staking
    for (const a of [agent1, agent2, agent3]) {
      await token.transfer(a.address, ethers.parseEther("2000"));
    }
  });

  afterEach(async function () {
    await snapshot.restore();
  });

  async function registerAgent(signer: any, name: string) {
    const regAddr = await registry.getAddress();
    await token.connect(signer).approve(regAddr, ethers.parseEther("10"));
    await registry.connect(signer).registerAgent(name, ["data"], "");
  }

  // Helper: end season and advance past seasonEnd + CLAIM_DELAY
  // seasonEnd = startSeason + 60 days; claim window = seasonEnd + 30 days = 90 days from start
  async function endSeasonAndOpenClaims() {
    await genesis.endSeason();
    await time.increase(90 * 24 * 3600 + 1); // past seasonEnd (60d) + CLAIM_DELAY (30d)
  }

  // ── Season setup ──────────────────────────────────────────────────────────

  it("starts with correct pool and 60-day duration", async function () {
    const info = await genesis.seasonInfo();
    expect(info.started).to.be.true;
    expect(info.ended).to.be.false;
    expect(info.pool).to.equal(ethers.parseEther("50000000"));
    expect(info.end - info.start).to.equal(60n * 24n * 3600n);
  });

  it("startSeason reverts if pool is not funded", async function () {
    const g2 = await (await ethers.getContractFactory("GenesisProgram")).deploy(
      await token.getAddress(), await registry.getAddress(),
      await reputation.getAddress(), await vault.getAddress(), await referral.getAddress()
    );
    await expect(g2.startSeason()).to.be.revertedWith("Fund the contract first");
  });

  // ── Points ────────────────────────────────────────────────────────────────

  it("awards 100 pts for registration", async function () {
    await registerAgent(agent1, "Agent1");
    await genesis.syncPoints(agent1.address);
    const p = await genesis.getParticipant(agent1.address);
    expect(p.points).to.equal(100n);
  });

  it("is idempotent — no double-award for same action", async function () {
    await registerAgent(agent1, "Agent1");
    await genesis.syncPoints(agent1.address);
    await genesis.syncPoints(agent1.address);
    const p = await genesis.getParticipant(agent1.address);
    expect(p.points).to.equal(100n);
  });

  it("awards stake points (100 register + 150 stake = 250)", async function () {
    await registerAgent(agent1, "Agent1");
    const vaultAddr = await vault.getAddress();
    await token.connect(agent1).approve(vaultAddr, ethers.parseEther("100"));
    await vault.connect(agent1).stake(ethers.parseEther("100"));
    await genesis.syncPoints(agent1.address);
    const p = await genesis.getParticipant(agent1.address);
    expect(p.points).to.equal(250n);
  });

  it("reverts syncPoints when season is not active", async function () {
    await registerAgent(agent1, "Agent1");
    await genesis.endSeason();
    await expect(genesis.syncPoints(agent1.address)).to.be.revertedWith("Season not active");
  });

  it("reverts for unregistered agent", async function () {
    await expect(genesis.syncPoints(agent1.address)).to.be.revertedWith("Not registered");
  });

  it("leaderboard returns all participants", async function () {
    await registerAgent(agent1, "Agent1");
    await registerAgent(agent2, "Agent2");
    await genesis.syncPoints(agent1.address);
    await genesis.syncPoints(agent2.address);
    const [addrs, pts] = await genesis.getLeaderboard();
    expect(addrs.length).to.equal(2);
    expect(pts[0]).to.equal(100n);
    expect(pts[1]).to.equal(100n);
  });

  // ── Claim window ──────────────────────────────────────────────────────────

  it("reverts claim before season ends", async function () {
    await registerAgent(agent1, "Agent1");
    await genesis.syncPoints(agent1.address);
    await expect(genesis.connect(agent1).claim()).to.be.revertedWith("Season not ended yet");
  });

  it("reverts claim if season ended but 30-day delay not passed", async function () {
    await registerAgent(agent1, "Agent1");
    await genesis.syncPoints(agent1.address);
    await genesis.endSeason();
    // Don't advance time
    await expect(genesis.connect(agent1).claim()).to.be.revertedWith("Claim window not open yet");
  });

  it("claimWindowOpen() is false before delay, true after", async function () {
    await registerAgent(agent1, "Agent1");
    await genesis.syncPoints(agent1.address);
    await genesis.endSeason();
    expect(await genesis.claimWindowOpen()).to.be.false;
    await time.increase(90 * 24 * 3600 + 1); // past seasonEnd + CLAIM_DELAY
    expect(await genesis.claimWindowOpen()).to.be.true;
  });

  // ── Vesting mechanics ─────────────────────────────────────────────────────

  it("claim releases 25% immediately and stores 75% in vesting", async function () {
    await registerAgent(agent1, "Agent1");
    await genesis.syncPoints(agent1.address);
    await endSeasonAndOpenClaims();

    const balBefore = await token.balanceOf(agent1.address);
    await genesis.connect(agent1).claim();
    const balAfter = await token.balanceOf(agent1.address);

    const immediate = balAfter - balBefore;
    // 1 agent = 100% of pool = 50M, but MAX_CLAIM cap = 1M AGT
    const totalAlloc = ethers.parseEther("1000000"); // capped
    const expected25pct = (totalAlloc * 2500n) / 10000n; // 250k AGT
    expect(immediate).to.equal(expected25pct);

    const vesting = await genesis.getVesting(agent1.address);
    expect(vesting.total).to.equal(totalAlloc - expected25pct); // 750k AGT vested
    expect(vesting.released).to.equal(0n);
  });

  it("proportional points: staker earns 2.5x non-staker", async function () {
    await registerAgent(agent1, "Agent1");
    await registerAgent(agent2, "Agent2");

    const vaultAddr = await vault.getAddress();
    await token.connect(agent1).approve(vaultAddr, ethers.parseEther("100"));
    await vault.connect(agent1).stake(ethers.parseEther("100"));

    await genesis.syncPoints(agent1.address); // 250 pts
    await genesis.syncPoints(agent2.address); // 100 pts

    // With only 2 agents both raw allocations exceed MAX_CLAIM — cap applies equally.
    // Verify proportionality via points (the source of truth for distribution).
    const p1 = await genesis.getParticipant(agent1.address);
    const p2 = await genesis.getParticipant(agent2.address);
    expect(Number(p1.points) / Number(p2.points)).to.be.closeTo(2.5, 0.01);

    // Both are capped at MAX_CLAIM since pool is small relative to participants
    expect(p1.estimatedAGT).to.equal(ethers.parseEther("1000000"));
    expect(p2.estimatedAGT).to.equal(ethers.parseEther("1000000"));
  });

  it("claimVested releases linearly over 180 days", async function () {
    await registerAgent(agent1, "Agent1");
    await genesis.syncPoints(agent1.address);
    await endSeasonAndOpenClaims();
    await genesis.connect(agent1).claim();

    const vesting = await genesis.getVesting(agent1.address);
    const totalVested = vesting.total;

    // Hardhat automines — even 1 second unlocks a tiny amount (~48 AGT).
    // Skip the t=0 check; test meaningful milestones instead.

    const margin = ethers.parseEther("500"); // 500 AGT tolerance for block timing

    // Advance 90 days (half vesting period)
    await time.increase(90 * 24 * 3600);
    const v90 = await genesis.getVesting(agent1.address);
    const half = totalVested / 2n;
    const diff90 = v90.claimable > half ? v90.claimable - half : half - v90.claimable;
    expect(diff90).to.be.lte(margin);

    // Claim half
    const b1: bigint = await token.balanceOf(agent1.address);
    await genesis.connect(agent1).claimVested();
    const claimed90: bigint = BigInt(await token.balanceOf(agent1.address)) - BigInt(b1);
    const diffC90 = claimed90 > half ? claimed90 - half : half - claimed90;
    expect(diffC90).to.be.lte(margin);

    // Advance another 90 days — rest unlocks
    await time.increase(90 * 24 * 3600);
    const b2: bigint = await token.balanceOf(agent1.address);
    await genesis.connect(agent1).claimVested();
    const claimed180: bigint = BigInt(await token.balanceOf(agent1.address)) - BigInt(b2);
    const diffC180 = claimed180 > half ? claimed180 - half : half - claimed180;
    expect(diffC180).to.be.lte(margin);

    // After full vest: nothing left
    await expect(genesis.connect(agent1).claimVested()).to.be.revertedWith("Nothing to claim yet");
  });

  it("prevents double claim()", async function () {
    await registerAgent(agent1, "Agent1");
    await genesis.syncPoints(agent1.address);
    await endSeasonAndOpenClaims();
    await genesis.connect(agent1).claim();
    await expect(genesis.connect(agent1).claim()).to.be.revertedWith("Already claimed");
  });

  it("reverts claimVested with no schedule", async function () {
    await expect(genesis.connect(agent1).claimVested()).to.be.revertedWith("No vesting schedule");
  });

  // ── Anti-whale cap ────────────────────────────────────────────────────────

  it("caps individual claim at 1M AGT", async function () {
    // agent1 is the only participant → would get 100% = 50M AGT without cap
    await registerAgent(agent1, "Agent1");
    await genesis.syncPoints(agent1.address);
    await endSeasonAndOpenClaims();

    const balBefore = await token.balanceOf(agent1.address);
    await genesis.connect(agent1).claim();
    const balAfter = await token.balanceOf(agent1.address);

    const immediate = balAfter - balBefore;
    // Cap is 1M AGT, 25% of that = 250k AGT immediate
    const capImmediate = (ethers.parseEther("1000000") * 2500n) / 10000n;
    expect(immediate).to.equal(capImmediate);

    const vesting = await genesis.getVesting(agent1.address);
    expect(vesting.total).to.equal(ethers.parseEther("1000000") - capImmediate);
  });

  // ── Emergency withdraw ────────────────────────────────────────────────────

  it("emergency withdraw requires 7-day timelock", async function () {
    await genesis.requestEmergencyWithdraw();
    await expect(genesis.executeEmergencyWithdraw()).to.be.revertedWith("Timelock not expired");
    await time.increase(7 * 24 * 3600 + 1);
    const balBefore = await token.balanceOf(owner.address);
    await genesis.executeEmergencyWithdraw();
    const balAfter = await token.balanceOf(owner.address);
    expect(balAfter - balBefore).to.equal(ethers.parseEther("50000000"));
  });

  it("emergency withdraw can be cancelled", async function () {
    await genesis.requestEmergencyWithdraw();
    await genesis.cancelEmergencyWithdraw();
    await time.increase(7 * 24 * 3600 + 1);
    await expect(genesis.executeEmergencyWithdraw()).to.be.revertedWith("Timelock not expired");
  });

  it("only owner can request emergency withdraw", async function () {
    await expect(genesis.connect(agent1).requestEmergencyWithdraw())
      .to.be.revertedWithCustomError(genesis, "OwnableUnauthorizedAccount");
  });
});
