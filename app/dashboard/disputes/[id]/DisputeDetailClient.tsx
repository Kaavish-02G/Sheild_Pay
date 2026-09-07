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
    return <div className="dash-muted text-sm">Opening case…</div>;
  }

  if (error || !dispute || !evidence || !settings) {
    return (
      <div>
        <p className="text-[var(--dash-bad)]">{error ?? "Failed to load dispute"}</p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-[var(--dash-gold)]">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link href="/dashboard" className="text-sm text-[var(--dash-gold)]">
        ← Cases
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="dash-kicker">Case file</p>
          <h1 className="dash-title mt-1">{dispute.orderId}</h1>
          <p className="dash-muted mt-1 text-sm">
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
            className={
              dispute.status === "insufficient" ||
              evidence.confidenceScore < settings.minEvidenceScore
                ? "dash-btn-danger"
                : "dash-btn-ghost"
            }
          >
            Preview
          </button>
          <span className="dash-chip">{STATUS_LABELS[dispute.status]}</span>
          {evidence.confidenceScore > 0 && (
            <EvidenceScoreBadge score={evidence.confidenceScore} size="lg" />
          )}
        </div>
      </div>

      {evidence.confidenceScore > 0 && (
        <p className="dash-muted mt-3 text-sm leading-6">
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
        <section className="dash-card mt-8 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="dash-serif text-2xl">Case preview</h2>
              <p className="dash-muted mt-1 text-sm leading-6">
                Receipt and delivery placeholders from verified evidence fields — always available
                for review.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className={
                evidence.confidenceScore < settings.minEvidenceScore ||
                dispute.status === "insufficient"
                  ? "dash-btn-danger"
                  : "dash-btn-primary"
              }
            >
              Open full preview
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
          <h2 className="dash-serif text-2xl">Receipt & delivery proof</h2>
          <p className="dash-muted mt-1 text-sm">
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
          <h2 className="dash-serif text-2xl">Verified evidence</h2>
          <p className="dash-muted mt-1 text-sm">Gathered against the network rule pack.</p>
          {evidence.evidence.length === 0 ? (
            <p className="dash-muted mt-4 text-sm">Waiting for investigation…</p>
          ) : (
            <dl className="mt-4 space-y-3">
              {evidence.evidence.map((field) => (
                <div key={field.key} className="dash-card px-4 py-3">
                  <dt className="dash-kicker">
                    {field.label}
                    {field.source && (
                      <span className="ml-2 font-normal normal-case tracking-normal">
                        via {field.source}
                      </span>
                    )}
                  </dt>
                  <dd className="mt-1 text-sm">{field.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <section>
          <h2 className="dash-serif text-2xl">Audit trail</h2>
          <p className="dash-muted mt-1 text-sm">
            Live ledger — updates while investigation runs.
          </p>
          <div className="mt-4">
            <AuditTrailTimeline entries={evidence.ledger} />
          </div>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="dash-serif text-2xl">Rebuttal</h2>
        <p className="dash-muted mt-1 text-sm">
          Drafted from verified evidence only — never invented facts.
        </p>
        <div className="dash-card mt-4 p-6">
          {responseText ? (
            <p className="text-sm leading-7">{responseText}</p>
          ) : (
            <p className="dash-muted text-sm">
              {isAgentRunning
                ? "Response appears after investigation completes…"
                : "Response appears once automation finishes."}
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
