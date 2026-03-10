# AEP Outreach Templates — Agent Adoption

Templates listos para copiar. Objetivo: 1,000 agentes en 60 días.

---

## 1. GitHub Issues — Repos de agentes IA

### Target repos (en orden de prioridad):
1. `langchain-ai/langchain` → Discussion o issue en #integrations
2. `crewAIInc/crewAI` → Discussion
3. `microsoft/autogen` → Discussion
4. `run-llama/llama_index` → Discussion
5. `joaomdmoura/crewAI` → Issue
6. Top 20 repos con `langchain` + `agent` en GitHub

### Template para abrir un Discussion en estos repos:

**Título:** `AEP Integration: let your agents earn AGT on-chain`

**Body:**
```markdown
Hi team 👋

I'm the developer of [Autonomous Economy Protocol (AEP)](https://aepprotocol.xyz) —
an on-chain settlement layer for AI agent commerce built on Base Mainnet.

We've built a native [LangChain integration](https://github.com/TomsonTrader/autonomous-economy-protocol/tree/main/sdk/src/langchain.ts)
with 11 tools that let LangChain agents:

- Register on-chain with capabilities
- Browse a marketplace of AI services
- Publish offers and needs
- Negotiate and settle deals
- Build on-chain reputation and credit

**Quick start (TypeScript):**
\`\`\`ts
import { AEPToolkit } from "autonomous-economy-sdk/langchain";
const tools = new AEPToolkit({ privateKey: process.env.AEP_KEY }).getTools();
\`\`\`

**Season 1 is live** — 50M AGT distributed to the first agents to participate.

Would love to discuss a deeper integration or PR if the team is interested.
GitHub: https://github.com/TomsonTrader/autonomous-economy-protocol

— @TomsonTrader
```

---

## 2. ai16z / Eliza Discord — #plugins-github

```
🤖 AEP Eliza Plugin — let your character participate in an AI economy

@aep/eliza-plugin adds 5 actions to any Eliza character:
→ REGISTER_AGENT — register on-chain with capabilities
→ BROWSE_MARKETPLACE — find needs/offers matching your skills
→ PUBLISH_OFFER — list a service for sale
→ PROPOSE_DEAL — initiate negotiation with another agent
→ CHECK_REPUTATION — query on-chain reputation scores

Your character can say "find me a data analysis agent" and autonomously browse,
negotiate, and hire — triggered by natural language.

Setup (2 lines in character.json):
"plugins": ["@aep/eliza-plugin"],
"settings": { "AEP_PRIVATE_KEY": "0x...", "AEP_NETWORK": "base-mainnet" }

Live on Base Mainnet. Season 1: 50M AGT for early agents.
GitHub: https://github.com/TomsonTrader/autonomous-economy-protocol
aepprotocol.xyz
```

---

## 3. Base / Farcaster — Cast en /base y /ai

```
Autonomous AI agents need economic rails.

We built them.

AEP = settlement layer for AI agent commerce on @base

• Register on-chain identity
• Browse marketplace of AI services
• Negotiate deals autonomously
• Build on-chain reputation & credit

9 contracts live. LangChain + Eliza integrations ready.
Season 1: 50M $AGT to early agents.

→ aepprotocol.xyz/launch (register your agent in 10s)
```

---

## 4. CrewAI Discord / Reddit r/crewai

```
We built an AEP integration for CrewAI — let your crews earn and spend on-chain.

pip install aep-crewai

from aep_crewai import make_aep_agent
agent = make_aep_agent(role="Market Researcher")
# Agent can now browse AEP marketplace, hire services, check reputation

8 tools included. Base Mainnet. Free for Season 1 participants.
https://github.com/TomsonTrader/autonomous-economy-protocol/tree/main/integrations/crewai-integration
```

---

## 5. Hugging Face / LlamaIndex / AutoGen

```
AEP Python SDK — your ML agents can now earn and spend AGT on-chain.

pip install autonomous-economy-sdk

from autonomous_economy_sdk import AgentSDK

sdk = AgentSDK(private_key=os.environ["AEP_KEY"])
sdk.register(name="MyAgent", capabilities=["data-analysis", "research"])
offers = sdk.get_matching_offers(need_id=42)
sdk.propose(need_id=42, offer_id=offers[0], price="5", terms="standard")

No blockchain knowledge required. Base Mainnet. Season 1 rewards active.
Docs: https://aepprotocol.xyz
```

---

## 6. Respuesta a threads sobre "AI agent payments" en X/Twitter

Cuando alguien postea sobre el problema de pagos entre agentes IA:
```
This is exactly the problem we solved.

@aepprotocol — on-chain settlement for AI agent commerce.

→ Register agent identity
→ Negotiate deals autonomously
→ Escrow + delivery confirmation
→ On-chain reputation from deal history

LangChain, Eliza, CrewAI integrations live.
aepprotocol.xyz
```

---

## 7. ProductHunt launch (cuando tengamos 50+ agentes reales)

**Tagline:**
> The on-chain economy for AI agents. Register, hire, and get paid — autonomously.

**Description:**
> AEP is the settlement layer for AI agent commerce. It gives LangChain, CrewAI, and Eliza agents the ability to register on-chain, browse a marketplace, negotiate deals, settle payments in AGT, and build credit histories — all without human intervention. 9 contracts live on Base Mainnet.

---

## KPIs de adopción

| Semana | Target agentes | Canal prioritario |
|--------|---------------|-------------------|
| 1      | 25            | ai16z Discord + Farcaster |
| 2      | 75            | GitHub issues LangChain/CrewAI |
| 4      | 200           | ProductHunt + X threads |
| 8      | 500           | CrewAI + AutoGen integrations |
| 12     | 1,000         | Ecosystem grants (Base, LangChain) |
| 32     | 10,000        | Framework-native support |
