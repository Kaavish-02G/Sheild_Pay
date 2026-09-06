"use client";



import { useCallback, useEffect, useState } from "react";

import type {

  AutomationResult,

  Dispute,

  MerchantSettings,

  VerifiedEvidencePackage,

} from "@/shared/schemas";

import {

  runDisputeAutomation,

  sendToPaymentGateway,

  submitDisputeAfterReview,

} from "@/lib/p4/api-client";

import DisputePreviewModal from "./DisputePreviewModal";

import EvidenceScoreBadge from "./EvidenceScoreBadge";

import MockEvidenceScreenshots from "./MockEvidenceScreenshots";



interface AutomationPanelProps {

  dispute: Dispute;

  evidence: VerifiedEvidencePackage;

  settings: MerchantSettings;

  responseText?: string;

  serverManaged?: boolean;

  onStatusChange: (status: Dispute["status"]) => void;

  onResponseText: (text: string) => void;

  onGatewayReference?: (ref: string) => void;

}



function PreviewButton({

  variant,

  onClick,

  disabled,

}: {

  variant: "red" | "default";

  onClick: () => void;

  disabled?: boolean;

}) {

  const classes =

    variant === "red"

      ? "bg-red-600 hover:bg-red-700 text-white"

      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700";



  return (

    <button

      type="button"

      onClick={onClick}

      disabled={disabled}

      className={`rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${classes}`}

    >

      Preview

    </button>

  );

}



function SendToPgButton({

  onClick,

  disabled,

  loading,

}: {

  onClick: () => void;

  disabled?: boolean;

  loading?: boolean;

}) {

  return (

    <button

      type="button"

      onClick={onClick}

      disabled={disabled || loading}

      className="rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"

    >

      {loading ? "Sending to PG…" : "Send Request to PG"}

    </button>

  );

}



