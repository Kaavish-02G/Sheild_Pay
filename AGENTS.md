# ShieldPay — Agent Playbook

> **Read this first.** Token-efficient spec for implementing/testing any module (P1–P4).

## Rules (all modules)

1. **Own only your paths** — never edit another module's folders.
2. **Contracts** — append types to `shared/schemas.ts` under your `// --- PX: ... ---` section only.
3. **Cross-module** — HTTP only via frozen routes below; never `import` from `lib/p2|p3|p4` or `app/dashboard`.
4. **Standalone** — wrap external `fetch()` in try/catch; log payload on failure (don't crash).
5. **Verify** — `npm run build` + `npm run test:px` before done.

## Ownership

| Module | Paths | Owns |
|--------|-------|------|
| **P1** | `lib/core/`, `lib/adapters/shopify/`, `app/api/core/` | PlatformAdapter, MongoDB, orchestrator, Shopify |
| **P2** | `lib/p2/`, `app/api/p2/` | Evidence tools, GatewayAdapter |
| **P3** | `lib/p3/`, `app/api/p3/` | AI agent loop, scoring, audit ledger |
| **P4** | `lib/p4/`, `app/api/p4/`, `app/dashboard/` | Response writer, dashboard UI |

## Frozen HTTP contracts

| Route | Method | Body | Caller → Callee |
|-------|--------|------|-----------------|
| `/api/core/auth` | GET | `?shop=` | Browser → P1 OAuth start |
| `/api/core/auth/callback` | GET | OAuth callback + HMAC | Shopify → P1 |
| `/api/core/auth/session` | POST | `{sessionToken}` or Bearer | CLI/embedded → P1 |
| `/api/core/auth/status` | GET | `?shop=` | Check merchant connected |
| `/api/core/simulate-dispute` | POST | `{orderId,reason,amount}` | P4 → P1 |
| `/api/core/webhooks` | POST | Shopify body + HMAC | Shopify → P1 |
| `/api/core/deadline-check` | GET | — | Cron → P1 |
| `/api/p3/invoke` | POST | `{disputeId}` | P1 → P3 |
| `/api/p2/*` | — | (P3 calls via HTTP) | P3 → P2 |
| `/api/p4/*` | — | (dashboard data) | Dashboard → P4 |

## Env vars (`.env.example`)

```
MONGODB_URI, SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SHOPIFY_WEBHOOK_SECRET, SHOPIFY_DEV_STORE
OLLAMA_BASE_URL          # P3
```

## Quick start

```bash
cp .env.example .env    # fill values
npm install && npm run dev
node scripts/test.mjs p1   # or: npm run test:p1
```

Shopify OAuth: `cd lib/adapters/shopify && npx shopify app dev`

---

## P1 — Core + Shopify ✅

**Paths:** `lib/core/`, `lib/adapters/shopify/`, `app/api/core/`, `shared/schemas.ts` (P1 section)

**Done when:**
- [ ] `PlatformAdapter` + Zod schemas in `shared/schemas.ts`
- [ ] `lib/core/db.ts`, `models.ts`, `orchestrator.ts`, `deadline-monitor.ts`
- [ ] `ShopifyAdapter` — OAuth, GraphQL order/customer/fulfillment, HMAC webhooks
- [ ] Routes: `webhooks`, `simulate-dispute`, `deadline-check`, `auth/callback`
- [ ] `vercel.json` cron → `/api/core/deadline-check`

**Test:** `npm run test:p1` (needs `npm run dev` + MongoDB running)

---

## P2 — Evidence & Gateways

**Paths:** `lib/p2/`, `app/api/p2/`, `shared/schemas.ts` (P2 section)

**Implement:**
1. Append `GatewayAdapter` interface + Zod types under `// --- P2: Evidence & Gateways ---`
2. Evidence tool functions (order, tracking, payment lookup)
3. Gateway adapters: Stripe, PayPal, Razorpay
4. `app/api/p2/*` routes P3 calls via HTTP
5. Add tests in `scripts/test-p2.mjs` following P1 pattern

**Must not:** import P1/P3/P4 code directly.

**Test:** `npm run test:p2`

---

## P3 — AI Agent

**Paths:** `lib/p3/`, `app/api/p3/`, `shared/schemas.ts` (P3 section)

**Implement:**
1. `POST /api/p3/invoke` — accept `{disputeId}`, load dispute from MongoDB
2. Tool-calling loop (Ollama) → HTTP calls to P2 evidence tools
3. Evidence scoring, stop conditions, write `ai_runs` + update dispute status
4. Add tests in `scripts/test-p3.mjs`

**Must not:** import P2 functions — `fetch('/api/p2/...')` only.

**Test:** `npm run test:p3`

---

## P4 — Response + Dashboard

**Paths:** `lib/p4/`, `app/api/p4/`, `app/dashboard/`, `shared/schemas.ts` (P4 section)

**Implement:**
1. Response generator (Ollama), merchant approve/reject flow
2. Dashboard: dispute list, evidence detail, settings, audit trail
3. "Simulate Incoming Dispute" → `POST /api/core/simulate-dispute` (frozen URL)
4. Add tests in `scripts/test-p4.mjs`

**Test:** `npm run test:p4`

---

## Test harness

```bash
npm run dev          # required for API tests
npm run test:p1      # unit + API — expect P1: N/N
```

Output: `OK name` lines then `unit: 7/7`, `api: 14/14`, `P1: 21/21`. Prereqs: MongoDB + `npm run dev`.

## schemas.ts pattern

```ts
// --- PX: Module Name ---
// (owned by PX — do not modify other sections)
export const MySchema = z.object({ ... });
export type MyType = z.infer<typeof MySchema>;
```
