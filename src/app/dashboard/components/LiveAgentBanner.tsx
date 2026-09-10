"use client";

interface LiveAgentBannerProps {
  ledgerSteps: number;
  toolSteps: number;
  targetSteps: number;
  isComplete: boolean;
}

export default function LiveAgentBanner({
  ledgerSteps,
  toolSteps,
  targetSteps,
  isComplete,
}: LiveAgentBannerProps) {
  if (isComplete) {
    return (
      <div className="dash-banner dash-banner-ok">
        <p className="text-sm font-semibold">
          Investigation complete — drafting the rebuttal and checking auto-submit rules.
        </p>
      </div>
    );
  }

  const currentStep = Math.min(toolSteps + 1, targetSteps);

  return (
    <div className="dash-banner dash-banner-info">
      <p className="text-sm font-semibold">
        Investigation running — step {currentStep}/{targetSteps}
      </p>
      <p className="dash-muted mt-1 text-xs">
        {ledgerSteps} ledger entries · tools {toolSteps}/{targetSteps}
      </p>
    </div>
  );
}
