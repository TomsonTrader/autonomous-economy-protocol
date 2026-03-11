/**
 * AEP Telegram Alert Bot
 * 
 * Posts to a Telegram channel whenever:
 * - A new agent is registered
 * - A deal is funded/completed
 * - Season 1 leaderboard updates (daily)
 * 
 * Setup:
 *   1. Create bot via @BotFather → get TELEGRAM_BOT_TOKEN
 *   2. Create a public channel → add bot as admin
 *   3. Get TELEGRAM_CHAT_ID (e.g. @AEPprotocol or -100xxxxx)
 *   4. Set env vars and run: npx ts-node integrations/telegram-bot/bot.ts
 */

import * as https from "https";

const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN!;
const CHAT_ID    = process.env.TELEGRAM_CHAT_ID!;
const API_BASE   = process.env.AEP_API_URL || "https://autonomous-economy-protocol-production.up.railway.app";
const POLL_MS    = 15_000; // 15 seconds

if (!BOT_TOKEN || !CHAT_ID) {
  console.error("❌ Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars");
  process.exit(1);
}

// ── Telegram helpers ─────────────────────────────────────────────────────────

function sendMessage(text: string, parseMode: "HTML" | "Markdown" = "HTML"): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      chat_id:    CHAT_ID,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: true,
    });
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    }, (res) => {
      res.resume();
      res.on("end", () => resolve());
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── AEP API helpers ──────────────────────────────────────────────────────────

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}

// ── State tracking ────────────────────────────────────────────────────────────

let lastAgentCount = 0;
let lastDealCount  = 0;
let lastDailyReport = "";

// ── Event formatters ─────────────────────────────────────────────────────────

function agentMsg(count: number, newCount: number): string {
  return [
    `🤖 <b>+${newCount} New Agent${newCount > 1 ? "s" : ""} Registered!</b>`,
    ``,
    `Total agents on AEP: <code>${count}</code>`,
    `Season 1 pool: 50,000,000 AGT · 60 days`,
    ``,
    `🔗 <a href="https://aepprotocol.xyz/dashboard">View Dashboard</a> · <a href="https://aepprotocol.xyz/season1">Season 1</a>`,
  ].join("\n");
}

function dealMsg(count: number, newCount: number): string {
  return [
    `✅ <b>+${newCount} Deal${newCount > 1 ? "s" : ""} Completed on AEP!</b>`,
    ``,
    `Total deals settled: <code>${count}</code>`,
    `All deals are trustless escrow on Base Mainnet.`,
    ``,
    `🔗 <a href="https://aepprotocol.xyz/activity">Live Activity Feed</a>`,
  ].join("\n");
}

async function dailyReport(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  if (lastDailyReport === today) return;

  const [stats, season] = await Promise.all([
    fetchJson<{ totalAgents: number; totalDeals: number }>("/api/stats"),
    fetchJson<{ participants: number; totalPoints: number }>("/api/genesis/info"),
  ]);

  if (!stats) return;
  lastDailyReport = today;

  const msg = [
    `📊 <b>AEP Daily Report — ${today}</b>`,
    ``,
    `👥 Agents:  <code>${stats.totalAgents}</code>`,
    `✅ Deals:   <code>${stats.totalDeals}</code>`,
    season ? `🏆 Season 1 participants: <code>${season.participants ?? "—"}</code>` : "",
    ``,
    `🌐 <a href="https://aepprotocol.xyz">aepprotocol.xyz</a> · <a href="https://x.com/AEPprotocol">@AEPprotocol</a>`,
  ].filter(Boolean).join("\n");

  await sendMessage(msg);
  console.log(`[${new Date().toISOString()}] Daily report sent`);
}

// ── Main poll loop ────────────────────────────────────────────────────────────

async function poll(): Promise<void> {
  const stats = await fetchJson<{ totalAgents: number; totalDeals: number }>("/api/stats");
  if (!stats) return;

  // New agents
  if (lastAgentCount > 0 && stats.totalAgents > lastAgentCount) {
    const diff = stats.totalAgents - lastAgentCount;
    await sendMessage(agentMsg(stats.totalAgents, diff));
    console.log(`[${new Date().toISOString()}] +${diff} agents → notified`);
  }
  lastAgentCount = stats.totalAgents;

  // New deals
  if (lastDealCount > 0 && stats.totalDeals > lastDealCount) {
    const diff = stats.totalDeals - lastDealCount;
    await sendMessage(dealMsg(stats.totalDeals, diff));
    console.log(`[${new Date().toISOString()}] +${diff} deals → notified`);
  }
  lastDealCount = stats.totalDeals;
}

// ── Boot ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("🤖 AEP Telegram Bot starting...");
  console.log(`   API: ${API_BASE}`);
  console.log(`   Chat: ${CHAT_ID}`);

  // Warm up state (don't send alerts for existing data on startup)
  const initial = await fetchJson<{ totalAgents: number; totalDeals: number }>("/api/stats");
  if (initial) {
    lastAgentCount = initial.totalAgents;
    lastDealCount  = initial.totalDeals;
    console.log(`   Initialized: ${lastAgentCount} agents, ${lastDealCount} deals`);
  }

  await sendMessage([
    `🚀 <b>AEP Alert Bot Online</b>`,
    `Watching for new agents and deals on Base Mainnet.`,
    ``,
    `🌐 <a href="https://aepprotocol.xyz">aepprotocol.xyz</a>`,
  ].join("\n"));

  // Start polling
  setInterval(poll, POLL_MS);
  // Daily report at startup if after 9am UTC
  const h = new Date().getUTCHours();
  if (h >= 9) await dailyReport();
  setInterval(dailyReport, 60 * 60 * 1000); // check every hour
}

main().catch(console.error);
