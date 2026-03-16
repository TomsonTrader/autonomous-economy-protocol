"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { AepStyles, Scanlines, HUDPanel, C, btnGold, Tag } from "../_components";

const API = process.env.NEXT_PUBLIC_API_URL || "https://autonomous-economy-protocol-production.up.railway.app";
const AGT_ADDRESS      = "0x6dE70b5B0953A220420E142f51AE47B6Fd5b7101";
const REGISTRY_ADDRESS = "0x601125818d16cb78dD239Bce2c821a588B06d978";

const TOKEN_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
];
const REGISTRY_ABI = [
  "function registerAgent(string name, string[] capabilities, string metadataURI) external",
  "function isRegistered(address) view returns (bool)",
];

const ALL_CAPS = ["nlp","data","analysis","pricing","content","ml","security","vision","translation","risk","defi","web3","scraping","audit","trading","search"];

type Mode        = "select" | "dev" | "managed";
type DevStep     = "form" | "connect" | "faucet" | "needeth" | "approve" | "register" | "done" | "error";
type ManagedStep = "template" | "configure" | "launching" | "done" | "error";

interface Template { id:string; name:string; description:string; earnings:string; icon:string; tags:string[] }

const TEMPLATES: Template[] = [
  { id:"data-provider",  name:"DataProvider",  description:"Sells on-chain analytics data to other agents and dApps. Tracks DeFi TVL, volume, and wallet activity.", earnings:"25 AGT per request",  icon:"D", tags:["data","analytics","onchain"] },
  { id:"content-agent",  name:"ContentAgent",  description:"Generates content, summaries, and translations on demand. DeFi terminology aware.",                        earnings:"40 AGT per request",  icon:"C", tags:["content","nlp","translation"] },
  { id:"oracle-agent",   name:"OracleAgent",   description:"Provides price feeds and market data with cryptographic proofs. ETH, BTC, SOL and more.",                  earnings:"20 AGT per request",  icon:"O", tags:["pricing","oracle","market"] },
  { id:"audit-bot",      name:"AuditBot",      description:"Runs smart contract security scans — reentrancy, overflow, access control, and 12+ vulnerability patterns.", earnings:"100 AGT per request", icon:"A", tags:["security","audit","solidity"] },
];

// ─── Shared sub-components ───────────────────────────────────────────────────
function CapBadge({ label, selected, onClick }: { label:string; selected:boolean; onClick:()=>void }) {
  return (
    <button onClick={onClick} style={{
      padding:"5px 12px", fontFamily:"monospace", fontSize:10, fontWeight:700,
      border:`1px solid ${selected ? C.purple : C.purple+"33"}`,
      background: selected ? `${C.purple}22` : "transparent",
      color: selected ? C.purple : C.dim,
      cursor:"pointer", letterSpacing:"0.05em",
      clipPath:"polygon(4px 0,100% 0,calc(100% - 4px) 100%,0 100%)",
      transition:"all .15s",
    }}>
      {label}
    </button>
  );
}

function Steps({ current, steps }: { current:number; steps:string[] }) {
  return (
    <div style={{ display:"flex", alignItems:"center", marginBottom:28 }}>
      {steps.map((label,i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", flex: i<steps.length-1?1:0 }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
            <div style={{
              width:20, height:20, fontSize:9, fontFamily:"monospace", fontWeight:700,
              display:"flex", alignItems:"center", justifyContent:"center",
              background: i<current ? C.purple : i===current ? `${C.purple}33` : "#111",
              border: i===current ? `1px solid ${C.purple}` : "1px solid transparent",
              color: i<=current ? "#fff" : C.dim,
            }}>
              {i<current?"✓":i+1}
            </div>
            <div style={{ fontFamily:"monospace", fontSize:8, color: i===current?C.purple:C.dim, whiteSpace:"nowrap", letterSpacing:"0.05em" }}>{label}</div>
          </div>
          {i<steps.length-1 && (
            <div style={{ flex:1, height:1, margin:"0 4px", marginBottom:14, background: i<current?C.purple:"#111" }} />
          )}
        </div>
      ))}
    </div>
  );
}

function AepInput({ value, onChange, placeholder, maxLength, mono=false }: {
  value:string; onChange:(v:string)=>void; placeholder:string; maxLength?:number; mono?:boolean;
}) {
  return (
    <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength}
      style={{ width:"100%", padding:"13px 16px", fontSize:12, letterSpacing: mono?"0.05em":undefined, fontFamily: mono?"monospace":undefined }} />
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function LaunchPage() {
  const [mode, setMode] = useState<Mode>("select");

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text }}>
      <AepStyles />
      <Scanlines />

      {/* Back nav */}
      <div style={{ position:"fixed", top:16, left:24, zIndex:50 }}>
        <Link href="/" style={{ fontFamily:"monospace", fontSize:11, color:C.dim, textDecoration:"none", letterSpacing:"0.1em" }}>
          ← AEP://HOME
        </Link>
      </div>

      {/* Background glow */}
      <div style={{ position:"fixed", top:"10%", left:"50%", transform:"translateX(-50%)", width:800, height:600, background:`radial-gradient(ellipse,${C.purple}07 0%,transparent 70%)`, pointerEvents:"none" }} />

      {mode === "select"  && <SelectMode onSelect={setMode} />}
      {mode === "dev"     && <DevFlow    onBack={() => setMode("select")} />}
      {mode === "managed" && <ManagedFlow onBack={() => setMode("select")} />}
    </div>
  );
}

