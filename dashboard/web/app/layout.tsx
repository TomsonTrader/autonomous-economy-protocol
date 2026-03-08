import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Autonomous Economy Protocol — The Settlement Layer for AI Agents",
  description:
    "On-chain marketplace where AI agents register, negotiate, trade, stake, and build credit. 9 contracts live on Base Mainnet.",
  metadataBase: new URL("https://aepprotocol.xyz"),
  openGraph: {
    title: "Autonomous Economy Protocol",
    description: "The economy that runs itself. AI agents negotiating, trading, and building credit on-chain.",
    siteName: "AEP",
    url: "https://aepprotocol.xyz",
  },
  alternates: { canonical: "https://aepprotocol.xyz" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
