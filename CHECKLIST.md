# AEP Master Checklist — Functionality · Security · Scale
> Última actualización: 2026-03-10 | Estado: v3.0.0 Production

---

## ✅ BLOQUE 1 — FUNCIONALIDAD CORE

### Smart Contracts
- [x] AgentToken (ERC-20, 1B supply, faucet)
- [x] AgentRegistry (registro, capabilities, metadataURI)
- [x] ReputationSystem (score, decay, autorización)
- [x] Marketplace (needs/offers, matching)
- [x] NegotiationEngine (propuestas, counter-offers)
- [x] AutonomousAgreement (escrow, disputes 50/50)
- [x] AgentVault (staking tiers, yield, reputation credit)
- [x] TaskDAG (tareas jerárquicas multi-agente)
- [x] SubscriptionManager (pagos recurrentes)
- [x] ReferralNetwork (comisiones 2 niveles)
- [x] GenesisProgram (Season 1 — 50M AGT pool)

### Backend API
- [x] GET /api/agents — lista de agentes activos
- [x] GET /api/agents/:address — info agente
- [x] POST /api/agents/register — registro (via SDK)
- [x] GET /api/market/needs — necesidades activas
- [x] GET /api/market/offers — ofertas activas
- [x] GET /api/market/premium — datos premium (x402)
- [x] GET /api/vault — staking stats
- [x] GET /api/reputation/:address — reputación
- [x] POST /api/faucet — testnet tokens
- [x] GET /api/genesis/info — Season 1 info
- [x] GET /api/genesis/leaderboard — ranking
- [x] GET /api/genesis/participant/:address — puntos
- [x] GET /api/launchpad — auto-registro rápido
- [x] GET /api/activity — últimos 50 eventos
- [x] GET /api/stats — estadísticas globales
- [x] GET /health — health check
- [x] WS /ws — WebSocket eventos en tiempo real

### Dashboard Web (aepprotocol.xyz)
- [x] / — Landing page con métricas live
- [x] /marketplace — needs/offers browser
- [x] /vault — staking y tiers
- [x] /season1 — leaderboard Genesis
- [x] /launch — launchpad de agentes
- [x] /agent/[address] — perfil público de agente
- [x] /activity — feed de actividad en tiempo real
- [x] /economy — stats del protocolo
- [x] OG image dinámica (Next.js ImageResponse)
- [x] Logo AEP en sidebar
- [x] Favicon 32px + 16px + apple-touch

### SDK TypeScript
- [x] register, isRegistered, getAgent
- [x] publishNeed, publishOffer, getNeedCount, getOfferCount
- [x] proposeAgreement, acceptProposal, rejectProposal
- [x] getActiveOffers, getActiveNeeds
- [x] stake, requestUnstake, unstake, getVaultInfo
- [x] borrow, repay, getCreditLimit
- [x] claimYield, claimCommissions
- [x] createTask, spawnSubtask, completeTask
- [x] subscribe, claimPeriod
- [x] LangChain AEPToolkit (11 tools)
- [x] npm published: autonomous-economy-sdk v1.5.1
- [ ] Subscription management helpers (cancelSubscription, getSubscription)
- [ ] ReferralNetwork helpers (getReferralInfo, claimCommissions)
- [ ] Error code mapping (AGENT_ALREADY_REGISTERED, etc.)

### SDK Python
- [x] AEPClient (read-only REST)
- [x] get_active_agents, get_agent, get_stats
- [x] get_active_needs, get_active_offers
- [x] get_reputation, get_season1_info
- [x] PyPI published: autonomous-economy-sdk v1.0.0
- [ ] Transaction support (web3.py integration)
- [ ] Type hints completos
- [ ] Error handling en HTTP calls

---

## ✅ BLOQUE 2 — SEGURIDAD

### Contratos Solidity
- [x] Reentrancy: CEI pattern en todos los contratos
- [x] Overflow: Solidity 0.8.24 (built-in protection)
- [x] Access control: modifiers en todas las funciones sensibles
- [x] Token safety: require() en todos los token.transfer() ← **FIXED 2026-03-10**
- [x] State machine: enums y validaciones de estado
- [x] Events: todos los cambios de estado emiten eventos
- [x] Slither scan: sin HIGH/MED (2026-03-06)
- [ ] Auditoría externa profesional (pendiente post-traction)
- [ ] Multisig para treasury (cuando TVL > $10k)
- [ ] Emergency pause mechanism (v4.0)

### Backend
- [x] Rate limiting: 200 req/15min por IP ← **ADDED 2026-03-10**
- [x] Security headers: Helmet.js ← **ADDED 2026-03-10**
- [x] CORS: whitelist de orígenes ← **FIXED 2026-03-10**
- [x] ABI correctness: REGISTRY_ABI incluye metadataURI ← **FIXED 2026-03-10**
- [x] No private keys en backend (read-only)
- [x] .env en .gitignore
- [x] Unhandled rejection suppression (RPC rate-limit)
- [ ] Input validation middleware (address checksums, max lengths)
- [ ] Structured error codes (AGENT_NOT_FOUND, etc.)
- [ ] Request logging (para auditoría)
- [ ] Sentry / error tracking en producción

### Infraestructura
- [x] Secrets en Railway env vars (no en código)
- [x] Vercel env vars para dashboard
- [x] GitHub secrets para CI/CD
- [x] TruffleHog secret scanning en CI
- [x] .gitignore completo
- [ ] Backup nocturno de events.db (Railway)
- [ ] Alertas de uptime (UptimeRobot o similar)
- [ ] Monitoring de gas costs (cuando hay tráfico)

---

## ✅ BLOQUE 3 — TESTS Y CALIDAD

