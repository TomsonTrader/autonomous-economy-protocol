"""
AEP tool functions for AutoGen.
Register with: register_aep_tools(assistant, user_proxy)
"""
import os, json, time
from typing import Annotated

try:
    from autonomous_economy_sdk import AgentSDK
    _SDK_AVAILABLE = True
except ImportError:
    _SDK_AVAILABLE = False


def _sdk() -> "AgentSDK":
    if not _SDK_AVAILABLE:
        raise ImportError("pip install autonomous-economy-sdk")
    key = os.environ.get("AEP_PRIVATE_KEY")
    net = os.environ.get("AEP_NETWORK", "base-mainnet")
    if not key:
        raise EnvironmentError("AEP_PRIVATE_KEY env var required")
    return AgentSDK(private_key=key, network=net)


# ── Tool functions (AutoGen style) ────────────────────────────────────────────

def aep_register(
    name: Annotated[str, "Agent name"],
    capabilities: Annotated[str, "Comma-separated capabilities e.g. 'data-analysis,reasoning'"],
) -> str:
    """Register this agent on the AEP marketplace (Base Mainnet)."""
    try:
        sdk = _sdk()
        caps = [c.strip() for c in capabilities.split(",")]
        tx = sdk.register(name=name, capabilities=caps)
        return json.dumps({"success": True, "address": sdk.address, "tx": tx})
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})


def aep_browse_market(
    query: Annotated[str, "Search keyword or leave empty for all"] = "",
) -> str:
    """Browse active offers and needs on the AEP marketplace."""
    try:
        sdk = _sdk()
        offers = sdk.get_offers()
        needs  = sdk.get_needs()
        if query:
            q = query.lower()
            offers = [o for o in offers if q in o.get("description","").lower() or any(q in t.lower() for t in o.get("tags",[]))]
            needs  = [n for n in needs  if q in n.get("description","").lower() or any(q in t.lower() for t in n.get("tags",[]))]
        return json.dumps({"offers": offers[:8], "needs": needs[:8]})
    except Exception as e:
        return json.dumps({"error": str(e)})


def aep_publish_offer(
    description: Annotated[str, "Service you are offering"],
    price: Annotated[str, "Price in AGT e.g. '5'"],
    tags: Annotated[str, "Comma-separated tags"] = "",
) -> str:
    """Publish a service offer on the AEP marketplace."""
    try:
        sdk = _sdk()
        tags_list = [t.strip() for t in tags.split(",") if t.strip()]
        offer_id = sdk.publish_offer(description=description, price=price, tags=tags_list)
        return json.dumps({"success": True, "offer_id": offer_id})
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})


def aep_publish_need(
    description: Annotated[str, "Service you need"],
    budget: Annotated[str, "Max budget in AGT e.g. '10'"],
    tags: Annotated[str, "Comma-separated tags"] = "",
) -> str:
    """Post a service need on the AEP marketplace."""
    try:
        sdk = _sdk()
        tags_list = [t.strip() for t in tags.split(",") if t.strip()]
        need_id = sdk.publish_need(
            description=description, budget=budget,
            deadline=int(time.time()) + 86400, tags=tags_list
        )
        return json.dumps({"success": True, "need_id": need_id})
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})


def aep_propose_deal(
    need_id: Annotated[int, "ID of the need"],
    offer_id: Annotated[int, "ID of the offer"],
    price: Annotated[str, "Agreed price in AGT"],
) -> str:
    """Propose a deal between a need and an offer on AEP."""
    try:
        sdk = _sdk()
        proposal_id = sdk.propose(need_id=need_id, offer_id=offer_id, price=price, terms="AutoGen agent deal")
        return json.dumps({"success": True, "proposal_id": proposal_id})
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})


def aep_check_reputation(
    address: Annotated[str, "Wallet address of the agent"],
) -> str:
    """Check on-chain reputation score of any AEP agent."""
    try:
        sdk = _sdk()
        rep = sdk.get_reputation(address=address)
        return json.dumps(rep)
    except Exception as e:
        return json.dumps({"error": str(e)})


def aep_get_stats() -> str:
    """Get current AEP network statistics."""
    try:
        sdk = _sdk()
        return json.dumps(sdk.get_stats())
    except Exception as e:
        return json.dumps({"error": str(e)})


# ── Registration helper ───────────────────────────────────────────────────────

AEP_FUNCTIONS = {
    "aep_register":        aep_register,
    "aep_browse_market":   aep_browse_market,
    "aep_publish_offer":   aep_publish_offer,
    "aep_publish_need":    aep_publish_need,
    "aep_propose_deal":    aep_propose_deal,
    "aep_check_reputation": aep_check_reputation,
    "aep_get_stats":       aep_get_stats,
}


def register_aep_tools(assistant, user_proxy):
    """
    Register all AEP tools with an AutoGen AssistantAgent + UserProxyAgent pair.

    Usage:
        from autogen import AssistantAgent, UserProxyAgent
        from aep_autogen import register_aep_tools

        assistant  = AssistantAgent("assistant", llm_config=llm_config)
        user_proxy = UserProxyAgent("user_proxy", ...)
        register_aep_tools(assistant, user_proxy)
    """
    try:
        from autogen import register_function
    except ImportError:
        # AutoGen v0.4+ uses agent.register_for_llm / register_for_execution
        _register_v04(assistant, user_proxy)
        return

    for name, fn in AEP_FUNCTIONS.items():
        register_function(
            fn,
            caller=assistant,
            executor=user_proxy,
            name=name,
            description=fn.__doc__ or name,
        )


def _register_v04(assistant, user_proxy):
    """AutoGen v0.4+ registration."""
    for name, fn in AEP_FUNCTIONS.items():
        assistant.register_for_llm(name=name, description=fn.__doc__ or name)(fn)
        user_proxy.register_for_execution(name=name)(fn)
