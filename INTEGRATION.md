# Integration notes

## What was retained

Original source: psychrage07/Sheild_Pay, commit aa8704fd373195490b3c4b849ec47905d06db0bf.

The modules in `src/lib/core`, `src/lib/adapters`, `src/lib/p2`, `src/lib/p3`, `src/lib/p4`, frozen Zod contracts in `src/shared/schemas.ts`, and core/P2/P3/P4 HTTP route families originate from that repository. Original case detail components, approval controls, rulebook browser, audit timelines, automation panels, alert processing and settings remain. `upstream/` preserves the original integration test and standalone mock-commerce assets for reference.

## What changed

- Next.js 14/React 18 → patched Next.js 16/React 19 and async route parameters.
- New merchant overview, order table, integration configuration screen and guide.
- Merrell-inspired store at `/shop`, with a dedicated layout so store CSS/navigation never wraps merchant tools.
- Store checkout uses PostgreSQL; the external port-4010 service is no longer required for local shopping.
- `src/db/schema.ts` contains typed store tables and `core_documents`.
- `src/lib/core/db.ts` preserves the model layer's document collection method signatures while implementing all storage through Drizzle/PostgreSQL. BSON ObjectId and Date encodings preserve existing contract IDs. No MongoClient is opened.
- Compatibility operations are intentionally limited to those used by this app, not a general MongoDB replacement. Collection writes use PostgreSQL advisory transactions and deterministic keys for merchants, disputes, evidence and cached orders. Collection scans are appropriate for this demo; normalized indexed tables and server-side pagination should replace them at production scale.
- Shop cases use deterministic IDs `sim-NL-...`; repeat issue submissions update the same case. Local order records are the evidence source. Supplementary payment/customer/refund evidence is collected alongside the network-required checklist.
- Missing local delivery proof stays missing. Failed P2 requests and unavailable live evidence no longer fall back to unrelated fixtures. Some upstream live payment/refund evidence implementations were mock-only; these now report unavailable until a real source is implemented rather than pretending to verify them.
- Stripe/Razorpay raw-body verification, PayPal remote verification, strict Shopify domain checking, OAuth state checking, provider-ID preservation, no webhook token overwrites, duplicate-case handling, persisted submission receipts, and correct handling of unsuccessful gateway responses were added.
- Demo pre-alert refunds and local case submissions ALWAYS use the mock gateway. A configured real gateway cannot accidentally charge/refund/submit a local demo order.
- An optional single-merchant HTTP Basic gate protects merchant pages/APIs. This is not a replacement for a production multi-tenant identity and authorization system.

## Legacy data migration

No old repository database was accessible in the sandbox; only code was imported. The preview has new demo data, not your existing merchant records. Back up your old database before doing anything.

1. Export each relevant MongoDB collection to Extended JSON using your normal database tools: merchants, disputes, evidence, orders, ai_runs, submission_status, mock_alerts, audit_ledger. Keep BSON dates and IDs. The exporter should produce either a JSON array or one Extended JSON object per line.
2. Put files named `merchants.json`, `disputes.json`, etc. in a PRIVATE directory outside the repo.
3. Set DATABASE_URL to the destination PostgreSQL database; run `npx drizzle-kit push`.
4. Run `npx tsx scripts/import-legacy-json.ts /absolute/path/to/private/export`.
5. Review the imported records and settings in a secured staging deployment, then exercise provider test webhooks. Keep your MongoDB backup until verified.

The import script uses the same Drizzle-backed repository. It preserves ObjectId and Date values and skips an existing logical identity rather than overwriting it. No secrets or exported customer data should be committed or added to the ZIP. The local shop schema is separate from cached core orders; old mock-commerce purchases do not automatically become browser-owned local store orders.

## Webhook configuration

| Provider | Route | Verification |
| --- | --- | --- |
| Shopify | `/api/core/webhooks` | `x-shopify-hmac-sha256`, original adapter |
| Stripe | `/api/core/webhooks/stripe` | SDK constructEvent on raw text + STRIPE_WEBHOOK_SECRET |
| PayPal | `/api/core/webhooks/paypal` | `/v1/notifications/verify-webhook-signature` with PAYPAL_WEBHOOK_ID |
| Razorpay | `/api/core/webhooks/razorpay` | raw body HMAC SHA-256 + RAZORPAY_WEBHOOK_SECRET |

A caller-controlled `x-mock-commerce` header never bypasses verification. To demo an incoming case use the merchant simulation button, not an unsigned live webhook.

Set SHIELDPAY_WEBHOOK_MERCHANT to the connected merchant ID or Shopify domain. Stripe disputes need metadata.order_id (or metadata.orderId). PayPal's original parser expects resource.custom for a store-order mapping; adapt this to your transaction-to-order lookup if your provider payload does not include it. Razorpay uses payload.dispute.entity.order_id. Missing mappings are rejected (422), not substituted with order 1042. Provider retries retain their original dispute ID; merchant data is never created from an unauthenticated payload.

Provider IDs and amounts are preserved (Stripe/Razorpay minor units → major units). Live result/event handling remains scoped to the original dispute lifecycle; this demo does not add settlement reconciliation or declare cases won/lost.

## Deployment notes

- All secrets are server-side. Never put gateway secrets into NEXT_PUBLIC variables.
- Set your public HTTPS URLs and provider callback URLs. Shopify requires matching Partner app configuration.
- Use a long-running Node service for preview-style `after()` jobs, or integrate a durable queue/outbox and a worker before relying on serverless execution. Replayed investigating events can restart interrupted work; this is not guaranteed exactly-once external submission.
- The Vercel deadline schedule is preserved. Set CRON_SECRET and configure merchant/internal authentication for scheduled calls.
- Live Shopify/payment credentials and an Ollama endpoint were unavailable in the sandbox. Signature rejection and local workflow are testable; live delivery/settlement/OAuth success are not claimed as tested.
- The preserved Shopify adapter has mutable context and assumes one merchant per deployment. Do not deploy it as multi-tenant without refactoring to request-scoped adapters and tenant authorization.
- Sample data is explicitly labeled. Submitted sample cases do not claim actual recovered funds.
- Run `npm audit` after installation. The starter's critical Next.js issue was patched during integration; remaining upstream/transitive advisories require review before production.

## GitHub replacement checklist

Use a new branch. This app uses `src/app` instead of the old root `app`. Remove the old root app/lib/shared directories and old JS build configurations before copying these files to avoid duplicate routing/configuration. Keep upstream backups outside the runtime project. Install from the included lockfile, migrate data deliberately, then run typegen, TypeScript, build, and smoke tests. Push only after your own staging verification.
