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

  // ── AgentVault ────────────────────────────────────────────────────────────
  describe("AgentVault", () => {
    let vault: any;

    beforeEach(async () => {
      const AgentVault = await ethers.getContractFactory("AgentVault");
      vault = await AgentVault.deploy(await token.getAddress(), await reputation.getAddress());

      // Register alice and bob (outer beforeEach gives each 100 AGT)
      const registryAddr = await registry.getAddress();
      await token.connect(alice).approve(registryAddr, ENTRY_FEE);
      await registry.connect(alice).registerAgent("Alice", ["data"], "");
      await token.connect(bob).approve(registryAddr, ENTRY_FEE);
      await registry.connect(bob).registerAgent("Bob", ["data"], "");

      // Extra tokens so alice can reach tier 3 (needs 50 000 AGT staked)
      await token.transfer(alice.address, ethers.parseEther("60000"));
    });

    it("stake updates tier correctly (0 → 1 → 2 → 3)", async () => {
      const vaultAddr = await vault.getAddress();
      expect(await vault.getTier(alice.address)).to.equal(0);

      await token.connect(alice).approve(vaultAddr, ethers.parseEther("500"));
      await vault.connect(alice).stake(ethers.parseEther("500"));
      expect(await vault.getTier(alice.address)).to.equal(1);

      await token.connect(alice).approve(vaultAddr, ethers.parseEther("4500"));
      await vault.connect(alice).stake(ethers.parseEther("4500"));
      expect(await vault.getTier(alice.address)).to.equal(2);

      await token.connect(alice).approve(vaultAddr, ethers.parseEther("45000"));
      await vault.connect(alice).stake(ethers.parseEther("45000"));
      expect(await vault.getTier(alice.address)).to.equal(3);
    });

    it("getMaxDealSize returns correct cap per tier", async () => {
      const vaultAddr = await vault.getAddress();

      // Tier 0 → 500 AGT cap
      expect(await vault.getMaxDealSize(alice.address)).to.equal(ethers.parseEther("500"));

      // Stake to tier 1 → 5 000 AGT cap
      await token.connect(alice).approve(vaultAddr, ethers.parseEther("500"));
      await vault.connect(alice).stake(ethers.parseEther("500"));
      expect(await vault.getMaxDealSize(alice.address)).to.equal(ethers.parseEther("5000"));

      // Stake to tier 2 → 50 000 AGT cap
      await token.connect(alice).approve(vaultAddr, ethers.parseEther("4500"));
      await vault.connect(alice).stake(ethers.parseEther("4500"));
      expect(await vault.getMaxDealSize(alice.address)).to.equal(ethers.parseEther("50000"));
    });

    it("yield accrues at ~5% APY and is claimable", async () => {
      const vaultAddr = await vault.getAddress();
      await vault.setMarketplace(deployer.address);

      await token.connect(alice).approve(vaultAddr, ethers.parseEther("1000"));
      await vault.connect(alice).stake(ethers.parseEther("1000"));

      // Fund yield pool so claimYield can transfer
      await token.approve(vaultAddr, ethers.parseEther("100"));
      await vault.depositFee(ethers.parseEther("100"));

      // Advance 1 year
      await ethers.provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      // 5% of 1000 = 50 AGT
      const pending = await vault.getPendingYield(alice.address);
      expect(pending).to.be.closeTo(ethers.parseEther("50"), ethers.parseEther("1"));

      const balBefore = await token.balanceOf(alice.address);
      await vault.connect(alice).claimYield();
      const balAfter = await token.balanceOf(alice.address);
      expect(balAfter - balBefore).to.be.closeTo(ethers.parseEther("50"), ethers.parseEther("1"));
    });

    it("requestUnstake enforces 7-day cooldown", async () => {
      const vaultAddr = await vault.getAddress();
      await token.connect(alice).approve(vaultAddr, ethers.parseEther("500"));
      await vault.connect(alice).stake(ethers.parseEther("500"));

      await vault.connect(alice).requestUnstake(ethers.parseEther("500"));

      // Immediately trying to unstake must revert
      await expect(vault.connect(alice).unstake()).to.be.revertedWith("AgentVault: cooldown not elapsed");

      // After 7 days it should succeed
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine", []);
      await expect(vault.connect(alice).unstake()).to.not.be.reverted;
    });

    describe("credit line (requires on-chain reputation)", () => {
      // Run a full deal so bob (seller) earns a reputation score
      beforeEach(async () => {
        // Use block timestamp (not Date.now()) — prior tests may have advanced EVM time
        const latestBlock = await ethers.provider.getBlock("latest");
        const deadline = latestBlock!.timestamp + ONE_DAY;
        await marketplace.connect(alice).publishNeed("Need data", ethers.parseEther("100"), deadline, ["data"]);
        await marketplace.connect(bob).publishOffer("Offer data", ethers.parseEther("80"), ["data"]);

        await engine.connect(alice).propose(0n, 0n, ethers.parseEther("80"), "terms");
        await engine.connect(bob).acceptProposal(0);

        const agreementAddr = await engine.proposalAgreement(0);
        const agreement = await ethers.getContractAt("AutonomousAgreement", agreementAddr);
        await token.connect(alice).approve(agreementAddr, ethers.parseEther("80"));
        await agreement.connect(alice).fund();
        await agreement.connect(alice).confirmDelivery(); // records reputation for bob
      });

      it("reputation score > 0 grants borrowable credit limit", async () => {
        const creditLimit = await vault.getCreditLimit(bob.address);
        expect(creditLimit).to.be.gt(0);

        const vaultAddr = await vault.getAddress();
        await vault.setMarketplace(deployer.address);
        await token.approve(vaultAddr, ethers.parseEther("100"));
        await vault.depositFee(ethers.parseEther("100"));

        const borrowAmount = creditLimit < ethers.parseEther("10") ? creditLimit : ethers.parseEther("10");
        const balBefore = await token.balanceOf(bob.address);
        await vault.connect(bob).borrow(borrowAmount);
        const balAfter = await token.balanceOf(bob.address);
        expect(balAfter - balBefore).to.equal(borrowAmount);
      });

      it("cannot requestUnstake with active debt", async () => {
        const creditLimit = await vault.getCreditLimit(bob.address);
        expect(creditLimit).to.be.gt(0);

        const vaultAddr = await vault.getAddress();
        await vault.setMarketplace(deployer.address);
        await token.approve(vaultAddr, ethers.parseEther("100"));
        await vault.depositFee(ethers.parseEther("100"));

        // Bob stakes then borrows
        await token.connect(bob).approve(vaultAddr, ethers.parseEther("500"));
        await vault.connect(bob).stake(ethers.parseEther("500"));
        const borrowAmount = creditLimit < ethers.parseEther("5") ? creditLimit : ethers.parseEther("5");
        await vault.connect(bob).borrow(borrowAmount);

        await expect(
          vault.connect(bob).requestUnstake(ethers.parseEther("500"))
        ).to.be.revertedWith("AgentVault: repay debt first");
      });

      it("repay clears debt and restores full credit line", async () => {
        const vaultAddr = await vault.getAddress();
        await vault.setMarketplace(deployer.address);
        await token.approve(vaultAddr, ethers.parseEther("100"));
        await vault.depositFee(ethers.parseEther("100"));

        const creditLimit = await vault.getCreditLimit(bob.address);
        const borrowAmount = creditLimit < ethers.parseEther("5") ? creditLimit : ethers.parseEther("5");
        await vault.connect(bob).borrow(borrowAmount);

        let vaultData = await vault.getVault(bob.address);
        expect(vaultData.borrowed).to.equal(borrowAmount);

        await token.connect(bob).approve(vaultAddr, borrowAmount);
        await vault.connect(bob).repay(borrowAmount);

        vaultData = await vault.getVault(bob.address);
        expect(vaultData.borrowed).to.equal(0);
      });
    });
  });

  // ── ReferralNetwork ───────────────────────────────────────────────────────
  describe("ReferralNetwork", () => {
    let referral: any;

    beforeEach(async () => {
      const ReferralNetwork = await ethers.getContractFactory("ReferralNetwork");
      referral = await ReferralNetwork.deploy(await token.getAddress(), deployer.address);
      // Use deployer as marketplace so tests can call onlyProtocol functions
      await referral.setMarketplace(deployer.address);
    });

    it("direct referral earns 1% commission on deal", async () => {
      // alice refers bob
      await referral.registerReferral(bob.address, alice.address);

      const dealValue = ethers.parseEther("1000");
      const expectedCommission = (dealValue * 100n) / 10_000n; // 10 AGT

      // Deposit commission funds into the contract
      await token.approve(await referral.getAddress(), expectedCommission);
      await referral.depositForCommissions(expectedCommission);

      await referral.distributeCommissions(bob.address, dealValue);

      const aliceData = await referral.getReferralData(alice.address);
      expect(aliceData.claimableEarnings).to.equal(expectedCommission);
    });

    it("2-level: A→B→C gives B 1% and A 0.5% of C's deal", async () => {
      // deployer refers alice, alice refers bob
      await referral.registerReferral(alice.address, carol.address);
      await referral.registerReferral(bob.address, alice.address);

      const dealValue = ethers.parseEther("1000");
      const l1Commission = (dealValue * 100n) / 10_000n; // 10 AGT → alice
      const l2Commission = (dealValue * 50n) / 10_000n;  // 5 AGT  → carol

      await token.approve(await referral.getAddress(), l1Commission + l2Commission);
      await referral.depositForCommissions(l1Commission + l2Commission);

      await referral.distributeCommissions(bob.address, dealValue);

      const aliceData = await referral.getReferralData(alice.address);
      expect(aliceData.claimableEarnings).to.equal(l1Commission);

      const carolData = await referral.getReferralData(carol.address);
      expect(carolData.claimableEarnings).to.equal(l2Commission);
    });

    it("claimCommissions transfers exact amount to earner", async () => {
      await referral.registerReferral(bob.address, alice.address);

      const dealValue = ethers.parseEther("2000");
      const commission = (dealValue * 100n) / 10_000n; // 20 AGT

      await token.approve(await referral.getAddress(), commission);
      await referral.depositForCommissions(commission);
      await referral.distributeCommissions(bob.address, dealValue);

      const balBefore = await token.balanceOf(alice.address);
      await referral.connect(alice).claimCommissions();
      const balAfter = await token.balanceOf(alice.address);
      expect(balAfter - balBefore).to.equal(commission);
    });
  });

  // ── SubscriptionManager ───────────────────────────────────────────────────
  describe("SubscriptionManager", () => {
    let subManager: any;
    const PERIOD_DURATION = 3600; // 1 hour in seconds
    const PRICE_PER_PERIOD = ethers.parseEther("10");

    beforeEach(async () => {
      const SubscriptionManager = await ethers.getContractFactory("SubscriptionManager");
      subManager = await SubscriptionManager.deploy(await token.getAddress(), await registry.getAddress());

      // Register alice (subscriber) and bob (provider)
      const registryAddr = await registry.getAddress();
      await token.connect(alice).approve(registryAddr, ENTRY_FEE);
      await registry.connect(alice).registerAgent("Alice", ["data"], "");
      await token.connect(bob).approve(registryAddr, ENTRY_FEE);
      await registry.connect(bob).registerAgent("Bob", ["data"], "");

      // Give alice extra tokens for subscriptions
      await token.transfer(alice.address, ethers.parseEther("500"));
    });

    it("subscribe → provider claims 1 period after interval", async () => {
      const totalPeriods = 3;
      const totalCost = PRICE_PER_PERIOD * BigInt(totalPeriods);

      await token.connect(alice).approve(await subManager.getAddress(), totalCost);
      await subManager.connect(alice).subscribe(
        bob.address, PRICE_PER_PERIOD, PERIOD_DURATION, totalPeriods, "Daily data feed"
      );

      // Advance exactly 1 period
      await ethers.provider.send("evm_increaseTime", [PERIOD_DURATION]);
      await ethers.provider.send("evm_mine", []);

      const balBefore = await token.balanceOf(bob.address);
      await subManager.connect(bob).claimPeriod(0);
      const balAfter = await token.balanceOf(bob.address);

      expect(balAfter - balBefore).to.equal(PRICE_PER_PERIOD);

      const sub = await subManager.getSubscription(0);
      expect(sub.periodsRemaining).to.equal(2);
    });

    it("cancel with no time elapsed gives subscriber full refund", async () => {
      const totalPeriods = 3;
      const totalCost = PRICE_PER_PERIOD * BigInt(totalPeriods);

      await token.connect(alice).approve(await subManager.getAddress(), totalCost);
      await subManager.connect(alice).subscribe(
        bob.address, PRICE_PER_PERIOD, PERIOD_DURATION, totalPeriods, "Service"
      );

      const aliceBefore = await token.balanceOf(alice.address);
      await subManager.connect(alice).cancel(0);
      const aliceAfter = await token.balanceOf(alice.address);

      // No time elapsed → full refund
      expect(aliceAfter - aliceBefore).to.equal(totalCost);
    });

    it("claim 2 periods at once after 2.5-period time advance", async () => {
      const totalPeriods = 3;
      const totalCost = PRICE_PER_PERIOD * BigInt(totalPeriods);

      await token.connect(alice).approve(await subManager.getAddress(), totalCost);
      await subManager.connect(alice).subscribe(
        bob.address, PRICE_PER_PERIOD, PERIOD_DURATION, totalPeriods, "Service"
      );

      // Advance 2.5 periods → 2 full periods elapsed
      await ethers.provider.send("evm_increaseTime", [PERIOD_DURATION * 2 + PERIOD_DURATION / 2]);
      await ethers.provider.send("evm_mine", []);

      const balBefore = await token.balanceOf(bob.address);
      await subManager.connect(bob).claimPeriod(0);
      const balAfter = await token.balanceOf(bob.address);

      expect(balAfter - balBefore).to.equal(PRICE_PER_PERIOD * 2n);
    });
  });

  // ── TaskDAG ───────────────────────────────────────────────────────────────
  describe("TaskDAG", () => {
    let taskDAG: any;

    beforeEach(async () => {
      const TaskDAG = await ethers.getContractFactory("TaskDAG");
      taskDAG = await TaskDAG.deploy(await token.getAddress(), await registry.getAddress());

      // Register alice (orchestrator), bob and carol (workers)
      const registryAddr = await registry.getAddress();
      await token.connect(alice).approve(registryAddr, ENTRY_FEE);
      await registry.connect(alice).registerAgent("Alice Orchestrator", ["orchestration"], "");
      await token.connect(bob).approve(registryAddr, ENTRY_FEE);
      await registry.connect(bob).registerAgent("Bob Worker", ["data"], "");
      // Carol needs tokens (outer beforeEach doesn't fund her)
      await token.transfer(carol.address, ethers.parseEther("100"));
      await token.connect(carol).approve(registryAddr, ENTRY_FEE);
      await registry.connect(carol).registerAgent("Carol Worker", ["content"], "");

      // Give alice extra budget for tasks
      await token.transfer(alice.address, ethers.parseEther("2000"));
    });

    it("createTask → spawnSubtask → completeSubtask → parent auto-completes", async () => {
      const taskAddr = await taskDAG.getAddress();
      const latestBlock1 = await ethers.provider.getBlock("latest");
      const deadline = latestBlock1!.timestamp + ONE_DAY;
      const budget = ethers.parseEther("300");

      // Alice creates parent task (sentinel at [0], first real task = id 1)
      await token.connect(alice).approve(taskAddr, budget);
      await taskDAG.connect(alice).createTask("Market Analysis", [], budget, deadline, 1);
      const parentId = 1;

      // Spawn subtask to bob with 100 AGT
      const subtaskBudget = ethers.parseEther("100");
      await taskDAG.connect(alice).spawnSubtask(
        parentId, bob.address, "Analyze dataset", [], subtaskBudget, deadline
      );
      const subtaskId = 2;

      // completeSubtask → bob gets paid, parent auto-completes (1 of 1 required done)
      const bobBefore = await token.balanceOf(bob.address);
      await taskDAG.connect(alice).completeSubtask(subtaskId);
      const bobAfter = await token.balanceOf(bob.address);

      expect(bobAfter - bobBefore).to.equal(subtaskBudget);

      const parentTask = await taskDAG.getTask(parentId);
      expect(parentTask.status).to.equal(2); // TaskStatus.Completed
    });

    it("spawnSubtask carves correct budget slice", async () => {
      const taskAddr = await taskDAG.getAddress();
      const latestBlock2 = await ethers.provider.getBlock("latest");
      const deadline = latestBlock2!.timestamp + ONE_DAY;

      await token.connect(alice).approve(taskAddr, ethers.parseEther("500"));
      await taskDAG.connect(alice).createTask("Task", [], ethers.parseEther("500"), deadline, 0);

      const subtaskBudget = ethers.parseEther("150");
      await taskDAG.connect(alice).spawnSubtask(
        1, bob.address, "Sub", [], subtaskBudget, deadline
      );

      const subtask = await taskDAG.getTask(2);
      expect(subtask.budget).to.equal(subtaskBudget);
      expect(subtask.assignee).to.equal(bob.address);
    });

    it("cancelTask refunds full budget to orchestrator", async () => {
      const taskAddr = await taskDAG.getAddress();
      const latestBlock3 = await ethers.provider.getBlock("latest");
      const deadline = latestBlock3!.timestamp + ONE_DAY;
      const budget = ethers.parseEther("200");

      await token.connect(alice).approve(taskAddr, budget);
      await taskDAG.connect(alice).createTask("Task to cancel", [], budget, deadline, 0);

      const balBefore = await token.balanceOf(alice.address);
      await taskDAG.connect(alice).cancelTask(1);
      const balAfter = await token.balanceOf(alice.address);

      expect(balAfter - balBefore).to.equal(budget);
    });

    it("completeTask reverts when required subtask is still pending", async () => {
      const taskAddr = await taskDAG.getAddress();
      const latestBlock4 = await ethers.provider.getBlock("latest");
      const deadline = latestBlock4!.timestamp + ONE_DAY;

      await token.connect(alice).approve(taskAddr, ethers.parseEther("300"));
      // requiredSubtasks = 1
      await taskDAG.connect(alice).createTask("Task", [], ethers.parseEther("300"), deadline, 1);

      // Bob accepts the parent task (sets assignee so completeTask path is reachable)
      await taskDAG.connect(bob).acceptTask(1);

      // Spawn a subtask but don't complete it
      await taskDAG.connect(alice).spawnSubtask(
        1, carol.address, "Required sub", [], ethers.parseEther("100"), deadline
      );

      // completeTask should revert because subtask is still pending
      await expect(
        taskDAG.connect(alice).completeTask(1)
      ).to.be.revertedWith("TaskDAG: subtasks pending");
    });
  });
});
