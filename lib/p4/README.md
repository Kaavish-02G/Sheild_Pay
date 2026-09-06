# P4 — Response Generation + Merchant Dashboard

## Overview

This module provides the merchant-facing dashboard and the final AI response-writing step that turns verified evidence into submittable dispute-response text.

## P1 Routes Used

| Route | Status | Notes |
|-------|--------|-------|
| `POST /api/core/simulate-dispute` | ✅ Live | Used by "Simulate Incoming Dispute" button |
| `GET /api/core/disputes` | ⚠️ TODO on P1 | Falls back to `shared/mocks/disputes_list.json` |
| `GET /api/core/disputes/:id` | ⚠️ TODO on P1 | Falls back to mock fixture by ID |
| `GET /api/core/merchants/:id/settings` | ⚠️ TODO on P1 | Falls back to default settings with "not persisted" indicator |
| `PATCH /api/core/merchants/:id/settings` | ⚠️ TODO on P1 | Falls back to local state; logs warning |

## P2/P3 Routes (with fallbacks)

| Route | Fallback |
|-------|----------|
| `POST /api/p3/invoke` | `shared/mocks/evidence_package.json` |
| `POST /api/p2/submit` | Toast "Submission service not yet available" + console log |

## P4 Routes

| Route | Method | Body | Response |
|-------|--------|------|----------|
| `/api/p4/generate-response` | POST | `{ disputeId }` | `{ responseText }` |
| `/api/p4/automate` | POST | `{ disputeId }` | `AutomationResult` — full agentic pipeline |
| `/api/p4/pending-reviews` | GET | — | `{ notifications[] }` |
| `/api/p4/pending-reviews` | POST | `{ disputeId }` | Dismiss notification after merchant approval |

## Automation Flow

1. P3 investigates → evidence package
2. P4 generates dispute response
3. If evidence confidence &lt; `minEvidenceScore` → **insufficient** (escalated)
4. If dispute amount &gt; `reviewAmountLimit` → **review_required** (merchant notified)
5. Otherwise → **auto_submitted** via P2 (no merchant action)

Merchants configure `reviewAmountLimit` on the Settings page.

## Environment Variables

- `OLLAMA_BASE_URL` — Ollama API endpoint (default: `http://127.0.0.1:11434/api`)
- `OLLAMA_MODEL` — Model for response generation (default: `qwen2.5:0.5b`)
- `SHOPIFY_DEV_STORE` — Used as default merchant ID for settings

## Running Standalone

The dashboard works without P2/P3 by using mock fixtures. Start the dev server:

```bash
npm run dev
# Dashboard: http://localhost:3000/dashboard
```

Ollama is optional — if unavailable, response generation falls back to a template paragraph.

```bash
ollama pull qwen2.5:0.5b
```
