import type { CustomerDetails, FulfillmentDetails, OrderDetails } from "@/shared/schemas";

export const MOCK_ACCESS_TOKEN = "mock-token";

export function isMockToken(token: string): boolean {
  return (
    process.env.SHOPIFY_MOCK_MODE === "true" ||
    process.env.NODE_ENV === "test" ||
    token === MOCK_ACCESS_TOKEN
  );
}

export function mockOrder(orderId: string): OrderDetails {
  return {
    orderId,
    customerId: "mock-customer-1",
    items: [{ name: "Test Product", quantity: 1, price: 49.99 }],
    totalAmount: 49.99,
    currency: "USD",
    createdAt: "2024-01-15T10:00:00Z",
  };
}

export function mockCustomer(customerId: string): CustomerDetails {
  return {
    customerId,
    email: "customer@example.com",
    totalOrders: 3,
    accountCreatedAt: "2023-06-01T00:00:00Z",
  };
}

export function mockFulfillment(orderId: string): FulfillmentDetails {
  return {
    orderId,
    status: "fulfilled",
    trackingNumber: "MOCK123456",
    carrier: "USPS",
    shippedAt: "2024-01-16T08:00:00Z",
    deliveredAt: "2024-01-18T14:00:00Z",
  };
}
