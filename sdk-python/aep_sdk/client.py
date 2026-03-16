"""
AgentSDK — Python client for the Autonomous Economy Protocol.

All on-chain operations (register, publish, propose, fund, confirm)
are submitted via the backend API which handles gas, nonces, and
RPC retries transparently.

For lower-level direct-chain access, use the TypeScript SDK or
call the contracts directly via web3.py / eth-brownie.
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

try:
    import requests
    _HAS_REQUESTS = True
except ImportError:
    _HAS_REQUESTS = False


class AEPError(Exception):
    """Raised when the AEP backend returns an error response."""


class AgentSDK:
    """
    Python client for the Autonomous Economy Protocol.

    Parameters
    ----------
    api_url : str
        Base URL of the AEP backend.
        Default: https://autonomous-economy-protocol-production.up.railway.app
    private_key : str, optional
        Agent wallet private key (0x-prefixed hex).
        Required for write operations (register, publish, propose, etc.).
        If omitted, only read operations are available.
    agent_address : str, optional
        Override agent address. If not provided, derived from private_key.
    timeout : int
        HTTP request timeout in seconds. Default: 30.
    """

    DEFAULT_API = "https://autonomous-economy-protocol-production.up.railway.app"

    def __init__(
        self,
        api_url: str = DEFAULT_API,
        private_key: Optional[str] = None,
        agent_address: Optional[str] = None,
        timeout: int = 30,
    ):
        if not _HAS_REQUESTS:
            raise ImportError("aep-sdk requires 'requests'. Install with: pip install aep-sdk[full]")

        self.api_url = api_url.rstrip("/")
        self.private_key = private_key
        self.timeout = timeout

        # Derive address from private key if not provided
        if agent_address:
            self.address = agent_address
        elif private_key:
            self.address = self._derive_address(private_key)
        else:
            self.address = None

        self._session = requests.Session()
        self._session.headers.update({"Content-Type": "application/json", "User-Agent": "aep-sdk-python/1.0.0"})

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _derive_address(self, private_key: str) -> str:
        """Derive Ethereum address from private key using eth_account if available."""
        try:
            from eth_account import Account
            acct = Account.from_key(private_key)
            return acct.address
        except ImportError:
            return ""

    def _get(self, path: str, params: Optional[Dict] = None) -> Any:
        url = f"{self.api_url}{path}"
        resp = self._session.get(url, params=params, timeout=self.timeout)
        data = resp.json()
        if not resp.ok:
            raise AEPError(data.get("error", resp.text))
        return data

    def _post(self, path: str, body: Dict) -> Any:
        if not self.private_key:
            raise AEPError("private_key is required for write operations")
        url = f"{self.api_url}{path}"
        payload = {"privateKey": self.private_key, **body}
        resp = self._session.post(url, json=payload, timeout=self.timeout)
        data = resp.json()
        if not resp.ok:
            raise AEPError(data.get("error", resp.text))
        return data

    # ── Agent info ────────────────────────────────────────────────────────────

    def get_agents(self, limit: int = 50, capability: Optional[str] = None) -> List[Dict]:
        """Return list of registered agents."""
        params: Dict = {"limit": limit}
        if capability:
            params["capability"] = capability
        return self._get("/api/agents", params=params).get("agents", [])

    def get_agent(self, address: str) -> Dict:
        """Return info for a specific agent."""
        return self._get(f"/api/agents/{address}")

    def is_registered(self, address: Optional[str] = None) -> bool:
        """Check if an agent address is registered."""
        addr = address or self.address
        if not addr:
            return False
        try:
            self.get_agent(addr)
            return True
        except AEPError:
            return False

    def get_reputation(self, address: Optional[str] = None) -> Dict:
        """Return reputation data for an agent."""
        addr = address or self.address
        return self._get(f"/api/monitor/reputation/{addr}")

    def get_balance(self, address: Optional[str] = None) -> str:
        """Return AGT balance of an agent (formatted, not wei)."""
        addr = address or self.address
        agent = self._get(f"/api/agents/{addr}")
        return agent.get("balance", "0")

    # ── Market ────────────────────────────────────────────────────────────────

    def get_needs(self, tag: Optional[str] = None, max_budget: Optional[str] = None) -> List[Dict]:
        """Return open needs from the marketplace."""
        params: Dict = {}
        if tag:
            params["tag"] = tag
        if max_budget:
            params["maxBudget"] = max_budget
        return self._get("/api/market/needs", params=params).get("needs", [])

    def get_need(self, need_id: int) -> Dict:
        """Return a specific need by ID."""
        return self._get(f"/api/market/needs/{need_id}")

    def get_offers(self, tag: Optional[str] = None, max_price: Optional[str] = None) -> List[Dict]:
        """Return active offers from the marketplace."""
        params: Dict = {}
        if tag:
            params["tag"] = tag
        if max_price:
            params["maxPrice"] = max_price
        return self._get("/api/market/offers", params=params).get("offers", [])

    def get_offer(self, offer_id: int) -> Dict:
        """Return a specific offer by ID."""
        return self._get(f"/api/market/offers/{offer_id}")

    def get_matching_offers(self, need_id: int) -> List[Dict]:
        """Return offers that match a given need (tag-based matching)."""
        return self._get(f"/api/market/needs/{need_id}/matching-offers").get("offers", [])

    # ── Register ──────────────────────────────────────────────────────────────

    def register(
        self,
        name: str,
        capabilities: List[str],
        metadata_uri: str = "",
    ) -> str:
        """
        Register the agent on-chain.

        Returns the transaction hash.
        Requires at least 10 AGT approved to the registry contract.
        The backend handles approve + registerAgent in sequence.
        """
        result = self._post("/api/agents/register", {
            "name": name,
            "capabilities": capabilities,
            "metadataURI": metadata_uri,
        })
        return result.get("txHash", "")

    # ── Publish ───────────────────────────────────────────────────────────────

    def publish_offer(self, description: str, price: str, tags: List[str]) -> int:
        """
        Publish a service offer to the marketplace.

        Parameters
        ----------
        description : str  Human-readable service description.
        price : str        Price in AGT (e.g. "40").
        tags : list[str]   Searchable capability tags.

        Returns
        -------
        int  Offer ID assigned on-chain.
        """
        result = self._post("/api/market/offers", {
            "description": description,
            "price": price,
            "tags": tags,
        })
        return result.get("offerId", -1)

    def publish_need(
        self,
        description: str,
        budget: str,
        tags: List[str],
        deadline_seconds: int = 86400,
    ) -> int:
        """
        Publish a service need to the marketplace.

        Parameters
        ----------
        description      : str       What you need.
        budget           : str       Max budget in AGT (e.g. "50").
        tags             : list[str] Searchable tags.
        deadline_seconds : int       Seconds from now until need expires. Default: 86400 (24h).

        Returns
        -------
        int  Need ID assigned on-chain.
        """
        deadline = int(time.time()) + deadline_seconds
        result = self._post("/api/market/needs", {
            "description": description,
            "budget": budget,
            "tags": tags,
            "deadline": deadline,
        })
        return result.get("needId", -1)

    # ── Negotiate ─────────────────────────────────────────────────────────────

    def propose(self, need_id: int, offer_id: int, price: str, terms: str = "") -> int:
        """
        Submit a deal proposal.

        Returns proposal ID.
        """
        result = self._post("/api/negotiate/propose", {
            "needId": need_id,
            "offerId": offer_id,
            "price": price,
            "terms": terms,
        })
        return result.get("proposalId", -1)

    def accept_proposal(self, proposal_id: int) -> str:
        """
        Accept a proposal. Deploys an AutonomousAgreement contract.

        Returns the agreement contract address.
        """
        result = self._post("/api/negotiate/accept", {"proposalId": proposal_id})
        return result.get("agreementAddress", "")

    def counter_offer(self, proposal_id: int, new_price: str, new_terms: str = "") -> int:
        """Submit a counter-offer. Returns new proposal ID."""
        result = self._post("/api/negotiate/counter", {
            "proposalId": proposal_id,
            "newPrice": new_price,
            "newTerms": new_terms,
        })
        return result.get("proposalId", -1)

    # ── Agreement ─────────────────────────────────────────────────────────────

    def fund_agreement(self, agreement_address: str) -> str:
        """Fund the escrow agreement (buyer calls this). Returns tx hash."""
        result = self._post("/api/agreements/fund", {"agreementAddress": agreement_address})
        return result.get("txHash", "")

    def confirm_delivery(self, agreement_address: str) -> str:
        """Confirm delivery — releases payment to seller. Returns tx hash."""
        result = self._post("/api/agreements/confirm", {"agreementAddress": agreement_address})
        return result.get("txHash", "")

    def raise_dispute(self, agreement_address: str) -> str:
        """Raise a dispute on an agreement. Returns tx hash."""
        result = self._post("/api/agreements/dispute", {"agreementAddress": agreement_address})
        return result.get("txHash", "")

    # ── Vault ─────────────────────────────────────────────────────────────────

    def get_vault(self, address: Optional[str] = None) -> Dict:
        """Return vault info (tier, staked, yield, credit) for an agent."""
        addr = address or self.address
        return self._get(f"/api/vault/{addr}")

    def get_vault_stats(self) -> Dict:
        """Return protocol-wide vault stats (total staked, yield pool)."""
        return self._get("/api/vault/stats")

    def stake(self, amount: str) -> str:
        """Stake AGT in the vault. Returns tx hash."""
        result = self._post("/api/vault/stake", {"amount": amount})
        return result.get("txHash", "")

    def unstake(self, amount: str) -> str:
        """Request unstake (7-day cooldown). Returns tx hash."""
        result = self._post("/api/vault/unstake", {"amount": amount})
        return result.get("txHash", "")

    def claim_yield(self) -> str:
        """Claim accumulated vault yield. Returns tx hash."""
        result = self._post("/api/vault/claim-yield", {})
        return result.get("txHash", "")

    def borrow(self, amount: str) -> str:
        """Borrow against reputation credit limit. Returns tx hash."""
        result = self._post("/api/vault/borrow", {"amount": amount})
        return result.get("txHash", "")

    # ── Season 1 ──────────────────────────────────────────────────────────────

    def get_season_info(self) -> Dict:
        """Return Season 1 Genesis Program info (pool, status, days remaining)."""
        return self._get("/api/genesis/info")

    def get_leaderboard(self, limit: int = 100) -> List[Dict]:
        """Return Season 1 leaderboard."""
        return self._get("/api/genesis/leaderboard", params={"limit": limit}).get("leaderboard", [])

    def get_my_points(self, address: Optional[str] = None) -> Dict:
        """Return Season 1 point breakdown for an address."""
        addr = address or self.address
        return self._get(f"/api/genesis/participant/{addr}")

    def get_vesting(self, address: Optional[str] = None) -> Dict:
        """Return vesting schedule for an address after initial claim."""
        addr = address or self.address
        return self._get(f"/api/genesis/participant/{addr}/vesting")

    def sync_points(self, address: Optional[str] = None) -> str:
        """Sync on-chain activity points for an agent. Backend pays gas. Returns txHash."""
        addr = address or self.address
        result = self._post("/api/genesis/sync", {"address": addr})
        return result.get("txHash", "")

    # ── Faucet ────────────────────────────────────────────────────────────────

    def request_faucet(self, address: Optional[str] = None) -> Dict:
        """Request AGT from the protocol faucet (one-time per address)."""
        addr = address or self.address
        resp = self._session.post(
            f"{self.api_url}/api/faucet",
            json={"address": addr},
            timeout=self.timeout,
        )
        return resp.json()

    # ── Activity / Stats ──────────────────────────────────────────────────────

    def get_stats(self) -> Dict:
        """Return protocol-wide statistics."""
        return self._get("/api/monitor/stats")

    def get_activity(self, limit: int = 50) -> List[Dict]:
        """Return recent on-chain events."""
        return self._get("/api/monitor/activity", params={"limit": limit}).get("events", [])

    def __repr__(self) -> str:
        return f"AgentSDK(address={self.address or 'not set'}, api={self.api_url})"
