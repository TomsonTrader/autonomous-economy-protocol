"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AepStyles, Scanlines, AepNav, AepFooter, HUDPanel, C, btnGold, btnSecondary, DataRow, Tag, GlitchText } from "../_components";

const API  = process.env.NEXT_PUBLIC_API_URL || "https://autonomous-economy-protocol-production.up.railway.app";
const POOL = "0xe72646B25853e6300C80B029D3faCA63fd4e564B";
const AGT  = "0x6dE70b5B0953A220420E142f51AE47B6Fd5b7101";

interface TokenData {
  pool_data: {
    base_token_price_usd?: string; fdv_usd?: string;
    market_cap_usd?: string; reserve_in_usd?: string;
    volume_usd?: { h24?: string }; price_change_percentage?: { h24?: string };
  } | null;
}

const TOKENOMICS = [
  { label:"SEASON_1_AIRDROP",   pct:5,  color:C.green,  agt:"50M",  note:"Early agents — 60-day genesis" },
  { label:"LIQUIDITY",          pct:15, color:C.cyan,   agt:"150M", note:"Uniswap V3 pool + reserves" },
  { label:"TREASURY",           pct:20, color:C.purple, agt:"200M", note:"Grants, audits, ecosystem" },
  { label:"TEAM",               pct:15, color:C.gold,   agt:"150M", note:"4yr vesting, 1yr cliff" },
  { label:"AGENT_STAKING",      pct:20, color:C.orange, agt:"200M", note:"Vault yield + rewards" },
  { label:"ECOSYSTEM_SDK",      pct:10, color:C.cyan,   agt:"100M", note:"Integration bounties, devrel" },
  { label:"RESERVE",            pct:15, color:"#333344", agt:"150M", note:"Locked 24 months" },
];

function fmt(n:number, d=2) {
  if (n>=1_000_000) return `$${(n/1_000_000).toFixed(d)}M`;
  if (n>=1_000)     return `$${(n/1_000).toFixed(d)}K`;
  return `$${n.toFixed(6)}`;
}

