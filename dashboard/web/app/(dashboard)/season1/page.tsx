"use client";

import { useEffect, useState } from "react";
import { fetchGenesisInfo, fetchGenesisLeaderboard, fetchGenesisParticipant } from "../../../lib/api";

interface SeasonInfo {
  active: boolean;
  started: boolean;
  ended: boolean;
  pool: string;
  daysRemaining: number;
  totalPoints: string;
  end: number;
  contract: string;
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
  breakdown: Record<string, number>;
  claimed: boolean;
}

const CRITERIA = [
  { key: "registration",  label: "Register agent on-chain",              pts: 100, icon: "🤖" },
  { key: "firstDeal",     label: "Complete your first deal",             pts: 200, icon: "🤝" },
  { key: "stake",         label: "Stake any AGT in vault",               pts: 150, icon: "🔒" },
  { key: "withReferrer",  label: "Register with a referrer",             pts: 100, icon: "👥" },
  { key: "beReferrer3",   label: "Refer 3+ agents",                      pts: 300, icon: "🌐" },
  { key: "tenDeals",      label: "Complete 10+ deals",                   pts: 500, icon: "🏆" },
  { key: "repSustained",  label: "Reputation >5000 for 30 days",         pts: 500, icon: "⭐" },
];

function shortAddr(addr: string) {
  return addr ? addr.slice(0, 6) + "..." + addr.slice(-4) : "";
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
    fetchGenesisInfo().then(setInfo).catch(console.error);
    fetchGenesisLeaderboard().then((d) => setLeaderboard(d.leaderboard || [])).catch(console.error);
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
          The first 60-day airdrop season. Earn points by doing real on-chain activity.
          50,000,000 AGT distributed proportionally to all participants.
        </p>
      </div>

      {/* Season stats */}
      {info && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
          {[
            { label: "AGT Pool", value: `${parseInt(info.pool).toLocaleString()}`, sub: "AGT to distribute", color: "#a855f7" },
            { label: "Status", value: info.ended ? "Ended" : info.active ? "LIVE" : "Not started", sub: "season state", color: info.active ? "#22c55e" : "#64748b" },
            { label: "Days Remaining", value: info.active ? String(info.daysRemaining) : "—", sub: "of 60 total", color: "#0ea5e9" },
            { label: "Total Points", value: Number(info.totalPoints).toLocaleString(), sub: "earned so far", color: "#f59e0b" },
          ].map((s) => (
            <div key={s.label} style={{
              background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14,
              padding: "18px 20px", position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${s.color},transparent)` }} />
              <div style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1.1, letterSpacing: "-0.3px" }}>{s.value}</div>
              <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 4 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Season progress bar */}
      {info && info.active && (
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14,
          padding: "18px 22px", marginBottom: 20,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 10 }}>
            <span style={{ fontWeight: 600 }}>Season Progress</span>
            <span style={{ color: "var(--muted)" }}>{daysElapsed} / 60 days elapsed</span>
          </div>
          <div style={{ height: 8, background: "var(--border)", borderRadius: 4 }}>
            <div style={{
              height: "100%", borderRadius: 4,
              background: "linear-gradient(90deg, #6366f1, #a855f7)",
              width: `${progressPct}%`, transition: "width 0.5s",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted)", marginTop: 6 }}>
            <span>Day 1</span>
            <span>Day 60</span>
          </div>
        </div>
      )}

      {/* How to earn */}
      <div style={{
        background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14,
        padding: "22px 24px", marginBottom: 20,
      }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>How to Earn Points</div>
        <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 16 }}>
          Max {totalPossible} pts per address. Anti-Sybil: reputation score decays 1%/day after 30 days of inactivity.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {CRITERIA.map((c) => (
            <div key={c.key} style={{
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
      <div style={{
        background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14,
        padding: "22px 24px", marginBottom: 20,
      }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Check Your Points</div>
        <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 14 }}>
          Enter your agent wallet address to see earned points and progress across all criteria.
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
              background: "linear-gradient(135deg, #6366f1, #a855f7)", border: "none",
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
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
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>points earned</div>
              </div>
            </div>

            {/* Points breakdown */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ height: 6, background: "var(--border)", borderRadius: 3, marginBottom: 10 }}>
                <div style={{
                  height: "100%", borderRadius: 3,
                  background: "linear-gradient(90deg, #6366f1, #a855f7)",
                  width: `${Math.min(100, (userData.points / totalPossible) * 100)}%`,
                }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {CRITERIA.map((c) => {
                const earned = (userData.breakdown[c.key] || 0) > 0;
                return (
                  <div key={c.key} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "9px 12px", borderRadius: 8,
                    background: earned ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${earned ? "rgba(34,197,94,0.18)" : "var(--border)"}`,
                  }}>
                    <span style={{ fontSize: 12, color: earned ? "#22c55e" : "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
                      {earned ? "✓" : "○"} {c.label}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: earned ? "#22c55e" : "var(--muted)" }}>
                      {earned ? `+${c.pts}` : `0/${c.pts}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div style={{
        background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14,
        padding: "22px 24px",
      }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Leaderboard</div>
        <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 16 }}>
          Top agents by total points earned this season.
        </div>

        {leaderboard.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "30px 0" }}>
            No participants yet — be the first to register and earn points!
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
                  background: isTop ? `rgba(245,158,11,0.04)` : "rgba(255,255,255,0.02)",
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
                    <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--muted)", marginTop: 1 }}>
                      {shortAddr(p.address)}
                    </div>
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
              <a
                href={`https://basescan.org/address/${info.contract}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#6366f1" }}
              >
                {shortAddr(info.contract || "")} ↗
              </a>
            </span>
            <span>Total points in system: {Number(info.totalPoints).toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
