import { after } from "next/server";
import { runDisputeInvestigation } from "@/lib/p3/agent";

import { runRebuttalLoopAndPersist } from "@/lib/p3/rebuttal-loop";

import { getDispute } from "@/lib/core/models";

import { runServerAutomation } from "@/lib/p4/server-automation";



/**

 * Fully autonomous dispute pipeline — no merchant action required.

 * P1 creates the dispute → P3 collects evidence (rule engine) → rebuttal loop → P4 auto-submits when rules allow.

 */

export async function runAutonomousDisputePipeline(

  disputeId: string

): Promise<void> {

  if (process.env.SKIP_P3_INVOKE !== "true") {

    const pkg = await runDisputeInvestigation(disputeId);

    const dispute = await getDispute(disputeId);

    await runRebuttalLoopAndPersist(disputeId, pkg, dispute?.reason ?? "chargeback");

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

  after(() => runAutonomousDisputePipeline(disputeId).catch((error) => {

    console.error(

      `[pipeline] Autonomous pipeline failed for ${disputeId}:`,

      error instanceof Error ? error.message : error

    );

  }));

}


