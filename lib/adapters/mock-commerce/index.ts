import type {
  CustomerDetails,
  CustomerHistory,
  DisputeEvent,
  FulfillmentDetails,
  OrderDetails,
  PaymentDetails,
  PlatformAdapter,
  RefundHistory,
  TrackingStatus,
} from "@/shared/schemas";

const DEFAULT_URL = process.env.MOCK_COMMERCE_URL ?? "http://localhost:4010";
const API_KEY = process.env.MOCK_COMMERCE_API_KEY ?? "mock-commerce-key";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${DEFAULT_URL}${path}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`Mock commerce ${path} returned ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export type MockOrderBundle = OrderDetails & {
  customer?: CustomerDetails;
  fulfillment?: FulfillmentDetails;
  tracking?: TrackingStatus;
  refunds?: RefundHistory;
  payment?: PaymentDetails;
};

export async function fetchMockOrderBundle(orderId: string): Promise<MockOrderBundle> {
  return fetchJson<MockOrderBundle>(`/orders/${encodeURIComponent(orderId)}`);
}

export const mockCommerceAdapter: PlatformAdapter = {
  async authenticate() {
    return { success: true, accessToken: "mock-commerce-token" };
  },

  async getOrder(orderId: string): Promise<OrderDetails> {
    const data = await fetchMockOrderBundle(orderId);
    return {
      orderId: data.orderId,
      customerId: data.customerId,
      items: data.items,
      totalAmount: data.totalAmount,
      currency: data.currency,
      createdAt: data.createdAt,
    };
  },

  async getCustomer(customerId: string): Promise<CustomerDetails> {
    try {
      return await fetchJson<CustomerDetails>(`/customers/${encodeURIComponent(customerId)}`);
    } catch {
      return {
        customerId,
        email: "customer@example.com",
        totalOrders: 1,
        accountCreatedAt: new Date().toISOString(),
      };
    }
  },

  async getFulfillment(orderId: string): Promise<FulfillmentDetails> {
    const data = await fetchMockOrderBundle(orderId);
    return (
      data.fulfillment ?? {
        orderId,
        status: "fulfilled",
        trackingNumber: null,
        carrier: null,
        shippedAt: null,
        deliveredAt: null,
      }
    );
  },

  async onWebhook(): Promise<DisputeEvent | null> {
    return null;
  },
};

export async function fetchMockPaymentDetails(orderId: string): Promise<PaymentDetails> {
  const data = await fetchMockOrderBundle(orderId);
  return (
    data.payment ?? {
      orderId,
      paymentId: `pay_mock_${orderId}`,
      status: "captured",
      amount: data.totalAmount,
      currency: data.currency,
      method: "card",
      avsResult: "match",
      cvvResult: "match",
      gateway: "stripe",
      cardNetwork: "visa",
      capturedAt: new Date().toISOString(),
    }
  );
}

export async function fetchMockTrackingStatus(orderId: string): Promise<TrackingStatus> {
  const data = await fetchMockOrderBundle(orderId);
  return (
    data.tracking ?? {
      orderId,
      carrier: "UPS",
      trackingNumber: null,
      status: "in_transit",
      lastUpdate: new Date().toISOString(),
      deliveredAt: null,
    }
  );
}

export async function fetchMockRefundHistory(orderId: string): Promise<RefundHistory> {
  const data = await fetchMockOrderBundle(orderId);
  return data.refunds ?? { orderId, refunds: [], totalRefunded: 0 };
}

export async function fetchMockCustomerHistory(orderId: string): Promise<CustomerHistory> {
  const data = await fetchMockOrderBundle(orderId);
  const customer = data.customer;
  return {
    customerId: customer?.customerId ?? `cust-${orderId}`,
    email: customer?.email ?? "customer@example.com",
    totalOrders: customer?.totalOrders ?? 1,
    accountCreatedAt: customer?.accountCreatedAt ?? new Date().toISOString(),
    recentOrders: [],
    disputeCount: 0,
  };
}

export function useMockCommerce(): boolean {
  return (
    process.env.MOCK_COMMERCE_MODE === "true" ||
    process.env.PLATFORM_MOCK_MODE === "true"
  );
}
