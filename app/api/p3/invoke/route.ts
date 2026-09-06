import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runDisputeInvestigation } from "@/lib/p3/agent";
import { VerifiedEvidencePackageSchema } from "@/lib/p3/schemas";

export const dynamic = "force-dynamic";

const InvokeBodySchema = z.object({
  disputeId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  let disputeId = "unknown";

  try {
    const body = await request.json();
    const parsed = InvokeBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    disputeId = parsed.data.disputeId;
    const pkg = await runDisputeInvestigation(disputeId);
    const validated = VerifiedEvidencePackageSchema.parse(pkg);

    return NextResponse.json(validated);
  } catch (error) {
    console.error("[P3 invoke] Error:", error);

    const fallback = VerifiedEvidencePackageSchema.parse({
      disputeId,
      evidence: {},
      confidenceScore: 0,
      status: "insufficient",
      ledger: [
        {
          step: 1,
          toolCalled: null,
          toolInput: null,
          toolOutput: null,
          reasoning:
            error instanceof Error
              ? `Investigation failed: ${error.message}`
              : "Investigation failed unexpectedly.",
          timestamp: new Date().toISOString(),
        },
      ],
    });

    return NextResponse.json(fallback, { status: 200 });
  }
}
