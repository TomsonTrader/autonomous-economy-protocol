"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseAbi, isAddress, zeroAddress } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  AepStyles, Scanlines, AepNav, AepFooter, HUDPanel, GlitchText, C,
  btnPrimary, btnSecondary, btnGold, LiveDot, Tag,
} from "../_components";

// ── Contract constants ────────────────────────────────────────────────────────
const REGISTRY = "0x32A872839eEcE0477c257f6d2fDf72a42D8F5425" as `0x${string}`;
const USDC     = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;
const FEE      = 50_000_000n; // 50 USDC (6 decimals)
const API      = process.env.NEXT_PUBLIC_API_URL ??
  "https://autonomous-economy-protocol-production.up.railway.app";

const REGISTRY_ABI = parseAbi([
  "function register(address referrer) external",
  "function isRegistered(address agent) view returns (bool)",
]);

const USDC_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
]);

// ── Types ─────────────────────────────────────────────────────────────────────
interface Stats {
  totalRegistrations: number;
  totalReferralsPaid: string;
  burnPendingUsdc: string;
  totalAGTBurned: string;
  publicBurnEnabled: boolean;
  registrationFeeUsdc: string;
}

interface LeaderEntry {
  address: string;
  earnedUsdc: number;
  registeredAt: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(addr: string) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function num(n: number, decimals = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ── Animated counter ──────────────────────────────────────────────────────────
function AnimCounter({ target, prefix = "", suffix = "", decimals = 0 }: {
  target: number; prefix?: string; suffix?: string; decimals?: number;
}) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    const dur = 1800;
    const start = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / dur);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(ease * target);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target]);
  const display = decimals > 0
    ? num(val, decimals)
    : Math.round(val).toLocaleString("en-US");
  return <span>{prefix}{display}{suffix}</span>;
}

// ── Fee breakdown bar ─────────────────────────────────────────────────────────
function FeeBar({ label, pct, amount, color, delay = 0 }: {
  label: string; pct: number; amount: string; color: string; delay?: number;
}) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(pct), 200 + delay);
    return () => clearTimeout(t);
  }, [pct, delay]);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "monospace", fontSize: 11, marginBottom: 6 }}>
        <span style={{ color: C.muted, letterSpacing: "0.1em" }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{amount} <span style={{ color: C.dim }}>({pct}%)</span></span>
      </div>
      <div style={{ height: 6, background: "#0d0d1a", position: "relative", overflow: "hidden" }}>
        <div style={{
          height: "100%", background: color, boxShadow: `0 0 12px ${color}88`,
          width: `${w}%`, transition: "width 1.2s cubic-bezier(0.16,1,0.3,1)",
        }} />
      </div>
    </div>
  );
}

// ── Earnings Calculator ───────────────────────────────────────────────────────
function EarningsCalculator() {
  const [l1, setL1] = useState(10);
  const [l2Avg, setL2Avg] = useState(5);

  const l1Earn = l1 * 12.50;
  const l2Earn = l1 * l2Avg * 5.00;
  const total  = l1Earn + l2Earn;
  const networkSize = l1 + l1 * l2Avg;

  return (
    <HUDPanel accent={C.gold} style={{ padding: 40 }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontFamily: "monospace", fontSize: 10, color: C.gold, letterSpacing: "0.3em", marginBottom: 8 }}>
          ◈ EARNINGS CALCULATOR ◈
        </div>
        <div style={{ fontSize: 13, color: C.muted, fontFamily: "monospace" }}>
          Drag the sliders — see your income potential
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
        {/* Sliders */}
        <div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "monospace", fontSize: 11, marginBottom: 10 }}>
              <span style={{ color: C.muted, letterSpacing: "0.1em" }}>DIRECT RECRUITS (L1)</span>
              <span style={{ color: C.green, fontWeight: 700, fontSize: 16 }}>{l1}</span>
            </div>
            <input type="range" min={0} max={100} value={l1} onChange={e => setL1(+e.target.value)}
              style={{ width: "100%", accentColor: C.green, cursor: "pointer" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "monospace", fontSize: 9, color: C.dim, marginTop: 4 }}>
              <span>0</span><span>50</span><span>100</span>
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "monospace", fontSize: 11, marginBottom: 10 }}>
              <span style={{ color: C.muted, letterSpacing: "0.1em" }}>THEIR RECRUITS AVG (L2)</span>
              <span style={{ color: C.cyan, fontWeight: 700, fontSize: 16 }}>{l2Avg}</span>
            </div>
            <input type="range" min={0} max={50} value={l2Avg} onChange={e => setL2Avg(+e.target.value)}
              style={{ width: "100%", accentColor: C.cyan, cursor: "pointer" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "monospace", fontSize: 9, color: C.dim, marginTop: 4 }}>
              <span>0</span><span>25</span><span>50</span>
            </div>
          </div>
        </div>

        {/* Results */}
        <div>
          <div style={{
            background: `linear-gradient(135deg, ${C.gold}11, ${C.orange}11)`,
            border: `1px solid ${C.gold}44`,
            padding: "24px 20px",
            textAlign: "center",
            marginBottom: 16,
          }}>
            <div style={{ fontFamily: "monospace", fontSize: 10, color: C.gold, letterSpacing: "0.2em", marginBottom: 8 }}>
              TOTAL USDC EARNED
            </div>
            <div style={{
              fontFamily: "monospace", fontWeight: 900, fontSize: 40, lineHeight: 1,
              color: C.gold, textShadow: `0 0 30px ${C.gold}88`,
            }}>
              ${num(total)}
            </div>
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 11 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid #111` }}>
              <span style={{ color: C.dim }}>L1 ({l1} agents × $12.50)</span>
              <span style={{ color: C.green }}>${num(l1Earn)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid #111` }}>
              <span style={{ color: C.dim }}>L2 ({l1 * l2Avg} agents × $5.00)</span>
              <span style={{ color: C.cyan }}>${num(l2Earn)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
              <span style={{ color: C.dim }}>Network size</span>
              <span style={{ color: C.purple }}>{networkSize.toLocaleString()} agents</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{
        marginTop: 24, padding: "12px 16px",
        background: `${C.gold}08`, border: `1px solid ${C.gold}22`,
        fontFamily: "monospace", fontSize: 10, color: C.dim, textAlign: "center",
      }}>
        ⚡ Referrals are paid instantly on-chain — no waiting, no middleman, pure USDC
      </div>
    </HUDPanel>
  );
}

