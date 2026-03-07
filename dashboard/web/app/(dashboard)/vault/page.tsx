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

const TIER_LABELS = ["Tier 0 — Basic (<500 AGT deals)", "Tier 1 — Standard (<5,000 AGT deals)", "Tier 2 — Premium (<50,000 AGT deals)", "Tier 3 — Institutional (unlimited)"];
const TIER_COLORS = ["#64748b", "#0ea5e9", "#8b5cf6", "#f59e0b"];
const TIER_STAKES = [0, 500, 5000, 50000];

function TierBar({ tier, staked }: { tier: number; staked: number }) {
  const next = tier < 3 ? TIER_STAKES[tier + 1] : TIER_STAKES[3];
  const current = TIER_STAKES[tier];
  const pct = tier === 3 ? 100 : Math.min(100, ((staked - current) / (next - current)) * 100);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
        <span style={{ color: TIER_COLORS[tier], fontWeight: 700 }}>{TIER_LABELS[tier]}</span>
        {tier < 3 && (
          <span style={{ color: "var(--muted)" }}>
            {staked.toFixed(1)} / {next.toLocaleString()} AGT to Tier {tier + 1}
          </span>
        )}
      </div>
      <div style={{ background: "var(--border)", borderRadius: 4, height: 8 }}>
        <div style={{ background: TIER_COLORS[tier], width: `${pct}%`, height: 8, borderRadius: 4, transition: "width 0.4s" }} />
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "16px 20px", minWidth: 150 }}>
      <div style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <div style={{ color: accent || "var(--accent)", fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ color: "var(--muted)", fontSize: 11 }}>{sub}</div>}
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
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Agent Vault</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 28 }}>
        Stake AGT to unlock higher-value deals, earn 5% APY yield, and borrow against your reputation score.
      </p>

      {/* Protocol stats */}
      {stats && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 32 }}>
          <StatCard label="Total AGT Staked" value={parseFloat(stats.totalStaked).toLocaleString(undefined, { maximumFractionDigits: 0 })} sub="protocol-wide" />
          <StatCard label="Yield Pool" value={parseFloat(stats.yieldPool).toFixed(2)} sub="AGT available for yield" accent="#10b981" />
        </div>
      )}

      {/* Lookup panel */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "20px 24px", marginBottom: 28 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Look up an agent vault</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x... agent address"
            style={{ flex: 1, minWidth: 260, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px", color: "var(--text)", fontFamily: "monospace", fontSize: 13 }}
          />
          <button
            onClick={lookup}
            disabled={loading}
            style={{ background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 6, padding: "8px 18px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}
          >
            {loading ? "Loading..." : "Lookup"}
          </button>
        </div>
        {error && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 8 }}>{error}</div>}
      </div>

      {/* Vault details */}
      {vault && (
        <div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
            <StatCard label="Staked" value={`${stakedNum.toLocaleString(undefined, { maximumFractionDigits: 1 })} AGT`} />
            <StatCard label="Pending Yield" value={`${yieldNum.toFixed(4)} AGT`} accent="#10b981" />
            <StatCard label="Borrowed" value={`${borrowedNum.toFixed(2)} AGT`} accent="#ef4444" />
            <StatCard label="Credit Limit" value={`${creditNum.toFixed(2)} AGT`} sub="from reputation score" accent="#8b5cf6" />
          </div>

          <TierBar tier={vault.tier} staked={stakedNum} />

          {/* Credit utilization */}
          {creditNum > 0 && (
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "16px 20px", marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                <span style={{ fontWeight: 600 }}>Credit Line Utilization</span>
                <span style={{ color: "var(--muted)" }}>{borrowedNum.toFixed(2)} / {creditNum.toFixed(2)} AGT ({creditUsed.toFixed(1)}%)</span>
              </div>
              <div style={{ background: "var(--border)", borderRadius: 4, height: 8 }}>
                <div style={{ background: creditUsed > 80 ? "#ef4444" : "#8b5cf6", width: `${creditUsed}%`, height: 8, borderRadius: 4 }} />
              </div>
            </div>
          )}

          {/* SDK snippet */}
          <div style={{ background: "#00000040", borderRadius: 6, padding: "12px 16px", fontFamily: "monospace", fontSize: 12, color: "#a3e635", lineHeight: 1.8 }}>
            <div style={{ color: "#64748b" }}># Stake AGT via SDK:</div>
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
