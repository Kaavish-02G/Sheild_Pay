"use client";

import { useCallback, useEffect, useState } from "react";
import type { Dispute } from "@/shared/schemas";
import { fetchDisputes, fetchDisputeSnapshot } from "@/lib/p4/api-client";
import DisputeCard from "./components/DisputeCard";
import SimulateDisputeModal from "./components/SimulateDisputeModal";
import ReviewNotificationBanner from "./components/ReviewNotificationBanner";
import MockAlertsPanel from "./components/MockAlertsPanel";

export default function DashboardPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [scores, setScores] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);

  const loadDisputes = useCallback(async () => {
    setLoading(true);
    const list = await fetchDisputes();
    setDisputes(list);
    setLoading(false);

    const scoreMap: Record<string, number | null> = {};
    list.forEach((d) => {
      scoreMap[d.disputeId] = null;
    });
    setScores(scoreMap);

    list.forEach(async (d) => {
      try {
        const snapshot = await fetchDisputeSnapshot(d.disputeId);
        const score = snapshot.evidence?.confidenceScore ?? null;
        if (score != null) {
          setScores((prev) => ({ ...prev, [d.disputeId]: score }));
        }
      } catch {
        // keep pending
      }
    });
  }, []);

  useEffect(() => {
    loadDisputes();
  }, [loadDisputes]);

  return (
    <div>
      <ReviewNotificationBanner />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Disputes
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Cases arrive automatically when a Northline order is placed. Green tag = sent to PG,
            red tag = needs your action.
          </p>
        </div>
        <SimulateDisputeModal onSuccess={loadDisputes} />
      </div>

      {loading ? (
        <div className="mt-10 text-center text-slate-400 dark:text-slate-500">
          Loading disputes…
        </div>
      ) : disputes.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-600 dark:bg-slate-800">
          <p className="text-slate-500 dark:text-slate-400">No disputes yet.</p>
          <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
            Place an order in the <a href="/shop" className="underline">Northline store</a> — the
            merchant desk is populated automatically.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {disputes.map((dispute) => (
            <DisputeCard
              key={dispute.disputeId}
              dispute={dispute}
              confidenceScore={scores[dispute.disputeId]}
            />
          ))}
        </div>
      )}

      <MockAlertsPanel />
    </div>
  );
}
