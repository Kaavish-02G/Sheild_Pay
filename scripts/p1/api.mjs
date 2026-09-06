import crypto from "crypto";
import { ok, err, done, req, cleanup, serverUp, mongoUp, cfg, connect } from "../lib/test-utils.mjs";

const SECRET = process.env.SHOPIFY_WEBHOOK_SECRET ?? "test_webhook_secret";
const SHOP_NONE = `${cfg.PREFIX}none.myshopify.com`;
const SHOP_MOCK = `${cfg.PREFIX}shop.myshopify.com`;
const MOCK_TOKEN = "mock-token";

async function reqRaw(method, path, opts = {}) {
  const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${BASE}${path}`, {
    method,
    redirect: "manual",
    headers: { "Content-Type": "application/json", ...opts.headers },
    body: opts.body !== undefined
      ? typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body)
      : undefined,
  });
  let json;
  try { json = JSON.parse(await res.text()); } catch { json = null; }
  return { status: res.status, json, location: res.headers.get("location") };
}

function sign(body) {
  return crypto.createHmac("sha256", SECRET).update(body, "utf8").digest("base64");
}

function shopifyHeaders(body, topic, shop = "test.myshopify.com") {
  return {
    "x-shopify-hmac-sha256": sign(body),
    "x-shopify-topic": topic,
    "x-shopify-shop-domain": shop,
  };
}

export async function runP1ApiTests() {
  const results = [];
  if (!(await mongoUp())) return 1;
  if (!(await serverUp())) return 1;
  await cleanup();

  let r = await req("GET", "/api/core/deadline-check");
  r.status === 200 && typeof r.json.urgentCount === "number"
    ? ok(results, "deadline-check") : err(results, "deadline-check", String(r.status));

  r = await req("POST", "/api/core/webhooks", { body: "{}" });
  r.status === 401 ? ok(results, "webhook-no-sig") : err(results, "webhook-no-sig", String(r.status));

  const body = JSON.stringify({ id: 1 });
  r = await req("POST", "/api/core/webhooks", {
    body,
    headers: { ...shopifyHeaders(body, "orders/updated"), "x-shopify-hmac-sha256": "bad" },
  });
  r.status === 401 ? ok(results, "webhook-bad-hmac") : err(results, "webhook-bad-hmac", String(r.status));

  r = await req("POST", "/api/core/webhooks", { body, headers: shopifyHeaders(body, "orders/updated") });
  r.status === 200 && r.json.received && r.json.dispute === null
    ? ok(results, "webhook-orders-updated") : err(results, "webhook-orders-updated", String(r.status));

  r = await req("POST", "/api/core/webhooks", { body, headers: shopifyHeaders(body, "fulfillments/create") });
  r.status === 200 && r.json.dispute === null
    ? ok(results, "webhook-fulfillment") : err(results, "webhook-fulfillment", String(r.status));

  r = await req("POST", "/api/core/simulate-dispute", { body: { orderId: "", reason: "x", amount: -1 } });
  r.status === 400 ? ok(results, "simulate-invalid-body") : err(results, "simulate-invalid-body", String(r.status));

  r = await req("POST", "/api/core/simulate-dispute", {
    body: { orderId: "1", reason: "fraud", amount: 10 },
    headers: { "x-shopify-shop-domain": SHOP_NONE },
  });
  r.status === 404 ? ok(results, "simulate-no-merchant") : err(results, "simulate-no-merchant", String(r.status));

  r = await req("GET", "/api/core/auth/callback");
  r.status === 400 ? ok(results, "auth-callback-missing") : err(results, "auth-callback-missing", String(r.status));

  r = await reqRaw("GET", "/api/core/auth");
  r.status === 400 ? ok(results, "auth-install-missing-shop") : err(results, "auth-install-missing-shop", String(r.status));

  r = await reqRaw("GET", `/api/core/auth?shop=${SHOP_MOCK}`);
  (r.status === 302 || r.status === 307) && r.location?.includes("admin/oauth/authorize")
    ? ok(results, "auth-install-redirect") : err(results, "auth-install-redirect", String(r.status));

  r = await req("GET", `/api/core/auth/status?shop=${SHOP_NONE}`);
  r.status === 200 && r.json.connected === false
    ? ok(results, "auth-status-disconnected") : err(results, "auth-status-disconnected", String(r.status));

  r = await req("POST", "/api/core/auth/session", { body: {} });
  r.status === 401 ? ok(results, "auth-session-reject") : err(results, "auth-session-reject", String(r.status));

  try {
    const { client, db } = await connect();
    await db.collection("merchants").insertOne({
      platform: "shopify",
      shopDomain: SHOP_MOCK,
      accessToken: MOCK_TOKEN,
      settings: { autoSubmitThreshold: 85, minEvidenceScore: 40, requireApprovalHighValue: true, requireApprovalWeakEvidence: true },
    });
    r = await req("GET", `/api/core/auth/status?shop=${SHOP_MOCK}`);
    const connected = r.json.connected === true;
    r = await req("POST", "/api/core/simulate-dispute", {
      body: { orderId: "999", reason: "fraudulent", amount: 49.99 },
      headers: { "x-shopify-shop-domain": SHOP_MOCK },
    });
    const simOk = r.status === 200 && r.json.success === true;
    const dispute = await db.collection("disputes").findOne({ disputeId: r.json.disputeId });
    await db.collection("merchants").deleteMany({ shopDomain: SHOP_MOCK });
    if (dispute) await db.collection("disputes").deleteOne({ disputeId: r.json.disputeId });
    await client.close();
    connected && simOk && dispute?.status === "investigating"
      ? ok(results, "simulate-e2e") : err(results, "simulate-e2e", `connected=${connected} sim=${simOk}`);
  } catch (e) {
    err(results, "simulate-e2e", e.message);
  }

  try {
    const { client, db } = await connect();
    const id = `${cfg.PREFIX}urgent`;
    await db.collection("disputes").insertOne({
      disputeId: id, orderId: "o1", merchantId: "m1", reason: "t", amount: 1, currency: "USD",
      deadline: new Date(Date.now() + 6 * 3600000).toISOString(), status: "investigating", createdAt: new Date(),
    });
    r = await req("GET", "/api/core/deadline-check");
    const hit = r.json.disputes?.some((d) => d.disputeId === id);
    await db.collection("disputes").deleteOne({ disputeId: id });
    await client.close();
    hit ? ok(results, "deadline-urgent") : err(results, "deadline-urgent", "not listed");
  } catch (e) {
    err(results, "deadline-urgent", e.message);
  }

  await cleanup();
  return done(results, "api");
}

const isMain = process.argv[1]?.replace(/\\/g, "/").endsWith("api.mjs");
if (isMain) runP1ApiTests().then((c) => process.exit(c));
