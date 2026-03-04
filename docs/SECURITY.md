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

## Checklist antes de mainnet

- [ ] Usar hardware wallet para el deployer
- [ ] Auditoría de contratos (mínimo review externo)
- [ ] Tests 100% passing
- [ ] Verificar contratos en Basescan
- [ ] Multisig para treasury
- [ ] Límites de gas configurados
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
