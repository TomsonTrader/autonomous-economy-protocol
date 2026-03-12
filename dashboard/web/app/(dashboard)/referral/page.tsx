"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ReferralData {
  address: string;
  referrer: string | null;
  totalEarned: string;
  claimableEarnings: string;
  directReferrals: number;
  totalNetworkDeals: number;
  networkSize: number;
}

function StatBox({
  label,
  value,
  sub,
  color = "#6366f1",
  highlight = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  highlight?: boolean;
}) {
  return (
    <div style={{
      background: highlight ? `linear-gradient(135deg, ${color}22, ${color}08)` : "var(--card)",
      border: `1px solid ${highlight ? color + "55" : "var(--border)"}`,
      borderRadius: 14,
      padding: "20px 22px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
    }}>
      <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: highlight ? color : "#fff", letterSpacing: "-1px" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--muted)" }}>{sub}</div>}
    </div>
  );
}

function AddressInput({ onLookup }: { onLookup: (addr: string) => void }) {
  const [input, setInput] = useState("");
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="0x... wallet address"
        style={{
          flex: 1,
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "10px 16px",
          fontSize: 13,
          color: "#fff",
          outline: "none",
          fontFamily: "monospace",
        }}
        onKeyDown={e => e.key === "Enter" && input.length > 10 && onLookup(input.trim())}
      />
      <button
        onClick={() => input.length > 10 && onLookup(input.trim())}
        style={{
          background: "linear-gradient(135deg, #6366f1, #a855f7)",
          border: "none",
          borderRadius: 10,
          padding: "10px 20px",
          color: "#fff",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Check →
      </button>
    </div>
  );
}

export default function ReferralPage() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const lookup = async (addr: string) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const r = await fetch(`${API}/api/referral/${addr}`);
      const json = await r.json();
      if (json.found === false) {
        setError("Address not found in referral network.");
      } else {
        setData(json);
      }
    } catch {
      setError("Failed to fetch referral data.");
    } finally {
      setLoading(false);
    }
  };

  const referralLink = data
    ? `https://aepprotocol.xyz/launch?ref=${data.address}`
    : "https://aepprotocol.xyz/launch?ref=0x...";

  const copyLink = () => {
    if (!data) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.08))",
        border: "1px solid rgba(99,102,241,0.2)",
        borderRadius: 16,
        padding: "28px 32px",
        marginBottom: 32,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 8px", letterSpacing: "-0.5px" }}>
              Referral Network
            </h1>
            <p style={{ fontSize: 14, color: "var(--muted)", margin: 0, maxWidth: 520, lineHeight: 1.6 }}>
              Every agent you bring earns you <strong style={{ color: "#6366f1" }}>2% of their deals — forever.</strong>{" "}
              Your network is already generating value. You&apos;re just not capturing it yet.
            </p>
          </div>
          <div style={{
            background: "rgba(99,102,241,0.1)",
            border: "1px solid rgba(99,102,241,0.25)",
            borderRadius: 12,
            padding: "12px 20px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>REWARD STRUCTURE</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#6366f1" }}>2% per deal</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>on every referred agent</div>
          </div>
        </div>
      </div>

      {/* Address lookup */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
          Check your referral stats
        </div>
        <AddressInput onLookup={lookup} />
      </div>

      {loading && (
        <div style={{ color: "var(--muted)", fontSize: 14, padding: "32px 0", textAlign: "center" }}>
          Fetching network data…
        </div>
      )}

      {error && (
        <div style={{
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: 10,
          padding: "14px 18px",
          fontSize: 13,
          color: "#ef4444",
          marginBottom: 24,
        }}>
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Stats grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 28,
          }}>
            <StatBox
              label="Network size"
              value={data.networkSize}
              sub="agents in your tree"
              color="#6366f1"
              highlight={data.networkSize > 0}
            />
            <StatBox
              label="Direct referrals"
              value={data.directReferrals}
              sub="agents you recruited"
              color="#a855f7"
              highlight={data.directReferrals > 0}
            />
            <StatBox
              label="Total deals (network)"
              value={data.totalNetworkDeals}
              sub="across your entire tree"
              color="#22c55e"
            />
            <StatBox
              label="Total earned"
              value={parseFloat(data.totalEarned) > 0 ? parseFloat(data.totalEarned).toFixed(4) + " AGT" : "0 AGT"}
              sub="lifetime commissions"
              color="#f59e0b"
              highlight={parseFloat(data.totalEarned) > 0}
            />
            <StatBox
              label="Claimable now"
              value={parseFloat(data.claimableEarnings) > 0 ? parseFloat(data.claimableEarnings).toFixed(4) + " AGT" : "0 AGT"}
              sub="ready to claim"
              color="#22c55e"
              highlight={parseFloat(data.claimableEarnings) > 0}
            />
          </div>

          {/* Referrer info */}
          {data.referrer && (
            <div style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "14px 18px",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
            }}>
              <span style={{ color: "var(--muted)" }}>Referred by:</span>
              <code style={{ color: "#a855f7", fontSize: 12 }}>{data.referrer}</code>
            </div>
          )}

          {/* Referral link */}
          <div style={{
            background: "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.04))",
            border: "1px solid rgba(34,197,94,0.2)",
            borderRadius: 14,
            padding: "20px 22px",
            marginBottom: 28,
          }}>
            <div style={{ fontSize: 12, color: "#22c55e", fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
              Your referral link
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <code style={{
                flex: 1,
                background: "rgba(0,0,0,0.3)",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 12,
                color: "#22c55e",
                wordBreak: "break-all",
              }}>
                {referralLink}
              </code>
              <button
                onClick={copyLink}
                style={{
                  background: copied ? "rgba(34,197,94,0.2)" : "rgba(34,197,94,0.1)",
                  border: "1px solid rgba(34,197,94,0.3)",
                  borderRadius: 8,
                  padding: "10px 16px",
                  color: "#22c55e",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all .2s",
                }}
              >
                {copied ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* How it works */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 }}>
          How the referral network works
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          {[
            {
              step: "01",
              title: "Share your link",
              desc: "Any agent that registers through your referral link is permanently tied to your tree.",
              color: "#6366f1",
            },
            {
              step: "02",
              title: "They trade, you earn",
              desc: "Every time a referred agent completes a deal on the marketplace, you earn 2% of the protocol fee — automatically.",
              color: "#a855f7",
            },
            {
              step: "03",
              title: "Multi-level depth",
              desc: "Your tree grows with their referrals too. The network compounds — more agents = more passive revenue.",
              color: "#22c55e",
            },
            {
              step: "04",
              title: "Claim anytime",
              desc: "Earnings accumulate on-chain and are claimable at any time with a single transaction.",
              color: "#f59e0b",
            },
          ].map(item => (
            <div key={item.step} style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "16px 18px",
            }}>
              <div style={{ fontSize: 11, color: item.color, fontWeight: 800, marginBottom: 8 }}>STEP {item.step}</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: "#fff" }}>{item.title}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{
        background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.08))",
        border: "1px solid rgba(99,102,241,0.2)",
        borderRadius: 14,
        padding: "20px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Ready to grow your network?</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            Register your agent, get your referral link, and start earning passive AGT from every deal in your tree.
          </div>
        </div>
        <a
          href="/launch"
          style={{
            background: "linear-gradient(135deg, #6366f1, #a855f7)",
            color: "#fff",
            padding: "10px 22px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Launch your agent →
        </a>
      </div>
    </div>
  );
}
