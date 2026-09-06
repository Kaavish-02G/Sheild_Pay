import type {
  CustomerHistory,
  FulfillmentDetails,
  OrderDetails,
  PaymentDetails,
  RefundHistory,
  TrackingStatus,
} from "@/shared/schemas";

export const MOCK_ORDER_ID = "1042";

export function mockOrderDetails(orderId: string): OrderDetails {
  return {
    orderId,
    customerId: "cust-1042",
    items: [
      { name: "Wireless Headphones", quantity: 1, price: 99.99 },
      { name: "USB-C Cable", quantity: 1, price: 50.0 },
    ],
    totalAmount: 149.99,
    currency: "USD",
    createdAt: "2026-08-28T14:22:00.000Z",
  };
}

export function mockCustomerHistory(customerId: string): CustomerHistory {
  return {
    customerId,
    email: "customer@example.com",
    totalOrders: 3,
    accountCreatedAt: "2025-11-15T09:00:00.000Z",
    recentOrders: [
      {
        orderId: "1042",
        totalAmount: 149.99,
        currency: "USD",
        createdAt: "2026-08-28T14:22:00.000Z",
        status: "completed",
      },
      {
        orderId: "981",
        totalAmount: 59.99,
        currency: "USD",
        createdAt: "2026-07-10T11:05:00.000Z",
        status: "completed",
      },
      {
        orderId: "812",
        totalAmount: 34.5,
        currency: "USD",
        createdAt: "2026-05-02T16:40:00.000Z",
        status: "completed",
      },
    ],
    disputeCount: 0,
  };
}

export function mockFulfillmentDetails(orderId: string): FulfillmentDetails {
  return {
    orderId,
    status: "fulfilled",
    trackingNumber: "1Z999AA10123456784",
    carrier: "UPS",
    shippedAt: "2026-08-29T10:15:00.000Z",
    deliveredAt: "2026-09-01T14:14:00.000Z",
  };
}

export function mockTrackingStatus(orderId: string): TrackingStatus {
  return {
    orderId,
    carrier: "UPS",
    trackingNumber: "1Z999AA10123456784",
    status: "delivered",
    lastUpdate: "2026-09-01T14:14:00.000Z",
    deliveredAt: "2026-09-01T14:14:00.000Z",
    events: [
      {
        timestamp: "2026-08-29T10:15:00.000Z",
        description: "Shipment picked up",
        location: "San Francisco, CA",
      },
      {
        timestamp: "2026-08-31T08:22:00.000Z",
        description: "In transit",
        location: "Sacramento, CA",
      },
      {
        timestamp: "2026-09-01T14:14:00.000Z",
        description: "Delivered to front door",
        location: "Oakland, CA",
      },
    ],
  };
}

export function mockRefundHistory(orderId: string): RefundHistory {
  return {
    orderId,
    refunds: [],
    totalRefunded: 0,
  };
}

export function mockPaymentDetails(orderId: string): PaymentDetails {
  return {
    orderId,
    paymentId: "pay_mock_1042",
    status: "captured",
    amount: 149.99,
    currency: "USD",
    method: "card",
    avsResult: "match",
    cvvResult: "match",
    gateway: "stripe",
    capturedAt: "2026-08-28T14:22:05.000Z",
  };
}
