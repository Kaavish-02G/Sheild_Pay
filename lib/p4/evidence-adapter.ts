import {
  AgentVerifiedEvidencePackageSchema,
  VerifiedEvidencePackageSchema,
  type AgentVerifiedEvidencePackage,
  type AuditLedgerEntry,
  type EvidenceField,
  type LedgerEntry,
  type VerifiedEvidencePackage,
} from "@/shared/schemas";

function evidenceRecordToFields(
  evidence: Record<string, unknown>
): EvidenceField[] {
  const fields: EvidenceField[] = [];

  const order = evidence.order as Record<string, unknown> | undefined;
  if (order) {
    fields.push({
      key: "order_id",
      label: "Order ID",
      value: String(order.orderId ?? "unknown"),
      source: "getOrderDetails",
    });
    if (order.totalAmount != null) {
      fields.push({
        key: "order_total",
        label: "Order Total",
        value: `${order.totalAmount} ${order.currency ?? "USD"}`,
        source: "getOrderDetails",
      });
    }
  }

  const customer = evidence.customer as Record<string, unknown> | undefined;
  if (customer?.email) {
    fields.push({
      key: "customer_email",
      label: "Customer Email",
      value: String(customer.email),
      source: "getCustomerHistory",
    });
  }

  const tracking = evidence.tracking as Record<string, unknown> | undefined;
  if (tracking) {
    if (tracking.trackingNumber) {
      fields.push({
        key: "tracking_number",
        label: "Tracking Number",
        value: String(tracking.trackingNumber),
        source: "getTrackingStatus",
      });
    }
    if (tracking.status) {
      fields.push({
        key: "delivery_status",
        label: "Delivery Status",
        value: String(tracking.status),
        source: "getTrackingStatus",
      });
    }
  }

  const payment = evidence.payment as Record<string, unknown> | undefined;
  if (payment?.status) {
    fields.push({
      key: "payment_status",
      label: "Payment Status",
      value: String(payment.status),
      source: "getPaymentDetails",
    });
  }

  return fields;
}

function ledgerToAudit(entries: LedgerEntry[]): AuditLedgerEntry[] {
  return entries.map((entry) => ({
    tool: entry.toolCalled ?? "reasoning",
    reasoning: entry.reasoning,
    resultSummary: entry.toolOutput
      ? JSON.stringify(entry.toolOutput).slice(0, 200)
      : "No tool output",
    timestamp: entry.timestamp,
  }));
}

export function isAgentPackage(
  data: unknown
): data is AgentVerifiedEvidencePackage {
  return AgentVerifiedEvidencePackageSchema.safeParse(data).success;
}

export function toDashboardEvidencePackage(
  raw: unknown,
  disputeReason = "chargeback"
): VerifiedEvidencePackage {
  if (isAgentPackage(raw)) {
    return VerifiedEvidencePackageSchema.parse({
      disputeId: raw.disputeId,
      disputeReason,
      confidenceScore: raw.confidenceScore,
      evidence: evidenceRecordToFields(raw.evidence),
      ledger: ledgerToAudit(raw.ledger),
      generatedAt: new Date().toISOString(),
      canonicalReason: raw.canonicalReason,
      cardNetwork: raw.cardNetwork,
      gateway: raw.gateway,
      rulePack: raw.rulePack,
      validation: raw.validation,
      strategy: raw.strategy,
      rebuttalIterations: raw.rebuttalIterations,
    });
  }

  return VerifiedEvidencePackageSchema.parse(raw);
}

export function agentPackageToSubmitText(
  pkg: AgentVerifiedEvidencePackage,
  disputeReason: string
): VerifiedEvidencePackage {
  return toDashboardEvidencePackage(pkg, disputeReason);
}
