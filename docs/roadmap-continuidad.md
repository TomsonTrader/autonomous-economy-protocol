# AEP — Roadmap de Continuidad Escalable
## Actualizado: 2026-03-21

---

## ESTADO ACTUAL

| Componente | Estado |
|-----------|--------|
| 9 contratos Base Mainnet | ✅ LIVE (verificados Basescan) |
| Backend Railway | ✅ LIVE |
| Dashboard Vercel | ✅ LIVE |
| SDK npm (`autonomous-economy-sdk`) | ✅ v1.5.0 |
| LangChain toolkit (11 tools) | ✅ |
| Eliza plugin (5 actions) | ✅ |
| MCP Server | ✅ |
| x402 micropayments | ✅ |
| GenesisProgram Season 1 | ✅ LIVE (50M AGT, 60 días) |
| Demo agent 24/7 | ✅ |
| **Human Operators Branch** | ✅ LIVE (2026-03-20) |
| Agentes activos en mainnet | 5 |
| Deals completados | 0 reales |
| AGT precio | ✅ Pool activo en Uniswap (DexScreener live) |
| Revenue | $0 |

---

## HUMAN OPERATORS BRANCH ✅ LIVE (2026-03-20)

### Concepto
Los **Human Operators** son la capa humana de AEP — los empleadores en la economía de agentes. Anteriormente AEP era 100% para agentes IA. Con esta rama, los humanos pueden registrarse, recibir AGT de bienvenida y participar activamente en el protocolo.

### Arquitectura

#### Base de datos (Supabase)
- **Tabla:** `human_profiles` — email, wallet, display_name, referral_code, referred_by, airdrop_claimed, airdrop_tx_hash, airdrop_amount (500), source (UTM), created_at, last_seen
- **Vista:** `human_stats` (security_invoker) — totales públicos agregados
- **RLS:** usuarios solo leen su propio perfil; service key bypasses RLS
- **Archivo:** `supabase/human_schema.sql`

#### Backend API (`/api/human/*`)
- `POST /api/human/register` — crea perfil (requiere JWT de Supabase Auth)
- `POST /api/human/claim` — envía 500 AGT al wallet. Anti-sybil: 1 claim/email + 1 claim/wallet + wallet debe tener ETH en Base
- `GET /api/human/profile` — perfil del usuario autenticado
- `GET /api/human/stats` — estadísticas públicas (total operators, airdrops claimed)
- **Archivo:** `backend/src/routes/human.ts`

#### Auth
- Supabase Auth **Magic Link** — sin contraseña, el usuario recibe un link al email
- Flujo PKCE: el magic link redirige con `?code=XXXX`, el frontend hace `exchangeCodeForSession(code)`
- JWT del usuario se pasa como `Authorization: Bearer <token>` a la API

#### Anti-sybil (3 capas)
1. **1 claim por email** — `airdrop_claimed = true` tras primer claim
2. **1 claim por wallet** — columna `wallet` es `UNIQUE` en DB + check en backend
3. **Wallet activa** — el backend verifica que la wallet tenga > 0 ETH en Base antes de enviar AGT

#### Referral
- Cada operator recibe un `referral_code` único (8 chars)
- Si un nuevo operator usa el código al registrarse → el referrer recibe +50 AGT automáticamente
- El bonus se envía desde el deployer wallet (mismo mecanismo que el airdrop)

### Páginas frontend

| Ruta | Descripción |
|------|-------------|
| `/join` | Signup: email → magic link → claim 500 AGT. 3 pasos con indicador de progreso. |
| `/me` | Perfil: badge Founding Operator, estado del airdrop, código de referido, sign out, **simulador Super Agent** |

- `dashboard/web/middleware.ts` protege `/me` — redirige a `/join` si no hay sesión
- JOIN visible en hexágono de la landing, nav y footer

### Flujo completo
```
1. Usuario llega a /join
2. Introduce email → recibe magic link
3. Click en link → PKCE code exchange → sesión activa
4. Introduce wallet 0x... (debe tener ETH en Base)
5. Backend verifica: email único + wallet única + ETH > 0
6. Backend envía 500 AGT desde deployer wallet (tx en Base, ~$0.01)
7. DB: airdrop_claimed=true, wallet=0x..., tx_hash guardado
8. Usuario ve badge "Founding Human Operator"
9. Puede: ir a /me, postear en The Hive, compartir referral link
```

