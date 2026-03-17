# AEP — Análisis Honesto de Utilidad Real
*Fecha: 2026-03-12*

---

## Lo que AEP hace bien HOY

**Infraestructura de coordinación on-chain:** registry, marketplace, escrow, reputación. Todo funciona. Un agente puede:
1. Publicar que existe y qué hace (AgentRegistry)
2. Anunciar servicios con precio (Marketplace)
3. Negociar y cerrar acuerdos en cadena (NegotiationEngine → AutonomousAgreement)
4. Cobrar de forma trustless (escrow AGT)

Esto es genuinamente útil como **capa de identidad y coordinación para agentes de IA.** El problema es lo que falta.

---

## La brecha crítica: el servicio no existe on-chain

Cuando el agente-comprador confirma "entrega completada", no hay ningún mecanismo que verifique que el servicio se entregó. El flujo real hoy es:

```
Buyer posta "necesito análisis de sentimiento"
Seller dice "lo hago por 40 AGT"
→ Se crea escrow on-chain ✅
→ Seller... ¿hace qué? No hay estándar. Manda un JSON por Telegram? Un email? Nada?
→ Buyer hace clic en "confirmar entrega" — por honor
→ Seller cobra
```

**Esto es un sistema de honor, no de verificación.** Para servicios entre agentes autónomos esto no escala porque no hay humano que confirme. Un agente malicioso puede cobrar sin entregar nada.

---

## Los 5 problemas reales (ordenados por impacto)

### 1. Sin capa de ejecución verificable
El blockchain registra *que hubo un deal* pero no *qué se intercambió*. La entrega ocurre off-chain sin prueba alguna.

Comparación: **Bittensor** resolvió esto con validadores on-chain que verifican outputs de modelos. AEP no tiene nada equivalente.

### 2. Latencia y gas incompatibles con microservicios
Una llamada a una API de sentiment analysis tarda 200ms. Publicar la necesidad on-chain + esperar confirmación + recibir resultado + confirmar entrega = 4 transacciones × 2 segundos Base + gas.

- Para servicios de alto valor ($50+): **aceptable**
- Para feeds de datos continuos o micro-tareas: **inviable**

### 3. Descubrimiento es primitivo
El marketplace tiene tags. Pero un agente LangChain que necesita "análisis de sentimiento en tiempo real con precisión >85% y latencia <500ms" no puede hacer esa query semántica.

Es como buscar trabajo en Craigslist cuando necesitas LinkedIn con filtros.

### 4. Sin SLAs ejecutables
Un agente puede prometer "99.9% uptime" en la descripción, pero no hay contrato on-chain que lo haga cumplir ni slashing si falla. La reputación sube/baja pero no hay penalización automática.

### 5. Fricción de onboarding para cualquier cosa real
Un developer que quiere integrar AEP necesita: wallet → ETH → AGT → approvals → transacciones. El 95% de builders de AI no van a hacer eso para probar algo nuevo.

El SDK de LangChain existe, pero la integración real (que una tarea de LangChain se route automáticamente por AEP) no existe aún.

---

## Mejoras eficientes (alta ROI, implementables en semanas)

### A. Webhook-based delivery verification (simple pero funcional)

El comprador especifica un endpoint HTTPS al publicar la necesidad. El vendedor entrega llamando a ese endpoint con el resultado y un hash. El escrow solo libera si el comprador confirma (o tras timeout). Esto no es ZK pero es infinitamente mejor que puro honor.

```
Need: { description, budget, deliveryWebhook: "https://..." }
Delivery: seller calls webhook → buyer's agent auto-confirms if hash matches SLA
```

### B. x402 micropayments para servicios continuos (ya tienes x402)

Para feeds de datos, oráculos, APIs: en lugar de un deal por transacción, abre un canal de pago. El comprador pre-deposita en escrow, el vendedor cobra stream por cada entrega. Liquidas on-chain cuando cierras el canal.

Esto resuelve el problema de latencia y gas para servicios de alta frecuencia.

### C. Integración real LangChain → AEP

La herramienta de LangChain que ya construiste hace `publishNeed`. Lo que falta: un `waitForFulfillment()` que escuche el webhook de entrega y devuelva el resultado al agente. Con esto, un agente LangChain puede subcontratar tareas a AEP de forma transparente:

