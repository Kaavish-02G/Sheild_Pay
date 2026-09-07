/**
 * Mock commerce backend — catalog, checkout, orders, customer dispute filing.
 * Run: npm run mock-commerce
 */
import http from "node:http";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.MOCK_COMMERCE_PORT ?? "4010");
const SHIELDPAY_URL = process.env.SHIELDPAY_APP_URL ?? "http://localhost:3000";
const API_KEY = process.env.MOCK_COMMERCE_API_KEY ?? "mock-commerce-key";

const catalogPath = join(dirname(fileURLToPath(import.meta.url)), "../../shared/shop/catalog.json");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));

const products = new Map(catalog.products.map((p) => [p.id, p]));
const productsByHandle = new Map(catalog.products.map((p) => [p.handle, p]));
const orders = new Map();
const customers = new Map();

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function nextOrderId() {
  return `NL-${1000 + orders.size + Math.floor(Math.random() * 80)}`;
}

function trackingFor(orderId) {
  const digits = orderId.replace(/\D/g, "").padStart(8, "0").slice(-8);
  return `1Z999AA10${digits}`;
}

function buildOrderRecord({
  orderId,
  items,
  customer,
  shipping,
  payment,
}) {
  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const trackingNumber = trackingFor(orderId);
  const createdAt = new Date().toISOString();
  const shippedAt = daysAgo(4);
  const deliveredAt = daysAgo(1);

  return {
    orderId,
    customerId: customer.customerId,
    items,
    totalAmount: Number(totalAmount.toFixed(2)),
    currency: "USD",
    createdAt,
    status: "fulfilled",
    shipping: {
      name: shipping.name,
      address1: shipping.address1,
      city: shipping.city,
      region: shipping.region,
      postalCode: shipping.postalCode,
      country: shipping.country ?? "US",
    },
    customer: {
      customerId: customer.customerId,
      email: customer.email,
      name: customer.name,
      totalOrders: customer.totalOrders ?? 1,
      accountCreatedAt: customer.accountCreatedAt ?? daysAgo(120),
    },
    fulfillment: {
      orderId,
      status: "fulfilled",
      trackingNumber,
      carrier: "UPS",
      shippedAt,
      deliveredAt,
    },
    tracking: {
      orderId,
      carrier: "UPS",
      trackingNumber,
      status: "delivered",
      lastUpdate: deliveredAt,
      deliveredAt,
      events: [
        {
          timestamp: shippedAt,
          description: "Picked up by carrier",
          location: "San Francisco, CA",
        },
        {
          timestamp: deliveredAt,
          description: "Delivered — signed by A. RIVERA",
          location: shipping.city ?? "San Francisco, CA",
        },
      ],
    },
    refunds: { orderId, refunds: [], totalRefunded: 0 },
    payment: {
      orderId,
      paymentId: `pay_nl_${orderId}`,
      status: "captured",
      amount: Number(totalAmount.toFixed(2)),
      currency: "USD",
      method: "card",
      avsResult: "match",
      cvvResult: "match",
      gateway: "stripe",
      cardNetwork: payment.cardNetwork ?? "visa",
      last4: payment.last4 ?? "4242",
      capturedAt: createdAt,
    },
  };
}

function seedLegacyOrder(orderId) {
  const product = catalog.products[0];
  const record = buildOrderRecord({
    orderId,
    items: [{ name: product.title, quantity: 1, price: product.price, productId: product.id }],
    customer: {
      customerId: `cust-${orderId}`,
      email: "customer@example.com",
      name: "Alex Rivera",
      totalOrders: 3,
      accountCreatedAt: "2025-11-15T09:00:00.000Z",
    },
    shipping: {
      name: "Alex Rivera",
      address1: "184 Market Street",
      city: "San Francisco",
      region: "CA",
      postalCode: "94103",
    },
    payment: { cardNetwork: "visa", last4: "4242" },
  });
  orders.set(orderId, record);
}

["1042", "1112", "555", "1088"].forEach(seedLegacyOrder);
seedWeakOrder("NL-WEAK");

function applyWeakFulfillment(order) {
  order.fulfillment = {
    orderId: order.orderId,
    status: "unfulfilled",
    trackingNumber: null,
    carrier: null,
    shippedAt: null,
    deliveredAt: null,
  };
  order.tracking = {
    orderId: order.orderId,
    carrier: null,
    trackingNumber: null,
    status: "pending",
    lastUpdate: null,
    deliveredAt: null,
    events: [],
  };
}

