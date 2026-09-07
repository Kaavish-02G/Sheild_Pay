import { NextRequest, NextResponse } from "next/server";
import { simulateShopPreAlert } from "@/lib/shop/commerce";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const body = (await request.json().catch(() => ({}))) as { riskReason?: string };
    const result = await simulateShopPreAlert({
      orderId: context.params.id,
      riskReason: body.riskReason ?? "customer_contacted_bank",
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not simulate pre-dispute signal",
      },
      { status: 500 }
    );
  }
}
