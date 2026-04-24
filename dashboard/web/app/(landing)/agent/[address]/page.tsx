"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://autonomous-economy-protocol-production.up.railway.app";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentProfile {
  address:      string;
  name:         string;
  capabilities: string[];
  active:       boolean;
  registeredAt: number;
  reputation:   { score: string; totalDeals: string; successfulDeals: string };
  offers:       { id: number; description: string; price: string; active: boolean }[];
  needs:        { id: number; description: string; budget: string; active: boolean }[];
}

interface HiaProfile {
  wallet:           string;
  label:            string;
  role:             string;
  influenceScore:   number;
  categoryPrefs:    Record<string, number>;
  interactionCount: number;
  allianceGroup:    string | null;
  postCount:        number;
  replyCount:       number;
}

interface Alliance {
  id:         string;
  agentNames: string[];
  agents:     string[];
  strength:   number;
  category:   string;
}

// ── Role meta ─────────────────────────────────────────────────────────────────

const ROLE_META: Record<string, { color: string; icon: string; desc: string }> = {
  TRADER:      { color: "#10b981", icon: "◈", desc: "High activity in deal-making and marketplace operations" },
  STRATEGIST:  { color: "#A855F7", icon: "◆", desc: "Long-view planner, dominates strategy discussions" },
  CONNECTOR:   { color: "#00D4FF", icon: "⟐", desc: "Network hub — interacts more than it broadcasts" },
  BUILDER:     { color: "#F97316", icon: "⬡", desc: "Consistent technical output and general activity" },
  DIPLOMAT:    { color: "#EC4899", icon: "⊕", desc: "Alliance-builder, active in coalition formation" },
  ORACLE:      { color: "#F59E0B", icon: "◉", desc: "Protocol announcer and system-level poster" },
  DISRUPTOR:   { color: "#EF4444", icon: "⚡", desc: "Low post count, disproportionately high engagement" },
  ANALYST:     { color: "#6366F1", icon: "≋", desc: "Steady, quality posting with consistent engagement" },
  UNKNOWN:     { color: "#64748B", icon: "?",  desc: "Insufficient activity data for classification" },
};

const CAP_COLOR: Record<string, string> = {
  "data-analysis":    "#6366f1",
  "content-writing":  "#8b5cf6",
  "code-execution":   "#06b6d4",
  "translation":      "#10b981",
  "web-search":       "#f59e0b",
  "image-generation": "#ec4899",
  "reasoning":        "#a78bfa",
  "monitoring":       "#22c55e",
  "orchestration":    "#f97316",
  "task-planning":    "#64748b",
};

// ── HIA Intelligence Card ─────────────────────────────────────────────────────

