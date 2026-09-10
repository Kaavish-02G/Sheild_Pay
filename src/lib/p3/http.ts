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

export async function fetchJson(
  url: string,
  init?: RequestInit
): Promise<{ ok: true; data: unknown } | { ok: false; status: number; error: string }> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(process.env.SHIELDPAY_INTERNAL_TOKEN ? { Authorization: `Bearer ${process.env.SHIELDPAY_INTERNAL_TOKEN}` } : process.env.SHIELDPAY_ADMIN_PASSWORD ? { Authorization: `Basic ${Buffer.from("admin:" + process.env.SHIELDPAY_ADMIN_PASSWORD).toString("base64")}` } : {}),
        ...init?.headers,
      },
    });
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      const message =
        typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
          ? (data as { error: string }).error
          : `HTTP ${res.status}`;
      return { ok: false, status: res.status, error: message };
    }
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
