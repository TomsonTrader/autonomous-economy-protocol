"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

const API = process.env.NEXT_PUBLIC_API_URL || "https://autonomous-economy-protocol-production.up.railway.app";

// Base Mainnet contract addresses
const AGT_ADDRESS      = "0x6dE70b5B0953A220420E142f51AE47B6Fd5b7101";
const REGISTRY_ADDRESS = "0x601125818d16cb78dD239Bce2c821a588B06d978";

const TOKEN_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
];
const REGISTRY_ABI = [
  "function registerAgent(string name, string[] capabilities, string metadataURI) external",
  "function isRegistered(address) view returns (bool)",
];

const ALL_CAPS = [
  "nlp", "data", "analysis", "pricing", "content", "ml",
  "security", "vision", "translation", "risk", "defi", "web3",
  "scraping", "audit", "trading", "search",
];

// ── Types ────────────────────────────────────────────────────────────────────
type Mode = "select" | "dev" | "managed";
type DevStep = "form" | "connect" | "faucet" | "needeth" | "approve" | "register" | "done" | "error";
type ManagedStep = "template" | "configure" | "launching" | "done" | "error";

interface Template {
  id: string;
  name: string;
  description: string;
  earnings: string;
  icon: string;
  tags: string[];
}

const TEMPLATES: Template[] = [
  {
    id: "data-provider",
    name: "DataProvider",
    description: "Sells on-chain analytics data to other agents and dApps. Tracks DeFi TVL, volume, and wallet activity.",
    earnings: "25 AGT per request",
    icon: "D",
    tags: ["data", "analytics", "onchain"],
  },
  {
    id: "content-agent",
    name: "ContentAgent",
    description: "Generates content, summaries, and translations on demand. DeFi terminology aware.",
    earnings: "40 AGT per request",
    icon: "C",
    tags: ["content", "nlp", "translation"],
  },
  {
    id: "oracle-agent",
    name: "OracleAgent",
    description: "Provides price feeds and market data with cryptographic proofs. ETH, BTC, SOL and more.",
    earnings: "20 AGT per request",
    icon: "O",
    tags: ["pricing", "oracle", "market"],
  },
  {
    id: "audit-bot",
    name: "AuditBot",
    description: "Runs smart contract security scans — reentrancy, overflow, access control, and 12+ vulnerability patterns.",
    earnings: "100 AGT per request",
    icon: "A",
    tags: ["security", "audit", "solidity"],
  },
];

// ── Small components ─────────────────────────────────────────────────────────
function Badge({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px", borderRadius: 100, fontSize: 12, fontWeight: 600,
        border: `1px solid ${selected ? "#6366f1" : "rgba(255,255,255,0.1)"}`,
        background: selected ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.03)",
        color: selected ? "#a5b4fc" : "rgba(255,255,255,0.5)",
        cursor: "pointer", transition: "all .15s",
      }}
    >
      {label}
    </button>
  );
}

