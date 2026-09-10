/** Base URL for calling P1 (and other module) HTTP routes from server-side P2 code. */
export function getBaseUrl(): string {
  if (process.env.SHIELDPAY_APP_URL) {
    return process.env.SHIELDPAY_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  const port = process.env.PORT ?? "3000";
  return `http://localhost:${port}`;
}

export async function fetchP1<T>(
  path: string,
  label: string
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${getBaseUrl()}${path}`, { cache: "no-store", headers: process.env.SHIELDPAY_INTERNAL_TOKEN ? { Authorization: `Bearer ${process.env.SHIELDPAY_INTERNAL_TOKEN}` } : process.env.SHIELDPAY_ADMIN_PASSWORD ? { Authorization: `Basic ${Buffer.from("admin:" + process.env.SHIELDPAY_ADMIN_PASSWORD).toString("base64")}` } : {}, signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      return { ok: false, error: `${label} returned ${res.status}` };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
