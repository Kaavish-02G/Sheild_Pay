import { DisputeSchema, type Dispute } from "@/shared/schemas";
import { mockOrderTotal } from "@/shared/mocks/order-variation";
import { fetchJson, getBaseUrl } from "./http";
import type { CanonicalDisputeReason, CardNetwork, GatewayType } from "@/shared/schemas";

export interface DisputeContext {
  disputeId: string;
  orderId: string;
  reason: string;
  amount: number;
  currency: string;
  canonicalReason?: CanonicalDisputeReason;
  cardNetwork?: CardNetwork;
  gateway?: GatewayType;
  merchantId?: string;
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

  throw new Error(`Dispute context unavailable for ${disputeId}`);
}

function toContext(dispute: Dispute): DisputeContext {
  return {
    disputeId: dispute.disputeId,
    orderId: dispute.orderId,
    reason: dispute.reason,
    amount: dispute.amount,
    currency: dispute.currency,
    canonicalReason: dispute.canonicalReason as CanonicalDisputeReason | undefined,
    cardNetwork: dispute.cardNetwork,
    gateway: dispute.gateway,
    merchantId: dispute.merchantId,
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
