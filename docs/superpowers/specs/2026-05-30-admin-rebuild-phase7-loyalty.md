# Phase 7: Loyalty — Sub-spec

**Status:** Approved 2026-06-07. Hand off to writing-plans.

**Parent spec:** `docs/superpowers/specs/2026-05-30-admin-rebuild-design.md`
**Sibling specs:** Phase 2 (Dashboard), Phase 3 (Products), Phase 4 (Fulfillment), Phase 5 (Marketing), Phase 6 (Analytics+Financial) — all shipped.

## Goal

Build a new V2 `/admin/loyalty` umbrella page with 6 tabs (Overview · Members · Tiers · Rewards · Redemptions · Events) + ⚙ Settings Inspector + dedicated full-page Reward editor, gated behind `NEXT_PUBLIC_ADMIN_V2_ENABLED`, with zero schema migrations. Reuses the existing atomic + idempotency-keyed `lib/loyalty/service.ts` (856L) for all points/tier mutations.

## Decisions table

| # | Decision | Choice |
|---|---|---|
| 1 | Tab structure | **C** — 6 tabs: `overview` · `members` · `tiers` · `rewards` · `redemptions` · `events`. Settings becomes a ⚙ button in the page header that opens `LoyaltySettingsInspector` (singleton edit). Splits Rewards (catalog CRUD) from Redemptions (read-only audit). |
| 2a | KPI strip (4) | **B** — Active Members (current snapshot) · Points Earned (range, trend) · Points Redeemed (range, trend) · Redemption Rate % (range, trend). Cards click → matching tab pre-filtered. |
| 2b | Date range UX | **i** — URL-persisted `?range=today\|7d\|30d\|90d\|year` pill row, sticky above KPI strip, defaults to `30d`. Mirror Phase 6's `AnalyticsRangePills` pattern as `LoyaltyRangePills`. |
| 3a | Tier editing | **A** — Inspector for edit, same Inspector in create mode for new. Tier card grid in TiersTab; click → TierInspector. |
| 3b | Member ledger + admin adjust | **i** — Per-member Inspector with read-only profile + scrollable last-50 PointsTransaction ledger + "Adjust Points" sub-dialog (amount ± / reason / writes ADMIN_ADJUSTMENT txn with idempotencyKey). |
| 3c | Reward + Redemption admin | **I** — RewardInspector for quick toggles (isActive + pointsCost + maxRedemptionsPerCustomer) + "Edit details →" link to dedicated `/admin/loyalty/rewards/[id]/edit` editor. Redemptions tab is read-only audit with RedemptionInspector that has Fulfill/Cancel action buttons. |
| 4a | Bulk actions | **A (conservative)** — Members: Bulk Adjust Points (SUPER_ADMIN) · Bulk Re-tier · Export CSV. Rewards: Bulk Activate/Deactivate. Redemptions: Bulk Mark Fulfilled · Bulk Cancel (SUPER_ADMIN). Events: Bulk Activate/Deactivate. Tiers: no bulk. |
| 4b | Events tab UX | **i** — Card grid with active/scheduled/ended status pills + per-event stats (totalBonusPointsAwarded, ordersAffected). Click → EventInspector for full CRUD. "+ New Event" → same Inspector in create mode. |
| 4c | Cron + automation | **α** — LoyaltySettings Inspector shows cron-config fields read-only (pointsExpireMonths, tierEvaluationPeriod) with a note that scheduling lives in `.github/workflows/birthday-points-cron.yml`. Manual trigger buttons (expireOldPoints, recomputeAllTiers, awardBirthdayPoints) deferred to Phase 7.5. |
| 4d | Cross-page integration | **x** — Defer. No Phase 2 dashboard loyalty tile. Phase 7 owns its own surfaces. Phase 6 CustomerInspector already exposes loyaltyTier.name via existing API. |

## Architecture

### Routing + dispatcher pattern (mirrors Phase 5/6)

