import { randomUUID } from "crypto";
import { normalizeDisputeReason } from "@/lib/core/normalization/reasons";
import { handleDisputeEvent } from "@/lib/core/orchestrator";
import { upsertMockMerchant, upsertMerchant } from "@/lib/core/models";
import type {
  CanonicalDisputeReason,
  CardNetwork,
  DisputeEvent,
  GatewayType,
} from "@/shared/schemas";

function defaultDeadline(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString();
}

export function buildDisputeEvent(input: {
  disputeId: string;
  orderId: string;
  merchantId: string;
  gateway: GatewayType;
  rawReason: string;
  amount: number;
  currency: string;
  cardNetwork?: CardNetwork;
  platform?: "shopify" | "mock_commerce";
  deadline?: string;
}): DisputeEvent {
  const canonicalReason = normalizeDisputeReason(input.gateway, input.rawReason);

  return {
    disputeId: input.disputeId.startsWith("sim-") || input.disputeId.startsWith("dp_")
      ? input.disputeId.startsWith("sim-")
        ? input.disputeId
        : `sim-${input.disputeId.replace(/^dp_/, "")}`
      : `sim-${randomUUID()}`,
    orderId: input.orderId,
    merchantId: input.merchantId,
    reason: canonicalReason.replace(/_/g, " ").toLowerCase(),
    amount: input.amount,
    currency: input.currency.toUpperCase(),
    deadline: input.deadline ?? defaultDeadline(),
    platform: input.platform ?? "mock_commerce",
    gateway: input.gateway,
    rawReason: input.rawReason,
    canonicalReason,
    cardNetwork: input.cardNetwork ?? "visa",
  };
}

export async function ingestDisputeEvent(event: DisputeEvent): Promise<DisputeEvent> {
  let resolved = event;

  if (event.platform === "mock_commerce") {
    const merchant = await upsertMockMerchant(event.merchantId);
    resolved = { ...event, merchantId: merchant._id.toString() };
  } else if (event.platform === "shopify") {
    const merchant = await upsertMerchant(event.merchantId, "webhook-token");
    resolved = { ...event, merchantId: merchant._id.toString() };
  }

  await handleDisputeEvent(resolved);
  return resolved;
}

export function parseStripeDisputeWebhook(body: Record<string, unknown>): DisputeEvent | null {
  const type = String(body.type ?? "");
  if (type !== "charge.dispute.created" && type !== "charge.dispute.updated") {
    return null;
  }

  const object = (body.data as { object?: Record<string, unknown> })?.object;
  if (!object) return null;

  const metadata = (object.metadata as Record<string, string>) ?? {};
  const orderId = metadata.order_id ?? metadata.orderId ?? "1042";
  const merchantId =
    metadata.merchant_id ??
    metadata.merchantId ??
    process.env.NEXT_PUBLIC_MERCHANT_ID ??
    "demo-merchant";

  const paymentDetails = object.payment_method_details as
    | { card?: { network?: string } }
    | undefined;
  const cardNetwork = (paymentDetails?.card?.network ?? "visa") as CardNetwork;

  const amountCents = Number(object.amount ?? 0);
  const amount = amountCents > 100 ? amountCents / 100 : amountCents;

  return buildDisputeEvent({
    disputeId: String(object.id ?? randomUUID()),
    orderId,
    merchantId,
    gateway: "stripe",
    rawReason: String(object.reason ?? "product_not_received"),
    amount: amount || 49.99,
    currency: String(object.currency ?? "usd"),
    cardNetwork,
    platform: "mock_commerce",
  });
}

export function parsePayPalDisputeWebhook(body: Record<string, unknown>): DisputeEvent | null {
  const resource = body.resource as Record<string, unknown> | undefined;
  if (!resource) return null;

  const disputeId = String(resource.dispute_id ?? randomUUID());
  const transactions = resource.dispute_transactions as Array<Record<string, unknown>> | undefined;
  const tx = transactions?.[0];
  const amountObj = tx?.gross_amount as { value?: string; currency_code?: string } | undefined;

  return buildDisputeEvent({
    disputeId,
    orderId: String(resource.custom ?? "1042"),
    merchantId: process.env.NEXT_PUBLIC_MERCHANT_ID ?? "demo-merchant",
    gateway: "paypal",
    rawReason: String(resource.reason ?? "item_not_received"),
    amount: Number(amountObj?.value ?? 49.99),
    currency: String(amountObj?.currency_code ?? "USD"),
    platform: "mock_commerce",
  });
}

export function parseRazorpayDisputeWebhook(body: Record<string, unknown>): DisputeEvent | null {
  const payload = (body.payload as { dispute?: { entity?: Record<string, unknown> } })?.dispute
    ?.entity;
  if (!payload) return null;

  return buildDisputeEvent({
    disputeId: String(payload.id ?? randomUUID()),
    orderId: String(payload.order_id ?? "1042"),
    merchantId: process.env.NEXT_PUBLIC_MERCHANT_ID ?? "demo-merchant",
    gateway: "razorpay",
    rawReason: String(payload.reason_code ?? "goods_not_received"),
    amount: Number(payload.amount ?? 4999) / 100,
    currency: "INR",
    cardNetwork: "rupay",
    platform: "mock_commerce",
  });
}

export type { CanonicalDisputeReason };
