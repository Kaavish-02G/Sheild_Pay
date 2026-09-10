import reasonMap from "@/shared/rules/reason-map.json";
import type { CanonicalDisputeReason, GatewayType } from "@/shared/schemas";

type ReasonMap = Record<string, Record<string, string>>;

const MAP = reasonMap as ReasonMap;

export function normalizeDisputeReason(
  gateway: GatewayType,
  rawReason: string
): CanonicalDisputeReason {
  const normalized = rawReason.toLowerCase().trim().replace(/\s+/g, "_");
  const gatewayMap = MAP[gateway] ?? {};
  const canonical = gatewayMap[normalized];

  if (canonical && isCanonicalReason(canonical)) {
    return canonical;
  }

  if (normalized.includes("not_received") || normalized.includes("goods_not")) {
    return "ITEM_NOT_RECEIVED";
  }
  if (normalized.includes("fraud") || normalized.includes("unauthorized")) {
    return "FRAUD";
  }
  if (normalized.includes("duplicate")) {
    return "DUPLICATE";
  }
  if (normalized.includes("unrecognized")) {
    return "UNRECOGNIZED";
  }

  return "GENERAL";
}

function isCanonicalReason(value: string): value is CanonicalDisputeReason {
  return [
    "ITEM_NOT_RECEIVED",
    "ITEM_NOT_AS_DESCRIBED",
    "FRAUD",
    "DUPLICATE",
    "UNRECOGNIZED",
    "CREDIT_NOT_PROCESSED",
    "GENERAL",
  ].includes(value);
}

export function formatCanonicalReason(reason: CanonicalDisputeReason): string {
  return reason.replace(/_/g, " ").toLowerCase();
}
