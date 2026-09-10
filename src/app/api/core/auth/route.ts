import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { buildInstallUrl, normalizeShop } from "@/lib/adapters/shopify/oauth";

export const dynamic = "force-dynamic";

/** Start Shopify OAuth install — GET /api/core/auth?shop=your-store.myshopify.com */
export async function GET(request: NextRequest) {
  const rawShop = request.nextUrl.searchParams.get("shop");
  if (!rawShop) {
    return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
  }

  const shop = normalizeShop(rawShop);
  if (!shop) {
    return NextResponse.json({ error: "Invalid shop domain" }, { status: 400 });
  }

  const apiKey = process.env.SHOPIFY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "SHOPIFY_API_KEY not configured" }, { status: 500 });
  }

  const state = randomBytes(24).toString('hex');
  const url = new URL(buildInstallUrl(shop, apiKey)); url.searchParams.set('state', state);
  const response = NextResponse.redirect(url); response.cookies.set('shieldpay-oauth-state', state, { httpOnly: true, sameSite: 'lax', secure: request.nextUrl.protocol === 'https:', maxAge: 600, path: '/api/core/auth' }); return response;
}
