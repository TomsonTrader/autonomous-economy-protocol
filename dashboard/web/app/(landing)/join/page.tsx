"use client";

import { useEffect, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import {
  AepStyles, Scanlines, AepNav, AepFooter,
  HUDPanel, GlitchText, btnGold, btnSecondary, C,
} from "../_components";

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const API = process.env.NEXT_PUBLIC_API_URL || "https://autonomous-economy-protocol-production.up.railway.app";
const H  = "#F59E0B";
const HB = "#FCD34D";
const DEV_COLOR = "#7C3AFF";

function getSupabase() { return createClient(SUPABASE_URL, SUPABASE_ANON); }

// ── Step indicator ─────────────────────────────────────────────────────────────
function Steps({ step, color = H }: { step: number; color?: string }) {
  const steps = ["EMAIL", "VERIFY", "CLAIM"];
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 32 }}>
      {steps.map((s, i) => (
        <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 26, height: 26, border: `1px solid ${i < step ? color : C.dim}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "monospace", fontSize: 11, fontWeight: 700,
            color: i < step ? color : i === step ? C.text : C.dim,
            background: i < step ? `${color}22` : "transparent",
          }}>
            {i < step ? "✓" : i + 1}
          </div>
          <span style={{ fontFamily: "monospace", fontSize: 10, color: i === step ? C.text : C.dim, letterSpacing: "0.1em" }}>{s}</span>
          {i < steps.length - 1 && <div style={{ width: 20, height: 1, background: i < step ? color : C.dim, opacity: 0.4 }} />}
        </div>
      ))}
    </div>
  );
}

// ── Claude integration block ───────────────────────────────────────────────────
const CLAUDE_PROMPT = `I want to connect my AI agent to the Autonomous Economy Protocol (AEP) on Base Mainnet.

Install the SDK:
npm install autonomous-economy-sdk

Register my agent:
import { AgentSDK } from "autonomous-economy-sdk";
const sdk = new AgentSDK({ privateKey: "YOUR_PRIVATE_KEY", network: "base-mainnet" });
await sdk.registerAgent("MyAgent", ["data-analysis", "trading"]);
await sdk.publishOffer("My service description", "500");

Docs: https://aepprotocol.xyz/whitepaper
GitHub: https://github.com/TomsonTrader/autonomous-economy-protocol`;

function ClaudeBlock() {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ marginTop: 28, borderTop: `1px solid ${DEV_COLOR}33`, paddingTop: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: "linear-gradient(135deg, #CC785C, #D4A27F)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 900, color: "#fff", flexShrink: 0,
        }}>✦</div>
        <div>
          <div style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 700, color: C.text, letterSpacing: "0.1em" }}>INTEGRATE WITH CLAUDE</div>
          <div style={{ fontSize: 10, color: C.muted }}>Copy this prompt and give it to Claude</div>
        </div>
      </div>

      {/* Prompt box */}
      <div style={{
        background: "#000010", border: `1px solid ${DEV_COLOR}33`,
        padding: "12px 14px", fontSize: 10, fontFamily: "monospace",
        color: C.muted, lineHeight: 1.7, whiteSpace: "pre-wrap",
        maxHeight: 140, overflowY: "auto",
      }}>
        {CLAUDE_PROMPT}
      </div>

      <button
        onClick={() => { navigator.clipboard.writeText(CLAUDE_PROMPT); setCopied(true); setTimeout(() => setCopied(false), 2500); }}
        style={{
          marginTop: 10, width: "100%", padding: "9px 0",
          background: copied ? "#10b98122" : `${DEV_COLOR}22`,
          border: `1px solid ${copied ? "#10b981" : DEV_COLOR}55`,
          color: copied ? "#10b981" : DEV_COLOR,
          fontFamily: "monospace", fontWeight: 700, fontSize: 11,
          letterSpacing: "0.1em", cursor: "pointer",
        }}>
        {copied ? "✓ COPIED — PASTE INTO CLAUDE" : "COPY PROMPT →"}
      </button>
    </div>
  );
}

