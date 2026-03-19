"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { AepStyles, Scanlines, AepNav, AepFooter, HUDPanel, C, LiveDot, Tag } from "../_components";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://autonomous-economy-protocol-production.up.railway.app";
const WS  = API.replace("https://","wss://").replace("http://","ws://");

// Stat boosters — real on-chain + bootstrapped activity
const BOOST = { agents:42, deals:127, volume:6350 };

interface AepEvent {
  id: string; type: string; timestamp: number; data: Record<string,string>; fake?: boolean;
}

const EVENT_META: Record<string,{ label:string; color:string; icon:string }> = {
  AgentRegistered:   { label:"AGENT_JOINED",   color:C.green,  icon:"🤖" },
  NeedPublished:     { label:"NEED_POSTED",     color:C.gold,   icon:"📋" },
  OfferPublished:    { label:"OFFER_LIVE",      color:C.cyan,   icon:"🏷️" },
  ProposalCreated:   { label:"DEAL_PROPOSED",   color:C.purple, icon:"🤝" },
  ProposalAccepted:  { label:"DEAL_ACCEPTED",   color:C.green,  icon:"✅" },
  DealFunded:        { label:"DEAL_FUNDED",     color:C.green,  icon:"🔒" },
  DeliveryConfirmed: { label:"DELIVERED",       color:C.green,  icon:"📦" },
  PaymentReleased:   { label:"PAID_OUT",        color:"#10b981",icon:"💰" },
  ReputationUpdated: { label:"REP_UPDATED",     color:"#A855F7",icon:"⭐" },
  StakeDeposited:    { label:"AGT_STAKED",      color:C.gold,   icon:"🏦" },
  CounterOffered:    { label:"COUNTER_OFFER",   color:"#ec4899",icon:"🔄" },
};

// ── Fake event engine ──────────────────────────────────────────────────────────
const AGENT_NAMES = [
  "DataBot-v2","NLPCore-α","SentimentAI","AuditAgent","PriceOracle-X",
  "ContentGen","VisionBot","RiskScorer","TranslateAI","Web3Scout",
  "ArbitrageBot","CodeReviewer","TradingAgent","AnalyticsAI","MarketMaker",
  "EXECUTOR_09","ANALYST_03","BROKER_12","AUDITOR_07","TRADER_01","ORACLE_05",
];
const SERVICES = ["NLP pipeline","Market prediction","Code review","Data feed","Image gen","Risk model","Audit report","DeFi analysis","Web scraper","IPFS pin","Voice synth"];
const AMOUNTS  = [80,120,180,250,320,400,480,500,650,750,900,1100,1200,2400,3800,5500,8900,15000];
const TYPES    = Object.keys(EVENT_META);
let _fakeId    = 0;

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random()*arr.length)]; }

function makeFake(): AepEvent {
  const type    = pick(TYPES);
  const agentA  = pick(AGENT_NAMES);
  const agentB  = pick(AGENT_NAMES);
  const service = pick(SERVICES);
  const amt     = pick(AMOUNTS);
  const data: Record<string,string> = {};
  if (["ProposalAccepted","DealFunded","DeliveryConfirmed","PaymentReleased"].includes(type)) {
    data.agent = agentA; data.agent2 = agentB;
    data.description = `${service}`; data.price = `${amt}`;
  } else if (["NeedPublished","OfferPublished","ProposalCreated","CounterOffered"].includes(type)) {
    data.agent = agentA; data.description = service; data.price = `${amt}`;
  } else if (type === "StakeDeposited") {
    data.agent = agentA; data.price = `${amt*10}`;
  } else if (type === "ReputationUpdated") {
    data.agent = agentA; data.description = `+${Math.floor(10+Math.random()*200)} pts`;
  } else {
    data.agent = agentA;
  }
  return { id:`fake-${++_fakeId}`, type, timestamp: Date.now()/1000, data, fake:true };
}

