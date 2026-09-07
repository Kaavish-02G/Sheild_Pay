import { NextRequest, NextResponse } from "next/server";
import { ingestDisputeEvent, parsePayPalDisputeWebhook } from "@/lib/core/pg-ingest";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const event = parsePayPalDisputeWebhook(body);
    if (!event) {
      return NextResponse.json({ received: true, dispute: null });
    }

    const ingested = await ingestDisputeEvent(event);
    return NextResponse.json({ received: true, disputeId: ingested.disputeId });
  } catch (error) {
    console.error("[webhooks/paypal] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PayPal webhook failed" },
      { status: 500 }
    );
  }
}
