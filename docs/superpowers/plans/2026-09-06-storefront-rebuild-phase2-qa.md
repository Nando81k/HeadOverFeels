# Storefront Rebuild — Phase 2 (Catalog Pages) QA Report

**Date:** 2026-09-07 · **Branch:** `claude/site-rebuild-shopify-c6zuz3` (PR #228) · **Plan:** `2026-09-06-storefront-rebuild-phase2-catalog.md`

## Summary

Phase 2 replaced the customer catalog with Shopify-backed pages under `app/(storefront)/` and removed the legacy route files for those paths. Every automated check is green. The trial store still has no Storefront tokens and no products (Task 0 of Phase 1 is human-owned), so every page was verified in its **unconfigured** state (`hasShopifyEnv()` false → `CatalogUnavailable`, HTTP 200) plus unit tests against the hand-authored fixtures for the configured state.

| Check | Command | Result |
|---|---|---|
| Unit tests | `npm run test:run` | 283 files / 2087 tests passed |
| Type check | `npx tsc --noEmit` | clean |
| Lint (storefront paths + no-hex rule) | `npx eslint components/storefront 'app/(storefront)' lib/storefront lib/shopify tests/unit/storefront tests/unit/shopify tests/e2e app/sitemap.ts next.config.ts` | clean |
| Admin subset | `npx vitest run tests/unit/admin-*.test.ts* tests/unit/fulfillment-*.test.ts*` | 19 files / 49 tests passed |
| Production build | `npx next build` (placeholder `STRIPE_SECRET_KEY`, `DATABASE_URL`) | compile + TypeScript stages pass; storefront routes prerender; exits on the **pre-existing** `/admin/settings/goals` prerender that needs a reachable database (succeeds on Vercel; same as Phase 1) |
| E2E smoke | `npm run test:e2e` (dev server, Chromium desktop + mobile) | 19 passed, 3 skipped (PDP tests skip while the catalog is empty) |

## What shipped (by task)

| Task | Deliverable | Tests |
|---|---|---|
| T1 | `lib/shopify/filters.ts` (URL ↔ `ProductFilter`), `lib/shopify/rich-text.ts`, `hasShopifyEnv()` | 66 |
| T2 | `search` results query (filters, sort, cursor, `totalCount`), `sitemap` queries, featured/description on collections, fixtures + README | 43 |
| T3 | Server actions (load more, predictive search, newsletter), `SearchDialog` in the header, `NewsletterForm` in the footer, `CatalogUnavailable`, fallback menu → `/drops`, `/about` | 35 |
| T4 | Legacy routes/tests/dead dependents deleted (36 files), redirects (`/privacy`, `/terms`, `/products`), `(storefront)` metadata + error/not-found/loading, Shopify-backed `app/sitemap.ts` | 14 |
| T5 | `/` — hero, marquee, featured collection tiles, New in / Best sellers rails, drop spotlight, editorial, newsletter; `getHomeData()` | 33 |
| T6 | `/collections`, `/collections/[handle]` (filter rail + mobile drawer, sort, active chips, `LoadMoreGrid`), `/products` → `/collections/all`, `/drops`; `lib/storefront/plp-params.ts` | 61 |
| T7 | `/products/[handle]` + `/drops/[handle]` — gallery with zoom, URL-state variant selector, add-to-cart panel (Phase 3 seam), details accordion from rich text, sticky mobile bar, recommendations, JSON-LD, canonical metadata; `lib/storefront/{variants,seo}.ts` | 62 |
| T8 | `/search` (form + results with the PLP toolbar), `/policies/[handle]`, e2e spec replacing the preview spec, preview route removed | 18 (+22 e2e) |

## Deviations from the plan (recorded)

1. **Fixtures are hand-authored**, not recorded (no Storefront tokens yet). `tests/fixtures/shopify/README.md` lists the re-record command for when Task 0 lands.
2. **`/search` renders the empty-query form even when unconfigured** (a plain GET form); the catalog notice shows only once a query is submitted. Found by e2e and changed during QA.
3. **`ActiveFilters` falls back to a rendered label** ("20 – 50") for a typed price range, because Shopify's `PRICE_RANGE` value never carries the typed bounds; otherwise the chip could not be removed.
4. **`buildPlpHref` folds `min`/`max` into `filter.v.price`** before applying any patch so the price form and the filter links agree on one canonical param.
5. **PLP shows no result count** — the Storefront collection API has no total; search does (`totalCount`).
6. **`/drops/[handle]` is the PDP re-exported**; option links canonicalise to `/products/<handle>`. Phase 5 adds the countdown state machine and can wrap the route if drop URLs must stick.
7. **`AddToCartPanel` ships disabled** (`data-phase="3"`) until the cart Server Action exists; the `action` prop is the only change Phase 3 needs.
8. **Kept, though now unreferenced** (outside the plan's deletion list; flagged for Phase 6): `components/drops/ExclusiveDropPage.tsx`, `components/products/CountdownTimer.tsx`, `components/collections/CollectionCard*.tsx`, `components/marketing/NewsletterSignup.tsx`, `components/products/ReviewImageLightbox.tsx`. `components/products/product-filtering.ts` stays because its test still imports it.
9. **`generateMetadata` on the PLP** issues one extra `getCollectionProducts({ first: 1 })` request per render.
10. **E2E console policy:** resource errors from the legacy `/api/auth/*` and `/api/popups/*` endpoints (root `Providers`: NextAuth `SessionProvider`, `AuthProvider`, `PopupManager`) are ignored by request URL, and the dev server gets a placeholder `AUTH_SECRET`. Both disappear with the providers in Phase 6.
11. **Store side (done via the Admin API during Phase 1/2):** all seven `custom.*` metafield definitions exist with `PUBLIC_READ`; `main-menu` = Shop `/collections/all`, Collections `/collections`, Drops `/drops`, Loyalty `/loyalty`, About `/about`.

## Known limitations until Task 0 (human) is done

- No Headless channel → no Storefront tokens → every catalog page renders the "shop is warming up" notice. Header/footer use `FALLBACK_LAYOUT`.
- No products in the store (the catalog migration needs the Admin token and `DATABASE_URL`).
- Vercel Preview builds still fail on the missing `STRIPE_SECRET_KEY` in the Preview environment (legacy checkout; noted on the PR).

## Human verification checklist

- [ ] Complete Phase 1 Task 0 (Headless channel + tokens, HOF Ops app token), add them to Vercel (Preview + Production) and to `.env.shopify` locally.
- [ ] Run `npx tsx scripts/shopify/migrate-catalog.ts --dry-run` then `--apply`; confirm products/collections in Shopify admin.
- [ ] Run `npx tsx scripts/shopify/record-fixtures.ts` and re-run `npm run test:run` (fixtures become real).
- [ ] On the Vercel preview: `/` (hero, tiles, rails), `/collections/hoodies` (filters change the URL, sort, load more), `/products/<handle>` (swatches/sizes update the URL and price, zoom, accordion), `/search?q=hoodie`, `/drops`, `/policies/privacy-policy`, header search dialog, footer newsletter (check the subscriber lands in admin → Marketing).
- [ ] Phone (390px): mobile filter drawer, sticky buy bar, menu drawer.
- [ ] `/admin` unchanged; `/about`, `/contact`, `/cart`, `/loyalty` still render with the legacy header (expected until Phases 3–6).
- [ ] Add `STRIPE_SECRET_KEY` to the Vercel Preview environment (or accept red Preview deploys until Phase 6 removes Stripe).

## Next phase

Phase 3 — cart & checkout: Shopify cart cookie + Server Actions (`addCartLine` into `AddToCartPanel.action`, `cartCount` on `StorefrontShell`), cart drawer + `/cart`, discount codes, Shop Pay, free-shipping bar, checkout handoff QA (needs the store plan upgrade for real payments; Bogus Gateway works on trial).
