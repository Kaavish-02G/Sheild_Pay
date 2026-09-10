import crypto from "crypto";
import type {
  CustomerDetails,
  DisputeEvent,
  FulfillmentDetails,
  OrderDetails,
  PlatformAdapter,
} from "@/shared/schemas";
import { getMerchant, getMerchantByShopDomain, upsertMerchant } from "@/lib/core/models";
import { isMockToken, mockCustomer, mockFulfillment, mockOrder } from "@/shared/mocks/shopify-fixtures";

const API_VERSION = "2024-10";

interface ShopifyAdapterConfig {
  apiKey: string;
  apiSecret: string;
  webhookSecret: string;
}

interface ShopifySession {
  shop: string;
  accessToken: string;
}

function getConfig(): ShopifyAdapterConfig {
  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;

  if (!apiKey || !apiSecret || !webhookSecret) {
    throw new Error(
      "SHOPIFY_API_KEY, SHOPIFY_API_SECRET, and SHOPIFY_WEBHOOK_SECRET must be set"
    );
  }

  return { apiKey, apiSecret, webhookSecret };
}

function verifyHmac(rawBody: string, signature: string, secret: string): boolean {
  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");

  const digestBuf = Buffer.from(digest, "utf8");
  const sigBuf = Buffer.from(signature, "utf8");

  if (digestBuf.length !== sigBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(digestBuf, sigBuf);
}

async function shopifyGraphQL<T>(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(
    `https://${shopDomain}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify GraphQL error ${response.status}: ${text}`);
  }

  const json = (await response.json()) as { data?: T; errors?: { message: string }[] };

  if (json.errors?.length) {
    throw new Error(`Shopify GraphQL errors: ${json.errors.map((e) => e.message).join(", ")}`);
  }

  return json.data as T;
}

function extractNumericId(gid: string): string {
  const parts = gid.split("/");
  return parts[parts.length - 1] ?? gid;
}

export class ShopifyAdapter implements PlatformAdapter {
  private shopDomain: string | null = null;
  private accessToken: string | null = null;
  private webhookTopic: string | null = null;

  constructor(shopDomain?: string) {
    if (shopDomain) {
      this.shopDomain = shopDomain;
    }
  }

  private async resolveSession(merchantId?: string): Promise<ShopifySession> {
    const lookupId = merchantId ?? this.shopDomain;
    if (!lookupId) {
      throw new Error("No merchant/shop context — provide merchantId or set shopDomain");
    }

    const merchant = (await getMerchant(lookupId)) ?? (await getMerchantByShopDomain(lookupId));

    if (!merchant?.accessToken) {
      throw new Error(`No access token found for merchant ${lookupId}`);
    }

    this.shopDomain = merchant.shopDomain;
    this.accessToken = merchant.accessToken;

    return { shop: merchant.shopDomain, accessToken: merchant.accessToken };
  }

  async authenticate(merchantId: string): Promise<{ success: boolean; accessToken?: string }> {
    try {
      const sessionToken = merchantId;

      // Shopify CLI dev flow passes a session token (JWT) or shop domain + token pair
      if (sessionToken.includes(".")) {
        const payload = this.decodeSessionToken(sessionToken);
        const shop = payload.dest?.replace("https://", "").replace(/\/$/, "") ?? payload.iss;

        if (!shop) {
          return { success: false };
        }

        const tokenResponse = await this.exchangeSessionToken(sessionToken, shop);
        const merchant = await upsertMerchant(shop, tokenResponse.access_token);

        this.shopDomain = merchant.shopDomain;
        this.accessToken = merchant.accessToken;

        return { success: true, accessToken: merchant.accessToken };
      }

      // Direct shop domain authentication (shop.myshopify.com)
      const shopDomain = merchantId.includes(".myshopify.com")
        ? merchantId
        : `${merchantId}.myshopify.com`;

      const merchant = await getMerchantByShopDomain(shopDomain);
      if (merchant?.accessToken) {
        this.shopDomain = merchant.shopDomain;
        this.accessToken = merchant.accessToken;
        return { success: true, accessToken: merchant.accessToken };
      }

      return { success: false };
    } catch (error) {
      console.error("[shopify] authenticate failed:", error);
      return { success: false };
    }
  }

