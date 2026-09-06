import { DisputeSchema, type Dispute } from "@/shared/schemas";
import { mockOrderTotal } from "@/shared/mocks/order-variation";
import { fetchJson, getBaseUrl } from "./http";

export interface DisputeContext {
  disputeId: string;
  orderId: string;
  reason: string;
  amount: number;
  currency: string;
}

export async function fetchDisputeContext(
  disputeId: string
): Promise<DisputeContext> {
  const result = await fetchJson(
    `${getBaseUrl()}/api/core/disputes/${encodeURIComponent(disputeId)}`
  );

  if (result.ok) {
    const payload = result.data as { dispute?: unknown };
    const parsed = DisputeSchema.safeParse(payload.dispute ?? result.data);
    if (parsed.success) {
      return toContext(parsed.data);
    }
  }

  console.warn(
    `[P3] GET /api/core/disputes/${disputeId} unavailable (${result.ok ? "invalid payload" : result.error}) — using minimal context. TODO: needs P1 route`
  );

  return {
    disputeId,
    orderId: disputeId.startsWith("sim-") ? "1042" : "1042",
    reason: "chargeback",
    amount: mockOrderTotal("1042"),
    currency: "USD",
  };
}

function toContext(dispute: Dispute): DisputeContext {
  return {
    disputeId: dispute.disputeId,
    orderId: dispute.orderId,
    reason: dispute.reason,
    amount: dispute.amount,
    currency: dispute.currency,
  };
}

export async function persistDisputeStatus(
  disputeId: string,
  status: "review" | "insufficient"
): Promise<boolean> {
  const result = await fetchJson(
    `${getBaseUrl()}/api/core/disputes/${encodeURIComponent(disputeId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }
  );

  if (!result.ok) {
    console.warn(
      `[P3] PATCH /api/core/disputes/${disputeId} failed — status buffered in response only:`,
      result.error
    );
    return false;
  }

  return true;
}

export async function persistEvidencePackage(
  disputeId: string,
  pkg: Record<string, unknown>
): Promise<boolean> {
  const result = await fetchJson(
    `${getBaseUrl()}/api/core/disputes/${encodeURIComponent(disputeId)}`,
    {
      method: "POST",
      body: JSON.stringify({ package: pkg }),
    }
  );

  if (!result.ok) {
    console.warn(
      `[P3] POST /api/core/disputes/${disputeId} evidence failed:`,
      result.error
    );
    return false;
  }

  return true;
}
