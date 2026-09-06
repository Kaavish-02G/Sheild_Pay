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
    className:
      "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:ring-emerald-800",
    borderClassName: "border-l-4 border-l-emerald-500",
  },
  needs_intervention: {
    label: "Needs intervention",
    className:
      "bg-red-100 text-red-800 ring-1 ring-red-200 dark:bg-red-900/40 dark:text-red-300 dark:ring-red-800",
    borderClassName: "border-l-4 border-l-red-500",
  },
};
