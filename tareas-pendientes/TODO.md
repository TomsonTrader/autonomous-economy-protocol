# AEP — Tareas y Estado del Proyecto
> Actualizado: 2026-03-17 | Ver plan completo: `/PLAN.md`
> ✅ hecho · 🔴 urgente · 🟡 importante · 🟢 opcional · ⏳ en espera de resultado

---

## BLOQUE 0 — BASE TÉCNICA (COMPLETO ✅)

Todo lo que está aquí ya funciona y está en producción.

- [x] 10 contratos Solidity en Base Mainnet (verificados en Basescan)
- [x] Backend Express en Railway — 13+ endpoints, webhooks, delivery, deal monitor
- [x] Dashboard Next.js en Vercel (aepprotocol.xyz)
- [x] TypeScript SDK v1.5.2 en npm (`autonomous-economy-sdk`)
- [x] Python SDK v1.0.1 en PyPI
- [x] MCP Server publicado (`@aep/mcp-server`) — 10 tools
- [x] n8n Node publicado (`n8n-nodes-aep@1.0.0`) — 12 operations
- [x] LangChain (11 tools), CrewAI (8), AutoGen (7), Eliza (5), Telegram (listo)
- [x] Orchestrator multi-agente
- [x] Pool Uniswap V3 AGT/USDC — `0xe72646B25853e6300C80B029D3faCA63fd4e564B`
- [x] GeckoTerminal: AGT indexado — precio $0.000001
- [x] Season 1 (GenesisProgram): 50M AGT pool activo — termina ~mayo 2026
- [x] Demo agent 24/7 en Railway
- [x] Tests: 55/55 unit + 51/52 E2E (mainnet, transacciones reales)
- [x] Faucet: 399M AGT disponibles, requisito mínimo ETH bajado a > 0
- [x] AgentVault staking verificado: Tier 0 (100 AGT) + Tier 1 (500 AGT) ✅

---

## BLOQUE 1 — VISIBILIDAD 🔴 (Esta semana — Mar 17-24)

### 1.1 Token visible en DexScreener
- [ ] 🔴 **Hacer 1 swap real en Uniswap** (~$5 de AGT) → DexScreener indexa automáticamente
  - URL: https://app.uniswap.org/explore/pools/base/0xe72646B25853e6300C80B029D3faCA63fd4e564B
- [ ] 🟡 Actualizar info en DexScreener: dexscreener.com/update-token-info
  - Logo 200x200px (desde agt-logo-1000.png via squoosh.app)
  - website=aepprotocol.xyz, Twitter=@AEPprotocol, GitHub

### 1.2 Twitter/X (@AEPprotocol)
- [ ] 🔴 Subir foto de perfil (agt-logo-400.png — squoosh.app → 400x400)
- [ ] 🔴 Banner de Twitter (crear con Grok/DALL-E si no tienes)
- [ ] 🔴 Bio: `The settlement layer for AI agents. Register · Trade · Build credit on-chain. 9 contracts live on Base Mainnet. $AGT 🔵`
- [ ] 🔴 Website: https://aepprotocol.xyz | Ubicación: `Base Mainnet`
- [ ] Publicar 3 tweets de lanzamiento (texto en docs/twitter-launch-thread.md)
- [ ] Seguir: @base @jessepollak @virtuals_io @ai16zdao @LangChainAI @BuildOnBase

### 1.3 Comunidades
- [ ] 🔴 **ai16z Discord** → canal #show-and-tell — texto en docs/outreach/ai16z-discord-post.md
- [ ] 🟡 **Farcaster** /base + /ai — texto en docs/outreach-templates.md sección 3
- [ ] 🔴 **Smithery MCP Registry** → smithery.ai/submit — YAML en mcp-server/smithery.yaml

---

## BLOQUE 2 — GRANTS Y PRIMER TRÁFICO 🔴 (Mar 24-31)

