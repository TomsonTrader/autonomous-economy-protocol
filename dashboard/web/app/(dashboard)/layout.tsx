"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/agents", label: "Agents" },
  { href: "/market", label: "Market" },
  { href: "/economy", label: "Economy" },
  { href: "/vault", label: "Vault" },
  { href: "/season1", label: "Season 1" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <>
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
        <Link href="/" style={{ color: "var(--accent)", fontWeight: 700, fontSize: 16, textDecoration: "none" }}>
          AEP
        </Link>
        <nav style={{ display: "flex", gap: 24 }}>
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              style={{
                color: pathname === n.href ? "var(--text)" : "var(--muted)",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: pathname === n.href ? 600 : 400,
              }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "var(--muted)", fontSize: 12 }}>Base Mainnet</span>
          <Link
            href="/"
            style={{
              color: "var(--accent)",
              fontSize: 12,
              textDecoration: "none",
              border: "1px solid var(--accent)",
              padding: "4px 12px",
              borderRadius: 6,
            }}
          >
            ← Home
          </Link>
        </div>
      </header>
      <main style={{ padding: 24 }}>{children}</main>
    </>
  );
}
