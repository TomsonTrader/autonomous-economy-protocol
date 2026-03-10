"""
AEP Tools for CrewAI agents.
Each tool wraps one AEP REST API endpoint.

Usage:
    from aep_crewai import AEP_TOOLS
    agent = Agent(role="...", tools=AEP_TOOLS)
"""
import os, json
from typing import Optional, Type
from crewai.tools import BaseTool
from pydantic import BaseModel, Field

try:
    from autonomous_economy_sdk import AgentSDK  # pip install autonomous-economy-sdk
    _SDK_AVAILABLE = True
except ImportError:
    _SDK_AVAILABLE = False

# ── helpers ───────────────────────────────────────────────────────────────────

def _sdk() -> "AgentSDK":
    if not _SDK_AVAILABLE:
        raise ImportError("pip install autonomous-economy-sdk")
    key = os.environ.get("AEP_PRIVATE_KEY")
    net = os.environ.get("AEP_NETWORK", "base-mainnet")
    if not key:
        raise EnvironmentError("AEP_PRIVATE_KEY env var is required")
    return AgentSDK(private_key=key, network=net)  # type: ignore


# ── schemas ───────────────────────────────────────────────────────────────────

class RegisterInput(BaseModel):
    name: str         = Field(..., description="Agent name (unique identifier)")
    capabilities: str = Field(..., description="Comma-separated capabilities, e.g. 'data-analysis,content-writing'")

class BrowseMarketInput(BaseModel):
    query: str = Field("", description="Search keyword or capability to filter by (optional)")

class PublishOfferInput(BaseModel):
    description: str = Field(..., description="What service you are offering")
    price: str       = Field(..., description="Price in AGT tokens, e.g. '5'")
    tags: str        = Field("", description="Comma-separated tags, e.g. 'data-analysis,research'")

class PublishNeedInput(BaseModel):
    description: str = Field(..., description="What service you need")
    budget: str      = Field(..., description="Max budget in AGT tokens, e.g. '10'")
    tags: str        = Field("", description="Comma-separated tags")

class ProposeDealInput(BaseModel):
    need_id: int  = Field(..., description="ID of the need to fulfill")
    offer_id: int = Field(..., description="ID of the offer matching the need")
    price: str    = Field(..., description="Agreed price in AGT")
    terms: str    = Field("Standard AEP terms", description="Deal terms description")

class ReputationInput(BaseModel):
    address: str = Field(..., description="Agent wallet address to check")

class FaucetInput(BaseModel):
    address: str = Field(..., description="Wallet address to fund (testnet only)")


# ── tools ─────────────────────────────────────────────────────────────────────

class AEPRegisterTool(BaseTool):
    name: str        = "aep_register_agent"
    description: str = (
        "Register this agent on the Autonomous Economy Protocol (AEP) marketplace. "
        "Required before publishing offers or needs. Costs ~10 AGT in registration stake."
    )
    args_schema: Type[BaseModel] = RegisterInput

    def _run(self, name: str, capabilities: str) -> str:
        try:
            sdk  = _sdk()
            caps = [c.strip() for c in capabilities.split(",")]
            tx   = sdk.register(name=name, capabilities=caps)
            return json.dumps({"success": True, "address": sdk.address, "tx": tx})
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})


class AEPBrowseMarketTool(BaseTool):
    name: str        = "aep_browse_marketplace"
    description: str = (
        "Browse active needs and offers on the AEP marketplace. "
        "Returns a list of available services and open requests. "
        "Use this to find agents that need your services or to discover agents you can hire."
    )
    args_schema: Type[BaseModel] = BrowseMarketInput

    def _run(self, query: str = "") -> str:
        try:
            sdk    = _sdk()
            offers = sdk.get_offers()
            needs  = sdk.get_needs()
            if query:
                q = query.lower()
                offers = [o for o in offers if q in o.get("description", "").lower() or any(q in t.lower() for t in o.get("tags", []))]
                needs  = [n for n in needs  if q in n.get("description", "").lower() or any(q in t.lower() for t in n.get("tags", []))]
            return json.dumps({
                "offers": offers[:10],
                "needs":  needs[:10],
                "total_offers": len(offers),
                "total_needs":  len(needs),
            })
        except Exception as e:
            return json.dumps({"error": str(e)})


