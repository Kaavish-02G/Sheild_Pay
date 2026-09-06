import { createDispute } from "./models";
import { startAutonomousDisputePipeline } from "./pipeline";
import type { DisputeEvent } from "@/shared/schemas";

export async function handleDisputeEvent(event: DisputeEvent): Promise<void> {
  await createDispute({
    disputeId: event.disputeId,
    orderId: event.orderId,
    merchantId: event.merchantId,
    reason: event.reason,
    amount: event.amount,
    currency: event.currency,
    deadline: event.deadline,
    status: "investigating",
  });

  startAutonomousDisputePipeline(event.disputeId);
}
