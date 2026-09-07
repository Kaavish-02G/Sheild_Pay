"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { MerchantNotification } from "@/shared/schemas";
import { fetchPendingReviews } from "@/lib/p4/api-client";

export default function ReviewNotificationBanner() {
  const [notifications, setNotifications] = useState<MerchantNotification[]>([]);

  const load = useCallback(async () => {
    const items = await fetchPendingReviews();
    setNotifications(items);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 space-y-3">
      {notifications.map((n) => (
        <div
          key={n.disputeId}
          className="dash-banner dash-banner-warn flex flex-wrap items-center justify-between gap-4"
        >
          <div>
            <p className="text-sm font-semibold">Review required: {n.orderId}</p>
            <p className="dash-muted mt-0.5 text-sm">{n.message}</p>
          </div>
          <Link href={`/dashboard/disputes/${n.disputeId}`} className="dash-btn-primary">
            Review now
          </Link>
        </div>
      ))}
    </div>
  );
}
