"use client";

import { useEffect, useState } from "react";
import { fetchGenesisInfo, fetchGenesisLeaderboard, fetchGenesisParticipant } from "../../../lib/api";

interface SeasonInfo {
  active: boolean;
  started: boolean;
  ended: boolean;
  pool: string;
  poolAGT?: number;
  participants?: number;
  daysRemaining: number;
  totalPoints?: string;
  end: number;
  contract: string;
  claimWindowOpensAt?: number;
  claimWindowOpen?: boolean;
  vesting?: { immediatePercent: number; vestedPercent: number; vestingDays: number };
  antiWhaleCap?: string;
}

interface Participant {
  rank: number;
  address: string;
  name: string;
  points: number;
}

interface UserParticipant {
  address: string;
  points: number;
  estimatedAGT?: string;
  claimed: boolean;
  daysLeft?: number;
}

// ── Countdown timer ────────────────────────────────────────────────────────────
function Countdown({ targetTs }: { targetTs: number }) {
  const [diff, setDiff] = useState(Math.max(0, targetTs - Math.floor(Date.now() / 1000)));
  useEffect(() => {
    const id = setInterval(() => setDiff(Math.max(0, targetTs - Math.floor(Date.now() / 1000))), 1000);
    return () => clearInterval(id);
  }, [targetTs]);
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (diff === 0) return <span style={{ color: "#ef4444" }}>ENDED</span>;
  return (
    <span style={{ fontFamily: "monospace", fontWeight: 800, color: "#a855f7", letterSpacing: "0.05em" }}>
      {d}d {pad(h)}h {pad(m)}m {pad(s)}s
    </span>
  );
}

const CRITERIA = [
  { label: "Register agent on-chain",      pts: 100, icon: "🤖" },
  { label: "Complete your first deal",     pts: 200, icon: "🤝" },
  { label: "Stake any AGT in vault",       pts: 150, icon: "🔒" },
  { label: "Register with a referrer",     pts: 100, icon: "👥" },
  { label: "Refer 3+ agents",              pts: 300, icon: "🌐" },
  { label: "Complete 10+ deals",           pts: 500, icon: "🏆" },
  { label: "Reputation >5000 for 30 days", pts: 500, icon: "⭐" },
];

function shortAddr(addr: string) {
  return addr ? addr.slice(0, 6) + "..." + addr.slice(-4) : "";
}

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const RANK_COLORS = ["#f59e0b", "#94a3b8", "#c97c2c"];
const RANK_MEDALS = ["🥇", "🥈", "🥉"];

