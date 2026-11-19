# TradeVouch

> Post-job SMS/voice review collection and customer testimonial hub built for residential trade businesses (roofers, plumbers, HVAC, and auto detailers).

> [!WARNING]
> **Project Status — Work in Progress (Not Fully Ready)**
> This project is currently under active development and is **not fully ready for production**. Some parts, features, or workflow steps will fail or behave unexpectedly. We are actively working on fixing all remaining issues.

## Overview

TradeVouch turns quick 10-second homeowner voice notes or 2-tap check-ins after a completed service job into verified, structured 5-star reviews ready for one-click posting to Google Maps and public showcase hubs:

- **Contractor Studio (`/studio`):** Dispatch post-job SMS collection links, manage technician attributions, and monitor review conversion across jobs.
- **Homeowner Voice/Tap Collector (`/r/:slug`):** Mobile-friendly review capture flow that converts short voice notes or quick taps into clean review drafts.
- **Public Verification Hub (`/hub/:slug`):** Displays collected customer testimonials, job details, and trade verification badges.

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Vite, Lucide Icons
- **API:** Hono serverless functions (`api/index.ts`)
- **Storage:** PostgreSQL (`postgres`) / `@vercel/blob` with local/sandbox fallbacks
- **Testing:** Vitest + Testing Library (`vitest run`)

## Local Development

```bash
npm install
npm run typecheck
npm test
npm run build
npm run dev
```
