import { getDisputesNearDeadline } from "./models";

export interface DeadlineWarning {
  disputeId: string;
  orderId: string;
  merchantId: string;
  deadline: string;
  status: string;
  hoursRemaining: number;
}

export async function checkApproachingDeadlines(): Promise<DeadlineWarning[]> {
  const disputes = await getDisputesNearDeadline(24);
  const warnings: DeadlineWarning[] = [];

  for (const dispute of disputes) {
    const deadlineMs = new Date(dispute.deadline).getTime();
    const hoursRemaining = (deadlineMs - Date.now()) / (1000 * 60 * 60);

    const warning: DeadlineWarning = {
      disputeId: dispute.disputeId,
      orderId: dispute.orderId,
      merchantId: dispute.merchantId,
      deadline: dispute.deadline,
      status: dispute.status,
      hoursRemaining: Math.round(hoursRemaining * 10) / 10,
    };

    console.warn(
      `[deadline-monitor] URGENT: Dispute ${dispute.disputeId} (order ${dispute.orderId}) ` +
        `deadline in ${warning.hoursRemaining}h — status: ${dispute.status}`
    );

    warnings.push(warning);
  }

  if (warnings.length === 0) {
    console.log("[deadline-monitor] No disputes with deadlines within 24 hours.");
  }

  return warnings;
}
