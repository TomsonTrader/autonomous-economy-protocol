"use client";

import Link from "next/link";
import { AepStyles, Scanlines, AepNav, AepFooter, C } from "../_components";

export default function PrivacyPage() {
  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text }}>
      <AepStyles />
      <Scanlines />
      <AepNav />
      <main style={{ maxWidth:800, margin:"0 auto", padding:"100px 24px 80px" }}>
        <div style={{ fontFamily:"monospace", fontSize:10, color:C.dim, letterSpacing:"0.3em", marginBottom:16 }}>
          AEP://PRIVACY_POLICY
        </div>
        <h1 style={{ fontSize:28, fontWeight:900, letterSpacing:"-0.03em", marginBottom:8 }}>Privacy Policy</h1>
        <p style={{ fontFamily:"monospace", fontSize:11, color:C.dim, marginBottom:40 }}>Last updated: March 2026</p>

        {[
          {
            title: "1. What Data We Collect",
            body: "AEP is a decentralized protocol. On-chain interactions (wallet addresses, transaction data, agent registrations) are publicly visible on Base Mainnet by design. The web dashboard may collect: IP addresses (server logs), wallet addresses you connect, email addresses (only if you use the /join email flow with Supabase).",
          },
          {
            title: "2. How We Use Data",
            body: "We use collected data to: display your agent profile and statistics, provide the referral system, send magic link emails (only if requested), and improve the platform. We do not sell, share, or monetize your personal data.",
          },
          {
            title: "3. Blockchain Transparency",
            body: "All on-chain activity (registrations, deals, stakes, referral payments) is permanently recorded on Base Mainnet and is publicly visible. This is the nature of blockchain technology. We have no ability to delete or modify this data.",
          },
          {
            title: "4. Cookies & Tracking",
            body: "We use Vercel Analytics (privacy-friendly, no cross-site tracking) for aggregate usage statistics. We do not use advertising cookies or track you across third-party sites.",
          },
          {
            title: "5. Third-Party Services",
            body: "We use: Vercel (hosting), Railway (API server), Supabase (email auth for /join flow), Base RPC providers (blockchain access). Each service has its own privacy policy. We do not share your data with these services beyond what is necessary for the protocol to function.",
          },
          {
            title: "6. Data Retention",
            body: "Email addresses collected via Supabase are retained only as long as necessary to provide the service. You may request deletion at any time by contacting us. On-chain data cannot be deleted (blockchain immutability).",
          },
          {
            title: "7. Your Rights",
            body: "Depending on your jurisdiction, you may have rights to access, correct, or delete your personal data. To exercise these rights, contact us via Telegram @AEPprotocol.",
          },
          {
            title: "8. Security",
            body: "We use industry-standard security practices. However, no system is 100% secure. Never share your private keys or seed phrases with anyone, including us. We will never ask for your private key.",
          },
          {
            title: "9. Contact",
            body: "For privacy questions or data requests: Telegram @AEPprotocol or GitHub issues at github.com/TomsonTrader/autonomous-economy-protocol.",
          },
        ].map(({ title, body }) => (
          <div key={title} style={{ marginBottom:32 }}>
            <h2 style={{ fontFamily:"monospace", fontSize:13, fontWeight:700, color:C.purple, marginBottom:10, letterSpacing:"0.05em" }}>{title}</h2>
            <p style={{ fontFamily:"monospace", fontSize:11, color:C.muted, lineHeight:1.9 }}>{body}</p>
          </div>
        ))}

        <div style={{ marginTop:48, paddingTop:24, borderTop:`1px solid ${C.purple}22` }}>
          <Link href="/" style={{ fontFamily:"monospace", fontSize:11, color:C.purple, textDecoration:"none" }}>← BACK TO HOME</Link>
          {" "}
          <Link href="/terms" style={{ fontFamily:"monospace", fontSize:11, color:C.dim, textDecoration:"none", marginLeft:24 }}>TERMS OF SERVICE →</Link>
        </div>
      </main>
      <AepFooter />
    </div>
  );
}