```
app/admin/loyalty/page.tsx                              ← dispatcher (V1 stub vs V2 root)
app/admin/loyalty/rewards/[id]/edit/page.tsx            ← dispatcher (V1 redirect to /admin/loyalty/rewards/[id]/edit existing V1 page vs V2 editor)
app/admin/loyalty-v1/page.tsx                           ← relocated original V1 page (verbatim 711L)
components/admin/_v1/AdminLoyaltyV1.tsx                 ← V1 stub linking to existing V1 pages
components/admin/_v1/AdminLoyaltyV1Page.tsx             ← verbatim relocation of V1's app/admin/loyalty/page.tsx
components/admin/dashboard/AdminLoyaltyV2.tsx           ← V2 root composition
components/admin/dashboard/LoyaltyTabPills.tsx          ← client wrapper around TabPills
components/admin/dashboard/LoyaltyRangePills.tsx        ← client wrapper for ?range= pill row
```

V1 sub-routes stay intact and unmodified — V1 stub links to each (`/admin/loyalty-v1` relocated original, plus `/admin/loyalty/customers`, `/tiers`, `/rewards`, `/redemptions`, `/events`, `/settings`).

### V2 root composition (`AdminLoyaltyV2`)

```
AdminLayout
├── Page header: "Loyalty" title + ⚙ Settings button (opens LoyaltySettingsInspector)
├── LoyaltyTabPills (6 tabs)
├── LoyaltyRangePills (5 ranges)
├── LoyaltyKpiStrip (Suspense) — 4 StatCards, each <Link href={`?tab=${target}&range=${range}`}>
└── Main content slot (Suspense per tab)
    ├── overview     → <OverviewTab data={...} range={range} />
    ├── members      → <MembersTab data={...} isSuperAdmin={isSuperAdmin} />
    ├── tiers        → <TiersTab tiers={...} isSuperAdmin={isSuperAdmin} />
    ├── rewards      → <RewardsTab data={...} isSuperAdmin={isSuperAdmin} />
    ├── redemptions  → <RedemptionsTab data={...} range={range} isSuperAdmin={isSuperAdmin} />
    └── events       → <EventsTab data={...} />
```

Each slot is its own async server-component function so Suspense streams independently.

## Schema additions

**Zero new models.** All needed models exist in `prisma/schema.prisma`:

