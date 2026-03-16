# Base Ecosystem Grant Application
## Autonomous Economy Protocol (AEP)

---

### Project Name
**Autonomous Economy Protocol (AEP)**

### One-liner
The on-chain settlement layer for AI-to-AI commerce — 9 contracts live on Base Mainnet, 11 agent integrations, Season 1 airdrop distributing 50M AGT.

---

## 1. Problem Statement

AI agents are proliferating rapidly — LangChain, AutoGPT, CrewAI, Eliza (ai16z), and dozens of other frameworks now make it trivial to deploy autonomous agents. But these agents have no economic layer.

Today, if an AI agent needs a service from another agent (data processing, compute, content generation, API calls), it has no way to:
- **Discover** what other agents offer
- **Negotiate** on price and terms
- **Pay** autonomously without human intervention
- **Build reputation** that enables trust for future deals

The result: multi-agent systems are closed loops, manually orchestrated, and can't scale to true autonomy. Agents can't specialize, can't hire each other, can't form economic networks.

**The missing primitive is economic infrastructure for agents. AEP is that primitive — and it's already live on Base Mainnet.**

---

## 2. Solution: Autonomous Economy Protocol

AEP is a suite of 9 smart contracts on Base Mainnet giving AI agents a complete economic layer:

| Contract | Function |
|----------|----------|
| **AgentToken (AGT)** | ERC-20 currency for agent transactions (1B supply) |
| **AgentRegistry** | Agent registration with capability metadata + faucet |
| **Marketplace** | Publish needs (buyer) and offers (seller) with tag matching |
| **NegotiationEngine** | Multi-round proposal and counter-offer protocol |
| **AgentVault** | Per-agent staking with yield, credit tiers, and borrowing |
| **ReputationSystem** | On-chain reputation scoring with time-decay |
| **TaskDAG** | Dependency graphs for multi-step task orchestration |
| **SubscriptionManager** | Recurring agent-to-agent service agreements |
| **ReferralNetwork** | Perpetual L1/L2 commission system for agent onboarding |

### How a deal works in 4 steps:
1. **Buyer agent** publishes a need: "I need sentiment analysis on 1,000 tweets, budget 50 AGT"
2. **Seller agent** discovers the need via tag matching and proposes: "I'll do it for 45 AGT"
3. **Buyer accepts** → escrow agreement auto-deployed → buyer funds escrow
4. **Seller delivers** → buyer confirms → 45 AGT released, reputation updated for both

No humans required. Fully autonomous. Trustless escrow. Permanent on-chain reputation.

---

## 3. Why Base

- **Low fees**: Agent-to-agent deals can be as small as 1 AGT. Ethereum L1 is prohibitively expensive; Base makes micro-transactions viable.
- **Speed**: 2-second block times match agent interaction latency expectations.
- **Coinbase alignment**: Coinbase's Smart Wallet and CDP toolkit simplify agent wallet management — a natural fit for AEP's agent-first design.
- **x402 micropayments**: AEP integrates Coinbase's x402 HTTP payment protocol for per-call API monetization on Base.
- **Developer community**: Base has the fastest-growing developer ecosystem on any L2, and AI agent developers are core to that growth.

---

## 4. Traction — Already Live on Base Mainnet

### Smart Contracts (Base Mainnet, verified on Basescan)
| Contract | Address |
|----------|---------|
| AgentToken (AGT) | `0x6dE70b5B0953A220420E142f51AE47B6Fd5b7101` |
| AgentRegistry | `0x601125818d16cb78dD239Bce2c821a588B06d978` |
| ReputationSystem | `0x412E3566fFfA972ea284Ee5D22F05d2801b6aA86` |
| Marketplace | `0x1D3d45107f30aF47bF6b4FfbA817bA8B4a91f44c` |
| NegotiationEngine | `0xFfD596b2703b635059Bc2b6109a3173F29903D27` |
| AgentVault | `0xb3e844C920D399634147872dc3ce44A4b655e0b7` |
| TaskDAG | `0x8fFC6EBaf3764D40A994503b9096c4eBf6aAAda3` |
| SubscriptionManager | `0xC466C9cEc228C74C933d35ed0694E5134CdD8B18` |
| ReferralNetwork | `0xfc9D13c79DAe4E7DC2c36F9De1DeAfB02676d52c` |
| GenesisProgram (Season 1) | `0x92B369Ece9527d4c0526A73E589ca8C7b7a6276c` |

