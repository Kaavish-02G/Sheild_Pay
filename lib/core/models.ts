import { ObjectId, type Filter } from "mongodb";
import { getDb } from "./db";

// --- Collection interfaces ---

export interface MerchantSettings {
  autoSubmitThreshold: number;
  minEvidenceScore: number;
  requireApprovalHighValue: boolean;
  requireApprovalWeakEvidence: boolean;
}

export interface Merchant {
  _id: ObjectId;
  platform: "shopify";
  shopDomain: string;
  accessToken: string;
  settings: MerchantSettings;
}

export interface Order {
  _id: ObjectId;
  orderId: string;
  merchantId: string;
  customerId: string;
  items: { name: string; quantity: number; price: number }[];
  totalAmount: number;
  currency: string;
  createdAt: string;
  cachedAt: Date;
}

export type DisputeStatus = "investigating" | "review" | "submitted" | "insufficient";

export interface Dispute {
  _id: ObjectId;
  disputeId: string;
  orderId: string;
  merchantId: string;
  reason: string;
  amount: number;
  currency: string;
  deadline: string;
  status: DisputeStatus;
  createdAt: Date;
}

export interface Evidence {
  _id: ObjectId;
  disputeId: string;
  package: Record<string, unknown>;
  createdAt: Date;
}

export interface AiRun {
  _id: ObjectId;
  disputeId: string;
  iteration: number;
  toolCalls: unknown[];
  reasoning: string;
  createdAt: Date;
}

export type SubmissionState = "pending" | "submitted" | "failed";

export interface SubmissionStatus {
  _id: ObjectId;
  disputeId: string;
  state: SubmissionState;
  gatewayResponse: unknown;
  updatedAt: Date;
}

const DEFAULT_SETTINGS: MerchantSettings = {
  autoSubmitThreshold: 85,
  minEvidenceScore: 40,
  requireApprovalHighValue: true,
  requireApprovalWeakEvidence: true,
};

// --- Data access ---

export async function createDispute(
  data: Omit<Dispute, "_id" | "createdAt">
): Promise<Dispute> {
  const db = await getDb();
  const doc: Omit<Dispute, "_id"> = { ...data, createdAt: new Date() };
  const result = await db.collection<Dispute>("disputes").insertOne(doc as Dispute);
  return { ...doc, _id: result.insertedId };
}

export async function getDispute(id: string): Promise<Dispute | null> {
  const db = await getDb();
  const filter: Filter<Dispute> = ObjectId.isValid(id)
    ? { _id: new ObjectId(id) }
    : { disputeId: id };
  return db.collection<Dispute>("disputes").findOne(filter);
}

export async function updateDisputeStatus(
  id: string,
  status: DisputeStatus
): Promise<Dispute | null> {
  const db = await getDb();
  const filter: Filter<Dispute> = ObjectId.isValid(id)
    ? { _id: new ObjectId(id) }
    : { disputeId: id };
  const result = await db
    .collection<Dispute>("disputes")
    .findOneAndUpdate(filter, { $set: { status } }, { returnDocument: "after" });
  return result ?? null;
}

export async function getMerchant(id: string): Promise<Merchant | null> {
  const db = await getDb();
  const filter: Filter<Merchant> = ObjectId.isValid(id)
    ? { _id: new ObjectId(id) }
    : { shopDomain: id };
  return db.collection<Merchant>("merchants").findOne(filter);
}

export async function getMerchantByShopDomain(shopDomain: string): Promise<Merchant | null> {
  const db = await getDb();
  return db.collection<Merchant>("merchants").findOne({ shopDomain });
}

export async function upsertMerchant(
  shopDomain: string,
  accessToken: string
): Promise<Merchant> {
  const db = await getDb();
  const result = await db.collection<Merchant>("merchants").findOneAndUpdate(
    { shopDomain },
    {
      $set: { accessToken, platform: "shopify" as const },
      $setOnInsert: { settings: DEFAULT_SETTINGS },
    },
    { upsert: true, returnDocument: "after" }
  );
  if (!result) {
    throw new Error(`Failed to upsert merchant for ${shopDomain}`);
  }
  return result;
}

export async function updateMerchantSettings(
  id: string,
  settings: Partial<MerchantSettings>
): Promise<Merchant | null> {
  const db = await getDb();
  const existing = await getMerchant(id);
  if (!existing) {
    return null;
  }

  const filter: Filter<Merchant> = ObjectId.isValid(id)
    ? { _id: new ObjectId(id) }
    : { shopDomain: id };

  const merged = { ...existing.settings, ...settings };

  const result = await db
    .collection<Merchant>("merchants")
    .findOneAndUpdate(filter, { $set: { settings: merged } }, { returnDocument: "after" });
  return result ?? null;
}

export async function cacheOrder(order: Omit<Order, "_id" | "cachedAt">): Promise<Order> {
  const db = await getDb();
  const doc = { ...order, cachedAt: new Date() };
  const result = await db.collection<Order>("orders").findOneAndUpdate(
    { orderId: order.orderId, merchantId: order.merchantId },
    { $set: doc },
    { upsert: true, returnDocument: "after" }
  );
  if (!result) {
    throw new Error(`Failed to cache order ${order.orderId}`);
  }
  return result;
}

export async function getDisputesNearDeadline(
  hoursThreshold: number
): Promise<Dispute[]> {
  const db = await getDb();
  const cutoff = new Date(Date.now() + hoursThreshold * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  return db
    .collection<Dispute>("disputes")
    .find({
      status: { $in: ["investigating", "review"] },
      deadline: { $lte: cutoff, $gte: now },
    })
    .toArray();
}

export async function listDisputes(limit = 100): Promise<Dispute[]> {
  const db = await getDb();
  return db
    .collection<Dispute>("disputes")
    .find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

export async function saveEvidencePackage(
  disputeId: string,
  pkg: Record<string, unknown>
): Promise<Evidence> {
  const db = await getDb();
  const doc = { disputeId, package: pkg, createdAt: new Date() };
  const result = await db.collection<Evidence>("evidence").findOneAndUpdate(
    { disputeId },
    { $set: doc },
    { upsert: true, returnDocument: "after" }
  );
  if (!result) {
    throw new Error(`Failed to save evidence for ${disputeId}`);
  }
  return result;
}

export async function getEvidencePackage(
  disputeId: string
): Promise<Evidence | null> {
  const db = await getDb();
  return db.collection<Evidence>("evidence").findOne({ disputeId });
}

export async function saveAiRun(
  data: Omit<AiRun, "_id" | "createdAt">
): Promise<AiRun> {
  const db = await getDb();
  const doc = { ...data, createdAt: new Date() };
  const result = await db.collection<AiRun>("ai_runs").insertOne(doc as AiRun);
  return { ...doc, _id: result.insertedId };
}

export function toMerchantSettingsResponse(
  settings: MerchantSettings
): MerchantSettings & { reviewAmountLimit: number } {
  return {
    reviewAmountLimit: 100,
    ...settings,
  };
}
