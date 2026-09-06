import { generateText, isStepCount } from "ai";
import { fetchDisputeContext, persistDisputeStatus, persistEvidencePackage } from "./dispute";
import { getOllamaModel } from "./model";
import { mapScoreToStatus, scoreEvidence } from "./scoring";
import {
  VerifiedEvidencePackageSchema,
  type LedgerEntry,
  type VerifiedEvidencePackage,
} from "./schemas";
import { createTools } from "./tools";

const MAX_ITERATIONS = Number(process.env.MAX_ITERATIONS ?? "6") || 6;
const STEP_TIMEOUT_MS = Number(process.env.P3_STEP_TIMEOUT_MS ?? "30000") || 30000;

function buildSystemPrompt(context: {
  disputeId: string;
  reason: string;
  amount: number;
  currency: string;
  orderId: string;
}): string {
  return `You are ShieldPay's dispute investigation agent.

Dispute ID: ${context.disputeId}
Order ID: ${context.orderId}
Reason: ${context.reason}
Amount: ${context.currency} ${context.amount}

Your job:
1. Select the minimum necessary evidence tools to build a strong chargeback defense.
2. Before each tool call, briefly state your reasoning in plain text.
3. Stop calling tools once you have enough evidence — reply with a short summary instead of calling more tools.
4. Prefer delivery/tracking for "not received" disputes; payment + customer history for fraud claims.

Available tools all take { orderId: "${context.orderId}" }.`;
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

  const ctx = {
    orderId: dispute.orderId,
    evidence,
    ledger,
    step,
    toolCache: new Map<string, unknown>(),
    appendLedger,
  };

  const tools = createTools(ctx);
  const system = buildSystemPrompt({ ...dispute, disputeId });

  appendLedger({
    toolCalled: null,
    toolInput: null,
    toolOutput: null,
    reasoning: `Starting investigation for dispute ${disputeId} (${dispute.reason}, ${dispute.currency} ${dispute.amount}).`,
  });

  let modelStopped = false;

  try {
    await runAgentLoop({
      system,
      tools,
      orderId: dispute.orderId,
      onModelText: (text) => {
        if (text.trim().length > 0) {
          appendLedger({
            toolCalled: null,
            toolInput: null,
            toolOutput: null,
            reasoning: text.trim(),
          });
        }
      },
      onComplete: () => {
        modelStopped = true;
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Agent loop failed unexpectedly";
    appendLedger({
      toolCalled: null,
      toolInput: null,
      toolOutput: null,
      reasoning: `Agent loop ended with error: ${message}. Returning partial evidence package.`,
    });
  }

  if (!modelStopped) {
    appendLedger({
      toolCalled: null,
      toolInput: null,
      toolOutput: null,
      reasoning: `Reached iteration limit (${MAX_ITERATIONS}) — finalizing with gathered evidence.`,
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

  const pkg: VerifiedEvidencePackage = {
    disputeId,
    evidence,
    confidenceScore,
    status,
    ledger,
  };

  const validated = VerifiedEvidencePackageSchema.parse(pkg);

  await persistEvidencePackage(disputeId, validated as unknown as Record<string, unknown>);

  if (status === "review" || status === "insufficient") {
    await persistDisputeStatus(
      disputeId,
      status === "insufficient" ? "insufficient" : "review"
    );
  }

  return validated;
}

async function runAgentLoop(options: {
  system: string;
  tools: ReturnType<typeof createTools>;
  orderId: string;
  onModelText: (text: string) => void;
  onComplete: () => void;
}): Promise<void> {
  const prompt = `Investigate order ${options.orderId}. Use tools as needed, state reasoning before each tool call, and stop when confident.`;

  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await generateText({
        model: getOllamaModel(),
        system: options.system,
        prompt,
        tools: options.tools,
        stopWhen: isStepCount(MAX_ITERATIONS),
        timeout: STEP_TIMEOUT_MS,
        onStepEnd: (step) => {
          if (step.text.trim()) {
            options.onModelText(step.text);
          }
          if (step.toolCalls.length === 0 && step.text.trim().length > 0) {
            options.onComplete();
          }
        },
      });

      if (result.text.trim()) {
        options.onModelText(result.text);
      }
      if (result.finishReason === "stop" || result.finishReason === "length") {
        options.onComplete();
      }
      return;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const isToolParseError =
        message.includes("tool") ||
        message.includes("JSON") ||
        message.includes("parse");

      if (attempt === 0 && isToolParseError) {
        console.warn("[P3] Malformed tool output — retrying once:", message);
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Agent loop failed after retry");
}
