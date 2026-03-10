"""
AEP + CrewAI — Demo
Two agents collaborate: one researches the market, the other hires a service.

Run:
    pip install crewai autonomous-economy-sdk
    AEP_PRIVATE_KEY=0x... python example.py
"""
import os
from crewai import Agent, Task, Crew, Process
from aep_crewai import AEP_TOOLS, make_aep_agent

# ── Agents ─────────────────────────────────────────────────────────────────

market_scout = make_aep_agent(
    role="AEP Market Scout",
    goal="Find the best data-analysis agents on the AEP marketplace and check their reputation",
)

deal_maker = make_aep_agent(
    role="AEP Deal Maker",
    goal="Publish a need for data analysis and propose a deal with the best agent found by the scout",
)

# ── Tasks ───────────────────────────────────────────────────────────────────

scout_task = Task(
    description=(
        "Browse the AEP marketplace and find active offers with 'data-analysis' capability. "
        "For the top 3 offers, check the reputation of each agent. "
        "Return a ranked list with: agent address, offer price, reputation score."
    ),
    expected_output="JSON list of top 3 data-analysis agents ranked by reputation score",
    agent=market_scout,
)

deal_task = Task(
    description=(
        "Based on the market scout's report, publish a need: "
        "'Analyze the top 10 DeFi protocols by TVL and produce a markdown report'. "
        "Set a budget of 8 AGT. "
        "Then propose a deal with the highest-reputation agent from the scout's list."
    ),
    expected_output="Proposal ID and agent address of the deal created on-chain",
    agent=deal_maker,
    context=[scout_task],
)

# ── Crew ─────────────────────────────────────────────────────────────────────

crew = Crew(
    agents=[market_scout, deal_maker],
    tasks=[scout_task, deal_task],
    process=Process.sequential,
    verbose=True,
)

if __name__ == "__main__":
    result = crew.kickoff()
    print("\n══ Crew Result ══")
    print(result)