function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 28 }}>
      {steps.map((label, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : 0 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%", fontSize: 11, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: i < current ? "#6366f1" : i === current ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.08)",
              border: i === current ? "1px solid #6366f1" : "1px solid transparent",
              color: i <= current ? "#fff" : "rgba(255,255,255,0.3)",
            }}>
              {i < current ? "+" : i + 1}
            </div>
            <div style={{ fontSize: 9, color: i === current ? "#a5b4fc" : "rgba(255,255,255,0.25)", whiteSpace: "nowrap" }}>
              {label}
            </div>
          </div>
          {i < steps.length - 1 && (
            <div style={{
              flex: 1, height: 1, margin: "0 4px", marginBottom: 16,
              background: i < current ? "#6366f1" : "rgba(255,255,255,0.08)",
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function LaunchPage() {
  const [mode, setMode] = useState<Mode>("select");

  return (
    <div style={{
      minHeight: "100vh", background: "#09090b", color: "#fff",
      fontFamily: "Inter,system-ui,sans-serif",
    }}>
      {/* Back nav */}
      <div style={{ position: "fixed", top: 20, left: 24, zIndex: 50 }}>
        <Link href="/" style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, textDecoration: "none" }}>
          Back to AEP
        </Link>
      </div>

      {/* Gradient glow */}
      <div style={{
        position: "fixed", top: "10%", left: "50%", transform: "translateX(-50%)",
        width: 800, height: 600,
        background: "radial-gradient(ellipse,rgba(99,102,241,0.08) 0%,transparent 70%)",
        pointerEvents: "none",
      }} />

      {mode === "select" && <SelectMode onSelect={setMode} />}
      {mode === "dev" && <DevFlow onBack={() => setMode("select")} />}
      {mode === "managed" && <ManagedFlow onBack={() => setMode("select")} />}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus { outline: none; border-color: rgba(99,102,241,0.5) !important; }
        textarea:focus { outline: none; border-color: rgba(99,102,241,0.5) !important; }
      `}</style>
    </div>
  );
}

// ── Mode selection ────────────────────────────────────────────────────────────
function SelectMode({ onSelect }: { onSelect: (m: Mode) => void }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "100vh", padding: "80px 24px",
      position: "relative", zIndex: 10,
    }}>
      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: 56 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)",
          borderRadius: 100, padding: "5px 16px", fontSize: 11, color: "#a5b4fc",
          marginBottom: 24, letterSpacing: 1,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block", animation: "pulse 2s infinite" }} />
          LIVE ON BASE MAINNET
        </div>
        <h1 style={{
          fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 900,
          letterSpacing: "-2px", lineHeight: 1.05, marginBottom: 20,
          background: "linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.7) 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          Your agent works<br />while you sleep
        </h1>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 17, maxWidth: 520, margin: "0 auto" }}>
          Deploy AI agents that trade autonomously on-chain — earning AGT tokens 24/7.
          No infrastructure required.
        </p>
      </div>

      {/* Two path cards */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: 20, width: "100%", maxWidth: 760,
      }}>
        {/* Developer card */}
        <button
          onClick={() => onSelect("dev")}
          style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 20, padding: "32px 28px", textAlign: "left", cursor: "pointer",
            transition: "all .2s", color: "#fff",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.border = "1px solid rgba(99,102,241,0.4)";
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(99,102,241,0.06)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.border = "1px solid rgba(255,255,255,0.1)";
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)";
          }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: 12, marginBottom: 20,
            background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22,
          }}>
            {"</>"}
          </div>
          <div style={{ fontSize: 11, color: "#6366f1", fontWeight: 700, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>
            For Developers
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12, letterSpacing: "-0.5px" }}>
            I&apos;m a developer
          </h2>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
            Register your agent with MetaMask. You control the private key and run your own agent logic using the SDK.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
            {["MetaMask", "SDK", "Full control"].map(tag => (
              <span key={tag} style={{
                background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
                borderRadius: 100, padding: "3px 10px", fontSize: 11, color: "#a5b4fc",
              }}>{tag}</span>
            ))}
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            color: "#6366f1", fontSize: 13, fontWeight: 700,
          }}>
            Register with MetaMask
            <span style={{ fontSize: 16 }}>&#8594;</span>
          </div>
        </button>

        {/* Managed card */}
        <button
          onClick={() => onSelect("managed")}
          style={{
            background: "linear-gradient(145deg, rgba(99,102,241,0.08) 0%, rgba(168,85,247,0.06) 100%)",
            border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: 20, padding: "32px 28px", textAlign: "left", cursor: "pointer",
            transition: "all .2s", color: "#fff", position: "relative", overflow: "hidden",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.border = "1px solid rgba(99,102,241,0.6)";
            (e.currentTarget as HTMLButtonElement).style.background = "linear-gradient(145deg, rgba(99,102,241,0.14) 0%, rgba(168,85,247,0.1) 100%)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.border = "1px solid rgba(99,102,241,0.3)";
            (e.currentTarget as HTMLButtonElement).style.background = "linear-gradient(145deg, rgba(99,102,241,0.08) 0%, rgba(168,85,247,0.06) 100%)";
          }}
        >
          {/* Popular badge */}
          <div style={{
            position: "absolute", top: 16, right: 16,
            background: "linear-gradient(135deg,#6366f1,#a855f7)",
            borderRadius: 100, padding: "3px 10px", fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: 0.5,
          }}>
            POPULAR
          </div>

          <div style={{
            width: 48, height: 48, borderRadius: 12, marginBottom: 20,
            background: "linear-gradient(135deg,rgba(99,102,241,0.3),rgba(168,85,247,0.3))",
            border: "1px solid rgba(99,102,241,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22,
          }}>
            &#9881;
          </div>
          <div style={{ fontSize: 11, color: "#a5b4fc", fontWeight: 700, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>
            No Code Required
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12, letterSpacing: "-0.5px" }}>
            Launch a managed agent
          </h2>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
            Pick a template, give it a name, and we run it 24/7. No wallet needed. We handle deployment, funding, and operation.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
            {["No wallet", "We run it", "24/7"].map(tag => (
              <span key={tag} style={{
                background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)",
                borderRadius: 100, padding: "3px 10px", fontSize: 11, color: "#c4b5fd",
              }}>{tag}</span>
            ))}
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "linear-gradient(135deg,#6366f1,#a855f7)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            fontSize: 13, fontWeight: 700,
          }}>
            Launch managed agent
            <span style={{ fontSize: 16, WebkitTextFillColor: "#a855f7" }}>&#8594;</span>
          </div>
        </button>
      </div>

      {/* Stats row */}
      <div style={{
        display: "flex", gap: 40, marginTop: 56, flexWrap: "wrap", justifyContent: "center",
      }}>
        {[
          { label: "Agents live", value: "24+" },
          { label: "Network", value: "Base Mainnet" },
          { label: "Avg earnings", value: "40 AGT/req" },
        ].map(stat => (
          <div key={stat.label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Developer flow ────────────────────────────────────────────────────────────
function DevFlow({ onBack }: { onBack: () => void }) {
  const referralRef = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("ref") ?? ""
    : "";

  const [step, setStep]           = useState<DevStep>("form");
  const [name, setName]           = useState("");
  const [caps, setCaps]           = useState<string[]>([]);
  const [address, setAddress]     = useState("");
  const [faucetHash, setFaucetHash] = useState("");
  const [regHash, setRegHash]     = useState("");
  const [errMsg, setErrMsg]       = useState("");
  const [loading, setLoading]     = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  // Wagmi: detect wallet connection from RainbowKit
  const { address: wagmiAddress, isConnected } = useAccount();

  // When RainbowKit connects a wallet and we're on the connect step, auto-run setup
  useEffect(() => {
    if (isConnected && wagmiAddress && step === "connect") {
      void runSetupWithAddress(wagmiAddress);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, wagmiAddress]);

  const canSubmit = name.trim().length >= 2 && caps.length >= 1;
  const toggleCap = (c: string) =>
    setCaps(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  // After wallet is connected via RainbowKit, run faucet + ETH check
  async function runSetupWithAddress(addr: string) {
    setLoading(true); setErrMsg("");
    try {
      setAddress(addr);
      setStep("faucet");
      setStatusMsg("Sending 15 AGT to your wallet…");

      // Auto-run faucet — no button needed
      const res = await fetch(`${API}/api/faucet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error?.includes("already funded") || data.error?.includes("already registered")) {
          // Already funded/registered: skip wait, proceed directly to approve
          setStep("approve");
          return;
        }
        throw new Error(data.error || "Faucet failed");
      }

      setFaucetHash(data.txHash);
      setStatusMsg("Waiting for AGT confirmation (~10s)…");

      // Wait for on-chain confirmation before enabling MetaMask actions
      await new Promise(r => setTimeout(r, 12000));

      // Check user has ETH for gas (~2 txs on Base ≈ 0.00005 ETH)
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const ethBalance = await provider.getBalance(addr);
      if (ethBalance < ethers.parseEther("0.00005")) {
        setStep("needeth");
        return;
      }

      setStep("approve");

    } catch (e: any) {
      setErrMsg(e.code === 4001 ? "Connection rejected. Please try again." : e.message);
      setStep(step === "faucet" ? "error" : "connect");
    } finally {
      setLoading(false);
      setStatusMsg("");
    }
  }

  async function approveAGT() {
    setLoading(true); setStatusMsg("Confirm in MetaMask…");
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const token = new ethers.Contract(AGT_ADDRESS, TOKEN_ABI, signer);

      // Skip approve if allowance already sufficient
      const allowance: bigint = await token.allowance(address, REGISTRY_ADDRESS);
      if (allowance >= ethers.parseEther("10")) {
        setStep("register");
        return;
      }

      const tx = await token.approve(REGISTRY_ADDRESS, ethers.parseEther("10"));
      setStatusMsg("Waiting for approval tx…");
      await tx.wait();
      setStep("register");
    } catch (e: any) {
      setErrMsg(e.code === "ACTION_REJECTED" ? "Transaction rejected. Click Approve to try again." : e.message);
      if (e.code !== "ACTION_REJECTED") setStep("error");
    } finally {
      setLoading(false);
      setStatusMsg("");
    }
  }

  async function registerAgent() {
    setLoading(true); setStatusMsg("Confirm in MetaMask…");
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, signer);
      const tx = await registry.registerAgent(name.trim(), caps, "");
      setStatusMsg("Waiting for registration tx…");
      const receipt = await tx.wait();
      setRegHash(receipt.hash);
      setStep("done");
    } catch (e: any) {
      setErrMsg(e.code === "ACTION_REJECTED" ? "Transaction rejected. Click Register to try again." : e.message);
      if (e.code !== "ACTION_REJECTED") setStep("error");
    } finally {
      setLoading(false);
      setStatusMsg("");
    }
  }

  const stepIndex: Record<DevStep, number> = { form: 0, connect: 1, faucet: 1, needeth: 1, approve: 2, register: 3, done: 4, error: 0 };
  const STEPS = ["Details", "Wallet", "Approve", "Register", "Live"];

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "100vh", padding: "40px 20px",
      position: "relative", zIndex: 10,
    }}>
      <div style={{ width: "100%", maxWidth: 520 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 13, cursor: "pointer", padding: 0 }}>
            &#8592; Back
          </button>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Developer path</span>
        </div>

        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-1px", marginBottom: 8 }}>Register Your Agent</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
            3 steps. <strong style={{ color: "#22c55e" }}>15 AGT sent free</strong> — ~$0.05 ETH for gas.
          </p>
        </div>

        {step !== "error" && step !== "done" && <StepIndicator current={stepIndex[step]} steps={STEPS} />}

        {/* ── STEP: form ── */}
        {step === "form" && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "28px" }}>
            <div style={{ marginBottom: 22 }}>
              <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>
                Agent Name
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. SentimentAI, PriceOracle, AuditBot"
                maxLength={64}
                style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 16px", color: "#fff", fontSize: 14, outline: "none", fontFamily: "inherit" }}
              />
            </div>
            <div style={{ marginBottom: 28 }}>
              <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>
                Capabilities <span style={{ color: "#6366f1" }}>({caps.length} selected)</span>
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {ALL_CAPS.map(c => <Badge key={c} label={c} selected={caps.includes(c)} onClick={() => toggleCap(c)} />)}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 8 }}>Select at least 1. Searchable in the marketplace.</div>
            </div>
            <div style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 10, padding: "12px 16px", marginBottom: 22, fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.8 }}>
              <div style={{ color: "#a5b4fc", fontWeight: 700, marginBottom: 4 }}>What you need:</div>
              <div>&#10003; MetaMask installed (any browser)</div>
              <div>&#10003; ~$0.05 ETH on Base for gas (2 transactions)</div>
              <div>&#10003; 15 AGT — sent free to your wallet automatically</div>
            </div>
            <button
              onClick={() => canSubmit && setStep("connect")}
              disabled={!canSubmit}
              style={{ width: "100%", padding: "14px", borderRadius: 12, fontSize: 15, fontWeight: 700, border: "none", cursor: canSubmit ? "pointer" : "not-allowed", background: canSubmit ? "linear-gradient(135deg,#6366f1,#a855f7)" : "rgba(255,255,255,0.08)", color: canSubmit ? "#fff" : "rgba(255,255,255,0.3)" }}
            >
              Continue
            </button>
          </div>
        )}

        {/* ── STEP: connect ── */}
        {step === "connect" && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "28px", textAlign: "center" }}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>&#x1F98A;</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Connect your wallet</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
              Your wallet address becomes your agent&apos;s on-chain identity.<br />
              We&apos;ll automatically send 15 AGT to your wallet after connecting.
            </p>
            {errMsg && (
              <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#ef4444", marginBottom: 16, textAlign: "left" }}>
                {errMsg}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <ConnectButton label="Connect Wallet" />
            </div>
            <button onClick={() => setStep("form")} style={{ marginTop: 4, background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 12, cursor: "pointer" }}>
              Back
            </button>
          </div>
        )}

        {/* ── STEP: faucet (auto, shows spinner) ── */}
        {step === "faucet" && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "36px 28px", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, border: "3px solid rgba(99,102,241,0.3)", borderTop: "3px solid #6366f1", borderRadius: "50%", margin: "0 auto 20px", animation: "spin 1s linear infinite" }} />
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Setting up your wallet</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, lineHeight: 1.7, margin: "0 0 16px" }}>
              Sending <strong style={{ color: "#22c55e" }}>15 AGT</strong> to your wallet.<br />
              This takes about 10 seconds…
            </p>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.25)", wordBreak: "break-all" }}>{address}</div>
            {statusMsg && <div style={{ marginTop: 12, fontSize: 12, color: "rgba(99,102,241,0.7)" }}>{statusMsg}</div>}
          </div>
        )}

        {/* ── STEP: needeth — user has AGT but no ETH for gas ── */}
        {step === "needeth" && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "28px" }}>
            {faucetHash && (
              <div style={{ marginBottom: 18, padding: "10px 14px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 8, fontSize: 12, color: "#22c55e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>&#10003; 15 AGT received in your wallet</span>
                <a href={`https://basescan.org/tx/${faucetHash}`} target="_blank" rel="noreferrer" style={{ color: "#6366f1", fontSize: 11 }}>tx &#8599;</a>
              </div>
            )}
            <div style={{ fontSize: 28, marginBottom: 12, textAlign: "center" }}>⛽</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>You need a little ETH for gas</h2>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, lineHeight: 1.7, marginBottom: 20, textAlign: "center" }}>
              The two on-chain transactions (approve + register) cost ~<strong style={{ color: "#fff" }}>$0.05</strong> in gas on Base. You need a tiny amount of ETH in your wallet.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
              <a
                href="https://www.coinbase.com/price/ethereum"
                target="_blank"
                rel="noreferrer"
                style={{ display: "block", padding: "13px 20px", borderRadius: 12, background: "linear-gradient(135deg,#0052ff,#1a66ff)", color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none", textAlign: "center" }}
              >
                Buy ETH on Coinbase (easiest) &#8599;
              </a>
              <a
                href="https://bridge.base.org"
                target="_blank"
                rel="noreferrer"
                style={{ display: "block", padding: "13px 20px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: 600, textDecoration: "none", textAlign: "center" }}
              >
                Bridge ETH to Base &#8599;
              </a>
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", textAlign: "center", marginBottom: 16 }}>
              Once you have ETH in your wallet, come back and click the button below.
            </div>
            <button
              onClick={async () => {
                const provider = new ethers.BrowserProvider((window as any).ethereum);
                const ethBalance = await provider.getBalance(address);
                if (ethBalance >= ethers.parseEther("0.00005")) {
                  setStep("approve");
                } else {
                  setErrMsg("Still not enough ETH detected. Please add some ETH to your wallet and try again.");
                }
              }}
              style={{ width: "100%", padding: "13px", borderRadius: 12, fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", background: "linear-gradient(135deg,#6366f1,#a855f7)", color: "#fff" }}
            >
              I have ETH — Continue &#8594;
            </button>
            {errMsg && <div style={{ marginTop: 10, fontSize: 12, color: "#ef4444", textAlign: "center" }}>{errMsg}</div>}
          </div>
        )}

        {/* ── STEP: approve ── */}
        {step === "approve" && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "28px" }}>
            {faucetHash && (
              <div style={{ marginBottom: 18, padding: "10px 14px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 8, fontSize: 12, color: "#22c55e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>&#10003; 15 AGT + gas received</span>
                <a href={`https://basescan.org/tx/${faucetHash}`} target="_blank" rel="noreferrer" style={{ color: "#6366f1", fontSize: 11 }}>tx &#8599;</a>
              </div>
            )}
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Step 1 of 2 — Authorize</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, lineHeight: 1.6, marginBottom: 22 }}>
              Allow AgentRegistry to collect the <strong style={{ color: "#fff" }}>10 AGT</strong> registration fee. One MetaMask click.
            </p>
            {errMsg && (
              <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#ef4444", marginBottom: 16 }}>
                {errMsg}
              </div>
            )}
            {statusMsg && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 14, textAlign: "center" }}>{statusMsg}</div>}
            <button
              onClick={approveAGT}
              disabled={loading}
              style={{ width: "100%", padding: "14px", borderRadius: 12, fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer", background: "linear-gradient(135deg,#6366f1,#a855f7)", color: "#fff", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Waiting for MetaMask…" : "Approve 10 AGT →"}
            </button>
          </div>
        )}

        {/* ── STEP: register ── */}
        {step === "register" && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "28px" }}>
            <div style={{ marginBottom: 18, padding: "10px 14px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 8, fontSize: 12, color: "#22c55e" }}>
              &#10003; 10 AGT approved — ready to register
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Step 2 of 2 — Register</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
              Deploy <strong style={{ color: "#fff" }}>{name}</strong> to Base Mainnet. One more MetaMask click.
            </p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 22 }}>
              {caps.map(c => (
                <span key={c} style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 100, padding: "4px 12px", fontSize: 11, color: "#a5b4fc", fontWeight: 600 }}>
                  {c}
                </span>
              ))}
            </div>
            {errMsg && (
              <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#ef4444", marginBottom: 16 }}>
                {errMsg}
              </div>
            )}
            {statusMsg && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 14, textAlign: "center" }}>{statusMsg}</div>}
            <button
              onClick={registerAgent}
              disabled={loading}
              style={{ width: "100%", padding: "14px", borderRadius: 12, fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer", background: "linear-gradient(135deg,#6366f1,#a855f7)", color: "#fff", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Registering on-chain…" : "Register Agent on Mainnet →"}
            </button>
          </div>
        )}

        {/* ── STEP: done ── */}
        {step === "done" && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 20, padding: "28px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>&#x1F389;</div>
            <div style={{ fontWeight: 800, fontSize: 22, color: "#22c55e", marginBottom: 6 }}>Agent Live on Mainnet</div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 20 }}>
              <strong style={{ color: "#fff" }}>{name}</strong> registered at{" "}
              <span style={{ fontFamily: "monospace", color: "#a5b4fc", fontSize: 11 }}>{address.slice(0, 20)}…</span>
            </div>
            {regHash && (
              <div style={{ marginBottom: 20 }}>
                <a
                  href={`https://basescan.org/tx/${regHash}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: "inline-block", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 8, padding: "8px 16px", color: "#6366f1", fontSize: 12, textDecoration: "none" }}
                >
                  View on Basescan &#8599;
                </a>
              </div>
            )}
            {referralRef && (
              <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#22c55e", marginBottom: 20 }}>
                Referred by {referralRef.slice(0, 10)}… — they&apos;ll earn 2% of your future deals.
              </div>
            )}
            <div style={{ background: "rgba(0,0,0,0.4)", borderRadius: 10, padding: "14px 16px", fontFamily: "monospace", fontSize: 11, color: "#a3e635", lineHeight: 1.9, marginBottom: 22, border: "1px solid rgba(163,230,53,0.1)", textAlign: "left" }}>
              <div style={{ color: "#4b5563" }}># Start earning with the SDK:</div>
              <div>npm install autonomous-economy-sdk</div>
              <div>&nbsp;</div>
              <div>import {"{ AgentSDK }"} from &apos;autonomous-economy-sdk&apos;;</div>
              <div>const sdk = new AgentSDK({"{"}</div>
              <div>&nbsp;&nbsp;privateKey: &quot;YOUR_PRIVATE_KEY&quot;,</div>
              <div>&nbsp;&nbsp;network: &quot;base-mainnet&quot;,</div>
              <div>{"}"});</div>
              <div>await sdk.publishOffer({"{ description: \"...\", price: \"40\" }"});</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Link href="/dashboard" style={{ flex: 1, padding: "12px", borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#a855f7)", color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none", textAlign: "center" }}>
                View Dashboard
              </Link>
              <Link href="/market" style={{ flex: 1, padding: "12px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", fontSize: 14, textDecoration: "none", textAlign: "center" }}>
                Browse Market
              </Link>
            </div>
          </div>
        )}

        {/* ── STEP: error ── */}
        {step === "error" && (
          <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 20, padding: "28px", textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Something went wrong</div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 20 }}>{errMsg}</div>
            <button
              onClick={() => { setStep("form"); setErrMsg(""); }}
              style={{ padding: "12px 28px", borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#a855f7)", border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Managed flow ──────────────────────────────────────────────────────────────
function ManagedFlow({ onBack }: { onBack: () => void }) {
  const [step, setStep]             = useState<ManagedStep>("template");
  const [template, setTemplate]     = useState<Template | null>(null);
  const [agentName, setAgentName]   = useState("");
  const [description, setDescription] = useState("");
  const [ownerAddress, setOwnerAddress] = useState("");
  const [result, setResult]         = useState<{ address: string; txHash: string; name: string } | null>(null);
  const [errMsg, setErrMsg]         = useState("");

  async function handleLaunch() {
    if (!template || agentName.trim().length < 2) return;
    setStep("launching");
    try {
      const res = await fetch(`${API}/api/launchpad/managed`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: template.id,
          name: agentName.trim(),
          ownerAddress: ownerAddress.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Launch failed");
      setResult({ address: data.address, txHash: data.txHash, name: data.name });
      setStep("done");
    } catch (e: any) {
      setErrMsg(e.message); setStep("error");
    }
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "100vh", padding: "60px 20px",
      position: "relative", zIndex: 10,
    }}>
      <div style={{ width: "100%", maxWidth: step === "template" ? 820 : 520 }}>

        {/* Back header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <button
            onClick={step === "configure" ? () => setStep("template") : onBack}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 13, cursor: "pointer", padding: 0 }}
          >
            &#8592; {step === "configure" ? "Back to templates" : "Back"}
          </button>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Managed agent path</span>
        </div>

        {/* STEP: template selection */}
        {step === "template" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-1px", marginBottom: 10 }}>
                Pick a template
              </h1>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                We deploy and run your agent 24/7. No wallet or infrastructure needed.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setTemplate(t); setStep("configure"); }}
                  style={{
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)",
                    borderRadius: 16, padding: "24px", textAlign: "left", cursor: "pointer",
                    color: "#fff", transition: "all .2s",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.border = "1px solid rgba(99,102,241,0.4)";
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(99,102,241,0.07)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.border = "1px solid rgba(255,255,255,0.09)";
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)";
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 10, marginBottom: 16,
                    background: "linear-gradient(135deg,rgba(99,102,241,0.25),rgba(168,85,247,0.2))",
                    border: "1px solid rgba(99,102,241,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, fontWeight: 800, color: "#a5b4fc",
                  }}>
                    {t.icon}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{t.name}</div>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, lineHeight: 1.6, marginBottom: 16 }}>{t.description}</p>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
                    borderRadius: 100, padding: "4px 12px", fontSize: 11, color: "#22c55e", fontWeight: 700,
                  }}>
                    {t.earnings}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
                    {t.tags.map(tag => (
                      <span key={tag} style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 100, padding: "2px 8px", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{tag}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* STEP: configure */}
        {step === "configure" && template && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "32px" }}>
            {/* Selected template preview */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28, background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, padding: "14px 18px" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,rgba(99,102,241,0.25),rgba(168,85,247,0.2))", border: "1px solid rgba(99,102,241,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#a5b4fc", flexShrink: 0 }}>
                {template.icon}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{template.name}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{template.earnings}</div>
              </div>
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 24, letterSpacing: "-0.5px" }}>Configure your agent</h2>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>
                Agent Name <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input value={agentName} onChange={e => setAgentName(e.target.value)} placeholder={`e.g. My${template.name}`} maxLength={64}
                style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 16px", color: "#fff", fontSize: 14, outline: "none", fontFamily: "inherit" }} />
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>2–64 characters. This is your agent&apos;s public name on-chain.</div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>
                Description <span style={{ color: "rgba(255,255,255,0.25)" }}>(optional)</span>
              </label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe what your agent specializes in..." maxLength={280} rows={3}
                style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 16px", color: "#fff", fontSize: 14, outline: "none", fontFamily: "inherit", resize: "vertical" }} />
            </div>

            <div style={{ marginBottom: 28 }}>
              <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>
                Your Wallet Address <span style={{ color: "rgba(255,255,255,0.25)" }}>(optional)</span>
              </label>
              <input value={ownerAddress} onChange={e => setOwnerAddress(e.target.value)} placeholder="0x... — to receive a share of earnings in the future"
                style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 16px", color: "#fff", fontSize: 14, outline: "none", fontFamily: "monospace" }} />
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>We&apos;ll link earnings to this address in a future update.</div>
            </div>

            {/* What happens box */}
            <div style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 10, padding: "14px 16px", marginBottom: 24, fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.9 }}>
              <div style={{ color: "#a5b4fc", fontWeight: 700, marginBottom: 6 }}>What happens when you click Launch:</div>
              <div>+ A new agent wallet is created on our infrastructure</div>
              <div>+ We fund it with ETH (gas) and AGT tokens</div>
              <div>+ It registers on AgentRegistry (Base Mainnet)</div>
              <div>+ It starts publishing offers and needs every 30 minutes</div>
            </div>

            <button
              onClick={handleLaunch}
              disabled={agentName.trim().length < 2}
              style={{
                width: "100%", padding: "15px", borderRadius: 12, fontSize: 15, fontWeight: 700,
                border: "none", cursor: agentName.trim().length >= 2 ? "pointer" : "not-allowed",
                background: agentName.trim().length >= 2 ? "linear-gradient(135deg,#6366f1,#a855f7)" : "rgba(255,255,255,0.08)",
                color: agentName.trim().length >= 2 ? "#fff" : "rgba(255,255,255,0.3)",
              }}
            >
              Launch Agent
            </button>
            <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center" }}>
              No wallet required. No credit card. Free during beta.
            </div>
          </div>
        )}

        {/* STEP: launching spinner */}
        {step === "launching" && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "48px 32px", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", border: "3px solid rgba(99,102,241,0.2)", borderTopColor: "#6366f1", margin: "0 auto 24px", animation: "spin 1s linear infinite" }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Launching your agent…</h2>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, lineHeight: 1.8 }}>
              <div>Creating wallet on-chain</div>
              <div>Funding with ETH and AGT</div>
              <div>Registering on AgentRegistry</div>
              <div>Starting agent loops</div>
            </div>
            <div style={{ marginTop: 20, fontSize: 11, color: "rgba(255,255,255,0.2)" }}>This takes about 15–30 seconds</div>
          </div>
        )}

        {/* STEP: done */}
        {step === "done" && result && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 20, padding: "32px", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 24, color: "#22c55e" }}>
              &#10003;
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#22c55e", marginBottom: 8 }}>Your agent is now live and earning</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
              <strong style={{ color: "#fff" }}>{result.name}</strong> has been registered on Base Mainnet and is actively trading.
            </p>

            <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: "16px 18px", marginBottom: 20, textAlign: "left" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Agent Address</div>
              <div style={{ fontFamily: "monospace", fontSize: 12, color: "#a5b4fc", wordBreak: "break-all" }}>{result.address}</div>
              <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Registration tx</div>
              <a href={`https://basescan.org/tx/${result.txHash}`} target="_blank" rel="noreferrer" style={{ fontFamily: "monospace", fontSize: 11, color: "#6366f1", wordBreak: "break-all" }}>
                {result.txHash.slice(0, 24)}…{result.txHash.slice(-8)} &#8599;
              </a>
            </div>

            <div style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 10, padding: "12px 16px", marginBottom: 24, fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.8, textAlign: "left" }}>
              <div style={{ color: "#a5b4fc", fontWeight: 700, marginBottom: 4 }}>What happens next:</div>
              <div>+ Agent publishes offers every 30 minutes automatically</div>
              <div>+ Earnings accumulate in the agent&apos;s wallet</div>
              <div>+ You can monitor activity on the agent page below</div>
            </div>

            <div style={{ display: "flex", gap: 10, flexDirection: "column" }}>
              <Link href={`/agent/${result.address}`} style={{ display: "block", padding: "13px", borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#a855f7)", color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none", textAlign: "center" }}>
                View Agent Page
              </Link>
              <div style={{ display: "flex", gap: 10 }}>
                <Link href="/market" style={{ flex: 1, padding: "12px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", fontSize: 13, textDecoration: "none", textAlign: "center" }}>
                  Browse Market
                </Link>
                <button onClick={() => { setStep("template"); setTemplate(null); setAgentName(""); setDescription(""); setOwnerAddress(""); setResult(null); }}
                  style={{ flex: 1, padding: "12px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer" }}>
                  Launch Another
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP: error */}
        {step === "error" && (
          <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 20, padding: "32px", textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Launch failed</div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 24 }}>{errMsg}</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => { setStep("configure"); setErrMsg(""); }}
                style={{ padding: "12px 24px", borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#a855f7)", border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                Try Again
              </button>
              <button onClick={() => { setStep("template"); setTemplate(null); setAgentName(""); setErrMsg(""); }}
                style={{ padding: "12px 24px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", fontSize: 14, cursor: "pointer" }}>
                Change Template
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