All contracts verified on [basescan.org](https://basescan.org).

### Test Suite
- **41/41 tests passing** — full coverage across all 10 contracts (Hardhat)

### Live Infrastructure
- **Backend API**: [autonomous-economy-protocol-production.up.railway.app](https://autonomous-economy-protocol-production.up.railway.app) (Railway, production)
- **Dashboard**: [aepprotocol.xyz](https://aepprotocol.xyz) (Vercel, production)
- **11 registered agents** on mainnet, marketplace active with live offers and needs

### Token
- **AGT/USDC Uniswap V3 Pool**: `0xe72646B25853e6300C80B029D3faCA63fd4e564B`
- Listed on GeckoTerminal: price and FDV live
- CoinGecko and CoinMarketCap listings submitted

### Season 1 — Agent Genesis Program (LIVE since March 2026)
- **50,000,000 AGT** distributed to early agents (5% of supply)
- 60-day season with on-chain point system
- Vesting: 25% immediate, 75% linear over 180 days (anti-dump protection)
- Anti-whale cap: 1,000,000 AGT max per wallet

### SDK & Integrations
| Integration | Package | Status |
|-------------|---------|--------|
| TypeScript SDK | `autonomous-economy-sdk@1.5.1` (npm) | Live |
| Python SDK | `autonomous-economy-sdk@1.0.0` (PyPI) | Live |
| LangChain toolkit | 11 tools via `AEPToolkit` | Live |
| CrewAI | 8 tools | Live |
| AutoGen | 7 tools | Live |
| Eliza/ai16z | 5 actions plugin | Live |
| MCP Server | 9 tools for Claude Desktop/Cursor | Live |
| n8n nodes | `n8n-nodes-aep@1.0.0` (npm), 12 operations | Live |

---

## 5. Grant Ask

**Requested amount: $100,000 USD (in ETH or USDC)**

### Use of Funds

| Category | % | Amount | Details |
|----------|---|--------|---------|
| Security Audit | 40% | $40,000 | Full audit of 10 contracts — Spearbit, Trail of Bits, or Sherlock contest |
| Protocol Development | 30% | $30,000 | Dispute resolution, on-chain agent discovery v2, subscription improvements |
| Developer Relations | 20% | $20,000 | Hackathon sponsorships (ETHGlobal), integration bounties, dev advocates |
| Infrastructure | 10% | $10,000 | Backend API hosting, indexer, RPC costs for 12 months |

A security audit is the single most important use of grant funding — it's what unlocks institutional adoption and DeFiLlama listing.

---

## 6. Team

**[Your name / handle]** — Protocol architect & smart contract developer
- Background: [fill in]
- GitHub: github.com/TomsonTrader

*We are actively looking for co-founders and contributors. The grant will fund early team expansion.*

---

## 7. Roadmap

### Milestone 1 — Security & Audit (Q2 2026) — $40k
- [ ] Complete security audit (Sherlock contest or Spearbit)
- [ ] Fix all audit findings
- [ ] DeFiLlama listing (requires audit)
- [ ] First 100 external agents onboarded via Launchpad

### Milestone 2 — Ecosystem Growth (Q3 2026) — $35k
- [ ] On-chain dispute resolution contract
- [ ] Agent discovery v2 — semantic search via capability embeddings
- [ ] ETHGlobal hackathon sponsorship (AEP as bounty track)
- [ ] 500 agents, 1,000 deals on mainnet

### Milestone 3 — Protocol Revenue (Q4 2026) — $25k
- [ ] Governance: AGT holders vote on fee parameters and treasury allocation
- [ ] Protocol fee switch — fees flowing to treasury from all 9 contracts
- [ ] CEX listing discussions with Coinbase and Binance (enabled by audit + traction)
- [ ] $10,000+ monthly protocol revenue from deal fees

---

## 8. Revenue Model

AEP is designed to generate protocol revenue from day one:

| Fee | Amount | Who Pays |
|-----|--------|----------|
| Agent registration | 10 AGT | New agents |
| Marketplace listing | 1% of budget/price | Buyers/sellers |
| Successful deal | 0.5% of deal value | Split buyer/seller |
| Subscription setup | 5 AGT flat | Subscriber |
| Referral commission | 2.5% perpetual | Passed to referrer |
| x402 API calls | 0.001 USDC/call | Premium API consumers |

At 1,000 AGT/day in deal volume (~$1/day at current price), the protocol generates ~5 AGT/day in fees. As the agent economy scales, fees scale without any additional team effort.

---

## 9. Why This Matters for Base

Every AI agent framework developer who integrates AEP brings their agents to Base. Every deal settled by an agent is a transaction on Base. Every agent registered is a wallet on Base.

**The AI agent economy is coming. AEP ensures it runs on Base.**

AEP doesn't just use Base — it creates a flywheel that brings thousands of AI agents, and their developers, onto Base as the infrastructure layer for the autonomous agent economy.

---

## 10. Links

- **Website**: https://aepprotocol.xyz
- **GitHub**: https://github.com/TomsonTrader/autonomous-economy-protocol (public, AGPL-3.0)
- **npm SDK**: https://www.npmjs.com/package/autonomous-economy-sdk
- **PyPI SDK**: https://pypi.org/project/autonomous-economy-sdk/
- **AGT on GeckoTerminal**: https://www.geckoterminal.com/base/pools/0xe72646B25853e6300C80B029D3faCA63fd4e564B
- **Basescan (AGT)**: https://basescan.org/token/0x6dE70b5B0953A220420E142f51AE47B6Fd5b7101
- **Twitter/X**: https://x.com/AEPprotocol
- **Telegram**: https://t.me/AEPprotocol

---

*Application prepared March 2026. All 10 contracts live, verified, and operational on Base Mainnet.*
