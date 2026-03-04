#!/usr/bin/env ts-node
/**
 * CLI Dashboard — Terminal monitor for the Autonomous Economy Protocol.
 * Connects to the backend WebSocket and displays live market data.
 *
 * Run: npx ts-node dashboard/cli/monitor.ts
 */

import { WebSocket } from "ws";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";
const WS_URL = BACKEND_URL.replace(/^http/, "ws") + "/ws";

// ── ANSI colors ───────────────────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgBlue: "\x1b[44m",
  bgGreen: "\x1b[42m",
};

function colorize(text: string, ...colors: string[]) {
  return colors.join("") + text + c.reset;
}

// ── State ─────────────────────────────────────────────────────────────────────
interface Event {
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
}

const recentEvents: Event[] = [];
const agentActivity: Map<string, { name: string; lastEvent: string; events: number }> = new Map();
let stats = {
  totalAgents: 0,
  totalNeeds: 0,
  totalOffers: 0,
  totalProposals: 0,
  acceptedProposals: 0,
};

const prices: number[] = [];

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  console.clear();

  const width = process.stdout.columns || 80;
  const sep = "─".repeat(width);

  // Header
  console.log(colorize(" AUTONOMOUS ECONOMY PROTOCOL — LIVE MONITOR ", c.bold, c.bgBlue, c.white));
  console.log(colorize(`  ${new Date().toLocaleString()} | Backend: ${BACKEND_URL}`, c.dim));
  console.log(sep);

  // Stats row
  console.log(
    colorize("  AGENTS ", c.bold, c.cyan) + colorize(stats.totalAgents.toString(), c.green, c.bold) +
    colorize("   NEEDS ", c.cyan, c.bold) + colorize(stats.totalNeeds.toString(), c.yellow, c.bold) +
    colorize("   OFFERS ", c.cyan, c.bold) + colorize(stats.totalOffers.toString(), c.yellow, c.bold) +
    colorize("   PROPOSALS ", c.cyan, c.bold) + colorize(stats.totalProposals.toString(), c.magenta, c.bold) +
    colorize("   DEALS ", c.cyan, c.bold) + colorize(stats.acceptedProposals.toString(), c.green, c.bold)
  );

  // Pricing
  if (prices.length > 0) {
    const avg = (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(1);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    console.log(colorize(`  Emergent Price: avg ${avg} AGT | range ${min}–${max} AGT | ${prices.length} deals`, c.dim));
  }

  console.log(sep);

  // Recent events
  console.log(colorize("  LIVE ACTIVITY (last 15 events)", c.bold));
  console.log();

  const EVENT_ICONS: Record<string, string> = {
    AgentRegistered: "🤖",
    NeedPublished: "📢",
    OfferPublished: "🏷️ ",
    ProposalCreated: "🤝",
    CounterOffered: "🔄",
    ProposalAccepted: "✅",
    ProposalRejected: "❌",
    DeliveryConfirmed: "📦",
    DisputeRaised: "⚠️ ",
    PaymentReleased: "💰",
    connected: "🔌",
  };

  const EVENT_COLOR: Record<string, string> = {
    AgentRegistered: c.cyan,
    NeedPublished: c.yellow,
    OfferPublished: c.yellow,
    ProposalCreated: c.blue,
    CounterOffered: c.magenta,
    ProposalAccepted: c.green,
    ProposalRejected: c.red,
    DeliveryConfirmed: c.green,
    DisputeRaised: c.red,
    PaymentReleased: c.green,
  };

  const shown = recentEvents.slice(-15).reverse();
  for (const event of shown) {
    const icon = EVENT_ICONS[event.type] || "📡";
    const color = EVENT_COLOR[event.type] || c.white;
    const time = new Date(event.timestamp).toLocaleTimeString();
    const detail = formatEventDetail(event);

    console.log(
      `  ${colorize(time, c.dim)} ${icon} ${colorize(event.type.padEnd(20), color, c.bold)} ${detail}`
    );
  }

  if (shown.length === 0) {
    console.log(colorize("  Waiting for events...", c.dim));
  }

  console.log(sep);

  // Agent activity
  if (agentActivity.size > 0) {
    console.log(colorize("  ACTIVE AGENTS", c.bold));
    for (const [addr, info] of agentActivity.entries()) {
      console.log(
        `  ${colorize(addr.slice(0, 10) + "...", c.dim)} ` +
        `${colorize(info.name || "Unknown", c.cyan)} ` +
        `${colorize(`[${info.events} events]`, c.dim)} ` +
        `← ${info.lastEvent}`
      );
    }
    console.log(sep);
  }

  console.log(colorize("  Press Ctrl+C to exit", c.dim));
}

