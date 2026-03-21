"use client";
// ─── Shared AEP Design System ────────────────────────────────────────────────
// Used across all landing pages. Import what you need.

import Link from "next/link";

// ─── Color palette ─────────────────────────────────────────────────────────
export const C = {
  bg:      "#00000A",
  purple:  "#7C3AFF",
  green:   "#00FFB2",
  gold:    "#FFD700",
  cyan:    "#00D4FF",
  red:     "#FF3366",
  orange:  "#FF6B35",
  text:    "#FFFFFF",
  muted:   "#8888AA",
  dim:     "#444466",
  border:  "rgba(124,58,255,0.25)",
  surface: "rgba(0,0,0,0.75)",
};

// ─── Global CSS (inject once per page) ─────────────────────────────────────
export function AepStyles() {
  return (
    <style>{`
      *, *::before, *::after { box-sizing: border-box; }
      body { background: ${C.bg}; color: ${C.text}; }
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-track { background: #000; }
      ::-webkit-scrollbar-thumb { background: ${C.purple}; border-radius: 2px; }
      @keyframes aep-spin   { to { transform: rotate(360deg); } }
      @keyframes aep-pulse  { 0%,100%{opacity:1} 50%{opacity:.4} }
      @keyframes aep-float  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
      @keyframes aep-blink  { 0%,100%{opacity:1} 50%{opacity:0} }
      @keyframes aep-reveal { from{opacity:0;transform:translateY(32px)} to{opacity:1;transform:translateY(0)} }
      @keyframes aep-fade-in { from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:translateX(0)} }
      @keyframes glitch1 {
        0%,100%{clip-path:inset(0 0 95% 0);transform:translate(-3px,0)}
        20%{clip-path:inset(30% 0 50% 0);transform:translate(3px,0)}
        40%{clip-path:inset(60% 0 10% 0);transform:translate(-2px,0)}
        60%{clip-path:inset(80% 0 5% 0);transform:translate(2px,0)}
        80%{clip-path:inset(10% 0 80% 0);transform:translate(-3px,0)}
      }
      @keyframes glitch2 {
        0%,100%{clip-path:inset(50% 0 30% 0);transform:translate(3px,0)}
        25%{clip-path:inset(5% 0 90% 0);transform:translate(-3px,0)}
        50%{clip-path:inset(70% 0 15% 0);transform:translate(2px,0)}
        75%{clip-path:inset(20% 0 70% 0);transform:translate(-2px,0)}
      }
      .aep-glitch-base { position:relative; }
      .aep-glitch-base::before, .aep-glitch-base::after {
        content: attr(data-text); position:absolute; inset:0;
      }
      .aep-glitch-base::before { color:${C.purple}; animation:glitch1 3s infinite; animation-delay:.1s }
      .aep-glitch-base::after  { color:${C.green};  animation:glitch2 3s infinite; animation-delay:.3s }
      input:focus, textarea:focus { outline:none; border-color:${C.purple}88 !important; }
      input, textarea, select {
        background:#000010 !important; color:${C.text} !important;
        border: 1px solid ${C.border} !important;
        font-family: monospace !important;
      }
      input::placeholder, textarea::placeholder { color:${C.dim} !important; }
      @keyframes sa-nav-glow { 0%,100% { box-shadow: 0 0 12px #0066FF99, 0 0 28px #00D4FF44; } 50% { box-shadow: 0 0 22px #0066FFCC, 0 0 50px #00D4FF88; } }
    `}</style>
  );
}

// ─── Scanline overlay ───────────────────────────────────────────────────────
export function Scanlines() {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 5, pointerEvents: "none",
      backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.15) 2px,rgba(0,0,0,0.15) 4px)",
      mixBlendMode: "multiply",
    }} />
  );
}

// ─── HUD bracketed panel ────────────────────────────────────────────────────
export function HUDPanel({ children, className, style, accent = C.purple }:
  { children: React.ReactNode; className?: string; style?: React.CSSProperties; accent?: string }) {
  const cs = `2px solid ${accent}`;
  return (
    <div className={className} style={{
      position: "relative",
      background: C.surface,
      border: `1px solid ${accent}33`,
      backdropFilter: "blur(12px)",
      ...style,
    }}>
      <span style={{ position:"absolute", top:0, left:0, width:14, height:14, borderTop:cs, borderLeft:cs }} />
      <span style={{ position:"absolute", top:0, right:0, width:14, height:14, borderTop:cs, borderRight:cs }} />
      <span style={{ position:"absolute", bottom:0, left:0, width:14, height:14, borderBottom:cs, borderLeft:cs }} />
      <span style={{ position:"absolute", bottom:0, right:0, width:14, height:14, borderBottom:cs, borderRight:cs }} />
      {children}
    </div>
  );
}

