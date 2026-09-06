import { NextResponse } from "next/server";
import { checkApproachingDeadlines } from "@/lib/core/deadline-monitor";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const warnings = await checkApproachingDeadlines();

    return NextResponse.json({
      checkedAt: new Date().toISOString(),
      urgentCount: warnings.length,
      disputes: warnings,
    });
  } catch (error) {
    console.error("[deadline-check] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Deadline check failed" },
      { status: 500 }
    );
  }
}
