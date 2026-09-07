import { NextRequest, NextResponse } from "next/server";
import { ingestDisputeEvent, parseStripeDisputeWebhook } from "@/lib/core/pg-ingest";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const mockMode =
      request.headers.get("x-mock-commerce") === "true" ||
      process.env.PG_MOCK_MODE === "true";

    if (!mockMode) {
      const signature = request.headers.get("stripe-signature");
      if (!signature && process.env.STRIPE_WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Missing Stripe signature" }, { status: 401 });
      }
    }

    const event = parseStripeDisputeWebhook(body);
    if (!event) {
      return NextResponse.json({ received: true, dispute: null });
    }

    const ingested = await ingestDisputeEvent(event);
    return NextResponse.json({ received: true, disputeId: ingested.disputeId });
  } catch (error) {
    console.error("[webhooks/stripe] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Stripe webhook failed" },
      { status: 500 }
    );
  }
}
