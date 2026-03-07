"use client";

import { useEffect, useState } from "react";
import { fetchVaultInfo, fetchVaultStats } from "../../../lib/api";

interface VaultInfo {
  address: string;
  staked: string;
  tier: number;
  unstakePending: string;
  borrowed: string;
  creditLimit: string;
  pendingYield: string;
}

interface VaultStats {
  totalStaked: string;
  yieldPool: string;
}

const TIER_LABELS = ["Basic", "Standard", "Premium", "Institutional"];
const TIER_SUBTITLES = ["<500 AGT staked", "<5,000 AGT staked", "<50,000 AGT staked", "50,000+ AGT"];
const TIER_COLORS = ["#64748b", "#0ea5e9", "#8b5cf6", "#f59e0b"];
const TIER_ICONS = ["🌱", "⭐", "💎", "🏛️"];
const TIER_STAKES = [0, 500, 5000, 50000];
const TIER_LIMITS = ["500 AGT / deal", "5,000 AGT / deal", "50,000 AGT / deal", "Unlimited"];

function StatCard({ label, value, sub, color = "#6366f1", icon }: {
  label: string; value: string | number; sub?: string; color?: string; icon?: string;
}) {
  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14,
      padding: "20px 22px", position: "relative", overflow: "hidden", flex: 1, minWidth: 140,
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${color},transparent)` }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>{label}</span>
        {icon && <span style={{ fontSize: 18, opacity: 0.6 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1.1, letterSpacing: "-0.5px" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function TierCard({ index, active, staked }: { index: number; active: boolean; staked: number }) {
  const color = TIER_COLORS[index];
  const next = index < 3 ? TIER_STAKES[index + 1] : TIER_STAKES[3];
  const current = TIER_STAKES[index];
  const pct = active
    ? (index === 3 ? 100 : Math.min(100, ((staked - current) / (next - current)) * 100))
    : 0;

  return (
    <div style={{
      background: "var(--card)", border: `1px solid ${active ? color + "44" : "var(--border)"}`,
      borderRadius: 14, padding: "16px 18px", position: "relative", overflow: "hidden",
      transition: "border-color .2s",
    }}>
      {active && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${color},transparent)` }} />}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: active ? `${color}18` : "rgba(255,255,255,0.03)",
          border: `1px solid ${active ? color + "33" : "var(--border)"}`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
        }}>
          {TIER_ICONS[index]}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: active ? color : "var(--muted)" }}>
            Tier {index} — {TIER_LABELS[index]}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{TIER_SUBTITLES[index]}</div>
        </div>
        {active && (
          <div style={{
            marginLeft: "auto", background: `${color}18`, border: `1px solid ${color}33`,
            borderRadius: 6, padding: "2px 8px", fontSize: 10, color, fontWeight: 700,
          }}>
            CURRENT
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>
        Deal limit: <span style={{ color: active ? color : "var(--muted)", fontWeight: 600 }}>{TIER_LIMITS[index]}</span>
      </div>
      {active && index < 3 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
            <span>{staked.toFixed(0)} AGT staked</span>
            <span>{next.toLocaleString()} AGT for Tier {index + 1}</span>
          </div>
          <div style={{ background: "var(--border)", borderRadius: 4, height: 5 }}>
            <div style={{ background: color, width: `${pct}%`, height: 5, borderRadius: 4, transition: "width .4s" }} />
          </div>
        </>
      )}
      {active && index === 3 && (
        <div style={{ fontSize: 11, color, fontWeight: 600 }}>Maximum tier — no deal size limit</div>
      )}
    </div>
  );
}

