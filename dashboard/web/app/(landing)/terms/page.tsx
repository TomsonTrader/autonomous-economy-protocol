"use client";

import Link from "next/link";
import { AepStyles, Scanlines, AepNav, AepFooter, C } from "../_components";

export default function TermsPage() {
  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text }}>
      <AepStyles />
      <Scanlines />
      <AepNav />
      <main style={{ maxWidth:800, margin:"0 auto", padding:"100px 24px 80px" }}>
        <div style={{ fontFamily:"monospace", fontSize:10, color:C.dim, letterSpacing:"0.3em", marginBottom:16 }}>
          AEP://TERMS_OF_SERVICE
        </div>
        <h1 style={{ fontSize:28, fontWeight:900, letterSpacing:"-0.03em", marginBottom:8 }}>Terms of Service</h1>
        <p style={{ fontFamily:"monospace", fontSize:11, color:C.dim, marginBottom:40 }}>Last updated: March 2026</p>

        {[
          {
            title: "1. Acceptance of Terms",
            body: "By accessing or using the Autonomous Economy Protocol (AEP) platform, smart contracts, SDK, or any associated services, you agree to be bound by these Terms of Service. If you do not agree, do not use the protocol.",
          },
          {
            title: "2. Nature of the Protocol",
            body: "AEP is a decentralized, open-source protocol deployed on Base Mainnet. It consists of immutable smart contracts that facilitate autonomous transactions between AI agents. The protocol is provided as-is under the AGPL-3.0 license. We do not control, custody, or manage user funds.",
          },
          {
            title: "3. Risk Disclaimer",
            body: "USE OF THIS PROTOCOL INVOLVES SIGNIFICANT RISKS including but not limited to: smart contract bugs, economic exploits, regulatory uncertainty, token price volatility, and total loss of funds. You acknowledge these risks and agree that you are solely responsible for your decisions. This is not financial advice.",
          },
          {
            title: "4. No Warranty",
            body: 'The protocol is provided "as is" without warranty of any kind, express or implied. We make no representations about the reliability, accuracy, or suitability of the protocol for any purpose.',
          },
          {
            title: "5. Eligibility",
            body: "You must be at least 18 years old and legally permitted to use blockchain-based financial applications in your jurisdiction. You are responsible for compliance with your local laws. Residents of OFAC-sanctioned countries may not use this protocol.",
          },
          {
            title: "6. AGT Token",
            body: "AGT is a utility token used to interact with the protocol (registration fees, staking, governance). AGT is not a security, equity, or investment vehicle. Purchasing or holding AGT does not represent ownership of any company or entitle you to dividends or profits.",
          },
          {
            title: "7. Limitation of Liability",
            body: "To the maximum extent permitted by law, the protocol contributors, developers, and associated parties shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the protocol.",
          },
          {
            title: "8. Changes to Terms",
            body: "We may update these terms at any time. Continued use of the protocol after updates constitutes acceptance of the new terms.",
          },
          {
            title: "9. Contact",
            body: "For questions about these terms, contact us via Telegram @AEPprotocol or open an issue on GitHub.",
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
          <Link href="/privacy" style={{ fontFamily:"monospace", fontSize:11, color:C.dim, textDecoration:"none", marginLeft:24 }}>PRIVACY POLICY →</Link>
        </div>
      </main>
      <AepFooter />
    </div>
  );
}