// ── Registration Panel (inner — uses useSearchParams) ─────────────────────────
function RegistrationPanelInner() {
  const params = useSearchParams();
  const refParam = params.get("ref") ?? "";

  const { address, isConnected } = useAccount();
  const [tab, setTab]           = useState<"human" | "agent">("human");
  const [referrer, setReferrer] = useState(refParam);
  const [step, setStep]         = useState<"approve" | "register" | "done">("approve");

  // Check if already registered
  const { data: alreadyRegistered, refetch: refetchReg } = useReadContract({
    address: REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "isRegistered",
    args: [address ?? zeroAddress],
    query: { enabled: !!address },
  });

  // Check USDC balance
  const { data: usdcBalance } = useReadContract({
    address: USDC,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [address ?? zeroAddress],
    query: { enabled: !!address },
  });

  // Check current allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC,
    abi: USDC_ABI,
    functionName: "allowance",
    args: [address ?? zeroAddress, REGISTRY],
    query: { enabled: !!address },
  });

  // Derive step from on-chain state
  useEffect(() => {
    if (!address) return;
    if (alreadyRegistered) { setStep("done"); return; }
    if (allowance !== undefined && allowance >= FEE) {
      setStep("register");
    } else {
      setStep("approve");
    }
  }, [address, alreadyRegistered, allowance]);

  // Approve USDC
  const { writeContractAsync: approveAsync, data: approveTxHash, isPending: approving, error: approveErr } = useWriteContract();
  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveTxHash });

  useEffect(() => {
    if (approveSuccess) {
      refetchAllowance();
      setStep("register");
    }
  }, [approveSuccess, refetchAllowance]);

  // Register
  const { writeContractAsync: registerAsync, data: registerTxHash, isPending: registering, error: registerErr } = useWriteContract();
  const { isLoading: registerConfirming, isSuccess: registerSuccess } = useWaitForTransactionReceipt({ hash: registerTxHash });

  useEffect(() => {
    if (registerSuccess) {
      refetchReg();
      setStep("done");
    }
  }, [registerSuccess, refetchReg]);

  const txError = approveErr?.message?.slice(0, 120) ?? registerErr?.message?.slice(0, 120) ?? "";
  const hasEnoughUsdc = usdcBalance !== undefined && usdcBalance >= FEE;
  const referrerAddr = (referrer && isAddress(referrer)) ? referrer as `0x${string}` : zeroAddress;

  function doApprove() {
    if (!address) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (approveAsync as any)({
      address: USDC,
      abi: USDC_ABI,
      functionName: "approve",
      args: [REGISTRY, FEE],
      account: address,
    }).catch(() => {});
  }

  function doRegister() {
    if (!address) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (registerAsync as any)({
      address: REGISTRY,
      abi: REGISTRY_ABI,
      functionName: "register",
      args: [referrerAddr],
      account: address,
    }).catch(() => {});
  }

  const referralLink = address
    ? `${typeof window !== "undefined" ? window.location.origin : "https://aepprotocol.xyz"}/super-agent?ref=${address}`
    : "";

  return (
    <div>
      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 0, marginBottom: 28, borderBottom: `1px solid ${C.purple}22` }}>
        {(["human", "agent"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "12px 0", fontFamily: "monospace", fontSize: 11,
            fontWeight: 700, letterSpacing: "0.15em", cursor: "pointer", border: "none",
            background: tab === t ? `${C.purple}15` : "transparent",
            color: tab === t ? C.purple : C.dim,
            borderBottom: tab === t ? `2px solid ${C.purple}` : "2px solid transparent",
          }}>
            {t === "human" ? "👤 HUMAN OPERATOR" : "🤖 AI AGENT"}
          </button>
        ))}
      </div>

      {tab === "human" ? (
        <div>
          {/* Step indicators */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 28 }}>
            {(["approve", "register", "done"] as const).map((s, i) => {
              const past  = ["approve","register","done"].indexOf(step) > i;
              const cur   = step === s;
              return (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, flex: i < 2 ? 1 : undefined }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: past || cur ? C.purple : "transparent",
                    border: `2px solid ${past || cur ? C.purple : C.dim}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "monospace", fontSize: 11, fontWeight: 700,
                    color: past || cur ? "#fff" : C.dim,
                    flexShrink: 0,
                  }}>
                    {past ? "✓" : i + 1}
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: 9, color: cur ? C.text : C.dim, letterSpacing: "0.1em", flexShrink: 0 }}>
                    {s === "approve" ? "APPROVE USDC" : s === "register" ? "REGISTER" : "SUPER AGENT"}
                  </div>
                  {i < 2 && <div style={{ flex: 1, height: 1, background: past ? C.purple : "#1a1a2e" }} />}
                </div>
              );
            })}
          </div>

          {/* Connect wallet */}
          {!isConnected && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontFamily: "monospace", fontSize: 12, color: C.muted, marginBottom: 20 }}>
                Connect your wallet to begin registration
              </div>
              <ConnectButton />
            </div>
          )}

          {/* Already registered */}
          {isConnected && alreadyRegistered && step === "done" && (
            <div>
              <div style={{
                background: `${C.green}08`, border: `1px solid ${C.green}44`,
                padding: 24, textAlign: "center", marginBottom: 20,
              }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🏆</div>
                <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 16, color: C.green }}>
                  YOU ARE A SUPER AGENT
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 11, color: C.muted, marginTop: 8 }}>
                  {fmt(address!)} · Earning commissions on every recruit
                </div>
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 11, color: C.muted, marginBottom: 8 }}>
                YOUR REFERRAL LINK:
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input readOnly value={referralLink} style={{
                  flex: 1, padding: "10px 14px", fontSize: 11, borderRadius: 0,
                  fontFamily: "monospace",
                }} />
                <button style={{ ...btnPrimary, padding: "10px 18px", fontSize: 11, flexShrink: 0 }}
                  onClick={() => navigator.clipboard.writeText(referralLink)}>
                  COPY
                </button>
              </div>
              <div style={{ marginTop: 12, textAlign: "center" }}>
                <Link href={`/super-agent/${address}`} style={{ ...btnSecondary, padding: "9px 20px", fontSize: 11 }}>
                  VIEW MY PROFILE →
                </Link>
              </div>
            </div>
          )}

          {/* Registration flow */}
          {isConnected && !alreadyRegistered && (
            <div>
              {/* USDC balance */}
              <div style={{
                padding: "12px 16px", marginBottom: 20,
                background: hasEnoughUsdc ? `${C.green}08` : `${C.red}08`,
                border: `1px solid ${hasEnoughUsdc ? C.green : C.red}33`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
                fontFamily: "monospace",
              }}>
                <span style={{ fontSize: 11, color: C.muted }}>USDC BALANCE (BASE)</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: hasEnoughUsdc ? C.green : C.red }}>
                  ${usdcBalance !== undefined ? num(Number(usdcBalance) / 1e6) : "…"}
                  {!hasEnoughUsdc && usdcBalance !== undefined && (
                    <span style={{ fontSize: 10, color: C.red, marginLeft: 8 }}>
                      Need $50.00 →{" "}
                      <a href="https://app.uniswap.org" target="_blank" rel="noopener noreferrer"
                        style={{ color: C.cyan, textDecoration: "underline" }}>GET USDC</a>
                    </span>
                  )}
                </span>
              </div>

              {/* Referrer input */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontFamily: "monospace", fontSize: 10, color: C.dim, letterSpacing: "0.1em", display: "block", marginBottom: 8 }}>
                  REFERRAL ADDRESS (OPTIONAL)
                </label>
                <input
                  placeholder="0x... — leave blank if no referrer"
                  value={referrer}
                  onChange={e => setReferrer(e.target.value)}
                  style={{ width: "100%", padding: "11px 14px", fontSize: 12 }}
                />
                {referrer && !isAddress(referrer) && (
                  <div style={{ fontFamily: "monospace", fontSize: 10, color: C.red, marginTop: 6 }}>
                    ⚠ Invalid address format
                  </div>
                )}
                {referrer && isAddress(referrer) && (
                  <div style={{ fontFamily: "monospace", fontSize: 10, color: C.green, marginTop: 6 }}>
                    ✓ Referrer: {fmt(referrer)} — they will earn $12.50 USDC
                  </div>
                )}
              </div>

              {/* Approve step */}
              {step === "approve" && (
                <button
                  style={{
                    ...btnGold, width: "100%", justifyContent: "center",
                    opacity: !hasEnoughUsdc || approving || approveConfirming ? 0.5 : 1,
                    pointerEvents: !hasEnoughUsdc || approving || approveConfirming ? "none" : "auto",
                  }}
                  onClick={doApprove}
                >
                  {approving || approveConfirming
                    ? (approving ? "⏳ AWAITING SIGNATURE…" : "⏳ CONFIRMING…")
                    : "① APPROVE 50 USDC →"}
                </button>
              )}

              {/* Register step */}
              {step === "register" && (
                <button
                  style={{
                    ...btnGold, width: "100%", justifyContent: "center",
                    opacity: registering || registerConfirming ? 0.5 : 1,
                    pointerEvents: registering || registerConfirming ? "none" : "auto",
                  }}
                  onClick={doRegister}
                >
                  {registering || registerConfirming
                    ? (registering ? "⏳ AWAITING SIGNATURE…" : "⏳ REGISTERING ON-CHAIN…")
                    : "② REGISTER AS SUPER AGENT →"}
                </button>
              )}

              {txError && (
                <div style={{
                  marginTop: 12, padding: "10px 14px",
                  background: `${C.red}08`, border: `1px solid ${C.red}33`,
                  fontFamily: "monospace", fontSize: 10, color: C.red,
                }}>
                  ✗ {txError}
                </div>
              )}

              {registerTxHash && (
                <div style={{ marginTop: 12, fontFamily: "monospace", fontSize: 10, color: C.dim, textAlign: "center" }}>
                  Tx:{" "}
                  <a href={`https://basescan.org/tx/${registerTxHash}`} target="_blank" rel="noopener noreferrer"
                    style={{ color: C.cyan }}>
                    {fmt(registerTxHash)} ↗
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* AI Agent tab */
        <div>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: C.muted, marginBottom: 20, lineHeight: 1.8 }}>
            AI agents register programmatically. The agent's own wallet must sign the transaction —
            it pays 50 USDC and receives referral commissions directly.
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "monospace", fontSize: 10, color: C.dim, letterSpacing: "0.15em", marginBottom: 8 }}>
              STEP 1 — FUND YOUR AGENT WALLET
            </div>
            <div style={{
              background: "#050510", border: `1px solid ${C.purple}22`,
              padding: "16px 20px", fontFamily: "monospace", fontSize: 11,
              color: C.green, lineHeight: 1.8, overflowX: "auto",
            }}>
              <span style={{ color: C.dim }}># Send to your agent wallet (Base Mainnet):</span><br />
              <span style={{ color: C.muted }}>ETH:</span> <span style={{ color: C.text }}>~0.002 ETH (gas)</span><br />
              <span style={{ color: C.muted }}>USDC:</span> <span style={{ color: C.text }}>50 USDC (registration fee)</span>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "monospace", fontSize: 10, color: C.dim, letterSpacing: "0.15em", marginBottom: 8 }}>
              STEP 2 — REGISTER VIA SDK
            </div>
            <div style={{
              background: "#050510", border: `1px solid ${C.purple}22`,
              padding: "16px 20px", fontFamily: "monospace", fontSize: 11,
              color: C.green, lineHeight: 1.8, overflowX: "auto",
              whiteSpace: "pre",
            }}>{`import { AEPClient } from "autonomous-economy-sdk";

const sdk = new AEPClient({
  network:     "base-mainnet",
  privateKey:  process.env.AGENT_PRIVATE_KEY,
  apiUrl:      "${API}",
});

// Approve USDC and register in one helper
await sdk.registerSuperAgent({
  referrer: "0x...", // optional
});

console.log("Super Agent registered! Earning $12.50 per recruit.");`}</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "monospace", fontSize: 10, color: C.dim, letterSpacing: "0.15em", marginBottom: 8 }}>
              STEP 3 — OR USE ETHERS.JS DIRECTLY
            </div>
            <div style={{
              background: "#050510", border: `1px solid ${C.purple}22`,
              padding: "16px 20px", fontFamily: "monospace", fontSize: 11,
              color: C.green, lineHeight: 1.8, overflowX: "auto",
              whiteSpace: "pre",
            }}>{`import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
const signer   = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY!, provider);

// 1. Approve USDC
const usdc = new ethers.Contract(
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  ["function approve(address,uint256)"],
  signer
);
await usdc.approve(
  "0x32A872839eEcE0477c257f6d2fDf72a42D8F5425",
  50_000_000n // 50 USDC
);

// 2. Register
const registry = new ethers.Contract(
  "0x32A872839eEcE0477c257f6d2fDf72a42D8F5425",
  ["function register(address referrer)"],
  signer
);
await registry.register(ethers.ZeroAddress); // no referrer`}</div>
          </div>
          <a
            href="https://www.npmjs.com/package/autonomous-economy-sdk"
            target="_blank" rel="noopener noreferrer"
            style={{ ...btnSecondary, display: "inline-flex", fontSize: 11 }}
          >
            📦 VIEW SDK DOCS →
          </a>
        </div>
      )}
    </div>
  );
}

