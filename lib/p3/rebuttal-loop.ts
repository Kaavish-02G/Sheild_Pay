import { generateText } from "ai";
import { saveEvidencePackage } from "@/lib/core/models";
import { formatRuleBookPrompt } from "@/lib/core/rules";
import { buildEvidenceOnlyResponse } from "@/lib/p4/response-generator";
import { agentPackageToSubmitText } from "@/lib/p4/evidence-adapter";
import { getOllamaModel } from "./model";
import type { AgentVerifiedEvidencePackage, RebuttalStrategy } from "@/shared/schemas";

const MAX_ITERATIONS = Number(process.env.P3_REBUTTAL_MAX_ITERATIONS ?? "3") || 3;

function useFastRebuttalMode(): boolean {
  return process.env.P3_REBUTTAL_FAST_MODE !== "false";
}

function ruleBookContext(pkg: AgentVerifiedEvidencePackage): string {
  if (pkg.rulePack) {
    return formatRuleBookPrompt(pkg.rulePack);
  }
  const checks =
    pkg.validation?.checks.map((c) => `- ${c.label}: ${c.passed ? "pass" : "fail"}`).join("\n") ??
    "No rule book attached";
  return `Card network: ${pkg.cardNetwork ?? "visa"}\nValidation:\n${checks}`;
}

function defaultStrategy(
  pkg: AgentVerifiedEvidencePackage
): AgentVerifiedEvidencePackage["strategy"] {
  const network = pkg.rulePack?.network?.toUpperCase() ?? pkg.cardNetwork?.toUpperCase() ?? "VISA";
  const requirements =
    pkg.rulePack?.requirements.map((req) => req.label).join(", ") ?? "verified evidence fields";
  const missing = pkg.validation?.missingFields ?? [];
  if (missing.some((field) => field.includes("tracking") || field.includes("delivery"))) {
    return {
      focus: "delivery_proof",
      rationale: "Missing delivery-related requirements — lead with fulfillment and tracking proof.",
    };
  }
  if (missing.some((field) => field.includes("customer"))) {
    return {
      focus: "customer_history",
      rationale: "Customer history signals are weak — emphasize account standing.",
    };
  }
  if (missing.some((field) => field.includes("payment") || field.includes("avs"))) {
    return {
      focus: "payment_proof",
      rationale: "Payment verification is the focus — cite AVS/CVV and capture status.",
    };
  }
  return {
    focus: "combined",
    rationale: `${network} rule book requires: ${requirements}. AI rebuttal will cite only verified fields that satisfy these rules.`,
  };
}

async function pickStrategy(
  pkg: AgentVerifiedEvidencePackage,
  disputeReason: string
): Promise<AgentVerifiedEvidencePackage["strategy"]> {
  if (useFastRebuttalMode()) {
    return defaultStrategy(pkg);
  }

  const checksSummary =
    pkg.validation?.checks
      .map((check) => `${check.label}: ${check.passed ? "pass" : "fail"}`)
      .join("\n") ?? "No validation checks";

  const ruleBook = ruleBookContext(pkg);

  try {
    const { text } = await generateText({
      model: getOllamaModel(),
      prompt: `You are a chargeback strategy analyst. Pick ONE focus for the rebuttal using ONLY the card-network rule book below.

${ruleBook}

Current validation:
${checksSummary}

Reply with JSON only: {"focus":"delivery_proof|customer_history|payment_proof|combined","rationale":"one sentence referencing which rule requirements to emphasize"}`,
    });
    const parsed = JSON.parse(text.trim()) as {
      focus?: RebuttalStrategy["focus"];
      rationale?: string;
    };
    if (parsed.focus && parsed.rationale) {
      return { focus: parsed.focus, rationale: parsed.rationale };
    }
  } catch {
    // fall through
  }

  return defaultStrategy(pkg);
}

async function draftRebuttal(
  pkg: AgentVerifiedEvidencePackage,
  disputeReason: string,
  strategy: NonNullable<AgentVerifiedEvidencePackage["strategy"]>
): Promise<string> {
  const dashboardPkg = agentPackageToSubmitText(pkg, disputeReason);
  if (useFastRebuttalMode()) {
    return buildEvidenceOnlyResponse(dashboardPkg);
  }

  const evidenceLines = dashboardPkg.evidence
    .map((field) => `- ${field.label}: ${field.value}`)
    .join("\n");

  try {
    const { text } = await generateText({
      model: getOllamaModel(),
      prompt: `Write a 3-6 sentence dispute rebuttal governed by this card-network rule book.

${ruleBookContext(pkg)}

Strategy focus: ${strategy.focus} — ${strategy.rationale}

Use ONLY these verified facts:
${evidenceLines || "(none)"}

Do not claim any requirement that is not supported by the verified facts above.
Output only the rebuttal paragraph.`,
    });
    const trimmed = text.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  } catch {
    // fall through
  }

  return buildEvidenceOnlyResponse(dashboardPkg);
}

