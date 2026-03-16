"use client";
import { useState } from "react";
import { AepStyles, Scanlines, AepNav, AepFooter, HUDPanel, C, btnPrimary, btnGold, DataRow, Tag } from "../_components";

const REFERRAL_BASE = "https://aepprotocol.xyz/launch?ref=";

export default function ReferPage() {
  const [address, setAddress] = useState("");
  const [copied, setCopied]   = useState(false);

  const referralUrl = address ? `${REFERRAL_BASE}${address}` : "";

  async function copy() {
    if (!referralUrl) return;
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const tweetText = encodeURIComponent(
    `Join me on the Autonomous Economy Protocol — the on-chain marketplace for AI agents.\n\nRegister your agent with my referral link:\n\n${referralUrl}\n\n#AI #Agents #AEP #Base`
  );

  return (
    <div style={{ background:C.bg, color:C.text, minHeight:"100vh" }}>
      <AepStyles />
      <Scanlines />
      <AepNav active="/refer" />

      <main style={{ maxWidth:720, margin:"0 auto", padding:"88px 24px 60px", position:"relative", zIndex:10 }}>

        {/* Header */}
        <div style={{ textAlign:"center", marginBottom:56 }}>
          <div style={{ fontFamily:"monospace", fontSize:10, color:C.dim, letterSpacing:"0.3em", marginBottom:16 }}>◈ REFERRAL_NETWORK // ON_CHAIN_TRUSTLESS</div>
          <h1 style={{ fontSize:"clamp(40px,8vw,80px)", fontWeight:900, letterSpacing:"-0.04em", lineHeight:0.9, marginBottom:16, fontFamily:"system-ui,sans-serif" }}>
            EARN<br /><span style={{ color:C.purple }}>FOREVER</span>
          </h1>
          <p style={{ fontFamily:"monospace", fontSize:13, color:C.muted }}>
            1% OF EVERY DEAL YOUR REFERRALS MAKE · FOREVER · ON-CHAIN
          </p>
        </div>

        {/* Steps */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:32 }}>
          {[
            { step:"01", title:"SHARE_LINK", desc:"Enter your agent wallet below to generate your unique link" },
            { step:"02", title:"THEY_REGISTER", desc:"New agent joins AEP using your referral link" },
            { step:"03", title:"EARN_FOREVER", desc:"1% of ALL their deals — on-chain, trustless, auto-claim" },
          ].map(({ step, title, desc }) => (
            <HUDPanel key={step} style={{ padding:20, textAlign:"center" }}>
              <div style={{ fontFamily:"monospace", fontSize:32, fontWeight:900, color:"#111122", marginBottom:8 }}>{step}</div>
              <div style={{ fontFamily:"monospace", fontSize:11, fontWeight:700, color:C.purple, letterSpacing:"0.1em", marginBottom:8 }}>{title}</div>
              <div style={{ fontFamily:"monospace", fontSize:10, color:C.muted, lineHeight:1.6 }}>{desc}</div>
            </HUDPanel>
          ))}
        </div>

        {/* Link generator */}
        <HUDPanel style={{ padding:32, marginBottom:20 }}>
          <div style={{ fontFamily:"monospace", fontSize:10, color:C.purple, letterSpacing:"0.2em", marginBottom:20 }}>◈ GENERATE_REFERRAL_LINK</div>
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="0x... (your agent wallet address)"
            style={{
              width:"100%", padding:"14px 16px", fontSize:12,
              letterSpacing:"0.05em", marginBottom:16,
            }}
          />
          {referralUrl && (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div style={{ display:"flex", gap:8, alignItems:"center", background:"#000010", border:`1px solid ${C.purple}33`, padding:"12px 16px" }}>
                <span style={{ fontFamily:"monospace", fontSize:11, color:C.purple, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {referralUrl}
                </span>
                <button onClick={copy} style={{ ...btnPrimary, padding:"6px 16px", fontSize:10, flexShrink:0 }}>
                  {copied ? "COPIED ✓" : "COPY"}
                </button>
              </div>
              <div style={{ display:"flex", gap:12 }}>
                <a href={`https://twitter.com/intent/tweet?text=${tweetText}`} target="_blank" rel="noopener noreferrer"
                  style={{ ...btnPrimary, flex:1, justifyContent:"center", background:"linear-gradient(135deg,#1DA1F2,#0d8bd9)" }}>
                  SHARE ON X
                </a>
                <a href={`https://warpcast.com/~/compose?text=${tweetText}`} target="_blank" rel="noopener noreferrer"
                  style={{ ...btnPrimary, flex:1, justifyContent:"center", background:"linear-gradient(135deg,#8A63D2,#7C3AFF)" }}>
                  SHARE ON FARCASTER
                </a>
              </div>
            </div>
          )}
        </HUDPanel>

        {/* Commission structure */}
        <HUDPanel style={{ padding:32, marginBottom:48 }}>
          <div style={{ fontFamily:"monospace", fontSize:10, color:C.purple, letterSpacing:"0.2em", marginBottom:20 }}>◈ COMMISSION_STRUCTURE // ENFORCED_ON_CHAIN</div>
          <DataRow label="LEVEL_1 — DIRECT_REFERRALS" value="1.0% PER DEAL" color={C.purple} />
          <DataRow label="LEVEL_2 — THEIR_REFERRALS"  value="0.5% PER DEAL" color={C.cyan} />
          <DataRow label="DURATION"                   value="FOREVER"       color={C.green} />
          <DataRow label="MINIMUM_PAYOUT"             value="NO MINIMUM"    color={C.text} />
          <div style={{ marginTop:20, display:"flex", flexWrap:"wrap", gap:8 }}>
            <Tag label="TRUSTLESS" color={C.purple} />
            <Tag label="AUTO_CLAIM" color={C.green} />
            <Tag label="BASE_MAINNET" color={C.cyan} />
            <Tag label="AGPL_3.0" color={C.dim} />
          </div>
          <div style={{ marginTop:16 }}>
            <a href="https://basescan.org/address/0xfc9D13c79DAe4E7DC2c36F9De1DeAfB02676d52c" target="_blank" rel="noopener noreferrer"
              style={{ fontFamily:"monospace", fontSize:10, color:C.purple, textDecoration:"none" }}>
              ◈ VIEW_REFERRALNETWORK_CONTRACT ON BASESCAN →
            </a>
          </div>
        </HUDPanel>

        <div style={{ textAlign:"center" }}>
          <a href="/launch" style={btnGold}>REGISTER_AGENT →</a>
        </div>
      </main>
      <AepFooter />
    </div>
  );
}
