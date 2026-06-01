# Admin Rebuild — Phase 5: Marketing QA Findings

**Date:** 2026-05-31
**Phase 5 PRs:** #117 (data layer), #118 (server actions, ~46 actions), #119 (MarketingListCardMobile), #120 (MarketingListTable), #121 (PromotionInspector), #122 (PopupInspector), #123 (AbandonedCartInspector), #124 (SubscriberInspector), #125 (CampaignInspector), #126 (PromotionBulkSheet), #127 (PopupBulkSheet), #128 (CampaignBulkSheet), #129 (AbandonedCartBulkSheet), #130 (SubscriberBulkSheet + BottomActionSheet `disabled` field), #131 (CampaignsListView), #132 (PopupsListView), #133 (PromotionsListView), #134 (AbandonedCartsListView), #135 (SubscribersListView), #136 (AdminMarketingV2 + V1 stub + page dispatcher), #137 (CampaignEditor), #138 (editor dispatcher pages), #139 (PopupEditor)

---

## Summary

Phase 5 ships the complete V2 `/admin/marketing` umbrella page: five tabs (Promotions, Popups, Subscribers, Campaigns, Abandoned Carts) with a KPI strip, generic desktop table + mobile card split, per-tab Inspectors, bulk-action sheets, and full-page editors for Newsletter Campaigns and Popups — all gated behind `NEXT_PUBLIC_ADMIN_V2_ENABLED` with zero schema migrations. Before flipping the flag, run through the smoke-test checklist below to confirm each sub-tab renders, key interactions fire, editors save correctly, and V1 marketing pages remain accessible when the flag is off.

---

## How to enable Phase 5

Add to `.env.local`:

```
NEXT_PUBLIC_ADMIN_V2_ENABLED=true
```

Restart the dev server (`pnpm dev`). Phases 1 through 5 all activate together under the single flag. The four existing V1 marketing pages (`/admin/promotions`, `/admin/popups`, `/admin/newsletter`, `/admin/abandoned-carts`) remain accessible regardless of the flag — they are not modified.

---

## Smoke test checklist

### Before you start

- [ ] `NEXT_PUBLIC_ADMIN_V2_ENABLED=true` in `.env.local`, dev server restarted
- [ ] Sign in as an admin user
- [ ] Navigate to `/admin/marketing`

---

### Tab: Promotions (`?tab=promotions` or no param)

**Expect:** KPI strip (4 cards: Active Promotions / Popup Conv 7d / Subscribers / Carts to Recover), filter-bar placeholder ("Filter bar — Phase 5.5"), then a desktop table or mobile stacked cards.

- [ ] KPI strip loads with real counts; "Active Promotions" card shows warning variant when count is zero
- [ ] Table renders promotion rows: name, code (nullable), type badge, value, active toggle, used count, expires
- [ ] Click a row → PromotionInspector slide-out opens
- [ ] Inspector: edit name, code, discount value → **Save** → toast confirms, row reflects changes on next load
- [ ] **Suggest code button:** click "Suggest" in the code field → auto-fills a random alphanumeric code
- [ ] **On-blur uniqueness check:** blur the code field after typing a code → if the code already exists the field shows a validation error; unique codes pass silently
- [ ] Check a row → bottom bulk-actions sheet appears with **Activate / Deactivate / Delete**
- [ ] **Bulk Activate / Deactivate:** select 2+ rows → action fires; active toggle reflects new state on refresh
- [ ] **Bulk Delete:** confirm prompt → `bulkDeletePromotions` fires; rows removed
- [ ] **Mobile (375px):** table is hidden; stacked promotion cards render with name, code, type, and value; long-press (or right-click) enters selection mode

---

### Tab: Popups (`?tab=popups`)

**Expect:** Popup rows with template badge (MODAL / BANNER / SLIDE_IN / etc.), position, trigger, 7d impressions, and 7d conversions.

- [ ] Table renders popup rows with correct columns
- [ ] Click a row → PopupInspector opens
- [ ] Inspector: edit name, template, position, trigger type → **Save** → toast + row update
- [ ] **Toggle active:** inspector toggle switches `isActive`; confirm status badge in row flips
- [ ] **Duplicate popup:** Inspector "Duplicate" button → `duplicatePopup` fires; new row appears with "(copy)" suffix
- [ ] Check a row → bulk sheet appears with **Activate / Deactivate / Duplicate / Delete**
- [ ] **Bulk Duplicate:** select 2 rows → duplicates created; new rows visible on next load
- [ ] **Mobile (375px):** mobile cards show popup name, template badge, 7d impressions/conversions; swipe-left shows "Activate" quick action

