"use client";

import { useEffect } from "react";
import type { Dispute, MerchantSettings, VerifiedEvidencePackage } from "@/shared/schemas";
import EvidenceScoreBadge from "./EvidenceScoreBadge";
import AuditTrailTimeline from "./AuditTrailTimeline";
import MockEvidenceScreenshots from "./MockEvidenceScreenshots";
import NetworkRuleBookPanel from "./NetworkRuleBookPanel";

interface DisputePreviewModalProps {
  open: boolean;
  onClose: () => void;
  dispute: Dispute;
  evidence: VerifiedEvidencePackage;
  settings: MerchantSettings;
  responseText?: string;
  automationMessage?: string;
  gatewayReference?: string;
  onSendToPg?: () => void;
  sendingToPg?: boolean;
  pgSent?: boolean;
}

const STATUS_LABELS: Record<Dispute["status"], string> = {
  investigating: "Investigating",
  review: "Review",
  submitted: "Submitted",
  insufficient: "Insufficient",
};

export default function DisputePreviewModal({
  open,
  onClose,
  dispute,
  evidence,
  settings,
  responseText,
  automationMessage,
  gatewayReference,
  onSendToPg,
  sendingToPg,
  pgSent,
}: DisputePreviewModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const belowMinimum = evidence.confidenceScore < settings.minEvidenceScore;
  const belowAutoSubmit = evidence.confidenceScore < settings.autoSubmitThreshold;
  const aboveAmountLimit = dispute.amount > settings.reviewAmountLimit;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="dash-card flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dispute-preview-title"
      >
        <div className="flex items-center justify-between border-b border-[var(--dash-line)] px-6 py-4">
          <div>
            <h2 id="dispute-preview-title" className="dash-serif text-2xl">
              Dispute preview
            </h2>
            <p className="dash-muted text-sm">
              Full case file — auto-submit only when thresholds are met.
            </p>
          </div>
          <button type="button" onClick={onClose} className="dash-btn-ghost">
            Close
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Dispute Summary
            </h3>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Order ID</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">{dispute.orderId}</dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Dispute ID</dt>
                <dd className="font-mono text-xs text-slate-800 dark:text-slate-200">
                  {dispute.disputeId}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Reason</dt>
                <dd className="font-medium capitalize text-slate-900 dark:text-slate-100">
                  {(evidence.canonicalReason ?? dispute.canonicalReason ?? dispute.reason).replace(
                    /_/g,
                    " "
                  )}
                </dd>
              </div>
              {(evidence.cardNetwork ?? dispute.cardNetwork) && (
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Card Network</dt>
                  <dd className="font-medium uppercase text-slate-900 dark:text-slate-100">
                    {evidence.cardNetwork ?? dispute.cardNetwork}
                  </dd>
                </div>
              )}
              {(evidence.gateway ?? dispute.gateway) && (
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Payment Gateway</dt>
                  <dd className="font-medium capitalize text-slate-900 dark:text-slate-100">
                    {evidence.gateway ?? dispute.gateway}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Amount</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">
                  {dispute.currency} {dispute.amount.toFixed(2)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Status</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">
                  {STATUS_LABELS[dispute.status]}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Deadline</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">
                  {new Date(dispute.deadline).toLocaleString()}
                </dd>
              </div>
            </dl>
          </section>

          <div className="mt-5">
            <NetworkRuleBookPanel
              cardNetwork={evidence.cardNetwork ?? dispute.cardNetwork}
              canonicalReason={evidence.canonicalReason ?? dispute.canonicalReason}
              rulePack={evidence.rulePack}
              validation={evidence.validation}
            />
          </div>

          {evidence.validation && (
            <section className="mt-5 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Validation Results (against rule book)
                </h3>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    evidence.validation.allRequiredMet
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                  }`}
                >
                  {evidence.validation.checks.filter((c) => c.passed).length}/
                  {evidence.validation.checks.length} passed
                </span>
              </div>
              <ul className="mt-3 space-y-2">
                {evidence.validation.checks.map((check) => (
                  <li
                    key={check.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
                  >
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {check.label}
                      </p>
                      {check.value && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">{check.value}</p>
                      )}
                    </div>
                    <span
                      className={
                        check.passed
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }
                    >
                      {check.passed ? "Pass" : "Fail"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {evidence.strategy && (
            <section className="dash-card mt-5 p-4">
              <h3 className="text-sm font-semibold">AI strategy</h3>
              <p className="mt-1 text-xs uppercase tracking-wide text-violet-600 dark:text-violet-400">
                Focus: {evidence.strategy.focus.replace(/_/g, " ")}
              </p>
              <p className="mt-2 text-sm text-violet-900 dark:text-violet-100">
                {evidence.strategy.rationale}
              </p>
            </section>
          )}

          {evidence.rebuttalIterations && evidence.rebuttalIterations.length > 0 && (
            <section className="mt-5 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Draft → Critique → Revise
              </h3>
              <ul className="mt-3 space-y-3">
                {evidence.rebuttalIterations.map((iteration) => (
                  <li
                    key={iteration.iteration}
                    className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"
                  >
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      Iteration {iteration.iteration}{" "}
                      {iteration.approved ? "· Approved" : "· Revised"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Critique: {iteration.critique}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-5 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                AI Decision & Thresholds
              </h3>
              <EvidenceScoreBadge score={evidence.confidenceScore} size="sm" />
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-slate-500">Minimum evidence</dt>
                <dd className="font-medium">{settings.minEvidenceScore}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Auto-submit threshold</dt>
                <dd className="font-medium">{settings.autoSubmitThreshold}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Review amount limit</dt>
                <dd className="font-medium">
                  {dispute.currency} {settings.reviewAmountLimit.toFixed(2)}
                </dd>
              </div>
            </dl>
            <ul className="mt-3 space-y-1 text-sm">
              {belowMinimum && (
                <li className="text-red-600 dark:text-red-400">
                  Score below minimum ({settings.minEvidenceScore}) — not sent to PG
                  automatically. Use Send Request to PG after review.
                </li>
              )}
              {!belowMinimum && belowAutoSubmit && (
                <li className="text-amber-600 dark:text-amber-400">
                  Score below auto-submit threshold ({settings.autoSubmitThreshold}) —
                  merchant must send to PG manually.
                </li>
              )}
              {!belowMinimum && !belowAutoSubmit && !aboveAmountLimit && (
                <li className="text-emerald-600 dark:text-emerald-400">
                  Meets all thresholds — eligible for automatic PG submission.
                </li>
              )}
              {aboveAmountLimit && (
                <li className="text-amber-600 dark:text-amber-400">
                  Amount exceeds review limit — send to PG manually after approval.
                </li>
              )}
            </ul>
            {automationMessage && (
              <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {automationMessage}
              </p>
            )}
          </section>

          <section className="mt-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Verified Evidence
            </h3>
            {evidence.evidence.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">No evidence collected yet.</p>
            ) : (
              <dl className="mt-3 space-y-2">
                {evidence.evidence.map((field) => (
                  <div
                    key={field.key}
                    className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"
                  >
                    <dt className="text-xs uppercase text-slate-400">{field.label}</dt>
                    <dd className="text-sm text-slate-800 dark:text-slate-200">{field.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section className="mt-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Mock Evidence Screenshots (sent to PG)
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Payment receipt, delivery proof, and verified fields packaged for the payment gateway.
            </p>
            <div className="mt-3">
              <MockEvidenceScreenshots
                dispute={dispute}
                evidence={evidence}
                gatewayReference={gatewayReference}
              />
            </div>
          </section>

          <section className="mt-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              AI Audit Trail
            </h3>
            <div className="mt-3">
              <AuditTrailTimeline entries={evidence.ledger} />
            </div>
          </section>

          <section className="mt-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Generated Response
            </h3>
            <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              {responseText ? (
                <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                  {responseText}
                </p>
              ) : (
                <p className="text-sm text-slate-400">
                  Response will appear once the AI agent completes automation.
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-200 px-6 py-4 dark:border-slate-700 sm:flex-row">
          {onSendToPg && dispute.status !== "submitted" && !pgSent && (
            <button
              type="button"
              onClick={onSendToPg}
              disabled={sendingToPg || evidence.evidence.length === 0}
              className="dash-btn-primary flex-1 disabled:opacity-50"
            >
              {sendingToPg ? "Sending to PG…" : "Send Request to PG"}
            </button>
          )}
          {(pgSent || dispute.status === "submitted") && (
            <p className="dash-banner dash-banner-ok flex-1 text-sm">
              Submitted to payment gateway{gatewayReference ? `: ${gatewayReference}` : ""}
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="dash-btn-ghost"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