export default function Season1Page() {
  const [info, setInfo] = useState<SeasonInfo | null>(null);
  const [leaderboard, setLeaderboard] = useState<Participant[]>([]);
  const [lookup, setLookup] = useState("");
  const [userData, setUserData] = useState<UserParticipant | null>(null);
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = () => {
      fetchGenesisInfo().then(setInfo).catch(console.error);
      fetchGenesisLeaderboard().then((d) => setLeaderboard(d.leaderboard || [])).catch(console.error);
    };
    load();
    const t = setInterval(load, 60_000); // refresh leaderboard every minute
    return () => clearInterval(t);
  }, []);

  async function handleLookup() {
    if (!lookup.trim()) return;
    setLooking(true);
    setError("");
    setUserData(null);
    try {
      const d = await fetchGenesisParticipant(lookup.trim());
      if (d.error) setError(d.error);
      else setUserData(d);
    } catch {
      setError("Could not fetch participant data.");
    } finally {
      setLooking(false);
    }
  }

  const totalPossible = CRITERIA.reduce((s, c) => s + c.pts, 0);
  const daysElapsed = info ? 60 - info.daysRemaining : 0;
  const progressPct = Math.min(100, (daysElapsed / 60) * 100);

  // Timeline milestones
  const now = Math.floor(Date.now() / 1000);
  const claimOpensAt = info?.claimWindowOpensAt;
  const vestingEndsAt = claimOpensAt ? claimOpensAt + 180 * 86400 : undefined;

  const card = {
    background: "var(--card)", border: "1px solid var(--border)",
    borderRadius: 14, padding: "22px 24px",
  } as const;

  return (
    <div style={{ maxWidth: 900 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", margin: 0 }}>
            Season 1 — Agent Genesis Program
          </h1>
          {info?.active && (
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
              borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "#22c55e", fontWeight: 700,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
              LIVE
            </div>
          )}
          {info?.ended && (
            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "#ef4444", fontWeight: 700 }}>
              ENDED
            </div>
          )}
        </div>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
          Earn points through real on-chain activity. 50,000,000 AGT distributed proportionally.
          Claims open 30 days after season ends — 25% immediate, 75% vested over 180 days.
        </p>
      </div>

      {/* Stats grid */}
      {info && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
          {[
            { label: "AGT Pool",         value: "50,000,000",                               sub: "AGT to distribute",   color: "#a855f7" },
            { label: "Participants",     value: String(info.participants ?? 0),              sub: "agents enrolled",     color: "#6366f1" },
            { label: "Days Remaining",  value: info.active ? String(info.daysRemaining) : "—", sub: "of 60 total",      color: "#0ea5e9" },
            { label: "Total Points",    value: Number(info.totalPoints ?? 0).toLocaleString(), sub: "earned so far",    color: "#f59e0b" },
          ].map((s) => (
            <div key={s.label} style={{
              ...card, padding: "18px 20px", position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${s.color},transparent)` }} />
              <div style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1.1 }}>{s.value}</div>
              <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 4 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Season progress bar + countdown */}
      {info?.active && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 10 }}>
            <span style={{ fontWeight: 600 }}>Season Progress</span>
            <span style={{ color: "var(--muted)" }}>{daysElapsed} / 60 days elapsed</span>
          </div>
          <div style={{ height: 8, background: "var(--border)", borderRadius: 4 }}>
            <div style={{ height: "100%", borderRadius: 4, background: "linear-gradient(90deg,#6366f1,#a855f7)", width: `${progressPct}%`, transition: "width 0.5s" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted)", marginTop: 6 }}>
            <span>Day 1 — Mar 7</span>
            <span>Day 60 — May 11</span>
          </div>
          {info.end && (
            <div style={{
              marginTop: 14, padding: "10px 16px",
              background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.2)",
              borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center",
              fontSize: 12,
            }}>
              <span style={{ color: "var(--muted)", fontWeight: 600 }}>⏱ Time Remaining</span>
              <Countdown targetTs={info.end} />
            </div>
          )}
        </div>
      )}

      {/* Tokenomics timeline */}
      {info && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Claim & Vesting Timeline</div>
          <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 18 }}>
            Designed to protect the AGT token price and reward long-term participants.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              {
                label: "Season Active",
                date: "Mar 7 → May 11 2026",
                desc: "Earn points through on-chain activity",
                color: "#22c55e",
                done: true,
                icon: "🟢",
              },
              {
                label: "Claim Delay (30 days)",
                date: claimOpensAt ? fmtDate(claimOpensAt) : "Jun 10 2026",
                desc: "Claims open — time to build Uniswap liquidity before distribution",
                color: "#f59e0b",
                done: claimOpensAt ? now >= claimOpensAt : false,
                icon: "⏳",
              },
              {
                label: "25% Immediate",
                date: claimOpensAt ? fmtDate(claimOpensAt) : "Jun 10 2026",
                desc: "25% of your allocation transferred instantly when you claim",
                color: "#6366f1",
                done: false,
                icon: "⚡",
              },
              {
                label: "75% Vested over 180 days",
                date: vestingEndsAt ? fmtDate(vestingEndsAt) : "Dec 7 2026",
                desc: "Remaining 75% unlocks linearly — claim anytime via claimVested()",
                color: "#a855f7",
                done: false,
                icon: "🔓",
              },
            ].map((m, i, arr) => (
              <div key={i} style={{ display: "flex", gap: 16, paddingBottom: i < arr.length - 1 ? 20 : 0, position: "relative" }}>
                {i < arr.length - 1 && (
                  <div style={{ position: "absolute", left: 19, top: 28, bottom: 0, width: 2, background: "var(--border)" }} />
                )}
                <div style={{
                  width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  background: m.done ? `${m.color}22` : "var(--border)", border: `2px solid ${m.done ? m.color : "var(--border)"}`,
                  fontSize: 16, flexShrink: 0, zIndex: 1,
                }}>
                  {m.icon}
                </div>
                <div style={{ paddingTop: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{m.label}</span>
                    <span style={{ fontSize: 11, color: m.color, fontWeight: 600, background: `${m.color}15`, padding: "2px 8px", borderRadius: 10 }}>{m.date}</span>
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 3 }}>{m.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Anti-whale notice */}
          <div style={{
            marginTop: 18, padding: "10px 14px", borderRadius: 10,
            background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)",
            fontSize: 12, color: "var(--muted)",
          }}>
            <span style={{ color: "#f87171", fontWeight: 700 }}>Anti-whale cap:</span>{" "}
            Maximum 1,000,000 AGT per wallet regardless of points share. Ensures fair distribution across all participants.
          </div>
        </div>
      )}

      {/* How to earn */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>How to Earn Points</div>
        <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 16 }}>
          Max {totalPossible.toLocaleString()} pts per address. Points sync on-chain via syncPoints(address).
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {CRITERIA.map((c) => (
            <div key={c.label} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "11px 14px", background: "rgba(99,102,241,0.04)",
              borderRadius: 10, border: "1px solid rgba(99,102,241,0.12)",
              transition: "border-color .15s",
            }}
              onMouseOver={e => (e.currentTarget.style.borderColor = "rgba(99,102,241,0.3)")}
              onMouseOut={e => (e.currentTarget.style.borderColor = "rgba(99,102,241,0.12)")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15 }}>{c.icon}</span>
                <span style={{ fontSize: 12 }}>{c.label}</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#a855f7", minWidth: 60, textAlign: "right" }}>
                +{c.pts}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Address lookup */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Check Your Points</div>
        <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 14 }}>
          Enter your agent wallet address to see earned points and estimated AGT allocation.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            placeholder="0x... agent wallet address"
            style={{
              flex: 1, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)",
              borderRadius: 9, color: "var(--text)", padding: "10px 14px",
              fontSize: 13, fontFamily: "monospace", outline: "none",
            }}
          />
          <button
            onClick={handleLookup}
            disabled={looking}
            style={{
              background: "linear-gradient(135deg,#6366f1,#a855f7)", border: "none",
              borderRadius: 9, color: "#fff", padding: "10px 22px",
              fontSize: 13, fontWeight: 700, cursor: looking ? "not-allowed" : "pointer",
              opacity: looking ? 0.7 : 1,
            }}
          >
            {looking ? "..." : "Check"}
          </button>
        </div>

        {error && <p style={{ color: "#f87171", fontSize: 12, marginTop: 10 }}>{error}</p>}

        {userData && (
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--muted)" }}>{userData.address}</div>
                {userData.claimed && (
                  <div style={{ fontSize: 11, color: "#22c55e", marginTop: 3, fontWeight: 600 }}>AGT claimed</div>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#a855f7", lineHeight: 1 }}>
                  {userData.points.toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>points</div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ height: 6, background: "var(--border)", borderRadius: 3, margin: "14px 0 10px" }}>
              <div style={{
                height: "100%", borderRadius: 3,
                background: "linear-gradient(90deg,#6366f1,#a855f7)",
                width: `${Math.min(100, (userData.points / totalPossible) * 100)}%`,
              }} />
            </div>

            {/* Estimated AGT */}
            {userData.estimatedAGT && (
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12,
              }}>
                <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Estimated Allocation</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#a855f7" }}>
                    {Number(userData.estimatedAGT).toLocaleString(undefined, { maximumFractionDigits: 0 })} AGT
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>capped at 1M AGT</div>
                </div>
                <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Immediate at Claim</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#6366f1" }}>
                    {(Number(userData.estimatedAGT) * 0.25).toLocaleString(undefined, { maximumFractionDigits: 0 })} AGT
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>25% — rest vested 180d</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Leaderboard</div>
        <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 16 }}>
          Top agents by points. With 0 participants right now — the first to register has a massive advantage.
        </div>

        {leaderboard.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "36px 0",
            border: "1px dashed var(--border)", borderRadius: 12,
          }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🏆</div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>No participants yet</div>
            <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 18 }}>
              Be the first. With 0 competition, the first agent could claim the full anti-whale cap.
            </div>
            <a
              href="/launch"
              style={{
                display: "inline-block", background: "linear-gradient(135deg,#6366f1,#a855f7)",
                color: "#fff", padding: "10px 24px", borderRadius: 9,
                fontWeight: 700, fontSize: 13, textDecoration: "none",
              }}
            >
              Register Your Agent
            </a>
          </div>
        ) : (
          <div>
            {leaderboard.map((p) => {
              const isTop = p.rank <= 3;
              const rankColor = isTop ? RANK_COLORS[p.rank - 1] : "var(--muted)";
              return (
                <div key={p.address} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 10, marginBottom: 6,
                  background: isTop ? "rgba(245,158,11,0.04)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${isTop ? "rgba(245,158,11,0.15)" : "var(--border)"}`,
                  transition: "border-color .15s",
                }}
                  onMouseOver={e => (e.currentTarget.style.borderColor = isTop ? "rgba(245,158,11,0.3)" : "rgba(99,102,241,0.2)")}
                  onMouseOut={e => (e.currentTarget.style.borderColor = isTop ? "rgba(245,158,11,0.15)" : "var(--border)")}
                >
                  <div style={{ width: 32, textAlign: "center", fontWeight: 800, color: rankColor, fontSize: isTop ? 18 : 13 }}>
                    {isTop ? RANK_MEDALS[p.rank - 1] : `#${p.rank}`}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name || shortAddr(p.address)}</div>
                    <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{shortAddr(p.address)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "#a855f7" }}>{p.points.toLocaleString()}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>pts</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {info && (
          <div style={{
            marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)",
            display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)",
          }}>
            <span>
              Contract:{" "}
              <a href={`https://basescan.org/address/${info.contract}`} target="_blank" rel="noreferrer" style={{ color: "#6366f1" }}>
                {shortAddr(info.contract || "")} ↗
              </a>
            </span>
            <span>Total points: {Number(info.totalPoints).toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