```python
result = aep_tool.delegate(
    task="Sentiment analysis of these 100 tweets",
    max_budget="5 AGT",
    timeout_seconds=30
)
# Espera resultado real, no solo confirmación de deal
```

### D. Agente verificador automático (TaskDAG ya existe)

Usa el contrato TaskDAG que ya deployaste. Un deal complejo se divide en subtareas. Para cada subtask, hay un agente verificador que comprueba el output antes de liberar pago. No necesita ZK, solo consenso de 3 agentes verificadores independientes.

---

## Mejoras innovadoras (diferenciación real)

### 1. SLA contracts con slashing automático

```solidity
struct ServiceSLA {
    uint256 uptimeCommitment; // 9950 = 99.50%
    uint256 maxLatencyMs;
    uint256 slashAmount;      // AGT en stake que se pierde si fallas
    address oracleFeed;       // Chainlink Functions que verifica uptime
}
```

Un agente que quiere ser tomado en serio deposita AGT como garantía. Si el oráculo detecta que falló su SLA, se hace slash automático hacia el comprador.

**Esto convierte la reputación en dinero real. Ningún marketplace de agentes de IA tiene esto hoy.**

### 2. Capability attestations verificables

En lugar de "dice que hace análisis de sentimiento", un agente puede publicar una prueba on-chain de que corrió un benchmark estándar (e.g., SST-2) con accuracy verificable. Usando Chainlink Functions o un oráculo de compute:

```
Agent capability: "NLP/Sentiment"
  → Attestation: ran SST-2 benchmark → 89.3% accuracy
  → Proof: tx hash que llama a Chainlink Functions con resultado
  → Válido por 30 días, renovable
```

Los compradores pueden filtrar por "accuracy > 85% verificada". Esto es lo que hace Bittensor pero general-purpose.

### 3. Composición de agentes (TaskDAG real)

El contrato TaskDAG ya existe pero nadie lo usa. El caso de uso real:

```
Comprador necesita: "Informe de mercado semanal de DeFi"

TaskDAG descompone en:
  → Subtask A: fetch on-chain TVL data       (10 AGT)
  → Subtask B: sentiment analysis of Twitter (20 AGT)
  → Subtask C: synthesize into report        (15 AGT)

Se ejecutan en paralelo, outputs se envían al siguiente step.
Pago final: 45 AGT distribuido automáticamente entre los 3 agentes.
```

Esto es lo que hace CrewAI pero con pagos reales y sin depender de un orquestador centralizado.

---

## La realidad en una frase

> AEP hoy es un **protocolo de coordinación** que funciona.
> No es todavía un **protocolo de ejecución verificable**.
> Para la mayoría de casos de uso de AI agents, necesitas los dos.

---

## El camino más corto a utilidad real demostrable

Construye **un caso de uso end-to-end completo** con verificación real:

1. **Oracle Agent**: fetches ETH/USDC price from CoinGecko cada 60s, publica on-chain con hash
2. **Consumer Agent**: LangChain agent que necesita el precio para una decisión de trading
3. Consumer publica need → Oracle acepta automáticamente → Oracle entrega via webhook con hash → Consumer verifica hash → pago automático
4. **Todo esto sin intervención humana, verificable en Basescan**

Ese demo en un video de 90 segundos vale más que todo el código escrito hasta ahora para conseguir adopción. Es la diferencia entre "una infraestructura cool" y "esto funciona de verdad".

---

## Tabla resumen: estado actual vs. objetivo

| Componente | Estado hoy | Para utilidad real |
|---|---|---|
| Identidad de agente | ✅ On-chain, funcional | ✅ Suficiente |
| Publicación de servicios | ✅ Marketplace funcional | ⚠️ Falta búsqueda semántica |
| Negociación | ✅ NegotiationEngine live | ✅ Suficiente |
| Escrow de pago | ✅ AGT trustless | ✅ Suficiente |
| Verificación de entrega | ❌ Solo honor | ❌ Necesita webhooks/ZK |
| SLA enforcement | ❌ No existe | ❌ Necesita slashing |
| Micropagos streaming | ❌ No existe | ❌ Necesita x402 channels |
| Composición multi-agente | ⚠️ TaskDAG existe, nadie usa | 🔄 Necesita integración SDK |
| Capability attestation | ❌ Solo texto libre | ❌ Necesita oráculo de compute |
| Discovery semántico | ❌ Solo tags | ❌ Necesita vector search |
