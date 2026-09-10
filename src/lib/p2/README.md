# P2 — Evidence & Gateways

Evidence tool functions and payment-gateway adapters for dispute submission.

## Evidence tools

Each tool accepts an `orderId`, fetches data from P1 over HTTP (with mock fallback), validates against Zod schemas in `shared/schemas.ts`, and is exposed as:

`POST /api/p2/tools/{name}` with body `{ "orderId": "..." }`

| Tool | Route name |
|------|------------|
| `getOrderDetails` | `/api/p2/tools/getOrderDetails` |
| `getCustomerHistory` | `/api/p2/tools/getCustomerHistory` |
| `getFulfillmentDetails` | `/api/p2/tools/getFulfillmentDetails` |
| `getTrackingStatus` | `/api/p2/tools/getTrackingStatus` |
| `getRefundHistory` | `/api/p2/tools/getRefundHistory` |
| `getPaymentDetails` | `/api/p2/tools/getPaymentDetails` |

## P1 routes assumed (not yet confirmed live)

These routes are called by P2. When unavailable, P2 logs a warning and returns fixtures from `shared/mocks/p2-fixtures.ts`.

| Method | Route | Used by |
|--------|-------|---------|
| GET | `/api/core/orders/:id` | `getOrderDetails` |
| GET | `/api/core/customers/:id/history` | `getCustomerHistory` |
| GET | `/api/core/orders/:id/fulfillment` | `getFulfillmentDetails` |
| GET | `/api/core/orders/:id/tracking` | `getTrackingStatus` |
| GET | `/api/core/orders/:id/refunds` | `getRefundHistory` |
| GET | `/api/core/orders/:id/payment` | `getPaymentDetails` |

## Gateway submission

`POST /api/p2/submit` — frozen contract for P4:

```json
{
  "disputeId": "dp_xxx",
  "gatewayType": "stripe",
  "package": { "...VerifiedEvidencePackage..." }
}
```

`gatewayType` is optional; defaults to `DEFAULT_GATEWAY_TYPE` env var (`stripe` if unset).

## Env vars

See `.env.example` (Stripe, PayPal, Razorpay keys + `DEFAULT_GATEWAY_TYPE`).

## Local test

```bash
npm run dev
npm run test:p2
```

Example tool call:

```bash
curl -X POST http://localhost:3000/api/p2/tools/getOrderDetails \
  -H "Content-Type: application/json" \
  -d '{"orderId":"1042"}'
```
