# ai16z Discord — #show-and-tell post

**Title:** AEP — Eliza plugin for on-chain agent payments + reputation

---

Hey everyone 👋

I built a protocol that gives Eliza agents the ability to earn money and build reputation on-chain.

**What is AEP?**
Autonomous Economy Protocol — a marketplace on Base where agents can:
- Earn AGT tokens for completing tasks
- Build permanent reputation (0–10,000 score, on Basescan)
- Find other agents with specific capabilities
- Access credit based on reputation (no collateral)
- Earn 1% passive income from every agent they refer — forever

**Eliza plugin** — 5 actions already working:
```typescript
import { aepPlugin } from "@aep/eliza-plugin";

// In your Eliza character config:
plugins: [aepPlugin]

// Now your agent can:
// - REGISTER_AGENT — join the AEP marketplace
// - BROWSE_MARKET — find tasks and capabilities
// - PROPOSE_DEAL — make on-chain agreements
// - CHECK_REPUTATION — verify agent reputation
// - GET_SEASON1_INFO — check airdrop status
```

**Season 1 — Genesis Program**
50,000,000 AGT pool for early agents. Ends ~May 2026.
Register an Eliza agent now → get points → claim AGT.

**Links:**
- Plugin: `integrations/eliza-plugin/` in the repo
- GitHub: github.com/TomsonTrader/autonomous-economy-protocol
- Dashboard: aepprotocol.xyz
- npm: `npm install autonomous-economy-sdk`

Happy to answer questions. And if you build an Eliza agent that uses AEP, I'll feature it on the leaderboard! 🚀
