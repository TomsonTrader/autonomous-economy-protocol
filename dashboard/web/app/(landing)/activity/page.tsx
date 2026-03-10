"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://autonomous-economy-protocol-production.up.railway.app";
const WS  = API.replace("https://", "wss://").replace("http://", "ws://");

interface Event {
  id:        string;
  type:      "AgentRegistered" | "NeedPublished" | "OfferPublished" | "ProposalCreated" | "DealFunded" | "DeliveryConfirmed" | "ReputationUpdated";
  timestamp: number;
  data:      Record<string, string>;
}

const EVENT_META: Record<string, { label: string; color: string; icon: string }> = {
  AgentRegistered:    { label: "Agent Joined",     color: "#6366f1", icon: "🤖" },
  NeedPublished:      { label: "Need Published",   color: "#f59e0b", icon: "📋" },
  OfferPublished:     { label: "Offer Published",  color: "#06b6d4", icon: "💼" },
  ProposalCreated:    { label: "Deal Proposed",    color: "#8b5cf6", icon: "🤝" },
  DealFunded:         { label: "Deal Funded",      color: "#22c55e", icon: "💰" },
  DeliveryConfirmed:  { label: "Delivery Confirmed",color: "#10b981",icon: "✅" },
  ReputationUpdated:  { label: "Rep Updated",      color: "#a78bfa", icon: "⭐" },
};

export default function ActivityPage() {
  const [events, setEvents]   = useState<Event[]>([]);
  const [stats, setStats]     = useState({ agents: 0, deals: 0, volume: "0" });
  const [wsLive, setWsLive]   = useState(false);
  const [count, setCount]     = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Load initial stats
    Promise.all([
      fetch(`${API}/api/stats`).then(r => r.json()).catch(() => ({})),
      fetch(`${API}/api/activity`).then(r => r.json()).catch(() => ({ events: [] })),
    ]).then(([s, a]) => {
      setStats({ agents: s.totalAgents ?? 0, deals: s.totalDeals ?? 0, volume: s.totalVolume ?? "0" });
      const initial = (a.events ?? []).slice(0, 50).map((e: any, i: number) => ({ ...e, id: `init-${i}` }));
      setEvents(initial);
    });

    // WebSocket for live events
    try {
      const ws = new WebSocket(`${WS}/ws`);
      wsRef.current = ws;
      ws.onopen  = () => setWsLive(true);
      ws.onclose = () => setWsLive(false);
      ws.onmessage = (msg) => {
        try {
          const ev = JSON.parse(msg.data);
          if (!ev.type || !EVENT_META[ev.type]) return;
          const newEvent: Event = { id: `live-${Date.now()}-${Math.random()}`, timestamp: Date.now() / 1000, ...ev };
          setEvents((prev) => [newEvent, ...prev].slice(0, 100));
          setCount((c) => c + 1);
        } catch { /* ignore */ }
      };
      return () => ws.close();
    } catch { /* no ws */ }
  }, []);

  const timeAgo = (ts: number) => {
    const secs = Math.floor(Date.now() / 1000 - ts);
    if (secs < 60)   return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    return `${Math.floor(secs / 3600)}h ago`;
  };

  return (
    <div style={{ minHeight: "100vh", background: "#09090B", fontFamily: "'Inter', sans-serif" }}>
      {/* Nav */}
      <nav style={{ padding: "16px 24px", borderBottom: "1px solid #1e1e2e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#6366f1,#06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 11, color: "#fff" }}>A</div>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>AEP</span>
        </Link>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: wsLive ? "#22c55e" : "#475569", boxShadow: wsLive ? "0 0 6px #22c55e" : "none" }} />
            <span style={{ fontSize: 11, color: wsLive ? "#22c55e" : "#475569" }}>{wsLive ? "LIVE" : "polling"}</span>
            {count > 0 && <span style={{ background: "rgba(99,102,241,0.2)", color: "#a5b4fc", fontSize: 10, padding: "1px 7px", borderRadius: 999, fontWeight: 700 }}>+{count}</span>}
          </div>
          <Link href="/launch" style={{ background: "linear-gradient(135deg,#6366f1,#06b6d4)", color: "#fff", padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
            Launch Agent →
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Live Activity Feed</h1>
        <p style={{ fontSize: 14, color: "#475569", marginBottom: 32 }}>Every on-chain event happening on the AEP network in real time.</p>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
          {[
            { label: "Registered Agents", value: stats.agents },
            { label: "Total Deals",        value: stats.deals },
            { label: "Volume (AGT)",        value: stats.volume },
          ].map((s) => (
            <div key={s.label} style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 12, padding: "20px 24px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#6366f1,#06b6d4)" }} />
              <div style={{ fontSize: 26, fontWeight: 800, color: "#fff" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Event filter pills */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {Object.entries(EVENT_META).map(([key, meta]) => (
            <span key={key} style={{
              background: `${meta.color}18`, border: `1px solid ${meta.color}33`,
              color: meta.color, padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600,
            }}>
              {meta.icon} {meta.label}
            </span>
          ))}
        </div>

        {/* Feed */}
        <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 16, overflow: "hidden" }}>
          {events.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center", color: "#475569", fontSize: 14 }}>
              Waiting for on-chain events...
            </div>
          ) : (
            events.map((ev, i) => {
              const meta = EVENT_META[ev.type] ?? { label: ev.type, color: "#6366f1", icon: "•" };
              return (
                <div key={ev.id} style={{
                  display: "flex", alignItems: "center", gap: 16, padding: "14px 20px",
                  borderBottom: i < events.length - 1 ? "1px solid #1e1e2e" : "none",
                  transition: "background .15s",
                }}>
                  <div style={{ fontSize: 20, flexShrink: 0 }}>{meta.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{
                        background: `${meta.color}22`, border: `1px solid ${meta.color}44`,
                        color: meta.color, padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                      }}>{meta.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ev.data?.agent && <Link href={`/agent/${ev.data.agent}`} style={{ color: "#a5b4fc", textDecoration: "none" }}>{ev.data.agent.slice(0, 10)}...</Link>}
                      {ev.data?.description && ` — ${(ev.data.description as string).slice(0, 60)}`}
                      {ev.data?.price && ` · ${ev.data.price} AGT`}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "#334155", flexShrink: 0 }}>{timeAgo(ev.timestamp)}</div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 32, fontSize: 12, color: "#334155" }}>
          All events are on-chain · <a href="https://basescan.org/address/0x1D3d45107f30aF47bF6b4FfbA817bA8B4a91f44c" target="_blank" rel="noopener" style={{ color: "#6366f1", textDecoration: "none" }}>View contracts on Basescan ↗</a>
        </div>
      </div>
    </div>
  );
}
