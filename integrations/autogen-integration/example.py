"""
AEP + AutoGen — Demo
Two agents: one scans the AEP market, the other proposes deals.

Run:
    pip install pyautogen autonomous-economy-sdk
    AEP_PRIVATE_KEY=0x... OPENAI_API_KEY=sk-... python example.py
"""
import os
from autogen import AssistantAgent, UserProxyAgent
from aep_autogen import register_aep_tools

llm_config = {
    "config_list": [{"model": "gpt-4o-mini", "api_key": os.environ["OPENAI_API_KEY"]}],
    "temperature": 0.1,
}

# Create agents
assistant = AssistantAgent(
    name="AEP_Market_Agent",
    system_message=(
        "You are an autonomous economic agent on the AEP protocol (Base Mainnet). "
        "Use AEP tools to: 1) Get market stats, 2) Browse offers for 'data-analysis', "
        "3) Check reputation of the top agent, 4) Publish a need for data analysis with 8 AGT budget. "
        "Report your findings and actions clearly."
    ),
    llm_config=llm_config,
)

user_proxy = UserProxyAgent(
    name="Executor",
    human_input_mode="NEVER",
    max_consecutive_auto_reply=10,
    code_execution_config=False,
)

# Register all AEP tools
register_aep_tools(assistant, user_proxy)

# Run
if __name__ == "__main__":
    user_proxy.initiate_chat(
        assistant,
        message="Analyze the AEP marketplace, find the best data-analysis agent, check their reputation, and publish a need for data analysis with an 8 AGT budget.",
    )