---

### Tab: Subscribers (`?tab=subscribers`)

**Expect:** Subscriber rows with email, source, status badge (Active/Unsubscribed), and subscribed date.

- [ ] Table renders subscriber rows
- [ ] Click a row → SubscriberInspector opens
- [ ] Inspector shows email, source, subscribed date, activity history
- [ ] **Unsubscribe:** inspector "Unsubscribe" button → `unsubscribeSubscriber` fires; status badge flips to Unsubscribed
- [ ] **Delete (SUPER_ADMIN only):** as SUPER_ADMIN, "Delete" button is visible and enabled → fires `deleteSubscriber`
- [ ] **Delete (non-SUPER_ADMIN):** Delete button is absent or disabled — PII gate working
- [ ] Check rows → bulk sheet appears with **Unsubscribe / Export CSV / Delete**
- [ ] **Export CSV:** `bulkExportSubscribersCsv` fires; browser downloads a `.csv` file with columns: email, source, isActive, subscribedAt
- [ ] **Bulk Delete:** SUPER_ADMIN only; confirm prompt → rows removed
- [ ] **Mobile (375px):** mobile cards show email, source, status; swipe-left shows "Unsubscribe" quick action

---

### Tab: Campaigns (`?tab=campaigns`)

**Expect:** Campaign rows with name, subject, status badge (DRAFT / QUEUED / SENDING / SENT / FAILED), audience count, sent count.

- [ ] Table renders campaign rows with status badges
- [ ] Click a row → CampaignInspector opens
- [ ] Inspector shows summary info (name, subject, status, audience, sent/failed counts)
- [ ] **Open in Editor:** Inspector "Edit in Editor" link → navigates to `/admin/marketing/campaigns/[id]/edit`
- [ ] Check rows → bulk sheet appears with **Duplicate / Delete (DRAFT only)**
- [ ] **Bulk Duplicate:** select 1+ rows → duplicates created with DRAFT status
- [ ] **Bulk Delete:** only DRAFT campaigns can be bulk-deleted; selecting a non-DRAFT campaign triggers a warning toast before the action proceeds
- [ ] **Mobile (375px):** mobile cards show campaign name, subject, status; no swipe quick-action for campaigns (campaigns variant has no swipe)

---

### Tab: Abandoned Carts (`?tab=abandoned-carts`)

**Expect:** Cart rows with customer email, item count, total value, recovered badge, and expiry date.

- [ ] Table renders cart rows; recovered carts show a "Recovered" badge
- [ ] Click a row → AbandonedCartInspector opens
- [ ] Inspector shows customer info, parsed cart items (name, quantity, price), and 3 action buttons
- [ ] **Send Recovery Email:** fires `sendCartRecoveryEmail`; toast confirms; "Recovery email sent" badge appears in inspector; button disables on repeat
- [ ] **Generate Code:** fires `generateCartRecoveryCode`; returned discount code appears in a toast and is stored in inspector state for copy-paste
- [ ] **Mark Recovered:** fires `markCartRecovered`; "Recovered" badge appears in the row on next load
- [ ] Check rows → bulk sheet appears with **Send Recovery / Generate Codes / Mark Recovered**
- [ ] **Bulk Send Recovery:** `bulkSendRecoveryEmails` fires for all selected; toast shows count
- [ ] **Bulk Generate Codes:** confirm prompt → `bulkGenerateRecoveryCodes` fires; toast shows count of codes generated
- [ ] **Bulk Mark Recovered:** confirm prompt → `bulkMarkCartsRecovered` fires; rows update
- [ ] **Mobile (375px):** mobile cards show customer email, item count, total value, recovery-sent badge; swipe-left shows "Send Recovery" quick action

---

### TabPills keyboard shortcuts

The tab strip supports `⌘1`–`⌘5` for quick tab switching (see `components/ui/TabPills.tsx` `showShortcutHints`).

