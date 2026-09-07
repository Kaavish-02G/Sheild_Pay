# ShieldPay Demo Script

End-to-end demo: mock commerce order → Stripe webhook ingest → deterministic evidence → rebuttal loop → dashboard → PG submit.

## Prerequisites

- MongoDB running (`MONGODB_URI` in `.env`)
- ShieldPay: `npm run dev` (port 3000)
- Mock commerce: `npm run mock-commerce` (port 4010)

Recommended `.env` flags for the demo:

```env
MOCK_COMMERCE_MODE=true
PG_MOCK_MODE=true
P3_REBUTTAL_FAST_MODE=true
P3_LIVE_FAST_MODE=true
P4_LIVE_FAST_MODE=true
SHOPIFY_MOCK_MODE=true
```

## 1. Start services

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run mock-commerce
```

## 2. Shop, then dispute (primary demo)

1. Open **http://localhost:3000/shop** (or 3001).
2. Add an item to cart and check out (pick Visa / Mastercard / Amex / RuPay).
3. On the order page, choose a dispute reason and click **Draft and submit dispute**.
4. Follow the link to the ShieldPay merchant dashboard.

## 3. Optional: admin simulate (no storefront)

Orders `1042`, `1112`, `555`, and `1088` are pre-seeded. To create a new one:

```bash
curl -X POST http://localhost:4010/admin/orders \
  -H "Authorization: Bearer mock-commerce-key" \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"1042\"}"
```

## 3. Trigger dispute (Stripe-shaped webhook)

```bash
curl -X POST http://localhost:4010/admin/simulate-dispute \
  -H "Authorization: Bearer mock-commerce-key" \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"1042\",\"reason\":\"product_not_received\",\"merchantId\":\"demo-merchant\"}"
```

Mock commerce forwards to `POST /api/core/webhooks/stripe`. ShieldPay:

1. Normalizes reason → `ITEM_NOT_RECEIVED`
2. Identifies network → `visa`
3. Runs rule-engine evidence collection
4. Validates checklist (tracking, delivery, payment, etc.)
5. Runs draft → critique → revise rebuttal loop
6. Applies P4 automation thresholds (auto-submit or merchant review)

## 4. Watch the dashboard

Open the dispute in the ShieldPay dashboard. The preview shows:

- Canonical reason and card network
- Visa/Mastercard rule checklist (pass/fail)
- AI strategy focus
- Critique iterations
- Generated rebuttal and PG submission status

Use **Send Request to PG** when automation requires merchant intervention (red tag on dispute card).

## 5. Run automated E2E check

With ShieldPay and mock commerce running:

```bash
npm run test:architecture
```

This script triggers a mock-commerce dispute, polls until evidence + rebuttal are ready, and verifies the pipeline output.

## Fallback: simulate-dispute (Shopify path)

For backward compatibility without mock commerce:

```bash
curl -X POST http://localhost:3000/api/core/simulate-dispute \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"1042\",\"reason\":\"product not received\"}"
```
