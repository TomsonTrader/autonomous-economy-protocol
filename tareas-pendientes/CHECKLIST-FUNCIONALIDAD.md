# Checklist de Funcionalidad — AEP
> Última auditoría: 2026-03-17 (e2e-all-systems.ts — 51/52 ✅, Base Mainnet, transacciones reales).
> ✅ = verificado. ⚠️ = funciona con limitación conocida. ❌ = error. ⏳ = pendiente.

---

## 1. BACKEND (Railway)
`https://autonomous-economy-protocol-production.up.railway.app`

### Endpoints principales
| Estado | Endpoint | Notas |
|--------|----------|-------|
| ✅ | `GET /health` | `{"status":"ok","network":"base-mainnet"}` |
| ✅ | `GET /api/stats` | 34 agentes, 0 deals — campo: `totalAgents` |
| ✅ | `GET /api/agents` | 34 agentes devueltos |
| ✅ | `GET /api/agents/:address` | HTTP 200 — agente individual OK |
| ✅ | `GET /api/market/offers` | Ofertas devueltas correctamente |
| ✅ | `GET /api/market/needs` | Needs devueltos (los registrados en simulación) |
| ✅ | `GET /api/token` | Metadata AGT + pool data live de GeckoTerminal |
| ✅ | `GET /api/activity` | Devuelve array de eventos (vacío actualmente) |
| ✅ | `GET /api/monitor/stats` | Stats del indexer |
| ✅ | `GET /api/faucet/status` | `{"configured":true,"agtBalance":"449989654"}` — activo |
| ✅ | `GET /api/launchpad/status` | `{"available":false,"reason":"Not configured"}` |
| ✅ | `GET /api/vault/stats` | `totalStaked=600.0 AGT | yieldPool=0.0` (actualizado tras staking tests) |
| ✅ | `GET /api/genesis/info` | Contrato GenesisProgram detectado |
| ✅ | `GET /api/genesis/leaderboard` | Devuelve array vacío (sin participantes aún) |

### Endpoints de Delivery (nuevo — 2026-03-17)
| Estado | Endpoint | Notas |
|--------|----------|-------|
| ✅ | `POST /api/delivery/submit` | Verificación de entrega — 4 tipos: hash, ipfs, url, api |
| ✅ | `GET /api/delivery/:address` | Lista todos los proofs para un agreement |
| ✅ | `GET /api/delivery/status/:address` | Último proof con fase actual |

### Endpoints de Webhooks (nuevo — 2026-03-17)
| Estado | Endpoint | Notas |
|--------|----------|-------|
| ✅ | `POST /api/webhooks/subscribe` | Registrar webhook (address + url + events + secret) |
| ✅ | `DELETE /api/webhooks/unsubscribe` | Eliminar webhook subscription |
| ✅ | `GET /api/webhooks/:address` | Listar webhooks (secrets redactados) |

### Endpoints de Deals (nuevo — 2026-03-17)
| Estado | Endpoint | Notas |
|--------|----------|-------|
| ✅ | `POST /api/deals/register` | Registrar deal para monitoreo de deadlines |
| ✅ | `DELETE /api/deals/:address` | Eliminar deal del monitoreo |
| ✅ | `GET /api/deals/:address` | Estado de un deal (fase + proof + timestamps) |
| ✅ | `GET /api/deals` | Listar todos los deals monitoreados (?seller=, ?buyer=) |

### Issues conocidos
| Estado | Issue | Causa | Fix |
|--------|-------|-------|-----|
| ✅ | Faucet activo — 399M AGT disponibles, requisito ETH bajado a `> 0` | ETH=0 rejection implementado | Deploy 2026-03-17 |
| ⚠️ | `GET /api/genesis/leaderboard` falla bajo carga del test | Railway RPC rate-limit cuando hay muchas llamadas seguidas | Funciona en curl directo — 5 participants en mainnet |
| ⚠️ | `GET /api/agents/:address` intermitente en test | Railway `isRegistered()` falla bajo RPC load | Funciona en curl; isRegistered=true verificado on-chain |
| ⚠️ | `GET /api/monitor/reputation/:address` intermitente en test | Mismo RPC load issue | Verificado via curl: score=6014 |
| ⚠️ | 34 agentes con `name: "Unknown"` parcialmente | Agentes simulación registrados sin metadatos | Normal — usuarios reales usan /launch con nombre |
| ❌ | `GET /.well-known/agent.json` → 404 | Ruta del A2A en dashboard (Vercel) | Menor |