- [ ] Press `⌘1` → URL changes to `?tab=promotions`
- [ ] Press `⌘2` → `?tab=popups`
- [ ] Press `⌘3` → `?tab=subscribers`
- [ ] Press `⌘4` → `?tab=campaigns`
- [ ] Press `⌘5` → `?tab=abandoned-carts`
- [ ] Shortcuts do not fire when typing in an input or textarea

---

### KPI strip cards → tab navigation

- [ ] Click "Active Promotions" card → URL changes to `?tab=promotions`
- [ ] Click "Popup Conv (7d)" card → `?tab=popups`
- [ ] Click "Subscribers" card → `?tab=subscribers`
- [ ] Click "Carts to Recover" card → `?tab=abandoned-carts`

_(Campaigns KPI is not in the strip; navigate via TabPills.)_

---

### CampaignEditor (full-page)

Navigate to `/admin/marketing/campaigns/[id]/edit` for a DRAFT campaign.

- [ ] All editable fields render: name, subject, HTML body (textarea), audience filter, preview pane
- [ ] **Save Draft:** edit subject → "Save Draft" → `updateCampaignDraft` fires; toast confirms; page stays on editor
- [ ] **Preview Audience:** click "Preview Audience" → `previewCampaignAudience` fires; count shown in sidebar
- [ ] **Send Test:** enter your email → "Send Test" → `sendCampaignTest` fires; check Resend dashboard / inbox for the test email
- [ ] **Queue Send:** click "Queue Send" → confirm prompt → `queueCampaignSend` fires; status flips to QUEUED; verify in `EmailQueue` table or Resend logs that the delivery jobs were enqueued
- [ ] Delivery log section renders recent test deliveries (email, status, sent date)
- [ ] Navigate to a non-existent campaign ID → Next.js 404 page renders
- [ ] Navigate to `/admin/marketing/campaigns/[id]/edit` with `NEXT_PUBLIC_ADMIN_V2_ENABLED=false` → redirects to `/admin/newsletter`

---

### PopupEditor (full-page)

Navigate to `/admin/marketing/popups/[id]/edit` for any popup.

- [ ] All 7 editor sections render: name, template selector, position, trigger type, frequency, promotion link, content (title/body/CTA)
- [ ] **Save:** edit name → "Save" → `updatePopup` fires; toast confirms
- [ ] **Activate / Deactivate toggle:** toggle the `isActive` switch → `togglePopupActive` fires; status updates
- [ ] **Add A/B variant:** click "Add Variant" → `createPopupVariant` fires; new variant tab appears in the editor
- [ ] **Remove variant:** click the × on a variant tab → `deletePopupVariant` fires; tab disappears
- [ ] Navigate to a non-existent popup ID → Next.js 404 page renders
- [ ] Navigate to `/admin/marketing/popups/[id]/edit` with flag off → redirects to `/admin/popups/[id]`

---

### V1 regression (flag OFF)

- [ ] Set `NEXT_PUBLIC_ADMIN_V2_ENABLED=false` (or remove from `.env.local`), restart dev server
- [ ] Navigate to `/admin/marketing` → V1 stub renders: links to `/admin/promotions`, `/admin/popups`, `/admin/newsletter`, `/admin/abandoned-carts`
- [ ] Navigate to `/admin/promotions` → original V1 Promotions page renders
- [ ] Navigate to `/admin/popups` → original V1 Popups page renders
- [ ] Navigate to `/admin/newsletter` → original V1 Newsletter page renders
- [ ] Navigate to `/admin/abandoned-carts` → original V1 Abandoned Carts page renders
- [ ] Navigate to `/admin/marketing/campaigns/[id]/edit` (flag off) → redirects to `/admin/newsletter`
- [ ] Navigate to `/admin/marketing/popups/[id]/edit` (flag off) → redirects to `/admin/popups/[id]`
- [ ] No console errors on any V1 page

---

### Email queue verification (newsletter sends)

- [ ] After "Queue Send" in CampaignEditor, query the `EmailQueue` table: `SELECT * FROM "EmailQueue" WHERE "campaignId" = '[id]' ORDER BY "createdAt" DESC LIMIT 10`
- [ ] Confirm rows exist with `status = 'QUEUED'` and the correct `to` addresses
- [ ] Alternatively: check the Resend dashboard → Broadcasts or Emails → confirm delivery jobs appear
- [ ] If `pnpm email:worker` is running: jobs should transition from QUEUED → SENT within the worker poll interval

