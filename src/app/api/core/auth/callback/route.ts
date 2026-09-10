import { NextRequest, NextResponse } from "next/server";
import { upsertMerchant } from "@/lib/core/models";
import { exchangeOAuthCode, normalizeShop, verifyOAuthHmac } from "@/lib/adapters/shopify/oauth";

export const dynamic = "force-dynamic";

/** OAuth callback — GET /api/core/auth/callback?code=...&shop=...&hmac=... */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const shop = normalizeShop(params.get("shop") ?? "");
  const code = params.get("code");

  if (!shop || !code) {
    return NextResponse.json({ error: "Missing shop or code parameter" }, { status: 400 });
  }

  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: "Shopify credentials not configured" }, { status: 500 });
  }

  if (!verifyOAuthHmac(params, apiSecret)) {
    return NextResponse.json({ error: "Invalid OAuth HMAC" }, { status: 401 });
  }

  const state = params.get('state');
  if (!state || state !== request.cookies.get('shieldpay-oauth-state')?.value) return NextResponse.json({ error: 'Invalid OAuth state' }, { status: 401 });
  try {
    const accessToken = await exchangeOAuthCode(shop, code, apiKey, apiSecret);
    const merchant = await upsertMerchant(shop, accessToken);
    const response = NextResponse.json({
      success: true,
      shop,
      merchantId: merchant._id.toString(),
      message: "OAuth complete — merchant connected",
    });
    response.cookies.delete("shieldpay-oauth-state");
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Token exchange failed" },
      { status: 401 }
    );
  }
}
