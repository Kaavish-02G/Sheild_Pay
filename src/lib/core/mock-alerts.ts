import { mockGateway } from '@/lib/p2/gateways/mock';
import { randomUUID } from "crypto";
import { getDb } from "@/lib/core/db";
import { getMerchantByShopDomain, upsertMockMerchant } from "@/lib/core/models";
import {
  fetchFulfillmentDetails,
  fetchOrderDetails,
  fetchRefundHistory,
  fetchTrackingStatus,
} from "@/lib/core/order-service";
import { getGatewayAdapter, resolveGatewayType } from "@/lib/p2/gateways";
import { scoreEvidence } from "@/lib/p3/scoring";
import type {
  MockAlertOutcome,
  MockAlertRecord,
  MockPreAlertEvent,
} from "@/shared/schemas";
import { MOCK_ALERT_DISCLAIMER } from "@/shared/schemas";

const MOCK_ALERTS = "mock_alerts";
const AUDIT_LEDGER = "audit_ledger";
const SOURCE = "mock_alert" as const;

export { MOCK_ALERT_DISCLAIMER };

export interface MockAlertDoc {
  eventId: string;
  idempotencyKey: string;
  orderId: string;
  riskReason: string;
  amount: number;
  currency: string;
  source: typeof SOURCE;
  outcome: MockAlertOutcome;
  message: string;
  confidenceScore?: number;
  gatewayReference?: string;
  createdAt: Date;
}

let indexesReady: Promise<void> | null = null;

async function ensureIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const db = await getDb();
      await db.collection(MOCK_ALERTS).createIndex({ idempotencyKey: 1 }, { unique: true });
      await db.collection(MOCK_ALERTS).createIndex({ orderId: 1, createdAt: -1 });
      await db.collection(AUDIT_LEDGER).createIndex({ source: 1, createdAt: -1 });
    })().catch((error) => {
      indexesReady = null;
      throw error;
    });
  }
  await indexesReady;
}

function toRecord(doc: MockAlertDoc): MockAlertRecord {
  return {
    eventId: doc.eventId,
    idempotencyKey: doc.idempotencyKey,
    orderId: doc.orderId,
    riskReason: doc.riskReason,
    amount: doc.amount,
    currency: doc.currency,
    source: SOURCE,
    outcome: doc.outcome,
    message: doc.message,
    confidenceScore: doc.confidenceScore,
    gatewayReference: doc.gatewayReference,
    createdAt: doc.createdAt.toISOString(),
  };
}

async function writeLedger(entry: {
  orderId: string;
  eventId: string;
  outcome: MockAlertOutcome;
  reasoning: string;
  resultSummary: string;
}): Promise<void> {
  const db = await getDb();
  await db.collection(AUDIT_LEDGER).insertOne({
    source: SOURCE,
    orderId: entry.orderId,
    eventId: entry.eventId,
    tool: "mock_pre_alert",
    reasoning: entry.reasoning,
    resultSummary: entry.resultSummary,
    timestamp: new Date().toISOString(),
    outcome: entry.outcome,
    createdAt: new Date(),
  });
}

async function insertHandled(doc: MockAlertDoc): Promise<MockAlertDoc> {
  const db = await getDb();
  try {
    await db.collection<MockAlertDoc>(MOCK_ALERTS).insertOne(doc);
    return doc;
  } catch (error) {
    const duplicate =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: number }).code === 11000;
    if (!duplicate) throw error;
    const existing = await db
      .collection<MockAlertDoc>(MOCK_ALERTS)
      .findOne({ idempotencyKey: doc.idempotencyKey });
    if (existing) return existing;
    throw error;
  }
}

function hasSignedDelivery(tracking: {
  events?: Array<{ description?: string }>;
}): boolean {
  return (tracking.events ?? []).some((event) =>
    /signed|signature/i.test(event.description ?? "")
  );
}

