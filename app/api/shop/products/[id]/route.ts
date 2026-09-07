import { NextRequest, NextResponse } from "next/server";
import { getShopProduct } from "@/lib/shop/commerce";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: { id: string } }
) {
  const product = await getShopProduct(context.params.id);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  return NextResponse.json({ product });
}