- `LoyaltyTier` — id, name, slug, description, primaryColor (#64748B), secondaryColor (#475569), minAnnualSpend (Float), minAnnualPoints (Int), isInviteOnly, pointMultiplier (1.0 default), freeShipping, earlyDropAccess, perks (JSON), sortOrder, isActive
- `PointsTransaction` — id, customerId, points (Int signed), type (PointsTransactionType enum, 14 values), description, orderId?, reviewId?, redemptionId?, referralId?, expiresAt?, isExpired (default false), metadata (JSON), idempotencyKey (unique nullable), createdAt
- `PointsTransactionType` enum: PURCHASE, ACCOUNT_CREATION, FIRST_PURCHASE, REVIEW, SOCIAL_FOLLOW, SOCIAL_SHARE, UGC_UPLOAD, BIRTHDAY, REFERRAL_GIVE, REFERRAL_RECEIVE, ADMIN_ADJUSTMENT, TIER_BONUS, REDEMPTION, EXPIRATION
- `Customer` loyalty fields — loyaltyTierId (FK nullable), currentPoints (Int default 0), lifetimePoints (Int default 0), annualPointsEarned (Int default 0), annualSpend (Float — legacy informational), tierStartDate (DateTime)
- `Reward` — id, name, slug (unique), description, pointsCost, rewardType (enum: DISCOUNT/FREE_SHIPPING/EARLY_ACCESS/EXCLUSIVE_PRODUCT/CHARITY_DONATION/DIGITAL_CONTENT/PHYSICAL_PERK), value (Float?), isActive, maxRedemptionsPerCustomer?, totalAvailable?, totalRedeemed, minTierRequired? (String of tier slug), metadata (JSON), image?, sortOrder
- `RewardRedemption` — id, customerId, rewardId, pointsSpent, status (RedemptionStatus enum: PENDING/ACTIVE/USED/EXPIRED/CANCELLED/FULFILLED), couponCode (unique nullable), usedAt?, orderId?, trackingNumber?, shippedAt?, metadata (JSON), idempotencyKey (unique)
- `PointsMultiplierEvent` — id, name, description?, startDate, endDate, multiplier (Float default 2.0), tierIds (JSON string), categoryIds (JSON string), isActive, totalBonusPointsAwarded (Int), ordersAffected (Int)
- `LoyaltySettings` singleton (id="default") — isEnabled, programName, pointsPerDollar (1), pointsRoundingMode, minimumOrderForPoints, referralPointsReferrer (100), referralPointsReferred (50), referralEnabled, reviewPointsEnabled, reviewPointsAmount (25), reviewWithPhotoBonus (25), birthdayRewardsEnabled, birthdayRewardType, birthdayRewardValue (100), birthdayRewardExpireDays (30), pointsExpireEnabled, pointsExpireMonths (12), tierEvaluationPeriod ("annual"), tierDowngradeEnabled, showPointsInCart, showPointsInCheckout, showTierProgress
- `ReferralCode` — id, customerId (unique FK), code (unique), timesUsed (Int)
- `EarlyAccessGrant` — cross-system; tracks tier-based + points-redemption early access to drops

**Reuses atomic ops from `lib/loyalty/service.ts` (existing, 856L):**
- `awardPoints(customerId, points, type, description, opts)` — idempotency-keyed
- `deductPoints(customerId, points, redemptionId, description)` — idempotency-keyed
- `updateCustomerTier(customerId)` — atomic tier recompute
- `expireOldPoints()` — cron-callable
- `awardBirthdayPoints(customerId)` — keyed by year

**Deferred to Phase 7.5+:**
- In-UI cron config editing (cron stays in `.github/workflows/birthday-points-cron.yml`)
- Manual trigger buttons in Settings Inspector (expireOldPoints / awardBirthdayPoints / recomputeAllTiers)
- Calendar view for Events tab
- Phase 2 dashboard loyalty tile
- Referral program admin (currently spans `ReferralCode` + cross-system but no dedicated tab)
- Notifications log / audit trail for loyalty events

## Components

### Page roots — `components/admin/dashboard/`

| File | Role |
|---|---|
| `AdminLoyaltyV2.tsx` | Server root composing tab pills + range pills + KPI strip + tab Suspense slots + ⚙ Settings button |
| `LoyaltyTabPills.tsx` | Client wrapper around `TabPills`; `router.push(\`?tab=${id}&range=${range}\`)` |
| `LoyaltyRangePills.tsx` | Client wrapper for 5-range pill row; preserves `?tab=` |

### Tab components — `components/admin/loyalty/`

| File | Content |
|---|---|
| `OverviewTab.tsx` | 4 charts (PointsActivityChart, TierDistributionChart, TopRewardsBar, MemberGrowthChart) + 2 quick-toggle panels (TierPerksQuickToggle, RewardActivationsQuickToggle) + PopularRewardsList + RecentTransactionsTable + ExportButton |
| `MembersTab.tsx` | Paginated member table (email, tier badge, currentPoints, lifetimePoints, lastActive) → MemberInspector on row click + MembersBulkSheet + ExportButton |
| `TiersTab.tsx` | Tier card grid (one card per tier showing name, colors, minAnnualPoints threshold, multiplier, perks summary) + "+ New Tier" → TierInspector + ExportButton |
| `RewardsTab.tsx` | Reward card grid (image, name, pointsCost, totalRedeemed, status pill, tier requirement) + "+ New Reward" → editor route + Inspector for quick toggles + RewardsBulkSheet + ExportButton |
| `RedemptionsTab.tsx` | Read-only audit table (customer, reward, pointsSpent, status pill, couponCode, createdAt) → RedemptionInspector on row click + RedemptionsBulkSheet + ExportButton |
| `EventsTab.tsx` | Event card grid (name, dates, multiplier, status pill, totalBonusPointsAwarded) → EventInspector + "+ New Event" + EventsBulkSheet + ExportButton |

### Charts — `components/admin/loyalty/charts/`

| File | Recharts type |
|---|---|
| `PointsActivityChart.tsx` | `<LineChart>` — earned vs redeemed over range (two lines) |
| `TierDistributionChart.tsx` | `<BarChart layout="vertical">` — members per tier with % labels |
| `TopRewardsBar.tsx` | `<BarChart layout="vertical">` — top rewards by redemption count |
| `MemberGrowthChart.tsx` | `<AreaChart>` — new members over range |

All thin Recharts wrappers with mock pattern from Phase 6 (cross-cutting note 8). `ResponsiveContainer` wrappers + empty-state fallbacks.

### Inspectors — `components/admin/loyalty/inspectors/`

| File | Editable / read-only scope |
|---|---|
| `MemberInspector.tsx` | Read-only profile (email, name, tier badge, currentPoints, lifetimePoints, annualPointsEarned, tierStartDate) + scrollable last-50 PointsTransaction ledger (uses MemberLedger sub-component) + "Adjust Points" button (opens AdjustPointsDialog) |
| `TierInspector.tsx` | Full CRUD — name, slug, description, primaryColor, secondaryColor, minAnnualSpend, minAnnualPoints, isInviteOnly, pointMultiplier, freeShipping, earlyDropAccess, perks JSON textarea, sortOrder, isActive |
| `RewardInspector.tsx` | Quick toggle isActive + pointsCost + maxRedemptionsPerCustomer + minTierRequired select. "Edit details →" link to `/admin/loyalty/rewards/[id]/edit` |
| `RedemptionInspector.tsx` | Read-only redemption detail (customer, reward, pointsSpent, status, couponCode, createdAt, usedAt, orderId link, trackingNumber, shippedAt). Action buttons based on status: "Mark Fulfilled" + tracking input (PENDING/ACTIVE only), "Cancel" (SUPER_ADMIN-gated, PENDING/ACTIVE only) |
| `EventInspector.tsx` | Full CRUD — name, description, startDate, endDate, multiplier, tierIds JSON select (multi), categoryIds JSON select (multi), isActive + read-only stats (totalBonusPointsAwarded, ordersAffected) |
| `LoyaltySettingsInspector.tsx` | LoyaltySettings singleton edit — isEnabled, programName, pointsPerDollar, pointsRoundingMode, minimumOrderForPoints, all referral fields, all birthday fields, all review fields, all display flags. **Cron fields (pointsExpireMonths, tierEvaluationPeriod) shown read-only** with note "Cron schedule managed in .github/workflows/birthday-points-cron.yml" |

### Sub-components — `components/admin/loyalty/`

| File | Role |
|---|---|
| `AdjustPointsDialog.tsx` | Sub-dialog opened by MemberInspector + MembersBulkSheet. Amount input (signed ±) + reason textarea + Submit. Writes ADMIN_ADJUSTMENT PointsTransaction with idempotencyKey `admin-${adminId}-${memberId}-${timestamp}` via `adjustMemberPoints` server action. |
| `TierPerksQuickToggle.tsx` | Overview widget — list of tiers with toggleable freeShipping + earlyDropAccess switches (calls toggleTierActive or updateTier with partial payload) |
| `RewardActivationsQuickToggle.tsx` | Overview widget — list of rewards with toggleable isActive switch (calls toggleRewardActive) |
| `RecentTransactionsTable.tsx` | Overview widget — last 10 PointsTransaction rows with type pills + member email + points + relative timestamp |
| `PopularRewardsList.tsx` | Overview widget — top 5 rewards by totalRedeemed count |
| `MemberLedger.tsx` | Sub-component of MemberInspector — scrollable last-50 PointsTransaction list with type pills + reason filter dropdown (PURCHASE/REDEMPTION/ADMIN_ADJUSTMENT/etc.) |
| `RewardEditor.tsx` | Full editor at `/admin/loyalty/rewards/[id]/edit`. All 11+ Reward fields: name, slug, description, pointsCost, rewardType (7-value select), value, isActive, maxRedemptionsPerCustomer, totalAvailable, minTierRequired select (from LoyaltyTier list), metadata JSON, image (URL input), sortOrder. Save → `updateReward` action. |
| `ExportButton.tsx` | Per-tab CSV download — wraps export*Csv server actions. Phase 6 ExportButton precedent. |

### BulkSheets — `components/admin/loyalty/bulk/`

| File | Actions |
|---|---|
| `MembersBulkSheet.tsx` | Bulk Adjust Points (opens AdjustPointsDialog with bulk mode; SUPER_ADMIN) · Bulk Re-tier · Export CSV |
| `RewardsBulkSheet.tsx` | Bulk Activate · Bulk Deactivate |
| `RedemptionsBulkSheet.tsx` | Bulk Mark Fulfilled (with tracking number prompt) · Bulk Cancel (SUPER_ADMIN) |
| `EventsBulkSheet.tsx` | Bulk Activate · Bulk Deactivate |

## Data layer — `lib/admin/loyalty.ts` (new)

Reuses Phase 6's helpers (local `TimeRange` + `getRangeBounds` + `buildTrend` copies, mirroring Phase 6 precedent).

```ts
// KPI
loadLoyaltyKpis(range: TimeRange): Promise<LoyaltyKpiData>
// { activeMembers, pointsEarned, pointsEarnedTrend, pointsRedeemed, pointsRedeemedTrend, redemptionRate, redemptionRateTrend }

// Tab loaders
loadOverviewData(range): Promise<OverviewData>
// { pointsActivity, tierDistribution, topRewards, memberGrowth, tierPerks, rewardActivations, recentTransactions, popularRewards }
loadMembersTab(filters?: MembersFilters): Promise<PaginatedResult<MemberRow>>
loadTiersTab(): Promise<TierRow[]>                              // all tiers, no pagination
loadRewardsTab(filters?: RewardsFilters): Promise<PaginatedResult<RewardRow>>
loadRedemptionsTab(range: TimeRange, filters?: RedemptionsFilters): Promise<PaginatedResult<RedemptionRow>>
loadEventsTab(filters?: EventsFilters): Promise<PaginatedResult<EventRow>>

// Detail loaders
loadMemberDetail(id: string): Promise<MemberDetailFull | null>  // includes recent 50 PointsTransaction rows
loadTierDetail(id: string): Promise<TierDetailFull | null>
loadRewardDetail(id: string): Promise<RewardDetailFull | null>
loadRedemptionDetail(id: string): Promise<RedemptionDetailFull | null>
loadEventDetail(id: string): Promise<EventDetailFull | null>
loadLoyaltySettings(): Promise<LoyaltySettingsRow>              // singleton id="default"
```

Hot paths use `prisma.aggregate` + `groupBy` + parallel `Promise.all()`.

## Server actions — `app/admin/loyalty/actions.ts` (new)

```ts
// Tiers
createTier(input): ActionResult<{ id }>
updateTier(id, input): ActionResult
deleteTier(id): ActionResult                                   // SUPER_ADMIN; rejects if any Customer is on this tier
toggleTierActive(id): ActionResult
getTierDetailForInspector(id): Promise<TierDetailFull | null>

// Members
adjustMemberPoints(memberId, delta, reason): ActionResult       // wraps lib/loyalty/service.ts awardPoints/deductPoints with ADMIN_ADJUSTMENT type
recomputeMemberTier(memberId): ActionResult                     // wraps updateCustomerTier
bulkAdjustMemberPoints(memberIds, delta, reason): BulkResult    // SUPER_ADMIN; per-member idempotencyKey
bulkRecomputeTiers(memberIds): BulkResult
bulkExportMembersCsv(filters?): ActionResult<{ csv: string }>
getMemberDetailForInspector(id): Promise<MemberDetailFull | null>

// Rewards
createReward(input): ActionResult<{ id }>
updateReward(id, input): ActionResult
deleteReward(id): ActionResult                                 // SUPER_ADMIN; rejects if any RewardRedemption exists
toggleRewardActive(id): ActionResult
bulkActivateRewards(ids): BulkResult
bulkDeactivateRewards(ids): BulkResult
getRewardDetailForInspector(id): Promise<RewardDetailFull | null>

// Redemptions
fulfillRedemption(id, trackingNumber?): ActionResult            // sets status FULFILLED
cancelRedemption(id, reason): ActionResult                     // SUPER_ADMIN; reverses points via awardPoints reversal
bulkFulfillRedemptions(ids, trackingByRedemptionId?): BulkResult
bulkCancelRedemptions(ids, reason): BulkResult                 // SUPER_ADMIN
getRedemptionDetailForInspector(id): Promise<RedemptionDetailFull | null>

// Events
createEvent(input): ActionResult<{ id }>
updateEvent(id, input): ActionResult
deleteEvent(id): ActionResult                                  // (no FK constraint; safe to delete)
toggleEventActive(id): ActionResult
bulkActivateEvents(ids): BulkResult
bulkDeactivateEvents(ids): BulkResult
getEventDetailForInspector(id): Promise<EventDetailFull | null>

// Settings
updateLoyaltySettings(input): ActionResult
getLoyaltySettings(): Promise<LoyaltySettingsRow>

// CSV exports
exportOverviewCsv(range): ActionResult<{ csv: string }>
exportMembersCsv(filters?): ActionResult<{ csv: string }>
exportRewardsCsv(filters?): ActionResult<{ csv: string }>
exportRedemptionsCsv(range, filters?): ActionResult<{ csv: string }>
exportEventsCsv(filters?): ActionResult<{ csv: string }>
```

**Total: ~32 server actions.** `requireAdmin()` for all; `requireAdminRole('SUPER_ADMIN')` for `deleteTier`, `deleteReward`, `cancelRedemption`, `bulkAdjustMemberPoints`, `bulkCancelRedemptions` (PII + points-liability touch).

CSV exports cap at 10,000 rows. Inspector wrappers inline Prisma queries during W1 parallel-safety. Refactor deferred to Phase 7.5.

## Data flow

1. Page dispatcher reads `searchParams.tab` + `searchParams.range` → renders `AdminLoyaltyV2` → SSR cascade kicks off KPI Suspense + tab Suspense.
2. Each tab slot awaits its loader; `revalidate = 60` on page.
3. Range pill change → `router.push(\`?tab=${tab}&range=${range}\`)` → page re-streams.
4. KPI card click → `router.push(\`?tab=${target}&range=${range}\`)`.
5. Mutations call server actions → `revalidatePath('/admin/loyalty')`.
6. `adjustMemberPoints` calls existing atomic `lib/loyalty/service.ts` `awardPoints` (for positive delta) or `deductPoints` (for negative) with type=`ADMIN_ADJUSTMENT` + idempotencyKey `admin-${adminId}-${memberId}-${Date.now()}`. Existing service-layer guards prevent overdraft (currentPoints < 0).
7. `cancelRedemption` reverses points via a new `awardPoints` call with type=`REDEMPTION` and negative-of-pointsSpent magnitude (refund), sets RewardRedemption status=CANCELLED, idempotencyKey `cancel-${redemptionId}`.
8. CSV exports: action returns `{ csv: string }`; client triggers Blob + a.download (Phase 4/5/6 precedent).

## Error handling

- Server actions return `ActionResult<T>` / `BulkResult` (Phase 3-6 shape).
- `adjustMemberPoints` rejects if `delta` would push `currentPoints` below 0 (existing service-layer guard).
- `cancelRedemption` only allowed for statuses PENDING / ACTIVE; rejects USED/EXPIRED/FULFILLED with `"Redemption already finalized — cannot cancel"`.
- `deleteTier` rejects if any Customer is currently on that tier — `"N customers on this tier; reassign first"`.
- `deleteReward` rejects if any RewardRedemption exists — `"Reward has redemption history; deactivate instead"`.
- `recomputeMemberTier` runs existing atomic `updateCustomerTier`; tier upgrade notifications + emails fire as side-effects (existing service behavior).
- CSV exports cap at 10,000 rows; over-cap returns `"Too many rows — narrow filters"`.
- Inspector data fetch errors render an "Unable to load" empty-state inside the Inspector.

## Testing

Per-component test files using Vitest + @testing-library/react. Recharts mocked via `vi.mock('recharts')` (Phase 6 cross-cutting note 8). `lib/loyalty/service.ts` mocked in actions tests (to verify call shape without invoking real Prisma writes). Target ~220-260 tests across the phase.

- 1 KPI loader + 6 tab loaders + 6 detail loaders test files
- 1 actions test file (~32 actions with mocked Prisma + mocked lib/loyalty/service.ts)
- 6 Tab component tests
- 4 chart component tests
- 6 Inspector tests + 1 AdjustPointsDialog test + 1 RewardEditor test
- 4 BulkSheet tests
- 6 utility component tests (TierPerksQuickToggle, RewardActivationsQuickToggle, RecentTransactionsTable, PopularRewardsList, MemberLedger, ExportButton)
- 1 list dispatcher test + 1 rewards editor dispatcher test + 1 AdminLoyaltyV2 smoke test

## Wave plan (drives the implementation plan)

| Wave | Tasks | Parallel? | Notes |
|---|---|---|---|
| W1 | Data layer (`lib/admin/loyalty.ts`) + Server actions (`actions.ts`) | 2 parallel | Reuses Phase 6 helpers + existing `lib/loyalty/service.ts` atomic ops |
| W2 | 4 chart components | 4 parallel | Recharts wrappers — mock pattern from Phase 6 |
| W3 | 6 Inspectors + AdjustPointsDialog + 6 utility components | 13 parallel | Independent |
| W4 | 4 BulkSheets (Members, Rewards, Redemptions, Events) | 4 parallel | |
| W5 | 6 Tab components (Overview, Members, Tiers, Rewards, Redemptions, Events) | 6 parallel | Depend on W2 + W3 + W4 |
| W6 | `AdminLoyaltyV2` root + V1 stub + V1 relocation + LoyaltyTabPills + LoyaltyRangePills + list page dispatcher (opus) | Sequential | Critical integration |
| W7 | `RewardEditor` full editor page + rewards edit dispatcher page | 1 task | Depends on W3 |
| W8 | Verification + QA doc | Sequential | Final |

~30 tasks total. Largest phase so far (Phase 6 had 28). Reflects the existing V1's scope: 711L main + 6 sub-routes + 8 Prisma models + atomic service layer.

## Constraints (per master spec)

- Dark futurist + Linear Calm density.
- Mobile co-equal — tables → mobile cards with long-press multi-select + swipe-left quick actions per tab.
- Per-widget Suspense boundaries with `revalidate = 60`.
- Branch naming `wave7p7/task-N-<short-name>`; worktree isolation on every Agent dispatch.
- Per-fix PRs — one focused commit per PR; controller batches per wave.
- Each subagent reads this spec + the plan for its specific task.
- No `dark:` Tailwind modifiers (PR #93 precedent).
- No Prisma in the client bundle (PR #92 precedent).
- `PaginatedResult` shape is `{ items, total, page, pageSize }` (Phase 3-6 precedent).
- Vitest 4.1.7: 1-arg `vi.fn<T>()` generics.
- Recharts mocked in tests via `vi.mock('recharts')`.
- All points/tier mutations route through existing `lib/loyalty/service.ts` atomic ops with idempotencyKey (preserves the recent atomicity fixes in PRs #17 + #37).

## Out of scope (deferred to Phase 7.5+)

- In-UI cron schedule editing (`.github/workflows/birthday-points-cron.yml` stays in code)
- Manual trigger buttons in Settings Inspector (expireOldPoints / awardBirthdayPoints / recomputeAllTiers — SUPER_ADMIN UX)
- Calendar view for Events tab
- Phase 2 dashboard loyalty tile (cross-page integration)
- Referral program admin (currently spans `ReferralCode` + cross-system but no dedicated tab)
- Notifications log / audit trail for loyalty events (in-app notification surface)
- In-UI tier-recompute progress UI for bulk re-tier (currently fire-and-forget)
- Bulk import members from CSV
- Loyalty A/B testing for tier thresholds
- Storefront preview of tier perks (would belong to a storefront task, not admin)