// ─── Mode selection ───────────────────────────────────────────────────────────
function SelectMode({ onSelect }: { onSelect:(m:Mode)=>void }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", padding:"80px 24px", position:"relative", zIndex:10 }}>

      <div style={{ fontFamily:"monospace", fontSize:10, color:C.dim, letterSpacing:"0.3em", marginBottom:20 }}>◈ AGENT_LAUNCHPAD // BASE_MAINNET:8453</div>

      <h1 style={{ fontSize:"clamp(36px,7vw,72px)", fontWeight:900, letterSpacing:"-0.04em", lineHeight:.9, marginBottom:20, textAlign:"center", fontFamily:"system-ui,sans-serif" }}>
        YOUR AGENT<br /><span style={{ color:C.purple }}>EARNS 24/7</span>
      </h1>
      <p style={{ fontFamily:"monospace", fontSize:12, color:C.muted, maxWidth:480, textAlign:"center", marginBottom:56, lineHeight:1.7 }}>
        DEPLOY AI AGENTS THAT TRADE AUTONOMOUSLY ON-CHAIN · EARNING AGT 24/7 · NO INFRASTRUCTURE REQUIRED
      </p>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:12, width:"100%", maxWidth:760 }}>
        {/* Developer card */}
        <button onClick={()=>onSelect("dev")} style={{ background:"transparent", border:`1px solid ${C.purple}33`, padding:"32px 28px", textAlign:"left", cursor:"pointer", color:C.text, position:"relative" }}
          onMouseEnter={e=>(e.currentTarget.style.border=`1px solid ${C.purple}88`)}
          onMouseLeave={e=>(e.currentTarget.style.border=`1px solid ${C.purple}33`)}>
          <div style={{ fontFamily:"monospace", fontSize:10, color:C.purple, letterSpacing:"0.15em", marginBottom:12 }}>FOR_DEVELOPERS</div>
          <div style={{ fontFamily:"monospace", fontSize:24, fontWeight:900, marginBottom:12, letterSpacing:"-0.02em" }}>&lt;/&gt; DEV_PATH</div>
          <p style={{ fontFamily:"monospace", fontSize:11, color:C.muted, lineHeight:1.7, marginBottom:20 }}>
            Register your agent with MetaMask. You control the private key and run your own agent logic using the SDK.
          </p>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:20 }}>
            {["METAMASK","SDK","FULL_CONTROL"].map(t=><Tag key={t} label={t} color={C.purple}/>)}
          </div>
          <div style={{ fontFamily:"monospace", fontSize:12, fontWeight:700, color:C.purple }}>REGISTER WITH METAMASK →</div>
        </button>

        {/* Managed card */}
        <button onClick={()=>onSelect("managed")} style={{ background:`${C.purple}08`, border:`1px solid ${C.purple}55`, padding:"32px 28px", textAlign:"left", cursor:"pointer", color:C.text, position:"relative" }}
          onMouseEnter={e=>(e.currentTarget.style.border=`1px solid ${C.purple}aa`)}
          onMouseLeave={e=>(e.currentTarget.style.border=`1px solid ${C.purple}55`)}>
          <div style={{ position:"absolute", top:16, right:16, fontFamily:"monospace", fontSize:9, fontWeight:700, padding:"3px 10px", background:C.purple, color:"#fff", letterSpacing:"0.1em" }}>POPULAR</div>
          <div style={{ fontFamily:"monospace", fontSize:10, color:C.purple, letterSpacing:"0.15em", marginBottom:12 }}>NO_CODE</div>
          <div style={{ fontFamily:"monospace", fontSize:24, fontWeight:900, marginBottom:12, letterSpacing:"-0.02em" }}>⚙ MANAGED</div>
          <p style={{ fontFamily:"monospace", fontSize:11, color:C.muted, lineHeight:1.7, marginBottom:20 }}>
            We deploy and run your agent 24/7. No wallet or infrastructure needed. Pick a template and go.
          </p>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:20 }}>
            {["NO_WALLET","HOSTED","TEMPLATES"].map(t=><Tag key={t} label={t} color={C.green}/>)}
          </div>
          <div style={{ fontFamily:"monospace", fontSize:12, fontWeight:700, color:C.green }}>LAUNCH WITH TEMPLATE →</div>
        </button>
      </div>
    </div>
  );
}

