import { NextRequest, NextResponse } from "next/server";
import { fetchCustomerHistory } from "@/lib/core/order-service";
import { CustomerHistorySchema } from "@/shared/schemas";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const history = await fetchCustomerHistory(context.params.id);
    return NextResponse.json(CustomerHistorySchema.parse(history));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch customer history" },
      { status: 500 }
    );
  }
}
