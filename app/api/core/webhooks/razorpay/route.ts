import { NextRequest, NextResponse } from "next/server";
import { ingestDisputeEvent, parseRazorpayDisputeWebhook } from "@/lib/core/pg-ingest";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const event = parseRazorpayDisputeWebhook(body);
    if (!event) {
      return NextResponse.json({ received: true, dispute: null });
    }

    const ingested = await ingestDisputeEvent(event);
    return NextResponse.json({ received: true, disputeId: ingested.disputeId });
  } catch (error) {
    console.error("[webhooks/razorpay] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Razorpay webhook failed" },
      { status: 500 }
    );
  }
}
