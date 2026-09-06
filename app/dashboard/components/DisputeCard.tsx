import Link from "next/link";
import type { Dispute } from "@/shared/schemas";
import { INTERVENTION_TAG, getInterventionKind } from "@/lib/p4/intervention-tag";
import EvidenceScoreBadge from "./EvidenceScoreBadge";
import InterventionTag from "./InterventionTag";

interface DisputeCardProps {
  dispute: Dispute;
  confidenceScore?: number | null;
}

const STATUS_LABELS: Record<Dispute["status"], string> = {
  investigating: "Investigating",
  review: "Review",
  submitted: "Submitted",
  insufficient: "Insufficient",
};

const STATUS_COLORS: Record<Dispute["status"], string> = {
  investigating: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  review: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  submitted: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  insufficient: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export default function DisputeCard({ dispute, confidenceScore }: DisputeCardProps) {
  const interventionKind = getInterventionKind(dispute);
  const borderClass =
    interventionKind != null ? INTERVENTION_TAG[interventionKind].borderClassName : "";

  return (
    <Link
      href={`/dashboard/disputes/${dispute.disputeId}`}
      className={`block rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-500 ${borderClass}`}
    >
      <div className="mb-3">
        <InterventionTag dispute={dispute} />
      </div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{dispute.orderId}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{dispute.reason.replace(/_/g, " ")}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {dispute.currency} {dispute.amount.toFixed(2)}
          </p>
          <span
            className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[dispute.status]}`}
          >
            {STATUS_LABELS[dispute.status]}
          </span>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-700">
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Deadline: {new Date(dispute.deadline).toLocaleDateString()}
        </p>
        <EvidenceScoreBadge score={confidenceScore} size="sm" />
      </div>
    </Link>
  );
}
