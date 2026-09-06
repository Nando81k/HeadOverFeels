# Storefront Rebuild — Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up everything the new Shopify-backed storefront is built on: the Shopify store prerequisites and metafield schema, a repeatable Prisma → Shopify catalog migration, a typed server-side Storefront API client with recorded fixtures, the new design tokens and UI primitives in their own namespace, and the header/footer shell — all merged to the `storefront-v2` integration branch with a Vercel preview, without touching admin V2.

**Architecture:** New namespaces only: `lib/shopify/**`, `components/storefront/**`, `styles/storefront/**`, `scripts/shopify/**`, `tests/unit/shopify/**`, `tests/unit/storefront/**`, `tests/fixtures/shopify/**`. The one shared file that changes is `app/globals.css`, which is split into `styles/admin/tokens.css` + `styles/storefront/tokens.css` + `styles/storefront/base.css` with no change to any admin utility class name. No legacy storefront page is replaced in this phase; Phase 2 starts replacing routes.

**Tech stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4 (`@theme`), `@shopify/storefront-api-client` 2026.4.x, `@shopify/admin-api-client` (scripts only), `next/font/google` (Archivo, Inter), class-variance-authority, `@radix-ui/react-slot`, Vitest 4 + @testing-library/react + jsdom, Playwright 1.63 (Chromium preinstalled at `/opt/pw-browsers/chromium`).

**Design spec:** `docs/superpowers/specs/2026-09-06-storefront-rebuild-shopify-design.md`

---

## Cross-cutting agent notes (read once, applies to every task)