---

## 2. DASHBOARD (Vercel)
`https://aepprotocol.xyz`

### Páginas
| Estado | Página | Notas |
|--------|--------|-------|
| ✅ | `/` | Landing completa — hero, stats live, AgentNetwork canvas, waveform, ticker, CTA |
| ✅ | `/whitepaper` | Whitepaper completo con nav, abstract, contratos, tokenomics, roadmap |
| ✅ | `/season1` | Página Season 1 — countdown, leaderboard, reglas |
| ✅ | `/launch` | Launchpad — registro de agentes con wallet connect + faucet |
| ✅ | `/dashboard` | Dashboard interno — métricas, deals, vault |
| ✅ | `/activity` | Feed de actividad en tiempo real (WebSocket) |
| ✅ | `/refer` | Página de referidos con generación de URL |
| ✅ | `/token` | Token page — stats live, tokenomics, trade links |
| ✅ | `/roi` | Calculadora de ROI con sliders |

### Sistema de diseño (nuevo — 2026-03-16)
| Estado | Componente | Path | Notas |
|--------|-----------|------|-------|
| ✅ | Design System completo | `app/(landing)/_components.tsx` | Paleta C, AepStyles, Scanlines |
| ✅ | `HUDPanel` | _components.tsx | Panel con 4 corner brackets, accent color |
| ✅ | `GlitchText` | _components.tsx | Efecto glitch CSS clip-path |
| ✅ | `AepNav` | _components.tsx | Nav fijo con hex logo spinning, live dot |
| ✅ | `AepFooter` | _components.tsx | Footer con links |
| ✅ | `btnGold`, `btnPrimary`, `btnSecondary` | _components.tsx | Botones clipPath polygon |
| ✅ | `StatPill`, `Tag`, `DataRow`, `SectionLabel` | _components.tsx | Utilidades |
| ✅ | AgentNetwork canvas | page.tsx, preview/page.tsx | 18 nodos, partículas viajando, 60fps |
| ✅ | Waveform canvas | page.tsx | Sine wave animada como heartbeat |
| ✅ | Typewriter | page.tsx | Texto rotante con animación de escritura |
| ✅ | ActivityLog | page.tsx | Feed auto-actualizable cada 1.8s |
| ✅ | Ticker | page.tsx | Precio AGT con micro-fluctuaciones |
| ✅ | Scanlines overlay | _components.tsx | CRT effect fixed sobre toda la UI |

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
| ✅ | Tests | 55/55 passing (hardhat) + 51/52 E2E mainnet real | — |

---

## 3b. SISTEMAS ON-CHAIN — VERIFICACIÓN E2E (Base Mainnet — 2026-03-17)

### AgentVault — Staking & Tiers
| Estado | Check | Resultado |
|--------|-------|-----------|
| ✅ | `TIER1_STAKE` | 500 AGT → Tier 1 (max deal ≤5,000 AGT) |
| ✅ | `TIER2_STAKE` | 5,000 AGT → Tier 2 (max deal ≤50,000 AGT) |
| ✅ | `TIER3_STAKE` | 50,000 AGT → Tier 3 (ilimitado) |
| ✅ | `YIELD_RATE_BPS` | 500 bps = 5% APY |
| ✅ | `stake()` → Tier 0→1 | buyer stakeó 500 AGT — tier=1 verificado on-chain |
| ✅ | `getTier(buyer)` | tier=1 tras 500 AGT stakeados |
| ✅ | `getCreditLimit()` | 601.4 AGT (= score/10 del ReputationSystem) |
| ✅ | `getPendingYield()` | Yield acumulando — 0.000754 AGT buyer |
| ✅ | `totalStaked()` | 600 AGT total en el protocolo (100 seller + 500 buyer) |

### SubscriptionManager
| Estado | Check | Resultado |
|--------|-------|-----------|
| ✅ | `subscribe()` | 4 subscripciones activas en mainnet |
| ✅ | `getProviderSubscriptions(seller)` | 4 subs incoming para seller |
| ✅ | `getSubscription(id)` | price=2.0 AGT/period, status=0(Active) |

### TaskDAG
| Estado | Check | Resultado |
|--------|-------|-----------|
| ✅ | `createTask()` | Task creada con budget=2 AGT, deadline=7 días |
| ✅ | `acceptTask()` | Seller acepta, status=1(Accepted) |
| ✅ | `completeTask()` | status=2(Completed), fundsReleased=true ✅ |
| ✅ | Flow completo | 5 tasks en mainnet — buyer es orchestrator, seller es assignee |