// ─── Glitch text ────────────────────────────────────────────────────────────
export function GlitchText({ text, style }: { text: string; style?: React.CSSProperties }) {
  return (
    <span className="aep-glitch-base" data-text={text} style={{ display:"inline-block", ...style }}>
      {text}
    </span>
  );
}

// ─── Clip-path button styles ─────────────────────────────────────────────────
export const btnPrimary: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8,
  background: `linear-gradient(135deg, ${C.purple}, #A855F7)`,
  color: "#fff", textDecoration: "none",
  padding: "13px 28px", fontFamily: "monospace", fontWeight: 700,
  fontSize: 13, letterSpacing: "0.1em", cursor: "pointer", border: "none",
  clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)",
  boxShadow: `0 0 30px ${C.purple}55`,
};
export const btnSecondary: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8,
  border: `1px solid ${C.purple}55`, color: C.purple,
  background: `${C.purple}08`, textDecoration: "none",
  padding: "13px 28px", fontFamily: "monospace", fontWeight: 700,
  fontSize: 13, letterSpacing: "0.1em", cursor: "pointer",
  clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)",
};
export const btnGold: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8,
  background: `linear-gradient(135deg, ${C.gold}, ${C.orange})`,
  color: "#000", textDecoration: "none",
  padding: "14px 36px", fontFamily: "monospace", fontWeight: 900,
  fontSize: 14, letterSpacing: "0.15em", cursor: "pointer", border: "none",
  clipPath: "polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%)",
  boxShadow: `0 0 50px ${C.gold}55`,
};

// ─── Hex logo ────────────────────────────────────────────────────────────────
export function HexLogo({ size = 32 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <svg viewBox="0 0 32 32" style={{ animation: "aep-spin 12s linear infinite" }}>
        <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" fill="none" stroke={C.purple} strokeWidth="1.5" />
        <polygon points="16,7 24,11.5 24,20.5 16,25 8,20.5 8,11.5" fill={`${C.purple}22`} />
        <circle cx="16" cy="16" r="3" fill={C.green} />
      </svg>
    </div>
  );
}

// ─── Shared Nav ─────────────────────────────────────────────────────────────
export function AepNav({ active }: { active?: string }) {
  const links = [
    { href: "/hive",        label: "THE_HIVE" },
    { href: "/super-agent", label: "SUPER_AGENT" },
    { href: "/token",       label: "AGT" },
    { href: "/whitepaper",  label: "DOCS" },
    { href: "/profile",     label: "MY_PROFILE" },
  ];
  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 32px", height: 56,
      background: "rgba(0,0,8,0.85)",
      borderBottom: `1px solid ${C.purple}22`,
      backdropFilter: "blur(20px)",
      fontFamily: "monospace",
    }}>
      <Link href="/" style={{ display:"flex", alignItems:"center", gap:10, textDecoration:"none" }}>
        <HexLogo />
        <span style={{ fontSize:12, fontWeight:700, letterSpacing:"0.2em", color:C.text }}>
          AEP<span style={{ color:C.purple }}>://</span>PROTOCOL
        </span>
      </Link>
      <div style={{ display:"flex", alignItems:"center", gap:24 }}>
        {links.map(l => (
          <Link key={l.href} href={l.href} style={{
            fontSize:11, letterSpacing:"0.15em", textDecoration:"none",
            color: active === l.href ? C.green : C.dim,
            borderBottom: active === l.href ? `1px solid ${C.green}` : "none",
            paddingBottom: 2,
          }}>{l.label}</Link>
        ))}
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ width:6, height:6, borderRadius:"50%", background:C.green, boxShadow:`0 0 6px ${C.green}` }} />
          <span style={{ fontSize:10, color:C.muted }}>BASE MAINNET</span>
        </div>
        <Link href="/join" style={{ ...btnPrimary, padding:"7px 18px", fontSize:11, background:"linear-gradient(135deg,#F59E0B,#F97316)", boxShadow:"0 0 14px rgba(245,158,11,0.4)", color:"#000" }}>
          🎁 FREE — 500 AGT
        </Link>
      </div>
    </nav>
  );
}

