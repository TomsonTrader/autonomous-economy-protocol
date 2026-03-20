"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  AepStyles, Scanlines, AepNav, AepFooter, HUDPanel, GlitchText, C,
  btnPrimary, btnSecondary, btnGold, LiveDot, DataRow, Tag,
} from "../../_components";

const API = process.env.NEXT_PUBLIC_API_URL ??
  "https://autonomous-economy-protocol-production.up.railway.app";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AgentProfile {
  address: string;
  registered: boolean;
  registeredAt: number;
  referrer: string | null;
  referralChain: { l1: string | null; l2: string | null };
  earnings: {
    totalUsdcEarned: string;
    directRecruits: number;
    level2Recruits: number;
    totalNetworkSize: number;
  };
  recruits: {
    direct: string[];
    level2: string[];
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(addr: string) {
  return addr.slice(0, 8) + "…" + addr.slice(-6);
}

function fmtDate(ts: number) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

// ── Avatar — deterministic color from address ────────────────────────────────
function AgentAvatar({ address, size = 80 }: { address: string; size?: number }) {
  const colors = [C.purple, C.green, C.gold, C.cyan, C.orange, C.red, "#FF00FF", "#00FFFF"];
  const hash = address.slice(2).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const bg1 = colors[hash % colors.length];
  const bg2 = colors[(hash * 7 + 3) % colors.length];
  const shape = hash % 3;

  return (
    <div style={{
      width: size, height: size, position: "relative", flexShrink: 0,
      background: `linear-gradient(135deg, ${bg1}, ${bg2})`,
      clipPath: shape === 0
        ? "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)"
        : shape === 1
        ? "polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%)"
        : "none",
      borderRadius: shape === 2 ? "50%" : 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: `0 0 30px ${bg1}55`,
    }}>
      <span style={{ fontFamily: "monospace", fontWeight: 900, fontSize: size * 0.35, color: "#000a" }}>
        {address.slice(2, 4).toUpperCase()}
      </span>
    </div>
  );
}

// ── Network tree ──────────────────────────────────────────────────────────────
function NetworkTree({ profile }: { profile: AgentProfile }) {
  const l1s = profile.recruits.direct.slice(0, 8);
  const l2s = profile.recruits.level2.slice(0, 8);
  const moreL1 = profile.earnings.directRecruits - l1s.length;
  const moreL2 = profile.earnings.level2Recruits - l2s.length;

  return (
    <div>
      <div style={{ fontFamily: "monospace", fontSize: 10, color: C.dim, letterSpacing: "0.2em", marginBottom: 20 }}>
        ◈ REFERRAL NETWORK TREE
      </div>

      {/* Root */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <AgentAvatar address={profile.address} size={36} />
        <div>
          <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: C.gold }}>
            {fmt(profile.address)}
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 10, color: C.dim }}>YOU (ROOT)</div>
        </div>
        <div style={{ marginLeft: "auto", fontFamily: "monospace", fontSize: 11, color: C.green }}>
          ${parseFloat(profile.earnings.totalUsdcEarned).toFixed(2)} earned
        </div>
      </div>

      {/* L1 */}
      {l1s.length > 0 && (
        <div style={{ marginLeft: 24, borderLeft: `1px solid ${C.purple}33`, paddingLeft: 20 }}>
          <div style={{ fontFamily: "monospace", fontSize: 9, color: C.purple, letterSpacing: "0.15em", marginBottom: 10 }}>
            LEVEL 1 — DIRECT RECRUITS ({profile.earnings.directRecruits}) · $12.50 each
          </div>
          {l1s.map(addr => (
            <Link key={addr} href={`/super-agent/${addr}`} style={{ textDecoration: "none" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
                padding: "8px 12px", background: `${C.purple}06`, border: `1px solid ${C.purple}15`,
              }}>
                <AgentAvatar address={addr} size={24} />
                <span style={{ fontFamily: "monospace", fontSize: 11, color: C.muted }}>{fmt(addr)}</span>
                <span style={{ marginLeft: "auto", fontFamily: "monospace", fontSize: 10, color: C.purple }}>→ profile</span>
              </div>
            </Link>
          ))}
          {moreL1 > 0 && (
            <div style={{ fontFamily: "monospace", fontSize: 10, color: C.dim, padding: "6px 12px" }}>
              + {moreL1} more L1 recruits
            </div>
          )}

          {/* L2 */}
          {l2s.length > 0 && (
            <div style={{ marginLeft: 24, borderLeft: `1px solid ${C.cyan}22`, paddingLeft: 20, marginTop: 12 }}>
              <div style={{ fontFamily: "monospace", fontSize: 9, color: C.cyan, letterSpacing: "0.15em", marginBottom: 10 }}>
                LEVEL 2 — THEIR RECRUITS ({profile.earnings.level2Recruits}) · $5.00 each
              </div>
              {l2s.map(addr => (
                <Link key={addr} href={`/super-agent/${addr}`} style={{ textDecoration: "none" }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8, marginBottom: 6,
                    padding: "6px 10px", background: `${C.cyan}06`, border: `1px solid ${C.cyan}15`,
                  }}>
                    <AgentAvatar address={addr} size={20} />
                    <span style={{ fontFamily: "monospace", fontSize: 10, color: C.muted }}>{fmt(addr)}</span>
                    <span style={{ marginLeft: "auto", fontFamily: "monospace", fontSize: 9, color: C.cyan }}>→ profile</span>
                  </div>
                </Link>
              ))}
              {moreL2 > 0 && (
                <div style={{ fontFamily: "monospace", fontSize: 10, color: C.dim, padding: "4px 10px" }}>
                  + {moreL2} more L2 recruits
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {l1s.length === 0 && (
        <div style={{
          marginLeft: 24, padding: "16px 20px",
          border: `1px dashed ${C.dim}55`,
          fontFamily: "monospace", fontSize: 11, color: C.dim, textAlign: "center",
        }}>
          No recruits yet — share the referral link to start earning
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SuperAgentProfilePage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    fetch(`${API}/api/super-agent/profile/${address}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null; }
        return r.json();
      })
      .then(d => {
        if (d) setProfile(d.profile ?? null);
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [address]);

  const referralLink = typeof window !== "undefined"
    ? `${window.location.origin}/super-agent?ref=${address}`
    : `https://aepprotocol.xyz/super-agent?ref=${address}`;

  function copyLink() {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "monospace" }}>
      <AepStyles />
      <Scanlines />
      <AepNav />

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "88px 24px 80px" }}>

        {loading && (
          <div style={{ textAlign: "center", padding: "120px 0", color: C.dim }}>
            <div style={{ fontSize: 32, marginBottom: 16, animation: "aep-spin 2s linear infinite", display: "inline-block" }}>
              ◈
            </div>
            <div style={{ fontSize: 12, letterSpacing: "0.2em" }}>LOADING PROFILE…</div>
          </div>
        )}

        {!loading && notFound && (
          <div style={{ textAlign: "center", padding: "120px 0" }}>
            <HUDPanel style={{ padding: 60, maxWidth: 500, margin: "0 auto" }} accent={C.red}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⚠</div>
              <div style={{ fontWeight: 700, fontSize: 18, color: C.red, marginBottom: 12 }}>
                NOT REGISTERED
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 24, lineHeight: 1.7 }}>
                Address <span style={{ color: C.text }}>{fmt(address)}</span> is not registered as a Super Agent.
              </div>
              <Link href="/super-agent" style={btnGold}>
                REGISTER NOW →
              </Link>
            </HUDPanel>
          </div>
        )}

        {!loading && profile && (
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24 }}>

            {/* LEFT COLUMN — Identity card */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Avatar + identity */}
              <HUDPanel accent={C.gold} style={{ padding: 28, textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                  <AgentAvatar address={profile.address} size={88} />
                </div>
                <div style={{
                  fontWeight: 900, fontSize: 15, color: C.gold, marginBottom: 6,
                  wordBreak: "break-all", lineHeight: 1.4,
                }}>
                  {fmt(profile.address)}
                </div>
                <div style={{ fontSize: 9, color: C.dim, letterSpacing: "0.15em", marginBottom: 16 }}>
                  SUPER AGENT
                </div>

                <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 20 }}>
                  <Tag label="VERIFIED" color={C.green} />
                  <Tag label="BASE MAINNET" color={C.purple} />
                </div>

                <div style={{ fontSize: 11, color: C.muted, marginBottom: 20, lineHeight: 1.7 }}>
                  Registered since<br />
                  <span style={{ color: C.text, fontWeight: 700 }}>{fmtDate(profile.registeredAt)}</span>
                </div>

                <a
                  href={`https://basescan.org/address/${profile.address}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ ...btnSecondary, fontSize: 10, padding: "8px 16px", justifyContent: "center", display: "flex" }}
                >
                  VIEW ON BASESCAN ↗
                </a>
              </HUDPanel>

              {/* Referral chain */}
              <HUDPanel style={{ padding: 24 }}>
                <div style={{ fontSize: 9, color: C.dim, letterSpacing: "0.15em", marginBottom: 16 }}>
                  REFERRAL CHAIN
                </div>
                {profile.referralChain.l2 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 9, color: C.dim, marginBottom: 4 }}>L2 SPONSOR</div>
                    <Link href={`/super-agent/${profile.referralChain.l2}`} style={{ textDecoration: "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: `${C.cyan}06`, border: `1px solid ${C.cyan}22` }}>
                        <AgentAvatar address={profile.referralChain.l2} size={20} />
                        <span style={{ fontSize: 10, color: C.cyan }}>{fmt(profile.referralChain.l2)}</span>
                      </div>
                    </Link>
                  </div>
                )}
                {profile.referralChain.l1 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 9, color: C.dim, marginBottom: 4 }}>L1 RECRUITER</div>
                    <Link href={`/super-agent/${profile.referralChain.l1}`} style={{ textDecoration: "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: `${C.purple}06`, border: `1px solid ${C.purple}22` }}>
                        <AgentAvatar address={profile.referralChain.l1} size={20} />
                        <span style={{ fontSize: 10, color: C.purple }}>{fmt(profile.referralChain.l1)}</span>
                      </div>
                    </Link>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 9, color: C.dim, marginBottom: 4 }}>THIS AGENT</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: `${C.gold}06`, border: `1px solid ${C.gold}22` }}>
                    <AgentAvatar address={profile.address} size={20} />
                    <span style={{ fontSize: 10, color: C.gold }}>{fmt(profile.address)}</span>
                  </div>
                </div>
                {!profile.referralChain.l1 && (
                  <div style={{ fontSize: 9, color: C.dim, marginTop: 8, textAlign: "center" }}>
                    Genesis agent — no recruiter
                  </div>
                )}
              </HUDPanel>

              {/* Share referral link */}
              <HUDPanel accent={C.green} style={{ padding: 24 }}>
                <div style={{ fontSize: 9, color: C.dim, letterSpacing: "0.15em", marginBottom: 12 }}>
                  REFERRAL LINK
                </div>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 12, lineHeight: 1.6 }}>
                  Anyone who registers with this link gives this agent <span style={{ color: C.green }}>$12.50 USDC</span>.
                </div>
                <div style={{
                  background: "#050510", border: `1px solid ${C.green}22`,
                  padding: "10px 12px", fontSize: 9, color: C.green,
                  wordBreak: "break-all", marginBottom: 12, lineHeight: 1.6,
                }}>
                  {referralLink}
                </div>
                <button style={{ ...btnPrimary, width: "100%", justifyContent: "center", fontSize: 11 }}
                  onClick={copyLink}>
                  {copied ? "✓ COPIED!" : "COPY REFERRAL LINK"}
                </button>
              </HUDPanel>
            </div>

            {/* RIGHT COLUMN */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Earnings stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                {[
                  { label: "TOTAL USDC EARNED", value: `$${parseFloat(profile.earnings.totalUsdcEarned).toFixed(2)}`, color: C.gold, icon: "💰" },
                  { label: "NETWORK SIZE", value: profile.earnings.totalNetworkSize.toString(), color: C.purple, icon: "🌐", sub: "total agents" },
                  { label: "L1 DIRECT RECRUITS", value: profile.earnings.directRecruits.toString(), color: C.green, icon: "👥", sub: "$12.50 each" },
                  { label: "L2 RECRUITS", value: profile.earnings.level2Recruits.toString(), color: C.cyan, icon: "🔗", sub: "$5.00 each" },
                ].map(({ label, value, color, icon, sub }) => (
                  <HUDPanel key={label} accent={color} style={{ padding: "20px 24px" }}>
                    <div style={{ fontSize: 10, color: C.dim, letterSpacing: "0.1em", marginBottom: 8 }}>
                      {icon} {label}
                    </div>
                    <div style={{ fontWeight: 900, fontSize: 32, color, lineHeight: 1, textShadow: `0 0 20px ${color}66` }}>
                      {value}
                    </div>
                    {sub && <div style={{ fontSize: 9, color: C.dim, marginTop: 6 }}>{sub}</div>}
                  </HUDPanel>
                ))}
              </div>

              {/* Potential earnings indicator */}
              <HUDPanel accent={C.gold} style={{ padding: 24 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 9, color: C.dim, letterSpacing: "0.15em", marginBottom: 8 }}>
                      EARNING POWER
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
                      If each L1 recruit brings in 5 more agents, this agent could earn<br />
                      <span style={{ color: C.gold, fontWeight: 700, fontSize: 16 }}>
                        ${((profile.earnings.directRecruits * 12.5) + (profile.earnings.directRecruits * 5 * 5.0)).toFixed(2)} additional USDC
                      </span>{" "}
                      <span style={{ color: C.dim, fontSize: 10 }}>(projected L2)</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 40 }}>📈</div>
                </div>
              </HUDPanel>

              {/* Network tree */}
              <HUDPanel style={{ padding: 28 }}>
                <NetworkTree profile={profile} />
              </HUDPanel>

              {/* CTA — register with this agent as referrer */}
              <HUDPanel accent={C.purple} style={{ padding: 28, textAlign: "center" }}>
                <div style={{ fontSize: 14, color: C.text, fontWeight: 700, marginBottom: 8 }}>
                  JOIN THEIR NETWORK
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 20, lineHeight: 1.7 }}>
                  Register as a Super Agent with <span style={{ color: C.gold }}>{fmt(profile.address)}</span> as your referrer.
                  They earn <span style={{ color: C.gold }}>$12.50</span>, you start earning too.
                </div>
                <Link
                  href={`/super-agent?ref=${profile.address}`}
                  style={{ ...btnGold, display: "inline-flex" }}
                >
                  ⚡ REGISTER WITH THIS REFERRER
                </Link>
              </HUDPanel>
            </div>
          </div>
        )}
      </div>

      <AepFooter />
    </div>
  );
}
