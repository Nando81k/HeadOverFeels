# Storefront Rebuild — Phase 4: Accounts & Loyalty Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Customers sign in through Shopify's Customer Account API (hosted, passwordless), get account pages under `/account/*` (overview, orders with tracking, order detail, addresses, profile), a re-skinned Care Points hub at `/loyalty`, and a wishlist that follows them. Care Points are awarded from Shopify's `orders/paid` webhook instead of the legacy order flow; a redeemed reward becomes a single-use Shopify discount code applied to the cart. The customer-only legacy auth/profile/orders/wishlist surface is removed. **Admin login is untouched** (the audit found `/signin` + `/api/auth/*` are the admin login, see §Legacy surface). Mockup: https://claude.ai/artifact/Drefi4GY9xBefRQZsYpfzt (boards 01–11 are the acceptance picture).

**Architecture:** `lib/shopify/customer/*` owns OAuth (PKCE), the encrypted `hof_customer` session cookie, the Customer Account API client and typed queries. `app/(storefront)/_actions/{account,loyalty,wishlist}.ts` are the only entry points the UI uses. A client `CustomerProvider` loads a slim summary after mount (same pattern as `CartProvider`) so catalog pages never read the session cookie during render; only `/account/*`, `/loyalty` (signed-in parts) and `/wishlist` are dynamic. `app/api/webhooks/shopify/route.ts` verifies HMAC, dedupes by webhook id, and calls `lib/loyalty/shopify-bridge.ts`. Loyalty logic stays in `lib/loyalty/service.ts`; the bridge resolves identity (Shopify customer GID → `Customer.id`) and mints discount codes through the Admin API.

**Tech stack:** as Phases 1–3. No new runtime dependencies (`jose` is already installed and is used for the cookie encryption; `zod` for inputs). Customer Account API: endpoints discovered from `https://<store>/.well-known/openid-configuration` and `/.well-known/customer-account-api` (documents validated 2026-10-11 against the `customer` schema). Admin API mutations validated 2026-10-11: `discountCodeBasicCreate`, `discountCodeDelete`, `webhookSubscriptionCreate` (`uri`, not the deprecated `endpoint`), `customerCreate` (`defaultEmailAddress`), `customers(query:)`. Shop GID for this store: `gid://shopify/Shop/85215183073`; `customerAccountsV2.customerAccountsVersion = NEW_CUSTOMER_ACCOUNTS` (confirmed), so the hosted login works once the Headless storefront has a Customer Account API client.

**Design spec:** `docs/superpowers/specs/2026-09-06-storefront-rebuild-shopify-design.md` decisions 6, 9, 15, 20; open questions 6a, 9a, 20a, 21 resolved below under "Decisions taken". **Prior plans/QA:** `phase1-foundation.md`, `phase2-catalog.md`, `phase3-cart.md`, `phase3-qa.md`. **Audits** (2026-10-11, summarised in §Legacy surface): legacy auth/account surface; customer loyalty surface.

---

## Decisions taken (defaults where the spec left a question open)

| # | Question | Decision |
|---|---|---|
| 6a | Callback domain | `NEXT_PUBLIC_BASE_URL` is the storefront origin. Preview: the Vercel preview URL of this branch; production: the primary domain when it is switched. Shopify refuses `http://` and `localhost`, so **local dev and e2e use the mock OIDC server** (Task 9); a tunnel is optional for a human smoke test. |
| 9a | Keep the Prisma loyalty program? | **Yes.** `lib/loyalty/service.ts` is untouched in signature; a bridge keys it by Shopify customer GID. |
| 20a | Historical orders | **Read-only from Prisma** under `/account/orders` → "Earlier orders"; matched by `Customer.email` (unique). No import into Shopify. |
| 21 | Avatar system | **Parked.** Not in the storefront nav; `/api/avatar/*` customer routes go, the admin `avatar/items` route stays. |
| new | Admin login | `/signin`, `/api/auth/{signin,signout,me,refresh-session,[...nextauth]}`, `lib/auth/*`, `app/providers.tsx` **stay** (admin depends on them). Customers never see them: every storefront link goes to `/account/login`. Phase 6 gives admin its own login and deletes them. |
| new | Loyalty identity key | `Customer.shopifyCustomerId` (new, unique, nullable) with **email as the fallback** for pre-cutover rows. `PointsTransaction.orderId` is a FK to the legacy `Order`; Shopify orders go in `metadata` + the idempotency key (`shopify-order-paid-<order gid>`), no schema change there. |
| new | Reward → discount | `discountCodeBasicCreate`: `usageLimit: 1`, `appliesOncePerCustomer: true`, `customerSelection.customers.add: [gid]`, `endsAt: now + 90d`, `customerGets.value.discountAmount` (DISCOUNT) or `percentage: 1` on shipping… **no**: Shopify's free-shipping discount is `discountCodeFreeShippingCreate` (validate in T2). Code format `HOF-<TYPE>-<6 chars>` from `crypto.randomBytes`, never `Math.random`. |
| new | Session storage | Customer Account tokens live only server-side, in an AES-256-GCM encrypted httpOnly cookie `hof_customer` (`jose` `EncryptJWT`/`jwtDecrypt`, key from `CUSTOMER_SESSION_SECRET`, fallback `AUTH_SECRET`), `sameSite: lax`, 30 days, `secure` in production. The access token (≈2 h) is refreshed with the refresh token inside `/account/refresh` (a route handler, because RSC cannot set cookies). |

---

## Cross-cutting agent notes (read once)

