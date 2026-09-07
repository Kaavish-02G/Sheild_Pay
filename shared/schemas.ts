// Contracts between modules — see AGENTS.md. Append only in your PX section.
import { z } from "zod";

// --- P2: Evidence & Gateways ---
// (owned by P2 team — do not modify)

export const TrackingStatusSchema = z.object({
  orderId: z.string(),
  carrier: z.string().nullable(),
  trackingNumber: z.string().nullable(),
  status: z.enum(["pending", "in_transit", "delivered", "exception", "unknown"]),
  lastUpdate: z.string().nullable(),
  deliveredAt: z.string().nullable(),
  events: z
    .array(
      z.object({
        timestamp: z.string(),
        description: z.string(),
        location: z.string().optional(),
      })
    )
    .optional(),
});
export type TrackingStatus = z.infer<typeof TrackingStatusSchema>;

export const RefundHistorySchema = z.object({
  orderId: z.string(),
  refunds: z.array(
    z.object({
      refundId: z.string(),
      amount: z.number(),
      currency: z.string(),
      status: z.enum(["pending", "completed", "failed"]),
      reason: z.string().nullable(),
      createdAt: z.string(),
    })
  ),
  totalRefunded: z.number(),
});
export type RefundHistory = z.infer<typeof RefundHistorySchema>;

export const PaymentDetailsSchema = z.object({
  orderId: z.string(),
  paymentId: z.string(),
  status: z.enum([
    "authorized",
    "captured",
    "partially_refunded",
    "refunded",
    "voided",
  ]),
  amount: z.number(),
  currency: z.string(),
  method: z.string(),
  avsResult: z.string().nullable(),
  cvvResult: z.string().nullable(),
  gateway: z.enum(["stripe", "paypal", "razorpay", "shopify_payments", "unknown"]),
  cardNetwork: z
    .enum(["visa", "mastercard", "amex", "rupay", "unknown"])
    .optional()
    .default("unknown"),
  capturedAt: z.string().nullable(),
});
export type PaymentDetails = z.infer<typeof PaymentDetailsSchema>;

export const CustomerHistorySchema = z.object({
  customerId: z.string(),
  email: z.string(),
  totalOrders: z.number(),
  accountCreatedAt: z.string(),
  recentOrders: z.array(
    z.object({
      orderId: z.string(),
      totalAmount: z.number(),
      currency: z.string(),
      createdAt: z.string(),
      status: z.enum(["completed", "cancelled", "refunded", "pending"]),
    })
  ),
  disputeCount: z.number(),
});
export type CustomerHistory = z.infer<typeof CustomerHistorySchema>;

export const SubmissionResultSchema = z.object({
  success: z.boolean(),
  gatewayReference: z.string().optional(),
  error: z.string().optional(),
});
export type SubmissionResult = z.infer<typeof SubmissionResultSchema>;

export const GatewayTypeSchema = z.enum(["stripe", "paypal", "razorpay"]);
export type GatewayType = z.infer<typeof GatewayTypeSchema>;

export interface GatewayAdapter {
  submitEvidence(
    disputeId: string,
    pkg: VerifiedEvidencePackage
  ): Promise<SubmissionResult>;
  checkStatus(disputeId: string): Promise<SubmissionResult>;
}

// --- P3: AI Agent Loop ---
// (owned by P3 team — do not modify)

export const LedgerEntrySchema = z.object({
  step: z.number(),
  toolCalled: z.string().nullable(),
  toolInput: z.record(z.unknown()).nullable(),
  toolOutput: z.record(z.unknown()).nullable(),
  reasoning: z.string(),
  timestamp: z.string(),
});
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

export const RulePackDisplaySchema = z.object({
  network: z.enum(["visa", "mastercard", "amex", "rupay", "unknown"]),
  canonicalReason: z.string(),
  requirements: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
    })
  ),
  tools: z.array(
    z.object({
      name: z.string(),
      label: z.string(),
    })
  ),
});
export type RulePackDisplay = z.infer<typeof RulePackDisplaySchema>;

export const AgentVerifiedEvidencePackageSchema = z.object({
  disputeId: z.string(),
  evidence: z.record(z.unknown()),
  confidenceScore: z.number().min(0).max(100),
  status: z.enum(["auto_submit", "review", "insufficient"]),
  ledger: z.array(LedgerEntrySchema),
  canonicalReason: z.string().optional(),
  cardNetwork: z.string().optional(),
  gateway: GatewayTypeSchema.optional(),
  rulePack: RulePackDisplaySchema.optional(),
  validation: z
    .object({
      checks: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          passed: z.boolean(),
          value: z.string().optional(),
        })
      ),
      allRequiredMet: z.boolean(),
      missingFields: z.array(z.string()),
    })
    .optional(),
  strategy: z
    .object({
      focus: z.enum(["delivery_proof", "customer_history", "payment_proof", "combined"]),
      rationale: z.string(),
    })
    .optional(),
  rebuttalIterations: z
    .array(
      z.object({
        iteration: z.number(),
        draft: z.string(),
        critique: z.string(),
        approved: z.boolean(),
      })
    )
    .optional(),
  responseText: z.string().optional(),
});
export type AgentVerifiedEvidencePackage = z.infer<
  typeof AgentVerifiedEvidencePackageSchema
