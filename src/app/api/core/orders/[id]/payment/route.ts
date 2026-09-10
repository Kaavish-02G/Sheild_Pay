import { NextRequest, NextResponse } from "next/server";
import { fetchPaymentDetails } from "@/lib/core/order-service";
import { PaymentDetailsSchema } from "@/shared/schemas";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const payment = await fetchPaymentDetails((await context.params).id);
    return NextResponse.json(PaymentDetailsSchema.parse(payment));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch payment" },
      { status: 500 }
    );
  }
}