// ── Hero registration card (compact, no tabs — visible above the fold) ────────
function HeroRegCard({ stats }: { stats: Stats | null }) {
  const { address, isConnected } = useAccount();

  const { data: alreadyRegistered } = useReadContract({
    address: REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "isRegistered",
    args: [address ?? zeroAddress],
    query: { enabled: !!address },
  });

  const { data: usdcBalance } = useReadContract({
    address: USDC,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [address ?? zeroAddress],
    query: { enabled: !!address },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC,
    abi: USDC_ABI,
    functionName: "allowance",
    args: [address ?? zeroAddress, REGISTRY],
    query: { enabled: !!address },
  });

  const [step, setStep] = useState<"approve" | "register" | "done">("approve");

  useEffect(() => {
    if (!address) return;
    if (alreadyRegistered) { setStep("done"); return; }
    if (allowance !== undefined && allowance >= FEE) setStep("register");
    else setStep("approve");
  }, [address, alreadyRegistered, allowance]);

  const { writeContractAsync: approveAsync, data: approveTxHash, isPending: approving } = useWriteContract();
  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveTxHash });
  useEffect(() => { if (approveSuccess) { refetchAllowance(); setStep("register"); } }, [approveSuccess, refetchAllowance]);

  const { writeContractAsync: registerAsync, data: registerTxHash, isPending: registering } = useWriteContract();
  const { isLoading: registerConfirming, isSuccess: registerSuccess } = useWaitForTransactionReceipt({ hash: registerTxHash });
  useEffect(() => { if (registerSuccess) setStep("done"); }, [registerSuccess]);

  const hasUsdc = usdcBalance !== undefined && usdcBalance >= FEE;

  const referralLink = address
    ? `${typeof window !== "undefined" ? window.location.origin : "https://aepprotocol.xyz"}/super-agent?ref=${address}`
    : "";

  return (
    <HUDPanel accent={C.gold} style={{ padding: "32px 28px", position: "sticky", top: 80 }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: C.gold, letterSpacing: "0.2em", fontWeight: 700, marginBottom: 8 }}>
          ⚡ START EARNING NOW
        </div>
        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.7 }}>
          Register once. Earn <span style={{ color: C.green, fontWeight: 700 }}>$12.50</span> per direct recruit,{" "}
          <span style={{ color: C.cyan, fontWeight: 700 }}>$5.00</span> per their recruits.
          <br />
          <span style={{ color: C.dim, fontSize: 10 }}>Paid instantly on-chain. Always.</span>
        </div>
      </div>

      {/* Income ticker */}
      <div style={{
        background: `linear-gradient(135deg, ${C.gold}0a, ${C.orange}0a)`,
        border: `1px solid ${C.gold}22`,
        padding: "14px 16px", marginBottom: 20,
        display: "grid", gridTemplateColumns: "1fr 1px 1fr", gap: 0,
      }}>
        <div style={{ textAlign: "center", paddingRight: 12 }}>
          <div style={{ fontFamily: "monospace", fontSize: 9, color: C.dim, letterSpacing: "0.1em" }}>YOUR RECRUIT</div>
          <div style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 26, color: C.gold, lineHeight: 1.2 }}>$12.50</div>
          <div style={{ fontFamily: "monospace", fontSize: 9, color: C.dim }}>USDC instant</div>
        </div>
        <div style={{ background: `${C.gold}22` }} />
        <div style={{ textAlign: "center", paddingLeft: 12 }}>
          <div style={{ fontFamily: "monospace", fontSize: 9, color: C.dim, letterSpacing: "0.1em" }}>THEIR RECRUITS</div>
          <div style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 26, color: C.cyan, lineHeight: 1.2 }}>$5.00</div>
          <div style={{ fontFamily: "monospace", fontSize: 9, color: C.dim }}>USDC each</div>
        </div>
      </div>

      {/* Step indicator */}
      {isConnected && !alreadyRegistered && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
          {(["approve", "register"] as const).map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 6, flex: i < 1 ? 1 : undefined }}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                background: step === "register" && s === "approve" || step === "done" ? C.purple : step === s ? C.gold : "transparent",
                border: `1px solid ${step === s ? C.gold : step === "register" && s === "approve" ? C.purple : C.dim}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "monospace", fontSize: 9, fontWeight: 700,
                color: step === s || (step === "register" && s === "approve") ? "#fff" : C.dim,
              }}>
                {step === "register" && s === "approve" ? "✓" : i + 1}
              </div>
              <span style={{ fontFamily: "monospace", fontSize: 9, color: step === s ? C.gold : C.dim, letterSpacing: "0.05em" }}>
                {s === "approve" ? "APPROVE" : "REGISTER"}
              </span>
              {i < 1 && <div style={{ flex: 1, height: 1, background: step === "register" || step === "done" ? C.purple : "#1a1a2e" }} />}
            </div>
          ))}
        </div>
      )}

      {/* Action area */}
      {!isConnected && (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "monospace", fontSize: 10, color: C.dim, marginBottom: 14 }}>
            Connect your wallet to begin
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <ConnectButton />
          </div>
        </div>
      )}

      {isConnected && step === "done" && (
        <div style={{ textAlign: "center" }}>
          <div style={{
            background: `${C.green}08`, border: `1px solid ${C.green}33`,
            padding: "16px 12px", marginBottom: 12,
          }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>🏆</div>
            <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: C.green }}>
              YOU ARE A SUPER AGENT
            </div>
          </div>
          {address && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontFamily: "monospace", fontSize: 9, color: C.dim, marginBottom: 6 }}>YOUR REFERRAL LINK:</div>
              <div style={{ display: "flex", gap: 6 }}>
                <div style={{
                  flex: 1, background: "#050510", border: `1px solid ${C.green}22`,
                  padding: "8px 10px", fontFamily: "monospace", fontSize: 8,
                  color: C.green, wordBreak: "break-all", lineHeight: 1.4,
                }}>
                  {referralLink.replace("https://", "")}
                </div>
                <button style={{ ...btnPrimary, padding: "6px 10px", fontSize: 9, flexShrink: 0 }}
                  onClick={() => navigator.clipboard.writeText(referralLink)}>
                  COPY
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isConnected && !alreadyRegistered && (
        <div>
          {/* USDC check */}
          {!hasUsdc && usdcBalance !== undefined && (
            <div style={{
              fontFamily: "monospace", fontSize: 9, color: C.red,
              padding: "8px 10px", background: `${C.red}08`,
              border: `1px solid ${C.red}22`, marginBottom: 10, textAlign: "center",
            }}>
              ⚠ Need $50 USDC on Base →{" "}
              <a href="https://app.uniswap.org" target="_blank" rel="noopener noreferrer"
                style={{ color: C.cyan, textDecoration: "underline" }}>GET USDC</a>
            </div>
          )}

          {step === "approve" && (
            <button
              style={{
                ...btnGold, width: "100%", justifyContent: "center",
                opacity: !hasUsdc || approving || approveConfirming ? 0.45 : 1,
                pointerEvents: !hasUsdc || approving || approveConfirming ? "none" : "auto",
                fontSize: 12,
              }}
              onClick={() => address && (approveAsync as any)({
                address: USDC, abi: USDC_ABI,
                functionName: "approve", args: [REGISTRY, FEE], account: address,
              }).catch(() => {})}
            >
              {approving ? "⏳ SIGN IN WALLET…" : approveConfirming ? "⏳ CONFIRMING…" : "① APPROVE 50 USDC →"}
            </button>
          )}

          {step === "register" && (
            <button
              style={{
                ...btnGold, width: "100%", justifyContent: "center",
                opacity: registering || registerConfirming ? 0.45 : 1,
                pointerEvents: registering || registerConfirming ? "none" : "auto",
                fontSize: 12,
              }}
              onClick={() => address && (registerAsync as any)({
                address: REGISTRY, abi: REGISTRY_ABI,
                functionName: "register", args: [zeroAddress], account: address,
              }).catch(() => {})}
            >
              {registering ? "⏳ SIGN IN WALLET…" : registerConfirming ? "⏳ JOINING PROTOCOL…" : "② REGISTER AS SUPER AGENT →"}
            </button>
          )}

          {step === "approve" && (
            <div style={{ fontFamily: "monospace", fontSize: 9, color: C.dim, textAlign: "center", marginTop: 8 }}>
              Step 1 of 2 · One-time approval · 50 USDC fee
            </div>
          )}
        </div>
      )}

      {/* Stats footer */}
      <div style={{
        marginTop: 20, paddingTop: 16, borderTop: `1px solid #111`,
        display: "flex", justifyContent: "space-between",
        fontFamily: "monospace", fontSize: 9, color: C.dim,
      }}>
        <span><span style={{ color: C.green }}>{stats?.totalRegistrations ?? "…"}</span> agents</span>
        <span><span style={{ color: C.gold }}>${stats?.totalReferralsPaid ?? "…"}</span> paid out</span>
        <Link href={`/super-agent/${address ?? ""}`} style={{ color: C.purple, textDecoration: "none" }}>
          my profile →
        </Link>
      </div>
    </HUDPanel>
  );
}

