# Storefront Rebuild — Phase 5: Drops, Reviews & Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drops become a real state machine — *upcoming · early-access · live · ended* — rendered from the Shopify `custom.drop_*` metafields, with a countdown, a server-enforced early-access gate on add-to-cart for signed-in customers who hold an `EarlyAccessGrant` (or whose tier has `earlyDropAccess`), and a server-enforced per-order cap. Reviews come back on the PDP, re-keyed from the Prisma product id to the Shopify product **handle**, with a signed-in review form, moderation-first publishing, Care Points for a review, `aggregateRating` in the Product JSON-LD and a reviews strip on the home page. Back-in-stock alerts work from the wishlist and the PDP, keyed by Shopify variant id, and are sent when a Shopify `products/update` webhook shows the variant back on sale. The storefront emits a small typed analytics event stream (page views, product views, add-to-cart, checkout hand-off, drop/early-access events) that is forwarded to GA4 when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set, and SEO gains site-level structured data. About/Contact already shipped in Phase 4 Task 8; the sitemap already comes from Shopify (Phase 2).

**Architecture:** `lib/storefront/drops.ts` is a pure state function over `ProductDetail['drop']`; `lib/storefront/early-access.ts` (server-only, Prisma) answers "does this session hold access to this handle"; `app/(storefront)/_actions/cart.ts` calls `assertPurchasable()` before `cartLinesAdd`, so the gate holds for the buy box, the sticky bar, the wishlist and the no-JS form alike. Catalog pages stay ISR: the PDP renders the **time-based** state on the server (with a client countdown that refreshes the route at zero) and resolves the **personal** early-access state in a client island after mount, exactly as the header chip and Care Points preview do. Reviews live in `lib/storefront/reviews.ts` (Prisma, `unstable_cache` 5 min, tag `reviews:<handle>`) behind `app/(storefront)/_actions/reviews.ts`; the PDP's `ReviewsSection` is a Server Component with two client islands (`ReviewForm`, `ReviewList` load-more). Back-in-stock keeps the existing `BackInStockNotification` table and `lib/back-in-stock` sender, adding Shopify keys; the webhook route from Phase 4 gets the `products/update` topic. Analytics is a `track()` function that writes to `window.dataLayer` and dispatches a DOM event; a single `<Analytics>` island in the storefront layout owns page views and the optional gtag loader.

**Tech stack:** as Phases 1–4. No new runtime dependencies. Webhook topic `PRODUCTS_UPDATE` is registered by `scripts/shopify/register-webhooks.ts` (list extended). Storefront API documents for the drop fields already exist (`PRODUCT_BY_HANDLE_QUERY` carries `dropStart`, `dropEnd`, `maxPerOrder`); `VARIANTS_BY_ID_QUERY` gains the same three product metafields so the cart gate and the wishlist can read them (validated against 2026-07 the same way, document pasted in the file header).

**Design spec:** `docs/superpowers/specs/2026-09-06-storefront-rebuild-shopify-design.md` decisions 10, 11, §5.4 rows `/`, `/products/[handle]`, `/drops`; open question **10a** resolved below. **Prior plans/QA:** `phase2-catalog.md` (route map), `phase3-cart.md` (cart actions), `phase4-accounts.md` (session, bridge, webhook), `phase4-qa.md`.

---

## Decisions taken (defaults where the spec left a question open)