---

## Known gaps / Phase 5.5 follow-ups

### 1. Filter bar is a placeholder

`AdminMarketingV2.tsx:141–142` renders `{/* TODO(phase-5.5): real filter bar … */}` and a `<div>Filter bar — Phase 5.5</div>`. No search, type/template/status filter, or date range is wired in the UI. All five loaders (`loadPromotionsTab`, `loadPopupsTab`, etc.) accept filter params — the loader side is ready. The UI is not.

### 2. Inline Prisma queries in the five `get*ForInspector` actions

`app/admin/marketing/actions.ts:22–26` explains the intentional parallel-safety inlining. The five `get*ForInspector` wrappers (`getPromotionDetailForInspector`, `getPopupDetailForInspector`, `getSubscriberDetailForInspector`, `getCampaignDetailForInspector`, `getAbandonedCartDetailForInspector`) each inline their Prisma query rather than importing from `lib/admin/marketing.ts`. Now that W1 (data layer) and W2 (server actions) have merged, a clean-up task should replace the inline queries with imports of the corresponding `load*Detail` loaders. No functional impact; purely a DRY refactor.

### 3. Five `load*Detail` loaders in `lib/admin/marketing.ts` are not directly imported

`loadPromotionDetail`, `loadSubscriberDetail`, `loadAbandonedCartDetail` are exported but not imported by any component directly — their logic is paralleled by inline queries in `actions.ts` (see item 2). `loadCampaignDetail` and `loadPopupDetail` are consumed by their respective editor page dispatchers. After the follow-up refactor in item 2, all five loaders will become canonical.

### 4. Bulk promotion code generation not implemented

There is no `bulkGeneratePromotionCodes` action. Promotion codes are single-per-promotion (`Promotion.code` nullable string). A `PromotionCode[]` child table for multi-use code pools (e.g., one-time-use gift codes) is out of scope for Phase 5.

### 5. Auto-cron recovery emails not wired

`sendCartRecoveryEmail` and `bulkSendRecoveryEmails` are manual-trigger only. There is no scheduled job that automatically sends recovery emails for carts older than 1 hour. Deferred: add a cron-triggered worker using `lib/email/queue.ts` that scans `AbandonedCart` where `recovered = false AND expiresAt > now() AND recoveryEmailSent = false AND createdAt < now() - 1h`.

### 6. Visual popup builder not shipped

`PopupEditor` exposes all structural fields (template, position, trigger, frequency, content) but has no drag-and-drop visual builder. A full visual editor with live preview canvas is a Phase 5.5 scope item.

### 7. Promotion segmentation is a raw string field

`Promotion.customerEmails` is stored as a nullable string (likely comma-separated). The editor surfaces this as a plain textarea. No audience-builder UI, no integration with `NewsletterSubscriber` lists, and no CSV import for targeted promotion codes.

### 8. Email open/click tracking not connected

`NewsletterCampaignDelivery` has `openedAt` and `clickedAt` columns (if present in schema) but no Resend webhook handler populates them. Phase 5.5: add `POST /api/webhooks/resend` to receive Resend delivery events and update `NewsletterCampaignDelivery` rows.

### 9. UTM attribution per source

`AbandonedCart.source` is surfaced in the inspector but there is no UTM link generation or session-attribution for recovered carts. Deferred to Phase 5.5 analytics work.

### 10. `PopupInspector.tsx:160` lint error — `set-state-in-effect`

`components/admin/marketing/PopupInspector.tsx:160` triggers `react-hooks/set-state-in-effect`: multiple `setState` calls are made synchronously inside a `useEffect` that syncs `detail` prop changes into local state. This is a controlled-pattern known issue also seen in Phase 4's `ShippingRatePicker`. Fix in Phase 5.5: replace the effect-based sync with `useMemo`-derived state or a `key={detail?.id}` reset on the parent.

### 11. Three unused `_id` warnings in ListView orchestrators

`AbandonedCartsListView.tsx:103`, `PromotionsListView.tsx:99`, and `SubscribersListView.tsx:107` each have an `_id` parameter in an inline callback that is intentionally unused (underscored). These generate `@typescript-eslint/no-unused-vars` warnings. Cosmetic only; no functional impact.

### 12. TypeScript error — `CampaignDetailFull.recentTestDeliveries` type mismatch (new in Phase 5)

