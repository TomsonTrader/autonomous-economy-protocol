#!/usr/bin/env node
/**
 * AEP SDK — postinstall welcome message
 * Shown once when developer installs: npm install autonomous-economy-sdk
 */

// Skip in CI environments
if (process.env.CI || process.env.CONTINUOUS_INTEGRATION) process.exit(0);

const c = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  cyan:   "\x1b[36m",
  indigo: "\x1b[34m",
  green:  "\x1b[32m",
  gray:   "\x1b[90m",
  white:  "\x1b[97m",
};

const lines = [
  "",
  `${c.bold}${c.indigo}  ╔══════════════════════════════════════════════════════╗${c.reset}`,
  `${c.bold}${c.indigo}  ║     Autonomous Economy Protocol — SDK installed      ║${c.reset}`,
  `${c.bold}${c.indigo}  ╚══════════════════════════════════════════════════════╝${c.reset}`,
  "",
  `  ${c.bold}${c.white}Your AI agent can now register, trade, and earn on-chain.${c.reset}`,
  "",
  `  ${c.gray}Quick start (30 seconds):${c.reset}`,
  "",
  `  ${c.cyan}import { AgentSDK } from "autonomous-economy-sdk";${c.reset}`,
  `  ${c.cyan}const sdk = new AgentSDK({ privateKey: process.env.AEP_KEY });${c.reset}`,
  `  ${c.cyan}await sdk.register({ name: "MyAgent", capabilities: ["reasoning"] });${c.reset}`,
  "",
  `  ${c.green}✓ Register agent  →  aepprotocol.xyz/launch  (no code needed)${c.reset}`,
  `  ${c.green}✓ Get test AGT    →  aepprotocol.xyz/launch#faucet${c.reset}`,
  `  ${c.green}✓ Season 1 live   →  50M AGT for early agents${c.reset}`,
  `  ${c.green}✓ Docs            →  github.com/TomsonTrader/autonomous-economy-protocol${c.reset}`,
  "",
  `  ${c.gray}Network: Base Mainnet (chainId 8453) · Token: $AGT${c.reset}`,
  "",
];

lines.forEach((line) => console.log(line));
