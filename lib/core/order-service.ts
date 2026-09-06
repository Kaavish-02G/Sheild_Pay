import { shopifyAdapter } from "@/lib/adapters/shopify";
import {
  mockCustomerHistory,
  mockFulfillmentDetails,
  mockOrderDetails,
  mockPaymentDetails,
  mockRefundHistory,
  mockTrackingStatus,
} from "@/shared/mocks/p2-fixtures";
import { mockCustomer, mockFulfillment, mockOrder } from "@/shared/mocks/shopify-fixtures";
import type {
  CustomerHistory,
  FulfillmentDetails,
  OrderDetails,
  PaymentDetails,
  RefundHistory,
  TrackingStatus,
} from "@/shared/schemas";
import { getMerchant, getMerchantByShopDomain } from "./models";

function useMockData(): boolean {
  return process.env.SHOPIFY_MOCK_MODE === "true" || process.env.NODE_ENV === "test";
}

async function resolveShopContext(merchantHint?: string): Promise<void> {
  const shopDomain =
    merchantHint ??
    process.env.SHOPIFY_DEV_STORE ??
    "demo-merchant.myshopify.com";

  const merchant =
    (await getMerchant(shopDomain)) ?? (await getMerchantByShopDomain(shopDomain));

  if (merchant?.accessToken) {
    shopifyAdapter.setShopContext(merchant.shopDomain, merchant.accessToken);
    return;
  }

  if (useMockData()) {
    shopifyAdapter.setShopContext(shopDomain, "mock-token");
  }
}

export async function fetchOrderDetails(orderId: string): Promise<OrderDetails> {
  if (useMockData()) {
    return mockOrderDetails(orderId);
  }

  await resolveShopContext();
  try {
    return await shopifyAdapter.getOrder(orderId);
  } catch {
    return mockOrderDetails(orderId);
  }
}

export async function fetchCustomerHistory(
  customerId: string
): Promise<CustomerHistory> {
  if (useMockData()) {
    return mockCustomerHistory(customerId);
  }

  await resolveShopContext();
  const customer = await shopifyAdapter.getCustomer(customerId);
  return {
    customerId: customer.customerId,
    email: customer.email,
    totalOrders: customer.totalOrders,
    accountCreatedAt: customer.accountCreatedAt,
    recentOrders: [],
    disputeCount: 0,
  };
}

export async function fetchCustomerHistoryForOrder(
  orderId: string
): Promise<CustomerHistory> {
  const order = await fetchOrderDetails(orderId);
  return fetchCustomerHistory(order.customerId || "cust-unknown");
}

export async function fetchFulfillmentDetails(
  orderId: string
): Promise<FulfillmentDetails> {
  if (useMockData()) {
    await resolveShopContext();
    try {
      return await shopifyAdapter.getFulfillment(orderId);
    } catch {
      return mockFulfillmentDetails(orderId);
    }
  }

  await resolveShopContext();
  return shopifyAdapter.getFulfillment(orderId);
}

export async function fetchTrackingStatus(orderId: string): Promise<TrackingStatus> {
  const fulfillment = await fetchFulfillmentDetails(orderId);
  const tracking = mockTrackingStatus(orderId);
  if (fulfillment.trackingNumber) {
    tracking.trackingNumber = fulfillment.trackingNumber;
    tracking.carrier = fulfillment.carrier;
  }
  if (fulfillment.deliveredAt) {
    tracking.status = "delivered";
    tracking.deliveredAt = fulfillment.deliveredAt;
  }
  return tracking;
}

export async function fetchRefundHistory(orderId: string): Promise<RefundHistory> {
  return mockRefundHistory(orderId);
}

export async function fetchPaymentDetails(orderId: string): Promise<PaymentDetails> {
  const order = await fetchOrderDetails(orderId);
  const payment = mockPaymentDetails(orderId);
  payment.amount = order.totalAmount;
  payment.currency = order.currency;
  return payment;
}

export async function fetchOrderForSimulate(orderId: string): Promise<OrderDetails> {
  if (useMockData()) {
    return mockOrderDetails(orderId);
  }
  return fetchOrderDetails(orderId);
}
