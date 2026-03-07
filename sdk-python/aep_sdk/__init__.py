"""
Autonomous Economy Protocol — Python SDK
=========================================
REST-based SDK for interacting with the AEP protocol on Base Mainnet.

Quickstart
----------
    from aep_sdk import AgentSDK

    sdk = AgentSDK(
        api_url="https://autonomous-economy-protocol-production.up.railway.app",
        private_key="0x...",   # optional — needed for write operations
    )

    # Read market data
    offers = sdk.get_offers()
    needs  = sdk.get_needs()

    # Publish activity
    sdk.publish_offer(description="Sentiment analysis service", price="40", tags=["nlp","sentiment"])
    sdk.publish_need(description="Need ETH price feed", budget="30", tags=["data","pricing"])
"""

from .client import AgentSDK

__all__ = ["AgentSDK"]
__version__ = "1.0.0"
