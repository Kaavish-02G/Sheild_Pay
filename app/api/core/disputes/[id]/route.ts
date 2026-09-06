import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { toDisputeResponse } from "@/lib/core/dispute-api";
import {
  getDispute,
  getEvidencePackage,
  saveEvidencePackage,
  updateDisputeStatus,
} from "@/lib/core/models";
import { DisputeStatusSchema } from "@/shared/schemas";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  status: DisputeStatusSchema,
});

const EvidenceSchema = z.record(z.unknown());

export async function GET(
  _request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const dispute = await getDispute(context.params.id);
    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    const evidence = await getEvidencePackage(dispute.disputeId);

    return NextResponse.json({
      dispute: toDisputeResponse(dispute),
      evidence: evidence?.package ?? null,
    });
  } catch (error) {
    console.error("[disputes/:id] GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch dispute" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await updateDisputeStatus(context.params.id, parsed.data.status);
    if (!updated) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    return NextResponse.json({ dispute: toDisputeResponse(updated) });
  } catch (error) {
    console.error("[disputes/:id] PATCH error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update dispute" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const parsed = EvidenceSchema.safeParse(body.package ?? body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid evidence package", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const dispute = await getDispute(context.params.id);
    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    const saved = await saveEvidencePackage(dispute.disputeId, parsed.data);
    return NextResponse.json({ success: true, evidence: saved.package });
  } catch (error) {
    console.error("[disputes/:id] POST evidence error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save evidence" },
      { status: 500 }
    );
  }
}
