# Admin Rebuild — Phase 2: Dashboard QA Findings

**Date:** 2026-05-30
**Phase 2 PRs:** #65 (Task 1 — Setting table), #66 (Task 2 — data layer), #73 (Task 3 — HeroRevenue / merged HeroTimeRangePills impl), #71 (Task 5 — KpiStrip), #70 (Task 6 — NeedsAttention), #72 (Task 7 — SalesGoals), #69 (Task 8 — LiveActivityFeed), #67 (Task 9 — skeletons), #74 (Task 10 — goals settings page), #75 (Task 11 — AdminDashboardV2 + page dispatcher)
**Note on PR #68:** `wave3p2/task-4-time-range-pills` was CLOSED (not merged) due to a file conflict with #73, which included the HeroTimeRangePills implementation. The component is in main; the dedicated test suite is not. See Phase 2.5 follow-ups below.

---

## Automated verification

### `npm run test:run`

**Result: 9 test files FAILED, 91 passed. 31 tests failed out of 327 total.**

All failures are pre-existing and unrelated to Phase 2 work. The single new Phase 2 test file (`tests/unit/lib/admin/dashboard.test.ts`) passes 4/4.

| File | Failed / Total | Root cause |
|------|---------------|------------|
| `tests/unit/collections-page.test.tsx` | 4 / 4 | UI query mismatches (pre-existing) |
| `tests/unit/fulfillment-case-drawer.test.tsx` | 2 / 5 | Element not found (pre-existing) |
| `tests/unit/navigation-dropdown.test.tsx` | 2 / 10 | Element not found (pre-existing) |
| `tests/unit/product-page-client.test.tsx` | 4 / 7 | Element not found (pre-existing) |
| `tests/unit/profile-page-tabs.test.tsx` | 6 / 6 | Element not found (pre-existing) |
| `tests/unit/navigation-mobile-menu-cart-widget.test.tsx` | 3 / 3 | waitFor timeout (pre-existing) |
| `tests/unit/fulfillment-queue-grid.test.tsx` | 2 / 2 | Multiple elements found (pre-existing) |
| `tests/unit/signup-api-route.test.ts` | 4 / 4 | Pre-existing |
| `tests/unit/wishlist-route.test.ts` | 4 / 4 | Pre-existing |

**Phase 2 test file result:**

| File | Result |
|------|--------|
| `tests/unit/lib/admin/dashboard.test.ts` | 4/4 PASS |

### `npx tsc --noEmit`

**Result: 2 errors — pre-existing, unrelated to Phase 2.**

| File | Error |
|------|-------|
| `lib/security/rateLimit.ts:2` | TS2307: Cannot find module `@upstash/ratelimit` |
| `lib/security/rateLimit.ts:3` | TS2307: Cannot find module `@upstash/redis` |

Both errors are in `lib/security/rateLimit.ts`, last modified in PR #43 (before Phase 2). No Phase 2 files introduce type errors.

### `npx eslint lib/admin/dashboard.ts components/admin/dashboard/ app/admin/settings/goals/ app/admin/page.tsx`

**Result: 0 errors, 0 warnings.**

One issue was found and fixed during this verification pass:
- `components/admin/dashboard/NeedsAttention.tsx` had a `react-hooks/set-state-in-effect` error (calling `setDismissed` synchronously inside a `useEffect`). Fixed by replacing the effect with a `useState` lazy initializer (`readDismissed` function), which is the idiomatic pattern for hydrating state from `sessionStorage` on first render.

### `npm run build`

**Result: BUILD FAILED — 2 errors in `lib/security/rateLimit.ts` (pre-existing, unrelated to Phase 2).**

```
Module not found: Can't resolve '@upstash/ratelimit'
Module not found: Can't resolve '@upstash/redis'
```

These are the same missing packages surfaced by `tsc --noEmit`. This failure predates Phase 2 (introduced in PR #43). Phase 2 changes do not touch `lib/security/rateLimit.ts` or its consumers.

---

## Migration deployment

After merging Task 1 PR (#65), run:

```bash
npx prisma migrate deploy
```

to apply the `add_setting_table` migration to the prod Neon DB. This creates the `settings` table used by `SalesGoals` and the `/admin/settings/goals` server action.

---

## Human QA — flag OFF (V1 path preserved)

- [ ] Visit `/admin` with `NEXT_PUBLIC_ADMIN_V2_ENABLED=false` — old dashboard renders unchanged
- [ ] No console errors
- [ ] All existing /admin functionality works

## Human QA — flag ON (V2 dashboard)

- [ ] Visit `/admin` — new dashboard renders with hero/KPIs/activity/needs-attention/goals
- [ ] Click time-range pills (Today/Week/Month/Year) — URL updates to `?range=...`, data refreshes with subtle pulse animation (no skeleton swap)
- [ ] Refresh page after picking Week — Week stays selected (localStorage persisted)
- [ ] Dismiss a Needs-attention alert with × — disappears, stays gone within session, returns on reload
- [ ] When all alerts dismissed — "All caught up ✓" shows
- [ ] Click an Activity feed row — navigates to correct detail page
- [ ] Visit `/admin/settings/goals` — set goals, save, return to `/admin` — Goals widget shows new targets

## Mobile QA (V2 on)

- [ ] Open `/admin` at 375px wide
- [ ] Stack order: Hero → KPIs (h-scroll) → Needs-attention → Live activity → Goals
- [ ] Bottom nav from Phase 1 still works
- [ ] No horizontal overflow

---

## Known limitations / Phase 2.5 follow-up items

### 1. Missing dedicated HeroTimeRangePills test suite

PR #68 (`wave3p2/task-4-time-range-pills`) was closed without merging due to a file conflict with PR #73, which had already included the HeroTimeRangePills component implementation. The component (`components/admin/dashboard/HeroTimeRangePills.tsx`) is in main and working, but the dedicated 3-test suite from #68 was never merged.

**Recommended action:** Open a small Phase 2.5 PR that adds only `tests/unit/components/admin/dashboard/HeroTimeRangePills.test.tsx` with the three tests originally planned: URL-param sync, localStorage persistence, and pill active-state rendering.

### 2. CVR stubbed at 3.4%

`loadKpiStrip` in `lib/admin/dashboard.ts` returns a hard-coded conversion rate of `3.4`. This value is not derived from any real session or event data. Wire to a real session counter source (e.g., track `session_started` events in the analytics table, or integrate a Vercel Analytics / PostHog query) in a Phase 2.5 follow-up PR.

### 3. Drop-ending alert `isDrop` flag investigation needed

The `loadNeedsAttention` function in `lib/admin/dashboard.ts` detects "drop ending soon" by filtering products with a `dropEndDate` within the alert window. However, the `Product` model has no dedicated `isDrop: Boolean` field, so any product with a `dropEndDate` set — including non-drop products that happen to have an end date — will surface in this alert. Investigate whether a separate `isDrop` boolean or a `drops` relation join is the right discriminator, and document the path forward. Until resolved, this alert may show false positives.

### 4. Socket events for LiveActivityFeed are inert

`components/admin/dashboard/LiveActivityFeed.tsx` subscribes to `order.created`, `order.refunded`, and `drop.sale` socket events. However, `lib/socket.ts` does not emit these events from the server side. The component is forward-compatible (subscriptions are wired correctly), but it will not receive real-time updates until server-side emit calls are added to the order creation, refund, and drop-sale flows. This is the expected Phase 2 state; wire in Phase 2.5 or Phase 3.
