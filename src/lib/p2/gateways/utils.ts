import pRetry from "p-retry";
import type { VerifiedEvidencePackage } from "@/shared/schemas";

export const RETRY_OPTIONS = {
  retries: 3,
  factor: 2,
  minTimeout: 500,
  maxTimeout: 4000,
};

export async function withRetry<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  return pRetry(fn, {
    ...RETRY_OPTIONS,
    onFailedAttempt: (error) => {
      const reason =
        error.error instanceof Error
          ? error.error.message
          : String(error.error ?? error);
      console.warn(
        `[P2] ${label} attempt ${error.attemptNumber} failed (${error.retriesLeft} retries left):`,
        reason
      );
    },
  });
}

export function buildEvidenceText(pkg: VerifiedEvidencePackage): string {
  const fields = pkg.evidence
    .map((field) => `${field.label}: ${field.value}`)
    .join("\n");
  const ledger = pkg.ledger
    .map(
      (entry) =>
        `[${entry.timestamp}] ${entry.tool}: ${entry.reasoning} — ${entry.resultSummary}`
    )
    .join("\n");
  return [
    `Dispute: ${pkg.disputeId}`,
    `Reason: ${pkg.disputeReason}`,
    `Confidence: ${pkg.confidenceScore}/100`,
    "",
    "Evidence:",
    fields,
    "",
    "Investigation ledger:",
    ledger,
  ].join("\n");
}

export function normalizeGatewayError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
