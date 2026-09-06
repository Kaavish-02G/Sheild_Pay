"use client";

import { useState } from "react";
import type { Dispute, MerchantSettings, VerifiedEvidencePackage } from "@/shared/schemas";
import { submitDispute } from "@/lib/p4/api-client";
import EvidenceScoreBadge from "./EvidenceScoreBadge";

interface ApprovalPanelProps {
  dispute: Dispute;
  evidence: VerifiedEvidencePackage;
  settings: MerchantSettings;
  responseText: string;
  onSubmitted: () => void;
}

export default function ApprovalPanel({
  dispute,
  evidence,
  settings,
  responseText,
  onSubmitted,
}: ApprovalPanelProps) {
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(dispute.status === "submitted");

  if (dispute.status === "insufficient") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
        <h3 className="text-lg font-semibold text-red-900 dark:text-red-300">
          Insufficient Evidence — Manual Handling Required
        </h3>
        <p className="mt-2 text-sm text-red-700 dark:text-red-400">
          The AI agent could not gather enough evidence to build a strong dispute response.
          Evidence confidence ({evidence.confidenceScore}%) is below the minimum threshold
          ({settings.minEvidenceScore}%). Please review this case manually or gather
          additional documentation before submitting.
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Dispute Submitted</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          This dispute response has been submitted to the payment gateway for review.
        </p>
      </div>
    );
  }

  const needsApproval =
    dispute.status === "review" ||
    evidence.confidenceScore < settings.autoSubmitThreshold;

  const handleApprove = async () => {
    setSubmitting(true);
    setToast(null);
    try {
      const result = await submitDispute(dispute.disputeId, evidence);
      if (result.success) {
        setSubmitted(true);
        onSubmitted();
      } else if ("unavailable" in result && result.unavailable) {
        setToast("Submission service not yet available");
      } else {
        setToast("error" in result ? result.error : "Submission failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Approval & Submission</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Evidence confidence: <EvidenceScoreBadge score={evidence.confidenceScore} size="sm" />
            {needsApproval && (
              <span className="ml-2 text-amber-600 dark:text-amber-400">
                · Requires merchant approval
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={handleApprove}
          disabled={submitting || !responseText}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Approve & Submit"}
        </button>
      </div>

      {toast && (
        <div className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          {toast}
        </div>
      )}

      {!responseText && (
        <p className="mt-3 text-sm text-slate-400 dark:text-slate-500">
          Waiting for AI response generation before submission is available.
        </p>
      )}
    </div>
  );
}
