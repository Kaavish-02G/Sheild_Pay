import type { Dispute } from "@/shared/schemas";

export type InterventionKind = "auto_sent" | "needs_intervention" | null;

export function getInterventionKind(dispute: Dispute): InterventionKind {
  if (dispute.status === "submitted") {
    return "auto_sent";
  }
  if (dispute.status === "review" || dispute.status === "insufficient") {
    return "needs_intervention";
  }
  return null;
}

export const INTERVENTION_TAG: Record<
  Exclude<InterventionKind, null>,
  { label: string; className: string; borderClassName: string }
> = {
  auto_sent: {
    label: "Sent to PG",
    className: "dash-chip dash-chip-ok",
    borderClassName: "border-l-[3px] border-l-[var(--dash-ok)]",
  },
  needs_intervention: {
    label: "Needs intervention",
    className: "dash-chip dash-chip-bad",
    borderClassName: "border-l-[3px] border-l-[var(--dash-bad)]",
  },
};
