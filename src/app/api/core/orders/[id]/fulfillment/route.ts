import { NextRequest, NextResponse } from "next/server";
import { fetchFulfillmentDetails } from "@/lib/core/order-service";
import { FulfillmentDetailsSchema } from "@/shared/schemas";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const fulfillment = await fetchFulfillmentDetails((await context.params).id);
    return NextResponse.json(FulfillmentDetailsSchema.parse(fulfillment));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch fulfillment" },
      { status: 500 }
    );
  }
}
