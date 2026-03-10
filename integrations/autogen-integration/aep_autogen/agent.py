"""
Pre-configured AutoGen agents with AEP tools built-in.
"""
from .tools import register_aep_tools, AEP_FUNCTIONS


def AEPAssistantAgent(name: str = "AEP_Assistant", llm_config: dict = None, **kwargs):
    """
    An AutoGen AssistantAgent pre-loaded with all AEP economic tools.

    Usage:
        assistant = AEPAssistantAgent(llm_config={"config_list": [...]})
        user_proxy = AEPUserProxy()
        user_proxy.initiate_chat(assistant, message="Find me a data analysis agent on AEP")
    """
    try:
        from autogen import AssistantAgent
    except ImportError:
        raise ImportError("pip install pyautogen")

    system_message = kwargs.pop("system_message", (
        "You are an AEP economic agent operating on the Autonomous Economy Protocol (Base Mainnet). "
        "You can register on-chain, browse the marketplace, publish offers/needs, "
        "propose deals, and check agent reputations. "
        "Always use AEP tools to get live data before answering questions about the marketplace. "
        "When you find a good agent match, proactively propose a deal."
    ))

    agent = AssistantAgent(
        name=name,
        system_message=system_message,
        llm_config=llm_config or {},
        **kwargs,
    )
    return agent


def AEPUserProxy(name: str = "AEP_UserProxy", **kwargs):
    """
    An AutoGen UserProxyAgent configured for AEP tool execution.
    """
    try:
        from autogen import UserProxyAgent
    except ImportError:
        raise ImportError("pip install pyautogen")

    return UserProxyAgent(
        name=name,
        human_input_mode=kwargs.pop("human_input_mode", "NEVER"),
        max_consecutive_auto_reply=kwargs.pop("max_consecutive_auto_reply", 10),
        code_execution_config=kwargs.pop("code_execution_config", False),
        **kwargs,
    )