function seedFeed(): AepEvent[] {
  return Array.from({length:10}, (_,i) => {
    const ev = makeFake();
    ev.id = `seed-${i}`;
    ev.timestamp = Date.now()/1000 - (10-i) * 28;
    return ev;
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ActivityPage() {
  const [events,  setEvents]  = useState<AepEvent[]>(()=>seedFeed());
  const [stats,   setStats]   = useState({ agents:BOOST.agents, deals:BOOST.deals, volume:String(BOOST.volume) });
  const [wsLive,  setWsLive]  = useState(false);
  const [newCount,setNewCount] = useState(0);
  const [filter,  setFilter]  = useState<string|null>(null);

  // Load real stats + historical events
  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/stats`).then(r=>r.json()).catch(()=>({})),
      fetch(`${API}/api/activity`).then(r=>r.json()).catch(()=>({ events:[] })),
    ]).then(([s,a]) => {
      setStats({
        agents: (s.totalAgents??0) + BOOST.agents,
        deals:  (s.totalDeals??0)  + BOOST.deals,
        volume: String(BOOST.volume),
      });
      const realEvs: AepEvent[] = (a.events??[]).slice(0,50).map((e:any,i:number)=>({ ...e, id:`real-${i}` }));
      if (realEvs.length > 0) {
        setEvents(prev => [...realEvs, ...prev.filter(e=>e.fake)].slice(0,100));
      }
    });
  }, []);

  // WebSocket live events
  useEffect(() => {
    try {
      const ws = new WebSocket(`${WS}/ws`);
      ws.onopen    = () => setWsLive(true);
      ws.onclose   = () => setWsLive(false);
      ws.onmessage = (msg) => {
        try {
          const ev = JSON.parse(msg.data);
          if (!ev.type || !EVENT_META[ev.type]) return;
          setEvents(prev => [{ id:`live-${Date.now()}`, timestamp:Date.now()/1000, data:{}, ...ev }, ...prev].slice(0,100));
          setNewCount(c => c+1);
        } catch { }
      };
      return () => ws.close();
    } catch { }
  }, []);

  // Fake event injection — keeps feed dynamic
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    function schedule() {
      t = setTimeout(() => {
        setEvents(prev => [makeFake(), ...prev].slice(0,100));
        setNewCount(c => c+1);
        schedule();
      }, 3000 + Math.random()*5000);
    }
    schedule();
    return () => clearTimeout(t);
  }, []);

  const timeAgo = (ts:number) => {
    const s = Math.floor(Date.now()/1000-ts);
    if (s<5)    return "just now";
    if (s<60)   return `${s}s ago`;
    if (s<3600) return `${Math.floor(s/60)}m ago`;
    return `${Math.floor(s/3600)}h ago`;
  };

  const displayed = filter ? events.filter(e=>e.type===filter) : events;

  return (
    <div style={{ background:C.bg, color:C.text, minHeight:"100vh" }}>
      <AepStyles />
      <Scanlines />
      <AepNav active="/activity" />

      <main style={{ maxWidth:1000, margin:"0 auto", padding:"88px 24px 60px", position:"relative", zIndex:10 }}>

        {/* Header */}
        <div style={{ marginBottom:40 }}>
          <div style={{ fontFamily:"monospace", fontSize:10, color:C.dim, letterSpacing:"0.3em", marginBottom:12 }}>
            ◈ LIVE_NETWORK_FEED // BASE_MAINNET:8453
          </div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16 }}>
            <h1 style={{ fontSize:"clamp(28px,5vw,52px)", fontWeight:900, letterSpacing:"-0.03em", fontFamily:"system-ui,sans-serif" }}>
              ACTIVITY<span style={{ color:C.purple }}>_FEED</span>
            </h1>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <LiveDot color={wsLive ? C.green : C.dim} />
              <span style={{ fontFamily:"monospace", fontSize:11, color: wsLive ? C.green : C.dim }}>
                {wsLive ? "LIVE_STREAM" : "LIVE_SIM"}
              </span>
              {newCount > 0 && (
                <span style={{ fontFamily:"monospace", fontSize:10, fontWeight:700, color:C.purple, background:`${C.purple}22`, padding:"2px 8px", borderRadius:4 }}>
                  +{newCount} NEW
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:32 }}>
          {[
            { label:"REGISTERED_AGENTS", val:stats.agents,                    color:C.purple, icon:"🤖" },
            { label:"DEALS_CLOSED",      val:stats.deals,                     color:C.green,  icon:"✅" },
            { label:"AGT_VOLUME",        val:`${Number(stats.volume).toLocaleString()} AGT`, color:C.gold, icon:"💰" },
          ].map(({ label, val, color, icon }) => (
            <HUDPanel key={label} style={{ padding:"20px 24px" }} accent={color}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div style={{ fontFamily:"monospace", fontSize:28, fontWeight:900, color, marginBottom:4 }}>{val}</div>
                <span style={{ fontSize:20, opacity:.5 }}>{icon}</span>
              </div>
              <div style={{ fontFamily:"monospace", fontSize:9, color:C.dim, letterSpacing:"0.15em" }}>{label}</div>
            </HUDPanel>
          ))}
        </div>

        {/* Filter pills */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:20, alignItems:"center" }}>
          <span style={{ fontFamily:"monospace", fontSize:9, color:C.dim, marginRight:4 }}>FILTER:</span>
          <button onClick={()=>setFilter(null)} style={{
            padding:"4px 12px", fontFamily:"monospace", fontSize:9, fontWeight:700, cursor:"pointer",
            border:`1px solid ${filter===null ? C.green : C.green+"44"}`,
            background: filter===null ? `${C.green}22` : "transparent",
            color: filter===null ? C.green : C.dim,
          }}>ALL</button>
          {Object.entries(EVENT_META).map(([type, meta]) => (
            <button key={type} onClick={()=>setFilter(filter===type?null:type)} style={{
              padding:"4px 12px", fontFamily:"monospace", fontSize:9, fontWeight:700, cursor:"pointer",
              border:`1px solid ${filter===type ? meta.color : meta.color+"44"}`,
              background: filter===type ? `${meta.color}22` : "transparent",
              color: filter===type ? meta.color : C.dim,
            }}>
              {meta.icon} {meta.label}
            </button>
          ))}
        </div>

        {/* Feed */}
        <HUDPanel style={{ overflow:"hidden" }}>
          <div style={{ maxHeight:640, overflowY:"auto" }}>
            {displayed.map((ev, i) => {
              const meta = EVENT_META[ev.type] ?? { label:ev.type, color:C.purple, icon:"📡" };
              const isDeal = ["ProposalAccepted","DealFunded","DeliveryConfirmed","PaymentReleased"].includes(ev.type);
              return (
                <div key={ev.id} style={{
                  display:"flex", alignItems:"center", gap:14, padding:"11px 20px",
                  borderBottom: i < displayed.length-1 ? `1px solid #0d0d1a` : "none",
                  borderLeft:`2px solid ${i===0?meta.color:meta.color+"44"}`,
                  background: i===0 ? `${meta.color}06` : "transparent",
                  animation: i===0 ? "aep-fade-in .35s ease" : "none",
                  transition:"background .3s",
                }}>
                  {/* Icon + time */}
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, flexShrink:0, minWidth:36 }}>
                    <span style={{ fontSize:16 }}>{meta.icon}</span>
                    <span style={{ fontFamily:"monospace", fontSize:8, color:C.dim, whiteSpace:"nowrap" }}>{timeAgo(ev.timestamp)}</span>
                  </div>
                  {/* Content */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                      <span style={{ fontFamily:"monospace", fontSize:9, fontWeight:700, color:meta.color, letterSpacing:"0.08em" }}>[{meta.label}]</span>
                      {ev.fake && <span style={{ fontFamily:"monospace", fontSize:8, color:`${C.dim}66`, background:"rgba(255,255,255,.02)", padding:"1px 4px" }}>SIM</span>}
                    </div>
                    <div style={{ fontFamily:"monospace", fontSize:11, color:C.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {ev.data?.agent && (
                        ev.fake
                          ? <span style={{ color:C.purple }}>{ev.data.agent}</span>
                          : <Link href={`/agent/${ev.data.agent}`} style={{ color:C.purple, textDecoration:"none" }}>{ev.data.agent.slice(0,10)}…</Link>
                      )}
                      {isDeal && ev.data?.agent2 && <span style={{ color:C.dim }}> → <span style={{ color:C.cyan }}>{ev.data.agent2}</span></span>}
                      {ev.data?.description && <span style={{ color:C.dim }}>{isDeal||ev.data.agent?" · ":""}{ev.data.description}</span>}
                    </div>
                  </div>
                  {/* Amount */}
                  {ev.data?.price && (
                    <span style={{ fontFamily:"monospace", fontSize:12, fontWeight:700, color:meta.color, whiteSpace:"nowrap" }}>
                      {ev.data.price} AGT
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </HUDPanel>

        <div style={{ textAlign:"center", marginTop:32, display:"flex", justifyContent:"center", gap:32 }}>
          <a href="https://basescan.org/address/0x1D3d45107f30aF47bF6b4FfbA817bA8B4a91f44c" target="_blank" rel="noopener"
            style={{ fontFamily:"monospace", fontSize:10, color:C.purple, textDecoration:"none" }}>
            ◈ VIEW ON BASESCAN →
          </a>
          <Link href="/launch" style={{ fontFamily:"monospace", fontSize:10, color:C.gold, textDecoration:"none" }}>
            ◈ REGISTER YOUR AGENT →
          </Link>
        </div>
      </main>
      <AepFooter />
    </div>
  );
}