1. npm only. `npx vitest run <file>`, `npx tsc --noEmit`, `npx eslint <paths>`. Vitest 4 one-arg `vi.fn<T>()`; tests touching `lib/shopify/client.ts` or `lib/shopify/customer/*` need `vi.mock('server-only', () => ({}))`; mock `next/headers` (`cookies`), `next/navigation` (`redirect`, `notFound`) and `@/lib/prisma` in action/route tests. React 19, Next 16 (`await cookies()`, `after()`, `cookies().set` only in Server Actions and route handlers).
2. Storefront imports only from `components/storefront/**`, `lib/storefront/**`, `lib/shopify/**`, `lib/loyalty/{service,tier-progress}.ts` (server only), `app/(storefront)/_actions/*`. Never `components/ui`, `components/layout/*`, `lib/store`, `lib/toast`, `sonner`, `lib/auth/*`, `next-auth`.
3. Token utilities per Phase 1; no hex literals under storefront paths (lint). Tier colours from the DB (`LoyaltyTier.primaryColor`) are **not** rendered in Phase 4; tiers use the ink/bone/signal system (mockup). `lib/loyalty/tier-theme.ts` stays admin-only.
4. Primitives to reuse: `Section`, `Container`, `Display/Eyebrow`, `Button`, `IconButton`, `Badge`, `Input`, `Select`, `Checkbox`, `Dialog`, `Drawer`, `Skeleton`, `Accordion`, `Price`. New shared pieces go in `components/storefront/account/` and `components/storefront/loyalty/`.
5. **Unconfigured rules:** `hasCustomerAccountEnv()` false (no client id / shop id) → `/account/login` renders `AccountUnavailable` ("Sign-in is being set up", HTTP 200, `data-account="unconfigured"`), `getCustomerSession()` returns `null`, the header shows the plain account icon, actions return `{ ok: false, error: 'Accounts unavailable' }` without fetching. `hasShopifyAdminEnv()` false → redemption returns `{ ok: false, error: 'Rewards unavailable' }` and no points move. Never throw to the client.
6. **Signed-out rule:** `/account/*` and `/wishlist` (signed-in view) render an inline `SignInGate` (HTTP 200) with a link to `/account/login?return_to=<path>`; no redirects from RSC for signed-out visitors. `/loyalty` is public; balance, history, Redeem and referral need a session and show the gate inline per section.
7. **Freshness:** Customer Account reads are `cache: 'no-store'` (they carry a bearer token; never tag-cached). Prisma reads for loyalty are per request. `revalidateTag` is not used anywhere in this phase.
8. **Error shape:** every action returns `AccountActionResult` / `LoyaltyActionResult` / `WishlistActionResult` (Shared contracts). Customer Account `userErrors` → `{ ok: false, error: <first message>, code }`; a thrown `CustomerAccountError` with `status: 401` → the action returns `{ ok: false, error: 'Please sign in again.', code: 'UNAUTHENTICATED' }` and the provider sets `status: 'expired'`.
9. **Secrets in logs:** never log tokens, codes, cookies or raw webhook bodies. Log `webhookId`, `topic`, order gid, customer gid and the error message only.
10. **Legacy deletion rule:** delete a file only when `grep -rn "<module>" app components lib tests scripts` shows no importer left after this plan's removals; otherwise keep it and list it. The kept-on-purpose list in §Legacy surface is final; **anything used by `app/admin`, `components/admin`, `lib/admin`, `lib/fulfillment`, `lib/auth`, `middleware.ts` or `app/providers.tsx` stays.**
11. Admin must stay green: `npx vitest run tests/unit/admin-*.test.ts* tests/unit/fulfillment-*.test.ts* tests/unit/app/admin tests/unit/components/admin` before finishing any task that deletes files or touches `next.config.ts`, `prisma/schema.prisma`, `app/layout.tsx`, `middleware.ts`.
12. Prisma: schema change + hand-written SQL migration (`IF NOT EXISTS` style, as `20260608000000_customer_anonymized_at`). Do **not** run `prisma migrate` or `db push` here (no database); run `npx prisma generate` and `npx prisma validate`.
13. Branching: integration branch `claude/site-rebuild-shopify-c6zuz3` (PR #228); the orchestrator commits each wave. Do not commit from a task.
14. Trial store: the Customer Account API and webhooks work on trial. Real orders through checkout need Bogus Gateway (Phase 3 checklist).

---

## Wave summary

| Wave | Tasks | Parallel? | Depends on |
|------|-------|-----------|------------|
| W1 | 1, 2, 3, 4 | 4 parallel (disjoint files; 3 and 4 import 1/2 by contract) | Phase 3 merged |
| W2 | 5, 6, 7, 8 | 4 parallel (disjoint files) | W1 committed |
| W3 | 9 (e2e mock OIDC + specs), 10 (verify + QA) | 9 then 10 | W2 committed |

---

## File structure

**Created**
- `lib/shopify/customer/{env,oauth,session,client,errors}.ts`, `lib/shopify/customer/queries/{customer,orders,addresses,index}.ts`, `tests/fixtures/shopify/customer/{customer,orders,order,addresses}.json`, `tests/unit/shopify/customer-*.test.ts` (T1)
- `app/(storefront)/_actions/account.ts`, `app/(storefront)/account/{login,callback,logout,refresh}/route.ts` (T1)
- `prisma/migrations/20261011000000_shopify_customer_identity/migration.sql`, `lib/loyalty/shopify-bridge.ts`, `lib/loyalty/ledger.ts`, `lib/shopify/admin/{discounts,customers,webhooks}.ts`, `app/api/webhooks/shopify/route.ts`, `tests/fixtures/shopify/webhooks/orders-paid.json`, `tests/unit/loyalty/*.test.ts`, `tests/unit/api/shopify-webhook.test.ts` (T2)
- `app/(storefront)/_actions/loyalty.ts`, `tests/unit/storefront/loyalty-actions.test.ts` (T2)
- `scripts/shopify/{precreate-customers,register-webhooks}.ts`, `tests/unit/scripts/shopify-{precreate-customers,register-webhooks}.test.ts` (T3)
- `lib/shopify/queries/variants.ts` (`nodes(ids:)` → variant cards), `lib/storefront/wishlist.ts` (guest storage contract), `app/(storefront)/_actions/wishlist.ts`, `tests/unit/storefront/wishlist-actions.test.ts` (T4)
- `components/storefront/account/{CustomerProvider,useCustomer,AccountNav,AccountShell,SignInGate,AccountUnavailable,OrderCard,OrderList,OrderDetail,FulfillmentTimeline,AddressCard,AddressForm,ProfileForm,EarlierOrders,index}.tsx`, `app/(storefront)/account/{page,orders/page,orders/[id]/page,addresses/page,profile/page,loading,layout}.tsx`, `tests/unit/storefront/account-*.test.tsx` (T5)
- `components/storefront/loyalty/{PointsHero,TierProgress,RewardCard,RewardGrid,RedeemDialog,EarnGrid,TierTable,LedgerTable,ReferralCard,LoyaltySignedOut,index}.tsx`, `app/(storefront)/loyalty/page.tsx`, `tests/unit/storefront/loyalty-*.test.tsx` (T6)
- `components/storefront/wishlist/{WishlistProvider,useWishlist,WishlistButton,WishlistGrid,WishlistPage,index}.tsx`, `app/(storefront)/wishlist/page.tsx`, `tests/unit/storefront/wishlist-*.test.tsx` (T7)
- `tests/e2e/mock/customer-account-mock.mjs` (OIDC + Customer Account GraphQL, mounted by `storefront-mock.mjs`), `tests/e2e/storefront-account.spec.ts` (T9)
- `docs/superpowers/plans/2026-09-06-storefront-rebuild-phase4-qa.md`, `…phase4-shopify-checklist.md` (T10; checklist drafted in T3)

**Modified**
- `lib/shopify/env.ts` (+customer-account env, `hasShopifyAdminEnv()`), `.env.shopify.example` (T1)
- `lib/shopify/types.ts` (+`Customer*`, `CustomerOrder*`, `CustomerAddress*`, `WishlistEntry`, action result types) (T1, T4)
- `prisma/schema.prisma` (T2); `lib/shopify/admin-client.ts` (export a typed `adminMutation` helper if missing) (T2)
- `app/(storefront)/_actions/cart.ts` (attach `customerAccessToken` on create/add when a session exists; `applyRedeemedCode`) (T2 — contract only; T5 wires)
- `app/(storefront)/layout.tsx` (wrap in `CustomerProvider`), `components/storefront/layout/{Header,MobileMenu}.tsx` (account button states + menu) (T5)
- `components/storefront/pdp/AddToCartPanel.tsx` (+`WishlistButton`), `components/storefront/product/ProductCard.tsx` (+ heart) (T7)
- `components/storefront/cart/CartSummary.tsx` (Care Points preview uses the tier multiplier when signed in) (T6)
- `next.config.ts` redirects (T8); `middleware.ts` (no change — documented) (T8)
- `tests/e2e/mock/storefront-mock.mjs`, `tests/e2e/playwright.config.ts`, `tests/e2e/support/console.ts` (T9)

**Deleted** — see §Legacy surface (T8).

---

## Shared contracts (source of truth)

```ts
// lib/shopify/customer/env.ts
export type CustomerAccountEnv = { storeDomain: string; clientId: string; shopId: string; baseUrl: string; issuerOverride: string | null }
export function getCustomerAccountEnv(): CustomerAccountEnv        // throws ShopifyError naming missing vars
export function hasCustomerAccountEnv(): boolean                   // SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID + SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID + NEXT_PUBLIC_BASE_URL present
// env: SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID, SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID, NEXT_PUBLIC_BASE_URL, CUSTOMER_SESSION_SECRET (fallback AUTH_SECRET),
//      SHOPIFY_CUSTOMER_ACCOUNT_ISSUER (test only: overrides discovery to the mock, e.g. http://127.0.0.1:4443/customer)

// lib/shopify/customer/oauth.ts  (server-only)
export type Discovery = { authorizationEndpoint: string; tokenEndpoint: string; logoutEndpoint: string; graphqlEndpoint: string }
export async function discover(): Promise<Discovery>                // GET <issuer>/.well-known/openid-configuration + /.well-known/customer-account-api; cached per process, 10 min
export function createPkce(): { verifier: string; challenge: string }   // S256, base64url without padding
export function buildAuthorizeUrl(d: Discovery, p: { state: string; nonce: string; challenge: string; redirectUri: string }): string
//   scope "openid email customer-account-api:full", response_type code, client_id, redirect_uri, state, nonce, code_challenge, code_challenge_method S256
export async function exchangeCode(d: Discovery, p: { code: string; verifier: string; redirectUri: string }): Promise<TokenSet>
export async function refreshTokens(d: Discovery, refreshToken: string): Promise<TokenSet>
export function buildLogoutUrl(d: Discovery, p: { idToken: string; postLogoutRedirectUri: string }): string
export type TokenSet = { accessToken: string; refreshToken: string | null; idToken: string | null; expiresAt: number /* epoch ms */ }
// Both token requests are form-encoded POSTs with client_id (public client); on 4xx throw CustomerAccountError({ status, code })

// lib/shopify/customer/session.ts  (server-only)
export const CUSTOMER_COOKIE = 'hof_customer'
export const OAUTH_STATE_COOKIE = 'hof_customer_oauth'              // { state, nonce, verifier, returnTo }, 10 min, httpOnly
export type CustomerSession = { tokens: TokenSet; customerId: string /* gid */; email: string; firstName: string | null; lastName: string | null }
export async function readCustomerSession(): Promise<CustomerSession | null>   // decrypts; null when absent/invalid; does NOT refresh
export async function writeCustomerSession(s: CustomerSession): Promise<void>  // Server Actions / route handlers only
export async function clearCustomerSession(): Promise<void>
export function isAccessTokenFresh(s: CustomerSession, skewMs = 5 * 60_000): boolean
export async function getCustomerSession(): Promise<CustomerSession | null>    // RSC-safe: returns the session even if stale; callers that need a live token use requireFreshSession
export async function requireFreshSession(returnTo: string): Promise<CustomerSession> // in RSC: stale → redirect(`/account/refresh?return_to=…`); none → throws SignedOutError (caught by SignInGate boundary)

// lib/shopify/customer/client.ts  (server-only)
export async function customerFetch<T>(query: string, opts: { variables?: Record<string, unknown>; accessToken: string }): Promise<T>
//   POST discovery.graphqlEndpoint, headers { Authorization: accessToken, 'Content-Type': 'application/json' }, cache 'no-store';
//   401 → CustomerAccountError({ status: 401, code: 'UNAUTHENTICATED' }); GraphQL errors → CustomerAccountError({ errors })

// lib/shopify/types.ts (add)
export type CustomerSummary = { id: string; email: string; firstName: string | null; lastName: string | null; displayName: string; phone: string | null; defaultAddress: CustomerAddress | null }
export type CustomerAddress = { id: string; firstName: string | null; lastName: string | null; company: string | null; address1: string | null; address2: string | null; city: string | null; zoneCode: string | null; territoryCode: string | null; zip: string | null; phone: string | null; formatted: string[]; isDefault: boolean }
export type CustomerAddressInput = Omit<CustomerAddress, 'id' | 'formatted' | 'isDefault'> & { defaultAddress?: boolean }
export type CustomerOrderCard = { id: string; name: string; number: number; processedAt: string; financialStatus: string | null; fulfillmentStatus: 'UNFULFILLED' | 'IN_PROGRESS' | 'FULFILLED' | 'CANCELLED' | 'UNKNOWN'; total: Money; lineItems: { id: string; title: string; quantity: number; image: ShopImage | null }[]; statusPageUrl: string | null }
export type CustomerOrder = CustomerOrderCard & { subtotal: Money | null; shipping: Money | null; tax: Money | null; cancelledAt: string | null; shippingAddress: string[] | null; discounts: { amount: Money | null; percentage: number | null }[]; lines: { id: string; title: string; variantTitle: string | null; quantity: number; image: ShopImage | null; unitPrice: Money | null; total: Money | null }[]; fulfillments: { id: string; status: string; createdAt: string; tracking: { number: string | null; company: string | null; url: string | null }[] }[] }
export type CustomerOrdersPage = { orders: CustomerOrderCard[]; hasNextPage: boolean; endCursor: string | null }
export type AccountActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; code?: string }
export type LoyaltyActionResult<T = undefined> = AccountActionResult<T>
export type WishlistActionResult = { ok: true; entries: WishlistEntry[] } | { ok: false; error: string }
export type WishlistEntry = { variantId: string; productHandle: string; addedAt: string }

// lib/shopify/customer/queries/*.ts — documents validated 2026-10-11 (api: customer)
export const CUSTOMER_SUMMARY_QUERY, CUSTOMER_ORDERS_QUERY, CUSTOMER_ORDER_QUERY, CUSTOMER_ADDRESSES_QUERY: string
export const CUSTOMER_UPDATE_MUTATION, CUSTOMER_ADDRESS_CREATE_MUTATION, CUSTOMER_ADDRESS_UPDATE_MUTATION, CUSTOMER_ADDRESS_DELETE_MUTATION: string
export async function getCustomerSummary(token): Promise<CustomerSummary>
export async function getCustomerOrders(token, { first = 10, after }): Promise<CustomerOrdersPage>
export async function getCustomerOrder(token, id): Promise<CustomerOrder | null>
export async function getCustomerAddresses(token): Promise<CustomerAddress[]>
export async function updateCustomer(token, { firstName, lastName }): Promise<CustomerSummary>
export async function createAddress / updateAddress / deleteAddress(token, …): Promise<CustomerAddress[] | string>
// Query bodies (validated): see §Validated documents.

// app/(storefront)/_actions/account.ts  ('use server')
export async function getCustomerSummaryAction(): Promise<{ status: 'signed-out' | 'unavailable' | 'expired' | 'ready'; customer: CustomerSummary | null; loyalty: { points: number; tierName: string; nextTierName: string | null; pointsToNext: number | null } | null }>
export async function updateProfileAction(prev, formData): Promise<AccountActionResult<CustomerSummary>>
export async function createAddressAction / updateAddressAction / deleteAddressAction(prev, formData): Promise<AccountActionResult<CustomerAddress[]>>
export async function loadMoreOrdersAction(after: string): Promise<AccountActionResult<CustomerOrdersPage>>
// routes: GET /account/login?return_to= → 302 to Shopify (or AccountUnavailable page when unconfigured)
//         GET /account/callback?code&state → exchange, fetch summary, link Prisma (bridge.resolveCustomer), attach cart buyer identity, 302 return_to (whitelisted: same-origin path)
//         GET /account/refresh?return_to= → refresh or clear + 302
//         POST /account/logout → clear cookie, 302 to Shopify logout (post_logout_redirect_uri = base) ; GET /account/logout renders a confirm form (no logout on GET)

// prisma (T2)
// Customer:            + shopifyCustomerId String? @unique  (index)
// RewardRedemption:    + shopifyDiscountId String?  + expiresAt DateTime?
// new model ShopifyWebhookEvent { id String @id (= X-Shopify-Webhook-Id); topic String; shopDomain String; receivedAt DateTime @default(now()); processedAt DateTime?; status String @default("received"); error String?  @@map("shopify_webhook_events") }
// new model StorefrontWishlistItem { id String @id @default(cuid()); customerId String; variantId String; productHandle String; createdAt DateTime @default(now()); customer Customer @relation(fields:[customerId], references:[id], onDelete: Cascade) @@unique([customerId, variantId]) @@index([customerId]) @@map("storefront_wishlist_items") }  (+ Customer.storefrontWishlist relation)

// lib/loyalty/shopify-bridge.ts (server-only)
export async function resolveCustomer(p: { shopifyCustomerId: string; email: string; firstName?: string | null; lastName?: string | null }): Promise<{ id: string; created: boolean }>
//   by shopifyCustomerId → by email (sets shopifyCustomerId) → create slim row (lowest active tier, newsletter false, name from first/last)
export type PaidOrder = { orderGid: string; orderName: string; webhookId: string; customer: { shopifyCustomerId: string | null; email: string | null; firstName: string | null; lastName: string | null }; subtotalAfterDiscounts: number; currency: string; discountCodes: string[]; processedAt: string }
export function parseOrdersPaid(payload: unknown): PaidOrder          // zod; subtotal = current_subtotal_price − current_total_discounts (never negative)
export async function awardPointsForPaidOrder(order: PaidOrder): Promise<{ customerId: string | null; pointsAwarded: number; firstOrder: boolean; redemptionsUsed: string[] }>
//   no customer email → skip (return customerId null); resolveCustomer; awardPurchasePoints(customerId, null, subtotal, `shopify-order-paid-${orderGid}`) with metadata { orderGid, orderName };
//   first paid order (no prior PURCHASE transaction) → awardFirstPurchasePoints(…, `shopify-first-${orderGid}`); referredBy → awardReferralPoints(…, `shopify-referral-${orderGid}`); updateCustomerTier;
//   discountCodes ∩ RewardRedemption.couponCode → status USED, usedAt, orderId = orderGid (string column)
export type RedeemResult = { redemptionId: string; code: string; expiresAt: string; newBalance: number }
export async function redeemRewardToCode(p: { customerId: string; rewardId: string; idempotencyKey: string; shopifyCustomerId: string }): Promise<RedeemResult>
//   Serializable tx: reward active + tier gate (by LoyaltyTier.sortOrder, not a hardcoded list) + maxRedemptions/totalAvailable + balance; create RewardRedemption PENDING with couponCode `HOF-<DISC|SHIP|DROP>-<6>`; deductPoints (service) ;
//   then Admin: DISCOUNT → discountCodeBasicCreate (amount off, all items, customerSelection this customer, usageLimit 1, appliesOncePerCustomer, startsAt now, endsAt +90d, title `Care Points · <reward.name> · <customer gid tail>`);
//   FREE_SHIPPING → discountCodeFreeShippingCreate (same selection/limits); EARLY_ACCESS → no Shopify code, EarlyAccessGrant as today (status FULFILLED);
//   on Admin failure → redemption CANCELLED + points restored via awardPoints('ADMIN_ADJUSTMENT', …, { idempotencyKey: `restore-${redemptionId}` }) and throw. Success → status ACTIVE, shopifyDiscountId, expiresAt.
export async function getLoyaltyOverview(customerId: string): Promise<LoyaltyOverview>   // stats + tiers + progress + expiring + rewards(canRedeem) + referral code
export type LoyaltyOverview = { points: number; lifetimePoints: number; annualPoints: number; tier: TierView; nextTier: TierView | null; pointsToNext: number | null; progressRatio: number; multiplier: number; expiringSoon: { points: number; at: string } | null; rewards: RewardView[]; referral: { code: string; url: string; joined: number; ordered: number; pointsEarned: number } }
export type TierView = { id: string; name: string; slug: string; minAnnualPoints: number; pointMultiplier: number; perks: string[]; current: boolean }
export type RewardView = { id: string; name: string; description: string | null; type: 'DISCOUNT' | 'FREE_SHIPPING' | 'EARLY_ACCESS' | 'OTHER'; value: number | null; pointsCost: number; canRedeem: boolean; reason: 'ok' | 'points' | 'tier' | 'limit' | 'soldout'; pointsShort: number }

// lib/loyalty/ledger.ts
export async function getLedgerPage(customerId, { cursor, limit = 20, filter: 'all' | 'earned' | 'redeemed' }): Promise<{ rows: LedgerRow[]; nextCursor: string | null }>
export type LedgerRow = { id: string; at: string; points: number; kind: 'earned' | 'redeemed' | 'expired' | 'adjusted'; label: string; reference: { type: 'order' | 'code' | 'review' | 'none'; label: string; href: string | null } }
export async function getActiveCodes(customerId): Promise<{ code: string; rewardName: string; expiresAt: string | null; status: 'ACTIVE' | 'USED' | 'EXPIRED' }[]>

// app/(storefront)/_actions/loyalty.ts ('use server')
export async function getLoyaltyOverviewAction(): Promise<LoyaltyActionResult<LoyaltyOverview>>      // signed-out → { ok:false, code:'SIGNED_OUT' }
export async function redeemRewardAction(input: { rewardId: string; idempotencyKey: string }): Promise<LoyaltyActionResult<RedeemResult & { cart: Cart | null }>>  // after minting, applies the code to the hof_cart cart when one exists (cart action helper), returns the new cart
export async function loadLedgerAction(input): Promise<LoyaltyActionResult<…>>

// lib/storefront/wishlist.ts (client-safe)
export const WISHLIST_STORAGE_KEY = 'hof_wishlist_v1'               // guest: JSON WishlistEntry[] in localStorage
export function readGuestWishlist(): WishlistEntry[]; export function writeGuestWishlist(entries): void
export function mergeWishlists(server: WishlistEntry[], guest: WishlistEntry[]): WishlistEntry[]   // union by variantId, oldest addedAt wins

// app/(storefront)/_actions/wishlist.ts ('use server')
export async function getWishlistAction(): Promise<WishlistActionResult>                          // signed-out → { ok:true, entries: [] }
export async function toggleWishlistAction(input: { variantId: string; productHandle: string }): Promise<WishlistActionResult>
export async function mergeGuestWishlistAction(entries: WishlistEntry[]): Promise<WishlistActionResult>  // called once after sign-in by WishlistProvider
export async function wishlistCardsAction(variantIds: string[]): Promise<ProductCardVariant[]>      // Storefront `nodes(ids:)` → card data (title, handle, image, price, compareAt, availableForSale, selectedOptions, product.tags) — any missing id dropped
```

### Validated documents (copy verbatim into the query files)

```graphql
query CustomerSummary { customer { id emailAddress { emailAddress } firstName lastName displayName phoneNumber { phoneNumber } defaultAddress { id formatted } } }

query CustomerOrders($first: Int!, $after: String) { customer { orders(first: $first, after: $after, sortKey: PROCESSED_AT, reverse: true) { pageInfo { hasNextPage endCursor } nodes { id name number processedAt financialStatus statusPageUrl fulfillments(first: 1) { nodes { status } } totalPrice { amount currencyCode } lineItems(first: 3) { nodes { id title quantity image { url altText } } } } } } }

query CustomerOrder($id: ID!) { order(id: $id) { id name number processedAt financialStatus cancelledAt statusPageUrl totalPrice { amount currencyCode } subtotal { amount currencyCode } totalShipping { amount currencyCode } totalTax { amount currencyCode } shippingAddress { formatted } lineItems(first: 50) { nodes { id title quantity variantTitle image { url altText } price { amount currencyCode } totalPrice { amount currencyCode } } } fulfillments(first: 10) { nodes { id status createdAt trackingInformation { number company url } } } discountApplications(first: 10) { nodes { value { ... on MoneyV2 { amount currencyCode } ... on PricingPercentageValue { percentage } } } } } }

query CustomerAddresses { customer { defaultAddress { id } addresses(first: 20) { nodes { id firstName lastName company address1 address2 city province zoneCode territoryCode zip phoneNumber formatted } } } }

mutation CustomerAddressCreate($address: CustomerAddressInput!, $defaultAddress: Boolean) { customerAddressCreate(address: $address, defaultAddress: $defaultAddress) { customerAddress { id } userErrors { field message code } } }
mutation CustomerAddressUpdate($addressId: ID!, $address: CustomerAddressInput, $defaultAddress: Boolean) { customerAddressUpdate(addressId: $addressId, address: $address, defaultAddress: $defaultAddress) { customerAddress { id } userErrors { field message code } } }
mutation CustomerAddressDelete($addressId: ID!) { customerAddressDelete(addressId: $addressId) { deletedAddressId userErrors { field message code } } }
mutation CustomerUpdate($input: CustomerUpdateInput!) { customerUpdate(input: $input) { customer { id firstName lastName } userErrors { field message code } } }
```
(`statusPageUrl` on `CustomerOrders.nodes` was not in the validated set; validate it in T1 and drop it if the schema refuses.)

Admin (validated): `discountCodeBasicCreate(basicCodeDiscount: DiscountCodeBasicInput!) { codeDiscountNode { id codeDiscount { ... on DiscountCodeBasic { title codes(first: 1) { nodes { code } } startsAt endsAt usageLimit appliesOncePerCustomer } } } userErrors { field message code } }` · `discountCodeDelete(id:) { deletedCodeDiscountId userErrors { field message } }` · `webhookSubscriptionCreate(topic:, webhookSubscription:) { webhookSubscription { id topic uri } userErrors { field message } }` · `webhookSubscriptions(first: 25) { nodes { id topic uri } }` · `customerCreate(input:) { customer { id defaultEmailAddress { emailAddress } } userErrors { field message } }` · `customers(first: 1, query: $query) { nodes { id defaultEmailAddress { emailAddress } } }`. T2 validates `discountCodeFreeShippingCreate` with the Shopify MCP before using it.

---

## Legacy surface (from the 2026-10-11 audits)

**Admin depends on (KEEP, untouched):** `app/signin/page.tsx` (admin login), `app/api/auth/{signin,signout,me,refresh-session,[...nextauth]}`, `lib/auth/{auth,auth.config,session,context,admin}.ts`, `app/providers.tsx` (`SessionProvider` + `AuthProvider` + `Toaster` + `PopupManager` + `CookieConsent`), `middleware.ts`, `app/api/orders/route.ts` GET (used by admin `CommandPalette`; **T8 locks it to admins**), `app/api/orders/[id]/{route,tracking,tracking/live}`, `app/api/orders/pending-count`, `app/api/avatar/items`, `components/orders/*`, `lib/orders/admin-order-query.ts`, `lib/notifications/service.ts` + models, `lib/socket.ts`, NextAuth tables and the Customer password/verification/reset columns (Phase 6).

**Delete in T8 (customer-only, no admin importer):**
- Pages: `app/forgot-password/`, `app/reset-password/`, `app/verify-email/`, `app/profile/**`, `app/orders/page.tsx`, `app/orders/[id]/track/page.tsx`, `app/order/track/[id]/page.tsx`, `app/wishlist/page.tsx`, `app/loyalty/**` (all six), `app/about/page.tsx` and `app/contact/page.tsx` **only if** T8 ports them to `app/(storefront)/{about,contact}/page.tsx` in the same task (About: copy in code on the new primitives; Contact: a real form posting to `/api/support` if that exists, else a mailto + address block — no fake submit).
- API: `app/api/auth/{signup,forgot-password,reset-password,verify-email,resend-verification,check-admin}`, `app/api/profile/**`, `app/api/wishlist/**`, `app/api/notifications/**` (customer inbox; `lib/notifications/service` stays), `app/api/customers/**` (no callers), `app/api/avatar/{route.ts,unlock}`, `app/api/orders/[id]/{confirm-payment,send-confirmation}`, `POST` handler of `app/api/orders/route.ts`, `app/api/loyalty/customers/**` (IDOR, no callers), `app/api/loyalty/{redeem,rewards,referrals,transactions,expiring,refresh-tier}` (replaced by actions; keep `tiers`, `me`, `points-history`, `redemptions` only if an admin or kept-legacy importer remains — grep).
- Components/libs: `components/auth/**`, `components/profile/**`, `components/wishlist/**`, `components/avatar/**`, `components/loyalty/**` (incl. `EarlyAccessDrops` — its only importer `RewardsHubSection` goes), `components/notifications/NotificationCenter.tsx` (importers: `Navigation`, `profile/notifications` — both go), `components/layout/{Navigation,MobileBottomNav}.tsx` (last importers: legacy pages above; verify with grep, keep if anything under `app/admin` imports them), `lib/store/wishlist.ts`, `lib/wishlist/**`, `lib/profile/**`, `lib/hooks/useOrderPolling.ts`, `lib/security/auth.ts` (dead), `lib/security/guest-session.ts` (with the `POST /api/orders` handler), `lib/email/auth.ts` + `lib/email/templates/{email-verification,password-reset,welcome}*`, `lib/loyalty/recovery.ts`, `lib/loyalty/use-tier-accent.ts` (importers go), `lib/checkout/server-pricing.ts` + `app/api/coupons/validate` (redemption consumption now lives in Shopify) — only if no importer remains.
- Legacy award paths superseded by the webhook: the award block in `app/api/stripe/webhook/route.ts` (lines ≈186–229) and its redemption-USED block (≈89–99) **stay for legacy Stripe refunds until Phase 6 but must not double-award**: guard with `if (order.stripePaymentIntentId)` (already true for legacy orders) and leave as is; document. `scripts/confirm-order.ts` → delete.
- Tests: `profile-page-tabs`, `wishlist-page-modernized`, `wishlist-quick-add`, `daily-mental-health-quote`, `profile-newsletter-route`, `customers-legacy-auth`, `order-track-legacy-redirect` (replace with the new redirect test), `navigation-*` (4), `tests/integration/api/auth-signin.test.js`, `cart-reservations.test.ts` if it only mocks guest-session.

**Redirects (T8, `next.config.ts`, permanent):** `/forgot-password`, `/reset-password`, `/verify-email` → `/account/login`; `/profile`, `/profile/:path*` → `/account`; `/orders` → `/account/orders`; `/orders/:id/track` → `/account/orders/:id`; `/order/track/:id` → `/account/orders/:id`; `/loyalty/rewards` → `/loyalty#rewards`, `/loyalty/tiers` → `/loyalty#tiers`, `/loyalty/points`, `/loyalty/history` → `/loyalty#history`, `/loyalty/referrals` → `/loyalty#refer`; update the Phase 3 `/order/confirmation` → `/account/orders`. **`/signin` is not redirected** (admin).

**Security fixes folded in (T8):** `GET /api/orders` requires `verifyAdmin` (drop the `x-user-email`/`x-user-admin` header trust; CommandPalette is admin-only so it keeps working); delete the IDOR loyalty routes; nothing new trusts a client-supplied customer id.

---

## Task 1: Customer Account OAuth, session, client, queries

**Files:** created `lib/shopify/customer/{env,oauth,session,client,errors}.ts`, `lib/shopify/customer/queries/*.ts`, `app/(storefront)/_actions/account.ts`, `app/(storefront)/account/{login,callback,logout,refresh}/route.ts`, fixtures, tests; modified `lib/shopify/env.ts`, `lib/shopify/types.ts`, `.env.shopify.example`.

- [ ] Env + discovery + PKCE + token exchange + logout URL per the contract; `fetch` with `cache: 'no-store'`, a `User-Agent` header (`HeadOverFeels-Storefront/1.0`), and the `Origin: baseUrl` header on token requests (Shopify requires it for public clients). Discovery uses `SHOPIFY_CUSTOMER_ACCOUNT_ISSUER` when set, else `https://${storeDomain}`.
- [ ] Session cookie: `EncryptJWT` (`dir` + `A256GCM`, key = SHA-256 of the secret), `jwtDecrypt` with `clockTolerance`; malformed → null + cookie cleared on the next write only. `requireFreshSession` behaviour per contract.
- [ ] Route handlers: `login` (unconfigured → render the `AccountUnavailable` HTML? No: redirect to `/account?unavailable=1`, the page renders it), `callback` (state mismatch → `/account/login?error=state`; exchange; `getCustomerSummary`; `resolveCustomer` from the bridge **behind a dynamic import so T1 does not depend on T2's file at build time** — call `import('@/lib/loyalty/shopify-bridge').catch(() => null)`; if the module is missing, skip linking; attach cart buyer identity when `hof_cart` exists via `updateCartBuyerIdentity`; `return_to` must be a same-origin path starting with `/` and not `//`), `refresh`, `logout` (POST only).
- [ ] Failing tests first: PKCE shape (43–128 chars, S256), authorize URL params, token exchange body + Origin header, 401 mapping, session round-trip (encrypt/decrypt, tamper → null), `requireFreshSession` redirect target, each query's normaliser against the fixtures (hand-author `customer.json`, `orders.json`, `order.json`, `addresses.json` in the Customer Account shapes above), route handlers with mocked `cookies`/`fetch`/`redirect`, `return_to` whitelist, callback attaching the cart. Green, typecheck, lint.

## Task 2: Prisma identity, loyalty bridge, webhook, loyalty actions

**Files:** `prisma/schema.prisma` + migration, `lib/loyalty/{shopify-bridge,ledger}.ts`, `lib/shopify/admin/{discounts,customers,webhooks}.ts`, `app/api/webhooks/shopify/route.ts`, `app/(storefront)/_actions/loyalty.ts`, `app/(storefront)/_actions/cart.ts` (+`applyRedeemedCode(code)` helper that reads the cookie and calls `updateCartDiscountCodes` merging codes), fixtures, tests.

- [ ] Schema per contract; migration SQL by hand; `npx prisma generate && npx prisma validate`.
- [ ] Admin helpers over `adminRequest`: `createCustomerDiscountCode(input) → { discountId, code, endsAt }`, `createFreeShippingCode`, `deleteDiscountCode`, `findCustomerByEmail`, `createCustomer`, `listWebhooks`, `createWebhook`. Validate `discountCodeFreeShippingCreate` with the Shopify MCP schema tool before writing it (field names exact); paste the validated document in the file header.
- [ ] Webhook route: `export const runtime = 'nodejs'`; read raw body (`await request.text()`), compare `crypto.timingSafeEqual(base64 HMAC-SHA256(SHOPIFY_WEBHOOK_SECRET, raw), X-Shopify-Hmac-Sha256)`; missing secret → 500 once logged; bad HMAC → 401; insert `ShopifyWebhookEvent` by `X-Shopify-Webhook-Id` (P2002 → 200 `{ duplicate: true }`); topics: `orders/paid` → `awardPointsForPaidOrder`; `customers/update` → sync email/name on the linked row; `orders/cancelled` + `refunds/create` → mark linked redemption `CANCELLED` and restore points when the refund covers the full order (keep simple: full cancel only); unknown topic → 200. Processing runs inline (Vercel has no queue); wrap in try/catch, set `status: 'failed'` + `error` and still return 200 so Shopify does not retry forever; return 500 only for HMAC/secret problems.
- [ ] Bridge + ledger per contract. Tier gate by `sortOrder`. `deductPoints` from the service is the only way points leave.
- [ ] Failing tests first: HMAC accept/reject/timing-safe, duplicate webhook id, `parseOrdersPaid` from the fixture (`tests/fixtures/shopify/webhooks/orders-paid.json`, Shopify's documented shape with `customer.admin_graphql_api_id`, `current_subtotal_price`, `current_total_discounts`, `discount_codes[]`), award path with mocked prisma + service (idempotency keys asserted), redemption USED marking, `redeemRewardToCode` happy path / Admin failure restores points / tier + limit gates, `getLoyaltyOverview` shapes, ledger paging + filters, actions signed-out/unavailable. Green, typecheck, lint, admin subset.

## Task 3: Customer pre-creation + webhook registration scripts, Shopify checklist

**Files:** `scripts/shopify/{precreate-customers,register-webhooks}.ts`, tests, `docs/superpowers/plans/2026-09-06-storefront-rebuild-phase4-shopify-checklist.md`.

- [ ] `precreate-customers.ts` (`--dry-run` default, `--apply`, `--limit`): Prisma customers with `anonymizedAt` null and `shopifyCustomerId` null → `customers(query: "email:<email>")` → found: write the gid; else `customerCreate({ email, firstName, lastName, emailMarketingConsent from newsletter })` → write the gid; sleeps on THROTTLED; prints a table and writes `scripts/shopify/out/customer-map.json`.
- [ ] `register-webhooks.ts` (`--dry-run`/`--apply`, `--base-url`): topics `ORDERS_PAID`, `ORDERS_CANCELLED`, `REFUNDS_CREATE`, `CUSTOMERS_UPDATE` → `<base>/api/webhooks/shopify` (JSON); lists existing first; idempotent by (topic, uri).
- [ ] Checklist doc (human): Headless → Customer Account API → create the client, callback URL `<preview>/account/callback` and later the primary domain, JavaScript origin, logout URL; copy the client id + shop id; app scopes `write_discounts read_discounts read_customers write_customers`; the webhook signing secret (for a custom app, the app's API secret key); Vercel env vars; run order (precreate → register → smoke: sign in, place a Bogus order, see points, redeem, see the code at checkout).
- [ ] Tests: mocked `adminRequest`; dry run makes no mutations; found-by-email path; idempotent re-run. Green, lint (`scripts/shopify` is exempt from the hex rule).

## Task 4: Wishlist data layer

**Files:** `lib/shopify/queries/variants.ts` (+index export), `lib/storefront/wishlist.ts`, `app/(storefront)/_actions/wishlist.ts`, `tests/fixtures/shopify/variants.json`, tests; `lib/shopify/types.ts` (+`ProductCardVariant`).

- [ ] `VARIANTS_BY_ID_QUERY`: `nodes(ids: $ids) { ... on ProductVariant { id title availableForSale quantityAvailable price { amount currencyCode } compareAtPrice { amount currencyCode } selectedOptions { name value } image { url altText width height } product { id handle title tags featuredImage { url altText width height } availableForSale } } }` — validate with the MCP (`storefront-graphql`) and paste the result in the header. `revalidate: 60`, tag `variants`.
- [ ] Actions per contract over `StorefrontWishlistItem`; signed-out `toggle` → `{ ok:false, error:'SIGNED_OUT' }` (the provider keeps guests in localStorage). Guest helpers are pure and SSR-safe (`typeof window`).
- [ ] Tests: normaliser from the fixture, merge semantics, actions with mocked prisma + session. Green, typecheck, lint.

## Task 5: Account pages, CustomerProvider, header

**Files:** `components/storefront/account/*`, `app/(storefront)/account/{layout,page,loading,orders/page,orders/[id]/page,addresses/page,profile/page}.tsx`, `app/(storefront)/layout.tsx`, `components/storefront/layout/{Header,MobileMenu}.tsx`, tests.

- [ ] `CustomerProvider({ children, available })`: on mount calls `getCustomerSummaryAction()`; context `{ status: 'loading'|'signed-out'|'ready'|'expired'|'unavailable', customer, loyalty, refresh() }`; `useCustomer()`/`useCustomerOptional()`. The layout wraps `<CartProvider>` children in it (`available={hasCustomerAccountEnv()}`).
- [ ] Header: signed-out → icon link to `/account/login`; ready → initials chip + small menu (`role="menu"`, Overview/Orders/Care Points/Wishlist/Sign out — Sign out is a `<form method="post" action="/account/logout">`); `expired` → icon link to `/account/refresh?return_to=`; mobile menu gets the same rows (mockup board 08).
- [ ] `/account` layout: `AccountShell` (side nav desktop / scrollable tabs mobile, mockup 02/09) with `SignInGate` boundary; pages are `dynamic = 'force-dynamic'` and use `requireFreshSession`. Overview (greeting, recent 2 orders, Care Points card from `getLoyaltyOverviewAction` when ready, default address, profile, earlier-orders strip), Orders (Shopify list with load-more + `EarlierOrders` from Prisma `Order` by email, read-only, mockup 03), Order detail (timeline from fulfillments, items, summary, points line = the `PointsTransaction` whose metadata.orderGid matches, mockup 04), Addresses (cards + `AddressForm` with `useActionState`, inline Shopify `userErrors`, mockup 05), Profile (name form; email read-only with "managed by Shopify"; drop-alerts toggle stored on the Prisma row `newsletter`/`smsOptIn` — keep to `newsletter`).
- [ ] Metadata: `robots: { index: false }` for everything under `/account`.
- [ ] Failing tests first (render with fake actions; fixtures): provider states, header states + menu a11y, gate renders 200 content with the right `return_to`, each page's key rows, address form error mapping, earlier orders by email. Green, lint.

## Task 6: Care Points hub

**Files:** `components/storefront/loyalty/*`, `app/(storefront)/loyalty/page.tsx`, `components/storefront/cart/CartSummary.tsx` (multiplier-aware preview via `useCustomerOptional()`), tests.

- [ ] Page is public: tiers, how-to-earn and the rewards catalogue render for everyone (data from `prisma.loyaltyTier`/`reward`, cached 5 min with `unstable_cache` keyed `loyalty-public`); the hero, balance, Redeem buttons, history and referral read the session (`getCustomerSession`) and render `LoyaltySignedOut` (mockup 08) when absent. Anchors `#rewards #earn #tiers #history #refer` match the redirects.
- [ ] `RedeemDialog` (confirm → `redeemRewardAction` with a per-open idempotency key → success state with the code, Copy, "View cart"; the returned `cart` is pushed into the layout `CartProvider` via `seed()`), `LedgerTable` with filter chips + load more, `ReferralCard` (copy link; `sms:`/`mailto:` share links), expiring banner.
- [ ] Care Points preview in the cart: `points = floor(total × multiplier)` when the customer context is ready, else as today; copy "Earn N Care Points".
- [ ] Failing tests first: signed-out vs signed-in render, reward gating reasons, redeem dialog flow incl. failure copy ("Your points were not taken"), ledger filters, anchors present, cart preview with multiplier. Green, lint (no hex).

## Task 7: Wishlist UI

**Files:** `components/storefront/wishlist/*`, `app/(storefront)/wishlist/page.tsx`, `components/storefront/pdp/AddToCartPanel.tsx`, `components/storefront/product/ProductCard.tsx`, `app/(storefront)/layout.tsx` (wrap in `WishlistProvider`), tests.

- [ ] `WishlistProvider`: guest state from localStorage; when `useCustomer().status === 'ready'` → `mergeGuestWishlistAction(guest)` once, then server state; `toggle(variantId, handle)` optimistic; `count`.
- [ ] `WishlistButton` (heart `IconButton`, `aria-pressed`) on the PDP buy box (for the selected variant) and on `ProductCard` (first available variant; hidden when none); `/wishlist` page (mockup 07): grid from `wishlistCardsAction`, "Add to cart" via `useCart().addLine`, sold-out → "Back in stock alert" **disabled with a title "coming in Phase 5"**, drop → "Notify me" link to the PDP; empty state; guest banner "Sign in to keep this list on every device".
- [ ] Failing tests first: guest persistence, merge on sign-in, toggle optimistic + rollback, page states. Green, lint.

## Task 8: Legacy removal, redirects, API lockdown, About/Contact port

- [ ] Port `app/about` and `app/contact` to `app/(storefront)/{about,contact}/page.tsx` on the new primitives (copy preserved; Contact posts to the existing support endpoint if one accepts anonymous tickets — grep `app/api/support` — else renders the address/email block, no fake submit). Delete the legacy pages afterwards.
- [ ] Delete per §Legacy surface (grep rule; cascade one level; report kept files). Rewire nothing else: the only remaining `Navigation` importers must be gone; if any `app/admin` file imports `Navigation`/`MobileBottomNav`, keep both and say so.
- [ ] `next.config.ts` redirects + test; `GET /api/orders` admin-only + test update (`orders-route-admin-filters.test.ts`).
- [ ] Full unit suite green, typecheck, lint, admin subset green.

## Task 9: Mock-backed e2e

- [x] `customer-account-mock.mjs` mounted inside `storefront-mock.mjs` under `/customer`: `/.well-known/openid-configuration`, `/.well-known/customer-account-api`, `GET /oauth/authorize` (302 straight back to `redirect_uri?code=mock-<n>&state=`), `POST /oauth/token` (code or refresh → `{ access_token, refresh_token, id_token, expires_in: 7200 }`), `GET /oauth/logout` (302 to `post_logout_redirect_uri`), `POST /graphql` keyed on operation name → the T1 fixtures (addresses mutate in memory). Playwright env adds `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID=mock`, `SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID=85215183073`, `SHOPIFY_CUSTOMER_ACCOUNT_ISSUER=http://127.0.0.1:4443/customer`, `NEXT_PUBLIC_BASE_URL=http://localhost:3000`, `CUSTOMER_SESSION_SECRET=e2e-secret`.
- [x] `storefront-account.spec.ts`: header icon → `/account/login` → back signed in with initials; overview shows the fixture name; orders list + detail with tracking; add an address (mutation hits the mock) and see it; wishlist guest add → sign in → merged; `/loyalty` signed-out gate copy; sign out clears the chip; `/account/orders` signed-out renders the gate with `return_to`; console clean per the allow-list. (Loyalty balances need Prisma → unit tests only; note it in the spec header.)
- [x] Both projects green on two consecutive full runs.

## Task 10: Verification + QA report (orchestrator)

- [x] `npm run test:run`, `npx tsc --noEmit`, `npx eslint` storefront paths, `npm run test:e2e`, `npx next build` stages, admin subset, `npx prisma validate`. Screenshots of the account overview, order detail, loyalty hub and wishlist from the mock (demo script).
- [x] `phase4-qa.md`: results, deviations, human checklist (client id/secret, callback URLs, webhook secret, scopes, precreate + register runs, Bogus order → points, redeem → code at checkout). Update PR #228 title/body to Phases 1–4. _(Wave 3 shipped 2026-10-20; W1/W2 tasks 1–8 shipped in `219a4b5` / `3e72241`.)_

---

## Definition of done (Phase 4)

- Sign in from the header lands on Shopify's hosted login and returns signed in; `/account/*` work from a fresh request with only the `hof_customer` cookie; expired access tokens refresh transparently; sign-out clears both sides.
- Orders, order detail with tracking, addresses (CRUD) and profile come from the Customer Account API; earlier Prisma orders show read-only.
- A paid Shopify order posts Care Points to the right Prisma customer (linked by Shopify id, then email, else created), idempotently; a redeemed reward mints a single-use Shopify code that is applied to the cart and marked USED when the order is paid.
- `/loyalty` is re-skinned on the primitives, public for tiers/rewards, gated for balances; the wishlist follows a signed-in customer and merges a guest list.
- Customer-only legacy auth/profile/orders/wishlist/loyalty pages, routes, components and tests are gone; admin login, admin pages and their tests are untouched and green; `GET /api/orders` no longer leaks.
- Mock-backed e2e covers the account flow without Shopify secrets; unit suite, typecheck, lint, admin subset green.
- Phase 5 can gate drop add-to-cart on `EarlyAccessGrant` using `getCustomerSession()` without touching the account pages.