>;

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
  responseText: z.string().nullish(),
  gateway: GatewayTypeSchema.optional(),
  rawReason: z.string().optional(),
  canonicalReason: z.string().optional(),
  cardNetwork: z
    .enum(["visa", "mastercard", "amex", "rupay", "unknown"])
    .optional(),
  platform: z.enum(["shopify", "mock_commerce"]).optional(),
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
  responseText: z.string().nullish(),
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
  canonicalReason: z.string().optional(),
  cardNetwork: z.string().optional(),
  gateway: GatewayTypeSchema.optional(),
  rulePack: RulePackDisplaySchema.optional(),
  validation: z
    .object({
      checks: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          passed: z.boolean(),
          value: z.string().optional(),
        })
      ),
      allRequiredMet: z.boolean(),
      missingFields: z.array(z.string()),
    })
    .optional(),
  strategy: z
    .object({
      focus: z.string(),
      rationale: z.string(),
    })
    .optional(),
  rebuttalIterations: z
    .array(
      z.object({
        iteration: z.number(),
        draft: z.string(),
        critique: z.string(),
        approved: z.boolean(),
      })
    )
    .optional(),
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

// --- P1: normalization & rules ---

export const CanonicalDisputeReasonSchema = z.enum([
  "ITEM_NOT_RECEIVED",
  "ITEM_NOT_AS_DESCRIBED",
  "FRAUD",
  "DUPLICATE",
  "UNRECOGNIZED",
  "CREDIT_NOT_PROCESSED",
  "GENERAL",
]);
export type CanonicalDisputeReason = z.infer<typeof CanonicalDisputeReasonSchema>;

export const CardNetworkSchema = z.enum([
  "visa",
  "mastercard",
  "amex",
  "rupay",
  "unknown",
]);
export type CardNetwork = z.infer<typeof CardNetworkSchema>;

export const PlatformTypeSchema = z.enum(["shopify", "mock_commerce"]);
export type PlatformType = z.infer<typeof PlatformTypeSchema>;

export const EvidenceValidationCheckSchema = z.object({
  id: z.string(),
  label: z.string(),
  passed: z.boolean(),
  value: z.string().optional(),
});
export type EvidenceValidationCheck = z.infer<typeof EvidenceValidationCheckSchema>;

export const EvidenceValidationResultSchema = z.object({
  checks: z.array(EvidenceValidationCheckSchema),
  allRequiredMet: z.boolean(),
  missingFields: z.array(z.string()),
});
export type EvidenceValidationResult = z.infer<typeof EvidenceValidationResultSchema>;

export const RebuttalStrategySchema = z.object({
  focus: z.enum(["delivery_proof", "customer_history", "payment_proof", "combined"]),
  rationale: z.string(),
});
export type RebuttalStrategy = z.infer<typeof RebuttalStrategySchema>;

export const RebuttalIterationSchema = z.object({
  iteration: z.number(),
  draft: z.string(),
  critique: z.string(),
  approved: z.boolean(),
});
export type RebuttalIteration = z.infer<typeof RebuttalIterationSchema>;

export const DisputeEventSchema = z.object({
  disputeId: z.string(),
  orderId: z.string(),
  merchantId: z.string(),
  reason: z.string(),
  amount: z.number(),
  currency: z.string(),
  deadline: z.string(),
  platform: PlatformTypeSchema.default("shopify"),
  gateway: GatewayTypeSchema.optional(),
  rawReason: z.string().optional(),
  canonicalReason: CanonicalDisputeReasonSchema.optional(),
  cardNetwork: CardNetworkSchema.optional(),
});
export type DisputeEvent = z.infer<typeof DisputeEventSchema>;

export interface PlatformAdapter {
  authenticate(merchantId: string): Promise<{ success: boolean; accessToken?: string }>;
  getOrder(orderId: string): Promise<OrderDetails>;
  getCustomer(customerId: string): Promise<CustomerDetails>;
  getFulfillment(orderId: string): Promise<FulfillmentDetails>;
  onWebhook(payload: unknown, signature: string): Promise<DisputeEvent | null>;
}
