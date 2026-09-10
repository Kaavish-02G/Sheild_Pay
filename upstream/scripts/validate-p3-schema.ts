/**
 * Validates P3 output against VerifiedEvidencePackageSchema without P4 or Ollama.
 * Run: npx tsx scripts/validate-p3-schema.ts
 */
import { scoreEvidence, mapScoreToStatus } from "../lib/p3/scoring";
import {
  LedgerEntrySchema,
  VerifiedEvidencePackageSchema,
} from "../lib/p3/schemas";

const sampleEvidence = {
  order: { orderId: "1001", totalAmount: 49.99, currency: "USD" },
  tracking: { status: "delivered", trackingNumber: "1Z999" },
  fulfillment: {
    status: "fulfilled",
    trackingNumber: "1Z999",
    shippedAt: "2026-09-01T00:00:00.000Z",
  },
  customer: { disputeCount: 0, totalOrders: 3 },
  payment: { status: "captured", avsResult: "match", cvvResult: "match" },
  refunds: { totalRefunded: 0 },
};

const score = scoreEvidence(sampleEvidence, "product_not_received");
const status = mapScoreToStatus(score);

const pkg = VerifiedEvidencePackageSchema.parse({
  disputeId: "validate-p3",
  evidence: sampleEvidence,
  confidenceScore: score,
  status,
  ledger: [
    LedgerEntrySchema.parse({
      step: 1,
      toolCalled: "getTrackingStatus",
      toolInput: { orderId: "1001" },
      toolOutput: sampleEvidence.tracking,
      reasoning: "Confirm delivery for not-received dispute.",
      timestamp: new Date().toISOString(),
    }),
  ],
});

console.log("OK validate-p3-schema", {
  confidenceScore: pkg.confidenceScore,
  status: pkg.status,
  ledgerSteps: pkg.ledger.length,
});
