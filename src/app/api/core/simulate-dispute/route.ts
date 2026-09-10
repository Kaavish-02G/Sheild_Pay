import { POST as simulateLocal } from '@/app/api/workspace/route';
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { shopifyAdapter } from "@/lib/adapters/shopify";
import { handleDisputeEvent } from "@/lib/core/orchestrator";
import { fetchOrderForSimulate } from "@/lib/core/order-service";
import { buildDisputeEvent } from "@/lib/core/pg-ingest";
import { getMerchantByShopDomain, cacheOrder, upsertMerchant, upsertMockMerchant } from "@/lib/core/models";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const SimulateDisputeSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().min(1),
  amount: z.number().positive().optional(),
});

async function resolveMerchant(shopDomain: string) {
  if (process.env.MOCK_COMMERCE_MODE === "true" || process.env.PLATFORM_MOCK_MODE === "true") {
    return upsertMockMerchant(shopDomain);
  }

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

    const { orderId, reason } = parsed.data;
    if (process.env.SHIELDPAY_DEMO_MODE !== 'false' && process.env.MOCK_COMMERCE_MODE !== 'true' && process.env.PLATFORM_MOCK_MODE !== 'true' && process.env.SHOPIFY_MOCK_MODE !== 'true') {
      const normalized = reason.toLowerCase().includes('duplicate') ? 'Duplicate charge' : reason.toLowerCase().includes('described') || reason.toLowerCase().includes('unacceptable') ? 'Item not as described' : reason.toLowerCase().includes('receive') ? 'Item not received' : 'Other';
      return simulateLocal(new NextRequest(request.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: normalized, orderId: orderId.startsWith('NL-') ? orderId : undefined }) }));
    }

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
    const amount = order.totalAmount;

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

    const event = buildDisputeEvent({
      disputeId: `sim-${randomUUID()}`,
      orderId: order.orderId,
      merchantId: merchant.shopDomain,
      gateway: "stripe",
      rawReason: reason,
      amount,
      currency: order.currency,
      deadline,
      platform:
        process.env.MOCK_COMMERCE_MODE === "true" ||
          process.env.PLATFORM_MOCK_MODE === "true"
          ? "mock_commerce"
          : "shopify",
    });

    event.merchantId = merchant._id.toString();
    await handleDisputeEvent(event);

    return NextResponse.json({
      success: true,
      disputeId: event.disputeId,
      orderId: event.orderId,
      amount: event.amount,
      currency: event.currency,
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
