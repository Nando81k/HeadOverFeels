# Admin Rebuild — Phase 7: Loyalty QA Findings

**Date:** 2026-05-31
**Phase 7 PRs:** #169 (data layer, 20 tests), #170 (server actions, 63 tests), #171 MemberGrowthChart, #172 TopRewardsBar, #173 TierDistributionChart, #174 PointsActivityChart, #175 TierPerksQuickToggle, #176 RecentTransactionsTable, #177 EventInspector, #178 PopularRewardsList, #179 AdjustPointsDialog, #180 MemberLedger, #181 RewardActivationsQuickToggle, #182 LoyaltySettingsInspector, #183 MemberInspector, #184 RewardInspector, #185 ExportButton, #186 RedemptionInspector, #187 TierInspector, #188 RedemptionsBulkSheet, #189 RewardsBulkSheet, #190 MembersBulkSheet, #191 EventsBulkSheet, #192 OverviewTab, #193 EventsTab, #194 RewardsTab, #195 MembersTab, #196 TiersTab, #197 RedemptionsTab, #198 AdminLoyaltyV2 + V1 stub + dispatcher, #199 RewardEditor + dispatcher

---

## Summary

Phase 7 ships the complete V2 `/admin/loyalty` umbrella page: six tabs (Overview, Members, Tiers, Rewards, Redemptions, Events) with a KPI strip, 4 Recharts chart components, 6 Inspectors, AdjustPointsDialog, 6 utility components, 4 BulkSheets, and 36 server actions — all gated behind `NEXT_PUBLIC_ADMIN_V2_ENABLED` with zero schema migrations. All points and tier mutations route exclusively through the existing atomic `lib/loyalty/service.ts` operations (preserving PR #17 + #37 guards); a full-page RewardEditor lands at `/admin/loyalty/rewards/[id]/edit` and the original V1 page is preserved verbatim at `/admin/loyalty-v1`.

---

## How to enable

Add to `.env.local`:

```
NEXT_PUBLIC_ADMIN_V2_ENABLED=true
```

Restart the dev server (`pnpm dev`). Phases 1 through 7 all activate together under the single flag. The V1 loyalty page (`/admin/loyalty-v1`) and all six existing V1 sub-routes (`/admin/loyalty/customers`, `/tiers`, `/rewards`, `/redemptions`, `/events`, `/settings`) remain accessible regardless of the flag — they are not modified.

---

## Smoke test checklist

### Before you start

- [ ] `NEXT_PUBLIC_ADMIN_V2_ENABLED=true` in `.env.local`, dev server restarted
- [ ] Sign in as an admin user
- [ ] Navigate to `/admin/loyalty`

---

### Shared controls (test before diving into tabs)

**LoyaltyTabPills**
- [ ] Six tab pills render: Overview / Members / Tiers / Rewards / Redemptions / Events
- [ ] Clicking a tab updates `?tab=` in the URL and renders the correct content
- [ ] Keyboard shortcut hints display (⌘1 through ⌘6 labels)
- [ ] Pressing ⌘1–⌘6 jumps to the corresponding tab

**LoyaltyRangePills**
- [ ] Five range pills render: Today / 7d / 30d / 90d / Year (default is 30d)
- [ ] Clicking a range updates `?range=` in the URL and re-fetches KPI strip + affected charts
- [ ] Current `?tab=` is preserved when switching range
- [ ] Navigating directly to `?tab=members&range=90d` renders the Members tab with 90-day context

**KPI strip** (always visible, above tab content)
- [ ] Four stat cards: Active Members / Points Earned / Points Redeemed / Redemption Rate
- [ ] Active Members card links to `?tab=members`; Points Earned card links to `?tab=overview`
- [ ] Trend arrows reflect change vs previous period
- [ ] Cards show `0` and neutral trend on an empty dataset rather than crashing

**⚙ Settings button**
- [ ] Settings button (LoyaltySettingsButton) visible in header area
- [ ] Click opens LoyaltySettingsInspector slide-out
- [ ] Inspector shows all configurable fields (points per dollar, referral, review, birthday, expiration settings)
- [ ] Cron-managed fields (`pointsExpireMonths`, `tierEvaluationPeriod`) displayed as read-only with a note pointing to `.github/workflows/`
- [ ] Save calls `updateLoyaltySettings` → toast confirms → values reflect on next load

---

### Tab: Overview (`?tab=overview`)

**Expect:** 4 charts + TierPerksQuickToggle + RewardActivationsQuickToggle + RecentTransactionsTable + PopularRewardsList + ExportButton

- [ ] PointsActivityChart renders earned vs redeemed lines for the selected range
- [ ] TierDistributionChart renders a donut/bar of members per tier
- [ ] TopRewardsBar renders top rewards by redemption count (horizontal bar)
- [ ] MemberGrowthChart renders an area chart of member count over time
- [ ] TierPerksQuickToggle lists all tiers with per-perk toggle switches (freeShipping, earlyDropAccess); toggling calls `updateTier` and persists
- [ ] RewardActivationsQuickToggle lists active rewards with isActive switch; toggling calls `toggleRewardActive`
- [ ] RecentTransactionsTable shows up to 10 most recent PointsTransactions with type pill, member email, points delta, and date
- [ ] PopularRewardsList shows top 5 rewards by `totalRedeemed` with rank and point cost
- [ ] ExportButton visible; click triggers `exportOverviewCsv(range)` → browser downloads `loyalty-overview-<range>-*.csv`
- [ ] **Mobile (375px):** charts stack in a single column; widget grid collapses to full-width cards

---

### Tab: Members (`?tab=members`)

**Expect:** Paginated table + MemberInspector + MembersBulkSheet

- [ ] Table renders rows with: email, tier badge, currentPoints, lifetimePoints, last order date
- [ ] Search/filter controls narrow results
- [ ] Row click → `getMemberDetailForInspector` fires → MemberInspector opens
- [ ] MemberInspector shows member summary + last 50 PointsTransactions in MemberLedger with transaction type filter dropdown
- [ ] AdjustPointsDialog (single mode): enter delta + reason → submits `adjustMemberPoints` → ADMIN_ADJUSTMENT row appears in ledger → toast confirms
- [ ] AdjustPointsDialog rejects: zero delta, blank reason, negative delta that would overdraft
- [ ] "Recompute Tier" button calls `recomputeMemberTier` → toast shows updated tier or "no change"
- [ ] Checkbox selection enables MembersBulkSheet with: Bulk Adjust Points (SUPER_ADMIN only — AdjustPointsDialog bulk mode), Bulk Re-tier, Export CSV
- [ ] Bulk Adjust toast summarizes success count + failure count per member
- [ ] **Mobile (375px):** table becomes card list; MemberInspector slides up from bottom

---

### Tab: Tiers (`?tab=tiers`)

**Expect:** Card grid + TierInspector (create/edit/delete)

- [ ] Card grid shows tier name, color swatch, minAnnualSpend/minAnnualPoints thresholds, pointMultiplier, active perk pills, member count badge
- [ ] Card click → `getTierDetailForInspector` fires → TierInspector opens in edit mode
- [ ] "+ New Tier" button → TierInspector opens in create mode with blank fields
- [ ] Save in edit mode calls `updateTier` → card updates on re-fetch → toast confirms
- [ ] Save in create mode calls `createTier` → new card appears → toast confirms
- [ ] Delete button is hidden for non-SUPER_ADMIN users (tooltip: "SUPER_ADMIN only")
- [ ] SUPER_ADMIN delete: blocked when any customer has this tier (error toast: "Cannot delete tier with active members"); succeeds when tier has 0 members
- [ ] **Mobile (375px):** card grid is 1-column; TierInspector slides up from bottom

---

### Tab: Rewards (`?tab=rewards`)

**Expect:** Card grid + RewardInspector + RewardsBulkSheet + link to RewardEditor

- [ ] Card grid renders: reward name, type badge, pointsCost, totalRedeemed, isActive pill
- [ ] "+ New Reward" link routes to V1 new-reward page (Phase 7.5 follow-up: V2 create flow)
- [ ] Card click → `getRewardDetailForInspector` fires → RewardInspector quick-edit panel opens
- [ ] RewardInspector shows: name (read-only display), isActive toggle, pointsCost field, maxRedemptionsPerCustomer, minTierRequired dropdown
- [ ] Saving RewardInspector calls `updateReward` → card updates → toast confirms
- [ ] "Edit details →" link navigates to `/admin/loyalty/rewards/[id]/edit` (V2 RewardEditor when flag is on)
- [ ] RewardEditor at `/admin/loyalty/rewards/[id]/edit` renders all reward fields pre-filled; Save calls `updateReward`; Delete (SUPER_ADMIN only, blocked if redemptions exist) calls `deleteReward`
- [ ] Checkbox selection enables RewardsBulkSheet: Bulk Activate, Bulk Deactivate
- [ ] CSV export downloads reward rows
- [ ] **Mobile (375px):** card grid is 2-column; RewardInspector panel slides up from bottom

---

### Tab: Redemptions (`?tab=redemptions`)

**Expect:** Audit table + RedemptionInspector + RedemptionsBulkSheet

- [ ] Audit table renders: customer email, reward name, pointsSpent, status pill (PENDING/ACTIVE/USED/EXPIRED/CANCELLED/FULFILLED), couponCode, createdAt
- [ ] Row click → `getRedemptionDetailForInspector` fires → RedemptionInspector opens with full detail
- [ ] "Mark Fulfilled" button visible only when status is PENDING or ACTIVE; submits `fulfillRedemption` with optional trackingNumber → status updates to FULFILLED → toast confirms
- [ ] "Cancel Redemption" SUPER_ADMIN-gated; on success calls `cancelRedemption` → refunds points via `awardPoints` with idempotency key `cancel-<redemptionId>` → status becomes CANCELLED → toast: "Refunded N points"
- [ ] Cancellation rejected for FULFILLED / USED / EXPIRED statuses (error toast)
- [ ] Checkbox selection enables RedemptionsBulkSheet: Bulk Fulfill, Bulk Cancel (SUPER_ADMIN)
- [ ] CSV export downloads redemption rows for selected range
- [ ] **Mobile (375px):** table scrolls horizontally; RedemptionInspector slides up from bottom

---

### Tab: Events (`?tab=events`)

**Expect:** Card grid (active/scheduled/ended pills) + EventInspector (full CRUD) + EventsBulkSheet

- [ ] Card grid with filter pills: All / Active / Scheduled / Ended
- [ ] Cards show: event name, multiplier, date range, tierIds count, ordersAffected, totalBonusPointsAwarded
- [ ] "+ New Event" button → EventInspector opens in create mode
- [ ] Card click → `getEventDetailForInspector` fires → EventInspector opens in edit mode
- [ ] EventInspector create: fill name, multiplier, startDate, endDate, tier filter → `createEvent` → card appears
- [ ] EventInspector edit: change multiplier or dates → `updateEvent` → card updates
- [ ] EventInspector delete (available to all admins — events are not PII): `deleteEvent` → card removed → toast
- [ ] Stats display: ordersAffected and totalBonusPointsAwarded shown as read-only in inspector
- [ ] Checkbox selection enables EventsBulkSheet: Bulk Activate, Bulk Deactivate
- [ ] CSV export downloads event rows
- [ ] **Mobile (375px):** cards stack; EventInspector slides up from bottom; date pickers are full-width

---

### V1 fallback and legacy routes

- [ ] **Flag off:** set `NEXT_PUBLIC_ADMIN_V2_ENABLED=false` (or remove from `.env.local`), restart → `/admin/loyalty` renders AdminLoyaltyV1 stub with 7 link cards to V1 sub-routes
- [ ] `/admin/loyalty-v1` renders the original 711L loyalty page verbatim — the dedicated route is never gated by the flag
- [ ] `/admin/loyalty/customers` — V1 customers sub-route renders (unmodified)
- [ ] `/admin/loyalty/tiers` — V1 tiers sub-route renders (unmodified)
- [ ] `/admin/loyalty/rewards` — V1 rewards sub-route renders (unmodified)
- [ ] `/admin/loyalty/redemptions` — V1 redemptions sub-route renders (unmodified)
- [ ] `/admin/loyalty/events` — V1 events sub-route renders (unmodified)
- [ ] `/admin/loyalty/settings` — V1 settings sub-route renders (unmodified)
- [ ] `/admin/loyalty/rewards/[id]/edit` with flag off → 308 redirect to `/admin/loyalty-v1/rewards/[id]/edit` → V1 editor renders
- [ ] `/admin/loyalty-v1/rewards/[id]/edit` renders `AdminLoyaltyRewardEditV1Page` directly (never gated)

---

## Known gaps / Phase 7.5 follow-ups

One `TODO(phase-7.5)` comment was found in the codebase. Additional plan-deferred items are listed below.

### TODO(phase-7.5) comments found

| File | Line | Item |
|------|------|------|
| `components/admin/loyalty/charts/PointsActivityChart.tsx` | 22 | Wire `onPointClick` to chart `onClick` handler for date-range drill-down |

### Plan-deferred items

- **In-UI cron schedule editing** — `pointsExpireMonths` and `tierEvaluationPeriod` are stored in `LoyaltySettings` but displayed read-only in the inspector; the note directs to `.github/workflows/`. A UI editor requires cron infrastructure changes.
- **Manual trigger buttons** — `expireOldPoints`, `awardBirthdayPoints`, `recomputeAllTiers` are SUPER_ADMIN cron jobs with no in-UI trigger button yet.
- **V2 "New Reward" create flow** — the "+ New Reward" link in RewardsTab routes to the V1 new-reward page; a V2 create mode for RewardEditor is deferred.
- **Calendar view for Events tab** — Events tab ships as a card grid; a calendar/gantt view for scheduling overlapping multiplier events is deferred.
- **Phase 2 dashboard loyalty tile** — the main admin dashboard (Phase 2) does not yet show a loyalty KPI tile linking to `/admin/loyalty?tab=overview`.
- **Referral program admin** — `referralEnabled` is a LoyaltySettings toggle but there is no dedicated referral program management tab.
- **Notifications log / audit trail** — no audit log viewer for admin actions on tiers, rewards, or member adjustments.
- **In-UI tier-recompute progress for bulk re-tier** — `bulkRecomputeTiers` runs sequentially; a progress indicator for large member sets is deferred.
- **Bulk import members from CSV** — MembersBulkSheet exports but does not yet import.
- **Loyalty A/B testing** — no variant/experiment management for point multiplier rules.
- **Storefront preview of tier perks** — no in-admin preview of how tier perks render on the storefront loyalty landing page.

---

## Test coverage summary

Phase 7 ships **32 test files** covering all major components and the data layer.

Run Phase 7 tests in isolation:

```bash
pnpm exec vitest run \
  "tests/unit/app/admin/loyalty" \
  "tests/unit/components/admin/loyalty" \
  "tests/unit/lib/admin/loyalty"
```

All 32 Phase 7 test files pass: **186/186 tests green**.

| Category | Files | Tests |
|----------|-------|-------|
| Data layer (`lib/admin/loyalty.ts`) | 1 | 20 |
| Server actions (`app/admin/loyalty/actions.ts`) | 1 | 63 |
| Page dispatcher (`app/admin/loyalty/page.tsx`) | 1 | varies |
| Rewards edit page (`app/admin/loyalty/rewards/[id]/edit/page.tsx`) | 1 | varies |
| Chart components (4 charts) | 4 | varies |
| Utility components (AdjustPointsDialog, ExportButton, MemberLedger, PopularRewardsList, RecentTransactionsTable, RewardActivationsQuickToggle, TierPerksQuickToggle, RewardEditor) | 8 | varies |
| Inspector components (6 inspectors) | 6 | varies |
| BulkSheet components (4 bulk sheets) | 4 | varies |
| Tab components (6 tabs) | 6 | varies |
| **Total** | **32 files** | **186 passing** |

---

## Regression risk

- **New DB tables:** NONE — zero Prisma migrations. Phase 7 reuses existing `LoyaltyTier`, `PointsTransaction`, `Reward`, `RewardRedemption`, `PointsMultiplierEvent`, `LoyaltySettings`, `Customer` loyalty fields.
- **Existing V1 sub-routes:** NOT modified — `/admin/loyalty/customers`, `/tiers`, `/rewards`, `/redemptions`, `/events`, `/settings` are untouched original pages.
- **`app/admin/loyalty/page.tsx`:** replaced with a dispatcher (46 lines). Original V1 content preserved verbatim at `components/admin/_v1/AdminLoyaltyV1.tsx`, served via `/admin/loyalty-v1`.
- **`app/admin/loyalty/rewards/[id]/edit/page.tsx`:** replaced with a dispatcher. Original V1 editor preserved as `AdminLoyaltyRewardEditV1Page`, served at `/admin/loyalty-v1/rewards/[id]/edit`.
- **`lib/loyalty/service.ts` (atomic service):** NOT modified — server actions wrap its `awardPoints` / `deductPoints` / `updateCustomerTier` exports. All idempotency-key patterns from PR #17 + #37 are preserved.
- **5 SUPER_ADMIN-gated actions verified:** `deleteTier`, `deleteReward`, `cancelRedemption`, `bulkAdjustMemberPoints`, `bulkCancelRedemptions` — all call `requireAdminRole('SUPER_ADMIN')` before any mutation.
- **Existing API routes:** NOT modified — Phase 7 server actions wrap Prisma/service calls directly; they do not proxy existing `/api/admin/loyalty/*` routes.
- **Client bundle Prisma rule:** All `'use client'` components import only `type` from `app/admin/loyalty/actions.ts`; runtime Prisma calls flow exclusively through server actions.
- **`dark:` Tailwind modifier rule:** No `dark:` modifiers found in Phase 7 components. Always-dark palette uses `bg-neutral-*`, `text-white/50`, `border-white/8` direct classes.

---

## Code consistency audit results

| Check | Result |
|-------|--------|
| Dispatcher (`app/admin/loyalty/page.tsx`) imports V1 + V2 correctly | PASS — `AdminLoyaltyV1` from `_v1/`, `AdminLoyaltyV2` from `dashboard/` |
| RewardEditor dispatcher redirects flag-off to V1 edit URL | PASS — `redirect('/admin/loyalty-v1/rewards/${id}/edit')` when flag off |
| V1 relocation: `/admin/loyalty-v1` | PASS — `app/admin/loyalty-v1/page.tsx` renders `AdminLoyaltyV1Page` |
| V1 relocation: `/admin/loyalty-v1/rewards/[id]/edit` | PASS — `app/admin/loyalty-v1/rewards/[id]/edit/page.tsx` renders `AdminLoyaltyRewardEditV1Page` |
| All 6 Tab components referenced by AdminLoyaltyV2 | PASS — OverviewTab, MembersTab, TiersTab, RewardsTab, RedemptionsTab, EventsTab all in Suspense slots |
| All 4 charts referenced by OverviewTab | PASS — PointsActivityChart, TierDistributionChart, TopRewardsBar, MemberGrowthChart imported |
| All 6 Inspectors wired | PASS — Member→MembersTab, Tier→TiersTab, Reward→RewardsTab, Redemption→RedemptionsTab, Event→EventsTab, LoyaltySettings→LoyaltySettingsButton |
| All 4 BulkSheets referenced by correct tabs | PASS — MembersBulkSheet→MembersTab, RewardsBulkSheet→RewardsTab, RedemptionsBulkSheet→RedemptionsTab, EventsBulkSheet→EventsTab |
| All 6 utility components referenced | PASS — TierPerksQuickToggle, RewardActivationsQuickToggle, RecentTransactionsTable, PopularRewardsList, MemberLedger, ExportButton all imported by tabs |
| 5 CSV export actions all have consumers in ExportButton | PASS — exportOverviewCsv, exportMembersCsv, exportRewardsCsv, exportRedemptionsCsv, exportEventsCsv wired via switch |
| Single flag gate (`NEXT_PUBLIC_ADMIN_V2_ENABLED`) | PASS — only `app/admin/loyalty/page.tsx` and `app/admin/loyalty/rewards/[id]/edit/page.tsx` gate Phase 7; no additional flags |
| All points/tier mutations route through `lib/loyalty/service.ts` | PASS — `awardPoints` called at lines 440, 503, 769; `updateCustomerTier` called at lines 457, 527; no raw `prisma.pointsTransaction.create` in actions |
| 5 SUPER_ADMIN gates verified | PASS — `deleteTier`, `bulkAdjustMemberPoints`, `deleteReward`, `cancelRedemption`, `bulkCancelRedemptions` all call `requireAdminRole('SUPER_ADMIN')` |
| Existing V1 sub-routes all present | PASS — 6 routes confirmed: /customers, /tiers, /rewards, /redemptions, /events, /settings |
| No `dark:` Tailwind modifiers in Phase 7 | PASS — 0 occurrences in Phase 7 components |

---

## Lint / TypeScript status

### Phase 7 files (production + tests)

| Scope | Errors | Warnings |
|-------|--------|----------|
| Production (`components/admin/loyalty/`, `app/admin/loyalty/`, `lib/admin/loyalty.ts`) | **6** | **1** |
| Tests (`tests/unit/**/loyalty/**`) | 0 | 1 (unused variable in `actions.test.ts:721`) |
| **Phase 7 total** | **6 errors** | **2 warnings** |

**Phase 7 lint errors (production) — all cosmetic, no runtime impact:**

| File | Line | Rule | Description |
|------|------|------|-------------|
| `components/admin/loyalty/AdjustPointsDialog.tsx` | 31 | `react-hooks/set-state-in-effect` | `setAmount(0)` + `setReason('')` in reset effect on `open` change |
| `components/admin/loyalty/ExportButton.tsx` | 29 | `@typescript-eslint/no-explicit-any` | `any` in CSV download handler |
| `components/admin/loyalty/inspectors/EventInspector.tsx` | 95 | `react-hooks/set-state-in-effect` | `setName(detail.name)` in form-reset effect |
| `components/admin/loyalty/inspectors/RedemptionInspector.tsx` | 66 | `react-hooks/set-state-in-effect` | `setTracking(...)` in reset effect |
| `components/admin/loyalty/inspectors/RewardInspector.tsx` | 66 | `react-hooks/set-state-in-effect` | `setIsActive(detail.isActive)` in reset effect |
| `lib/admin/loyalty.ts` | 334 | `@typescript-eslint/no-empty-object-type` | Empty interface extending supertype |

The `react-hooks/set-state-in-effect` pattern (setState called inside a `useEffect` to reset form state when a panel opens) is the established Phase 3–6 pattern used across all inspector components in the codebase. These are intentional form-reset effects, not cascading renders, and they do not affect runtime correctness. Defer to Phase 7.5.

**Phase 7 lint warnings (tests):**
- `tests/unit/app/admin/loyalty/actions.test.ts:721` — `pointsMultiplierEventCount` assigned but never used in one test helper.

### Full codebase (for context — all pre-existing)

| Scope | Errors | Warnings |
|-------|--------|----------|
| Full lint (`pnpm lint`) | 508 errors | 317 warnings |
| Full TypeScript (`pnpm exec tsc --noEmit`) | 20 errors | — |

All 508 lint errors and 20 TypeScript errors in the full codebase. Phase 7 contributes 6 lint errors and 1 warning to the production total. All remaining are pre-existing and unrelated to Phase 7. Notable pre-existing issues:
- `app/api/admin/loyalty/tiers/[id]/route.ts` — 2 TS errors: `AdminRole` + `verifyAdminRole` missing from `lib/auth/admin` exports (pre-Phase 7 V1 API route)
- `app/api/admin/admin-audit-logs/route.ts` / `app/api/admin/audit-logs/route.ts` / `app/api/admin/fulfillment/tickets/[id]/decision/route.ts` — same pre-existing `AdminRole` / `verifyAdminRole` missing exports
- `components/avatar/AvatarModel.tsx` — Three.js `Object3D` → `Mesh` type assertion errors
- `lib/stripe/config.ts` — Stripe API version mismatch

### Test suite (full)

| Scope | Files | Tests | Status |
|-------|-------|-------|--------|
| Phase 7 tests (isolated run) | 32 passed | 186 passed | **All green** |
| Full suite | 9 failed / 215 passed (224 total) | 33 failed / 1264 passed (1297 total) | Pre-existing failures |

The 9 failing test files in the full suite are all pre-existing regressions: `collections-page`, `fulfillment-case-drawer`, `fulfillment-queue-grid`, `navigation-dropdown`, `navigation-mobile-menu-cart-widget`, `product-page-client`, `products-page-filters`, `profile-page-tabs`, `components/admin/products/ProductsListView` — none are Phase 7 files.
