/**
 * Deterministic evidence scoring — weighted checklist (caps at 100).
 *
 * Weights (documented for audit / judges):
 * - Delivery confirmation present: +30
 * - Tracking matches fulfillment / address signal: +20
 * - Customer history clean (low dispute rate): +15
 * - Payment details consistent (captured, AVS/CVV ok): +15
 * - Refund history clean (no prior refunds on order): +10
 * - Fulfillment record complete (shipped + tracking): +10
 */
export function scoreEvidence(
  evidenceGathered: Record<string, unknown>,
  disputeReason: string
): number {
  let score = 0;

  const tracking = asRecord(evidenceGathered.tracking);
  const fulfillment = asRecord(evidenceGathered.fulfillment);
  const customer = asRecord(evidenceGathered.customer);
  const payment = asRecord(evidenceGathered.payment);
  const refunds = asRecord(evidenceGathered.refunds);

  if (tracking?.status === "delivered" || fulfillment?.deliveredAt) {
    score += 30;
  }

  const trackingNumber = stringOrNull(tracking?.trackingNumber);
  const fulfillmentTracking = stringOrNull(fulfillment?.trackingNumber);
  if (
    trackingNumber &&
    fulfillmentTracking &&
    trackingNumber === fulfillmentTracking
  ) {
    score += 20;
  } else if (trackingNumber || fulfillmentTracking) {
    score += 10;
  }

  const disputeCount = numberOrZero(customer?.disputeCount);
  const totalOrders = numberOrZero(customer?.totalOrders);
  if (totalOrders > 0 && disputeCount === 0) {
    score += 15;
  } else if (totalOrders > 0 && disputeCount <= 1) {
    score += 8;
  }

  const paymentStatus = stringOrNull(payment?.status);
  if (paymentStatus === "captured" || paymentStatus === "authorized") {
    score += 10;
    const avs = stringOrNull(payment?.avsResult)?.toLowerCase() ?? "";
    const cvv = stringOrNull(payment?.cvvResult)?.toLowerCase() ?? "";
    if (avs.includes("match") || avs.includes("pass")) {
      score += 3;
    }
    if (cvv.includes("match") || cvv.includes("pass")) {
      score += 2;
    }
  }

  const totalRefunded = numberOrZero(refunds?.totalRefunded);
  if (totalRefunded === 0) {
    score += 10;
  }

  const fulfillmentStatus = stringOrNull(fulfillment?.status);
  if (
    fulfillmentStatus === "fulfilled" &&
    (fulfillment?.shippedAt || fulfillment?.trackingNumber)
  ) {
    score += 10;
  }

  const reason = disputeReason.toLowerCase();
  if (reason.includes("fraud") && score >= 50) {
    score -= 5;
  }
  if (reason.includes("not received") && tracking?.status !== "delivered") {
    score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function mapScoreToStatus(
  confidenceScore: number
): "auto_submit" | "review" | "insufficient" {
  if (confidenceScore >= 85) {
    return "auto_submit";
  }
  if (confidenceScore >= 40) {
    return "review";
  }
  return "insufficient";
}
