// Contracts between modules — see AGENTS.md. Append only in your PX section.
import { z } from "zod";

// --- P2: Evidence & Gateways ---
// (owned by P2 team — do not modify)

// --- P3: AI Agent ---
// (owned by P3 team — do not modify)

// --- P4: Response Gen + Dashboard ---
// (owned by P4 team — do not modify)

// --- P1: Platform Adapter ---

export const OrderDetailsSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  items: z.array(
    z.object({ name: z.string(), quantity: z.number(), price: z.number() })
  ),
  totalAmount: z.number(),
  currency: z.string(),
  createdAt: z.string(),
});
export type OrderDetails = z.infer<typeof OrderDetailsSchema>;

export const CustomerDetailsSchema = z.object({
  customerId: z.string(),
  email: z.string(),
  totalOrders: z.number(),
  accountCreatedAt: z.string(),
});
export type CustomerDetails = z.infer<typeof CustomerDetailsSchema>;

export const FulfillmentDetailsSchema = z.object({
  orderId: z.string(),
  status: z.enum(["fulfilled", "unfulfilled", "partial"]),
  trackingNumber: z.string().nullable(),
  carrier: z.string().nullable(),
  shippedAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
});
export type FulfillmentDetails = z.infer<typeof FulfillmentDetailsSchema>;

export const DisputeEventSchema = z.object({
  disputeId: z.string(),
  orderId: z.string(),
  merchantId: z.string(),
  reason: z.string(),
  amount: z.number(),
  currency: z.string(),
  deadline: z.string(),
  platform: z.enum(["shopify"]),
});
export type DisputeEvent = z.infer<typeof DisputeEventSchema>;

export interface PlatformAdapter {
  authenticate(merchantId: string): Promise<{ success: boolean; accessToken?: string }>;
  getOrder(orderId: string): Promise<OrderDetails>;
  getCustomer(customerId: string): Promise<CustomerDetails>;
  getFulfillment(orderId: string): Promise<FulfillmentDetails>;
  onWebhook(payload: unknown, signature: string): Promise<DisputeEvent | null>;
}
