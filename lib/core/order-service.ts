import { shopifyAdapter } from "@/lib/adapters/shopify";
import {
  fetchMockCustomerHistory,
  fetchMockOrderBundle,
  fetchMockPaymentDetails,
  fetchMockRefundHistory,
  fetchMockTrackingStatus,
  mockCommerceAdapter,
  useMockCommerce,
} from "@/lib/adapters/mock-commerce";
import { getAdapterForMerchant, resolveMerchantPlatform } from "@/lib/adapters/registry";
import {
  mockCustomerHistory,
  mockFulfillmentDetails,
  mockOrderDetails,
  mockPaymentDetails,
  mockRefundHistory,
  mockTrackingStatus,
} from "@/shared/mocks/p2-fixtures";
import type {
  CustomerHistory,
  FulfillmentDetails,
  OrderDetails,
  PaymentDetails,
  RefundHistory,
  TrackingStatus,
} from "@/shared/schemas";

function useShopifyMockData(): boolean {
  return process.env.SHOPIFY_MOCK_MODE === "true" || process.env.NODE_ENV === "test";
}

function defaultMerchantHint(merchantHint?: string): string {
  return (
    merchantHint ??
    process.env.NEXT_PUBLIC_MERCHANT_ID ??
    process.env.SHOPIFY_DEV_STORE ??
    "demo-merchant"
  );
}

async function isMockCommercePlatform(merchantHint?: string): Promise<boolean> {
  if (useMockCommerce()) {
    return true;
  }
  return (await resolveMerchantPlatform(defaultMerchantHint(merchantHint))) === "mock_commerce";
}

async function resolveShopContext(merchantHint?: string): Promise<void> {
  const shopDomain = defaultMerchantHint(merchantHint);
  const adapter = await getAdapterForMerchant(shopDomain);
  if (adapter === mockCommerceAdapter) {
    return;
  }
  if (adapter === shopifyAdapter) {
    shopifyAdapter.setShopContext(shopDomain, "mock-token");
  }
}

export async function fetchOrderDetails(
  orderId: string,
  merchantHint?: string
): Promise<OrderDetails> {
  if (await isMockCommercePlatform(merchantHint)) {
    try {
      return await mockCommerceAdapter.getOrder(orderId);
    } catch {
      return mockOrderDetails(orderId);
    }
  }

  if (useShopifyMockData()) {
    return mockOrderDetails(orderId);
  }

  await resolveShopContext(merchantHint);
  try {
    const adapter = await getAdapterForMerchant(defaultMerchantHint(merchantHint));
    return await adapter.getOrder(orderId);
  } catch {
    return mockOrderDetails(orderId);
  }
}

export async function fetchCustomerHistory(
  customerId: string,
  merchantHint?: string
): Promise<CustomerHistory> {
  if (await isMockCommercePlatform(merchantHint)) {
    const orderId = customerId.replace(/^cust-/, "1042");
    try {
      return await fetchMockCustomerHistory(orderId);
    } catch {
      return mockCustomerHistory(customerId);
    }
  }

  if (useShopifyMockData()) {
    return mockCustomerHistory(customerId);
  }

  await resolveShopContext(merchantHint);
  const adapter = await getAdapterForMerchant(defaultMerchantHint(merchantHint));
  const customer = await adapter.getCustomer(customerId);
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
  orderId: string,
  merchantHint?: string
): Promise<CustomerHistory> {
  const order = await fetchOrderDetails(orderId, merchantHint);
  return fetchCustomerHistory(order.customerId || "cust-unknown", merchantHint);
}

export async function fetchFulfillmentDetails(
  orderId: string,
  merchantHint?: string
): Promise<FulfillmentDetails> {
  if (await isMockCommercePlatform(merchantHint)) {
    try {
      return await mockCommerceAdapter.getFulfillment(orderId);
    } catch {
      return mockFulfillmentDetails(orderId);
    }
  }

  if (useShopifyMockData()) {
    await resolveShopContext(merchantHint);
    try {
      return await shopifyAdapter.getFulfillment(orderId);
    } catch {
      return mockFulfillmentDetails(orderId);
    }
  }

  await resolveShopContext(merchantHint);
  const adapter = await getAdapterForMerchant(defaultMerchantHint(merchantHint));
  return adapter.getFulfillment(orderId);
}

export async function fetchTrackingStatus(
  orderId: string,
  merchantHint?: string
): Promise<TrackingStatus> {
  if (await isMockCommercePlatform(merchantHint)) {
    try {
      const tracking = await fetchMockTrackingStatus(orderId);
      const fulfillment = await mockCommerceAdapter.getFulfillment(orderId);
      if (fulfillment.trackingNumber) {
        tracking.trackingNumber = fulfillment.trackingNumber;
        tracking.carrier = fulfillment.carrier;
      }
      if (fulfillment.deliveredAt) {
        tracking.status = "delivered";
        tracking.deliveredAt = fulfillment.deliveredAt;
      }
      return tracking;
    } catch {
      return mockTrackingStatus(orderId);
    }
  }

  const fulfillment = await fetchFulfillmentDetails(orderId, merchantHint);
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

export async function fetchRefundHistory(
  orderId: string,
  merchantHint?: string
): Promise<RefundHistory> {
  if (await isMockCommercePlatform(merchantHint)) {
    try {
      return await fetchMockRefundHistory(orderId);
    } catch {
      return mockRefundHistory(orderId);
    }
  }
  return mockRefundHistory(orderId);
}

export async function fetchPaymentDetails(
  orderId: string,
  merchantHint?: string
): Promise<PaymentDetails> {
  if (await isMockCommercePlatform(merchantHint)) {
    try {
      const payment = await fetchMockPaymentDetails(orderId);
      const order = await fetchOrderDetails(orderId, merchantHint);
      payment.amount = order.totalAmount;
      payment.currency = order.currency;
      return payment;
    } catch {
      const payment = mockPaymentDetails(orderId);
      const order = await fetchOrderDetails(orderId, merchantHint);
      payment.amount = order.totalAmount;
      payment.currency = order.currency;
      return payment;
    }
  }

  const order = await fetchOrderDetails(orderId, merchantHint);
  const payment = mockPaymentDetails(orderId);
  payment.amount = order.totalAmount;
  payment.currency = order.currency;
  return payment;
}

export async function fetchOrderForSimulate(
  orderId: string,
  merchantHint?: string
): Promise<OrderDetails> {
  return fetchOrderDetails(orderId, merchantHint);
}

export { fetchMockOrderBundle };