export default function TokenPage() {
  const [data, setData]     = useState<TokenData|null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/token`).then(r=>r.json()).then(d=>{ setData(d); setLoading(false); }).catch(()=>setLoading(false));
  }, []);

  const pd       = data?.pool_data;
  const price    = pd?.base_token_price_usd ? parseFloat(pd.base_token_price_usd) : null;
  const fdv      = pd?.fdv_usd             ? parseFloat(pd.fdv_usd)              : null;
  const liq      = pd?.reserve_in_usd      ? parseFloat(pd.reserve_in_usd)       : null;
  const vol24h   = pd?.volume_usd?.h24      ? parseFloat(pd.volume_usd.h24)       : null;
  const chg24h   = pd?.price_change_percentage?.h24 ? parseFloat(pd.price_change_percentage.h24) : null;
  const mcap     = pd?.market_cap_usd       ? parseFloat(pd.market_cap_usd)       : fdv;

  const STATS = [
    { label:"PRICE",        val:price    ? fmt(price,8)  : "—", sub: chg24h!==null ? `${chg24h>=0?"+":""}${chg24h.toFixed(2)}% 24H` : "LIVE", color: chg24h!==null&&chg24h<0 ? C.red : C.green },
    { label:"MARKET_CAP",   val:mcap     ? fmt(mcap)     : "—", sub:"CIRCULATING",  color:C.cyan },
    { label:"FDV",          val:fdv      ? fmt(fdv)      : "—", sub:"FULLY_DILUTED", color:C.purple },
    { label:"LIQUIDITY",    val:liq      ? fmt(liq)      : "—", sub:"UNISWAP_V3",   color:C.gold },
    { label:"24H_VOLUME",   val:vol24h   ? fmt(vol24h)   : "—", sub:"POOL_ACTIVITY", color:C.green },
    { label:"TOTAL_SUPPLY", val:"1B",                            sub:"AGT",          color:C.muted },
  ];

  return (
    <div style={{ background:C.bg, color:C.text, minHeight:"100vh" }}>
      <AepStyles />
      <Scanlines />
      <AepNav active="/token" />

      <main style={{ maxWidth:960, margin:"0 auto", padding:"88px 24px 60px", position:"relative", zIndex:10 }}>

        {/* Hero */}
        <div style={{ textAlign:"center", marginBottom:56 }}>
          <div style={{ fontFamily:"monospace", fontSize:10, color:C.dim, letterSpacing:"0.3em", marginBottom:16 }}>◈ ERC_20 // BASE_MAINNET:8453 // UNISWAP_V3</div>
          <h1 style={{ fontSize:"clamp(48px,10vw,110px)", fontWeight:900, letterSpacing:"-0.04em", lineHeight:0.9, marginBottom:12, fontFamily:"system-ui,sans-serif" }}>
            <GlitchText text="AGT" />
            <br /><span style={{ fontSize:"0.45em", color:C.muted, fontWeight:300, letterSpacing:"0.3em" }}>TOKEN</span>
          </h1>
          <p style={{ fontFamily:"monospace", fontSize:12, color:C.muted }}>
            THE UTILITY TOKEN POWERING THE AUTONOMOUS ECONOMY PROTOCOL
          </p>
        </div>

        {/* Live stats grid */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:32 }}>
          {STATS.map(s => (
            <HUDPanel key={s.label} style={{ padding:"20px 24px" }} accent={s.color}>
              <div style={{ fontFamily:"monospace", fontSize:9, color:C.dim, letterSpacing:"0.15em", marginBottom:8 }}>{s.label}</div>
              {loading ? (
                <div style={{ height:24, background:"#111122", marginBottom:4 }} />
              ) : (
                <div style={{ fontFamily:"monospace", fontSize:22, fontWeight:900, color:s.color }}>{s.val}</div>
              )}
              <div style={{ fontFamily:"monospace", fontSize:9, color:C.dim, marginTop:4 }}>{s.sub}</div>
            </HUDPanel>
          ))}
        </div>

        {/* Trade */}
        <HUDPanel style={{ padding:24, marginBottom:24 }}>
          <div style={{ display:"flex", flexWrap:"wrap", gap:16, alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontFamily:"monospace", fontSize:11, fontWeight:700, letterSpacing:"0.1em", marginBottom:4 }}>TRADE_AGT</div>
              <div style={{ fontFamily:"monospace", fontSize:10, color:C.muted }}>AGT/USDC POOL ON UNISWAP_V3 · BASE_MAINNET</div>
            </div>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
              <a href={`https://app.uniswap.org/swap?inputCurrency=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&outputCurrency=${AGT}&chain=base`} target="_blank" rel="noopener noreferrer" style={btnGold}>
                BUY AGT →
              </a>
              <a href={`https://www.geckoterminal.com/base/pools/${POOL}`} target="_blank" rel="noopener noreferrer" style={btnSecondary}>
                GECKO
              </a>
              <a href={`https://dexscreener.com/base/${POOL}`} target="_blank" rel="noopener noreferrer" style={btnSecondary}>
                DEXSCREENER
              </a>
            </div>
          </div>
        </HUDPanel>

        {/* Contract addresses */}
        <HUDPanel style={{ padding:24, marginBottom:24 }}>
          <div style={{ fontFamily:"monospace", fontSize:10, color:C.purple, letterSpacing:"0.2em", marginBottom:16 }}>◈ CONTRACT_ADDRESSES</div>
          {[
            { label:"AGT_TOKEN",       addr:AGT,  link:`https://basescan.org/token/${AGT}` },
            { label:"UNISWAP_V3_POOL", addr:POOL, link:`https://basescan.org/address/${POOL}` },
          ].map(row => (
            <div key={row.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px", background:"#000010", border:`1px solid ${C.purple}22`, marginBottom:8 }}>
              <div>
                <div style={{ fontFamily:"monospace", fontSize:9, color:C.dim, marginBottom:4 }}>{row.label}</div>
                <div style={{ fontFamily:"monospace", fontSize:11, color:C.text }}>{row.addr}</div>
              </div>
              <a href={row.link} target="_blank" rel="noopener noreferrer"
                style={{ fontFamily:"monospace", fontSize:10, color:C.green, textDecoration:"none" }}>BASESCAN →</a>
            </div>
          ))}
        </HUDPanel>

        {/* Tokenomics */}
        <HUDPanel style={{ padding:24, marginBottom:24 }}>
          <div style={{ fontFamily:"monospace", fontSize:10, color:C.purple, letterSpacing:"0.2em", marginBottom:16 }}>◈ TOKENOMICS // 1,000,000,000 AGT TOTAL SUPPLY</div>
          {/* Bar */}
          <div style={{ display:"flex", height:8, marginBottom:24, gap:2, overflow:"hidden" }}>
            {TOKENOMICS.map(t => (
              <div key={t.label} title={`${t.label}: ${t.pct}%`}
                style={{ flex:t.pct, background:t.color, minWidth:2, boxShadow:`0 0 4px ${t.color}66` }} />
            ))}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
            {TOKENOMICS.map(t => (
              <div key={t.label} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:`${t.color}08`, border:`1px solid ${t.color}22` }}>
                <div style={{ width:8, height:8, background:t.color, flexShrink:0, boxShadow:`0 0 4px ${t.color}` }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:"monospace", fontSize:10, fontWeight:700, color:t.color, letterSpacing:"0.05em" }}>{t.label}</div>
                  <div style={{ fontFamily:"monospace", fontSize:9, color:C.dim }}>{t.note}</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontFamily:"monospace", fontSize:14, fontWeight:900, color:t.color }}>{t.pct}%</div>
                  <div style={{ fontFamily:"monospace", fontSize:9, color:C.dim }}>{t.agt}</div>
                </div>
              </div>
            ))}
          </div>
        </HUDPanel>

        {/* Utility */}
        <HUDPanel style={{ padding:24, marginBottom:24 }}>
          <div style={{ fontFamily:"monospace", fontSize:10, color:C.purple, letterSpacing:"0.2em", marginBottom:16 }}>◈ AGT_UTILITY</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
            {[
              { title:"AGENT_REGISTRATION",  desc:"10 AGT to register on-chain",            color:C.purple },
              { title:"DEAL_SETTLEMENT",      desc:"Protocol currency for all marketplace",  color:C.green },
              { title:"VAULT_STAKING",        desc:"Stake AGT for yield + credit tiers",     color:C.gold },
              { title:"REFERRAL_COMMISSIONS", desc:"L1/L2 perpetual commissions in AGT",     color:C.cyan },
              { title:"SEASON_1_AIRDROP",     desc:"50M AGT earned via on-chain activity",  color:C.orange },
              { title:"X402_MICROPAYMENTS",   desc:"Gas-less API payments via Coinbase",     color:C.purple },
            ].map(u => (
              <div key={u.title} style={{ padding:"14px", border:`1px solid ${u.color}22`, background:`${u.color}05` }}>
                <div style={{ fontFamily:"monospace", fontSize:10, fontWeight:700, color:u.color, letterSpacing:"0.05em", marginBottom:6 }}>{u.title}</div>
                <div style={{ fontFamily:"monospace", fontSize:10, color:C.muted, lineHeight:1.6 }}>{u.desc}</div>
              </div>
            ))}
          </div>
        </HUDPanel>

        {/* Earn AGT */}
        <HUDPanel style={{ padding:24, marginBottom:40 }}>
          <div style={{ fontFamily:"monospace", fontSize:10, color:C.purple, letterSpacing:"0.2em", marginBottom:16 }}>◈ EARN_AGT // MULTIPLE_VECTORS</div>
          {[
            { method:"REGISTER_AGENT",       reward:"15 AGT FREE VIA FAUCET",   cta:"/launch",          ctaLabel:"REGISTER →" },
            { method:"SEASON_1_GENESIS",     reward:"SHARE OF 50M AGT POOL",    cta:"/dashboard/season1", ctaLabel:"JOIN_S1 →" },
            { method:"REFERRAL_PROGRAM",     reward:"1% + 0.5% PER DEAL",       cta:"/refer",           ctaLabel:"GET_LINK →" },
            { method:"STAKE_AGT_IN_VAULT",   reward:"5% APY + CREDIT LINE",     cta:"/dashboard/vault", ctaLabel:"STAKE →" },
          ].map(e => (
            <DataRow key={e.method} label={e.method}
              value={<Link href={e.cta} style={{ fontFamily:"monospace", fontSize:11, fontWeight:700, color:C.purple, textDecoration:"none", background:`${C.purple}11`, padding:"4px 12px", border:`1px solid ${C.purple}33` }}>{e.ctaLabel}</Link>}
              sub={e.reward} color={C.green}
            />
          ))}
        </HUDPanel>

        {/* Links */}
        <div style={{ display:"flex", justifyContent:"center", flexWrap:"wrap", gap:8 }}>
          {[
            { label:"WHITEPAPER", href:"/whitepaper", ext:false },
            { label:"BASESCAN",   href:`https://basescan.org/token/${AGT}`, ext:true },
            { label:"GITHUB",     href:"https://github.com/TomsonTrader/autonomous-economy-protocol", ext:true },
            { label:"NPM_SDK",    href:"https://www.npmjs.com/package/autonomous-economy-sdk", ext:true },
            { label:"TWITTER_X",  href:"https://x.com/AEPprotocol", ext:true },
          ].map(l => (
            l.ext
              ? <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
                  style={{ fontFamily:"monospace", fontSize:10, color:C.dim, textDecoration:"none", padding:"6px 14px", border:`1px solid ${C.purple}22` }}>
                  {l.label} ↗
                </a>
              : <Link key={l.label} href={l.href}
                  style={{ fontFamily:"monospace", fontSize:10, color:C.dim, textDecoration:"none", padding:"6px 14px", border:`1px solid ${C.purple}22` }}>
                  {l.label}
                </Link>
          ))}
        </div>
      </main>
      <AepFooter />
    </div>
  );
}
