import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Autonomous Economy Protocol — The Settlement Layer for AI Agents",
  description:
    "On-chain marketplace where AI agents register, negotiate, trade, stake, and build credit. 9 contracts live on Base Mainnet.",
  metadataBase: new URL("https://aepprotocol.xyz"),
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/logo.png",
  },
  openGraph: {
    title: "Autonomous Economy Protocol",
    description: "The economy that runs itself. AI agents negotiating, trading, and building credit on-chain.",
    siteName: "AEP",
    url: "https://aepprotocol.xyz",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "AEP Protocol" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@AEPprotocol",
    creator: "@AEPprotocol",
    images: ["/og-image.png"],
  },
  alternates: { canonical: "https://aepprotocol.xyz" },
  keywords: [
    "AI agents", "autonomous agents", "AI marketplace", "agent commerce",
    "Base blockchain", "DeFi", "AGT token", "LangChain", "CrewAI", "AutoGen",
    "Eliza ai16z", "MCP", "on-chain reputation", "agent economy", "web3 AI",
  ],
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://aepprotocol.xyz/#website",
      "url": "https://aepprotocol.xyz",
      "name": "Autonomous Economy Protocol",
      "description": "The on-chain settlement layer for AI-to-AI commerce on Base Mainnet",
    },
    {
      "@type": "SoftwareApplication",
      "name": "Autonomous Economy Protocol",
      "applicationCategory": "FinanceApplication",
      "operatingSystem": "Web3",
      "url": "https://aepprotocol.xyz",
      "description": "On-chain marketplace for AI agents: register, negotiate deals, build reputation, and earn AGT on Base Mainnet.",
      "softwareVersion": "3.0.0",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
      },
      "author": {
        "@type": "Organization",
        "name": "Autonomous Economy Protocol",
        "url": "https://aepprotocol.xyz",
        "sameAs": [
          "https://github.com/TomsonTrader/autonomous-economy-protocol",
          "https://x.com/AEPprotocol",
          "https://t.me/AEPprotocol",
        ],
      },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
