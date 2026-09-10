import { shopifyAdapter } from "@/lib/adapters/shopify";
import { mockCommerceAdapter, useMockCommerce } from "@/lib/adapters/mock-commerce";
import type { PlatformAdapter } from "@/shared/schemas";
import { getMerchant, getMerchantByShopDomain } from "@/lib/core/models";

export async function getAdapterForMerchant(
  merchantId: string
): Promise<PlatformAdapter> {
  const merchant =
    (await getMerchant(merchantId)) ??
    (await getMerchantByShopDomain(merchantId));

  if (merchant?.platform === "mock_commerce" || useMockCommerce()) {
    return mockCommerceAdapter;
  }

  return shopifyAdapter;
}

export async function resolveMerchantPlatform(
  merchantId: string
): Promise<"shopify" | "mock_commerce"> {
  if (useMockCommerce()) {
    return "mock_commerce";
  }
  const merchant =
    (await getMerchant(merchantId)) ??
    (await getMerchantByShopDomain(merchantId));
  return merchant?.platform === "mock_commerce" ? "mock_commerce" : "shopify";
}
