import type { LedgerEntry } from "@/lib/p3/schemas";
import {
  runInvestigationTool,
  type InvestigationToolName,
  type ToolRuntimeContext,
} from "@/lib/p3/tools";

const STEP_PAUSE_MS = Number(process.env.P3_STEP_PAUSE_MS ?? "700") || 700;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function collectEvidenceDeterministic(options: {
  orderId: string;
  tools: InvestigationToolName[];
  onProgress?: (ledger: LedgerEntry[]) => void;
}): Promise<{ evidence: Record<string, unknown>; ledger: LedgerEntry[] }> {
  const evidence: Record<string, unknown> = {};
  const ledger: LedgerEntry[] = [];
  let step = 0;

  const appendLedger = (entry: Omit<LedgerEntry, "step" | "timestamp">) => {
    step += 1;
    ledger.push({ step, ...entry, timestamp: new Date().toISOString() });
    options.onProgress?.(ledger);
  };

  const ctx: ToolRuntimeContext = {
    orderId: options.orderId,
    evidence,
    ledger,
    step,
    toolCache: new Map(),
    appendLedger,
  };

  appendLedger({
    toolCalled: null,
    toolInput: { tools: options.tools },
    toolOutput: null,
    reasoning: `Rule engine selected ${options.tools.length} evidence tools: ${options.tools.join(" → ")}.`,
  });

  for (let index = 0; index < options.tools.length; index += 1) {
    const toolName = options.tools[index];
    appendLedger({
      toolCalled: null,
      toolInput: { step: index + 1, tool: toolName },
      toolOutput: null,
      reasoning: `Collecting ${toolName} for order ${options.orderId}…`,
    });
    await sleep(STEP_PAUSE_MS);
    await runInvestigationTool(ctx, toolName, `Deterministic collection: ${toolName}`);
    await sleep(STEP_PAUSE_MS);
  }

  return { evidence, ledger };
}
