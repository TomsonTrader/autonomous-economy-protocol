"use client";

import { useEffect, useState } from "react";
import { fetchAgents } from "../../../lib/api";

interface Agent {
  address: string;
  name: string;
  capabilities: string[];
  active: boolean;
  balance: string;
  reputation: {
    score: string;
    totalDeals: string;
    successfulDeals: string;
    totalValueTransacted: string;
  };
}

function ReputationBar({ score }: { score: number }) {
  const pct = Math.min(100, (score / 10000) * 100);
  const color = pct > 70 ? "#10b981" : pct > 40 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          flex: 1,
          height: 6,
          background: "var(--border)",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div style={{ width: `${pct}%`, height: "100%", background: color }} />
      </div>
      <span style={{ color, fontSize: 12, minWidth: 40 }}>{(pct).toFixed(1)}%</span>
    </div>
  );
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchAgents()
      .then((d) => setAgents(d.agents || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.capabilities.some((c) => c.toLowerCase().includes(search.toLowerCase())) ||
      a.address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Registered Agents</h1>
        <span
          style={{
            background: "#0ea5e933",
            color: "var(--accent)",
            padding: "2px 10px",
            borderRadius: 12,
            fontSize: 12,
          }}
        >
          {agents.length} total
        </span>
      </div>

      <input
        placeholder="Search by name, capability, or address..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%",
          maxWidth: 400,
          padding: "8px 12px",
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          color: "var(--text)",
          fontSize: 13,
          marginBottom: 20,
        }}
      />

      {loading ? (
        <div style={{ color: "var(--muted)" }}>Loading agents...</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: "var(--muted)" }}>No agents found. Deploy and register some agents first.</div>
      ) : (
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))" }}>
          {filtered.map((agent) => (
            <div
              key={agent.address}
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 16,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>🤖 {agent.name}</div>
                  <div style={{ color: "var(--muted)", fontSize: 11, fontFamily: "monospace" }}>
                    {agent.address.slice(0, 10)}...{agent.address.slice(-6)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "#10b981", fontWeight: 700 }}>
                    {parseFloat(agent.balance).toFixed(1)} AGT
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: 11 }}>balance</div>
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 4 }}>REPUTATION</div>
                <ReputationBar score={Number(agent.reputation?.score || 0)} />
                <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 11, color: "var(--muted)" }}>
                  <span>{agent.reputation?.totalDeals || 0} deals</span>
                  <span>{agent.reputation?.successfulDeals || 0} successful</span>
                  <span>{parseFloat(agent.reputation?.totalValueTransacted || "0").toFixed(0)} AGT volume</span>
                </div>
              </div>

              <div>
                <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 6 }}>CAPABILITIES</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {agent.capabilities.map((cap) => (
                    <span
                      key={cap}
                      style={{
                        background: "#0ea5e922",
                        color: "var(--accent)",
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: 11,
                      }}
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
