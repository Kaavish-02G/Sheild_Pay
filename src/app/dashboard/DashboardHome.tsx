"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Dispute } from "@/shared/schemas";
import { fetchDisputes, fetchDisputeSnapshot } from "@/lib/p4/api-client";
import DisputeCard from "./components/DisputeCard";
import SimulateDisputeModal from "./components/SimulateDisputeModal";
import ReviewNotificationBanner from "./components/ReviewNotificationBanner";
import MockAlertsPanel from "./components/MockAlertsPanel";

export default function DashboardHome() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "alerts" ? "alerts" : "cases";
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

  if (view === "alerts") {
    return <MockAlertsPanel />;
  }

  return (
    <div>
      <ReviewNotificationBanner />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="dash-kicker">Open cases</p>
          <h1 className="dash-title mt-2">Disputes</h1>
          <p className="dash-muted mt-2 max-w-xl text-sm leading-6">
            Cases arrive when a Northline order is placed. Green means submitted to the
            gateway; rust means the desk still needs a decision.
          </p>
        </div>
        <SimulateDisputeModal onSuccess={loadDisputes} />
      </div>

      {loading ? (
        <div className="dash-muted mt-12 text-sm">Loading cases…</div>
      ) : disputes.length === 0 ? (
        <div className="dash-card mt-10 px-8 py-14 text-center">
          <p className="dash-serif text-2xl">No disputes yet</p>
          <p className="dash-muted mx-auto mt-2 max-w-md text-sm leading-6">
            Place an order in the{" "}
            <a href="/shop" className="underline decoration-[var(--dash-gold)] underline-offset-4">
              Northline store
            </a>
            . The merchant desk is populated automatically.
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
