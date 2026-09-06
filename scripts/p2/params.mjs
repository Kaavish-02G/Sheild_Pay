/**
 * P2 parameter + schema smoke tests — validates every response field and error paths.
 * Usage: npm run dev  &&  node scripts/p2/params.mjs
 */
import "../lib/env.mjs";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const CUSTOM_ORDER = "param-test-9999";

const TOOL_SCHEMAS = {
  getOrderDetails: {
    required: ["orderId", "customerId", "items", "totalAmount", "currency", "createdAt"],
    check: (d, orderId) =>
      d.orderId === orderId &&
      Array.isArray(d.items) &&
      d.items.every((i) => "name" in i && "quantity" in i && "price" in i),
  },
  getCustomerHistory: {
    required: [
      "customerId",
      "email",
      "totalOrders",
      "accountCreatedAt",
      "recentOrders",
      "disputeCount",
    ],
    check: (d) =>
      typeof d.customerId === "string" &&
      Array.isArray(d.recentOrders) &&
      d.recentOrders.every(
        (o) =>
          o.orderId &&
          typeof o.totalAmount === "number" &&
          o.currency &&
          o.createdAt &&
          o.status
      ),
  },
  getFulfillmentDetails: {
    required: [
      "orderId",
      "status",
      "trackingNumber",
      "carrier",
      "shippedAt",
      "deliveredAt",
    ],
    check: (d, orderId) =>
      d.orderId === orderId &&
      ["fulfilled", "unfulfilled", "partial"].includes(d.status),
  },
  getTrackingStatus: {
    required: [
      "orderId",
      "carrier",
      "trackingNumber",
      "status",
      "lastUpdate",
      "deliveredAt",
    ],
    check: (d, orderId) =>
      d.orderId === orderId &&
      ["pending", "in_transit", "delivered", "exception", "unknown"].includes(d.status),
  },
  getRefundHistory: {
    required: ["orderId", "refunds", "totalRefunded"],
    check: (d, orderId) =>
      d.orderId === orderId &&
      Array.isArray(d.refunds) &&
      typeof d.totalRefunded === "number",
  },
  getPaymentDetails: {
    required: [
      "orderId",
      "paymentId",
      "status",
      "amount",
      "currency",
      "method",
      "avsResult",
      "cvvResult",
      "gateway",
      "capturedAt",
    ],
    check: (d, orderId) =>
      d.orderId === orderId &&
      typeof d.amount === "number" &&
      ["stripe", "paypal", "razorpay", "shopify_payments", "unknown"].includes(d.gateway),
  },
};

const results = [];

function ok(name) {
  results.push(true);
  console.log(`OK ${name}`);
}

function fail(name, why) {
  results.push(false);
  console.log(`ERR ${name} ${why}`);
}

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = JSON.parse(await res.text());
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

function samplePackage(disputeId) {
  return {
    disputeId,
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
  };
}

async function testToolFields() {
  for (const [tool, schema] of Object.entries(TOOL_SCHEMAS)) {
    const r = await req("POST", `/api/p2/tools/${tool}`, { orderId: CUSTOM_ORDER });
    if (r.status !== 200) {
      fail(`fields-${tool}`, `status ${r.status}`);
      continue;
    }
    const missing = schema.required.filter((k) => !(k in r.json));
    if (missing.length) {
      fail(`fields-${tool}`, `missing keys: ${missing.join(", ")}`);
      continue;
    }
    if (!schema.check(r.json, CUSTOM_ORDER)) {
      fail(`fields-${tool}`, "value/type check failed");
      continue;
    }
    ok(`fields-${tool}`);
  }
}

async function testValidationErrors() {
  const badOrder = await req("POST", "/api/p2/tools/getOrderDetails", {});
  badOrder.status === 400 ? ok("reject-empty-body") : fail("reject-empty-body", `got ${badOrder.status}`);

  const badTool = await req("POST", "/api/p2/tools/notARealTool", { orderId: "1" });
  badTool.status === 404 ? ok("reject-unknown-tool") : fail("reject-unknown-tool", `got ${badTool.status}`);

  const badSubmit = await req("POST", "/api/p2/submit", { disputeId: "x" });
  badSubmit.status === 400 ? ok("reject-bad-submit") : fail("reject-bad-submit", `got ${badSubmit.status}`);

  const badGateway = await req("POST", "/api/p2/submit", {
    disputeId: "dp_x",
    gatewayType: "bitcoin",
    package: samplePackage("dp_x"),
  });
  badGateway.status === 400 ? ok("reject-bad-gateway") : fail("reject-bad-gateway", `got ${badGateway.status}`);
}

async function testSubmitGateways() {
  for (const gateway of ["stripe", "paypal", "razorpay"]) {
    const disputeId = `dp_param_${gateway}`;
    const r = await req("POST", "/api/p2/submit", {
      disputeId,
      gatewayType: gateway,
      package: samplePackage(disputeId),
    });
    if (r.status !== 200) {
      fail(`submit-${gateway}`, `status ${r.status}`);
      continue;
    }
    if (typeof r.json?.success !== "boolean") {
      fail(`submit-${gateway}`, "missing success boolean");
      continue;
    }
    if (r.json.success && !r.json.gatewayReference) {
      // gatewayReference optional on success when keys missing — success:false expected
    }
    if (!r.json.success && typeof r.json.error !== "string") {
      fail(`submit-${gateway}`, "expected error string when success=false");
      continue;
    }
    ok(`submit-${gateway}`);
  }

  const defaultGw = await req("POST", "/api/p2/submit", {
    disputeId: "dp_param_default",
    package: samplePackage("dp_param_default"),
  });
  if (defaultGw.status === 200 && typeof defaultGw.json?.success === "boolean") {
    ok("submit-default-gateway");
  } else {
    fail("submit-default-gateway", `status ${defaultGw.status}`);
  }
}

async function testHealthListsTools() {
  const r = await req("GET", "/api/p2/health");
  if (r.status !== 200 || !Array.isArray(r.json?.tools)) {
    fail("health-tool-list", "expected tools array");
    return;
  }
  const expected = Object.keys(TOOL_SCHEMAS);
  const missing = expected.filter((t) => !r.json.tools.includes(t));
  missing.length ? fail("health-tool-list", `missing: ${missing}`) : ok("health-tool-list");
}

async function main() {
  console.log(`P2 param tests @ ${BASE}\n`);
  try {
    await fetch(BASE);
  } catch {
    console.log("ERR setup start npm run dev");
    process.exit(1);
  }

  await testHealthListsTools();
  await testToolFields();
  await testValidationErrors();
  await testSubmitGateways();

  const passed = results.filter(Boolean).length;
  const total = results.length;
  console.log(`\nP2 params: ${passed}/${total}${passed < total ? ` (${total - passed} failed)` : ""}`);
  process.exit(passed < total ? 1 : 0);
}

main();
