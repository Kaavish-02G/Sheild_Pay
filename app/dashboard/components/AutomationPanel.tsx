"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AutomationResult,
  Dispute,
  MerchantSettings,
  VerifiedEvidencePackage,
} from "@/shared/schemas";
import { runDisputeAutomation, submitDisputeAfterReview } from "@/lib/p4/api-client";
import EvidenceScoreBadge from "./EvidenceScoreBadge";

interface AutomationPanelProps {
  dispute: Dispute;
  evidence: VerifiedEvidencePackage;
  settings: MerchantSettings;
  onStatusChange: (status: Dispute["status"]) => void;
  onResponseText: (text: string) => void;
}

export default function AutomationPanel({
  dispute,
  evidence,
  settings,
  onStatusChange,
  onResponseText,
}: AutomationPanelProps) {
  const [result, setResult] = useState<AutomationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const runAutomation = useCallback(async () => {
    if (dispute.status === "submitted") {
      setResult({
        action: "already_submitted",
        disputeId: dispute.disputeId,
        message: "This dispute has already been submitted.",
      });
      return;
    }

    setRunning(true);
    setToast(null);
    try {
      const automationResult = await runDisputeAutomation(dispute.disputeId);
      setResult(automationResult);
      if (automationResult.responseText) {
        onResponseText(automationResult.responseText);
      }
      if (automationResult.action === "auto_submitted") {
        onStatusChange("submitted");
      } else if (
        automationResult.action === "review_required" ||
        automationResult.action === "insufficient"
      ) {
        onStatusChange(automationResult.action === "insufficient" ? "insufficient" : "review");
      }
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Automation failed");
    } finally {
      setRunning(false);
    }
  }, [dispute.disputeId, dispute.status, onResponseText, onStatusChange]);

  useEffect(() => {
    runAutomation();
  }, [runAutomation]);

  const handleManualSubmit = async () => {
    setSubmitting(true);
    setToast(null);
    try {
      const submitResult = await submitDisputeAfterReview(
        dispute.disputeId,
        evidence,
        result?.responseText
      );
      if (submitResult.success) {
        onStatusChange("submitted");
        setResult({
          action: "already_submitted",
          disputeId: dispute.disputeId,
          message: "Dispute submitted after merchant review.",
          responseText: result?.responseText,
        });
      } else if ("unavailable" in submitResult && submitResult.unavailable) {
        setToast("Submission service not yet available");
      } else {
        setToast("error" in submitResult ? submitResult.error : "Submission failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (running) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-900/20">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200">
          AI Agent Running…
        </h3>
        <p className="mt-2 text-sm text-blue-700 dark:text-blue-300">
          Investigating evidence, generating response, and evaluating auto-submission rules.
        </p>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  if (result.action === "insufficient") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
        <h3 className="text-lg font-semibold text-red-900 dark:text-red-300">
          Insufficient Evidence — Escalated
        </h3>
        <p className="mt-2 text-sm text-red-700 dark:text-red-400">{result.message}</p>
      </div>
    );
  }

  if (result.action === "auto_submitted" || result.action === "already_submitted") {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-800 dark:bg-emerald-900/20">
        <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-300">
          Auto-Submitted by AI Agent
        </h3>
        <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">{result.message}</p>
        <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-500">
          Amount {dispute.currency} {dispute.amount.toFixed(2)} is within your review limit of{" "}
          {dispute.currency} {settings.reviewAmountLimit.toFixed(2)}.
        </p>
      </div>
    );
  }

  if (result.action === "review_required") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20">
        <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-300">
          Merchant Review Required
        </h3>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">{result.message}</p>
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
          Evidence confidence:{" "}
          <EvidenceScoreBadge score={evidence.confidenceScore} size="sm" />
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleManualSubmit}
            disabled={submitting || !result.responseText}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Approve & Submit"}
          </button>
          <span className="text-xs text-amber-600 dark:text-amber-500">
            Only needed because this dispute exceeds your review amount limit.
          </span>
        </div>
        {toast && (
          <div className="mt-4 rounded-md bg-amber-100 px-4 py-3 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
            {toast}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Automation Paused
      </h3>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{result.message}</p>
      <button
        type="button"
        onClick={runAutomation}
        className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Retry Automation
      </button>
      {toast && <p className="mt-3 text-sm text-red-600">{toast}</p>}
    </div>
  );
}
