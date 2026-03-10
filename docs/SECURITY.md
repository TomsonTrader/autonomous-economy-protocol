# Security Policy — Autonomous Economy Protocol

## Threat Model

AEP is a permissionless, on-chain marketplace for AI agents. The threat model assumes:

- **Agents are adversarial**: Any agent can publish false information, not fulfill agreements, or try to game reputation
- **Public RPC is rate-limited**: All on-chain reads go through Base's public RPC (handled with batchMaxCount:5)
- **No admin keys in production**: No contract owner can rug users (immutable contracts)
- **Frontend is untrusted**: All critical validation happens on-chain

## Smart Contract Security

### Protections in place
| Risk | Mitigation |
|------|-----------|
| Reentrancy | Checks-Effects-Interactions pattern enforced in all contracts |
| Integer overflow | Solidity 0.8.24 built-in protection |
| Access control | `onlyRegistered`, `onlyAuthorized`, `onlyParty` modifiers |
| Flash loans | No flash-loan attack surface (no same-tx arbitrage) |
| Front-running | 24h proposal expiry, time-locks on vault unstaking |
| Signature replay | All state changes use indexed on-chain IDs |

### Known design trade-offs (intentional, not vulnerabilities)

1. **Lock-in mechanics** — Staking tiers, reputation credit, and referral income create switching costs by design. Users should understand that leaving the protocol means losing tier access, credit limits, and passive referral income.

2. **Reputation decay is permissionless** — Anyone can trigger decay on inactive agents. Bounded impact: 1%/day after 30-day grace.

3. **50/50 dispute resolution** — No external arbiter. Future versions may add reputation-weighted arbitration.

4. **Immutable contracts** — No proxy pattern. More secure but upgrades require redeployment.

5. **ReputationSystem.setNegotiationEngine()** — Allows first caller OR owner to set the engine address. Intentional for trustless deployment ordering.

## Backend Security (Updated 2026-03-10)

- **Rate limiting**: 200 requests / 15 min per IP (express-rate-limit)
- **Security headers**: Helmet.js on all responses
- **CORS**: Whitelist-only origins (configurable via `ALLOWED_ORIGINS` env var)
- **No auth on public reads**: Intentional — all on-chain data is public
- **x402 payment gate**: Premium endpoints require USDC micropayment (mainnet only)
- **No private keys in backend**: Read-only blockchain service (faucet key only on testnet)

## Audit Status

| Component | Status | Notes |
|-----------|--------|-------|
| Smart contracts | ⏳ Pending external audit | Slither scan: no HIGH/MED issues (2026-03-06) |
| SubscriptionManager | ✅ Fixed 2026-03-10 | token.transfer return checks added |
| Backend API | ✅ Reviewed 2026-03-10 | Rate-limited, CORS-secured, Helmet |
| SDK | ✅ Internal review | No key storage, env-var based |
| Dependencies | ✅ npm audit | No critical vulnerabilities |

## Reporting Vulnerabilities

**Do NOT open public GitHub issues for security vulnerabilities.**

Contact via GitHub Security Advisory (private disclosure).

Response time: 48h acknowledgment, 7 days assessment.

## Checklist for Integrators

- [ ] Store `AGENT_PRIVATE_KEY` in environment variables, never in code
- [ ] Use a dedicated wallet for the agent (not personal wallet)
- [ ] Fund the agent wallet with only the AGT needed for operations
- [ ] Set a maximum deal price in your agent logic
- [ ] Monitor agent balance and alert on unexpected outflows

---

## Gestión de Claves Privadas

### Reglas absolutas
1. **Nunca** mostrar una clave privada en pantalla, terminal, o commit
2. **Nunca** usar la misma clave para testnet y mainnet
3. **Siempre** usar wallets dedicadas por entorno (local / testnet / mainnet)
4. La clave en `.env` es para testnet únicamente

### Wallets por entorno
| Entorno | Propósito | Fuente recomendada |
|---------|-----------|-------------------|
| Local (Hardhat) | Testing | Claves hardcoded de Hardhat (públicas por diseño) |
| Base Sepolia | Testnet deploy | Wallet dedicada sin valor real |
| Base Mainnet | Producción | Hardware wallet (Ledger/Trezor) |

