# AEP — Plan de Ejecución 2026
> Última actualización: 2026-03-17

---

## SITUACIÓN ACTUAL

El protocolo está **100% construido y en producción**. No hay nada técnico que bloquee el crecimiento.
El único problema es la distribución: nadie sabe que existimos.

### Lo que tenemos
| Componente | Estado | Detalle |
|---|---|---|
| 10 contratos Solidity | ✅ Live en Base Mainnet | Verificados en Basescan |
| Backend API | ✅ Railway | 13+ endpoints, webhooks, delivery, deal monitor |
| Dashboard | ✅ Vercel (aepprotocol.xyz) | 12 páginas, wallet connect |
| TypeScript SDK | ✅ npm v1.5.2 | autonomous-economy-sdk |
| Python SDK | ✅ PyPI v1.0.1 | autonomous-economy-sdk |
| MCP Server | ✅ publicado | 10 tools para Claude/Cursor/Windsurf |
| n8n Node | ✅ npm v1.0.0 | 12 operaciones |
| 7 integraciones | ✅ LangChain, CrewAI, AutoGen, Eliza, Telegram | Listas para uso |
| Pool Uniswap V3 | ✅ AGT/USDC | `0xe72646B25853e6300C80B029D3faCA63fd4e564B` |
| Season 1 activa | ✅ 50M AGT pool | 60 días (termina ~mayo 2026) |
| Tests | ✅ 55/55 unit + 51/52 E2E | Mainnet con transacciones reales |

### El problema real
```
34 agentes registrados → todos nuestros (simulación/demo)
0 deals reales → 0 revenue para el protocolo
0 agentes externos → nadie del exterior sabe que existimos
AGT precio: $0.000001 → FDV = $1,000 (funciona, pero sin historia)
```

---

## PLAN SEMANAL — 6 SEMANAS

---

### SEMANA 1 — Mar 17-24: HACER VISIBLE EL PROTOCOLO

> Objetivo: que DexScreener indexe AGT y que 3 comunidades clave sepan que existimos.

| # | Tarea | Impacto | Cómo |
|---|-------|---------|------|
| 1 | **Swap real en Uniswap** (~$5 de AGT) | DexScreener indexa automáticamente → visibilidad trading | app.uniswap.org → pool 0xe726... |
| 2 | **Completar perfil Twitter @AEPprotocol** | Credibilidad básica con cualquier persona que nos descubra | Foto 400x400 + banner + bio (texto en docs/exchange-listings.md) |
| 3 | **Publicar 3 tweets de lanzamiento** | Primeros seguidores | Texto en docs/twitter-launch-thread.md |
| 4 | **Post en ai16z Discord** | Comunidad de 50k builders de AI agents | discord.gg/ai16z → #show-and-tell — texto en docs/outreach/ai16z-discord-post.md |
| 5 | **Post Farcaster /base + /ai** | Audiencia nativa de Base | Texto en docs/outreach-templates.md sección 3 |
| 6 | **Smithery MCP listing** | Claude/Cursor users descubren el MCP | smithery.ai/submit — YAML en mcp-server/smithery.yaml |

**KPI objetivo semana 1:** DexScreener live, 50+ followers Twitter, 3 replies en Discord

---

### SEMANA 2 — Mar 24-31: GRANTS + COMUNIDADES TECH ⚠️ DEADLINE

> Objetivo: aplicar a Base Grants ANTES del 31 de marzo. Empezar a atraer developers técnicos.

| # | Tarea | Impacto | Urgencia |
|---|-------|---------|----------|
| 1 | **Base Grants — aplicar** | $100k funding | 🔴 ANTES DEL 31 DE MARZO |
| 2 | **Hugging Face Space** | Demo visual para ML builders | Subir 3 archivos de huggingface-space/ |
| 3 | **LangChain GitHub Discussion** | Comunidad de Python/AI builders | github.com/langchain-ai/langchain/discussions — texto en docs/outreach/langchain-pr.md |
| 4 | **CrewAI GitHub Discussion** | Builders de multi-agent systems | github.com/joaomdmoura/crewAI/discussions |
| 5 | **n8n Community post** | Automation builders (no-code) | community.n8n.io → #share-your-work |
| 6 | **Invitar 5 personas** a registrar su primer agente | Primeros usuarios reales | aepprotocol.xyz/launch (el faucet da 15 AGT gratis) |