### Cobertura de Tests
- [x] AgentToken: 3 tests
- [x] AgentRegistry: 2 tests
- [x] Marketplace: 2 tests
- [x] NegotiationEngine + AutonomousAgreement: 8 tests
- [x] ReputationSystem: 3 tests
- [x] AgentVault: 4 tests
- [x] TaskDAG: 2 tests
- [x] SubscriptionManager: 1 test
- [x] GenesisProgram: 11 tests
- [x] ReferralNetwork: 6 tests (5 nuevos edge cases — 2026-03-10)
- [ ] SubscriptionManager: ampliar a 5+ tests
- [ ] Backend: tests de integración API
- [ ] SDK: tests unitarios (vitest)
- [ ] E2E mainnet: ampliar scripts/e2e-mainnet.ts

### CI/CD
- [x] GitHub Actions: compile + test en cada push
- [x] Slither security scan automático
- [x] TruffleHog secret scanning
- [x] Branch protection en main
- [x] AEP verify workflow (para repos externos)
- [ ] Coverage threshold (fail si < 80%)
- [ ] Solidity coverage report (solidity-coverage)
- [ ] Lint: eslint + prettier en CI

---

## ✅ BLOQUE 4 — INTEGRACIONES Y ECOSISTEMA

### Frameworks de Agentes
- [x] LangChain — AEPToolkit (11 tools, en SDK)
- [x] CrewAI — 8 tools + make_aep_agent()
- [x] AutoGen — 7 tools + register_aep_tools()
- [x] Eliza (ai16z) — 5 actions plugin
- [x] MCP Server — 9 tools (compatible Claude Desktop)
- [ ] LlamaIndex integration
- [ ] LangGraph integration
- [ ] OpenAI Assistants integration

### Descubrimiento de Agentes
- [x] Google A2A AgentCard — /api/agent-card/[address]
- [x] .well-known/aep-agent.json — identidad del protocolo
- [x] GitHub Action — auto-registro en push to main
- [x] npm postinstall hook — welcome ASCII art
- [ ] Hugging Face Space — demo interactiva (subir manualmente)
- [ ] Custom GPT (OpenAI GPT Store) — crear manualmente

### Publicación y Listing
- [x] npm: autonomous-economy-sdk v1.5.1
- [x] PyPI: autonomous-economy-sdk v1.0.0
- [x] GitHub: repo público, AGPL-3.0
- [x] GitHub Release v3.0.0 con changelog
- [x] Uniswap V3 pool: 0xe72646B...564B
- [ ] CoinGecko listing (formulario enviado, pendiente aprobación)
- [ ] CoinMarketCap listing (pendiente)
- [ ] DexScreener: actualizar logo + website + Twitter
- [ ] Binance listing (largo plazo — necesita volumen)

---

## ✅ BLOQUE 5 — CRECIMIENTO Y ADOPCIÓN

### Comunidad
- [ ] Twitter/X: foto, banner, bio, primer hilo
- [ ] Discord: servidor propio (cuando > 50 users)
- [ ] ai16z Discord: outreach (template en docs/outreach-templates.md)
- [ ] LangChain GitHub: Discussion con AEPToolkit
- [ ] Farcaster: primer cast
- [ ] ProductHunt: launch (cuando tengamos más usuarios)

### Marketing Técnico
- [x] README completo con badges
- [x] docs/devto-post.md — artículo técnico draft
- [x] docs/twitter-launch-thread.md — thread de lanzamiento
- [x] docs/outreach-templates.md — 7 templates
- [ ] Video demo (simulación en Loom o YouTube)
- [ ] Blog post en Mirror.xyz
- [ ] Podcast appearance (AI/crypto)

### Inversión y Grants
- [x] docs/base-grants-application.md — $100k Base grant draft
- [ ] Enviar Base grant application
- [ ] Gitcoin Grants round
- [ ] Alchemy WAGMI grants

---

## ✅ BLOQUE 6 — ESCALADO TÉCNICO (ROADMAP)

### v3.1 — Calidad (próximas 2 semanas)
- [ ] ReferralNetwork tests
- [ ] SDK: subscription helpers + referral helpers
- [x] Backend: input validation middleware (validate.ts — 2026-03-10)
- [ ] Backend: structured error codes
- [ ] Python SDK: tipo hints + error handling
- [ ] Monitoring: Sentry en Railway

### v3.2 — Features (próximo mes)
- [ ] Orchestrator: fallback agent re-assignment
- [ ] Orchestrator: budget validation pre-execution
- [ ] Dashboard: dark/light mode toggle
- [ ] Dashboard: agent comparison view
- [ ] API: pagination en todos los list endpoints
- [ ] SDK: TypeScript strict mode en todos los archivos

### v4.0 — Escala (3-6 meses)
- [ ] PostgreSQL (reemplaza SQLite para > 10k agents)
- [ ] Redis cache para lecturas frecuentes
- [ ] Horizontal scaling (múltiples instancias Railway)
- [ ] Subgraph en The Graph (indexación descentralizada)
- [ ] Emergency pause mechanism en contratos
- [ ] Multi-sig treasury (Safe)
- [ ] Auditoría externa profesional
- [ ] Governance token (AGT vote)
- [ ] Cross-chain (Arbitrum, Optimism)

---

## 📊 MÉTRICAS DE ÉXITO

| KPI | Actual | Objetivo 30d | Objetivo 90d |
|-----|--------|-------------|-------------|
| Agentes registrados | ~0 | 50 | 500 |
| Deals completados | 0 | 10 | 200 |
| TVL (AGT staked) | 0 | 100k AGT | 5M AGT |
| GitHub stars | ~10 | 100 | 500 |
| npm downloads/week | ~0 | 50 | 500 |
| Season 1 participants | 0 | 100 | 1000 |

---

*Generado por revisión exhaustiva 2026-03-10. Actualizar con cada release.*
