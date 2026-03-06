"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { fetchActivity, fetchStats, fetchVaultStats, WS_URL } from "../../lib/api";

interface PricePoint {
  time: string;
  price: number;
  type: string;
}

interface WealthPoint {
  name: string;
  balance: number;
  deals: number;
}

export default function EconomyPage() {
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [eventTotals, setEventTotals] = useState<{ name: string; count: number }[]>([]);
  const [vaultStats, setVaultStats] = useState<{ totalStaked: string; yieldPool: string } | null>(null);

  useEffect(() => {
    fetchVaultStats().then(setVaultStats).catch(() => {});
  }, []);

  useEffect(() => {
    // Load historical activity to build price chart
    fetchActivity(100)
      .then((d) => {
        const events = d.events || [];
        const points: PricePoint[] = [];

        for (const ev of events.reverse()) {
          if (ev.type === "ProposalCreated" || ev.type === "CounterOffered" || ev.type === "ProposalAccepted") {
            const priceRaw = ev.data?.price || ev.data?.newPrice;
            if (priceRaw) {
              try {
                const price = Number(BigInt(priceRaw)) / 1e18;
                points.push({
                  time: new Date(ev.timestamp * 1000).toLocaleTimeString(),
                  price,
                  type: ev.type,
                });
              } catch {}
            }
          }
        }
        setPriceHistory(points);
      })
      .catch(() => {});

    fetchStats()
      .then((d) => {
        setStats(d);
        const evs = d.events || {};
        const arr = Object.entries(evs).map(([name, count]) => ({
          name: name.replace(/([A-Z])/g, " $1").trim(),
          count: count as number,
        }));
        setEventTotals(arr);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(WS_URL);
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (["ProposalCreated", "CounterOffered", "ProposalAccepted"].includes(msg.type)) {
          const priceRaw = msg.data?.price || msg.data?.newPrice;
          if (priceRaw) {
            try {
              const price = Number(BigInt(priceRaw)) / 1e18;
              setPriceHistory((prev) => [
                ...prev,
                {
                  time: new Date().toLocaleTimeString(),
                  price,
                  type: msg.type,
                },
              ].slice(-60));
            } catch {}
          }
        }
        // Update event totals
        setEventTotals((prev) => {
          const label = msg.type.replace(/([A-Z])/g, " $1").trim();
          const existing = prev.find((e) => e.name === label);
          if (existing) {
            return prev.map((e) => e.name === label ? { ...e, count: e.count + 1 } : e);
          }
          return [...prev, { name: label, count: 1 }];
        });
      };
    } catch {}
    return () => ws?.close();
  }, []);

  const avgPrice = priceHistory.length > 0
    ? (priceHistory.reduce((s, p) => s + p.price, 0) / priceHistory.length).toFixed(1)
    : "—";

  const maxPrice = priceHistory.length > 0
    ? Math.max(...priceHistory.map((p) => p.price)).toFixed(0)
    : "—";

  const minPrice = priceHistory.length > 0
    ? Math.min(...priceHistory.map((p) => p.price)).toFixed(0)
    : "—";

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Economy Analytics</h1>

      {/* Vault / staking metrics */}
      {vaultStats && (
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          {[
            { label: "Total AGT Staked", value: `${parseFloat(vaultStats.totalStaked).toLocaleString(undefined, { maximumFractionDigits: 0 })} AGT`, color: "#f59e0b" },
            { label: "Yield Pool", value: `${parseFloat(vaultStats.yieldPool).toFixed(2)} AGT`, color: "#10b981" },
          ].map((m) => (
            <div key={m.label} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 20px", minWidth: 160 }}>
              <div style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>{m.label}</div>
              <div style={{ color: m.color, fontSize: 24, fontWeight: 700 }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Price metrics */}
      <div style={{ display: "flex", gap: 12, marginBottom: 32, flexWrap: "wrap" }}>
        {[
          { label: "Avg Deal Price", value: `${avgPrice} AGT`, color: "#0ea5e9" },
          { label: "Max Price", value: `${maxPrice} AGT`, color: "#f59e0b" },
          { label: "Min Price", value: `${minPrice} AGT`, color: "#10b981" },
          { label: "Price Points", value: priceHistory.length.toString(), color: "#8b5cf6" },
        ].map((m) => (
          <div
            key={m.label}
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "14px 20px",
              minWidth: 140,
            }}
          >
            <div style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
              {m.label}
            </div>
            <div style={{ color: m.color, fontSize: 28, fontWeight: 700 }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Price emergence chart */}
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 16 }}>
          📈 Emergent Price Discovery (AGT)
        </div>
        {priceHistory.length === 0 ? (
          <div style={{ color: "var(--muted)", textAlign: "center", padding: 40 }}>
            No price data yet. Run simulation to generate activity.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={priceHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="time" tick={{ fill: "#6b7280", fontSize: 11 }} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} unit=" AGT" />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 6 }}
                labelStyle={{ color: "#6b7280" }}
                itemStyle={{ color: "#0ea5e9" }}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={{ r: 3, fill: "#0ea5e9" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Event distribution */}
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 20,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 16 }}>
          📊 Economic Activity Distribution
        </div>
        {eventTotals.length === 0 ? (
          <div style={{ color: "var(--muted)", textAlign: "center", padding: 40 }}>
            No activity data yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={eventTotals} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#6b7280", fontSize: 11 }} width={140} />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 6 }}
                itemStyle={{ color: "#10b981" }}
              />
              <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Explanation */}
      <div
        style={{
          background: "#0ea5e911",
          border: "1px solid #0ea5e933",
          borderRadius: 8,
          padding: 16,
          marginTop: 24,
          fontSize: 13,
          color: "var(--muted)",
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: "var(--accent)" }}>How prices emerge:</strong> No price is set centrally.
        Each agent proposes, counter-offers, and accepts based on its own economic strategy. The price chart
        shows how a market clearing price emerges organically from thousands of individual agent decisions —
        libertarian economics in action.
      </div>
    </div>
  );
}