function decideAutoRefund(snapshot: {
  tracking: Awaited<ReturnType<typeof fetchTrackingStatus>>;
  fulfillment: Awaited<ReturnType<typeof fetchFulfillmentDetails>>;
  score: number;
}): { refund: boolean; message: string } {
  const trackingNumber =
    snapshot.tracking.trackingNumber ?? snapshot.fulfillment.trackingNumber;
  const delivered =
    snapshot.tracking.status === "delivered" || Boolean(snapshot.fulfillment.deliveredAt);
  const signed = hasSignedDelivery(snapshot.tracking);

  if (trackingNumber && delivered && signed) {
    return {
      refund: false,
      message: "alert received, evidence supports contesting — no auto-refund",
    };
  }

  const shippedAt = snapshot.fulfillment.shippedAt
    ? new Date(snapshot.fulfillment.shippedAt).getTime()
    : null;
  const pastDeliveryWindow =
    Boolean(shippedAt) &&
    Date.now() - (shippedAt as number) > 7 * 24 * 60 * 60 * 1000 &&
    !delivered;

  if (!trackingNumber || !delivered || pastDeliveryWindow || snapshot.score < 40) {
    return {
      refund: true,
      message:
        "weak evidence (no tracking, undelivered, or past delivery window) — auto-refund",
    };
  }

  return {
    refund: false,
    message: "alert received, evidence supports contesting — no auto-refund",
  };
}

async function recordCommerceRefund(orderId: string, amount: number, currency: string) {
  const base = process.env.MOCK_COMMERCE_URL ?? "http://localhost:4010";
  const key = process.env.MOCK_COMMERCE_API_KEY ?? "mock-commerce-key";
  try {
    await fetch(`${base}/admin/record-refund`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orderId, amount, currency }),
    });
  } catch {
    console.warn("[mock-alerts] Could not record refund on mock commerce for", orderId);
  }
}

