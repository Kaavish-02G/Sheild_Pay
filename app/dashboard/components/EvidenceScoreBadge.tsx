interface EvidenceScoreBadgeProps {
  score?: number | null;
  size?: "sm" | "md" | "lg";
}

function getScoreColor(score: number): string {
  if (score >= 85) return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800";
  if (score >= 70) return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800";
  if (score >= 40) return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800";
  return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800";
}

function getScoreLabel(score: number): string {
  if (score >= 85) return "Strong";
  if (score >= 70) return "Good";
  if (score >= 40) return "Weak";
  return "Low";
}

const SIZE_CLASSES = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-3 py-1",
  lg: "text-base px-4 py-1.5",
};

export default function EvidenceScoreBadge({
  score,
  size = "md",
}: EvidenceScoreBadgeProps) {
  if (score === null || score === undefined) {
    return (
      <span
        className={`inline-flex items-center rounded-full border border-slate-200 bg-slate-50 font-medium text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 ${SIZE_CLASSES[size]}`}
      >
        Pending
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${getScoreColor(score)} ${SIZE_CLASSES[size]}`}
      title={`Evidence confidence: ${score}%`}
    >
      <span>{score}%</span>
      <span className="font-normal opacity-75">· {getScoreLabel(score)}</span>
    </span>
  );
}
