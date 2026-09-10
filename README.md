# ShieldPay × Northline / Merrell-inspired store

A runnable integration of psychrage07/Sheild_Pay (source commit aa8704fd373195490b3c4b849ec47905d06db0bf) and the supplied storefront requirements. Next.js 16 App Router, React 19, PostgreSQL, Drizzle, and the original P1–P4 dispute engine.

## Quick start

1. Use Node.js 22+ and PostgreSQL 14+.
2. Copy `.env.example` to `.env`, and set `DATABASE_URL`.
3. Run `npm install`.
4. Run `npx drizzle-kit push` (for a non-default database use the environment-aware `drizzle.config.ts`).
5. Run `npm run dev`, then open http://localhost:3000.
6. Open `/dashboard` for the merchant desk or `/shop` for the storefront.

The first `/api/workspace` request creates eight labeled demonstration orders/cases, only in demo mode. No MongoDB or external mock-commerce server is required. Existing MongoDB data is NOT automatically moved; see INTEGRATION.md.

## Try the full flow

1. `/shop`: choose a product, size and color; add to bag.
2. `/shop/cart`: change quantities, then checkout.
3. Enter fictional shipping details and choose **Use demo card**. Only the four allowlisted test card numbers work. PAN/CVC are never stored.
4. On the order confirmation, click **Report an Issue → Open Demo Dispute**.
5. Click **View Merchant Case**. The original investigation pipeline calls P2 evidence tools, which read the real local order, payment, fulfillment and refund state from PostgreSQL.
6. Inspect evidence, the network rulebook, audit trail, and generated response. Local orders have no delivery evidence; the engine must not invent it.
7. Use the case approval controls to submit through the mock gateway. Repeated customer dispute requests resolve to the same case.
8. `/dashboard/operations?view=alerts` retains the original simulated pre-dispute alert tools; `/dashboard/settings` retains the merchant thresholds.

Newly created cases use the original evidence engine. Seed case scores/outcomes are explicitly illustrative. All local payments, refunds, and gateway submissions are simulated. A `submitted` case means evidence submitted, not a won dispute or recovered money.

## Routes

- `/dashboard`: new overview and dispute queue.
- `/dashboard/disputes`: search/filter/export cases.
- `/dashboard/disputes/[id]`: original evidence/approval/automation detail.
- `/dashboard/orders`: local order management.
- `/dashboard/operations`: original cases, simulation, alerts tools.
- `/dashboard/rules`: original Visa/Mastercard/Amex/RuPay rulebook browser.
- `/dashboard/settings`: original merchant settings.
- `/dashboard/integrations`: configuration status, webhook URLs, Shopify connect.
- `/dashboard/guide`: walkthrough and source download.
- `/shop`: storefront, catalog, details, cart, checkout, orders/account, contact, newsletter.
- Original `/api/core/*`, `/api/p2/*`, `/api/p3/*`, `/api/p4/*` URLs remain.

## Validation

`npx next typegen`

`npm exec tsc -- --noEmit --pretty false`

`npm run build`

With the server running:

`npx playwright install --with-deps chromium`

`node scripts/smoke.mjs`

Smoke tests create fictional orders and save screenshots to `artifacts/`. Original test scripts are preserved in `upstream/scripts` as reference; they require adaptation from the upstream MongoDB/server assumptions and are not the integration acceptance suite.

## Security / production scope

This is a single-merchant demo, not a production multi-tenant SaaS. Configure `SHIELDPAY_ADMIN_PASSWORD` (username `admin`) and HTTPS before exposing non-demo merchant data. Set `SHIELDPAY_DEMO_MODE=false` for live mode; it fails closed without the password. Customer order lookup is separately protected by a random HttpOnly browser-session cookie and email filter.

Live gateway submissions require authenticated live mode. Demo cases always use the mock gateway even with real credentials. Shopify, Stripe, PayPal and Razorpay webhooks require valid provider signatures; the old `x-mock-commerce` bypass is removed. Merchant gateway webhooks require an already-connected merchant mapping and a real order ID in the provider event. Missing evidence is not replaced with unrelated fixtures in live mode.

For production, add your identity provider, per-merchant authorization, rate limiting, encryption/key management for OAuth tokens, durable job workers, monitoring, and documented retention policies. `next/server after()` runs investigations reliably within the lifetime of a long-running Node deployment but is not a durable queue across crashes or serverless time limits. Do not claim bank-network certification from the demo rulebooks. Live provider tests require your credentials and have not been performed in this sandbox.

## Source download / GitHub

Run `python3 scripts/package-source.py` to create `public/downloads/shieldpay-source.zip`. The ZIP excludes `.env`, dependencies, build output, artifacts and database data. Download it from the dashboard sidebar. Extract into a **new branch** of your GitHub checkout. Remove the old root `app/`, `lib/`, `shared/`, `next.config.js`, `postcss.config.js`, and Tailwind 3 config when replacing them with this `src/` layout; do not leave two App Routers. Back up your original repository and database first.

The source is prepared for download, not pushed to your GitHub account. See INTEGRATION.md for the retained architecture and migration notes.

## Assets

Mountain photography: Mario Vogt and Luka Peric / Pexels. Product footwear images are AI-generated demo illustrations, not official Merrell product photography. Merrell marks/design are used here as an independent demo reference; no affiliation is claimed. DM Sans and Barlow Condensed: Google Fonts (OFL). Review asset and trademark permissions before a commercial deployment.
