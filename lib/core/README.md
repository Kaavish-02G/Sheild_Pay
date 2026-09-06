# P1 — Core Engine

See **`AGENTS.md`**. Tests: `npm run test:p1` → `P1: 21/21`.

## Setup

```bash
cp .env.example .env
# Set: MONGODB_URI, SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SHOPIFY_WEBHOOK_SECRET, SHOPIFY_DEV_STORE
npm install && npm run dev
```

## OAuth (end-to-end)

### Option A — Shopify CLI (recommended)

```bash
# Edit shopify.app.toml: client_id + dev_store_url
npx shopify app dev
```

CLI opens install flow → token saved to `merchants` collection.

### Option B — Manual OAuth

1. Open `http://localhost:3000/api/core/auth?shop=YOUR_STORE.myshopify.com`
2. Approve in Shopify → redirects to `/api/core/auth/callback`
3. Verify: `GET /api/core/auth/status?shop=YOUR_STORE.myshopify.com` → `{ connected: true }`

### Session token (embedded / CLI)

```bash
POST /api/core/auth/session
Authorization: Bearer <session_token>
```

Calls `ShopifyAdapter.authenticate()` → stores offline token in MongoDB.

## Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/core/auth` | GET | Start OAuth install |
| `/api/core/auth/callback` | GET | OAuth callback (HMAC verified) |
| `/api/core/auth/session` | POST | Session token exchange |
| `/api/core/auth/status` | GET | Merchant connection check |
| `/api/core/webhooks` | POST | Shopify webhooks |
| `/api/core/simulate-dispute` | POST | Demo dispute trigger |
| `/api/core/deadline-check` | GET | Deadline monitor |

## Simulate dispute (after OAuth)

```bash
curl -X POST http://localhost:3000/api/core/simulate-dispute \
  -H "Content-Type: application/json" \
  -d '{"orderId":"REAL_ORDER_ID","reason":"fraudulent","amount":49.99}'
```

Fetches live order via Admin API → creates dispute → fires `POST /api/p3/invoke`.
