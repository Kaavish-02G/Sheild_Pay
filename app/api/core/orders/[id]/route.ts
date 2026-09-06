import { NextRequest, NextResponse } from "next/server";
import { fetchOrderDetails } from "@/lib/core/order-service";
import { OrderDetailsSchema } from "@/shared/schemas";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const order = await fetchOrderDetails(context.params.id);
    return NextResponse.json(OrderDetailsSchema.parse(order));
  } catch (error) {
    console.error("[orders/:id] GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch order" },
      { status: 500 }
    );
  }
}
