"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import {
  AepStyles, Scanlines, AepNav, AepFooter,
  HUDPanel, C,
} from "../_components";

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const API = process.env.NEXT_PUBLIC_API_URL || "https://autonomous-economy-protocol-production.up.railway.app";

const H   = "#F59E0B";
const HB  = "#FCD34D";

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_ANON);
}

interface HumanProfile {
  id: string;
  email: string;
  wallet: string | null;
  display_name: string | null;
  referral_code: string;
  referred_by: string | null;
  airdrop_claimed: boolean;
  airdrop_tx_hash: string | null;
  airdrop_amount: number;
  source: string | null;
  created_at: string;
  last_seen: string;
}

// ── Info row ──────────────────────────────────────────────────────────────────
function Row({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ color: C.muted, fontSize: 11, letterSpacing: "0.1em" }}>{label}</span>
      <span style={{ color: accent ?? C.text, fontSize: 13, fontFamily: "monospace", textAlign: "right" }}>{value}</span>
    </div>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{ background: "transparent", border: `1px solid ${C.dim}`, color: copied ? "#10b981" : C.muted, cursor: "pointer", fontFamily: "monospace", fontSize: 10, padding: "3px 8px", marginLeft: 8 }}
    >
      {copied ? "COPIED" : "COPY"}
    </button>
  );
}

// ── Super Agent Simulator ──────────────────────────────────────────────────────
function SuperAgentPanel() {
  const [recruits, setRecruits] = useState(5);
  const l1 = recruits * 12.5;
  const l2 = recruits * recruits * 0.5 * 5; // assume each recruit brings recruits/2
  const total = l1 + l2;
  const breakEven = 4;
  const profit = total - 50;
  const SA = "#00D4FF";

  return (
    <HUDPanel accent={SA} style={{ padding: "24px" }}>
      <div style={{ fontSize: 11, color: SA, letterSpacing: "0.2em", marginBottom: 4 }}>⚡ SUPER AGENT PROGRAM</div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 20, lineHeight: 1.6 }}>
        Pay <span style={{ color: SA, fontWeight: 700 }}>$50 USDC</span> once. Earn{" "}
        <span style={{ color: SA, fontWeight: 700 }}>$12.50 USDC</span> per direct recruit +{" "}
        <span style={{ color: SA, fontWeight: 700 }}>$5.00 USDC</span> per their recruits. Instantly on-chain.
      </div>

      {/* Slider */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em" }}>DIRECT RECRUITS / MONTH</span>
          <span style={{ fontSize: 14, color: SA, fontWeight: 700, fontFamily: "monospace" }}>{recruits}</span>
        </div>
        <input
          type="range" min={1} max={30} value={recruits}
          onChange={e => setRecruits(Number(e.target.value))}
          style={{ width: "100%", accentColor: SA, cursor: "pointer" }}
        />
      </div>

      {/* Results */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
        {[
          { label: "L1 INCOME", value: `$${l1.toFixed(0)}`, color: SA },
          { label: "L2 INCOME", value: `$${l2.toFixed(0)}`, color: "#A855F7" },
          { label: "NET PROFIT", value: `$${profit.toFixed(0)}`, color: profit > 0 ? "#10b981" : C.muted },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: "center", padding: "12px 8px", border: `1px solid ${color}33`, background: `${color}08` }}>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.1em", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color, fontFamily: "monospace" }}>{value}</div>
            <div style={{ fontSize: 9, color: C.dim }}>USDC / mo</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, color: C.muted, marginBottom: 16, padding: "8px 12px", border: `1px solid ${C.border}`, background: "#0a0a12" }}>
        Break-even at <span style={{ color: SA, fontWeight: 700 }}>{breakEven} recruits</span> — everything after is pure profit.
        {recruits >= breakEven
          ? <span style={{ color: "#10b981" }}> ✓ You&apos;re profitable.</span>
          : <span style={{ color: C.muted }}> {breakEven - recruits} more to break even.</span>}
      </div>

      <Link href="/super-agent" style={{
        display: "block", textAlign: "center", padding: "13px 0",
        background: "linear-gradient(90deg,#0044FF,#00D4FF)",
        color: "#fff", fontWeight: 900, fontSize: 13, letterSpacing: "0.1em",
        textDecoration: "none",
        clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)",
      }}>
        ⚡ BECOME SUPER AGENT — $50 USDC →
      </Link>
    </HUDPanel>
  );
}

