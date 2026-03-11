/**
 * AEP Full System Health Check
 * Usage: npx ts-node scripts/health-check.ts
 */

const BACKEND  = "https://autonomous-economy-protocol-production.up.railway.app";
const FRONTEND = "https://aepprotocol.xyz";
const POOL     = "0xe72646B25853e6300C80B029D3faCA63fd4e564B";
const AGT      = "0x6dE70b5B0953A220420E142f51AE47B6Fd5b7101";

const c = {
  ok:   "\x1b[32m✅\x1b[0m",
  warn: "\x1b[33m⚠️ \x1b[0m",
  fail: "\x1b[31m❌\x1b[0m",
  bold: "\x1b[1m",
  dim:  "\x1b[2m",
  rst:  "\x1b[0m",
};

type Result = { label: string; ok: boolean; detail?: string };
const results: Result[] = [];

async function check(label: string, fn: () => Promise<string>): Promise<void> {
  try {
    const detail = await fn();
    results.push({ label, ok: true, detail });
    process.stdout.write(`  ${c.ok} ${label}${detail ? c.dim + " — " + detail + c.rst : ""}\n`);
  } catch (e: any) {
    results.push({ label, ok: false, detail: e.message });
    process.stdout.write(`  ${c.fail} ${label}${c.dim + " — " + e.message + c.rst}\n`);
  }
}

async function get(url: string, timeout = 25000): Promise<Response> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

async function main() {
  console.log(`\n${c.bold}AEP Health Check — ${new Date().toISOString()}${c.rst}\n`);

  // ── Backend ──────────────────────────────────────────────────────────────
  console.log(`${c.bold}Backend (Railway)${c.rst}`);
  await check("/health", async () => {
    const d = await (await get(`${BACKEND}/health`)).json() as any;
    return `${d.network} · ${d.status}`;
  });
  await check("/api/stats", async () => {
    const d = await (await get(`${BACKEND}/api/stats`)).json() as any;
    return `${d.totalAgents} agents, ${d.totalDeals} deals`;
  });
  await check("/api/market/offers", async () => {
    const d = await (await get(`${BACKEND}/api/market/offers`)).json() as any;
    return `${(d.offers||[]).length} offers`;
  });
  await check("/api/genesis/info", async () => {
    const d = await (await get(`${BACKEND}/api/genesis/info`)).json() as any;
    return `pool=${Math.round(d.poolAGT||0).toLocaleString()} AGT, participants=${d.participants||0}`;
  });
  await check("/api/vault/stats", async () => {
    const d = await (await get(`${BACKEND}/api/vault/stats`)).json() as any;
    return `staked=${d.totalStaked} AGT`;
  });
  await check("/api/token", async () => {
    const d = await (await get(`${BACKEND}/api/token`)).json() as any;
    const price = d.pool_data?.base_token_price_usd;
    return price ? `$${parseFloat(price).toExponential(3)}` : "pool_data null";
  });
  await check("/api/reputation/leaderboard", async () => {
    const d = await (await get(`${BACKEND}/api/reputation/leaderboard`)).json() as any;
    return `${(d.leaderboard||[]).length} agents ranked`;
  });
  await check("/api/faucet/status", async () => {
    const d = await (await get(`${BACKEND}/api/faucet/status`)).json() as any;
    if (!d.configured) throw new Error("not configured — add ETH to faucet wallet");
    return "configured";
  });

  // ── Dashboard ─────────────────────────────────────────────────────────────
  console.log(`\n${c.bold}Dashboard (Vercel)${c.rst}`);
  for (const path of ["/", "/whitepaper", "/season1", "/launch", "/dashboard", "/activity", "/vault", "/refer", "/sitemap.xml", "/robots.txt"]) {
    await check(path, async () => {
      await get(`${FRONTEND}${path}`);
      return "200 OK";
    });
  }
  await check("/api/widget (SVG badge)", async () => {
    const r = await get(`${FRONTEND}/api/widget`);
    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("svg")) throw new Error(`wrong content-type: ${ct}`);
    return "SVG OK";
  });
  await check("/.well-known/agent.json (A2A)", async () => {
    const d = await (await get(`${FRONTEND}/.well-known/agent.json`)).json() as any;
    return d.name || "ok";
  });

  // ── Token / Pool ──────────────────────────────────────────────────────────
  console.log(`\n${c.bold}Token / Pool${c.rst}`);
  await check("GeckoTerminal pool", async () => {
    const d = await (await get(`https://api.geckoterminal.com/api/v2/networks/base/pools/${POOL}`)).json() as any;
    const a = d.data?.attributes;
    return `$${parseFloat(a.base_token_price_usd).toExponential(3)} · $${parseFloat(a.reserve_in_usd).toFixed(0)} TVL`;
  });
  await check("DexScreener pool", async () => {
    const d = await (await get(`https://api.dexscreener.com/latest/dex/pairs/base/${POOL}`)).json() as any;
    if (!d.pair && !d.pairs?.length) throw new Error("not indexed yet — make a swap on Uniswap");
    const p = d.pair || d.pairs[0];
    return `$${p.priceUsd}`;
  });

  // ── npm ───────────────────────────────────────────────────────────────────
  console.log(`\n${c.bold}npm / PyPI${c.rst}`);
  await check("autonomous-economy-sdk (npm)", async () => {
    const d = await (await get("https://registry.npmjs.org/autonomous-economy-sdk/latest")).json() as any;
    return `v${d.version}`;
  });
  await check("n8n-nodes-aep (npm)", async () => {
    const d = await (await get("https://registry.npmjs.org/n8n-nodes-aep/latest")).json() as any;
    return `v${d.version}`;
  });
  await check("autonomous-economy-sdk (PyPI)", async () => {
    const d = await (await get("https://pypi.org/pypi/autonomous-economy-sdk/json")).json() as any;
    return `v${d.info.version}`;
  });

  // ── Summary ───────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${"─".repeat(56)}`);
  console.log(`${c.bold}${passed}/${results.length} checks passed${failed > 0 ? ` · ${failed} failed` : " 🎉"}${c.rst}\n`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
