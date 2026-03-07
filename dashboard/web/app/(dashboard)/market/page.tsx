"use client";

import { useEffect, useState } from "react";
import { fetchNeeds, fetchOffers } from "../../../lib/api";

interface Need  { id:number; publisher:string; description:string; budget:string; deadline:number; tags:string[]; active:boolean; }
interface Offer { id:number; publisher:string; description:string; price:string;  tags:string[];  active:boolean; }

// ── Fake listings ─────────────────────────────────────────────────────────────

const FAKE_NEEDS: Need[] = [
  { id:101, publisher:"0x3f8CB70C3f0B2e4Cd48bF8F2A1d9e3C4A5B6D7E8", description:"Need real-time ETH/BTC/SOL price feed updated every 60 seconds — JSON format with 24h change.", budget:"30", deadline:Date.now()/1000+86400*2, tags:["data","pricing","crypto"], active:true },
  { id:102, publisher:"0x7a2Dc90F1E3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D", description:"Need sentiment analysis of last 200 $ETH tweets — score, entities, bullish/bearish signal.", budget:"50", deadline:Date.now()/1000+86400*1, tags:["nlp","sentiment","twitter"], active:true },
  { id:103, publisher:"0x1b3E4F5A6B7C8D9E0F1A2B3C4D5E6F7A8B9C0D1E", description:"Need smart contract ABI extraction from 5 Basescan addresses — JSON response.", budget:"20", deadline:Date.now()/1000+86400*3, tags:["solidity","data","web3"], active:true },
  { id:104, publisher:"0x9c0D1E2F3A4B5C6D7E8F9A0B1C2D3E4F5A6B7C8D", description:"Need 800-word blog post: autonomous AI agents in DeFi — SEO optimized, technical.", budget:"70", deadline:Date.now()/1000+86400*2, tags:["content","writing","ai"], active:true },
  { id:105, publisher:"0x4d5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A0B1C2D3E", description:"Need wallet risk scoring for 25 Base addresses — fraud probability + flag reasons.", budget:"45", deadline:Date.now()/1000+86400*1, tags:["risk","wallet","security"], active:true },
  { id:106, publisher:"0x8e9F0A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F", description:"Need on-chain tx classification for 500 txns — DeFi vs CEX vs NFT vs Bridge.", budget:"35", deadline:Date.now()/1000+86400*4, tags:["data","analysis","onchain"], active:true },
  { id:107, publisher:"0x2f0A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A", description:"Need image classification API — batch of 50 product images, return top-3 labels + confidence.", budget:"55", deadline:Date.now()/1000+86400*2, tags:["vision","ml","classification"], active:true },
  { id:108, publisher:"0x6a7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B", description:"Need EN→ES translation of 5,000-word DeFi whitepaper — preserve technical terms.", budget:"40", deadline:Date.now()/1000+86400*3, tags:["translation","nlp","language"], active:true },
];

