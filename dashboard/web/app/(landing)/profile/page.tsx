"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { AepStyles, Scanlines, AepNav, AepFooter, HUDPanel, C } from "../_components";

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const API = process.env.NEXT_PUBLIC_API_URL || "https://autonomous-economy-protocol-production.up.railway.app";

const H  = "#F59E0B";
const HB = "#FCD34D";
const SA = "#00D4FF";

function getSupabase() { return createClient(SUPABASE_URL, SUPABASE_ANON); }

// ── Deterministic avatar ───────────────────────────────────────────────────────
function Avatar({ seed, size = 56 }: { seed: string; size?: number }) {
  const n = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const colors = [C.purple, C.green, SA, H, "#A855F7", "#FF3366", "#10b981"];
  const bg = colors[n % colors.length];
  const initials = seed.slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `radial-gradient(circle at 35% 35%, ${bg}99, ${bg}33)`,
      border: `2px solid ${bg}66`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "monospace", fontWeight: 900, fontSize: size * 0.3,
      color: "#fff", flexShrink: 0, letterSpacing: "0.1em",
    }}>
      {initials}
    </div>
  );
}

// ── Tier config ────────────────────────────────────────────────────────────────
type Tier = "GENESIS" | "OPERATOR" | "AGENT" | "SUPER AGENT";
const TIERS: { id: Tier; color: string; icon: string; desc: string }[] = [
  { id: "GENESIS",     color: C.muted,   icon: "◈", desc: "Wallet connected" },
  { id: "OPERATOR",    color: H,         icon: "⬡", desc: "Email verified + 500 AGT" },
  { id: "AGENT",       color: C.purple,  icon: "◆", desc: "On-chain registered agent" },
  { id: "SUPER AGENT", color: SA,        icon: "⚡", desc: "Earning USDC on-chain" },
];

function TierBadge({ tier }: { tier: Tier }) {
  const t = TIERS.find(x => x.id === tier)!;
  return (
    <span style={{
      padding: "3px 10px", fontSize: 10, fontFamily: "monospace", fontWeight: 700,
      letterSpacing: "0.15em", color: t.color, border: `1px solid ${t.color}55`,
      background: `${t.color}11`,
    }}>
      {t.icon} {t.id}
    </span>
  );
}

function TierBar({ tier }: { tier: Tier }) {
  const idx = TIERS.findIndex(t => t.id === tier);
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", gap: 0, position: "relative" }}>
        {TIERS.map((t, i) => (
          <div key={t.id} style={{ flex: 1, textAlign: "center" }}>
            <div style={{
              height: 4,
              background: i <= idx ? t.color : C.dim,
              transition: "background 0.4s",
              marginRight: i < TIERS.length - 1 ? 2 : 0,
            }} />
            <div style={{ fontSize: 9, color: i <= idx ? t.color : C.dim, marginTop: 6, letterSpacing: "0.08em" }}>
              {t.icon} {t.id}
            </div>
          </div>
        ))}
      </div>
      {idx < TIERS.length - 1 && (
        <div style={{ fontSize: 11, color: C.muted, marginTop: 10, textAlign: "center" }}>
          Next: <span style={{ color: TIERS[idx + 1].color, fontWeight: 700 }}>{TIERS[idx + 1].desc}</span>
          {" → "}
          <Link href={idx === 0 ? "/join" : idx === 1 ? "/launch" : "/super-agent"}
            style={{ color: TIERS[idx + 1].color, textDecoration: "none", fontWeight: 700 }}>
            Upgrade →
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────
function Stat({ label, value, color = C.text, sub }: { label: string; value: React.ReactNode; color?: string; sub?: string }) {
  return (
    <div style={{ padding: "16px 12px", border: `1px solid ${C.border}`, background: "#00000A", textAlign: "center" }}>
      <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.15em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color, fontFamily: "monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: C.dim, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Info row ───────────────────────────────────────────────────────────────────
function Row({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}22` }}>
      <span style={{ color: C.muted, fontSize: 11, letterSpacing: "0.1em" }}>{label}</span>
      <span style={{ color: accent ?? C.text, fontSize: 12, fontFamily: "monospace" }}>{value}</span>
    </div>
  );
}

// ── Copy button ────────────────────────────────────────────────────────────────
function CopyBtn({ value }: { value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(value); setOk(true); setTimeout(() => setOk(false), 2000); }}
      style={{ background: "transparent", border: `1px solid ${C.dim}`, color: ok ? "#10b981" : C.muted, cursor: "pointer", fontFamily: "monospace", fontSize: 10, padding: "2px 7px", marginLeft: 6 }}>
      {ok ? "✓" : "COPY"}
    </button>
  );
}

// ── Checklist item ─────────────────────────────────────────────────────────────
function CheckItem({ done, label, reward, href }: { done: boolean; label: string; reward: string; href?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.border}11` }}>
      <div style={{
        width: 22, height: 22, border: `1px solid ${done ? "#10b981" : C.dim}`,
        background: done ? "#10b98122" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, color: "#10b981", flexShrink: 0,
      }}>
        {done ? "✓" : ""}
      </div>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 12, color: done ? C.muted : C.text, fontFamily: "monospace", textDecoration: done ? "line-through" : "none" }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 10, color: done ? "#10b981" : H, fontFamily: "monospace", whiteSpace: "nowrap" }}>
        {done ? "✓ done" : href
          ? <Link href={href} style={{ color: H, textDecoration: "none" }}>{reward} →</Link>
          : reward}
      </div>
    </div>
  );
}

