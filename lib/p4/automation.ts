import type {
  AutomationResult,
  Dispute,
  MerchantSettings,
  VerifiedEvidencePackage,
} from "@/shared/schemas";
import { generateDisputeResponse } from "./response-generator";
import { addReviewNotification } from "./notifications";

export interface AutomationInput {
  dispute: Dispute;
  evidence: VerifiedEvidencePackage;
  settings: MerchantSettings;
  responseText?: string;
}

export function shouldRequireMerchantReview(
  dispute: Dispute,
  settings: MerchantSettings
): boolean {
  return dispute.amount > settings.reviewAmountLimit;
}

export function hasInsufficientEvidence(
  evidence: VerifiedEvidencePackage,
  settings: MerchantSettings
): boolean {
  return evidence.confidenceScore < settings.minEvidenceScore;
}

export async function runAutomationPipeline(
  input: AutomationInput,
  submitFn: (
    disputeId: string,
    package_: VerifiedEvidencePackage
  ) => Promise<{ success: boolean; unavailable?: boolean; error?: string }>
): Promise<AutomationResult> {
  const { dispute, evidence, settings } = input;

  if (dispute.status === "submitted") {
    return {
      action: "already_submitted",
      disputeId: dispute.disputeId,
      message: "This dispute has already been submitted.",
      responseText: input.responseText,
    };
  }

  if (hasInsufficientEvidence(evidence, settings)) {
    return {
      action: "insufficient",
      disputeId: dispute.disputeId,
      message: `Evidence confidence (${evidence.confidenceScore}%) is below the minimum threshold (${settings.minEvidenceScore}%). Manual handling required.`,
      responseText: input.responseText,
    };
  }

  let responseText = input.responseText;
  if (!responseText) {
    responseText = await generateDisputeResponse(evidence);
  }

  if (shouldRequireMerchantReview(dispute, settings)) {
    const notification = {
      disputeId: dispute.disputeId,
      orderId: dispute.orderId,
      amount: dispute.amount,
      currency: dispute.currency,
      reason: dispute.reason,
      message: `Dispute ${dispute.orderId} (${dispute.currency} ${dispute.amount.toFixed(2)}) exceeds your review limit of ${dispute.currency} ${settings.reviewAmountLimit.toFixed(2)}. Please review before submission.`,
      createdAt: new Date().toISOString(),
    };
    addReviewNotification(notification);

    return {
      action: "review_required",
      disputeId: dispute.disputeId,
      message: notification.message,
      responseText,
      notification,
    };
  }

  const submitResult = await submitFn(dispute.disputeId, evidence);
  if (submitResult.success) {
    return {
      action: "auto_submitted",
      disputeId: dispute.disputeId,
      message: "Dispute response auto-generated and submitted by the AI agent — no merchant action required.",
      responseText,
    };
  }

  if (submitResult.unavailable) {
    return {
      action: "submission_unavailable",
      disputeId: dispute.disputeId,
      message: "Automation completed but submission service is not yet available. Response is ready for retry.",
      responseText,
    };
  }

  return {
    action: "submission_unavailable",
    disputeId: dispute.disputeId,
    message: submitResult.error ?? "Auto-submission failed.",
    responseText,
  };
}
