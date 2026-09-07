import catalog from "@/shared/shop/catalog.json";

const DEFAULT_URL = process.env.MOCK_COMMERCE_URL ?? "http://localhost:4010";
const API_KEY = process.env.MOCK_COMMERCE_API_KEY ?? "mock-commerce-key";

export type ShopProduct = (typeof catalog.products)[number];

async function commerceFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${DEFAULT_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

export async function listShopProducts(options?: {
  collection?: string;
  q?: string;
  sort?: string;
}): Promise<ShopProduct[]> {
  const params = new URLSearchParams();
  if (options?.collection) params.set("collection", options.collection);
  if (options?.q) params.set("q", options.q);
  if (options?.sort) params.set("sort", options.sort);
  const qs = params.toString();
  try {
    const res = await commerceFetch(`/products${qs ? `?${qs}` : ""}`);
    if (res.ok) {
      const data = (await res.json()) as { products: ShopProduct[] };
      return data.products;
    }
  } catch {
    // local catalog
  }
  let list = catalog.products as ShopProduct[];
  if (options?.collection && options.collection !== "all") {
    list = list.filter((p) => p.category === options.collection);
  }
  const q = (options?.q ?? "").toLowerCase();
  if (q) {
    list = list.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some((t) => t.includes(q))
    );
  }
  if (options?.sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
  if (options?.sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
  if (options?.sort === "rating") list = [...list].sort((a, b) => b.rating - a.rating);
  return list;
}

export async function getShopProduct(idOrHandle: string): Promise<ShopProduct | null> {
  try {
    const res = await commerceFetch(`/products/${encodeURIComponent(idOrHandle)}`);
    if (res.ok) {
      const data = (await res.json()) as { product: ShopProduct };
      return data.product;
    }
  } catch {
    // local catalog
  }
  return (
    catalog.products.find((p) => p.id === idOrHandle || p.handle === idOrHandle) ?? null
  );
}

export async function checkoutShopOrder(payload: Record<string, unknown>) {
  const res = await commerceFetch("/checkout", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? `Checkout failed (${res.status})`);
  }
  return data as { success: boolean; order: Record<string, unknown> };
}

export async function getShopOrder(orderId: string) {
  const res = await commerceFetch(`/orders/${encodeURIComponent(orderId)}`);
  if (!res.ok) return null;
  return res.json() as Promise<Record<string, unknown>>;
}

export async function listShopOrders(email?: string) {
  const qs = email ? `?email=${encodeURIComponent(email)}` : "";
  const res = await commerceFetch(`/orders${qs}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { orders: Record<string, unknown>[] };
  return data.orders;
}

export async function fileShopDispute(input: {
  orderId: string;
  reason: string;
  merchantId?: string;
}) {
  const res = await commerceFetch("/disputes", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? `Dispute filing failed (${res.status})`);
  }
  return data as {
    success: boolean;
    disputeId: string;
    orderId: string;
    shieldpayStatus: number;
  };
}

export function productSwatch(image: string): { bg: string; ink: string } {
  const map: Record<string, { bg: string; ink: string }> = {
    sweater: { bg: "#fde68a", ink: "#451a03" },
    shirt: { bg: "#e0f2fe", ink: "#0c4a6e" },
    denim: { bg: "#dbeafe", ink: "#1e3a8a" },
    throw: { bg: "#e7e5e4", ink: "#44403c" },
    pourer: { bg: "#e5e5e5", ink: "#262626" },
    tray: { bg: "#ffedd5", ink: "#7c2d12" },
    buds: { bg: "#e4e4e7", ink: "#27272a" },
    lamp: { bg: "#fef9c3", ink: "#713f12" },
    wallet: { bg: "#fde68a", ink: "#451a03" },
    tote: { bg: "#d1fae5", ink: "#064e3b" },
    beanie: { bg: "#e2e8f0", ink: "#1e293b" },
    pack: { bg: "#d4d4d4", ink: "#171717" },
  };
  return map[image] ?? { bg: "#e7e5e4", ink: "#44403c" };
}