### 2.1 Base Grants — DEADLINE 31 MARZO
- [ ] 🔴 **Aplicar en grants.base.org** — el doc ya está en docs/base-grants-application.md
  - El doc está listo, solo hay que rellenarlo y enviarlo
  - Deadline: 31 de marzo de 2026

### 2.2 Primeros usuarios reales
- [ ] 🟡 Invitar 5 personas a registrar agente en aepprotocol.xyz/launch
  - El faucet da 15 AGT gratis (sin necesidad de ETH mínimo ahora)
  - También pueden usar el referral link para ganar comisiones
- [ ] 🟡 **Hugging Face Space** → subir huggingface-space/ a huggingface.co/new-space
- [ ] 🟡 **LangChain GitHub Discussion** — docs/outreach/langchain-pr.md
- [ ] 🟢 **CrewAI GitHub Discussion** — docs/outreach/crewai-github-discussion.md
- [ ] 🟢 **n8n Community post** — community.n8n.io → #share-your-work

---

## BLOQUE 3 — REVENUE Y ESCALA (Abr 1-14)

- [ ] 🟡 **Custom GPT en OpenAI Store** — docs/custom-gpt/ (system prompt + openapi spec)
- [ ] 🟡 **Gitcoin Grants S23** — docs/gitcoin-grants.md
- [ ] 🟡 **Agent Launchpad con pricing** — cobrar 5 USDC por agente managed (nuevo revenue)
- [ ] 🟢 **Dev.to article** — docs/devto-post.md (el artículo ya está escrito)
- [ ] 🟢 **Mirror.xyz crowdfund** — docs/gitcoin-grants.md sección Mirror

---

## BLOQUE 4 — CREDIBILIDAD LARGO PLAZO (Mes 2-3)

- [ ] 🟡 **Virtuals Protocol outreach** — proponer "AEP Economy Layer for Virtuals Agents"
- [ ] 🟡 **Bonding Curve AGT** (nuevo contrato) — requiere confirmación tuya para deploy
- [ ] 🟡 **DexTools** — dextools.io → Token Manager → actualizar info AGT
- [ ] 🟢 **Security Audit** (Spearbit/Code4rena) — deferred a 100+ agentes ($15-20k)
- [ ] 🟢 **CoinMarketCap** — ⏳ submitted, pendiente aprobación (2-30 días)
- [ ] ⏳ **CoinGecko** — submitted, pendiente aprobación (1-14 días)

---

## SEGUIMIENTO KPIs

| Semana | Agentes ext. | Deals reales | Treasury | Notas |
|--------|-------------:|-------------:|---------:|-------|
| Sem 0 (Mar 17) | 0 | 0 | 0 USDC | Estado inicial |
| Sem 1 (Mar 24) | | | | Objetivo: DexScreener + Twitter |
| Sem 2 (Mar 31) | | | | Objetivo: Base Grants submitted |
| Sem 4 (Abr 14) | | | | Objetivo: 25 agentes externos |
| Mes 2 (May) | | | | Objetivo: 100 agentes + CoinGecko |

---

## REFERENCIAS RÁPIDAS

| Recurso | URL / Path |
|---------|-----------|
| Dashboard | https://aepprotocol.xyz |
| Backend API | https://autonomous-economy-protocol-production.up.railway.app |
| GitHub | github.com/TomsonTrader/autonomous-economy-protocol |
| Pool Uniswap | app.uniswap.org/explore/pools/base/0xe72646... |
| Faucet | aepprotocol.xyz/launch (15 AGT gratis) |
| Deployer wallet | 0x1200BE707C668b0313757Fc7d097B1a498bA62Ba |
| Texts de outreach | docs/outreach-templates.md |
| Texts para listings | docs/exchange-listings.md |
| Logo 400x400 | squoosh.app → agt-logo-1000.png → resize 400px |
| Logo 200x200 | squoosh.app → agt-logo-1000.png → resize 200px |
| Base Grants app | docs/base-grants-application.md |
| Plan completo | /PLAN.md |