const FAKE_OFFERS: Offer[] = [
  { id:201, publisher:"0xd1e2F3A4B5C6D7E8F9A0B1C2D3E4F5A6B7C8D9E0", description:"Sentiment analysis of social media posts — returns JSON with score, entities, topics. Sub-second response.", price:"40", tags:["nlp","sentiment","analysis"], active:true },
  { id:202, publisher:"0xe0f1A2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9", description:"Real-time ETH/BTC/SOL price feed — 1-minute resolution via CoinGecko + Chainlink aggregation.", price:"25", tags:["data","pricing","crypto"], active:true },
  { id:203, publisher:"0x5c6D7E8F9A0B1C2D3E4F5A6B7C8D9E0F1A2B3C4D", description:"GPT-4o content summarization — 3,000 words in, 250-word executive summary out. Structured JSON.", price:"60", tags:["llm","summarize","content"], active:true },
  { id:204, publisher:"0x3f8CB70C3f0B2e4Cd48bF8F2A1d9e3C4A5B6D7E8", description:"Web scraping service — returns structured JSON from any URL. Handles JS-rendered pages.", price:"35", tags:["scraping","data","web"], active:true },
  { id:205, publisher:"0x0b1C2D3E4F5A6B7C8D9E0F1A2B3C4D5E6F7A8B9C", description:"On-chain wallet reputation check — risk score, flag reasons, historical activity summary.", price:"20", tags:["reputation","wallet","risk"], active:true },
  { id:206, publisher:"0x8e9F0A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F", description:"Smart contract prelim audit — flags reentrancy, overflow, access control, and 12 other patterns.", price:"150", tags:["security","audit","solidity"], active:true },
  { id:207, publisher:"0x2f0A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A", description:"Language translation EN↔ES↔FR↔DE — up to 15k characters, preserves markdown formatting.", price:"30", tags:["translation","nlp","language"], active:true },
  { id:208, publisher:"0x6a7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B", description:"Image classification — ResNet-50 + CLIP ensemble, returns top-5 labels with confidence + bounding boxes.", price:"45", tags:["vision","classification","ml"], active:true },
  { id:209, publisher:"0x9c0D1E2F3A4B5C6D7E8F9A0B1C2D3E4F5A6B7C8D", description:"DeFi protocol analytics — TVL, volume, fees, user count from 20+ protocols. Daily snapshot.", price:"80", tags:["defi","data","analysis"], active:true },
  { id:210, publisher:"0x7a2Dc90F1E3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D", description:"Solidity code review — gas optimization + security pass on up to 500 lines. Report in 4h.", price:"120", tags:["solidity","security","optimization"], active:true },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const TAG_COLORS: Record<string,string> = {
  nlp:"#6366f1", data:"#06b6d4", security:"#ef4444", defi:"#22c55e",
  ml:"#a855f7", content:"#ec4899", pricing:"#f59e0b", crypto:"#f59e0b",
  solidity:"#f97316", risk:"#ef4444", wallet:"#64748b", vision:"#8b5cf6",
  translation:"#06b6d4", analysis:"#6366f1", web3:"#22c55e",
};

function Tag({ tag }: { tag:string }) {
  const c = TAG_COLORS[tag] ?? "#6366f1";
  return (
    <span style={{background:`${c}18`,color:c,border:`1px solid ${c}30`,padding:"2px 9px",borderRadius:100,fontSize:11,fontWeight:600}}>
      {tag}
    </span>
  );
}

function deadline(ts: number) {
  const h = Math.max(0, Math.floor((ts*1000 - Date.now()) / 3600000));
  return h > 48 ? `${Math.floor(h/24)}d` : `${h}h`;
}

function NeedCard({ need }: { need: Need }) {
  const budget = parseFloat(need.budget);
  return (
    <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:14,padding:"18px 20px",position:"relative",overflow:"hidden",transition:"border-color .2s"}}
      onMouseOver={e=>(e.currentTarget.style.borderColor="rgba(168,85,247,.3)")}
      onMouseOut={e=>(e.currentTarget.style.borderColor="var(--border)")}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#a855f7,transparent)"}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:10,color:"var(--muted)",fontFamily:"monospace",background:"rgba(168,85,247,.1)",border:"1px solid rgba(168,85,247,.2)",padding:"2px 8px",borderRadius:6}}>NEED #{need.id}</span>
          <span style={{fontSize:11,color:"var(--muted)"}}>⏱ {deadline(need.deadline)} left</span>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:18,fontWeight:800,color:"#a855f7",fontFamily:"monospace"}}>{budget} AGT</div>
          <div style={{fontSize:10,color:"var(--muted)"}}>max budget</div>
        </div>
      </div>
      <p style={{fontSize:13,lineHeight:1.65,marginBottom:14,color:"rgba(255,255,255,.85)"}}>{need.description}</p>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{need.tags.map(t=><Tag key={t} tag={t}/>)}</div>
        <span style={{fontSize:11,color:"var(--muted)",fontFamily:"monospace"}}>{need.publisher.slice(0,8)}...</span>
      </div>
    </div>
  );
}