function formatEventDetail(event: Event): string {
  const d = event.data;
  switch (event.type) {
    case "AgentRegistered":
      return colorize(`${d.name} (${(d.capabilities as string[])?.join(", ")})`, c.cyan);
    case "NeedPublished":
      return colorize(`#${d.needId} budget: ${formatAGT(d.budget as string)} AGT | tags: ${(d.tags as string[])?.join(", ")}`, c.yellow);
    case "OfferPublished":
      return colorize(`#${d.offerId} price: ${formatAGT(d.price as string)} AGT | tags: ${(d.tags as string[])?.join(", ")}`, c.yellow);
    case "ProposalCreated":
      return colorize(`#${d.proposalId} price: ${formatAGT(d.price as string)} AGT`, c.blue);
    case "CounterOffered":
      return colorize(`#${d.newProposalId} ← counter ${formatAGT(d.newPrice as string)} AGT`, c.magenta);
    case "ProposalAccepted":
      return colorize(`#${d.proposalId} → ${String(d.agreementContract).slice(0, 10)}...`, c.green);
    default:
      return colorize(JSON.stringify(d).slice(0, 60), c.dim);
  }
}

function formatAGT(raw: string): string {
  if (!raw) return "?";
  // If it looks like wei (large number), convert
  try {
    const n = BigInt(raw);
    if (n > 10n ** 15n) {
      return (Number(n) / 1e18).toFixed(1);
    }
    return raw;
  } catch {
    return raw;
  }
}

// ── WebSocket connection ───────────────────────────────────────────────────────
function connect() {
  console.log(`Connecting to ${WS_URL}...`);

  const ws = new WebSocket(WS_URL);

  ws.on("open", () => {
    // Fetch initial stats
    fetchStats();
    render();
  });

  ws.on("message", (raw: Buffer) => {
    try {
      const event: Event = JSON.parse(raw.toString());
      recentEvents.push(event);
      if (recentEvents.length > 100) recentEvents.shift();

      // Update stats from events
      updateStats(event);

      // Track agent activity
      const addr = event.data?.agent as string || event.data?.publisher as string || event.data?.buyer as string;
      if (addr) {
        const existing = agentActivity.get(addr) || { name: String(event.data?.name || ""), lastEvent: "", events: 0 };
        agentActivity.set(addr, {
          name: existing.name || String(event.data?.name || ""),
          lastEvent: event.type,
          events: existing.events + 1,
        });
      }

      render();
    } catch {}
  });

  ws.on("close", () => {
    console.log("\nDisconnected from backend. Reconnecting in 3s...");
    setTimeout(connect, 3000);
  });

  ws.on("error", (err) => {
    console.error(`\nWebSocket error: ${err.message}`);
    console.log("Make sure backend is running: npm run backend");
    setTimeout(connect, 5000);
  });
}

function updateStats(event: Event) {
  switch (event.type) {
    case "AgentRegistered": stats.totalAgents++; break;
    case "NeedPublished": stats.totalNeeds++; break;
    case "OfferPublished": stats.totalOffers++; break;
    case "ProposalCreated": stats.totalProposals++; break;
    case "ProposalAccepted":
      stats.acceptedProposals++;
      // Extract price for emergent pricing display
      const price = event.data?.price as string;
      if (price) {
        try {
          const n = BigInt(price);
          if (n > 0n) prices.push(Number(n) / 1e18);
        } catch {}
      }
      break;
  }
}

async function fetchStats() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/monitor/stats`);
    if (res.ok) {
      const data = await res.json() as any;
      stats.totalAgents = data.market?.totalAgents || 0;
      stats.totalNeeds = data.market?.totalNeeds || 0;
      stats.totalOffers = data.market?.totalOffers || 0;
      stats.totalProposals = data.market?.totalProposals || 0;
    }
  } catch {
    // Backend not ready yet
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.clear();
console.log("🤖 Autonomous Economy Protocol — CLI Monitor");
console.log(`Connecting to ${BACKEND_URL}...`);
connect();

// Refresh stats every 10s
setInterval(() => {
  fetchStats();
  render();
}, 10_000);
