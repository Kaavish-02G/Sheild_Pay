import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { shopifyAdapter } from "@/lib/adapters/shopify";
import { handleDisputeEvent } from "@/lib/core/orchestrator";
import { fetchOrderForSimulate } from "@/lib/core/order-service";
import { getMerchantByShopDomain, cacheOrder, upsertMerchant } from "@/lib/core/models";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const SimulateDisputeSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().min(1),
  amount: z.number().positive(),
});

async function resolveMerchant(shopDomain: string) {
  let merchant = await getMerchantByShopDomain(shopDomain);
  if (merchant) {
    return merchant;
  }

  if (process.env.SHOPIFY_MOCK_MODE === "true" || process.env.NODE_ENV === "test") {
    merchant = await upsertMerchant(shopDomain, "mock-token");
    return merchant;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = SimulateDisputeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { orderId, reason, amount } = parsed.data;

    const shopDomain =
      request.headers.get("x-shopify-shop-domain") ??
      process.env.SHOPIFY_DEV_STORE ??
      "demo-merchant.myshopify.com";

    const merchant = await resolveMerchant(shopDomain);
    if (!merchant) {
      return NextResponse.json(
        { error: `No merchant found for ${shopDomain} — run shopify app dev and authenticate first` },
        { status: 404 }
      );
    }

    shopifyAdapter.setShopContext(merchant.shopDomain, merchant.accessToken);

    const order = await fetchOrderForSimulate(orderId);

    await cacheOrder({
      orderId: order.orderId,
      merchantId: merchant._id.toString(),
      customerId: order.customerId,
      items: order.items,
      totalAmount: order.totalAmount,
      currency: order.currency,
      createdAt: order.createdAt,
    });

    const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const event = {
      disputeId: `sim-${randomUUID()}`,
      orderId: order.orderId,
      merchantId: merchant._id.toString(),
      reason,
      amount,
      currency: order.currency,
      deadline,
      platform: "shopify" as const,
    };

    await handleDisputeEvent(event);

    return NextResponse.json({
      success: true,
      disputeId: event.disputeId,
      orderId: event.orderId,
      message: "Simulated dispute created and investigation started",
    });
  } catch (error) {
    console.error("[simulate-dispute] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to simulate dispute" },
      { status: 500 }
    );
  }
}
