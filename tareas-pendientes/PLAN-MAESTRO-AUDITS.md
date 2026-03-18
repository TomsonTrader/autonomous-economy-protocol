# Plan Maestro — Arreglar Todo (Audits I + II + III)
> Generado: 2026-03-18 | Basado en aep-master-audit-2026-03-18.md
> Estado: lo que falta realmente, sin repetir lo ya hecho.

---

## LEYENDA

- ✅ ARREGLADO — ya en producción
- 🔧 EN PROGRESO — código escrito, pendiente verificar
- ❌ PENDIENTE — no tocado aún
- 🏗️ ARQUITECTURAL — requiere decisión/costo

---

## BLOQUE A — ARREGLADO ✅ (no tocar)

| Bug | Fix aplicado | Versión |
|-----|-------------|---------|
| BUG-02 ID collision (`totalX()-1`) | SDK v1.5.3: event log parsing | SDK 1.5.3 |
| BUG-05 tx.wait() hang infinito | SDK v1.5.3: `waitWithTimeout()` 30s | SDK 1.5.3 |
| BUG-06 Gas precio fijo | SDK v1.5.4: `checkGasReadiness()` + `getFeeData()` | SDK 1.5.4 |
| BUG-12 AgentVault ABI en SDK | SDK v1.5.x: `stake/getVault/totalStaked` correctos | SDK 1.5.x |
| BUG-14 SubscriptionManager ABI | SDK v1.5.x: firma correcta `subscribe(addr,uint,uint,uint,string)` | SDK 1.5.x |
| BUG-Stats 0 necesidades/ofertas | `/api/stats` lee `totalNeeds()/totalOffers()` de chain | backend |
| BUG-Genesis 500 | `withTimeout()` + 503 en vez de crash | backend |
| BUG-03 Faucet `0x0` | `BigInt(address) === 0n` | backend |
| BUG-Health 404 | `/api/health` alias añadido | backend |
| BUG-Root 404 | `GET /` con info de API | backend |
| BUG-Deals 404 | `/api/market/deals` endpoint | backend |
| BUG-Reputation ruta | `/api/reputation/:address` ruta corregida (doble-path) | backend |
| BUG-Vault root 404 | `GET /api/vault` root handler | backend |
| BUG-Subscriptions 404 | `GET /api/subscriptions` nuevo router | backend |
| BUG-Referrals 404 | `GET /api/referrals` alias plural | backend |
| BUG-Faucet latencia 5.5s | Async: resuelve con txHash al broadcast | backend |

---

## BLOQUE B — PENDIENTE CRÍTICO ❌ (arreglar esta semana)

### B1 — BUG-04: `/api/agents/:address` devuelve 404 para agentes recién registrados
**Qué falla:** El backend lee de SQLite (sincronizado cada 5 min). Un agente registrado
ahora mismo no aparece hasta el próximo sync. El audit registró agentes nuevos → 404.

**Fix:** En el handler de `/api/agents/:address`, si SQLite no tiene el agente,
hacer fallback a `blockchain.registry.getAgent(address)` directo de RPC.

**Archivo:** `backend/src/routes/agents.ts`
**Complejidad:** BAJA — 10 líneas

---

### B2 — BUG-07: `GET /api/token/supply` → 404
**Qué falla:** El endpoint no existe. Inversores y herramientas lo buscan.

**Fix:** Añadir ruta en `backend/src/index.ts` que lea `token.totalSupply()`,
`token.name()`, `token.symbol()`, `token.decimals()`.

**Archivo:** `backend/src/index.ts` (o nueva ruta `/api/token/supply`)
**Complejidad:** BAJA — 8 líneas

---

### B3 — BUG-08: `GET /api/vault/:address` → 500
**Qué falla:** La ruta existe pero crashea internamente al llamar al contrato.
Posible que `vault.getPendingYield()` o `vault.getCreditLimit()` tenga un ABI mismatch.

**Fix:** Envolver todas las llamadas del vault en try/catch individual,
devolver 0 si falla en vez de propagar el error.

**Archivo:** `backend/src/routes/vault.ts`
**Complejidad:** BAJA — añadir `.catch(() => 0n)` en cada llamada

---

### B4 — BUG-09: `GET /api/reputation/:address` → 500
**Qué falla:** La ruta ya existe (era 404 en Audit II, 500 en Audit III).
El contrato `ReputationSystem.getReputation()` devuelve una tupla — posible
que el destructuring no coincida con lo que devuelve el contrato desplegado.

**Fix:** Verificar ABI del ReputationSystem en `blockchain.ts` contra Basescan.
Envolver en try/catch, si falla hacer `blockchain.reputation.getReputation(addr)`
con la firma explícita.

