import type { Dispute } from "@/shared/schemas";
import { INTERVENTION_TAG, getInterventionKind } from "@/lib/p4/intervention-tag";

interface InterventionTagProps {
  dispute: Dispute;
  size?: "sm" | "md";
}

export default function InterventionTag({ dispute }: InterventionTagProps) {
  const kind = getInterventionKind(dispute);
  if (!kind) return null;

  const tag = INTERVENTION_TAG[kind];

  return <span className={tag.className}>{tag.label}</span>;
}

export { getInterventionKind, INTERVENTION_TAG };