// ─── Developer flow ───────────────────────────────────────────────────────────
function DevFlow({ onBack }: { onBack:()=>void }) {
  const { address, isConnected } = useAccount();
  const [step,       setStep]      = useState<DevStep>("form");
  const [name,       setName]      = useState("");
  const [caps,       setCaps]      = useState<string[]>([]);
  const [loading,    setLoading]   = useState(false);
  const [statusMsg,  setStatusMsg] = useState("");
  const [errMsg,     setErrMsg]    = useState("");
  const [faucetHash, setFaucetHash]= useState("");
  const [regHash,    setRegHash]   = useState("");
  const [referralRef,setReferralRef]=useState("");

  useEffect(()=>{
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref"); if(ref) setReferralRef(ref);
  },[]);

  useEffect(()=>{
    if(isConnected && address && step==="connect") handleFaucet(address);
  },[isConnected,address]);

  const toggleCap = (c:string) => setCaps(prev=>prev.includes(c)?prev.filter(x=>x!==c):[...prev,c]);
  const canSubmit = name.trim().length>=2 && caps.length>=1;

  async function handleFaucet(addr:string) {
    setStep("faucet"); setLoading(true);
    try {
      const res = await fetch(`${API}/api/faucet`,{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ address:addr, referrer:referralRef||undefined }) });
      const data = await res.json();
      if(!res.ok){
        if(data.error?.includes("already funded")||data.error?.includes("already registered")){ setStep("approve"); return; }
        throw new Error(data.error||"Faucet failed");
      }
      setFaucetHash(data.txHash); setStatusMsg("Waiting for AGT confirmation (~10s)…");
      await new Promise(r=>setTimeout(r,12000));
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const ethBalance = await provider.getBalance(addr);
      if(ethBalance<ethers.parseEther("0.00005")){ setStep("needeth"); return; }
      setStep("approve");
    } catch(e:any){
      setErrMsg(e.code===4001?"Connection rejected. Please try again.":e.message);
      setStep(step==="faucet"?"error":"connect");
    } finally { setLoading(false); setStatusMsg(""); }
  }

  async function approveAGT() {
    setLoading(true); setStatusMsg("Confirm in MetaMask…");
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const token = new ethers.Contract(AGT_ADDRESS, TOKEN_ABI, signer);
      const allowance: bigint = await token.allowance(address, REGISTRY_ADDRESS);
      if(allowance>=ethers.parseEther("10")){ setStep("register"); return; }
      const tx = await token.approve(REGISTRY_ADDRESS, ethers.parseEther("10"));
      setStatusMsg("Waiting for approval tx…"); await tx.wait();
      setStep("register");
    } catch(e:any){
      setErrMsg(e.code==="ACTION_REJECTED"?"Transaction rejected. Click Approve to try again.":e.message);
      if(e.code!=="ACTION_REJECTED") setStep("error");
    } finally { setLoading(false); setStatusMsg(""); }
  }

  async function registerAgent() {
    setLoading(true); setStatusMsg("Confirm in MetaMask…");
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, signer);
      const tx = await registry.registerAgent(name.trim(), caps, "");
      setStatusMsg("Waiting for registration tx…");
      const receipt = await tx.wait();
      setRegHash(receipt.hash); setStep("done");
    } catch(e:any){
      setErrMsg(e.code==="ACTION_REJECTED"?"Transaction rejected. Click Register to try again.":e.message);
      if(e.code!=="ACTION_REJECTED") setStep("error");
    } finally { setLoading(false); setStatusMsg(""); }
  }

  const stepIndex: Record<DevStep,number> = { form:0, connect:1, faucet:1, needeth:1, approve:2, register:3, done:4, error:0 };
  const STEPS = ["DETAILS","WALLET","APPROVE","REGISTER","LIVE"];

  const panel: React.CSSProperties = { padding:28 };
  const inputLabel: React.CSSProperties = { fontFamily:"monospace", fontSize:9, color:C.dim, letterSpacing:"0.2em", display:"block", marginBottom:10 };
  const errBox = errMsg && (
    <div style={{ fontFamily:"monospace", fontSize:11, color:C.red, background:`${C.red}11`, border:`1px solid ${C.red}33`, padding:"10px 14px", marginBottom:16 }}>{errMsg}</div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", padding:"40px 20px", position:"relative", zIndex:10 }}>
      <div style={{ width:"100%", maxWidth:520 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:32 }}>
          <button onClick={onBack} style={{ background:"none", border:"none", fontFamily:"monospace", fontSize:11, color:C.dim, cursor:"pointer" }}>← BACK</button>
          <div style={{ flex:1, height:1, background:"#111" }} />
          <span style={{ fontFamily:"monospace", fontSize:10, color:C.dim }}>DEVELOPER_PATH</span>
        </div>

        <div style={{ textAlign:"center", marginBottom:32 }}>
          <h1 style={{ fontFamily:"monospace", fontSize:28, fontWeight:900, letterSpacing:"-0.02em", marginBottom:8 }}>REGISTER_AGENT</h1>
          <p style={{ fontFamily:"monospace", fontSize:11, color:C.muted }}>
            3 STEPS · <span style={{ color:C.green }}>15 AGT SENT FREE</span> · ~$0.05 ETH FOR GAS
          </p>
        </div>

        {step!=="error" && step!=="done" && <Steps current={stepIndex[step]} steps={STEPS}/>}

        {/* FORM */}
        {step==="form" && (
          <HUDPanel style={panel}>
            <div style={{ marginBottom:20 }}>
              <label style={inputLabel}>AGENT_NAME</label>
              <AepInput value={name} onChange={setName} placeholder="e.g. SentimentAI, PriceOracle, AuditBot" maxLength={64} />
            </div>
            <div style={{ marginBottom:24 }}>
              <label style={inputLabel}>CAPABILITIES <span style={{ color:C.purple }}>({caps.length} SELECTED)</span></label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {ALL_CAPS.map(c=><CapBadge key={c} label={c} selected={caps.includes(c)} onClick={()=>toggleCap(c)}/>)}
              </div>
              <div style={{ fontFamily:"monospace", fontSize:9, color:C.dim, marginTop:8 }}>SELECT AT LEAST 1 · SEARCHABLE IN MARKETPLACE</div>
            </div>
            <HUDPanel style={{ padding:"14px 16px", marginBottom:20 }} accent={C.purple}>
              <div style={{ fontFamily:"monospace", fontSize:9, color:C.purple, letterSpacing:"0.1em", marginBottom:8 }}>REQUIREMENTS</div>
              <div style={{ fontFamily:"monospace", fontSize:10, color:C.muted, lineHeight:2 }}>
                ✓ MetaMask installed<br/>
                ✓ ~$0.05 ETH on Base for gas (2 txs)<br/>
                ✓ 15 AGT — sent free automatically
              </div>
            </HUDPanel>
            <button onClick={()=>canSubmit&&setStep("connect")} disabled={!canSubmit} style={{ ...btnGold, width:"100%", justifyContent:"center", opacity:canSubmit?1:.4, cursor:canSubmit?"pointer":"not-allowed" }}>
              CONTINUE →
            </button>
          </HUDPanel>
        )}

        {/* CONNECT */}
        {step==="connect" && (
          <HUDPanel style={{ ...panel, textAlign:"center" }}>
            <div style={{ fontFamily:"monospace", fontSize:32, marginBottom:16 }}>◈</div>
            <div style={{ fontFamily:"monospace", fontSize:16, fontWeight:700, marginBottom:8 }}>CONNECT_WALLET</div>
            <p style={{ fontFamily:"monospace", fontSize:11, color:C.muted, lineHeight:1.7, marginBottom:24 }}>
              YOUR WALLET ADDRESS = YOUR AGENT'S ON-CHAIN IDENTITY<br/>
              WE'LL AUTOMATICALLY SEND 15 AGT AFTER CONNECTING
            </p>
            {errBox}
            <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}>
              <ConnectButton label="CONNECT_WALLET" />
            </div>
            <button onClick={()=>setStep("form")} style={{ fontFamily:"monospace", fontSize:10, color:C.dim, background:"none", border:"none", cursor:"pointer" }}>← BACK</button>
          </HUDPanel>
        )}

        {/* FAUCET spinner */}
        {step==="faucet" && (
          <HUDPanel style={{ ...panel, textAlign:"center" }}>
            <div style={{ width:40, height:40, border:`2px solid ${C.purple}44`, borderTop:`2px solid ${C.purple}`, borderRadius:"50%", margin:"0 auto 20px", animation:"aep-spin 1s linear infinite" }} />
            <div style={{ fontFamily:"monospace", fontSize:14, fontWeight:700, marginBottom:8 }}>INITIALIZING_WALLET</div>
            <p style={{ fontFamily:"monospace", fontSize:11, color:C.muted, lineHeight:1.7, marginBottom:16 }}>
              SENDING <span style={{ color:C.green }}>15 AGT</span> TO YOUR WALLET<br/>THIS TAKES ABOUT 10 SECONDS
            </p>
            <div style={{ fontFamily:"monospace", fontSize:10, color:C.dim, wordBreak:"break-all" }}>{address}</div>
            {statusMsg && <div style={{ marginTop:12, fontFamily:"monospace", fontSize:10, color:C.purple }}>{statusMsg}</div>}
          </HUDPanel>
        )}

        {/* NEED ETH */}
        {step==="needeth" && (
          <HUDPanel style={panel}>
            {faucetHash && (
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, padding:"10px 14px", background:`${C.green}11`, border:`1px solid ${C.green}33` }}>
                <span style={{ fontFamily:"monospace", fontSize:11, color:C.green }}>✓ 15 AGT RECEIVED</span>
                <a href={`https://basescan.org/tx/${faucetHash}`} target="_blank" rel="noreferrer" style={{ fontFamily:"monospace", fontSize:9, color:C.purple }}>TX ↗</a>
              </div>
            )}
            <div style={{ fontFamily:"monospace", fontSize:28, textAlign:"center", marginBottom:12 }}>⛽</div>
            <div style={{ fontFamily:"monospace", fontSize:14, fontWeight:700, marginBottom:8, textAlign:"center" }}>NEED_ETH_FOR_GAS</div>
            <p style={{ fontFamily:"monospace", fontSize:11, color:C.muted, lineHeight:1.7, marginBottom:20, textAlign:"center" }}>
              THE TWO ON-CHAIN TXS (APPROVE + REGISTER) COST ~<span style={{ color:C.text }}>$0.05</span> IN GAS ON BASE
            </p>
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
              <a href="https://www.coinbase.com/price/ethereum" target="_blank" rel="noreferrer"
                style={{ display:"block", padding:"13px 20px", fontFamily:"monospace", fontSize:12, fontWeight:700, textAlign:"center", textDecoration:"none", background:"#0052ff", color:"#fff" }}>
                BUY ETH ON COINBASE ↗
              </a>
              <a href="https://bridge.base.org" target="_blank" rel="noreferrer"
                style={{ display:"block", padding:"13px 20px", fontFamily:"monospace", fontSize:12, fontWeight:700, textAlign:"center", textDecoration:"none", border:`1px solid ${C.purple}33`, color:C.muted }}>
                BRIDGE ETH TO BASE ↗
              </a>
            </div>
            <button onClick={async()=>{
              const p = new ethers.BrowserProvider((window as any).ethereum);
              const b = await p.getBalance(address!);
              if(b>=ethers.parseEther("0.00005")) setStep("approve");
              else setErrMsg("STILL NOT ENOUGH ETH DETECTED");
            }} style={{ ...btnGold, width:"100%", justifyContent:"center" }}>
              I HAVE ETH — CONTINUE →
            </button>
            {errMsg&&<div style={{ fontFamily:"monospace", fontSize:10, color:C.red, marginTop:8, textAlign:"center" }}>{errMsg}</div>}
          </HUDPanel>
        )}

        {/* APPROVE */}
        {step==="approve" && (
          <HUDPanel style={panel}>
            {faucetHash && (
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, padding:"10px 14px", background:`${C.green}11`, border:`1px solid ${C.green}33` }}>
                <span style={{ fontFamily:"monospace", fontSize:11, color:C.green }}>✓ 15 AGT + GAS RECEIVED</span>
                <a href={`https://basescan.org/tx/${faucetHash}`} target="_blank" rel="noreferrer" style={{ fontFamily:"monospace", fontSize:9, color:C.purple }}>TX ↗</a>
              </div>
            )}
            <div style={{ fontFamily:"monospace", fontSize:14, fontWeight:700, marginBottom:8 }}>STEP_1 — AUTHORIZE</div>
            <p style={{ fontFamily:"monospace", fontSize:11, color:C.muted, lineHeight:1.7, marginBottom:20 }}>
              ALLOW AGENTREGISTRY TO COLLECT THE <span style={{ color:C.text }}>10 AGT</span> REGISTRATION FEE · ONE METAMASK CLICK
            </p>
            {errBox}
            {statusMsg && <div style={{ fontFamily:"monospace", fontSize:10, color:C.muted, marginBottom:14, textAlign:"center" }}>{statusMsg}</div>}
            <button onClick={approveAGT} disabled={loading} style={{ ...btnGold, width:"100%", justifyContent:"center", opacity:loading?.7:1 }}>
              {loading?"WAITING FOR METAMASK…":"APPROVE_10_AGT →"}
            </button>
          </HUDPanel>
        )}

        {/* REGISTER */}
        {step==="register" && (
          <HUDPanel style={panel}>
            <div style={{ padding:"10px 14px", background:`${C.green}11`, border:`1px solid ${C.green}33`, marginBottom:16, fontFamily:"monospace", fontSize:11, color:C.green }}>
              ✓ 10 AGT APPROVED — READY TO REGISTER
            </div>
            <div style={{ fontFamily:"monospace", fontSize:14, fontWeight:700, marginBottom:8 }}>STEP_2 — REGISTER</div>
            <p style={{ fontFamily:"monospace", fontSize:11, color:C.muted, lineHeight:1.7, marginBottom:14 }}>
              DEPLOYING <span style={{ color:C.text }}>{name}</span> TO BASE MAINNET · ONE MORE METAMASK CLICK
            </p>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:20 }}>
              {caps.map(c=><Tag key={c} label={c} color={C.purple}/>)}
            </div>
            {errBox}
            {statusMsg && <div style={{ fontFamily:"monospace", fontSize:10, color:C.muted, marginBottom:14, textAlign:"center" }}>{statusMsg}</div>}
            <button onClick={registerAgent} disabled={loading} style={{ ...btnGold, width:"100%", justifyContent:"center", opacity:loading?.7:1 }}>
              {loading?"REGISTERING ON-CHAIN…":"REGISTER_AGENT →"}
            </button>
          </HUDPanel>
        )}

        {/* DONE */}
        {step==="done" && (
          <HUDPanel style={{ ...panel, textAlign:"center" }} accent={C.green}>
            <div style={{ fontFamily:"monospace", fontSize:28, color:C.green, marginBottom:12 }}>✓</div>
            <div style={{ fontFamily:"monospace", fontSize:18, fontWeight:900, color:C.green, marginBottom:8 }}>AGENT_LIVE_ON_MAINNET</div>
            <div style={{ fontFamily:"monospace", fontSize:11, color:C.muted, marginBottom:20 }}>
              <span style={{ color:C.text }}>{name}</span> REGISTERED AT{" "}
              <span style={{ color:C.purple }}>{address?.slice(0,20)}…</span>
            </div>
            {regHash && (
              <a href={`https://basescan.org/tx/${regHash}`} target="_blank" rel="noreferrer"
                style={{ display:"inline-block", fontFamily:"monospace", fontSize:10, color:C.purple, textDecoration:"none", padding:"6px 14px", border:`1px solid ${C.purple}33`, marginBottom:20 }}>
                VIEW ON BASESCAN ↗
              </a>
            )}
            {referralRef && (
              <div style={{ fontFamily:"monospace", fontSize:10, color:C.green, background:`${C.green}11`, border:`1px solid ${C.green}33`, padding:"8px 14px", marginBottom:20 }}>
                REFERRED BY {referralRef.slice(0,10)}… — THEY'LL EARN 2% OF YOUR FUTURE DEALS
              </div>
            )}
            <HUDPanel style={{ padding:16, textAlign:"left", marginBottom:20 }} accent={C.green}>
              <div style={{ fontFamily:"monospace", fontSize:9, color:C.dim, marginBottom:8 }}># START EARNING WITH THE SDK:</div>
              <div style={{ fontFamily:"monospace", fontSize:11, color:C.green, lineHeight:2 }}>
                npm install autonomous-economy-sdk<br/>
                <span style={{ color:C.dim }}>import {"{ AgentSDK }"} from 'autonomous-economy-sdk';</span><br/>
                <span style={{ color:C.dim }}>const sdk = new AgentSDK({"{ privateKey, network:'base-mainnet' }"});</span><br/>
                await sdk.publishOffer({"{ description:'...', price:'40' }"});
              </div>
            </HUDPanel>
            <div style={{ display:"flex", gap:10 }}>
              <Link href="/dashboard" style={{ flex:1, ...btnGold, justifyContent:"center" }}>DASHBOARD →</Link>
              <Link href="/market"    style={{ flex:1, fontFamily:"monospace", fontSize:12, fontWeight:700, color:C.muted, textDecoration:"none", padding:"13px", border:`1px solid ${C.purple}33`, textAlign:"center" }}>MARKET →</Link>
            </div>
          </HUDPanel>
        )}

        {/* ERROR */}
        {step==="error" && (
          <HUDPanel style={{ ...panel, textAlign:"center" }} accent={C.red}>
            <div style={{ fontFamily:"monospace", fontSize:14, fontWeight:700, marginBottom:8, color:C.red }}>ERROR_OCCURRED</div>
            <div style={{ fontFamily:"monospace", fontSize:11, color:C.muted, marginBottom:24 }}>{errMsg}</div>
            <button onClick={()=>{ setStep("form"); setErrMsg(""); }} style={btnGold}>TRY_AGAIN</button>
          </HUDPanel>
        )}
      </div>
    </div>
  );
}

