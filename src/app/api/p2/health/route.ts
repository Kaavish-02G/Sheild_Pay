import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    module: "p2",
    tools: [
      "getOrderDetails",
      "getCustomerHistory",
      "getFulfillmentDetails",
      "getTrackingStatus",
      "getRefundHistory",
      "getPaymentDetails",
    ],
  });
}
