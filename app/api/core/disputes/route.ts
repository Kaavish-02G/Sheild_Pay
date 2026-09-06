import { NextResponse } from "next/server";
import { toDisputeResponse } from "@/lib/core/dispute-api";
import { listDisputes } from "@/lib/core/models";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const disputes = await listDisputes();
    return NextResponse.json({
      disputes: disputes.map(toDisputeResponse),
    });
  } catch (error) {
    console.error("[disputes] GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list disputes" },
      { status: 500 }
    );
  }
}