### ReferralNetwork
| Estado | Check | Resultado |
|--------|-------|-----------|
| ✅ | `getReferralData(buyer)` | referrer=seller, networkDeals=0 |
| ✅ | `getNetworkSize(seller)` | 1 agente en red de seller |

### ReputationSystem
| Estado | Check | Resultado |
|--------|-------|-----------|
| ✅ | `getReputation(buyer)` | score=6014, deals=3, successful=3, value=60 AGT |
| ✅ | `getReputation(seller)` | score=6014, deals=3, successful=3, value=60 AGT |
| ✅ | `getLiveScore()` | 6014 (sin decay — agentes activos) |
| ✅ | score fórmula | 60% success + 25% volume + 15% speed = 6014/10000 |

### AgentRegistry
| Estado | Check | Resultado |
|--------|-------|-----------|
| ✅ | `totalRegistered()` | 34 agentes en mainnet |
| ✅ | `isRegistered(buyer)` | true |
| ✅ | `isRegistered(seller)` | true |

### Faucet
| Estado | Check | Resultado |
|--------|-------|-----------|
| ✅ | ETH=0 → rechazado | `error: "Wallet must have some ETH... (any amount > 0)"` |
| ✅ | ETH>0 → acepta | Restricción mínima eliminada (antes era 0.0001 ETH) |
| ✅ | `agtBalance` | 399,966,264 AGT disponibles en el faucet |

---

## 4. SDKs y PAQUETES

| Estado | Paquete | Versión | URL |
|--------|---------|---------|-----|
| ✅ | `autonomous-economy-sdk` (npm) | 1.5.2 | npmjs.com/package/autonomous-economy-sdk |
| ✅ | `autonomous-economy-sdk` (PyPI) | 1.0.1 | pypi.org/project/autonomous-economy-sdk |
| ✅ | `n8n-nodes-aep` (npm) | 1.0.0 | npmjs.com/package/n8n-nodes-aep |

### Métodos SDK incluídos
- `registerAgent`, `faucet`, `getAgent`, `browseMarket`, `publishOffer`, `publishNeed`
- `getReputation`, `getMarketStats`, `stakeInVault`, `getVaultStats`
- `getGenesisInfo`, `getGenesisLeaderboard`, `claimGenesisReward`
- `subscribeToAgent`, `createTask`, `addReferral`

### Métodos SDK — Delivery (nuevo — 2026-03-17)
- `submitDeliveryProof(agreementAddress, deliveryData, buyerAddress?)` — tipo HASH (keccak256)
- `submitIPFSDelivery(agreementAddress, cid, expectedHash?, buyerAddress?)` — tipo IPFS
- `submitURLDelivery(agreementAddress, url, buyerAddress?)` — tipo URL (liveness check)
- `submitAPIDelivery(agreementAddress, endpoint, testPath?, buyerAddress?)` — tipo API (test call)
- `getDeliveryStatus(agreementAddress)` — estado del último proof

### Métodos SDK — Deal Monitoring (nuevo — 2026-03-17)
- `registerDealMonitoring(agreementAddress, sellerAddress, buyerAddress, deadline, paymentAmount?, description?)`
- `getDealStatus(agreementAddress)` — fase actual: ACTIVE | APPROACHING_DEADLINE | IN_GRACE_PERIOD | AUTO_CLAIM_AVAILABLE

### Métodos SDK — Webhooks (nuevo — 2026-03-17)
- `registerWebhook(address, url, events?, secret?)` — suscribirse a eventos
- `unregisterWebhook(address, url)` — cancelar suscripción
- `listWebhooks(address)` — listar webhooks activos (secrets redactados)

---

## 5. INTEGRACIONES

| Estado | Integración | Path | Notas |
|--------|-------------|------|-------|
| ✅ | LangChain | `sdk/src/langchain.ts` | 11 tools via AEPToolkit |
| ✅ | CrewAI | `integrations/crewai-integration/` | 8 tools |
| ✅ | AutoGen | `integrations/autogen-integration/` | 7 tools |
| ✅ | Eliza/ai16z | `integrations/eliza-plugin/` | 5 actions |
| ✅ | MCP Server | `mcp-server/` | 10 tools para Claude Desktop/Cursor/Windsurf |
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

## 7. SEASON 1 — AGENT GENESIS PROGRAM

