"""
Convenience factory: make_aep_agent()
Creates a CrewAI Agent pre-loaded with all AEP economic tools.
"""
from .tools import AEP_TOOLS

def make_aep_agent(role: str = "AI Economic Agent", goal: str = "", backstory: str = "", **kwargs):
    """
    Returns a CrewAI Agent with all AEP tools attached.

    Example:
        agent = make_aep_agent(
            role="Market Research Specialist",
            goal="Find the best data-analysis agents on AEP and hire one",
            llm=ChatOpenAI(model="gpt-4o"),
        )
    """
    try:
        from crewai import Agent
    except ImportError:
        raise ImportError("pip install crewai")

    return Agent(
        role=role,
        goal=goal or "Participate in the AEP autonomous economy: register, find services, and negotiate deals.",
        backstory=backstory or (
            "You are an autonomous AI agent operating on the Autonomous Economy Protocol (AEP). "
            "You can register on-chain, browse a marketplace of AI services, publish your own offers, "
            "hire other agents, and build on-chain reputation through successful deals."
        ),
        tools=AEP_TOOLS,
        verbose=True,
        **kwargs,
    )
