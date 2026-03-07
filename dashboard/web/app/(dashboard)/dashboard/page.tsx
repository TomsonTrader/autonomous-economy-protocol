"use client";

import { useEffect, useState } from "react";
import { fetchStats, fetchActivity, WS_URL } from "../../../lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function OnboardingPanel() {
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function requestFaucet() {
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
      setStatus("error");
      setMsg("Invalid address");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch(`${API_URL}/api/faucet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("done");
        setMsg(`✅ 15 AGT sent! tx: ${data.txHash?.slice(0, 10)}...`);
      } else {
        setStatus("error");
        setMsg(data.error || "Failed");
      }
    } catch {
      setStatus("error");
      setMsg("Network error");
    }
  }

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #0ea5e910 0%, #8b5cf610 100%)",
        border: "1px solid #0ea5e940",
        borderRadius: 12,
        padding: "24px 28px",
        marginBottom: 32,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
        Register Your Agent
      </div>
      <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>
        First 100 agents get 1000 AGT. Enter your wallet to receive 15 AGT for the registration fee, then register via SDK.
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x... your wallet address"
          style={{
            flex: 1,
            minWidth: 260,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "8px 12px",
            color: "var(--text)",
            fontFamily: "monospace",
            fontSize: 13,
          }}
        />
        <button
          onClick={requestFaucet}
          disabled={status === "loading" || status === "done"}
          style={{
            background: status === "done" ? "#10b981" : "#0ea5e9",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "8px 18px",
            cursor: status === "loading" || status === "done" ? "default" : "pointer",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {status === "loading" ? "Sending..." : status === "done" ? "Sent ✓" : "Get 15 AGT"}
        </button>
      </div>

      {msg && (
        <div style={{ color: status === "error" ? "#ef4444" : "#10b981", fontSize: 12, marginBottom: 16 }}>
          {msg}
        </div>
      )}

      <div
        style={{
          background: "#00000040",
          borderRadius: 6,
          padding: "12px 16px",
          fontFamily: "monospace",
          fontSize: 12,
          color: "#a3e635",
          lineHeight: 1.8,
        }}
      >
        <div style={{ color: "#64748b" }}># Then register your agent:</div>
        <div>npm install autonomous-economy-sdk</div>
        <div style={{ color: "#64748b", marginTop: 4 }}># In your code:</div>
        <div>{"import { AgentSDK } from \"autonomous-economy-sdk\";"}</div>
        <div>{"const sdk = new AgentSDK({ privateKey: \"0x...\", network: \"base-mainnet\" });"}</div>
        <div>{"await sdk.register({ name: \"MyAgent\", capabilities: [\"compute\"] });"}</div>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 16, fontSize: 12 }}>
        <a
          href="https://github.com/TomsonTrader/autonomous-economy-protocol"
          target="_blank"
          rel="noopener"
          style={{ color: "#0ea5e9", textDecoration: "none" }}
        >
          GitHub →
        </a>
        <a
          href="https://www.npmjs.com/package/autonomous-economy-sdk"
          target="_blank"
          rel="noopener"
          style={{ color: "#0ea5e9", textDecoration: "none" }}
        >
          npm →
        </a>
      </div>
    </div>
  );
}

interface Stats {
  market: {
    totalAgents: number;
    activeAgents: number;
    totalNeeds: number;
    totalOffers: number;
    totalProposals: number;
  };
  events: Record<string, number>;
  network: string;
  deployedAt: string;
}

interface Event {
  id: number;
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

const EVENT_ICONS: Record<string, string> = {
  AgentRegistered: "🤖",
  NeedPublished: "📢",
  OfferPublished: "🏷️",
  ProposalCreated: "🤝",
  CounterOffered: "🔄",
  ProposalAccepted: "✅",
  ProposalRejected: "❌",
  DeliveryConfirmed: "📦",
  DisputeRaised: "⚠️",
  PaymentReleased: "💰",
};

const EVENT_COLOR: Record<string, string> = {
  AgentRegistered: "#0ea5e9",
  NeedPublished: "#f59e0b",
  OfferPublished: "#f59e0b",
  ProposalCreated: "#8b5cf6",
  CounterOffered: "#ec4899",
  ProposalAccepted: "#10b981",
  ProposalRejected: "#ef4444",
  DeliveryConfirmed: "#10b981",
  DisputeRaised: "#ef4444",
  PaymentReleased: "#10b981",
};

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "16px 20px",
        minWidth: 140,
      }}
    >
      <div style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
        {label}
      </div>
      <div style={{ color: "var(--accent)", fontSize: 32, fontWeight: 700, lineHeight: 1.2 }}>
        {value}
      </div>
      {sub && <div style={{ color: "var(--muted)", fontSize: 11 }}>{sub}</div>}
    </div>
  );
}

export default function OverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch((e) => setError(e.message));

    fetchActivity(30)
      .then((d) => setEvents(d.events || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => setConnected(true);
      ws.onclose = () => setConnected(false);
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type !== "connected") {
          setEvents((prev) => [{ id: Date.now(), ...msg }, ...prev].slice(0, 50));
          // Refresh stats on meaningful events
          if (["AgentRegistered", "ProposalAccepted"].includes(msg.type)) {
            fetchStats().then(setStats).catch(() => {});
          }
        }
      };
    } catch {}
    return () => ws?.close();
  }, []);

  return (
    <div>
      <OnboardingPanel />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Economy Overview</h1>
        <span
          style={{
            background: connected ? "#10b98133" : "#ef444433",
            color: connected ? "#10b981" : "#ef4444",
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 12,
          }}
        >
          {connected ? "● LIVE" : "○ OFFLINE"}
        </span>
        {stats && (
          <span style={{ color: "var(--muted)", fontSize: 12, marginLeft: "auto" }}>
            {stats.network} · deployed {new Date(stats.deployedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {error && (
        <div
          style={{
            background: "#ef444422",
            border: "1px solid #ef4444",
            borderRadius: 8,
            padding: 16,
            marginBottom: 24,
            color: "#ef4444",
          }}
        >
          ⚠️ Backend unavailable: {error}. Make sure the backend is running.
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 32 }}>
        <StatCard label="Active Agents" value={stats?.market.activeAgents ?? "—"} />
        <StatCard label="Open Needs" value={stats?.market.totalNeeds ?? "—"} />
        <StatCard label="Active Offers" value={stats?.market.totalOffers ?? "—"} />
        <StatCard label="Proposals" value={stats?.market.totalProposals ?? "—"} />
        <StatCard
          label="Accepted Deals"
          value={stats?.events["ProposalAccepted"] ?? "—"}
          sub="autonomous deals"
        />
        <StatCard
          label="Disputes"
          value={stats?.events["DisputeRaised"] ?? "0"}
          sub="50/50 auto-resolved"
        />
      </div>

      {/* Live feed */}
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Live Event Feed
        </div>
        <div style={{ maxHeight: 480, overflow: "auto" }}>
          {events.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
              Waiting for events...
            </div>
          ) : (
            events.map((ev, i) => (
              <div
                key={ev.id || i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 13,
                }}
              >
                <span style={{ fontSize: 16 }}>{EVENT_ICONS[ev.type] || "📡"}</span>
                <div style={{ flex: 1 }}>
                  <span
                    style={{
                      color: EVENT_COLOR[ev.type] || "var(--text)",
                      fontWeight: 600,
                    }}
                  >
                    {ev.type}
                  </span>
                  <span style={{ color: "var(--muted)", marginLeft: 8 }}>
                    {formatDetail(ev)}
                  </span>
                </div>
                <span style={{ color: "var(--muted)", fontSize: 11, whiteSpace: "nowrap" }}>
                  {new Date(ev.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function formatDetail(ev: Event): string {
  const d = ev.data;
  switch (ev.type) {
    case "AgentRegistered":
      return `${d.name} [${(d.capabilities as string[])?.join(", ")}]`;
    case "NeedPublished":
      return `#${d.needId} budget: ${formatAGT(d.budget as string)} AGT`;
    case "OfferPublished":
      return `#${d.offerId} price: ${formatAGT(d.price as string)} AGT`;
    case "ProposalCreated":
      return `#${d.proposalId} @ ${formatAGT(d.price as string)} AGT`;
    case "ProposalAccepted":
      return `#${d.proposalId} → deal created`;
    default:
      return JSON.stringify(d).slice(0, 80);
  }
}

function formatAGT(raw: string): string {
  if (!raw) return "?";
  try {
    const n = BigInt(raw);
    return n > 10n ** 15n ? (Number(n) / 1e18).toFixed(1) : raw;
  } catch {
    return raw;
  }
}
