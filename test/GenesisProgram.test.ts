import { ethers } from "hardhat";
import { expect } from "chai";

describe("GenesisProgram", function () {
  let owner: any, agent1: any, agent2: any;
  let token: any, registry: any, reputation: any, vault: any, referral: any;
  let genesis: any;

  beforeEach(async function () {
    [owner, agent1, agent2] = await ethers.getSigners();

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

    // Fund genesis with 50M AGT
    await token.transfer(await genesis.getAddress(), ethers.parseEther("50000000"));
    await genesis.startSeason();

    // Give agents tokens for registration + staking
    for (const a of [agent1, agent2]) {
      await token.transfer(a.address, ethers.parseEther("2000"));
    }
  });

  async function registerAgent(signer: any, name: string) {
    const regAddr = await registry.getAddress();
    await token.connect(signer).approve(regAddr, ethers.parseEther("10"));
    await registry.connect(signer).registerAgent(name, ["data"], "");
  }

  it("starts with correct pool and 60-day duration", async function () {
    const info = await genesis.seasonInfo();
    expect(info.started).to.be.true;
    expect(info.ended).to.be.false;
    expect(info.pool).to.equal(ethers.parseEther("50000000"));
    expect(info.end - info.start).to.equal(60n * 24n * 3600n);
  });

  it("awards 100 pts for registration", async function () {
    await registerAgent(agent1, "Agent1");
    await genesis.syncPoints(agent1.address);
    const p = await genesis.getParticipant(agent1.address);
    expect(p.points).to.equal(100n);
  });

  it("is idempotent — no double-award", async function () {
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

  it("proportional claim: staker gets 2.5x non-staker", async function () {
    await registerAgent(agent1, "Agent1");
    await registerAgent(agent2, "Agent2");

    const vaultAddr = await vault.getAddress();
    await token.connect(agent1).approve(vaultAddr, ethers.parseEther("100"));
    await vault.connect(agent1).stake(ethers.parseEther("100"));

    await genesis.syncPoints(agent1.address);
    await genesis.syncPoints(agent2.address);
    await genesis.endSeason();

    const b1 = await token.balanceOf(agent1.address);
    const b2 = await token.balanceOf(agent2.address);
    await genesis.connect(agent1).claim();
    await genesis.connect(agent2).claim();

    const r1 = (await token.balanceOf(agent1.address)) - b1;
    const r2 = (await token.balanceOf(agent2.address)) - b2;
    expect(Number(r1) / Number(r2)).to.be.closeTo(2.5, 0.01);
  });

  it("prevents double claim", async function () {
    await registerAgent(agent1, "Agent1");
    await genesis.syncPoints(agent1.address);
    await genesis.endSeason();
    await genesis.connect(agent1).claim();
    await expect(genesis.connect(agent1).claim()).to.be.revertedWith("Already claimed");
  });

  it("reverts syncPoints when season is not active", async function () {
    await registerAgent(agent1, "Agent1");
    await genesis.endSeason();
    await expect(genesis.syncPoints(agent1.address)).to.be.revertedWith("Season not active");
  });

  it("reverts claim before season ends", async function () {
    await registerAgent(agent1, "Agent1");
    await genesis.syncPoints(agent1.address);
    await expect(genesis.connect(agent1).claim()).to.be.revertedWith("Season not ended yet");
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

  it("startSeason reverts if pool is not funded", async function () {
    const g2 = await (await ethers.getContractFactory("GenesisProgram")).deploy(
      await token.getAddress(), await registry.getAddress(),
      await reputation.getAddress(), await vault.getAddress(), await referral.getAddress()
    );
    await expect(g2.startSeason()).to.be.revertedWith("Fund the contract first");
  });
});
