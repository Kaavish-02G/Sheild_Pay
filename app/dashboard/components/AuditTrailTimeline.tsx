import type { AuditLedgerEntry } from "@/shared/schemas";

interface AuditTrailTimelineProps {
  entries: AuditLedgerEntry[];
}

export default function AuditTrailTimeline({ entries }: AuditTrailTimelineProps) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        No audit trail entries available yet.
      </p>
    );
  }

  return (
    <ol className="relative space-y-0">
      {entries.map((entry, index) => (
        <li key={`${entry.tool}-${entry.timestamp}`} className="relative flex gap-4 pb-8">
          {index < entries.length - 1 && (
            <span
              className="absolute left-[15px] top-8 h-full w-0.5 bg-slate-200 dark:bg-slate-600"
              aria-hidden
            />
          )}
          <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white dark:bg-blue-500">
            {index + 1}
          </div>
          <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                {entry.tool}
              </span>
              <time className="text-xs text-slate-400 dark:text-slate-500">
                {new Date(entry.timestamp).toLocaleString()}
              </time>
            </div>
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Reasoning
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {entry.reasoning}
              </p>
            </div>
            <div className="mt-3 rounded-md bg-blue-50 px-3 py-2 dark:bg-blue-900/30">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                Result
              </p>
              <p className="mt-1 text-sm leading-relaxed text-blue-900 dark:text-blue-200">
                {entry.resultSummary}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