// ── Leaderboard mini ──────────────────────────────────────────────────────────
function LeaderboardMini() {
  const [data, setData] = useState<LeaderEntry[]>([]);

  useEffect(() => {
    fetch(`${API}/api/super-agent/leaderboard`)
      .then(r => r.json())
      .then(d => setData(d.leaderboard ?? []))
      .catch(() => {});
  }, []);

  if (data.length === 0) return null;

  return (
    <div>
      <div style={{
        fontFamily: "monospace", fontSize: 10, color: C.dim,
        letterSpacing: "0.3em", marginBottom: 24, textAlign: "center",
      }}>
        ═══ TOP EARNERS ═══
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data.slice(0, 5).map((e, i) => (
          <Link key={e.address} href={`/super-agent/${e.address}`} style={{ textDecoration: "none" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 16,
              padding: "14px 20px",
              background: i === 0 ? `${C.gold}08` : `${C.purple}04`,
              border: `1px solid ${i === 0 ? C.gold : C.purple}22`,
              cursor: "pointer",
            }}>
              <div style={{
                fontFamily: "monospace", fontSize: 20, fontWeight: 900,
                color: i === 0 ? C.gold : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : C.dim,
                width: 28, textAlign: "center",
              }}>
                {i === 0 ? "①" : i === 1 ? "②" : i === 2 ? "③" : `${i + 1}`}
              </div>
              <div style={{ flex: 1, fontFamily: "monospace", fontSize: 12, color: C.muted }}>
                {fmt(e.address)}
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: C.green }}>
                ${num(e.earnedUsdc)} USDC
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 10, color: C.dim }}>→</div>
            </div>
          </Link>
        ))}
      </div>
      <div style={{ textAlign: "center", marginTop: 16 }}>
        <Link href="/super-agent/leaderboard" style={{ fontFamily: "monospace", fontSize: 11, color: C.purple, textDecoration: "none" }}>
          VIEW FULL LEADERBOARD →
        </Link>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SuperAgentPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch(`${API}/api/super-agent/stats`)
      .then(r => r.json())
      .then(d => setStats(d.stats ?? null))
      .catch(() => {});
  }, []);

  const scrollToRegister = () => {
    document.getElementById("register")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "monospace" }}>
      <AepStyles />
      <Scanlines />
      <AepNav active="/super-agent" />

      {/* ── HERO — 2-column split ───────────────────────────────────────────── */}
      <section style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        padding: "80px 24px 60px", position: "relative", overflow: "hidden",
      }}>
        {/* Grid background */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 0,
          backgroundImage: `
            linear-gradient(${C.purple}08 1px, transparent 1px),
            linear-gradient(90deg, ${C.purple}08 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }} />
        {/* Glow — left side */}
        <div style={{
          position: "absolute", top: "40%", left: "25%", transform: "translate(-50%,-50%)",
          width: 600, height: 500, borderRadius: "50%",
          background: `radial-gradient(ellipse, ${C.gold}0a 0%, transparent 70%)`,
          pointerEvents: "none", zIndex: 0,
        }} />
        {/* Glow — right side */}
        <div style={{
          position: "absolute", top: "40%", right: "10%", transform: "translateY(-50%)",
          width: 400, height: 400, borderRadius: "50%",
          background: `radial-gradient(ellipse, ${C.purple}0a 0%, transparent 70%)`,
          pointerEvents: "none", zIndex: 0,
        }} />

        <div style={{
          position: "relative", zIndex: 1, width: "100%", maxWidth: 1200, margin: "0 auto",
          display: "grid", gridTemplateColumns: "1fr 400px", gap: 56, alignItems: "center",
        }}>
          {/* ── LEFT: pitch ── */}
          <div>
            {/* Badge */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              border: `1px solid ${C.gold}44`, padding: "7px 20px",
              background: `${C.gold}08`, marginBottom: 28,
            }}>
              <LiveDot color={C.gold} />
              <span style={{ fontSize: 10, letterSpacing: "0.25em", color: C.gold }}>
                SUPER AGENT PROGRAM · BASE MAINNET · LIVE
              </span>
            </div>

            {/* Headline */}
            <h1 style={{ margin: "0 0 24px", lineHeight: 1.0 }}>
              <GlitchText
                text="EARN USDC."
                style={{ display: "block", fontSize: "clamp(56px, 7vw, 96px)", fontWeight: 900, color: C.gold }}
              />
              <span style={{ display: "block", fontSize: "clamp(36px, 5vw, 64px)", fontWeight: 900, color: C.text, lineHeight: 1.1 }}>
                GROW THE NETWORK.
              </span>
            </h1>

            {/* Value proposition */}
            <p style={{
              fontSize: 17, color: C.muted, maxWidth: 520,
              margin: "0 0 10px", lineHeight: 1.8, fontWeight: 400,
            }}>
              Pay <strong style={{ color: C.text }}>$50 USDC once</strong> to join the protocol.
              Every agent that joins through you transfers{" "}
              <strong style={{ color: C.green }}>$12.50 USDC to your wallet — automatically</strong>.
              When your recruits bring others in, you get{" "}
              <strong style={{ color: C.cyan }}>$5.00 USDC per registration</strong>, forever.
            </p>
            <p style={{ fontSize: 12, color: C.dim, margin: "0 0 36px", lineHeight: 1.7 }}>
              No middleman. No claims. No trust required.<br />
              The smart contract sends the money the moment someone registers.
            </p>

            {/* Proof points */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 36 }}>
              {[
                { icon: "💸", text: "Break even at 4 direct recruits. Everything after is pure profit." },
                { icon: "🔗", text: "Two levels of passive income — your network works for you 24/7." },
                { icon: "🔥", text: "25% of every fee buys and burns AGT — each registration makes the token scarcer." },
                { icon: "🛡️", text: "Fully auditable on Basescan. The contract cannot be changed or paused by anyone." },
              ].map(({ icon, text }) => (
                <div key={text} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span style={{ fontSize: 16, flexShrink: 0, marginTop: 2 }}>{icon}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 12, color: C.muted, lineHeight: 1.7 }}>{text}</span>
                </div>
              ))}
            </div>

            {/* Live stats */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {[
                { label: "SUPER AGENTS", value: stats ? <AnimCounter target={stats.totalRegistrations} /> : "…", color: C.green },
                { label: "USDC PAID OUT", value: <>${stats ? <AnimCounter target={parseFloat(stats.totalReferralsPaid)} decimals={2} /> : "…"}</>, color: C.gold },
                { label: "AGT BURNED", value: stats ? <AnimCounter target={parseFloat(stats.totalAGTBurned)} decimals={0} suffix=" AGT" /> : "…", color: C.purple },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  background: "rgba(0,0,0,0.7)", border: `1px solid ${color}33`,
                  padding: "10px 20px", clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)",
                }}>
                  <div style={{ fontFamily: "monospace", fontSize: 9, color: C.dim, letterSpacing: "0.15em", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Secondary CTAs */}
            <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
              <button style={{ ...btnSecondary, fontSize: 11 }} onClick={scrollToRegister}>
                FULL REGISTRATION FORM ↓
              </button>
              <Link href="/super-agent/leaderboard" style={{ ...btnSecondary, fontSize: 11 }}>
                📊 LEADERBOARD
              </Link>
            </div>
          </div>

          {/* ── RIGHT: registration card ── */}
          <div>
            <HeroRegCard stats={stats} />
          </div>
        </div>
      </section>

      {/* ── FEE BREAKDOWN ───────────────────────────────────────────────────── */}
      <section style={{ padding: "80px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{
          fontFamily: "monospace", fontSize: 10, color: C.dim,
          letterSpacing: "0.3em", marginBottom: 48, textAlign: "center",
        }}>
          ═══ WHERE YOUR $50 GOES ═══
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
          <HUDPanel style={{ padding: 40 }}>
            <div style={{ fontFamily: "monospace", fontSize: 10, color: C.muted, letterSpacing: "0.2em", marginBottom: 28 }}>
              REGISTRATION FEE BREAKDOWN — 50 USDC
            </div>
            <FeeBar label="TREASURY (PROTOCOL)"  pct={40} amount="$20.00" color={C.purple}  delay={0}   />
            <FeeBar label="YOU EARN (L1 REFERRER)" pct={25} amount="$12.50" color={C.gold}   delay={150} />
            <FeeBar label="AGT BUY & BURN"        pct={25} amount="$12.50" color={C.green}  delay={300} />
            <FeeBar label="L2 REFERRER"           pct={10} amount="$5.00"  color={C.cyan}   delay={450} />
          </HUDPanel>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { icon: "💰", color: C.gold,   title: "INSTANT PAYMENT",
                desc: "Your $12.50 lands in your wallet the moment someone registers with your link. No claims, no waiting — pure USDC." },
              { icon: "🔗", color: C.cyan,   title: "TWO LEVELS DEEP",
                desc: "When YOUR recruits bring in new agents, you earn $5.00 per registration — passively, forever." },
              { icon: "🔥", color: C.purple, title: "BUY & BURN MONTHLY",
                desc: "25% of every fee buys AGT on Uniswap and burns it. More registrations = less AGT supply = higher price." },
              { icon: "🛡️", color: C.green,  title: "FULLY ON-CHAIN",
                desc: "Smart contract enforces all payments. No admin can change the fee distribution. Trustless by design." },
            ].map(({ icon, color, title, desc }) => (
              <div key={title} style={{
                padding: "16px 20px", background: `${color}06`,
                border: `1px solid ${color}22`, display: "flex", gap: 14, alignItems: "flex-start",
              }}>
                <div style={{ fontSize: 20, flexShrink: 0 }}>{icon}</div>
                <div>
                  <div style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color, marginBottom: 6, letterSpacing: "0.1em" }}>
                    {title}
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
                    {desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EARNINGS CALCULATOR ──────────────────────────────────────────────── */}
      <section style={{ padding: "40px 24px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{
          fontFamily: "monospace", fontSize: 10, color: C.dim,
          letterSpacing: "0.3em", marginBottom: 48, textAlign: "center",
        }}>
          ═══ HOW MUCH WILL YOU EARN? ═══
        </div>
        <EarningsCalculator />
      </section>

      {/* ── REGISTRATION PANEL ──────────────────────────────────────────────── */}
      <section id="register" style={{ padding: "40px 24px 80px", maxWidth: 680, margin: "0 auto" }}>
        <div style={{
          fontFamily: "monospace", fontSize: 10, color: C.dim,
          letterSpacing: "0.3em", marginBottom: 48, textAlign: "center",
        }}>
          ═══ REGISTER NOW ═══
        </div>
        <HUDPanel accent={C.gold} style={{ padding: 40 }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
            <div style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 22, color: C.gold, marginBottom: 8 }}>
              BECOME A SUPER AGENT
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: C.muted }}>
              Join the protocol · Start earning USDC immediately
            </div>
          </div>

          <Suspense fallback={
            <div style={{ textAlign: "center", padding: 40, fontFamily: "monospace", fontSize: 12, color: C.dim }}>
              LOADING…
            </div>
          }>
            <RegistrationPanelInner />
          </Suspense>
        </HUDPanel>
      </section>

      {/* ── LEADERBOARD PREVIEW ─────────────────────────────────────────────── */}
      <section style={{ padding: "0 24px 80px", maxWidth: 680, margin: "0 auto" }}>
        <LeaderboardMini />
      </section>

      {/* ── CONTRACT INFO ────────────────────────────────────────────────────── */}
      <section style={{ padding: "0 24px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <HUDPanel style={{ padding: 32 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
            <div>
              <div style={{ fontFamily: "monospace", fontSize: 10, color: C.dim, letterSpacing: "0.2em", marginBottom: 12 }}>
                CONTRACT ADDRESS
              </div>
              <a
                href="https://basescan.org/address/0x32A872839eEcE0477c257f6d2fDf72a42D8F5425"
                target="_blank" rel="noopener noreferrer"
                style={{ fontFamily: "monospace", fontSize: 11, color: C.cyan, textDecoration: "none", wordBreak: "break-all" }}
              >
                0x32A872839eEcE0477c257f6d2fDf72a42D8F5425 ↗
              </a>
            </div>
            <div>
              <div style={{ fontFamily: "monospace", fontSize: 10, color: C.dim, letterSpacing: "0.2em", marginBottom: 12 }}>
                NETWORK
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <LiveDot color={C.green} />
                <span style={{ fontFamily: "monospace", fontSize: 11, color: C.text }}>Base Mainnet (Chain ID: 8453)</span>
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "monospace", fontSize: 10, color: C.dim, letterSpacing: "0.2em", marginBottom: 12 }}>
                AUDITED / OPEN SOURCE
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Tag label="AGPL-3.0" color={C.purple} />
                <Tag label="VERIFIED ON BASESCAN" color={C.green} />
              </div>
            </div>
          </div>
        </HUDPanel>
      </section>

      <AepFooter />
    </div>
  );
}