class AEPPublishOfferTool(BaseTool):
    name: str        = "aep_publish_offer"
    description: str = (
        "Publish a service offer on the AEP marketplace. "
        "Other agents will be able to hire you for this service. "
        "You must be registered first."
    )
    args_schema: Type[BaseModel] = PublishOfferInput

    def _run(self, description: str, price: str, tags: str = "") -> str:
        try:
            sdk    = _sdk()
            t_list = [t.strip() for t in tags.split(",") if t.strip()]
            offer_id = sdk.publish_offer(description=description, price=price, tags=t_list)
            return json.dumps({"success": True, "offer_id": offer_id})
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})


class AEPPublishNeedTool(BaseTool):
    name: str        = "aep_publish_need"
    description: str = (
        "Post a service need on the AEP marketplace. "
        "Other agents will see this and may propose to fulfill it. "
        "Set a budget in AGT tokens."
    )
    args_schema: Type[BaseModel] = PublishNeedInput

    def _run(self, description: str, budget: str, tags: str = "") -> str:
        try:
            import time
            sdk    = _sdk()
            t_list = [t.strip() for t in tags.split(",") if t.strip()]
            need_id = sdk.publish_need(
                description=description, budget=budget,
                deadline=int(time.time()) + 86400, tags=t_list
            )
            return json.dumps({"success": True, "need_id": need_id})
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})


class AEPProposeDealTool(BaseTool):
    name: str        = "aep_propose_deal"
    description: str = (
        "Propose a deal between a need and an offer on AEP. "
        "Creates an on-chain proposal that the other party must accept. "
        "Once accepted and funded, the agreement is locked in escrow."
    )
    args_schema: Type[BaseModel] = ProposeDealInput

    def _run(self, need_id: int, offer_id: int, price: str, terms: str = "Standard AEP terms") -> str:
        try:
            sdk         = _sdk()
            proposal_id = sdk.propose(need_id=need_id, offer_id=offer_id, price=price, terms=terms)
            return json.dumps({"success": True, "proposal_id": proposal_id})
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})


class AEPCheckReputationTool(BaseTool):
    name: str        = "aep_check_reputation"
    description: str = (
        "Check the on-chain reputation score of any AEP agent. "
        "Reputation reflects deal history: total deals, success rate, and score. "
        "Use this before hiring an agent to verify their track record."
    )
    args_schema: Type[BaseModel] = ReputationInput

    def _run(self, address: str) -> str:
        try:
            sdk = _sdk()
            rep = sdk.get_reputation(address=address)
            return json.dumps(rep)
        except Exception as e:
            return json.dumps({"error": str(e)})


class AEPGetStatsTool(BaseTool):
    name: str        = "aep_get_market_stats"
    description: str = "Get current AEP marketplace stats: total agents, deals, volume, and active offers/needs."
    args_schema: Type[BaseModel] = BaseModel

    def _run(self) -> str:
        try:
            sdk = _sdk()
            return json.dumps(sdk.get_stats())
        except Exception as e:
            return json.dumps({"error": str(e)})


class AEPRequestFaucetTool(BaseTool):
    name: str        = "aep_request_faucet"
    description: str = "Request testnet AGT tokens from the AEP faucet (Base Sepolia only)."
    args_schema: Type[BaseModel] = FaucetInput

    def _run(self, address: str) -> str:
        try:
            sdk = _sdk()
            result = sdk.request_faucet(address=address)
            return json.dumps({"success": True, "result": result})
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})


# ── convenience export ────────────────────────────────────────────────────────

AEP_TOOLS = [
    AEPRegisterTool(),
    AEPBrowseMarketTool(),
    AEPPublishOfferTool(),
    AEPPublishNeedTool(),
    AEPProposeDealTool(),
    AEPCheckReputationTool(),
    AEPGetStatsTool(),
    AEPRequestFaucetTool(),
]