function seedWeakOrder(orderId) {
  seedLegacyOrder(orderId);
  applyWeakFulfillment(orders.get(orderId));
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function emitPreAlertForOrder(order, riskReason = "customer_contacted_bank", eventId) {
  const event = {
    type: "mock.pre_dispute_alert",
    eventId: eventId ?? `mock-alert-${randomUUID()}`,
    orderId: order.orderId,
    riskReason,
    amount: Math.round(Number(order.totalAmount) * 100),
    currency: String(order.currency ?? "usd").toLowerCase(),
    source: "mock-alerts-simulator",
  };
  const forward = await forwardMockPreAlert(event);
  const parsed = parseJsonSafe(forward.body);
  return { event, alert: parsed.alert ?? parsed, status: forward.status };
}

async function emitDisputeForOrder(order, reason = "product_not_received", merchantId = "demo-merchant") {
  const amount = Math.round(Number(order.totalAmount) * 100);
  const disputeId = `dp_mock_${randomUUID().slice(0, 12)}`;
  const stripePayload = {
    type: "charge.dispute.created",
    data: {
      object: {
        id: disputeId,
        amount,
        currency: String(order.currency ?? "usd").toLowerCase(),
        reason,
        metadata: {
          order_id: order.orderId,
          merchant_id: merchantId,
        },
        payment_method_details: {
          card: { network: order.payment?.cardNetwork ?? "visa" },
        },
      },
    },
  };
  const forward = await forwardStripeWebhook(stripePayload);
  const parsed = parseJsonSafe(forward.body);
  return {
    disputeId: parsed.disputeId ?? `sim-${disputeId.replace(/^dp_/, "")}`,
    gatewayDisputeId: disputeId,
    status: forward.status,
    body: forward.body,
  };
}

async function forwardMockPreAlert(payload) {
  const res = await fetch(`${SHIELDPAY_URL}/api/core/mock-alerts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-mock-alerts": "true",
    },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.text() };
}

async function forwardStripeWebhook(payload) {
  const res = await fetch(`${SHIELDPAY_URL}/api/core/webhooks/stripe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-mock-commerce": "true",
    },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.text() };
}

