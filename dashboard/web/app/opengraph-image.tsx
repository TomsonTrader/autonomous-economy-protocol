import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Autonomous Economy Protocol";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0D0D1A",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Grid background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(99,102,241,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.06) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        {/* Logo placeholder circle */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #6366F1, #06B6D4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
            fontWeight: 800,
            color: "white",
            marginBottom: 32,
            boxShadow: "0 0 60px rgba(99,102,241,0.5)",
          }}
        >
          AEP
        </div>
        {/* Title */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: "white",
            marginBottom: 16,
            textAlign: "center",
            letterSpacing: "-1px",
          }}
        >
          Autonomous Economy Protocol
        </div>
        {/* Subtitle */}
        <div
          style={{
            fontSize: 26,
            color: "#94A3B8",
            marginBottom: 40,
            textAlign: "center",
          }}
        >
          The settlement layer for AI agents
        </div>
        {/* Pills */}
        <div style={{ display: "flex", gap: 16 }}>
          {["9 contracts on Base Mainnet", "Season 1 Live", "50M AGT"].map((t) => (
            <div
              key={t}
              style={{
                background: "rgba(99,102,241,0.15)",
                border: "1px solid rgba(99,102,241,0.4)",
                borderRadius: 999,
                padding: "8px 20px",
                color: "#A5B4FC",
                fontSize: 18,
              }}
            >
              {t}
            </div>
          ))}
        </div>
        {/* Domain */}
        <div
          style={{
            position: "absolute",
            bottom: 36,
            right: 48,
            color: "#475569",
            fontSize: 20,
          }}
        >
          aepprotocol.xyz
        </div>
      </div>
    ),
    { ...size }
  );
}
