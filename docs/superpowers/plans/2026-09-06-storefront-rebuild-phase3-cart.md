# Storefront Rebuild — Phase 3: Cart & Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the custom cart and Stripe checkout with a Shopify cart: cart ID in an httpOnly cookie, every mutation a Server Action, a cart drawer that opens on add, a `/cart` page, discount codes, the free-shipping bar, Shop Pay, and a plain link to `cart.checkoutUrl` for checkout. Delete the legacy cart-only code and rewire the three surviving legacy consumers. Mockup: https://claude.ai/artifact/CYSwqV3XFTAec6Q5mb8GHT (screens 01–05 and the states grid are the acceptance picture).

**Architecture:** `lib/shopify/queries/cart.ts` owns the validated documents and `normalizeCart`. `lib/shopify/cart/cookie.ts` owns the `hof_cart` cookie. `app/(storefront)/_actions/cart.ts` exposes the actions. `CartProvider` (client) loads the cart once on mount through `getCartAction()` so catalog pages stay ISR-cacheable (no cookie read during render), keeps optimistic line state, and owns the drawer's open state; `useCart()` is the only way UI touches the cart. The PDP form posts to a Server Action without JS and is intercepted by the provider with JS. Checkout and Shop Pay are `<a href>` links out to Shopify.

**Tech stack:** as Phases 1–2. No new dependencies. Storefront API 2026-07; cart documents validated 2026-10-10 (Shopify's `totalTaxAmount`/`totalDutyAmount` are deprecated and omitted; taxes show at checkout).

**Design spec:** `docs/superpowers/specs/2026-09-06-storefront-rebuild-shopify-design.md` decisions 5, 7, 14. **Prior plans/QA:** `phase1-foundation.md`, `phase2-catalog.md`, `phase2-qa.md` (token names, primitives, conventions). **Audit** used for this plan is summarised in §"Legacy surface" below.

---

## Cross-cutting agent notes (read once)

1. npm only. `npx vitest run <file>`, `npx tsc --noEmit`, `npx eslint <paths>`. Vitest 4 one-arg `vi.fn<T>()`; tests touching `lib/shopify/client.ts` need `vi.mock('server-only', () => ({}))`; mock `next/headers` (`cookies`) and `next/cache` (`revalidateTag`) in action tests. React 19 (`useOptimistic`, `useTransition`, `useActionState`, `useFormStatus`). Next 16: `await cookies()`; `cookies().set` is allowed only in Server Actions and route handlers.
2. Storefront imports only from `components/storefront/**`, `lib/storefront/**`, `lib/shopify/**`, `app/(storefront)/_actions/*`. Never `components/ui`, `components/layout/Navigation`, `lib/store`, `lib/toast`, `sonner`.
3. Token utilities per Phase 1 (`bg-bone text-ink bg-ink text-bone bg-signal text-signal-ink border-line rounded-sharp px-gutter py-section duration-sf-fast ease-sf-out`, `.num`, focus ring `focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2`). No hex literals (lint-enforced). Shop Pay's brand purple is the one exception and lives as a token `--color-shoppay: #5A31F4` added to `styles/storefront/tokens.css` (T5) so the button can be `bg-shoppay`.
4. Primitives to reuse: `Drawer` (`OverlayProps` + `side`, `footer` slot), `Dialog`, `QuantityStepper` (controlled, clamps), `Button`, `IconButton`, `Badge`, `Price`, `Input`, `Skeleton`, `Section`, `Container`, `Display/Eyebrow`. Extend in place, never fork.
5. **Unconfigured store rule** still applies: with `hasShopifyEnv()` false, actions return `{ ok: false, error: 'Cart unavailable' }` without fetching, the provider stays in `status: 'unavailable'`, the PDP button is disabled with `data-phase="unconfigured"`, and `/cart` renders `CatalogUnavailable`. Never throw to the client.
6. **Cart freshness:** every cart fetch is `revalidate: false` (no-store). Actions return the full normalised cart; the client replaces its state with the returned cart (no refetch). `revalidateTag('cart')` is not needed and must not be used (nothing caches the cart). Do not read the cookie in any layout or page render except `/cart` (which is `dynamic = 'force-dynamic'`).
7. **Error shape:** every action returns `CartActionResult` (Shared contracts). Shopify `userErrors` become `{ ok: false, error: <first message>, code }`; a thrown `ShopifyError` becomes `{ ok: false, error: 'Something went wrong updating your cart.' }` and is logged with the message only.
8. **Legacy deletion rule:** delete a file only when `grep -rn "<module>" app components lib tests scripts` shows no importer left after this plan's removals; otherwise keep it and list it in the report. The kept-on-purpose list in §"Legacy surface" is final.
9. Admin must stay green: `npx vitest run tests/unit/admin-*.test.ts* tests/unit/fulfillment-*.test.ts* tests/unit/app/admin` before finishing any task that deletes files or touches `next.config.ts`, `app/layout.tsx`, `components/layout/*`.
10. Branching: integration branch `claude/site-rebuild-shopify-c6zuz3` (PR #228); the orchestrator commits each wave. Do not commit from a task.
11. Trial store: `cart.checkoutUrl` works on trial (Bogus Gateway for test payments); real payments need the plan upgrade. Shop Pay needs the Headless storefront to exist (Task 0 of Phase 1).

---

## Wave summary

| Wave | Tasks | Parallel? | Depends on |
|------|-------|-----------|------------|
| W1 | 1, 2, 3 | 3 parallel (disjoint files) | Phase 2 merged |
| W2 | 4, 5, 6, 7 | 4 parallel (disjoint files; 6 and 7 import 4/5 by contract) | W1 committed |
| W3 | 8 (e2e mock + spec), 9 (verify + QA) | 8 then 9 | W2 committed |

---

## File structure

**Created**
- `lib/shopify/queries/cart.ts`, `tests/fixtures/shopify/cart.json`, `tests/unit/shopify/cart-query.test.ts` (T1)
- `lib/shopify/cart/cookie.ts`, `app/(storefront)/_actions/cart.ts`, `tests/unit/storefront/cart-actions.test.ts` (T2)
- `lib/storefront/shipping.ts` (free-shipping threshold + copy), `tests/unit/storefront/shipping.test.ts` (T2)
- `scripts/shopify/checkout-branding.ts`, `scripts/shopify/lib/checkout-branding-input.ts`, `tests/unit/scripts/shopify-checkout-branding.test.ts` (T3)
- `components/storefront/cart/{CartProvider,useCart,CartBadge}.tsx`, `tests/unit/storefront/cart-provider.test.tsx` (T4)
- `components/storefront/cart/{CartDrawer,CartLineItem,CartLines,CartSummary,FreeShippingBar,DiscountCodeForm,CheckoutButtons,EmptyCart}.tsx`, `tests/unit/storefront/cart-drawer.test.tsx` (T5)
- `app/(storefront)/cart/page.tsx`, `components/storefront/cart/{CartPage,CartNoteForm}.tsx`, `tests/unit/storefront/cart-page.test.tsx` (T7)
- `tests/e2e/mock/storefront-mock.mjs`, `tests/e2e/storefront-cart.spec.ts` (T8)
- `docs/superpowers/plans/2026-09-06-storefront-rebuild-phase3-qa.md` (T9)

**Modified**
- `lib/shopify/types.ts` (+`Cart`, `CartLine`, `CartActionResult`) (T1)
- `lib/shopify/queries/index.ts` (T1); `scripts/shopify/lib/fixture-queries.ts` (T1: `cart` entry noted as mutation-produced; recorder skips it)
- `styles/storefront/tokens.css` (+`--color-shoppay`) (T5)
- `components/storefront/layout/{Header,StorefrontShell}.tsx` (badge from `useCart`; `cartCount` prop becomes the SSR fallback) (T4); `app/(storefront)/layout.tsx` (wraps children in `CartProvider`, announcement copy from `lib/storefront/shipping`) (T4)
- `components/storefront/pdp/{AddToCartPanel,StickyBuyBar,DetailsAccordion}.tsx`, `app/(storefront)/products/[handle]/page.tsx`, `app/(storefront)/page.tsx` (marquee copy) (T6)
- `components/layout/Navigation.tsx`, `components/layout/MobileBottomNav.tsx`, `app/wishlist/page.tsx` + their tests (T7, rewire)
- `next.config.ts` (redirects `/checkout` → `/cart`, `/order/confirmation` → `/orders`) (T7); `tests/unit/storefront/redirects.test.ts` (T7)
- `tests/e2e/playwright.config.ts`, `.github/workflows/ci.yml` (mock-backed e2e runs without secrets) (T8)
- `tests/unit/storefront/{pdp,header,footer}.test.tsx` (placeholders replaced) (T4/T6)

**Deleted (T7, after the grep rule)**
- Routes: `app/cart/page.tsx`, `app/checkout/page.tsx`, `app/order/confirmation/page.tsx`, `app/api/cart-reservations/route.ts`, `app/api/stripe/payment-intent/route.ts`, `app/api/orders/express/route.ts`
- Code: `lib/store/cart.ts`, `lib/cart/**`, `lib/checkout/insights.ts`, `lib/orders/confirmation-insights.ts` (verify), `components/cart/**`, `components/checkout/**`, `components/products/MobileAddToCartBar.tsx`, `components/drops/ExclusiveDropPage.tsx` (+ `components/products/CountdownTimer.tsx` if it has no other importer), `lib/security/validation.ts` → only the `cartReservationSchema` export
- Tests: `tests/unit/{cart-store-totals,cart-validation,cart-page-modernized,checkout-insights,order-confirmation-page,order-confirmation-insights,shipping-form-newsletter}.test.*`; `tests/integration/api/checkout.test.js` (dead, never ran)

**Kept on purpose (Phase 6):** `app/api/stripe/webhook`, `lib/stripe/*` (admin refunds), `lib/email/queue.ts` (cron + admin marketing), `lib/checkout/server-pricing.ts` (`app/api/orders` POST), `app/api/orders/[id]/{confirm-payment,send-confirmation}`, `lib/store/wishlist.ts` (Phase 4), `components/layout/Navigation.tsx` + `MobileBottomNav.tsx` (rewired, not removed), Prisma cart tables and the abandoned-cart admin pages.

---

## Shared contracts (source of truth)

```ts
// lib/shopify/types.ts (add)
export type CartLine = {
  id: string; quantity: number
  merchandise: {
    id: string; title: string; sku: string | null; availableForSale: boolean; quantityAvailable: number | null
    price: Money; compareAtPrice: Money | null
    selectedOptions: { name: string; value: string }[]
    image: ShopImage | null
    product: { id: string; handle: string; title: string; tags: string[]; featuredImage: ShopImage | null; maxPerOrder: number | null }
  }
  cost: { total: Money; perUnit: Money; compareAtPerUnit: Money | null }
  discount: Money | null                         // sum of line discountAllocations, null when none
  attributes: { key: string; value: string }[]
}
export type Cart = {
  id: string; checkoutUrl: string; totalQuantity: number; note: string | null
  lines: CartLine[]
  discountCodes: { code: string; applicable: boolean }[]
  cost: { subtotal: Money; total: Money; discount: Money | null }   // discount = sum of cart-level discountAllocations
  buyer: { email: string | null; customerId: string | null }
}
export type CartActionResult =
  | { ok: true; cart: Cart; warning?: string }
  | { ok: false; error: string; code?: string; cart?: Cart }

// lib/shopify/queries/cart.ts
export const CART_FIELDS: string                                        // CartFields + CartLineFields fragments (validated document in this file's header)
export const CART_BY_ID_QUERY, CART_CREATE_MUTATION, CART_LINES_ADD_MUTATION, CART_LINES_UPDATE_MUTATION,
  CART_LINES_REMOVE_MUTATION, CART_DISCOUNT_CODES_UPDATE_MUTATION, CART_NOTE_UPDATE_MUTATION, CART_BUYER_IDENTITY_UPDATE_MUTATION: string
export type RawCart, RawCartLine
export function normalizeCart(raw: RawCart): Cart
export type CartUserError = { field: string[] | null; message: string; code: string | null }
export async function getCartById(id: string): Promise<Cart | null>           // null when Shopify returns cart: null (expired/invalid)
export async function createCart(input: { lines?: { merchandiseId: string; quantity: number }[]; note?: string; discountCodes?: string[] }): Promise<Cart>
export async function addCartLines(cartId: string, lines: { merchandiseId: string; quantity: number }[]): Promise<Cart>
export async function updateCartLines(cartId: string, lines: { id: string; quantity: number }[]): Promise<Cart>
export async function removeCartLines(cartId: string, lineIds: string[]): Promise<Cart>
export async function updateCartDiscountCodes(cartId: string, codes: string[]): Promise<Cart>
export async function updateCartNote(cartId: string, note: string): Promise<Cart>
export async function updateCartBuyerIdentity(cartId: string, buyer: { email?: string; customerAccessToken?: string; countryCode?: string }): Promise<Cart>
// every mutation helper: storefrontFetch with revalidate false; throws ShopifyError({ userErrors }) when userErrors.length; returns normalizeCart(cart)

// lib/shopify/cart/cookie.ts (server only)
export const CART_COOKIE = 'hof_cart'
export async function readCartId(): Promise<string | null>
export async function writeCartId(id: string): Promise<void>           // httpOnly, sameSite 'lax', secure when NODE_ENV==='production', path '/', maxAge 30 days
export async function clearCartId(): Promise<void>

// lib/storefront/shipping.ts (pure, client-safe)
export const FREE_SHIPPING_THRESHOLD: number        // Number(process.env.NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD) || 75
export const FREE_SHIPPING_COPY: string             // `Free US shipping over $${FREE_SHIPPING_THRESHOLD}`
export function freeShippingProgress(subtotal: Money): { remaining: number; ratio: number; unlocked: boolean }

// app/(storefront)/_actions/cart.ts ('use server')
export async function getCartAction(): Promise<Cart | null>           // reads cookie; null when none/expired (clears the cookie on expired)
export async function addCartLine(input: { variantId: string; quantity?: number }): Promise<CartActionResult>
  // creates the cart when there is no cookie; caps at merchandise.product.maxPerOrder (updates the line and returns warning 'Max N per order') and at quantityAvailable (warning 'Only N left')
export async function addCartLineForm(prev: CartActionResult | null, formData: FormData): Promise<CartActionResult>   // useActionState/no-JS wrapper over addCartLine (fields variantId, quantity)
export async function updateCartLine(input: { lineId: string; quantity: number }): Promise<CartActionResult>    // quantity 0 → remove
export async function removeCartLine(input: { lineId: string }): Promise<CartActionResult>
export async function applyDiscountCode(input: { code: string }): Promise<CartActionResult>   // adds to existing codes; if the returned code is not applicable → removes it again and returns { ok: false, error: `${code} isn't valid for this cart.`, cart }
export async function removeDiscountCode(input: { code: string }): Promise<CartActionResult>
export async function updateCartNoteAction(input: { note: string }): Promise<CartActionResult>

// components/storefront/cart/CartProvider.tsx ('use client')
export type CartStatus = 'loading' | 'ready' | 'unavailable'
export type CartContextValue = {
  cart: Cart | null; status: CartStatus; count: number
  open: boolean; openDrawer(): void; closeDrawer(): void
  pending: boolean; error: string | null; warning: string | null; clearMessages(): void
  addLine(input: { variantId: string; quantity?: number }, opts?: { open?: boolean }): Promise<CartActionResult>   // open defaults true
  updateLine(lineId: string, quantity: number): Promise<CartActionResult>      // optimistic
  removeLine(lineId: string): Promise<CartActionResult>                        // optimistic
  applyCode(code: string): Promise<CartActionResult>
  removeCode(code: string): Promise<CartActionResult>
  setNote(note: string): Promise<CartActionResult>
}
export function CartProvider({ children, initialCart?: Cart | null, available?: boolean, actions?: Partial<CartActions> }): JSX.Element
  // `actions` lets tests inject fakes; defaults to the server actions. On mount (when !initialCart && available) calls getCartAction().
export function useCart(): CartContextValue              // throws outside the provider
export function useCartOptional(): CartContextValue | null
// CartBadge.tsx: renders the header count from useCartOptional(); falls back to the `fallbackCount` prop (SSR) until loaded
```

Validated Storefront documents (2026-07, 2026-10-10). Compose them in `cart.ts` exactly like this (fragments once per document):

```graphql
fragment ImageFields on Image { url altText width height }
fragment MoneyFields on MoneyV2 { amount currencyCode }
fragment CartLineFields on BaseCartLine {
  id quantity
  attributes { key value }
  cost { totalAmount { ...MoneyFields } amountPerQuantity { ...MoneyFields } compareAtAmountPerQuantity { ...MoneyFields } }
  discountAllocations { discountedAmount { ...MoneyFields } }
  merchandise { ... on ProductVariant {
    id title sku availableForSale quantityAvailable
    price { ...MoneyFields } compareAtPrice { ...MoneyFields }
    selectedOptions { name value }
    image { ...ImageFields }
    product { id handle title tags featuredImage { ...ImageFields } maxPerOrder: metafield(namespace: "custom", key: "max_per_order") { value } }
  } }
}
fragment CartFields on Cart {
  id checkoutUrl totalQuantity note
  buyerIdentity { email countryCode customer { id } }
  discountCodes { code applicable }
  discountAllocations { discountedAmount { ...MoneyFields } }
  cost { subtotalAmount { ...MoneyFields } totalAmount { ...MoneyFields } checkoutChargeAmount { ...MoneyFields } }
  lines(first: 100) { nodes { ...CartLineFields } }
}
query CartById($id: ID!) { cart(id: $id) { ...CartFields } }
mutation CartCreate($input: CartInput!) { cartCreate(input: $input) { cart { ...CartFields } userErrors { field message code } warnings { code message target } } }
mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) { cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ...CartFields } userErrors { field message code } warnings { code message target } } }
mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) { cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { ...CartFields } userErrors { field message code } warnings { code message target } } }
mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) { cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ...CartFields } userErrors { field message code } warnings { code message target } } }
mutation CartDiscountCodesUpdate($cartId: ID!, $discountCodes: [String!]!) { cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) { cart { ...CartFields } userErrors { field message code } warnings { code message target } } }
mutation CartNoteUpdate($cartId: ID!, $note: String!) { cartNoteUpdate(cartId: $cartId, note: $note) { cart { ...CartFields } userErrors { field message code } warnings { code message target } } }
mutation CartBuyerIdentityUpdate($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!) { cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) { cart { ...CartFields } userErrors { field message code } warnings { code message target } } }
```

Shopify `warnings` (e.g. `MERCHANDISE_NOT_ENOUGH_STOCK`, `MERCHANDISE_OUT_OF_STOCK`) are mapped to `CartActionResult.warning` text, never errors. Checkout links: `cart.checkoutUrl` for the Checkout button; `${cart.checkoutUrl}${checkoutUrl.includes('?') ? '&' : '?'}payment=shop_pay` for the Shop Pay button.

UI contract (from the mockup): drawer `Drawer side="right" title="Cart"` with the count in the title; body = `FreeShippingBar` → `CartLines` → discount chips/`DiscountCodeForm`; `footer` = `CartSummary` (subtotal, discount rows, estimated total, "Taxes and shipping calculated at checkout · Earn N Care Points" where N = `Math.floor(total)`) + `CheckoutButtons` (signal "Checkout · $total", Shop Pay, "Secure checkout by Shopify"). Empty → `EmptyCart` ("Your cart is empty." + Button `/collections/all` "Shop new arrivals" + link `/drops`). Line item = 72px 4:5 image → title (link to `/products/<handle>`), options, `QuantityStepper size="sm"` (max from `quantityAvailable` / `maxPerOrder`), `Price`, Remove. Pending = `aria-busy` on the drawer body + `opacity-60` on the affected line. Sold-out line = dimmed, `Badge soldout`, `alert` "Remove it to check out", Checkout disabled while any line `!availableForSale`.

---

## Legacy surface (from the 2026-10-10 audit)

- The cart-only legacy code has no admin/loyalty/support importers; everything in "Deleted" above is safe once three consumers are rewired: `components/layout/Navigation.tsx` (imports `useCartStore` and `MiniCart`; badge + MiniCart), `components/layout/MobileBottomNav.tsx` (cart count), `app/wishlist/page.tsx` (quick-add via the store).
- `lib/store/wishlist.ts` stays (WishlistIcon, MobileBottomNav, wishlist page). `lib/stripe/refunds` + `config` stay (admin refunds, support, AI tools). `lib/email/queue.ts` stays (cron, admin marketing). `app/api/orders/route.ts` POST still uses `lib/checkout/server-pricing.ts`.
- `app/api/cart-reservations`, `app/api/stripe/payment-intent`, `app/api/orders/express` have no callers after the page deletions.
- Nothing calls `revalidateTag` or sets cookies today; `await cookies()` is the repo convention.
- `NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD` is read nowhere; "$75" is hard-coded in four storefront strings and legacy logic uses 100.
- Legacy storefront tests that pin Phase 2 placeholders: `pdp.test.tsx` (`data-phase="3"`), `header.test.tsx` ("Cart, N items"), `footer.test.tsx` (`cartCount` pass-through), `navigation-{dropdown,search,wordmark,mobile-menu-cart-widget}.test.tsx` (mock `@/lib/store/cart`).
- `/products/nope` returns 200 with the not-found UI because `loading.tsx` streams the shell first (pre-existing, Phase 5 may move `notFound()` ahead of the suspense boundary).

---

## Task 1: Cart documents, normaliser, fixture

**Files:** `lib/shopify/queries/cart.ts`, `lib/shopify/types.ts`, `lib/shopify/queries/index.ts`, `tests/fixtures/shopify/cart.json`, `tests/unit/shopify/cart-query.test.ts`, `scripts/shopify/lib/fixture-queries.ts`, `tests/fixtures/shopify/README.md`

- [x] Fixture: hand-author `cart.json` as the raw `cart` object (two lines: Core Hoodie Taupe/M qty 1 at 88.0 and Signature Tee Black/L qty 1 at 24.0 with compare-at 34.0 and a `MERCHANDISE_NOT_ENOUGH_STOCK`-style `quantityAvailable: 1`; `discountCodes: [{ code: "GOLD15", applicable: true }]`; cart-level `discountAllocations` 16.8; `cost.subtotalAmount` 112.0, `totalAmount` 95.2; `checkoutUrl` `https://tgqucm-qg.myshopify.com/cart/c/Z2NwLXVzLWVhc3QxOjAx…?key=…`; `buyerIdentity.email` null; product `maxPerOrder` metafield `{ value: "2" }` on the crew, null on others). Document in the README that cart fixtures are mutation-produced and cannot be recorded by the recorder.
- [x] Failing tests: `normalizeCart` maps every field in the contract (money via `toMoney`, images via `toImage`, `maxPerOrder` parsed to number or null, line `discount` summed or null, cart `cost.discount` summed or null, `buyer`); each helper sends the right document + variables with `revalidate: false`; `userErrors` → thrown `ShopifyError` with `userErrors`; `getCartById` returns null on `cart: null`; `createCart` passes `lines`/`note`/`discountCodes` only when given.
- [x] Implement. Green, typecheck, lint.

