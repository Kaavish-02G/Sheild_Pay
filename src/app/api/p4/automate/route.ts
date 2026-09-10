import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runServerAutomation } from "@/lib/p4/server-automation";
import { AutomationResultSchema } from "@/shared/schemas";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  disputeId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await runServerAutomation(parsed.data.disputeId);
    return NextResponse.json(AutomationResultSchema.parse(result));
  } catch (error) {
    console.error("[P4 automate] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Automation pipeline failed",
      },
      { status: 500 }
    );
  }
}
