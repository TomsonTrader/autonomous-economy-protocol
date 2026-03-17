import * as crypto from "crypto";

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * Signs a webhook payload with HMAC-SHA256 so the receiver can verify authenticity.
 * The signature is included as the `X-AEP-Signature` header.
 *
 * Format: `sha256=<hex_digest>`  (same convention as GitHub webhooks)
 */
function signPayload(body: string, secret: string): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(body);
  return `sha256=${hmac.digest("hex")}`;
}

/**
 * Sends a single HTTP POST webhook to a target URL.
 *
 * @param url      - The receiver's callback URL
 * @param secret   - HMAC secret shared at subscription time
 * @param payload  - Structured event payload
 * @param timeout  - Request timeout in ms (default 8s)
 * @returns true if the receiver returned 2xx, false otherwise
 */
export async function sendWebhook(
  url: string,
  secret: string,
  payload: WebhookPayload,
  timeout = 8_000
): Promise<boolean> {
  const body = JSON.stringify(payload);
  const signature = signPayload(body, secret);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "AEP-Webhook/1.0",
        "X-AEP-Signature": signature,
        "X-AEP-Event": payload.event,
        "X-AEP-Timestamp": payload.timestamp,
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timer);
    return res.ok;
  } catch (err: any) {
    // Network error, timeout, or invalid URL — non-fatal
    console.warn(`[Webhook] Failed to deliver to ${url}: ${err.message}`);
    return false;
  }
}

/**
 * Fans out a webhook event to multiple subscribers.
 * Delivers concurrently; individual failures don't block others.
 *
 * @param subscribers - List of { url, secret } pairs
 * @param payload     - Event to deliver
 * @returns Array of results per subscriber
 */
export async function fanoutWebhooks(
  subscribers: Array<{ url: string; secret: string }>,
  payload: WebhookPayload
): Promise<Array<{ url: string; success: boolean }>> {
  if (subscribers.length === 0) return [];

  const results = await Promise.allSettled(
    subscribers.map(sub => sendWebhook(sub.url, sub.secret, payload))
  );

  return subscribers.map((sub, i) => ({
    url: sub.url,
    success: results[i].status === "fulfilled" && (results[i] as PromiseFulfilledResult<boolean>).value,
  }));
}
