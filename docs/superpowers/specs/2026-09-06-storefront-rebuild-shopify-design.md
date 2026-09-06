# Storefront Rebuild on Shopify — Design Spec

**Status:** Draft for review (brainstorm output, 2026-09-06). Decisions below are recommendations; the ones marked **OPEN** need a call from Nando before the matching phase starts. Phase 1 can begin on the recommendations as written.

**Scope:** Rebuild the customer-facing site from scratch on Shopify (Storefront API + Customer Account API + Shopify Checkout) and replace the entire storefront design system. The admin V2 rebuild (`docs/superpowers/specs/2026-05-30-admin-rebuild-*.md`) is out of scope and must keep working throughout.

**Store:** `tgqucm-qg.myshopify.com` (name "My Store", theme Horizon, 0 products, 1 empty collection). Plan: trial — the store must be upgraded before it can accept real payments; nothing in this spec depends on that until Phase 3 (checkout QA).

---

## 1. Why

The current storefront is a hand-rolled commerce stack: 72 Prisma models, custom cart with reservations, a Stripe checkout, NextAuth credentials auth, custom order/fulfillment, gift cards, promotions, abandoned-cart tracking, and a thick admin. Most of that is commodity work that Shopify does better and keeps compliant (PCI, taxes, Shop Pay, fraud, fulfillment apps). The brand-specific parts — loyalty, drops, community/reviews, Reggie AI, support — are what deserve custom code.

The storefront styling has also drifted: three fonts (Inter, Allura, Harlow), hardcoded hex colours alongside `@theme` tokens, scroll-jacking animation utilities, a glassmorphism admin token set living in the same `globals.css`, and a 1,200-line `Navigation.tsx`. A rebuild is cheaper than a migration.

## 2. Decisions table