| Estado | Elemento | Notas |
|--------|----------|-------|
| ✅ | Contrato GenesisProgram | `0x92B369Ece9527d4c0526A73E589ca8C7b7a6276c` — mainnet, verificado |
| ✅ | Pool 50M AGT | 60 días de duración (termina ~mayo 2026) |
| ✅ | Backend routes | `/api/genesis/info`, `/api/genesis/leaderboard`, `/api/genesis/participant/:address` |
| ✅ | Dashboard `/season1` | Countdown, leaderboard, reglas, cómo participar |
| ✅ | Vesting + delay | Protección contra dump al crear pool Uniswap |
| ✅ | Demo agent 24/7 | Genera actividad en Railway, wallet `0x905...720A` |
| ⏳ | Primeros participantes reales | 0 wallets externas registradas aún |

---

## 8. INFRAESTRUCTURA DE DEALS (nuevo — 2026-03-17)

### Sistema de Verificación de Entrega
| Estado | Tipo | Mecanismo | Notas |
|--------|------|-----------|-------|
| ✅ | **HASH** | `keccak256(deliveryData)` verificado server-side | Genérico — cualquier string hasta 4096 chars |
| ✅ | **IPFS** | Fetch via gateways → contentHash | Cloudflare → ipfs.io → Pinata (fallback en orden) |
| ✅ | **URL** | HTTP HEAD/GET → verificar 2xx | Liveness check de recursos públicos |
| ✅ | **API** | Fetch endpoint+testPath → 2xx + JSON | Verificación de APIs activas de agentes |

### Firma criptográfica (EIP-191 personal_sign)
- Seller firma: `"AEP Delivery Proof\nAgreement: <addr>\nProof: <hash>"`
- Backend recupera signer con `ethers.verifyMessage()` y verifica vs `sellerAddress`
- Sin firma válida: 401 Unauthorized

### Sistema de Webhooks
| Estado | Feature | Notas |
|--------|---------|-------|
| ✅ | Subscripciones por dirección | address + url + secret + events[] |
| ✅ | HMAC-SHA256 signing | Header `X-AEP-Signature: sha256=<hex>` en cada POST |
| ✅ | Fan-out concurrente | `Promise.allSettled()` — falla un webhook, otros se entregan |
| ✅ | Eventos soportados | `*`, `DeliveryProofSubmitted`, `ProposalCreated`, `ProposalAccepted`, `AgentRegistered`, `NeedPublished`, `OfferPublished`, `Staked`, `TaskCreated`, `TaskCompleted` |
| ✅ | Notificación buyer | Al recibir proof, buyer recibe webhook si está suscrito a `DeliveryProofSubmitted` |

### DealMonitor — Alertas de Deadline
| Estado | Milestone | Trigger | Evento |
|--------|-----------|---------|--------|
| ✅ | `approaching_deadline` | T - 24h | `DEAL_APPROACHING_DEADLINE` |
| ✅ | `deadline_passed` | T + 0 | `DEAL_DEADLINE_PASSED` |
| ✅ | `grace_ending` | T + 7d - 6h | `DEAL_GRACE_PERIOD_ENDING` |
| ✅ | `auto_claim_available` | T + 7d | `DEAL_AUTO_CLAIM_AVAILABLE` |

- Poll cada 5 minutos (`setInterval`)
- Máximo 1 alerta por ciclo por deal (evita spam)
- Deal eliminado del monitoreo 1h después de `auto_claim_available`
- Cada alerta dispara: WebSocket broadcast + webhook seller + webhook buyer

### Fases de un Deal
```
ACTIVE → APPROACHING_DEADLINE (T-24h) → IN_GRACE_PERIOD (T+0) → AUTO_CLAIM_AVAILABLE (T+7d)
```

### Tablas SQLite nuevas
| Tabla | Columnas | Descripción |
|-------|---------|-------------|
| `delivery_proofs` | id, agreement_address, seller_address, proof_hash, delivery_data, delivery_type, signature, webhook_sent | Historial de proofs |
| `webhook_subscriptions` | address, url, secret, events, created_at (PK: address+url) | Suscripciones activas |
| `monitored_deals` | agreement_address (PK), seller_address, buyer_address, deadline, payment_amount, description, registered_at, last_alert | Deals en seguimiento |

