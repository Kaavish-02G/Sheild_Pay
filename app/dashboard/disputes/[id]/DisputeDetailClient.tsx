"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import type { Dispute, MerchantSettings, VerifiedEvidencePackage } from "@/shared/schemas";
import {
  fetchDisputeSnapshot,
  fetchMerchantSettings,
  getDefaultMerchantId,
} from "@/lib/p4/api-client";
import EvidenceScoreBadge from "../../components/EvidenceScoreBadge";
import AuditTrailTimeline from "../../components/AuditTrailTimeline";
import AutomationPanel from "../../components/AutomationPanel";
import DisputePreviewModal from "../../components/DisputePreviewModal";
import LiveAgentBanner from "../../components/LiveAgentBanner";
import MockEvidenceScreenshots from "../../components/MockEvidenceScreenshots";
import InterventionTag from "../../components/InterventionTag";
import NetworkRuleBookPanel from "../../components/NetworkRuleBookPanel";
import { sendToPaymentGateway } from "@/lib/p4/api-client";

const STATUS_LABELS: Record<Dispute["status"], string> = {
  investigating: "Investigating",
  review: "Review",
  submitted: "Submitted",
  insufficient: "Insufficient",
};

const EMPTY_EVIDENCE = (disputeId: string): VerifiedEvidencePackage => ({
  disputeId,
  disputeReason: "chargeback",
  confidenceScore: 0,
  evidence: [],
  ledger: [],
  generatedAt: new Date().toISOString(),
});

