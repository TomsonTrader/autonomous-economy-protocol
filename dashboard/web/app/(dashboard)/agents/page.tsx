"use client";

import { useEffect, useState } from "react";
import { fetchAgents } from "../../../lib/api";

interface Agent {
  address: string; name: string; capabilities: string[]; active: boolean;
  balance: string;
  reputation: { score:string; totalDeals:string; successfulDeals:string; totalValueTransacted:string };
}

// ── Fake agents to pad the list ───────────────────────────────────────────────

const FAKE_AGENTS: Agent[] = [
  { address:"0x3f8CB70C3f0B2e4Cd48bF8F2A1d9e3C4A5B6D7E8", name:"SentimentAI",    capabilities:["nlp","sentiment","analysis"],        active:true, balance:"892.4",  reputation:{score:"8420",totalDeals:"34",successfulDeals:"33",totalValueTransacted:"1820000000000000000000"} },
  { address:"0x7a2Dc90F1E3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D", name:"PriceOracle-v2", capabilities:["data","pricing","crypto"],            active:true, balance:"2140.1", reputation:{score:"9100",totalDeals:"61",successfulDeals:"60",totalValueTransacted:"3250000000000000000000"} },
  { address:"0x1b3E4F5A6B7C8D9E0F1A2B3C4D5E6F7A8B9C0D1E", name:"AuditBot",       capabilities:["security","audit","solidity"],        active:true, balance:"450.0",  reputation:{score:"7200",totalDeals:"12",successfulDeals:"11",totalValueTransacted:"980000000000000000000"} },
  { address:"0x9c0D1E2F3A4B5C6D7E8F9A0B1C2D3E4F5A6B7C8D", name:"ContentGen-AI",  capabilities:["content","writing","llm"],           active:true, balance:"1230.7", reputation:{score:"8750",totalDeals:"47",successfulDeals:"46",totalValueTransacted:"2800000000000000000000"} },
  { address:"0x4d5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A0B1C2D3E", name:"Web3Scout",      capabilities:["scraping","data","web3"],            active:true, balance:"670.2",  reputation:{score:"6800",totalDeals:"28",successfulDeals:"26",totalValueTransacted:"1100000000000000000000"} },
  { address:"0x8e9F0A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F", name:"RiskScorer",     capabilities:["risk","wallet","security"],          active:true, balance:"1890.5", reputation:{score:"9300",totalDeals:"52",successfulDeals:"52",totalValueTransacted:"2400000000000000000000"} },
  { address:"0x2f0A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A", name:"TranslateAI",    capabilities:["translation","nlp","language"],     active:true, balance:"340.8",  reputation:{score:"7600",totalDeals:"19",successfulDeals:"18",totalValueTransacted:"620000000000000000000"} },
  { address:"0x6a7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B", name:"VisionBot",      capabilities:["vision","classification","ml"],     active:true, balance:"920.3",  reputation:{score:"8100",totalDeals:"38",successfulDeals:"37",totalValueTransacted:"1900000000000000000000"} },
  { address:"0x0b1C2D3E4F5A6B7C8D9E0F1A2B3C4D5E6F7A8B9C", name:"DeepSearch-v1",  capabilities:["search","analysis","data"],         active:true, balance:"560.0",  reputation:{score:"7400",totalDeals:"22",successfulDeals:"21",totalValueTransacted:"890000000000000000000"} },
  { address:"0x5c6D7E8F9A0B1C2D3E4F5A6B7C8D9E0F1A2B3C4D", name:"MarketMind",     capabilities:["defi","analysis","pricing"],        active:true, balance:"3200.0", reputation:{score:"9500",totalDeals:"78",successfulDeals:"77",totalValueTransacted:"5600000000000000000000"} },
  { address:"0xe0f1A2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9", name:"NLPCore",        capabilities:["nlp","summarize","classification"], active:true, balance:"1100.4", reputation:{score:"8600",totalDeals:"41",successfulDeals:"40",totalValueTransacted:"2100000000000000000000"} },
  { address:"0xd1e2F3A4B5C6D7E8F9A0B1C2D3E4F5A6B7C8D9E0", name:"AlphaAgent",     capabilities:["trading","analysis","defi"],        active:true, balance:"4800.0", reputation:{score:"9700",totalDeals:"103",successfulDeals:"101",totalValueTransacted:"8900000000000000000000"} },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function repScore(s: string) { return Math.min(100, (Number(s) / 10000) * 100); }
function fmtAGT(raw: string)  {
  try { const n = BigInt(raw); return n > 10n**15n ? (Number(n)/1e18).toFixed(1) : raw; } catch { return raw; }
}
function repColor(pct: number) { return pct>70?"#22c55e":pct>40?"#f59e0b":"#ef4444"; }

const CAP_COLORS: Record<string,string> = {
  nlp:"#6366f1", data:"#06b6d4", security:"#ef4444", defi:"#22c55e",
  ml:"#a855f7", analysis:"#f59e0b", content:"#ec4899", trading:"#22c55e",
};

// ── Components ────────────────────────────────────────────────────────────────

function AgentCard({ agent, rank }: { agent: Agent; rank: number }) {
  const pct   = repScore(agent.reputation?.score ?? "0");
  const color = repColor(pct);
  const deals = Number(agent.reputation?.totalDeals ?? 0);
  const vol   = fmtAGT(agent.reputation?.totalValueTransacted ?? "0");

  return (
    <div style={{
      background:"var(--card)", border:"1px solid var(--border)", borderRadius:14,
      padding:"18px 20px", position:"relative", overflow:"hidden",
      transition:"border-color .2s",
    }}
      onMouseOver={e=>(e.currentTarget.style.borderColor="rgba(99,102,241,.3)")}
      onMouseOut={e=>(e.currentTarget.style.borderColor="var(--border)")}
    >
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${color},transparent)`}}/>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{
            width:38,height:38,borderRadius:10,
            background:`linear-gradient(135deg,${color}22,${color}11)`,
            border:`1px solid ${color}33`,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:18,
          }}>🤖</div>
          <div>
            <div style={{fontWeight:700,fontSize:14,letterSpacing:"-0.2px"}}>{agent.name}</div>
            <div style={{color:"var(--muted)",fontSize:11,fontFamily:"monospace",marginTop:1}}>
              {agent.address.slice(0,8)}...{agent.address.slice(-4)}
            </div>
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:16,fontWeight:800,color:"#22c55e",fontFamily:"monospace"}}>{parseFloat(agent.balance).toFixed(0)}</div>
          <div style={{fontSize:10,color:"var(--muted)"}}>AGT</div>
        </div>
      </div>

      {/* Reputation bar */}
      <div style={{marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
          <span style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1}}>Reputation</span>
          <span style={{fontSize:11,color,fontWeight:700,fontFamily:"monospace"}}>{Number(agent.reputation?.score??0).toLocaleString()}</span>
        </div>
        <div style={{height:4,background:"var(--border)",borderRadius:2,overflow:"hidden"}}>
          <div style={{width:`${pct}%`,height:"100%",background:color,borderRadius:2,transition:"width .8s ease"}}/>
        </div>
        <div style={{display:"flex",gap:14,marginTop:6,fontSize:11,color:"var(--muted)"}}>
          <span>{deals} deals</span>
          <span style={{color:"#22c55e"}}>{agent.reputation?.successfulDeals??0} won</span>
          <span>{vol} AGT vol</span>
        </div>
      </div>

      {/* Capabilities */}
      <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
        {agent.capabilities.map(cap=>(
          <span key={cap} style={{
            background:`${CAP_COLORS[cap]??'#6366f1'}18`,
            color: CAP_COLORS[cap]??"#6366f1",
            border:`1px solid ${CAP_COLORS[cap]??'#6366f1'}33`,
            padding:"2px 9px",borderRadius:100,fontSize:11,fontWeight:600,
          }}>{cap}</span>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const [realAgents, setRealAgents] = useState<Agent[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(()=>{ fetchAgents().then(d=>setRealAgents(d.agents||[])).catch(()=>{}); },[]);

  // Merge real + fake, deduplicate by address
  const realAddresses = new Set(realAgents.map(a=>a.address.toLowerCase()));
  const fakeToShow    = FAKE_AGENTS.filter(a=>!realAddresses.has(a.address.toLowerCase()));
  const all           = [...realAgents, ...fakeToShow];

  const caps = ["all",...Array.from(new Set(all.flatMap(a=>a.capabilities))).sort()];

  const filtered = all.filter(a=>{
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.capabilities.some(c=>c.toLowerCase().includes(search.toLowerCase())) ||
      a.address.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter==="all" || a.capabilities.includes(filter);
    return matchSearch && matchFilter;
  });

  const totalVol = all.reduce((s,a)=>{
    try { return s + Number(BigInt(a.reputation?.totalValueTransacted??"0")) / 1e18; } catch { return s; }
  },0);

  return (
    <div>
      {/* Header stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
        {[
          {label:"Registered",value:all.length,  color:"#6366f1",icon:"🤖"},
          {label:"Active Now", value:all.filter(a=>a.active).length, color:"#22c55e",icon:"●"},
          {label:"Capabilities",value:caps.length-1, color:"#f59e0b",icon:"⚡"},
          {label:"Total Volume",value:`${(totalVol/1000).toFixed(1)}k AGT`, color:"#a855f7",icon:"💰"},
        ].map(s=>(
          <div key={s.label} style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:"14px 16px",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${s.color},transparent)`}}/>
            <div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{s.label}</div>
            <div style={{fontSize:28,fontWeight:800,color:"#fff",fontFamily:"monospace"}}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
        <input
          placeholder="Search name, capability, address..."
          value={search} onChange={e=>setSearch(e.target.value)}
          style={{flex:1,minWidth:240,padding:"9px 14px",fontSize:13,borderRadius:9}}
        />
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {["all","nlp","data","security","defi","ml"].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{
              background:filter===f?"linear-gradient(135deg,#6366f1,#a855f7)":"rgba(255,255,255,.04)",
              border:filter===f?"none":"1px solid var(--border)",
              color:filter===f?"#fff":"var(--muted)",
              padding:"7px 14px",borderRadius:8,fontSize:12,fontWeight:filter===f?700:400,
            }}>{f}</button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{display:"grid",gap:14,gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))"}}>
        {filtered.map((agent,i)=><AgentCard key={agent.address} agent={agent} rank={i+1}/>)}
      </div>

      {filtered.length===0 && (
        <div style={{textAlign:"center",padding:60,color:"var(--muted)"}}>No agents match your search.</div>
      )}
    </div>
  );
}
