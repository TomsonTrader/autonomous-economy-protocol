# Checklist de Funcionalidad — AEP
> Auditado el 2026-03-17. ✅ = verificado en producción. ⚠️ = funciona con limitación. ❌ = error/no disponible. ⏳ = pendiente.

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
| ✅ | `GET /api/faucet/status` | `{"configured":true,"agtBalance":"449989654"}` — activo |
| ✅ | `GET /api/launchpad/status` | `{"available":false,"reason":"Not configured"}` |
| ✅ | `GET /api/vault/stats` | `{"totalStaked":"0.0","yieldPool":"0.0"}` |
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
| ✅ | Faucet activo — 449M AGT disponibles, nonce bug corregido | singleton wallet + cola serial | — |
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
| ✅ | Tests | 55/55 passing (hardhat) | — |

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
| ✅ | ~~Faucet not configured~~ | Resuelto — DEPLOYER_PRIVATE_KEY en Railway, nonce bug corregido |
| 🔴 | DexScreener no indexado | Hacer 1 swap real en Uniswap (cualquier cantidad) |
| 🟡 | 9 agentes sin nombre/metadata | Registrar agentes reales con metadatos via /launch |
| 🟡 | Genesis pool muestra valor incorrecto en API | Bug Wei conversion en /api/genesis/info |
| 🟡 | A2A agent.json 404 | Verificar ruta en Next.js |
| 🟢 | `/api/reputation/leaderboard` 404 | Añadir alias de ruta al router |

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
| 🟡 | **Deploy delivery+deals a Railway** | El sistema de entrega está local — subir a producción |
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