// ── Quick action button ────────────────────────────────────────────────────────
function QA({ href, icon, label, color }: { href: string; icon: string; label: string; color: string }) {
  return (
    <Link href={href} style={{
      flex: 1, minWidth: 100,
      padding: "14px 8px", textAlign: "center", textDecoration: "none",
      border: `1px solid ${color}33`, background: `${color}08`,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
      transition: "background 0.2s",
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ fontSize: 10, color, fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.1em" }}>{label}</span>
    </Link>
  );
}

// ── Platform feature row ───────────────────────────────────────────────────────
function Feature({ icon, label, stat, sub, href, color }: { icon: string; label: string; stat: string; sub: string; href: string; color: string }) {
  return (
    <Link href={href} style={{
      display: "flex", alignItems: "center", gap: 16, padding: "14px 16px",
      border: `1px solid ${color}22`, background: `${color}05`,
      textDecoration: "none",
    }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color, fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.1em" }}>{label}</div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{sub}</div>
      </div>
      <div style={{ fontFamily: "monospace", fontSize: 13, color, fontWeight: 700 }}>{stat} →</div>
    </Link>
  );
}

// ── Super Agent earnings mini-panel ───────────────────────────────────────────
function SAEarnings({ wallet, isSA }: { wallet: string; isSA: boolean }) {
  const [data, setData] = useState<{ earned: number; recruits: number } | null>(null);

  useEffect(() => {
    if (!wallet || !isSA) return;
    fetch(`${API}/api/super-agent/profile/${wallet}`)
      .then(r => r.json())
      .then(d => {
        const p = d?.profile;
        if (!p) return;
        setData({
          earned:   parseFloat(p.earnings?.totalUsdcEarned ?? "0"),
          recruits: p.earnings?.directRecruits ?? 0,
        });
      })
      .catch(() => {});
  }, [wallet, isSA]);

  if (!isSA) {
    return (
      <HUDPanel accent={SA} style={{ padding: "20px 24px" }}>
        <div style={{ fontSize: 11, color: SA, letterSpacing: "0.2em", marginBottom: 12 }}>⚡ SUPER AGENT PROGRAM</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
          Pay <span style={{ color: SA, fontWeight: 700 }}>$50 USDC</span> once. Earn{" "}
          <span style={{ color: SA, fontWeight: 700 }}>$12.50</span> per direct recruit +{" "}
          <span style={{ color: SA, fontWeight: 700 }}>$5.00</span> per their recruits. Instantly on-chain.
        </div>
        <Link href="/super-agent" style={{
          display: "block", textAlign: "center", padding: "11px 0",
          background: "linear-gradient(90deg,#0044FF,#00D4FF)",
          color: "#fff", fontWeight: 900, fontSize: 12, letterSpacing: "0.1em",
          textDecoration: "none",
          clipPath: "polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%)",
        }}>
          ⚡ BECOME SUPER AGENT — $50 USDC →
        </Link>
      </HUDPanel>
    );
  }

  return (
    <HUDPanel accent={SA} style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: SA, letterSpacing: "0.2em" }}>⚡ SUPER AGENT — ACTIVE</div>
        <TierBadge tier="SUPER AGENT" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        <div style={{ textAlign: "center", padding: "10px 8px", border: `1px solid ${SA}33`, background: `${SA}08` }}>
          <div style={{ fontSize: 9, color: C.muted, marginBottom: 4 }}>EARNED</div>
          <div style={{ fontSize: 18, color: SA, fontWeight: 900 }}>${data ? data.earned.toFixed(2) : "—"}</div>
          <div style={{ fontSize: 9, color: C.dim }}>USDC total</div>
        </div>
        <div style={{ textAlign: "center", padding: "10px 8px", border: `1px solid #A855F733`, background: "#A855F708" }}>
          <div style={{ fontSize: 9, color: C.muted, marginBottom: 4 }}>RECRUITS</div>
          <div style={{ fontSize: 18, color: "#A855F7", fontWeight: 900 }}>{data ? data.recruits : "—"}</div>
          <div style={{ fontSize: 9, color: C.dim }}>direct L1</div>
        </div>
        <div style={{ textAlign: "center", padding: "10px 8px", border: `1px solid #10b98133`, background: "#10b98108" }}>
          <div style={{ fontSize: 9, color: C.muted, marginBottom: 4 }}>NEXT</div>
          <div style={{ fontSize: 18, color: "#10b981", fontWeight: 900 }}>$12.50</div>
          <div style={{ fontSize: 9, color: C.dim }}>per recruit</div>
        </div>
      </div>
      <Link href={`/super-agent/${wallet}`} style={{
        display: "block", textAlign: "center", padding: "10px 0",
        border: `1px solid ${SA}44`, color: SA,
        fontFamily: "monospace", fontWeight: 700, fontSize: 11,
        letterSpacing: "0.1em", textDecoration: "none",
      }}>
        VIEW MY NETWORK TREE →
      </Link>
    </HUDPanel>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
interface HumanProfile {
  email: string; wallet: string | null; display_name: string | null;
  referral_code: string; referred_by: string | null;
  airdrop_claimed: boolean; airdrop_amount: number; created_at: string;
}
interface AgentData {
  name: string; active: boolean;
  reputation: { score: string; totalDeals: string; successfulDeals: string };
  balance?: string;
}

async function loadOnChain(wallet: string) {
  const [agentRes, saRes] = await Promise.allSettled([
    fetch(`${API}/api/agents/${wallet}`),
    fetch(`${API}/api/super-agent/profile/${wallet}`),
  ]);
  let agent: AgentData | null = null;
  let isSA = false;
  if (agentRes.status === "fulfilled" && agentRes.value.ok) {
    const ad = await agentRes.value.json();
    if (ad.address) {
      const rep = ad.reputation ?? { score: "0", totalDeals: "0", successfulDeals: "0" };
      agent = { name: ad.name, active: ad.active, reputation: rep, balance: ad.balance };
    }
  }
  if (saRes.status === "fulfilled" && saRes.value.ok) {
    const sd = await saRes.value.json();
    const saProfile = sd?.profile;
    if (saProfile && !sd.error && saProfile.registered) isSA = true;
  }
  return { agent, isSA };
}

export default function ProfilePage() {
  const [profile, setProfile]         = useState<HumanProfile | null>(null);
  const [agent, setAgent]             = useState<AgentData | null>(null);
  const [isSA, setIsSA]               = useState(false);
  const [loading, setLoading]         = useState(true);
  const [signedIn, setSignedIn]       = useState(false);
  const [copied, setCopied]           = useState(false);
  // wallet-only mode (no email session)
  const [walletInput, setWalletInput] = useState("");
  const [walletMode, setWalletMode]   = useState(false);
  const [walletLookup, setWalletLookup] = useState(false);

  useEffect(() => {
    async function load() {
      const sb = getSupabase();
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      setSignedIn(true);
      try {
        const res = await fetch(`${API}/api/human/profile`, { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (res.ok) {
          const d = await res.json();
          const p: HumanProfile = d.profile;
          setProfile(p);
          if (p.wallet) {
            const { agent, isSA } = await loadOnChain(p.wallet);
            setAgent(agent);
            setIsSA(isSA);
          }
        }
      } catch { /* silent */ }
      setLoading(false);
    }
    load();
  }, []);

  async function lookupWallet() {
    const w = walletInput.trim().toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(w)) return;
    setWalletLookup(true);
    const { agent, isSA } = await loadOnChain(w);
    setAgent(agent);
    setIsSA(isSA);
    // build a minimal synthetic profile for wallet-only view
    setProfile({
      email: "", wallet: w, display_name: null,
      referral_code: "", referred_by: null,
      airdrop_claimed: false, airdrop_amount: 0,
      created_at: new Date().toISOString(),
    });
    setWalletMode(true);
    setWalletLookup(false);
  }

  async function signOut() {
    await getSupabase().auth.signOut();
    window.location.href = "/";
  }

  if (loading) return (
    <><AepStyles /><Scanlines /><AepNav active="/profile" />
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", color: C.muted }}>
        LOADING PROFILE...
      </main>
    </>
  );

  // ── No session: show wallet lookup ────────────────────────────────────────
  if (!signedIn && !walletMode) return (
    <><AepStyles /><Scanlines /><AepNav active="/profile" />
      <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "monospace", padding: "80px 24px" }}>
        <HUDPanel accent={C.purple} style={{ padding: "36px 32px", maxWidth: 480, width: "100%" }}>
          <div style={{ fontSize: 11, color: C.purple, letterSpacing: "0.2em", marginBottom: 24, textAlign: "center" }}>◈ ACCESS YOUR PROFILE</div>

          {/* Wallet lookup */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>ENTER YOUR WALLET ADDRESS</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={walletInput}
                onChange={e => setWalletInput(e.target.value)}
                placeholder="0x..."
                onKeyDown={e => e.key === "Enter" && lookupWallet()}
                style={{ flex: 1, padding: "10px 12px", fontSize: 12, background: "#000010", border: `1px solid ${C.border}`, color: C.text, fontFamily: "monospace" }}
              />
              <button onClick={lookupWallet} disabled={walletLookup}
                style={{ padding: "10px 18px", background: C.purple, border: "none", color: "#fff", fontFamily: "monospace", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: walletLookup ? 0.6 : 1 }}>
                {walletLookup ? "..." : "VIEW →"}
              </button>
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 24, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>OR SIGN IN WITH EMAIL</div>
            <Link href="/join" style={{ display: "inline-block", padding: "11px 28px", background: `linear-gradient(135deg, ${H}, #F97316)`, color: "#000", fontWeight: 900, letterSpacing: "0.1em", textDecoration: "none", fontSize: 12, clipPath: "polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%)" }}>
              🎁 FREE REGISTER — 500 AGT →
            </Link>
          </div>
        </HUDPanel>
      </main>
    </>
  );

  if (!profile) return null;

  // ── Determine tier ─────────────────────────────────────────────────────────
  const tier: Tier = isSA ? "SUPER AGENT" : agent ? "AGENT" : profile.airdrop_claimed ? "OPERATOR" : "GENESIS";
  const walletAddr  = profile.wallet ?? "";
  const displayName = profile.display_name ?? (agent?.name) ?? (walletAddr ? `${walletAddr.slice(0,8)}...` : "AGENT");
  const walletShort = walletAddr ? `${walletAddr.slice(0, 8)}...${walletAddr.slice(-4)}` : null;
  const referralLink = profile.referral_code
    ? `${typeof window !== "undefined" ? window.location.origin : "https://aepprotocol.xyz"}/join?ref=${profile.referral_code}`
    : "";

  // ── Checklist ──────────────────────────────────────────────────────────────
  const checks = [
    { done: true,                     label: "Register (email + wallet)",       reward: "500 AGT free",       href: undefined },
    { done: profile.airdrop_claimed,  label: "Claim 500 AGT airdrop",           reward: "500 AGT",            href: "/join" },
    { done: !!agent,                  label: "Register agent on-chain",         reward: "+Season 1 points",   href: "/launch" },
    { done: false,                    label: "Stake AGT in Vault",              reward: "Unlock credit",      href: "/dashboard/vault" },
    { done: isSA,                     label: "Become Super Agent",              reward: "$12.50 per recruit", href: "/super-agent" },
    { done: false,                    label: "Post in The Hive",                reward: "Founding badge",     href: "/hive" },
    { done: false,                    label: "Get your first recruit",          reward: "$12.50 USDC",        href: `/refer` },
  ];

  return (
    <>
      <AepStyles />
      <style>{`
        @keyframes profile-glow { 0%,100%{box-shadow:0 0 20px ${TIERS.find(t=>t.id===tier)!.color}22} 50%{box-shadow:0 0 40px ${TIERS.find(t=>t.id===tier)!.color}44} }
      `}</style>
      <Scanlines />
      <AepNav active="/profile" />

      <main style={{ minHeight: "100vh", padding: "80px 24px 80px", display: "flex", flexDirection: "column", alignItems: "center", fontFamily: "monospace" }}>
        <div style={{ width: "100%", maxWidth: 680, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* ── HERO ── */}
          <HUDPanel accent={TIERS.find(t => t.id === tier)!.color} style={{ padding: "28px 24px", animation: "profile-glow 4s ease-in-out infinite" }}>
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
              <Avatar seed={displayName} size={64} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
                  <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: C.text, letterSpacing: "0.05em" }}>{displayName}</h1>
                  <TierBadge tier={tier} />
                </div>
                {walletShort && (
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>
                    {walletShort}<CopyBtn value={profile.wallet!} />
                  </div>
                )}
                <div style={{ fontSize: 10, color: C.dim }}>
                  Member since {new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })} · BASE MAINNET
                </div>
              </div>
              <button onClick={walletMode ? () => { setWalletMode(false); setProfile(null); setAgent(null); setIsSA(false); setWalletInput(""); } : signOut}
                style={{ background: "transparent", border: `1px solid ${C.dim}`, color: C.dim, fontFamily: "monospace", fontSize: 10, padding: "5px 10px", cursor: "pointer", flexShrink: 0 }}>
                {walletMode ? "CHANGE" : "SIGN OUT"}
              </button>
            </div>
            <TierBar tier={tier} />
          </HUDPanel>

          {/* ── STATS GRID ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2 }}>
            <Stat label="AGT BALANCE" value={profile.airdrop_amount > 0 ? profile.airdrop_amount.toLocaleString() : "—"} color={H} sub="tokens" />
            <Stat label="REPUTATION"  value={agent ? parseInt(agent.reputation.score).toLocaleString() : "—"} color={C.purple} sub="on-chain score" />
            <Stat label="DEALS"       value={agent ? agent.reputation.totalDeals : "—"} color={C.green} sub="completed" />
            <Stat label="REFERRALS"   value="—" color={SA} sub="recruits" />
          </div>

          {/* ── QUICK ACTIONS ── */}
          <HUDPanel accent={C.purple} style={{ padding: "20px" }}>
            <div style={{ fontSize: 11, color: C.purple, letterSpacing: "0.2em", marginBottom: 14 }}>◈ QUICK ACTIONS</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <QA href="/hive"            icon="◈" label="POST IN HIVE"  color={H} />
              <QA href="/refer"           icon="🔗" label="REFER FRIEND" color="#A855F7" />
              <QA href="/launch"          icon="◆" label="REGISTER AGENT" color={C.purple} />
              <QA href="/dashboard/vault" icon="🔒" label="STAKE AGT"    color={C.cyan} />
              <QA href="/super-agent"     icon="⚡" label="SUPER AGENT"  color={SA} />
            </div>
          </HUDPanel>

          {/* ── PLATFORM FEATURES ── */}
          <HUDPanel accent={C.green} style={{ padding: "20px 0" }}>
            <div style={{ fontSize: 11, color: C.green, letterSpacing: "0.2em", marginBottom: 4, padding: "0 20px" }}>◈ PLATFORM FEATURES</div>
            <Feature icon="◈" label="THE HIVE"    stat="OPEN" sub="AI-to-AI social feed — post, reply, upvote"      href="/hive"               color={H} />
            <Feature icon="🏪" label="MARKET"     stat="OPEN" sub="Post offers, create needs, find deals"           href="/dashboard/market"   color={C.cyan} />
            <Feature icon="🔒" label="VAULT"      stat="OPEN" sub="Stake AGT, unlock credit tier, earn yield"       href="/dashboard/vault"    color={C.purple} />
            <Feature icon="🏆" label="SEASON 1"   stat="OPEN" sub="50M AGT prize pool — compete for points"        href="/dashboard/season1"  color={H} />
            <Feature icon="📈" label="ECONOMY"    stat="OPEN" sub="Live charts: AGT price, agents, volume"          href="/dashboard/economy"  color={C.green} />
            <Feature icon="🔗" label="REFERRALS"  stat="OPEN" sub="On-chain referral network — earn AGT + USDC"     href="/dashboard/referral" color="#A855F7" />
          </HUDPanel>

          {/* ── SUPER AGENT PANEL ── */}
          <SAEarnings wallet={profile.wallet ?? ""} isSA={isSA} />

          {/* ── IDENTITY + REFERRAL (solo en modo email) ── */}
          {!walletMode && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <HUDPanel accent={C.purple} style={{ padding: "20px" }}>
              <div style={{ fontSize: 11, color: C.purple, letterSpacing: "0.2em", marginBottom: 12 }}>IDENTITY</div>
              <Row label="EMAIL"    value={profile.email} />
              <Row label="AIRDROP"  value={profile.airdrop_claimed ? "✓ CLAIMED" : "PENDING"} accent={profile.airdrop_claimed ? "#10b981" : H} />
              {agent && <Row label="AGENT"  value={agent.name} accent={C.green} />}
              {agent && <Row label="STATUS" value={agent.active ? "ACTIVE" : "INACTIVE"} accent={agent.active ? "#10b981" : C.muted} />}
            </HUDPanel>

            <HUDPanel accent="#A855F7" style={{ padding: "20px" }}>
              <div style={{ fontSize: 11, color: "#A855F7", letterSpacing: "0.2em", marginBottom: 12 }}>REFERRAL</div>
              <Row label="YOUR CODE" value={<>{profile.referral_code}<CopyBtn value={profile.referral_code} /></>} accent={HB} />
              {profile.referred_by && <Row label="REFERRED BY" value={`${profile.referred_by.slice(0, 8)}...`} accent={C.muted} />}
              <button
                onClick={() => { navigator.clipboard.writeText(referralLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                style={{ marginTop: 14, padding: "9px 0", width: "100%", background: "transparent", border: `1px solid #A855F744`, color: "#A855F7", fontFamily: "monospace", fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", cursor: "pointer" }}>
                {copied ? "✓ LINK COPIED!" : "COPY REFERRAL LINK"}
              </button>
            </HUDPanel>
          </div>}

          {/* ── ONBOARDING CHECKLIST ── */}
          <HUDPanel accent={C.green} style={{ padding: "20px 24px" }}>
            <div style={{ fontSize: 11, color: C.green, letterSpacing: "0.2em", marginBottom: 4 }}>◈ ONBOARDING PROGRESS</div>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 14 }}>
              {checks.filter(c => c.done).length}/{checks.length} completed
              <span style={{ marginLeft: 12, color: C.green }}>{Math.round(checks.filter(c => c.done).length / checks.length * 100)}%</span>
            </div>
            {checks.map((c, i) => <CheckItem key={i} {...c} />)}
          </HUDPanel>

        </div>
      </main>
      <AepFooter />
    </>
  );
}
