import { localOrderBundle } from '@/lib/shop-bridge';
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

    shopifyAdapter.setShopContext(shopDomain);

  }

}



export async function fetchOrderDetails(

  orderId: string,

  merchantHint?: string

): Promise<OrderDetails> {
  if (orderId.startsWith('NL-')) return localOrderBundle(orderId);


  if (await isMockCommercePlatform(merchantHint)) {

    try {

      return await mockCommerceAdapter.getOrder(orderId);

    } catch {

      if (!useShopifyMockData() && !useMockCommerce()) throw new Error("Evidence unavailable from connected platform");

      return mockOrderDetails(orderId);

    }

  }



  if (useShopifyMockData()) {

    if (!useShopifyMockData() && !useMockCommerce()) throw new Error("Evidence unavailable from connected platform");

    return mockOrderDetails(orderId);

  }



  await resolveShopContext(merchantHint);

  try {

    const adapter = await getAdapterForMerchant(defaultMerchantHint(merchantHint));

    return await adapter.getOrder(orderId);

  } catch {

    if (!useShopifyMockData() && !useMockCommerce()) throw new Error("Evidence unavailable from connected platform");

    return mockOrderDetails(orderId);

  }

}



export async function fetchCustomerHistory(

  customerId: string,

  merchantHint?: string

): Promise<CustomerHistory> {
  if (customerId.startsWith('cust-NL-') || customerId.startsWith('NL-')) { const id = customerId.replace(/^cust-/, ''); const o = await localOrderBundle(id); return { ...o.customer, recentOrders: [{ orderId: id, totalAmount: o.totalAmount, currency: 'USD', createdAt: o.createdAt, status: 'completed' as const }], disputeCount: 1 }; }


  if (await isMockCommercePlatform(merchantHint)) {

    const orderId = customerId.replace(/^cust-/, "1042");

    try {

      return await fetchMockCustomerHistory(orderId);

    } catch {

      if (!useShopifyMockData() && !useMockCommerce()) throw new Error("Evidence unavailable from connected platform");

      return mockCustomerHistory(customerId);

    }

  }



  if (useShopifyMockData()) {

    if (!useShopifyMockData() && !useMockCommerce()) throw new Error("Evidence unavailable from connected platform");

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
  if (orderId.startsWith('NL-')) { const o = await localOrderBundle(orderId); return { ...o.customer, recentOrders: [{ orderId, totalAmount: o.totalAmount, currency: 'USD', createdAt: o.createdAt, status: 'completed' as const }], disputeCount: 1 }; }


  const order = await fetchOrderDetails(orderId, merchantHint);

  return fetchCustomerHistory(order.customerId || "cust-unknown", merchantHint);

}



export async function fetchFulfillmentDetails(

  orderId: string,

  merchantHint?: string

): Promise<FulfillmentDetails> {
  if (orderId.startsWith('NL-')) return (await localOrderBundle(orderId)).fulfillment;


  if (await isMockCommercePlatform(merchantHint)) {

    try {

      return await mockCommerceAdapter.getFulfillment(orderId);

    } catch {

      if (!useShopifyMockData() && !useMockCommerce()) throw new Error("Evidence unavailable from connected platform");

      return mockFulfillmentDetails(orderId);

    }

  }



  if (useShopifyMockData()) {

    await resolveShopContext(merchantHint);

    try {

      return await shopifyAdapter.getFulfillment(orderId);

    } catch {

      if (!useShopifyMockData() && !useMockCommerce()) throw new Error("Evidence unavailable from connected platform");

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
  if (orderId.startsWith('NL-')) return (await localOrderBundle(orderId)).tracking;


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

      if (!useShopifyMockData() && !useMockCommerce()) throw new Error("Evidence unavailable from connected platform");

      return mockTrackingStatus(orderId);

    }

  }



  const fulfillment = await fetchFulfillmentDetails(orderId, merchantHint);

  if (!useShopifyMockData()) { const f = await fetchFulfillmentDetails(orderId, merchantHint); return { orderId, carrier: f.carrier, trackingNumber: f.trackingNumber, status: f.deliveredAt ? "delivered" : f.shippedAt ? "in_transit" : "unknown", lastUpdate: f.deliveredAt ?? f.shippedAt, deliveredAt: f.deliveredAt }; }
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
  if (orderId.startsWith('NL-')) return (await localOrderBundle(orderId)).refunds;


  if (await isMockCommercePlatform(merchantHint)) {

    try {

      return await fetchMockRefundHistory(orderId);

    } catch {

      if (!useShopifyMockData() && !useMockCommerce()) throw new Error("Evidence unavailable from connected platform");

      return mockRefundHistory(orderId);

    }

  }

  if (!useShopifyMockData() && !useMockCommerce()) throw new Error("Evidence unavailable from connected platform");

  return mockRefundHistory(orderId);

}



export async function fetchPaymentDetails(

  orderId: string,

  merchantHint?: string

): Promise<PaymentDetails> {
  if (orderId.startsWith('NL-')) return (await localOrderBundle(orderId)).payment;


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



  if (!useShopifyMockData()) throw new Error("Live payment evidence source is not configured");
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


