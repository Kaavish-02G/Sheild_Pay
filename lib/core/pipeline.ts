import { runDisputeInvestigation } from "@/lib/p3/agent";
import { runServerAutomation } from "@/lib/p4/server-automation";

/**
 * Fully autonomous dispute pipeline — no merchant action required.
 * P1 creates the dispute → P3 investigates (3-step loop) → P4 generates response + auto-submits when rules allow.
 */
export async function runAutonomousDisputePipeline(
  disputeId: string
): Promise<void> {
  if (process.env.SKIP_P3_INVOKE !== "true") {
    await runDisputeInvestigation(disputeId);
  }

  if (process.env.SKIP_P4_AUTOMATION === "true") {
    return;
  }

  try {
    await runServerAutomation(disputeId);
  } catch (error) {
    console.warn(
      `[pipeline] P4 automation failed for ${disputeId}:`,
      error instanceof Error ? error.message : error
    );
  }
}

/** Fire-and-forget — returns immediately so the UI can show live agent progress. */
export function startAutonomousDisputePipeline(disputeId: string): void {
  void runAutonomousDisputePipeline(disputeId).catch((error) => {
    console.error(
      `[pipeline] Autonomous pipeline failed for ${disputeId}:`,
      error instanceof Error ? error.message : error
    );
  });
}
