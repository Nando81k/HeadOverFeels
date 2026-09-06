# Storefront Rebuild — Phase 1 QA Report

**Date:** 2026-09-06 · **Branch:** `claude/site-rebuild-shopify-c6zuz3` (PR #228, Phase 1 integration branch) · **Plan:** `2026-09-06-storefront-rebuild-phase1-foundation.md` · **Spec:** `specs/2026-09-06-storefront-rebuild-shopify-design.md`

## 1. Scope delivered

All 15 code tasks of Phase 1 are implemented and committed on the integration branch. Task 0 (human) is partially done through the Admin API; the remaining Task 0 items need the Shopify admin UI.

| Task | Deliverable | Status |
|---|---|---|
| 0 | Store prerequisites | **Partial.** Done via API: 7 `custom.*` metafield definitions (storefront `PUBLIC_READ`), `main-menu` = Shop / Collections / Drops / Loyalty / About. **Still human:** Headless sales channel + Storefront tokens, "HOF Ops" Admin app + token, policies text, shipping/taxes, store rename. |
| 1 | Env accessor, Admin client, deps, `.env.shopify.example` | Done |
| 2 | `storefrontFetch` (cache tags, retry on 429/430), `ShopifyError`, domain types | Done |
| 3 | Metafield definitions script | Done (definitions also created in the store) |
| 4 | Catalog migration, `productOperation` polling, fixture recorder | Done (code only — **not run**: no DB or tokens here) |
| 5 | Product query + normaliser | Done |
| 6 | Collection(s) queries + normalisers | Done |
| 7 | Shop layout, policies, predictive search, recommendations | Done |
| 8 | Tokens, base styles, fonts, `globals.css` split | Done |
| 9 | Button, IconButton, Badge, Price, money helpers, no-hex lint rule | Done |
| 10 | Display / Eyebrow / Prose, Container, Section | Done |
| 11 | Input, Select, Checkbox, QuantityStepper, Skeleton | Done |
| 12 | Drawer, Dialog, Accordion, AnnouncementBar, Marquee | Done |
| 13 | ProductCard, ProductGrid, SwatchDots (+ `cdn.shopify.com` images) | Done |
| 14 | Header, HeaderNav, MobileMenu, Footer, StorefrontShell, `/storefront-preview` | Done |
| 15 | Playwright config + smoke spec, non-blocking CI job, this report | Done |

## 2. Verification results

| Check | Command | Result |
|---|---|---|
| Unit tests (whole repo) | `npm run test:run` | **270 files, 1812 tests passed, 0 failed** |
| Storefront + Shopify unit tests | `npx vitest run tests/unit/shopify tests/unit/storefront tests/unit/scripts` | 84 (shopify) + 221 (storefront) + 33 (scripts) passed |
| Admin subset (cross-cutting note 7) | `npx vitest run tests/unit/admin-*.test.ts* tests/unit/fulfillment-*.test.ts*` | passed (included in the full run; no admin file regressed) |
| Type check | `npx tsc --noEmit` | clean |
| Lint (new code, incl. no-hex rule) | `npx eslint components/storefront lib/shopify lib/storefront 'app/(storefront)' scripts/shopify tests/unit/{shopify,storefront,scripts} tests/e2e` | clean |
| Production build | `npx next build` | **Compile + TypeScript stages pass** (`✓ Compiled successfully`). The build then fails in this container while prerendering the **legacy** `/` page, which queries Prisma at build time (`Can't reach database server`) — there is no `DATABASE_URL` here. Pre-existing behaviour; Vercel supplies the env. Not caused by Phase 1 (no storefront route is prerendered: `/storefront-preview` is `force-dynamic`). |
| Playwright smoke | `npm run test:e2e` (against `next dev`, no Shopify env → shell renders the fallback layout) | **11 passed, 1 skipped** (mobile-only drawer test is skipped on the desktop project by design) |
| Storefront GraphQL | Shopify MCP `validate_graphql_codeblocks` (storefront-graphql) | all 7 documents valid against 2026-07 |

### Pre-existing issues observed (not fixed in this phase)

- `next build` without a reachable database fails on the legacy homepage prerender (see above). Vercel **Preview** deployments also need `STRIPE_SECRET_KEY` in the Preview environment (Vercel project setting, flagged on PRs #229–#232).
- With no auth env, `next dev` logs `[auth][error] MissingSecret` on every page because the legacy root `Providers` poll `/api/auth/session`. Harmless for the storefront shell; goes away in Phase 6 when the legacy providers are removed from storefront routes.
- `npm run lint` (whole repo) still carries the ~88 pre-existing errors CI already tolerates (`continue-on-error`). New storefront paths are clean.

## 3. Deviations from the plan (all recorded in the plan doc)

1. **Integration branch** is the session branch `claude/site-rebuild-shopify-c6zuz3` (PR #228), not a separate `storefront-v2`; the session may not push elsewhere. The draft "integration" PR to `main` is therefore #228 itself.
2. **Token names** renamed on the storefront side to avoid colliding with the admin `@theme` block and Tailwind's defaults: `--radius-sharp` (`rounded-sharp`) instead of `--radius-sm`; `--duration-sf-*` and `--ease-sf-*` instead of `--duration-*` / `--ease-*`. `duration-sf-*` are explicit `@utility` blocks in `base.css` because Tailwind v4 has no `--duration-*` namespace.
3. **PDP query** aliases the 12-image gallery (`gallery: images(first: 12)`) — the un-aliased form conflicts with the card fragment's `images(first: 2)` (schema validation caught it).
4. **Fixtures are hand-authored placeholders**, not recorded: the store has no Headless channel yet, so `record-fixtures.ts` cannot run. `tests/fixtures/shopify/README.md` lists the re-record steps (`npx tsx --conditions=react-server scripts/shopify/record-fixtures.ts --apply`).
5. **Preview route** is `/storefront-preview` (the plan's `_preview` is a private folder in the App Router and never routes). It is `force-dynamic`, `noindex`, and 404s in production unless `STOREFRONT_PREVIEW=1`.
6. **`StorefrontShell` falls back** to a static menu (`FALLBACK_LAYOUT`, `data-layout-source="fallback"`) when `getShopLayout()` throws, so the shell renders before the Storefront tokens exist.
7. **`lib/shopify/admin-client.ts` does not import `server-only`** — the migration scripts run under `tsx`, which has no `react-server` condition. It is documented as server/scripts-only. `client.ts` (Storefront) does import `server-only`.
8. **Storefront SDK** is used only for the Admin client. `storefrontFetch` uses plain `fetch` so Next's `next: { tags, revalidate }` applies. Installed versions are `@shopify/*-api-client@2.0.0` (the plan's `2026.4.x` does not exist on npm).
9. **Header logo** is the text wordmark in `font-display`: `public/assets/head-over-feels-wordmark.png` has an opaque white background and would not survive the transparent header state.
10. **`productSet` default variant**: `ProductVariantSetInput.optionValues` is non-null in 2026-07; products with no Size/Color may need `[{ optionName: 'Title', name: 'Default Title' }]`. Flagged in `migrate-catalog.ts`; confirm on the first `--apply --limit 1` run.

## 4. Human verification checklist (Nando)

- [ ] Shopify admin → Sales channels → add **Headless**, create storefront "Head Over Feels web", copy the public + private Storefront tokens; enable the unauthenticated scopes listed in plan Task 0.
- [ ] Settings → Apps → Develop apps → "HOF Ops" with the Admin scopes from Task 0; copy the Admin token.
- [ ] Put both in a local `.env.shopify` (copy `.env.shopify.example`); never commit it.
- [ ] Settings → Policies (Privacy, Terms, Refund, Shipping), Shipping profile, Taxes, rename store to "Head Over Feels".
- [ ] Add repo secrets `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_PRIVATE_TOKEN`, `NEXT_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN` so the non-blocking `e2e` CI job runs; add the same (plus `SHOPIFY_ADMIN_ACCESS_TOKEN`) to Vercel Preview + Production. Add `STRIPE_SECRET_KEY` to Vercel Preview so preview builds stop failing.
- [ ] Run `npx tsx scripts/shopify/migrate-catalog.ts` (dry run), then `--apply --limit 1`, inspect the product in Shopify admin, then full `--apply`.
- [ ] Run the fixture recorder and commit the recorded JSON (replaces the placeholders).
- [ ] Open `/storefront-preview` on the Vercel preview (set `STOREFRONT_PREVIEW=1` there) on desktop and a real phone: header transparent→scrolled, mobile drawer, marquee, product grid from the trial store, footer policies.
- [ ] Confirm `/admin` renders unchanged (only `globals.css` was split; admin tokens moved verbatim).
- [ ] Answer spec §10 open questions (6a customer-account domain, 9a loyalty keep/buy, 10a drops enforcement, 20a order history, 21 avatar nav) before Phase 2/4 start.

## 5. Definition of done — status

| Item | Status |
|---|---|
| Store has metafield definitions, migrated catalog, collections, `main-menu`, published to Online Store + Headless | Metafields ✅ · menu ✅ · catalog/collections/Headless ⏳ (needs Task 0 tokens) |
| `lib/shopify` covers product, collections, shop layout, policies, search, recommendations with fixtures + passing normaliser tests | ✅ (fixtures are placeholders until recorded) |
| Tokens + primitives + ProductCard/Grid + shell exist, lint-clean under no-hex, render at the preview route | ✅ |
| `app/globals.css` is a three-import file; admin unchanged and admin tests green | ✅ |
| Integration branch with Vercel preview; draft integration PR open | ✅ PR #228 (Vercel preview builds need the Preview env fix above) |
| Phase 2 can start from the shared contracts | ✅ |