## Task 2: Cookie, Server Actions, shipping constant

**Files:** `lib/shopify/cart/cookie.ts`, `app/(storefront)/_actions/cart.ts`, `lib/storefront/shipping.ts`, `tests/unit/storefront/cart-actions.test.ts`, `tests/unit/storefront/shipping.test.ts`

- [x] Failing tests (mock `next/headers` `cookies` with an in-memory jar; mock `@/lib/shopify/queries/cart` and `@/lib/shopify/env`): `getCartAction` with no cookie → null and no fetch; with cookie → `getCartById`; expired (null) → clears cookie; `addCartLine` with no cookie → `createCart({ lines })` + `writeCartId`; with cookie → `addCartLines`; quantity defaults 1, invalid variantId → `{ ok:false }` without fetch; **max-per-order cap**: returned line with `product.maxPerOrder = 2` and quantity 3 → `updateCartLines` to 2 + `warning`; **stock cap**: `quantityAvailable` 1 and quantity 2 → updates to 1 + warning; `updateCartLine` quantity 0 → `removeCartLines`; `applyDiscountCode` merges with existing codes, non-applicable → removed again + `{ ok:false, cart }`; `removeDiscountCode`; `updateCartNoteAction` trims; thrown `ShopifyError` → friendly `{ ok:false }` and `console.error` with message only; unconfigured env → `{ ok:false, error: 'Cart unavailable' }` for every action and `null` for `getCartAction`; `addCartLineForm` reads `variantId`/`quantity` from `FormData`. `shipping.ts`: threshold from env with 75 default; `freeShippingProgress` remaining/ratio/unlocked, clamps at 1.
- [x] Implement. `cookie.ts` is `server-only`. Green, typecheck, lint.