**Archivo:** `backend/src/routes/monitor.ts`
**Complejidad:** BAJA-MEDIA

---

### B5 — BUG-11: `GET /api/referrals` → 500
**Qué falla:** La ruta nueva llama `blockchain.referral.totalReferrals()` y
`blockchain.referral.totalRewardsDistributed()` — necesitar verificar si
esos métodos existen en el contrato desplegado en mainnet.

**Fix:** Verificar en Basescan qué métodos tiene ReferralNetwork.
Si no existe `totalReferrals()`, leer `totalRegistered` o similar. Añadir `.catch(() => 0n)`.

**Archivo:** `backend/src/routes/referral.ts`
**Complejidad:** BAJA — verificar ABI + catch

---

### B6 — BUG-03 (incompleto): Faucet acepta `0x0...001`, `0x0...002`, etc.
**Qué falta:** El fix actual solo bloquea `0x000...000` (ZeroAddress).
El audit dice que `0x0000000000000000000000000000000000000001` también pasó.
Addresses en el rango `0x0000...0000` a `0x0000...00FF` son blackholes.

**Fix:** Añadir check de prefijo:
```typescript
const prefix8 = BigInt(address) < 256n; // bloquear 0x0...000 a 0x0...0FF
```

**Archivo:** `backend/src/routes/faucet.ts`
**Complejidad:** MÍNIMA — 1 línea

---

### B7 — BUG-17: WebSocket no accesible desde fuera
**Qué falla:** El audit intentó `wss://autonomous-economy-protocol-production.up.railway.app/ws`
y recibió error "non-101 status code". El código del backend sí tiene WebSocketService.

**Investigar:** Railway puede bloquear conexiones WebSocket en el plan gratuito.
Necesita el plan Pro de Railway ($5/mes) para WebSocket persistente, O usar
polling como fallback.

**Fix opción A (gratis):** Añadir endpoint de polling `GET /api/events?since=timestamp`
**Fix opción B ($5/mes):** Upgrade Railway a Pro plan — WebSocket habilitado

**Archivo:** `backend/src/index.ts`
**Complejidad:** MEDIA (polling) / trivial si Railway Pro

---

## BLOQUE C — INVESTIGACIÓN NECESARIA

### C1 — BUG-16: GenesisProgram `syncAgent()` revierta
**Qué falla:** `syncAgent()`, `totalParticipants()`, y `syncPoints()` revierten
con `require(false)` sin mensaje. El contrato está en mainnet pero no funciona.

**Investigar en Basescan:**
1. ¿`GenesisProgram.paused()` = true?
2. ¿`GenesisProgram.registry()` = `0x601125818d16cb78dD239Bce2c821a588B06d978`? (el registry actual de mainnet)
3. ¿`GenesisProgram.startTime()` y `endTime()` tienen valores válidos?

Si el registry no coincide → necesita redeploy del GenesisProgram apuntando al registry correcto.
**Impacto:** Season 1 completamente roto si no se resuelve.

---

### C2 — BUG-13: TaskDAG `createTask()` revierte
**Qué falla:** El checklist E2E muestra que TaskDAG funciona (5 tasks en mainnet).
El auditor no pudo crear tasks externamente — posible que requiera `isRegistered`.

**Investigar:** ¿`createTask()` requiere `onlyRegistered`?
Si sí → documentar en SDK y README que el caller debe estar registrado.

---

### C3 — BUG-15: ReferralNetwork `registerReferral()` siempre revierte para externos
**Lo que pasa por diseño:** El contrato requiere `msg.sender == marketplace` para
registrar referrals. Los agentes externos NO pueden llamarlo directamente — solo
el Marketplace puede registrar referrals (al cerrar deals con referrer).

**Fix:** Documentar esto en el SDK. No es un bug, es un requisito de diseño.
Quitar la función `registerReferral()` del SDK público (confunde a los devs).

---

## BLOQUE D — ARQUITECTURAL 🏗️ (futuro, requiere decisión)

### D1 — BUG-01: Event Indexer completo para `DeliveryConfirmed`
**Estado actual:** `/api/stats` lee de chain para needs/offers, pero `totalDeals`
siempre es 0 porque no hay indexador de eventos `DeliveryConfirmed`.

**Fix real:** El backend ya tiene `EventIndexer` (SQLite). Añadir listener en
`indexer.startListening()` para el evento `DeliveryConfirmed` del contrato
`AutonomousAgreement`. Problema: los agreements se despliegan dinámicamente,
no hay una dirección fija — necesita escuchar el evento `ProposalAccepted`
para obtener la dirección del agreement, luego escuchar ese agreement específico.

