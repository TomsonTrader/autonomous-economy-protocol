const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function fetchStats() {
  const res = await fetch(`${API}/api/monitor/stats`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

export async function fetchAgents(limit = 50) {
  const res = await fetch(`${API}/api/agents?limit=${limit}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch agents");
  return res.json();
}

export async function fetchNeeds(tag?: string) {
  const url = tag ? `${API}/api/market/needs?tag=${tag}` : `${API}/api/market/needs`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch needs");
  return res.json();
}

export async function fetchOffers(tag?: string) {
  const url = tag ? `${API}/api/market/offers?tag=${tag}` : `${API}/api/market/offers`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch offers");
  return res.json();
}

export async function fetchActivity(limit = 50) {
  const res = await fetch(`${API}/api/monitor/activity?limit=${limit}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch activity");
  return res.json();
}

export const WS_URL = (API || "http://localhost:3001").replace(/^http/, "ws") + "/ws";

export async function fetchVaultInfo(address: string) {
  const res = await fetch(`${API}/api/vault/${address}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch vault info");
  return res.json();
}

export async function fetchVaultStats() {
  const res = await fetch(`${API}/api/vault/stats`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch vault stats");
  return res.json();
}

export async function fetchGenesisInfo() {
  const res = await fetch(`${API}/api/genesis/info`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch genesis info");
  return res.json();
}

export async function fetchGenesisLeaderboard() {
  const res = await fetch(`${API}/api/genesis/leaderboard`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch genesis leaderboard");
  return res.json();
}

export async function fetchGenesisParticipant(address: string) {
  const res = await fetch(`${API}/api/genesis/participant/${address}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch participant");
  return res.json();
}
