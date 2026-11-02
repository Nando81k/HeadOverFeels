# Storefront Rebuild — Phase 5 (Drops, Reviews, Back-in-stock, SEO & Analytics) QA Report

**Date:** 2026-11-02 · **Branch:** `claude/project-thread-rxir25` → `claude/site-rebuild-shopify-c6zuz3` (PR #235; integration PR #228) · **Plan:** `2026-09-06-storefront-rebuild-phase5-drops-reviews.md`

## Summary

Phase 5 gives the storefront its merchandising layer: the drop state machine (upcoming · early-access · live · ended) with a countdown, a client-side early-access gate for members and an authoritative server-side gate at add-to-cart time; product reviews re-keyed by Shopify handle (PDP summary, paged list, moderated submission, home strip, `aggregateRating`); back-in-stock alerts keyed by Shopify variant with a `products/update` webhook that releases them; site-level JSON-LD and robots rules; and a typed analytics event stream (`window.dataLayer` + optional gtag). Both waves shipped on one branch (PR #235): wave 1 = Tasks 1, 2, 4; wave 2 = Tasks 3, 5.

The trial store still has no Storefront tokens, Customer Account client or `custom.drop_*` metafield definitions (human-owned, see the checklist), so every configured path was verified against the hermetic Storefront + Customer Account mocks and the unit suite; the unconfigured path renders exactly as before.

| Check | Command | Result |
|---|---|---|
| Unit tests | `npx vitest run` (with a placeholder `DATABASE_URL`) | 322 files / 2911 tests passed, 0 unhandled errors |
| Type check | `npx tsc --noEmit` | clean |
| Lint (storefront paths + no-hex rule) | `npx eslint components/storefront lib/storefront lib/shopify lib/back-in-stock 'app/(storefront)' app/api/webhooks scripts/shopify tests/e2e tests/unit/storefront` | clean |
| Admin subset | `npx vitest run tests/unit/admin-*.test.ts* tests/unit/fulfillment-*.test.ts* tests/unit/app/admin tests/unit/components/admin` | 171 files / 1094 tests passed |
| E2E (mock-backed, desktop Chromium) | `npx playwright test -c tests/e2e/playwright.config.ts --project=chromium` | desktop + mobile Chromium, one worker: 46 passed, 2 skipped (mobile-only); the drops spec is 5/5 on both projects. First cold run found the two bugs below. |
| Prisma | `npx prisma validate` + `npx prisma generate` (no database here; migrations are hand-written SQL) | clean |

## What shipped

| Task | Deliverable |
|---|---|
| 1 Drops | `lib/storefront/drops.ts` (pure state machine over `custom.drop_start` / `custom.drop_end`, copy, countdown, `groupDrops`), `early-access.ts` (tier flag **or** `EarlyAccessGrant` by `Product.slug = handle`), `purchasable.ts` (`assertPurchasable` wired into `addCartLine`: `DROP_NOT_OPEN` / `DROP_ENDED`), `DropStatus`, `DropCountdown` (`router.refresh()` once at zero), `EarlyAccessGate` (client island, `checkEarlyAccessAction`), locked buy button + sticky bar, `/drops` groups (Open now / Next drops / Past drops), home spotlight + marquee follow the live or next drop. |
| 2 Reviews | Prisma `Review.productHandle` (+ index with status), `productId` optional, migration backfills from `products.slug`; `lib/storefront/reviews.ts` (`unstable_cache` 300 s, tag `reviews:<handle>`, every read degrades to empty; `createReview` → `PENDING`, one per customer per product, verified purchase via Customer Account order line titles); `submitReviewAction` / `listReviewsAction`; `Stars`, `ReviewSummary`, `ReviewCard`, `ReviewList` (sort + load more), `ReviewForm` (sign-in line, honeypot, moderation notice, `review_submitted`), `ReviewsSection` (`#reviews`), `Textarea` primitive, home `ReviewsStrip`; PDP rating link + `aggregateRating` in Product JSON-LD. |
| 3 Back-in-stock | Prisma `BackInStockNotification.productHandle` / `shopifyVariantId` (unique with email, indexed with status), `productId` optional; `lib/back-in-stock/send.ts` shared Resend sender (legacy trigger refactored onto it); `lib/storefront/back-in-stock.ts` (`subscribe` upsert, `parseProductsUpdate`, `notifyVariantsBackInStock`, `cancelSubscription`); `subscribeBackInStockAction` (account email for signed-in customers, typed email for guests, honeypot); `BackInStockForm` under the buy box for a sold-out variant; wishlist "Back in stock alert" links to the PDP form with the variant preselected; `/back-in-stock/unsubscribe` page; webhook `products/update` → alerts; `PRODUCTS_UPDATE` added to `register-webhooks.ts`. |
| 4 SEO + analytics | Organization + WebSite/SearchAction JSON-LD in the layout, CollectionPage + BreadcrumbList on collections, robots rules for the new routes; `lib/storefront/analytics.ts` (`track()` → `dataLayer` + `hof:analytics` DOM event), `Analytics` island (page_view, gtag only with `NEXT_PUBLIC_GA_MEASUREMENT_ID`), `ViewItem` island (view_item + drop_view), cart provider / checkout buttons / gate / forms emit their events. |
| 5 E2E + QA | Storefront mock promotes `signature-tee` to an upcoming drop (opens in two days) beside the fixture's live `drop-01-heavyweight-crew`, and passes drop metafields through to mocked PDPs; `tests/e2e/storefront-drops.spec.ts` (five tests: `/drops` groups, upcoming PDP locked + countdown + signed-out gate, live PDP adds to cart, sold-out variant offers the alert, home announces the drop); this report; PR #228 summary updated to Phases 1–5. |

## Bugs found and fixed during QA

1. **`'use server'` files exported constants.** `app/(storefront)/_actions/reviews.ts` and `back-in-stock.ts` exported their form-state types and copy next to the actions. The unit suite (which imports the modules directly) was green, but Turbopack refuses non-async exports from a `'use server'` module, so every PDP and the home page 500'd on the dev server. The e2e drops spec caught it on its first run. Fix: the shared contracts moved to `lib/storefront/review-form.ts` and `lib/storefront/back-in-stock-form.ts`; the action files export only async functions. Worth remembering for every future Server Action module.
2. **`EarlyAccessGate` took a render prop across the server/client boundary.** The PDP (a Server Component) passed `{(locked) => buyBox(...)}` as the gate's children; React refuses a function child on a Client Component ("Functions are not valid as a child of Client Components"), so every **upcoming** drop PDP fell into the error boundary. jsdom renders both sides in one tree and never sees the boundary. Fix: the gate takes `locked` and `unlocked` as rendered elements and picks one. Same lesson as above: anything that crosses into a client island must be serialisable.
3. **Drops index test pinned the old page size.** `collections-index.test.tsx` expected `first: 24` after the `/drops` rewrite moved to 48 (so the grouped page can hold a season of past drops). Updated.

## Deviations from the plan (recorded)

1. **`maxPerOrder` is not re-checked by `assertPurchasable`.** Phase 3's `addCartLine` already caps the line after the add and surfaces the warning; the Phase 5 gate only decides open/closed. Same user-visible result, one less Storefront round trip.
2. **Early access is resolved client-side after mount.** The PDP is ISR (300 s) and cannot know the viewer, so the page renders the time-based state and `EarlyAccessGate` asks `checkEarlyAccessAction` once mounted. The server re-checks on every add. A member therefore sees a locked box for one paint before it unlocks.
3. **Verified purchase matches on line-item title.** The Customer Account API on this store does not expose line-item product ids; a title match against the product title stands in. Unverified reviews are accepted and moderated like everything else.
4. **Review points are awarded on approval, not submission** — the admin approve path already calls `awardReviewPoints`; nothing changes on submit.
5. **Back-in-stock without an email provider marks rows `NOTIFIED` without sending**, so configuring Resend later does not fire a backlog of stale alerts. The legacy Prisma-keyed trigger keeps its own behaviour (skip and retry next cycle).
6. **The e2e live-drop add puts the Core Hoodie's variant in the cart.** Every mocked PDP shares the Core Hoodie fixture's options and variant ids, so the server-side gate sees a non-drop variant; the gate, early access and the per-order cap are unit-tested (`purchasable.test.ts`, `early-access.test.ts`, `cart-actions.test.ts`). The signed-in early-access unlock needs Prisma and is unit-only.
7. **Both waves on one PR.** The thread works on a single designated branch, so wave 2 landed on PR #235 rather than a second draft; the PR body lists both.
8. **PR #228's body had not been updated for Phase 4**; it now covers Phases 1–5.

## Phase 6 removals enabled by this phase

- Legacy review components under `components/products/Review*.tsx` and `app/api/reviews/*`, `app/api/products/[id]/reviews/route.ts` (the admin review pages still import some of them — move those first).
- `Review.productId` / `BackInStockNotification.productId` foreign keys once the admin screens read by handle.
- Legacy `app/api/back-in-stock/route.ts` (NextAuth-gated) in favour of the storefront action + unsubscribe page.

## Human checklist (needs Nando)

- [ ] Shopify admin → Settings → Custom data → Products: metafield definitions `custom.drop_start` (date_time), `custom.drop_end` (date_time), `custom.max_per_order` (integer), storefront access **read**. Tag a test product `drop` and set a start a few minutes ahead to watch the countdown flip.
- [ ] Re-run `npx tsx scripts/shopify/register-webhooks.ts --base-url <preview> --apply` so `PRODUCTS_UPDATE` is subscribed (five topics now).
- [ ] Vercel env: `NEXT_PUBLIC_GA_MEASUREMENT_ID` if GA is wanted (gtag loads only when set); `RESEND_API_KEY` + `EMAIL_FROM` for back-in-stock emails.
- [ ] Run the two Prisma migrations (`20261102000000_phase5_reviews_handle`, `20261102010000_phase5_back_in_stock_shopify`) against the preview database (`npx prisma migrate deploy`).
- [ ] Approve one submitted review in `/admin/reviews` and confirm it shows on the PDP within five minutes.
- [ ] `STRIPE_SECRET_KEY` in the Vercel Preview environment (pre-existing; every wave PR preview fails without it).
