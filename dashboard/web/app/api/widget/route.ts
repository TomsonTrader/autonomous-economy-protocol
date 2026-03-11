import { NextResponse } from "next/server";

const POOL = "0xe72646B25853e6300C80B029D3faCA63fd4e564B";

// Simple cache
let cache: { svg: string; ts: number } | null = null;

async function fetchPrice(): Promise<{ price: string; change: string; up: boolean }> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/pairs/base/${POOL}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error("no data");
    const data = await res.json();
    const pair = data?.pair ?? data?.pairs?.[0];
    if (!pair?.priceUsd) throw new Error("no price");
    const price = parseFloat(pair.priceUsd);
    const change = parseFloat(pair.priceChange?.h24 ?? "0");
    return {
      price: price < 0.001 ? price.toExponential(2) : price.toFixed(6),
      change: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
      up: change >= 0,
    };
  } catch {
    return { price: "—", change: "—", up: true };
  }
}

export async function GET() {
  // Serve cached SVG if fresh
  if (cache && Date.now() - cache.ts < 60_000) {
    return new NextResponse(cache.svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=60, stale-while-revalidate=30",
      },
    });
  }

  const { price, change, up } = await fetchPrice();
  const color = up ? "#22c55e" : "#ef4444";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="28">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#090912"/>
      <stop offset="100%" stop-color="#0f0f1a"/>
    </linearGradient>
  </defs>
  <rect width="220" height="28" rx="6" fill="url(#bg)" stroke="#ffffff18" stroke-width="1"/>
  <circle cx="14" cy="14" r="5" fill="#6366f1"/>
  <text x="24" y="18" font-family="monospace,sans-serif" font-size="11" fill="#a5b4fc" font-weight="bold">AGT</text>
  <text x="54" y="18" font-family="monospace,sans-serif" font-size="11" fill="#ffffff" font-weight="bold">$${price}</text>
  <text x="165" y="18" font-family="monospace,sans-serif" font-size="10" fill="${color}">${change}</text>
</svg>`;

  cache = { svg, ts: Date.now() };

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=30",
    },
  });
}
