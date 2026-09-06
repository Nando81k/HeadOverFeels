# Storefront Rebuild — Phase 2: Catalog Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the customer-facing catalog with pages built on the Phase 1 layer: home, collections index, collection/PLP with Shopify filters + sort + cursor "load more", `/products` alias, PDP with URL-state variants, `/drops` list, `/search`, `/policies/[handle]`, a Shopify-backed sitemap, and the header search + footer newsletter interactions — deleting the legacy route files (and only their dead dependents) as each path is taken over. Cart, accounts, reviews and the drop state machine are later phases; Phase 2 leaves clean seams for them.

**Architecture:** Routes live under `app/(storefront)/` inside `StorefrontShell`. Data comes only from `lib/shopify/queries/*` (plus new `search`/`sitemap` modules and small additions to `collections`). Every page tolerates a store without Storefront tokens: `hasShopifyEnv()` false → render `CatalogUnavailable` (never throw, never 500); with env present, Shopify errors propagate to `app/(storefront)/error.tsx`. URL is the state: PLP filters/sort/cursor, PDP variant options, search query. Client islands are small and use Server Actions (`app/(storefront)/_actions/*`).

**Tech stack:** as Phase 1. No new dependencies.

**Design spec:** `docs/superpowers/specs/2026-09-06-storefront-rebuild-shopify-design.md` §5.3–5.4. **Phase 1 plan / QA:** `2026-09-06-storefront-rebuild-phase1-{foundation,qa}.md` (token names, primitives, deviations). **Legacy audit** used for this plan is summarised in §"Legacy surface" below.

---

## Cross-cutting agent notes (read once)

