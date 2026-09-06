import { NextRequest, NextResponse } from "next/server";
import { shopifyAdapter } from "@/lib/adapters/shopify";

export const dynamic = "force-dynamic";

/** Exchange Shopify session token (CLI dev / embedded app) — POST /api/core/auth/session */
export async function POST(request: NextRequest) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const body = await request.json().catch(() => ({}));
  const sessionToken = bearer || (body as { sessionToken?: string }).sessionToken;

  if (!sessionToken) {
    return NextResponse.json({ error: "Missing session token" }, { status: 401 });
  }

  const result = await shopifyAdapter.authenticate(sessionToken);
  if (!result.success) {
    return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
  }

  return NextResponse.json({ success: true, accessToken: result.accessToken });
}
