import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://aepprotocol.xyz";
  const now = new Date();

  return [
    { url: base,                  lastModified: now, changeFrequency: "daily",   priority: 1.0 },
    { url: `${base}/whitepaper`,  lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/season1`,     lastModified: now, changeFrequency: "daily",   priority: 0.9 },
    { url: `${base}/launch`,      lastModified: now, changeFrequency: "weekly",  priority: 0.8 },
    { url: `${base}/dashboard`,   lastModified: now, changeFrequency: "daily",   priority: 0.8 },
    { url: `${base}/activity`,    lastModified: now, changeFrequency: "hourly",  priority: 0.7 },
    { url: `${base}/vault`,       lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${base}/refer`,       lastModified: now, changeFrequency: "weekly",  priority: 0.6 },
    { url: `${base}/token`,       lastModified: now, changeFrequency: "hourly",  priority: 0.9 },
  ];
}
