import { ok, err, done, req, serverUp } from "./lib/test-utils.mjs";

const TOOLS = [
  "getOrderDetails",
  "getCustomerHistory",
  "getFulfillmentDetails",
  "getTrackingStatus",
  "getRefundHistory",
  "getPaymentDetails",
];

export async function runP2Tests() {
  const results = [];
  if (!(await serverUp())) return 1;

  try {
    const r = await req("GET", "/api/p2/health");
    r.status === 200
      ? ok(results, "p2-health")
      : err(results, "p2-health", `need GET /api/p2/health got ${r.status}`);
  } catch (e) {
    err(results, "p2-health", "add app/api/p2/health/route.ts");
  }

  for (const tool of TOOLS) {
    try {
      const r = await req("POST", `/api/p2/tools/${tool}`, {
        body: { orderId: "1042" },
      });
      if (r.status !== 200 || !r.json?.orderId && tool !== "getCustomerHistory") {
        if (tool === "getCustomerHistory" && r.status === 200 && r.json?.customerId) {
          ok(results, `tool-${tool}`);
        } else {
          err(results, `tool-${tool}`, `expected 200 got ${r.status}`);
        }
      } else {
        ok(results, `tool-${tool}`);
      }
    } catch (e) {
      err(results, `tool-${tool}`, String(e.message ?? e));
    }
  }

  try {
    const r = await req("POST", "/api/p2/submit", {
      body: {
        disputeId: "dp_test_1042",
        gatewayType: "stripe",
        package: {
          disputeId: "dp_test_1042",
          disputeReason: "fraudulent",
          confidenceScore: 78,
          evidence: [{ key: "order_id", label: "Order", value: "1042" }],
          ledger: [
            {
              tool: "order_lookup",
              reasoning: "test",
              resultSummary: "ok",
              timestamp: new Date().toISOString(),
            },
          ],
          generatedAt: new Date().toISOString(),
        },
      },
    });
    r.status === 200 && typeof r.json?.success === "boolean"
      ? ok(results, "p2-submit")
      : err(results, "p2-submit", `expected SubmissionResult got ${r.status}`);
  } catch (e) {
    err(results, "p2-submit", String(e.message ?? e));
  }

  return done(results, "P2");
}

const isMain = process.argv[1]?.replace(/\\/g, "/").endsWith("test-p2.mjs");
if (isMain) runP2Tests().then((c) => process.exit(c));
