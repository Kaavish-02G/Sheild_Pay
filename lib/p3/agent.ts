import { isStepCount, type ModelMessage } from "ai";
import { generateText as ollamaGenerateText } from "ai-sdk-ollama";
import { saveEvidencePackage } from "@/lib/core/models";
import { fetchDisputeContext, persistDisputeStatus } from "./dispute";
import { getOllamaModel } from "./model";
import { mapScoreToStatus, scoreEvidence } from "./scoring";
import {
  VerifiedEvidencePackageSchema,
  type LedgerEntry,
  type VerifiedEvidencePackage,
} from "./schemas";
import {
  createTools,
  hasEvidenceForTool,
  runInvestigationTool,
  selectInvestigationPlan,
  type InvestigationToolName,
  type ToolRuntimeContext,
} from "./tools";

const INVESTIGATION_STEPS =
  Number(process.env.P3_INVESTIGATION_STEPS ?? "3") || 3;
const STEP_PAUSE_MS = Number(process.env.P3_STEP_PAUSE_MS ?? "700") || 700;
const STEP_TIMEOUT_MS = Number(process.env.P3_STEP_TIMEOUT_MS ?? "30000") || 30000;

function useFastLiveMode(): boolean {
  return process.env.P3_LIVE_FAST_MODE !== "false";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildInvestigationSummary(
  evidence: Record<string, unknown>,
  reason: string,
  score: number,
  status: string
): string {
  const order = evidence.order as Record<string, unknown> | undefined;
  const orderId = order?.orderId ?? "unknown order";
  const collected = Object.keys(evidence).filter((key) => evidence[key] != null);
  return (
    `Investigation complete for ${reason.replace(/_/g, " ")} on order ${orderId}. ` +
    `Collected evidence: ${collected.length > 0 ? collected.join(", ") : "none"}. ` +
    `Evidence score ${score}/100 → ${status}. Ready for response generation.`
  );
}

async function persistProgress(
  disputeId: string,
  pkg: VerifiedEvidencePackage
): Promise<void> {
  await saveEvidencePackage(
    disputeId,
    pkg as unknown as Record<string, unknown>
  );
}

export async function runDisputeInvestigation(
  disputeId: string
): Promise<VerifiedEvidencePackage> {
  const dispute = await fetchDisputeContext(disputeId);
  const evidence: Record<string, unknown> = {};
  const ledger: LedgerEntry[] = [];
  let step = 0;

  const appendLedger = (entry: Omit<LedgerEntry, "step" | "timestamp">) => {
    step += 1;
    ledger.push({
      step,
      ...entry,
      timestamp: new Date().toISOString(),
    });
  };

  const ctx: ToolRuntimeContext = {
    orderId: dispute.orderId,
    evidence,
    ledger,
    step,
    toolCache: new Map<string, unknown>(),
    appendLedger,
  };

  const plan = selectInvestigationPlan(dispute.reason).slice(0, INVESTIGATION_STEPS);

  appendLedger({
    toolCalled: null,
    toolInput: null,
    toolOutput: null,
    reasoning: `Starting ${INVESTIGATION_STEPS}-step live investigation for dispute ${disputeId} (${dispute.reason}, ${dispute.currency} ${dispute.amount}). Planned tools: ${plan.join(" → ")}.`,
  });

  const snapshot = (): VerifiedEvidencePackage => ({
    disputeId,
    evidence,
    confidenceScore: scoreEvidence(evidence, dispute.reason),
    status: mapScoreToStatus(scoreEvidence(evidence, dispute.reason)),
    ledger,
  });

  await persistProgress(disputeId, snapshot());

  if (useFastLiveMode()) {
    await runFastLiveAgentLoop({
      ctx,
      plan,
      disputeId,
      reason: dispute.reason,
      orderId: dispute.orderId,
      snapshot,
    });
  } else {
    await runOllamaSteppedLoop({
      ctx,
      plan,
      dispute,
      disputeId,
      appendLedger,
      snapshot,
    });
  }

  const confidenceScore = scoreEvidence(evidence, dispute.reason);
  const status = mapScoreToStatus(confidenceScore);

  appendLedger({
    toolCalled: null,
    toolInput: null,
    toolOutput: { confidenceScore, status },
    reasoning: `Evidence scoring complete: ${confidenceScore}/100 → ${status}.`,
  });

  const summary = buildInvestigationSummary(
    evidence,
    dispute.reason,
    confidenceScore,
    status
  );
  appendLedger({
    toolCalled: null,
    toolInput: null,
    toolOutput: null,
    reasoning: summary,
  });

  const pkg: VerifiedEvidencePackage = {
    disputeId,
    evidence,
    confidenceScore,
    status,
    ledger,
  };

  const validated = VerifiedEvidencePackageSchema.parse(pkg);
  await persistProgress(disputeId, validated);

  if (status === "review" || status === "insufficient") {
    await persistDisputeStatus(
      disputeId,
      status === "insufficient" ? "insufficient" : "review"
    );
  }

  return validated;
}

async function runFastLiveAgentLoop(options: {
  ctx: ToolRuntimeContext;
  plan: InvestigationToolName[];
  disputeId: string;
  reason: string;
  orderId: string;
  snapshot: () => VerifiedEvidencePackage;
}): Promise<void> {
  for (let index = 0; index < options.plan.length; index += 1) {
    const stepNum = index + 1;
    const toolName = options.plan[index];

    options.ctx.appendLedger({
      toolCalled: null,
      toolInput: { step: stepNum, tool: toolName },
      toolOutput: null,
      reasoning: `Step ${stepNum}/${INVESTIGATION_STEPS}: fetching ${toolName} for order ${options.orderId}…`,
    });
    await persistProgress(options.disputeId, options.snapshot());
    await sleep(STEP_PAUSE_MS);

    await runInvestigationTool(
      options.ctx,
      toolName,
      `Step ${stepNum}/${INVESTIGATION_STEPS}: running ${toolName}.`
    );
    await persistProgress(options.disputeId, options.snapshot());
    await sleep(STEP_PAUSE_MS);
  }
}

async function runOllamaSteppedLoop(options: {
  ctx: ToolRuntimeContext;
  plan: InvestigationToolName[];
  dispute: { orderId: string; reason: string; currency: string; amount: number };
  disputeId: string;
  appendLedger: (entry: Omit<LedgerEntry, "step" | "timestamp">) => void;
  snapshot: () => VerifiedEvidencePackage;
}): Promise<void> {
  const tools = createTools(options.ctx);
  const system = `You are ShieldPay's dispute investigation agent. Order ${options.dispute.orderId}.`;
  const messages: ModelMessage[] = [];
  const steps = options.plan.slice(0, INVESTIGATION_STEPS);

  for (let index = 0; index < steps.length; index += 1) {
    const stepNum = index + 1;
    const toolName = steps[index];
    options.appendLedger({
      toolCalled: null,
      toolInput: { step: stepNum, tool: toolName },
      toolOutput: null,
      reasoning: `Agent loop step ${stepNum}/${INVESTIGATION_STEPS}: choose and call ${toolName}.`,
    });
    await persistProgress(options.disputeId, options.snapshot());

    messages.push({
      role: "user",
      content: `Step ${stepNum}/${INVESTIGATION_STEPS} — call ${toolName} for order ${options.dispute.orderId}.`,
    });

    const before = Object.keys(options.ctx.evidence).length;
    await ollamaGenerateText({
      model: getOllamaModel(),
      system,
      messages,
      tools,
      activeTools: [toolName],
      toolChoice: "required",
      stopWhen: isStepCount(1),
      timeout: STEP_TIMEOUT_MS,
    });

    if (
      Object.keys(options.ctx.evidence).length === before &&
      !hasEvidenceForTool(options.ctx, toolName)
    ) {
      await runInvestigationTool(
        options.ctx,
        toolName,
        `Step ${stepNum}: executed ${toolName} directly.`
      );
    }
    await persistProgress(options.disputeId, options.snapshot());
  }
}