`tsc --noEmit` reports one new Phase 5 error:

| File | Error |
|------|-------|
| `app/admin/marketing/campaigns/[id]/edit/page.tsx:21` | `CampaignDetailFull` from `lib/admin/marketing` is not assignable to `CampaignDetailFull` from `app/admin/marketing/actions`. Root cause: `CampaignDeliveryRow.status` typed as `string` in the actions inline shape vs `NewsletterDeliveryStatus` enum in the lib shape — same parallel-safety pattern as Phase 4's `OrderDetailFull.status` mismatch. Fix in Phase 5.5 by the inline-query refactor (item 2 above). |

This does not crash the application at runtime — the data shapes are structurally compatible.

---

## Test coverage summary

**25 Phase 5 test files, 242 tests — all passing.**

| Layer | File | Tests |
|-------|------|-------|
| Marketing loaders | `tests/unit/lib/admin/marketing.test.ts` | 17 |
| Server actions | `tests/unit/app/admin/marketing/actions.test.ts` | 71 |
| MarketingListTable | `tests/unit/components/admin/marketing/MarketingListTable.test.tsx` | 9 |
| MarketingListCardMobile | `tests/unit/components/admin/marketing/MarketingListCardMobile.test.tsx` | 24 |
| PromotionInspector | `tests/unit/components/admin/marketing/PromotionInspector.test.tsx` | 5 |
| PopupInspector | `tests/unit/components/admin/marketing/PopupInspector.test.tsx` | 36 |
| AbandonedCartInspector | `tests/unit/components/admin/marketing/AbandonedCartInspector.test.tsx` | 5 |
| SubscriberInspector | `tests/unit/components/admin/marketing/SubscriberInspector.test.tsx` | 4 |
| CampaignInspector | `tests/unit/components/admin/marketing/CampaignInspector.test.tsx` | 5 |
| PromotionBulkSheet | `tests/unit/components/admin/marketing/PromotionBulkSheet.test.tsx` | 3 |
| PopupBulkSheet | `tests/unit/components/admin/marketing/PopupBulkSheet.test.tsx` | 2 |
| CampaignBulkSheet | `tests/unit/components/admin/marketing/CampaignBulkSheet.test.tsx` | 3 |
| AbandonedCartBulkSheet | `tests/unit/components/admin/marketing/AbandonedCartBulkSheet.test.tsx` | 6 |
| SubscriberBulkSheet | `tests/unit/components/admin/marketing/SubscriberBulkSheet.test.tsx` | 3 |
| PromotionsListView | `tests/unit/components/admin/marketing/PromotionsListView.test.tsx` | 3 |
| PopupsListView | `tests/unit/components/admin/marketing/PopupsListView.test.tsx` | 2 |
| CampaignsListView | `tests/unit/components/admin/marketing/CampaignsListView.test.tsx` | 2 |
| AbandonedCartsListView | `tests/unit/components/admin/marketing/AbandonedCartsListView.test.tsx` | 2 |
| SubscribersListView | `tests/unit/components/admin/marketing/SubscribersListView.test.tsx` | 5 |
| CampaignEditor | `tests/unit/components/admin/marketing/editor/CampaignEditor.test.tsx` | 7 |
| PopupEditor | `tests/unit/components/admin/marketing/editor/PopupEditor.test.tsx` | 5 |
| AdminMarketingV2 | `tests/unit/components/admin/dashboard/AdminMarketingV2.test.tsx` | 9 |
| Marketing list dispatcher | `tests/unit/app/admin/marketing/page.test.tsx` | 3 |
| Campaign editor dispatcher | `tests/unit/app/admin/marketing/campaigns/[id]/edit/page.test.tsx` | 5 |
| Popup editor dispatcher | `tests/unit/app/admin/marketing/popups/[id]/edit/page.test.tsx` | 6 |
| **Total** | | **242** |

