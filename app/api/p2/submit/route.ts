import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getGatewayAdapter, resolveGatewayType } from "@/lib/p2/gateways";
import {
  GatewayTypeSchema,
  SubmissionResultSchema,
  VerifiedEvidencePackageSchema,
} from "@/shared/schemas";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  disputeId: z.string().min(1),
  gatewayType: GatewayTypeSchema.optional(),
  package: VerifiedEvidencePackageSchema,
});

/** Frozen contract for P4 "Approve & Submit" — do not change response shape. */
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

    const { disputeId, package: evidencePackage } = parsed.data;
    const gatewayType = resolveGatewayType(parsed.data.gatewayType);
    const adapter = getGatewayAdapter(gatewayType);
    const result = await adapter.submitEvidence(disputeId, evidencePackage);

    return NextResponse.json(SubmissionResultSchema.parse(result));
  } catch (error) {
    console.error("[P2 submit] Error:", error);
    const fallback = SubmissionResultSchema.parse({
      success: false,
      error:
        error instanceof Error ? error.message : "Evidence submission failed",
    });
    return NextResponse.json(fallback, { status: 500 });
  }
}