function publicOk(pathname, method) {
  if (method === "OPTIONS") return true;
  if (pathname === "/health") return true;
  if (method === "GET" && pathname.startsWith("/products")) return true;
  if (method === "GET" && pathname.startsWith("/collections")) return true;
  if (method === "GET" && pathname === "/store") return true;
  return false;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      return json(res, 204, {});
    }

    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    const auth = req.headers.authorization?.replace("Bearer ", "");
    if (!publicOk(url.pathname, req.method) && auth !== API_KEY) {
      return json(res, 401, { error: "Unauthorized" });
    }

    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, { ok: true, orders: orders.size, products: products.size });
    }

    if (req.method === "GET" && url.pathname === "/store") {
      return json(res, 200, catalog.store);
    }

    if (req.method === "GET" && url.pathname === "/collections") {
      return json(res, 200, { collections: catalog.collections });
    }

    if (req.method === "GET" && url.pathname === "/products") {
      const collection = url.searchParams.get("collection");
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      let list = catalog.products;
      if (collection && collection !== "all") {
        list = list.filter((p) => p.category === collection);
      }
      if (q) {
        list = list.filter(
          (p) =>
            p.title.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.tags.some((t) => t.includes(q))
        );
      }
      const sort = url.searchParams.get("sort");
      if (sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
      if (sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
      if (sort === "rating") list = [...list].sort((a, b) => b.rating - a.rating);
      return json(res, 200, { products: list });
    }

    if (req.method === "GET" && url.pathname.startsWith("/products/")) {
      const key = url.pathname.split("/")[2];
      const product = products.get(key) ?? productsByHandle.get(key);
      if (!product) return json(res, 404, { error: "Product not found" });
      return json(res, 200, { product });
    }

    if (req.method === "GET" && url.pathname === "/orders") {
      const email = url.searchParams.get("email");
      let list = Array.from(orders.values());
      if (email) {
        list = list.filter((o) => o.customer?.email?.toLowerCase() === email.toLowerCase());
      }
      return json(res, 200, { orders: list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) });
    }

    if (req.method === "GET" && url.pathname.startsWith("/customers/")) {
      const customerId = decodeURIComponent(url.pathname.split("/")[2]);
      const match = Array.from(orders.values()).find(
        (o) => o.customerId === customerId || o.customer?.customerId === customerId
      );
      if (!match?.customer) return json(res, 404, { error: "Customer not found" });
      return json(res, 200, match.customer);
    }

    if (req.method === "GET" && url.pathname.startsWith("/orders/")) {
      const orderId = decodeURIComponent(url.pathname.split("/")[2]);
      const order = orders.get(orderId);
      if (!order) return json(res, 404, { error: "Order not found" });
      return json(res, 200, order);
    }

    if (req.method === "POST" && url.pathname === "/checkout") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const lineItems = Array.isArray(body.items) ? body.items : [];
      if (lineItems.length === 0) {
        return json(res, 400, { error: "Cart is empty" });
      }

      const items = lineItems.map((line) => {
        const product = products.get(line.productId);
        if (!product) {
          throw new Error(`Unknown product ${line.productId}`);
        }
        const qty = Math.max(1, Number(line.quantity ?? 1));
        return {
          name: product.title,
          quantity: qty,
          price: product.price,
          productId: product.id,
          variant: line.variant ?? product.variants?.[0]?.name,
        };
      });

      const email = body.email ?? "customer@example.com";
      const name = body.name ?? "Guest Shopper";
      let customer = customers.get(email);
      if (!customer) {
        customer = {
          customerId: `cust-${randomUUID().slice(0, 8)}`,
          email,
          name,
          totalOrders: 0,
          accountCreatedAt: new Date().toISOString(),
        };
      }
      customer.totalOrders += 1;
      customer.name = name;
      customers.set(email, customer);

      const orderId = body.orderId ?? nextOrderId();
      const order = buildOrderRecord({
        orderId,
        items,
        customer,
        shipping: body.shipping ?? {
          name,
          address1: "184 Market Street",
          city: "San Francisco",
          region: "CA",
          postalCode: "94103",
        },
        payment: {
          cardNetwork: body.cardNetwork ?? "visa",
          last4: String(body.cardNumber ?? "4242").slice(-4),
        },
      });
      orders.set(orderId, order);
      const alertResult = await emitPreAlertForOrder(order);
      const disputeResult = await emitDisputeForOrder(
        order,
        "product_not_received",
        body.merchantId ?? "demo-merchant"
      );
      order.shieldpay = {
        alert: alertResult.alert,
        disputeId: disputeResult.disputeId,
      };
      orders.set(orderId, order);
      return json(res, 201, {
        success: true,
        order,
        alert: alertResult.alert,
        disputeId: disputeResult.disputeId,
      });
    }

    if (req.method === "POST" && url.pathname === "/admin/orders") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const orderId = body.orderId ?? nextOrderId();
      if (!orders.has(orderId)) {
        if (body.weakEvidence === true) seedWeakOrder(orderId);
        else seedLegacyOrder(orderId);
      }
      return json(res, 201, { orderId, order: orders.get(orderId) });
    }

    if (req.method === "POST" && url.pathname === "/admin/record-refund") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const orderId = body.orderId;
      const order = orders.get(orderId);
      if (!order) return json(res, 404, { error: "Order not found" });
      const amount = Number(body.amount ?? order.totalAmount);
      const refundId = `re_mock_${randomUUID().slice(0, 10)}`;
      order.refunds = order.refunds ?? { orderId, refunds: [], totalRefunded: 0 };
      order.refunds.refunds.push({
        refundId,
        amount,
        currency: String(body.currency ?? order.currency ?? "usd"),
        status: "completed",
        reason: "simulated_pre_dispute_auto_refund",
        createdAt: new Date().toISOString(),
      });
      order.refunds.totalRefunded = Number(
        (order.refunds.totalRefunded + amount).toFixed(2)
      );
      if (order.payment) order.payment.status = "refunded";
      orders.set(orderId, order);
      return json(res, 200, { success: true, refundId, refunds: order.refunds });
    }

    if (req.method === "POST" && url.pathname === "/admin/simulate-prealert") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const orderId = body.orderId;
      if (!orderId) return json(res, 400, { error: "orderId is required" });
      if (!orders.has(orderId)) {
        if (body.weakEvidence === true) seedWeakOrder(orderId);
        else seedLegacyOrder(orderId);
      }
      const order = orders.get(orderId);
      const result = await emitPreAlertForOrder(
        order,
        body.riskReason ?? "customer_contacted_bank",
        body.eventId
      );
      return json(res, 200, {
        success: result.status < 400,
        event: result.event,
        alert: result.alert,
        shieldpayStatus: result.status,
      });
    }

    if (req.method === "POST" && (url.pathname === "/disputes" || url.pathname === "/admin/simulate-dispute")) {
      const body = JSON.parse((await readBody(req)) || "{}");
      const orderId = body.orderId ?? "1042";
      if (!orders.has(orderId)) seedLegacyOrder(orderId);
      const order = orders.get(orderId);
      const result = await emitDisputeForOrder(
        order,
        body.reason ?? "product_not_received",
        body.merchantId ?? "demo-merchant"
      );
      return json(res, 200, {
        success: result.status < 400,
        disputeId: result.disputeId,
        gatewayDisputeId: result.gatewayDisputeId,
        orderId,
        shieldpayStatus: result.status,
        shieldpayBody: result.body,
      });
    }

    json(res, 404, { error: "Not found" });
  } catch (error) {
    json(res, 500, { error: error instanceof Error ? error.message : "Server error" });
  }
});

server.listen(PORT, () => {
  console.log(`[mock-commerce] listening on http://localhost:${PORT}`);
  console.log(`[mock-commerce] catalog ${products.size} products → ${SHIELDPAY_URL}/api/core/webhooks/stripe`);
});
