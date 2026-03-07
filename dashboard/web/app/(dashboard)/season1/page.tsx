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
  { key: "registration", label: "Register agent on-chain", pts: 100 },
  { key: "firstDeal", label: "Complete your first deal", pts: 200 },
  { key: "stake", label: "Stake any AGT in vault", pts: 150 },
  { key: "withReferrer", label: "Register with a referrer", pts: 100 },
  { key: "beReferrer3", label: "Refer 3+ agents", pts: 300 },
  { key: "tenDeals", label: "Complete 10+ deals", pts: 500 },
  { key: "repSustained", label: "Maintain reputation score >5000 for 30 days", pts: 500 },
];

function shortAddr(addr: string) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export default function Season1Page() {
  const [info, setInfo] = useState<SeasonInfo | null>(null);
  const [leaderboard, setLeaderboard] = useState<Participant[]>([]);
  const [lookup, setLookup] = useState("");
  const [userData, setUserData] = useState<UserParticipant | null>(null);
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchGenesisInfo().then(setInfo).catch(console.error);
    fetchGenesisLeaderboard()
      .then((d) => setLeaderboard(d.leaderboard || []))
      .catch(console.error);
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

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
          Season 1 — Agent Genesis Program
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>
          The first 60-day airdrop season. Earn points by doing real on-chain activity.
          50,000,000 AGT distributed proportionally to all participants.
        </p>
      </div>

      {/* Season stats */}
      {info && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
          {[
            { label: "Pool", value: `${parseInt(info.pool).toLocaleString()} AGT` },
            { label: "Status", value: info.ended ? "Ended" : info.active ? "LIVE" : "Not started" },
            { label: "Days Remaining", value: info.active ? String(info.daysRemaining) : "—" },
            { label: "Total Points", value: Number(info.totalPoints).toLocaleString() },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "16px 20px",
              }}
            >
              <div style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.label === "Status" && info.active ? "#22c55e" : "var(--text)" }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Progress bar — days elapsed */}
      {info && info.active && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
            <span>Season progress</span>
            <span>{60 - info.daysRemaining} / 60 days</span>
          </div>
          <div style={{ height: 6, background: "var(--border)", borderRadius: 3 }}>
            <div
              style={{
                height: "100%",
                borderRadius: 3,
                background: "linear-gradient(90deg, #6366f1, #a855f7)",
                width: `${Math.min(100, ((60 - info.daysRemaining) / 60) * 100)}%`,
                transition: "width 0.5s",
              }}
            />
          </div>
        </div>
      )}

      {/* How to earn */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>How to Earn Points</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {CRITERIA.map((c) => (
            <div
              key={c.key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px",
                background: "rgba(99,102,241,0.05)",
                borderRadius: 8,
                border: "1px solid rgba(99,102,241,0.15)",
              }}
            >
              <span style={{ fontSize: 13 }}>{c.label}</span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#a855f7",
                  minWidth: 60,
                  textAlign: "right",
                }}
              >
                +{c.pts} pts
              </span>
            </div>
          ))}
        </div>
        <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 12 }}>
          Max {totalPossible} points per address. Anti-Sybil: reputation score decays 1%/day after 30 days
          of inactivity — bots cannot maintain scores.
        </p>
      </div>

      {/* Address lookup */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Check Your Points</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            placeholder="0x... agent wallet address"
            style={{
              flex: 1,
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text)",
              padding: "10px 14px",
              fontSize: 13,
              fontFamily: "monospace",
              outline: "none",
            }}
          />
          <button
            onClick={handleLookup}
            disabled={looking}
            style={{
              background: "linear-gradient(135deg, #6366f1, #a855f7)",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {looking ? "..." : "Check"}
          </button>
        </div>

        {error && <p style={{ color: "#f87171", fontSize: 13, marginTop: 12 }}>{error}</p>}

        {userData && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontFamily: "monospace", fontSize: 13, color: "var(--muted)" }}>
                {userData.address}
              </span>
              <span style={{ fontSize: 20, fontWeight: 700, color: "#a855f7" }}>
                {userData.points} pts
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {CRITERIA.map((c) => {
                const earned = (userData.breakdown[c.key] || 0) > 0;
                return (
                  <div
                    key={c.key}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: 6,
                      background: earned ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.02)",
                      border: `1px solid ${earned ? "rgba(34,197,94,0.2)" : "var(--border)"}`,
                    }}
                  >
                    <span style={{ fontSize: 12, color: earned ? "#22c55e" : "var(--muted)" }}>
                      {earned ? "✓" : "○"} {c.label}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: earned ? "#22c55e" : "var(--muted)" }}>
                      {earned ? `+${c.pts}` : `0/${c.pts}`}
                    </span>
                  </div>
                );
              })}
            </div>
            {userData.claimed && (
              <p style={{ color: "#22c55e", fontSize: 13, marginTop: 12 }}>AGT already claimed.</p>
            )}
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Leaderboard</h2>
        {leaderboard.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>
            No participants yet. Be the first to register and earn points!
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--muted)", textAlign: "left" }}>
                <th style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>Rank</th>
                <th style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>Agent</th>
                <th style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>Address</th>
                <th style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>Points</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((p) => (
                <tr key={p.address} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 12px", color: p.rank <= 3 ? "#f59e0b" : "var(--muted)", fontWeight: p.rank <= 3 ? 700 : 400 }}>
                    {p.rank <= 3 ? ["🥇", "🥈", "🥉"][p.rank - 1] : `#${p.rank}`}
                  </td>
                  <td style={{ padding: "10px 12px", fontWeight: 500 }}>{p.name}</td>
                  <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "var(--muted)", fontSize: 12 }}>
                    {shortAddr(p.address)}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#a855f7" }}>
                    {p.points.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {info && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)" }}>
            <span>Contract: <a href={`https://basescan.org/address/${info.contract}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>{shortAddr(info.contract || "")}</a></span>
            <span>Total points in system: {Number(info.totalPoints).toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