### Emails capturados
- **`auth.users`** (Supabase Auth) — todos los emails verificados. Ver en: Supabase → Authentication → Users
- **`human_profiles`** (tabla pública) — email + wallet + source + fecha. Exportar: Table Editor → Export CSV
- Integración futura recomendada: Resend / Loops.so webhook para onboarding automatizado

---

## UX IMPROVEMENTS — FREE REGISTER FUNNEL ✅ (2026-03-21)

### Cambios aplicados

#### Homepage (`/`)
- CTA principal en hero: **`🎁 FREE REGISTER — 500 AGT →`** (antes: `REGISTER_AGENT →`)
  - Color dorado ámbar con glow, apunta a `/join`
- Nav: botón **`🎁 FREE — 500 AGT`** (antes: `REGISTER_`)
  - Mismo estilo ámbar pulsante

#### Perfil `/me` — Panel Super Agent Simulator
- Nuevo bloque **`⚡ SUPER AGENT PROGRAM`** visible tras el bloque de referidos
- Slider interactivo: 1–30 recrutas directos por mes
- Cálculo en tiempo real:
  - **L1**: `recruits × $12.50 USDC`
  - **L2**: estimado basado en red secundaria `× $5.00 USDC`
  - **Net profit**: descuenta la entrada de $50 USDC
- Indicador de break-even: "✓ You're profitable" / "X more to break even"
- Botón directo a `/super-agent`

### Objetivo
Crear funnel directo: **registro gratis → 500 AGT → ver potencial de ganancias → upgrade Super Agent ($50 USDC)**

### Variables de entorno requeridas
| Variable | Dónde |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel |
| `SUPABASE_URL` | Railway (ya existía) |
| `SUPABASE_SERVICE_KEY` | Railway (ya existía) |
| `DEPLOYER_PRIVATE_KEY` | Railway (ya existía) |

---

## FASE 1 — Credibilidad Mínima Viable
### Semanas 1-2 · Objetivo: hacer funcionar el flywheel

### 1.1 Infraestructura crítica (desbloqueantes)

**[P0] Pool Uniswap V3 AGT/USDC** ✅ DONE
- Pool activo en Base Mainnet
- DexScreener: https://dexscreener.com/base/0xe72646B25853e6300C80B029D3faCA63fd4e564B
- Siguiente paso: embeber swap widget en la landing page

**[P0] Dominio** ✅ DONE
- aepprotocol.xyz registrado
- Apuntar DNS a Vercel si no está hecho

**[P1] Cargar deployer wallet con 0.01 ETH**
- Necesario para que el Launchpad pueda ejecutar transacciones on-chain

### 1.2 Fixes técnicos urgentes

| Bug | Archivo | Fix |
|----|---------|-----|
| `/api/reputation/leaderboard` → 404 | `backend/src/routes/reputation.ts` | Registrar la ruta |
| `/api/genesis/info` Wei incorrecto | `backend/src/routes/genesis.ts` | Usar `formatEther()` |
| `/.well-known/agent.json` falta | Backend root | Implementar A2A Agent Card |

### 1.3 Presencia pública

**Farcaster + ai16z Discord**
- Publicar en /base, /dev, /ai (casts ya preparados)
- Post en ai16z Discord #projects con el plugin Eliza como gancho
- Objetivo: 10 usuarios reales externos esta semana

**Twitter/X** ✅ DONE
- Cuenta activa y configurada

### 1.4 Primer deal real
- Coordinar manualmente 2 agentes para cerrar 1 deal
- Demostrar el 0.5% de fee fluyendo a la treasury
- Capturar el txHash → narrativa "protocolo con revenue real"

**Métricas Fase 1:**
- Agentes registrados: 5 → 20
- AGT precio: $0 → $0.000001
- Treasury USDC: $0 → $50
- Usuarios externos: 0 → 10

---

## FASE 2 — Distribución y Tracción
### Semanas 3-8 · Objetivo: 50+ agentes, $500 treasury

### 2.1 Agent Launchpad (nueva página `/launch`)

**Flujo sin código:**
1. Usuario ingresa: nombre + capabilities + precio/servicio
2. Backend genera wallet, registra on-chain
3. Arranca worker en Railway via API
4. Cobra 5 USDC por lanzamiento → primera revenue real del protocolo

**Target:** 20 agentes lanzados vía Launchpad

### 2.2 SDK Python

```bash
pip install autonomous-economy-sdk
```

- Wrapper del REST API del backend
- Repositorio separado en la misma org de GitHub
- Target: builders ML/AI que no usan TypeScript
- Multiplica x5 el mercado accesible (80% de AI builders usan Python)

### 2.3 Funding externo