1. npm only. `npx vitest run <file>`, `npx tsc --noEmit`, `npx eslint <paths>`. Vitest 4 one-arg `vi.fn<T>()`; `global.fetch` is a `vi.fn()`; tests that transitively import `lib/shopify/client.ts` need `vi.mock('server-only', () => ({}))`. React 19 (`ref` prop, `useActionState`, `use`). Next 16: `params`/`searchParams` are **Promises** in pages and `generateMetadata`.
2. Storefront imports only from `components/storefront/**`, `lib/storefront/**`, `lib/shopify/**`, `lib/newsletter/subscribers` (server action only). Never `components/ui`, `components/layout/Navigation`, `lib/store`, `lib/home`, `lib/api`, `lib/seo`.
3. Token utilities (Phase 1 names): colours `ink ink-soft ink-mute bone paper line line-strong signal signal-ink rose rose-tint ok warn danger`; `font-display font-body font-mono`; `text-display-xl|lg|md`; `tracking-display tracking-eyebrow`; `px-gutter py-section gap-gutter`; `max-w-shop`; `rounded-sharp rounded-pill`; `duration-sf-fast|base|slow`, `ease-sf-out|spring`; `.num`; focus ring `focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2`. No hex literals (lint-enforced under `components/storefront`, `app/(storefront)`, `lib/storefront`).
4. Primitives available: Button, IconButton, Badge, Price, Display/Eyebrow/Prose, Container, Section, Input, Select, Checkbox, QuantityStepper, Skeleton/SkeletonText, Drawer, Dialog, Accordion/AccordionItem, AnnouncementBar, Marquee, ProductCard/ProductCardSkeleton, ProductGrid, SwatchDots, Header/HeaderNav/MobileMenu/Footer/StorefrontShell. Read a primitive's props before using it; do not fork primitives — extend them in place if a prop is missing (and keep their tests green).
5. **Unconfigured store rule:** pages call `hasShopifyEnv()` first. False → `<CatalogUnavailable />` inside the normal page chrome (`data-catalog="unconfigured"`), HTTP 200. True → fetch; a `null` result (unknown handle) → `notFound()`; a thrown `ShopifyError` propagates (error boundary). Never `.catch(() => null)` around a fetch when env is configured.
6. **URL state contracts** (see Shared contracts): PLP `?sort=&after=&filter.*=`; PDP `?<OptionName>=<value>`; search `?q=&sort=&after=&filter.*=`.
7. **Legacy deletion rule (T3):** delete a legacy file only when `grep -rn "<module path>" app components lib tests scripts` shows no importer left after the route removals in this plan. If something surviving still imports it, leave it and list it in the report.
8. Admin must stay green: `npx vitest run tests/unit/admin-*.test.ts* tests/unit/fulfillment-*.test.ts*` before finishing any task that touches `app/layout.tsx`, `next.config.ts`, or deletes files.
9. Branching: integration branch is `claude/site-rebuild-shopify-c6zuz3` (PR #228); waves are committed to it by the orchestrator. Do not commit from a task.
10. Trial store: 0 products until the catalog migration runs (needs Task 0 tokens + DB). Fixtures under `tests/fixtures/shopify` are hand-authored placeholders; extend them in the same style and update `tests/fixtures/shopify/README.md`.

---

## Wave summary

| Wave | Tasks | Parallel? | Depends on |
|------|-------|-----------|------------|
| W1 | 1, 2, 3 | 3 parallel | Phase 1 merged |
| W2 | 4, 5, 6, 7, 8 | 5 parallel (disjoint files) | W1 committed |
| W3 | 9 (verify + QA report) | sequential | W2 committed |

---

## File structure

**Created**
- `lib/shopify/filters.ts` (T1) — URL param ↔ `ProductFilter` mapping (pure)
- `lib/shopify/rich-text.ts` (T1) — Shopify rich text JSON → HTML (pure)
- `lib/shopify/queries/search.ts` additions, `lib/shopify/queries/sitemap.ts` (T2)
- `tests/fixtures/shopify/search-results.json`, `sitemap-products.json`, `sitemap-collections.json` (T2); `collections.json` updated (T2)
- `app/(storefront)/_actions/catalog.ts`, `app/(storefront)/_actions/newsletter.ts` (T3)
- `components/storefront/search/SearchDialog.tsx`, `components/storefront/newsletter/NewsletterForm.tsx`, `components/storefront/CatalogUnavailable.tsx` (T3)
- `app/(storefront)/error.tsx`, `app/(storefront)/not-found.tsx`, `app/(storefront)/loading.tsx` (T4)
- `app/(storefront)/page.tsx`, `lib/storefront/home-data.ts`, `components/storefront/home/{Hero,CollectionTiles,ProductRail,DropSpotlight,Editorial,NewsletterSection}.tsx` (T5)
- `app/(storefront)/collections/page.tsx`, `app/(storefront)/collections/[handle]/page.tsx`, `app/(storefront)/products/page.tsx`, `app/(storefront)/drops/page.tsx`, `components/storefront/collection/{CollectionHeader,FilterRail,FilterGroup,SortSelect,ActiveFilters,LoadMore,CollectionTile,PlpToolbar}.tsx`, `lib/storefront/plp-params.ts` (T6)
- `app/(storefront)/products/[handle]/page.tsx`, `app/(storefront)/drops/[handle]/page.tsx`, `components/storefront/pdp/{Gallery,VariantSelector,AddToCartPanel,DetailsAccordion,StickyBuyBar,RecommendationsRail,ProductJsonLd}.tsx`, `lib/storefront/variants.ts`, `lib/storefront/seo.ts` (T7)
- `app/(storefront)/search/page.tsx`, `app/(storefront)/policies/[handle]/page.tsx`, `components/storefront/search/SearchResults.tsx` (T8)
- `tests/e2e/storefront-catalog.spec.ts` (T8), `tests/unit/storefront/*.test.tsx`, `tests/unit/shopify/*.test.ts` (per task)
- `docs/superpowers/plans/2026-09-06-storefront-rebuild-phase2-qa.md` (T9)

**Modified**
- `lib/shopify/env.ts` (+`hasShopifyEnv`) (T1); `lib/shopify/types.ts` (+`SearchPage`, `CollectionSummary.description/featured`, `SitemapEntry`) (T1)
- `lib/shopify/queries/collections.ts` (+description, featured) (T2); `lib/shopify/queries/index.ts` (T2)
- `components/storefront/layout/Header.tsx` (search button opens `SearchDialog`), `Footer.tsx` (uses `NewsletterForm`), `StorefrontShell.tsx` (`FALLBACK_LAYOUT` → `/drops`, `/about`) (T3)
- `app/(storefront)/layout.tsx` (metadata) (T4); `app/sitemap.ts` (Shopify) (T4); `next.config.ts` (redirects) (T4)
- `tests/e2e/playwright.config.ts` (webServer url → `/`), `.github/workflows/ci.yml` (drop `STOREFRONT_PREVIEW`) (T8)

**Deleted (T4, after grep rule)**
- Routes: `app/page.tsx`, `app/collections/page.tsx`, `app/collections/[slug]/page.tsx`, `app/products/page.tsx`, `app/products/[slug]/page.tsx`, `app/products/[slug]/ProductPageClient.tsx`, `app/drops/[slug]/page.tsx`, `app/privacy/page.tsx`, `app/terms/page.tsx`, `app/(storefront)/storefront-preview/**`
- Dead dependents: `components/home/**` (all files incl. the six already-unused carousels), `lib/home/**`, `components/products/ProductsClientView.tsx` (verify), `components/drops/DropHeroSection.tsx` (verify), `lib/seo/**` (verify; replaced by `lib/storefront/seo.ts`)
- Tests: `tests/unit/collections-page.test.tsx`, `collection-detail-page.test.tsx`, `product-page-client.test.tsx`, `homepage-data.test.ts`, `homepage-sections.test.tsx`, `products-page-filters.test.tsx`

**Kept on purpose:** `components/layout/Navigation.tsx` + `MobileBottomNav` + `components/search/**` + `/api/products*`, `/api/collections*`, `/api/search*` (13 legacy account/checkout pages still use them until Phases 3–4/6); `lib/collections/public-collections.ts` (admin API routes import it).

---

## Shared contracts (source of truth)

```ts
// lib/shopify/env.ts (add)
export function hasShopifyEnv(): boolean   // true when SHOPIFY_STORE_DOMAIN + SHOPIFY_STOREFRONT_PRIVATE_TOKEN are non-blank; never throws

// lib/shopify/types.ts (add / change)
export type CollectionSummary = { id: string; handle: string; title: string; image: ShopImage | null; description: string | null; featured: boolean; productCount?: number }
export type SearchPage = { products: ProductCardData[]; filters: Filter[]; pageInfo: { hasNextPage: boolean; endCursor: string | null }; totalCount: number }
export type SitemapEntry = { handle: string; updatedAt: string }
export type SitemapEntries = { products: SitemapEntry[]; collections: SitemapEntry[] }

// lib/shopify/filters.ts (pure)
export type ProductFilter =
  | { available: boolean } | { variantOption: { name: string; value: string } }
  | { price: { min?: number; max?: number } } | { productType: string } | { productVendor: string }
  | { tag: string } | { productMetafield: { namespace: string; key: string; value: string } }
  | { variantMetafield: { namespace: string; key: string; value: string } }
export type ActiveFilter = { key: string; value: string }          // e.g. { key: 'filter.v.option.size', value: 'M' }
export type SearchParamsLike = URLSearchParams | Record<string, string | string[] | undefined>
export function parseFilterParams(params: SearchParamsLike): { productFilters: ProductFilter[]; active: ActiveFilter[] }
export function filterValueToActive(value: FilterValue): ActiveFilter | null     // parses value.input JSON
export function isFilterValueActive(active: ActiveFilter[], value: FilterValue): boolean
export function toggleFilterParam(params: URLSearchParams, f: ActiveFilter): URLSearchParams  // add/remove, drops `after`
export function clearFilterParams(params: URLSearchParams): URLSearchParams
// Param scheme (mirrors Shopify FilterValue.id): filter.v.availability=1|0 · filter.v.option.<name>=<value> (repeatable)
// · filter.v.price=<min>-<max> (either side may be empty) · filter.p.product_type=<v> · filter.p.vendor=<v> · filter.p.tag=<v>
// · filter.p.m.<ns>.<key>=<v> · filter.v.m.<ns>.<key>=<v>

// lib/shopify/rich-text.ts (pure)
export function richTextToHtml(json: string | null | undefined): string | null
// Supports root, paragraph, heading(level 1-6), list(listType bullet|ordered), list-item, link(url,title,target), text(bold,italic,value). Escapes all text/attrs. Unknown nodes render their children.

// lib/shopify/queries/search.ts (add)
export const SEARCH_QUERY: string
export type SearchSort = 'relevance' | 'price-asc' | 'price-desc'
export function toSearchSortArgs(sort?: SearchSort): { sortKey: 'RELEVANCE' | 'PRICE'; reverse: boolean }
export function normalizeSearchPage(raw: RawSearchPage): SearchPage
export async function getSearchResults(args: { q: string; first?: number; after?: string | null; filters?: ProductFilter[]; sort?: SearchSort }): Promise<SearchPage>
// tags ['search'], revalidate false; q trimmed; empty q → { products: [], filters: [], pageInfo: {hasNextPage:false,endCursor:null}, totalCount: 0 } without fetching

// lib/shopify/queries/sitemap.ts
export async function getSitemapEntries(): Promise<SitemapEntries>   // paginates 250 at a time; tags ['collections','products']; revalidate 3600

// lib/shopify/queries/collection.ts (change) — filters now typed
getCollectionProducts({ handle, first?, after?, filters?: ProductFilter[]; sort?: CollectionSort })

// app/(storefront)/_actions/catalog.ts ('use server')
export async function loadMoreCollectionProducts(input: { handle: string; after: string; filters: ProductFilter[]; sort?: CollectionSort }): Promise<{ products: ProductCardData[]; pageInfo: CollectionPage['pageInfo'] }>
export async function loadMoreSearchResults(input: { q: string; after: string; filters: ProductFilter[]; sort?: SearchSort }): Promise<{ products: ProductCardData[]; pageInfo: SearchPage['pageInfo'] }>
export async function predictiveSearchAction(q: string): Promise<SearchSuggestion>
// app/(storefront)/_actions/newsletter.ts ('use server')
export type NewsletterState = { status: 'idle' | 'success' | 'error'; message: string }
export async function subscribeNewsletterAction(prev: NewsletterState, formData: FormData): Promise<NewsletterState>
// calls subscribeToNewsletter from '@/lib/newsletter/subscribers' with { email, source: 'storefront-footer' }; honeypot field `company` → success without persisting; zod email check

// lib/storefront/plp-params.ts (pure)
export type PlpParams = { sort: CollectionSort; after: string | null; filters: ProductFilter[]; active: ActiveFilter[]; q?: string }
export function parsePlpParams(sp: SearchParamsLike, opts?: { defaultSort?: CollectionSort }): PlpParams
export function buildPlpHref(pathname: string, sp: URLSearchParams, patch: { sort?: CollectionSort | null; toggle?: ActiveFilter; clear?: boolean }): string
export const SORT_OPTIONS: { value: CollectionSort; label: string }[]  // Best selling, Newest, Price low→high, Price high→low, A–Z

// lib/storefront/variants.ts (pure)
export function selectVariant(product: ProductDetail, sp: SearchParamsLike): { selected: ProductVariant | null; selectedOptions: Record<string, string>; complete: boolean }
// defaults: no params → first availableForSale variant (else first variant); partial params → fill remaining options from the first variant matching the given ones
export function variantHref(pathname: string, selectedOptions: Record<string, string>, change: { name: string; value: string }): string
export function optionValueAvailability(product: ProductDetail, selectedOptions: Record<string,string>, optionName: string, value: string): 'available' | 'soldout' | 'unavailable'

// lib/storefront/seo.ts (pure)
export function siteUrl(path?: string): string             // NEXT_PUBLIC_BASE_URL ?? 'https://headoverfeels.com'
export function productJsonLd(p: ProductDetail, selected: ProductVariant | null): object
export function breadcrumbJsonLd(items: { name: string; url: string }[]): object
export function collectionJsonLd(c: CollectionSummary, products: ProductCardData[]): object
export function organizationJsonLd(): object
export function jsonLdScriptProps(schema: object): { type: 'application/ld+json'; dangerouslySetInnerHTML: { __html: string } }  // escapes `<`

// lib/storefront/home-data.ts (server)
export type HomeData = { featuredCollections: CollectionSummary[]; newIn: ProductCardData[]; bestSellers: ProductCardData[]; drops: ProductCardData[] }
export async function getHomeData(): Promise<HomeData>
// featuredCollections = getCollections() filtered featured (fallback: first 3 non-`all`/`frontpage`); newIn = getCollectionProducts({handle:'all', sort:'newest', first:8}); bestSellers = collection 'best-sellers' (fallback: 'all' sort best-selling); drops = collection 'drops' first 4 (or []). Uses Promise.all; a missing collection → []; a ShopifyError propagates.
```

Storefront GraphQL added in Phase 2 (validated against 2026-07 on 2026-09-06):

```graphql
query SearchProducts($q: String!, $first: Int!, $after: String, $filters: [ProductFilter!], $sortKey: SearchSortKeys, $reverse: Boolean) {
  search(query: $q, first: $first, after: $after, productFilters: $filters, sortKey: $sortKey, reverse: $reverse, types: [PRODUCT], unavailableProducts: LAST) {
    totalCount
    productFilters { id label type values { id label count input } }
    pageInfo { hasNextPage endCursor }
    nodes { ... on Product { ...ProductCardFields } }
  }
}
query SitemapProducts($first: Int!, $after: String) { products(first: $first, after: $after, sortKey: UPDATED_AT) { pageInfo { hasNextPage endCursor } nodes { handle updatedAt } } }
query SitemapCollections($first: Int!, $after: String) { collections(first: $first, after: $after) { pageInfo { hasNextPage endCursor } nodes { handle updatedAt } } }
query Collections($first: Int!) { collections(first: $first, sortKey: TITLE) { nodes { id handle title description image { ...ImageFields } featured: metafield(namespace: "custom", key: "featured") { value } } } }
```

Route map after Phase 2 (all under `app/(storefront)/`, inside `StorefrontShell`):

| Route | File | Data | Notes |
|---|---|---|---|
| `/` | `page.tsx` | `getHomeData()` | `revalidate = 300`; Hero (static asset), Marquee (drop live? "Drop live — shop now" : "Free US shipping over $75 · Earn Care Points on every order"), CollectionTiles (3), ProductRail New in, DropSpotlight (only when `drops.length`), ProductRail Best sellers, Editorial, NewsletterSection |
| `/collections` | `collections/page.tsx` | `getCollections()` | tiles grid, skips `frontpage`; no product counts (Storefront API has none) |
| `/collections/[handle]` | `collections/[handle]/page.tsx` | `getCollectionProducts` | header, FilterRail (desktop aside / mobile Drawer), SortSelect, ActiveFilters, ProductGrid, LoadMore island |
| `/products` | `products/page.tsx` | — | `redirect('/collections/all')` (permanent handled in `next.config` too) |
| `/products/[handle]` | `products/[handle]/page.tsx` | `getProduct` + `getRecommendations` | PDP; `generateMetadata` from `seo`/title/description/first image; JSON-LD |
| `/drops` | `drops/page.tsx` | `getCollectionProducts({handle:'drops'})` | grid of drop products with `drop` badge; empty state "No drops scheduled" |
| `/drops/[handle]` | `drops/[handle]/page.tsx` | — | re-exports the PDP page component (same UI; Phase 5 adds the countdown state machine) |
| `/search` | `search/page.tsx` | `getSearchResults` | `?q=`; same toolbar/filters/grid as PLP; empty query → prompt; `totalCount` |
| `/policies/[handle]` | `policies/[handle]/page.tsx` | `getPolicy` | `Prose html`; `generateStaticParams` for the four handles; `notFound()` otherwise |

Redirects added to `next.config.ts` (permanent): `/privacy` → `/policies/privacy-policy`, `/terms` → `/policies/terms-of-service`, `/products` → `/collections/all` (also handled by the page), `/collections/drops` stays a real collection (no redirect).

---

## Legacy surface (from the 2026-09-06 audit)

- Legacy pages render `components/layout/Navigation` themselves; the root layout has no chrome. Thirteen account/checkout/marketing pages keep using it after Phase 2 (two headers until Phases 3–6). Do not touch `Navigation`.
- `app/providers.tsx` (SessionProvider, AuthProvider, Toaster, PopupManager, CookieConsent) still wraps `(storefront)`. Leave it (Phase 6).
- `middleware.ts` matches `/admin*` only. Nothing to change.
- `app/sitemap.ts` is Prisma-slug based and untested → rewritten in T4 on `getSitemapEntries()`.
- `/api/newsletter` POST expects JSON `{ email, source?, honeypot? }` and returns JSON; the Phase 1 footer's plain form POST would show raw JSON → replaced by the `NewsletterForm` island + server action (T3).
- `/search` and `/drops` (list) never existed; five legacy links point at `/drops` today.

---

## Task 1: Filters, rich text, env guard, types

**Files:** `lib/shopify/filters.ts`, `lib/shopify/rich-text.ts`, `lib/shopify/env.ts`, `lib/shopify/types.ts`, `tests/unit/shopify/filters.test.ts`, `tests/unit/shopify/rich-text.test.ts`, `tests/unit/shopify/env.test.ts` (extend)

- [ ] Failing tests: param scheme round-trips for every `ProductFilter` kind; `filterValueToActive` on real `FilterValue.input` strings (`{"available":true}`, `{"variantOption":{"name":"Size","value":"M"}}`, `{"price":{"min":10,"max":50}}`, `{"productType":"Hoodies"}`, `{"tag":"drop"}`, `{"productMetafield":{...}}`); `toggleFilterParam` adds, removes, and drops `after`; `richTextToHtml` on a nested doc with bold/italic/link/list → exact HTML, escapes `<script>`; `hasShopifyEnv()` false when blank, true when set (no throw).
- [ ] Implement. `types.ts` changes are additive except `CollectionSummary` (new fields) — fix `normalizeCollections` callers compile (T2 owns the query; add the fields with defaults in the type only if T2 is not done, and coordinate via the orchestrator). Green, typecheck, lint.

## Task 2: Search results, sitemap, featured collections queries + fixtures

**Files:** `lib/shopify/queries/search.ts`, `lib/shopify/queries/sitemap.ts`, `lib/shopify/queries/collections.ts`, `lib/shopify/queries/collection.ts` (typed `filters`), `lib/shopify/queries/index.ts`, `scripts/shopify/lib/fixture-queries.ts` (append), fixtures `search-results.json`, `sitemap-products.json`, `sitemap-collections.json`, `collections.json` (add `description`, `featured`), `tests/unit/shopify/search-query.test.ts` (extend), `tests/unit/shopify/sitemap-query.test.ts`, `tests/unit/shopify/collection-query.test.ts` (extend), `tests/fixtures/shopify/README.md`

- [ ] Failing tests: `normalizeSearchPage` maps `productFilters` → `filters`, nodes → cards, `totalCount`; `getSearchResults` passes `{ q, first, after, filters, sortKey, reverse }` with tags `['search']`, `revalidate: false`, and short-circuits empty `q`; `toSearchSortArgs`; `getSitemapEntries` follows `hasNextPage` (mock two pages); `normalizeCollections` sets `featured` from `"true"` and `description`.
- [ ] Implement with the validated documents above. Green, typecheck, lint.

## Task 3: Server actions, SearchDialog, NewsletterForm, CatalogUnavailable, shell fixes

**Files:** `app/(storefront)/_actions/catalog.ts`, `app/(storefront)/_actions/newsletter.ts`, `components/storefront/search/SearchDialog.tsx`, `components/storefront/newsletter/NewsletterForm.tsx`, `components/storefront/CatalogUnavailable.tsx`, `components/storefront/layout/Header.tsx`, `Footer.tsx`, `StorefrontShell.tsx`, `tests/unit/storefront/search-dialog.test.tsx`, `tests/unit/storefront/newsletter-form.test.tsx`, `tests/unit/storefront/header.test.tsx` + `footer.test.tsx` (extend), `tests/unit/storefront/actions.test.ts`

- [ ] Failing tests: `SearchDialog` (props `open`, `onOpenChange`) renders a `role="dialog"` with a labelled search input, debounces 200ms, calls the injected `search` fn (prop `searchFn` defaulting to the server action) for ≥ 2 chars, lists product results as links to `/products/<handle>` and collections to `/collections/<handle>`, Enter submits to `/search?q=` via `next/navigation` router (mock), Escape closes; `NewsletterForm` uses `useActionState` with the action injected via prop (default = server action), shows success/error message in `role="status"`/`role="alert"`, has a visually-hidden honeypot named `company`; Header's Search button opens the dialog (`aria-haspopup="dialog"`); Footer renders `NewsletterForm`; `FALLBACK_LAYOUT` menu = Shop `/collections/all`, Collections `/collections`, Drops `/drops`, Loyalty `/loyalty`, About `/about`; actions: `subscribeNewsletterAction` validates email, honeypot short-circuits, maps `subscribeToNewsletter` outcomes to messages (mock `@/lib/newsletter/subscribers`); `loadMoreCollectionProducts` delegates to `getCollectionProducts` with `after` (mock).
- [ ] Implement. Green, typecheck, lint, header/footer suites still green.

## Task 4: Legacy removal, redirects, boundaries, metadata, sitemap

**Files:** deletions listed in File structure; `next.config.ts`; `app/(storefront)/layout.tsx`; `app/(storefront)/error.tsx`, `not-found.tsx`, `loading.tsx`; `app/sitemap.ts`; `tests/unit/storefront/sitemap.test.ts`, `tests/unit/storefront/redirects.test.ts`

- [ ] Delete the legacy routes and tests listed; apply the grep rule to `components/home/**`, `lib/home/**`, `components/products/ProductsClientView.tsx`, `components/drops/DropHeroSection.tsx`, `lib/seo/**`; report anything kept.
- [ ] `next.config.ts` redirects (see route map). `app/(storefront)/layout.tsx`: `export const metadata = { title: { default: 'Head Over Feels', template: '%s · Head Over Feels' }, description: ..., metadataBase: new URL(siteUrl()) }` (import from `lib/storefront/seo` — T7 creates it; if absent, inline `NEXT_PUBLIC_BASE_URL` fallback and say so). `error.tsx` (client; Section + Display "Something went wrong" + Button reset), `not-found.tsx` (Section + links to `/collections/all`), `loading.tsx` (ProductGrid loading=true inside Section).
- [ ] `app/sitemap.ts`: static routes (`/`, `/collections`, `/collections/all`, `/drops`, `/search`? no — exclude search, `/about`, `/contact`, `/loyalty`), policies (4 handles), then `getSitemapEntries()` products → `/products/<handle>` (lastModified updatedAt), collections → `/collections/<handle>`; when `!hasShopifyEnv()` return statics only; wrap in try/catch → statics only + `console.warn`. Test with mocked queries.
- [ ] Full unit suite green (deleted tests gone, nothing else broke), typecheck, lint, admin subset green.

## Task 5: Home page

**Files:** `app/(storefront)/page.tsx`, `lib/storefront/home-data.ts`, `components/storefront/home/{Hero,CollectionTiles,ProductRail,DropSpotlight,Editorial,NewsletterSection}.tsx`, `tests/unit/storefront/home.test.tsx`, `tests/unit/storefront/home-data.test.ts`

- [ ] Failing tests: `getHomeData` composes the four fetches (mock queries; missing `best-sellers` → falls back to `all` best-selling; missing `drops` → `[]`; featured filter + fallback); `Hero` renders eyebrow, `Display` headline with a `text-signal` word, one `signal` CTA to `/collections/all`, `next/image` hero from `/assets/...` (pick an existing hero asset in `public/assets`, `priority`); `CollectionTiles` renders ≤ 3 tiles linking `/collections/<handle>`; `ProductRail` title + "Shop all" link + horizontal scroll list of `ProductCard`s with `snap-x`; `DropSpotlight` renders only with products; page renders `CatalogUnavailable` when unconfigured (mock `hasShopifyEnv`).
- [ ] Implement per spec §5.4 row `/`. `revalidate = 300`. Green.

## Task 6: Collections index, PLP, `/products`, `/drops`

**Files:** `app/(storefront)/collections/page.tsx`, `collections/[handle]/page.tsx`, `products/page.tsx`, `drops/page.tsx`, `components/storefront/collection/*`, `lib/storefront/plp-params.ts`, `tests/unit/storefront/plp-params.test.ts`, `tests/unit/storefront/plp.test.tsx`, `tests/unit/storefront/collections-index.test.tsx`

- [ ] Failing tests: `parsePlpParams` (sort default `best-selling`, invalid → default, filters via `parseFilterParams`, `after`); `buildPlpHref` toggles/clears and drops `after`; `FilterRail` renders one `FilterGroup` per `Filter` (LIST → checkbox links; PRICE_RANGE → min/max inputs in a `<form method="get">` preserving other params; BOOLEAN → single toggle), active state from URL, counts, links built with `buildPlpHref`; `ActiveFilters` chips with remove links + "Clear all"; `SortSelect` native select that navigates on change (client, `useRouter`) and is a `<noscript>`-friendly form; `LoadMore` (client) calls the injected loader with `after` and appends cards, hides when `hasNextPage` false, `aria-busy` while pending; PLP page: unknown handle → `notFound()`, unconfigured → `CatalogUnavailable`, header shows title + `descriptionHtml` via `Prose`; `/collections` lists tiles minus `frontpage`; `/drops` renders `drop`-badged grid + empty state; `/products` redirects.
- [ ] Implement. PLP layout: `Section` → `CollectionHeader` → `PlpToolbar` (result count when known, SortSelect, mobile "Filters" button opening a `Drawer` with the same `FilterRail`) → grid `lg:grid-cols-[16rem_1fr]` with `<aside>` FilterRail + `ProductGrid` + `LoadMore`. `generateMetadata` from collection title/description. Green.

## Task 7: PDP (+ `/drops/[handle]`)

**Files:** `app/(storefront)/products/[handle]/page.tsx`, `app/(storefront)/drops/[handle]/page.tsx`, `components/storefront/pdp/*`, `lib/storefront/variants.ts`, `lib/storefront/seo.ts`, `tests/unit/storefront/variants.test.ts`, `tests/unit/storefront/seo.test.ts`, `tests/unit/storefront/pdp.test.tsx`

- [ ] Failing tests: `selectVariant` defaults/partials/complete; `optionValueAvailability` (sold-out vs unavailable combination); `variantHref` keeps other options; `productJsonLd` (Product + Offer with price/availability/url/sku/image), `breadcrumbJsonLd`, `jsonLdScriptProps` escapes `</script>`; `Gallery` renders thumb rail (buttons with `aria-pressed`) + main `next/image` + zoom button opening a `Dialog` with the large image; `VariantSelector` renders colour swatches (from `option.values[].swatchColor` / variant `colorHex`) as links (`variantHref`) with `aria-current`, size chips with `line-through` + `aria-disabled` for `soldout`; `AddToCartPanel` shows `Price` for the selected variant, `QuantityStepper`, an `AddToCartButton` that is **disabled with `data-phase="3"` and label "Add to cart"** (Phase 3 wires the action; keep the prop `action?: (fd: FormData) => void`), and "Sold out" state; `DetailsAccordion` items: Description (`descriptionHtml`), Materials/Care (from `richTextToHtml`, omitted when null), Shipping & returns (links to `/policies/shipping-policy`, `/policies/refund-policy`); `StickyBuyBar` (mobile, `md:hidden`, price + button); `RecommendationsRail` "Complete the look" ≤ 4 cards; page: `notFound()` on null, unconfigured → `CatalogUnavailable`, `generateMetadata` uses `seo.title ?? title`, `seo.description ?? stripped description`, OG image = first image, canonical `siteUrl('/products/<handle>')`; drop products show `Badge drop` + the drop window text when `drop` is present (state machine is Phase 5).
- [ ] Implement per spec §5.4 row `/products/[handle]`. Layout `lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-16`, buy box `lg:sticky lg:top-24`. `drops/[handle]/page.tsx` re-exports `default` and `generateMetadata` from the products page. Green.

## Task 8: Search page, policies pages, e2e replacement, preview removal

**Files:** `app/(storefront)/search/page.tsx`, `app/(storefront)/policies/[handle]/page.tsx`, `components/storefront/search/SearchResults.tsx`, `tests/unit/storefront/search-page.test.tsx`, `tests/unit/storefront/policies-page.test.tsx`, `tests/e2e/storefront-catalog.spec.ts` (replaces `storefront-shell.spec.ts`), `tests/e2e/playwright.config.ts`, `.github/workflows/ci.yml`, delete `app/(storefront)/storefront-preview/**`

- [ ] Failing tests: search page with empty `q` renders a prompt + no fetch; with `q` renders "N results for “q”", FilterRail/Sort from T6's components (import them; if T6 is not finished when you run, mock the module and note it), `ProductGrid`, `LoadMore` with `loadMoreSearchResults`; `robots: noindex` in metadata; policies page: known handle renders `Display` title + `Prose html`, unknown → `notFound()`, `generateStaticParams` returns the four handles, unconfigured → `CatalogUnavailable`.
- [ ] e2e spec (`/`, `/collections/all`, `/products/<first card handle>` when cards exist, `/search?q=hoodie`, `/policies/privacy-policy`, `/drops`): each returns 200 with header/footer, no console errors (same allow-list as Phase 1), and either real content or the `data-catalog="unconfigured"` notice; mobile project: open menu drawer; header search button opens the dialog and typing navigates on Enter. Config: `webServer.url` → `http://localhost:3000/`, remove `STOREFRONT_PREVIEW` from config and CI. Delete the preview route and its islands.
- [ ] Green, typecheck, lint, `npx playwright test --list`.

## Task 9: Verification + QA report (orchestrator)

- [ ] `npm run test:run`, `npx tsc --noEmit`, `npx eslint` on storefront paths, `npm run test:e2e`, `npx next build` (compile + TypeScript stages; prerender needs the Vercel env), admin subset.
- [ ] Write `2026-09-06-storefront-rebuild-phase2-qa.md` (results tables, deviations, human checklist: preview URL walkthrough once tokens + catalog exist; Vercel Preview `STRIPE_SECRET_KEY`; confirm `/about` + `/contact` legacy pages are acceptable until Phase 5).

---

## Definition of done (Phase 2)

- `/`, `/collections`, `/collections/[handle]` (filters, sort, load more), `/products` → `/collections/all`, `/products/[handle]`, `/drops`, `/drops/[handle]`, `/search`, `/policies/[handle]` all render inside `StorefrontShell`, return 200 unconfigured, and render Shopify data when configured.
- Header search and footer newsletter work end-to-end (dialog → `/search`; form → `subscribeToNewsletter`).
- Legacy route files for those paths and their dead dependents are gone; nothing else imports them; full unit suite, typecheck, lint green; admin unchanged.
- Sitemap and metadata are Shopify-handle based; redirects for `/privacy`, `/terms`, `/products`.
- Phase 3 (cart) can start from `AddToCartPanel`'s `action` prop and the `cartCount` prop on `StorefrontShell` without touching page structure.
