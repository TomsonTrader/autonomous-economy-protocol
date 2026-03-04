# CLAUDE.md — Autonomous Economy Protocol

## Modo de trabajo

Claude opera de forma **completamente autónoma** en este proyecto.
No es necesario pedir permiso para operaciones de desarrollo estándar.

---

## Operaciones que Claude puede hacer SIN confirmación

### Código y compilación
- Editar cualquier archivo del proyecto (`.sol`, `.ts`, `.json`, `.md`, etc.)
- Crear nuevos archivos
- Ejecutar `npm install` o `npm install <paquete>`
- Compilar: `npx hardhat compile`
- Ejecutar tests: `npx hardhat test`
- Formatear o lint código

### Red local y desarrollo
- Iniciar/detener nodo Hardhat local: `npx hardhat node`
- Desplegar contratos en red local (hardhat)
- Ejecutar la simulación: `npx ts-node simulation/run.ts`
- Iniciar el backend: `npx ts-node backend/src/index.ts`
- Iniciar el dashboard: `cd dashboard/web && npm run dev`

### Base Sepolia (testnet)
- Desplegar contratos en Base Sepolia
- Ejecutar scripts de verificación en Basescan
- Interactuar con contratos desplegados en testnet
- Leer balances, estado de contratos, etc.

### Git (local)
- `git add`, `git commit`, `git status`, `git log`, `git diff`
- Crear branches locales

---

## Operaciones que SIEMPRE requieren confirmación explícita del usuario

### Dinero real / Mainnet
- ❌ Desplegar en Base Mainnet (`--network base-mainnet`)
- ❌ Transferir ETH o AGT reales
- ❌ Cualquier transacción en mainnet

### Git remoto
- ❌ `git push` a cualquier remote
- ❌ `git push --force`
- ❌ Crear pull requests

### Datos críticos
- ❌ Eliminar archivos (excepto temporales obvios como `*.log`, `events.db`)
- ❌ `git reset --hard`
- ❌ Modificar `.env` con claves reales
- ❌ Publicar claves privadas en ningún sitio

---

## Estructura del proyecto

```
autonomous-economy-protocol/
├── contracts/          # 9 contratos Solidity (CORE — no tocar sin razón)
├── scripts/deploy/     # Deploy scripts
├── test/               # 12 tests (deben pasar siempre)
├── simulation/         # Agentes autónomos de demostración
├── backend/            # API Express + WebSocket (puerto 3001)
├── sdk/                # TypeScript SDK para agentes externos
├── dashboard/
│   ├── cli/            # Monitor terminal
│   └── web/            # Next.js (puerto 3000)
└── deployments/        # Direcciones desplegadas (NO contiene claves)
```

## Contratos desplegados (Base Sepolia)

| Contrato | Dirección |
|----------|-----------|
| AgentToken (AGT) | `0x126d65BeBC92Aa660b67882B623aaceC0F533797` |
| AgentRegistry | `0xAAF4E3D289168FEaE502a6bFF35dC893eD1Ef2D3` |
| ReputationSystem | `0x3E895D9259Be22717a0590a421bC3BB76D332841` |
| Marketplace | `0xa9205cC3c3fC31D0af06b71287A8869430a0da97` |
| NegotiationEngine | `0x19C6ccfbf25d586dfc83a71Eb951EA1dFFDA40f6` |
| AgentVault | `0x208A5e53C884E6997AC8918109A2c79Ce33138D2` |
| TaskDAG | `0x93caC51CdE985326032367422330b25c64D6408d` |
| SubscriptionManager | `0xF175576DC487cc59C35A2d68B4c9C9420259A458` |
| ReferralNetwork | `0xce13AE836f6A38463fed7231122a1E09bAB8A88E` |

## Wallet del desplegador

- Dirección: `0xE4e4D612E83252fB0312BE6a5ee25Ef674934E1c` (nueva — generada segura)
- Red: Base Sepolia (testnet — sin valor real)
- La clave privada está en `.env` (NO se sube a git)
- ⚠️ Wallet anterior `0xf7f2B8E79eE2c0B74FEAfd3E47106Bd9eB5faa1c` está comprometida — NO usar para mainnet

## Reglas de seguridad del proyecto

1. `.env` está en `.gitignore` — nunca se sube
2. `node_modules/`, `artifacts/`, `cache/` están en `.gitignore`
3. Los contratos tienen 12 tests — deben pasar antes de cualquier deploy
4. `deployments/*.json` contiene solo direcciones públicas (seguro para git)

## Comandos principales

```bash
npm test                    # 12 tests de contratos
npm run compile             # compilar Solidity
npm run simulate            # simulación completa (necesita hardhat node)
npm run backend             # API en puerto 3001
npm run dev                 # web dashboard en puerto 3000
npm run node                # nodo Hardhat local
npm run deploy:sepolia      # deploy en testnet (requiere .env con clave)
npm run deploy:mainnet      # ⚠️ REQUIERE CONFIRMACIÓN — mainnet
```

## Contexto de negocio

Este es un protocolo DeFi/AI en Base. El objetivo es:
1. Ser la infraestructura de comercio entre agentes de IA
2. Generar ingresos vía fees de protocolo (0.5% por deal)
3. Token AGT con utilidad real (staking, fees, reputación-crédito)
4. Atraer inversores y desarrolladores de agentes IA

**Prioridades actuales:**
- Publicar en GitHub (repo público)
- Crear demo video del simulation
- Conectar con comunidad de agentes IA (Twitter/X)
- Preparar para mainnet cuando haya suficiente traction

---

*Este archivo es leído automáticamente por Claude Code en cada sesión.*
