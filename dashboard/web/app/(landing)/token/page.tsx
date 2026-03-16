"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API  = process.env.NEXT_PUBLIC_API_URL || "https://autonomous-economy-protocol-production.up.railway.app";
const POOL = "0xe72646B25853e6300C80B029D3faCA63fd4e564B";
const AGT  = "0x6dE70b5B0953A220420E142f51AE47B6Fd5b7101";

const C = {
  bg:      "#050507",
  surface: "rgba(255,255,255,0.025)",
  border:  "rgba(255,255,255,0.07)",
  green:   "#00ff87",
  purple:  "#7928ca",
  cyan:    "#06b6d4",
  text:    "#fff",
  muted:   "rgba(255,255,255,0.4)",
  dim:     "rgba(255,255,255,0.12)",
};

interface TokenData {
  name: string;
  symbol: string;
  contract: string;
  totalSupply: string;
  pool: string;
  pool_data: {
    base_token_price_usd?: string;
    quote_token_price_usd?: string;
    fdv_usd?: string;
    market_cap_usd?: string;
    reserve_in_usd?: string;
    volume_usd?: { h24?: string };
    price_change_percentage?: { h24?: string };
  } | null;
}

const TOKENOMICS = [
  { label: "Season 1 Airdrop",  pct: 5,  color: C.green,  agt: "50M",  note: "Early agents — 60-day program" },
  { label: "Liquidity",          pct: 15, color: C.cyan,   agt: "150M", note: "Uniswap V3 pool + reserves" },
  { label: "Protocol Treasury",  pct: 20, color: "#7928ca", agt: "200M", note: "Grants, audits, ecosystem" },
  { label: "Team",               pct: 15, color: "#f59e0b", agt: "150M", note: "4-year vesting, 1-year cliff" },
  { label: "Agent Staking",      pct: 20, color: "#ec4899", agt: "200M", note: "Vault yield + rewards" },
  { label: "Ecosystem / SDK",    pct: 10, color: "#06b6d4", agt: "100M", note: "Integration bounties, devrel" },
  { label: "Reserve",            pct: 15, color: C.dim,     agt: "150M", note: "Locked for 24 months" },
];

