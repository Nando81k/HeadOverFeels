# Storefront Rebuild — Phase 4 (Accounts & Loyalty) QA Report

**Date:** 2026-10-20 · **Branch:** `claude/site-rebuild-shopify-c6zuz3` (PR #228) · **Plan:** `2026-09-06-storefront-rebuild-phase4-accounts.md` · **Human checklist:** `2026-09-06-storefront-rebuild-phase4-shopify-checklist.md`

## Summary

Phase 4 moved customer sign-in to Shopify's Customer Account API (PKCE, hosted login, encrypted `hof_customer` cookie), added the `/account/*` pages (overview, orders with tracking, order detail, addresses, profile), the Care Points hub at `/loyalty`, a wishlist that follows the customer, Care Points from the `orders/paid` webhook and reward redemption as single-use Shopify discount codes, and removed the customer-only legacy auth / profile / orders / wishlist surface. Waves 1 and 2 shipped in `219a4b5` and `3e72241`; this wave (3) adds the **hermetic Customer Account mock** and the **account e2e suite**, and fixes three bugs that suite found.

The trial store still has no Customer Account client (human-owned, see the checklist), so the configured path was verified end to end against the mock OIDC server and the hand-authored customer fixtures; the unconfigured path renders `AccountUnavailable` / `Sign-in is being set up` as designed.

| Check | Command | Result |
|---|---|---|
| Unit tests | `npm run test:run` | 305 files / 2765 tests passed, 0 unhandled errors |
| Type check | `npx tsc --noEmit` | clean |
| Lint (storefront paths + no-hex rule) | `npx eslint components/storefront lib/storefront lib/shopify 'app/(storefront)' tests/e2e scripts/shopify` | clean |
| Admin subset | `npx vitest run tests/unit/admin-*.test.ts* tests/unit/fulfillment-*.test.ts*` | 19 files / 49 tests passed |
| E2E (mock-backed) | `npm run test:e2e` (mock + `next dev`, Chromium desktop + mobile) | 36 passed, 2 skipped (mobile-only) on two consecutive warm runs; the account spec alone is 10/10 on both projects |
| E2E from a cold `.next` cache | same, `rm -rf .next` first | 1 worker: 36 passed. 2 workers: the Phase 3 cart test failed 3/3 (drawer never opened) — a `next dev` Fast Refresh from the other worker's first-time compile drops the pending transition. CI now runs 1 worker (deviation 6). |
| Production build | `npx next build` (placeholder `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `DATABASE_URL`, `AUTH_SECRET`) | compile + TypeScript stages pass and every storefront route builds; exits on the **pre-existing** `/admin/settings/goals` prerender that needs a reachable database (same as Phases 1–3; fine on Vercel) |

## What shipped in Wave 3

| Piece | Deliverable |
|---|---|
| Mock OIDC + Customer Account API | `tests/e2e/mock/customer-account-mock.mjs`, mounted by `storefront-mock.mjs` under `/customer`: `/.well-known/openid-configuration`, `/.well-known/customer-account-api`, `GET /oauth/authorize` (302 straight back with `code` + `state`; PKCE challenge and nonce remembered per code), `POST /oauth/token` (`authorization_code` with S256 verification and the `Origin` check, `refresh_token`; the id token carries the nonce), `GET /oauth/logout`, `POST /graphql` keyed on operation name (`CustomerSummary`, `CustomerUpdate`, `CustomerOrders`, `CustomerOrder`, `CustomerAddresses`, `CustomerAddressCreate/Update/Delete`) over the T1 fixtures; names and addresses mutate in memory **per sign-in**, so parallel Playwright workers never see each other's state; a bad token is a 401. |
| Storefront mock | `VariantsById` resolver (wishlist cards) from the merchandise map with `variants.json` as fallback. |
| Playwright env | `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID=mock`, `SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID=85215183073`, `SHOPIFY_CUSTOMER_ACCOUNT_ISSUER=http://127.0.0.1:4443/customer`, `NEXT_PUBLIC_BASE_URL=http://localhost:3000`, `CUSTOMER_SESSION_SECRET=e2e-secret`; `workers: 1` in CI. |
| `tests/e2e/storefront-account.spec.ts` | One journey (guest heart on the PDP → header icon → hosted login round trip → `/account` with "Hey, Nando." and the `NA` chip → overview cards → orders list → order #1012 detail with the UPS tracking link and status page → add an address through the real Server Action and the mock mutation → `/wishlist` keeps the saved item → `/loyalty` signed in → sign out from the header menu clears the chip and the cookie → `/account/orders` renders the gate with `return_to`) plus four short tests: `return_to` round trip, a forged callback `state` is refused with a 302 and no session cookie, `/loyalty` signed-out hero + both inline gates, `/account` signed out is a 200 gate. Console must be clean beyond the allow-list in every test. |
| Console allow-list | `tests/e2e/support/console.ts` also ignores the server `console.error` lines `next dev` mirrors into the browser when a Prisma call fails for want of a database (`Environment variable not found: DATABASE_URL` locally, `Can't reach database server` with CI's placeholder URL). |

## Bugs found by the suite and fixed here

1. **`/account` overview crashed on the server.** `app/(storefront)/account/page.tsx` called `customerFirstName()` imported from `CustomerProvider.tsx`, a `'use client'` module; Next 16 refuses to call a client-module function during server rendering ("Attempted to call customerFirstName() from the server…"), so the page rendered an empty `<main>`. The unit tests (jsdom) never see that boundary. Fix: the two name helpers now live in `components/storefront/account/customer-name.ts` (server-safe) and `CustomerProvider` re-exports them for the client callers.
2. **Sign-in links soft-navigated into a cross-origin redirect.** Every link into `/account/login` (header icon, `SignInGate`, loyalty hero and gates, `RewardCard`, wishlist banner, mobile menu) was a `next/link`; on click the router fetched the RSC payload, followed the route handler's 302 to the Shopify-side authorize URL cross-origin, hit CORS, logged `Failed to fetch RSC payload … Falling back to browser navigation` and only then did a full navigation. Fix: those links (and the `/account/refresh` one) are plain anchors. The gate copy and hrefs are unchanged; the unit tests still pass.
3. **Mock state was shared between workers** (first version of the mock): one worker's logout revoked the other's tokens and an added address showed up twice. Fix: state is per sign-in, carried through refreshes.

## Deviations from the plan (recorded)

1. **Prisma stays out of the e2e run.** Care Points balances, the ledger, the server wishlist (`StorefrontWishlistItem`), the customer link and earlier orders all need a database. The plan already scoped balances to unit tests; the same holds for the wishlist merge: the e2e asserts the guest entry survives sign-in and accepts both outcomes (`data-status="ready"` with the "We merged the 1 item" banner when a database is reachable, the local list with the guest banner when not). Everything in that family degrades and logs by design; nothing redirects or 500s.
2. **Order detail is loaded with `page.goto`, not by clicking "View".** The link's `href` is asserted first. A `next/link` soft navigation to a route the dev server has not compiled yet can be dropped when a Fast Refresh (another worker's compile) lands mid-transition; it is a dev-server artefact, not a page bug (the same click works on a warm cache).
3. **The forged-`state` test reads the raw 302** (`page.request`, `maxRedirects: 0`) rather than the landing page: `/account/login?error=state` is a route handler that starts a new login at once, so the error query never reaches a page. Pre-existing from Task 1 — the `NOTICES` map on `/account` only sees errors sent to `/account?error=`. Worth a follow-up: have the login route send `error=` to `/account` instead of restarting the flow.
4. **The journey test has its own 150 s budget** (`test.setTimeout`); seven first-time route compiles on `next dev` exceed the suite-wide 30 s.
5. **The legacy cookie-consent popup** (root `Providers` → `PopupManager`) still covers the lower third of the mobile viewport on every storefront page. It did not block any step here (Playwright scrolls targets into view) but it is visible in the mobile screenshots; Phase 6 removes the legacy providers.
6. **CI runs the e2e job with one worker** (`workers: isCI ? 1 : undefined`): with two, first-time compiles of different routes collide and a Fast Refresh drops the Phase 3 cart test's add-to-cart transition (3/3 cold runs). One worker passed cold. Cost: ~3 min instead of ~2.
7. **GitHub removed as a NextAuth provider** (`lib/auth/auth.config.ts`, `docs/SOCIAL_LOGIN_SETUP.md`) on Nando's ask of 2026-10-20: a developer-platform login is out of place on a storefront. It was only registered when `GITHUB_CLIENT_ID/SECRET` were set (no button in the repo's own sign-in page; NextAuth's default pages listed it). Google stays for admin.

## Human checklist (needs Nando)

From `2026-09-06-storefront-rebuild-phase4-shopify-checklist.md`, none of which can be done from this environment:

- [ ] Headless → Customer Account API client: callback URL `<preview>/account/callback` (later the primary domain), JavaScript origin, logout URL; copy the client id and shop id (`85215183073`).
- [ ] "HOF Ops" app scopes `read_discounts write_discounts read_customers write_customers`; re-copy the Admin token if it changed.
- [ ] `SHOPIFY_WEBHOOK_SECRET` = the app's API secret key.
- [ ] Vercel env (Preview + Production): `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID`, `SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID`, `CUSTOMER_SESSION_SECRET`, `SHOPIFY_WEBHOOK_SECRET`, `NEXT_PUBLIC_BASE_URL`; redeploy.
- [ ] `npx tsx scripts/shopify/precreate-customers.ts` (dry run, then `--apply`), then `register-webhooks.ts --base-url <preview>` (dry run, then `--apply`).
- [ ] Smoke on the preview: sign in from the header → `/account` shows the Shopify customer; place a Bogus Gateway order → Care Points appear on `/loyalty` and on the order detail; redeem a reward → the code is applied to the cart and shows at checkout; sign out clears both sides.

## Verification log

All of the above were run on this branch on 2026-10-20 before the wave 3 PR was opened (commit in the PR description). Order: unit suite → typecheck → lint → account spec (both projects) → full e2e ×2 warm → full e2e cold with 2 workers (cart flake reproduced 3/3) and with 1 worker (green) → admin subset → production build.
