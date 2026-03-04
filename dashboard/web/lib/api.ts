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