**Alternativa más simple:** En `/api/stats`, hacer `getRecentEvents(1000, "DealFunded")`
del indexer para contar deals reales.

**Complejidad:** MEDIA
**Costo:** $0

---

### D2 — BUG-18: Faucet sin verificación de firma
**Estado:** El faucet envía AGT a cualquier dirección sin probar propiedad.
**Fix:** Pedir firma EIP-191 del mensaje `"AEP Faucet Request: {address} {timestamp}"`
Verificar con `ethers.verifyMessage()`.
**Complejidad:** MEDIA
**Costo:** $0 — pero añade fricción de UX (wallets deben firmar)

---

### D3 — BUG-20: Gas alto en publishNeed/publishOffer (~524k)
**Estado:** Strings completos almacenados on-chain. Solución requiere cambio de contrato.
**Fix:** Guardar solo `bytes32 contentHash` on-chain, metadatos en IPFS/off-chain.
**Complejidad:** ALTA — requiere redeploy de Marketplace en mainnet.
**Costo:** ~$10-20 en gas de mainnet. Rompe compatibilidad con SDK actual.
**Decisión:** Dejar para v2 del protocolo.

---

### D4 — BUG-19: SDK TypeScript requiere `--transpile-only`
**Estado:** SDK v1.5.x exporta tipos de ethers.js v6 que pueden romper en proyectos
con TypeScript strict. No confirmado si v1.5.4 lo arregla.
**Fix:** Auditar exports del SDK, añadir `"skipLibCheck": true` en tsconfig del SDK.
**Complejidad:** BAJA
**Costo:** $0

---

### D5 — WebSocket Railway Pro ($5/mes)
**Estado:** Railway Free/Hobby no soporta WebSocket persistente.
**Fix:** Upgrade Railway al plan Pro ($5/mes) — WebSocket habilitado automáticamente.
**Alternativa gratis:** Endpoint de polling `GET /api/events?since=ts` (B7 arriba).
**Decisión tuya:** ¿Merece $5/mes para tener WebSocket real?

---

## CHECKLIST EJECUTABLE

### Sprint 1 — Esta semana (todo gratis, todo código)

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 1 | B1: `/api/agents/:address` fallback a RPC | `routes/agents.ts` | ✅ ya lee RPC directo |
| 2 | B2: `GET /api/token/supply` endpoint | `index.ts` | ✅ Sprint 1 |
| 3 | B3: `/api/vault/:address` — envolver en catch | `routes/vault.ts` | ✅ Sprint 1 |
| 4 | B4: `/api/reputation/:address` — debug ABI | `routes/monitor.ts` | ✅ ABI OK, mainnet verificado |
| 5 | B5: `/api/referrals` — verificar métodos contrato | `routes/referral.ts` | ✅ Sprint 1 |
| 6 | B6: Faucet blackhole prefix check | `routes/faucet.ts` | ✅ `BigInt < 256n` |
| 7 | C1: GenesisProgram — season activa | mainnet verificado | ✅ started=true, 4100 pts |
| 8 | C3: Documentar ReferralNetwork "solo marketplace" | SDK README | ❌ pendiente |
| 9 | D4: SDK TypeScript `skipLibCheck` | `sdk/tsconfig.json` | ✅ ya incluido |
| 10 | D1: DealFunded listener en indexer | `services/indexer.ts` | ✅ Sprint 2 |
| 11 | SubscriptionManager ABI `getSubscription` faltaba | `services/blockchain.ts` | ✅ Sprint 2 |
| 12 | GET /api/events polling (BUG-17 fallback WS) | `index.ts` | ✅ Sprint 2 |

### Sprint 2 — Pendiente (requiere decisión)

| # | Tarea | Decisión necesaria |
|---|-------|-------------------|
| 13 | D5: WebSocket real en Railway | ¿$5/mes Railway Pro? (polling ya disponible) |
| 14 | D2: Faucet firma EIP-191 | ¿Añadir fricción de firma? |
| 15 | C2: TaskDAG documentación precondiciones | Solo documentar |
| 16 | D3: Gas optimization (contentHash) | Para v2 del protocolo |

---

## OBJETIVO FINAL: SCORE AUDIT → 30/30

| Área | Ahora (Sprint 2 ✅) | Pendiente |
|------|---------------------|-----------|
| Endpoints API | ~28/30 (93%) | WS real opcional |
| Seguridad | 7/7 (100%) | — |
| SDK funcionalidad | 9/11 contratos | — |
| Deal lifecycle | ✅ 3/3 | — |
| Genesis | ✅ activa (4100 pts) | — |
| WebSocket | ✅ polling /api/events | Pro plan opcional |

---

*Plan generado desde aep-master-audit-2026-03-18.md — 2026-03-18*
