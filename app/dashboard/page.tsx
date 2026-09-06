"use client";

import { useCallback, useEffect, useState } from "react";
import type { Dispute } from "@/shared/schemas";
import { fetchDisputes, fetchEvidencePackage, runDisputeAutomation } from "@/lib/p4/api-client";
import DisputeCard from "./components/DisputeCard";
import SimulateDisputeModal from "./components/SimulateDisputeModal";
import ReviewNotificationBanner from "./components/ReviewNotificationBanner";

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
      if (d.status === "investigating") {
        runDisputeAutomation(d.disputeId).catch(() => {});
      }
      try {
        const pkg = await fetchEvidencePackage(d.disputeId);
        setScores((prev) => ({ ...prev, [d.disputeId]: pkg.confidenceScore }));
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
            Fully agentic dispute handling — you only intervene above your review limit.
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
            Use &ldquo;Simulate Incoming Dispute&rdquo; to create a test case.
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
    </div>
  );
}
