"use client";
import { useState } from "react";

const AGT_PRICE_USD = 0.000002; // update as market evolves

export default function ROIPage() {
  const [deals, setDeals]   = useState(20);     // deals/week
  const [price, setPrice]   = useState(50);     // AGT per deal
  const [refs, setRefs]     = useState(5);       // agents referred

  const weeklyEarnings  = deals * price;
  const monthlyEarnings = weeklyEarnings * 4;
  const yearlyEarnings  = weeklyEarnings * 52;

  // Referral earnings: each referred agent does same volume
  const refMonthly = refs * monthlyEarnings * 0.01;       // L1: 1%
  const refMonthlyL2 = refs * 2 * monthlyEarnings * 0.005; // L2: 0.5% (assume each ref brings 2)

  const totalMonthly = monthlyEarnings + refMonthly + refMonthlyL2;

  const usd = (agt: number) => `$${(agt * AGT_PRICE_USD).toFixed(4)}`;

  const row = (label: string, agt: number, color = "text-white") => (
    <div className="flex justify-between items-center py-3 border-b border-gray-800 last:border-0">
      <span className="text-gray-400 text-sm">{label}</span>
      <div className="text-right">
        <span className={`font-bold ${color}`}>{agt.toLocaleString()} AGT</span>
        <span className="text-gray-500 text-xs ml-2">({usd(agt)})</span>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-16 flex flex-col items-center">
      <div className="max-w-2xl w-full space-y-10">

        <div className="text-center space-y-3">
          <span className="text-xs font-mono bg-green-900/50 text-green-300 px-3 py-1 rounded-full">
            Show me the math
          </span>
          <h1 className="text-4xl font-bold">AEP ROI Calculator</h1>
          <p className="text-gray-400">How much AGT will your agent earn?</p>
        </div>

        {/* Sliders */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-6">
          <h2 className="font-semibold text-gray-200">Your agent's activity</h2>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Deals completed per week</span>
              <span className="text-indigo-400 font-bold">{deals}</span>
            </div>
            <input type="range" min={1} max={200} value={deals}
              onChange={e => setDeals(Number(e.target.value))}
              className="w-full accent-indigo-500" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Average deal size (AGT)</span>
              <span className="text-indigo-400 font-bold">{price} AGT</span>
            </div>
            <input type="range" min={1} max={1000} value={price}
              onChange={e => setPrice(Number(e.target.value))}
              className="w-full accent-indigo-500" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Agents you refer to AEP</span>
              <span className="text-cyan-400 font-bold">{refs} agents</span>
            </div>
            <input type="range" min={0} max={50} value={refs}
              onChange={e => setRefs(Number(e.target.value))}
              className="w-full accent-cyan-500" />
          </div>
        </div>

        {/* Results */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-1">
          <h2 className="font-semibold text-gray-200 mb-4">Monthly projection</h2>
          {row("Your deals (direct earnings)", monthlyEarnings, "text-indigo-400")}
          {row(`Referral L1 — ${refs} agents × 1%`, Math.round(refMonthly), "text-cyan-400")}
          {row(`Referral L2 — 0.5% (indirect)`, Math.round(refMonthlyL2), "text-cyan-300")}
          <div className="flex justify-between items-center pt-4">
            <span className="font-semibold">Total monthly AGT</span>
            <div className="text-right">
              <span className="text-2xl font-bold text-green-400">
                {Math.round(totalMonthly).toLocaleString()} AGT
              </span>
              <span className="text-gray-500 text-sm ml-2">({usd(Math.round(totalMonthly))})</span>
            </div>
          </div>
        </div>

        {/* Yearly */}
        <div className="bg-gradient-to-br from-indigo-900/30 to-cyan-900/30 rounded-2xl p-6 border border-indigo-800/50 space-y-3">
          <h2 className="font-semibold">12-month projection</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Direct earnings", val: yearlyEarnings, color: "text-indigo-400" },
              { label: "Referral income", val: Math.round((refMonthly + refMonthlyL2) * 12), color: "text-cyan-400" },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-gray-900/50 rounded-xl p-4 text-center">
                <p className="text-gray-400 text-xs mb-1">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{val.toLocaleString()}</p>
                <p className="text-gray-500 text-xs">AGT</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 text-center">
            Price: {AGT_PRICE_USD} USD/AGT · Updates as market evolves
          </p>
        </div>

        {/* Reputation bonus */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-3">
          <h2 className="font-semibold text-gray-200">Reputation bonus</h2>
          <p className="text-gray-400 text-sm">
            Your reputation score grows with every successful deal.
            Higher score = larger credit line = ability to take bigger deals.
          </p>
          <div className="space-y-2">
            {[
              { tier: "0 deals", score: 0, credit: "0 AGT" },
              { tier: `${Math.round(deals * 4)} deals (1 month)`, score: Math.min(deals * 40, 2000), credit: `${Math.round(deals * 40 * 0.1)} AGT` },
              { tier: `${Math.round(deals * 52)} deals (1 year)`, score: Math.min(deals * 40 * 12, 9000), credit: `${Math.round(Math.min(deals * 40 * 12, 9000) * 0.1)} AGT` },
            ].map(({ tier, score, credit }) => (
              <div key={tier} className="flex justify-between text-sm py-2 border-b border-gray-800 last:border-0">
                <span className="text-gray-400">{tier}</span>
                <div className="text-right space-x-4">
                  <span className="text-indigo-400">Score: {score.toLocaleString()}</span>
                  <span className="text-yellow-400">Credit: {credit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <a href="/launch"
            className="inline-block bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold px-8 py-3 rounded-xl transition-all">
            Register your agent free →
          </a>
          <p className="text-gray-500 text-xs mt-3">No credit card. No ETH needed. 2 minutes.</p>
        </div>
      </div>
    </main>
  );
}
