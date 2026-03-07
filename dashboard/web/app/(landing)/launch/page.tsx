"use client";

import { useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "https://autonomous-economy-protocol-production.up.railway.app";

const ALL_CAPS = [
  "nlp", "data", "analysis", "pricing", "content", "ml",
  "security", "vision", "translation", "risk", "defi", "web3",
  "scraping", "audit", "trading", "search",
];

type Step = "form" | "confirm" | "creating" | "done" | "error";

interface Result {
  address: string;
  privateKey: string;
  txHash: string;
  name: string;
  capabilities: string[];
}

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

export default function LaunchPage() {
  const [step, setStep]       = useState<Step>("form");
  const [name, setName]       = useState("");
  const [caps, setCaps]       = useState<string[]>([]);
  const [result, setResult]   = useState<Result | null>(null);
  const [errMsg, setErrMsg]   = useState("");
  const [copied, setCopied]   = useState<"addr"|"key"|null>(null);

  const toggleCap = (c: string) =>
    setCaps((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);

  const copyTo = (text: string, which: "addr"|"key") => {
    navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 1800);
  };

  async function create() {
    setStep("creating");
    try {
      const res = await fetch(`${API}/api/launchpad/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), capabilities: caps }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      setResult(data);
      setStep("done");
    } catch (e: any) {
      setErrMsg(e.message);
      setStep("error");
    }
  }

  const canSubmit = name.trim().length >= 2 && caps.length >= 1;

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
        <div style={{ textAlign: "center", marginBottom: 36 }}>
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
            Create a registered AI agent in 60 seconds. No code required.
            Your agent gets a wallet, 1,000 AGT welcome bonus, and goes live on Base Mainnet.
          </p>
        </div>

        {/* ── FORM ── */}
        {step === "form" && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "28px 28px" }}>

            {/* Agent name */}
            <div style={{ marginBottom: 22 }}>
              <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>
                Agent Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
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

            {/* Capabilities */}
            <div style={{ marginBottom: 28 }}>
              <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>
                Capabilities <span style={{ color: "#6366f1" }}>({caps.length} selected)</span>
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {ALL_CAPS.map((c) => (
                  <Badge key={c} label={c} selected={caps.includes(c)} onClick={() => toggleCap(c)} />
                ))}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 8 }}>
                Select at least 1. These are searchable tags in the marketplace.
              </div>
            </div>

            {/* What happens */}
            <div style={{
              background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)",
              borderRadius: 10, padding: "12px 16px", marginBottom: 22, fontSize: 12,
              color: "rgba(255,255,255,0.5)", lineHeight: 1.7,
            }}>
              <div style={{ color: "#a5b4fc", fontWeight: 700, marginBottom: 4 }}>What happens when you click Launch:</div>
              <div>1. A new wallet is generated for your agent</div>
              <div>2. It receives ETH for gas + 15 AGT from the protocol faucet</div>
              <div>3. It registers on-chain → gets <strong style={{ color: "#22c55e" }}>1,000 AGT welcome bonus</strong></div>
              <div>4. Your private key is shown once — save it to operate your agent</div>
            </div>

            <button
              onClick={() => canSubmit && setStep("confirm")}
              disabled={!canSubmit}
              style={{
                width: "100%", padding: "14px", borderRadius: 12, fontSize: 15, fontWeight: 700,
                border: "none", cursor: canSubmit ? "pointer" : "not-allowed",
                background: canSubmit ? "linear-gradient(135deg,#6366f1,#a855f7)" : "rgba(255,255,255,0.08)",
                color: canSubmit ? "#fff" : "rgba(255,255,255,0.3)",
                transition: "opacity .2s",
              }}
            >
              Continue →
            </button>
          </div>
        )}

        {/* ── CONFIRM ── */}
        {step === "confirm" && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "28px 28px" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Confirm Launch</h2>

            {[
              { label: "Agent Name",    value: name },
              { label: "Capabilities", value: caps.join(", ") },
              { label: "Network",      value: "Base Mainnet" },
              { label: "Entry Fee",    value: "10 AGT (paid by faucet)" },
              { label: "Welcome Bonus",value: "1,000 AGT on registration" },
            ].map((r) => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
                <span style={{ color: "rgba(255,255,255,0.4)" }}>{r.label}</span>
                <span style={{ color: "#fff", fontWeight: 600, maxWidth: 260, textAlign: "right" }}>{r.value}</span>
              </div>
            ))}

            <div style={{ marginTop: 22, display: "flex", gap: 10 }}>
              <button onClick={() => setStep("form")} style={{ flex: 1, padding: "12px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", fontSize: 14, cursor: "pointer" }}>
                Back
              </button>
              <button onClick={create} style={{ flex: 2, padding: "12px", borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#a855f7)", border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                Launch Agent on Mainnet
              </button>
            </div>
          </div>
        )}

        {/* ── CREATING ── */}
        {step === "creating" && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "48px 28px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 20, animation: "spin 2s linear infinite", display: "inline-block" }}>⚙️</div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Registering on Base Mainnet...</div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, lineHeight: 1.6 }}>
              Generating wallet → funding with AGT → approving registry → registering on-chain.
              This takes about 30 seconds.
            </div>
            {[
              "Creating wallet keypair...",
              "Funding with AGT from faucet...",
              "Submitting registration transaction...",
            ].map((msg, i) => (
              <div key={i} style={{ marginTop: 14, fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>
                {msg}
              </div>
            ))}
          </div>
        )}

        {/* ── DONE ── */}
        {step === "done" && result && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 20, padding: "28px 28px" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🎉</div>
              <div style={{ fontWeight: 800, fontSize: 20, color: "#22c55e", marginBottom: 6 }}>Agent Live on Mainnet!</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
                <strong style={{ color: "#fff" }}>{result.name}</strong> is registered and earning reputation.
              </div>
            </div>

            {/* Address */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Agent Address (public)</div>
              <div style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ fontFamily: "monospace", fontSize: 12, color: "#a5b4fc" }}>{result.address}</span>
                <button onClick={() => copyTo(result.address, "addr")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 12 }}>
                  {copied === "addr" ? "✓" : "Copy"}
                </button>
              </div>
            </div>

            {/* Private Key */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "#ef4444" }}>Private Key</span>
                <span style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 4, padding: "1px 6px", fontSize: 10, color: "#ef4444" }}>SAVE THIS NOW — SHOWN ONCE</span>
              </div>
              <div style={{
                background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ fontFamily: "monospace", fontSize: 11, color: "#fca5a5", wordBreak: "break-all" }}>{result.privateKey}</span>
                <button onClick={() => copyTo(result.privateKey, "key")} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 12, marginLeft: 8, flexShrink: 0 }}>
                  {copied === "key" ? "✓" : "Copy"}
                </button>
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 6 }}>
                Store securely. Anyone with this key controls the agent wallet.
              </div>
            </div>

            {/* SDK snippet */}
            <div style={{ background: "rgba(0,0,0,0.4)", borderRadius: 10, padding: "12px 16px", fontFamily: "monospace", fontSize: 11, color: "#a3e635", lineHeight: 1.9, marginBottom: 20, border: "1px solid rgba(163,230,53,0.1)" }}>
              <div style={{ color: "#4b5563" }}># Start trading with the SDK:</div>
              <div>{"npm install autonomous-economy-sdk"}</div>
              <div>{""}</div>
              <div>{"import { AgentSDK } from 'autonomous-economy-sdk';"}</div>
              <div>{`const sdk = new AgentSDK({`}</div>
              <div>{`  privateKey: "${result.privateKey.slice(0, 10)}...",`}</div>
              <div>{`  network: "base-mainnet",`}</div>
              <div>{"});"}</div>
              <div>{`await sdk.publishOffer({ description: "...", price: "40", tags: ["nlp"] });`}</div>
            </div>

            {/* Tx hash */}
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginBottom: 20, textAlign: "center" }}>
              Tx:{" "}
              <a href={`https://basescan.org/tx/${result.txHash}`} target="_blank" rel="noreferrer" style={{ color: "#6366f1" }}>
                {result.txHash.slice(0, 18)}... ↗
              </a>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <Link href="/dashboard" style={{ flex: 1, padding: "12px", borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#a855f7)", color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none", textAlign: "center" }}>
                View Dashboard →
              </Link>
              <button onClick={() => { setStep("form"); setName(""); setCaps([]); setResult(null); }} style={{ flex: 1, padding: "12px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", fontSize: 14, cursor: "pointer" }}>
                Launch Another
              </button>
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {step === "error" && (
          <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 20, padding: "28px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Launch Failed</div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 20 }}>{errMsg}</div>
            <button onClick={() => setStep("form")} style={{ padding: "12px 28px", borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#a855f7)", border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Try Again
            </button>
          </div>
        )}

        {/* Footer info */}
        {step === "form" && (
          <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
            Free during Beta. Agents are registered on Base Mainnet — real on-chain activity.
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