export async function handleMockPreAlert(
  event: MockPreAlertEvent
): Promise<MockAlertRecord> {
  await ensureIndexes();
  await fetchOrderDetails(event.orderId);

  const merchant =
    (await getMerchantByShopDomain("demo-merchant")) ??
    (await upsertMockMerchant("demo-merchant"));
  if (merchant.settings?.mockAlertsEnabled === false) {
    const eventId = event.eventId?.trim() || `mock-alert-${randomUUID()}`;
    const doc: MockAlertDoc = {
      eventId,
      idempotencyKey: `${event.orderId}:${eventId}`,
      orderId: event.orderId,
      riskReason: event.riskReason,
      amount: event.amount,
      currency: event.currency,
      source: SOURCE,
      outcome: "skipped",
      message: "Mock Alerts disabled in merchant settings — no auto-refund",
      createdAt: new Date(),
    };
    const saved = await insertHandled(doc);
    await writeLedger({
      orderId: event.orderId,
      eventId,
      outcome: "skipped",
      reasoning: "Merchant turned off Simulated Pre-Dispute Alerts.",
      resultSummary: saved.message,
    });
    return toRecord(saved);
  }

  const eventId = event.eventId?.trim() || `mock-alert-${randomUUID()}`;
  const idempotencyKey = `${event.orderId}:${eventId}`;
  const db = await getDb();

  const sameEvent = await db
    .collection<MockAlertDoc>(MOCK_ALERTS)
    .findOne({ idempotencyKey });
  if (sameEvent) {
    await writeLedger({
      orderId: event.orderId,
      eventId,
      outcome: "already_handled",
      reasoning: `Duplicate Mock Alerts event ${eventId} for order ${event.orderId}.`,
      resultSummary: "already_handled — identical simulated pre-dispute signal ignored",
    });
    return toRecord(sameEvent);
  }

  const priorOrder = await db
    .collection<MockAlertDoc>(MOCK_ALERTS)
    .findOne({ orderId: event.orderId }, { sort: { createdAt: -1 } });
  if (priorOrder) {
    const doc: MockAlertDoc = {
      eventId,
      idempotencyKey,
      orderId: event.orderId,
      riskReason: event.riskReason,
      amount: event.amount,
      currency: event.currency,
      source: SOURCE,
      outcome: "already_handled",
      message: `already_handled — prior Mock Alerts outcome was ${priorOrder.outcome}`,
      createdAt: new Date(),
    };
    const saved = await insertHandled(doc);
    await writeLedger({
      orderId: event.orderId,
      eventId,
      outcome: "already_handled",
      reasoning: `Order ${event.orderId} already processed a simulated pre-dispute signal.`,
      resultSummary: saved.message,
    });
    return toRecord(saved);
  }

  const refunds = await fetchRefundHistory(event.orderId);
  if (refunds.totalRefunded > 0) {
    const doc: MockAlertDoc = {
      eventId,
      idempotencyKey,
      orderId: event.orderId,
      riskReason: event.riskReason,
      amount: event.amount,
      currency: event.currency,
      source: SOURCE,
      outcome: "already_handled",
      message: "already_handled — a refund already exists for this order",
      createdAt: new Date(),
    };
    const saved = await insertHandled(doc);
    await writeLedger({
      orderId: event.orderId,
      eventId,
      outcome: "already_handled",
      reasoning: `Refund history for ${event.orderId} shows $${refunds.totalRefunded} already refunded.`,
      resultSummary: saved.message,
    });
    return toRecord(saved);
  }

  const [order, tracking, fulfillment] = await Promise.all([
    fetchOrderDetails(event.orderId),
    fetchTrackingStatus(event.orderId),
    fetchFulfillmentDetails(event.orderId),
  ]);

  const snapshotEvidence = { order, tracking, fulfillment, refunds };
  const score = scoreEvidence(snapshotEvidence, "product not received");
  const decision = decideAutoRefund({ tracking, fulfillment, score });

  let outcome: MockAlertOutcome = decision.refund ? "refunded" : "skipped";
  let message = decision.message;
  let gatewayReference: string | undefined;

  if (decision.refund) {
    const adapter = mockGateway;
    const result = await adapter.refund(event.orderId);
    if (result.success) {
      gatewayReference = result.gatewayReference;
      const amount = event.amount / (event.amount >= 100 ? 100 : 1);
      await recordCommerceRefund(
        event.orderId,
        Number.isFinite(order.totalAmount) ? order.totalAmount : amount,
        event.currency
      );
    } else {
      outcome = "skipped";
      message = `auto-refund requested but gateway returned: ${result.error ?? "unknown error"}`;
    }
  }

  const doc: MockAlertDoc = {
    eventId,
    idempotencyKey,
    orderId: event.orderId,
    riskReason: event.riskReason,
    amount: event.amount,
    currency: event.currency,
    source: SOURCE,
    outcome,
    message,
    confidenceScore: score,
    gatewayReference,
    createdAt: new Date(),
  };
  const saved = await insertHandled(doc);
  await writeLedger({
    orderId: event.orderId,
    eventId,
    outcome,
    reasoning: `Simulated pre-dispute signal (${event.riskReason}). Fast evidence score ${score}/100. Tracking=${tracking.trackingNumber ?? "none"}, delivery=${tracking.status}.`,
    resultSummary: message,
  });
  return toRecord(saved);
}

export async function listMockAlerts(limit = 25): Promise<MockAlertRecord[]> {
  await ensureIndexes();
  const db = await getDb();
  const docs = await db
    .collection<MockAlertDoc>(MOCK_ALERTS)
    .find({ source: SOURCE })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map(toRecord);
}

export async function listMockAlertLedger(limit = 50) {
  await ensureIndexes();
  const db = await getDb();
  return db
    .collection(AUDIT_LEDGER)
    .find({ source: SOURCE })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}