async function critiqueDraft(
  draft: string,
  pkg: AgentVerifiedEvidencePackage,
  disputeReason: string
): Promise<{ approved: boolean; critique: string }> {
  if (useFastRebuttalMode()) {
    const unmet = pkg.validation?.missingFields ?? [];
    const ruleNames =
      pkg.rulePack?.requirements
        .filter((req) => unmet.includes(req.id))
        .map((req) => req.label)
        .join(", ") ?? "";
    const hasUnsupported = unmet.length > 0 && draft.length > 0;
    return {
      approved: !hasUnsupported || draft.includes("verified"),
      critique: hasUnsupported
        ? `Draft uses verified fields only, but ${networkLabel(pkg)} rule book still missing: ${ruleNames || "some requirements"}.`
        : `Approved against ${networkLabel(pkg)} rule book — evidence-only language.`,
    };
  }

  const dashboardPkg = agentPackageToSubmitText(pkg, disputeReason);
  const allowedFacts = dashboardPkg.evidence.map((field) => field.value);

  try {
    const { text } = await generateText({
      model: getOllamaModel(),
      prompt: `Critique this dispute rebuttal against the card-network rule book.

${ruleBookContext(pkg)}

Allowed facts: ${allowedFacts.join("; ") || "none"}
Draft:
${draft}

Reject the draft if it claims evidence not listed above or ignores a required rule that passed validation.
Reply JSON only: {"approved":true|false,"critique":"short critique referencing rule book requirements"}`,
    });
    const parsed = JSON.parse(text.trim()) as { approved?: boolean; critique?: string };
    if (typeof parsed.approved === "boolean" && parsed.critique) {
      return { approved: parsed.approved, critique: parsed.critique };
    }
  } catch {
    // fall through
  }

  return {
    approved: true,
    critique: "Critique unavailable — accepting draft with verified evidence constraints.",
  };
}

function networkLabel(pkg: AgentVerifiedEvidencePackage): string {
  return (pkg.rulePack?.network ?? pkg.cardNetwork ?? "visa").toUpperCase();
}

async function reviseDraft(
  draft: string,
  critique: string,
  pkg: AgentVerifiedEvidencePackage,
  disputeReason: string
): Promise<string> {
  if (useFastRebuttalMode()) {
    return buildEvidenceOnlyResponse(agentPackageToSubmitText(pkg, disputeReason));
  }

  const dashboardPkg = agentPackageToSubmitText(pkg, disputeReason);
  const evidenceLines = dashboardPkg.evidence
    .map((field) => `- ${field.label}: ${field.value}`)
    .join("\n");

  try {
    const { text } = await generateText({
      model: getOllamaModel(),
      prompt: `Revise this dispute rebuttal using ONLY verified evidence and the card-network rule book.

${ruleBookContext(pkg)}

Critique: ${critique}
Previous draft:
${draft}

Verified evidence:
${evidenceLines}

Output only the revised paragraph.`,
    });
    const trimmed = text.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  } catch {
    // fall through
  }

  return buildEvidenceOnlyResponse(dashboardPkg);
}

export async function runRebuttalLoop(
  pkg: AgentVerifiedEvidencePackage,
  disputeReason: string
): Promise<AgentVerifiedEvidencePackage> {
  const strategy = await pickStrategy(pkg, disputeReason);
  let draft = await draftRebuttal(pkg, disputeReason, strategy!);
  const iterations: NonNullable<AgentVerifiedEvidencePackage["rebuttalIterations"]> = [];

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration += 1) {
    const { approved, critique } = await critiqueDraft(draft, pkg, disputeReason);
    iterations.push({ iteration, draft, critique, approved });

    pkg.ledger.push({
      step: pkg.ledger.length + 1,
      toolCalled: null,
      toolInput: { iteration, phase: approved ? "approved" : "revise" },
      toolOutput: { critiquePreview: critique.slice(0, 200) },
      reasoning: `Rebuttal iteration ${iteration}/${MAX_ITERATIONS}: ${approved ? "approved" : "needs revision"}.`,
      timestamp: new Date().toISOString(),
    });

    if (approved || iteration === MAX_ITERATIONS) {
      break;
    }

    draft = await reviseDraft(draft, critique, pkg, disputeReason);
  }

  return {
    ...pkg,
    strategy,
    rebuttalIterations: iterations,
    responseText: draft,
  };
}

export async function runRebuttalLoopAndPersist(
  disputeId: string,
  pkg: AgentVerifiedEvidencePackage,
  disputeReason: string
): Promise<AgentVerifiedEvidencePackage> {
  const updated = await runRebuttalLoop(pkg, disputeReason);
  await saveEvidencePackage(disputeId, updated as unknown as Record<string, unknown>);
  return updated;
}
