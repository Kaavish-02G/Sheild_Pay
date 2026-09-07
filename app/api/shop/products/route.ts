import { NextRequest, NextResponse } from "next/server";
import { listShopProducts } from "@/lib/shop/commerce";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const products = await listShopProducts({
    collection: searchParams.get("collection") ?? undefined,
    q: searchParams.get("q") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
  });
  return NextResponse.json({ products });
}
