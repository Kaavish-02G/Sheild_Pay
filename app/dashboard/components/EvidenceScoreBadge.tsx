interface EvidenceScoreBadgeProps {
  score?: number | null;
  size?: "sm" | "md" | "lg";
}

function getScoreChip(score: number): string {
  if (score >= 85) return "dash-chip dash-chip-ok";
  if (score >= 70) return "dash-chip";
  if (score >= 40) return "dash-chip dash-chip-warn";
  return "dash-chip dash-chip-bad";
}

function getScoreLabel(score: number): string {
  if (score >= 85) return "Strong";
  if (score >= 70) return "Good";
  if (score >= 40) return "Weak";
  return "Low";
}

const SIZE_CLASSES = {
  sm: "text-[10px]",
  md: "text-[11px]",
  lg: "text-xs px-3 py-1",
};

export default function EvidenceScoreBadge({
  score,
  size = "md",
}: EvidenceScoreBadgeProps) {
  if (score === null || score === undefined) {
    return <span className={`dash-chip ${SIZE_CLASSES[size]}`}>Pending</span>;
  }

  return (
    <span
      className={`${getScoreChip(score)} ${SIZE_CLASSES[size]}`}
      title={`Evidence confidence: ${score}%`}
    >
      <span className="tabular">{score}%</span>
      <span className="ml-1 font-normal opacity-80">· {getScoreLabel(score)}</span>
    </span>
  );
}
