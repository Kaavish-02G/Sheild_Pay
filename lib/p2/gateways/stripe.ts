import Stripe from "stripe";
import type { GatewayAdapter, SubmissionResult, VerifiedEvidencePackage } from "@/shared/schemas";
import {
  buildEvidenceText,
  normalizeGatewayError,
  withRetry,
} from "./utils";

function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return null;
  }
  return new Stripe(key, { apiVersion: "2026-08-26.dahlia" });
}

export const stripeGateway: GatewayAdapter = {
  async submitEvidence(
    disputeId: string,
    pkg: VerifiedEvidencePackage
  ): Promise<SubmissionResult> {
    const stripe = getStripeClient();
    if (!stripe) {
      return { success: false, error: "STRIPE_SECRET_KEY is not configured" };
    }

    try {
      const evidenceText = buildEvidenceText(pkg);
      const dispute = await withRetry("stripe.disputes.update", () =>
        stripe.disputes.update(disputeId, {
          evidence: {
            uncategorized_text: evidenceText,
            customer_communication: evidenceText,
          },
          submit: true,
        })
      );

      return {
        success: true,
        gatewayReference: dispute.id,
      };
    } catch (error) {
      return { success: false, error: normalizeGatewayError(error) };
    }
  },

  async checkStatus(disputeId: string): Promise<SubmissionResult> {
    const stripe = getStripeClient();
    if (!stripe) {
      return { success: false, error: "STRIPE_SECRET_KEY is not configured" };
    }

    try {
      const dispute = await withRetry("stripe.disputes.retrieve", () =>
        stripe.disputes.retrieve(disputeId)
      );

      return {
        success: dispute.status !== "lost",
        gatewayReference: dispute.id,
        error:
          dispute.status === "lost"
            ? `Dispute status: ${dispute.status}`
            : undefined,
      };
    } catch (error) {
      return { success: false, error: normalizeGatewayError(error) };
    }
  },

  async refund(orderId: string): Promise<SubmissionResult> {
    const stripe = getStripeClient();
    if (!stripe) {
      return { success: false, error: "STRIPE_SECRET_KEY is not configured" };
    }
    try {
      const refund = await withRetry("stripe.refunds.create", () =>
        stripe.refunds.create({ metadata: { order_id: orderId } })
      );
      return { success: true, gatewayReference: refund.id };
    } catch (error) {
      return { success: false, error: normalizeGatewayError(error) };
    }
  },
};
