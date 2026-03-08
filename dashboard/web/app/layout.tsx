import type { Metadata } from "next";
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
    site: "@aepprotocol",
    images: ["/og-image.png"],
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