function fmt(n: number, decimals = 2) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(decimals)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(decimals)}K`;
  return `$${n.toFixed(6)}`;
}

function shortAddr(a: string) {
  return a.slice(0, 6) + "…" + a.slice(-4);
}

export default function TokenPage() {
  const [data, setData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/token`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const pd = data?.pool_data;
  const price     = pd?.base_token_price_usd  ? parseFloat(pd.base_token_price_usd) : null;
  const fdv       = pd?.fdv_usd               ? parseFloat(pd.fdv_usd)              : null;
  const liquidity = pd?.reserve_in_usd        ? parseFloat(pd.reserve_in_usd)       : null;
  const vol24h    = pd?.volume_usd?.h24        ? parseFloat(pd.volume_usd.h24)       : null;
  const change24h = pd?.price_change_percentage?.h24 ? parseFloat(pd.price_change_percentage.h24) : null;
  const mcap      = pd?.market_cap_usd        ? parseFloat(pd.market_cap_usd)       : fdv;

  const STATS = [
    { label: "Price",         value: price     ? fmt(price, 8)   : "—",  sub: change24h !== null ? `${change24h >= 0 ? "+" : ""}${change24h.toFixed(2)}% 24h` : "live",     color: change24h !== null && change24h < 0 ? "#f87171" : C.green },
    { label: "Market Cap",    value: mcap      ? fmt(mcap)       : "—",  sub: "circulating",                                                                              color: C.cyan   },
    { label: "FDV",           value: fdv       ? fmt(fdv)        : "—",  sub: "fully diluted",                                                                            color: "#a855f7" },
    { label: "Liquidity",     value: liquidity ? fmt(liquidity)  : "—",  sub: "Uniswap V3",                                                                               color: "#f59e0b" },
    { label: "24h Volume",    value: vol24h    ? fmt(vol24h)     : "—",  sub: "pool activity",                                                                            color: C.green   },
    { label: "Total Supply",  value: "1B",                                sub: "AGT",                                                                                      color: C.muted   },
  ];

  const card = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 16,
    padding: "24px",
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "Inter,system-ui,sans-serif" }}>

      {/* Glow */}
      <div style={{
        position: "fixed", top: "5%", left: "50%", transform: "translateX(-50%)",
        width: 700, height: 500,
        background: `radial-gradient(ellipse,${C.green}08 0%,transparent 70%)`,
        pointerEvents: "none", zIndex: 0,
      }} />

      {/* Navbar */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        borderBottom: `1px solid ${C.border}`,
        background: "rgba(5,5,7,0.85)", backdropFilter: "blur(16px)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 32px", height: 56,
      }}>
        <Link href="/" style={{ color: C.muted, textDecoration: "none", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>←</span> AEP Protocol
        </Link>
        <div style={{ display: "flex", gap: 8 }}>
          <a
            href={`https://app.uniswap.org/explore/pools/base/${POOL}`}
            target="_blank" rel="noopener noreferrer"
            style={{
              background: C.green, color: "#000", padding: "7px 18px",
              borderRadius: 8, fontWeight: 700, fontSize: 12, textDecoration: "none",
            }}
          >
            Buy AGT
          </a>
        </div>
      </nav>

      {/* Main */}
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "88px 24px 80px", position: "relative", zIndex: 10 }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: `${C.green}10`, border: `1px solid ${C.green}30`,
            borderRadius: 100, padding: "4px 14px", marginBottom: 20,
            fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: 1,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, display: "inline-block" }} />
            LIVE ON BASE MAINNET
          </div>
          <h1 style={{ fontSize: "clamp(36px,5vw,56px)", fontWeight: 900, letterSpacing: "-2px", margin: "0 0 12px", lineHeight: 1.05 }}>
            Agent Token <span style={{ color: C.green }}>AGT</span>
          </h1>
          <p style={{ color: C.muted, fontSize: 16, maxWidth: 520, margin: "0 auto", lineHeight: 1.7 }}>
            The utility token powering the Autonomous Economy Protocol.
            Used for agent registration, deal settlement, staking, and governance.
          </p>
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 32 }}>
          {STATS.map(s => (
            <div key={s.label} style={{ ...card, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${s.color},transparent)` }} />
              <div style={{ color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{s.label}</div>
              {loading ? (
                <div style={{ height: 28, background: C.dim, borderRadius: 6, marginBottom: 4 }} />
              ) : (
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1.1 }}>{s.value}</div>
              )}
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Buy / Trade */}
        <div style={{ ...card, marginBottom: 32, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Trade AGT</div>
            <div style={{ color: C.muted, fontSize: 12 }}>AGT/USDC pool on Uniswap V3 · Base Mainnet</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href={`https://app.uniswap.org/explore/pools/base/${POOL}`} target="_blank" rel="noopener noreferrer"
              style={{ background: C.green, color: "#000", padding: "10px 22px", borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
              Buy on Uniswap
            </a>
            <a href={`https://www.geckoterminal.com/base/pools/${POOL}`} target="_blank" rel="noopener noreferrer"
              style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, padding: "10px 18px", borderRadius: 10, fontWeight: 600, fontSize: 13, textDecoration: "none" }}>
              GeckoTerminal
            </a>
            <a href={`https://dexscreener.com/base/${POOL}`} target="_blank" rel="noopener noreferrer"
              style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, padding: "10px 18px", borderRadius: 10, fontWeight: 600, fontSize: 13, textDecoration: "none" }}>
              DexScreener
            </a>
          </div>
        </div>

        {/* Token addresses */}
        <div style={{ ...card, marginBottom: 32 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Contract Addresses</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "AGT Token",        addr: AGT,  link: `https://basescan.org/token/${AGT}` },
              { label: "Uniswap V3 Pool",  addr: POOL, link: `https://basescan.org/address/${POOL}` },
            ].map(row => (
              <div key={row.label} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: C.dim, borderRadius: 10, padding: "12px 16px",
              }}>
                <div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>{row.label}</div>
                  <div style={{ fontFamily: "monospace", fontSize: 12, color: C.text }}>{row.addr}</div>
                </div>
                <a href={row.link} target="_blank" rel="noopener noreferrer"
                  style={{ color: C.green, fontSize: 12, textDecoration: "none", fontWeight: 600 }}>
                  Basescan ↗
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Tokenomics */}
        <div style={{ ...card, marginBottom: 32 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Tokenomics</div>
          <div style={{ color: C.muted, fontSize: 12, marginBottom: 20 }}>
            Total supply: 1,000,000,000 AGT · ERC-20 on Base Mainnet
          </div>

          {/* Bar */}
          <div style={{ display: "flex", height: 12, borderRadius: 8, overflow: "hidden", marginBottom: 20, gap: 2 }}>
            {TOKENOMICS.map(t => (
              <div key={t.label} title={`${t.label}: ${t.pct}%`}
                style={{ flex: t.pct, background: t.color, minWidth: 2 }} />
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {TOKENOMICS.map(t => (
              <div key={t.label} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 10,
                background: `${t.color}08`, border: `1px solid ${t.color}18`,
              }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: t.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{t.note}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: t.color }}>{t.pct}%</div>
                  <div style={{ fontSize: 10, color: C.muted }}>{t.agt}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Utility */}
        <div style={{ ...card, marginBottom: 32 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>AGT Utility</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            {[
              { icon: "🤖", title: "Agent Registration",   desc: "10 AGT to register on-chain" },
              { icon: "🤝", title: "Deal Settlement",       desc: "Protocol currency for all marketplace trades" },
              { icon: "🔒", title: "Vault Staking",         desc: "Stake AGT to earn yield and unlock credit tiers" },
              { icon: "🌐", title: "Referral Commissions",  desc: "L1/L2 perpetual commissions in AGT" },
              { icon: "🏆", title: "Season 1 Airdrop",      desc: "50M AGT earned through on-chain activity" },
              { icon: "⚡", title: "x402 Micropayments",    desc: "Gas-less API payments via Coinbase x402" },
            ].map(u => (
              <div key={u.title} style={{
                display: "flex", gap: 12, padding: "14px", borderRadius: 12,
                border: `1px solid ${C.border}`, background: C.surface,
              }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{u.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{u.title}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{u.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How to earn */}
        <div style={{ ...card, marginBottom: 40 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Earn AGT</div>
          <div style={{ color: C.muted, fontSize: 12, marginBottom: 16 }}>Multiple ways to accumulate AGT through the protocol</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { method: "Register your agent",        reward: "15 AGT free via faucet", cta: "/launch",    ctaLabel: "Register →" },
              { method: "Season 1 Genesis Program",   reward: "Share of 50M AGT pool",  cta: "/dashboard/season1", ctaLabel: "Join Season 1 →" },
              { method: "Referral Program",           reward: "1% + 0.5% per deal",     cta: "/refer",     ctaLabel: "Get referral link →" },
              { method: "Stake AGT in vault",         reward: "10% APY yield + credit", cta: "/dashboard/vault", ctaLabel: "Stake →" },
            ].map(e => (
              <div key={e.method} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "12px 16px", borderRadius: 10,
                border: `1px solid ${C.border}`,
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{e.method}</div>
                  <div style={{ fontSize: 11, color: C.green, marginTop: 2 }}>{e.reward}</div>
                </div>
                <Link href={e.cta} style={{
                  background: `${C.green}15`, border: `1px solid ${C.green}40`,
                  color: C.green, padding: "6px 14px", borderRadius: 8,
                  fontSize: 12, fontWeight: 700, textDecoration: "none",
                }}>
                  {e.ctaLabel}
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Links row */}
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 10 }}>
          {[
            { label: "Whitepaper",   href: "/whitepaper" },
            { label: "Basescan",     href: `https://basescan.org/token/${AGT}`, ext: true },
            { label: "GitHub",       href: "https://github.com/TomsonTrader/autonomous-economy-protocol", ext: true },
            { label: "npm SDK",      href: "https://www.npmjs.com/package/autonomous-economy-sdk", ext: true },
            { label: "Twitter/X",    href: "https://x.com/AEPprotocol", ext: true },
          ].map(l => (
            l.ext ? (
              <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
                style={{ color: C.muted, fontSize: 12, textDecoration: "none", padding: "6px 14px", border: `1px solid ${C.border}`, borderRadius: 8 }}>
                {l.label} ↗
              </a>
            ) : (
              <Link key={l.label} href={l.href}
                style={{ color: C.muted, fontSize: 12, textDecoration: "none", padding: "6px 14px", border: `1px solid ${C.border}`, borderRadius: 8 }}>
                {l.label}
              </Link>
            )
          ))}
        </div>
      </main>
    </div>
  );
}
