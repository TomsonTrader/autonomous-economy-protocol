import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  AgentToken,
  AgentRegistry,
  ReputationSystem,
  Marketplace,
  NegotiationEngine,
  AutonomousAgreement,
} from "../typechain-types";

describe("Autonomous Economy Protocol", () => {
  let token: AgentToken;
  let registry: AgentRegistry;
  let reputation: ReputationSystem;
  let marketplace: Marketplace;
  let engine: NegotiationEngine;
  let deployer: HardhatEthersSigner;
  let alice: HardhatEthersSigner; // buyer / need publisher
  let bob: HardhatEthersSigner;   // seller / offer publisher
  let carol: HardhatEthersSigner;

  const ENTRY_FEE = ethers.parseEther("10");
  const FAUCET_AMOUNT = ethers.parseEther("1000");
  const ONE_DAY = 24 * 60 * 60;

  beforeEach(async () => {
    [deployer, alice, bob, carol] = await ethers.getSigners();

    // Deploy contracts
    const AgentToken = await ethers.getContractFactory("AgentToken");
    token = await AgentToken.deploy(deployer.address);

    const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
    registry = await AgentRegistry.deploy(await token.getAddress());

    const ReputationSystem = await ethers.getContractFactory("ReputationSystem");
    reputation = await ReputationSystem.deploy();

    const Marketplace = await ethers.getContractFactory("Marketplace");
    marketplace = await Marketplace.deploy(
      await registry.getAddress(),
      deployer.address
    );

    const NegotiationEngine = await ethers.getContractFactory("NegotiationEngine");
    engine = await NegotiationEngine.deploy(
      await registry.getAddress(),
      await marketplace.getAddress(),
      await reputation.getAddress()
    );

    // Wire up
    await token.setRegistry(await registry.getAddress());
    await reputation.setNegotiationEngine(await engine.getAddress());

    // Fund alice and bob with enough tokens to register
    await token.transfer(alice.address, ethers.parseEther("100"));
    await token.transfer(bob.address, ethers.parseEther("100"));
  });

  describe("AgentToken", () => {
    it("has correct name and symbol", async () => {
      expect(await token.name()).to.equal("Agent Token");
      expect(await token.symbol()).to.equal("AGT");
    });

    it("mints total supply to deployer", async () => {
      const totalSupply = await token.totalSupply();
      expect(totalSupply).to.equal(ethers.parseEther("1000000000"));
    });

    it("faucet only callable by registry", async () => {
      await expect(token.connect(alice).faucet(alice.address)).to.be.revertedWith(
        "AgentToken: caller is not registry"
      );
    });
  });

  describe("AgentRegistry", () => {
    it("registers an agent and dispenses welcome tokens", async () => {
      const registryAddr = await registry.getAddress();
      await token.connect(alice).approve(registryAddr, ENTRY_FEE);

      const balanceBefore = await token.balanceOf(alice.address);
      await registry.connect(alice).registerAgent("Alice Bot", ["data", "analysis"], "");

      const balanceAfter = await token.balanceOf(alice.address);
      // Paid 10, received 1000 → net +990
      expect(balanceAfter - balanceBefore).to.equal(
        FAUCET_AMOUNT - ENTRY_FEE
      );

      expect(await registry.isRegistered(alice.address)).to.be.true;
      const agent = await registry.getAgent(alice.address);
      expect(agent.name).to.equal("Alice Bot");
    });

    it("cannot register twice", async () => {
      const registryAddr = await registry.getAddress();
      await token.connect(alice).approve(registryAddr, ENTRY_FEE);
      await registry.connect(alice).registerAgent("Alice Bot", ["data"], "");

      await token.connect(alice).approve(registryAddr, ENTRY_FEE);
      await expect(
        registry.connect(alice).registerAgent("Alice Bot 2", ["data"], "")
      ).to.be.revertedWith("AgentRegistry: already registered");
    });
  });

  describe("Marketplace", () => {
    beforeEach(async () => {
      const registryAddr = await registry.getAddress();
      await token.connect(alice).approve(registryAddr, ENTRY_FEE);
      await registry.connect(alice).registerAgent("Alice", ["data"], "");
      await token.connect(bob).approve(registryAddr, ENTRY_FEE);
      await registry.connect(bob).registerAgent("Bob", ["data", "analysis"], "");
    });

    it("publishes a need and offer", async () => {
      const deadline = Math.floor(Date.now() / 1000) + ONE_DAY;
      await marketplace
        .connect(alice)
        .publishNeed("Need data analysis", ethers.parseEther("100"), deadline, ["data"]);

      await marketplace
        .connect(bob)
        .publishOffer("Offer data analysis", ethers.parseEther("80"), ["data"]);

      expect(await marketplace.totalNeeds()).to.equal(1);
      expect(await marketplace.totalOffers()).to.equal(1);
    });

    it("matches offers by tag overlap", async () => {
      const deadline = Math.floor(Date.now() / 1000) + ONE_DAY;
      await marketplace
        .connect(alice)
        .publishNeed("Need data analysis", ethers.parseEther("100"), deadline, ["data"]);
      await marketplace
        .connect(bob)
        .publishOffer("Offer data analysis", ethers.parseEther("80"), ["data"]);

      const matches = await marketplace.getMatchingOffers(0);
      expect(matches.length).to.equal(1);
      expect(matches[0]).to.equal(0);
    });
  });

  describe("NegotiationEngine → AutonomousAgreement", () => {
    let needId: bigint;
    let offerId: bigint;

    beforeEach(async () => {
      const registryAddr = await registry.getAddress();
      await token.connect(alice).approve(registryAddr, ENTRY_FEE);
      await registry.connect(alice).registerAgent("Alice", ["data"], "");
      await token.connect(bob).approve(registryAddr, ENTRY_FEE);
      await registry.connect(bob).registerAgent("Bob", ["data"], "");

      const deadline = Math.floor(Date.now() / 1000) + ONE_DAY;
      const needTx = await marketplace
        .connect(alice)
        .publishNeed("Need data", ethers.parseEther("100"), deadline, ["data"]);
      const needReceipt = await needTx.wait();
      needId = 0n;

      const offerTx = await marketplace
        .connect(bob)
        .publishOffer("Offer data", ethers.parseEther("80"), ["data"]);
      await offerTx.wait();
      offerId = 0n;
    });

    it("creates a proposal", async () => {
      await engine.connect(alice).propose(needId, offerId, ethers.parseEther("80"), "standard terms");
      const proposal = await engine.getProposal(0);
      expect(proposal.buyer).to.equal(alice.address);
      expect(proposal.seller).to.equal(bob.address);
      expect(proposal.price).to.equal(ethers.parseEther("80"));
    });

    it("allows counter-offer and acceptance → deploys agreement", async () => {
      await engine.connect(alice).propose(needId, offerId, ethers.parseEther("70"), "standard terms");

      // Bob counters
      await engine.connect(bob).counterOffer(0, ethers.parseEther("80"), "revised terms");

      // Alice accepts counter
      const tx = await engine.connect(alice).acceptProposal(1);
      const receipt = await tx.wait();

      const agreementAddr = await engine.proposalAgreement(1);
      expect(agreementAddr).to.not.equal(ethers.ZeroAddress);
    });

    it("full deal lifecycle: fund → confirm → reputation updated", async () => {
      await engine.connect(alice).propose(needId, offerId, ethers.parseEther("80"), "terms");
      const tx = await engine.connect(bob).acceptProposal(0);
      await tx.wait();

      const agreementAddr = await engine.proposalAgreement(0);
      const agreement = await ethers.getContractAt("AutonomousAgreement", agreementAddr) as AutonomousAgreement;

      // Alice funds the escrow
      await token.connect(alice).approve(agreementAddr, ethers.parseEther("80"));
      await agreement.connect(alice).fund();

      // Alice confirms delivery
      await agreement.connect(alice).confirmDelivery();

      const [score, totalDeals, successfulDeals] = await reputation.getReputation(bob.address);
      expect(totalDeals).to.equal(1);
      expect(successfulDeals).to.equal(1);
      expect(score).to.be.gt(0);
    });

    it("treasury receives 0.5% fee on deal completion", async () => {
      const treasury = carol; // deployer used carol.address as treasury in beforeEach? No — deployer.address is treasury
      // Re-check: Marketplace was deployed with deployer.address as treasury
      const treasuryAddr = deployer.address;
      const price = ethers.parseEther("100");

      await engine.connect(alice).propose(needId, offerId, price, "terms");
      await engine.connect(bob).acceptProposal(0);

      const agreementAddr = await engine.proposalAgreement(0);
      const agreement = await ethers.getContractAt("AutonomousAgreement", agreementAddr) as AutonomousAgreement;

      // Confirm treasury address embedded in agreement
      const embeddedTreasury = await agreement.treasury();
      expect(embeddedTreasury.toLowerCase()).to.equal(treasuryAddr.toLowerCase());

      await token.connect(alice).approve(agreementAddr, price);
      await agreement.connect(alice).fund();

      const treasuryBefore = await token.balanceOf(treasuryAddr);
      const bobBefore = await token.balanceOf(bob.address);

      await agreement.connect(alice).confirmDelivery();

      const treasuryAfter = await token.balanceOf(treasuryAddr);
      const bobAfter = await token.balanceOf(bob.address);

      // Expected fee: 100 * 50 / 10000 = 0.5 AGT
      const expectedFee = (price * 50n) / 10000n;
      const expectedSeller = price - expectedFee;

      expect(treasuryAfter - treasuryBefore).to.equal(expectedFee);
      expect(bobAfter - bobBefore).to.equal(expectedSeller);
    });

    it("dispute resolves 50/50", async () => {
      await engine.connect(alice).propose(needId, offerId, ethers.parseEther("80"), "terms");
      await engine.connect(bob).acceptProposal(0);
      const agreementAddr = await engine.proposalAgreement(0);
      const agreement = await ethers.getContractAt("AutonomousAgreement", agreementAddr) as AutonomousAgreement;

      const paymentAmount = ethers.parseEther("80");
      await token.connect(alice).approve(agreementAddr, paymentAmount);
      await agreement.connect(alice).fund();

      const aliceBefore = await token.balanceOf(alice.address);
      const bobBefore = await token.balanceOf(bob.address);

      await agreement.connect(alice).raiseDispute();

      const aliceAfter = await token.balanceOf(alice.address);
      const bobAfter = await token.balanceOf(bob.address);

      // Each gets ~40 AGT
      expect(aliceAfter - aliceBefore).to.be.closeTo(
        ethers.parseEther("40"),
        ethers.parseEther("1")
      );
      expect(bobAfter - bobBefore).to.be.closeTo(
        ethers.parseEther("40"),
        ethers.parseEther("1")
      );
    });
  });

  describe("ReputationSystem", () => {
    it("only owner or first-time can set engine, strangers cannot", async () => {
      const rep2 = await (await ethers.getContractFactory("ReputationSystem")).deploy();
      // First-time set by deployer (owner) works
      await rep2.setNegotiationEngine(carol.address);
      // Owner can update engine address
      await rep2.setNegotiationEngine(alice.address);
      // A non-owner stranger cannot set engine
      await expect(
        rep2.connect(bob).setNegotiationEngine(bob.address)
      ).to.be.revertedWith("ReputationSystem: not authorized");
    });
  });
});
