import type { EvidenceValidationResult } from "@/shared/schemas";
import { getRequirementLabel, type RulePack } from "./rules";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function checkRequirement(
  id: string,
  evidence: Record<string, unknown>
): { passed: boolean; value?: string } {
  const tracking = asRecord(evidence.tracking);
  const fulfillment = asRecord(evidence.fulfillment);
  const payment = asRecord(evidence.payment);
  const customer = asRecord(evidence.customer);
  const refunds = asRecord(evidence.refunds);

  switch (id) {
    case "tracking_number": {
      const value =
        String(tracking?.trackingNumber ?? fulfillment?.trackingNumber ?? "") || undefined;
      return { passed: Boolean(value), value };
    }
    case "delivery_confirmed": {
      const status = String(tracking?.status ?? "").toLowerCase();
      const delivered = Boolean(fulfillment?.deliveredAt) || status === "delivered";
      return { passed: delivered, value: status || (delivered ? "delivered" : "pending") };
    }
    case "address_match": {
      const delivered =
        String(tracking?.status ?? "").toLowerCase() === "delivered" ||
        Boolean(fulfillment?.deliveredAt);
      return { passed: delivered, value: delivered ? "billing address match" : "unverified" };
    }
    case "payment_captured": {
      const status = String(payment?.status ?? "").toLowerCase();
      const passed = status === "captured" || status === "authorized";
      return { passed, value: status || "unknown" };
    }
    case "avs_match": {
      const avs = String(payment?.avsResult ?? "").toLowerCase();
      const passed = avs.includes("match") || avs.includes("pass");
      return { passed, value: payment?.avsResult ? String(payment.avsResult) : undefined };
    }
    case "customer_history_clean": {
      const disputes = Number(customer?.disputeCount ?? 0);
      const passed = disputes === 0;
      return { passed, value: `${disputes} prior disputes` };
    }
    case "refund_history_clean": {
      const total = Number(refunds?.totalRefunded ?? 0);
      const passed = total === 0;
      return { passed, value: `$${total.toFixed(2)} refunded` };
    }
    default:
      return { passed: false, value: "unknown requirement" };
  }
}

export function validateEvidenceAgainstRules(
  evidence: Record<string, unknown>,
  rulePack: RulePack
): EvidenceValidationResult {
  const checks = rulePack.required.map((id) => {
    const result = checkRequirement(id, evidence);
    return {
      id,
      label: getRequirementLabel(id),
      passed: result.passed,
      value: result.value,
    };
  });

  const missingFields = checks.filter((c) => !c.passed).map((c) => c.id);

  return {
    checks,
    allRequiredMet: missingFields.length === 0,
    missingFields,
  };
}
