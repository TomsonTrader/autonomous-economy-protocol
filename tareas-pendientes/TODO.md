# Tareas Pendientes — AEP
> Actualizado por Claude. Marca ✅ cuando termines cada tarea.
> Las tareas con 🔴 son bloqueantes para otras. Las 🟡 son importantes. Las 🟢 son opcionales pero valiosas.

---

## BLOQUE 1 — Infraestructura base (ya hecho en su mayoría)

- [x] Contratos desplegados en Base Mainnet (9 contratos)
- [x] Backend en Railway (https://autonomous-economy-protocol-production.up.railway.app)
- [x] Dashboard en Vercel (https://aepprotocol.xyz)
- [x] Dominio aepprotocol.xyz conectado a Vercel (DNS en Porkbun)
- [x] GitHub repo público (github.com/TomsonTrader/autonomous-economy-protocol)
- [x] npm package publicado (autonomous-economy-sdk@1.5.1 — con postinstall hook)
- [x] Python SDK publicado en PyPI (autonomous-economy-sdk@1.0.0)
- [x] Logo AEP integrado en dashboard (favicon, OG image, sidebar)
- [x] AutoGen integration (7 tools) — integrations/autogen-integration/
- [x] CrewAI integration (8 tools) — integrations/crewai-integration/
- [x] MCP Server (9 tools) — mcp-server/
- [x] Orchestrator multi-agente — orchestrator/
- [x] Activity feed (/activity) y agent profiles (/agent/[address])
- [x] Google A2A AgentCard endpoint
- [x] GitHub Action para auto-registro
- [x] README actualizado completamente

---

## BLOQUE 2 — Token y mercado 🔴

### 2.1 Pool Uniswap
- [x] Crear pool AGT/USDC en Uniswap V3 (Base Mainnet)
- [x] Dirección del pool: `0xe72646B25853e6300C80B029D3faCA63fd4e564B`
- [x] URL Uniswap: https://app.uniswap.org/explore/pools/base/0xe72646B25853e6300C80B029D3faCA63fd4e564B
- [x] Añadir liquidez suficiente (mínimo $100 para CoinGecko)

### 2.2 DexScreener
- [ ] 🟡 Ir a dexscreener.com/update-token-info
- [ ] Subir logo (200x200px de agt-logo-1000.png via squoosh.app)
- [ ] Añadir: website=aepprotocol.xyz, Twitter=@AEPprotocol, GitHub, descripción
- [ ] Anotar aquí la URL del pool en DexScreener: `___________________________`

### 2.3 DexTools
- [ ] 🟢 Ir a dextools.io → Token Manager → buscar AGT → actualizar info

---

## BLOQUE 3 — Redes sociales 🔴

### 3.1 Twitter/X (@AEPprotocol)
- [x] Cuenta creada: https://x.com/AEPprotocol
- [ ] 🔴 Subir foto de perfil (agt-logo-400.png — redimensionar en squoosh.app)
- [ ] 🔴 Subir banner (twitter-header.png — crear con Grok si no tienes)
- [ ] 🔴 Añadir bio: `The settlement layer for AI agents. Register · Trade · Build credit on-chain. 9 contracts live on Base Mainnet. $AGT 🔵`
- [ ] 🔴 Añadir website: https://aepprotocol.xyz
- [ ] 🔴 Añadir ubicación: `Base Mainnet`
- [ ] Publicar tweet pin (texto en docs/twitter-launch-thread.md)
- [ ] Publicar los 4 tweets de lanzamiento
- [ ] Seguir: @base @jessepollak @virtuals_io @ai16zdao @LangChainAI @BuildOnBase

### 3.2 Farcaster
- [ ] 🟡 Crear cuenta si no tienes (warpcast.com)
- [ ] Publicar cast en /base (texto en docs/outreach-templates.md → sección 3)
- [ ] Publicar cast en /ai

---

## BLOQUE 4 — Listings de token 🟡

### 4.1 CoinGecko
- [ ] 🔴 PRIMERO necesitas el pool Uniswap funcionando (Bloque 2.1)
- [ ] Ir a coingecko.com/en/coins/new
- [ ] Rellenar con los textos de docs/exchange-listings.md
  - Logo: 200x200px (squoosh.app)
  - Todas las respuestas largas están en este repo (Claude las preparó)
- [ ] Publicar tweet de verificación con Request ID cuando te lo den
- [ ] Anotar Request ID aquí: `___________________________`

### 4.2 CoinMarketCap
- [ ] Ir a coinmarketcap.com/request
- [ ] Rellenar con datos de docs/exchange-listings.md
- [ ] Anotar Request ID aquí: `___________________________`

### 4.3 GeckoTerminal
- [ ] 🟢 Ya aparece automáticamente si tienes pool Uniswap. Verificar en geckoterminal.com
- [ ] Actualizar info del token si es necesario

---

## BLOQUE 5 — Comunidades de desarrolladores 🔴

### 5.1 ai16z / Eliza Discord ← MENSAJE LISTO
- [ ] 🔴 Entrar: discord.gg/ai16z → canal #show-and-tell o #projects
- [ ] Copiar y pegar el mensaje de: **docs/outreach/ai16z-discord-post.md**
- [ ] Anotar respuestas/feedback aquí: `___________________________`

### 5.2 LangChain GitHub ← PR LISTO
- [ ] 🟡 Ir a github.com/langchain-ai/langchain/discussions
- [ ] Copiar título + body de: **docs/outreach/langchain-pr.md**
- [ ] URL del discussion: `___________________________`

### 5.3 CrewAI GitHub ← POST LISTO
- [ ] 🟢 Ir a github.com/joaomdmoura/crewAI/discussions
- [ ] Copiar el post de: **docs/outreach/crewai-github-discussion.md**
- [ ] URL: `___________________________`

### 5.4 Smithery MCP Registry ← LISTING LISTO
- [ ] 🔴 Ir a smithery.ai/submit
- [ ] El archivo de listing ya está en: **mcp-server/smithery.yaml**
- [ ] También enviar a: glama.ai (directorio alternativo de MCPs)

### 5.5 n8n Community Nodes ← NODE LISTO
- [ ] 🟡 Ir a community.n8n.io → #share-your-work
- [ ] Anunciar el nodo: n8n-nodes-aep (código en integrations/n8n-node/)
- [x] Publicar en npm: `n8n-nodes-aep@1.0.0` live en npmjs.com ✅

### 5.4 Base / Farcaster /base
- [ ] 🟡 Post en canal /base de Farcaster
- [ ] Post en canal /ai de Farcaster

---

## BLOQUE 6 — Hugging Face Space 🟡

- [ ] Crear cuenta en huggingface.co si no tienes
- [ ] Ir a huggingface.co/new-space
  - Name: `aep-protocol`
  - SDK: Gradio
  - Visibility: Public
- [ ] Subir los 3 archivos de la carpeta `huggingface-space/`:
  - `app.py`
  - `requirements.txt`
  - `README.md`
- [ ] URL del Space: `___________________________`
- [ ] Compartir en Twitter y Discord

---

## BLOQUE 7 — Custom GPT (OpenAI) 🟡

- [ ] Ir a chat.openai.com/gpts/editor
- [ ] Name: `AEP Agent Assistant`
- [ ] Pegar el system prompt de docs/custom-gpt/system-prompt.md
- [ ] En Actions: subir docs/custom-gpt/openapi-spec.json
- [ ] Subir logo (agt-logo-1000.png)
- [ ] Visibility: Public
- [ ] Publicar en GPT Store
- [ ] URL del GPT: `___________________________`

---

## BLOQUE 8 — Financiación 🟢

### 8.1 Base Grants
- [ ] Leer docs/base-grants-application.md
- [ ] Ir a grants.base.org
- [ ] Rellenar con los datos del doc
- [ ] Fecha límite próxima convocatoria: `___________________________`

### 8.2 Gitcoin Grants
- [ ] Leer docs/gitcoin-grants.md
- [ ] Esperar la próxima ronda de Gitcoin (GG23+)
- [ ] URL cuando apliques: `___________________________`

### 8.3 Mirror.xyz (crowdfund)
- [ ] Crear cuenta en mirror.xyz
- [ ] Publicar el Manifesto de docs/gitcoin-grants.md → sección Mirror
- [ ] Activar crowdfund con NFTs Genesis (100,000 AGT por NFT)
- [ ] URL: `___________________________`

---

## BLOQUE 9 — Faucet y primeros agentes reales 🔴

- [ ] 🔴 Cargar el wallet del deployer con más ETH para gas (Railway demo agent)
  - Dirección deployer: `0x1200BE707C668b0313757Fc7d097B1a498bA62Ba`
  - Necesita ~0.01 ETH para financiar agentes nuevos vía launchpad
- [ ] Probar el launchpad manualmente: ir a aepprotocol.xyz/launch
- [ ] Verificar que funciona end-to-end
- [ ] Reclutar 5 amigos/conocidos para registrar su primer agente

---

## BLOQUE 10 — Seguridad (cuando tengamos tracción) 🟢

- [ ] Contratar auditoría de seguridad (Spearbit, Code4rena, o similar)
  - Presupuesto estimado: $10,000–$20,000
  - Prioridad: después de 100 agentes activos
- [ ] Publicar resultados de auditoría en GitHub
- [ ] Añadir badge de auditoría al README

---

## SEGUIMIENTO DE KPIs

Actualiza esta tabla cada semana:

| Semana | Agentes registrados | Deals totales | Volumen AGT | Notas |
|--------|--------------------:|-------------:|------------:|-------|
| Sem 1  | 11 (nuestros)       | 0            | 0           | Pre-lanzamiento |
| Sem 2  |                     |              |             | |
| Sem 3  |                     |              |             | |
| Sem 4  |                     |              |             | |
| Sem 8  |                     |              |             | |
| Sem 12 |                     |              |             | |

---

## NOTAS IMPORTANTES

- **Deployer wallet**: `0x1200BE707C668b0313757Fc7d097B1a498bA62Ba` — guarda bien la clave privada, no la compartas
- **Pool Uniswap**: la dirección del pool es necesaria para CoinGecko, DexScreener y el dashboard
- **Logo 200x200**: para exchanges ve a squoosh.app, sube agt-logo-1000.png, redimensiona a 200x200, descarga como PNG
- **Logo 400x400**: para Twitter/X perfil, mismo proceso pero 400x400
- **Todos los textos** para formularios están en `docs/exchange-listings.md`
- **Todos los mensajes** para comunidades están en `docs/outreach-templates.md`
