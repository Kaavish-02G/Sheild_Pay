/** P1 unit tests — models, orchestrator, schemas. No HTTP server needed. */
import "../lib/env.mjs";
import { DisputeEventSchema } from "../../shared/schemas.ts";
import {
  createDispute,
  getDispute,
  updateDisputeStatus,
  upsertMerchant,
  getMerchantByShopDomain,
} from "../../lib/core/models.ts";
import { closeDb } from "../../lib/core/db.ts";
import { handleDisputeEvent } from "../../lib/core/orchestrator.ts";
import { cleanup, cfg } from "../lib/test-utils.mjs";

const P = cfg.PREFIX;
const results: boolean[] = [];

function ok(name: string) {
  results.push(true);
  console.log(`OK ${name}`);
}

function fail(name: string, why: string) {
  results.push(false);
  console.log(`ERR ${name} ${why}`);
}

async function main() {
  await cleanup();

  const event = {
    disputeId: `${P}evt-1`,
    orderId: "o1",
    merchantId: "m1",
    reason: "fraudulent",
    amount: 10,
    currency: "USD",
    deadline: new Date(Date.now() + 86400000).toISOString(),
    platform: "shopify" as const,
  };

  DisputeEventSchema.parse(event);
  ok("schema-valid");

  try {
    DisputeEventSchema.parse({ ...event, platform: "ebay" });
    fail("schema-reject", "accepted bad platform");
  } catch {
    ok("schema-reject");
  }

  const shop = `${P}shop.myshopify.com`;
  const merchant = await upsertMerchant(shop, "tok");
  merchant.shopDomain === shop ? ok("merchant-upsert") : fail("merchant-upsert", shop);

  const found = await getMerchantByShopDomain(shop);
  found?.accessToken === "tok" ? ok("merchant-get") : fail("merchant-get", "missing");

  const d = await createDispute({
    disputeId: `${P}disp-1`,
    orderId: "o1",
    merchantId: merchant._id.toString(),
    reason: "test",
    amount: 25,
    currency: "USD",
    deadline: event.deadline,
    status: "investigating",
  });

  const loaded = await getDispute(d.disputeId);
  loaded?.status === "investigating" ? ok("dispute-create") : fail("dispute-create", "not found");

  const updated = await updateDisputeStatus(d.disputeId, "review");
  updated?.status === "review" ? ok("dispute-update") : fail("dispute-update", String(updated?.status));

  await handleDisputeEvent({
    ...event,
    disputeId: `${P}orch-1`,
    merchantId: merchant._id.toString(),
  });

  const orch = await getDispute(`${P}orch-1`);
  orch?.status === "investigating" ? ok("orchestrator") : fail("orchestrator", "dispute missing");

  await new Promise((r) => setTimeout(r, 500));
  await cleanup();
  await closeDb();
  await new Promise((r) => setTimeout(r, 100));

  const n = results.filter(Boolean).length;
  console.log(`unit: ${n}/${results.length}`);
  process.exit(n === results.length ? 0 : 1);
}

main().catch((e) => {
  console.log(`ERR unit ${e.message}`);
  process.exit(1);
});
