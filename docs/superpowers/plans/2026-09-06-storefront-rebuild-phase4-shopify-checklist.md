# Phase 4 — Shopify accounts & loyalty checklist (HUMAN)

**Owner:** Nando. Needed before customer sign-in, Care Points from Shopify orders and reward codes can be tested end to end. Everything in the first four sections is clicked in Shopify admin / Vercel; the two scripts at the end are the only API steps.

Store reminder (trial): "Plan: trial — you'll need to upgrade before you can start selling and unlock full features". The Customer Account API and webhooks work on trial; real orders go through Bogus Gateway (Phase 3 checklist).

## Customer Account API (Headless channel)

Shopify admin → Sales channels → **Headless** → the storefront ("Head Over Feels web") → **Customer Account API**.

- [ ] Create / enable the Customer Account API client for this storefront.
- [ ] Record the **Client ID** → `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID`.
- [ ] Record the **Shop ID** → `SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID`. For this store it is `85215183073` (the GID is `gid://shopify/Shop/85215183073`).
- [ ] **Callback URL(s):** `https://<vercel preview host>/account/callback` now, and later `https://<primary domain>/account/callback` when the domain is switched. Keep both while the preview is in use.
- [ ] **JavaScript origin(s):** the same origins (`https://<vercel preview host>`, later `https://<primary domain>`).
- [ ] **Logout URL:** the origin (`https://<vercel preview host>`, later `https://<primary domain>`).
- [ ] Shopify refuses `http://` and `localhost` here, so local testing uses the e2e mock OIDC server (Task 9); a tunnel is optional for a human smoke test and is not required.

## "HOF Ops" app scopes

Settings → Apps and sales channels → Develop apps → **HOF Ops** → Configuration → Admin API scopes.

- [ ] Add `read_discounts write_discounts read_customers write_customers` (on top of the Phase 1/3 scopes). Save, then update/reinstall the app when prompted.
- [ ] Re-copy the Admin API access token if it changed → `SHOPIFY_ADMIN_ACCESS_TOKEN` in `.env.shopify` and on Vercel.

## Webhook signing secret

- [ ] For an admin-created custom app, webhooks created through the API are signed with the **app's API secret key**: Apps → HOF Ops → **API credentials** → API secret key. Put it in `SHOPIFY_WEBHOOK_SECRET` (local `.env.shopify` and Vercel). (The secret shown under Settings → Notifications → Webhooks only signs admin-created webhooks, not these.)

## Vercel environment (Preview + Production)

Project → Settings → Environment Variables. Set each for **Preview** and **Production**:

- [ ] `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` — from the Customer Account API client above.
- [ ] `SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID` — `85215183073`.
- [ ] `CUSTOMER_SESSION_SECRET` — 32+ random bytes (`openssl rand -base64 48`); never reuse another secret.
- [ ] `SHOPIFY_WEBHOOK_SECRET` — the API secret key above.
- [ ] `NEXT_PUBLIC_BASE_URL` — the storefront origin: the Vercel preview URL of this branch for Preview, the primary domain for Production (no trailing slash). It must match the Callback URL / JavaScript origin registered above.
- [ ] Redeploy the preview after saving (env changes do not apply to the running deployment).

## Scripts (run order)

Both scripts read `.env.shopify` (+ `.env.local` for `DATABASE_URL`) and default to a dry run; nothing is written without `--apply`.

### 1. Pre-create customers

Links every active Prisma customer to a Shopify customer (found by email, else created with the newsletter consent) and writes `Customer.shopifyCustomerId`. Output: `scripts/shopify/out/customer-map.json`.

```bash
npx tsx scripts/shopify/precreate-customers.ts                   # dry run: read-only lookups, prints would-link / would-create
npx tsx scripts/shopify/precreate-customers.ts --apply --limit 5 # first 5 only — check the table in Shopify → Customers
npx tsx scripts/shopify/precreate-customers.ts --apply           # the rest; re-runnable (linked rows drop out, nothing is duplicated)
```

- [ ] Dry run: the counts match expectations (anonymised customers are excluded).
- [ ] `--apply --limit 5`, then `--apply`; any `error` rows are listed with Shopify's message and keep `shopifyCustomerId` null for a re-run.

### 2. Register webhooks

Subscribes `ORDERS_PAID`, `ORDERS_CANCELLED`, `REFUNDS_CREATE`, `CUSTOMERS_UPDATE` to `<base>/api/webhooks/shopify`. Idempotent by (topic, uri).

```bash
npx tsx scripts/shopify/register-webhooks.ts --base-url https://<vercel preview host>            # dry run: lists existing + the plan
npx tsx scripts/shopify/register-webhooks.ts --base-url https://<vercel preview host> --apply    # creates the missing subscriptions
```

- [ ] Dry run shows four `Would create` lines (or fewer on a re-run).
- [ ] `--apply` → `✓ 4 created, 0 already present, 0 failed`. A scope error means the HOF Ops reinstall above was skipped.
- [ ] Repeat with `--base-url https://<primary domain>` when the domain is switched; delete the preview-host subscriptions by hand (Settings → Notifications → Webhooks) once production is live.

## Smoke test (preview)

- [ ] Open the preview → account icon → **Sign in** → Shopify's hosted login (email code) → back on `/account` with the name and the orders list.
- [ ] Add to cart → Checkout → pay with Bogus Gateway card `1` → the order appears under `/account/orders`.
- [ ] Within a minute, `/loyalty` shows the **Care Points** for that order (webhook `orders/paid` → points posted; the admin loyalty history shows `shopify-order-paid-<order gid>`).
- [ ] **Redeem** a reward on `/loyalty` → a `HOF-…` code is shown and applied to the cart.
- [ ] Go to checkout → the code is honoured (discount line visible). Place the order with card `1`; the redemption is marked used.
