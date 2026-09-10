/**
 * End-to-end checks for P3 tool HTTP layer (no Ollama required).
 * Run: npx tsx scripts/p3-tools-check.ts
 */
import {
  CustomerHistorySchema,
  FulfillmentDetailsSchema,
  OrderDetailsSchema,
  PaymentDetailsSchema,
  RefundHistorySchema,
  TrackingStatusSchema,
} from "../shared/schemas";
import { scoreEvidence, mapScoreToStatus } from "../lib/p3/scoring";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const ORDER_ID = "1042";

const TOOLS: Array<{
  name: string;
  schema: { safeParse: (v: unknown) => { success: boolean } };
}> = [
    { name: "getOrderDetails", schema: OrderDetailsSchema },
    { name: "getCustomerHistory", schema: CustomerHistorySchema },
    { name: "getFulfillmentDetails", schema: FulfillmentDetailsSchema },
    { name: "getTrackingStatus", schema: TrackingStatusSchema },
    { name: "getRefundHistory", schema: RefundHistorySchema },
    { name: "getPaymentDetails", schema: PaymentDetailsSchema },
  ];

async function main() {
  const evidence: Record<string, unknown> = {};
  let passed = 0;

  for (const tool of TOOLS) {
    const res = await fetch(`${BASE}/api/p2/tools/${tool.name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: ORDER_ID }),
    });
    const json = await res.json();
    const valid = res.status === 200 && tool.schema.safeParse(json).success;
    console.log(`${valid ? "OK" : "ERR"} p3-tool-${tool.name} (HTTP ${res.status})`);
    if (valid) {
      passed += 1;
      const key = tool.name.replace(/^get/, "").replace(/Details|History|Status/, (m) =>
        m === "Details" ? "" : m.toLowerCase()
      );
      evidence[tool.name] = json;
      if (tool.name === "getOrderDetails") evidence.order = json;
      if (tool.name === "getCustomerHistory") evidence.customer = json;
      if (tool.name === "getFulfillmentDetails") evidence.fulfillment = json;
      if (tool.name === "getTrackingStatus") evidence.tracking = json;
      if (tool.name === "getRefundHistory") evidence.refunds = json;
      if (tool.name === "getPaymentDetails") evidence.payment = json;
    }
  }

  const score = scoreEvidence(evidence, "product_not_received");
  const status = mapScoreToStatus(score);
  console.log(
    `OK p3-scoring-offline score=${score} status=${status} (from ${passed}/6 tools)`
  );

  if (passed !== TOOLS.length) process.exit(1);
}

main().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
