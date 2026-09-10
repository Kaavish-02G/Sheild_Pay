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

const STATUS_CHIP: Record<Dispute["status"], string> = {
  investigating: "dash-chip",
  review: "dash-chip dash-chip-warn",
  submitted: "dash-chip dash-chip-ok",
  insufficient: "dash-chip dash-chip-bad",
};

export default function DisputeCard({ dispute, confidenceScore }: DisputeCardProps) {
  const interventionKind = getInterventionKind(dispute);
  const edge =
    interventionKind != null ? INTERVENTION_TAG[interventionKind].borderClassName : "";

  return (
    <Link href={`/dashboard/disputes/${dispute.disputeId}`} className={`dash-card block p-5 ${edge}`}>
      <div className="mb-4">
        <InterventionTag dispute={dispute} />
      </div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="dash-serif text-xl tracking-tight">{dispute.orderId}</p>
          <p className="dash-muted mt-1 text-sm capitalize">
            {dispute.reason.replace(/_/g, " ")}
          </p>
        </div>
        <div className="text-right">
          <p className="tabular text-lg font-semibold">
            {dispute.currency} {dispute.amount.toFixed(2)}
          </p>
          <span className={`mt-2 ${STATUS_CHIP[dispute.status]}`}>
            {STATUS_LABELS[dispute.status]}
          </span>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-[var(--dash-line)] pt-3">
        <p className="dash-muted text-xs">
          Deadline {new Date(dispute.deadline).toLocaleDateString()}
        </p>
        <EvidenceScoreBadge score={confidenceScore} size="sm" />
      </div>
    </Link>
  );
}