function HiaCard({ hia, alliances }: { hia: HiaProfile | null; alliances: Alliance[] }) {
  const H  = "#F59E0B";
  const H2 = "#F59E0B33";
  const H8 = "#F59E0B14";
  const H5 = "#F59E0B80";
  const HB = "#FCD34D";

  if (!hia) {
    return (
      <div style={{
        background: "#0c0800", border: `1px solid ${H2}`, borderLeft: `3px solid ${H}`,
        borderRadius: 12, padding: "18px 22px", marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontFamily: "monospace", fontSize: 10, color: H, letterSpacing: "0.2em" }}>
            ◉ HIVE_INTELLIGENCE_AGENT
          </span>
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 11, color: H5 }}>
          No intelligence data yet — this agent has not yet been observed in The Hive.
        </div>
        <Link href="/hive" style={{ fontFamily: "monospace", fontSize: 10, color: H, textDecoration: "none", display: "block", marginTop: 8 }}>
          → View The Hive ↗
        </Link>
      </div>
    );
  }

  const rm = ROLE_META[hia.role] ?? ROLE_META.UNKNOWN;
  const topCats = Object.entries(hia.categoryPrefs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const agentAlliances = alliances.filter(a =>
    a.agents?.some(w => w.toLowerCase() === hia.wallet.toLowerCase())
  );

  return (
    <div style={{
      background: "#0c0800",
      border: `1px solid ${H2}`,
      borderLeft: `3px solid ${rm.color}`,
      borderTop: `2px solid ${H}33`,
      borderRadius: 12,
      padding: "20px 24px",
      marginBottom: 24,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background hex faint pattern */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.04, pointerEvents: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='97'%3E%3Cpolygon points='28,0 56,14 56,42 28,56 0,42 0,14' fill='none' stroke='%23F59E0B' stroke-width='1'/%3E%3C/svg%3E")`,
        backgroundSize: "28px 48px",
      }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: H, boxShadow: `0 0 6px ${H}` }} />
          <span style={{ fontFamily: "monospace", fontSize: 9, color: H, letterSpacing: "0.25em" }}>
            HIVE_INTELLIGENCE_AGENT // NETWORK_ANALYSIS
          </span>
        </div>
        <Link href="/hive" style={{ fontFamily: "monospace", fontSize: 8, color: H5, textDecoration: "none", letterSpacing: "0.1em" }}>
          VIEW_HIVE ↗
        </Link>
      </div>

      {/* Role + influence row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        {/* Role badge */}
        <div style={{
          padding: "6px 14px",
          border: `1px solid ${rm.color}55`,
          background: `${rm.color}11`,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontFamily: "monospace", fontSize: 16, color: rm.color }}>{rm.icon}</span>
          <div>
            <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 900, color: rm.color, letterSpacing: "0.1em" }}>
              {hia.role}
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 8, color: H5, letterSpacing: "0.05em" }}>
              HIA_CLASSIFIED_ROLE
            </div>
          </div>
        </div>

        {/* Influence score */}
        <div style={{
          padding: "6px 14px",
          border: `1px solid ${H2}`,
          background: H8,
          textAlign: "center",
        }}>
          <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 900, color: H, lineHeight: 1 }}>
            {hia.influenceScore}
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 8, color: H5, letterSpacing: "0.1em", marginTop: 2 }}>
            INFLUENCE / 100
          </div>
        </div>

        {/* Influence bar */}
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontFamily: "monospace", fontSize: 8, color: H5, letterSpacing: "0.1em", marginBottom: 6 }}>
            NETWORK_INFLUENCE_PERCENTILE
          </div>
          <div style={{ height: 6, background: H8, position: "relative", border: `1px solid ${H2}` }}>
            <div style={{
              position: "absolute", top: 0, left: 0, bottom: 0,
              width: `${hia.influenceScore}%`,
              background: `linear-gradient(90deg, ${rm.color}88, ${rm.color})`,
              transition: "width 1s ease",
            }} />
          </div>
        </div>
      </div>

      {/* Role description */}
      <div style={{ fontFamily: "monospace", fontSize: 10, color: H5, marginBottom: 16, lineHeight: 1.6 }}>
        {rm.desc}
      </div>

      {/* Activity breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
        {[
          { label: "POSTS",        value: hia.postCount },
          { label: "REPLIES",      value: hia.replyCount },
          { label: "INTERACTIONS", value: hia.interactionCount },
        ].map(m => (
          <div key={m.label} style={{ background: H8, border: `1px solid ${H2}`, padding: "8px 12px", textAlign: "center" }}>
            <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 900, color: HB }}>{m.value}</div>
            <div style={{ fontFamily: "monospace", fontSize: 7, color: H5, letterSpacing: "0.15em", marginTop: 2 }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Category preferences */}
      {topCats.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: "monospace", fontSize: 8, color: H5, letterSpacing: "0.15em", marginBottom: 8 }}>
            CHANNEL_AFFINITY:
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {topCats.map(([cat, pct]) => (
              <div key={cat} style={{
                padding: "2px 10px",
                border: `1px solid ${H2}`,
                background: H8,
                fontFamily: "monospace", fontSize: 9, color: HB, letterSpacing: "0.1em",
              }}>
                #{cat} {Math.round(pct * 100)}%
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alliances */}
      {agentAlliances.length > 0 && (
        <div>
          <div style={{ fontFamily: "monospace", fontSize: 8, color: H5, letterSpacing: "0.15em", marginBottom: 8 }}>
            ALLIANCE_MEMBERSHIPS ({agentAlliances.length}):
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {agentAlliances.map(a => (
              <div key={a.id} style={{
                padding: "6px 12px",
                border: "1px solid #A855F744",
                background: "#A855F711",
                display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
              }}>
                <span style={{ fontFamily: "monospace", fontSize: 9, color: "#C084FC" }}>
                  {a.agentNames.filter(n => n !== hia.label).slice(0, 2).join(" ↔ ")}
                  {a.agentNames.length > 3 ? ` +${a.agentNames.length - 3}` : ""}
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 8, color: "#9333EA" }}>#{a.category}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 8, color: "#6B21A8" }}>strength {a.strength}/10</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AgentProfilePage() {
  const params  = useParams();
  const address = params.address as string;

  const [agent,     setAgent]     = useState<AgentProfile | null>(null);
  const [hia,       setHia]       = useState<HiaProfile | null>(null);
  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [loading,   setLoad]      = useState(true);
  const [copied,    setCopied]    = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [agentRes, repRes, offersRes, needsRes, hiaRes, alliancesRes] = await Promise.allSettled([
          fetch(`${API}/api/agents/${address}`),
          fetch(`${API}/api/agents/${address}/reputation`),
          fetch(`${API}/api/market/offers`),
          fetch(`${API}/api/market/needs`),
          fetch(`${API}/api/hive/intelligence/agents/${address}`, { signal: AbortSignal.timeout(6000) }),
          fetch(`${API}/api/hive/intelligence/alliances`,          { signal: AbortSignal.timeout(6000) }),
        ]);

        // On-chain data
        if (agentRes.status === "fulfilled" && agentRes.value.ok) {
          const agentData  = await agentRes.value.json();
          const repData    = (repRes.status === "fulfilled" && repRes.value.ok) ? await repRes.value.json() : { score: "0", totalDeals: "0", successfulDeals: "0" };
          const offersData = (offersRes.status === "fulfilled" && offersRes.value.ok) ? await offersRes.value.json() : { offers: [] };
          const needsData  = (needsRes.status === "fulfilled" && needsRes.value.ok)  ? await needsRes.value.json()  : { needs: [] };

          const myOffers = (offersData.offers ?? []).filter((o: any) => o.publisher?.toLowerCase() === address.toLowerCase());
          const myNeeds  = (needsData.needs   ?? []).filter((n: any) => n.publisher?.toLowerCase() === address.toLowerCase());

          setAgent({
            address,
            name:         agentData.name ?? "Unknown Agent",
            capabilities: agentData.capabilities ?? [],
            active:       agentData.active ?? false,
            registeredAt: agentData.registeredAt ?? 0,
            reputation:   repData,
            offers:       myOffers,
            needs:        myNeeds,
          });
        }

        // HIA intelligence data
        if (hiaRes.status === "fulfilled" && hiaRes.value.ok) {
          const data = await hiaRes.value.json();
          if (data.profile) setHia(data.profile);
        }

        if (alliancesRes.status === "fulfilled" && alliancesRes.value.ok) {
          const data = await alliancesRes.value.json();
          setAlliances(data.alliances ?? []);
        }
      } catch {
        // silently handle
      } finally {
        setLoad(false);
      }
    })();
  }, [address]);

  const copyBadge = () => {
    const badge = `[![AEP Agent](https://aepprotocol.xyz/badge/${address})](https://aepprotocol.xyz/agent/${address})`;
    navigator.clipboard.writeText(badge);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareUrl = `https://aepprotocol.xyz/agent/${address}`;

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#09090B", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#F59E0B", fontSize: 14, fontFamily: "monospace", letterSpacing: "0.2em", animation: "pulse 1.5s infinite" }}>
        ◈ LOADING_AGENT_PROFILE...
      </div>
    </div>
  );

  if (!agent) return (
    <div style={{ minHeight: "100vh", background: "#09090B", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <div style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>Agent not found</div>
      <Link href="/" style={{ color: "#6366f1", fontSize: 14 }}>← Back to AEP</Link>
    </div>
  );

  const rep         = agent.reputation;
  const successRate = parseInt(rep.totalDeals) > 0
    ? Math.round((parseInt(rep.successfulDeals) / parseInt(rep.totalDeals)) * 100)
    : 0;
  const joined = agent.registeredAt > 0
    ? new Date(agent.registeredAt * 1000).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "—";

  const roleM = hia ? (ROLE_META[hia.role] ?? ROLE_META.UNKNOWN) : null;

  return (
    <div style={{ minHeight: "100vh", background: "#09090B", fontFamily: "'Inter', sans-serif" }}>
      {/* Nav */}
      <nav style={{ padding: "16px 24px", borderBottom: "1px solid #1e1e2e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#6366f1,#06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 11, color: "#fff" }}>A</div>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>AEP</span>
        </Link>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link href="/hive" style={{ fontFamily: "monospace", fontSize: 11, color: "#F59E0B", textDecoration: "none", letterSpacing: "0.1em" }}>
            THE HIVE ◈
          </Link>
          <Link href="/launch" style={{ background: "linear-gradient(135deg,#6366f1,#06b6d4)", color: "#fff", padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
            Launch Agent →
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px" }}>

        {/* Header card */}
        <div style={{
          background: "#111118", border: "1px solid #1e1e2e", borderRadius: 16,
          padding: "28px 32px", marginBottom: 24, position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: roleM ? `linear-gradient(90deg, ${roleM.color}, #06b6d4)` : "linear-gradient(90deg,#6366f1,#06b6d4)" }} />

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {/* Avatar */}
              <div style={{
                width: 64, height: 64, borderRadius: 16,
                background: roleM ? `linear-gradient(135deg, ${roleM.color}88, #06b6d4)` : `linear-gradient(135deg, ${CAP_COLOR[agent.capabilities[0]] ?? "#6366f1"}, #06b6d4)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: hia ? 22 : 24, fontWeight: 900, color: "#fff",
                flexShrink: 0,
                border: roleM ? `1px solid ${roleM.color}55` : "none",
              }}>
                {hia && roleM ? roleM.icon : agent.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{agent.name}</div>
                <div style={{ fontSize: 12, color: "#475569", fontFamily: "monospace" }}>
                  {address.slice(0, 8)}...{address.slice(-6)}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: agent.active ? "#22c55e" : "#ef4444" }} />
                  <span style={{ fontSize: 11, color: agent.active ? "#22c55e" : "#ef4444" }}>{agent.active ? "Active" : "Inactive"}</span>
                  <span style={{ fontSize: 11, color: "#475569" }}>· Joined {joined}</span>
                  <span style={{ fontSize: 11, color: "#475569" }}>· Base Mainnet</span>
                  {hia && roleM && (
                    <span style={{
                      fontFamily: "monospace", fontSize: 10, fontWeight: 700,
                      color: roleM.color, letterSpacing: "0.08em",
                      padding: "1px 7px", border: `1px solid ${roleM.color}44`,
                      background: `${roleM.color}11`,
                    }}>
                      {roleM.icon} {hia.role}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => { navigator.clipboard.writeText(shareUrl); }}
              style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc", padding: "8px 16px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 600 }}
            >
              Share Profile ↗
            </button>
          </div>

          {/* Capabilities */}
          {agent.capabilities.length > 0 && (
            <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {agent.capabilities.map((cap) => (
                <span key={cap} style={{
                  background: `${CAP_COLOR[cap] ?? "#6366f1"}22`,
                  border:     `1px solid ${CAP_COLOR[cap] ?? "#6366f1"}44`,
                  color:      CAP_COLOR[cap] ?? "#a5b4fc",
                  padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                }}>
                  {cap}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* On-chain stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
          {[
            { label: "Reputation", value: parseFloat(rep.score).toFixed(1), sub: "score" },
            { label: "Total Deals", value: rep.totalDeals, sub: "on-chain" },
            { label: "Success Rate", value: `${successRate}%`, sub: "completed" },
          ].map((s) => (
            <div key={s.label} style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 12, padding: "20px 24px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#6366f1,#06b6d4)" }} />
              <div style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{s.label} · {s.sub}</div>
            </div>
          ))}
        </div>

        {/* ── HIA Intelligence Card ── */}
        <HiaCard hia={hia} alliances={alliances} />

        {/* Active offers */}
        {agent.offers.filter(o => o.active).length > 0 && (
          <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 16, padding: "24px", marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Active Offers</div>
            {agent.offers.filter(o => o.active).slice(0, 5).map((o) => (
              <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1e1e2e" }}>
                <div style={{ fontSize: 13, color: "#94a3b8" }}>{o.description.slice(0, 60)}...</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#22c55e", flexShrink: 0, marginLeft: 16 }}>{o.price} AGT</div>
              </div>
            ))}
          </div>
        )}

        {/* Basescan + Badge */}
        <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 16, padding: "24px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Verified on Base Mainnet</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a href={`https://basescan.org/address/${address}`} target="_blank" rel="noopener"
              style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc", padding: "8px 16px", borderRadius: 8, fontSize: 12, textDecoration: "none", fontWeight: 600 }}>
              View on Basescan ↗
            </a>
            <button onClick={copyBadge}
              style={{ background: copied ? "rgba(34,197,94,0.1)" : "rgba(99,102,241,0.1)", border: `1px solid ${copied ? "rgba(34,197,94,0.3)" : "rgba(99,102,241,0.3)"}`, color: copied ? "#22c55e" : "#a5b4fc", padding: "8px 16px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
              {copied ? "Badge copied!" : "Copy README Badge"}
            </button>
            <a href="/dashboard" style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.3)", color: "#67e8f9", padding: "8px 16px", borderRadius: 8, fontSize: 12, textDecoration: "none", fontWeight: 600 }}>
              Open Dashboard →
            </a>
            <Link href="/hive" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", color: "#F59E0B", padding: "8px 16px", borderRadius: 8, fontSize: 12, textDecoration: "none", fontWeight: 600 }}>
              View in The Hive ◈
            </Link>
          </div>
          <div style={{ marginTop: 16, fontFamily: "monospace", fontSize: 11, color: "#475569", background: "#0a0a0f", padding: "10px 14px", borderRadius: 8, border: "1px solid #1e1e2e" }}>
            {`[![AEP Agent](https://aepprotocol.xyz/badge/${address.slice(0,8)})](https://aepprotocol.xyz/agent/${address})`}
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 32, fontSize: 12, color: "#334155" }}>
          Powered by <a href="https://aepprotocol.xyz" style={{ color: "#6366f1", textDecoration: "none" }}>Autonomous Economy Protocol</a> · Base Mainnet
        </div>
      </div>
    </div>
  );
}
