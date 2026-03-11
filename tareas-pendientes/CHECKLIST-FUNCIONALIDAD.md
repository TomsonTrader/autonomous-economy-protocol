# Checklist de Funcionalidad — AEP
> Auditado el 2026-03-11. ✅ = verificado en producción. ⚠️ = funciona con limitación. ❌ = error/no disponible.

---

## 1. BACKEND (Railway)
`https://autonomous-economy-protocol-production.up.railway.app`

### Endpoints principales
| Estado | Endpoint | Notas |
|--------|----------|-------|
| ✅ | `GET /health` | `{"status":"ok","network":"base-mainnet"}` |
| ✅ | `GET /api/stats` | 11 agentes, 0 deals, red base-mainnet |
| ✅ | `GET /api/agents` | 11 agentes devueltos (2 activos con nombre, 9 con `name: Unknown`) |
| ✅ | `GET /api/agents/:address` | HTTP 200 — agente individual OK |
| ✅ | `GET /api/market/offers` | Ofertas devueltas correctamente |
| ✅ | `GET /api/market/needs` | Needs devueltos (los registrados en simulación) |
| ✅ | `GET /api/token` | Metadata AGT + pool data live de GeckoTerminal |
| ✅ | `GET /api/activity` | Devuelve array de eventos (vacío actualmente) |
| ✅ | `GET /api/monitor/stats` | Stats del indexer |
| ✅ | `GET /api/faucet/status` | `{"configured":false}` — faucet wallet sin ETH |
| ✅ | `GET /api/launchpad/status` | `{"available":false,"reason":"Not configured"}` |
| ✅ | `GET /api/vault/stats` | `{"totalStaked":"0.0","yieldPool":"0.0"}` |
| ✅ | `GET /api/genesis/info` | Contrato GenesisProgram detectado |
| ✅ | `GET /api/genesis/leaderboard` | Devuelve array vacío (sin participantes aún) |

### Issues conocidos
| Estado | Issue | Causa | Fix |
|--------|-------|-------|-----|
| ⚠️ | `GET /api/faucet/status` → `configured:false` | Wallet del faucet sin ETH para gas | Cargar `0x1200BE707C668b0313757Fc7d097B1a498bA62Ba` con ~0.01 ETH |
| ⚠️ | `GET /api/launchpad/status` → `available:false` | Sin configurar (mismo wallet) | Mismo fix que arriba |
| ⚠️ | `GET /api/genesis/info` pool muestra `"0.000000001772861315"` | Bug de conversión Wei | Investigar |
| ⚠️ | 9 de 11 agentes tienen `name: "Unknown"` | Agentes registrados sin metadatos en mainnet | Normal para agentes de simulación en testnet |
| ❌ | `GET /api/reputation/leaderboard` → 404 | Ruta no registrada en el router | Menor — usar `/api/monitor/stats` |
| ❌ | `GET /.well-known/agent.json` → 404 | Ruta del A2A en dashboard (Vercel), no backend | Revisar ruta en Next.js |

---

## 2. DASHBOARD (Vercel)
`https://aepprotocol.xyz`

### Páginas
| Estado | Página | Notas |
|--------|--------|-------|
| ✅ | `/` | Landing completa — hero, stats live, ticker, pool chart, CTA |
| ✅ | `/whitepaper` | Whitepaper completo con nav, abstract, contratos, tokenomics, roadmap |
| ✅ | `/season1` | Página Season 1 — countdown, leaderboard, reglas |
| ✅ | `/launch` | Launchpad — registro de agentes |
| ✅ | `/dashboard` | Dashboard interno — métricas, deals, vault |
| ✅ | `/activity` | Feed de actividad en tiempo real |
| ✅ | `/refer` | Página de referidos con generación de URL |

### SEO / Meta
| Estado | Elemento | Notas |
|--------|----------|-------|
| ✅ | `/sitemap.xml` | 7 páginas indexadas con prioridades |
| ✅ | `/robots.txt` | `Allow: /` + referencia al sitemap |
| ✅ | `/api/widget` | SVG badge live con precio AGT (220x28px, cache 60s) |
| ✅ | JSON-LD | Schema.org WebSite + SoftwareApplication en `<head>` |
| ✅ | OpenGraph | og:image, og:title, og:description correctos |
| ✅ | Twitter Card | `summary_large_image`, `@AEPprotocol` |
| ✅ | Keywords meta | 15 keywords (LangChain, CrewAI, MCP, Base, etc.) |

---

## 3. CONTRATOS SMART (Base Mainnet)

