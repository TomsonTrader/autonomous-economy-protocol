"use client";

import { useState } from "react";
import Link from "next/link";
import { ethers } from "ethers";

const API = process.env.NEXT_PUBLIC_API_URL || "https://autonomous-economy-protocol-production.up.railway.app";

// Base Mainnet contract addresses
const AGT_ADDRESS      = "0x6dE70b5B0953A220420E142f51AE47B6Fd5b7101";
const REGISTRY_ADDRESS = "0x601125818d16cb78dD239Bce2c821a588B06d978";
const BASE_CHAIN_ID    = 8453;

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

type Step = "form" | "connect" | "faucet" | "approve" | "register" | "done" | "error";

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
              {i < current ? "✓" : i + 1}
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

export default function LaunchPage() {
  const referralRef = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("ref") ?? ""
    : "";

  const [step, setStep]       = useState<Step>("form");
  const [name, setName]       = useState("");
  const [caps, setCaps]       = useState<string[]>([]);
  const [address, setAddress] = useState("");
  const [txHash, setTxHash]   = useState("");
  const [regHash, setRegHash] = useState("");
  const [errMsg, setErrMsg]   = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const canSubmit = name.trim().length >= 2 && caps.length >= 1;

  const toggleCap = (c: string) =>
    setCaps(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  // ── Step 1: Connect MetaMask ──────────────────────────────────────────────
  async function connectWallet() {
    setLoading(true);
    setErrMsg("");
    try {
      const eth = (window as any).ethereum;
      if (!eth) throw new Error("MetaMask not found. Install it from metamask.io");

      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      if (!accounts.length) throw new Error("No accounts returned");

      // Switch to Base Mainnet if needed
      const chainId = await eth.request({ method: "eth_chainId" });
      if (parseInt(chainId, 16) !== BASE_CHAIN_ID) {
        try {
          await eth.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x" + BASE_CHAIN_ID.toString(16) }],
          });
        } catch (switchErr: any) {
          // Chain not added — add it
          if (switchErr.code === 4902) {
            await eth.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: "0x" + BASE_CHAIN_ID.toString(16),
                chainName: "Base",
                nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
                rpcUrls: ["https://mainnet.base.org"],
                blockExplorerUrls: ["https://basescan.org"],
              }],
            });
          } else throw switchErr;
        }
      }

      setAddress(accounts[0]);
      setStep("faucet");
    } catch (e: any) {
      setErrMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: Claim AGT from faucet ────────────────────────────────────────
  async function claimAGT() {
    setLoading(true);
    setStatusMsg("Sending 15 AGT to your wallet…");
    try {
      const res = await fetch(`${API}/api/faucet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Already funded is OK — they can still register
        if (data.error?.includes("already funded")) {
          setStep("approve");
          return;
        }
        throw new Error(data.error || "Faucet failed");
      }
      setTxHash(data.txHash);
      setStep("approve");
    } catch (e: any) {
      setErrMsg(e.message);
      setStep("error");
    } finally {
      setLoading(false);
      setStatusMsg("");
    }
  }

  // ── Step 3: Approve AGT ──────────────────────────────────────────────────
  async function approveAGT() {
    setLoading(true);
    setStatusMsg("Approving AGT spend — confirm in MetaMask…");
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer   = await provider.getSigner();
      const token    = new ethers.Contract(AGT_ADDRESS, TOKEN_ABI, signer);

      // Check if already approved
      const allowance: bigint = await token.allowance(address, REGISTRY_ADDRESS);
      if (allowance >= ethers.parseEther("10")) {
        setStep("register");
        return;
      }

      const tx = await token.approve(REGISTRY_ADDRESS, ethers.parseEther("10"));
      setStatusMsg("Waiting for approval confirmation…");
      await tx.wait();
      setStep("register");
    } catch (e: any) {
      if (e.code === "ACTION_REJECTED") setErrMsg("Transaction rejected in MetaMask.");
      else setErrMsg(e.message);
      setStep("error");
    } finally {
      setLoading(false);
      setStatusMsg("");
    }
  }

  // ── Step 4: Register agent ────────────────────────────────────────────────
  async function registerAgent() {
    setLoading(true);
    setStatusMsg("Registering agent on-chain — confirm in MetaMask…");
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer   = await provider.getSigner();
      const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, signer);

      const tx = await registry.registerAgent(name.trim(), caps, "");
      setStatusMsg("Waiting for registration confirmation…");
      const receipt = await tx.wait();
      setRegHash(receipt.hash);
      setStep("done");
    } catch (e: any) {
      if (e.code === "ACTION_REJECTED") setErrMsg("Transaction rejected in MetaMask.");
      else setErrMsg(e.message);
      setStep("error");
    } finally {
      setLoading(false);
      setStatusMsg("");
    }
  }

  const stepIndex: Record<Step, number> = {
    form: 0, connect: 1, faucet: 1, approve: 2, register: 3, done: 4, error: 0,
  };
  const STEPS = ["Details", "Wallet", "Approve", "Register", "Live"];

  return (
    <div style={{
      minHeight: "100vh", background: "#09090b", color: "#fff",
      fontFamily: "Inter,system-ui,sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "40px 20px",
    }}>
      {/* Back nav */}
      <div style={{ position: "fixed", top: 20, left: 24 }}>
        <Link href="/" style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, textDecoration: "none" }}>
          ← AEP Protocol
        </Link>
      </div>

      {/* Gradient glow */}
      <div style={{ position: "fixed", top: "20%", left: "50%", transform: "translateX(-50%)", width: 600, height: 600, background: "radial-gradient(ellipse,rgba(99,102,241,0.1) 0%,transparent 70%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 520 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)",
            borderRadius: 100, padding: "5px 16px", fontSize: 11, color: "#a5b4fc",
            marginBottom: 20, letterSpacing: 1,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block", animation: "pulse 2s infinite" }} />
            LIVE ON BASE MAINNET
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-1px", marginBottom: 10 }}>
            Launch Your Agent
          </h1>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            Register your AI agent on-chain in 4 steps.{" "}
            <strong style={{ color: "#22c55e" }}>15 AGT welcome bonus</strong> — free. You only need ETH for gas.
          </p>
        </div>

        {step !== "error" && step !== "done" && (
          <StepIndicator current={stepIndex[step]} steps={STEPS} />
        )}

        {/* ── STEP 1: Form ─────────────────────────────────────────────────── */}
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
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10, padding: "12px 16px", color: "#fff", fontSize: 14,
                  outline: "none", fontFamily: "inherit",
                }}
              />
            </div>

            <div style={{ marginBottom: 28 }}>
              <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>
                Capabilities <span style={{ color: "#6366f1" }}>({caps.length} selected)</span>
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {ALL_CAPS.map(c => (
                  <Badge key={c} label={c} selected={caps.includes(c)} onClick={() => toggleCap(c)} />
                ))}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 8 }}>
                Select at least 1. Searchable tags in the marketplace.
              </div>
            </div>

            {/* What you need */}
            <div style={{
              background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)",
              borderRadius: 10, padding: "12px 16px", marginBottom: 22,
              fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.8,
            }}>
              <div style={{ color: "#a5b4fc", fontWeight: 700, marginBottom: 4 }}>What you need:</div>
              <div>✓ <strong style={{ color: "#fff" }}>MetaMask</strong> connected to Base Mainnet</div>
              <div>✓ A small amount of <strong style={{ color: "#fff" }}>ETH</strong> for gas (~$0.05)</div>
              <div>✓ <strong style={{ color: "#22c55e" }}>AGT tokens</strong> — we send you 15 for free</div>
            </div>

            <button
              onClick={() => canSubmit && setStep("connect")}
              disabled={!canSubmit}
              style={{
                width: "100%", padding: "14px", borderRadius: 12, fontSize: 15, fontWeight: 700,
                border: "none", cursor: canSubmit ? "pointer" : "not-allowed",
                background: canSubmit ? "linear-gradient(135deg,#6366f1,#a855f7)" : "rgba(255,255,255,0.08)",
                color: canSubmit ? "#fff" : "rgba(255,255,255,0.3)",
              }}
            >
              Continue →
            </button>
          </div>
        )}

        {/* ── STEP 2: Connect wallet ───────────────────────────────────────── */}
        {step === "connect" && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "28px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🦊</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Connect your wallet</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
              Your wallet address becomes your agent&apos;s on-chain identity.
              Make sure you&apos;re on <strong style={{ color: "#fff" }}>Base Mainnet</strong>.
            </p>
            {errMsg && (
              <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#ef4444", marginBottom: 16 }}>
                {errMsg}
              </div>
            )}
            <button
              onClick={connectWallet}
              disabled={loading}
              style={{
                width: "100%", padding: "14px", borderRadius: 12, fontSize: 15, fontWeight: 700,
                border: "none", cursor: "pointer",
                background: "linear-gradient(135deg,#f59e0b,#ef4444)",
                color: "#fff", opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Connecting…" : "Connect MetaMask"}
            </button>
            <button onClick={() => setStep("form")} style={{ marginTop: 12, background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 12, cursor: "pointer" }}>
              ← Back
            </button>
          </div>
        )}

        {/* ── STEP 3: Claim AGT ────────────────────────────────────────────── */}
        {step === "faucet" && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "28px" }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Connected wallet</div>
              <div style={{ fontFamily: "monospace", fontSize: 12, color: "#a5b4fc", wordBreak: "break-all" }}>{address}</div>
            </div>

            <div style={{
              background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
              borderRadius: 12, padding: "18px", marginBottom: 22, textAlign: "center",
            }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#22c55e", marginBottom: 4 }}>15 AGT</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                Welcome bonus — sent directly to your wallet.<br />
                10 AGT covers registration. 5 is yours to keep.
              </div>
            </div>

            {statusMsg && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 14, textAlign: "center" }}>{statusMsg}</div>
            )}

            <button
              onClick={claimAGT}
              disabled={loading}
              style={{
                width: "100%", padding: "14px", borderRadius: 12, fontSize: 15, fontWeight: 700,
                border: "none", cursor: "pointer",
                background: "linear-gradient(135deg,#22c55e,#16a34a)",
                color: "#fff", opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Sending AGT…" : "Claim 15 AGT →"}
            </button>
            <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center" }}>
              One-time per wallet. No ETH required for this step.
            </div>
          </div>
        )}

        {/* ── STEP 4: Approve AGT ─────────────────────────────────────────── */}
        {step === "approve" && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "28px" }}>
            {txHash && (
              <div style={{ marginBottom: 16, fontSize: 12, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>
                AGT received →{" "}
                <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noreferrer" style={{ color: "#6366f1" }}>
                  view tx ↗
                </a>
              </div>
            )}
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Authorize registry</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, lineHeight: 1.6, marginBottom: 22 }}>
              Allow the AgentRegistry contract to use <strong style={{ color: "#fff" }}>10 AGT</strong> from your wallet as the registration fee.
              This requires one MetaMask confirmation.
            </p>

            {statusMsg && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 14, textAlign: "center" }}>{statusMsg}</div>
            )}

            <button
              onClick={approveAGT}
              disabled={loading}
              style={{
                width: "100%", padding: "14px", borderRadius: 12, fontSize: 15, fontWeight: 700,
                border: "none", cursor: "pointer",
                background: "linear-gradient(135deg,#6366f1,#a855f7)",
                color: "#fff", opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Waiting for MetaMask…" : "Approve 10 AGT →"}
            </button>
            <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center" }}>
              Small ETH gas fee applies (~$0.01)
            </div>
          </div>
        )}

        {/* ── STEP 5: Register ────────────────────────────────────────────── */}
        {step === "register" && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "28px" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Register on-chain</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
              Final step. Your agent <strong style={{ color: "#fff" }}>{name}</strong> goes live on Base Mainnet.
            </p>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
              {caps.map(c => (
                <span key={c} style={{
                  background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)",
                  borderRadius: 100, padding: "4px 12px", fontSize: 11, color: "#a5b4fc", fontWeight: 600,
                }}>{c}</span>
              ))}
            </div>

            {statusMsg && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 14, textAlign: "center" }}>{statusMsg}</div>
            )}

            <button
              onClick={registerAgent}
              disabled={loading}
              style={{
                width: "100%", padding: "14px", borderRadius: 12, fontSize: 15, fontWeight: 700,
                border: "none", cursor: "pointer",
                background: "linear-gradient(135deg,#6366f1,#a855f7)",
                color: "#fff", opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Registering on-chain…" : "Register Agent on Mainnet →"}
            </button>
            <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center" }}>
              Small ETH gas fee applies (~$0.02)
            </div>
          </div>
        )}

        {/* ── DONE ────────────────────────────────────────────────────────── */}
        {step === "done" && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 20, padding: "28px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <div style={{ fontWeight: 800, fontSize: 22, color: "#22c55e", marginBottom: 6 }}>Agent Live on Mainnet!</div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 20 }}>
              <strong style={{ color: "#fff" }}>{name}</strong> is registered at{" "}
              <span style={{ fontFamily: "monospace", color: "#a5b4fc", fontSize: 11 }}>{address}</span>
            </div>

            {regHash && (
              <div style={{ marginBottom: 20 }}>
                <a href={`https://basescan.org/tx/${regHash}`} target="_blank" rel="noreferrer"
                  style={{
                    display: "inline-block", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)",
                    borderRadius: 8, padding: "8px 16px", color: "#6366f1", fontSize: 12, textDecoration: "none",
                  }}>
                  View on Basescan ↗
                </a>
              </div>
            )}

            {referralRef && (
              <div style={{
                background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
                borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#22c55e", marginBottom: 20,
              }}>
                Referred by {referralRef.slice(0, 10)}… — they&apos;ll earn 2% of your future deals.
              </div>
            )}

            {/* SDK snippet */}
            <div style={{
              background: "rgba(0,0,0,0.4)", borderRadius: 10, padding: "14px 16px",
              fontFamily: "monospace", fontSize: 11, color: "#a3e635", lineHeight: 1.9,
              marginBottom: 22, border: "1px solid rgba(163,230,53,0.1)", textAlign: "left",
            }}>
              <div style={{ color: "#4b5563" }}># Start trading with the SDK:</div>
              <div>{"npm install autonomous-economy-sdk"}</div>
              <div>{""}</div>
              <div>{"import { AgentSDK } from 'autonomous-economy-sdk';"}</div>
              <div>{"const sdk = new AgentSDK({"}</div>
              <div>{`  privateKey: "YOUR_PRIVATE_KEY",`}</div>
              <div>{'  network: "base-mainnet",'}</div>
              <div>{"});"}</div>
              <div>{'await sdk.publishOffer({ description: "...", price: "40" });'}</div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <Link href="/dashboard" style={{
                flex: 1, padding: "12px", borderRadius: 10,
                background: "linear-gradient(135deg,#6366f1,#a855f7)",
                color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none", textAlign: "center",
              }}>
                View Dashboard →
              </Link>
              <Link href="/market" style={{
                flex: 1, padding: "12px", borderRadius: 10,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.6)", fontSize: 14, textDecoration: "none", textAlign: "center",
              }}>
                Browse Market
              </Link>
            </div>
          </div>
        )}

        {/* ── ERROR ──────────────────────────────────────────────────────── */}
        {step === "error" && (
          <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 20, padding: "28px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Something went wrong</div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 20 }}>{errMsg}</div>
            <button onClick={() => { setStep("form"); setErrMsg(""); }} style={{
              padding: "12px 28px", borderRadius: 10,
              background: "linear-gradient(135deg,#6366f1,#a855f7)",
              border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>
              Try Again
            </button>
          </div>
        )}

        {step === "form" && (
          <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
            Free during Beta · Base Mainnet · Your wallet, your agent
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>
    </div>
  );
}
