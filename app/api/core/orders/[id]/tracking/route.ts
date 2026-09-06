import { NextRequest, NextResponse } from "next/server";
import { fetchTrackingStatus } from "@/lib/core/order-service";
import { TrackingStatusSchema } from "@/shared/schemas";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const tracking = await fetchTrackingStatus(context.params.id);
    return NextResponse.json(TrackingStatusSchema.parse(tracking));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch tracking" },
      { status: 500 }
    );
  }
}
