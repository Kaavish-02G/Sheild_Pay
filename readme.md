# ShieldPay

AI agent that autonomously investigates and fights merchant chargebacks/disputes — gathers evidence, scores confidence, generates a response, and submits it (or flags for merchant review). Platform-agnostic core engine, shipping with a real Shopify integration.

## Problem

Chargeback disputes require merchants to manually dig through order history, tracking data, and payment records to build a case — slow, inconsistent, and easy to lose money on simply from lack of time.

## Solution

ShieldPay's AI agent loops through evidence sources autonomously (like a human investigator would), scores how strong the case is, writes a professional dispute response using only verified evidence, and either auto-submits or routes to the merchant for approval — with a full audit trail showing exactly what it did and why.

## Architecture

```
                 CORE DISPUTE ENGINE (platform-agnostic)
                            │
              ┌─────────────┴─────────────┐
        PlatformAdapter               GatewayAdapter
         (interface)                   (interface)
              │                             │
        ShopifyAdapter              Stripe / PayPal / Razorpay
      (real OAuth + Admin API)              Adapters
              │
    ┌─────────┴─────────────────────────────────┐
    │                                             │
Webhook / Simulated Dispute → Orchestrator → AI Agent Loop (Ollama)
                                                    │
                                       Tool Selection → Evidence Tools
                                                    │
                                       Evidence Scoring → Confidence %
                                                    │
                                       Verified Evidence Package
                                                    │
                                  Response Generator (Ollama) → Dashboard
                                                    │
                                    Merchant Approve/Auto-Submit → Gateway
```

The engine never talks to Shopify directly — everything goes through the `PlatformAdapter` interface, so adding WooCommerce, Amazon, or a custom REST backend later is a new adapter, not a rewrite.

## Tech Stack

- **Framework:** Next.js 14+ (App Router), TypeScript, single codebase for API + dashboard
- **Database:** MongoDB (`mongodb` driver)
- **AI:** Ollama (`Qwen2.5:3b`) via Vercel AI SDK — tool-calling agent loop + response generation
- **Validation:** Zod (shared schemas/contracts)
- **Platform integration:** Shopify CLI (`@shopify/cli`, `@shopify/app`), real OAuth via local dev tunnel against a Shopify Partner dev store
- **Payments:** `stripe`, `razorpay` SDKs; PayPal via REST
- **UI:** React, Tailwind CSS
- **Retry/reliability:** `p-retry`

## Project Structure

```
shieldpay/
├── app/
│   ├── api/
│   │   ├── core/         # Core engine + Shopify adapter endpoints
│   │   ├── p2/           # Evidence tools + gateway endpoints
│   │   ├── p3/           # AI agent invoke endpoint
│   │   └── p4/           # Response gen + dashboard data endpoints
│   └── dashboard/         # Merchant-facing UI
├── lib/
│   ├── core/              # PlatformAdapter interface, Dispute/Merchant models, orchestrator
│   ├── adapters/shopify/  # Shopify OAuth + Admin API implementation
│   ├── p2/                # Evidence tools, GatewayAdapter implementations
│   ├── p3/                # Agent loop, evidence scoring, audit ledger
│   └── p4/                # Response writer
├── shared/
│   ├── schemas.ts         # Frozen Zod contracts between modules
│   └── mocks/             # Fixture data for isolated development
└── .env
```

## Core Features

- Real Shopify OAuth install (local dev via Shopify CLI, no public deployment needed)
- Autonomous AI agent loop with configurable `MAX_ITERATIONS`, `MAX_TOOL_CALLS`, `EVIDENCE_THRESHOLD`
- Evidence confidence scoring: 85–100 auto-submit · 70–84 good · 40–69 weak/review · <40 insufficient
- Full audit trail/ledger — every tool call, reasoning, and decision logged and viewable
- Merchant dashboard: dispute list, evidence detail, approve/reject flow, threshold settings
- Simulated dispute trigger (dashboard button) for demoing without waiting on real chargebacks
- Pluggable gateway layer (Stripe, PayPal, Razorpay) via `GatewayAdapter`

## Getting Started

```bash
npm install -g @shopify/cli @shopify/app
git clone <repo-url>
cd shieldpay
npm install
ollama pull llama3.1:8b
ollama serve
cp .env.example .env   # fill in MongoDB URI, OLLAMA_BASE_URL, Shopify Partner app credentials
shopify app dev        # starts local server + Shopify OAuth tunnel
```

Dashboard: `http://localhost:3000/dashboard`

## Team / Module Ownership

| Module | Owns |
|---|---|
| **Core Engine + Shopify Adapter** | `PlatformAdapter` interface, DB models, orchestrator, real Shopify OAuth/webhooks |
| **Evidence & Gateways** | Evidence tool functions, `GatewayAdapter` (Stripe/PayPal/Razorpay), submission logic |
| **AI Agent Loop** | Ollama-powered tool-calling loop, evidence scoring, stop conditions, audit ledger |
| **Response Gen + Dashboard** | Response writer, merchant-facing dashboard, settings, audit trail UI |

Cross-module contracts are frozen in `shared/schemas.ts`; modules never import across each other's folders directly — only through these contracts.

## Roadmap

- WooCommerce adapter
- Standalone REST API for custom merchant backends
- Real chargeback data integration (beyond sandbox simulation)
- Multi-tenant billing
