"use client";

import { useEffect, useState } from "react";
import { fetchNeeds, fetchOffers } from "../../lib/api";

interface Need {
  id: number;
  publisher: string;
  description: string;
  budget: string;
  deadline: number;
  tags: string[];
  active: boolean;
}

interface Offer {
  id: number;
  publisher: string;
  description: string;
  price: string;
  tags: string[];
  active: boolean;
}

function TagBadge({ tag }: { tag: string }) {
  return (
    <span
      style={{
        background: "#f59e0b22",
        color: "#f59e0b",
        padding: "2px 8px",
        borderRadius: 12,
        fontSize: 11,
      }}
    >
      {tag}
    </span>
  );
}

export default function MarketPage() {
  const [needs, setNeeds] = useState<Need[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [view, setView] = useState<"needs" | "offers">("needs");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchNeeds(), fetchOffers()])
      .then(([n, o]) => {
        setNeeds(n.needs || []);
        setOffers(o.offers || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const activeNeeds = needs.filter((n) => n.active);
  const activeOffers = offers.filter((o) => o.active);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Marketplace</h1>
        <div style={{ display: "flex", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
          {(["needs", "offers"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setView(tab)}
              style={{
                padding: "6px 16px",
                background: view === tab ? "var(--accent)" : "transparent",
                color: view === tab ? "#fff" : "var(--muted)",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {tab === "needs" ? `📢 Needs (${activeNeeds.length})` : `🏷️ Offers (${activeOffers.length})`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ color: "var(--muted)" }}>Loading market...</div>
      ) : view === "needs" ? (
        activeNeeds.length === 0 ? (
          <div style={{ color: "var(--muted)" }}>No active needs. Run the simulation to populate the market.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {activeNeeds.map((need) => (
              <div
                key={need.id}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: 16,
                  display: "flex",
                  gap: 16,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    background: "#f59e0b22",
                    color: "#f59e0b",
                    borderRadius: 6,
                    padding: "4px 10px",
                    fontSize: 22,
                    minWidth: 48,
                    textAlign: "center",
                  }}
                >
                  #{need.id}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>{need.description}</div>
                  <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 8, fontFamily: "monospace" }}>
                    by {need.publisher.slice(0, 12)}...
                    · deadline: {new Date(need.deadline * 1000).toLocaleDateString()}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {need.tags.map((t) => <TagBadge key={t} tag={t} />)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "#10b981", fontWeight: 700, fontSize: 18 }}>
                    {parseFloat(need.budget).toFixed(0)} AGT
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: 11 }}>max budget</div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : activeOffers.length === 0 ? (
        <div style={{ color: "var(--muted)" }}>No active offers. Run the simulation to populate the market.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {activeOffers.map((offer) => (
            <div
              key={offer.id}
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 16,
                display: "flex",
                gap: 16,
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  background: "#0ea5e922",
                  color: "#0ea5e9",
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: 22,
                  minWidth: 48,
                  textAlign: "center",
                }}
              >
                #{offer.id}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{offer.description}</div>
                <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 8, fontFamily: "monospace" }}>
                  by {offer.publisher.slice(0, 12)}...
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {offer.tags.map((t) => <TagBadge key={t} tag={t} />)}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "var(--accent)", fontWeight: 700, fontSize: 18 }}>
                  {parseFloat(offer.price).toFixed(0)} AGT
                </div>
                <div style={{ color: "var(--muted)", fontSize: 11 }}>asking price</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
