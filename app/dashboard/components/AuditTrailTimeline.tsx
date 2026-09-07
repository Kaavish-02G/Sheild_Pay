import type { AuditLedgerEntry } from "@/shared/schemas";

interface AuditTrailTimelineProps {
  entries: AuditLedgerEntry[];
}

export default function AuditTrailTimeline({ entries }: AuditTrailTimelineProps) {
  if (entries.length === 0) {
    return <p className="dash-muted text-sm">No audit trail entries yet.</p>;
  }

  return (
    <ol className="relative space-y-0">
      {entries.map((entry, index) => (
        <li key={`${entry.tool}-${entry.timestamp}`} className="relative flex gap-4 pb-8">
          {index < entries.length - 1 && (
            <span
              className="absolute left-[15px] top-8 h-full w-px bg-[var(--dash-line)]"
              aria-hidden
            />
          )}
          <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--dash-line-strong)] bg-[var(--dash-surface)] text-[11px] font-semibold">
            {index + 1}
          </div>
          <div className="dash-card min-w-0 flex-1 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-[var(--dash-muted)]">{entry.tool}</span>
              <time className="dash-muted text-xs">
                {new Date(entry.timestamp).toLocaleString()}
              </time>
            </div>
            <p className="dash-kicker mt-3">Reasoning</p>
            <p className="mt-1 text-sm leading-6">{entry.reasoning}</p>
            <div className="mt-3 rounded-md border border-[var(--dash-line)] bg-[var(--dash-paper)] px-3 py-2">
              <p className="dash-kicker">Result</p>
              <p className="mt-1 text-sm leading-6">{entry.resultSummary}</p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