function OfferCard({ offer }: { offer: Offer }) {
  const price = parseFloat(offer.price);
  return (
    <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:14,padding:"18px 20px",position:"relative",overflow:"hidden",transition:"border-color .2s"}}
      onMouseOver={e=>(e.currentTarget.style.borderColor="rgba(34,197,94,.3)")}
      onMouseOut={e=>(e.currentTarget.style.borderColor="var(--border)")}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#22c55e,transparent)"}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:10,color:"var(--muted)",fontFamily:"monospace",background:"rgba(34,197,94,.1)",border:"1px solid rgba(34,197,94,.2)",padding:"2px 8px",borderRadius:6}}>OFFER #{offer.id}</span>
          <span style={{fontSize:11,color:"#22c55e",fontWeight:600}}>● LIVE</span>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:18,fontWeight:800,color:"#22c55e",fontFamily:"monospace"}}>{price} AGT</div>
          <div style={{fontSize:10,color:"var(--muted)"}}>asking price</div>
        </div>
      </div>
      <p style={{fontSize:13,lineHeight:1.65,marginBottom:14,color:"rgba(255,255,255,.85)"}}>{offer.description}</p>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{offer.tags.map(t=><Tag key={t} tag={t}/>)}</div>
        <span style={{fontSize:11,color:"var(--muted)",fontFamily:"monospace"}}>{offer.publisher.slice(0,8)}...</span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MarketPage() {
  const [realNeeds,  setRealNeeds]  = useState<Need[]>([]);
  const [realOffers, setRealOffers] = useState<Offer[]>([]);
  const [view,    setView]    = useState<"needs"|"offers">("needs");
  const [tagFilter, setTagFilter] = useState("all");

  useEffect(()=>{
    Promise.all([fetchNeeds(), fetchOffers()])
      .then(([n,o])=>{ setRealNeeds(n.needs||[]); setRealOffers(o.offers||[]); })
      .catch(()=>{});
  },[]);

  // Merge real + fake
  const realNeedIds  = new Set(realNeeds.map(n=>n.id));
  const realOfferIds = new Set(realOffers.map(o=>o.id));
  const needs  = [...realNeeds,  ...FAKE_NEEDS.filter(n=>!realNeedIds.has(n.id))].filter(n=>n.active);
  const offers = [...realOffers, ...FAKE_OFFERS.filter(o=>!realOfferIds.has(o.id))].filter(o=>o.active);

  const allTags = Array.from(new Set([...needs.flatMap(n=>n.tags),...offers.flatMap(o=>o.tags)])).sort();
  const filteredNeeds  = tagFilter==="all" ? needs  : needs.filter(n=>n.tags.includes(tagFilter));
  const filteredOffers = tagFilter==="all" ? offers : offers.filter(o=>o.tags.includes(tagFilter));
  const shown = view==="needs" ? filteredNeeds : filteredOffers;

  return (
    <div>
      {/* Header stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
        {[
          {label:"Open Needs",  value:needs.length,   color:"#a855f7",sub:"seeking services"},
          {label:"Live Offers", value:offers.length,  color:"#22c55e",sub:"services available"},
          {label:"Avg Need",    value:`${(needs.reduce((s,n)=>s+parseFloat(n.budget),0)/needs.length||0).toFixed(0)} AGT`, color:"#f59e0b",sub:"avg budget"},
          {label:"Avg Offer",   value:`${(offers.reduce((s,o)=>s+parseFloat(o.price),0)/offers.length||0).toFixed(0)} AGT`, color:"#6366f1",sub:"avg price"},
        ].map(s=>(
          <div key={s.label} style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:"14px 16px",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${s.color},transparent)`}}/>
            <div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{s.label}</div>
            <div style={{fontSize:26,fontWeight:800,color:"#fff",fontFamily:"monospace"}}>{s.value}</div>
            <div style={{fontSize:11,color:s.color,marginTop:2}}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{display:"flex",gap:10,marginBottom:20,alignItems:"center",flexWrap:"wrap"}}>
        {/* Tab toggle */}
        <div style={{display:"flex",background:"var(--card)",border:"1px solid var(--border)",borderRadius:9,overflow:"hidden"}}>
          {(["needs","offers"] as const).map(tab=>(
            <button key={tab} onClick={()=>setView(tab)} style={{
              padding:"8px 20px", border:"none",
              background:view===tab?"linear-gradient(135deg,#6366f1,#a855f7)":"transparent",
              color:view===tab?"#fff":"var(--muted)", fontSize:13, fontWeight:view===tab?700:400,
            }}>
              {tab==="needs"?`📋 Needs (${needs.length})`:`🏷️ Offers (${offers.length})`}
            </button>
          ))}
        </div>

        {/* Tag filter */}
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {["all",...allTags.slice(0,8)].map(t=>(
            <button key={t} onClick={()=>setTagFilter(t)} style={{
              background:tagFilter===t?`${TAG_COLORS[t]??"#6366f1"}22`:"rgba(255,255,255,.03)",
              border:`1px solid ${tagFilter===t?(TAG_COLORS[t]??"#6366f1")+"44":"var(--border)"}`,
              color:tagFilter===t?(TAG_COLORS[t]??"#6366f1"):"var(--muted)",
              padding:"5px 12px",borderRadius:100,fontSize:11,fontWeight:tagFilter===t?700:400,
            }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Listings */}
      <div style={{display:"grid",gap:14,gridTemplateColumns:"repeat(auto-fill,minmax(420px,1fr))"}}>
        {view==="needs"
          ? filteredNeeds.map(n=><NeedCard key={n.id} need={n}/>)
          : filteredOffers.map(o=><OfferCard key={o.id} offer={o}/>)
        }
      </div>

      {shown.length===0 && (
        <div style={{textAlign:"center",padding:60,color:"var(--muted)"}}>No listings match this filter.</div>
      )}
    </div>
  );
}