| # | Question | Decision |
|---|---|---|
| 10a | Shopify Functions for hard cart validation? | **No for v1.** Gating lives in `addCartLineAction` (the only storefront path that adds lines) plus a `maxPerOrder` cap there. Shopify's own checkout cannot be reached with a line the storefront refused, and a hand-built cart via the Storefront API is out of scope for a trial store. Revisit if drops become the core business. |
| new | Early-access source of truth | `EarlyAccessGrant` row for the customer **or** the customer's `LoyaltyTier.earlyDropAccess = true`. Grants are keyed by the Prisma `Product.id`; the handle maps to it through `Product.slug` (the catalog migration kept slug = handle). A drop with no Prisma row (created in Shopify only) still honours the tier flag. |
| new | Drop state with a missing metafield | No `drop_start` → treat as already started; no `drop_end` → open-ended. A product that is not tagged `drop` has no state (`null`) and is never gated. |
| new | What "upcoming" shows | Price, gallery, variant selector stay; the buy box becomes "Opens <date>" + countdown and a signed-out/no-access line "Early access for members — sign in" / "Early access opens for Gold"; `WishlistButton` stays active. |
| new | Reviews key | New nullable `Review.productHandle` (indexed) + `Review.productId` made nullable. Migration backfills the handle from `products.slug`. New reviews write the handle always and the Prisma id when a product with that slug exists (keeps `/admin/reviews` working; Phase 6 may drop the FK). |
| new | Verified purchase | A review is `isVerified` when any order in the customer's Customer Account `orders` carries a line item whose product handle matches (Customer Account `lineItems { productId }` is not exposed on the trial version; we match on `title` against the product title as a fallback). Unverified reviews are still accepted and go to moderation like everything else. |
| new | Review points | `awardReviewPoints(customerId, reviewId)` from `lib/loyalty/service.ts` (25 points, idempotent) **when the review is approved**, not on submission — the admin approve path already exists; this plan wires the storefront side only and records the deferral. |
| new | Back-in-stock trigger | Shopify `products/update` webhook → for each variant now `availableForSale`, pending rows with that `shopifyVariantId` are sent through the existing `lib/back-in-stock` Resend template and marked `SENT`. `inventory_levels/update` is not used (no variant gid on the payload without an extra Admin call). |
| new | Analytics sink | `window.dataLayer.push({ event, ...payload })` always; gtag via `next/script` only when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set. Purchase events come from Shopify's checkout, not from us. No consent banner in this phase (US store); a `hof:analytics` DOM event lets a later consent layer gate the sink. |

---

## Cross-cutting agent notes (read once)

