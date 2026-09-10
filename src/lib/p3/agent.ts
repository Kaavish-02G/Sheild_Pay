import { saveEvidencePackage } from "@/lib/core/models";
import { collectEvidenceDeterministic } from "@/lib/core/evidence-collector";
import { validateEvidenceAgainstRules } from "@/lib/core/evidence-validator";
import { normalizeDisputeReason } from "@/lib/core/normalization/reasons";
import { identifyNetwork, loadRulePack, formatRulePackDisplay } from "@/lib/core/rules";
import { fetchDisputeContext, persistDisputeStatus } from "./dispute";
import { mapScoreToStatus, scoreValidatedEvidence } from "./scoring";
import {
  VerifiedEvidencePackageSchema,
  type LedgerEntry,
  type VerifiedEvidencePackage,
} from "./schemas";
import type { CanonicalDisputeReason, CardNetwork, GatewayType } from "@/shared/schemas";

function inferCanonicalReason(
  reason: string,
  gateway?: GatewayType
): CanonicalDisputeReason {
  return normalizeDisputeReason(gateway ?? "stripe", reason);
}

function buildInvestigationSummary(
  evidence: Record<string, unknown>,
  canonicalReason: string,
  network: CardNetwork,
  score: number,
  status: string,
  validationPassed: number,
  validationTotal: number
): string {
  const order = evidence.order as Record<string, unknown> | undefined;
  const orderId = order?.orderId ?? "unknown order";
  return (
    `Deterministic investigation complete for ${canonicalReason.replace(/_/g, " ")} ` +
    `(${network}) on order ${orderId}. Rule checklist: ${validationPassed}/${validationTotal} passed. ` +
    `Evidence score ${score}/100 → ${status}. Ready for rebuttal generation.`
  );
}

async function persistProgress(
  disputeId: string,
  pkg: VerifiedEvidencePackage
): Promise<void> {
  await saveEvidencePackage(disputeId, pkg as unknown as Record<string, unknown>);
}

export async function runDisputeInvestigation(
  disputeId: string
): Promise<VerifiedEvidencePackage> {
  const dispute = await fetchDisputeContext(disputeId);
  const canonicalReason =
    dispute.canonicalReason ?? inferCanonicalReason(dispute.reason, dispute.gateway);
  const cardNetwork =
    dispute.cardNetwork ??
    identifyNetwork(
      dispute.cardNetwork ? { cardNetwork: dispute.cardNetwork } : undefined
    );

  const rulePack = loadRulePack(cardNetwork, canonicalReason);
  const tools = rulePack.tools;

  let ledger: LedgerEntry[] = [];

  const buildSnapshot = (
    evidence: Record<string, unknown>,
    validation?: VerifiedEvidencePackage["validation"]
  ): VerifiedEvidencePackage => {
    const confidenceScore = scoreValidatedEvidence(
      evidence,
      validation,
      canonicalReason
    );
    return {
      disputeId,
      evidence,
      confidenceScore,
      status: mapScoreToStatus(confidenceScore),
      ledger,
      canonicalReason,
      cardNetwork,
      gateway: dispute.gateway,
      validation,
    };
  };

  const { evidence, ledger: collectedLedger } = await collectEvidenceDeterministic({
    orderId: dispute.orderId,
    tools,
    onProgress: async (updatedLedger) => {
      ledger = updatedLedger;
      await persistProgress(disputeId, buildSnapshot({}));
    },
  });
  ledger = collectedLedger;

  const networkFromPayment = identifyNetwork(
    evidence.payment as Record<string, unknown> | undefined,
    cardNetwork
  );
  const activeRulePack = loadRulePack(networkFromPayment, canonicalReason);
  const rulePackDisplay = formatRulePackDisplay(activeRulePack);
  const validation = validateEvidenceAgainstRules(evidence, activeRulePack);

  ledger.push({
    step: ledger.length + 1,
    toolCalled: null,
    toolInput: { rulePack: activeRulePack.required },
    toolOutput: {
      allRequiredMet: validation.allRequiredMet,
      missingFields: validation.missingFields,
    },
    reasoning: `Rule validation: ${validation.checks.filter((c) => c.passed).length}/${validation.checks.length} requirements met.`,
    timestamp: new Date().toISOString(),
  });

  const confidenceScore = scoreValidatedEvidence(
    evidence,
    validation,
    canonicalReason
  );
  const status = mapScoreToStatus(confidenceScore);

  ledger.push({
    step: ledger.length + 1,
    toolCalled: null,
    toolInput: null,
    toolOutput: { confidenceScore, status },
    reasoning: buildInvestigationSummary(
      evidence,
      canonicalReason,
      networkFromPayment,
      confidenceScore,
      status,
      validation.checks.filter((c) => c.passed).length,
      validation.checks.length
    ),
    timestamp: new Date().toISOString(),
  });

  const pkg: VerifiedEvidencePackage = {
    disputeId,
    evidence,
    confidenceScore,
    status,
    ledger,
    canonicalReason,
    cardNetwork: networkFromPayment,
    gateway: dispute.gateway,
    rulePack: rulePackDisplay,
    validation,
  };

  const validated = VerifiedEvidencePackageSchema.parse(pkg);
  await persistProgress(disputeId, validated);

  if (status === "review" || status === "insufficient") {
    await persistDisputeStatus(
      disputeId,
      status === "insufficient" ? "insufficient" : "review"
    );
  }

  return validated;
}
