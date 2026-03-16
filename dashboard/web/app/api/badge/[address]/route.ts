import { NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL
  ?? "https://autonomous-economy-protocol-production.up.railway.app";

// Cache per address, 60s TTL
const cache = new Map<string, { svg: string; ts: number }>();

export async function GET(_req: Request, { params }: { params: { address: string } }) {
  const { address } = params;

  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return new NextResponse("Invalid address", { status: 400 });
  }

  const cached = cache.get(address);
  if (cached && Date.now() - cached.ts < 60_000) {
    return svg(cached.svg);
  }

  // Fetch agent data and reputation
  let name = "AEP Agent";
  let score = "0";
  let deals = "0";
  let active = true;

  try {
    const [agentRes, repRes] = await Promise.all([
      fetch(`${BACKEND}/api/agents/${address}`, { signal: AbortSignal.timeout(4000) }),
      fetch(`${BACKEND}/api/agents/${address}/reputation`, { signal: AbortSignal.timeout(4000) }),
    ]);

    if (agentRes.ok) {
      const a = await agentRes.json();
      name   = a.name && a.name !== "Unknown" ? a.name.slice(0, 20) : shortAddr(address);
      active = a.active ?? true;
    }
    if (repRes.ok) {
      const r = await repRes.json();
      score = parseFloat(r.score ?? "0").toFixed(1);
      deals = r.totalDeals ?? "0";
    }
  } catch {
    name = shortAddr(address);
  }

  const statusColor = active ? "#00ff87" : "#ef4444";
  const statusText  = active ? "ACTIVE" : "INACTIVE";

  // Badge SVG — 320x36px — dark themed, AEP brand
  const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="36">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#050507"/>
      <stop offset="100%" stop-color="#0d0d12"/>
    </linearGradient>
    <linearGradient id="left" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#7928ca"/>
      <stop offset="100%" stop-color="#6366f1"/>
    </linearGradient>
  </defs>
  <rect width="320" height="36" rx="8" fill="url(#bg)" stroke="#ffffff12" stroke-width="1"/>
  <!-- Left AEP brand block -->
  <rect width="46" height="36" rx="8" fill="url(#left)"/>
  <rect x="38" width="10" height="36" fill="url(#left)"/>
  <text x="23" y="23" font-family="monospace,sans-serif" font-size="11" font-weight="900" fill="#fff" text-anchor="middle">AEP</text>
  <!-- Agent name -->
  <text x="56" y="22" font-family="Inter,sans-serif" font-size="12" font-weight="700" fill="#ffffff">${escapeXml(name)}</text>
  <!-- Reputation score -->
  <text x="190" y="14" font-family="monospace,sans-serif" font-size="9" fill="#ffffff66">rep</text>
  <text x="190" y="26" font-family="monospace,sans-serif" font-size="11" font-weight="700" fill="#a5b4fc">${score}</text>
  <!-- Deals -->
  <text x="238" y="14" font-family="monospace,sans-serif" font-size="9" fill="#ffffff66">deals</text>
  <text x="238" y="26" font-family="monospace,sans-serif" font-size="11" font-weight="700" fill="#67e8f9">${deals}</text>
  <!-- Status -->
  <circle cx="290" cy="15" r="4" fill="${statusColor}" opacity="0.9"/>
  <text x="300" y="19" font-family="monospace,sans-serif" font-size="9" font-weight="700" fill="${statusColor}">${statusText}</text>
</svg>`;

  cache.set(address, { svg: svgStr, ts: Date.now() });

  // Evict stale entries to prevent unbounded growth
  if (cache.size > 500) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) cache.delete(oldest[0]);
  }

  return svg(svgStr);
}

function svg(content: string) {
  return new NextResponse(content, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=30",
    },
  });
}

function shortAddr(addr: string) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