1. npm only. `npx vitest run <file>`, `npx tsc --noEmit`, `npx eslint <paths>`. Vitest 4 one-arg `vi.fn<T>()`; tests touching `lib/shopify/client.ts`, `lib/shopify/customer/*` or `lib/storefront/{early-access,reviews,back-in-stock}.ts` need `vi.mock('server-only', () => ({}))`; mock `next/headers`, `next/navigation`, `next/cache` (`unstable_cache: (fn) => fn`, `revalidateTag`) and `@/lib/prisma` in action/route tests. React 19, Next 16.
2. Storefront imports only from `components/storefront/**`, `lib/storefront/**`, `lib/shopify/**`, `lib/loyalty/{service,shopify-bridge,tier-progress}.ts` (server only), `lib/back-in-stock/*` (server only), `app/(storefront)/_actions/*`. Never `components/ui`, `components/products/*` (legacy review components), `lib/store`, `lib/toast`, `sonner`, `lib/auth/*`, `next-auth`.
3. No hex literals under storefront paths (lint). Motion follows `styles/storefront/motion.css` conventions (transform/opacity only, inside `prefers-reduced-motion: no-preference`).
4. Primitives to reuse: `Section`, `Container`, `Display/Eyebrow`, `Button`, `IconButton`, `Badge`, `Input`, `Textarea` (add to `ui/` if missing, same API as `Input`), `Select`, `Dialog`, `Skeleton`, `Accordion`, `Price`, `Reveal`. New shared pieces go in `components/storefront/drops/`, `components/storefront/reviews/`, `components/storefront/analytics/`.
5. **Unconfigured rules:** no Storefront env → every page renders `CatalogUnavailable` as today and no action touches Shopify. No Customer Account env → early access resolves to `false`, the review form renders its sign-in line, back-in-stock takes a typed email. No `DATABASE_URL` reachable → `getReviewSummary`/`listReviews`/`getHomeReviews` **catch and return empty** (the home page is prerendered at build time without a database); the review form's submit returns `{ ok: false, error: 'Reviews unavailable' }`.
6. **Signed-out rule:** signed-out visitors see the time-based drop state only; the review form shows "Sign in to write a review" linking `/account/login?return_to=<pdp>#reviews`; back-in-stock asks for an email.
7. **Freshness:** drop state on ISR pages may lag up to 5 min after `drop_start`; the countdown island calls `router.refresh()` at zero and the gate is always evaluated server-side at add time with `new Date()`. Reviews are cached 5 min by tag; a new review is `PENDING`, so nothing revalidates on submit. `revalidateTag('reviews:<handle>')` is called by the webhook? No — by nothing in this phase; admin approval is a Prisma write the 5-minute cache absorbs.
8. **Error shape:** actions return `{ ok: true, data } | { ok: false, error, code? }` (`StorefrontActionResult<T>` in `lib/shopify/types.ts`). The cart action's refusal codes: `DROP_NOT_OPEN`, `DROP_ENDED`, `MAX_PER_ORDER` — copy comes from `lib/storefront/drops.ts` so the panel and the drawer say the same thing.
9. **Secrets in logs:** never log tokens, emails or raw webhook bodies.
10. Admin must stay green: `npx vitest run tests/unit/admin-*.test.ts* tests/unit/fulfillment-*.test.ts* tests/unit/app/admin tests/unit/components/admin` before finishing any task that touches `prisma/schema.prisma`, `app/api/webhooks/shopify/route.ts` or `next.config.ts`.
11. Prisma: schema change + hand-written SQL migration (`IF NOT EXISTS` / `DROP NOT NULL` style, as `20261011000000_shopify_customer_identity`). Do **not** run `prisma migrate` or `db push` (no database); run `npx prisma generate` and `npx prisma validate`.
12. Branching: integration branch `claude/site-rebuild-shopify-c6zuz3` (PR #228); each wave is a draft PR into it. Do not commit from a task.
13. Legacy review components under `components/products/Review*.tsx` and `app/api/reviews/*` stay until Phase 6 (the admin review pages import some of them); this plan adds the storefront path beside them and lists what Phase 6 removes.

---

## Wave summary

| Wave | Tasks | Parallel? | Depends on |
|------|-------|-----------|------------|
| W1 | 1 (drops + gate), 2 (reviews), 4 (SEO + analytics) | 3 parallel (disjoint files; 1 and 2 both touch the PDP page in separate blocks — orchestrator merges) | Phase 4 merged |
| W2 | 3 (back-in-stock + webhook topic), 5 (e2e + QA) | 3 then 5 | W1 committed |

---

## File structure

```
lib/storefront/drops.ts                      T1  pure: dropState(), dropCopy(), formatDropDate()
lib/storefront/early-access.ts               T1  server-only: hasEarlyAccess(session, handle)
lib/storefront/purchasable.ts                T1  server-only: assertPurchasable(variant, quantity, session)
lib/shopify/queries/variants.ts              T1  + dropStart/dropEnd/maxPerOrder on product (query + normaliser)
lib/shopify/types.ts                         T1  ProductCardVariant.product.drop; T2 Review types; T4 AnalyticsEvent
app/(storefront)/_actions/cart.ts            T1  addCartLineAction → assertPurchasable before cartLinesAdd
app/(storefront)/_actions/drops.ts           T1  checkEarlyAccessAction(handle)
components/storefront/drops/DropCountdown.tsx T1  client: ticks, router.refresh() at zero
components/storefront/drops/DropStatus.tsx   T1  server: badge + window copy for the given state
components/storefront/drops/EarlyAccessGate.tsx T1 client island around the buy box (upcoming only)
components/storefront/pdp/AddToCartPanel.tsx T1  `locked` prop → "Opens <date>" button
app/(storefront)/products/[handle]/page.tsx  T1 + T2 (DropStatus / EarlyAccessGate; ReviewsSection)
app/(storefront)/drops/page.tsx              T1  grouped: Live now · Coming up · Past drops
components/storefront/home/DropSpotlight.tsx T1  countdown + state copy

prisma/schema.prisma                         T2  Review.productHandle, productId optional; T3 BackInStock keys
prisma/migrations/20261102000000_phase5_reviews_handle/migration.sql   T2
prisma/migrations/20261102000001_phase5_back_in_stock_shopify/migration.sql  T3
lib/storefront/reviews.ts                    T2  server-only: getReviewSummary, listReviews, createReview, getHomeReviews
app/(storefront)/_actions/reviews.ts         T2  submitReviewAction, listReviewsAction
components/storefront/reviews/{Stars,ReviewSummary,ReviewCard,ReviewList,ReviewForm,ReviewsSection}.tsx  T2
components/storefront/home/ReviewsStrip.tsx  T2
lib/storefront/seo.ts                        T2  productJsonLd(product, selected, rating?) → aggregateRating

lib/storefront/back-in-stock.ts              T3  server-only: subscribe(), notifyVariantsBackInStock()
app/(storefront)/_actions/back-in-stock.ts   T3  subscribeBackInStockAction
components/storefront/pdp/BackInStockForm.tsx T3 (sold-out variant) ; wishlist button wired
app/api/webhooks/shopify/route.ts            T3  + products/update topic
scripts/shopify/lib/register-webhooks.ts     T3  + PRODUCTS_UPDATE

lib/storefront/analytics.ts                  T4  track(), AnalyticsEvent union, dataLayer sink
components/storefront/analytics/Analytics.tsx T4 client: page_view on pathname change, optional gtag loader
components/storefront/pdp/ViewItem.tsx       T4  client: view_item on mount
components/storefront/cart/CartProvider.tsx  T4  add_to_cart / remove_from_cart after a successful action
components/storefront/cart/CheckoutButtons.tsx T4 begin_checkout on click
app/(storefront)/layout.tsx                  T4  <Analytics /> + site JSON-LD (Organization, WebSite+SearchAction)
app/robots.ts                                T4  drop legacy paths, add /wishlist, /search
app/(storefront)/collections/[handle]/page.tsx T4 BreadcrumbList JSON-LD (CollectionPage already there)

tests/unit/storefront/{drops,early-access,purchasable,drop-components,drops-page}.test.ts(x)  T1
tests/unit/storefront/{reviews,reviews-actions,reviews-components,home-reviews}.test.ts(x)   T2
tests/unit/storefront/{back-in-stock,back-in-stock-webhook}.test.ts                           T3
tests/unit/storefront/{analytics,seo-site}.test.ts(x)                                         T4
tests/e2e/storefront-drops.spec.ts, fixtures: a drop product with drop_start in the future  T5
docs/superpowers/plans/2026-09-06-storefront-rebuild-phase5-qa.md                            T5
```

---

## Shared contracts (source of truth)

```ts
// lib/storefront/drops.ts (pure; no I/O)
export type DropState = 'upcoming' | 'early-access' | 'live' | 'ended'
export type DropView = {
  state: DropState
  start: Date | null; end: Date | null
  maxPerOrder: number | null
  /** ms until the next transition (start when upcoming/early-access, end when live), null when none */
  nextTransitionIn: number | null
}
export function dropState(drop: ProductDetail['drop'] | null | undefined, now: Date, hasEarlyAccess: boolean): DropView | null
//   null when drop is null. start>now → hasEarlyAccess ? 'early-access' : 'upcoming'; end<=now → 'ended'; else 'live'.
//   Invalid date strings count as missing.
export function dropCopy(view: DropView): { eyebrow: string; headline: string; detail: string | null }
//   upcoming: "Drop" / "Opens <Mon D, h:mm a>" / "Early access for members"; early-access: "Early access" / "Yours before everyone else" / "Opens to all <date>";
//   live: "Drop" / "Live now" / end ? "Until <date>" : null; ended: "Drop" / "This drop has ended" / null
export function formatDropDate(date: Date, options?: { withTime?: boolean }): string   // en-US, UTC-safe: "Sep 6" / "Sep 6, 9:00 AM"
export const DROP_REFUSALS = {
  DROP_NOT_OPEN: 'This drop has not opened yet.',
  DROP_ENDED: 'This drop has ended.',
  MAX_PER_ORDER: (n: number) => `Limited to ${n} per order.`,
} as const

// lib/storefront/early-access.ts (server-only)
export async function hasEarlyAccess(session: CustomerSession | null, handle: string, now?: Date): Promise<boolean>
//   false when session null or hasCustomerAccountEnv() false. resolveCustomer → prisma.customer (loyaltyTier.earlyDropAccess) ||
//   prisma.earlyAccessGrant.findFirst({ customerId, product: { slug: handle }, validUntil: { gt: now } }). Catches and returns false (logged).

// lib/storefront/purchasable.ts (server-only)
export type Purchasable = { ok: true } | { ok: false; error: string; code: 'DROP_NOT_OPEN' | 'DROP_ENDED' | 'MAX_PER_ORDER' }
export async function assertPurchasable(p: { variantId: string; quantity: number; existingQuantity?: number }): Promise<Purchasable>
//   getVariantsByIds([variantId]) → product.drop; dropState(drop, now, await hasEarlyAccess(session, handle));
//   upcoming → DROP_NOT_OPEN; ended → DROP_ENDED; maxPerOrder && quantity + existingQuantity > maxPerOrder → MAX_PER_ORDER.
//   Unknown variant → { ok: true } (Shopify will refuse with its own userError). Not a drop → { ok: true } (unless maxPerOrder set).

// lib/shopify/queries/variants.ts (add to product)
//   dropStart: metafield(namespace:"custom", key:"drop_start") { value } dropEnd: … maxPerOrder: …
//   ProductCardVariant.product.drop: { start: string | null; end: string | null; maxPerOrder: number | null } | null  (null unless tags includes 'drop')

// app/(storefront)/_actions/drops.ts
export async function checkEarlyAccessAction(handle: string): Promise<{ ok: true; data: { hasEarlyAccess: boolean } } | { ok: false; error: string }>

// lib/storefront/reviews.ts (server-only)
export type ReviewSummary = { handle: string; average: number; count: number; distribution: Record<1|2|3|4|5, number> }
export type ReviewItem = { id: string; rating: 1|2|3|4|5; title: string | null; comment: string; authorName: string /* "Nando R." */; isVerified: boolean; createdAt: string; adminReply: string | null; helpfulCount: number }
export type ReviewPage = { items: ReviewItem[]; nextCursor: string | null; total: number }
export type ReviewSort = 'newest' | 'highest' | 'lowest' | 'helpful'
export async function getReviewSummary(handle: string): Promise<ReviewSummary>              // APPROVED only; unstable_cache 300s tag `reviews:<handle>`; empty on failure
export async function listReviews(handle: string, p?: { cursor?: string | null; limit?: number; sort?: ReviewSort }): Promise<ReviewPage>
export async function getHomeReviews(limit = 3): Promise<(ReviewItem & { productHandle: string; productTitle: string | null })[]>   // APPROVED, rating >= 4, newest; empty on failure
export type CreateReviewInput = { handle: string; productTitle: string; rating: number; title?: string | null; comment: string }
export async function createReview(input: CreateReviewInput, session: CustomerSession): Promise<{ id: string; status: 'PENDING' }>
//   resolveCustomer → customerId; one review per (customer, handle) → throws ReviewError('ALREADY_REVIEWED'); isVerified via Customer Account orders (title match);
//   writes productHandle, productId (Prisma product by slug when present), customerName from session, customerEmail, status PENDING.

// app/(storefront)/_actions/reviews.ts
export async function submitReviewAction(prev: ReviewFormState, formData: FormData): Promise<ReviewFormState>
//   ReviewFormState = { status: 'idle' | 'success' | 'error'; error?: string; fieldErrors?: Partial<Record<'rating'|'title'|'comment', string>> }
//   signed out → error 'Sign in to write a review.' code SIGNED_OUT; zod: rating 1–5 int, title ≤ 120, comment 20–2000.
export async function listReviewsAction(p: { handle: string; cursor: string | null; sort?: ReviewSort }): Promise<StorefrontActionResult<ReviewPage>>

// lib/storefront/analytics.ts
export type AnalyticsEvent =
  | { event: 'page_view'; path: string; title?: string }
  | { event: 'view_item'; handle: string; title: string; price: number; currency: string; variantId?: string }
  | { event: 'add_to_cart'; variantId: string; quantity: number; price?: number; currency?: string }
  | { event: 'remove_from_cart'; lineId: string; quantity: number }
  | { event: 'begin_checkout'; value: number; currency: string; items: number }
  | { event: 'drop_view'; handle: string; state: DropState }
  | { event: 'early_access_unlocked'; handle: string }
  | { event: 'review_submitted'; handle: string; rating: number }
  | { event: 'back_in_stock_subscribed'; variantId: string }
export function track(e: AnalyticsEvent): void   // no-op on the server; pushes to window.dataLayer and dispatches CustomEvent('hof:analytics', { detail: e })
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? null

// lib/shopify/types.ts (add)
export type StorefrontActionResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: string }
```

---

## Task 1: Drop state machine, countdown, early-access gate

**Files:** see File structure (T1). **Tests first** in `tests/unit/storefront/drops.test.ts` (state table incl. missing/invalid dates and the hasEarlyAccess branch; copy; date formatting in UTC), `early-access.test.ts` (tier flag, valid grant, expired grant, no session, no env, prisma throws → false), `purchasable.test.ts` (each refusal code, unknown variant passes, non-drop with maxPerOrder), `drop-components.test.tsx` (`DropStatus` per state, `DropCountdown` renders `<time>` + aria-live and calls refresh at zero with fake timers, `EarlyAccessGate` unlocks when the action says yes), `drops-page.test.tsx` (three groups, empty states), and updates to `pdp.test.tsx` (upcoming drop → locked button text "Opens Sep 6", live → normal) and `cart-actions.test.ts` (refusal short-circuits before Shopify).

- [ ] `lib/storefront/drops.ts` per contract. `formatDropDate` uses `Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', … })` — the store's merchant timezone (Shopify shop `ianaTimezone`; hardcode with a comment, Phase 6 can read it from `shop`).
- [ ] `lib/shopify/queries/variants.ts`: add the three metafields to the document and `drop` to the normaliser (same rule as `normalizeProduct`); update `tests/fixtures/shopify/variants.json` and the e2e mock's `VariantsById` resolver (`productRef`) to carry them.
- [ ] `lib/storefront/early-access.ts`, `lib/storefront/purchasable.ts` per contract; `addCartLineAction` and `addCartLineForm` call `assertPurchasable` **before** any Shopify mutation and return its refusal as `CartActionResult` (`{ ok: false, error, code }`); `existingQuantity` = the current cart line quantity for that variant when a cart exists (one `getCartById`, already fetched for the add path? If not, skip the read and cap on `quantity` alone — note it).
- [ ] `components/storefront/drops/*`: `DropStatus` (Badge "Drop" / "Early access" / "Ended" + copy), `DropCountdown` (`'use client'`, `useEffect` interval 1s, `<time dateTime=…>` "02d 04h 09m 12s", `aria-live="polite"` but updates the live region at most once a minute; at zero → `router.refresh()`), `EarlyAccessGate` (`'use client'`; when `state === 'upcoming'` and `useCustomer().status === 'ready'` → `checkEarlyAccessAction(handle)` once; renders children with `locked` false when access is granted; tracks `early_access_unlocked`).
- [ ] `AddToCartPanel`: new `locked?: { label: string }` prop → the button is disabled and reads `locked.label` ("Opens Sep 6"), `data-drop="locked"`; the sticky bar mirrors it.
- [ ] PDP: compute `const view = dropState(product.drop, new Date(), false)`; render `DropStatus` under the title instead of the plain `dropText`; wrap `AddToCartPanel` + `StickyBuyBar` in `EarlyAccessGate` when `view?.state === 'upcoming'`; `ended` → sold-out styling with "This drop has ended". Keep `/drops/[handle]` as the re-export.
- [ ] `/drops` page: fetch the `drops` collection (first 48), then `getProduct` for each handle is too costly — instead extend `COLLECTION_PRODUCTS` card fields? **No**: add `dropStart`/`dropEnd` to `ProductCardFields` fragment (two metafields, cheap) and `ProductCardData.drop?: { start; end }`, then group with `dropState`: "Live now", "Coming up" (with the nearest countdown), "Past drops" (collapsed `Accordion`). Update the collection-products fixture and the mock.
- [ ] `DropSpotlight`: takes the grouped data; shows the live drop (or the next upcoming with a countdown); the marquee says "Drop live — shop now" only when something is live, "Drop opens <date>" when upcoming.
- [ ] Green, typecheck, lint, admin subset untouched.

## Task 2: Reviews on the storefront (re-keyed by handle)

**Files:** see File structure (T2). **Tests first:** `reviews.test.ts` (summary math, distribution, cursor paging, sort, `createReview` rules: duplicate, verified via mocked `getCustomerOrders`, productId resolution by slug, unavailable DB → empty), `reviews-actions.test.ts` (signed-out, zod field errors, success, generic failure), `reviews-components.test.tsx` (`Stars` a11y label "4 out of 5 stars", `ReviewSummary` bars, `ReviewCard` verified badge + admin reply, `ReviewList` load more, `ReviewForm` states incl. the sign-in line, `ReviewsSection` empty state "No reviews yet — be the first"), `home-reviews.test.tsx` (strip renders ≤3 with product links; hidden when empty), `seo.test.ts` additions (`aggregateRating` present only when count > 0).

- [ ] Prisma: `Review.productHandle String?` + `@@index([productHandle, status])`; `productId String?` and relation optional. Migration SQL: add column, backfill `UPDATE reviews r SET "productHandle" = p.slug FROM products p WHERE r."productId" = p.id AND r."productHandle" IS NULL`, index, `ALTER COLUMN "productId" DROP NOT NULL`. `npx prisma generate && npx prisma validate`; run the admin subset (admin review pages select `product`; they must tolerate `null` — fix with `product?.` where the typecheck says so).
- [ ] `lib/storefront/reviews.ts` per contract (`'server-only'`; `unstable_cache` for the two reads; `authorName` = first name + last initial from `customerName`).
- [ ] Actions per contract; `ReviewForm` with `useActionState`, rating as a radio group of 5 star buttons (`fieldset`/`legend`), `Textarea`, honeypot field; success copy "Thanks — your review is in moderation and will appear once approved."
- [ ] `ReviewsSection` (server): `id="reviews"`, heading with `ReviewSummary` (average, count, 5 bars), first page `listReviews(handle, { limit: 6 })`, `ReviewList` client island for sort + load more via `listReviewsAction`, `ReviewForm` beneath; signed-in state comes from `useCustomer()` in the island (the section itself is cached with the page).
- [ ] PDP: render `ReviewsSection` after `DetailsAccordion`'s grid, before `RecommendationsRail`; pass `summary` to `ProductJsonLd` → `productJsonLd(product, selected, summary)` adds `aggregateRating` when `count > 0`. Title block shows `Stars` + "(12)" linking `#reviews` when count > 0.
- [ ] Home: `ReviewsStrip` (eyebrow "What people say", three cards, each linking `/products/<handle>#reviews`), inserted between `Editorial` and `NewsletterSection`; `getHomeReviews` runs beside `getHomeData` and is **also** called on the unconfigured home shape (reviews need no Shopify).
- [ ] Green, typecheck, lint, admin subset.

## Task 3: Back-in-stock alerts (Shopify-keyed) + webhook topic — Wave 2

- [ ] Prisma: `BackInStockNotification.productHandle String?`, `shopifyVariantId String?` (+ index `[shopifyVariantId, status]`), `productId` optional, `@@unique([shopifyVariantId, email])`. Migration SQL by hand.
- [ ] `lib/storefront/back-in-stock.ts`: `subscribe({ variantId, handle, email, customerId? })` (upsert PENDING), `notifyVariantsBackInStock(variants: { id; handle; title; availableForSale }[])` → pending rows → send via `lib/back-in-stock` sender (refactor its email builder to accept `{ productTitle, productUrl, variantTitle }` without a Prisma product) → `SENT`.
- [ ] Action `subscribeBackInStockAction(prev, formData)`; `BackInStockForm` on the PDP when the selected variant is sold out (signed-in: one-click with the session email; guest: email input); wishlist "Back in stock alert" button wired (remove `data-phase="5"`).
- [ ] Webhook: `products/update` → `parseProductsUpdate(payload)` → variant gids + `available` (`inventory_quantity > 0 || inventory_policy === 'continue'`) → `notifyVariantsBackInStock`. `register-webhooks.ts` topic list + checklist doc updated. Tests: parse fixture `tests/fixtures/shopify/webhooks/products-update.json`, dedupe, send + mark.
- [ ] Green, typecheck, lint, admin subset.

## Task 4: SEO site data + analytics stream

**Tests first:** `analytics.test.ts` (`track` no-op on server, pushes to `dataLayer`, dispatches the DOM event, event shapes), `seo-site.test.ts` (`organizationJsonLd`/`webSiteJsonLd` payloads; robots rules), `analytics-island.test.tsx` (page_view on pathname change, gtag script only with the env var), cart provider/checkout button tests extended for the two events.

- [ ] `lib/storefront/analytics.ts` per contract; `components/storefront/analytics/Analytics.tsx` (`'use client'`, `usePathname` → `track({ event: 'page_view' })`; `GA_MEASUREMENT_ID` → `<Script src="https://www.googletagmanager.com/gtag/js?id=…" strategy="afterInteractive">` + inline config with `send_page_view: false`, and a `dataLayer` listener is unnecessary since gtag reads `dataLayer` itself).
- [ ] Hooks: `ViewItem` island on the PDP; `CartProvider.addLine`/`removeLine` success → `add_to_cart`/`remove_from_cart`; `CheckoutButtons` click → `begin_checkout`; `EarlyAccessGate` → `early_access_unlocked`; `DropStatus` server → a tiny `DropView` island fires `drop_view`? **Keep it to the PDP `ViewItem` island with an optional `dropState` field** (one island, one event).
- [ ] `lib/storefront/seo.ts`: `webSiteJsonLd()` (`WebSite` + `SearchAction` to `/search?q={search_term_string}`); layout emits Organization + WebSite once. Collection page adds `BreadcrumbList`. `robots.ts`: remove `/profile/`, `/orders/`, `/signin/` (legacy), add `/wishlist/`, `/search`; keep the rest.
- [ ] `.env.example` (if present) documents `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
- [ ] Green, typecheck, lint.

## Task 5: E2E + QA report — Wave 2

- [ ] Mock: the `drops` collection fixture gets one product with `drop_start` 2 days ahead and one live; `storefront-drops.spec.ts`: `/drops` shows both groups, the upcoming PDP has a disabled "Opens …" button and a countdown, the live PDP adds to cart, the signed-in journey (customer mock) with a mocked `hasEarlyAccess` is unit-only (needs Prisma) — note in the spec header. Catalog/cart/account specs stay green.
- [ ] `phase5-qa.md`: results table, deviations, human checklist (register `PRODUCTS_UPDATE`, set `NEXT_PUBLIC_GA_MEASUREMENT_ID`, set `custom.drop_*` on a test product, approve a review in `/admin/reviews`, Phase 6 removals list). Update PR #228 title/body to Phases 1–5.

---

## Definition of done (Phase 5)

- A product tagged `drop` with `custom.drop_start` in the future renders "Opens <date>" with a countdown and cannot be added to the cart by anyone without early access, from any path; the same product renders normally once the date passes; `custom.max_per_order` is enforced at add time.
- A signed-in customer whose tier has `earlyDropAccess`, or who holds a valid `EarlyAccessGrant`, sees the buy box unlock on an upcoming drop and can add it.
- The PDP shows approved reviews for the handle with a summary, paging and sorting; a signed-in customer can submit one review per product, which lands `PENDING`; Product JSON-LD carries `aggregateRating` when reviews exist; the home page shows a reviews strip when there are any.
- A sold-out variant offers a back-in-stock alert from the PDP and the wishlist; a `products/update` webhook that brings the variant back sends the email once.
- `window.dataLayer` receives page_view / view_item / add_to_cart / begin_checkout events; gtag loads only with the env var.
- Unit suite, typecheck, lint, admin subset green; e2e drops spec green on both projects; Phase 6 can delete the legacy review API and components without touching the storefront.
