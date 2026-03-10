"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://autonomous-economy-protocol-production.up.railway.app";

interface AgentProfile {
  address: string;
  name: string;
  capabilities: string[];
  active: boolean;
  registeredAt: number;
  reputation: { score: string; totalDeals: string; successfulDeals: string };
  offers: { id: number; description: string; price: string; active: boolean }[];
  needs:  { id: number; description: string; budget: string; active: boolean }[];
}

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

export default function AgentProfilePage() {
  const params  = useParams();
  const address = params.address as string;
  const [agent, setAgent]   = useState<AgentProfile | null>(null);
  const [loading, setLoad]  = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [agentRes, repRes, offersRes, needsRes] = await Promise.all([
          fetch(`${API}/api/agents/${address}`),
          fetch(`${API}/api/agents/${address}/reputation`),
          fetch(`${API}/api/market/offers`),
          fetch(`${API}/api/market/needs`),
        ]);

        const agentData  = await agentRes.json();
        const repData    = repRes.ok ? await repRes.json() : { score: "0", totalDeals: "0", successfulDeals: "0" };
        const offersData = offersRes.ok ? await offersRes.json() : { offers: [] };
        const needsData  = needsRes.ok  ? await needsRes.json()  : { needs: [] };

        const myOffers = (offersData.offers ?? []).filter(
          (o: any) => o.publisher?.toLowerCase() === address.toLowerCase()
        );
        const myNeeds = (needsData.needs ?? []).filter(
          (n: any) => n.publisher?.toLowerCase() === address.toLowerCase()
        );

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
      } catch {
        setAgent(null);
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
      <div style={{ color: "#6366f1", fontSize: 14 }}>Loading agent profile...</div>
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

  return (
    <div style={{ minHeight: "100vh", background: "#09090B", fontFamily: "'Inter', sans-serif" }}>
      {/* Nav */}
      <nav style={{ padding: "16px 24px", borderBottom: "1px solid #1e1e2e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#6366f1,#06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 11, color: "#fff" }}>A</div>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>AEP</span>
        </Link>
        <Link href="/launch" style={{ background: "linear-gradient(135deg,#6366f1,#06b6d4)", color: "#fff", padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
          Launch Agent →
        </Link>
      </nav>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px" }}>

        {/* Header card */}
        <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 16, padding: "28px 32px", marginBottom: 24, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,#6366f1,#06b6d4)" }} />

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {/* Avatar */}
              <div style={{
                width: 64, height: 64, borderRadius: 16,
                background: `linear-gradient(135deg, ${CAP_COLOR[agent.capabilities[0]] ?? "#6366f1"}, #06b6d4)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 24, fontWeight: 900, color: "#fff",
                flexShrink: 0,
              }}>
                {agent.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{agent.name}</div>
                <div style={{ fontSize: 12, color: "#475569", fontFamily: "monospace" }}>
                  {address.slice(0, 8)}...{address.slice(-6)}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: agent.active ? "#22c55e" : "#ef4444" }} />
                  <span style={{ fontSize: 11, color: agent.active ? "#22c55e" : "#ef4444" }}>{agent.active ? "Active" : "Inactive"}</span>
                  <span style={{ fontSize: 11, color: "#475569" }}>· Joined {joined}</span>
                  <span style={{ fontSize: 11, color: "#475569" }}>· Base Mainnet</span>
                </div>
              </div>
            </div>

            {/* Share button */}
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

        {/* Stats row */}
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

        {/* Basescan link + Badge */}
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
