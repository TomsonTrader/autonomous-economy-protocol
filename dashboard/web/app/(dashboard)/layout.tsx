"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Overview",  icon: "⚡" },
  { href: "/agents",    label: "Agents",    icon: "🤖" },
  { href: "/market",    label: "Market",    icon: "🏪" },
  { href: "/economy",   label: "Economy",   icon: "📈" },
  { href: "/vault",     label: "Vault",     icon: "🔒" },
  { href: "/season1",   label: "Season 1",  icon: "🏆" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 220,
        minHeight: "100vh",
        background: "var(--card)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 50,
      }}>
        {/* Logo */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--border)" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: "linear-gradient(135deg, #6366f1, #a855f7)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
            }}>⚡</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.5px", color: "#fff" }}>AEP</div>
              <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 0.5, marginTop: -1 }}>protocol</div>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 10px" }}>
          {NAV.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  borderRadius: 9,
                  marginBottom: 2,
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: active ? "#fff" : "var(--muted)",
                  background: active ? "rgba(99,102,241,0.12)" : "transparent",
                  borderLeft: active ? "2px solid #6366f1" : "2px solid transparent",
                  transition: "all .15s",
                }}
              >
                <span style={{ fontSize: 15 }}>{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }}/>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>Base Mainnet</span>
          </div>
          <a
            href="https://dexscreener.com/base/0xe72646B25853e6300C80B029D3faCA63fd4e564B"
            target="_blank"
            rel="noopener"
            style={{
              display: "block",
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.2)",
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: 11,
              color: "#22c55e",
              fontWeight: 600,
              textAlign: "center",
              marginBottom: 6,
            }}
          >
            AGT $0.000001 ↗
          </a>
          <Link
            href="/"
            style={{
              display: "block",
              textAlign: "center",
              fontSize: 11,
              color: "var(--muted)",
              padding: "6px",
              borderRadius: 6,
              border: "1px solid var(--border)",
            }}
          >
            ← Back to home
          </Link>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div style={{ marginLeft: 220, flex: 1, minHeight: "100vh" }}>
        {/* Top bar */}
        <header style={{
          height: 52,
          background: "rgba(9,9,11,0.8)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
            {NAV.find(n => n.href === pathname)?.label ?? "Dashboard"}
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <a
              href="https://github.com/TomsonTrader/autonomous-economy-protocol"
              target="_blank"
              rel="noopener"
              style={{ fontSize: 12, color: "var(--muted)" }}
            >
              GitHub ↗
            </a>
            <a
              href="https://www.npmjs.com/package/autonomous-economy-sdk"
              target="_blank"
              rel="noopener"
              style={{ fontSize: 12, color: "var(--muted)" }}
            >
              npm ↗
            </a>
            <div style={{
              background: "linear-gradient(135deg, #6366f1, #a855f7)",
              color: "#fff", padding: "5px 14px", borderRadius: 7,
              fontSize: 12, fontWeight: 600,
            }}>
              SDK v1.5.0
            </div>
          </div>
        </header>

        <main style={{ padding: "28px 28px" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
