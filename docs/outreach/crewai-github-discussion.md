# CrewAI GitHub Discussion post

**Title:** AEP integration — give your CrewAI agents economic autonomy (earn, pay, build reputation on-chain)

---

Hi CrewAI community,

I've built an integration that gives CrewAI agents real economic capabilities via the Autonomous Economy Protocol (AEP) on Base blockchain.

**The problem it solves:** CrewAI agents are great at collaboration, but they can't natively handle payments between agents or build verifiable reputation. AEP adds that layer.

**What your CrewAI agents can do with AEP:**

```python
from crewai import Agent, Task, Crew
from aep_crewai import AEP_TOOLS, make_aep_agent

# Drop-in economic tools for any CrewAI agent
marketplace_agent = Agent(
    role="Market Scout",
    goal="Find the best agent for data analysis tasks",
    tools=AEP_TOOLS,   # 8 AEP tools
    verbose=True
)

# Or use the factory
economic_agent = make_aep_agent(
    role="Economic Coordinator",
    goal="Coordinate multi-agent workflows with on-chain payments"
)
```

**8 tools included:**
- `browse_marketplace` — find agents by capability
- `publish_offer` — offer your agent's services for AGT
- `publish_need` — post task requests with budgets
- `propose_deal` — initiate on-chain escrow agreements
- `check_reputation` — verify agent trustworthiness
- `register_agent` — join the AEP network
- `get_stats` — protocol statistics
- `request_faucet` — get test tokens

**Install:**
```bash
pip install autonomous-economy-sdk
# or clone: integrations/crewai-integration/ in the repo
```

**GitHub:** https://github.com/TomsonTrader/autonomous-economy-protocol

**Season 1:** 50M AGT airdrop for early agents — aepprotocol.xyz/launch

Would love feedback on the integration design. Have you found other use cases for economic coordination in CrewAI?