export default function DisputeDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const liveMode = searchParams.get("live") === "1";
  const previewParam = searchParams.get("preview") === "1";
  const previewAutoOpened = useRef(false);

  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [evidence, setEvidence] = useState<VerifiedEvidencePackage | null>(null);
  const [settings, setSettings] = useState<MerchantSettings | null>(null);
  const [responseText, setResponseText] = useState<string>("");
  const [gatewayReference, setGatewayReference] = useState<string | undefined>();
  const [sendingToPg, setSendingToPg] = useState(false);
  const [pgSent, setPgSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const loadSnapshot = useCallback(async () => {
    const [snapshot, settingsData] = await Promise.all([
      fetchDisputeSnapshot(id),
      fetchMerchantSettings(getDefaultMerchantId()),
    ]);

    if (!snapshot.dispute) {
      return { found: false as const, settings: settingsData.settings };
    }

    return {
      found: true as const,
      dispute: snapshot.dispute,
      evidence: snapshot.evidence ?? EMPTY_EVIDENCE(id),
      settings: settingsData.settings,
      responseText: snapshot.dispute.responseText,
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    const run = async (attempt = 0) => {
      const result = await loadSnapshot();
      if (cancelled) return;

      if (!result.found) {
        if (liveMode && attempt < 8) {
          setTimeout(() => void run(attempt + 1), 400);
          return;
        }
        setError("Dispute not found");
        setLoading(false);
        return;
      }

      setDispute(result.dispute);
      setEvidence(result.evidence);
      setSettings(result.settings);
      if (result.dispute.status === "submitted") {
        setPgSent(true);
      }
      if (result.responseText) {
        setResponseText(result.responseText);
      }
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [loadSnapshot, liveMode]);

  const isAgentRunning = useMemo(() => {
    if (!dispute) return false;
    return dispute.status === "investigating" && !responseText;
  }, [dispute, responseText]);

  useEffect(() => {
    const shouldPoll =
      liveMode ||
      dispute?.status === "investigating" ||
      (dispute != null && !responseText && dispute.status !== "submitted");

    if (!shouldPoll) return;

    const interval = setInterval(() => {
      void loadSnapshot().then((result) => {
        if (!result.found) return;
        setDispute(result.dispute);
        setEvidence(result.evidence);
        setSettings(result.settings);
        if (result.responseText) {
          setResponseText(result.responseText);
        }
      });
    }, 600);

    return () => clearInterval(interval);
  }, [liveMode, dispute?.status, responseText, loadSnapshot]);

  const canShowPreview =
    (evidence?.ledger.length ?? 0) > 0 || Boolean(responseText) || (evidence?.evidence.length ?? 0) > 0;

  useEffect(() => {
    if (!previewParam || !canShowPreview || previewAutoOpened.current) return;
    previewAutoOpened.current = true;
    setPreviewOpen(true);
  }, [previewParam, canShowPreview]);

  const handleClosePreview = useCallback(() => {
    previewAutoOpened.current = true;
    setPreviewOpen(false);
    if (typeof window !== "undefined" && previewParam) {
      const url = new URL(window.location.href);
      url.searchParams.delete("preview");
      const qs = url.searchParams.toString();
      window.history.replaceState(null, "", qs ? `${url.pathname}?${qs}` : url.pathname);
    }
  }, [previewParam]);

  const toolSteps = useMemo(
    () =>
      evidence?.ledger.filter((entry) => entry.tool !== "reasoning").length ?? 0,
    [evidence?.ledger]
  );

  const investigationComplete = useMemo(() => {
    if (!evidence) return false;
    return evidence.ledger.some((entry) =>
      entry.reasoning.includes("Investigation complete")
    );
  }, [evidence?.ledger]);

  const displayAmount = useMemo(() => {
    const orderTotalField = evidence?.evidence.find((field) => field.key === "order_total");
    if (orderTotalField) {
      const match = orderTotalField.value.match(/([\d.]+)/);
      if (match) {
        return parseFloat(match[1]);
      }
    }
    return dispute?.amount ?? 0;
  }, [evidence?.evidence, dispute?.amount]);

  const handleSendToPg = useCallback(async () => {
    if (!evidence) return;
    setSendingToPg(true);
    try {
      const result = await sendToPaymentGateway(id, evidence);
      if (result.success) {
        setGatewayReference(result.gatewayReference);
        setPgSent(true);
        setDispute((prev) => (prev ? { ...prev, status: "submitted" } : prev));
      }
    } finally {
      setSendingToPg(false);
    }
  }, [evidence, id]);

  if (loading) {
    return (
      <div className="text-center text-slate-400 dark:text-slate-500">
        Opening live agent view…
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
            {(evidence.canonicalReason ?? dispute.canonicalReason ?? dispute.reason).replace(
              /_/g,
              " "
            )}
            {(evidence.cardNetwork ?? dispute.cardNetwork)
              ? ` · ${(evidence.cardNetwork ?? dispute.cardNetwork)?.toUpperCase()}`
              : ""}{" "}
            · {dispute.currency} {displayAmount.toFixed(2)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <InterventionTag dispute={dispute} size="md" />
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition ${
              dispute.status === "insufficient" ||
              evidence.confidenceScore < settings.minEvidenceScore
                ? "bg-red-600 text-white hover:bg-red-700"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            }`}
          >
            Preview
          </button>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-300">
            {STATUS_LABELS[dispute.status]}
          </span>
          {evidence.confidenceScore > 0 && (
            <EvidenceScoreBadge score={evidence.confidenceScore} size="lg" />
          )}
        </div>
      </div>

      {evidence.confidenceScore > 0 && (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Confidence score {evidence.confidenceScore}/100 — auto-submit threshold is{" "}
          {settings.autoSubmitThreshold}, minimum evidence is {settings.minEvidenceScore}.
          {evidence.confidenceScore < settings.minEvidenceScore
            ? " Below minimum — not auto-submitted. Review preview and use Send Request to PG."
            : evidence.confidenceScore < settings.autoSubmitThreshold
              ? " Below auto-submit threshold — merchant review required before sending to PG."
              : dispute.amount > settings.reviewAmountLimit
                ? " Amount exceeds review limit — send to PG manually after review."
                : " Meets thresholds — AI auto-submits to the payment gateway."}
        </p>
      )}

      {(isAgentRunning || investigationComplete) && (
        <section className="mt-6">
          <LiveAgentBanner
            ledgerSteps={evidence.ledger.length}
            toolSteps={toolSteps}
            targetSteps={3}
            isComplete={investigationComplete && isAgentRunning}
          />
        </section>
      )}

      {canShowPreview && (
        <section className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800/40">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Case Preview
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Full dispute preview with mock payment receipt and delivery proof — always available
                for merchant review.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition ${
                evidence.confidenceScore < settings.minEvidenceScore ||
                dispute.status === "insufficient"
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-violet-600 text-white hover:bg-violet-700"
              }`}
            >
              Open Full Preview
            </button>
          </div>
          <div className="mt-5">
            <MockEvidenceScreenshots
              dispute={dispute}
              evidence={evidence}
              gatewayReference={gatewayReference}
            />
          </div>
        </section>
      )}

      <section className="mt-8">
        <NetworkRuleBookPanel
          cardNetwork={evidence.cardNetwork ?? dispute.cardNetwork}
          canonicalReason={evidence.canonicalReason ?? dispute.canonicalReason}
          rulePack={evidence.rulePack}
          validation={evidence.validation}
        />
      </section>

      <section className="mt-8">
          <AutomationPanel
            dispute={dispute}
            evidence={evidence}
            settings={settings}
            responseText={responseText}
            serverManaged
            onStatusChange={(status) => setDispute({ ...dispute, status })}
            onResponseText={setResponseText}
            onGatewayReference={setGatewayReference}
          />
        </section>

      {(pgSent || dispute.status === "submitted") && !canShowPreview && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Mock Payment Receipt & Delivery Proof
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Evidence screenshots packaged and sent to the payment gateway.
          </p>
          <div className="mt-4">
            <MockEvidenceScreenshots
              dispute={dispute}
              evidence={evidence}
              gatewayReference={gatewayReference}
            />
          </div>
        </section>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Verified Evidence
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Evidence gathered by the AI investigation agent.
          </p>
          {evidence.evidence.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">
              Waiting for agent step 1…
            </p>
          ) : (
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
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            AI Audit Trail
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Live step-by-step reasoning — updates every second while the agent runs.
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
              {isAgentRunning
                ? "Response will appear after the 3-step investigation completes…"
                : "Response will appear once the AI agent completes automation."}
            </p>
          )}
        </div>
      </section>

      <DisputePreviewModal
        open={previewOpen}
        onClose={handleClosePreview}
        dispute={dispute}
        evidence={evidence}
        settings={settings}
        responseText={responseText || undefined}
        gatewayReference={gatewayReference}
        onSendToPg={handleSendToPg}
        sendingToPg={sendingToPg}
        pgSent={pgSent || dispute.status === "submitted"}
      />
    </div>
  );
}
