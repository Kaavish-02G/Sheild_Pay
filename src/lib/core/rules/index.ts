import networkRules from "@/shared/rules/network-rules.json";
import type { CanonicalDisputeReason, CardNetwork } from "@/shared/schemas";
import type { InvestigationToolName } from "@/lib/p3/tools";

export interface RulePack {
  network: CardNetwork;
  canonicalReason: CanonicalDisputeReason;
  required: string[];
  tools: InvestigationToolName[];
}

export interface RuleRequirementDisplay {
  id: string;
  label: string;
}

export interface RulePackDisplay {
  network: CardNetwork;
  canonicalReason: CanonicalDisputeReason;
  requirements: RuleRequirementDisplay[];
  tools: Array<{ name: InvestigationToolName; label: string }>;
}

export const REQUIREMENT_LABELS: Record<string, string> = {
  tracking_number: "Tracking Number",
  delivery_confirmed: "Delivery Confirmed",
  address_match: "Address Match",
  payment_captured: "Payment Captured",
  avs_match: "AVS Match",
  customer_history_clean: "Clean Customer History",
  refund_history_clean: "No Prior Refunds",
};

export const TOOL_LABELS: Record<InvestigationToolName, string> = {
  getOrderDetails: "Order details",
  getCustomerHistory: "Customer history",
  getFulfillmentDetails: "Fulfillment record",
  getTrackingStatus: "Carrier tracking",
  getRefundHistory: "Refund history",
  getPaymentDetails: "Payment / AVS details",
};

export const CARD_NETWORKS: CardNetwork[] = [
  "visa",
  "mastercard",
  "amex",
  "rupay",
];

type NetworkRulesFile = Record<
  string,
  Record<string, { required: string[]; tools: string[] }>
>;

const RULES = networkRules as NetworkRulesFile;

const DEFAULT_TOOLS: InvestigationToolName[] = [
  "getOrderDetails",
  "getPaymentDetails",
  "getTrackingStatus",
];

export function identifyNetwork(
  payment: Record<string, unknown> | undefined,
  fallback: CardNetwork = "visa"
): CardNetwork {
  const network = String(payment?.cardNetwork ?? "").toLowerCase();
  if (network === "visa" || network === "mastercard" || network === "amex" || network === "rupay") {
    return network;
  }
  return fallback;
}

export function loadRulePack(
  network: CardNetwork,
  canonicalReason: CanonicalDisputeReason
): RulePack {
  const networkRules = RULES[network] ?? RULES.visa;
  const pack = networkRules[canonicalReason] ?? networkRules.ITEM_NOT_RECEIVED;

  if (!pack) {
    return {
      network,
      canonicalReason,
      required: ["payment_captured"],
      tools: DEFAULT_TOOLS,
    };
  }

  return {
    network,
    canonicalReason,
    required: pack.required,
    tools: pack.tools as InvestigationToolName[],
  };
}

export function mapRequirementsToTools(required: string[]): InvestigationToolName[] {
  const toolSet = new Set<InvestigationToolName>();

  for (const req of required) {
    if (req.includes("tracking") || req.includes("delivery") || req.includes("address")) {
      toolSet.add("getOrderDetails");
      toolSet.add("getFulfillmentDetails");
      toolSet.add("getTrackingStatus");
    }
    if (req.includes("payment") || req.includes("avs")) {
      toolSet.add("getPaymentDetails");
    }
    if (req.includes("customer")) {
      toolSet.add("getCustomerHistory");
    }
    if (req.includes("refund")) {
      toolSet.add("getRefundHistory");
    }
  }

  if (toolSet.size === 0) {
    return DEFAULT_TOOLS;
  }

  return Array.from(toolSet);
}

export function getRequirementLabel(id: string): string {
  return REQUIREMENT_LABELS[id] ?? id.replace(/_/g, " ");
}

export function formatRulePackDisplay(pack: RulePack): RulePackDisplay {
  return {
    network: pack.network,
    canonicalReason: pack.canonicalReason,
    requirements: pack.required.map((id) => ({
      id,
      label: getRequirementLabel(id),
    })),
    tools: pack.tools.map((name) => ({
      name,
      label: TOOL_LABELS[name] ?? name,
    })),
  };
}

export function formatRuleBookPrompt(pack: {
  network: string;
  canonicalReason: string;
  requirements: Array<{ id: string; label: string }>;
  tools: Array<{ name: string; label: string }>;
}): string {
  const requirements = pack.requirements
    .map((req, index) => `${index + 1}. ${req.label} (${req.id})`)
    .join("\n");
  const tools = pack.tools.map((tool) => `- ${tool.label}`).join("\n");
  return (
    `Card network rule book — ${pack.network.toUpperCase()} / ${pack.canonicalReason}:\n` +
    `Required evidence:\n${requirements}\n` +
    `Evidence tools to collect:\n${tools}`
  );
}

export function getNetworkRuleBook(network: CardNetwork): Array<{
  canonicalReason: CanonicalDisputeReason;
  requirements: RuleRequirementDisplay[];
  tools: Array<{ name: string; label: string }>;
}> {
  const networkRules = RULES[network] ?? RULES.visa;
  return Object.entries(networkRules).map(([canonicalReason, pack]) => ({
    canonicalReason: canonicalReason as CanonicalDisputeReason,
    requirements: pack.required.map((id) => ({
      id,
      label: getRequirementLabel(id),
    })),
    tools: pack.tools.map((name) => ({
      name,
      label: TOOL_LABELS[name as InvestigationToolName] ?? name,
    })),
  }));
}

export function getFullRuleBook(): Record<
  CardNetwork,
  ReturnType<typeof getNetworkRuleBook>
> {
  return {
    visa: getNetworkRuleBook("visa"),
    mastercard: getNetworkRuleBook("mastercard"),
    amex: getNetworkRuleBook("amex"),
    rupay: getNetworkRuleBook("rupay"),
    unknown: getNetworkRuleBook("visa"),
  };
}
