// Contracts between modules — see AGENTS.md. Append only in your PX section.
import { z } from "zod";

// --- P2: Evidence & Gateways ---
// (owned by P2 team — do not modify)

// --- P3: AI Agent ---
// (owned by P3 team — do not modify)

// --- P4: Response Gen + Dashboard ---
// (owned by P4 team — do not modify)

export const DisputeStatusSchema = z.enum([
  "investigating",
  "review",
  "submitted",
  "insufficient",
]);
export type DisputeStatus = z.infer<typeof DisputeStatusSchema>;

export const DisputeSchema = z.object({
  disputeId: z.string(),
  orderId: z.string(),
  merchantId: z.string(),
  reason: z.string(),
  amount: z.number(),
  currency: z.string(),
  deadline: z.string(),
  status: DisputeStatusSchema,
  createdAt: z.string().optional(),
  responseText: z.string().optional(),
});
export type Dispute = z.infer<typeof DisputeSchema>;

export const MerchantSettingsSchema = z.object({
  autoSubmitThreshold: z.number(),
  minEvidenceScore: z.number(),
  reviewAmountLimit: z.number(),
  requireApprovalHighValue: z.boolean(),
  requireApprovalWeakEvidence: z.boolean(),
  requireApprovalMissingDeliveryProof: z.boolean().optional(),
});
export type MerchantSettings = z.infer<typeof MerchantSettingsSchema>;

export const AutomationActionSchema = z.enum([
  "auto_submitted",
  "review_required",
  "insufficient",
  "already_submitted",
  "submission_unavailable",
]);
export type AutomationAction = z.infer<typeof AutomationActionSchema>;

export const AutomationResultSchema = z.object({
  action: AutomationActionSchema,
  disputeId: z.string(),
  message: z.string(),
  responseText: z.string().optional(),
  notification: z
    .object({
      disputeId: z.string(),
      orderId: z.string(),
      amount: z.number(),
      currency: z.string(),
      reason: z.string(),
      message: z.string(),
      createdAt: z.string(),
    })
    .optional(),
});
export type AutomationResult = z.infer<typeof AutomationResultSchema>;

export const MerchantNotificationSchema = z.object({
  disputeId: z.string(),
  orderId: z.string(),
  amount: z.number(),
  currency: z.string(),
  reason: z.string(),
  message: z.string(),
  createdAt: z.string(),
});
export type MerchantNotification = z.infer<typeof MerchantNotificationSchema>;

export const AuditLedgerEntrySchema = z.object({
  tool: z.string(),
  reasoning: z.string(),
  resultSummary: z.string(),
  timestamp: z.string(),
});
export type AuditLedgerEntry = z.infer<typeof AuditLedgerEntrySchema>;

export const EvidenceFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.string(),
  source: z.string().optional(),
});
export type EvidenceField = z.infer<typeof EvidenceFieldSchema>;

export const VerifiedEvidencePackageSchema = z.object({
  disputeId: z.string(),
  disputeReason: z.string(),
  confidenceScore: z.number().min(0).max(100),
  evidence: z.array(EvidenceFieldSchema),
  ledger: z.array(AuditLedgerEntrySchema),
  generatedAt: z.string(),
});
export type VerifiedEvidencePackage = z.infer<typeof VerifiedEvidencePackageSchema>;

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