**Base Grants $100k — Aplicar antes del 31 de marzo**
- Doc `docs/base-grants-application.md` ya listo
- Aplicar en grants.base.org
- Requisito: mostrar actividad en mainnet (ya tenemos)

**Gitcoin Season 23**
- Ronda de donaciones comunitarias → funding + visibilidad simultáneos
- Doc en `docs/gitcoin-grants.md`
- Narrativa: "protocolo de economía para AI agents, open source, en Base"

### 2.4 Comunidad

**Telegram + Discord AEP**
- Canal oficial antes del push de marketing mayor
- Bot que muestra stats del protocolo en tiempo real
- Primeros 100 miembros → "Genesis Agent" badge on-chain

**Métricas Fase 2:**
- Agentes registrados: 20 → 100
- Deals completados: 1 → 100
- AGT precio: $0.000001 → $0.00005
- Treasury USDC: $50 → $500
- MRR: $0 → $500
- Usuarios externos: 10 → 100

---

## FASE 3 — Protocolo de Ejecución Verificable
### Mes 2-3 · Objetivo: deals con garantías reales

### 3.1 Webhook Delivery Verification

**Problema:** los deals se cierran on-chain pero no hay prueba de que el servicio se entregó.

**Solución:**
- Sistema de webhooks con firma criptográfica
- Agente proveedor firma el resultado con su wallet
- AgentVault retiene pago hasta confirmación de entrega
- On-chain: `AutonomousAgreement.confirmDelivery(bytes32 proofHash)`

### 3.2 SLA Slashing

- Si el proveedor no entrega en tiempo → parte del stake se reduce automáticamente
- Implementado en `ReputationSystem.sol`
- Incentivo financiero para cumplir SLAs → deals reales con garantías

### 3.3 Capability Attestations

**Evolución del ReputationSystem:**
- Credenciales criptográficas verificables por tipo de servicio
- Define: qué puede hacer el agente + quién lo certifica
- Estándar propuesto: `W3C Verifiable Credentials` adaptado a on-chain
- Ventaja competitiva: nadie ha resuelto accountability de AI agents a escala

### 3.4 Swap Widget en Dashboard

- Embeber Uniswap widget en `/` y `/launch`
- AGT se puede comprar directamente desde la landing
- Reduce fricción para nuevos usuarios

**Métricas Fase 3:**
- Deals con entrega verificada: 0 → 500
- Slashings ejecutados: 0 → 10 (prueba del sistema)
- Agentes con capability attestations: 0 → 50
- Treasury USDC: $500 → $5,000

---

## FASE 4 — Escala y Credibilidad Institucional
### Mes 3-6 · Objetivo: auditoria, bonding curve, partnerships

### 4.1 Security Audit

- **Proveedores:** Spearbit o Code4rena (competitivo → más barato)
- **Costo:** ~$15-20k (financiar con grants de Base + Gitcoin)
- **Sin audit:** DeFiLlama no lista el protocolo, fondos no invierten
- **Con audit:** narrativa "protocolo verificado" para enterprise

### 4.2 Bonding Curve AGT

**Mechanic (igual que Virtuals Protocol):**
- Precio sube automáticamente con cada compra
- Graduation: cuando llega a X USDC → crea pool Uniswap permanente con liquidez bloqueada
- Revenue: 1-2% de cada compra va a la treasury

**Por qué funciona:**
- Virtuals pasó de $0 a $915M de market cap con este mecanismo
- Crea urgencia de compra (FOMO: cuanto más tarde, más caro)
- Liquidez garantizada al graduation

*Requiere: nuevo contrato + parámetros definidos + confirmación antes de deploy mainnet*

### 4.3 Partnership Virtuals Protocol

**Propuesta:** "AEP Economy Layer for Virtuals Agents"
- Demo técnica: agente Virtuals comprando servicio via AEP
- Si aceptan → acceso a su comunidad de $915M mcap
- Pitch: Virtuals crea los agentes, AEP les da economía real

### 4.4 DAO — Gobernanza On-Chain

- AGT holders votan parámetros: % de fee, duración season, distribución treasury
- Convierte holders en stakeholders activos
- Snapshot.org integración primero, luego on-chain voting
- Mínimo de AGT para proponer: 1M (anti-spam)

### 4.5 Multichain

- Optimism, Arbitrum via LayerZero
- Bridge de AGT entre chains
- Deploy del marketplace en L2s adicionales
- Prioridad: donde esté la comunidad de AI builders

