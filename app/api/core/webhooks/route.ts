import { NextRequest, NextResponse } from "next/server";
import { shopifyAdapter } from "@/lib/adapters/shopify";
import { handleDisputeEvent } from "@/lib/core/orchestrator";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-shopify-hmac-sha256") ?? "";

    if (!signature) {
      return NextResponse.json({ error: "Missing HMAC signature" }, { status: 401 });
    }

    const topic = request.headers.get("x-shopify-topic") ?? "";
    const shop = request.headers.get("x-shopify-shop-domain") ?? "";

    if (shop) {
      shopifyAdapter.setShopContext(shop);
    }

    shopifyAdapter.setWebhookTopic(topic);

    const event = await shopifyAdapter.onWebhook(rawBody, signature);

    if (event) {
      await handleDisputeEvent(event);
      return NextResponse.json({ received: true, disputeId: event.disputeId });
    }

    return NextResponse.json({ received: true, dispute: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";

    if (message.includes("HMAC") || message.includes("signature")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    console.error("[webhooks] Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
