import { NextRequest, NextResponse } from "next/server";
import { getMerchantByShopDomain } from "@/lib/core/models";
import { normalizeShop } from "@/lib/adapters/shopify/oauth";

export const dynamic = "force-dynamic";

/** Check merchant OAuth status — GET /api/core/auth/status?shop=your-store.myshopify.com */
export async function GET(request: NextRequest) {
  const rawShop =
    request.nextUrl.searchParams.get("shop") ??
    process.env.SHOPIFY_DEV_STORE;

  if (!rawShop) {
    return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
  }

  const shop = normalizeShop(rawShop);
  if (!shop) {
    return NextResponse.json({ error: "Invalid shop domain" }, { status: 400 });
  }

  const merchant = await getMerchantByShopDomain(shop);
  return NextResponse.json({
    shop,
    connected: Boolean(merchant?.accessToken),
    merchantId: merchant?._id?.toString() ?? null,
  });
}
