# NOETFIELD OS — Global Economic Bridge

This repository is the independent source for the new **NOETFIELD OS** public application and the Business-to-Onchain Architect.

**Product:** Real-world businesses, startups, capital, assets, agents and specialists → Economic Intent → 3 operating models → jurisdiction options → provider capability route → real proposal → accepted engagement → verified execution.

## Current implemented application
- Premium original, accessible responsive dark-emerald public UI; Platform, Architect, Network, Economy and Proof pages.
- 6 guided entry journeys, conventional/hybrid/onchain model assessment, Canada/Switzerland/UAE source reference packs.
- 3 multi-provider route alternatives and honest unsourced capability placeholders (never fake partners).
- PostgreSQL-backed persistent private projects, owner keys, assessment, revisions, route quotes, publication, proposal requests and provider applications.
- Live public opportunity and independently verified provider inventories (no synthetic counts).
- Optional real Founder-ops notification through the existing Noetfield intake API; local PostgreSQL remains the canonical Architect record.
- Optional Stripe Checkout integration with signature-verified payment webhook and real paid-status transition. Without Stripe configuration, actionable proposal requests remain available.
- Existing first-party RWA Clinic and control sandbox links. These demos are not silently copied into this app.

## Production / deployment
- Node.js >=20. `npm install && npm test && npm start`.
- `DATABASE_URL` is required for actual APIs and healthy production status. Schema `onchain_os` is isolated from other services on the PostgreSQL server.
- Deploy via the existing authorized Railway service. Set `DATABASE_URL` to an appropriate PostgreSQL reference variable. The service listens on `PORT`.
- Health endpoint: `GET /api/health` — returns 503 without a live database (rather than misleading success).
- Web application: `/onchain/`; Architect: `/onchain/architect/`; Network: `/onchain/network/`; Economy: `/onchain/economy/`; Proof: `/onchain/proof/`.
- Checkout only becomes available when `STRIPE_SECRET_KEY`, `STRIPE_PRICE_DIAGNOSTIC`, `STRIPE_WEBHOOK_SECRET` and `APP_ORIGIN` are correctly configured.
- Set Stripe webhook to `/api/stripe/webhook` on the verified deployment host.
- Never treat a Checkout Session as successful payment before verified provider webhook.
- Railway deployment does **not** automatically transfer ownership of `https://www.noetfield.com/onchain/` from the previous Noetfield Cloudflare source. The domain's actual edge route must be verified/migrated separately before claiming the new app serves that URL.

## Authorization
In this first no-wallet guest slice, the client receives a 256-bit random private project key. The server retains only a SHA-256 hash; reads and mutations require `X-Project-Key`. The browser stores the key for resuming. Do not upload secrets in goal text. Organization-level authentication and role management are future upgrades, not yet claimed.

## Privacy and verification
Publicly displayed opportunities require explicit user publication. Provider applications remain pending until actually verified. Actual event records are stored in PostgreSQL. Real network metrics are database queries, not seeded numbers.

## Development
```bash
npm install
npm run check
npm test
DATABASE_URL=postgresql://... npm start
```

GitHub Actions run static syntax checks, 27 deterministic Architect tests and a real PostgreSQL CRUD smoke suite.

## Commercial status
This MVP supports real proposal capture. Paid diagnostic checkout is optional and must not be advertised as enabled until Stripe credentials and a price are connected. No current third-party partner agreements or payments are implied.

## Ecosystem ownership
`Noetfield-Systems/noetfeld-os` remains the existing GEL/control plane. `Noetfield-Systems/Noetfield` currently owns the prior public Cloudflare pages deployment. This repo becomes the canonical new Onchain OS app codebase; cross-repo routing must preserve those live services.