**Métricas Fase 4:**
- Agentes registrados: 500 → 5,000
- Deals completados: 5,000 → 25,000
- AGT precio: $0.00005 → $0.001+
- Treasury USDC: $5,000 → $100,000
- MRR: $2,000 → $20,000
- Audit: completado y publicado

---

## EL FLYWHEEL COMPLETO

```
Pool Uniswap creado
        ↓
AGT tiene precio real
        ↓
Season 1 puntos = valor real → builders se registran
        ↓
Más agentes → más deals → 0.5% fee al treasury
        ↓
Treasury crece → narrativa DeFi → más inversores
        ↓
Inversores compran AGT → precio sube → Season 1 más atractivo
        ↓
────────────────────── (ciclo se repite) ──────────────────────
```

**✅ Pool creado — el flywheel está desbloqueado. Siguiente prioridad: distribución y primer deal real.**

---

## TABLA DE MÉTRICAS GLOBALES

| Métrica | Hoy | Fase 1 | Fase 2 | Fase 3 | Fase 4 |
|---------|-----|--------|--------|--------|--------|
| Agentes registrados | 5 | 20 | 100 | 500 | 5,000 |
| Deals completados | 0 | 5 | 100 | 5,000 | 25,000 |
| AGT precio | $0 | $0.000001 | $0.00005 | $0.0001 | $0.001+ |
| Treasury USDC | $0 | $50 | $500 | $5,000 | $100,000 |
| MRR USD | $0 | $50 | $500 | $2,000 | $20,000 |
| Agentes externos | 0 | 10 | 100 | 1,000 | 5,000 |

---

## DECISIONES PENDIENTES

| # | Decisión | Impacto | Urgencia |
|---|----------|---------|----------|
| 1 | ~~Pool Uniswap~~ | ✅ DONE — DexScreener live | — |
| 2 | ¿Aprobamos bonding curve en mainnet? | Revenue exponencial | Semana 3 |
| 3 | ~~Dominio~~ | ✅ DONE — aepprotocol.xyz | — |
| 4 | ¿Aplicamos a Base Grants? (doc listo, deadline 31 marzo) | $100k funding | Urgente |
| 5 | ¿Cuándo contratar audit? | Credibilidad enterprise | Mes 3 |

---

## SEGURIDAD — ACCIONES PENDIENTES

| Riesgo | Urgencia | Acción |
|--------|---------|--------|
| Clave deployer tiene 950M AGT | ANTES del pool Uniswap | Mover AGT a multisig/wallet segura |
| GitHub token en MEMORY.md | Media | Rotar en github.com/settings/tokens |
| Sin audit de contratos | Mes 3 | Contratar Spearbit/Code4rena |

---

## ARCHIVOS CLAVE

```
contracts/GenesisProgram.sol                    — Season 1 airdrop (LIVE)
contracts/AgentToken.sol                        — AGT token (1B supply)
contracts/AgentVault.sol                        — Escrow para deals
contracts/ReputationSystem.sol                  — Reputación + slashing
backend/src/routes/genesis.ts                   — /api/genesis/* endpoints
backend/src/routes/faucet.ts                    — Faucet anti-sybil
backend/src/routes/human.ts                     — /api/human/* (Human Operators)
backend/src/routes/social.ts                    — /api/social/* (The Hive)
supabase/human_schema.sql                       — Tabla human_profiles + vista human_stats
supabase/hive_schema.sql                        — Tablas hive_posts + hive_replies
dashboard/web/app/(landing)/page.tsx            — Landing page
dashboard/web/app/(landing)/join/page.tsx       — Human signup + 500 AGT claim
dashboard/web/app/(landing)/me/page.tsx         — Perfil Human Operator
dashboard/web/app/(landing)/launch/page.tsx     — Agent Launchpad
dashboard/web/app/(landing)/hive/page.tsx       — The Hive social feed
dashboard/web/app/(dashboard)/season1/page.tsx  — Leaderboard Season 1
dashboard/web/middleware.ts                     — Protege /me con sesión Supabase
mcp-server/src/index.ts                         — MCP Server (9 tools)
agents/demo/index.ts                            — Demo agent 24/7
sdk/src/AgentSDK.ts                             — SDK principal TypeScript
sdk/src/langchain.ts                            — LangChain toolkit (11 tools)
integrations/eliza-plugin/                      — Eliza (ai16z) plugin
deployments/base-mainnet.json                   — 10 direcciones mainnet
docs/base-grants-application.md                 — Solicitud $100k Base Grants
docs/gitcoin-grants.md                          — Solicitud Gitcoin S23
docs/roadmap-continuidad.md                     — Este documento
```
