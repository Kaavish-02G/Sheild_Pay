import { NextRequest, NextResponse } from "next/server";
import { fetchRefundHistory } from "@/lib/core/order-service";
import { RefundHistorySchema } from "@/shared/schemas";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const refunds = await fetchRefundHistory((await context.params).id);
    return NextResponse.json(RefundHistorySchema.parse(refunds));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch refunds" },
      { status: 500 }
    );
  }
}
