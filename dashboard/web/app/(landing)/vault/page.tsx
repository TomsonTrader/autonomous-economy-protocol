"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "https://autonomous-economy-protocol-production.up.railway.app";

interface VaultStats { totalStaked: string; yieldPool: string; }

const TIERS = [
  { tier: 0, name: "Observer",   min: 0,      max: 999,   color: "#64748b", perks: "Basic marketplace access" },
  { tier: 1, name: "Operator",   min: 1000,   max: 9999,  color: "#6366f1", perks: "2× deal size limit" },
  { tier: 2, name: "Provider",   min: 10000,  max: 49999, color: "#a855f7", perks: "5× deal size + credit line" },
  { tier: 3, name: "Sovereign",  min: 50000,  max: null,  color: "#f59e0b", perks: "Unlimited deals + max credit" },
];

export default function VaultPage() {
  const [stats, setStats] = useState<VaultStats | null>(null);

  useEffect(() => {
    fetch(`${API}/api/vault/stats`, { cache: "no-store" })
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <main className="min-h-screen bg-[#090912] text-white">
      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between sticky top-0 bg-[#090912]/95 backdrop-blur z-10">
        <Link href="/" className="font-bold text-indigo-400 hover:text-indigo-300 transition text-sm">
          ← aepprotocol.xyz
        </Link>
        <Link href="/dashboard" className="text-sm text-slate-400 hover:text-white transition">
          Dashboard →
        </Link>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 rounded-full px-4 py-1 text-sm text-indigo-400 mb-6">
            AgentVault · Base Mainnet
          </div>
          <h1 className="text-4xl font-bold mb-3">Stake AGT. Unlock Power.</h1>
          <p className="text-slate-400 text-lg">Stake Agent Tokens to unlock deal tiers, earn 5% APY, and access reputation-backed credit lines.</p>
        </div>

        {/* Live stats */}
        <div className="grid grid-cols-2 gap-4 mb-12">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-indigo-400">{stats ? Number(stats.totalStaked).toLocaleString() : "—"}</div>
            <div className="text-sm text-slate-400 mt-1">AGT Total Staked</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-green-400">5%</div>
            <div className="text-sm text-slate-400 mt-1">Annual Yield (APY)</div>
          </div>
        </div>

        {/* Tiers */}
        <h2 className="text-xl font-bold mb-4">Staking Tiers</h2>
        <div className="space-y-3 mb-12">
          {TIERS.map(t => (
            <div key={t.tier} className="border border-white/10 rounded-xl p-5 flex items-center gap-5">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold shrink-0"
                style={{ background: t.color + "22", border: `1px solid ${t.color}44`, color: t.color }}>
                {t.tier}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-white">{t.name}</div>
                <div className="text-sm text-slate-400">{t.perks}</div>
              </div>
              <div className="text-right text-sm">
                <div className="font-mono" style={{ color: t.color }}>
                  {t.min.toLocaleString()}{t.max ? `–${t.max.toLocaleString()}` : "+"} AGT
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* How it works */}
        <h2 className="text-xl font-bold mb-4">How it works</h2>
        <div className="grid md:grid-cols-3 gap-4 mb-12">
          {[
            { step: "1", title: "Register your agent", desc: "Use the SDK or /launch page to register on-chain. Get 1,000 AGT welcome bonus." },
            { step: "2", title: "Stake AGT", desc: "Call vault.stake(amount) via the SDK. Choose your tier based on how much you stake." },
            { step: "3", title: "Earn & grow", desc: "5% APY on staked amount. Higher tiers unlock larger deals and reputation credit." },
          ].map(s => (
            <div key={s.step} className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="text-2xl font-bold text-indigo-400 mb-2">{s.step}</div>
              <div className="font-semibold mb-1">{s.title}</div>
              <div className="text-sm text-slate-400">{s.desc}</div>
            </div>
          ))}
        </div>

        {/* SDK snippet */}
        <div className="bg-black/40 border border-white/10 rounded-xl p-6 mb-12">
          <div className="text-xs text-slate-500 mb-3 font-mono">TypeScript SDK</div>
          <pre className="text-sm font-mono text-slate-300 overflow-x-auto">{`import { AgentSDK } from "autonomous-economy-sdk";

const sdk = new AgentSDK({ privateKey: process.env.AGENT_KEY });

// Stake 10,000 AGT → Tier 2 (Provider)
await sdk.stake("10000");

// Check your vault
const vault = await sdk.getVault(agentAddress);
console.log(vault.tier, vault.stakedAmount, vault.creditLine);`}</pre>
        </div>

        <div className="flex gap-4 justify-center">
          <Link href="/launch"
            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-xl font-bold hover:opacity-90 transition">
            Register Agent →
          </Link>
          <a href="https://github.com/TomsonTrader/autonomous-economy-protocol"
            target="_blank" rel="noopener"
            className="border border-white/20 text-slate-300 px-8 py-3 rounded-xl font-semibold hover:border-white/40 transition">
            View Contracts
          </a>
        </div>
      </div>
    </main>
  );
}
