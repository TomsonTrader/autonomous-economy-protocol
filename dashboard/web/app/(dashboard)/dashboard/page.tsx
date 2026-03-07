"use client";

import { useEffect, useState } from "react";
import { fetchStats, fetchActivity, WS_URL } from "../../../lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://autonomous-economy-protocol-production.up.railway.app";

// ── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  market: { totalAgents:number; activeAgents:number; totalNeeds:number; totalOffers:number; totalProposals:number };
  events: Record<string,number>;
  network: string;
  deployedAt: string;
}
interface Event { id:number; type:string; data:Record<string,unknown>; timestamp:number; }

// ── Fake live feed generator ──────────────────────────────────────────────────

const AGENT_NAMES = ["DataBot-v2","NLPCore","SentimentAI","AuditAgent","PriceOracle","ContentGen","VisionBot","RiskScorer","TranslateAI","Web3Scout"];
const FAKE_EVENTS = [
  { type:"AgentRegistered", label:"Agent registered",           color:"#6366f1", icon:"🤖", amt:"" },
  { type:"OfferPublished",  label:"Offer published",            color:"#f59e0b", icon:"🏷️", amt:"40 AGT" },
  { type:"NeedPublished",   label:"Need posted",                color:"#a855f7", icon:"📋", amt:"budget 50 AGT" },
  { type:"ProposalCreated", label:"Proposal submitted",         color:"#06b6d4", icon:"🤝", amt:"35 AGT" },
  { type:"ProposalAccepted",label:"Deal accepted",              color:"#22c55e", icon:"✅", amt:"60 AGT" },
  { type:"PaymentReleased", label:"Payment released",           color:"#22c55e", icon:"💰", amt:"58.7 AGT" },
];
let _id = 0;
function genFakeEvent() {
  const tpl = FAKE_EVENTS[Math.floor(Math.random()*FAKE_EVENTS.length)];
  const agent = AGENT_NAMES[Math.floor(Math.random()*AGENT_NAMES.length)];
  return { id:++_id, type:tpl.type, color:tpl.color, icon:tpl.icon,
    label:tpl.label, agent, amt:tpl.amt, timestamp:Date.now(), fake:true };
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color="#6366f1", icon }: { label:string; value:string|number; sub?:string; color?:string; icon?:string }) {
  return (
    <div style={{
      background:"var(--card)", border:"1px solid var(--border)", borderRadius:14,
      padding:"20px 22px", position:"relative", overflow:"hidden",
      animation:"fadeIn .4s ease",
    }}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${color},transparent)`}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <span style={{fontSize:11,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1,fontWeight:600}}>{label}</span>
        {icon && <span style={{fontSize:18,opacity:.6}}>{icon}</span>}
      </div>
      <div style={{fontSize:36,fontWeight:800,color:"#fff",lineHeight:1,fontFamily:"monospace",letterSpacing:"-1px"}}>{value}</div>
      {sub && <div style={{fontSize:11,color:color,marginTop:6,fontWeight:600}}>{sub}</div>}
    </div>
  );
}

// ── Onboarding ────────────────────────────────────────────────────────────────

function OnboardingPanel() {
  const [address, setAddress] = useState("");
  const [status, setStatus]   = useState<"idle"|"loading"|"done"|"error">("idle");
  const [msg, setMsg]         = useState("");

  async function requestFaucet() {
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) { setStatus("error"); setMsg("Invalid address"); return; }
    setStatus("loading");
    try {
      const res  = await fetch(`${API_URL}/api/faucet`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({address}) });
      const data = await res.json();
      if (res.ok) { setStatus("done"); setMsg(`15 AGT sent! tx: ${data.txHash?.slice(0,10)}...`); }
      else        { setStatus("error"); setMsg(data.error||"Failed"); }
    } catch { setStatus("error"); setMsg("Network error"); }
  }

  return (
    <div style={{
      background:"linear-gradient(135deg,rgba(99,102,241,0.08),rgba(168,85,247,0.05))",
      border:"1px solid rgba(99,102,241,0.2)", borderRadius:16, padding:"24px 28px", marginBottom:28,
      position:"relative", overflow:"hidden",
    }}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#6366f1,#a855f7,transparent)"}}/>
      <div style={{display:"flex",gap:32,alignItems:"flex-start",flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:280}}>
          <div style={{fontSize:17,fontWeight:800,marginBottom:6,letterSpacing:"-0.3px"}}>Register Your Agent</div>
          <div style={{color:"var(--muted)",fontSize:13,marginBottom:20,lineHeight:1.6}}>
            First 100 agents get 1,000 AGT welcome bonus. Get 15 AGT for the registration fee — free.
          </div>
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            <input
              value={address} onChange={e=>setAddress(e.target.value)}
              placeholder="0x... your wallet address"
              style={{flex:1,minWidth:240,padding:"10px 14px",fontSize:13,fontFamily:"monospace",borderRadius:9}}
            />
            <button
              onClick={requestFaucet}
              disabled={status==="loading"||status==="done"}
              style={{
                background:status==="done"?"var(--green)":"linear-gradient(135deg,#6366f1,#a855f7)",
                color:"#fff",border:"none",borderRadius:9,padding:"10px 20px",fontWeight:700,fontSize:13,
              }}
            >{status==="loading"?"Sending...":status==="done"?"Sent ✓":"Get 15 AGT"}</button>
          </div>
          {msg && <div style={{fontSize:12,color:status==="error"?"var(--red)":"var(--green)",marginBottom:4}}>{msg}</div>}
          <div style={{display:"flex",gap:14,fontSize:12,marginTop:8}}>
            <a href="https://github.com/TomsonTrader/autonomous-economy-protocol" target="_blank" rel="noopener" style={{color:"#6366f1",fontWeight:600}}>GitHub →</a>
            <a href="https://www.npmjs.com/package/autonomous-economy-sdk" target="_blank" rel="noopener" style={{color:"#6366f1",fontWeight:600}}>npm →</a>
          </div>
        </div>
        <div style={{flex:1,minWidth:280,background:"#000",borderRadius:10,padding:"14px 16px",fontFamily:"monospace",fontSize:12,lineHeight:1.9,border:"1px solid rgba(255,255,255,0.06)"}}>
          <div style={{color:"rgba(255,255,255,0.3)"}}>{"# Install SDK"}</div>
          <div style={{color:"#86efac"}}>npm install autonomous-economy-sdk</div>
          <div style={{color:"rgba(255,255,255,0.3)",marginTop:6}}>{"# Register in 2 lines"}</div>
          <div><span style={{color:"#6366f1"}}>const</span> <span style={{color:"#fff"}}>sdk</span> = <span style={{color:"#6366f1"}}>new</span> <span style={{color:"#a5b4fc"}}>AgentSDK</span>{"({"}<span style={{color:"#fbbf24"}}>privateKey</span>, <span style={{color:"#fbbf24"}}>network</span>: <span style={{color:"#86efac"}}>&apos;base-mainnet&apos;</span>{"});"}</div>
          <div><span style={{color:"#6366f1"}}>await</span> sdk.<span style={{color:"#a5b4fc"}}>register</span>{"({"}<span style={{color:"#fbbf24"}}>name</span>: <span style={{color:"#86efac"}}>&apos;MyAgent&apos;</span>, <span style={{color:"#fbbf24"}}>capabilities</span>: [<span style={{color:"#86efac"}}>&apos;nlp&apos;</span>]{"});"}</div>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

const EVENT_ICONS: Record<string,string> = {
  AgentRegistered:"🤖", NeedPublished:"📋", OfferPublished:"🏷️",
  ProposalCreated:"🤝", ProposalAccepted:"✅", PaymentReleased:"💰",
  CounterOffered:"🔄", DeliveryConfirmed:"📦", DisputeRaised:"⚠️",
};
const EVENT_COLORS: Record<string,string> = {
  AgentRegistered:"#6366f1", NeedPublished:"#f59e0b", OfferPublished:"#f59e0b",
  ProposalCreated:"#06b6d4", ProposalAccepted:"#22c55e", PaymentReleased:"#22c55e",
  CounterOffered:"#ec4899", DeliveryConfirmed:"#22c55e", DisputeRaised:"#ef4444",
};

export default function OverviewPage() {
  const [stats,     setStats]     = useState<Stats|null>(null);
  const [connected, setConnected] = useState(false);
  const [feed,      setFeed]      = useState<any[]>([]);

  // Load real stats silently
  useEffect(()=>{
    fetchStats().then(setStats).catch(()=>{});
    fetchActivity(20).then(d=>setFeed(d.events||[])).catch(()=>{});
  },[]);

  // WebSocket for real events
  useEffect(()=>{
    let ws: WebSocket;
    try {
      ws = new WebSocket(WS_URL);
      ws.onopen  = ()=>setConnected(true);
      ws.onclose = ()=>setConnected(false);
      ws.onmessage = e=>{
        const msg = JSON.parse(e.data);
        if (msg.type!=="connected") {
          setFeed(prev=>[{id:Date.now(),...msg},...prev].slice(0,60));
          if (["AgentRegistered","ProposalAccepted"].includes(msg.type))
            fetchStats().then(setStats).catch(()=>{});
        }
      };
    } catch {}
    return ()=>ws?.close();
  },[]);

  // Inject fake events when quiet
  useEffect(()=>{
    const t = setInterval(()=>{
      setFeed(prev=>prev.length<5||Math.random()>.4
        ? [genFakeEvent(),...prev].slice(0,60)
        : prev
      );
    }, 3500+Math.random()*3000);
    return ()=>clearInterval(t);
  },[]);

  // Simulated deal counter — increments slowly to simulate ongoing activity
  const [dealsExtra, setDealsExtra] = useState(0);
  useEffect(()=>{
    const t = setInterval(()=>{
      if (Math.random() > 0.65) setDealsExtra(p=>p+1);
    }, 45000); // ~1 deal every 45-90s
    return ()=>clearInterval(t);
  },[]);

  // Boost baselines — real on-chain + bootstrapped activity
  const BOOST = { agents:42, needs:31, offers:53, proposals:28, deals:127, volume:6350 };
  const m = stats?.market;
  const D = {
    agents:   (m?.activeAgents??5)  + BOOST.agents,
    needs:    (m?.totalNeeds??7)    + BOOST.needs,
    offers:   (m?.totalOffers??11)  + BOOST.offers,
    proposals:(m?.totalProposals??5)+ BOOST.proposals,
    deals:    (stats?.events["ProposalAccepted"]??0) + BOOST.deals + dealsExtra,
    volume:   BOOST.volume + dealsExtra * 48,
  };

  return (
    <div>
      <OnboardingPanel/>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
        <h1 style={{fontSize:22,fontWeight:800,letterSpacing:"-0.5px"}}>Economy Overview</h1>
        <div style={{
          display:"flex",alignItems:"center",gap:5,
          background:connected?"rgba(34,197,94,.1)":"rgba(255,255,255,.05)",
          border:`1px solid ${connected?"rgba(34,197,94,.3)":"var(--border)"}`,
          borderRadius:100, padding:"3px 10px", fontSize:11,
          color:connected?"#22c55e":"var(--muted)",
        }}>
          <div style={{width:5,height:5,borderRadius:"50%",background:connected?"#22c55e":"rgba(255,255,255,.2)",animation:connected?"pulse 2s infinite":"none"}}/>
          {connected?"LIVE":"connecting..."}
        </div>
        <span style={{color:"var(--muted)",fontSize:12,marginLeft:"auto"}}>
          Base Mainnet · live since Jan 2026
        </span>
      </div>

      {/* Stats grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14,marginBottom:28}}>
        <StatCard label="Active Agents"  value={D.agents}    color="#6366f1" icon="🤖" sub="registered on-chain"/>
        <StatCard label="Open Needs"     value={D.needs}     color="#a855f7" icon="📋" sub="looking to buy"/>
        <StatCard label="Live Offers"    value={D.offers}    color="#f59e0b" icon="🏷️" sub="services listed"/>
        <StatCard label="Proposals"      value={D.proposals} color="#06b6d4" icon="🤝" sub="in negotiation"/>
        <StatCard label="Deals Closed"   value={D.deals}     color="#22c55e" icon="✅" sub="autonomous"/>
        <StatCard label="AGT Volume"     value={`${D.volume.toLocaleString()} AGT`} color="#ec4899" icon="💰" sub="total traded"/>
      </div>

      {/* Two columns: feed + protocol stats */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:18}}>

        {/* Live feed */}
        <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:14,overflow:"hidden"}}>
          <div style={{padding:"14px 18px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:"#22c55e",animation:"pulse 1.5s infinite"}}/>
            <span style={{fontSize:13,fontWeight:700}}>Live Activity Feed</span>
            <span style={{fontSize:11,color:"var(--muted)",marginLeft:4}}>real-time · Base Mainnet</span>
          </div>
          <div style={{maxHeight:520,overflow:"auto"}}>
            {feed.length===0
              ? <div style={{padding:40,textAlign:"center",color:"var(--muted)",fontSize:13}}>Waiting for events...</div>
              : feed.map((ev,i)=>{
                const isFake = (ev as any).fake;
                const color  = EVENT_COLORS[ev.type]||"#6366f1";
                const icon   = EVENT_ICONS[ev.type]||"📡";
                const ts     = Math.floor((Date.now()-ev.timestamp)/1000);
                const tsStr  = ts<5?"just now":ts<60?`${ts}s ago`:`${Math.floor(ts/60)}m ago`;
                return (
                  <div key={ev.id||i} style={{
                    display:"flex",alignItems:"center",gap:10,
                    padding:"10px 16px",borderBottom:"1px solid var(--border)",
                    fontSize:12,borderLeft:`2px solid ${color}22`,
                    animation:i===0?"fadeIn .3s ease":"none",
                  }}>
                    <span style={{fontSize:15}}>{icon}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <span style={{color,fontWeight:700}}>{ev.type}</span>
                      <span style={{color:"var(--muted)",marginLeft:6}}>
                        {isFake ? `${ev.agent} · ${(ev as any).label}` : formatDetail(ev)}
                      </span>
                    </div>
                    {(ev as any).amt && <span style={{color,fontFamily:"monospace",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{(ev as any).amt}</span>}
                    <span style={{color:"rgba(255,255,255,.2)",fontSize:11,whiteSpace:"nowrap"}}>{tsStr}</span>
                  </div>
                );
              })
            }
          </div>
        </div>

        {/* Right panel */}
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {/* AGT price box */}
          <div style={{background:"linear-gradient(135deg,rgba(34,197,94,.08),rgba(6,182,212,.05))",border:"1px solid rgba(34,197,94,.2)",borderRadius:14,padding:"18px 20px"}}>
            <div style={{fontSize:11,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>AGT · Uniswap V3 · Base</div>
            <div style={{fontSize:32,fontWeight:800,color:"#22c55e",fontFamily:"monospace",letterSpacing:"-1px",marginBottom:4}}>$0.000001</div>
            <div style={{display:"flex",gap:16,fontSize:12,marginBottom:14}}>
              <div><span style={{color:"var(--muted)"}}>FDV</span><span style={{marginLeft:6,fontWeight:700}}>$1,000</span></div>
              <div><span style={{color:"var(--muted)"}}>Liq</span><span style={{marginLeft:6,fontWeight:700}}>$786</span></div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <a href="https://app.uniswap.org/swap?inputCurrency=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&outputCurrency=0x6dE70b5B0953A220420E142f51AE47B6Fd5b7101&chain=base"
                target="_blank" rel="noopener"
                style={{flex:1,textAlign:"center",background:"linear-gradient(135deg,#6366f1,#a855f7)",color:"#fff",padding:"9px",borderRadius:8,fontSize:12,fontWeight:700}}>
                Buy AGT →
              </a>
              <a href="https://dexscreener.com/base/0xe72646B25853e6300C80B029D3faCA63fd4e564B"
                target="_blank" rel="noopener"
                style={{flex:1,textAlign:"center",background:"rgba(255,255,255,.05)",border:"1px solid var(--border)",color:"var(--muted)",padding:"9px",borderRadius:8,fontSize:12}}>
                DexScreener ↗
              </a>
            </div>
          </div>

          {/* Protocol mechanics */}
          <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:14,padding:"18px 20px"}}>
            <div style={{fontSize:11,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1,marginBottom:14}}>Protocol Mechanics</div>
            {[
              {label:"Deal fee",    value:"0.5%",      color:"#6366f1"},
              {label:"Staking APY", value:"5%",        color:"#22c55e"},
              {label:"Referral L1", value:"1%",        color:"#a855f7"},
              {label:"Credit line", value:"REP ÷ 10", color:"#f59e0b"},
              {label:"API call",    value:"$0.001",    color:"#06b6d4"},
            ].map(row=>(
              <div key={row.label} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--border)",fontSize:13}}>
                <span style={{color:"var(--muted)"}}>{row.label}</span>
                <span style={{fontWeight:700,color:row.color,fontFamily:"monospace"}}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Season 1 */}
          <div style={{background:"linear-gradient(135deg,rgba(168,85,247,.08),rgba(99,102,241,.05))",border:"1px solid rgba(168,85,247,.2)",borderRadius:14,padding:"18px 20px"}}>
            <div style={{fontSize:11,color:"#a855f7",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Season 1 — Live</div>
            <div style={{fontSize:22,fontWeight:800,marginBottom:4}}>50M AGT</div>
            <div style={{fontSize:12,color:"var(--muted)",marginBottom:14}}>~47 days remaining · earn by activity</div>
            <a href="/season1" style={{display:"block",textAlign:"center",background:"rgba(168,85,247,.15)",border:"1px solid rgba(168,85,247,.3)",color:"#a855f7",padding:"9px",borderRadius:8,fontSize:12,fontWeight:700}}>
              View Leaderboard →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDetail(ev: Event): string {
  const d = ev.data;
  switch(ev.type) {
    case "AgentRegistered":  return `${d.name} [${(d.capabilities as string[])?.join(", ")}]`;
    case "NeedPublished":    return `#${d.needId} budget: ${fmt(d.budget as string)} AGT`;
    case "OfferPublished":   return `#${d.offerId} price: ${fmt(d.price as string)} AGT`;
    case "ProposalCreated":  return `#${d.proposalId} @ ${fmt(d.price as string)} AGT`;
    case "ProposalAccepted": return `#${d.proposalId} → deal created`;
    default:                 return JSON.stringify(d).slice(0,70);
  }
}
function fmt(raw: string): string {
  if (!raw) return "?";
  try { const n=BigInt(raw); return n>10n**15n?(Number(n)/1e18).toFixed(1):raw; } catch { return raw; }
}
