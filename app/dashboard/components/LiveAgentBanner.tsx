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
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
          Investigation complete — generating response and evaluating auto-submit rules…
        </p>
      </div>
    );
  }

  const currentStep = Math.min(toolSteps + 1, targetSteps);

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-600" />
        </span>
        <div>
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
            AI Agent running — step {currentStep}/{targetSteps}
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300">
            {ledgerSteps} reasoning entries recorded live · tools executed: {toolSteps}/{targetSteps}
          </p>
        </div>
      </div>
    </div>
  );
}