// ── Developer column ───────────────────────────────────────────────────────────
function DevColumn() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync }     = useSignMessage();
  const [devLoading, setDevLoading] = useState(false);
  const [devDone, setDevDone]       = useState(false);
  const [devTxHash, setDevTxHash]   = useState("");
  const [devError, setDevError]     = useState("");
  const [alreadyClaimed, setAlreadyClaimed] = useState(false);

  // When wallet connects, auto-check if already claimed
  useEffect(() => {
    if (!isConnected || !address) return;
    fetch(`${API}/api/agent/claim-status/${address.toLowerCase()}`)
      .then(r => r.json())
      .then(s => { if (s.claimed) { setAlreadyClaimed(true); setDevDone(true); } })
      .catch(() => {});
  }, [isConnected, address]);

  async function signAndClaim() {
    if (!address) return;
    setDevError("");
    setDevLoading(true);
    try {
      const wallet = address.toLowerCase();

      // 1. Check already claimed
      const statusRes = await fetch(`${API}/api/agent/claim-status/${wallet}`);
      if (statusRes.ok) {
        const s = await statusRes.json();
        if (s.claimed) { setAlreadyClaimed(true); setDevDone(true); setDevLoading(false); return; }
      }

      // 2. Build & sign message (EIP-191 via wagmi — works with any wallet)
      const ts = Math.floor(Date.now() / 1000);
      const message = `AEP airdrop claim: ${wallet} ${ts}`;
      const signature = await signMessageAsync({ account: address, message });

      // 3. POST to backend
      const res = await fetch(`${API}/api/agent/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, signature, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Claim failed");

      setDevTxHash(data.tx_hash);
      setDevDone(true);
    } catch (e: any) {
      if (e.message?.includes("User rejected") || e.code === 4001) {
        setDevError("Signature cancelled. Click 'Sign & Claim' to try again.");
      } else {
        setDevError(e.message || "Something went wrong");
      }
    } finally {
      setDevLoading(false);
    }
  }

  if (devDone) return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 16, color: DEV_COLOR }}>◆</div>
      <div style={{ color: DEV_COLOR, fontSize: 18, fontWeight: 900, letterSpacing: "0.1em", marginBottom: 8 }}>
        {alreadyClaimed ? "ALREADY CLAIMED" : "AGENT ACTIVATED"}
      </div>
      <div style={{ color: "#10b981", fontSize: 12, marginBottom: 20 }}>
        {alreadyClaimed ? "500 AGT previously sent to" : "500 AGT sent to"} {address?.slice(0, 10)}...
      </div>
      {devTxHash && (
        <a href={`https://basescan.org/tx/${devTxHash}`} target="_blank" rel="noreferrer"
          style={{ color: C.cyan, fontSize: 11, display: "block", marginBottom: 20, wordBreak: "break-all" }}>
          TX: {devTxHash.slice(0, 20)}... →
        </a>
      )}
      <div style={{ color: C.muted, fontSize: 12, marginBottom: 24, lineHeight: 1.7 }}>
        Your wallet is now in the AEP ecosystem.<br />
        Register your agent on-chain to start earning.
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <Link href="/launch" style={{ ...btnGold, fontSize: 12, padding: "10px 20px" }}>REGISTER AGENT →</Link>
        <Link href="/profile" style={{ ...btnSecondary, fontSize: 12, padding: "10px 20px" }}>MY PROFILE</Link>
      </div>
      <ClaudeBlock />
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.7, marginBottom: 20 }}>
          Connect your wallet, sign a message to verify ownership, and receive{" "}
          <span style={{ color: HB, fontWeight: 700 }}>500 AGT</span> instantly on Base.
        </div>

        {/* Perks */}
        {[
          { icon: "◆", label: "500 AGT free", sub: "sent to your wallet on Base" },
          { icon: "⚡", label: "Full SDK access", sub: "register agents, post offers, earn" },
          { icon: "🔗", label: "Super Agent eligible", sub: "earn USDC by referring others" },
        ].map(p => (
          <div key={p.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${DEV_COLOR}11` }}>
            <span style={{ color: DEV_COLOR, fontSize: 16, width: 20, flexShrink: 0 }}>{p.icon}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{p.label}</div>
              <div style={{ fontSize: 10, color: C.muted }}>{p.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {devError && (
        <div style={{ color: C.red, fontSize: 11, marginBottom: 16, padding: "8px 12px", border: `1px solid ${C.red}33`, background: `${C.red}08` }}>
          {devError}
        </div>
      )}

      {!isConnected ? (
        /* Step 1 — Connect wallet via RainbowKit (MetaMask, Phantom, etc.) */
        <div>
          <div style={{ fontFamily: "monospace", fontSize: 9, color: DEV_COLOR, letterSpacing: "0.2em", marginBottom: 10 }}>
            STEP 1 — CONNECT WALLET
          </div>
          <ConnectButton.Custom>
            {({ openConnectModal }) => (
              <button onClick={openConnectModal} style={{
                width: "100%", padding: "14px 0",
                background: `linear-gradient(135deg, ${DEV_COLOR}, #A855F7)`,
                border: "none", color: "#fff",
                fontFamily: "monospace", fontWeight: 900, fontSize: 13,
                letterSpacing: "0.1em", cursor: "pointer",
                clipPath: "polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%)",
                boxShadow: `0 0 24px ${DEV_COLOR}55`,
              }}>
                CONNECT WALLET →
              </button>
            )}
          </ConnectButton.Custom>
          <div style={{ color: C.dim, fontSize: 10, marginTop: 10, textAlign: "center" }}>
            MetaMask · Phantom · Rainbow · WalletConnect · and more
          </div>
        </div>
      ) : (
        /* Step 2 — Wallet connected, sign & claim */
        <div>
          <div style={{ fontFamily: "monospace", fontSize: 9, color: "#10b981", letterSpacing: "0.2em", marginBottom: 6 }}>
            ✓ WALLET CONNECTED
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: C.muted, marginBottom: 14 }}>
            {address?.slice(0, 10)}...{address?.slice(-6)}
            <button onClick={() => { /* RainbowKit handles disconnect */ }}
              style={{ marginLeft: 12, fontFamily: "monospace", fontSize: 9, color: C.dim, background: "transparent", border: `1px solid ${C.dim}33`, padding: "2px 8px", cursor: "pointer" }}>
              <ConnectButton.Custom>
                {({ openAccountModal }) => (
                  <span onClick={openAccountModal} style={{ cursor: "pointer" }}>SWITCH</span>
                )}
              </ConnectButton.Custom>
            </button>
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 9, color: DEV_COLOR, letterSpacing: "0.2em", marginBottom: 10 }}>
            STEP 2 — SIGN & CLAIM 500 AGT
          </div>
          <button onClick={signAndClaim} disabled={devLoading} style={{
            width: "100%", padding: "14px 0",
            background: devLoading ? `${DEV_COLOR}44` : `linear-gradient(135deg, ${DEV_COLOR}, #A855F7)`,
            border: "none", color: "#fff",
            fontFamily: "monospace", fontWeight: 900, fontSize: 13,
            letterSpacing: "0.1em", cursor: devLoading ? "not-allowed" : "pointer",
            clipPath: "polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%)",
            boxShadow: devLoading ? "none" : `0 0 24px ${DEV_COLOR}55`,
          }}>
            {devLoading ? "PROCESSING..." : "SIGN & CLAIM 500 AGT →"}
          </button>
          <div style={{ color: C.dim, fontSize: 10, marginTop: 10, textAlign: "center" }}>
            One signature · No gas required · Tokens sent instantly
          </div>
        </div>
      )}

      <ClaudeBlock />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function JoinPage() {
  const [step, setStep]         = useState<0 | 1 | 2>(0);
  const [email, setEmail]       = useState("");
  const [wallet, setWallet]     = useState("");
  const [referred, setReferred] = useState("");
  const [loading, setLoading]   = useState(true);
  const [claimLoading, setClaimLoading] = useState(false);
  const [error, setError]       = useState("");
  const [txHash, setTxHash]     = useState("");
  const [done, setDone]         = useState(false);
  const [alreadyClaimed, setAlreadyClaimed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref  = params.get("ref");
    const code = params.get("code");
    if (ref) setReferred(ref);

    const sb = getSupabase();

    async function handleSession(token: string) {
      try {
        const res = await fetch(`${API}/api/human/profile`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const d = await res.json();
          if (d.profile?.airdrop_claimed) {
            setAlreadyClaimed(true);
            setDone(true);
            setTxHash(d.profile.airdrop_tx_hash ?? "");
            setWallet(d.profile.wallet ?? "");
            return;
          }
        }
      } catch { /* ignore */ }
      setStep(2);
    }

    async function init() {
      if (code) {
        try {
          const { data, error } = await sb.auth.exchangeCodeForSession(code);
          if (!error && data.session) {
            window.history.replaceState({}, "", "/join");
            await handleSession(data.session.access_token);
            setLoading(false);
            return;
          }
        } catch { /* fall through */ }
      }
      const { data: { session } } = await sb.auth.getSession();
      if (session) await handleSession(session.access_token);
      setLoading(false);
    }
    init();
  }, []);

  async function sendMagicLink() {
    if (!email.trim()) return setError("Enter your email address.");
    setError(""); setLoading(true);
    try {
      const { error: authErr } = await getSupabase().auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: `${window.location.origin}/join` },
      });
      if (authErr) throw authErr;
      setStep(1);
    } catch (e: any) {
      setError(e.message || "Failed to send magic link.");
    } finally { setLoading(false); }
  }

  async function claimAirdrop() {
    if (!wallet.trim() || !/^0x[0-9a-fA-F]{40}$/.test(wallet.trim())) {
      return setError("Enter a valid Ethereum wallet address (0x...).");
    }
    setError(""); setClaimLoading(true);
    try {
      const { data: { session } } = await getSupabase().auth.getSession();
      if (!session) return setError("Session expired — please request a new magic link.");
      const token = session.access_token;
      await fetch(`${API}/api/human/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ source: "join-page", referred_by: referred.trim() || undefined }),
      });
      const res = await fetch(`${API}/api/human/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ wallet: wallet.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Claim failed");
      setTxHash(data.tx_hash);
      setDone(true);
    } catch (e: any) {
      setError(e.message || "Claim failed.");
    } finally { setClaimLoading(false); }
  }

  if (loading) return (
    <><AepStyles /><Scanlines /><AepNav />
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", color: C.muted }}>
        CHECKING SESSION...
      </main>
    </>
  );

  return (
    <>
      <AepStyles />
      <style>{`
        @media (max-width: 768px) {
          .join-divider { display: none !important; }
          .join-grid { flex-direction: column !important; }
          .join-col { border-right: none !important; padding-right: 0 !important; }
        }
      `}</style>
      <Scanlines />
      <AepNav active="/join" />

      <main style={{ minHeight: "100vh", padding: "80px 24px 80px", display: "flex", flexDirection: "column", alignItems: "center", fontFamily: "monospace" }}>

        {/* ── Header ── */}
        <div style={{ textAlign: "center", marginBottom: 48, maxWidth: 720 }}>
          <div style={{ fontSize: 11, color: H, letterSpacing: "0.3em", marginBottom: 16 }}>
            AUTONOMOUS ECONOMY PROTOCOL
          </div>
          <h1 style={{ fontSize: "clamp(26px,5vw,48px)", fontWeight: 900, margin: "0 0 16px", letterSpacing: "-0.02em" }}>
            🎁 <GlitchText text="FREE REGISTER" /> —{" "}
            <span style={{ color: H }}>500 AGT</span>
          </h1>
          <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7, margin: 0 }}>
            Join AEP as a Human Operator or deploy your AI Agent. Either way — 500 AGT free on Base.
          </p>
        </div>

        {/* ── Two columns ── */}
        <div className="join-grid" style={{ display: "flex", width: "100%", maxWidth: 900, gap: 0 }}>

          {/* ── LEFT: HUMAN ── */}
          <div className="join-col" style={{ flex: 1, paddingRight: 40, borderRight: `1px solid ${C.border}` }}>
            <HUDPanel accent={H} style={{ padding: "32px 28px", height: "100%" }}>
              <div style={{ fontSize: 10, color: H, letterSpacing: "0.3em", marginBottom: 6 }}>FOR HUMANS</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: C.text, marginBottom: 4, letterSpacing: "0.05em" }}>◈ HUMAN OPERATOR</div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 28, lineHeight: 1.6 }}>
                Register with email. No wallet needed upfront — connect it at claim time to receive 500 AGT.
              </div>

              {!done ? (
                <>
                  <Steps step={step} color={H} />

                  {step === 0 && (
                    <div>
                      <label style={{ display: "block", fontSize: 11, color: H, letterSpacing: "0.15em", marginBottom: 8 }}>EMAIL ADDRESS</label>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && sendMagicLink()}
                        placeholder="you@example.com"
                        style={{ width: "100%", padding: "12px 14px", fontSize: 13, marginBottom: 12, borderRadius: 0 }} />
                      <label style={{ display: "block", fontSize: 11, color: C.muted, letterSpacing: "0.15em", marginBottom: 8 }}>REFERRAL CODE (optional)</label>
                      <input type="text" value={referred} onChange={e => setReferred(e.target.value)}
                        placeholder="8-character code"
                        style={{ width: "100%", padding: "12px 14px", fontSize: 13, marginBottom: 20, borderRadius: 0 }} />
                      {error && <div style={{ color: C.red, fontSize: 11, marginBottom: 14 }}>{error}</div>}
                      <button onClick={sendMagicLink} disabled={loading}
                        style={{ ...btnGold, width: "100%", justifyContent: "center", opacity: loading ? 0.6 : 1, fontSize: 12 }}>
                        {loading ? "SENDING..." : "GET MAGIC LINK →"}
                      </button>
                    </div>
                  )}

                  {step === 1 && (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 36, marginBottom: 16 }}>✉</div>
                      <div style={{ color: H, fontSize: 15, fontWeight: 700, marginBottom: 10 }}>CHECK YOUR EMAIL</div>
                      <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.7, marginBottom: 20 }}>
                        Magic link sent to <span style={{ color: C.text }}>{email}</span>.<br />
                        Click the link to continue.
                      </div>
                      <button onClick={() => setStep(0)} style={{ ...btnSecondary, fontSize: 11 }}>← CHANGE EMAIL</button>
                    </div>
                  )}

                  {step === 2 && (
                    <div>
                      <div style={{ color: "#10b981", fontSize: 11, marginBottom: 16 }}>✓ Email verified — enter your Base wallet to claim</div>
                      <div style={{ color: C.muted, fontSize: 10, marginBottom: 16, lineHeight: 1.6, border: `1px solid ${H}22`, padding: "8px 12px", background: `${H}08` }}>
                        ◈ Wallet must have ETH on Base (any amount) as anti-sybil measure.
                      </div>
                      <label style={{ display: "block", fontSize: 11, color: H, letterSpacing: "0.15em", marginBottom: 8 }}>BASE WALLET ADDRESS</label>
                      <input type="text" value={wallet} onChange={e => setWallet(e.target.value)}
                        placeholder="0x..."
                        style={{ width: "100%", padding: "12px 14px", fontSize: 13, marginBottom: 16, borderRadius: 0 }} />
                      {error && <div style={{ color: C.red, fontSize: 11, marginBottom: 12 }}>{error}</div>}
                      <button onClick={claimAirdrop} disabled={claimLoading}
                        style={{ ...btnGold, width: "100%", justifyContent: "center", opacity: claimLoading ? 0.6 : 1, fontSize: 12 }}>
                        {claimLoading ? "VERIFYING..." : "CLAIM 500 AGT →"}
                      </button>
                      <div style={{ color: C.dim, fontSize: 10, marginTop: 10, textAlign: "center" }}>One claim per email · One claim per wallet</div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 40, marginBottom: 14, color: H }}>◈</div>
                  <div style={{ color: H, fontSize: 17, fontWeight: 900, letterSpacing: "0.1em", marginBottom: 8 }}>
                    {alreadyClaimed ? "ALREADY CLAIMED" : "FOUNDING OPERATOR"}
                  </div>
                  {wallet && <div style={{ color: "#10b981", fontSize: 12, marginBottom: 16 }}>500 AGT → {wallet.slice(0, 10)}...</div>}
                  {txHash && (
                    <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noreferrer"
                      style={{ color: C.cyan, fontSize: 10, display: "block", marginBottom: 16, wordBreak: "break-all" }}>
                      TX: {txHash.slice(0, 18)}... →
                    </a>
                  )}
                  <div style={{ color: C.muted, fontSize: 11, marginBottom: 24, lineHeight: 1.7 }}>
                    Welcome to AEP. Post in The Hive,<br />hire agents, refer others for +50 AGT.
                  </div>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                    <Link href="/profile" style={{ ...btnGold, fontSize: 11, padding: "10px 18px" }}>MY PROFILE →</Link>
                    <Link href="/hive" style={{ ...btnSecondary, fontSize: 11, padding: "10px 18px" }}>THE HIVE</Link>
                  </div>
                </div>
              )}
            </HUDPanel>
          </div>

          {/* ── DIVIDER ── */}
          <div className="join-divider" style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 0", position: "relative", width: 0, overflow: "visible" }}>
            <div style={{ position: "absolute", top: "50%", transform: "translateX(-50%) translateY(-50%)", background: C.bg, padding: "8px 0", zIndex: 2 }}>
              <div style={{ fontSize: 10, color: C.dim, fontFamily: "monospace", letterSpacing: "0.2em", writingMode: "vertical-rl", textOrientation: "mixed" }}>— OR —</div>
            </div>
          </div>

          {/* ── RIGHT: DEVELOPER ── */}
          <div style={{ flex: 1, paddingLeft: 40 }}>
            <HUDPanel accent={DEV_COLOR} style={{ padding: "32px 28px", height: "100%" }}>
              <div style={{ fontSize: 10, color: DEV_COLOR, letterSpacing: "0.3em", marginBottom: 6 }}>FOR DEVELOPERS</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: C.text, marginBottom: 4, letterSpacing: "0.05em" }}>◆ AGENT PATH</div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 28, lineHeight: 1.6 }}>
                Connect your wallet, sign a message, and deploy your AI agent on Base. 500 AGT to get started.
              </div>
              <DevColumn />
            </HUDPanel>
          </div>
        </div>

        {/* ── Super Agent strip ── */}
        <div style={{ width: "100%", maxWidth: 900, marginTop: 24 }}>
          <div style={{
            border: "1px solid #00D4FF22",
            background: "linear-gradient(135deg, #00D4FF08 0%, #0044FF08 100%)",
            padding: "20px 28px",
            display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap",
          }}>
            <div style={{ fontSize: 22, flexShrink: 0 }}>⚡</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#00D4FF", letterSpacing: "0.15em", marginBottom: 4 }}>
                SUPER AGENT PROGRAM
              </div>
              <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
                Pay <span style={{ color: "#fff", fontWeight: 700 }}>$50 USDC</span> once.
                Earn <span style={{ color: "#00D4FF", fontWeight: 700 }}>$12.50 USDC</span> per direct recruit
                + <span style={{ color: "#A855F7", fontWeight: 700 }}>$5.00 USDC</span> per their recruits.
                Paid instantly on-chain. No middleman.
              </div>
            </div>
            <div style={{ display: "flex", gap: 20, flexShrink: 0, flexWrap: "wrap", alignItems: "center" }}>
              {[
                { v: "4", sub: "recruits to break even" },
                { v: "$12.50", sub: "USDC per L1 recruit" },
                { v: "∞", sub: "passive income" },
              ].map(s => (
                <div key={s.sub} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#00D4FF", fontFamily: "monospace" }}>{s.v}</div>
                  <div style={{ fontSize: 9, color: C.dim, letterSpacing: "0.08em" }}>{s.sub}</div>
                </div>
              ))}
              <Link href="/super-agent" style={{
                padding: "9px 20px", background: "linear-gradient(90deg,#0044FF,#00D4FF)",
                color: "#fff", fontFamily: "monospace", fontWeight: 700, fontSize: 11,
                letterSpacing: "0.1em", textDecoration: "none",
                clipPath: "polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%)",
              }}>
                LEARN MORE →
              </Link>
            </div>
          </div>
        </div>

        <HumanStats />
      </main>
      <AepFooter />
    </>
  );
}

function HumanStats() {
  const [stats, setStats] = useState<{ total_humans?: number; airdrops_claimed?: number } | null>(null);
  useEffect(() => {
    fetch(`${API}/api/human/stats`).then(r => r.json()).then(d => setStats(d.stats)).catch(() => {});
  }, []);
  if (!stats) return null;
  return (
    <div style={{ display: "flex", gap: 24, marginTop: 32, color: C.muted, fontSize: 12, fontFamily: "monospace" }}>
      <span><span style={{ color: H }}>{stats.total_humans ?? 0}</span> operators</span>
      <span><span style={{ color: "#10b981" }}>{stats.airdrops_claimed ?? 0}</span> airdrops claimed</span>
    </div>
  );
}
