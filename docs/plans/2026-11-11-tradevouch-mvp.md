# TradeVouch MVP Implementation Plan

**Goal:** Build and deploy TradeVouch, an automated review generation platform for local trades (roofers, plumbers, detailers) featuring an AI Voice-to-Review Assistant, Jobber/Housecall Pro/ServiceTitan webhooks, SMS/email cadence engine, and $29/mo flat pricing, deployed 24/7 on Railway.

**Architecture:** React 19 + Tailwind CSS v4 + Vite 8 single-page app bundled into a self-contained gzipped HTML payload served alongside a Hono (`hono@4`) REST API inside a Bun-powered Railway Function (`index.tsx`), backed by Railway PostgreSQL (`postgres@3`) with automatic schema migration and demo seeding, plus an in-memory `StoreAdapter` for fast deterministic Vitest runs.

**Tech Stack:** TypeScript, React 19, Tailwind CSS v4, Lucide React, Hono 4, Zod 3, postgres 3, Vite 8, Vitest, jsdom, Testing Library, Railway Functions + PostgreSQL.

## Global Constraints
- Pricing positioned at `$29/month` flat with no annual lock-in vs. NiceJob (`$75–$125/month`) and Birdeye (`$250+/month`).
- Homeowner flow (`/r/:token`) eliminates blank-page syndrome via either a 10-second voice note (Web Speech API / audio transcript) or 2 quick guided tap questions, producing a detailed 5-star review highlighting the technician's professionalism with 1-click copy and Google Maps deep link.
- Supports Jobber, Housecall Pro, and ServiceTitan job-completion webhooks plus CSV import and multi-step SMS/email cadences.
- Every core unit (AI Voice-to-Review, CRM webhook normalizers, cadence engine, Hono API endpoints, critical UI flows) is developed test-first (Red -> Green -> Refactor) and verified before deploy.
- Live deployment verified end-to-end on Railway (`*.up.railway.app`) with PostgreSQL persistence.

## Review Focus
1. Filler-word noise & short/empty transcripts: 10-second spoken voice notes often have `"um"`, `"uh"`, `"like"`, `"you know"`, or partial fragments — AI drafter must gracefully compose a natural review using job context (`techName`, `serviceType`, `businessName`) instead of returning broken fragments or crashing on empty strings.
2. Malformed or provider-specific CRM webhook payloads (Jobber GraphQL/REST webhook vs. Housecall Pro vs. ServiceTitan vs. missing phone/email): normalizer must extract customer, technician, and job details safely and return `400` with clear validation errors rather than `500`.
3. Duplicate CRM webhook deliveries or repeated cadence dispatch runs: idempotent handling by `crmExternalId` and message status transitions prevent double-texting homeowners.
4. Non-five-star homeowner ratings (1–3 stars): must capture immediate private resolution feedback for the owner while keeping honest Google review access compliant (no illegal review gating errors or dead-end UI).
5. Unauthenticated vs. authenticated workspace access and invalid tokens (`/r/unknown-token`, wrong webhook key): must return clean `401`/`404` JSON responses and user-friendly recovery states in the UI.

---

### Task 1: Project Scaffold & Tooling Setup
**Files:**
- Create: `package.json`, `index.html`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `src/index.css`
- Verify: `node node_modules/vitest/vitest.mjs run` executes cleanly (0 tests / exits cleanly or runs sample check).

### Task 2: Shared Types & AI Voice-to-Review Engine (TDD)
**Files:**
- Create: `shared/types.ts`, `shared/reviewAi.ts`
- Test: `tests/reviewAi.test.ts`
- Produces: `draftTradeReview(input)`, `draftOwnerReply(input)`, `SAMPLE_VOICE_CLIPS`, `TRADE_PRESETS`

### Task 3: CRM Webhook Normalizers, CSV Importer & Cadence Engine (TDD)
**Files:**
- Create: `shared/crm.ts`, `shared/cadence.ts`
- Test: `tests/crm.test.ts`, `tests/cadence.test.ts`
- Produces: `normalizeCrmWebhook(provider, payload)`, `parseJobsCsv(csv)`, `renderCadenceTemplate(template, vars)`, `buildCadenceSchedule(business, request, baseTime)`

### Task 4: Backend Store Adapter, Seed Data & Hono API (TDD)
**Files:**
- Create: `server/store.ts`, `server/memoryStore.ts`, `server/postgresStore.ts`, `server/seed.ts`, `server/aiClient.ts`, `server/app.ts`
- Test: `tests/api.test.ts`
- Produces: `createApp(store, options?)` serving `/api/health`, `/api/demo`, `/api/auth/*`, `/api/studio/*`, `/api/requests/*`, `/api/r/:token`, `/api/public/:slug`, `/api/webhooks/crm/:provider`, `/api/ai/draft-review`, `/api/ai/owner-reply`

### Task 5: Frontend SPA & Interactive Flows (TDD)
**Files:**
- Create: `src/lib/api.ts`, `src/components/Navbar.tsx`, `src/components/LiveDemoWidget.tsx`, `src/components/PricingCompare.tsx`, `src/components/AuthModal.tsx`, `src/pages/LandingPage.tsx`, `src/pages/CollectorPage.tsx`, `src/pages/StudioPage.tsx`, `src/pages/PublicHubPage.tsx`, `src/App.tsx`, `src/main.tsx`
- Test: `tests/ui.test.tsx`

### Task 6: Local Dev Server, Single-File Railway Function Bundler & Full Verification
**Files:**
- Create: `server/dev.ts`, `scripts/build-railway.mjs`
- Verify: `vitest run` (all unit, API, and UI tests passing), `vite build`, `node scripts/build-railway.mjs` produces `dist/railway-function.tsx` and validates bundle size.

### Task 7: Railway Deployment & Live Verification
- Provision Railway project `tradevouch`, deploy verified `postgres` template, deploy `tradevouch` Railway Function via `create-function`, link `DATABASE_URL=${{Postgres.DATABASE_URL}}`, generate public `*.up.railway.app` domain.
- Verify live `https://<domain>/`, `GET /api/health`, `POST /api/webhooks/crm/jobber`, `POST /api/ai/draft-review`, and PostgreSQL persistence across requests.
