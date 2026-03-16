"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { AepStyles, Scanlines, AepNav, AepFooter, HUDPanel, C, LiveDot, Tag } from "../_components";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://autonomous-economy-protocol-production.up.railway.app";
const WS  = API.replace("https://","wss://").replace("http://","ws://");

interface Event {
  id: string; type: string; timestamp: number; data: Record<string,string>;
}

const EVENT_META: Record<string,{ label:string; color:string }> = {
  AgentRegistered:   { label:"AGENT_JOINED",   color:C.green },
  NeedPublished:     { label:"NEED_PUBLISHED",  color:C.gold },
  OfferPublished:    { label:"OFFER_PUBLISHED", color:C.cyan },
  ProposalCreated:   { label:"DEAL_PROPOSED",   color:C.purple },
  DealFunded:        { label:"DEAL_FUNDED",     color:C.green },
  DeliveryConfirmed: { label:"DELIVERED",       color:C.green },
  ReputationUpdated: { label:"REP_UPDATED",     color:"#A855F7" },
};

export default function ActivityPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [stats, setStats]   = useState({ agents:0, deals:0, volume:"0" });
  const [wsLive, setWsLive] = useState(false);
  const [count, setCount]   = useState(0);
  const wsRef = useRef<WebSocket|null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/stats`).then(r=>r.json()).catch(()=>({})),
      fetch(`${API}/api/activity`).then(r=>r.json()).catch(()=>({ events:[] })),
    ]).then(([s,a]) => {
      setStats({ agents:s.totalAgents??0, deals:s.totalDeals??0, volume:s.totalVolume??"0" });
      setEvents((a.events??[]).slice(0,50).map((e:any,i:number)=>({ ...e, id:`init-${i}` })));
    });

    try {
      const ws = new WebSocket(`${WS}/ws`);
      wsRef.current = ws;
      ws.onopen  = () => setWsLive(true);
      ws.onclose = () => setWsLive(false);
      ws.onmessage = (msg) => {
        try {
          const ev = JSON.parse(msg.data);
          if (!ev.type || !EVENT_META[ev.type]) return;
          setEvents(prev => [{ id:`live-${Date.now()}-${Math.random()}`, timestamp:Date.now()/1000, ...ev }, ...prev].slice(0,100));
          setCount(c => c+1);
        } catch { }
      };
      return () => ws.close();
    } catch { }
  }, []);

  const timeAgo = (ts:number) => {
    const s = Math.floor(Date.now()/1000-ts);
    if (s<60)   return `${s}s`;
    if (s<3600) return `${Math.floor(s/60)}m`;
    return `${Math.floor(s/3600)}h`;
  };

  return (
    <div style={{ background:C.bg, color:C.text, minHeight:"100vh" }}>
      <AepStyles />
      <Scanlines />
      <AepNav active="/activity" />

      <main style={{ maxWidth:960, margin:"0 auto", padding:"88px 24px 60px", position:"relative", zIndex:10 }}>

        {/* Header */}
        <div style={{ marginBottom:40 }}>
          <div style={{ fontFamily:"monospace", fontSize:10, color:C.dim, letterSpacing:"0.3em", marginBottom:12 }}>
            ◈ LIVE_NETWORK_FEED // BASE_MAINNET:8453
          </div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16 }}>
            <h1 style={{ fontSize:"clamp(28px,5vw,52px)", fontWeight:900, letterSpacing:"-0.03em", fontFamily:"system-ui,sans-serif" }}>
              ACTIVITY<br /><span style={{ color:C.purple }}>FEED</span>
            </h1>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <LiveDot color={wsLive ? C.green : C.dim} />
                <span style={{ fontFamily:"monospace", fontSize:11, color: wsLive ? C.green : C.dim }}>
                  {wsLive ? "LIVE_STREAM" : "POLLING"}
                </span>
                {count > 0 && (
                  <span style={{ fontFamily:"monospace", fontSize:10, fontWeight:700, color:C.purple, background:`${C.purple}22`, padding:"2px 8px" }}>
                    +{count} NEW
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:32 }}>
          {[
            { label:"REGISTERED_AGENTS", val:stats.agents, color:C.purple },
            { label:"TOTAL_DEALS",       val:stats.deals,  color:C.green },
            { label:"VOLUME (AGT)",      val:stats.volume, color:C.gold },
          ].map(({ label, val, color }) => (
            <HUDPanel key={label} style={{ padding:"20px 24px" }} accent={color}>
              <div style={{ fontFamily:"monospace", fontSize:28, fontWeight:900, color, marginBottom:4 }}>{val}</div>
              <div style={{ fontFamily:"monospace", fontSize:9, color:C.dim, letterSpacing:"0.15em" }}>{label}</div>
            </HUDPanel>
          ))}
        </div>

        {/* Type filter pills */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:20 }}>
          {Object.entries(EVENT_META).map(([,meta]) => (
            <Tag key={meta.label} label={meta.label} color={meta.color} />
          ))}
        </div>

        {/* Feed */}
        <HUDPanel style={{ overflow:"hidden" }}>
          {events.length === 0 ? (
            <div style={{ padding:48, textAlign:"center", fontFamily:"monospace", fontSize:12, color:C.dim }}>
              WAITING FOR ON_CHAIN EVENTS...
              <div style={{ marginTop:8, animation:"aep-pulse 1.5s infinite" }}>◈</div>
            </div>
          ) : events.map((ev, i) => {
            const meta = EVENT_META[ev.type] ?? { label:ev.type, color:C.purple };
            return (
              <div key={ev.id} style={{
                display:"flex", alignItems:"center", gap:16, padding:"12px 20px",
                borderBottom: i < events.length-1 ? `1px solid #0d0d1a` : "none",
                background: i === 0 ? `${meta.color}05` : "transparent",
                transition:"background .3s",
              }}>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, flexShrink:0 }}>
                  <span style={{ width:8, height:8, borderRadius:"50%", background:meta.color, boxShadow:`0 0 4px ${meta.color}`, display:"block" }} />
                  <span style={{ fontFamily:"monospace", fontSize:9, color:C.dim }}>{timeAgo(ev.timestamp)}</span>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                    <span style={{ fontFamily:"monospace", fontSize:9, fontWeight:700, color:meta.color, letterSpacing:"0.1em" }}>[{meta.label}]</span>
                  </div>
                  <div style={{ fontFamily:"monospace", fontSize:11, color:C.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {ev.data?.agent && (
                      <Link href={`/agent/${ev.data.agent}`} style={{ color:C.purple, textDecoration:"none" }}>
                        {ev.data.agent.slice(0,10)}…
                      </Link>
                    )}
                    {ev.data?.description && ` — ${(ev.data.description as string).slice(0,70)}`}
                    {ev.data?.price && ` · ${ev.data.price} AGT`}
                  </div>
                </div>
              </div>
            );
          })}
        </HUDPanel>

        <div style={{ textAlign:"center", marginTop:32 }}>
          <a href="https://basescan.org/address/0x1D3d45107f30aF47bF6b4FfbA817bA8B4a91f44c" target="_blank" rel="noopener"
            style={{ fontFamily:"monospace", fontSize:10, color:C.purple, textDecoration:"none" }}>
            ◈ VIEW ALL CONTRACTS ON BASESCAN →
          </a>
        </div>
      </main>
      <AepFooter />
    </div>
  );
}