export default function AutomationPanel({

  dispute,

  evidence,

  settings,

  responseText: responseTextProp,

  serverManaged = false,

  onStatusChange,

  onResponseText,

  onGatewayReference,

}: AutomationPanelProps) {

  const [result, setResult] = useState<AutomationResult | null>(null);

  const [running, setRunning] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const [sendingToPg, setSendingToPg] = useState(false);

  const [gatewayReference, setGatewayReference] = useState<string | undefined>();

  const [pgSent, setPgSent] = useState(dispute.status === "submitted");

  const [toast, setToast] = useState<string | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);



  const responseText = responseTextProp ?? result?.responseText ?? dispute.responseText;

  const canPreview = evidence.ledger.length > 0 || Boolean(responseText);

  const lowScore = evidence.confidenceScore < settings.minEvidenceScore;



  const handlePgSuccess = useCallback(

    (ref?: string) => {

      if (ref) {

        setGatewayReference(ref);

        onGatewayReference?.(ref);

      }

      setPgSent(true);

      onStatusChange("submitted");

    },

    [onGatewayReference, onStatusChange]

  );



  const handleSendToPg = useCallback(async () => {

    setSendingToPg(true);

    setToast(null);

    try {

      const submitResult = await sendToPaymentGateway(dispute.disputeId, evidence);

      if (submitResult.success) {

        handlePgSuccess(submitResult.gatewayReference);

        setResult({

          action: "already_submitted",

          disputeId: dispute.disputeId,

          message: `Submitted to payment gateway${submitResult.gatewayReference ? `: ${submitResult.gatewayReference}` : ""}. Mock payment receipt and delivery proof attached.`,

          responseText: responseText ?? undefined,

        });

      } else if ("unavailable" in submitResult && submitResult.unavailable) {

        setToast("Payment gateway unavailable — check PG_MOCK_MODE or gateway credentials.");

      } else {

        setToast("error" in submitResult ? submitResult.error : "Submission failed");

      }

    } finally {

      setSendingToPg(false);

    }

  }, [dispute.disputeId, evidence, handlePgSuccess, responseText]);



  const runAutomation = useCallback(async () => {

    if (dispute.status === "submitted") {

      setResult({

        action: "already_submitted",

        disputeId: dispute.disputeId,

        message: "This dispute has already been submitted.",

        responseText: dispute.responseText,

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

        handlePgSuccess();

      } else if (automationResult.action === "review_required") {

        onStatusChange("review");

      } else if (automationResult.action === "insufficient") {

        onStatusChange("insufficient");

      }

    } catch (err) {

      setToast(err instanceof Error ? err.message : "Automation failed");

    } finally {

      setRunning(false);

    }

  }, [

    dispute.disputeId,

    dispute.responseText,

    dispute.status,

    handlePgSuccess,

    onResponseText,

    onStatusChange,

  ]);



  useEffect(() => {

    if (dispute.status === "submitted") {

      setPgSent(true);

    }

  }, [dispute.status]);



  useEffect(() => {

    if (dispute.responseText) {

      if (dispute.status === "submitted") {

        setResult({

          action: "auto_submitted",

          disputeId: dispute.disputeId,

          message:
            "Dispute response auto-generated and submitted to the payment gateway — evidence met your thresholds.",

          responseText: dispute.responseText,

        });

      } else if (dispute.status === "insufficient") {

        setResult({

          action: "insufficient",

          disputeId: dispute.disputeId,

          message: `Evidence confidence (${evidence.confidenceScore}%) is below minimum (${settings.minEvidenceScore}%). Preview case details or send to PG manually.`,

          responseText: dispute.responseText,

        });

      } else {

        setResult({

          action: "review_required",

          disputeId: dispute.disputeId,

          message:
            dispute.status === "review"
              ? `Evidence score (${evidence.confidenceScore}%) or amount requires merchant review before sending to PG.`
              : "AI agent completed investigation — send to PG manually when ready.",

          responseText: dispute.responseText,

        });

      }

      onResponseText(dispute.responseText);

      return;

    }



    if (dispute.status === "investigating" && !serverManaged) {

      runAutomation();

    }

  }, [

    dispute.disputeId,

    dispute.responseText,

    dispute.status,

    evidence.confidenceScore,

    lowScore,

    onResponseText,

    runAutomation,

    serverManaged,

    settings.minEvidenceScore,

  ]);



  const handleManualSubmit = async () => {

    setSubmitting(true);

    setToast(null);

    try {

      const submitResult = await submitDisputeAfterReview(

        dispute.disputeId,

        evidence,

        responseText ?? undefined

      );

      if (submitResult.success) {

        handlePgSuccess(submitResult.gatewayReference);

        setResult({

          action: "already_submitted",

          disputeId: dispute.disputeId,

          message: "Dispute submitted after merchant review.",

          responseText: responseText ?? undefined,

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



  const previewModal = (

    <DisputePreviewModal

      open={previewOpen}

      onClose={() => setPreviewOpen(false)}

      dispute={dispute}

      evidence={evidence}

      settings={settings}

      responseText={responseText ?? undefined}

      automationMessage={result?.message}

      gatewayReference={gatewayReference}

      onSendToPg={handleSendToPg}

      sendingToPg={sendingToPg}

      pgSent={pgSent}

    />

  );



  if (serverManaged && dispute.status === "investigating" && !dispute.responseText && !result) {

    return (

      <>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-900/20">

          <div className="flex flex-wrap items-start justify-between gap-4">

            <div>

              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200">

                AI Agent Running…

              </h3>

              <p className="mt-2 text-sm text-blue-700 dark:text-blue-300">

                The AI is investigating and will only auto-submit to the payment gateway when
                your evidence and amount thresholds are met.

              </p>

            </div>

            <PreviewButton variant="default" onClick={() => setPreviewOpen(true)} disabled={!canPreview} />

          </div>

        </div>

        {previewModal}

      </>

    );

  }



  if (running) {

    return (

      <>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-900/20">

          <div className="flex flex-wrap items-start justify-between gap-4">

            <div>

              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200">

                AI Agent Running…

              </h3>

              <p className="mt-2 text-sm text-blue-700 dark:text-blue-300">

                Investigating evidence and generating a response — PG submission only if thresholds are met.

              </p>

            </div>

            <PreviewButton variant="default" onClick={() => setPreviewOpen(true)} disabled={!canPreview} />

          </div>

        </div>

        {previewModal}

      </>

    );

  }



  if (!result) {

    return (

      <>

        <div className="flex flex-wrap justify-end gap-3">

          {!pgSent && evidence.evidence.length > 0 && (

            <SendToPgButton onClick={handleSendToPg} loading={sendingToPg} />

          )}

          <PreviewButton variant="default" onClick={() => setPreviewOpen(true)} disabled={!canPreview} />

        </div>

        {toast && <p className="mt-3 text-sm text-red-600">{toast}</p>}

        {previewModal}

      </>

    );

  }



  if (result.action === "insufficient") {

    return (

      <>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20">

          <div className="flex flex-wrap items-start justify-between gap-4">

            <div className="flex-1">

              <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-300">
                Needs Intervention — Low Evidence Score
              </h3>

              <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">{result.message}</p>

              <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">

                Score: <EvidenceScoreBadge score={evidence.confidenceScore} size="sm" /> (minimum:{" "}

                {settings.minEvidenceScore})

              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">

                <SendToPgButton onClick={handleSendToPg} loading={sendingToPg} />

                <PreviewButton variant="red" onClick={() => setPreviewOpen(true)} />

              </div>

              {toast && (

                <div className="mt-4 rounded-md bg-amber-100 px-4 py-3 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">

                  {toast}

                </div>

              )}

            </div>

          </div>

        </div>

        {previewModal}

      </>

    );

  }



  if (result.action === "auto_submitted" || result.action === "already_submitted") {

    return (

      <>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-800 dark:bg-emerald-900/20">

          <div className="flex flex-wrap items-start justify-between gap-4">

            <div className="flex-1">

              <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-300">
                Auto-Submitted to Payment Gateway
              </h3>

              <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">{result.message}</p>

              {gatewayReference && (

                <p className="mt-2 font-mono text-xs text-emerald-600 dark:text-emerald-500">

                  Gateway ref: {gatewayReference}

                </p>

              )}

            </div>

            <PreviewButton variant="default" onClick={() => setPreviewOpen(true)} />

          </div>

          <div className="mt-5">

            <MockEvidenceScreenshots

              dispute={dispute}

              evidence={evidence}

              gatewayReference={gatewayReference}

            />

          </div>

        </div>

        {previewModal}

      </>

    );

  }



  if (result.action === "review_required") {

    return (

      <>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20">

          <div className="flex flex-wrap items-start justify-between gap-4">

            <div className="flex-1">

              <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-300">

                Merchant Review Required

              </h3>

              <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">{result.message}</p>

              <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">

                Evidence confidence:{" "}

                <EvidenceScoreBadge score={evidence.confidenceScore} size="sm" />

              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">

                <SendToPgButton onClick={handleSendToPg} loading={sendingToPg} />

                <button

                  type="button"

                  onClick={handleManualSubmit}

                  disabled={submitting || !responseText}

                  className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"

                >

                  {submitting ? "Submitting…" : "Approve & Submit"}

                </button>

                <PreviewButton variant="default" onClick={() => setPreviewOpen(true)} />

              </div>

              {toast && (

                <div className="mt-4 rounded-md bg-amber-100 px-4 py-3 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">

                  {toast}

                </div>

              )}

            </div>

          </div>

        </div>

        {previewModal}

      </>

    );

  }



  return (

    <>

      <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">

        <div className="flex flex-wrap items-start justify-between gap-4">

          <div>

            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">

              Automation Paused

            </h3>

            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{result.message}</p>

            <div className="mt-4 flex flex-wrap gap-3">

              <SendToPgButton onClick={handleSendToPg} loading={sendingToPg} />

              <button

                type="button"

                onClick={runAutomation}

                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"

              >

                Retry Automation

              </button>

              <PreviewButton variant="default" onClick={() => setPreviewOpen(true)} />

            </div>

            {toast && <p className="mt-3 text-sm text-red-600">{toast}</p>}

          </div>

        </div>

      </div>

      {previewModal}

    </>

  );

}