// ─── Shared Footer ───────────────────────────────────────────────────────────
export function AepFooter() {
  return (
    <footer style={{
      position: "relative", zIndex: 20,
      borderTop: `1px solid ${C.purple}15`,
      padding: "28px 32px",
      display: "flex", flexWrap: "wrap", gap: 16,
      justifyContent: "space-between", alignItems: "center",
      fontFamily: "monospace",
    }}>
      <div style={{ fontSize:10, color:"#222233" }}>
        AEP://PROTOCOL // BASE_MAINNET:8453 // AGPL-3.0
      </div>
      <div style={{ display:"flex", gap:24 }}>
        {[
          { label:"DOCS",        href:"/whitepaper" },
          { label:"SDK",         href:"https://www.npmjs.com/package/autonomous-economy-sdk", ext:true },
          { label:"GITHUB",      href:"https://github.com/TomsonTrader/autonomous-economy-protocol", ext:true },
          { label:"LEADERBOARD", href:"/dashboard/season1" },
          { label:"TOKEN",       href:"/token" },
          { label:"SUPER AGENT", href:"/super-agent" },
          { label:"JOIN",        href:"/join" },
          { label:"MY PROFILE",  href:"/me" },
        ].map(({ label, href, ext }) => (
          ext
            ? <a key={label} href={href} target="_blank" rel="noopener noreferrer" style={{ fontSize:10, color:C.dim, textDecoration:"none", letterSpacing:"0.15em" }}>{label}</a>
            : <Link key={label} href={href} style={{ fontSize:10, color:C.dim, textDecoration:"none", letterSpacing:"0.15em" }}>{label}</Link>
        ))}
      </div>
      <div style={{ fontSize:10, color:"#1a1a2e" }}>ALL SYSTEMS OPERATIONAL ◈</div>
    </footer>
  );
}

// ─── Data strip row (used in multiple pages) ─────────────────────────────────
export function DataRow({ label, value, sub, color = C.green }: { label:string; value:string|React.ReactNode; sub?:string; color?:string }) {
  return (
    <div style={{
      display:"flex", justifyContent:"space-between", alignItems:"center",
      padding:"14px 0", borderBottom:`1px solid #0d0d1a`,
    }}>
      <span style={{ fontFamily:"monospace", fontSize:12, color:C.muted, letterSpacing:"0.1em" }}>{label}</span>
      <div style={{ textAlign:"right" }}>
        <span style={{ fontFamily:"monospace", fontSize:14, fontWeight:700, color }}>{value}</span>
        {sub && <div style={{ fontFamily:"monospace", fontSize:10, color:C.dim, marginTop:2 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─── Stat pill ───────────────────────────────────────────────────────────────
export function StatPill({ label, value, color = C.green }: { label:string; value:string|React.ReactNode; color?:string }) {
  return (
    <div style={{
      background:"rgba(0,0,0,0.8)", border:`1px solid ${color}33`,
      padding:"10px 20px", fontFamily:"monospace",
      clipPath:"polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)",
    }}>
      <div style={{ fontSize:9, color:C.dim, letterSpacing:"0.15em", marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:16, fontWeight:700, color }}>{value}</div>
    </div>
  );
}

// ─── Tag badge ──────────────────────────────────────────────────────────────
export function Tag({ label, color = C.purple }: { label:string; color?:string }) {
  return (
    <span style={{
      fontFamily:"monospace", fontSize:9, fontWeight:700,
      padding:"3px 8px", letterSpacing:"0.1em",
      background:`${color}11`, color:`${color}cc`,
      border:`1px solid ${color}33`,
    }}>{label}</span>
  );
}

// ─── Section header ─────────────────────────────────────────────────────────
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily:"monospace", fontSize:10, color:C.dim,
      letterSpacing:"0.3em", marginBottom:48, textAlign:"center",
    }}>
      ═══ {children} ═══
    </div>
  );
}

// ─── Live dot ───────────────────────────────────────────────────────────────
export function LiveDot({ color = C.green }: { color?:string }) {
  return (
    <span style={{
      display:"inline-block", width:6, height:6, borderRadius:"50%",
      background:color, boxShadow:`0 0 6px ${color}`,
      animation:"aep-pulse 2s infinite",
    }} />
  );
}