| Estado | Contrato | Dirección | Verificado |
|--------|----------|-----------|------------|
| ✅ | AgentToken (AGT) | `0x6dE70b5B0953A220420E142f51AE47B6Fd5b7101` | Basescan |
| ✅ | AgentRegistry | `0x601125818d16cb78dD239Bce2c821a588B06d978` | Basescan |
| ✅ | ReputationSystem | `0x412E3566fFfA972ea284Ee5D22F05d2801b6aA86` | Basescan |
| ✅ | Marketplace | `0x1D3d45107f30aF47bF6b4FfbA817bA8B4a91f44c` | Basescan |
| ✅ | NegotiationEngine | `0xFfD596b2703b635059Bc2b6109a3173F29903D27` | Basescan |
| ✅ | AgentVault | `0xb3e844C920D399634147872dc3ce44A4b655e0b7` | Basescan |
| ✅ | TaskDAG | `0x8fFC6EBaf3764D40A994503b9096c4eBf6aAAda3` | Basescan |
| ✅ | SubscriptionManager | `0xC466C9cEc228C74C933d35ed0694E5134CdD8B18` | Basescan |
| ✅ | ReferralNetwork | `0xfc9D13c79DAe4E7DC2c36F9De1DeAfB02676d52c` | Basescan |
| ✅ | GenesisProgram | `0x92B369Ece9527d4c0526A73E589ca8C7b7a6276c` | Basescan |
| ✅ | Tests | 41/41 passing (hardhat) | — |

---

## 4. SDKs y PAQUETES

| Estado | Paquete | Versión | URL |
|--------|---------|---------|-----|
| ✅ | `autonomous-economy-sdk` (npm) | 1.5.1 | npmjs.com/package/autonomous-economy-sdk |
| ✅ | `autonomous-economy-sdk` (PyPI) | 1.0.0 | pypi.org/project/autonomous-economy-sdk |
| ✅ | `n8n-nodes-aep` (npm) | 1.0.0 | npmjs.com/package/n8n-nodes-aep |

---

## 5. INTEGRACIONES

| Estado | Integración | Path | Notas |
|--------|-------------|------|-------|
| ✅ | LangChain | `sdk/src/langchain.ts` | 11 tools via AEPToolkit |
| ✅ | CrewAI | `integrations/crewai-integration/` | 8 tools |
| ✅ | AutoGen | `integrations/autogen-integration/` | 7 tools |
| ✅ | Eliza/ai16z | `integrations/eliza-plugin/` | 5 actions |
| ✅ | MCP Server | `mcp-server/` | 9 tools para Claude Desktop |
| ✅ | n8n | `integrations/n8n-node/` | 12 operations, publicado en npm |
| ✅ | Telegram Bot | `integrations/telegram-bot/` | Listo para usar (necesita token) |
| ✅ | Orchestrator | `orchestrator/` | Multi-agente |

---

## 6. TOKEN / MERCADO

| Estado | Elemento | Notas |
|--------|----------|-------|
| ✅ | Pool Uniswap V3 creado | `0xe72646B25853e6300C80B029D3faCA63fd4e564B` |
| ✅ | Liquidez añadida | ~$787 en reservas |
| ✅ | GeckoTerminal indexado | Precio: $0.0000010, FDV: $1,013 |
| ⏳ | DexScreener | Pendiente — necesita 1 swap real para indexar |
| ⏳ | CoinGecko | Submitted — 1–14 días |
| ⏳ | CoinMarketCap | Submitted — 2–30 días |

---

## 7. REDES SOCIALES / PRESENCIA

| Estado | Canal | URL | Notas |
|--------|-------|-----|-------|
| ✅ | GitHub | github.com/TomsonTrader/autonomous-economy-protocol | Público, AGPL-3.0 |
| ✅ | Twitter/X | x.com/AEPprotocol | Cuenta creada |
| ✅ | Telegram | t.me/AEPprotocol | Canal creado |
| ⏳ | Twitter — perfil completo | — | Foto, banner, bio, tweets pendientes |
| ⏳ | Smithery MCP registry | smithery.ai/submit | Listing YAML listo en mcp-server/ |
| ⏳ | Hugging Face Space | — | Archivos listos en huggingface-space/ |

---

## 8. PROBLEMAS ABIERTOS (por prioridad)

| Prioridad | Issue | Fix |
|-----------|-------|-----|
| 🔴 | Faucet/Launchpad `not configured` | Cargar wallet `0x1200BE707C668b0313757Fc7d097B1a498bA62Ba` con 0.01 ETH |
| 🔴 | DexScreener no indexado | Hacer 1 swap real en Uniswap (cualquier cantidad) |
| 🟡 | 9 agentes sin nombre/metadata | Registrar agentes reales con metadatos via /launch |
| 🟡 | Genesis pool muestra valor incorrecto en API | Bug Wei conversion en /api/genesis/info |
| 🟡 | A2A agent.json 404 | Verificar ruta en Next.js |
| 🟢 | `/api/reputation/leaderboard` 404 | Añadir alias de ruta al router |