**KPI objetivo semana 2:** Base Grants submitted, 5 agentes externos registrados, 2 GitHub discussions activas

---

### SEMANA 3-4 — Abr 1-14: PRIMER REVENUE + ESCALA

> Objetivo: primeras transacciones reales de otros, 25+ agentes externos.

| # | Tarea | Impacto | Detalle |
|---|-------|---------|---------|
| 1 | **Custom GPT en OpenAI Store** | Descubrimiento por usuarios de ChatGPT | chat.openai.com/gpts/editor — system prompt en docs/custom-gpt/ |
| 2 | **Gitcoin Grants S23** | Funding comunitario + visibilidad | Docs en docs/gitcoin-grants.md |
| 3 | **Agent Launchpad con pricing** | Primera revenue: 5 USDC/agente | Mejora de /launch — cobrar 5 USDC para agentes managed |
| 4 | **Dev.to / Hashnode article** | SEO + builder awareness | Texto en docs/devto-post.md |
| 5 | **Telegram community bot** | Canal con stats en tiempo real | Bot en integrations/telegram-bot/ |
| 6 | **Mirror.xyz crowdfund** | Funding + NFTs Genesis | Manifesto en docs/gitcoin-grants.md → sección Mirror |

**KPI objetivo semana 3-4:** 25 agentes externos, 10 deals reales, primer $10 en treasury

---

### MES 2 — Abr-May: ACELERACIÓN

| Tarea | Objetivo | Impacto |
|-------|----------|---------|
| **100 agentes** | Umbral de credibilidad | Pitch a inversores, DeFiLlama listing |
| **Virtuals Protocol outreach** | "AEP Economy Layer for Virtuals" | Acceso a su comunidad de $915M mcap |
| **CoinGecko / CMC aprobados** | Presencia en aggregators | Descubrimiento masivo |
| **Bonding Curve AGT** (si aprobado) | Revenue exponencial al estilo Virtuals | Requiere tu confirmación para deploy en mainnet |
| **DAO governance (AGT snapshot)** | AGT holders votan parámetros | Token con utilidad de gobernanza real |

**KPI objetivo mes 2:** 100+ agentes, 50+ deals, $100 treasury, AGT listado en CoinGecko

---

### MES 3 — Jun: CREDIBILIDAD ENTERPRISE

| Tarea | Objetivo | Presupuesto / Detalle |
|-------|----------|-----------------------|
| **Security Audit** (Code4rena/Spearbit) | Sin audit: fondos no invierten | $10-20k — financiar con grants |
| **DeFiLlama listing** | TVL visible para DeFi investors | Requiere audit + TVL real |
| **The Graph subgraph** | Indexación de eventos on-chain | Elimina dependencia de RPC para ID lookups — `NeedPublished`, `OfferPublished`, `ProposalCreated`, `AgreementDeployed` |
| **Dispute resolution** (Kleros / multisig arbiter) | Desbloquear escrows bloqueados | Window de 7 días → cualquier parte puede escalar; árbitros = agentes con alta reputación |
| **Series A deck** | Pitch a Coinbase Ventures, Multicoin | Con 1000 agentes + audit |

---

### MES 4-6: PROTOCOLO DE SIGUIENTE NIVEL

> Estas mejoras convierten AEP de "marketplace funcional" a "infraestructura estándar para agentes IA".

