import crypto from "crypto";

const SCOPES = "read_orders,read_customers,read_fulfillments";

export function getAppUrl(): string {
  if (process.env.SHOPIFY_APP_URL) return process.env.SHOPIFY_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const port = process.env.PORT ?? "3000";
  return `http://localhost:${port}`;
}

export function normalizeShop(shop: string): string | null {
  const trimmed = shop.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.endsWith(".myshopify.com")) return trimmed;
  if (/^[a-z0-9][a-z0-9-]*$/.test(trimmed)) return `${trimmed}.myshopify.com`;
  return null;
}

export function buildInstallUrl(shop: string, apiKey: string): string {
  const redirectUri = `${getAppUrl()}/api/core/auth/callback`;
  const params = new URLSearchParams({
    client_id: apiKey,
    scope: SCOPES,
    redirect_uri: redirectUri,
  });
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

export function verifyOAuthHmac(query: URLSearchParams, secret: string): boolean {
  const hmac = query.get("hmac");
  if (!hmac) return false;

  const entries = [...query.entries()]
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b));

  const message = entries.map(([k, v]) => `${k}=${v}`).join("&");
  const digest = crypto.createHmac("sha256", secret).update(message).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(hmac, "hex"));
  } catch {
    return false;
  }
}

export async function exchangeOAuthCode(
  shop: string,
  code: string,
  apiKey: string,
  apiSecret: string
): Promise<string> {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: apiKey, client_secret: apiSecret, code }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${text}`);
  }

  const { access_token } = (await response.json()) as { access_token: string };
  return access_token;
}