## Task 3: Checkout branding script + Shopify checklist

**Files:** `scripts/shopify/lib/checkout-branding-input.ts`, `scripts/shopify/checkout-branding.ts`, `tests/unit/scripts/shopify-checkout-branding.test.ts`, `docs/superpowers/plans/2026-09-06-storefront-rebuild-phase3-shopify-checklist.md`

- [x] `checkout-branding-input.ts` (pure): `export const CHECKOUT_BRANDING_INPUT` = a `CheckoutBrandingInput` for the storefront look: `designSystem.colors.global { brand: "#0A0A0A", accent: "#FF3131", success: "#1E7F4F", critical: "#B3261E" }`, `colors.schemes.scheme1` base `background "#F7F5F2"` / `text "#0A0A0A"`, `primaryButton` background `#0A0A0A` text `#F7F5F2` hover `#3D3D3D`, `control` background `#FFFFFF` border `rgba→#D9D5D0`; `designSystem.cornerRadius { base: 2, small: 2, large: 2 }`; `typography.primary.shopifyFontGroup { name: "Inter" }` and `secondary.shopifyFontGroup { name: "Archivo" }`; `customizations.headingLevel1.typography { font: SECONDARY, weight: BOLD, letterCase: UPPER }`, `headingLevel2` same, `primaryButton.cornerRadius: BASE`, `global.cornerRadius: NONE`, `header.alignment: START`, `merchandiseThumbnail.border: NONE`, `cartLink.visibility: VISIBLE`. Introspect every input type with the Shopify schema tool before writing it (field names must be exact; this file is the only place the storefront palette appears outside tokens.css and is exempt from the no-hex lint rule by path). Export `toBrandingVariables(profileId)`.
- [x] `checkout-branding.ts` (CLI, dotenv `.env.shopify`, `--dry-run` default): `checkoutProfiles(first: 5)` → pick `isPublished`; `--apply` runs `checkoutBrandingUpsert` (validated 2026-10-10; Shopify marks it deprecated but it is the available mutation for this API version) and prints `userErrors` or "applied to <profile name>". Also prints the human checklist from the doc.
- [x] Checklist doc (human, no API): enable **Bogus Gateway** (Settings → Payments → "(for testing) Bogus Gateway"), enable **Shop Pay** on the Headless storefront, upload the logo under Checkout customization (API cannot upload files on trial), confirm the checkout's "Continue shopping" target, and the Phase 1 Task 0 tokens.
- [x] Test: the input object has the keys above and only hex/enum values; `toBrandingVariables` shape. Green, lint (`scripts/shopify` paths are exempt from the storefront hex rule — verify the eslint config scoping, do not widen it).

