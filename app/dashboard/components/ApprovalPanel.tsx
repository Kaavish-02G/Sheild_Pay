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
      <div className="dash-banner dash-banner-warn">
        <h3 className="dash-serif text-2xl">Insufficient evidence</h3>
        <p className="mt-2 text-sm leading-6">
          Confidence ({evidence.confidenceScore}%) is below the minimum (
          {settings.minEvidenceScore}%). Review the case or send to the gateway manually.
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="dash-banner dash-banner-ok">
        <h3 className="dash-serif text-2xl">Submitted</h3>
        <p className="mt-2 text-sm leading-6">
          This response has been sent to the payment gateway.
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
    <div className="dash-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="dash-serif text-2xl">Approval</h3>
          <p className="mt-1 text-sm">
            Evidence confidence: <EvidenceScoreBadge score={evidence.confidenceScore} size="sm" />
            {needsApproval && <span className="ml-2 text-[var(--dash-warn)]">· Needs approval</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={handleApprove}
          disabled={submitting || !responseText}
          className="dash-btn-primary disabled:cursor-not-allowed"
        >
          {submitting ? "Submitting…" : "Approve & submit"}
        </button>
      </div>

      {toast && <div className="dash-banner dash-banner-warn mt-4 text-sm">{toast}</div>}

      {!responseText && (
        <p className="dash-muted mt-3 text-sm">Waiting for the rebuttal before submit is available.</p>
      )}
    </div>
  );
}
