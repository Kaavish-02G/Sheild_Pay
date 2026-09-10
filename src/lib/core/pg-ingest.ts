import { randomUUID } from "crypto";
import { normalizeDisputeReason } from "@/lib/core/normalization/reasons";
import { handleDisputeEvent } from "@/lib/core/orchestrator";
import { upsertMockMerchant, getMerchant } from "@/lib/core/models";
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
    disputeId: input.disputeId,
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
    if (!merchant) throw new Error("Merchant not connected");
    const processor = merchant.settings?.paymentProcessor;
    resolved = {
      ...event,
      merchantId: merchant._id.toString(),
      gateway:
        processor === "stripe" || processor === "paypal" || processor === "razorpay"
          ? processor
          : event.gateway,
    };
  } else if (event.platform === "shopify") {
    const merchant = await getMerchant(event.merchantId);
    if (!merchant) throw new Error("Merchant not connected");
    const processor = merchant.settings?.paymentProcessor;
    resolved = {
      ...event,
      merchantId: merchant._id.toString(),
      gateway:
        processor === "stripe" || processor === "paypal" || processor === "razorpay"
          ? processor
          : event.gateway,
    };
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
  const orderId = metadata.order_id ?? metadata.orderId ?? "";
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
  const amount = amountCents / 100;

  return buildDisputeEvent({
    disputeId: String(object.id ?? ""),
    orderId,
    merchantId,
    gateway: "stripe",
    rawReason: String(object.reason ?? "product_not_received"),
    amount,
    currency: String(object.currency ?? "usd"),
    cardNetwork,
    platform: "shopify",
  });
}

export function parsePayPalDisputeWebhook(body: Record<string, unknown>): DisputeEvent | null {
  if (!String(body.event_type ?? "").startsWith("CUSTOMER.DISPUTE.")) return null;
  const resource = body.resource as Record<string, unknown> | undefined;
  if (!resource) return null;

  const disputeId = String(resource.dispute_id ?? "");
  const transactions = resource.dispute_transactions as Array<Record<string, unknown>> | undefined;
  const tx = transactions?.[0];
  const amountObj = tx?.gross_amount as { value?: string; currency_code?: string } | undefined;

  return buildDisputeEvent({
    disputeId,
    orderId: String(resource.custom ?? ""),
    merchantId: process.env.NEXT_PUBLIC_MERCHANT_ID ?? "demo-merchant",
    gateway: "paypal",
    rawReason: String(resource.reason ?? "item_not_received"),
    amount: Number(amountObj?.value ?? 49.99),
    currency: String(amountObj?.currency_code ?? "USD"),
    platform: "shopify",
  });
}

export function parseRazorpayDisputeWebhook(body: Record<string, unknown>): DisputeEvent | null {
  if (!String(body.event ?? "").startsWith("payment.dispute.")) return null;
  const payload = (body.payload as { dispute?: { entity?: Record<string, unknown> } })?.dispute
    ?.entity;
  if (!payload) return null;

  return buildDisputeEvent({
    disputeId: String(payload.id ?? ""),
    orderId: String(payload.order_id ?? ""),
    merchantId: process.env.NEXT_PUBLIC_MERCHANT_ID ?? "demo-merchant",
    gateway: "razorpay",
    rawReason: String(payload.reason_code ?? "goods_not_received"),
    amount: Number(payload.amount ?? 4999) / 100,
    currency: "INR",
    cardNetwork: "rupay",
    platform: "shopify",
  });
}

export type { CanonicalDisputeReason };
