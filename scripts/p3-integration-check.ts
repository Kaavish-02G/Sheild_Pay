/**
 * Deep integration check for P3 invoke — prints a readable summary.
 * Run: npx tsx scripts/p3-integration-check.ts
 */
import { VerifiedEvidencePackageSchema } from "../lib/p3/schemas";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";

async function main() {
  const res = await fetch(`${BASE}/api/p3/invoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ disputeId: "integration-test-1042" }),
  });

  const raw = await res.json();
  const parsed = VerifiedEvidencePackageSchema.safeParse(raw);

  if (res.status >= 500) {
    console.error("FAIL HTTP", res.status);
    process.exit(1);
  }

  if (!parsed.success) {
    console.error("FAIL schema", parsed.error.flatten());
    process.exit(1);
  }

  const pkg = parsed.data;
  const evidenceKeys = Object.keys(pkg.evidence);
  const toolsUsed = [
    ...new Set(
      pkg.ledger
        .map((e) => e.toolCalled)
        .filter((t): t is string => typeof t === "string")
    ),
  ];

  const loopSteps = pkg.ledger.filter((e) =>
    e.reasoning.includes("Agent loop step")
  );

  console.log("OK p3-integration");
  console.log(
    JSON.stringify(
      {
        httpStatus: res.status,
        disputeId: pkg.disputeId,
        status: pkg.status,
        confidenceScore: pkg.confidenceScore,
        evidenceKeys,
        toolsUsed,
        investigationLoopSteps: loopSteps.length,
        ledgerSteps: pkg.ledger.length,
        loopTimeline: loopSteps.map((e) => ({
          step: e.step,
          reasoning: e.reasoning.slice(0, 100),
        })),
        sampleLedger: pkg.ledger.slice(0, 5).map((e) => ({
          step: e.step,
          tool: e.toolCalled,
          reasoning: e.reasoning.slice(0, 80),
        })),
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
