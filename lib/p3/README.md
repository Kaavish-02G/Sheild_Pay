# P3 — AI Agent Loop

## Stack

Next.js/TypeScript, Ollama (`llama3.1:8b`) via Vercel AI SDK (`ai` + `ai-sdk-ollama` v4 — required for AI SDK v7; `ollama-ai-provider` v1 is incompatible), Zod.

## Integrated endpoints

| Module | Route | Status |
|--------|-------|--------|
| P1 | `GET /api/core/disputes/:id` | ⚠️ Not implemented on P1 yet — falls back to minimal dispute context |
| P1 | `PATCH /api/core/disputes/:id` | ⚠️ Not implemented on P1 yet — status buffered in invoke response only |
| P1 | `POST /api/p3/invoke` `{ disputeId }` | ✅ Implemented (this module) |
| P2 | `POST /api/p2/tools/getOrderDetails` `{ orderId }` | ✅ Live |
| P2 | `POST /api/p2/tools/getCustomerHistory` `{ orderId }` | ✅ Live |
| P2 | `POST /api/p2/tools/getFulfillmentDetails` `{ orderId }` | ✅ Live |
| P2 | `POST /api/p2/tools/getTrackingStatus` `{ orderId }` | ✅ Live |
| P2 | `POST /api/p2/tools/getRefundHistory` `{ orderId }` | ✅ Live |
| P2 | `POST /api/p2/tools/getPaymentDetails` `{ orderId }` | ✅ Live |

P2 routes use the dynamic handler `app/api/p2/tools/[name]/route.ts` with camelCase tool names and `{ orderId }` body (not kebab-case paths).

## Output contract

`VerifiedEvidencePackage` is defined as `AgentVerifiedEvidencePackageSchema` in `shared/schemas.ts` (P3 section) and re-exported from `lib/p3/schemas.ts` under the frozen names. P4's legacy `VerifiedEvidencePackageSchema` in the P4 section uses a different shape — P4 should migrate to the P3 contract when ready.

## Env vars

```
OLLAMA_BASE_URL=http://127.0.0.1:11434/api
OLLAMA_MODEL=llama3.1:8b
MAX_ITERATIONS=6
P3_STEP_TIMEOUT_MS=30000
SHIELDPAY_APP_URL=http://localhost:3000
```

## Local validation

```bash
npm run dev
node scripts/validate-p3-schema.mjs
npm run test:p3
```
