/**
 * Architecture E2E: Stripe webhook ingest → pipeline → evidence + rebuttal.
 * Run: npm run test:architecture
 * Requires: ShieldPay (TEST_BASE_URL) + MongoDB; mock commerce optional for order seeding.
 */
import { randomUUID } from "crypto";
import { AgentVerifiedEvidencePackageSchema } from "../shared/schemas";

const SHIELDPAY =
  process.env.TEST_BASE_URL ??
  process.env.SHIELDPAY_APP_URL ??
  "http://localhost:3000";
const MOCK_COMMERCE = process.env.MOCK_COMMERCE_URL ?? "http://localhost:4010";
const API_KEY = process.env.MOCK_COMMERCE_API_KEY ?? "mock-commerce-key";
const POLL_MS = 1500;
const MAX_POLLS = 40;

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function seedOrder(orderId: string): Promise<void> {
  const health = await fetch(`${MOCK_COMMERCE}/health`).catch(() => null);
  if (!health?.ok) {
    return;
  }
  await fetch(`${MOCK_COMMERCE}/admin/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orderId }),
  });
}

async function ingestStripeDispute(orderId: string): Promise<string> {
  const disputeId = `dp_e2e_${randomUUID().slice(0, 12)}`;
  const res = await fetch(`${SHIELDPAY}/api/core/webhooks/stripe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-mock-commerce": "true",
    },
    body: JSON.stringify({
      type: "charge.dispute.created",
      data: {
        object: {
          id: disputeId,
          amount: 4999,
          currency: "usd",
          reason: "product_not_received",
          metadata: {
            order_id: orderId,
            merchant_id: "demo-merchant",
          },
          payment_method_details: {
            card: { network: "visa" },
          },
        },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Stripe webhook ingest returned ${res.status}`);
  }

  const body = (await res.json()) as { disputeId?: string };
  if (!body.disputeId) {
    throw new Error("Webhook response missing disputeId");
  }

  return body.disputeId;
}

async function fetchDisputeSnapshot(disputeId: string) {
  const res = await fetch(`${SHIELDPAY}/api/core/disputes/${encodeURIComponent(disputeId)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    return null;
  }
  return res.json() as Promise<{ dispute?: { status?: string }; evidence?: unknown }>;
}

async function main() {
  const shieldpayHealth = await fetch(`${SHIELDPAY}/api/core/disputes`).catch(() => null);
  if (!shieldpayHealth?.ok) {
    console.error("FAIL ShieldPay not reachable at", SHIELDPAY);
    process.exit(1);
  }

  const orderId = `e2e-${Date.now().toString().slice(-6)}`;
  await seedOrder(orderId);
  const disputeId = await ingestStripeDispute(orderId);

  for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
    await sleep(POLL_MS);

    const snapshot = await fetchDisputeSnapshot(disputeId);
    if (!snapshot?.evidence) {
      continue;
    }

    const parsed = AgentVerifiedEvidencePackageSchema.safeParse(snapshot.evidence);
    if (!parsed.success) {
      continue;
    }

    const pkg = parsed.data;
    if (
      pkg.validation &&
      pkg.strategy &&
      pkg.rebuttalIterations &&
      pkg.rebuttalIterations.length > 0 &&
      pkg.responseText
    ) {
      console.log("OK architecture-e2e");
      console.log(
        JSON.stringify(
          {
            shieldpayUrl: SHIELDPAY,
            disputeId,
            orderId,
            canonicalReason: pkg.canonicalReason,
            cardNetwork: pkg.cardNetwork,
            validationPassed: pkg.validation.checks.filter((c) => c.passed).length,
            validationTotal: pkg.validation.checks.length,
            strategy: pkg.strategy.focus,
            rebuttalIterations: pkg.rebuttalIterations.length,
            confidenceScore: pkg.confidenceScore,
            disputeStatus: snapshot.dispute?.status,
            responsePreview: pkg.responseText.slice(0, 120),
          },
          null,
          2
        )
      );
      return;
    }
  }

  console.error("FAIL architecture-e2e — pipeline did not complete in time for", disputeId);
  process.exit(1);
}

main().catch((error) => {
  console.error("FAIL", error instanceof Error ? error.message : error);
  process.exit(1);
});
