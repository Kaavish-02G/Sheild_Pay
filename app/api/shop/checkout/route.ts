import { NextRequest, NextResponse } from "next/server";
import { checkoutShopOrder } from "@/lib/shop/commerce";
import { inferCardNetwork, validateCheckoutCard } from "@/shared/shop/test-cards";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const invalid = validateCheckoutCard(body);
    if (invalid) {
      return NextResponse.json({ error: invalid }, { status: 400 });
    }
    const result = await checkoutShopOrder({
      ...body,
      cardNetwork: inferCardNetwork(body.cardNumber, String(body.cardNetwork ?? "visa")),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed" },
      { status: 400 }
    );
  }
}