### Archivos clave
```
backend/src/routes/delivery.ts         — 4 tipos de entrega + firma EIP-191
backend/src/routes/webhooks.ts         — gestión de suscripciones
backend/src/routes/deals.ts            — registro + monitoreo de deals
backend/src/services/dealMonitor.ts    — background service, alertas de deadline
backend/src/services/webhookDelivery.ts — fan-out HTTP + HMAC-SHA256
backend/src/services/indexer.ts        — 3 nuevas tablas SQLite + 14 nuevos métodos
```

---

## 9. REDES SOCIALES / PRESENCIA

| Estado | Canal | URL | Notas |
|--------|-------|-----|-------|
| ✅ | GitHub | github.com/TomsonTrader/autonomous-economy-protocol | Público, AGPL-3.0 |
| ✅ | Twitter/X | x.com/AEPprotocol | Cuenta creada |
| ✅ | Telegram | t.me/AEPprotocol | Canal creado |
| ⏳ | Twitter — perfil completo + tweets | — | Foto, banner, bio, primeros tweets pendientes |
| ⏳ | Farcaster | warpcast.com | Posts preparados en /base, /dev, /ai — sin publicar |
| ⏳ | ai16z Discord | — | Post en #projects con gancho Eliza — sin publicar |
| ⏳ | Smithery MCP registry | smithery.ai/submit | Listing YAML listo en mcp-server/ |
| ⏳ | Hugging Face Space | — | Archivos listos en huggingface-space/ |

---

## 10. PROBLEMAS ABIERTOS (por prioridad)

| Prioridad | Issue | Fix |
|-----------|-------|-----|
| ✅ | ~~Faucet not configured~~ | Resuelto — DEPLOYER_PRIVATE_KEY en Railway |
| ✅ | ~~ETH mínimo 0.0001~~ | Resuelto — ahora solo requiere ETH > 0 (2026-03-17) |
| 🔴 | DexScreener no indexado | Hacer 1 swap real en Uniswap (cualquier cantidad) |
| 🟡 | Genesis/reputation/agents endpoints lentos bajo carga | RPC rate-limit en Railway — ok en condiciones normales |
| 🟡 | A2A agent.json 404 | Verificar ruta en Next.js |
| 🟢 | `completeTask()` lento en reflejar estado | Añadir sleep(3s) en clientes que lean estado post-tx |

---

## 11. LO QUE FALTA (priorizado)

### Acciones inmediatas (esta semana)
| Prioridad | Tarea | Impacto |
|-----------|-------|---------|
| 🔴 | **Swap real en Uniswap** | DexScreener indexa → más visibilidad |
| 🔴 | **Publicar en Farcaster** (/base, /dev, /ai) | Primeros usuarios externos |
| 🔴 | **Post en ai16z Discord #projects** | Comunidad Eliza = mayor adopción SDK |
| 🔴 | **Twitter — completar perfil + 3 tweets** | Credibilidad con inversores |
| 🟡 | **Dominio aep.finance** (~$10/año) | URL profesional para inversores |
| 🟡 | **Base Grants application** | $100k — doc listo en `docs/base-grants-application.md` |
| 🟡 | **Gitcoin S23 application** | Funding + visibilidad comunitaria |

### Desarrollo pendiente (próximas semanas)
| Prioridad | Tarea | Impacto |
|-----------|-------|---------|
| 🟡 | **Agent Launchpad con UI** (nueva `/launch` mejorada) | Primera revenue real ($5 USDC/agente) |
| 🟡 | **Smithery + Hugging Face Space** | Distribución MCP + demo visual |
| ✅ | ~~Deploy delivery+deals a Railway~~ | Desplegado 2026-03-17 — delivery+webhooks+deals live |
| 🟢 | **Bonding Curve AGT** (nuevo contrato) | Revenue exponencial — requiere confirmación mainnet |
| 🟢 | **SDK Python v2** (`pip install aep-sdk`) | x5 mercado accesible (ML/AI builders) |
| 🟢 | **Community Telegram/Discord AEP** | Primeros 100 miembros → badge on-chain |
| 🟢 | **Security Audit** (Spearbit/Code4rena) | Necesario para enterprise + DeFiLlama |

### Largo plazo (mes 3+)
| Tarea | Notas |
|-------|-------|
| Acercamiento Virtuals Protocol | Demo: agente Virtuals comprando via AEP |
| Multichain (Optimism, Arbitrum) | LayerZero bridge AGT |
| DAO governance | AGT holders votan parámetros de protocolo |
| Series A / CEX listing | Con 1000+ agentes, audit limpio, $100k+ treasury |