`loadPromotionDetail`, `loadSubscriberDetail`, and `loadAbandonedCartDetail` have no dedicated Phase 5 loader test (they are not directly consumed by any component — see Known gaps #3). All other exported functions in `lib/admin/marketing.ts` and `app/admin/marketing/actions.ts` are exercised through the component and integration-style mock tests.

---

## Regression risk

**Low.** Assessment by area:

**Schema change.** None. Zero Prisma migrations were created in Phase 5. All five domain models (`Promotion`, `MarketingPopup`, `NewsletterSubscriber`, `NewsletterCampaign`, `AbandonedCart`) and their relations existed before Phase 5. Schema regression risk: none.

**V1 marketing pages.** None of the four V1 marketing pages (`/admin/promotions`, `/admin/popups`, `/admin/newsletter`, `/admin/abandoned-carts`) were modified by any Phase 5 PR. The new `/admin/marketing` dispatcher renders `AdminMarketingV1` (a new stub in `components/admin/_v1/AdminMarketingV1.tsx`) when the flag is off. The stub renders links to the four V1 pages — it does not touch or wrap any V1 code.

**`BottomActionSheet` primitive.** PR #130 (`SubscriberBulkSheet`) added an optional `disabled?: boolean` field to `BottomActionSheet`'s action item type. The field defaults to `undefined` (falsy), so all existing callers of `BottomActionSheet` that do not pass `disabled` are unaffected. Additive, backward-compatible change.

**`lib/email/newsletter.ts` and `app/api/admin/newsletter/*` routes.** Not modified. Phase 5's `sendCampaignTest` and `queueCampaignSend` server actions delegate to `lib/newsletter/campaigns.ts` (which wraps the Resend send + `EmailQueue` enqueue) — they do not reimplement send logic.

**`lib/newsletter/campaigns.ts` and `lib/newsletter/audience.ts`.** Read by Phase 5 actions at import time. Not modified by Phase 5.

---

## Lint / TypeScript status

### ESLint — Phase 5 files only

**Result: 1 error, 3 warnings (all new in Phase 5).**

| File | Line | Rule | Notes |
|------|------|------|-------|
| `components/admin/marketing/PopupInspector.tsx` | 160 | `react-hooks/set-state-in-effect` | Multiple `setState` calls in a `useEffect` sync block — see Known gap #10 |
| `components/admin/marketing/AbandonedCartsListView.tsx` | 103 | `no-unused-vars` | `_id` intentionally underscore-prefixed callback param |
| `components/admin/marketing/PromotionsListView.tsx` | 99 | `no-unused-vars` | Same pattern |
| `components/admin/marketing/SubscribersListView.tsx` | 107 | `no-unused-vars` | Same pattern |

No new lint errors in non-Phase 5 files introduced by Phase 5.

### ESLint — Full project

**Result: 496 errors, 309 warnings (total 805 problems).** All pre-existing. The 4 Phase 5 contributions above are a subset of the total.

### `pnpm exec tsc --noEmit` — Full project

**Result: 21 errors — 20 pre-existing, 1 new in Phase 5.**

New Phase 5 error:

| File | Error | Details |
|------|-------|---------|
| `app/admin/marketing/campaigns/[id]/edit/page.tsx:21` | TS2322 | `CampaignDetailFull.recentTestDeliveries[].status` typed as `string` (actions.ts inline shape) vs `NewsletterDeliveryStatus` enum (lib shape) — see Known gap #12 |

Pre-existing errors (unchanged from Phase 4 baseline):

| File | Error |
|------|-------|
| `app/api/admin/admin-audit-logs/route.ts` | TS2305/TS2724: `AdminRole` / `verifyAdminRole` not exported from `lib/auth/admin` |
| `app/api/admin/audit-logs/route.ts` | Same |
| `app/api/admin/fulfillment/tickets/[id]/decision/route.ts` | Same |
| `app/api/admin/loyalty/tiers/[id]/route.ts` | Same |
| `components/avatar/AvatarModel.tsx:512,517` | TS2352: unsafe cast `Object3D` → `Mesh` |
| `lib/stripe/config.ts:11` | TS2322: Stripe API version string mismatch |
| `components/admin/fulfillment/OrdersListView.tsx:83` | TS2345: `OrderDetailFull.status` string vs `OrderStatus` enum (Phase 4 known issue) |
| `components/admin/fulfillment/ReturnsListView.tsx:75` | TS2345: `ReturnWithItems.status` string vs `ReturnStatus` enum (Phase 4 known issue) |
| `scripts/backfill-returns-from-tickets.ts:96` | TS2322: `string \| null` not assignable to `string \| undefined` (Phase 4 known issue) |
| `tests/unit/components/admin/products/ProductsListView.test.tsx:10,15,124,277` | TS2558/TS2345: Vitest two-arg generic (Phase 3 known issue) |
| `tests/unit/lib/admin/rma-counter.test.ts:18` | TS2322: `Promise<unknown>` not assignable to `Promise<void>` (Phase 4 known issue) |

### `pnpm test` — Full suite

**Result: 9 failed | 155 passed (164 files) — 33 tests failed out of 961 total.**

All 33 failures are pre-existing and confined to non-Phase-5 files. No Phase 5 file contributes to any failure.

| File | Failed / Total | Root cause |
|------|---------------|------------|
| `tests/unit/collections-page.test.tsx` | 4 / 4 | UI query mismatches (pre-existing) |
| `tests/unit/fulfillment-case-drawer.test.tsx` | 2 / 5 | Element not found (pre-existing) |
| `tests/unit/fulfillment-queue-grid.test.tsx` | 2 / 2 | Multiple elements found (pre-existing) |
| `tests/unit/navigation-dropdown.test.tsx` | 2 / 10 | Element not found (pre-existing) |
| `tests/unit/navigation-mobile-menu-cart-widget.test.tsx` | 3 / 3 | waitFor timeout (pre-existing) |
| `tests/unit/product-page-client.test.tsx` | 4 / 7 | Element not found (pre-existing) |
| `tests/unit/products-page-filters.test.tsx` | 5 / 5 | Element not found (pre-existing) |
| `tests/unit/profile-page-tabs.test.tsx` | 6 / 6 | Element not found (pre-existing) |
| `tests/unit/components/admin/products/ProductsListView.test.tsx` | 6 / 21 | `cookies()` outside request scope (pre-existing) |

---

## Code consistency audit

### Dispatcher: `app/admin/marketing/page.tsx`

Correct. Imports `AdminMarketingV1` from `@/components/admin/_v1/AdminMarketingV1` and `AdminMarketingV2` from `@/components/admin/dashboard/AdminMarketingV2`. Flag check is `process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED !== 'true'`. No secondary condition. The page also resolves `isSuperAdmin` once at the server boundary and forwards it to `AdminMarketingV2` (which passes it to `SubscribersListView` for the PII Delete gate).

### Dispatcher: `app/admin/marketing/campaigns/[id]/edit/page.tsx`

Correct. Flag off → `redirect('/admin/newsletter')`. Flag on → loads `CampaignDetailFull` via `loadCampaignDetail`, calls `notFound()` on null, renders `<CampaignEditor detail={detail} campaignId={id} />`.

### Dispatcher: `app/admin/marketing/popups/[id]/edit/page.tsx`

Correct. Flag off → `redirect(\`/admin/popups/${id}\`)`. Flag on → loads `PopupDetailFull` via `loadPopupDetail`, calls `notFound()` on null, renders `<PopupEditor detail={detail} popupId={id} />`.

### AdminMarketingV2 — ListView references

All five Wave 5 list views are imported and rendered under the correct tab:

| Component | Tab condition |
|-----------|--------------|
| `PromotionsListView` | `currentTab === 'promotions'` |
| `PopupsListView` | `currentTab === 'popups'` |
| `SubscribersListView` | `currentTab === 'subscribers'` |
| `CampaignsListView` | `currentTab === 'campaigns'` |
| `AbandonedCartsListView` | default (else branch = `'abandoned-carts'`) |

No orphan ListView components detected. Tab ID `abandoned-carts` (not `carts`) is used consistently in `MARKETING_TABS`, `MarketingTab` type, and `AdminMarketingV2`'s `KpiStripSlot` link href.

### Server action coverage

All 46 exported server actions in `app/admin/marketing/actions.ts` are consumed by at least one component:

| Group | Actions | Consumers |
|-------|---------|-----------|
| Promotions | `createPromotion`, `updatePromotion`, `deletePromotion`, `togglePromotionActive`, `suggestPromotionCode`, `checkPromotionCodeUnique`, `bulkActivatePromotions`, `bulkDeactivatePromotions`, `bulkDeletePromotions`, `getPromotionDetailForInspector` | `PromotionInspector.tsx`, `PromotionBulkSheet.tsx`, `PromotionsListView.tsx` |
| Popups | `createPopup`, `updatePopup`, `deletePopup`, `togglePopupActive`, `duplicatePopup`, `createPopupVariant`, `updatePopupVariant`, `deletePopupVariant`, `bulkActivatePopups`, `bulkDeactivatePopups`, `bulkDuplicatePopups`, `bulkDeletePopups`, `getPopupDetailForInspector` | `PopupInspector.tsx`, `PopupEditor.tsx`, `PopupBulkSheet.tsx`, `PopupsListView.tsx` |
| Subscribers | `unsubscribeSubscriber`, `deleteSubscriber`, `bulkUnsubscribeSubscribers`, `bulkExportSubscribersCsv`, `bulkDeleteSubscribers`, `getSubscriberDetailForInspector` | `SubscriberInspector.tsx`, `SubscriberBulkSheet.tsx`, `SubscribersListView.tsx` |
| Campaigns | `createCampaignDraft`, `updateCampaignDraft`, `duplicateCampaign`, `deleteCampaign`, `queueCampaignSend`, `sendCampaignTest`, `previewCampaignAudience`, `bulkDuplicateCampaigns`, `bulkDeleteCampaigns`, `getCampaignDetailForInspector` | `CampaignEditor.tsx`, `CampaignInspector.tsx`, `CampaignBulkSheet.tsx`, `CampaignsListView.tsx` |
| Abandoned Carts | `sendCartRecoveryEmail`, `generateCartRecoveryCode`, `markCartRecovered`, `bulkSendRecoveryEmails`, `bulkGenerateRecoveryCodes`, `bulkMarkCartsRecovered`, `getAbandonedCartDetailForInspector` | `AbandonedCartInspector.tsx`, `AbandonedCartBulkSheet.tsx`, `AbandonedCartsListView.tsx` |

### Loader coverage

| Loader | Consumer | Notes |
|--------|----------|-------|
| `loadMarketingKpis` | `AdminMarketingV2.tsx` (KpiStripSlot) | |
| `loadPromotionsTab` | `AdminMarketingV2.tsx` (PromotionsSlot) | |
| `loadPopupsTab` | `AdminMarketingV2.tsx` (PopupsSlot) | |
| `loadSubscribersTab` | `AdminMarketingV2.tsx` (SubscribersSlot) | |
| `loadCampaignsTab` | `AdminMarketingV2.tsx` (CampaignsSlot) | |
| `loadAbandonedCartsTab` | `AdminMarketingV2.tsx` (AbandonedCartsSlot) | |
| `loadCampaignDetail` | `app/admin/marketing/campaigns/[id]/edit/page.tsx` | Server component, safe direct import |
| `loadPopupDetail` | `app/admin/marketing/popups/[id]/edit/page.tsx` | Server component, safe direct import |
| `loadPromotionDetail` | Not directly imported | Paralleled by inline query in `getPromotionDetailForInspector`; Phase 5.5 refactor target |
| `loadSubscriberDetail` | Not directly imported | Same — paralleled in `getSubscriberDetailForInspector` |
| `loadAbandonedCartDetail` | Not directly imported | Same — paralleled in `getAbandonedCartDetailForInspector` |
| `isMarketingTab` | `AdminMarketingV2.tsx` | Type guard |

### Flag gating

`NEXT_PUBLIC_ADMIN_V2_ENABLED` is the only flag used in all three Phase 5 dispatchers. Checked as `process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED !== 'true'`. No secondary flag.

### Mobile / desktop breakpoint split

| Component | Pattern | Result |
|-----------|---------|--------|
| `MarketingListTable.tsx:229` | `hidden md:block` on table wrapper | Desktop table hidden on mobile — correct |
| `AbandonedCartsListView.tsx:145` | `md:hidden` on mobile cards container | Mobile cards hidden on desktop — correct |
| `CampaignsListView.tsx:78` | `md:hidden` on mobile cards container | Correct |
| `SubscribersListView.tsx:153` | `md:hidden` on mobile cards container | Correct |
| `PopupsListView.tsx:131` | `md:hidden` on mobile cards container | Correct |
| `PromotionsListView.tsx:145` | `md:hidden` on mobile cards container | Correct |
| `MarketingListCardMobile.tsx:431` | `md:hidden` at root element | Correct |

The table/card split is applied consistently at both the view-orchestration layer (each `*ListView`) and the individual card component. All five tabs use the same `MarketingListTable` (desktop) + `MarketingListCardMobile` (mobile) pair.
