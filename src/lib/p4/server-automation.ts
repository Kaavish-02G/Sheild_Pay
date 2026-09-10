import { toDisputeResponse } from "@/lib/core/dispute-api";
import {
  getDispute,
  getEvidencePackage,
  getMerchant,
  toMerchantSettingsResponse,
  updateDisputeAfterAutomation,
} from "@/lib/core/models";
import {
  MerchantSettingsSchema,
  type AutomationResult,
  type VerifiedEvidencePackage,
} from "@/shared/schemas";
import { toDashboardEvidencePackage, isAgentPackage } from "./evidence-adapter";
import { runAutomationPipeline } from "./automation";

function getBaseUrl(): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  const port = process.env.PORT ?? "3000";
  return `http://localhost:${port}`;
}

async function submitEvidencePackage(
  disputeId: string,
  package_: VerifiedEvidencePackage
): Promise<{ success: boolean; unavailable?: boolean; error?: string }> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/p2/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(process.env.SHIELDPAY_ADMIN_PASSWORD ? { Authorization: `Basic ${Buffer.from("admin:" + process.env.SHIELDPAY_ADMIN_PASSWORD).toString("base64")}` } : {}) },
      body: JSON.stringify({ disputeId, package: package_ }),
    });
    if (!res.ok) {
      return { success: false, error: `P2 submit returned ${res.status}` };
    }
    const result = await res.json();
    return { success: result.success === true, error: result.error };
  } catch (error) {
    return {
      success: false,
      unavailable: true,
      error: error instanceof Error ? error.message : "Submit failed",
    };
  }
}

function statusFromAutomation(
  result: AutomationResult
): "submitted" | "review" | "insufficient" | "investigating" {
  switch (result.action) {
    case "auto_submitted":
    case "already_submitted":
      return "submitted";
    case "insufficient":
      return "insufficient";
    case "review_required":
      return "review";
    default:
      return "review";
  }
}

export async function runServerAutomation(
  disputeId: string
): Promise<AutomationResult> {
  const disputeDoc = await getDispute(disputeId);
  if (!disputeDoc) {
    throw new Error(`Dispute not found: ${disputeId}`);
  }

  const evidenceDoc = await getEvidencePackage(disputeId);
  if (!evidenceDoc?.package) {
    throw new Error(`No evidence package for dispute ${disputeId}`);
  }

  const dispute = toDisputeResponse(disputeDoc);
  const rawPkg = evidenceDoc.package;
  const agentResponseText =
    isAgentPackage(rawPkg) && rawPkg.responseText ? rawPkg.responseText : undefined;
  const evidence = toDashboardEvidencePackage(rawPkg, dispute.reason);

  const merchant = await getMerchant(disputeDoc.merchantId);
  const settings = MerchantSettingsSchema.parse(
    toMerchantSettingsResponse(merchant?.settings)
  );

  const result = await runAutomationPipeline(
    {
      dispute,
      evidence,
      settings,
      responseText: agentResponseText ?? dispute.responseText ?? undefined,
    },
    submitEvidencePackage
  );

  await updateDisputeAfterAutomation(disputeId, {
    status: statusFromAutomation(result),
    responseText: result.responseText ?? undefined,
  });

  return {
    ...result,
    responseText: result.responseText ?? undefined,
  };
}
