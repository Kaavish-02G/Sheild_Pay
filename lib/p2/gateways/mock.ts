import type { GatewayAdapter, SubmissionResult, VerifiedEvidencePackage } from "@/shared/schemas";
import { buildEvidenceText } from "./utils";

export const mockGateway: GatewayAdapter = {
  async submitEvidence(
    disputeId: string,
    pkg: VerifiedEvidencePackage
  ): Promise<SubmissionResult> {
    const reference = `pg-mock-${disputeId.replace(/[^a-z0-9-]/gi, "").slice(0, 24)}`;
    console.info(
      `[P2 mock PG] Submitted dispute ${disputeId} with evidence pack (${pkg.evidence.length} fields, score ${pkg.confidenceScore})`
    );
    console.info(`[P2 mock PG] Payload preview:\n${buildEvidenceText(pkg).slice(0, 500)}…`);
    return {
      success: true,
      gatewayReference: reference,
    };
  },

  async checkStatus(disputeId: string): Promise<SubmissionResult> {
    return {
      success: true,
      gatewayReference: `pg-mock-${disputeId.slice(0, 12)}`,
    };
  },
};

export function useMockPaymentGateway(): boolean {
  return (
    process.env.SHOPIFY_MOCK_MODE === "true" ||
    process.env.PG_MOCK_MODE === "true" ||
    process.env.NODE_ENV === "test"
  );
}
