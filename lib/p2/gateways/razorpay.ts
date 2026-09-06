import Razorpay from "razorpay";
import type { GatewayAdapter, SubmissionResult, VerifiedEvidencePackage } from "@/shared/schemas";
import {
  buildEvidenceText,
  normalizeGatewayError,
  withRetry,
} from "./utils";

function getRazorpayClient(): Razorpay | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return null;
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export const razorpayGateway: GatewayAdapter = {
  async submitEvidence(
    disputeId: string,
    pkg: VerifiedEvidencePackage
  ): Promise<SubmissionResult> {
    const razorpay = getRazorpayClient();
    if (!razorpay) {
      return {
        success: false,
        error: "RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured",
      };
    }

    try {
      const evidenceText = buildEvidenceText(pkg);
      const dispute = await withRetry("razorpay.disputes.contest", () =>
        razorpay.disputes.contest(disputeId, {
          amount: Math.round(pkg.confidenceScore * 100),
          summary: evidenceText.slice(0, 1000),
          action: "submit",
        })
      );

      const reference =
        typeof dispute === "object" && dispute !== null && "id" in dispute
          ? String((dispute as { id: string }).id)
          : disputeId;

      return {
        success: true,
        gatewayReference: reference,
      };
    } catch (error) {
      return { success: false, error: normalizeGatewayError(error) };
    }
  },

  async checkStatus(disputeId: string): Promise<SubmissionResult> {
    const razorpay = getRazorpayClient();
    if (!razorpay) {
      return {
        success: false,
        error: "RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured",
      };
    }

    try {
      const dispute = await withRetry("razorpay.disputes.fetch", () =>
        razorpay.disputes.fetch(disputeId)
      );

      const status =
        typeof dispute === "object" && dispute !== null && "status" in dispute
          ? String((dispute as { status: string }).status)
          : "unknown";

      return {
        success: status !== "lost" && status !== "closed",
        gatewayReference:
          typeof dispute === "object" && dispute !== null && "id" in dispute
            ? String((dispute as { id: string }).id)
            : disputeId,
        error:
          status === "lost" || status === "closed"
            ? `Dispute status: ${status}`
            : undefined,
      };
    } catch (error) {
      return { success: false, error: normalizeGatewayError(error) };
    }
  },
};
