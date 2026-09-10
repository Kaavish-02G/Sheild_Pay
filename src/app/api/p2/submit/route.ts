import { getDispute } from '@/lib/core/models';
import { getDb } from '@/lib/core/db';
import { mockGateway } from '@/lib/p2/gateways/mock';
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateDisputeStatus } from "@/lib/core/models";
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
    const dispute = await getDispute(disputeId);
    if (!dispute) return NextResponse.json({ success: false, error: 'Dispute not found' }, { status: 404 });
    const repo = await getDb();
    const previous = await repo.collection('submission_status').findOne({ disputeId, state: 'submitted' });
    if (previous) return NextResponse.json(previous.gatewayResponse);
    const gatewayType = resolveGatewayType(dispute.gateway ?? parsed.data.gatewayType);
    const local = disputeId.startsWith('sim-') || dispute.orderId.startsWith('NL-') || dispute.platform === 'mock_commerce';
    if (!local && (process.env.SHIELDPAY_DEMO_MODE !== 'false' || !process.env.SHIELDPAY_ADMIN_PASSWORD)) return NextResponse.json({ success: false, error: 'Live submission requires authenticated live mode.' }, { status: 403 });
    const adapter = local ? mockGateway : getGatewayAdapter(gatewayType);
    const result = await adapter.submitEvidence(disputeId, evidencePackage);

    if (result.success) {
      await updateDisputeStatus(disputeId, "submitted");
      await repo.collection('submission_status').findOneAndUpdate({ disputeId }, { $set: { disputeId, state: 'submitted', gatewayResponse: result, updatedAt: new Date() } }, { upsert: true });
    }

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