| Mejora | Qué resuelve | Impacto |
|--------|-------------|---------|
| **ERC-4337 Paymaster** | Agentes deben tener ETH para gas — barrier de entrada | Treasury patrocina gas para agentes registrados → protocolo verdaderamente ETH-free para usuarios |
| **LayerZero OFT (AGT multichain)** | AGT solo existe en Base → agentes en Ethereum/Arbitrum/Polygon no pueden participar | AGT nativo en 4+ chains, supply unificado — multiplica el mercado x5 |
| **Chainlink Functions (delivery verificado)** | `confirmDelivery()` confía en el buyer — riesgo de moral hazard | Seller commit hash al crear propuesta; Chainlink verifica off-chain que el entregable coincide antes de liberar escrow |
| **W3C DID para agentes** | Identidad = solo dirección Ethereum — no portable a otros sistemas | DID documents anclados al registro on-chain → agentes reconocibles por otros protocolos con estándar industry |
| **ERC-7521 Intent Matching** | Buyer debe conocer offerId exacto — no escala para agentes autónomos | Agentes publican intents estructurados; Solver network los matchea automáticamente por tags + precio + reputación |
| **DAO governance (AGT snapshot → on-chain)** | Parámetros del protocolo controlados por deployer | AGT holders votan fees, duración seasons, whitelist de capabilities |

---

## DECISIONES PENDIENTES TUYAS

| # | Decisión | Impacto | Por qué ahora |
|---|----------|---------|---------------|
| 1 | **¿Hago el swap de $5 en Uniswap?** | DexScreener indexa → más visibilidad | Sin swap, DexScreener no aparece |
| 2 | **¿Aplico a Base Grants?** (doc listo) | $100k — deadline 31 marzo | El doc ya está en docs/base-grants-application.md |
| 3 | **¿Cuándo completo el perfil Twitter?** | Credibilidad básica | Cualquier link que demos va a Twitter primero |
| 4 | **¿Apruebo bonding curve en mainnet?** | Revenue exponencial si funciona | Contrato listo, requiere tu firma para deploy |

---

## MÉTRICAS DE SEGUIMIENTO

| Métrica | Hoy (Mar 17) | Sem 2 | Sem 4 | Mes 2 |
|---------|-------------|-------|-------|-------|
| Agentes totales | 34 (demo) | 40 | 60 | 150 |
| Agentes externos | 0 | 5 | 25 | 100 |
| Deals reales | 0 | 0 | 10 | 50 |
| AGT price | $0.000001 | — | — | — |
| Treasury USDC | $0 | — | $10 | $100 |
| Twitter followers | 0 | 50 | 200 | 500 |
| GitHub stars | — | — | 50 | 200 |

---

## ESTRUCTURA DEL PROYECTO (referencia rápida)

```
contracts/          → 10 contratos Solidity (NO modificar sin razón)
backend/src/        → API Express (Railway)
  routes/           → 11 rutas API
  services/         → blockchain, indexer, dealMonitor, webhooks, websocket
dashboard/web/      → Next.js frontend (Vercel — aepprotocol.xyz)
sdk/src/            → TypeScript SDK (npm)
sdk-python/         → Python SDK (PyPI)
mcp-server/         → MCP Server para Claude/Cursor
orchestrator/       → Multi-agent orchestration
agents/demo/        → Demo agent 24/7 (Railway)
simulation/         → 5 agentes simulados (local)
integrations/       → LangChain, CrewAI, AutoGen, Eliza, n8n, Telegram
scripts/            → Deploy, E2E tests, management
deployments/        → Direcciones de contratos (mainnet + testnet)
docs/               → Documentación, grants, outreach
tareas-pendientes/  → Checklist funcionalidad + tasks pendientes
pruebas-reales/     → Informes y resultados de tests E2E en mainnet
```

---

## ESTADO DE PRODUCCIÓN HOY

```
Backend   → https://autonomous-economy-protocol-production.up.railway.app
Dashboard → https://aepprotocol.xyz
GitHub    → github.com/TomsonTrader/autonomous-economy-protocol
npm SDK   → autonomous-economy-sdk@1.5.2
PyPI SDK  → autonomous-economy-sdk@1.0.1
MCP       → @aep/mcp-server
n8n node  → n8n-nodes-aep@1.0.0
Pool AGT  → 0xe72646B25853e6300C80B029D3faCA63fd4e564B (Uniswap V3, Base)
```

---

*Plan actualizado por Claude Code — 2026-03-17*
