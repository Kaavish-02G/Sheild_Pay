import { NextRequest, NextResponse } from "next/server";
import { getShopOrder } from "@/lib/shop/commerce";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: { id: string } }
) {
  const order = await getShopOrder(context.params.id);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  return NextResponse.json({ order });
}