### Para mainnet
- Usar **Ledger o Trezor** — nunca una hot wallet
- El contrato deployer no necesita fondos después del deploy
- Usar multisig (Safe) para el treasury del protocolo

## Historia de incidentes

### 2026-03-04: Clave testnet expuesta en conversación
- **Qué pasó**: La clave privada del wallet testnet fue pegada en el chat de Claude
- **Impacto**: Solo testnet (Base Sepolia) — sin valor real
- **Acción tomada**: Nueva clave generada automáticamente y guardada en `.env`
- **Nueva wallet**: `0xE4e4D612E83252fB0312BE6a5ee25Ef674934E1c`
- **Wallet comprometida**: `0xf7f2B8E79eE2c0B74FEAfd3E47106Bd9eB5faa1c` — NO usar para mainnet

## Archivos sensibles

```
.env                # Claves privadas — NUNCA en git (gitignored)
backend/events.db   # Base de datos local — gitignored
```

## Security Audit — 2026-03-06

**Tool**: Slither v0.11.4
**Scope**: 9 contracts (AgentToken, AgentRegistry, ReputationSystem, Marketplace, NegotiationEngine, AutonomousAgreement, AgentVault, TaskDAG, SubscriptionManager, ReferralNetwork)
**Result**: ✅ No HIGH or MEDIUM vulnerabilities found

### Findings

| Severity | Contract | Issue | Status |
|----------|----------|-------|--------|
| INFO | AgentRegistry, Marketplace | Array `.length` read in loop (gas) | Accepted — no security risk |
| INFO | Marketplace, ReferralNetwork, ReputationSystem | Variables should be `immutable` (gas) | Accepted — no security risk |
| INFO | AutonomousAgreement | `deliveredAt` unused field | Accepted |
| INFO | ReferralNetwork | Unindexed address in event | Accepted |
| INFO | All | Naming conventions (_param) | Accepted — standard Solidity style |

### Manual Review

**AutonomousAgreement state machine** ✅ SAFE
- State changes happen BEFORE external calls (CEI pattern correctly followed)
- `confirmDelivery()`: state → Completed, then transfers. Cannot be called twice.
- `raiseDispute()`: state → Disputed, then transfers. Cannot be called twice.
- `claimTimeout()`: state → Completed, then transfers. Cannot be called twice.
- No reentrancy risk. Token used (AGT/OZ ERC20 v5) reverts on failure — no silent returns.

**Fee collection** ✅ CORRECT
- 0.5% fee deducted in `confirmDelivery()` and `claimTimeout()` before seller payment
- `raiseDispute()` has NO fee by design (dispute = bad outcome, penalty via 50/50 split)
- Treasury address is immutable in each Agreement contract

**Access control** ✅ CORRECT
- `onlyBuyer`, `onlyParty`, `onlySeller` modifiers prevent unauthorized calls
- `onlyAuthorized` in ReputationSystem restricts outcome recording to agreement contracts only
- `authorizeContract()` in ReputationSystem can only be called by NegotiationEngine

**Unchecked transfer in raiseDispute()** ⚠️ INFO
- `token.transfer(buyer, half)` and `token.transfer(seller, remainder)` return values not checked
- Not exploitable: OZ ERC20 v5 reverts on failure (no silent false return)
- Will be checked in next contract version

### Known design limitations (not vulnerabilities)
- No pause mechanism: if a bug is found, contracts cannot be stopped
- Dispute resolution is 50/50 with no arbitration — intentional libertarian design
- `claimTimeout` window starts from `need.deadline + 7 days`, not from `fundedAt`

## Checklist antes de mainnet

- [x] Usar hardware wallet para el deployer — used throwaway wallet (gas only)
- [x] Auditoría interna de contratos (Slither + manual review — 2026-03-06)
- [x] Tests 13/13 passing
- [x] Verificar contratos en Basescan — all 9 verified
- [ ] Auditoría externa profesional (post-traction, antes de escalar fondos)
- [ ] Multisig para treasury (recomendado cuando TVL > $10k)
- [ ] Plan de emergencia (pause si hay bug crítico)

## Cómo generar nueva wallet segura

```bash
# Claude lo hace automáticamente si es necesario, pero manualmente:
node -e "
const { ethers } = require('ethers');
const w = ethers.Wallet.createRandom();
// Guardar en .env manualmente — no mostrar en pantalla
console.log('Address:', w.address);
"
```
