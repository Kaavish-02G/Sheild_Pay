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
          className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20"
        >
          <div>
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Review required: {n.orderId}
            </p>
            <p className="mt-0.5 text-sm text-amber-800 dark:text-amber-300">{n.message}</p>
          </div>
          <Link
            href={`/dashboard/disputes/${n.disputeId}`}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Review Now
          </Link>
        </div>
      ))}
    </div>
  );
}