## Task 4: CartProvider, badge, layout wiring

**Files:** `components/storefront/cart/{CartProvider,useCart,CartBadge}.tsx`, `components/storefront/layout/{Header,StorefrontShell}.tsx`, `app/(storefront)/layout.tsx`, `tests/unit/storefront/cart-provider.test.tsx`, `tests/unit/storefront/{header,footer}.test.tsx` (update)

- [x] Failing tests (inject fake `actions`): mounts → calls `getCart` once → `status: 'ready'`, `count = totalQuantity`; `available: false` → `'unavailable'`, no call; `addLine` → calls `addCartLine`, replaces cart, opens the drawer, sets `warning` when returned; `updateLine` is optimistic (count/quantity change before the promise resolves) and rolls back on `{ ok:false }` with `error` set; `removeLine` optimistic; `applyCode` error surfaces `error` and keeps the returned `cart`; `clearMessages`; `useCart` throws outside the provider; `CartBadge` shows `fallbackCount` while loading then the live count; Header's cart button opens the drawer (`aria-haspopup="dialog"`, `aria-expanded`), label "Cart, N items".
- [x] Implement: `useOptimistic` for lines + `useTransition`; the provider renders `{children}` only (the drawer mounts in T5 and is rendered by the Header next to `MobileMenu`/`SearchDialog`, reading `open` from context). `StorefrontShell` keeps `cartCount` as the SSR fallback passed to `CartBadge`. `app/(storefront)/layout.tsx` wraps `StorefrontShell` in `<CartProvider available={hasShopifyEnv()}>` and uses `FREE_SHIPPING_COPY` for the announcement. Green; footer/header suites updated, not deleted.

