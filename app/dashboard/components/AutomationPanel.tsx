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

  const classes = variant === "red" ? "dash-btn-danger" : "dash-btn-ghost";

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={classes}>

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

      className="dash-btn-primary disabled:cursor-not-allowed"

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

        <div className="dash-banner dash-banner-info">

          <div className="flex flex-wrap items-start justify-between gap-4">

            <div>

              <h3 className="dash-serif text-2xl">Investigation running</h3>
              <p className="dash-muted mt-2 text-sm leading-6">

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

        <div className="dash-banner dash-banner-info">

          <div className="flex flex-wrap items-start justify-between gap-4">

            <div>

              <h3 className="dash-serif text-2xl">Investigation running</h3>
              <p className="dash-muted mt-2 text-sm leading-6">

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

        <div className="dash-banner dash-banner-warn">

          <div className="flex flex-wrap items-start justify-between gap-4">

            <div className="flex-1">

              <h3 className="dash-serif text-2xl">Needs intervention</h3>
              <p className="mt-2 text-sm leading-6">{result.message}</p>
              <p className="mt-3 text-sm">

                Score: <EvidenceScoreBadge score={evidence.confidenceScore} size="sm" /> (minimum:{" "}

                {settings.minEvidenceScore})

              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">

                <SendToPgButton onClick={handleSendToPg} loading={sendingToPg} />

                <PreviewButton variant="red" onClick={() => setPreviewOpen(true)} />

              </div>

              {toast && (

                <div className="dash-banner mt-4 text-sm">

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

        <div className="dash-banner dash-banner-ok">

          <div className="flex flex-wrap items-start justify-between gap-4">

            <div className="flex-1">

              <h3 className="dash-serif text-2xl">Submitted to payment gateway</h3>
              <p className="mt-2 text-sm leading-6">{result.message}</p>

              {gatewayReference && (

                <p className="mt-2 font-mono text-xs">

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

        <div className="dash-banner dash-banner-warn">

          <div className="flex flex-wrap items-start justify-between gap-4">

            <div className="flex-1">

              <h3 className="dash-serif text-2xl">Merchant review required</h3>
              <p className="mt-2 text-sm leading-6">{result.message}</p>
              <p className="mt-3 text-sm">

                Evidence confidence:{" "}

                <EvidenceScoreBadge score={evidence.confidenceScore} size="sm" />

              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">

                <SendToPgButton onClick={handleSendToPg} loading={sendingToPg} />

                <button

                  type="button"

                  onClick={handleManualSubmit}

                  disabled={submitting || !responseText}

                  className="dash-btn-primary disabled:cursor-not-allowed"

                >

                  {submitting ? "Submitting…" : "Approve & Submit"}

                </button>

                <PreviewButton variant="default" onClick={() => setPreviewOpen(true)} />

              </div>

              {toast && (

                <div className="dash-banner mt-4 text-sm">

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

      <div className="dash-card p-6">

        <div className="flex flex-wrap items-start justify-between gap-4">

          <div>

            <h3 className="dash-serif text-2xl">Automation paused</h3>
            <p className="dash-muted mt-2 text-sm leading-6">{result.message}</p>

            <div className="mt-4 flex flex-wrap gap-3">

              <SendToPgButton onClick={handleSendToPg} loading={sendingToPg} />

              <button

                type="button"

                onClick={runAutomation}

                className="dash-btn-primary"

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