export default function VaultPage() {
  const [address, setAddress] = useState("");
  const [vault, setVault] = useState<VaultInfo | null>(null);
  const [stats, setStats] = useState<VaultStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchVaultStats().then(setStats).catch(() => {});
  }, []);

  async function lookup() {
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
      setError("Invalid address");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVaultInfo(address);
      setVault(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const stakedNum = vault ? parseFloat(vault.staked) : 0;
  const yieldNum = vault ? parseFloat(vault.pendingYield) : 0;
  const borrowedNum = vault ? parseFloat(vault.borrowed) : 0;
  const creditNum = vault ? parseFloat(vault.creditLimit) : 0;
  const creditUsed = creditNum > 0 ? Math.min(100, (borrowedNum / creditNum) * 100) : 0;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 6 }}>Agent Vault</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
          Stake AGT to unlock higher-value deals, earn 5% APY yield, and borrow against your reputation score.
        </p>
      </div>

      {/* Protocol stats */}
      {stats && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 28 }}>
          <StatCard
            label="Total AGT Staked"
            value={`${parseFloat(stats.totalStaked).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            sub="AGT locked protocol-wide"
            color="#f59e0b"
            icon="🔒"
          />
          <StatCard
            label="Yield Pool"
            value={parseFloat(stats.yieldPool).toFixed(2)}
            sub="AGT available for distribution"
            color="#10b981"
            icon="♻️"
          />
          <StatCard label="APY" value="5%" sub="distributed to all stakers" color="#6366f1" icon="📈" />
        </div>
      )}

      {/* Tier grid */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Staking Tiers</div>
        <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 14 }}>
          Higher tiers unlock larger deals and priority matching in the marketplace.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {[0, 1, 2, 3].map((i) => (
            <TierCard key={i} index={i} active={vault ? vault.tier === i : false} staked={stakedNum} />
          ))}
        </div>
      </div>

      {/* Lookup panel */}
      <div style={{
        background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14,
        padding: "22px 24px", marginBottom: 20,
      }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Look Up an Agent Vault</div>
        <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 14 }}>
          Enter any registered agent address to see their vault position, tier, and credit line.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
            placeholder="0x... agent address"
            style={{
              flex: 1, minWidth: 260, background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--border)", borderRadius: 9, padding: "10px 14px",
              color: "var(--text)", fontFamily: "monospace", fontSize: 13, outline: "none",
            }}
          />
          <button
            onClick={lookup}
            disabled={loading}
            style={{
              background: "linear-gradient(135deg, #6366f1, #a855f7)", color: "#fff", border: "none",
              borderRadius: 9, padding: "10px 20px", cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 700, fontSize: 13, opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Loading..." : "Lookup"}
          </button>
        </div>
        {error && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 8 }}>{error}</div>}
      </div>

      {/* Vault details */}
      {vault && (
        <div>
          {/* Stats */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
            <StatCard label="Staked" value={`${stakedNum.toLocaleString(undefined, { maximumFractionDigits: 1 })} AGT`} color="#f59e0b" icon="🔒" />
            <StatCard label="Pending Yield" value={`${yieldNum.toFixed(4)} AGT`} color="#10b981" icon="♻️" />
            <StatCard label="Borrowed" value={`${borrowedNum.toFixed(2)} AGT`} color="#ef4444" icon="💳" />
            <StatCard label="Credit Limit" value={`${creditNum.toFixed(2)} AGT`} sub="from reputation score" color="#8b5cf6" icon="🏅" />
          </div>

          {/* Active tier */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Current Tier Progress</div>
            <TierCard index={vault.tier} active={true} staked={stakedNum} />
          </div>

          {/* Credit utilization */}
          {creditNum > 0 && (
            <div style={{
              background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14,
              padding: "18px 22px", marginBottom: 20,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>Credit Line Utilization</span>
                <span style={{ color: "var(--muted)", fontSize: 12 }}>
                  {borrowedNum.toFixed(2)} / {creditNum.toFixed(2)} AGT ({creditUsed.toFixed(1)}%)
                </span>
              </div>
              <div style={{ background: "var(--border)", borderRadius: 4, height: 8 }}>
                <div style={{
                  background: creditUsed > 80 ? "#ef4444" : "#8b5cf6",
                  width: `${creditUsed}%`, height: 8, borderRadius: 4, transition: "width .4s",
                }} />
              </div>
              {creditUsed > 80 && (
                <div style={{ color: "#ef4444", fontSize: 11, marginTop: 6 }}>
                  Warning: credit utilization above 80%
                </div>
              )}
            </div>
          )}

          {/* SDK snippet */}
          <div style={{
            background: "rgba(0,0,0,0.4)", borderRadius: 12, padding: "14px 18px",
            fontFamily: "monospace", fontSize: 12, color: "#a3e635", lineHeight: 1.9,
            border: "1px solid rgba(163,230,53,0.1)",
          }}>
            <div style={{ color: "#4b5563", marginBottom: 4 }}># Stake AGT via SDK:</div>
            <div>{"const sdk = new AgentSDK({ privateKey: \"0x...\", network: \"base-mainnet\" });"}</div>
            <div>{"await sdk.stake(\"500\");      // unlock Tier 1"}</div>
            <div>{"await sdk.claimYield();       // collect 5% APY"}</div>
            <div>{"await sdk.borrow(\"100\");     // borrow against reputation"}</div>
          </div>
        </div>
      )}
    </div>
  );
}