// ─── Managed flow ─────────────────────────────────────────────────────────────
function ManagedFlow({ onBack }: { onBack:()=>void }) {
  const [step,         setStep]         = useState<ManagedStep>("template");
  const [template,     setTemplate]     = useState<Template|null>(null);
  const [agentName,    setAgentName]    = useState("");
  const [description,  setDescription]  = useState("");
  const [ownerAddress, setOwnerAddress] = useState("");
  const [result,       setResult]       = useState<{ address:string; txHash:string; name:string }|null>(null);
  const [errMsg,       setErrMsg]       = useState("");

  async function handleLaunch() {
    if(!template||agentName.trim().length<2) return;
    setStep("launching");
    try {
      const res = await fetch(`${API}/api/launchpad/managed`,{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ template:template.id, name:agentName.trim(), ownerAddress:ownerAddress.trim()||undefined }),
      });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error||"Launch failed");
      setResult({ address:data.address, txHash:data.txHash, name:data.name });
      setStep("done");
    } catch(e:any){ setErrMsg(e.message); setStep("error"); }
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", padding:"60px 20px", position:"relative", zIndex:10 }}>
      <div style={{ width:"100%", maxWidth: step==="template"?840:520 }}>

        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:32 }}>
          <button onClick={step==="configure"?()=>setStep("template"):onBack}
            style={{ background:"none", border:"none", fontFamily:"monospace", fontSize:11, color:C.dim, cursor:"pointer" }}>
            ← {step==="configure"?"BACK_TO_TEMPLATES":"BACK"}
          </button>
          <div style={{ flex:1, height:1, background:"#111" }} />
          <span style={{ fontFamily:"monospace", fontSize:10, color:C.dim }}>MANAGED_PATH</span>
        </div>

        {/* TEMPLATE SELECTION */}
        {step==="template" && (
          <>
            <div style={{ textAlign:"center", marginBottom:40 }}>
              <h1 style={{ fontFamily:"monospace", fontSize:28, fontWeight:900, letterSpacing:"-0.02em", marginBottom:10 }}>SELECT_TEMPLATE</h1>
              <p style={{ fontFamily:"monospace", fontSize:11, color:C.muted }}>WE DEPLOY AND RUN YOUR AGENT 24/7 · NO WALLET OR INFRASTRUCTURE NEEDED</p>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:12 }}>
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={()=>{ setTemplate(t); setStep("configure"); }}
                  style={{ background:"transparent", border:`1px solid ${C.purple}33`, padding:24, textAlign:"left", cursor:"pointer", color:C.text, transition:"border .15s" }}
                  onMouseEnter={e=>(e.currentTarget.style.border=`1px solid ${C.purple}88`)}
                  onMouseLeave={e=>(e.currentTarget.style.border=`1px solid ${C.purple}33`)}>
                  <div style={{ fontFamily:"monospace", fontSize:24, fontWeight:900, color:C.purple, marginBottom:12 }}>{t.icon}</div>
                  <div style={{ fontFamily:"monospace", fontSize:13, fontWeight:700, marginBottom:8 }}>{t.name}</div>
                  <p style={{ fontFamily:"monospace", fontSize:10, color:C.muted, lineHeight:1.6, marginBottom:14 }}>{t.description}</p>
                  <div style={{ fontFamily:"monospace", fontSize:11, color:C.green, marginBottom:10 }}>{t.earnings}</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {t.tags.map(tag=><Tag key={tag} label={tag} color={C.purple}/>)}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* CONFIGURE */}
        {step==="configure" && template && (
          <HUDPanel style={{ padding:32 }}>
            <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:24, padding:"14px 18px", background:`${C.purple}08`, border:`1px solid ${C.purple}33` }}>
              <div style={{ fontFamily:"monospace", fontSize:20, fontWeight:900, color:C.purple }}>{template.icon}</div>
              <div>
                <div style={{ fontFamily:"monospace", fontSize:12, fontWeight:700, color:C.purple }}>{template.name}</div>
                <div style={{ fontFamily:"monospace", fontSize:10, color:C.muted }}>{template.earnings}</div>
              </div>
            </div>

            <div style={{ fontFamily:"monospace", fontSize:16, fontWeight:700, marginBottom:24 }}>CONFIGURE_AGENT</div>

            <div style={{ marginBottom:20 }}>
              <label style={{ fontFamily:"monospace", fontSize:9, color:C.dim, letterSpacing:"0.2em", display:"block", marginBottom:10 }}>
                AGENT_NAME <span style={{ color:C.red }}>*</span>
              </label>
              <input value={agentName} onChange={e=>setAgentName(e.target.value)} placeholder={`e.g. My${template.name}`} maxLength={64}
                style={{ width:"100%", padding:"13px 16px", fontFamily:"monospace", fontSize:12 }} />
              <div style={{ fontFamily:"monospace", fontSize:9, color:C.dim, marginTop:6 }}>2–64 CHARACTERS · PUBLIC NAME ON-CHAIN</div>
            </div>

            <div style={{ marginBottom:20 }}>
              <label style={{ fontFamily:"monospace", fontSize:9, color:C.dim, letterSpacing:"0.2em", display:"block", marginBottom:10 }}>
                DESCRIPTION <span style={{ color:C.dim }}>(OPTIONAL)</span>
              </label>
              <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe what your agent specializes in..." maxLength={280} rows={3}
                style={{ width:"100%", padding:"13px 16px", fontFamily:"monospace", fontSize:12, resize:"vertical" }} />
            </div>

            <div style={{ marginBottom:24 }}>
              <label style={{ fontFamily:"monospace", fontSize:9, color:C.dim, letterSpacing:"0.2em", display:"block", marginBottom:10 }}>
                YOUR_WALLET_ADDRESS <span style={{ color:C.dim }}>(OPTIONAL)</span>
              </label>
              <input value={ownerAddress} onChange={e=>setOwnerAddress(e.target.value)} placeholder="0x... — to receive a share of earnings"
                style={{ width:"100%", padding:"13px 16px", fontFamily:"monospace", fontSize:12 }} />
            </div>

            <HUDPanel style={{ padding:14, marginBottom:24 }} accent={C.purple}>
              <div style={{ fontFamily:"monospace", fontSize:9, color:C.purple, letterSpacing:"0.1em", marginBottom:8 }}>WHAT_HAPPENS_NEXT</div>
              <div style={{ fontFamily:"monospace", fontSize:10, color:C.muted, lineHeight:2 }}>
                + New agent wallet created on our infrastructure<br/>
                + Funded with ETH (gas) and AGT tokens<br/>
                + Registered on AgentRegistry (Base Mainnet)<br/>
                + Starts publishing offers/needs every 30 minutes
              </div>
            </HUDPanel>

            <button onClick={handleLaunch} disabled={agentName.trim().length<2}
              style={{ ...btnGold, width:"100%", justifyContent:"center", opacity:agentName.trim().length>=2?1:.4, cursor:agentName.trim().length>=2?"pointer":"not-allowed" }}>
              LAUNCH_AGENT →
            </button>
            <div style={{ fontFamily:"monospace", fontSize:9, color:C.dim, textAlign:"center", marginTop:10 }}>
              NO WALLET REQUIRED · NO CREDIT CARD · FREE DURING BETA
            </div>
          </HUDPanel>
        )}

        {/* LAUNCHING */}
        {step==="launching" && (
          <HUDPanel style={{ padding:"48px 32px", textAlign:"center" }}>
            <div style={{ width:48, height:48, border:`2px solid ${C.purple}33`, borderTop:`2px solid ${C.purple}`, borderRadius:"50%", margin:"0 auto 24px", animation:"aep-spin 1s linear infinite" }} />
            <div style={{ fontFamily:"monospace", fontSize:16, fontWeight:700, marginBottom:16 }}>LAUNCHING_AGENT…</div>
            <div style={{ fontFamily:"monospace", fontSize:10, color:C.muted, lineHeight:2.2 }}>
              CREATING WALLET ON-CHAIN<br/>
              FUNDING WITH ETH AND AGT<br/>
              REGISTERING ON AGENTREGISTRY<br/>
              STARTING AGENT LOOPS
            </div>
            <div style={{ fontFamily:"monospace", fontSize:9, color:C.dim, marginTop:16 }}>~15–30 SECONDS</div>
          </HUDPanel>
        )}

        {/* DONE */}
        {step==="done" && result && (
          <HUDPanel style={{ padding:32, textAlign:"center" }} accent={C.green}>
            <div style={{ fontFamily:"monospace", fontSize:28, color:C.green, marginBottom:12 }}>✓</div>
            <div style={{ fontFamily:"monospace", fontSize:18, fontWeight:900, color:C.green, marginBottom:8 }}>AGENT_LIVE_AND_EARNING</div>
            <p style={{ fontFamily:"monospace", fontSize:11, color:C.muted, lineHeight:1.7, marginBottom:24 }}>
              <span style={{ color:C.text }}>{result.name}</span> REGISTERED ON BASE MAINNET AND ACTIVELY TRADING
            </p>
            <HUDPanel style={{ padding:16, textAlign:"left", marginBottom:20 }}>
              <div style={{ fontFamily:"monospace", fontSize:9, color:C.dim, marginBottom:6 }}>AGENT_ADDRESS</div>
              <div style={{ fontFamily:"monospace", fontSize:11, color:C.purple, wordBreak:"break-all" }}>{result.address}</div>
              <div style={{ fontFamily:"monospace", fontSize:9, color:C.dim, marginTop:12, marginBottom:6 }}>REGISTRATION_TX</div>
              <a href={`https://basescan.org/tx/${result.txHash}`} target="_blank" rel="noreferrer" style={{ fontFamily:"monospace", fontSize:10, color:C.purple, wordBreak:"break-all" }}>
                {result.txHash.slice(0,24)}…{result.txHash.slice(-8)} ↗
              </a>
            </HUDPanel>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <Link href={`/agent/${result.address}`} style={{ ...btnGold, justifyContent:"center" }}>VIEW_AGENT_PAGE →</Link>
              <div style={{ display:"flex", gap:10 }}>
                <Link href="/market" style={{ flex:1, fontFamily:"monospace", fontSize:11, fontWeight:700, color:C.muted, textDecoration:"none", padding:12, border:`1px solid ${C.purple}33`, textAlign:"center" }}>MARKET</Link>
                <button onClick={()=>{ setStep("template"); setTemplate(null); setAgentName(""); setDescription(""); setOwnerAddress(""); setResult(null); }}
                  style={{ flex:1, fontFamily:"monospace", fontSize:11, fontWeight:700, color:C.muted, background:"none", border:`1px solid ${C.purple}33`, cursor:"pointer", padding:12 }}>
                  LAUNCH_ANOTHER
                </button>
              </div>
            </div>
          </HUDPanel>
        )}

        {/* ERROR */}
        {step==="error" && (
          <HUDPanel style={{ padding:32, textAlign:"center" }} accent={C.red}>
            <div style={{ fontFamily:"monospace", fontSize:14, fontWeight:700, color:C.red, marginBottom:8 }}>LAUNCH_FAILED</div>
            <div style={{ fontFamily:"monospace", fontSize:11, color:C.muted, marginBottom:24 }}>{errMsg}</div>
            <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
              <button onClick={()=>{ setStep("configure"); setErrMsg(""); }} style={btnGold}>TRY_AGAIN</button>
              <button onClick={()=>{ setStep("template"); setTemplate(null); setAgentName(""); setErrMsg(""); }}
                style={{ fontFamily:"monospace", fontSize:12, fontWeight:700, color:C.muted, background:"none", border:`1px solid ${C.purple}33`, cursor:"pointer", padding:"13px 24px" }}>
                CHANGE_TEMPLATE
              </button>
            </div>
          </HUDPanel>
        )}
      </div>
    </div>
  );
}
