"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Dispute, MerchantSettings, VerifiedEvidencePackage } from "@/shared/schemas";
import {
  fetchDispute,
  fetchEvidencePackage,
  fetchMerchantSettings,
  getDefaultMerchantId,
} from "@/lib/p4/api-client";
import EvidenceScoreBadge from "../../components/EvidenceScoreBadge";
import AuditTrailTimeline from "../../components/AuditTrailTimeline";
import AutomationPanel from "../../components/AutomationPanel";

const STATUS_LABELS: Record<Dispute["status"], string> = {
  investigating: "Investigating",
  review: "Review",
  submitted: "Submitted",
  insufficient: "Insufficient",
};

export default function DisputeDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [evidence, setEvidence] = useState<VerifiedEvidencePackage | null>(null);
  const [settings, setSettings] = useState<MerchantSettings | null>(null);
  const [responseText, setResponseText] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [disputeData, evidenceData, settingsData] = await Promise.all([
      fetchDispute(id),
      fetchEvidencePackage(id),
      fetchMerchantSettings(getDefaultMerchantId()),
    ]);

    if (!disputeData) {
      setError("Dispute not found");
      setLoading(false);
      return;
    }

    setDispute(disputeData);
    setEvidence(evidenceData);
    setSettings(settingsData.settings);
    if (disputeData.responseText) {
      setResponseText(disputeData.responseText);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="text-center text-slate-400 dark:text-slate-500">
        Loading dispute details…
      </div>
    );
  }

  if (error || !dispute || !evidence || !settings) {
    return (
      <div className="text-center">
        <p className="text-red-600">{error ?? "Failed to load dispute"}</p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/dashboard"
        className="text-sm text-blue-600 hover:underline dark:text-blue-400"
      >
        ← Back to disputes
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Dispute: {dispute.orderId}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {dispute.reason.replace(/_/g, " ")} · {dispute.currency}{" "}
            {dispute.amount.toFixed(2)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-300">
            {STATUS_LABELS[dispute.status]}
          </span>
          <EvidenceScoreBadge score={evidence.confidenceScore} size="lg" />
        </div>
      </div>

      <section className="mt-8">
        <AutomationPanel
          dispute={dispute}
          evidence={evidence}
          settings={settings}
          onStatusChange={(status) => setDispute({ ...dispute, status })}
          onResponseText={setResponseText}
        />
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Verified Evidence
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Evidence gathered by the AI investigation agent.
          </p>
          <dl className="mt-4 space-y-3">
            {evidence.evidence.map((field) => (
              <div
                key={field.key}
                className="rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800"
              >
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {field.label}
                  {field.source && (
                    <span className="ml-2 font-normal normal-case text-slate-300 dark:text-slate-600">
                      via {field.source}
                    </span>
                  )}
                </dt>
                <dd className="mt-1 text-sm text-slate-800 dark:text-slate-200">
                  {field.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            AI Audit Trail
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Step-by-step record of every tool call and decision.
          </p>
          <div className="mt-4">
            <AuditTrailTimeline entries={evidence.ledger} />
          </div>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Generated Response
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          AI-written dispute response based solely on verified evidence.
        </p>
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
          {responseText ? (
            <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
              {responseText}
            </p>
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Response will appear once the AI agent completes automation.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
