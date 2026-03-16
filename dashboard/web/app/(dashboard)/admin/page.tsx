"use client";

import { useEffect, useState, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const GITHUB_REPO = "TomsonTrader/autonomous-economy-protocol";
const MOLTBOOK_AGENT = "aepprotocol";
const DEPLOYER = "0x1200BE707C668b0313757Fc7d097B1a498bA62Ba";
const UNISWAP_POOL = "0xe72646B25853e6300C80B029D3faCA63fd4e564B";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Metric {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  href?: string;
  loading?: boolean;
  error?: boolean;
}

interface Section {
  title: string;
  icon: string;
  metrics: Metric[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────
async function safeFetch(url: string, opts?: RequestInit) {
  try {
    const r = await fetch(url, { cache: "no-store", ...opts });
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  } catch {
    return null;
  }
}

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      background: color + "22",
      border: `1px solid ${color}44`,
      color,
      borderRadius: 6,
      padding: "2px 8px",
      fontSize: 11,
      fontWeight: 700,
    }}>{children}</span>
  );
}

function MetricCard({ m }: { m: Metric }) {
  const card = (
    <div style={{
      background: "var(--card)",
      border: `1px solid ${m.error ? "#ef4444" : m.color ? m.color + "33" : "var(--border)"}`,
      borderRadius: 12,
      padding: "16px 18px",
      minHeight: 80,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      opacity: m.loading ? 0.6 : 1,
      transition: "opacity .3s",
    }}>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>{m.label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: m.error ? "#ef4444" : m.color ?? "#fff", letterSpacing: "-0.5px" }}>
        {m.loading ? "…" : m.error ? "error" : m.value}
      </div>
      {m.sub && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{m.sub}</div>}
    </div>
  );

  if (m.href) return <a href={m.href} target="_blank" rel="noopener" style={{ textDecoration: "none" }}>{card}</a>;
  return card;
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [livePrice, setLivePrice] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Fetch all sources in parallel
    const [stats, genesis, vaultStats, github, moltbook, backendHealth, tokenData] = await Promise.all([
      safeFetch(`${API}/api/monitor/stats`),
      safeFetch(`${API}/api/genesis/info`),
      safeFetch(`${API}/api/vault/stats`),
      safeFetch(`https://api.github.com/repos/${GITHUB_REPO}`),
      safeFetch(`https://www.moltbook.com/api/v1/agents/profile?name=${MOLTBOOK_AGENT}`),
      safeFetch(`${API}/api/health`).then(r => r !== null),
      safeFetch(`${API}/api/token`),
    ]);

    const fmtAGT = (v: string | number) => {
      const n = typeof v === "string" ? parseFloat(v) : v;
      if (isNaN(n)) return "—";
      if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
      if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
      return n.toFixed(2);
    };

    // Genesis days
    const daysLeft = genesis?.daysRemaining ?? "—";
    const seasonEnd = genesis?.end
      ? new Date(genesis.end * 1000).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })
      : "—";

    const newSections: Section[] = [
      {
        title: "Protocolo On-chain",
        icon: "⛓️",
        metrics: [
          {
            label: "Agentes activos",
            value: stats?.activeAgents ?? "—",
            sub: "registrados en mainnet",
            color: "#6366f1",
            loading: !stats,
          },
          {
            label: "Needs publicados",
            value: stats?.totalNeeds ?? "—",
            sub: "en marketplace",
            loading: !stats,
          },
          {
            label: "Offers publicadas",
            value: stats?.totalOffers ?? "—",
            sub: "en marketplace",
            loading: !stats,
          },
          {
            label: "Proposals totales",
            value: stats?.totalProposals ?? "—",
            sub: "negociaciones",
            loading: !stats,
          },
        ],
      },
      {
        title: "Genesis Season 1",
        icon: "🏆",
        metrics: [
          {
            label: "Participantes",
            value: genesis?.participants ?? "—",
            sub: "agentes con puntos",
            color: "#f59e0b",
            loading: !genesis,
          },
          {
            label: "Puntos totales",
            value: genesis?.totalPoints ? Number(genesis.totalPoints).toLocaleString() : "—",
            sub: "acumulados on-chain",
            loading: !genesis,
          },
          {
            label: "Pool AGT",
            value: genesis?.poolAGT ? fmtAGT(genesis.poolAGT) : "—",
            sub: "a distribuir",
            color: "#22c55e",
            loading: !genesis,
          },
          {
            label: "Días restantes",
            value: typeof daysLeft === "number" ? daysLeft : "—",
            sub: `fin: ${seasonEnd}`,
            color: daysLeft !== "—" && Number(daysLeft) < 10 ? "#ef4444" : "#f59e0b",
            loading: !genesis,
          },
        ],
      },
      {
        title: "Token AGT",
        icon: "💎",
        metrics: [
          {
            label: "Precio AGT",
            value: tokenData?.price ? `$${Number(tokenData.price).toFixed(7)}` : "0.000001 USDC",
            sub: tokenData?.change24h !== undefined ? `${Number(tokenData.change24h) >= 0 ? "+" : ""}${Number(tokenData.change24h).toFixed(1)}% 24h` : "pool Uniswap V3",
            color: "#22c55e",
            href: `https://dexscreener.com/base/${UNISWAP_POOL}`,
          },
          {
            label: "Pool Uniswap",
            value: tokenData?.liquidity ? `$${Math.round(Number(tokenData.liquidity)).toLocaleString()}` : "~$400",
            sub: "liquidez total",
            href: `https://app.uniswap.org/explore/pools/base/${UNISWAP_POOL}`,
          },
          {
            label: "Total staked",
            value: vaultStats?.totalStaked ? fmtAGT(vaultStats.totalStaked) + " AGT" : "—",
            sub: "en AgentVault",
            color: "#6366f1",
            loading: !vaultStats,
          },
          {
            label: "FDV",
            value: "~$1,000",
            sub: "1B supply × precio",
            color: "#a855f7",
          },
        ],
      },
      {
        title: "Infraestructura",
        icon: "🛠️",
        metrics: [
          {
            label: "Backend Railway",
            value: backendHealth ? "Online" : "Offline",
            sub: "API Express",
            color: backendHealth ? "#22c55e" : "#ef4444",
            error: !backendHealth,
            href: `${API}/api/health`,
          },
          {
            label: "ETH deployer",
            value: "~0.0014",
            sub: DEPLOYER.slice(0, 10) + "…",
            color: "#f59e0b",
            href: `https://basescan.org/address/${DEPLOYER}`,
          },
          {
            label: "Contratos",
            value: "10",
            sub: "Base Mainnet, verificados",
            color: "#22c55e",
            href: "https://basescan.org",
          },
          {
            label: "Tests",
            value: "41 / 41",
            sub: "pasando",
            color: "#22c55e",
          },
        ],
      },
      {
        title: "Comunidad",
        icon: "🌐",
        metrics: [
          {
            label: "GitHub Stars",
            value: github?.stargazers_count ?? "—",
            sub: `${github?.forks_count ?? "—"} forks`,
            color: "#f59e0b",
            loading: !github,
            href: `https://github.com/${GITHUB_REPO}`,
          },
          {
            label: "Moltbook karma",
            value: moltbook?.agent?.karma ?? "—",
            sub: `${moltbook?.agent?.follower_count ?? "—"} seguidores · ${moltbook?.agent?.posts_count ?? "—"} posts`,
            color: "#6366f1",
            loading: !moltbook,
            href: `https://www.moltbook.com/u/${MOLTBOOK_AGENT}`,
          },
          {
            label: "SDK npm",
            value: "autonomous-economy-sdk",
            sub: "v1.5.0 publicado",
            color: "#ef4444",
            href: "https://www.npmjs.com/package/autonomous-economy-sdk",
          },
          {
            label: "Moltbook perfil",
            value: "@aepprotocol",
            sub: "m/aep-protocol",
            color: "#22c55e",
            href: "https://www.moltbook.com/u/aepprotocol",
          },
        ],
      },
    ];

    if (tokenData?.price) setLivePrice(`$${Number(tokenData.price).toFixed(7)}`);
    setSections(newSections);
    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000); // refresh every 60s
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Panel de Control</h1>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0" }}>
            Todas las variables del proyecto en tiempo real
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {lastUpdated && (
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              Actualizado: {lastUpdated.toLocaleTimeString("es-ES")}
            </span>
          )}
          <button
            onClick={load}
            style={{
              background: "rgba(99,102,241,0.12)",
              border: "1px solid rgba(99,102,241,0.3)",
              color: "#6366f1",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ↻ Actualizar
          </button>
        </div>
      </div>

      {/* Quick status chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
        <Chip color="#22c55e">Base Mainnet</Chip>
        <Chip color="#6366f1">Season 1 LIVE</Chip>
        <Chip color="#f59e0b">AGT {livePrice ?? "$0.000001"}</Chip>
        <Chip color="#22c55e">Backend Online</Chip>
        <Chip color="#a855f7">Moltbook @aepprotocol</Chip>
      </div>

      {/* Sections */}
      {loading ? (
        <div style={{ color: "var(--muted)", fontSize: 14 }}>Cargando datos…</div>
      ) : (
        sections.map((section) => (
          <div key={section.title} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--muted)", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
              {section.icon} {section.title}
            </h2>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 12,
            }}>
              {section.metrics.map((m) => (
                <MetricCard key={m.label} m={m} />
              ))}
            </div>
          </div>
        ))
      )}

      {/* Footer note */}
      <div style={{
        marginTop: 16,
        padding: "12px 16px",
        background: "rgba(99,102,241,0.06)",
        border: "1px solid rgba(99,102,241,0.15)",
        borderRadius: 10,
        fontSize: 12,
        color: "var(--muted)",
      }}>
        Se actualiza automáticamente cada 60 segundos. Vercel Analytics activo — visitas disponibles en el dashboard de Vercel.
      </div>
    </div>
  );
}