  private decodeSessionToken(token: string): { dest?: string; iss?: string; sub?: string } {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid session token format");
    }
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return payload;
  }

  private async exchangeSessionToken(
    sessionToken: string,
    shop: string
  ): Promise<{ access_token: string }> {
    const { apiKey, apiSecret } = getConfig();

    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: apiKey,
        client_secret: apiSecret,
        grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
        subject_token: sessionToken,
        subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
        requested_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${text}`);
    }

    return response.json() as Promise<{ access_token: string }>;
  }

  async getOrder(orderId: string): Promise<OrderDetails> {
    const { shop, accessToken } = await this.resolveSession();
    if (isMockToken(accessToken)) return mockOrder(orderId);

    const gid = orderId.startsWith("gid://")
      ? orderId
      : `gid://shopify/Order/${orderId}`;

    const data = await shopifyGraphQL<{
      order: {
        id: string;
        createdAt: string;
        totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
        customer: { id: string } | null;
        lineItems: {
          edges: { node: { name: string; quantity: number; originalUnitPriceSet: { shopMoney: { amount: string } } } }[];
        };
      } | null;
    }>(
      shop,
      accessToken,
      `query GetOrder($id: ID!) {
        order(id: $id) {
          id
          createdAt
          totalPriceSet { shopMoney { amount currencyCode } }
          customer { id }
          lineItems(first: 50) {
            edges {
              node {
                name
                quantity
                originalUnitPriceSet { shopMoney { amount } }
              }
            }
          }
        }
      }`,
      { id: gid }
    );

    if (!data.order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    const order = data.order;

    return {
      orderId: extractNumericId(order.id),
      customerId: order.customer ? extractNumericId(order.customer.id) : "",
      items: order.lineItems.edges.map((edge) => ({
        name: edge.node.name,
        quantity: edge.node.quantity,
        price: parseFloat(edge.node.originalUnitPriceSet.shopMoney.amount),
      })),
      totalAmount: parseFloat(order.totalPriceSet.shopMoney.amount),
      currency: order.totalPriceSet.shopMoney.currencyCode,
      createdAt: order.createdAt,
    };
  }

  async getCustomer(customerId: string): Promise<CustomerDetails> {
    const { shop, accessToken } = await this.resolveSession();
    if (isMockToken(accessToken)) return mockCustomer(customerId);

    const gid = customerId.startsWith("gid://")
      ? customerId
      : `gid://shopify/Customer/${customerId}`;

    const data = await shopifyGraphQL<{
      customer: {
        id: string;
        email: string;
        createdAt: string;
        numberOfOrders: string;
      } | null;
    }>(
      shop,
      accessToken,
      `query GetCustomer($id: ID!) {
        customer(id: $id) {
          id
          email
          createdAt
          numberOfOrders
        }
      }`,
      { id: gid }
    );

    if (!data.customer) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    const customer = data.customer;

    return {
      customerId: extractNumericId(customer.id),
      email: customer.email,
      totalOrders: parseInt(customer.numberOfOrders, 10),
      accountCreatedAt: customer.createdAt,
    };
  }

  async getFulfillment(orderId: string): Promise<FulfillmentDetails> {
    const { shop, accessToken } = await this.resolveSession();
    if (isMockToken(accessToken)) return mockFulfillment(orderId);

    const gid = orderId.startsWith("gid://")
      ? orderId
      : `gid://shopify/Order/${orderId}`;

    const data = await shopifyGraphQL<{
      order: {
        id: string;
        displayFulfillmentStatus: string;
        fulfillments: {
          trackingInfo: { number: string; company: string }[];
          createdAt: string;
          deliveredAt: string | null;
        }[];
      } | null;
    }>(
      shop,
      accessToken,
      `query GetFulfillment($id: ID!) {
        order(id: $id) {
          id
          displayFulfillmentStatus
          fulfillments {
            trackingInfo { number company }
            createdAt
            deliveredAt
          }
        }
      }`,
      { id: gid }
    );

    if (!data.order) {
      throw new Error(`Order not found for fulfillment: ${orderId}`);
    }

    const order = data.order;
    const fulfillment = order.fulfillments[0];
    const tracking = fulfillment?.trackingInfo?.[0];

    const statusMap: Record<string, FulfillmentDetails["status"]> = {
      FULFILLED: "fulfilled",
      UNFULFILLED: "unfulfilled",
      PARTIALLY_FULFILLED: "partial",
    };

    const rawStatus = order.displayFulfillmentStatus?.toUpperCase() ?? "UNFULFILLED";

    return {
      orderId: extractNumericId(order.id),
      status: statusMap[rawStatus] ?? "unfulfilled",
      trackingNumber: tracking?.number ?? null,
      carrier: tracking?.company ?? null,
      shippedAt: fulfillment?.createdAt ?? null,
      deliveredAt: fulfillment?.deliveredAt ?? null,
    };
  }

  async onWebhook(payload: unknown, signature: string): Promise<DisputeEvent | null> {
    const { webhookSecret } = getConfig();

    const rawBody =
      typeof payload === "string" ? payload : JSON.stringify(payload);

    if (!verifyHmac(rawBody, signature, webhookSecret)) {
      throw new Error("Invalid webhook HMAC signature");
    }

    const topic = this.webhookTopic;

    // Chargeback webhooks are unavailable in sandbox — return null for non-dispute topics
    if (topic !== "orders/updated" && topic !== "fulfillments/create") {
      return null;
    }

    // These topics update cached order data but do not produce dispute events
    console.log(`[shopify] Received webhook topic: ${topic} — no dispute event generated`);
    return null;
  }

  setShopContext(shopDomain: string, accessToken?: string): void {
    this.shopDomain = shopDomain;
    if (accessToken) {
      this.accessToken = accessToken;
    }
  }

  setWebhookTopic(topic: string): void {
    this.webhookTopic = topic;
  }
}

export const shopifyAdapter = new ShopifyAdapter();