## Task 5: Cart drawer and parts

**Files:** `components/storefront/cart/{CartDrawer,CartLineItem,CartLines,CartSummary,FreeShippingBar,DiscountCodeForm,CheckoutButtons,EmptyCart,index}.tsx`, `styles/storefront/tokens.css` (`--color-shoppay`), `tests/unit/storefront/cart-drawer.test.tsx`, `tests/unit/storefront/tokens.test.ts` (add the token)

- [x] Failing tests (render inside a `CartProvider` with fake actions and the `cart.json` fixture via `normalizeCart`): drawer `role="dialog"` named "Cart (2)"; lines render image/title link/options/price; stepper calls `updateLine` with the new quantity and disables + at `quantityAvailable`/`maxPerOrder`; Remove calls `removeLine`; `FreeShippingBar` shows "$X away" vs "unlocked" with `role="progressbar"` `aria-valuenow`; `DiscountCodeForm` submits `applyCode`, shows the error inline (`role="alert"`), chips remove via `removeCode`; summary rows (subtotal, discount, estimated total, Care Points copy); `CheckoutButtons` hrefs (`checkoutUrl`, Shop Pay with `payment=shop_pay`), Checkout disabled when a line is unavailable; empty cart state; `aria-busy` while pending; `warning` renders as `role="status"`.
- [x] Implement per the UI contract; `Drawer`'s `footer` slot holds summary + buttons; on mobile the footer is sticky by the primitive. Green, lint (no hex; Shop Pay via `bg-shoppay`).

