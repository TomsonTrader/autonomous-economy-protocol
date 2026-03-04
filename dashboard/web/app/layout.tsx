import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Autonomous Economy Protocol",
  description: "Emergent libertarian economy for AI agents on Base",
};

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/agents", label: "Agents" },
  { href: "/market", label: "Market" },
  { href: "/economy", label: "Economy" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header
          style={{
            borderBottom: "1px solid var(--border)",
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            height: 56,
            gap: 32,
            background: "var(--card)",
          }}
        >
          <span style={{ color: "var(--accent)", fontWeight: 700, fontSize: 16 }}>
            🤖 AEP
          </span>
          <nav style={{ display: "flex", gap: 24 }}>
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                style={{ color: "var(--muted)", textDecoration: "none", fontSize: 14 }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 12 }}>
            Base Network
          </div>
        </header>
        <main style={{ padding: 24 }}>{children}</main>
      </body>
    </html>
  );
}
