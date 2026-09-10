/**
 * P3 canonical output contract — re-exported under frozen names for agent code.
 * shared/schemas.ts uses AgentVerifiedEvidencePackageSchema to avoid clashing with
 * P4's legacy VerifiedEvidencePackageSchema (different shape).
 */
export {
  AgentVerifiedEvidencePackageSchema as VerifiedEvidencePackageSchema,
  LedgerEntrySchema,
  type AgentVerifiedEvidencePackage as VerifiedEvidencePackage,
  type LedgerEntry,
} from "@/shared/schemas";
