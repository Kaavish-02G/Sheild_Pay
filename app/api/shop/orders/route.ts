import { NextRequest, NextResponse } from "next/server";
import { listShopOrders } from "@/lib/shop/commerce";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email") ?? undefined;
  const orders = await listShopOrders(email);
  return NextResponse.json({ orders });
}
