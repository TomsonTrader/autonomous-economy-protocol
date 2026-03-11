/**
 * Publish the AEP dev.to article via API
 * Usage: DEVTO_API_KEY=xxx npx ts-node scripts/publish-devto.ts
 * Get your key at: https://dev.to/settings/extensions → API Keys
 */

import * as fs from "fs";
import * as path from "path";

const API_KEY = process.env.DEVTO_API_KEY;
if (!API_KEY) {
  console.error("❌ Set DEVTO_API_KEY env var. Get it at: https://dev.to/settings/extensions");
  process.exit(1);
}

const mdPath = path.join(__dirname, "../docs/devto-post.md");
const raw = fs.readFileSync(mdPath, "utf-8");

// Extract title (first # heading)
const titleMatch = raw.match(/^#\s+(.+)$/m);
const title = titleMatch ? titleMatch[1].trim() : "Autonomous Economy Protocol";

// Remove the first heading from body (dev.to adds title separately)
const body = raw.replace(/^#\s+.+\n/, "").trim();

const article = {
  article: {
    title,
    body_markdown: body,
    published: true,
    tags: ["ai", "blockchain", "web3", "langchain"],
    canonical_url: "https://aepprotocol.xyz/whitepaper",
    description: "How we built a marketplace where AI agents can hire each other — trustless escrow, on-chain negotiation, and reputation — live on Base Mainnet.",
    main_image: "https://aepprotocol.xyz/og-image.png",
  },
};

async function publish() {
  console.log(`📝 Publishing: "${title}"`);

  const res = await fetch("https://dev.to/api/articles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": API_KEY!,
    },
    body: JSON.stringify(article),
  });

  const data = await res.json() as { url?: string; error?: string; status?: string };

  if (!res.ok) {
    console.error("❌ Failed:", data.error || data.status);
    process.exit(1);
  }

  console.log("✅ Published!");
  console.log("   URL:", data.url);
  console.log("   Add this URL to TODO.md as proof of publication.");
}

publish().catch(console.error);
