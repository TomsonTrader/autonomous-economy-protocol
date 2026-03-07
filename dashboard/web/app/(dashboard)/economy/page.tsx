"use client";

import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart,
} from "recharts";
import { fetchActivity, fetchStats, fetchVaultStats, WS_URL } from "../../../lib/api";

interface PricePoint { time: string; price: number; type: string; }

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

const TOOLTIP_STYLE = { background: "#111827", border: "1px solid #1f2937", borderRadius: 8, fontSize: 12 };

export default function EconomyPage() {
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [eventTotals, setEventTotals] = useState<{ name: string; count: number }[]>([]);
  const [vaultStats, setVaultStats] = useState<{ totalStaked: string; yieldPool: string } | null>(null);
  const [liveCount, setLiveCount] = useState(0);

  useEffect(() => {
    fetchVaultStats().then(setVaultStats).catch(() => {});

    fetchActivity(100).then((d) => {
      const events = d.events || [];
      const points: PricePoint[] = [];
      for (const ev of [...events].reverse()) {
        if (["ProposalCreated", "CounterOffered", "ProposalAccepted"].includes(ev.type)) {
          const priceRaw = ev.data?.price || ev.data?.newPrice;
          if (priceRaw) {
            try {
              const price = Number(BigInt(priceRaw)) / 1e18;
              points.push({ time: new Date(ev.timestamp * 1000).toLocaleTimeString(), price, type: ev.type });
            } catch {}
          }
        }
      }
      setPriceHistory(points);

      const evs = d.events || [];
      const counts: Record<string, number> = {};
      for (const ev of evs) {
        counts[ev.type] = (counts[ev.type] || 0) + 1;
      }
      setEventTotals(Object.entries(counts).map(([name, count]) => ({
        name: name.replace(/([A-Z])/g, " $1").trim(),
        count,
      })));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(WS_URL);
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        setLiveCount((c) => c + 1);
        if (["ProposalCreated", "CounterOffered", "ProposalAccepted"].includes(msg.type)) {
          const priceRaw = msg.data?.price || msg.data?.newPrice;
          if (priceRaw) {
            try {
              const price = Number(BigInt(priceRaw)) / 1e18;
              setPriceHistory((prev) => [...prev, { time: new Date().toLocaleTimeString(), price, type: msg.type }].slice(-60));
            } catch {}
          }
        }
        setEventTotals((prev) => {
          const label = msg.type.replace(/([A-Z])/g, " $1").trim();
          const existing = prev.find((e) => e.name === label);
          if (existing) return prev.map((e) => e.name === label ? { ...e, count: e.count + 1 } : e);
          return [...prev, { name: label, count: 1 }];
        });
      };
    } catch {}
    return () => ws?.close();
  }, []);

  const avgPrice = priceHistory.length > 0
    ? (priceHistory.reduce((s, p) => s + p.price, 0) / priceHistory.length).toFixed(1) : "—";
  const maxPrice = priceHistory.length > 0 ? Math.max(...priceHistory.map((p) => p.price)).toFixed(0) : "—";
  const minPrice = priceHistory.length > 0 ? Math.min(...priceHistory.map((p) => p.price)).toFixed(0) : "—";
  const totalVolume = eventTotals.find((e) => e.name.toLowerCase().includes("payment"))?.count ?? 0;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", margin: 0 }}>Economy Analytics</h1>
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
            borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "#22c55e", fontWeight: 600,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
            LIVE
          </div>
          {liveCount > 0 && (
            <span style={{ fontSize: 11, color: "var(--muted)" }}>{liveCount} events received</span>
          )}
        </div>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
          Real-time price discovery and economic activity across the AEP marketplace.
        </p>
      </div>

      {/* Stat row 1 — deal prices */}
      <div style={{ display: "flex", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
        <StatCard label="Avg Deal Price" value={avgPrice === "—" ? avgPrice : `${avgPrice} AGT`} color="#0ea5e9" icon="📊" />
        <StatCard label="Max Price" value={maxPrice === "—" ? maxPrice : `${maxPrice} AGT`} color="#f59e0b" icon="↑" />
        <StatCard label="Min Price" value={minPrice === "—" ? minPrice : `${minPrice} AGT`} color="#10b981" icon="↓" />
        <StatCard label="Price Points" value={priceHistory.length} color="#8b5cf6" icon="🔢" />
      </div>

      {/* Stat row 2 — vault */}
      {vaultStats && (
        <div style={{ display: "flex", gap: 14, marginBottom: 28, flexWrap: "wrap" }}>
          <StatCard
            label="Total AGT Staked"
            value={`${parseFloat(vaultStats.totalStaked).toLocaleString(undefined, { maximumFractionDigits: 0 })} AGT`}
            color="#f59e0b"
            icon="🔒"
            sub="protocol-wide vault deposits"
          />
          <StatCard
            label="Yield Pool"
            value={`${parseFloat(vaultStats.yieldPool).toFixed(2)} AGT`}
            color="#10b981"
            icon="♻️"
            sub="5% APY distributed to stakers"
          />
          <StatCard label="Payments Released" value={totalVolume} color="#22c55e" icon="💰" sub="on-chain settlements" />
        </div>
      )}

      {/* Price chart */}
      <div style={{
        background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14,
        padding: "22px 24px", marginBottom: 20,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Emergent Price Discovery</div>
            <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>
              AGT price per deal — no central oracle, emerges from agent negotiations
            </div>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.2)", borderRadius: 6, padding: "4px 10px" }}>
            Last {priceHistory.length} points
          </div>
        </div>
        {priceHistory.length === 0 ? (
          <div style={{ color: "var(--muted)", textAlign: "center", padding: "40px 0", fontSize: 13 }}>
            Waiting for negotiation events...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={priceHistory}>
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="time" tick={{ fill: "#6b7280", fontSize: 10 }} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} unit=" AGT" />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#6b7280" }} itemStyle={{ color: "#0ea5e9" }} />
              <Area type="monotone" dataKey="price" stroke="#0ea5e9" strokeWidth={2} fill="url(#priceGrad)" dot={{ r: 3, fill: "#0ea5e9" }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Event distribution */}
      <div style={{
        background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14,
        padding: "22px 24px", marginBottom: 20,
      }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Economic Activity Distribution</div>
        <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 18 }}>On-chain events by type — all emitted from live smart contracts on Base Mainnet</div>
        {eventTotals.length === 0 ? (
          <div style={{ color: "var(--muted)", textAlign: "center", padding: "40px 0", fontSize: 13 }}>No activity data yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={eventTotals} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#6b7280", fontSize: 10 }} width={150} />
              <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: "#10b981" }} />
              <Bar dataKey="count" fill="#10b981" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* How price emerges */}
      <div style={{
        background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.15)",
        borderRadius: 14, padding: "18px 22px", fontSize: 13, color: "var(--muted)", lineHeight: 1.7,
      }}>
        <strong style={{ color: "#a855f7" }}>How prices emerge:</strong>{" "}
        No price is set centrally. Each agent proposes, counter-offers, and accepts based on its own economic strategy.
        The chart above shows how a market-clearing price emerges organically from individual agent decisions —
        libertarian economics encoded in smart contracts.{" "}
        <a href="https://basescan.org/address/0xFfD596b2703b635059Bc2b6109a3173F29903D27" target="_blank" rel="noreferrer" style={{ color: "#6366f1" }}>
          View NegotiationEngine on Basescan ↗
        </a>
      </div>
    </div>
  );
}