1. **This repo uses npm, NOT pnpm.** `npx vitest run <path>` for one test file, `npx tsc --noEmit` for typecheck, `npx eslint <paths>` for lint. Worktrees have no `node_modules` — symlink it: `ln -s <repo-root>/node_modules node_modules`.
2. **Do not import from `components/ui/*` or `lib/store/*` in storefront code.** Those belong to admin/legacy. Storefront primitives live in `components/storefront/ui/*` and are the only UI imports allowed under `components/storefront` and (from Phase 2) `app/(storefront)`.
3. **No hex colours in storefront code.** Only `styles/storefront/tokens.css` may contain `#rrggbb`. Use Tailwind utilities generated from tokens (`bg-bone`, `text-ink`, `bg-signal`, `border-line`).
4. **Server-only Shopify access.** `lib/shopify/client.ts` imports `server-only`. The private token never reaches a client component. Client components receive already-normalised plain objects.
5. **Normalise at the boundary.** Every query module exports `QUERY` (string), a `Raw*` type mirroring the GraphQL shape, and a `normalize*()` that returns the storefront domain type from `lib/shopify/types.ts`. Components never see `edges`/`nodes`.
6. **Fixtures are recorded, not invented.** `tests/fixtures/shopify/*.json` are produced by `scripts/shopify/record-fixtures.ts` against the trial store after Task 4 seeds it. Tests import the JSON; if a query changes, re-record.
7. **Admin tests must stay green in every wave.** Run `npx vitest run tests/unit/admin-*.test.ts* tests/unit/fulfillment-*.test.ts*` before opening a PR that touches `app/globals.css` or `app/layout.tsx`. The 7 files listed in `plans/2026-05-30-admin-rebuild-phase1-qa.md` are known-red before this phase; do not fix or delete them.
8. **Vitest 4 generics:** one-arg `vi.fn<T>()`. `global.fetch` is already a `vi.fn()` from `tests/setup.ts`; reset it with `vi.mocked(fetch).mockReset()` in `beforeEach`.
9. **Environment for scripts:** scripts read `.env.shopify` (git-ignored, see Task 1) via `dotenv`. Never print tokens. `--dry-run` is the default; `--apply` is required to mutate.
10. **Branching:** the designated session branch `claude/site-rebuild-shopify-c6zuz3` (PR #228) is the Phase 1 integration branch (the session may not push elsewhere); waves are committed to it directly. Nothing merges to `main` in this phase.
11. **Trial store reminder:** the store cannot accept payments until upgraded. Nothing in Phase 1 needs payments.

---

## Wave summary

| Wave | Tasks | Parallel? | Model | Depends on |
|------|-------|-----------|-------|------------|
| W0 | 0 (human) | — | — | none |
| W1 | 1, 2 | 2 parallel | sonnet | W0 done |
| W2 | 3, 4 | sequential (3 then 4) | sonnet | W1 merged |
| W3 | 5, 6, 7 | 3 parallel | sonnet | W2 merged (fixtures exist) |
| W4 | 8, 9 | 2 parallel | sonnet | W1 merged |
| W5 | 10, 11, 12 | 3 parallel | sonnet | W4 merged |
| W6 | 13, 14 | 13 then 14 | sonnet | W3 + W5 merged |
| W7 | 15 | sequential | **opus** | W6 merged |

Total: **16 tasks** (one human) across **8 waves**. All tasks in a wave create disjoint files (see File Structure).

---

## File structure

**Created**
- `.env.shopify.example` (T1)
- `lib/shopify/env.ts` — validated env accessor (T1)
- `lib/shopify/admin-client.ts` — Admin API client for scripts + server (T1)
- `lib/shopify/client.ts` — `storefrontFetch` (T2)
- `lib/shopify/errors.ts` (T2)
- `lib/shopify/types.ts` — domain types (T2)
- `scripts/shopify/setup-metafields.ts` (T3)
- `scripts/shopify/lib/metafield-definitions.ts` (T3)
- `scripts/shopify/migrate-catalog.ts` (T4)
- `scripts/shopify/lib/build-product-set-input.ts` (T4)
- `scripts/shopify/lib/poll-product-operation.ts` (T4)
- `scripts/shopify/record-fixtures.ts` (T4)
- `tests/fixtures/shopify/*.json` (T4 output)
- `lib/shopify/queries/fragments.ts` (T5)
- `lib/shopify/queries/product.ts` (T5)
- `lib/shopify/queries/collection.ts` (T6)
- `lib/shopify/queries/collections.ts` (T6)
- `lib/shopify/queries/shop.ts` (T7)
- `lib/shopify/queries/search.ts` (T7)
- `lib/shopify/queries/recommendations.ts` (T7)
- `styles/storefront/tokens.css` (T8)
- `styles/storefront/base.css` (T8)
- `styles/admin/tokens.css` (T8, moved from globals)
- `lib/storefront/fonts.ts` (T8)
- `lib/storefront/cn.ts` (T9)
- `lib/storefront/money.ts` (T9)
- `components/storefront/ui/Button.tsx`, `IconButton.tsx`, `Badge.tsx`, `Price.tsx` (T9)
- `components/storefront/ui/Typography.tsx` (Eyebrow, Display, Prose), `Container.tsx`, `Section.tsx` (T10)
- `components/storefront/ui/Input.tsx`, `Select.tsx`, `Checkbox.tsx`, `QuantityStepper.tsx`, `Skeleton.tsx` (T11)
- `components/storefront/ui/Drawer.tsx`, `Dialog.tsx`, `Accordion.tsx`, `AnnouncementBar.tsx`, `Marquee.tsx` (T12)
- `components/storefront/product/ProductCard.tsx`, `ProductGrid.tsx`, `SwatchDots.tsx` (T13)
- `components/storefront/layout/Header.tsx`, `HeaderNav.tsx`, `MobileMenu.tsx`, `Footer.tsx`, `StorefrontShell.tsx` (T14)
- `app/(storefront)/_preview/page.tsx` — temporary kitchen-sink route for QA, deleted in Phase 2 (T14)
- `app/(storefront)/layout.tsx` (T14)
- `tests/e2e/playwright.config.ts`, `tests/e2e/storefront-shell.spec.ts` (T15)
- `tests/unit/shopify/*.test.ts`, `tests/unit/storefront/*.test.tsx` (per task)

**Modified**
- `package.json` (T1: deps; T15: `test:e2e` script)
- `.gitignore` (T1: `.env.shopify`, `scripts/shopify/out/`)
- `app/globals.css` (T8: becomes three `@import`s)
- `app/layout.tsx` (T8: font variables swap; T14: no other change)
- `eslint.config.mjs` (T9: no-hex rule scoped to storefront paths)
- `.github/workflows/ci.yml` (T15: non-blocking e2e job)

---

## Shared contracts (source of truth for types)

```ts
// lib/shopify/types.ts
export type Money = { amount: string; currencyCode: string }           // amount stays a decimal string
export type ShopImage = { url: string; altText: string | null; width: number | null; height: number | null }

export type ProductCardData = {
  id: string; handle: string; title: string
  availableForSale: boolean
  image: ShopImage | null
  hoverImage: ShopImage | null
  price: Money; compareAtPrice: Money | null   // compareAt only when > price
  swatches: { name: string; color: string | null }[]   // from Color option swatch or custom.color_hex
  badges: ('sale' | 'drop' | 'new' | 'soldout')[]
}

export type ProductOption = { id: string; name: string; values: { id: string; name: string; swatchColor: string | null }[] }
export type ProductVariant = {
  id: string; title: string; sku: string | null; availableForSale: boolean; quantityAvailable: number | null
  price: Money; compareAtPrice: Money | null
  selectedOptions: { name: string; value: string }[]
  image: ShopImage | null; colorHex: string | null
}
export type ProductDetail = ProductCardData & {
  descriptionHtml: string; vendor: string; productType: string; tags: string[]
  seo: { title: string | null; description: string | null }
  images: ShopImage[]; options: ProductOption[]; variants: ProductVariant[]
  materials: string | null; careGuide: string | null            // rich_text JSON → HTML via lib/shopify/rich-text.ts (Phase 2)
  drop: { start: string | null; end: string | null; maxPerOrder: number | null } | null   // null unless tags includes 'drop'
}

export type CollectionSummary = { id: string; handle: string; title: string; image: ShopImage | null; productCount?: number }
export type FilterValue = { id: string; label: string; count: number; input: string }
export type Filter = { id: string; label: string; type: 'LIST' | 'PRICE_RANGE' | 'BOOLEAN'; values: FilterValue[] }
export type CollectionPage = {
  collection: CollectionSummary & { descriptionHtml: string }
  products: ProductCardData[]; filters: Filter[]
  pageInfo: { hasNextPage: boolean; endCursor: string | null }
}

export type MenuItem = { id: string; title: string; url: string; items: MenuItem[] }   // url rewritten to relative path
export type ShopLayoutData = {
  name: string; description: string | null
  menu: MenuItem[]
  policies: { handle: string; title: string }[]
}
export type Policy = { handle: string; title: string; body: string }

export type SearchSuggestion = { products: ProductCardData[]; collections: CollectionSummary[] }
```

```ts
// lib/shopify/client.ts
export type StorefrontFetchOptions = { variables?: Record<string, unknown>; tags?: string[]; revalidate?: number | false; buyerIp?: string }
export async function storefrontFetch<T>(query: string, opts?: StorefrontFetchOptions): Promise<T>
// throws ShopifyError { status, graphqlErrors } — never returns partial data silently
```

Cache tags convention: `shop`, `menu`, `collections`, `collection:<handle>`, `product:<handle>`, `search` (no-store), `cart` (no-store). Default `revalidate` 300s for catalog, `false` for cart/search.

Storefront queries (validated against Storefront API 2026-07 on 2026-09-06; re-validated during execution — the PDP `images(first: 12)` had to be aliased `gallery`):

```graphql
# lib/shopify/queries/fragments.ts
fragment ImageFields on Image { url altText width height }
fragment MoneyFields on MoneyV2 { amount currencyCode }
fragment ProductCardFields on Product {
  id handle title availableForSale tags
  featuredImage { ...ImageFields }
  images(first: 2) { nodes { ...ImageFields } }
  priceRange { minVariantPrice { ...MoneyFields } }
  compareAtPriceRange { minVariantPrice { ...MoneyFields } }
  options { name optionValues { name swatch { color } } }
}
```

```graphql
# lib/shopify/queries/product.ts
query ProductByHandle($handle: String!) {
  product(handle: $handle) {
    ...ProductCardFields
    descriptionHtml vendor productType
    seo { title description }
    gallery: images(first: 12) { nodes { ...ImageFields } }   # aliased: conflicts with ProductCardFields.images(first: 2)
    options { id name optionValues { id name swatch { color } } }
    variants(first: 100) { nodes {
      id title sku availableForSale quantityAvailable
      price { ...MoneyFields } compareAtPrice { ...MoneyFields }
      selectedOptions { name value } image { ...ImageFields }
      colorHex: metafield(namespace: "custom", key: "color_hex") { value }
    } }
    materials: metafield(namespace: "custom", key: "materials") { value type }
    careGuide: metafield(namespace: "custom", key: "care_guide") { value type }
    dropStart: metafield(namespace: "custom", key: "drop_start") { value }
    dropEnd: metafield(namespace: "custom", key: "drop_end") { value }
    maxPerOrder: metafield(namespace: "custom", key: "max_per_order") { value }
  }
}
```

```graphql
# lib/shopify/queries/collection.ts
query CollectionProducts($handle: String!, $first: Int!, $after: String, $filters: [ProductFilter!], $sortKey: ProductCollectionSortKeys, $reverse: Boolean) {
  collection(handle: $handle) {
    id handle title descriptionHtml image { ...ImageFields }
    products(first: $first, after: $after, filters: $filters, sortKey: $sortKey, reverse: $reverse) {
      filters { id label type values { id label count input } }
      pageInfo { hasNextPage endCursor }
      nodes { ...ProductCardFields }
    }
  }
}
# lib/shopify/queries/collections.ts
query Collections($first: Int!) { collections(first: $first, sortKey: TITLE) { nodes { id handle title image { ...ImageFields } } } }
```

```graphql
# lib/shopify/queries/shop.ts
query ShopLayout {
  shop { name description primaryDomain { url }
    privacyPolicy { handle title } termsOfService { handle title } refundPolicy { handle title } shippingPolicy { handle title } }
  menu(handle: "main-menu") { items { id title url type resourceId items { id title url type resourceId } } }
}
query Policies { shop {
  privacyPolicy { handle title body } termsOfService { handle title body }
  refundPolicy { handle title body } shippingPolicy { handle title body } } }
```

```graphql
# lib/shopify/queries/search.ts
query PredictiveSearch($q: String!) {
  predictiveSearch(query: $q, limit: 6, types: [PRODUCT, COLLECTION]) {
    products { ...ProductCardFields } collections { id handle title }
  }
}
# lib/shopify/queries/recommendations.ts
query Recommendations($handle: String!) {
  productRecommendations(productHandle: $handle, intent: COMPLEMENTARY) { ...ProductCardFields }
}
```

Cart mutations are Phase 3; note for then: `cartDiscountCodesUpdate($codes: [String!]!)` — the argument is non-null (validation caught `[String!]`).

Metafield definitions (Task 3), all namespace `custom`, owner type in brackets:

| key | type | owner | pins |
|---|---|---|---|
| `materials` | `rich_text_field` | PRODUCT | Storefront access: `PUBLIC_READ` |
| `care_guide` | `rich_text_field` | PRODUCT | `PUBLIC_READ` |
| `drop_start` | `date_time` | PRODUCT | `PUBLIC_READ` |
| `drop_end` | `date_time` | PRODUCT | `PUBLIC_READ` |
| `max_per_order` | `number_integer` | PRODUCT | `PUBLIC_READ` |
| `featured` | `boolean` | COLLECTION | `PUBLIC_READ` |
| `color_hex` | `color` | PRODUCTVARIANT | `PUBLIC_READ` |

`MetafieldDefinitionInput.access.storefront = PUBLIC_READ` is what makes them readable through the Storefront API; without it every `metafield(...)` above returns `null`.

---

## Task 0 (HUMAN): Shopify store prerequisites

**Owner:** Nando. Blocks W1. Nothing here has an API.

- [ ] Shopify admin → Sales channels → add **Headless** → Add storefront → rename "Head Over Feels web". Copy **public** and **private** Storefront access tokens. Under Manage API access → Storefront API → enable: unauthenticated read product listings, product inventory, product tags, product pickup locations, collection listings, customer tags, content (menus/policies), checkouts/carts read+write, selling plans.
- [ ] Settings → Apps and sales channels → Develop apps → create app "HOF Ops" with Admin API scopes: `read_products write_products read_publications write_publications read_inventory write_inventory read_locations read_discounts write_discounts read_customers write_customers read_orders read_metaobject_definitions write_metaobject_definitions read_online_store_navigation write_online_store_navigation`. Install and copy the Admin access token.
- [ ] Settings → Locations: confirm the primary location. Settings → Shipping: one general profile (rates can be placeholders). Settings → Taxes: US automatic.
- [x] Online Store → Navigation: create menu **Main menu** (handle `main-menu`) with items Shop (`/collections/all`), Collections (`/collections`), Drops (`/collections/drops`), Loyalty (`/loyalty`), About (`/pages/about`). Placeholder collection links are fine; Task 4 creates the real ones. *Done 2026-09-06 via Admin API `menuUpdate` on `gid://shopify/Menu/269016891617`.*
- [ ] Settings → Policies: paste current Privacy and Terms; add Refund and Shipping.
- [ ] Rename store from "My Store" to "Head Over Feels" (Settings → General).
- [ ] Put the tokens in a local `.env.shopify` per `.env.shopify.example` (Task 1). Never commit it.

---

## Task 1: Shopify env + Admin client + dependencies

**Files:** `package.json`, `.gitignore`, `.env.shopify.example`, `lib/shopify/env.ts`, `lib/shopify/admin-client.ts`, `tests/unit/shopify/env.test.ts`

- [ ] **Step 1: Install deps**
  ```bash
  npm i @shopify/storefront-api-client@^2026.4.3 @shopify/admin-api-client server-only
  npm i -D @playwright/test@^1.63.0
  ```
- [ ] **Step 2: Write the failing test** `tests/unit/shopify/env.test.ts`
  - `getShopifyEnv()` throws a message naming every missing variable when none are set.
  - Returns `{ storeDomain, apiVersion: '2026-07', privateToken, publicToken }` when set; `apiVersion` defaults to `2026-07` when `SHOPIFY_STOREFRONT_API_VERSION` is absent.
  - `getShopifyAdminEnv()` is separate and only requires `SHOPIFY_STORE_DOMAIN` + `SHOPIFY_ADMIN_ACCESS_TOKEN`.
- [ ] **Step 3: Run, see fail:** `npx vitest run tests/unit/shopify/env.test.ts`
- [ ] **Step 4: Implement** `lib/shopify/env.ts` with zod (already a dep) schemas; cache the parsed object per process; export `SHOPIFY_API_VERSION = '2026-07' as const`.
- [ ] **Step 5: Implement** `lib/shopify/admin-client.ts`: `import 'server-only'`; `createAdminApiClient({ storeDomain, apiVersion: SHOPIFY_API_VERSION, accessToken })`; export `adminRequest<T>(query, variables)` that throws on `errors` or non-empty `userErrors` passed in by caller helper `assertNoUserErrors(obj, path)`.
- [ ] **Step 6:** `.env.shopify.example` with the variables from spec §3 (empty values, one comment each). Add `.env.shopify` and `scripts/shopify/out/` to `.gitignore`.
- [ ] **Step 7:** Test green, `npx tsc --noEmit` clean, commit `feat(storefront-v2): add Shopify env + Admin client`.

## Task 2: Storefront fetch client

**Files:** `lib/shopify/client.ts`, `lib/shopify/errors.ts`, `lib/shopify/types.ts`, `tests/unit/shopify/client.test.ts`

- [ ] **Step 1: Failing tests** (mock `global.fetch`):
  - POSTs to `https://<domain>/api/2026-07/graphql.json` with headers `Shopify-Storefront-Private-Token`, `Content-Type: application/json`, and `Shopify-Storefront-Buyer-IP` when `buyerIp` given.
  - Passes `next: { tags, revalidate }` through to fetch (assert on the second argument).
  - Throws `ShopifyError` with `status` on non-2xx; with `graphqlErrors` when the body has `errors`; returns `data` otherwise.
  - Retries once on HTTP 430/429 after `Retry-After` (fake timers).
- [ ] **Step 2:** Run, fail. **Step 3:** Implement with plain `fetch` (not the SDK's fetch wrapper, so Next's cache options work); use `createStorefrontApiClient` only for `getHeaders()`/`getApiUrl()` helpers to stay aligned with Shopify's header names.
- [ ] **Step 4:** Add `lib/shopify/types.ts` exactly as in Shared contracts. **Step 5:** green, typecheck, commit.

## Task 3: Metafield definitions script

**Files:** `scripts/shopify/lib/metafield-definitions.ts`, `scripts/shopify/setup-metafields.ts`, `tests/unit/scripts/shopify-metafield-definitions.test.ts`

- [ ] **Step 1: Failing test:** `METAFIELD_DEFINITIONS` has the 7 rows from Shared contracts, every one with `access: { storefront: 'PUBLIC_READ' }`, `ownerType` in `PRODUCT | PRODUCTVARIANT | COLLECTION`, and `namespace: 'custom'`. `toDefinitionInput(row)` yields a valid `MetafieldDefinitionInput` shape (`name`, `namespace`, `key`, `type`, `ownerType`, `access`, `pin: true`).
- [ ] **Step 2:** Implement. Script: for each definition run `metafieldDefinitionCreate`; treat `userErrors.code === 'TAKEN'` as already-exists (idempotent); print a table. `--dry-run` prints only.
- [x] **Step 3:** Run for real: `npx tsx scripts/shopify/setup-metafields.ts --apply` (needs `.env.shopify`). Paste the output table in the PR. *Done 2026-09-06 through the Shopify Admin API (no `.env.shopify` yet): all 7 definitions created with `access.storefront = PUBLIC_READ` — `custom.materials` (245658976481), `care_guide` (245659009249), `drop_start` (245659042017), `drop_end` (245659074785), `max_per_order` (245659107553) on PRODUCT; `featured` (245659697377) on COLLECTION; `color_hex` (245659730145) on PRODUCTVARIANT. Re-running the script is a no-op (`TAKEN`).*
- [ ] **Step 4:** green, commit `feat(storefront-v2): metafield definitions script`.

## Task 4: Catalog migration + fixture recorder

**Files:** `scripts/shopify/lib/build-product-set-input.ts`, `scripts/shopify/lib/poll-product-operation.ts`, `scripts/shopify/migrate-catalog.ts`, `scripts/shopify/record-fixtures.ts`, `tests/unit/scripts/shopify-build-product-set-input.test.ts`, `tests/fixtures/shopify/*.json`

- [ ] **Step 1: Failing tests for the pure builder** (`buildProductSetInput(product, { locationId })` where `product` is a Prisma `Product & { variants, category, collections }`):
  - `handle === slug`, `title`, `descriptionHtml` (description wrapped in `<p>` when plain text), `productType = category?.name ?? ''`, `status: 'ACTIVE'` when `isActive`.
  - `productOptions` built from distinct non-null `size`/`color` in first-seen order; a product with only sizes gets one option; a product with neither gets none and a single default variant.
  - Each variant: `sku`, `price` as string with 2 decimals, `compareAtPrice` only when `> price`, `inventoryQuantities: [{ locationId, name: 'available', quantity }]`, `optionValues`, `metafields: [{ namespace:'custom', key:'color_hex', type:'color', value }]` only when `colorHex` matches `/^#[0-9a-f]{6}$/i`, `file: { originalSource }` from the first variant image, `inventoryItem: { cost, tracked: true }` when `costPrice`.
  - `files` from `JSON.parse(images)` deduped, `contentType: 'IMAGE'`.
  - `tags` includes `drop` when `isLimitedEdition`, `featured` when `isFeatured`, `new-arrival` when `isFeaturedNewArrival`.
  - Product `metafields`: `materials`/`care_guide` as rich_text JSON (`{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","value":...}]}]}`), `drop_start`/`drop_end` ISO strings, `max_per_order` from `maxQuantity`. Omitted when null.
- [ ] **Step 2:** Run, fail. **Step 3:** Implement builder (pure, no I/O).
- [ ] **Step 4:** `poll-product-operation.ts`: `pollProductOperation(id, { intervalMs: 1500, timeoutMs: 120000 })` until `COMPLETE`/`FAILED`; returns `{ productId, handle, variants: [{id, sku}] }`; test with a fake `adminRequest` that returns `CREATED` twice then `COMPLETE`.
- [ ] **Step 5:** `migrate-catalog.ts`:
  1. Load `.env.shopify` + `DATABASE_URL`; fetch locations, pick `shipsInventory: true` (fallback first).
  2. Load active products with variants/category/collections from Prisma.
  3. Look up existing Shopify product by handle (`productByHandle` — in 2026-07 use `productByIdentifier(identifier: { handle })`); if found, pass `id` into `productSet` so it updates in place.
  4. `productSet(synchronous: false)` with concurrency 3; poll; collect id map.
  5. Collections: for each Prisma collection, find by handle or `collectionCreate({ handle: slug, title: name, descriptionHtml, image: { src }, metafields: [custom.featured] })`, then `collectionAddProductsV2` in `sortOrder`. Also create `drops` (tag-based smart collection via `ruleSet` `TAG equals drop`) and `best-sellers` (manual, empty for now).
  6. `publishablePublish` each product and collection to the Online Store and Headless publications (query `publications(first: 10)` and match names `Online Store`, `Headless`).
  7. Write `scripts/shopify/out/id-map.json` and a summary. `--dry-run` prints the first 3 inputs and counts.
- [ ] **Step 6:** Run `--dry-run`, then `--apply` against the trial store. Verify with the Shopify MCP `search_products` / `get-product` tools that variants, images, and metafields are present. Paste counts in the PR.
- [ ] **Step 7:** `record-fixtures.ts`: runs every query in `lib/shopify/queries/*` (by import) against the store with real handles picked from the id map and writes `tests/fixtures/shopify/{product-by-handle,collection-products,collections,shop-layout,policies,predictive-search,recommendations}.json`. Strip nothing; fixtures are the raw response `data`.
  *Ordering note:* T5–T7 write the query modules. Task 4 ships the recorder with a `QUERIES` registry file `scripts/shopify/lib/fixture-queries.ts` that T5–T7 append to; each of those tasks re-runs the recorder for its own fixtures. Task 4 records `shop-layout` and `policies` only (they need no query module: inline the strings from Shared contracts in the registry).
- [ ] **Step 8:** green, typecheck (`scripts` is excluded from `tsconfig`; typecheck the pure libs by importing them from tests), commit `feat(storefront-v2): catalog migration + fixture recorder`.

## Task 5: Product query + normaliser

**Files:** `lib/shopify/queries/fragments.ts`, `lib/shopify/queries/product.ts`, `tests/unit/shopify/product-query.test.ts`, `tests/fixtures/shopify/product-by-handle.json`

- [ ] **Step 1: Record fixture** (append to registry, run recorder for `product-by-handle` with a handle that has 2+ colours and a compare-at price; if none exists, set one in Shopify admin first).
- [ ] **Step 2: Failing tests:** `normalizeProduct(fixture.product)` returns `ProductDetail` with: `swatches` from `Color` option swatches, falling back to variant `colorHex`; `compareAtPrice` null when equal to price; `badges` contains `sale` when any variant compareAt > price, `drop` when tag present, `soldout` when `!availableForSale`; `drop` null when no `drop` tag; `materials` is the raw rich-text JSON string (rendering is Phase 2); `getProduct(handle)` calls `storefrontFetch` with tags `['product:<handle>']` and returns `null` when `product` is null.
- [ ] **Step 3:** Implement `toProductCard(raw)` in `fragments.ts` (shared by all card-bearing queries) and `normalizeProduct` in `product.ts`. **Step 4:** green, commit.

## Task 6: Collection queries + normalisers

**Files:** `lib/shopify/queries/collection.ts`, `lib/shopify/queries/collections.ts`, `tests/unit/shopify/collection-query.test.ts`, fixtures `collection-products.json`, `collections.json`

- [ ] **Step 1:** Record fixtures (collection `all` with `first: 12` and a `filters` argument of `[{available: true}]` so the fixture contains active filter values).
- [ ] **Step 2: Failing tests:** `normalizeCollectionPage` maps filters (type narrowed to the three enum values), products via `toProductCard`, `pageInfo`; `getCollectionProducts({ handle, first, after, filters, sort })` maps `sort` (`'best-selling'|'newest'|'price-asc'|'price-desc'|'title'`) to `{ sortKey, reverse }`; `filters` are passed through as Storefront `ProductFilter` objects parsed from `FilterValue.input` JSON; `getCollections()` uses tag `collections`; `getCollectionProducts` uses `['collections', 'collection:<handle>']`.
- [ ] **Step 3:** Implement. **Step 4:** green, commit.

## Task 7: Shop layout, policies, search, recommendations

**Files:** `lib/shopify/queries/shop.ts`, `lib/shopify/queries/search.ts`, `lib/shopify/queries/recommendations.ts`, `tests/unit/shopify/shop-query.test.ts`, `tests/unit/shopify/search-query.test.ts`, fixtures `shop-layout.json`, `policies.json`, `predictive-search.json`, `recommendations.json`

- [ ] **Step 1:** Record `predictive-search` (query `"hoodie"`) and `recommendations`.
- [ ] **Step 2: Failing tests:**
  - `normalizeMenu` rewrites absolute `https://<store>.myshopify.com/collections/x` and `https://<primaryDomain>/...` to `/collections/x`; keeps external URLs; nests one level.
  - `getShopLayout()` returns `ShopLayoutData` with `policies` in order privacy, terms, refund, shipping and skips nulls; tags `['shop','menu']`.
  - `getPolicy(handle)` returns the matching `Policy` or `null`; tag `shop`.
  - `getPredictiveSearch(q)` trims, returns empty suggestion for `q.length < 2` without fetching; `revalidate: false`.
  - `getRecommendations(handle)` returns `ProductCardData[]`, tag `product:<handle>`.
- [ ] **Step 3:** Implement. **Step 4:** green, commit.

## Task 8: Tokens, base styles, fonts, globals split

**Files:** `styles/storefront/tokens.css`, `styles/storefront/base.css`, `styles/admin/tokens.css`, `lib/storefront/fonts.ts`, `app/globals.css`, `app/layout.tsx`, `tests/unit/storefront/tokens.test.ts`

- [ ] **Step 1: Failing test** (reads files with `fs`): `styles/storefront/tokens.css` defines every token named in spec §5.1; `app/globals.css` contains exactly `@import "tailwindcss";` plus imports of the three style files and nothing else; `styles/admin/tokens.css` still defines `--color-surface-base`, `--color-border-subtle`, `--shadow-glow-primary`, `--color-primary`, `--color-background`, `--color-muted-foreground` (the admin V2 and legacy semantic tokens — moved verbatim, not renamed); no file under `components/storefront` contains a hex literal (empty dir passes).
- [ ] **Step 2:** Move the existing `@theme { ... }` block and the `:root` legacy variables from `globals.css` into `styles/admin/tokens.css` verbatim (they also keep the legacy storefront working until Phase 6). Move the body/scrollbar/animation utilities into `styles/admin/tokens.css` too under a `/* legacy */` comment — Phase 6 deletes them.
- [ ] **Step 3:** Write `styles/storefront/tokens.css` from spec §5.1 in a second `@theme` block (Tailwind v4 merges multiple `@theme` blocks). **Collisions resolved during execution** (renamed on the storefront side, so admin utilities and Tailwind defaults are untouched): `--radius-sm` → `--radius-sharp` (`rounded-sharp`), `--duration-fast|base|slow` → `--duration-sf-fast|sf-base|sf-slow`, `--ease-out|spring` → `--ease-sf-out|sf-spring`; `--radius-none` dropped (Tailwind default already 0). Every later task uses these names.
- [ ] **Step 4:** `styles/storefront/base.css`: `@layer base` rules scoped to `[data-surface="storefront"]`: background bone, ink text, `font-body`, focus ring with `--color-signal`, `::selection`, `prefers-reduced-motion` kill-switch, tabular-nums utility `.num`. Scoping by attribute keeps admin pages unaffected.
- [ ] **Step 5:** `lib/storefront/fonts.ts`: `Archivo` (`variable: '--font-archivo'`, `axes: ['wdth']`, weight `500 900`) and `Inter` (`--font-inter`). `app/layout.tsx`: add both variables to `<html className>` alongside the existing Allura/Harlow (legacy pages still use them until Phase 6).
- [ ] **Step 6:** Boot `npm run dev` and load `/admin` and `/` — both must render unchanged. Run the admin test subset from note 7.
- [ ] **Step 7:** green, commit `feat(storefront-v2): design tokens + globals split`.

## Task 9: Button, IconButton, Badge, Price + lint rule

**Files:** `lib/storefront/cn.ts`, `lib/storefront/money.ts`, `components/storefront/ui/Button.tsx`, `IconButton.tsx`, `Badge.tsx`, `Price.tsx`, `eslint.config.mjs`, `tests/unit/storefront/button.test.tsx`, `tests/unit/storefront/price.test.tsx`, `tests/unit/storefront/money.test.ts`

- [ ] **Step 1: Failing tests:**
  - `formatMoney({amount:'42.5',currencyCode:'USD'})` → `$42.50`; `formatMoney(..., { trimZeros: true })` → `$42.50` stays, `$40.00` → `$40`; `isOnSale(price, compareAt)`.
  - `Button`: renders `<button type="button">` by default, `asChild` renders the child element with classes, `loading` sets `aria-busy` and `disabled`, variant `signal` includes class `bg-signal`, size `lg` min height 48px class.
  - `IconButton` requires `label` → sets `aria-label`; hit target class `min-h-11 min-w-11`.
  - `Badge` variant `soldout` text "Sold out" uppercase.
  - `Price` renders `<span class="num">` with formatted amount, and a `<s>` for compare-at with `aria-label="Original price"` only when higher.
- [ ] **Step 2:** Implement with cva; `Button` variants `ink|signal|outline|ghost|link`, sizes `sm|md|lg`; radius `rounded-sharp` everywhere; focus `focus-visible:outline-2 focus-visible:outline-signal focus-visible:outline-offset-2`.
- [ ] **Step 3:** ESLint: add a config object with `files: ['components/storefront/**', 'app/(storefront)/**', 'lib/storefront/**']` and `no-restricted-syntax` selector `Literal[value=/#[0-9a-fA-F]{3,8}\b/]` message "Use a token from styles/storefront/tokens.css". Verify `npx eslint components/storefront` passes and a deliberate `bg-[#fff]` fails.
- [ ] **Step 4:** green, commit.

## Task 10: Typography, Container, Section

**Files:** `components/storefront/ui/Typography.tsx`, `Container.tsx`, `Section.tsx`, `tests/unit/storefront/layout-primitives.test.tsx`

- [ ] **Step 1: Failing tests:** `Display` renders `h1` by default with `font-display uppercase tracking-display`, `as="h2"` and `size="lg|md|xl"` map to `text-display-*`; `Eyebrow` renders `<p class="... tracking-eyebrow uppercase text-ink-mute">`; `Prose` applies `prose`-like spacing classes to child HTML (`dangerouslySetInnerHTML` supported via `html` prop); `Container` sets `max-w-shop px-gutter mx-auto`; `Section` `tone="ink"` sets `bg-ink text-bone` and `py-section`.
- [ ] **Step 2:** Implement. **Step 3:** green, commit.

## Task 11: Form primitives + Skeleton

**Files:** `components/storefront/ui/Input.tsx`, `Select.tsx`, `Checkbox.tsx`, `QuantityStepper.tsx`, `Skeleton.tsx`, `tests/unit/storefront/form-primitives.test.tsx`

- [ ] **Step 1: Failing tests:** `Input` links `label` via `htmlFor`/`id` (auto `useId`), renders `error` in `<p role="alert">` and sets `aria-invalid`; `Select` native `<select>` with chevron icon; `Checkbox` accessible label; `QuantityStepper` `value/min/max/onChange`, decrement disabled at min, both buttons have labels, input is `inputMode="numeric"`; `Skeleton` has `aria-hidden` and `animate-pulse` honours reduced motion (class `motion-safe:animate-pulse`).
- [ ] **Step 2:** Implement (native elements; no Radix). **Step 3:** green, commit.

## Task 12: Drawer, Dialog, Accordion, AnnouncementBar, Marquee

**Files:** `components/storefront/ui/Drawer.tsx`, `Dialog.tsx`, `Accordion.tsx`, `AnnouncementBar.tsx`, `Marquee.tsx`, `tests/unit/storefront/overlays.test.tsx`

- [ ] **Step 1: Failing tests:** `Drawer` (`open`, `onOpenChange`, `side="right"|"left"`, `title`) renders `role="dialog" aria-modal` with `aria-labelledby`, closes on Escape and on backdrop click, returns focus to the trigger (use `user-event`); body gets `overflow-hidden` while open; `Dialog` same contract centred; `Accordion` uses `<details>/<summary>` with `name` for single-open groups; `AnnouncementBar` renders children and a dismiss button that persists in `sessionStorage` (wrapped in try/catch); `Marquee` duplicates children with `aria-hidden` on the clone and pauses with `motion-reduce`.
- [ ] **Step 2:** Implement `Drawer`/`Dialog` on native `<dialog>` (`showModal()`), with a small `useLockBody` hook and a focus-return effect. Framer Motion is not used in storefront primitives; use CSS transitions with `@starting-style`.
- [ ] **Step 3:** green, commit.

## Task 13: ProductCard, SwatchDots, ProductGrid

**Files:** `components/storefront/product/ProductCard.tsx`, `SwatchDots.tsx`, `ProductGrid.tsx`, `tests/unit/storefront/product-card.test.tsx`

- [ ] **Step 1: Failing tests** (input = `normalizeProduct(fixture)` from T5 narrowed to `ProductCardData`): renders a link to `/products/<handle>` wrapping image and title; second image is rendered with `data-hover` and hidden by default; `Price` with compare-at; `SwatchDots` shows up to 4 dots with `title` = colour name and a "+N" overflow; `soldout` badge dims the image; `onQuickAdd` renders a "Quick add" button (`aria-label="Quick add <title>"`) that calls back with the product id (Phase 3 wires it to the cart); `ProductGrid` renders `n` skeleton cards when `loading`; columns prop maps to `grid-cols-2 md:grid-cols-3 xl:grid-cols-4`.
- [ ] **Step 2:** Implement with `next/image` (`sizes="(min-width:1280px) 25vw, (min-width:768px) 33vw, 50vw"`, aspect `4/5`, `object-cover`). Add `cdn.shopify.com` to `next.config.ts` `images.remotePatterns` (this is the one config edit in this wave; note it in the PR).
- [ ] **Step 3:** green, commit.

## Task 14: Header, MobileMenu, Footer, StorefrontShell, preview route

**Files:** `components/storefront/layout/Header.tsx`, `HeaderNav.tsx`, `MobileMenu.tsx`, `Footer.tsx`, `StorefrontShell.tsx`, `app/(storefront)/layout.tsx`, `app/(storefront)/_preview/page.tsx`, `tests/unit/storefront/header.test.tsx`, `tests/unit/storefront/footer.test.tsx`

- [ ] **Step 1: Failing tests:**
  - `Header` (props: `menu: MenuItem[]`, `cartCount: number`, `transparent?: boolean`) renders logo link to `/`, top-level nav links, a search button, account link to `/account`, cart button with `aria-label="Cart, N items"`; `transparent` adds `data-transparent` and the header toggles `data-scrolled` after `scrollY > 24` (fire a scroll event in test); a child item list opens on hover/focus with `aria-expanded`.
  - `MobileMenu` renders inside `Drawer`, lists items with nested `Accordion` for children.
  - `Footer` (props: `policies`, `menu`) renders four columns, policies as links to `/policies/<handle>`, current year, newsletter form posting to `/api/newsletter` (existing endpoint, unchanged).
  - `StorefrontShell` is an async server component: calls `getShopLayout()` and renders `Header`, `children` in `<main id="main-content">`, `Footer`; wraps in `<div data-surface="storefront">`.
- [ ] **Step 2:** Implement. `app/(storefront)/layout.tsx` renders `StorefrontShell`. Because `app/(storefront)` has no `page.tsx` yet, the only route it owns is `_preview` — a kitchen-sink page that renders every primitive, a `ProductGrid` from `getCollectionProducts({ handle: 'all', first: 8 })`, and a `Marquee`. Guard it: `notFound()` unless `process.env.NODE_ENV !== 'production' || process.env.STOREFRONT_PREVIEW === '1'`.
- [ ] **Step 3:** Manual QA at `/_preview` on desktop and 390px; screenshot into the PR (Playwright `page.screenshot`, headless Chromium).
- [ ] **Step 4:** green, admin subset green, commit `feat(storefront-v2): header/footer shell + preview route`.

## Task 15: Playwright smoke + CI job + verification report

**Files:** `tests/e2e/playwright.config.ts`, `tests/e2e/storefront-shell.spec.ts`, `package.json` (`"test:e2e": "playwright test -c tests/e2e/playwright.config.ts"`), `.github/workflows/ci.yml`, `docs/superpowers/plans/2026-09-06-storefront-rebuild-phase1-qa.md`

- [ ] **Step 1:** Config: `webServer: { command: 'npm run dev', port: 3000, reuseExistingServer: true, env: { STOREFRONT_PREVIEW: '1' } }`, project chromium with `executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'` when that path exists.
- [ ] **Step 2:** Spec: `/_preview` loads with no console errors, header nav has ≥3 links from the Shopify menu, product grid shows ≥1 card with an image from `cdn.shopify.com`, mobile viewport opens the drawer and focus lands inside it, footer has 4 policy links.
- [ ] **Step 3:** CI: add job `e2e` (needs `validate`), `continue-on-error: true`, secrets `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_PRIVATE_TOKEN`, `NEXT_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN`, skip the job when secrets are absent (`if: ${{ secrets.SHOPIFY_STOREFRONT_PRIVATE_TOKEN != '' }}` via an env indirection step). Add repo secrets — human step, noted in the QA doc.
- [ ] **Step 4:** Verification (opus): run `npm run test:run`, `npx tsc --noEmit`, `npx eslint components/storefront lib/shopify lib/storefront`, `npm run build`, `npm run test:e2e`. Write the QA report in the Phase 1–8 format (results tables, pre-existing failures called out, human-verification checklist for `/admin` unchanged and `/_preview` on a real phone).
- [ ] **Step 5:** Open the wave PR into `storefront-v2`; after merge, open a **draft** PR `storefront-v2 → main` titled "Storefront V2 (Shopify) — integration" that stays open through Phase 6 and carries the Vercel preview URL.

---

## Definition of done (Phase 1)

- Trial store has the metafield definitions, migrated catalog with variants/images/inventory/metafields, collections, `main-menu`, and everything published to Online Store + Headless.
- `lib/shopify` covers product, collection(s), shop layout, policies, predictive search, recommendations, each with a recorded fixture and a passing normaliser test.
- `styles/storefront/tokens.css` + `components/storefront/ui/*` + `ProductCard/Grid` + header/footer shell exist, lint-clean under the no-hex rule, and render at `/_preview`.
- `app/globals.css` is a three-import file; admin pages and admin tests are unchanged.
- `storefront-v2` branch exists with a Vercel preview; draft integration PR to `main` is open.
- Phase 2 (Catalog pages) plan can start from the Shared contracts above without new discovery.
