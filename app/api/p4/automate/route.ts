import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runAutomationPipeline } from "@/lib/p4/automation";
import {
  fetchDispute,
  fetchEvidencePackage,
  fetchMerchantSettings,
  getDefaultMerchantId,
  submitDispute,
} from "@/lib/p4/api-client";
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

    const { disputeId } = parsed.data;
    const merchantId = getDefaultMerchantId();

    const [dispute, evidence, settingsResult] = await Promise.all([
      fetchDispute(disputeId),
      fetchEvidencePackage(disputeId),
      fetchMerchantSettings(merchantId),
    ]);

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    const result = await runAutomationPipeline(
      {
        dispute,
        evidence,
        settings: settingsResult.settings,
        responseText: dispute.responseText,
      },
      async (id, package_) => submitDispute(id, package_)
    );

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
