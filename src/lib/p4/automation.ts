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
  return (
    settings.requireApprovalHighValue &&
    dispute.amount > settings.reviewAmountLimit
  );
}

export function needsWeakEvidenceReview(
  evidence: VerifiedEvidencePackage,
  settings: MerchantSettings
): boolean {
  return (
    settings.requireApprovalWeakEvidence &&
    evidence.confidenceScore < settings.autoSubmitThreshold
  );
}

export function hasInsufficientEvidence(
  evidence: VerifiedEvidencePackage,
  settings: MerchantSettings
): boolean {
  return evidence.confidenceScore < settings.minEvidenceScore;
}

export function canAutoSubmitToPg(
  dispute: Dispute,
  evidence: VerifiedEvidencePackage,
  settings: MerchantSettings
): boolean {
  if (hasInsufficientEvidence(evidence, settings)) return false;
  if (evidence.validation && !evidence.validation.allRequiredMet) return false;
  if (settings.requireApprovalMissingDeliveryProof && !evidence.evidence.some(f => f.key === 'delivery_status' && f.value === 'delivered')) return false;
  if (shouldRequireMerchantReview(dispute, settings)) return false;
  if (needsWeakEvidenceReview(evidence, settings)) return false;
  return true;
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
      message: "This dispute has already been submitted to the payment gateway.",
      responseText: input.responseText,
    };
  }

  let responseText = input.responseText;
  if (!responseText) {
    responseText = await generateDisputeResponse(evidence);
  }

  if (hasInsufficientEvidence(evidence, settings)) {
    return {
      action: "insufficient",
      disputeId: dispute.disputeId,
      message: `Evidence confidence (${evidence.confidenceScore}%) is below your minimum (${settings.minEvidenceScore}%). An evidence-only response is available — review the case and use Send Request to PG when ready.`,
      responseText,
    };
  }

  if ((evidence.validation && !evidence.validation.allRequiredMet) || (settings.requireApprovalMissingDeliveryProof && !evidence.evidence.some(f => f.key === 'delivery_status' && f.value === 'delivered'))) {
    return { action: 'review_required', disputeId: dispute.disputeId, responseText, message: 'Mandatory evidence is missing. Review the network checklist and delivery proof before approving a response.' };
  }
  if (shouldRequireMerchantReview(dispute, settings)) {
    const notification = {
      disputeId: dispute.disputeId,
      orderId: dispute.orderId,
      amount: dispute.amount,
      currency: dispute.currency,
      reason: dispute.reason,
      message: `Dispute ${dispute.orderId} (${dispute.currency} ${dispute.amount.toFixed(2)}) exceeds your review limit of ${dispute.currency} ${settings.reviewAmountLimit.toFixed(2)}. Approve and send to PG manually.`,
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

  if (needsWeakEvidenceReview(evidence, settings)) {
    return {
      action: "review_required",
      disputeId: dispute.disputeId,
      message: `Evidence score (${evidence.confidenceScore}%) is below your auto-submit threshold (${settings.autoSubmitThreshold}%). Review the preview and send to PG manually when ready.`,
      responseText,
    };
  }

  const submitResult = await submitFn(dispute.disputeId, evidence);
  if (submitResult.success) {
    return {
      action: "auto_submitted",
      disputeId: dispute.disputeId,
      message:
        "Dispute response auto-generated and submitted to the payment gateway — evidence met your thresholds.",
      responseText,
    };
  }

  if (submitResult.unavailable) {
    return {
      action: "submission_unavailable",
      disputeId: dispute.disputeId,
      message: "Response ready but payment gateway submission is unavailable. Use Send Request to PG when ready.",
      responseText,
    };
  }

  return {
    action: "submission_unavailable",
    disputeId: dispute.disputeId,
    message: submitResult.error ?? "Payment gateway submission failed.",
    responseText,
  };
}
