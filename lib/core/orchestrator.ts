import type { DisputeEvent } from "@/shared/schemas";
import { createDispute } from "./models";

function getBaseUrl(): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  const port = process.env.PORT ?? "3000";
  return `http://localhost:${port}`;
}

export async function invokeP3(disputeId: string): Promise<void> {
  if (process.env.SKIP_P3_INVOKE === "true") {
    return;
  }

  const url = `${getBaseUrl()}/api/p3/invoke`;
  const payload = { disputeId };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn(
        `[orchestrator] P3 invoke returned ${response.status} for dispute ${disputeId}`
      );
    }
  } catch (error) {
    console.warn(
      `[orchestrator] P3 endpoint not available — logging payload for standalone dev:`,
      payload,
      error instanceof Error ? error.message : error
    );
  }
}

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

  await invokeP3(event.disputeId);
}
