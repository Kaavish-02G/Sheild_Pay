import { NextRequest, NextResponse } from "next/server";
import { fileShopDispute } from "@/lib/shop/commerce";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const body = (await request.json()) as { reason?: string };
    const result = await fileShopDispute({
      orderId: context.params.id,
      reason: body.reason ?? "product_not_received",
      merchantId: "demo-merchant",
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not file dispute" },
      { status: 500 }
    );
  }
}