## Task 6: Wire the PDP

**Files:** `components/storefront/pdp/{AddToCartPanel,StickyBuyBar,DetailsAccordion}.tsx`, `app/(storefront)/products/[handle]/page.tsx`, `app/(storefront)/page.tsx` (marquee copy → `FREE_SHIPPING_COPY`), `tests/unit/storefront/pdp.test.tsx` (update)

- [x] Failing tests: `AddToCartPanel` inside `CartProvider` → submitting calls `addLine({ variantId, quantity })` and NOT the form action (preventDefault); outside a provider (or `status: 'unavailable'`) → button disabled with `data-phase="unconfigured"`; while pending → `aria-busy` + "Adding…"; after success → button reads "Added ✓" for 2s then "Add to cart" (timer; test with fake timers); sold out unchanged; `StickyBuyBar` submits the buy-box form (`requestSubmit`) instead of only scrolling, mirrors pending/added state; helper copy uses `FREE_SHIPPING_COPY`; page passes `action={addCartLineForm}`-based no-JS fallback (the form's `action` is a `'use server'` wrapper) and no longer passes `disabled` to the sticky bar unconditionally.
- [x] Implement with `useCartOptional()`; keep the `action` prop and hidden inputs for no-JS. Green; remove every `data-phase="3"` assertion.

## Task 7: `/cart` page, legacy removal, rewires, redirects

**Files:** `app/(storefront)/cart/page.tsx`, `components/storefront/cart/{CartPage,CartNoteForm}.tsx`, `tests/unit/storefront/cart-page.test.tsx`; deletions per File structure; `components/layout/Navigation.tsx`, `components/layout/MobileBottomNav.tsx`, `app/wishlist/page.tsx`; `tests/unit/navigation-*.test.tsx`, `tests/unit/wishlist-page-modernized.test.tsx`; `next.config.ts`, `tests/unit/storefront/redirects.test.ts`

- [x] `/cart`: `dynamic = 'force-dynamic'`; unconfigured → `CatalogUnavailable`; reads the cookie via `getCartAction()` and renders `<CartProvider initialCart={cart}>` (nested provider is fine; it seeds state) → `CartPage` (client): `Display` "Your cart", table of `CartLineItem`s (wider variant), `CartNoteForm` (`useActionState` over `updateCartNoteAction`, debounced save on blur), `CartSummary` + `DiscountCodeForm` + `CheckoutButtons` in a sticky aside, payment icons row (text badges), policy links; empty state. Metadata title "Cart", `robots: { index: false }`.
- [x] Rewire: `Navigation.tsx` → remove `useCartStore`/`MiniCart`; cart button becomes `<Link href="/cart">` without a count. `MobileBottomNav.tsx` → `/cart` tab without the count (keep `data-testid="mobile-nav-cart-count"` absent; update its test to assert the link). `app/wishlist/page.tsx` → quick-add/bulk-add replaced by links to `/products/<slug>` (handles = slugs); update `wishlist-page-modernized.test.tsx`. Remove stale `vi.mock('@/lib/store/cart')` from the navigation tests.
- [x] Delete the legacy files (grep rule; cascade one level; report kept files). Redirects: `/checkout` → `/cart`, `/order/confirmation` → `/orders` (permanent) + test.
- [x] Full unit suite green, typecheck, lint, admin subset green.

## Task 8: Mock-backed e2e

**Files:** `tests/e2e/mock/storefront-mock.mjs`, `tests/e2e/storefront-cart.spec.ts`, `tests/e2e/storefront-catalog.spec.ts` (unskip PDP), `tests/e2e/playwright.config.ts`, `.github/workflows/ci.yml`

- [x] Port the demo mock (`scratchpad/demo/mock-storefront.mjs`, catalog ops from fixtures) into the repo and add **in-memory cart ops** (`CartCreate`, `CartLinesAdd/Update/Remove`, `CartDiscountCodesUpdate` with `GOLD15` applicable and everything else not, `CartNoteUpdate`, `CartById`), computing costs from the fixture prices; `checkoutUrl` = `https://tgqucm-qg.myshopify.com/checkouts/cn/mock-<id>`. HTTP (not HTTPS) on 127.0.0.1:4443 — `storefrontFetch` builds `https://…`; add `SHOPIFY_STOREFRONT_INSECURE_LOCAL=1` support in `lib/shopify/client.ts` that switches the scheme to `http` for `localhost`/`127.0.0.1` domains only (test-only switch, documented). Images: mock serves `/s/files/**` from `public/assets`; the e2e allow-list ignores `/_next/image` failures for `cdn.shopify.com` (the optimizer cannot reach the fake host in CI) — do not add hosts entries.
- [x] `playwright.config.ts`: start the mock as a second `webServer`; env for the dev server `SHOPIFY_STORE_DOMAIN=127.0.0.1:4443`, tokens `mock`, `SHOPIFY_STOREFRONT_INSECURE_LOCAL=1`, placeholder `AUTH_SECRET`. CI job no longer needs Shopify secrets (keep `continue-on-error: true` this phase).
- [x] `storefront-cart.spec.ts`: PDP add → drawer opens with the line and count badge 1; stepper to 2 → subtotal updates; apply `GOLD15` → discount row; apply `NOPE` → inline error; Remove → empty state; `/cart` page renders the same cart from the cookie; Checkout link href matches `/checkouts/`; mobile: sticky bar add → drawer; no console errors beyond the allow-list. Unskip the catalog PDP tests.

## Task 9: Verification + QA report (orchestrator)

- [ ] `npm run test:run`, `npx tsc --noEmit`, `npx eslint` storefront paths, `npm run test:e2e`, `npx next build` stages, admin subset. Re-run the demo mock (now the repo mock) for drawer/cart screenshots.
- [ ] `phase3-qa.md`: results, deviations, human checklist (Task 3 doc, Bogus order through the preview, Shop Pay visible, abandoned-checkout email arrives from Shopify).

---

## Definition of done (Phase 3)

- Add to cart from the PDP (with and without JS) creates/updates a Shopify cart held in `hof_cart`; the drawer opens with optimistic lines; quantity, remove, discount codes and notes round-trip; Checkout and Shop Pay link to Shopify; the free-shipping bar and Care Points preview use the shared threshold.
- `/cart` works from a fresh request with only the cookie.
- Legacy cart/checkout pages, store, components, dead APIs and their tests are gone; `Navigation`, `MobileBottomNav` and the wishlist page no longer import the cart store; Stripe webhook/refunds, email queue and order routes are untouched.
- Mock-backed e2e covers the cart flow and runs in CI without Shopify secrets; unit suite, typecheck, lint, admin subset green.
- Phase 4 can attach `customerAccessToken` via `updateCartBuyerIdentity` and switch the Care Points preview to the real tier without touching the drawer.
