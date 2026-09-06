import type { Dispute } from "@/shared/schemas";
import type { Dispute as DbDispute } from "./models";

export function toDisputeResponse(doc: DbDispute): Dispute {
  return {
    disputeId: doc.disputeId,
    orderId: doc.orderId,
    merchantId: doc.merchantId,
    reason: doc.reason,
    amount: doc.amount,
    currency: doc.currency,
    deadline: doc.deadline,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
  };
}
