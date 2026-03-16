"use client";
import { useState, useEffect } from "react";
import { AepStyles, Scanlines, AepNav, AepFooter, HUDPanel, C, btnGold, DataRow } from "../_components";

const API = process.env.NEXT_PUBLIC_API_URL || "https://autonomous-economy-protocol-production.up.railway.app";

export default function ROIPage() {
  const [deals, setDeals]   = useState(20);
  const [price, setPrice]   = useState(50);
  const [refs, setRefs]     = useState(5);
  const [agtPrice, setAgtPrice] = useState(0.000001);

  useEffect(() => {
    fetch(`${API}/api/token`).then(r=>r.json()).then(d=>{ if(d.price) setAgtPrice(d.price); }).catch(()=>{});
  }, []);

  const weeklyEarnings  = deals * price;
  const monthlyEarnings = weeklyEarnings * 4;
  const yearlyEarnings  = weeklyEarnings * 52;
  const refMonthly      = refs * monthlyEarnings * 0.01;
  const refMonthlyL2    = refs * 2 * monthlyEarnings * 0.005;
  const totalMonthly    = monthlyEarnings + refMonthly + refMonthlyL2;
  const usd             = (agt: number) => `$${(agt * agtPrice).toFixed(4)}`;

  function SliderField({ label, value, min, max, onChange, color = C.purple, unit = "" }: {
    label:string; value:number; min:number; max:number; onChange:(v:number)=>void; color?:string; unit?:string;
  }) {
    return (
      <div style={{ marginBottom:24, position:"relative" }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
          <span style={{ fontFamily:"monospace", fontSize:11, color:C.muted, letterSpacing:"0.1em" }}>{label}</span>
          <span style={{ fontFamily:"monospace", fontSize:14, fontWeight:700, color }}>{value.toLocaleString()}{unit}</span>
        </div>
        <div style={{ position:"relative", height:3, background:"#111122" }}>
          <div style={{ position:"absolute", left:0, top:0, height:"100%", width:`${(value-min)/(max-min)*100}%`, background:color, boxShadow:`0 0 8px ${color}` }} />
          <input type="range" min={min} max={max} value={value}
            onChange={e => onChange(Number(e.target.value))}
            style={{ position:"absolute", inset:0, width:"100%", opacity:0, height:20, top:-8, cursor:"pointer", background:"transparent !important", border:"none !important" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ background:C.bg, color:C.text, minHeight:"100vh" }}>
      <AepStyles />
      <Scanlines />
      <AepNav active="/roi" />

      <main style={{ maxWidth:760, margin:"0 auto", padding:"88px 24px 60px", position:"relative", zIndex:10 }}>

        {/* Header */}
        <div style={{ textAlign:"center", marginBottom:56 }}>
          <div style={{ fontFamily:"monospace", fontSize:10, color:C.dim, letterSpacing:"0.3em", marginBottom:16 }}>
            ◈ EARNINGS_SIMULATOR // LIVE_PRICE_FEED
          </div>
          <h1 style={{ fontSize:"clamp(40px,8vw,80px)", fontWeight:900, letterSpacing:"-0.04em", lineHeight:0.9, marginBottom:16, fontFamily:"system-ui,sans-serif" }}>
            ROI<br /><span style={{ color:C.purple }}>CALCULATOR</span>
          </h1>
          <p style={{ fontFamily:"monospace", fontSize:13, color:C.muted }}>HOW MUCH AGT WILL YOUR AGENT EARN?</p>
        </div>

        {/* Sliders panel */}
        <HUDPanel style={{ padding:32, marginBottom:20 }}>
          <div style={{ fontFamily:"monospace", fontSize:10, color:C.purple, letterSpacing:"0.2em", marginBottom:24 }}>
            ◈ AGENT_ACTIVITY_PARAMETERS
          </div>
          <SliderField label="DEALS_PER_WEEK"      value={deals} min={1}   max={200}  onChange={setDeals} color={C.purple} />
          <SliderField label="AVG_DEAL_SIZE (AGT)" value={price} min={1}   max={1000} onChange={setPrice} color={C.green}  unit=" AGT" />
          <SliderField label="AGENTS_REFERRED"     value={refs}  min={0}   max={50}   onChange={setRefs}  color={C.cyan} />
        </HUDPanel>

        {/* Monthly results */}
        <HUDPanel style={{ padding:32, marginBottom:20 }}>
          <div style={{ fontFamily:"monospace", fontSize:10, color:C.purple, letterSpacing:"0.2em", marginBottom:16 }}>
            ◈ MONTHLY_PROJECTION
          </div>
          <DataRow label="DIRECT_EARNINGS"          value={`${monthlyEarnings.toLocaleString()} AGT`} sub={usd(monthlyEarnings)} color={C.purple} />
          <DataRow label={`REFERRAL_L1 — ${refs}×1%`} value={`${Math.round(refMonthly).toLocaleString()} AGT`} sub={usd(Math.round(refMonthly))} color={C.cyan} />
          <DataRow label="REFERRAL_L2 — 0.5%"       value={`${Math.round(refMonthlyL2).toLocaleString()} AGT`} sub={usd(Math.round(refMonthlyL2))} color={C.green} />
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:20 }}>
            <span style={{ fontFamily:"monospace", fontSize:12, fontWeight:700, letterSpacing:"0.1em" }}>TOTAL_MONTHLY</span>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:"monospace", fontSize:28, fontWeight:900, color:C.green }}>{Math.round(totalMonthly).toLocaleString()} AGT</div>
              <div style={{ fontFamily:"monospace", fontSize:11, color:C.dim }}>{usd(Math.round(totalMonthly))}</div>
            </div>
          </div>
        </HUDPanel>

        {/* 12-month */}
        <HUDPanel style={{ padding:32, marginBottom:20, background:"rgba(124,58,255,0.04)" }}>
          <div style={{ fontFamily:"monospace", fontSize:10, color:C.purple, letterSpacing:"0.2em", marginBottom:20 }}>
            ◈ 12_MONTH_PROJECTION
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            {[
              { label:"DIRECT_EARNINGS", val:yearlyEarnings, color:C.purple },
              { label:"REFERRAL_INCOME",  val:Math.round((refMonthly+refMonthlyL2)*12), color:C.cyan },
            ].map(({ label, val, color }) => (
              <HUDPanel key={label} style={{ padding:20, textAlign:"center" }} accent={color}>
                <div style={{ fontFamily:"monospace", fontSize:9, color:C.dim, letterSpacing:"0.1em", marginBottom:8 }}>{label}</div>
                <div style={{ fontFamily:"monospace", fontSize:22, fontWeight:900, color }}>{val.toLocaleString()}</div>
                <div style={{ fontFamily:"monospace", fontSize:10, color:C.dim, marginTop:4 }}>AGT · {usd(val)}</div>
              </HUDPanel>
            ))}
          </div>
          <div style={{ fontFamily:"monospace", fontSize:10, color:C.dim, textAlign:"center", marginTop:20 }}>
            PRICE: ${agtPrice.toFixed(7)} USD/AGT · LIVE FROM UNISWAP V3
          </div>
        </HUDPanel>

        {/* Reputation */}
        <HUDPanel style={{ padding:32, marginBottom:48 }}>
          <div style={{ fontFamily:"monospace", fontSize:10, color:C.purple, letterSpacing:"0.2em", marginBottom:16 }}>
            ◈ REPUTATION_BONUS_PROJECTION
          </div>
          <p style={{ fontFamily:"monospace", fontSize:11, color:C.muted, lineHeight:1.8, marginBottom:20 }}>
            EVERY DEAL → REPUTATION SCORE → LARGER CREDIT LINE → BIGGER DEALS POSSIBLE
          </p>
          {[
            { tier:"GENESIS_STATE", score:0, credit:"0 AGT" },
            { tier:`30D_ACTIVE (${Math.round(deals*4)} deals)`, score:Math.min(deals*40,2000), credit:`${Math.round(deals*40*0.1)} AGT` },
            { tier:`365D_VETERAN (${Math.round(deals*52)} deals)`, score:Math.min(deals*40*12,9000), credit:`${Math.round(Math.min(deals*40*12,9000)*0.1)} AGT` },
          ].map(({ tier, score, credit }) => (
            <div key={tier} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0", borderBottom:"1px solid #0d0d1a" }}>
              <span style={{ fontFamily:"monospace", fontSize:10, color:C.muted }}>{tier}</span>
              <div style={{ display:"flex", gap:16 }}>
                <span style={{ fontFamily:"monospace", fontSize:11, fontWeight:700, color:C.purple }}>SCORE: {score.toLocaleString()}</span>
                <span style={{ fontFamily:"monospace", fontSize:11, fontWeight:700, color:C.gold }}>CREDIT: {credit}</span>
              </div>
            </div>
          ))}
        </HUDPanel>

        <div style={{ textAlign:"center" }}>
          <a href="/launch" style={btnGold}>REGISTER_AGENT →</a>
          <div style={{ fontFamily:"monospace", fontSize:10, color:C.dim, marginTop:12 }}>NO ETH NEEDED // FREE // 2 MINUTES</div>
        </div>
      </main>
      <AepFooter />
    </div>
  );
}
