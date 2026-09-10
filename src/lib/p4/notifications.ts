import type { MerchantNotification } from "@/shared/schemas";

const pendingReviews = new Map<string, MerchantNotification>();

export function addReviewNotification(notification: MerchantNotification): void {
  pendingReviews.set(notification.disputeId, notification);
  console.warn(
    "[P4] MERCHANT REVIEW REQUIRED — notification queued:",
    notification
  );
}

export function getPendingReviews(): MerchantNotification[] {
  return Array.from(pendingReviews.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function dismissReviewNotification(disputeId: string): void {
  pendingReviews.delete(disputeId);
}

export function hasReviewNotification(disputeId: string): boolean {
  return pendingReviews.has(disputeId);
}
