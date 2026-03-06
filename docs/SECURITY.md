# Security Guide

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
