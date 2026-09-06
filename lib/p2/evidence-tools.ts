import {
  CustomerHistorySchema,
  FulfillmentDetailsSchema,
  OrderDetailsSchema,
  PaymentDetailsSchema,
  RefundHistorySchema,
  TrackingStatusSchema,
  type CustomerHistory,
  type FulfillmentDetails,
  type OrderDetails,
  type PaymentDetails,
  type RefundHistory,
  type TrackingStatus,
} from "@/shared/schemas";
import {
  mockCustomerHistory,
  mockFulfillmentDetails,
  mockOrderDetails,
  mockPaymentDetails,
  mockRefundHistory,
  mockTrackingStatus,
} from "@/shared/mocks/p2-fixtures";
import { fetchP1 } from "./http";
import { parseOrThrow } from "./validate";

// TODO: needs P1 route — GET /api/core/orders/:id
export async function getOrderDetails(orderId: string): Promise<OrderDetails> {
  const result = await fetchP1<{ order?: OrderDetails } & OrderDetails>(
    `/api/core/orders/${encodeURIComponent(orderId)}`,
    "GET /api/core/orders/:id"
  );

  if (!result.ok) {
    console.warn(
      `[P2] ${result.error} — using mock order fixture. TODO: needs P1 route`
    );
    return parseOrThrow(
      OrderDetailsSchema,
      "OrderDetails",
      mockOrderDetails(orderId)
    );
  }

  const payload = result.data.order ?? result.data;
  return parseOrThrow(OrderDetailsSchema, "OrderDetails", payload);
}

// TODO: needs P1 route — GET /api/core/customers/:id/history
export async function getCustomerHistory(
  customerId: string
): Promise<CustomerHistory> {
  const result = await fetchP1<{ history?: CustomerHistory } & CustomerHistory>(
    `/api/core/customers/${encodeURIComponent(customerId)}/history`,
    "GET /api/core/customers/:id/history"
  );

  if (!result.ok) {
    console.warn(
      `[P2] ${result.error} — using mock customer history fixture. TODO: needs P1 route`
    );
    return parseOrThrow(
      CustomerHistorySchema,
      "CustomerHistory",
      mockCustomerHistory(customerId)
    );
  }

  const payload = result.data.history ?? result.data;
  return parseOrThrow(CustomerHistorySchema, "CustomerHistory", payload);
}

// TODO: needs P1 route — GET /api/core/orders/:id/fulfillment
export async function getFulfillmentDetails(
  orderId: string
): Promise<FulfillmentDetails> {
  const result = await fetchP1<
    { fulfillment?: FulfillmentDetails } & FulfillmentDetails
  >(
    `/api/core/orders/${encodeURIComponent(orderId)}/fulfillment`,
    "GET /api/core/orders/:id/fulfillment"
  );

  if (!result.ok) {
    console.warn(
      `[P2] ${result.error} — using mock fulfillment fixture. TODO: needs P1 route`
    );
    return parseOrThrow(
      FulfillmentDetailsSchema,
      "FulfillmentDetails",
      mockFulfillmentDetails(orderId)
    );
  }

  const payload = result.data.fulfillment ?? result.data;
  return parseOrThrow(FulfillmentDetailsSchema, "FulfillmentDetails", payload);
}

// TODO: needs P1 route — GET /api/core/orders/:id/tracking
export async function getTrackingStatus(
  orderId: string
): Promise<TrackingStatus> {
  const result = await fetchP1<{ tracking?: TrackingStatus } & TrackingStatus>(
    `/api/core/orders/${encodeURIComponent(orderId)}/tracking`,
    "GET /api/core/orders/:id/tracking"
  );

  if (!result.ok) {
    console.warn(
      `[P2] ${result.error} — using mock tracking fixture. TODO: needs P1 route`
    );
    const fulfillment = mockFulfillmentDetails(orderId);
    const tracking = mockTrackingStatus(orderId);
    if (fulfillment.trackingNumber) {
      tracking.trackingNumber = fulfillment.trackingNumber;
      tracking.carrier = fulfillment.carrier;
    }
    return parseOrThrow(TrackingStatusSchema, "TrackingStatus", tracking);
  }

  const payload = result.data.tracking ?? result.data;
  return parseOrThrow(TrackingStatusSchema, "TrackingStatus", payload);
}

// TODO: needs P1 route — GET /api/core/orders/:id/refunds
export async function getRefundHistory(orderId: string): Promise<RefundHistory> {
  const result = await fetchP1<{ refunds?: RefundHistory } & RefundHistory>(
    `/api/core/orders/${encodeURIComponent(orderId)}/refunds`,
    "GET /api/core/orders/:id/refunds"
  );

  if (!result.ok) {
    console.warn(
      `[P2] ${result.error} — using mock refund history fixture. TODO: needs P1 route`
    );
    return parseOrThrow(
      RefundHistorySchema,
      "RefundHistory",
      mockRefundHistory(orderId)
    );
  }

  return parseOrThrow(RefundHistorySchema, "RefundHistory", result.data);
}

// TODO: needs P1 route — GET /api/core/orders/:id/payment
export async function getPaymentDetails(orderId: string): Promise<PaymentDetails> {
  const result = await fetchP1<{ payment?: PaymentDetails } & PaymentDetails>(
    `/api/core/orders/${encodeURIComponent(orderId)}/payment`,
    "GET /api/core/orders/:id/payment"
  );

  if (!result.ok) {
    console.warn(
      `[P2] ${result.error} — using mock payment fixture. TODO: needs P1 route`
    );
    return parseOrThrow(
      PaymentDetailsSchema,
      "PaymentDetails",
      mockPaymentDetails(orderId)
    );
  }

  const payload = result.data.payment ?? result.data;
  return parseOrThrow(PaymentDetailsSchema, "PaymentDetails", payload);
}

/** Resolve customer history from an order id (used by HTTP tool routes). */
export async function getCustomerHistoryForOrder(
  orderId: string
): Promise<CustomerHistory> {
  const order = await getOrderDetails(orderId);
  return getCustomerHistory(order.customerId);
}

export const EVIDENCE_TOOL_NAMES = [
  "getOrderDetails",
  "getCustomerHistory",
  "getFulfillmentDetails",
  "getTrackingStatus",
  "getRefundHistory",
  "getPaymentDetails",
] as const;

export type EvidenceToolName = (typeof EVIDENCE_TOOL_NAMES)[number];

export async function invokeEvidenceTool(
  name: EvidenceToolName,
  orderId: string
): Promise<
  | OrderDetails
  | CustomerHistory
  | FulfillmentDetails
  | TrackingStatus
  | RefundHistory
  | PaymentDetails
> {
  switch (name) {
    case "getOrderDetails":
      return getOrderDetails(orderId);
    case "getCustomerHistory":
      return getCustomerHistoryForOrder(orderId);
    case "getFulfillmentDetails":
      return getFulfillmentDetails(orderId);
    case "getTrackingStatus":
      return getTrackingStatus(orderId);
    case "getRefundHistory":
      return getRefundHistory(orderId);
    case "getPaymentDetails":
      return getPaymentDetails(orderId);
    default: {
      const exhaustive: never = name;
      throw new Error(`Unknown evidence tool: ${exhaustive}`);
    }
  }
}