| # | Decision | Choice | Alternatives considered |
|---|---|---|---|
| 1 | Architecture | **A — Headless Next.js on Shopify.** Keep this repo, Next.js 16 App Router, Vercel. Shopify owns catalog, cart, checkout, orders, customers, discounts. | B: Liquid theme (Horizon) — abandons Next.js, admin, loyalty. C: Hydrogen on Oxygen — new framework + host, no gain over Next.js for this team. |
| 2 | Where the new code lives | **Same repo, in-place replacement.** New namespaces `lib/shopify/`, `components/storefront/`, `styles/storefront/`. Legacy storefront routes are replaced path-by-path; legacy code is deleted at cutover (Phase 6), not kept behind flags. | New repo (cleanest, but forks loyalty/admin/support; rejected). Feature-flag dispatchers like admin V2 (two `page.tsx` per path is not possible in one route tree; rejected). |
| 3 | Integration strategy | **Long-lived integration branch `storefront-v2`** with Vercel preview. Wave PRs merge into it; one cutover PR merges it to `main`. `main` stays deployable throughout. | Ship each phase straight to `main` behind `NEXT_PUBLIC_STOREFRONT_V2` (needs duplicate routes; rejected). |
| 4 | Source of truth per domain | See §4 ownership matrix. Short version: **Shopify for commerce, Prisma for brand extras** (loyalty, drop early access, reviews, support, AI). | Everything in Shopify (loses loyalty ledger and drops). Everything in Prisma (status quo). |
| 5 | Checkout | **Shopify Checkout via `cart.checkoutUrl`** + Shop Pay button on PDP/cart. Custom Stripe checkout is removed. | Keep Stripe checkout with Shopify catalog (double-books orders; rejected). |
| 6 | Customer auth | **Shopify Customer Account API** (passwordless OAuth/PKCE, hosted login). NextAuth credentials, email verification, and password reset routes are removed for customers. Admin login is unchanged. | Keep NextAuth + link to Shopify customer by email (two identities, two sessions; rejected). **OPEN 6a:** Customer Account API needs a public HTTPS callback; local dev uses a tunnel. Confirm the storefront domain (`headoverfeels.com`?) before Phase 4. |
| 7 | Cart state | **Server-owned Shopify cart.** Cart ID in an httpOnly cookie, mutations through Server Actions, `useOptimistic` for the drawer. Zustand cart store, cart reservations, and `/api/cart-reservations` are removed. | Client-side `CartProvider` from hydrogen-react (works, but pushes tokens and logic to the browser). |
| 8 | Data fetching | `@shopify/storefront-api-client` with the **private** Storefront token on the server; hand-written typed GraphQL fragments in `lib/shopify/queries/`; Next `fetch` cache with tags; webhook-driven `revalidateTag`. Storefront API version pinned to **2026-07**. | GraphQL codegen (`@shopify/hydrogen-codegen`) — deferred; add when fragments stabilise. |
| 9 | Loyalty integration | **Keep the Prisma loyalty program.** Points accrue from the `orders/paid` webhook; redemptions mint single-use Shopify discount codes via Admin API (`discountCodeBasicCreate`) and are applied with `cartDiscountCodesUpdate`. Customer identity key becomes the Shopify customer GID (new `Customer.shopifyCustomerId` column). | Shopify loyalty app (Smile etc.) — replaces already-built tiers/referrals; **OPEN 9a** if you would rather buy than keep. |
| 10 | Drops | Drop = Shopify product with `custom.drop_start`, `custom.drop_end`, `custom.max_per_order` metafields and a scheduled Online Store/Headless publish date. Countdown and sold-out states render from metafields. **Early access** stays in Prisma (`EarlyAccessGrant`) and is enforced server-side: the PDP add-to-cart action refuses before `drop_start` unless the signed-in customer holds a grant. | Shopify Functions cart validation (needs a deployed custom app; **OPEN 10a** — worth it if drops are the core business). |
| 11 | Reviews | **Keep Prisma reviews**, re-keyed from `productId` to Shopify product handle. Existing rows migrate with the catalog. | Judge.me / Shopify Product Reviews app (loses existing data, adds a widget we don't style). |
| 12 | Search | Storefront API `predictiveSearch` (header) and `search` (results page) with Shopify filters. Custom search modal/API removed. | Algolia — unnecessary at this catalog size. |
| 13 | Content pages & policies | About/Contact are Next.js pages with copy in code (MDX not needed). Privacy/Terms/Refund/Shipping come from `shop.privacyPolicy`, `shop.termsOfService`, `shop.refundPolicy`, `shop.shippingPolicy` so legal text is edited in Shopify admin. | Shopify Pages via Storefront API `pages` — fine later; not needed for v1. |
| 14 | Transactional email | Shopify sends order confirmation, shipping, and abandoned-checkout emails. Resend stays for loyalty, drop alerts, newsletter, and support. Custom order-email templates and the email queue for orders are removed. | Keep all email custom (double emails; rejected). |
| 15 | Wishlist | Anonymous: `localStorage`. Signed in: Prisma `WishlistItem` keyed by Shopify customer GID + variant GID. | Shopify wishlist app. |
| 16 | Admin surface | **Shopify admin becomes the operations tool** for products, inventory, orders, fulfillment, customers, discounts, gift cards, analytics. `/admin` keeps only brand extras (loyalty, drops config, support, marketing popups, newsletter, Reggie). Retiring the duplicated admin pages is a separate spec after cutover. | Keep syncing Shopify → Prisma to feed the existing admin (double source of truth; rejected). |
| 17 | Design system | **Full replacement**, see §5. One look (no dark mode on the storefront). Tokens live in `styles/storefront/tokens.css`; admin V2 tokens move to `styles/admin/tokens.css`; `app/globals.css` imports both. | Incremental token migration (the current plan in `globals.css` comments; too slow). |
| 18 | Testing | Vitest + RTL for components and `lib/shopify` (mocked fetch fixtures recorded from the real store). Playwright smoke: home → PLP → PDP → add to cart → `checkoutUrl` reachable. | — |
| 19 | Catalog migration | One-shot script `scripts/shopify/migrate-catalog.ts` (Prisma → `productSet`), idempotent by SKU, run against the trial store now and again before cutover. | Manual entry in Shopify admin (error-prone; catalog has variant images and colour hexes). |
| 20 | Legacy orders & customers | Customers are created in Shopify by email (`customerCreate`) before cutover so loyalty balances can be linked. Historical orders stay in Prisma and are shown read-only under Account → "Earlier orders". | Import history via Admin API `orderCreate` (possible; **OPEN 20a**, adds Shopify order volume without payments). |

## 3. Architecture

```
Browser
  │  RSC / Server Actions
  ▼
Next.js 16 (Vercel)
  ├── app/(storefront)/**            ← new customer routes (this spec)
  ├── app/admin/**                   ← untouched
  ├── app/api/webhooks/shopify       ← HMAC-verified: orders/paid, orders/fulfilled,
  │                                    products/update, collections/update, customers/update
  ├── lib/shopify/
  │   ├── client.ts                  ← storefrontFetch(query, vars, {tags, cache})
  │   ├── admin-client.ts            ← server-only Admin API for discount codes + migration
  │   ├── queries/*.ts               ← typed fragments (product, collection, cart, search, shop)
  │   ├── cart/actions.ts            ← Server Actions: addLine, updateLine, removeLine, applyCode
  │   ├── customer/                  ← Customer Account API OAuth + session (Phase 4)
  │   └── types.ts
  ├── lib/loyalty/** (existing)      ← now keyed by shopifyCustomerId
  └── prisma (reduced)               ← loyalty, drops early access, reviews, support, AI, popups, newsletter
        ▲
        │ webhooks
Shopify ─┴─ catalog · inventory · cart · checkout · orders · customers · discounts · policies
```

### Request flow examples

- **PDP** (`/products/[handle]`): RSC calls `getProduct(handle)` (Storefront API, cached with tag `product:<handle>`), plus `getReviewSummary(handle)` from Prisma. Variant selection is URL-state (`?Size=M&Color=Black`) so links are shareable and no client store is needed.
- **Add to cart**: form posts to `addCartLine` Server Action → reads cart cookie → `cartLinesAdd` (or `cartCreate`) → sets cookie → `revalidateTag('cart')` → returns new cart for `useOptimistic` reconciliation.
- **Checkout**: cart drawer "Checkout" is a plain link to `cart.checkoutUrl`. If the customer is signed in, `cartBuyerIdentityUpdate` has already attached their `customerAccessToken` so checkout is pre-filled.
- **Order paid**: Shopify webhook → verify HMAC → look up `Customer` by `shopifyCustomerId` (fallback email) → `awardPointsForOrder` → Resend "points earned" email.
- **Product edited in Shopify admin**: `products/update` webhook → `revalidateTag('product:<handle>')` and `revalidateTag('collections')`.

### Environment

```
SHOPIFY_STORE_DOMAIN=tgqucm-qg.myshopify.com
SHOPIFY_STOREFRONT_API_VERSION=2026-07
SHOPIFY_STOREFRONT_PRIVATE_TOKEN=          # server only (Headless channel)
NEXT_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN=  # Shop Pay button + predictive search only
SHOPIFY_ADMIN_ACCESS_TOKEN=                # custom app: write_products, write_discounts, read_customers, write_customers, read_orders
SHOPIFY_WEBHOOK_SECRET=
SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID=        # Phase 4
SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID=          # Phase 4
NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD=75
```

Prerequisites that must be done in Shopify admin by a human (no API for them): install the **Headless** sales channel and create a storefront (yields the two Storefront tokens); create a custom app for the Admin token with the scopes above; set the primary location, shipping profile, and taxes; upgrade the plan before checkout QA.

## 4. Data ownership matrix

| Domain | Today | After | Notes |
|---|---|---|---|
| Products, options, variants, images, prices, compare-at | Prisma `Product`, `ProductVariant` | **Shopify** | Options: Size, Color. `colorHex` → variant metafield `custom.color_hex`. `materials`, `careGuide` → product metafields `custom.materials`, `custom.care_guide` (rich text). |
| Categories | Prisma `Category` | Shopify **product type** + one automated collection per type | Nav reads collections, not categories. |
| Collections | Prisma `Collection`, `CollectionProduct` | **Shopify** collections (manual, ordered) | `isFeatured` → metafield `custom.featured` boolean. |
| Inventory | `ProductVariant.inventory` | **Shopify** inventory at primary location | `inventorySetQuantities` during migration. |
| Drops | `isLimitedEdition`, `releaseDate`, `dropEndDate`, `maxQuantity` | Shopify metafields `custom.drop_start`, `custom.drop_end`, `custom.max_per_order` + tag `drop` | Early access grants stay in Prisma. |
| Cart | Prisma `CartItem`, `CartReservation`, Zustand | **Shopify cart** | Reservations removed; Shopify holds inventory at checkout. |
| Checkout, payment, tax, shipping rates | Stripe + custom | **Shopify Checkout** | Stripe SDK removed from storefront. |
| Orders, fulfillment, tracking, returns, refunds | Prisma `Order`, `Return`, `RefundRecord`, EasyPost | **Shopify** | Legacy rows stay read-only for history. Admin fulfillment pages (V1/V2) are retired in a later spec. |
| Customers, addresses | Prisma `Customer`, `Address`, NextAuth | **Shopify customers** + Customer Account API | Prisma `Customer` keeps a slim row: `shopifyCustomerId`, loyalty fields, preferences. |
| Discounts, coupons, gift cards, promotions | Prisma `Promotion`, `GiftCard`, coupons API | **Shopify** | Loyalty reward → Shopify discount code (Admin API). |
| Loyalty tiers, points, rewards, referrals | Prisma | **Prisma** (unchanged logic) | Trigger = `orders/paid` webhook. |
| Reviews | Prisma `Review` | **Prisma**, keyed by product handle | |
| Wishlist | Prisma `WishlistItem` | Prisma (signed in) + localStorage (guest) | keyed by variant GID |
| Support tickets, live chat | Prisma | **Prisma** | unchanged |
| Newsletter, popups | Prisma | **Prisma** | unchanged; revisit Shopify Email later |
| Abandoned carts | Prisma `AbandonedCart` + cron | **Shopify** abandoned checkouts | custom cron removed |
| Back-in-stock | Prisma | **Prisma**, keyed by variant GID; trigger from `inventory_levels/update` webhook | |
| Reggie AI | Prisma conversations; tools read Prisma catalog | Prisma conversations; tools read **Storefront API** | tool executor swap only |
| Avatar system | Prisma | Prisma | untouched; **OPEN 21:** keep or retire from storefront nav |

## 5. Design system (full replacement)

Direction: **editorial streetwear**. High-contrast ink on bone, one signal colour, oversized condensed headlines, product photography does the work. No gradients, no glass, no scroll-jacking. Motion is quick and physical.

### 5.1 Tokens (`styles/storefront/tokens.css`, Tailwind v4 `@theme`)

```css
@theme {
  /* Colour — the only hex values allowed in the storefront */
  --color-ink: #0A0A0A;            /* text, primary buttons, header on scroll */
  --color-ink-soft: #3D3D3D;       /* secondary text */
  --color-ink-mute: #6F6F6F;       /* captions, placeholders */
  --color-bone: #F7F5F2;           /* page background */
  --color-paper: #FFFFFF;          /* cards, drawers */
  --color-line: rgb(10 10 10 / 0.12);
  --color-line-strong: rgb(10 10 10 / 0.32);
  --color-signal: #FF3131;         /* brand red: sale, drops, focus, one CTA per view */
  --color-signal-ink: #FFFFFF;
  --color-rose: #CDA09B;           /* heritage mauve, demoted to tints/eyebrows */
  --color-rose-tint: rgb(205 160 155 / 0.18);
  --color-ok: #1E7F4F;
  --color-warn: #B26B00;
  --color-danger: #B3261E;

  /* Type */
  --font-display: var(--font-archivo), "Archivo", "Arial Narrow", sans-serif;  /* 800–900, uppercase, tight */
  --font-body: var(--font-inter), "Inter", system-ui, sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, monospace;                       /* prices, SKUs, timers */
  --text-display-xl: clamp(3rem, 8vw, 7.5rem);
  --text-display-lg: clamp(2.25rem, 5vw, 4.5rem);
  --text-display-md: clamp(1.75rem, 3vw, 2.75rem);
  --tracking-display: -0.03em;
  --tracking-eyebrow: 0.14em;

  /* Space & shape */
  --spacing-gutter: clamp(1rem, 3vw, 2.5rem);
  --spacing-section: clamp(3.5rem, 8vw, 8rem);
  --container-shop: 90rem;         /* 1440px */
  --radius-none: 0;
  --radius-sm: 2px;                /* buttons, inputs, cards — sharp */
  --radius-pill: 999px;            /* chips only */

  /* Motion */
  --duration-fast: 120ms;
  --duration-base: 200ms;
  --duration-slow: 360ms;
  --ease-out: cubic-bezier(0.2, 0.7, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.3, 0.64, 1);
}
```

Rules: no hex outside this file (lint rule `no-restricted-syntax` on `#[0-9a-f]{3,6}` under `components/storefront` and `app/(storefront)`); `prefers-reduced-motion` disables all non-essential motion; focus rings are `2px solid var(--color-signal)` with `2px` offset everywhere.

Fonts: **Archivo** (variable, `next/font/google`, weights 500–900, `font-stretch` 75–100 for condensed display) + **Inter** (variable). Allura and Harlow are retired; the logo is the wordmark PNG/SVG asset. Prices, countdowns, and order numbers render in tabular mono.

### 5.2 Primitives (`components/storefront/ui/`)

| Component | Notes |
|---|---|
| `Button` | variants `ink` (default), `signal`, `outline`, `ghost`, `link`; sizes `sm` `md` `lg`; `loading` and `asChild`. cva. |
| `IconButton` | 44px min hit target; `label` required. |
| `Badge` | `sale`, `drop`, `new`, `soldout`, `neutral`. Uppercase eyebrow type. |
| `Price` | `amount`, `compareAt?`, `currencyCode`; strikes compare-at; uses `Intl.NumberFormat`. |
| `Eyebrow`, `Display`, `Prose` | typographic wrappers so pages never set font classes ad hoc. |
| `Container`, `Section` | gutter + section rhythm from tokens; `Section` takes `tone="bone|paper|ink"`. |
| `ProductCard` | 4:5 image, second image on hover/focus, title, price, colour swatch dots, quick-add on hover (desktop) / always (touch); sold-out overlay. |
| `ProductGrid` | 2 / 3 / 4 columns; supports `loading` skeleton count. |
| `Drawer` | right-side, used by cart and mobile menu; focus trap, `inert` background, ESC. |
| `Dialog`, `Accordion`, `Tabs` | headless, Radix where already a dependency (`react-slot`), otherwise native `<dialog>` and `<details>`. |
| `Input`, `Select`, `Checkbox`, `QuantityStepper` | form primitives with error slot. |
| `Skeleton`, `Spinner`, `Marquee`, `AnnouncementBar`, `Toast` (sonner restyled) | |

### 5.3 Layout

- **Header**: 64px, transparent over hero and inverts to bone/ink after 24px scroll; left logo, centre primary nav (Shop · Collections · Drops · Loyalty · About), right search / account / cart with count. Mobile: logo + menu + cart; menu opens a full-height `Drawer`.
- **Mega-menu**: replaced by a two-level flyout per primary item (collections list + one featured image). Nav data comes from a Shopify **menu** (`menu(handle: "main-menu")`) so it is editable in Shopify admin.
- **Footer**: four columns (Shop, Help, Company, Newsletter), policies row reads from Shopify policies.
- **Mobile bottom nav**: removed. Cart and menu are reachable from the header; PDP gets a sticky add-to-cart bar.
- **Page rhythm**: every page is `Section` blocks; no bespoke margins.

### 5.4 Key pages

| Route | Composition |
|---|---|
| `/` | `Hero` (single still image or video, display headline, one signal CTA) → `Marquee` (drop or promo) → `CollectionTiles` (3 up, from featured collections) → `ProductRail` "New in" → `DropSpotlight` (only when a drop is live or scheduled) → `ProductRail` "Best sellers" (`collection(handle:"best-sellers")`) → `Editorial` (brand story split) → `Reviews` strip → `Newsletter` → footer |
| `/collections` | grid of collection tiles with product counts |
| `/collections/[handle]` | header with description, filter rail (Shopify filters: availability, price, size, colour, product type), sort, `ProductGrid` with cursor pagination |
| `/products` | alias of `collections/all` |
| `/products/[handle]` | gallery (thumb rail + zoom), title/price, variant selectors (colour swatches from `custom.color_hex`, size chips with sold-out strike), quantity, add to cart + Shop Pay, details accordion (description, materials, care, shipping/returns from policies), reviews, "Complete the look" from `productRecommendations` |
| `/search?q=` | results with same grid and filters |
| `/cart` | full-page cart (drawer is primary) with free-shipping progress, discount code, notes |
| `/drops`, `/drops/[handle]` | list of drop-tagged products; drop page = PDP with countdown state machine (upcoming · early-access · live · ended) |
| `/account/*` | Customer Account API: overview, orders, order detail (tracking), addresses, profile, loyalty summary link |
| `/loyalty/*` | existing pages re-skinned on the new primitives |
| `/wishlist` | grid with move-to-cart |
| `/pages/about`, `/pages/contact` | content pages |
| `/policies/[handle]` | privacy, terms, refund, shipping from Shopify |

Removed routes (redirects in `next.config.ts`): `/checkout` → `/cart`; `/signin`, `/forgot-password`, `/reset-password`, `/verify-email` → `/account/login`; `/order/confirmation` → `/account/orders`; `/orders/*` → `/account/orders/*`; `/profile` → `/account`.

## 6. Phases

| Phase | Deliverable | Plan doc |
|---|---|---|
| **1 Foundation** | Store prerequisites checklist, metafield definitions, catalog migration script + first run, `lib/shopify` client + queries + fixtures, tokens + primitives, header/footer shell, integration branch + preview | `plans/2026-09-06-storefront-rebuild-phase1-foundation.md` |
| 2 Catalog | Home, collections, PLP with filters, PDP, search, policies pages | next |
| 3 Cart & checkout | Cart cookie + actions + drawer + `/cart`, discount codes, Shop Pay, free-shipping bar, checkout handoff QA (needs plan upgrade) | |
| 4 Accounts & loyalty | Customer Account API login, account pages, webhooks, loyalty on `orders/paid`, redemption → discount codes, wishlist, customer pre-creation script | |
| 5 Drops, reviews, content | Drop state machine + early access, reviews re-key, about/contact, SEO (sitemap from Shopify, JSON-LD), analytics | |
| 6 Cutover & decommission | Redirect map, delete legacy storefront routes/components/APIs/Stripe/cart-reservations/order emails, prune Prisma models + migration, env cleanup, domain switch, merge `storefront-v2` → `main` | |

Each phase gets its own plan in the repo's writing-plans format and is executed wave-by-wave with subagents, matching how admin V2 phases 4–9 were shipped.

## 7. Catalog migration (Phase 1 script, re-run before cutover)

`scripts/shopify/migrate-catalog.ts --dry-run | --apply`:

1. Read active `Product` + `ProductVariant` + `Category` + `Collection` from Prisma.
2. For each product build a `productSet` input: `handle = slug`, `title`, `descriptionHtml`, `productType = category.name`, `tags` (`drop` when `isLimitedEdition`, `featured`, `new-arrival`), `productOptions` Size/Color from distinct variant values, `variants[]` with `sku`, `price`, `compareAtPrice`, `inventoryQuantities` at primary location, `optionValues`, `metafields[custom.color_hex]`, `files[]` from Cloudinary URLs (`originalSource`), product `metafields` for `materials`, `care_guide`, `drop_start`, `drop_end`, `max_per_order`, `cost_price` (variant `inventoryItem.cost`).
3. Run `productSet(synchronous: false)`, poll `productOperation` until `COMPLETE`, log `userErrors`.
4. Collections: `collectionCreate` (manual) then `collectionAddProductsV2` in `sortOrder`; `custom.featured` metafield.
5. Publish everything to the Online Store and Headless publications (`publishablePublish`).
6. Write `scripts/shopify/out/id-map.json` (`prismaProductId → shopifyProductGid`, `variantId → variantGid`) for the reviews/wishlist/back-in-stock re-key in Phase 5.

Idempotency: products matched by handle, variants by SKU; re-running updates in place.

## 8. Testing strategy

- `tests/unit/shopify/*.test.ts`: `storefrontFetch` (headers, version, error surfacing, tags), each query's `normalize*` mapper against recorded JSON fixtures in `tests/fixtures/shopify/`.
- `tests/unit/storefront/*.test.tsx`: primitives (a11y roles, variants), `ProductCard`, header behaviour, cart drawer optimistic states (Phase 3).
- Playwright (`tests/e2e/storefront.spec.ts`, Chromium preinstalled): home renders products from the trial store, PLP filter changes URL, PDP variant selection updates price, add to cart opens drawer, checkout link resolves to `checkout.shopify.com`/`*.myshopify.com`.
- CI: keep `ci.yml`; add `npm run test:e2e` as a non-blocking job until Phase 3, blocking after.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Customer Account API callback needs a public HTTPS origin | Vercel preview URL for the integration branch is registered as a callback; tunnel for local dev. |
| Trial store cannot take payments | Phase 3 QA uses Shopify's test gateway (Bogus Gateway) which works on trial; real payment QA after upgrade. |
| Storefront API rate limits during migration | `productSet` async mode + batched polling; script sleeps on `THROTTLED`. |
| Loyalty identity mismatch after auth swap | Pre-create Shopify customers by email and store GIDs before cutover; fallback lookup by email in the webhook. |
| Admin V2 shares `components/ui` and `globals.css` | Storefront gets its own namespaces; `globals.css` becomes two imports; admin tests must stay green in every wave. |
| Losing SEO on URL changes | Handles = existing slugs, so `/products/<slug>` and `/collections/<slug>` are unchanged; redirect map for everything else. |

## 10. Open questions (need Nando)

- **6a** Storefront domain for Customer Account API callbacks (`headoverfeels.com`?).
- **9a** Keep the custom loyalty program (recommended) or replace with a Shopify loyalty app?
- **10a** Are drops important enough to justify a deployed Shopify Functions app for hard cart validation, or is server-side gating on our add-to-cart action enough for v1?
- **20a** Import historical orders into Shopify, or show them read-only from Prisma (recommended)?
- **21** Keep the avatar system in the storefront nav, or park it?
- **Design** Approve the direction in §5 (ink/bone/signal, Archivo + Inter, sharp radii) before Phase 1 wave 3 builds primitives. A quick visual mock can be produced on request before any code is written.