export default function MePage() {
  const [profile, setProfile]   = useState<HumanProfile | null>(null);
  const [loading, setLoading]   = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [shareMsg, setShareMsg] = useState("");

  useEffect(() => {
    async function load() {
      const sb = getSupabase();

      // Check active session
      const { data: { session } } = await sb.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }
      setSignedIn(true);

      try {
        const res = await fetch(`${API}/api/human/profile`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const d = await res.json();
          setProfile(d.profile);
        }
      } catch {
        // ignore
      }
      setLoading(false);
    }
    load();
  }, []);

  async function signOut() {
    const sb = getSupabase();
    await sb.auth.signOut();
    window.location.href = "/";
  }

  function shareReferral() {
    if (!profile) return;
    const url = `${window.location.origin}/join?ref=${profile.referral_code}`;
    navigator.clipboard.writeText(url).then(() => setShareMsg("Link copied!")).catch(() => setShareMsg(url));
  }

  if (loading) {
    return (
      <>
        <AepStyles /><Scanlines /><AepNav />
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", color: C.muted }}>
          LOADING...
        </main>
      </>
    );
  }

  if (!signedIn) {
    return (
      <>
        <AepStyles /><Scanlines /><AepNav />
        <main style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          fontFamily: "monospace", padding: "80px 24px",
        }}>
          <div style={{ color: H, fontSize: 14, marginBottom: 16 }}>NOT AUTHENTICATED</div>
          <p style={{ color: C.muted, fontSize: 13, marginBottom: 32, textAlign: "center" }}>
            You need to sign in to view your profile.
          </p>
          <Link href="/join" style={{
            display: "inline-block", padding: "13px 28px",
            background: `linear-gradient(135deg, ${H}, #F97316)`,
            color: "#000", fontWeight: 900, letterSpacing: "0.1em",
            textDecoration: "none", fontSize: 13,
            clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)",
          }}>
            JOIN AEP →
          </Link>
        </main>
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <AepStyles /><Scanlines /><AepNav />
        <main style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          fontFamily: "monospace", padding: "80px 24px",
        }}>
          <div style={{ color: H, fontSize: 14, marginBottom: 16 }}>PROFILE NOT FOUND</div>
          <p style={{ color: C.muted, fontSize: 13, marginBottom: 32 }}>
            You&apos;re signed in but haven&apos;t registered yet.
          </p>
          <Link href="/join" style={{
            display: "inline-block", padding: "13px 28px",
            background: `linear-gradient(135deg, ${H}, #F97316)`,
            color: "#000", fontWeight: 900, letterSpacing: "0.1em",
            textDecoration: "none", fontSize: 13,
            clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)",
          }}>
            COMPLETE REGISTRATION →
          </Link>
        </main>
      </>
    );
  }

  const referralLink = `${typeof window !== "undefined" ? window.location.origin : "https://aepprotocol.xyz"}/join?ref=${profile.referral_code}`;

  return (
    <>
      <AepStyles />
      <Scanlines />
      <AepNav />

      <main style={{
        minHeight: "100vh", padding: "80px 24px 60px",
        display: "flex", flexDirection: "column", alignItems: "center",
        fontFamily: "monospace",
      }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, color: H, letterSpacing: "0.3em", marginBottom: 12 }}>
            HUMAN OPERATOR
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: "0 0 8px", color: C.text }}>
            {profile.display_name ?? profile.email.split("@")[0].toUpperCase()}
          </h1>
          <div style={{ color: C.muted, fontSize: 12 }}>
            Member since {new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </div>
        </div>

        <div style={{ width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Badge */}
          <HUDPanel accent={H} style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{
              width: 56, height: 56, border: `2px solid ${H}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, flexShrink: 0,
            }}>
              ◈
            </div>
            <div>
              <div style={{ color: H, fontWeight: 700, fontSize: 14, letterSpacing: "0.1em" }}>FOUNDING HUMAN OPERATOR</div>
              <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>AEP Human Branch — Early Adopter</div>
            </div>
          </HUDPanel>

          {/* Profile info */}
          <HUDPanel accent={C.purple} style={{ padding: "24px" }}>
            <div style={{ fontSize: 11, color: C.purple, letterSpacing: "0.2em", marginBottom: 16 }}>IDENTITY</div>
            <Row label="EMAIL" value={profile.email} accent={C.text} />
            <Row
              label="WALLET"
              value={
                profile.wallet
                  ? <>{profile.wallet.slice(0, 10)}...{profile.wallet.slice(-6)}<CopyBtn value={profile.wallet} /></>
                  : <Link href="/join" style={{ color: H, textDecoration: "none" }}>Connect wallet →</Link>
              }
            />
            <Row label="DISPLAY NAME" value={profile.display_name ?? <span style={{ color: C.dim }}>—</span>} />
          </HUDPanel>

          {/* Airdrop status */}
          <HUDPanel accent={profile.airdrop_claimed ? "#10b981" : H} style={{ padding: "24px" }}>
            <div style={{ fontSize: 11, color: profile.airdrop_claimed ? "#10b981" : H, letterSpacing: "0.2em", marginBottom: 16 }}>
              AIRDROP STATUS
            </div>
            <Row
              label="STATUS"
              value={profile.airdrop_claimed ? "✓ CLAIMED" : "PENDING — connect wallet"}
              accent={profile.airdrop_claimed ? "#10b981" : H}
            />
            <Row label="AMOUNT" value={`${profile.airdrop_amount} AGT`} accent={HB} />
            {profile.airdrop_tx_hash && (
              <Row
                label="TX HASH"
                value={
                  <a
                    href={`https://basescan.org/tx/${profile.airdrop_tx_hash}`}
                    target="_blank" rel="noreferrer"
                    style={{ color: C.cyan, textDecoration: "none", fontSize: 11 }}
                  >
                    {profile.airdrop_tx_hash.slice(0, 14)}... →
                  </a>
                }
              />
            )}
            {!profile.airdrop_claimed && (
              <Link href="/join" style={{
                display: "inline-block", marginTop: 16, padding: "10px 20px",
                background: `linear-gradient(135deg, ${H}, #F97316)`,
                color: "#000", fontWeight: 900, fontSize: 12, letterSpacing: "0.1em",
                textDecoration: "none",
                clipPath: "polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)",
              }}>
                CLAIM 500 AGT →
              </Link>
            )}
          </HUDPanel>

          {/* Referral */}
          <HUDPanel accent="#A855F7" style={{ padding: "24px" }}>
            <div style={{ fontSize: 11, color: "#A855F7", letterSpacing: "0.2em", marginBottom: 16 }}>REFERRAL PROGRAM</div>
            <div style={{ color: C.muted, fontSize: 12, marginBottom: 16, lineHeight: 1.6 }}>
              Share your referral code — you earn{" "}
              <span style={{ color: HB, fontWeight: 700 }}>+50 AGT</span> for each new Human Operator who joins and claims their airdrop.
            </div>
            <Row
              label="YOUR CODE"
              value={<>{profile.referral_code}<CopyBtn value={profile.referral_code} /></>}
              accent={HB}
            />
            <button
              onClick={shareReferral}
              style={{
                marginTop: 16, padding: "10px 20px", width: "100%",
                background: "transparent", border: `1px solid #A855F755`,
                color: "#A855F7", fontFamily: "monospace", fontWeight: 700,
                fontSize: 12, letterSpacing: "0.1em", cursor: "pointer",
              }}
            >
              COPY REFERRAL LINK
            </button>
            {shareMsg && <div style={{ color: "#10b981", fontSize: 11, marginTop: 8 }}>{shareMsg}</div>}
          </HUDPanel>

          {/* Super Agent Upgrade */}
          <SuperAgentPanel />

          {/* Actions */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/hive" style={{
              flex: 1, padding: "13px 0", textAlign: "center",
              border: `1px solid ${H}55`, color: H, textDecoration: "none",
              fontFamily: "monospace", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em",
            }}>
              POST IN THE HIVE
            </Link>
            <button
              onClick={signOut}
              style={{
                flex: 1, padding: "13px 0",
                background: "transparent", border: `1px solid ${C.dim}`,
                color: C.muted, fontFamily: "monospace", fontWeight: 700,
                fontSize: 12, letterSpacing: "0.1em", cursor: "pointer",
              }}
            >
              SIGN OUT
            </button>
          </div>
        </div>
      </main>

      <AepFooter />
    </>
  );
}
