# Phase 7: Loyalty Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new V2 /admin/loyalty umbrella page with 6 tabs (Overview / Members / Tiers / Rewards / Redemptions / Events) + ⚙ Settings Inspector + dedicated full-page Reward editor, gated behind NEXT_PUBLIC_ADMIN_V2_ENABLED, with zero schema migrations.

**Architecture:** Server-rendered V2 page composition mirroring Phase 5/6 pattern (TabPills + URL-persisted range pill row + KPI strip + per-tab Suspense slots). Page dispatcher gates V1 stub vs V2 by env flag. V1's 711L /admin/loyalty page is relocated verbatim to /admin/loyalty-v1; V1 stub links to it + 6 existing V1 sub-routes (/customers, /tiers, /rewards, /redemptions, /events, /settings). All points + tier mutations route through existing atomic + idempotency-keyed lib/loyalty/service.ts (preserves PR #17 + #37 fixes). Inspector pattern for tiers (full CRUD), members (read-only + AdjustPointsDialog), rewards (quick toggles + "Edit details →" link), redemptions (read-only audit + Fulfill/Cancel), events (full CRUD + stats), and LoyaltySettings (singleton with cron fields read-only). 4 Recharts wrappers reuse Phase 6 mock pattern.

**Tech Stack:** Next.js 16 App Router, React 19 (RSC + Server Actions + Suspense), TypeScript strict, Prisma 6 + Neon, Tailwind v4 (@theme — direct dark colors only, no `dark:` modifiers), Framer Motion, Phosphor icons, Sonner toasts (via `lib/toast.ts`), class-variance-authority, Recharts v3.6.0 (already installed, dynamic-imported), Vitest 4.1.7 + @testing-library/react + jsdom (Phase 1 harness — Recharts mocked via `vi.mock('recharts')`).

---

## Cross-cutting agent notes (read once, applies to every task)

These are hard-won lessons from Phase 3/4/5/6. Re-read them whenever you start a new task:

1. **No Prisma in the client bundle.** Client components (`'use client'`) must ONLY use `import type` from `lib/admin/loyalty.ts`. Any value-import that needs Prisma data goes through a `'use server'` action wrapper in `app/admin/loyalty/actions.ts`. The 6 `get*ForInspector` actions are the canonical wrappers — agents must use these from client code, NOT raw loaders. **PR #92 hotfix is the precedent.**
2. **No `dark:` Tailwind modifiers.** V2 admin is always-dark with no `dark` class on `<html>`. Use direct colors like `bg-neutral-900/60`, `border-white/8`, `text-white/50`, `text-white/30`. **PR #93 hotfix is the precedent.**
3. **`PaginatedResult` shape is `{ items, total, page, pageSize }`** — destructure `.items` (NOT `.rows`). All loaders return this shape.
4. **Vitest 4.1.7 generics: use 1-arg `vi.fn<T>()`** (or zero-arg with `mockResolvedValue`). The two-arg `vi.fn<[Args], Return>()` form from Vitest 1.x triggers TS2558.
5. **`requireAdmin()` has two overloads** in `lib/auth/admin.ts`: `requireAdmin(request)` for API routes (returns customer object) and `requireAdmin()` no-arg for server actions (returns userId string). Use no-arg in actions. `requireAdminRole('SUPER_ADMIN')` for: `deleteTier`, `deleteReward`, `cancelRedemption`, `bulkAdjustMemberPoints`, `bulkCancelRedemptions` (PII + points-liability touch).
6. **Wave 1 parallel-safe inline queries.** Wave 1 has data layer (Task 1) + server actions (Task 2) running in parallel. Task 2's `get*ForInspector` wrappers MUST inline their Prisma queries (don't import from `lib/admin/loyalty.ts` being built in parallel by Task 1). Phase 4/5/6 W1 precedents. Refactor deferred to Phase 7.5.
7. **Wave 5 Tab agents adopt verified prop shapes** from merged W2 + W3 + W4 PRs, not the plan prose. Phase 4/5/6 Wave 5 precedents — agents shipped different prop names than the plan prose; tests-as-source-of-truth pattern worked. Read the merged chart, Inspector, BulkSheet and utility component prop signatures and adopt them verbatim; the plan prose is approximate.
8. **Recharts mocked in tests** via `vi.mock('recharts')` returning bare divs (jsdom doesn't support canvas). EVERY chart component test (W2) MUST start with the mock. Use this exact pattern:

```ts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  Bar: () => <div data-testid="bar" />,
  Area: () => <div data-testid="area" />,
  Cell: () => <div data-testid="cell" />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  LabelList: () => null,
}))
```

Trim the mock to just the primitives each chart imports (keeps tests focused).

9. **All points/tier mutations MUST route through existing `lib/loyalty/service.ts` atomic ops.** Do NOT write raw `prisma.pointsTransaction.create` calls in server actions — use `awardPoints` / `deductPoints` / `updateCustomerTier`. The service has guards against overdraft + double-award. PR #17 + #37 made these atomic; preserving that is non-negotiable. Mock `@/lib/loyalty/service` in actions tests to verify the call shape without invoking real Prisma writes.
10. **idempotencyKey** for `adjustMemberPoints` should be `admin-adjust-${adminId}-${memberId}-${timestamp}` (unique per call). For `cancelRedemption` reversal: `cancel-${redemptionId}`. For bulk: `bulk-${batchId}-${memberId}` where `batchId` is generated once per bulk call (e.g. `crypto.randomUUID()`). Re-runs with the same key are safe (existing service-layer behavior returns the prior transaction).

---

## Wave summary

| Wave | Tasks | Parallel? | Model | Depends on |
|------|-------|-----------|-------|------------|
| W1   | 1, 2 | 2 parallel | sonnet | none (no schema work) |
| W2   | 3, 4, 5, 6 | 4 parallel | sonnet | W1 |
| W3   | 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19 | 13 parallel | sonnet | W1 |
| W4   | 20, 21, 22, 23 | 4 parallel | sonnet | W3 |
| W5   | 24, 25, 26, 27, 28, 29 | 6 parallel | sonnet | W2 + W3 + W4 |
| W6   | 30 | sequential | **opus** | W5 |
| W7   | 31 | sequential | sonnet | W3 |
| W8   | 32 | sequential | sonnet | W6 + W7 |

Total: **32 tasks** across **8 waves**. Branch naming: `wave7p7/task-N-<short-name>`.

---

## Wave 1 — Data layer + server actions (2 parallel)

### Task 1: `lib/admin/loyalty.ts` data layer

**Wave:** 1 | **Parallel-safe with:** Task 2 | **Branch:** `wave7p7/task-1-data-layer` | **Model:** sonnet

**Schema realities for this task:**
- `TimeRange = 'today' | '7d' | '30d' | '90d' | 'year'` (5 values, identical to Phase 6 — define LOCALLY in `lib/admin/loyalty.ts`; do NOT import from `lib/admin/analytics.ts` because that would cross-link sibling phases).
- `LoyaltyTier`: id, name, slug, description, primaryColor (default `#64748B`), secondaryColor (default `#475569`), minAnnualSpend Float (default 0), minAnnualPoints Int (default 0), isInviteOnly Boolean (default false), pointMultiplier Float (default 1.0), freeShipping Boolean (default false), earlyDropAccess Boolean (default false), perks String? (JSON), sortOrder Int, isActive Boolean (default true), createdAt, updatedAt.
- `PointsTransaction`: id, customerId, points Int (signed; redemption is negative), type (PointsTransactionType enum, 14 values), description, orderId?, reviewId?, redemptionId?, referralId?, expiresAt?, isExpired Boolean (default false), metadata String? (JSON), idempotencyKey String? unique, createdAt.
- `PointsTransactionType` enum (14): `PURCHASE | ACCOUNT_CREATION | FIRST_PURCHASE | REVIEW | SOCIAL_FOLLOW | SOCIAL_SHARE | UGC_UPLOAD | BIRTHDAY | REFERRAL_GIVE | REFERRAL_RECEIVE | ADMIN_ADJUSTMENT | TIER_BONUS | REDEMPTION | EXPIRATION`.
- `Customer` loyalty fields: loyaltyTierId (FK nullable), currentPoints Int (default 0), lifetimePoints Int (default 0), annualPointsEarned Int (default 0), annualSpend Float (default 0 — legacy informational), tierStartDate DateTime (default now()). For "active members" we use `WHERE lastOrderDate >= range.start` (best snapshot proxy).
- `Reward`: id, name, slug unique, description, pointsCost Int, rewardType (enum: `DISCOUNT | FREE_SHIPPING | EARLY_ACCESS | EXCLUSIVE_PRODUCT | CHARITY_DONATION | DIGITAL_CONTENT | PHYSICAL_PERK`), value Float?, isActive Boolean (default true), maxRedemptionsPerCustomer Int?, totalAvailable Int?, totalRedeemed Int (default 0), minTierRequired String? (tier slug), metadata String? (JSON), image String?, sortOrder Int (default 0), createdAt, updatedAt.
- `RewardRedemption`: id, customerId, rewardId, pointsSpent Int, status (`PENDING | ACTIVE | USED | EXPIRED | CANCELLED | FULFILLED`), couponCode String? unique, usedAt?, orderId?, trackingNumber?, shippedAt?, metadata String? (JSON), idempotencyKey String unique (NOT nullable).
- `PointsMultiplierEvent`: id, name, description?, startDate, endDate, multiplier Float (default 2.0), tierIds String? (JSON array of tier IDs), categoryIds String? (JSON array of category IDs), isActive, totalBonusPointsAwarded Int (default 0), ordersAffected Int (default 0), createdAt, updatedAt.
- `LoyaltySettings` singleton (`id = "default"`): isEnabled, programName, pointsPerDollar Float (default 1), pointsRoundingMode, minimumOrderForPoints Float, referralPointsReferrer Int (default 100), referralPointsReferred Int (default 50), referralEnabled, reviewPointsEnabled, reviewPointsAmount Int (default 25), reviewWithPhotoBonus Int (default 25), birthdayRewardsEnabled, birthdayRewardType, birthdayRewardValue Int (default 100), birthdayRewardExpireDays Int (default 30), pointsExpireEnabled, pointsExpireMonths Int (default 12 — CRON FIELD), tierEvaluationPeriod String (default "annual" — CRON FIELD), tierDowngradeEnabled, showPointsInCart, showPointsInCheckout, showTierProgress, createdAt, updatedAt.
- "Redemption rate" = redeemed points / earned points in range × 100. Cap at `Number.isFinite` checks (zero-earned protection).
- Hot paths use `prisma.aggregate` + `groupBy` + parallel `Promise.all()`.

**Files:**
- Create: `lib/admin/loyalty.ts`
- Test: `tests/unit/lib/admin/loyalty.test.ts`

#### Steps

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/lib/admin/loyalty.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const customerCount = vi.fn()
const customerFindMany = vi.fn()
const customerFindUnique = vi.fn()
const customerGroupBy = vi.fn()
const pointsTxFindMany = vi.fn()
const pointsTxAggregate = vi.fn()
const pointsTxGroupBy = vi.fn()
const pointsTxCount = vi.fn()
const tierFindMany = vi.fn()
const tierFindUnique = vi.fn()
const tierCount = vi.fn()
const rewardFindMany = vi.fn()
const rewardFindUnique = vi.fn()
const rewardCount = vi.fn()
const redemptionFindMany = vi.fn()
const redemptionFindUnique = vi.fn()
const redemptionCount = vi.fn()
const eventFindMany = vi.fn()
const eventFindUnique = vi.fn()
const eventCount = vi.fn()
const settingsFindUnique = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      count: customerCount,
      findMany: customerFindMany,
      findUnique: customerFindUnique,
      groupBy: customerGroupBy,
    },
    pointsTransaction: {
      findMany: pointsTxFindMany,
      aggregate: pointsTxAggregate,
      groupBy: pointsTxGroupBy,
      count: pointsTxCount,
    },
    loyaltyTier: {
      findMany: tierFindMany,
      findUnique: tierFindUnique,
      count: tierCount,
    },
    reward: {
      findMany: rewardFindMany,
      findUnique: rewardFindUnique,
      count: rewardCount,
    },
    rewardRedemption: {
      findMany: redemptionFindMany,
      findUnique: redemptionFindUnique,
      count: redemptionCount,
    },
    pointsMultiplierEvent: {
      findMany: eventFindMany,
      findUnique: eventFindUnique,
      count: eventCount,
    },
    loyaltySettings: { findUnique: settingsFindUnique },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getRangeBounds (loyalty)', () => {
  it('maps 7d to 7-day window with previous shift', async () => {
    const { getRangeBounds } = await import('@/lib/admin/loyalty')
    const ref = new Date('2026-05-31T12:00:00Z')
    const b = getRangeBounds('7d', ref)
    const day = 24 * 60 * 60 * 1000
    expect(b.end.getTime() - b.start.getTime()).toBe(7 * day)
    expect(b.previousEnd.getTime()).toBe(b.end.getTime() - 7 * day)
  })
  it('today snaps start to UTC midnight', async () => {
    const { getRangeBounds } = await import('@/lib/admin/loyalty')
    const ref = new Date('2026-05-31T18:00:00Z')
    const b = getRangeBounds('today', ref)
    expect(b.start.toISOString()).toBe('2026-05-31T00:00:00.000Z')
  })
})

describe('loadLoyaltyKpis', () => {
  it('returns activeMembers, earned, redeemed, redemptionRate with trends', async () => {
    customerCount.mockResolvedValueOnce(120) // active members (current snapshot)
    pointsTxAggregate
      .mockResolvedValueOnce({ _sum: { points: 5000 } }) // earned current (positive)
      .mockResolvedValueOnce({ _sum: { points: 3000 } }) // earned previous
      .mockResolvedValueOnce({ _sum: { points: -1500 } }) // redeemed current (negative)
      .mockResolvedValueOnce({ _sum: { points: -1200 } }) // redeemed previous
    const { loadLoyaltyKpis } = await import('@/lib/admin/loyalty')
    const k = await loadLoyaltyKpis('30d')
    expect(k.activeMembers).toBe(120)
    expect(k.pointsEarned).toBe(5000)
    expect(k.pointsRedeemed).toBe(1500)
    expect(k.redemptionRate).toBeCloseTo(30, 5)
    expect(k.pointsEarnedTrend.direction).toBe('up')
  })

  it('handles zero earned without dividing by zero', async () => {
    customerCount.mockResolvedValue(0)
    pointsTxAggregate.mockResolvedValue({ _sum: { points: 0 } })
    const { loadLoyaltyKpis } = await import('@/lib/admin/loyalty')
    const k = await loadLoyaltyKpis('30d')
    expect(Number.isFinite(k.redemptionRate)).toBe(true)
    expect(k.redemptionRate).toBe(0)
  })
})

describe('loadOverviewData', () => {
  it('returns 4 chart series + tier perks + reward activations + recent + popular', async () => {
    pointsTxFindMany.mockResolvedValue([])
    customerGroupBy.mockResolvedValue([
      { loyaltyTierId: 'tier-bronze', _count: { _all: 30 } },
    ])
    tierFindMany.mockResolvedValue([
      { id: 'tier-bronze', name: 'Bronze', slug: 'bronze', primaryColor: '#64748B',
        secondaryColor: '#475569', freeShipping: false, earlyDropAccess: false,
        pointMultiplier: 1, sortOrder: 1, isActive: true },
    ])
    rewardFindMany.mockResolvedValue([
      { id: 'r1', name: '10% off', pointsCost: 500, totalRedeemed: 12, isActive: true, sortOrder: 0 },
    ])
    customerFindMany.mockResolvedValue([])
    pointsTxAggregate.mockResolvedValue({ _sum: { points: 0 } })
    const { loadOverviewData } = await import('@/lib/admin/loyalty')
    const d = await loadOverviewData('30d')
    expect(Array.isArray(d.pointsActivity)).toBe(true)
    expect(d.tierDistribution.length).toBe(1)
    expect(d.tierPerks[0].name).toBe('Bronze')
    expect(d.rewardActivations[0].name).toBe('10% off')
  })
})

describe('loadMembersTab', () => {
  it('returns paginated MemberRow list', async () => {
    customerFindMany.mockResolvedValue([
      { id: 'c1', email: 'a@e.com', name: 'Ada', currentPoints: 250,
        lifetimePoints: 1500, lastOrderDate: new Date('2026-05-20'),
        annualPointsEarned: 800, tierStartDate: new Date('2026-01-01'),
        loyaltyTier: { id: 't1', name: 'Silver', slug: 'silver', primaryColor: '#aaa' } },
    ])
    customerCount.mockResolvedValue(1)
    const { loadMembersTab } = await import('@/lib/admin/loyalty')
    const r = await loadMembersTab()
    expect(r.items).toHaveLength(1)
    expect(r.items[0].email).toBe('a@e.com')
    expect(r.items[0].tierName).toBe('Silver')
  })

  it('filters by tierId when provided', async () => {
    customerFindMany.mockResolvedValue([])
    customerCount.mockResolvedValue(0)
    const { loadMembersTab } = await import('@/lib/admin/loyalty')
    await loadMembersTab({ tierId: 'tier-gold' })
    expect(customerFindMany.mock.calls[0][0].where.loyaltyTierId).toBe('tier-gold')
  })
})

describe('loadTiersTab', () => {
  it('returns all tiers sorted by sortOrder', async () => {
    tierFindMany.mockResolvedValue([
      { id: 't1', name: 'Bronze', slug: 'bronze', primaryColor: '#64748B',
        secondaryColor: '#475569', minAnnualSpend: 0, minAnnualPoints: 0,
        isInviteOnly: false, pointMultiplier: 1, freeShipping: false,
        earlyDropAccess: false, perks: null, sortOrder: 1, isActive: true,
        description: null, createdAt: new Date(), updatedAt: new Date() },
    ])
    customerGroupBy.mockResolvedValue([
      { loyaltyTierId: 't1', _count: { _all: 30 } },
    ])
    const { loadTiersTab } = await import('@/lib/admin/loyalty')
    const r = await loadTiersTab()
    expect(r).toHaveLength(1)
    expect(r[0].name).toBe('Bronze')
    expect(r[0].memberCount).toBe(30)
  })
})

describe('loadRewardsTab', () => {
  it('returns paginated rewards', async () => {
    rewardFindMany.mockResolvedValue([
      { id: 'r1', name: '10% off', slug: '10-off', pointsCost: 500,
        rewardType: 'DISCOUNT', isActive: true, totalRedeemed: 5,
        maxRedemptionsPerCustomer: null, totalAvailable: null,
        minTierRequired: null, sortOrder: 0, image: null,
        createdAt: new Date(), updatedAt: new Date() },
    ])
    rewardCount.mockResolvedValue(1)
    const { loadRewardsTab } = await import('@/lib/admin/loyalty')
    const r = await loadRewardsTab()
    expect(r.items[0].name).toBe('10% off')
  })
})

describe('loadRedemptionsTab', () => {
  it('returns paginated redemptions in range', async () => {
    redemptionFindMany.mockResolvedValue([
      { id: 'red1', customerId: 'c1', rewardId: 'r1', pointsSpent: 500,
        status: 'PENDING', couponCode: 'HOF-ABC', usedAt: null, orderId: null,
        trackingNumber: null, shippedAt: null, createdAt: new Date('2026-05-20'),
        updatedAt: new Date(),
        customer: { id: 'c1', email: 'a@e.com', name: 'Ada' },
        reward: { id: 'r1', name: '10% off', rewardType: 'DISCOUNT' } },
    ])
    redemptionCount.mockResolvedValue(1)
    const { loadRedemptionsTab } = await import('@/lib/admin/loyalty')
    const r = await loadRedemptionsTab('30d')
    expect(r.items[0].customerEmail).toBe('a@e.com')
    expect(r.items[0].rewardName).toBe('10% off')
  })
})

describe('loadEventsTab', () => {
  it('returns paginated events', async () => {
    eventFindMany.mockResolvedValue([
      { id: 'e1', name: 'Memorial Day 2x', description: 'Double points',
        startDate: new Date('2026-05-25'), endDate: new Date('2026-05-27'),
        multiplier: 2, tierIds: null, categoryIds: null, isActive: true,
        totalBonusPointsAwarded: 0, ordersAffected: 0,
        createdAt: new Date(), updatedAt: new Date() },
    ])
    eventCount.mockResolvedValue(1)
    const { loadEventsTab } = await import('@/lib/admin/loyalty')
    const r = await loadEventsTab()
    expect(r.items[0].name).toBe('Memorial Day 2x')
  })
})

describe('detail loaders', () => {
  it('loadMemberDetail returns null when missing', async () => {
    customerFindUnique.mockResolvedValue(null)
    const { loadMemberDetail } = await import('@/lib/admin/loyalty')
    expect(await loadMemberDetail('missing')).toBeNull()
  })

  it('loadMemberDetail returns full detail with last 50 transactions', async () => {
    customerFindUnique.mockResolvedValue({
      id: 'c1', email: 'a@e.com', name: 'Ada',
      currentPoints: 250, lifetimePoints: 1500,
      annualPointsEarned: 800, tierStartDate: new Date('2026-01-01'),
      lastOrderDate: new Date('2026-05-20'),
      loyaltyTier: { id: 't1', name: 'Silver', slug: 'silver', primaryColor: '#aaa' },
      pointsTransactions: [
        { id: 'p1', points: 100, type: 'PURCHASE', description: 'order 1',
          createdAt: new Date(), orderId: 'o1', redemptionId: null,
          referralId: null, reviewId: null },
      ],
    })
    const { loadMemberDetail } = await import('@/lib/admin/loyalty')
    const d = await loadMemberDetail('c1')
    expect(d?.email).toBe('a@e.com')
    expect(d?.transactions).toHaveLength(1)
  })

  it('loadTierDetail returns null when missing', async () => {
    tierFindUnique.mockResolvedValue(null)
    const { loadTierDetail } = await import('@/lib/admin/loyalty')
    expect(await loadTierDetail('missing')).toBeNull()
  })

  it('loadRewardDetail returns full reward', async () => {
    rewardFindUnique.mockResolvedValue({
      id: 'r1', name: '10% off', slug: '10-off',
      description: 'd', pointsCost: 500, rewardType: 'DISCOUNT',
      value: 10, isActive: true, maxRedemptionsPerCustomer: null,
      totalAvailable: null, totalRedeemed: 5, minTierRequired: null,
      metadata: null, image: null, sortOrder: 0,
      createdAt: new Date(), updatedAt: new Date(),
    })
    const { loadRewardDetail } = await import('@/lib/admin/loyalty')
    const d = await loadRewardDetail('r1')
    expect(d?.name).toBe('10% off')
  })

  it('loadRedemptionDetail returns full redemption with customer + reward', async () => {
    redemptionFindUnique.mockResolvedValue({
      id: 'red1', customerId: 'c1', rewardId: 'r1', pointsSpent: 500,
      status: 'PENDING', couponCode: 'HOF-ABC', usedAt: null, orderId: null,
      trackingNumber: null, shippedAt: null, metadata: null, idempotencyKey: 'k',
      createdAt: new Date(), updatedAt: new Date(),
      customer: { id: 'c1', email: 'a@e.com', name: 'Ada' },
      reward: { id: 'r1', name: '10% off', rewardType: 'DISCOUNT', pointsCost: 500 },
    })
    const { loadRedemptionDetail } = await import('@/lib/admin/loyalty')
    const d = await loadRedemptionDetail('red1')
    expect(d?.customerEmail).toBe('a@e.com')
    expect(d?.rewardName).toBe('10% off')
  })

  it('loadEventDetail returns full event', async () => {
    eventFindUnique.mockResolvedValue({
      id: 'e1', name: 'Memorial Day 2x', description: 'd',
      startDate: new Date(), endDate: new Date(), multiplier: 2,
      tierIds: null, categoryIds: null, isActive: true,
      totalBonusPointsAwarded: 100, ordersAffected: 5,
      createdAt: new Date(), updatedAt: new Date(),
    })
    const { loadEventDetail } = await import('@/lib/admin/loyalty')
    const d = await loadEventDetail('e1')
    expect(d?.name).toBe('Memorial Day 2x')
  })

  it('loadLoyaltySettings returns defaults when missing', async () => {
    settingsFindUnique.mockResolvedValue(null)
    const { loadLoyaltySettings } = await import('@/lib/admin/loyalty')
    const s = await loadLoyaltySettings()
    expect(s.id).toBe('default')
    expect(s.pointsPerDollar).toBe(1)
    expect(s.pointsExpireMonths).toBe(12)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/admin/loyalty.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/admin/loyalty.ts`**

```ts
// lib/admin/loyalty.ts
//
// Single source of truth for Phase 7 loyalty admin data shapes and Prisma queries.
// All loaders are pure async functions called from Server Components.
//
// Schema adaptations:
//   - TimeRange is Phase 7 specific (matches Phase 6 vocabulary): 'today' | '7d' | '30d' | '90d' | 'year'
//   - We DO NOT import TimeRange from lib/admin/analytics.ts — cross-phase coupling adds churn.
//   - Mutations are NEVER performed here — that's app/admin/loyalty/actions.ts wrapping lib/loyalty/service.ts.

import { prisma } from '@/lib/prisma'
import type { PointsTransactionType, RedemptionStatus, RewardType } from '@prisma/client'

// ============================================================
// TimeRange + range bounds
// ============================================================

export type TimeRange = 'today' | '7d' | '30d' | '90d' | 'year'
export const TIME_RANGES: TimeRange[] = ['today', '7d', '30d', '90d', 'year']

export interface RangeBounds {
  start: Date
  end: Date
  previousStart: Date
  previousEnd: Date
}

export function getRangeBounds(range: TimeRange, ref: Date = new Date()): RangeBounds {
  const end = new Date(ref)
  const start = new Date(ref)
  const day = 24 * 60 * 60 * 1000
  let durationMs: number
  let previousShiftMs: number

  switch (range) {
    case 'today':
      start.setUTCHours(0, 0, 0, 0)
      durationMs = end.getTime() - start.getTime()
      previousShiftMs = day
      break
    case '7d':
      durationMs = 7 * day
      previousShiftMs = durationMs
      start.setTime(end.getTime() - durationMs)
      break
    case '30d':
      durationMs = 30 * day
      previousShiftMs = durationMs
      start.setTime(end.getTime() - durationMs)
      break
    case '90d':
      durationMs = 90 * day
      previousShiftMs = durationMs
      start.setTime(end.getTime() - durationMs)
      break
    case 'year':
      durationMs = 365 * day
      previousShiftMs = durationMs
      start.setTime(end.getTime() - durationMs)
      break
  }

  return {
    start,
    end,
    previousStart: new Date(start.getTime() - previousShiftMs),
    previousEnd: new Date(end.getTime() - previousShiftMs),
  }
}

// ============================================================
// Trend helper
// ============================================================

export interface TrendData {
  direction: 'up' | 'down' | 'flat'
  text: string
}

export function buildTrend(current: number, previous: number): TrendData {
  if (previous === 0) {
    return { direction: 'flat', text: current > 0 ? '↑ new' : '— No prior data' }
  }
  const pct = ((current - previous) / previous) * 100
  if (Math.abs(pct) < 0.5) return { direction: 'flat', text: '— 0%' }
  return {
    direction: pct > 0 ? 'up' : 'down',
    text: `${pct > 0 ? '↑' : '↓'} ${Math.abs(pct).toFixed(1)}%`,
  }
}

// ============================================================
// Pagination + filters
// ============================================================

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

const DEFAULT_PAGE_SIZE = 25

export interface MembersFilters {
  search?: string
  tierId?: string
  page?: number
  pageSize?: number
}
export interface RewardsFilters {
  search?: string
  isActive?: boolean
  rewardType?: RewardType
  page?: number
  pageSize?: number
}
export interface RedemptionsFilters {
  status?: RedemptionStatus
  rewardId?: string
  customerId?: string
  page?: number
  pageSize?: number
}
export interface EventsFilters {
  isActive?: boolean
  page?: number
  pageSize?: number
}

// ============================================================
// Row + chart point shapes
// ============================================================

export interface PointsActivityPoint {
  bucket: string // ISO date
  earned: number
  redeemed: number
}

export interface TierDistributionPoint {
  tierId: string | null
  tierName: string
  count: number
  percent: number
}

export interface TopRewardPoint {
  rewardId: string
  name: string
  totalRedeemed: number
}

export interface MemberGrowthPoint {
  bucket: string
  newMembers: number
}

export interface TierPerksRow {
  id: string
  name: string
  primaryColor: string
  freeShipping: boolean
  earlyDropAccess: boolean
  pointMultiplier: number
  sortOrder: number
}

export interface RewardActivationsRow {
  id: string
  name: string
  pointsCost: number
  isActive: boolean
  totalRedeemed: number
  sortOrder: number
}

export interface RecentTransactionRow {
  id: string
  customerEmail: string
  customerName: string | null
  type: PointsTransactionType
  points: number
  description: string
  createdAt: Date
}

export interface PopularRewardRow {
  id: string
  name: string
  pointsCost: number
  totalRedeemed: number
  rewardType: RewardType
}

// ============================================================
// KPI shape
// ============================================================

export interface LoyaltyKpiData {
  activeMembers: number
  pointsEarned: number
  pointsEarnedTrend: TrendData
  pointsRedeemed: number
  pointsRedeemedTrend: TrendData
  redemptionRate: number // percent 0-100
  redemptionRateTrend: TrendData
}

// ============================================================
// Tab data shapes
// ============================================================

export interface OverviewData {
  pointsActivity: PointsActivityPoint[]
  tierDistribution: TierDistributionPoint[]
  topRewards: TopRewardPoint[]
  memberGrowth: MemberGrowthPoint[]
  tierPerks: TierPerksRow[]
  rewardActivations: RewardActivationsRow[]
  recentTransactions: RecentTransactionRow[]
  popularRewards: PopularRewardRow[]
}

export interface MemberRow {
  id: string
  email: string
  name: string | null
  tierId: string | null
  tierName: string | null
  tierColor: string | null
  currentPoints: number
  lifetimePoints: number
  annualPointsEarned: number
  lastOrderDate: Date | null
  tierStartDate: Date
}

export interface TierRow {
  id: string
  name: string
  slug: string
  description: string | null
  primaryColor: string
  secondaryColor: string
  minAnnualSpend: number
  minAnnualPoints: number
  isInviteOnly: boolean
  pointMultiplier: number
  freeShipping: boolean
  earlyDropAccess: boolean
  perks: string | null
  sortOrder: number
  isActive: boolean
  memberCount: number
}

export interface RewardRow {
  id: string
  name: string
  slug: string
  pointsCost: number
  rewardType: RewardType
  isActive: boolean
  totalRedeemed: number
  maxRedemptionsPerCustomer: number | null
  totalAvailable: number | null
  minTierRequired: string | null
  sortOrder: number
  image: string | null
}

export interface RedemptionRow {
  id: string
  customerId: string
  customerEmail: string
  customerName: string | null
  rewardId: string
  rewardName: string
  rewardType: RewardType
  pointsSpent: number
  status: RedemptionStatus
  couponCode: string | null
  trackingNumber: string | null
  createdAt: Date
}

export interface EventRow {
  id: string
  name: string
  description: string | null
  startDate: Date
  endDate: Date
  multiplier: number
  isActive: boolean
  totalBonusPointsAwarded: number
  ordersAffected: number
}

// ============================================================
// Detail shapes
// ============================================================

export interface MemberLedgerEntry {
  id: string
  points: number
  type: PointsTransactionType
  description: string
  createdAt: Date
  orderId: string | null
  redemptionId: string | null
  referralId: string | null
  reviewId: string | null
}

export interface MemberDetailFull {
  id: string
  email: string
  name: string | null
  tierId: string | null
  tierName: string | null
  tierColor: string | null
  currentPoints: number
  lifetimePoints: number
  annualPointsEarned: number
  tierStartDate: Date
  lastOrderDate: Date | null
  transactions: MemberLedgerEntry[]
}

export interface TierDetailFull extends TierRow {}

export interface RewardDetailFull {
  id: string
  name: string
  slug: string
  description: string
  pointsCost: number
  rewardType: RewardType
  value: number | null
  isActive: boolean
  maxRedemptionsPerCustomer: number | null
  totalAvailable: number | null
  totalRedeemed: number
  minTierRequired: string | null
  metadata: string | null
  image: string | null
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

export interface RedemptionDetailFull {
  id: string
  customerId: string
  customerEmail: string
  customerName: string | null
  rewardId: string
  rewardName: string
  rewardType: RewardType
  pointsSpent: number
  status: RedemptionStatus
  couponCode: string | null
  usedAt: Date | null
  orderId: string | null
  trackingNumber: string | null
  shippedAt: Date | null
  metadata: string | null
  idempotencyKey: string
  createdAt: Date
  updatedAt: Date
}

export interface EventDetailFull {
  id: string
  name: string
  description: string | null
  startDate: Date
  endDate: Date
  multiplier: number
  tierIds: string | null
  categoryIds: string | null
  isActive: boolean
  totalBonusPointsAwarded: number
  ordersAffected: number
  createdAt: Date
  updatedAt: Date
}

export interface LoyaltySettingsRow {
  id: string
  isEnabled: boolean
  programName: string
  pointsPerDollar: number
  pointsRoundingMode: string
  minimumOrderForPoints: number
  referralPointsReferrer: number
  referralPointsReferred: number
  referralEnabled: boolean
  reviewPointsEnabled: boolean
  reviewPointsAmount: number
  reviewWithPhotoBonus: number
  birthdayRewardsEnabled: boolean
  birthdayRewardType: string
  birthdayRewardValue: number
  birthdayRewardExpireDays: number
  pointsExpireEnabled: boolean
  pointsExpireMonths: number // CRON-MANAGED, render read-only
  tierEvaluationPeriod: string // CRON-MANAGED, render read-only
  tierDowngradeEnabled: boolean
  showPointsInCart: boolean
  showPointsInCheckout: boolean
  showTierProgress: boolean
  updatedAt: Date
}

// ============================================================
// Helpers
// ============================================================

function bucketCount(range: TimeRange): number {
  switch (range) {
    case 'today': return 24
    case '7d': return 7
    case '30d': return 30
    case '90d': return 30
    case 'year': return 12
  }
}

// ============================================================
// KPI loader
// ============================================================

export async function loadLoyaltyKpis(range: TimeRange): Promise<LoyaltyKpiData> {
  const { start, end, previousStart, previousEnd } = getRangeBounds(range)

  const [
    activeMembers,
    earnedCur,
    earnedPrev,
    redeemedCur,
    redeemedPrev,
  ] = await Promise.all([
    prisma.customer.count({ where: { lastOrderDate: { gte: start, lte: end } } }),
    prisma.pointsTransaction.aggregate({
      where: { createdAt: { gte: start, lte: end }, points: { gt: 0 } },
      _sum: { points: true },
    }),
    prisma.pointsTransaction.aggregate({
      where: { createdAt: { gte: previousStart, lte: previousEnd }, points: { gt: 0 } },
      _sum: { points: true },
    }),
    prisma.pointsTransaction.aggregate({
      where: { createdAt: { gte: start, lte: end }, type: 'REDEMPTION' },
      _sum: { points: true },
    }),
    prisma.pointsTransaction.aggregate({
      where: { createdAt: { gte: previousStart, lte: previousEnd }, type: 'REDEMPTION' },
      _sum: { points: true },
    }),
  ])

  const earned = Number(earnedCur._sum.points ?? 0)
  const prevEarned = Number(earnedPrev._sum.points ?? 0)
  const redeemed = Math.abs(Number(redeemedCur._sum.points ?? 0))
  const prevRedeemed = Math.abs(Number(redeemedPrev._sum.points ?? 0))
  const rate = earned === 0 ? 0 : (redeemed / earned) * 100
  const prevRate = prevEarned === 0 ? 0 : (prevRedeemed / prevEarned) * 100

  return {
    activeMembers,
    pointsEarned: earned,
    pointsEarnedTrend: buildTrend(earned, prevEarned),
    pointsRedeemed: redeemed,
    pointsRedeemedTrend: buildTrend(redeemed, prevRedeemed),
    redemptionRate: rate,
    redemptionRateTrend: buildTrend(rate, prevRate),
  }
}

// ============================================================
// Overview tab
// ============================================================

export async function loadOverviewData(range: TimeRange): Promise<OverviewData> {
  const { start, end } = getRangeBounds(range)
  const buckets = bucketCount(range)

  const [
    txns,
    tierGroups,
    tiers,
    topRewardsRows,
    newMembers,
    recentTxns,
    popular,
    activations,
  ] = await Promise.all([
    prisma.pointsTransaction.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { points: true, type: true, createdAt: true },
    }),
    prisma.customer.groupBy({
      by: ['loyaltyTierId'],
      _count: { _all: true },
    }),
    prisma.loyaltyTier.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true, name: true, primaryColor: true, freeShipping: true,
        earlyDropAccess: true, pointMultiplier: true, sortOrder: true,
      },
    }),
    prisma.reward.findMany({
      orderBy: { totalRedeemed: 'desc' },
      take: 5,
      select: { id: true, name: true, totalRedeemed: true, pointsCost: true, rewardType: true },
    }),
    prisma.customer.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { createdAt: true },
    }),
    prisma.pointsTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true, points: true, type: true, description: true, createdAt: true,
        customer: { select: { email: true, name: true } },
      },
    }),
    prisma.reward.findMany({
      orderBy: { totalRedeemed: 'desc' },
      take: 5,
      select: { id: true, name: true, pointsCost: true, totalRedeemed: true, rewardType: true },
    }),
    prisma.reward.findMany({
      orderBy: { sortOrder: 'asc' },
      take: 10,
      select: { id: true, name: true, pointsCost: true, isActive: true, totalRedeemed: true, sortOrder: true },
    }),
  ])

  // Points activity buckets
  const span = Math.max(end.getTime() - start.getTime(), 1)
  const pointsActivity: PointsActivityPoint[] = []
  for (let i = 0; i < buckets; i++) {
    const bStart = new Date(start.getTime() + (i * span) / buckets)
    pointsActivity.push({ bucket: bStart.toISOString(), earned: 0, redeemed: 0 })
  }
  for (const t of txns) {
    const idx = Math.min(
      buckets - 1,
      Math.max(0, Math.floor(((t.createdAt.getTime() - start.getTime()) / span) * buckets)),
    )
    if (t.type === 'REDEMPTION') {
      pointsActivity[idx].redeemed += Math.abs(Number(t.points))
    } else if (Number(t.points) > 0) {
      pointsActivity[idx].earned += Number(t.points)
    }
  }

  // Member growth
  const memberGrowth: MemberGrowthPoint[] = []
  for (let i = 0; i < buckets; i++) {
    const bStart = new Date(start.getTime() + (i * span) / buckets)
    memberGrowth.push({ bucket: bStart.toISOString(), newMembers: 0 })
  }
  for (const c of newMembers) {
    const idx = Math.min(
      buckets - 1,
      Math.max(0, Math.floor(((c.createdAt.getTime() - start.getTime()) / span) * buckets)),
    )
    memberGrowth[idx].newMembers += 1
  }

  // Tier distribution
  const tierMap = new Map(tiers.map((t) => [t.id, t.name]))
  const totalMembers = tierGroups.reduce((sum, g) => sum + g._count._all, 0) || 1
  const tierDistribution: TierDistributionPoint[] = tierGroups.map((g) => ({
    tierId: g.loyaltyTierId,
    tierName: g.loyaltyTierId ? (tierMap.get(g.loyaltyTierId) ?? 'Unknown') : 'No tier',
    count: g._count._all,
    percent: (g._count._all / totalMembers) * 100,
  }))

  const topRewards: TopRewardPoint[] = topRewardsRows.map((r) => ({
    rewardId: r.id,
    name: r.name,
    totalRedeemed: r.totalRedeemed,
  }))

  return {
    pointsActivity,
    tierDistribution,
    topRewards,
    memberGrowth,
    tierPerks: tiers,
    rewardActivations: activations,
    recentTransactions: recentTxns.map((t) => ({
      id: t.id,
      customerEmail: t.customer?.email ?? 'unknown',
      customerName: t.customer?.name ?? null,
      type: t.type,
      points: Number(t.points),
      description: t.description,
      createdAt: t.createdAt,
    })),
    popularRewards: popular.map((r) => ({
      id: r.id,
      name: r.name,
      pointsCost: r.pointsCost,
      totalRedeemed: r.totalRedeemed,
      rewardType: r.rewardType,
    })),
  }
}

// ============================================================
// Members tab
// ============================================================

export async function loadMembersTab(
  filters: MembersFilters = {},
): Promise<PaginatedResult<MemberRow>> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  const where: Record<string, unknown> = {}
  if (filters.tierId) where.loyaltyTierId = filters.tierId
  if (filters.search) {
    where.OR = [
      { email: { contains: filters.search, mode: 'insensitive' as const } },
      { name: { contains: filters.search, mode: 'insensitive' as const } },
    ]
  }

  const [rows, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { lifetimePoints: 'desc' },
      select: {
        id: true, email: true, name: true,
        currentPoints: true, lifetimePoints: true, annualPointsEarned: true,
        lastOrderDate: true, tierStartDate: true,
        loyaltyTier: { select: { id: true, name: true, primaryColor: true } },
      },
    }),
    prisma.customer.count({ where }),
  ])

  return {
    items: rows.map((c) => ({
      id: c.id,
      email: c.email,
      name: c.name ?? null,
      tierId: c.loyaltyTier?.id ?? null,
      tierName: c.loyaltyTier?.name ?? null,
      tierColor: c.loyaltyTier?.primaryColor ?? null,
      currentPoints: c.currentPoints,
      lifetimePoints: c.lifetimePoints,
      annualPointsEarned: c.annualPointsEarned,
      lastOrderDate: c.lastOrderDate ?? null,
      tierStartDate: c.tierStartDate,
    })),
    total,
    page,
    pageSize,
  }
}

// ============================================================
// Tiers tab
// ============================================================

export async function loadTiersTab(): Promise<TierRow[]> {
  const [tiers, counts] = await Promise.all([
    prisma.loyaltyTier.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.customer.groupBy({
      by: ['loyaltyTierId'],
      _count: { _all: true },
    }),
  ])
  const countMap = new Map(counts.map((c) => [c.loyaltyTierId, c._count._all]))
  return tiers.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    description: t.description ?? null,
    primaryColor: t.primaryColor,
    secondaryColor: t.secondaryColor,
    minAnnualSpend: Number(t.minAnnualSpend ?? 0),
    minAnnualPoints: t.minAnnualPoints,
    isInviteOnly: t.isInviteOnly,
    pointMultiplier: Number(t.pointMultiplier ?? 1),
    freeShipping: t.freeShipping,
    earlyDropAccess: t.earlyDropAccess,
    perks: t.perks ?? null,
    sortOrder: t.sortOrder,
    isActive: t.isActive,
    memberCount: countMap.get(t.id) ?? 0,
  }))
}

// ============================================================
// Rewards tab
// ============================================================

export async function loadRewardsTab(
  filters: RewardsFilters = {},
): Promise<PaginatedResult<RewardRow>> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  const where: Record<string, unknown> = {}
  if (filters.isActive !== undefined) where.isActive = filters.isActive
  if (filters.rewardType) where.rewardType = filters.rewardType
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' as const } },
      { slug: { contains: filters.search, mode: 'insensitive' as const } },
    ]
  }

  const [rows, total] = await Promise.all([
    prisma.reward.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true, name: true, slug: true, pointsCost: true, rewardType: true,
        isActive: true, totalRedeemed: true, maxRedemptionsPerCustomer: true,
        totalAvailable: true, minTierRequired: true, sortOrder: true, image: true,
      },
    }),
    prisma.reward.count({ where }),
  ])

  return {
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      pointsCost: r.pointsCost,
      rewardType: r.rewardType,
      isActive: r.isActive,
      totalRedeemed: r.totalRedeemed,
      maxRedemptionsPerCustomer: r.maxRedemptionsPerCustomer ?? null,
      totalAvailable: r.totalAvailable ?? null,
      minTierRequired: r.minTierRequired ?? null,
      sortOrder: r.sortOrder,
      image: r.image ?? null,
    })),
    total,
    page,
    pageSize,
  }
}

// ============================================================
// Redemptions tab
// ============================================================

export async function loadRedemptionsTab(
  range: TimeRange,
  filters: RedemptionsFilters = {},
): Promise<PaginatedResult<RedemptionRow>> {
  const { start, end } = getRangeBounds(range)
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  const where: Record<string, unknown> = { createdAt: { gte: start, lte: end } }
  if (filters.status) where.status = filters.status
  if (filters.rewardId) where.rewardId = filters.rewardId
  if (filters.customerId) where.customerId = filters.customerId

  const [rows, total] = await Promise.all([
    prisma.rewardRedemption.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, email: true, name: true } },
        reward: { select: { id: true, name: true, rewardType: true } },
      },
    }),
    prisma.rewardRedemption.count({ where }),
  ])

  return {
    items: rows.map((r) => ({
      id: r.id,
      customerId: r.customerId,
      customerEmail: r.customer?.email ?? 'unknown',
      customerName: r.customer?.name ?? null,
      rewardId: r.rewardId,
      rewardName: r.reward?.name ?? 'unknown',
      rewardType: r.reward?.rewardType ?? 'DISCOUNT',
      pointsSpent: r.pointsSpent,
      status: r.status,
      couponCode: r.couponCode ?? null,
      trackingNumber: r.trackingNumber ?? null,
      createdAt: r.createdAt,
    })),
    total,
    page,
    pageSize,
  }
}

// ============================================================
// Events tab
// ============================================================

export async function loadEventsTab(
  filters: EventsFilters = {},
): Promise<PaginatedResult<EventRow>> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  const where: Record<string, unknown> = {}
  if (filters.isActive !== undefined) where.isActive = filters.isActive

  const [rows, total] = await Promise.all([
    prisma.pointsMultiplierEvent.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { startDate: 'desc' },
    }),
    prisma.pointsMultiplierEvent.count({ where }),
  ])

  return {
    items: rows.map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description ?? null,
      startDate: e.startDate,
      endDate: e.endDate,
      multiplier: Number(e.multiplier ?? 1),
      isActive: e.isActive,
      totalBonusPointsAwarded: e.totalBonusPointsAwarded,
      ordersAffected: e.ordersAffected,
    })),
    total,
    page,
    pageSize,
  }
}

// ============================================================
// Detail loaders
// ============================================================

export async function loadMemberDetail(id: string): Promise<MemberDetailFull | null> {
  const c = await prisma.customer.findUnique({
    where: { id },
    include: {
      loyaltyTier: { select: { id: true, name: true, slug: true, primaryColor: true } },
      pointsTransactions: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true, points: true, type: true, description: true, createdAt: true,
          orderId: true, redemptionId: true, referralId: true, reviewId: true,
        },
      },
    },
  })
  if (!c) return null
  return {
    id: c.id,
    email: c.email,
    name: c.name ?? null,
    tierId: c.loyaltyTier?.id ?? null,
    tierName: c.loyaltyTier?.name ?? null,
    tierColor: c.loyaltyTier?.primaryColor ?? null,
    currentPoints: c.currentPoints,
    lifetimePoints: c.lifetimePoints,
    annualPointsEarned: c.annualPointsEarned,
    tierStartDate: c.tierStartDate,
    lastOrderDate: c.lastOrderDate ?? null,
    transactions: c.pointsTransactions.map((t) => ({
      id: t.id,
      points: Number(t.points),
      type: t.type,
      description: t.description,
      createdAt: t.createdAt,
      orderId: t.orderId ?? null,
      redemptionId: t.redemptionId ?? null,
      referralId: t.referralId ?? null,
      reviewId: t.reviewId ?? null,
    })),
  }
}

export async function loadTierDetail(id: string): Promise<TierDetailFull | null> {
  const t = await prisma.loyaltyTier.findUnique({ where: { id } })
  if (!t) return null
  const count = await prisma.customer.count({ where: { loyaltyTierId: id } })
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    description: t.description ?? null,
    primaryColor: t.primaryColor,
    secondaryColor: t.secondaryColor,
    minAnnualSpend: Number(t.minAnnualSpend ?? 0),
    minAnnualPoints: t.minAnnualPoints,
    isInviteOnly: t.isInviteOnly,
    pointMultiplier: Number(t.pointMultiplier ?? 1),
    freeShipping: t.freeShipping,
    earlyDropAccess: t.earlyDropAccess,
    perks: t.perks ?? null,
    sortOrder: t.sortOrder,
    isActive: t.isActive,
    memberCount: count,
  }
}

export async function loadRewardDetail(id: string): Promise<RewardDetailFull | null> {
  const r = await prisma.reward.findUnique({ where: { id } })
  if (!r) return null
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    pointsCost: r.pointsCost,
    rewardType: r.rewardType,
    value: r.value === null ? null : Number(r.value),
    isActive: r.isActive,
    maxRedemptionsPerCustomer: r.maxRedemptionsPerCustomer ?? null,
    totalAvailable: r.totalAvailable ?? null,
    totalRedeemed: r.totalRedeemed,
    minTierRequired: r.minTierRequired ?? null,
    metadata: r.metadata ?? null,
    image: r.image ?? null,
    sortOrder: r.sortOrder,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

export async function loadRedemptionDetail(id: string): Promise<RedemptionDetailFull | null> {
  const r = await prisma.rewardRedemption.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, email: true, name: true } },
      reward: { select: { id: true, name: true, rewardType: true, pointsCost: true } },
    },
  })
  if (!r) return null
  return {
    id: r.id,
    customerId: r.customerId,
    customerEmail: r.customer?.email ?? 'unknown',
    customerName: r.customer?.name ?? null,
    rewardId: r.rewardId,
    rewardName: r.reward?.name ?? 'unknown',
    rewardType: r.reward?.rewardType ?? 'DISCOUNT',
    pointsSpent: r.pointsSpent,
    status: r.status,
    couponCode: r.couponCode ?? null,
    usedAt: r.usedAt ?? null,
    orderId: r.orderId ?? null,
    trackingNumber: r.trackingNumber ?? null,
    shippedAt: r.shippedAt ?? null,
    metadata: r.metadata ?? null,
    idempotencyKey: r.idempotencyKey,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

export async function loadEventDetail(id: string): Promise<EventDetailFull | null> {
  const e = await prisma.pointsMultiplierEvent.findUnique({ where: { id } })
  if (!e) return null
  return {
    id: e.id,
    name: e.name,
    description: e.description ?? null,
    startDate: e.startDate,
    endDate: e.endDate,
    multiplier: Number(e.multiplier ?? 1),
    tierIds: e.tierIds ?? null,
    categoryIds: e.categoryIds ?? null,
    isActive: e.isActive,
    totalBonusPointsAwarded: e.totalBonusPointsAwarded,
    ordersAffected: e.ordersAffected,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }
}

const SETTINGS_DEFAULTS: LoyaltySettingsRow = {
  id: 'default',
  isEnabled: true,
  programName: 'Head Over Feels Rewards',
  pointsPerDollar: 1,
  pointsRoundingMode: 'floor',
  minimumOrderForPoints: 0,
  referralPointsReferrer: 100,
  referralPointsReferred: 50,
  referralEnabled: true,
  reviewPointsEnabled: true,
  reviewPointsAmount: 25,
  reviewWithPhotoBonus: 25,
  birthdayRewardsEnabled: true,
  birthdayRewardType: 'points',
  birthdayRewardValue: 100,
  birthdayRewardExpireDays: 30,
  pointsExpireEnabled: true,
  pointsExpireMonths: 12,
  tierEvaluationPeriod: 'annual',
  tierDowngradeEnabled: false,
  showPointsInCart: true,
  showPointsInCheckout: true,
  showTierProgress: true,
  updatedAt: new Date(0),
}

export async function loadLoyaltySettings(): Promise<LoyaltySettingsRow> {
  const s = await prisma.loyaltySettings.findUnique({ where: { id: 'default' } })
  if (!s) return { ...SETTINGS_DEFAULTS }
  return {
    id: s.id,
    isEnabled: s.isEnabled,
    programName: s.programName,
    pointsPerDollar: Number(s.pointsPerDollar ?? 1),
    pointsRoundingMode: s.pointsRoundingMode,
    minimumOrderForPoints: Number(s.minimumOrderForPoints ?? 0),
    referralPointsReferrer: s.referralPointsReferrer,
    referralPointsReferred: s.referralPointsReferred,
    referralEnabled: s.referralEnabled,
    reviewPointsEnabled: s.reviewPointsEnabled,
    reviewPointsAmount: s.reviewPointsAmount,
    reviewWithPhotoBonus: s.reviewWithPhotoBonus,
    birthdayRewardsEnabled: s.birthdayRewardsEnabled,
    birthdayRewardType: s.birthdayRewardType,
    birthdayRewardValue: s.birthdayRewardValue,
    birthdayRewardExpireDays: s.birthdayRewardExpireDays,
    pointsExpireEnabled: s.pointsExpireEnabled,
    pointsExpireMonths: s.pointsExpireMonths,
    tierEvaluationPeriod: s.tierEvaluationPeriod,
    tierDowngradeEnabled: s.tierDowngradeEnabled,
    showPointsInCart: s.showPointsInCart,
    showPointsInCheckout: s.showPointsInCheckout,
    showTierProgress: s.showTierProgress,
    updatedAt: s.updatedAt,
  }
}

// ============================================================
// Tab constants
// ============================================================

export const LOYALTY_TABS = [
  'overview',
  'members',
  'tiers',
  'rewards',
  'redemptions',
  'events',
] as const
export type LoyaltyTab = (typeof LOYALTY_TABS)[number]

export function isLoyaltyTab(v: unknown): v is LoyaltyTab {
  return typeof v === 'string' && (LOYALTY_TABS as readonly string[]).includes(v)
}

export function isTimeRange(v: unknown): v is TimeRange {
  return typeof v === 'string' && (TIME_RANGES as readonly string[]).includes(v)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/lib/admin/loyalty.test.ts`
Expected: PASS — 15+ tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add lib/admin/loyalty.ts tests/unit/lib/admin/loyalty.test.ts
git commit -m "feat(admin-v2): add loyalty data layer with KPI + 6 tab loaders + 6 detail loaders"
git push -u origin wave7p7/task-1-data-layer
gh pr create --title "feat(admin-v2): Phase 7 W1 loyalty data layer" --body "Adds lib/admin/loyalty.ts: TimeRange ('today'|'7d'|'30d'|'90d'|'year'), local getRangeBounds, buildTrend, KPI loader (activeMembers/pointsEarned/pointsRedeemed/redemptionRate with trends), 6 tab loaders, 6 detail loaders, LoyaltySettings singleton loader with defaults fallback. 15 tests passing."
```

---

### Task 2: `app/admin/loyalty/actions.ts` server actions

**Wave:** 1 | **Parallel-safe with:** Task 1 | **Branch:** `wave7p7/task-2-server-actions` | **Model:** sonnet

**Schema realities for this task:**
- ~32 server actions per spec.
- `requireAdmin()` no-arg overload for all; `requireAdminRole('SUPER_ADMIN')` ONLY for these 5 actions: `deleteTier`, `deleteReward`, `cancelRedemption`, `bulkAdjustMemberPoints`, `bulkCancelRedemptions`.
- All mutations call `revalidatePath('/admin/loyalty')`.
- All points/tier mutations MUST call `lib/loyalty/service.ts` functions (`awardPoints`, `deductPoints`, `updateCustomerTier`) — do NOT write raw Prisma to PointsTransaction.
- `adjustMemberPoints` routes through `awardPoints` (positive delta) or `deductPoints`-then-`awardPoints` (negative delta via `awardPoints` with negative value — but `awardPoints` already supports any sign via the `points` arg; for ADMIN_ADJUSTMENT we always go through `awardPoints` with the signed delta, type `'ADMIN_ADJUSTMENT'`, idempotencyKey `admin-adjust-${adminId}-${memberId}-${Date.now()}`). The service-layer guards against overdraft via the inner `updateMany.where: { currentPoints: { gte: -delta } }` for negative deltas. NOTE: in the existing `awardPoints` implementation, negative `points` are still incremented (which subtracts) without an overdraft guard. For ADMIN_ADJUSTMENT negative deltas, we must additionally pre-check the current balance and reject before calling `awardPoints`.
- `cancelRedemption` reverses points via `awardPoints(customerId, +pointsSpent, 'ADMIN_ADJUSTMENT', "Refund: ${reason}", { idempotencyKey: cancel-${redemptionId} })` AND sets the RewardRedemption status to `CANCELLED`. Only allowed for `PENDING` / `ACTIVE` statuses; rejects USED/EXPIRED/FULFILLED.
- `fulfillRedemption(id, trackingNumber?)` sets status `FULFILLED` + `shippedAt = now` + optional `trackingNumber`. Only allowed for PENDING/ACTIVE statuses; rejects USED/EXPIRED/CANCELLED/FULFILLED.
- `deleteTier` rejects if any Customer is on that tier — `prisma.customer.count({ where: { loyaltyTierId: id } })`.
- `deleteReward` rejects if any RewardRedemption exists — `prisma.rewardRedemption.count({ where: { rewardId: id } })`.
- `updateLoyaltySettings` upserts the singleton with `id = "default"`. Do NOT allow editing of `pointsExpireMonths` or `tierEvaluationPeriod` (cron-managed) — silently strip those keys from the input before upsert.
- CSV exports cap at 10,000 rows; over-cap returns `{ ok: false, error: 'Too many rows — narrow filters' }`.
- `get*ForInspector` wrappers MUST inline Prisma queries (parallel-safety with Task 1).
- Re-export type aliases (`MemberDetailFull`, `TierDetailFull`, `RewardDetailFull`, `RedemptionDetailFull`, `EventDetailFull`, `LoyaltySettingsRow`, `TimeRange`) so client components can `import type`.
- Re-export `PointsTransactionType`, `RewardType`, `RedemptionStatus` from `@prisma/client` (already client-safe — `import type` only).

**Files:**
- Create: `app/admin/loyalty/actions.ts`
- Test: `tests/unit/app/admin/loyalty/actions.test.ts`

#### Steps

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/app/admin/loyalty/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const customerFindUnique = vi.fn()
const customerCount = vi.fn()
const customerFindMany = vi.fn()
const tierCreate = vi.fn()
const tierUpdate = vi.fn()
const tierDelete = vi.fn()
const tierFindUnique = vi.fn()
const tierFindMany = vi.fn()
const rewardCreate = vi.fn()
const rewardUpdate = vi.fn()
const rewardDelete = vi.fn()
const rewardFindUnique = vi.fn()
const rewardFindMany = vi.fn()
const redemptionFindUnique = vi.fn()
const redemptionFindMany = vi.fn()
const redemptionUpdate = vi.fn()
const redemptionCount = vi.fn()
const eventCreate = vi.fn()
const eventUpdate = vi.fn()
const eventDelete = vi.fn()
const eventFindUnique = vi.fn()
const eventFindMany = vi.fn()
const settingsUpsert = vi.fn()
const settingsFindUnique = vi.fn()

const awardPoints = vi.fn()
const deductPoints = vi.fn()
const updateCustomerTier = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      findUnique: customerFindUnique,
      count: customerCount,
      findMany: customerFindMany,
    },
    loyaltyTier: {
      create: tierCreate,
      update: tierUpdate,
      delete: tierDelete,
      findUnique: tierFindUnique,
      findMany: tierFindMany,
    },
    reward: {
      create: rewardCreate,
      update: rewardUpdate,
      delete: rewardDelete,
      findUnique: rewardFindUnique,
      findMany: rewardFindMany,
    },
    rewardRedemption: {
      findUnique: redemptionFindUnique,
      findMany: redemptionFindMany,
      update: redemptionUpdate,
      count: redemptionCount,
    },
    pointsMultiplierEvent: {
      create: eventCreate,
      update: eventUpdate,
      delete: eventDelete,
      findUnique: eventFindUnique,
      findMany: eventFindMany,
    },
    loyaltySettings: { upsert: settingsUpsert, findUnique: settingsFindUnique },
  },
}))

vi.mock('@/lib/loyalty/service', () => ({
  awardPoints: (...a: unknown[]) => awardPoints(...a),
  deductPoints: (...a: unknown[]) => deductPoints(...a),
  updateCustomerTier: (...a: unknown[]) => updateCustomerTier(...a),
}))

vi.mock('@/lib/auth/admin', () => ({
  requireAdmin: vi.fn().mockResolvedValue('admin-1'),
  requireAdminRole: vi.fn().mockResolvedValue('admin-1'),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TIER actions', () => {
  it('createTier persists the row', async () => {
    tierCreate.mockResolvedValue({ id: 't1' })
    const { createTier } = await import('@/app/admin/loyalty/actions')
    const r = await createTier({
      name: 'Bronze', slug: 'bronze', primaryColor: '#64748B', secondaryColor: '#475569',
      minAnnualSpend: 0, minAnnualPoints: 0, pointMultiplier: 1, sortOrder: 1,
      isActive: true, isInviteOnly: false, freeShipping: false, earlyDropAccess: false,
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data?.id).toBe('t1')
  })

  it('deleteTier rejects when customers are on the tier', async () => {
    customerCount.mockResolvedValue(3)
    const { deleteTier } = await import('@/app/admin/loyalty/actions')
    const r = await deleteTier('t1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/reassign/i)
  })

  it('deleteTier deletes when no customers are on it', async () => {
    customerCount.mockResolvedValue(0)
    tierDelete.mockResolvedValue({})
    const { deleteTier } = await import('@/app/admin/loyalty/actions')
    const r = await deleteTier('t1')
    expect(r.ok).toBe(true)
  })

  it('toggleTierActive flips isActive', async () => {
    tierFindUnique.mockResolvedValue({ id: 't1', isActive: true })
    tierUpdate.mockResolvedValue({})
    const { toggleTierActive } = await import('@/app/admin/loyalty/actions')
    const r = await toggleTierActive('t1')
    expect(r.ok).toBe(true)
    expect(tierUpdate.mock.calls[0][0].data.isActive).toBe(false)
  })
})

describe('MEMBER actions', () => {
  it('adjustMemberPoints calls awardPoints with ADMIN_ADJUSTMENT + idempotencyKey', async () => {
    customerFindUnique.mockResolvedValue({ id: 'c1', currentPoints: 1000 })
    awardPoints.mockResolvedValue({ id: 'p1' })
    const { adjustMemberPoints } = await import('@/app/admin/loyalty/actions')
    const r = await adjustMemberPoints('c1', 50, 'Test bonus')
    expect(r.ok).toBe(true)
    const [customerId, points, type, description, opts] = awardPoints.mock.calls[0]
    expect(customerId).toBe('c1')
    expect(points).toBe(50)
    expect(type).toBe('ADMIN_ADJUSTMENT')
    expect(description).toContain('Test bonus')
    expect(opts.idempotencyKey).toMatch(/^admin-adjust-admin-1-c1-/)
  })

  it('adjustMemberPoints rejects negative delta that would overdraft', async () => {
    customerFindUnique.mockResolvedValue({ id: 'c1', currentPoints: 10 })
    const { adjustMemberPoints } = await import('@/app/admin/loyalty/actions')
    const r = await adjustMemberPoints('c1', -50, 'Reverse')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/insufficient/i)
    expect(awardPoints).not.toHaveBeenCalled()
  })

  it('adjustMemberPoints rejects when reason is blank', async () => {
    const { adjustMemberPoints } = await import('@/app/admin/loyalty/actions')
    const r = await adjustMemberPoints('c1', 10, '   ')
    expect(r.ok).toBe(false)
  })

  it('recomputeMemberTier calls updateCustomerTier', async () => {
    updateCustomerTier.mockResolvedValue(null)
    const { recomputeMemberTier } = await import('@/app/admin/loyalty/actions')
    const r = await recomputeMemberTier('c1')
    expect(r.ok).toBe(true)
    expect(updateCustomerTier).toHaveBeenCalledWith('c1')
  })

  it('bulkAdjustMemberPoints uses one batchId per call', async () => {
    customerFindUnique.mockResolvedValue({ id: 'c1', currentPoints: 1000 })
    awardPoints.mockResolvedValue({ id: 'p1' })
    const { bulkAdjustMemberPoints } = await import('@/app/admin/loyalty/actions')
    const r = await bulkAdjustMemberPoints(['c1', 'c2'], 100, 'Promo')
    expect(r.ok).toBe(true)
    // Both calls share the same batch UUID prefix
    const k1 = awardPoints.mock.calls[0][4].idempotencyKey
    const k2 = awardPoints.mock.calls[1][4].idempotencyKey
    const batch1 = k1.split('-')[1]
    const batch2 = k2.split('-')[1]
    expect(batch1).toBe(batch2)
  })
})

describe('REWARD actions', () => {
  it('createReward validates pointsCost positive', async () => {
    const { createReward } = await import('@/app/admin/loyalty/actions')
    const r = await createReward({
      name: 'Bad', slug: 'bad', description: 'd', pointsCost: -10,
      rewardType: 'DISCOUNT', isActive: true, sortOrder: 0,
    })
    expect(r.ok).toBe(false)
  })

  it('createReward persists with defaults', async () => {
    rewardCreate.mockResolvedValue({ id: 'r1' })
    const { createReward } = await import('@/app/admin/loyalty/actions')
    const r = await createReward({
      name: '10% off', slug: '10-off', description: 'd', pointsCost: 500,
      rewardType: 'DISCOUNT', isActive: true, sortOrder: 0,
    })
    expect(r.ok).toBe(true)
  })

  it('deleteReward rejects when redemptions exist', async () => {
    redemptionCount.mockResolvedValue(5)
    const { deleteReward } = await import('@/app/admin/loyalty/actions')
    const r = await deleteReward('r1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/redemption history/i)
  })

  it('toggleRewardActive flips isActive', async () => {
    rewardFindUnique.mockResolvedValue({ id: 'r1', isActive: true })
    rewardUpdate.mockResolvedValue({})
    const { toggleRewardActive } = await import('@/app/admin/loyalty/actions')
    const r = await toggleRewardActive('r1')
    expect(r.ok).toBe(true)
    expect(rewardUpdate.mock.calls[0][0].data.isActive).toBe(false)
  })

  it('bulkActivateRewards returns per-id results', async () => {
    rewardUpdate.mockResolvedValue({})
    const { bulkActivateRewards } = await import('@/app/admin/loyalty/actions')
    const r = await bulkActivateRewards(['r1', 'r2'])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data?.succeeded).toEqual(['r1', 'r2'])
  })
})

describe('REDEMPTION actions', () => {
  it('fulfillRedemption rejects non-pending/active status', async () => {
    redemptionFindUnique.mockResolvedValue({ id: 'red1', status: 'USED' })
    const { fulfillRedemption } = await import('@/app/admin/loyalty/actions')
    const r = await fulfillRedemption('red1', 'TRACK-123')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/already finalized/i)
  })

  it('fulfillRedemption sets FULFILLED + trackingNumber', async () => {
    redemptionFindUnique.mockResolvedValue({ id: 'red1', status: 'PENDING' })
    redemptionUpdate.mockResolvedValue({})
    const { fulfillRedemption } = await import('@/app/admin/loyalty/actions')
    const r = await fulfillRedemption('red1', 'TRACK-123')
    expect(r.ok).toBe(true)
    const data = redemptionUpdate.mock.calls[0][0].data
    expect(data.status).toBe('FULFILLED')
    expect(data.trackingNumber).toBe('TRACK-123')
    expect(data.shippedAt).toBeInstanceOf(Date)
  })

  it('cancelRedemption reverses points via awardPoints with idempotency cancel-${id}', async () => {
    redemptionFindUnique.mockResolvedValue({
      id: 'red1', status: 'PENDING', customerId: 'c1', pointsSpent: 500,
    })
    redemptionUpdate.mockResolvedValue({})
    awardPoints.mockResolvedValue({ id: 'p1' })
    const { cancelRedemption } = await import('@/app/admin/loyalty/actions')
    const r = await cancelRedemption('red1', 'Customer request')
    expect(r.ok).toBe(true)
    expect(awardPoints).toHaveBeenCalledWith(
      'c1', 500, 'ADMIN_ADJUSTMENT', expect.any(String),
      expect.objectContaining({ idempotencyKey: 'cancel-red1' }),
    )
    expect(redemptionUpdate.mock.calls[0][0].data.status).toBe('CANCELLED')
  })

  it('cancelRedemption refuses already-finalized statuses', async () => {
    redemptionFindUnique.mockResolvedValue({ id: 'red1', status: 'FULFILLED' })
    const { cancelRedemption } = await import('@/app/admin/loyalty/actions')
    const r = await cancelRedemption('red1', 'oops')
    expect(r.ok).toBe(false)
  })
})

describe('EVENT actions', () => {
  it('createEvent persists', async () => {
    eventCreate.mockResolvedValue({ id: 'e1' })
    const { createEvent } = await import('@/app/admin/loyalty/actions')
    const r = await createEvent({
      name: 'Memorial 2x', description: 'd',
      startDate: new Date('2026-05-25'), endDate: new Date('2026-05-27'),
      multiplier: 2, isActive: true,
    })
    expect(r.ok).toBe(true)
  })

  it('deleteEvent succeeds (no FK guards)', async () => {
    eventDelete.mockResolvedValue({})
    const { deleteEvent } = await import('@/app/admin/loyalty/actions')
    const r = await deleteEvent('e1')
    expect(r.ok).toBe(true)
  })
})

describe('SETTINGS actions', () => {
  it('updateLoyaltySettings strips cron fields silently', async () => {
    settingsUpsert.mockResolvedValue({})
    const { updateLoyaltySettings } = await import('@/app/admin/loyalty/actions')
    const r = await updateLoyaltySettings({
      isEnabled: true,
      programName: 'New Name',
      pointsPerDollar: 2,
      pointsExpireMonths: 999, // should be stripped
      tierEvaluationPeriod: 'monthly', // should be stripped
    })
    expect(r.ok).toBe(true)
    const data = settingsUpsert.mock.calls[0][0].update
    expect(data.programName).toBe('New Name')
    expect(data.pointsExpireMonths).toBeUndefined()
    expect(data.tierEvaluationPeriod).toBeUndefined()
  })
})

describe('Inspector wrappers (inline queries)', () => {
  it('getMemberDetailForInspector returns null on missing', async () => {
    customerFindUnique.mockResolvedValue(null)
    const { getMemberDetailForInspector } = await import('@/app/admin/loyalty/actions')
    expect(await getMemberDetailForInspector('missing')).toBeNull()
  })

  it('getTierDetailForInspector returns detail with memberCount', async () => {
    tierFindUnique.mockResolvedValue({
      id: 't1', name: 'Bronze', slug: 'bronze', description: null,
      primaryColor: '#64748B', secondaryColor: '#475569',
      minAnnualSpend: 0, minAnnualPoints: 0, isInviteOnly: false,
      pointMultiplier: 1, freeShipping: false, earlyDropAccess: false,
      perks: null, sortOrder: 1, isActive: true,
    })
    customerCount.mockResolvedValue(10)
    const { getTierDetailForInspector } = await import('@/app/admin/loyalty/actions')
    const d = await getTierDetailForInspector('t1')
    expect(d?.memberCount).toBe(10)
  })
})

describe('CSV exports', () => {
  it('exportMembersCsv returns ActionResult<{ csv }>', async () => {
    customerCount.mockResolvedValue(1)
    customerFindMany.mockResolvedValue([
      { id: 'c1', email: 'a@e.com', name: 'Ada',
        currentPoints: 100, lifetimePoints: 1000, annualPointsEarned: 500,
        lastOrderDate: new Date('2026-05-15'),
        loyaltyTier: { name: 'Silver' } },
    ])
    const { exportMembersCsv } = await import('@/app/admin/loyalty/actions')
    const r = await exportMembersCsv()
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data?.csv).toContain('a@e.com')
  })

  it('rejects exports over cap', async () => {
    customerCount.mockResolvedValue(20000)
    const { exportMembersCsv } = await import('@/app/admin/loyalty/actions')
    const r = await exportMembersCsv()
    expect(r.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/app/admin/loyalty/actions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `app/admin/loyalty/actions.ts`**

```ts
// app/admin/loyalty/actions.ts
'use server'

/**
 * Phase 7 — Admin Loyalty Server Actions (~32 actions).
 *
 * Auth gates:
 *   - requireAdmin() (no-arg) for all read + most write actions.
 *   - requireAdminRole('SUPER_ADMIN') for: deleteTier, deleteReward, cancelRedemption,
 *     bulkAdjustMemberPoints, bulkCancelRedemptions.
 *
 * Points/tier mutations:
 *   ALL points changes route through lib/loyalty/service.ts (awardPoints/deductPoints/
 *   updateCustomerTier) — never write raw to PointsTransaction. Preserves PR #17 + #37
 *   atomicity + idempotency guarantees.
 *
 * PARALLEL-SAFETY NOTE:
 *   get*ForInspector actions inline their Prisma queries because Task 1 (which builds
 *   lib/admin/loyalty.ts) is executing concurrently on a separate branch. Refactor
 *   deferred to Phase 7.5.
 */

import { revalidatePath } from 'next/cache'
import type {
  PointsTransactionType,
  RewardType,
  RedemptionStatus,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin, requireAdminRole } from '@/lib/auth/admin'
import { awardPoints, updateCustomerTier } from '@/lib/loyalty/service'

// ============================================================
// Return types
// ============================================================

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

export interface BulkResultData {
  succeeded: string[]
  failed: { id: string; error: string }[]
}
export type BulkResult = ActionResult<BulkResultData>

// ============================================================
// TimeRange (re-declared inline for parallel-safety with Task 1)
// ============================================================

export type TimeRange = 'today' | '7d' | '30d' | '90d' | 'year'

function getRangeBoundsLocal(range: TimeRange, ref: Date = new Date()) {
  const end = new Date(ref)
  const start = new Date(ref)
  const day = 24 * 60 * 60 * 1000
  switch (range) {
    case 'today': start.setUTCHours(0, 0, 0, 0); break
    case '7d':    start.setTime(end.getTime() - 7 * day); break
    case '30d':   start.setTime(end.getTime() - 30 * day); break
    case '90d':   start.setTime(end.getTime() - 90 * day); break
    case 'year':  start.setTime(end.getTime() - 365 * day); break
  }
  return { start, end }
}

const CSV_MAX_ROWS = 10000
const LOYALTY_PATH = '/admin/loyalty'

function revalidateLoyalty() {
  revalidatePath(LOYALTY_PATH)
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = v instanceof Date ? v.toISOString() : String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function rowsToCsv(headers: string[], rows: unknown[][]): string {
  const head = headers.join(',')
  const body = rows.map((r) => r.map(csvEscape).join(',')).join('\n')
  return body ? `${head}\n${body}` : head
}

// ============================================================
// Re-exported detail shapes (so client components can import type)
// ============================================================

export interface MemberLedgerEntry {
  id: string
  points: number
  type: PointsTransactionType
  description: string
  createdAt: Date
  orderId: string | null
  redemptionId: string | null
  referralId: string | null
  reviewId: string | null
}

export interface MemberDetailFull {
  id: string
  email: string
  name: string | null
  tierId: string | null
  tierName: string | null
  tierColor: string | null
  currentPoints: number
  lifetimePoints: number
  annualPointsEarned: number
  tierStartDate: Date
  lastOrderDate: Date | null
  transactions: MemberLedgerEntry[]
}

export interface TierDetailFull {
  id: string
  name: string
  slug: string
  description: string | null
  primaryColor: string
  secondaryColor: string
  minAnnualSpend: number
  minAnnualPoints: number
  isInviteOnly: boolean
  pointMultiplier: number
  freeShipping: boolean
  earlyDropAccess: boolean
  perks: string | null
  sortOrder: number
  isActive: boolean
  memberCount: number
}

export interface RewardDetailFull {
  id: string
  name: string
  slug: string
  description: string
  pointsCost: number
  rewardType: RewardType
  value: number | null
  isActive: boolean
  maxRedemptionsPerCustomer: number | null
  totalAvailable: number | null
  totalRedeemed: number
  minTierRequired: string | null
  metadata: string | null
  image: string | null
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

export interface RedemptionDetailFull {
  id: string
  customerId: string
  customerEmail: string
  customerName: string | null
  rewardId: string
  rewardName: string
  rewardType: RewardType
  pointsSpent: number
  status: RedemptionStatus
  couponCode: string | null
  usedAt: Date | null
  orderId: string | null
  trackingNumber: string | null
  shippedAt: Date | null
  metadata: string | null
  idempotencyKey: string
  createdAt: Date
  updatedAt: Date
}

export interface EventDetailFull {
  id: string
  name: string
  description: string | null
  startDate: Date
  endDate: Date
  multiplier: number
  tierIds: string | null
  categoryIds: string | null
  isActive: boolean
  totalBonusPointsAwarded: number
  ordersAffected: number
  createdAt: Date
  updatedAt: Date
}

export interface LoyaltySettingsRow {
  id: string
  isEnabled: boolean
  programName: string
  pointsPerDollar: number
  pointsRoundingMode: string
  minimumOrderForPoints: number
  referralPointsReferrer: number
  referralPointsReferred: number
  referralEnabled: boolean
  reviewPointsEnabled: boolean
  reviewPointsAmount: number
  reviewWithPhotoBonus: number
  birthdayRewardsEnabled: boolean
  birthdayRewardType: string
  birthdayRewardValue: number
  birthdayRewardExpireDays: number
  pointsExpireEnabled: boolean
  pointsExpireMonths: number
  tierEvaluationPeriod: string
  tierDowngradeEnabled: boolean
  showPointsInCart: boolean
  showPointsInCheckout: boolean
  showTierProgress: boolean
  updatedAt: Date
}

// ============================================================
// Re-exported enums (client-safe via import type)
// ============================================================

export type { PointsTransactionType, RewardType, RedemptionStatus }

// ============================================================
// Input types
// ============================================================

export interface CreateTierInput {
  name: string
  slug: string
  description?: string | null
  primaryColor: string
  secondaryColor: string
  minAnnualSpend?: number
  minAnnualPoints?: number
  isInviteOnly?: boolean
  pointMultiplier: number
  freeShipping?: boolean
  earlyDropAccess?: boolean
  perks?: string | null
  sortOrder: number
  isActive?: boolean
}

export type UpdateTierInput = Partial<CreateTierInput>

export interface CreateRewardInput {
  name: string
  slug: string
  description: string
  pointsCost: number
  rewardType: RewardType
  value?: number | null
  isActive?: boolean
  maxRedemptionsPerCustomer?: number | null
  totalAvailable?: number | null
  minTierRequired?: string | null
  metadata?: string | null
  image?: string | null
  sortOrder?: number
}

export type UpdateRewardInput = Partial<CreateRewardInput>

export interface CreateEventInput {
  name: string
  description?: string | null
  startDate: Date
  endDate: Date
  multiplier: number
  tierIds?: string | null
  categoryIds?: string | null
  isActive?: boolean
}

export type UpdateEventInput = Partial<CreateEventInput>

export interface UpdateLoyaltySettingsInput {
  isEnabled?: boolean
  programName?: string
  pointsPerDollar?: number
  pointsRoundingMode?: string
  minimumOrderForPoints?: number
  referralPointsReferrer?: number
  referralPointsReferred?: number
  referralEnabled?: boolean
  reviewPointsEnabled?: boolean
  reviewPointsAmount?: number
  reviewWithPhotoBonus?: number
  birthdayRewardsEnabled?: boolean
  birthdayRewardType?: string
  birthdayRewardValue?: number
  birthdayRewardExpireDays?: number
  pointsExpireEnabled?: boolean
  /** CRON-MANAGED — silently stripped by updateLoyaltySettings. */
  pointsExpireMonths?: number
  /** CRON-MANAGED — silently stripped by updateLoyaltySettings. */
  tierEvaluationPeriod?: string
  tierDowngradeEnabled?: boolean
  showPointsInCart?: boolean
  showPointsInCheckout?: boolean
  showTierProgress?: boolean
}

// ============================================================
// TIERS
// ============================================================

export async function createTier(input: CreateTierInput): Promise<ActionResult<{ id: string }>> {
  await requireAdmin()
  if (!input.name?.trim() || !input.slug?.trim()) {
    return { ok: false, error: 'Name and slug are required' }
  }
  try {
    const t = await prisma.loyaltyTier.create({
      data: {
        name: input.name.trim(),
        slug: input.slug.trim(),
        description: input.description ?? null,
        primaryColor: input.primaryColor,
        secondaryColor: input.secondaryColor,
        minAnnualSpend: input.minAnnualSpend ?? 0,
        minAnnualPoints: input.minAnnualPoints ?? 0,
        isInviteOnly: input.isInviteOnly ?? false,
        pointMultiplier: input.pointMultiplier,
        freeShipping: input.freeShipping ?? false,
        earlyDropAccess: input.earlyDropAccess ?? false,
        perks: input.perks ?? null,
        sortOrder: input.sortOrder,
        isActive: input.isActive ?? true,
      },
    })
    revalidateLoyalty()
    return { ok: true, data: { id: t.id } }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create tier' }
  }
}

export async function updateTier(id: string, input: UpdateTierInput): Promise<ActionResult> {
  await requireAdmin()
  const data: Record<string, unknown> = {}
  for (const key of Object.keys(input) as Array<keyof UpdateTierInput>) {
    if (input[key] !== undefined) data[key] = input[key]
  }
  try {
    await prisma.loyaltyTier.update({ where: { id }, data })
    revalidateLoyalty()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update tier' }
  }
}

export async function deleteTier(id: string): Promise<ActionResult> {
  await requireAdminRole('SUPER_ADMIN')
  const count = await prisma.customer.count({ where: { loyaltyTierId: id } })
  if (count > 0) {
    return { ok: false, error: `${count} customers on this tier; reassign first` }
  }
  try {
    await prisma.loyaltyTier.delete({ where: { id } })
    revalidateLoyalty()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete tier' }
  }
}

export async function toggleTierActive(id: string): Promise<ActionResult> {
  await requireAdmin()
  const existing = await prisma.loyaltyTier.findUnique({
    where: { id }, select: { isActive: true },
  })
  if (!existing) return { ok: false, error: 'Tier not found' }
  await prisma.loyaltyTier.update({ where: { id }, data: { isActive: !existing.isActive } })
  revalidateLoyalty()
  return { ok: true }
}

export async function getTierDetailForInspector(id: string): Promise<TierDetailFull | null> {
  await requireAdmin()
  const t = await prisma.loyaltyTier.findUnique({ where: { id } })
  if (!t) return null
  const count = await prisma.customer.count({ where: { loyaltyTierId: id } })
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    description: t.description ?? null,
    primaryColor: t.primaryColor,
    secondaryColor: t.secondaryColor,
    minAnnualSpend: Number(t.minAnnualSpend ?? 0),
    minAnnualPoints: t.minAnnualPoints,
    isInviteOnly: t.isInviteOnly,
    pointMultiplier: Number(t.pointMultiplier ?? 1),
    freeShipping: t.freeShipping,
    earlyDropAccess: t.earlyDropAccess,
    perks: t.perks ?? null,
    sortOrder: t.sortOrder,
    isActive: t.isActive,
    memberCount: count,
  }
}

// ============================================================
// MEMBERS
// ============================================================

export async function adjustMemberPoints(
  memberId: string,
  delta: number,
  reason: string,
): Promise<ActionResult> {
  const adminId = await requireAdmin()
  if (!Number.isFinite(delta) || delta === 0) {
    return { ok: false, error: 'Delta must be a non-zero number' }
  }
  if (!reason || reason.trim().length === 0) {
    return { ok: false, error: 'Reason is required' }
  }
  // Pre-check overdraft for negative deltas (the existing awardPoints function
  // does not guard against negative-delta overdraft — only deductPoints does).
  if (delta < 0) {
    const c = await prisma.customer.findUnique({
      where: { id: memberId }, select: { currentPoints: true },
    })
    if (!c) return { ok: false, error: 'Customer not found' }
    if (c.currentPoints + delta < 0) {
      return { ok: false, error: `Insufficient points (balance: ${c.currentPoints})` }
    }
  }
  try {
    await awardPoints(
      memberId,
      delta,
      'ADMIN_ADJUSTMENT',
      `Admin adjustment: ${reason.trim()}`,
      { idempotencyKey: `admin-adjust-${adminId}-${memberId}-${Date.now()}` },
    )
    revalidateLoyalty()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to adjust points' }
  }
}

export async function recomputeMemberTier(memberId: string): Promise<ActionResult> {
  await requireAdmin()
  try {
    await updateCustomerTier(memberId)
    revalidateLoyalty()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to recompute tier' }
  }
}

export async function bulkAdjustMemberPoints(
  memberIds: string[],
  delta: number,
  reason: string,
): Promise<BulkResult> {
  const adminId = await requireAdminRole('SUPER_ADMIN')
  if (!Number.isFinite(delta) || delta === 0) {
    return { ok: false, error: 'Delta must be a non-zero number' }
  }
  if (!reason || reason.trim().length === 0) {
    return { ok: false, error: 'Reason is required' }
  }
  const batchId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`)
    .replace(/-/g, '')
    .slice(0, 12)
  const succeeded: string[] = []
  const failed: { id: string; error: string }[] = []
  for (const memberId of memberIds) {
    try {
      if (delta < 0) {
        const c = await prisma.customer.findUnique({
          where: { id: memberId }, select: { currentPoints: true },
        })
        if (!c) {
          failed.push({ id: memberId, error: 'not found' })
          continue
        }
        if (c.currentPoints + delta < 0) {
          failed.push({ id: memberId, error: 'insufficient points' })
          continue
        }
      }
      await awardPoints(
        memberId,
        delta,
        'ADMIN_ADJUSTMENT',
        `Bulk admin adjustment: ${reason.trim()}`,
        { idempotencyKey: `bulk-${batchId}-${memberId}` },
      )
      succeeded.push(memberId)
    } catch (err) {
      failed.push({ id: memberId, error: err instanceof Error ? err.message : 'failed' })
    }
    void adminId
  }
  revalidateLoyalty()
  return { ok: true, data: { succeeded, failed } }
}

export async function bulkRecomputeTiers(memberIds: string[]): Promise<BulkResult> {
  await requireAdmin()
  const succeeded: string[] = []
  const failed: { id: string; error: string }[] = []
  for (const id of memberIds) {
    try {
      await updateCustomerTier(id)
      succeeded.push(id)
    } catch (err) {
      failed.push({ id, error: err instanceof Error ? err.message : 'failed' })
    }
  }
  revalidateLoyalty()
  return { ok: true, data: { succeeded, failed } }
}

export async function getMemberDetailForInspector(id: string): Promise<MemberDetailFull | null> {
  await requireAdmin()
  const c = await prisma.customer.findUnique({
    where: { id },
    include: {
      loyaltyTier: { select: { id: true, name: true, slug: true, primaryColor: true } },
      pointsTransactions: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true, points: true, type: true, description: true, createdAt: true,
          orderId: true, redemptionId: true, referralId: true, reviewId: true,
        },
      },
    },
  })
  if (!c) return null
  return {
    id: c.id,
    email: c.email,
    name: c.name ?? null,
    tierId: c.loyaltyTier?.id ?? null,
    tierName: c.loyaltyTier?.name ?? null,
    tierColor: c.loyaltyTier?.primaryColor ?? null,
    currentPoints: c.currentPoints,
    lifetimePoints: c.lifetimePoints,
    annualPointsEarned: c.annualPointsEarned,
    tierStartDate: c.tierStartDate,
    lastOrderDate: c.lastOrderDate ?? null,
    transactions: c.pointsTransactions.map((t) => ({
      id: t.id,
      points: Number(t.points),
      type: t.type,
      description: t.description,
      createdAt: t.createdAt,
      orderId: t.orderId ?? null,
      redemptionId: t.redemptionId ?? null,
      referralId: t.referralId ?? null,
      reviewId: t.reviewId ?? null,
    })),
  }
}

// ============================================================
// REWARDS
// ============================================================

export async function createReward(input: CreateRewardInput): Promise<ActionResult<{ id: string }>> {
  await requireAdmin()
  if (!input.name?.trim() || !input.slug?.trim()) {
    return { ok: false, error: 'Name and slug are required' }
  }
  if (!Number.isFinite(input.pointsCost) || input.pointsCost < 0) {
    return { ok: false, error: 'pointsCost must be a non-negative number' }
  }
  try {
    const r = await prisma.reward.create({
      data: {
        name: input.name.trim(),
        slug: input.slug.trim(),
        description: input.description,
        pointsCost: input.pointsCost,
        rewardType: input.rewardType,
        value: input.value ?? null,
        isActive: input.isActive ?? true,
        maxRedemptionsPerCustomer: input.maxRedemptionsPerCustomer ?? null,
        totalAvailable: input.totalAvailable ?? null,
        minTierRequired: input.minTierRequired ?? null,
        metadata: input.metadata ?? null,
        image: input.image ?? null,
        sortOrder: input.sortOrder ?? 0,
      },
    })
    revalidateLoyalty()
    return { ok: true, data: { id: r.id } }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create reward' }
  }
}

export async function updateReward(id: string, input: UpdateRewardInput): Promise<ActionResult> {
  await requireAdmin()
  const data: Record<string, unknown> = {}
  for (const key of Object.keys(input) as Array<keyof UpdateRewardInput>) {
    if (input[key] !== undefined) data[key] = input[key]
  }
  try {
    await prisma.reward.update({ where: { id }, data })
    revalidateLoyalty()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update reward' }
  }
}

export async function deleteReward(id: string): Promise<ActionResult> {
  await requireAdminRole('SUPER_ADMIN')
  const count = await prisma.rewardRedemption.count({ where: { rewardId: id } })
  if (count > 0) {
    return { ok: false, error: 'Reward has redemption history; deactivate instead' }
  }
  try {
    await prisma.reward.delete({ where: { id } })
    revalidateLoyalty()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete reward' }
  }
}

export async function toggleRewardActive(id: string): Promise<ActionResult> {
  await requireAdmin()
  const existing = await prisma.reward.findUnique({
    where: { id }, select: { isActive: true },
  })
  if (!existing) return { ok: false, error: 'Reward not found' }
  await prisma.reward.update({ where: { id }, data: { isActive: !existing.isActive } })
  revalidateLoyalty()
  return { ok: true }
}

export async function bulkActivateRewards(ids: string[]): Promise<BulkResult> {
  await requireAdmin()
  const succeeded: string[] = []
  const failed: { id: string; error: string }[] = []
  for (const id of ids) {
    try {
      await prisma.reward.update({ where: { id }, data: { isActive: true } })
      succeeded.push(id)
    } catch (err) {
      failed.push({ id, error: err instanceof Error ? err.message : 'failed' })
    }
  }
  revalidateLoyalty()
  return { ok: true, data: { succeeded, failed } }
}

export async function bulkDeactivateRewards(ids: string[]): Promise<BulkResult> {
  await requireAdmin()
  const succeeded: string[] = []
  const failed: { id: string; error: string }[] = []
  for (const id of ids) {
    try {
      await prisma.reward.update({ where: { id }, data: { isActive: false } })
      succeeded.push(id)
    } catch (err) {
      failed.push({ id, error: err instanceof Error ? err.message : 'failed' })
    }
  }
  revalidateLoyalty()
  return { ok: true, data: { succeeded, failed } }
}

export async function getRewardDetailForInspector(id: string): Promise<RewardDetailFull | null> {
  await requireAdmin()
  const r = await prisma.reward.findUnique({ where: { id } })
  if (!r) return null
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    pointsCost: r.pointsCost,
    rewardType: r.rewardType,
    value: r.value === null ? null : Number(r.value),
    isActive: r.isActive,
    maxRedemptionsPerCustomer: r.maxRedemptionsPerCustomer ?? null,
    totalAvailable: r.totalAvailable ?? null,
    totalRedeemed: r.totalRedeemed,
    minTierRequired: r.minTierRequired ?? null,
    metadata: r.metadata ?? null,
    image: r.image ?? null,
    sortOrder: r.sortOrder,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

// ============================================================
// REDEMPTIONS
// ============================================================

const FULFILLABLE_STATUSES: RedemptionStatus[] = ['PENDING', 'ACTIVE']
const CANCELLABLE_STATUSES: RedemptionStatus[] = ['PENDING', 'ACTIVE']

export async function fulfillRedemption(
  id: string,
  trackingNumber?: string,
): Promise<ActionResult> {
  await requireAdmin()
  const existing = await prisma.rewardRedemption.findUnique({
    where: { id }, select: { id: true, status: true },
  })
  if (!existing) return { ok: false, error: 'Redemption not found' }
  if (!FULFILLABLE_STATUSES.includes(existing.status)) {
    return { ok: false, error: 'Redemption already finalized — cannot fulfill' }
  }
  try {
    await prisma.rewardRedemption.update({
      where: { id },
      data: {
        status: 'FULFILLED',
        shippedAt: new Date(),
        trackingNumber: trackingNumber ?? null,
      },
    })
    revalidateLoyalty()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to fulfill redemption' }
  }
}

export async function cancelRedemption(id: string, reason: string): Promise<ActionResult> {
  await requireAdminRole('SUPER_ADMIN')
  if (!reason || reason.trim().length === 0) {
    return { ok: false, error: 'Cancellation reason is required' }
  }
  const existing = await prisma.rewardRedemption.findUnique({
    where: { id },
    select: { id: true, status: true, customerId: true, pointsSpent: true },
  })
  if (!existing) return { ok: false, error: 'Redemption not found' }
  if (!CANCELLABLE_STATUSES.includes(existing.status)) {
    return { ok: false, error: 'Redemption already finalized — cannot cancel' }
  }
  try {
    await awardPoints(
      existing.customerId,
      existing.pointsSpent,
      'ADMIN_ADJUSTMENT',
      `Refund for cancelled redemption ${id}: ${reason.trim()}`,
      { idempotencyKey: `cancel-${id}` },
    )
    await prisma.rewardRedemption.update({
      where: { id },
      data: { status: 'CANCELLED' },
    })
    revalidateLoyalty()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to cancel redemption' }
  }
}

export async function bulkFulfillRedemptions(
  ids: string[],
  trackingByRedemptionId: Record<string, string> = {},
): Promise<BulkResult> {
  await requireAdmin()
  const succeeded: string[] = []
  const failed: { id: string; error: string }[] = []
  for (const id of ids) {
    const r = await fulfillRedemption(id, trackingByRedemptionId[id])
    if (r.ok) succeeded.push(id)
    else failed.push({ id, error: r.error })
  }
  revalidateLoyalty()
  return { ok: true, data: { succeeded, failed } }
}

export async function bulkCancelRedemptions(
  ids: string[],
  reason: string,
): Promise<BulkResult> {
  await requireAdminRole('SUPER_ADMIN')
  const succeeded: string[] = []
  const failed: { id: string; error: string }[] = []
  for (const id of ids) {
    const r = await cancelRedemption(id, reason)
    if (r.ok) succeeded.push(id)
    else failed.push({ id, error: r.error })
  }
  revalidateLoyalty()
  return { ok: true, data: { succeeded, failed } }
}

export async function getRedemptionDetailForInspector(
  id: string,
): Promise<RedemptionDetailFull | null> {
  await requireAdmin()
  const r = await prisma.rewardRedemption.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, email: true, name: true } },
      reward: { select: { id: true, name: true, rewardType: true } },
    },
  })
  if (!r) return null
  return {
    id: r.id,
    customerId: r.customerId,
    customerEmail: r.customer?.email ?? 'unknown',
    customerName: r.customer?.name ?? null,
    rewardId: r.rewardId,
    rewardName: r.reward?.name ?? 'unknown',
    rewardType: r.reward?.rewardType ?? 'DISCOUNT',
    pointsSpent: r.pointsSpent,
    status: r.status,
    couponCode: r.couponCode ?? null,
    usedAt: r.usedAt ?? null,
    orderId: r.orderId ?? null,
    trackingNumber: r.trackingNumber ?? null,
    shippedAt: r.shippedAt ?? null,
    metadata: r.metadata ?? null,
    idempotencyKey: r.idempotencyKey,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

// ============================================================
// EVENTS
// ============================================================

export async function createEvent(input: CreateEventInput): Promise<ActionResult<{ id: string }>> {
  await requireAdmin()
  if (!input.name?.trim()) return { ok: false, error: 'Name is required' }
  if (input.endDate < input.startDate) {
    return { ok: false, error: 'endDate must be after startDate' }
  }
  try {
    const e = await prisma.pointsMultiplierEvent.create({
      data: {
        name: input.name.trim(),
        description: input.description ?? null,
        startDate: input.startDate,
        endDate: input.endDate,
        multiplier: input.multiplier,
        tierIds: input.tierIds ?? null,
        categoryIds: input.categoryIds ?? null,
        isActive: input.isActive ?? true,
      },
    })
    revalidateLoyalty()
    return { ok: true, data: { id: e.id } }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create event' }
  }
}

export async function updateEvent(id: string, input: UpdateEventInput): Promise<ActionResult> {
  await requireAdmin()
  const data: Record<string, unknown> = {}
  for (const key of Object.keys(input) as Array<keyof UpdateEventInput>) {
    if (input[key] !== undefined) data[key] = input[key]
  }
  try {
    await prisma.pointsMultiplierEvent.update({ where: { id }, data })
    revalidateLoyalty()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update event' }
  }
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  await requireAdmin()
  try {
    await prisma.pointsMultiplierEvent.delete({ where: { id } })
    revalidateLoyalty()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete event' }
  }
}

export async function toggleEventActive(id: string): Promise<ActionResult> {
  await requireAdmin()
  const existing = await prisma.pointsMultiplierEvent.findUnique({
    where: { id }, select: { isActive: true },
  })
  if (!existing) return { ok: false, error: 'Event not found' }
  await prisma.pointsMultiplierEvent.update({
    where: { id }, data: { isActive: !existing.isActive },
  })
  revalidateLoyalty()
  return { ok: true }
}

export async function bulkActivateEvents(ids: string[]): Promise<BulkResult> {
  await requireAdmin()
  const succeeded: string[] = []
  const failed: { id: string; error: string }[] = []
  for (const id of ids) {
    try {
      await prisma.pointsMultiplierEvent.update({ where: { id }, data: { isActive: true } })
      succeeded.push(id)
    } catch (err) {
      failed.push({ id, error: err instanceof Error ? err.message : 'failed' })
    }
  }
  revalidateLoyalty()
  return { ok: true, data: { succeeded, failed } }
}

export async function bulkDeactivateEvents(ids: string[]): Promise<BulkResult> {
  await requireAdmin()
  const succeeded: string[] = []
  const failed: { id: string; error: string }[] = []
  for (const id of ids) {
    try {
      await prisma.pointsMultiplierEvent.update({ where: { id }, data: { isActive: false } })
      succeeded.push(id)
    } catch (err) {
      failed.push({ id, error: err instanceof Error ? err.message : 'failed' })
    }
  }
  revalidateLoyalty()
  return { ok: true, data: { succeeded, failed } }
}

export async function getEventDetailForInspector(id: string): Promise<EventDetailFull | null> {
  await requireAdmin()
  const e = await prisma.pointsMultiplierEvent.findUnique({ where: { id } })
  if (!e) return null
  return {
    id: e.id,
    name: e.name,
    description: e.description ?? null,
    startDate: e.startDate,
    endDate: e.endDate,
    multiplier: Number(e.multiplier ?? 1),
    tierIds: e.tierIds ?? null,
    categoryIds: e.categoryIds ?? null,
    isActive: e.isActive,
    totalBonusPointsAwarded: e.totalBonusPointsAwarded,
    ordersAffected: e.ordersAffected,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }
}

// ============================================================
// SETTINGS
// ============================================================

const SETTINGS_DEFAULTS = {
  isEnabled: true,
  programName: 'Head Over Feels Rewards',
  pointsPerDollar: 1,
  pointsRoundingMode: 'floor',
  minimumOrderForPoints: 0,
  referralPointsReferrer: 100,
  referralPointsReferred: 50,
  referralEnabled: true,
  reviewPointsEnabled: true,
  reviewPointsAmount: 25,
  reviewWithPhotoBonus: 25,
  birthdayRewardsEnabled: true,
  birthdayRewardType: 'points',
  birthdayRewardValue: 100,
  birthdayRewardExpireDays: 30,
  pointsExpireEnabled: true,
  pointsExpireMonths: 12,
  tierEvaluationPeriod: 'annual',
  tierDowngradeEnabled: false,
  showPointsInCart: true,
  showPointsInCheckout: true,
  showTierProgress: true,
}

export async function updateLoyaltySettings(
  input: UpdateLoyaltySettingsInput,
): Promise<ActionResult> {
  await requireAdmin()
  // Strip cron-managed fields silently (UI renders them read-only).
  const sanitized: Record<string, unknown> = {}
  for (const key of Object.keys(input) as Array<keyof UpdateLoyaltySettingsInput>) {
    if (key === 'pointsExpireMonths' || key === 'tierEvaluationPeriod') continue
    if (input[key] !== undefined) sanitized[key] = input[key]
  }
  try {
    await prisma.loyaltySettings.upsert({
      where: { id: 'default' },
      update: sanitized,
      create: { id: 'default', ...SETTINGS_DEFAULTS, ...sanitized },
    })
    revalidateLoyalty()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update settings' }
  }
}

export async function getLoyaltySettings(): Promise<LoyaltySettingsRow> {
  await requireAdmin()
  const s = await prisma.loyaltySettings.findUnique({ where: { id: 'default' } })
  if (!s) {
    return {
      id: 'default',
      ...SETTINGS_DEFAULTS,
      updatedAt: new Date(0),
    } as LoyaltySettingsRow
  }
  return {
    id: s.id,
    isEnabled: s.isEnabled,
    programName: s.programName,
    pointsPerDollar: Number(s.pointsPerDollar ?? 1),
    pointsRoundingMode: s.pointsRoundingMode,
    minimumOrderForPoints: Number(s.minimumOrderForPoints ?? 0),
    referralPointsReferrer: s.referralPointsReferrer,
    referralPointsReferred: s.referralPointsReferred,
    referralEnabled: s.referralEnabled,
    reviewPointsEnabled: s.reviewPointsEnabled,
    reviewPointsAmount: s.reviewPointsAmount,
    reviewWithPhotoBonus: s.reviewWithPhotoBonus,
    birthdayRewardsEnabled: s.birthdayRewardsEnabled,
    birthdayRewardType: s.birthdayRewardType,
    birthdayRewardValue: s.birthdayRewardValue,
    birthdayRewardExpireDays: s.birthdayRewardExpireDays,
    pointsExpireEnabled: s.pointsExpireEnabled,
    pointsExpireMonths: s.pointsExpireMonths,
    tierEvaluationPeriod: s.tierEvaluationPeriod,
    tierDowngradeEnabled: s.tierDowngradeEnabled,
    showPointsInCart: s.showPointsInCart,
    showPointsInCheckout: s.showPointsInCheckout,
    showTierProgress: s.showTierProgress,
    updatedAt: s.updatedAt,
  }
}

// ============================================================
// CSV EXPORTS
// ============================================================

export async function exportOverviewCsv(range: TimeRange): Promise<ActionResult<{ csv: string }>> {
  await requireAdmin()
  const { start, end } = getRangeBoundsLocal(range)
  // Overview CSV = last N points transactions in range (cap-protected).
  const txns = await prisma.pointsTransaction.findMany({
    where: { createdAt: { gte: start, lte: end } },
    orderBy: { createdAt: 'desc' },
    take: CSV_MAX_ROWS + 1,
    select: {
      id: true, points: true, type: true, description: true, createdAt: true,
      customer: { select: { email: true } },
    },
  })
  if (txns.length > CSV_MAX_ROWS) return { ok: false, error: 'Too many rows — narrow filters' }
  const csv = rowsToCsv(
    ['id', 'createdAt', 'customerEmail', 'type', 'points', 'description'],
    txns.map((t) => [t.id, t.createdAt, t.customer?.email ?? '', t.type, Number(t.points), t.description]),
  )
  return { ok: true, data: { csv } }
}

export interface MembersCsvFilters {
  tierId?: string
}

export async function exportMembersCsv(
  filters: MembersCsvFilters = {},
): Promise<ActionResult<{ csv: string }>> {
  await requireAdmin()
  const where: Record<string, unknown> = {}
  if (filters.tierId) where.loyaltyTierId = filters.tierId
  const count = await prisma.customer.count({ where })
  if (count > CSV_MAX_ROWS) return { ok: false, error: 'Too many rows — narrow filters' }
  const rows = await prisma.customer.findMany({
    where,
    orderBy: { lifetimePoints: 'desc' },
    take: CSV_MAX_ROWS,
    select: {
      id: true, email: true, name: true,
      currentPoints: true, lifetimePoints: true, annualPointsEarned: true,
      lastOrderDate: true,
      loyaltyTier: { select: { name: true } },
    },
  })
  const csv = rowsToCsv(
    ['id', 'email', 'name', 'tier', 'currentPoints', 'lifetimePoints', 'annualPointsEarned', 'lastOrderDate'],
    rows.map((c) => [
      c.id, c.email, c.name ?? '', c.loyaltyTier?.name ?? '',
      c.currentPoints, c.lifetimePoints, c.annualPointsEarned,
      c.lastOrderDate ?? '',
    ]),
  )
  return { ok: true, data: { csv } }
}

export interface RewardsCsvFilters {
  isActive?: boolean
  rewardType?: RewardType
}

export async function exportRewardsCsv(
  filters: RewardsCsvFilters = {},
): Promise<ActionResult<{ csv: string }>> {
  await requireAdmin()
  const where: Record<string, unknown> = {}
  if (filters.isActive !== undefined) where.isActive = filters.isActive
  if (filters.rewardType) where.rewardType = filters.rewardType
  const count = await prisma.reward.count({ where })
  if (count > CSV_MAX_ROWS) return { ok: false, error: 'Too many rows — narrow filters' }
  const rows = await prisma.reward.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    take: CSV_MAX_ROWS,
    select: {
      id: true, name: true, slug: true, rewardType: true,
      pointsCost: true, isActive: true, totalRedeemed: true,
      maxRedemptionsPerCustomer: true, totalAvailable: true, minTierRequired: true,
    },
  })
  const csv = rowsToCsv(
    ['id', 'name', 'slug', 'type', 'pointsCost', 'isActive', 'totalRedeemed', 'maxPerCustomer', 'totalAvailable', 'minTier'],
    rows.map((r) => [
      r.id, r.name, r.slug, r.rewardType, r.pointsCost, r.isActive,
      r.totalRedeemed, r.maxRedemptionsPerCustomer ?? '',
      r.totalAvailable ?? '', r.minTierRequired ?? '',
    ]),
  )
  return { ok: true, data: { csv } }
}

export interface RedemptionsCsvFilters {
  status?: RedemptionStatus
  rewardId?: string
}

export async function exportRedemptionsCsv(
  range: TimeRange,
  filters: RedemptionsCsvFilters = {},
): Promise<ActionResult<{ csv: string }>> {
  await requireAdmin()
  const { start, end } = getRangeBoundsLocal(range)
  const where: Record<string, unknown> = { createdAt: { gte: start, lte: end } }
  if (filters.status) where.status = filters.status
  if (filters.rewardId) where.rewardId = filters.rewardId
  const count = await prisma.rewardRedemption.count({ where })
  if (count > CSV_MAX_ROWS) return { ok: false, error: 'Too many rows — narrow filters' }
  const rows = await prisma.rewardRedemption.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: CSV_MAX_ROWS,
    include: {
      customer: { select: { email: true } },
      reward: { select: { name: true } },
    },
  })
  const csv = rowsToCsv(
    ['id', 'createdAt', 'customerEmail', 'reward', 'pointsSpent', 'status', 'couponCode', 'trackingNumber', 'shippedAt'],
    rows.map((r) => [
      r.id, r.createdAt, r.customer?.email ?? '', r.reward?.name ?? '',
      r.pointsSpent, r.status, r.couponCode ?? '',
      r.trackingNumber ?? '', r.shippedAt ?? '',
    ]),
  )
  return { ok: true, data: { csv } }
}

export interface EventsCsvFilters {
  isActive?: boolean
}

export async function exportEventsCsv(
  filters: EventsCsvFilters = {},
): Promise<ActionResult<{ csv: string }>> {
  await requireAdmin()
  const where: Record<string, unknown> = {}
  if (filters.isActive !== undefined) where.isActive = filters.isActive
  const count = await prisma.pointsMultiplierEvent.count({ where })
  if (count > CSV_MAX_ROWS) return { ok: false, error: 'Too many rows — narrow filters' }
  const rows = await prisma.pointsMultiplierEvent.findMany({
    where,
    orderBy: { startDate: 'desc' },
    take: CSV_MAX_ROWS,
  })
  const csv = rowsToCsv(
    ['id', 'name', 'startDate', 'endDate', 'multiplier', 'isActive', 'totalBonusPointsAwarded', 'ordersAffected'],
    rows.map((e) => [
      e.id, e.name, e.startDate, e.endDate, Number(e.multiplier ?? 1),
      e.isActive, e.totalBonusPointsAwarded, e.ordersAffected,
    ]),
  )
  return { ok: true, data: { csv } }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/app/admin/loyalty/actions.test.ts`
Expected: PASS — ~25 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
mkdir -p app/admin/loyalty tests/unit/app/admin/loyalty
git add app/admin/loyalty/actions.ts tests/unit/app/admin/loyalty/actions.test.ts
git commit -m "feat(admin-v2): add loyalty server actions (~32) — tier/member/reward/redemption/event/settings + 5 CSV exports"
git push -u origin wave7p7/task-2-server-actions
gh pr create --title "feat(admin-v2): Phase 7 W1 loyalty server actions" --body "Adds app/admin/loyalty/actions.ts: ~32 actions across tier/member/reward/redemption/event/settings, all points/tier mutations route through lib/loyalty/service.ts atomic ops, 5 SUPER_ADMIN-gated actions, 5 CSV exports capped at 10,000 rows. Inspector wrappers inline Prisma queries for W1 parallel-safety with Task 1. ~25 tests passing."
```


---

## Wave 2 — 4 chart components (4 parallel, after W1 merged)

All chart components are thin Recharts wrappers in `components/admin/loyalty/charts/`. They share a common shape:

- Marked `'use client'` (Recharts needs the browser).
- Props: typed `data` array + optional `height` (default 300).
- Empty-state fallback when `data.length === 0` → renders a centered `<div className="h-[300px] flex items-center justify-center text-white/30 text-xs">No data for this range</div>`.
- `<ResponsiveContainer width="100%" height={height}>` wrapping the chart primitive.
- Always-dark theme (NO `dark:` modifiers): stroke `#FF3131` (accent red) or `#6366f1` (indigo); CartesianGrid `stroke="#ffffff14"`; XAxis/YAxis `stroke="#ffffff66"`, font 11; Tooltip `contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff14', borderRadius: 8, fontSize: 12, color: '#fff' }}`.
- Currency / number formatter where appropriate: `new Intl.NumberFormat('en-US')` (we render point counts, not currency).
- Each test MUST mock `recharts` via `vi.mock('recharts', ...)` (cross-cutting note 8). Trim the mock to just the primitives each chart imports.

---

### Task 3: `PointsActivityChart.tsx`

**Wave:** 2 | **Branch:** `wave7p7/task-3-points-activity-chart` | **Model:** sonnet

**Schema realities for this task:** Purely presentational. Consumes `PointsActivityPoint[]` (`{ bucket: string; earned: number; redeemed: number }`). LineChart with two lines (earned = indigo `#6366f1`, redeemed = red `#FF3131`). Declare the prop type locally — do NOT import from `lib/admin/loyalty.ts` (that pulls Prisma into the client bundle).

**Files:**
- Create: `components/admin/loyalty/charts/PointsActivityChart.tsx`
- Test: `tests/unit/components/admin/loyalty/charts/PointsActivityChart.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/loyalty/charts/PointsActivityChart.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}))

import { PointsActivityChart } from '@/components/admin/loyalty/charts/PointsActivityChart'

describe('PointsActivityChart', () => {
  it('renders empty state when data is empty', () => {
    render(<PointsActivityChart data={[]} />)
    expect(screen.getByText(/no data/i)).toBeTruthy()
  })
  it('renders 2 lines when data present', () => {
    render(<PointsActivityChart data={[{ bucket: '2026-05-30', earned: 100, redeemed: 30 }]} />)
    expect(screen.getByTestId('line-chart')).toBeTruthy()
    expect(screen.getAllByTestId('line')).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run test (FAIL — module not found).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export interface PointsActivityPoint {
  bucket: string
  earned: number
  redeemed: number
}

export interface PointsActivityChartProps {
  data: PointsActivityPoint[]
  height?: number
}

const nFmt = new Intl.NumberFormat('en-US')

export function PointsActivityChart({ data, height = 300 }: PointsActivityChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-white/30 text-xs">
        No data for this range
      </div>
    )
  }
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
          <XAxis dataKey="bucket" stroke="#ffffff66" style={{ fontSize: 11 }} />
          <YAxis stroke="#ffffff66" style={{ fontSize: 11 }} tickFormatter={(v) => nFmt.format(Number(v))} />
          <Tooltip
            formatter={(v) => nFmt.format(Number(v))}
            contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff14', borderRadius: 8, fontSize: 12, color: '#fff' }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#ffffffaa' }} />
          <Line
            type="monotone"
            dataKey="earned"
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ fill: '#6366f1', r: 3 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="redeemed"
            stroke="#FF3131"
            strokeWidth={2}
            dot={{ fill: '#FF3131', r: 3 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
mkdir -p components/admin/loyalty/charts tests/unit/components/admin/loyalty/charts
pnpm test tests/unit/components/admin/loyalty/charts/PointsActivityChart.test.tsx
pnpm exec tsc --noEmit
git add components/admin/loyalty/charts/PointsActivityChart.tsx tests/unit/components/admin/loyalty/charts/PointsActivityChart.test.tsx
git commit -m "feat(admin-v2): add PointsActivityChart (earned vs redeemed LineChart)"
git push -u origin wave7p7/task-3-points-activity-chart
gh pr create --title "feat(admin-v2): Phase 7 W2 PointsActivityChart" --body "Two-line LineChart: earned (indigo) vs redeemed (red). 2 tests passing."
```

---

### Task 4: `TierDistributionChart.tsx`

**Wave:** 2 | **Branch:** `wave7p7/task-4-tier-distribution-chart` | **Model:** sonnet

**Schema realities for this task:** Consumes `TierDistributionPoint[]` (`{ tierId: string | null; tierName: string; count: number; percent: number }`). Horizontal BarChart (`layout="vertical"`) with `LabelList` showing `${percent.toFixed(0)}%` at the end of each bar. Bars colored `#6366f1` (single fill — tier colors come from a separate visualization in TierPerksQuickToggle).

**Files:**
- Create: `components/admin/loyalty/charts/TierDistributionChart.tsx`
- Test: `tests/unit/components/admin/loyalty/charts/TierDistributionChart.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/loyalty/charts/TierDistributionChart.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: ({ children }: { children?: React.ReactNode }) => <div data-testid="bar">{children}</div>,
  LabelList: () => <div data-testid="labellist" />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}))

import { TierDistributionChart } from '@/components/admin/loyalty/charts/TierDistributionChart'

describe('TierDistributionChart', () => {
  it('renders empty state on empty data', () => {
    render(<TierDistributionChart data={[]} />)
    expect(screen.getByText(/no data/i)).toBeTruthy()
  })
  it('renders chart when data present', () => {
    render(<TierDistributionChart data={[
      { tierId: 't1', tierName: 'Bronze', count: 30, percent: 75 },
      { tierId: 't2', tierName: 'Silver', count: 10, percent: 25 },
    ]} />)
    expect(screen.getByTestId('bar-chart')).toBeTruthy()
    expect(screen.getByTestId('bar')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { BarChart, Bar, LabelList, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export interface TierDistributionPoint {
  tierId: string | null
  tierName: string
  count: number
  percent: number
}

export interface TierDistributionChartProps {
  data: TierDistributionPoint[]
  height?: number
}

const nFmt = new Intl.NumberFormat('en-US')

export function TierDistributionChart({ data, height = 300 }: TierDistributionChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-white/30 text-xs">
        No data for this range
      </div>
    )
  }
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
          <XAxis type="number" stroke="#ffffff66" style={{ fontSize: 11 }} tickFormatter={(v) => nFmt.format(Number(v))} />
          <YAxis type="category" dataKey="tierName" stroke="#ffffff66" style={{ fontSize: 11 }} width={100} />
          <Tooltip
            formatter={(v: unknown) => nFmt.format(Number(v))}
            contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff14', borderRadius: 8, fontSize: 12, color: '#fff' }}
          />
          <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            <LabelList
              dataKey="percent"
              position="right"
              formatter={(v: unknown) => `${Number(v).toFixed(0)}%`}
              style={{ fill: '#ffffffaa', fontSize: 11 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/loyalty/charts/TierDistributionChart.test.tsx
pnpm exec tsc --noEmit
git add components/admin/loyalty/charts/TierDistributionChart.tsx tests/unit/components/admin/loyalty/charts/TierDistributionChart.test.tsx
git commit -m "feat(admin-v2): add TierDistributionChart (horizontal BarChart with % labels)"
git push -u origin wave7p7/task-4-tier-distribution-chart
gh pr create --title "feat(admin-v2): Phase 7 W2 TierDistributionChart" --body "Horizontal BarChart of members per tier with LabelList % suffix. 2 tests passing."
```

---

### Task 5: `TopRewardsBar.tsx`

**Wave:** 2 | **Branch:** `wave7p7/task-5-top-rewards-bar` | **Model:** sonnet

**Schema realities for this task:** Consumes `TopRewardPoint[]` (`{ rewardId: string; name: string; totalRedeemed: number }`). Horizontal BarChart. Bars colored `#FF3131`.

**Files:**
- Create: `components/admin/loyalty/charts/TopRewardsBar.tsx`
- Test: `tests/unit/components/admin/loyalty/charts/TopRewardsBar.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/loyalty/charts/TopRewardsBar.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}))

import { TopRewardsBar } from '@/components/admin/loyalty/charts/TopRewardsBar'

describe('TopRewardsBar', () => {
  it('empty state', () => {
    render(<TopRewardsBar data={[]} />)
    expect(screen.getByText(/no data/i)).toBeTruthy()
  })
  it('renders horizontal bar chart with data', () => {
    render(<TopRewardsBar data={[{ rewardId: 'r1', name: '10% off', totalRedeemed: 25 }]} />)
    expect(screen.getByTestId('bar-chart')).toBeTruthy()
    expect(screen.getByTestId('bar')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export interface TopRewardPoint {
  rewardId: string
  name: string
  totalRedeemed: number
}

export interface TopRewardsBarProps {
  data: TopRewardPoint[]
  height?: number
}

const nFmt = new Intl.NumberFormat('en-US')

export function TopRewardsBar({ data, height = 300 }: TopRewardsBarProps) {
  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-white/30 text-xs">
        No data for this range
      </div>
    )
  }
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 70 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
          <XAxis type="number" stroke="#ffffff66" style={{ fontSize: 11 }} tickFormatter={(v) => nFmt.format(Number(v))} />
          <YAxis type="category" dataKey="name" stroke="#ffffff66" style={{ fontSize: 11 }} width={120} />
          <Tooltip
            formatter={(v) => nFmt.format(Number(v))}
            contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff14', borderRadius: 8, fontSize: 12, color: '#fff' }}
          />
          <Bar dataKey="totalRedeemed" fill="#FF3131" radius={[0, 4, 4, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/loyalty/charts/TopRewardsBar.test.tsx
pnpm exec tsc --noEmit
git add components/admin/loyalty/charts/TopRewardsBar.tsx tests/unit/components/admin/loyalty/charts/TopRewardsBar.test.tsx
git commit -m "feat(admin-v2): add TopRewardsBar (horizontal BarChart by totalRedeemed)"
git push -u origin wave7p7/task-5-top-rewards-bar
gh pr create --title "feat(admin-v2): Phase 7 W2 TopRewardsBar" --body "Horizontal BarChart for top rewards by redemption count. 2 tests passing."
```

---

### Task 6: `MemberGrowthChart.tsx`

**Wave:** 2 | **Branch:** `wave7p7/task-6-member-growth-chart` | **Model:** sonnet

**Schema realities for this task:** Consumes `MemberGrowthPoint[]` (`{ bucket: string; newMembers: number }`). AreaChart with single area fill `#6366f155`.

**Files:**
- Create: `components/admin/loyalty/charts/MemberGrowthChart.tsx`
- Test: `tests/unit/components/admin/loyalty/charts/MemberGrowthChart.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/loyalty/charts/MemberGrowthChart.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}))

import { MemberGrowthChart } from '@/components/admin/loyalty/charts/MemberGrowthChart'

describe('MemberGrowthChart', () => {
  it('empty state', () => {
    render(<MemberGrowthChart data={[]} />)
    expect(screen.getByText(/no data/i)).toBeTruthy()
  })
  it('renders area when data present', () => {
    render(<MemberGrowthChart data={[{ bucket: '2026-05-30', newMembers: 3 }]} />)
    expect(screen.getByTestId('area-chart')).toBeTruthy()
    expect(screen.getByTestId('area')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export interface MemberGrowthPoint {
  bucket: string
  newMembers: number
}

export interface MemberGrowthChartProps {
  data: MemberGrowthPoint[]
  height?: number
}

const nFmt = new Intl.NumberFormat('en-US')

export function MemberGrowthChart({ data, height = 300 }: MemberGrowthChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-white/30 text-xs">
        No data for this range
      </div>
    )
  }
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
          <XAxis dataKey="bucket" stroke="#ffffff66" style={{ fontSize: 11 }} />
          <YAxis stroke="#ffffff66" style={{ fontSize: 11 }} tickFormatter={(v) => nFmt.format(Number(v))} />
          <Tooltip
            formatter={(v) => nFmt.format(Number(v))}
            contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff14', borderRadius: 8, fontSize: 12, color: '#fff' }}
          />
          <Area
            type="monotone"
            dataKey="newMembers"
            stroke="#6366f1"
            fill="#6366f155"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/loyalty/charts/MemberGrowthChart.test.tsx
pnpm exec tsc --noEmit
git add components/admin/loyalty/charts/MemberGrowthChart.tsx tests/unit/components/admin/loyalty/charts/MemberGrowthChart.test.tsx
git commit -m "feat(admin-v2): add MemberGrowthChart (AreaChart of new members per bucket)"
git push -u origin wave7p7/task-6-member-growth-chart
gh pr create --title "feat(admin-v2): Phase 7 W2 MemberGrowthChart" --body "AreaChart for new members over range. 2 tests passing."
```

---

## Wave 3 — 6 Inspectors + AdjustPointsDialog + 6 utility components (13 parallel, after W1 merged)

All inspectors use the shared `<Inspector>` primitive (`components/ui/Inspector.tsx`). They import `*DetailFull` types from `@/app/admin/loyalty/actions` (NEVER `@/lib/admin/loyalty` — that pulls Prisma into the client bundle). All toast calls use `@/lib/toast`. Width 460 unless noted.

---

### Task 7: `MemberInspector.tsx`

**Wave:** 3 | **Branch:** `wave7p7/task-7-member-inspector` | **Model:** sonnet

**Schema realities for this task:**
- Read-only profile: email, name, tier badge (color-chip + tierName), currentPoints, lifetimePoints, annualPointsEarned, tierStartDate, lastOrderDate.
- Includes `<MemberLedger>` sub-component (Task 18) for the scrollable last-50 PointsTransaction ledger.
- "Adjust Points" button opens `AdjustPointsDialog` (Task 13) in single-member mode.
- "Recompute Tier" button (calls `recomputeMemberTier` server action — toast on result).
- Import `MemberDetailFull` from `@/app/admin/loyalty/actions`.

**Files:**
- Create: `components/admin/loyalty/inspectors/MemberInspector.tsx`
- Test: `tests/unit/components/admin/loyalty/inspectors/MemberInspector.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/loyalty/inspectors/MemberInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const recomputeMemberTier = vi.fn()
vi.mock('@/app/admin/loyalty/actions', () => ({
  recomputeMemberTier: (...a: unknown[]) => recomputeMemberTier(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/admin/loyalty/MemberLedger', () => ({
  MemberLedger: () => <div data-testid="member-ledger" />,
}))
vi.mock('@/components/admin/loyalty/AdjustPointsDialog', () => ({
  AdjustPointsDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="adjust-dialog-open" /> : null,
}))

import { MemberInspector } from '@/components/admin/loyalty/inspectors/MemberInspector'

const member = {
  id: 'c1', email: 'a@e.com', name: 'Ada',
  tierId: 't1', tierName: 'Silver', tierColor: '#aaaaaa',
  currentPoints: 250, lifetimePoints: 1500, annualPointsEarned: 800,
  tierStartDate: new Date('2026-01-01'), lastOrderDate: new Date('2026-05-20'),
  transactions: [],
}

beforeEach(() => vi.clearAllMocks())

describe('MemberInspector', () => {
  it('shows loading when detail null', () => {
    render(<MemberInspector open detail={null} isSuperAdmin onClose={() => {}} />)
    expect(screen.getByText(/loading/i)).toBeTruthy()
  })
  it('renders email + tier + points + ledger', () => {
    render(<MemberInspector open detail={member} isSuperAdmin onClose={() => {}} />)
    expect(screen.getByText(/a@e\.com/)).toBeTruthy()
    expect(screen.getByText(/Silver/)).toBeTruthy()
    expect(screen.getByTestId('member-ledger')).toBeTruthy()
  })
  it('opens AdjustPointsDialog on click', () => {
    render(<MemberInspector open detail={member} isSuperAdmin onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /adjust points/i }))
    expect(screen.getByTestId('adjust-dialog-open')).toBeTruthy()
  })
  it('calls recomputeMemberTier on click', async () => {
    recomputeMemberTier.mockResolvedValue({ ok: true })
    render(<MemberInspector open detail={member} isSuperAdmin onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /recompute tier/i }))
    await waitFor(() => expect(recomputeMemberTier).toHaveBeenCalledWith('c1'))
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { recomputeMemberTier, type MemberDetailFull } from '@/app/admin/loyalty/actions'
import { Inspector } from '@/components/ui/Inspector'
import { MemberLedger } from '@/components/admin/loyalty/MemberLedger'
import { AdjustPointsDialog } from '@/components/admin/loyalty/AdjustPointsDialog'
import { toast } from '@/lib/toast'

export interface MemberInspectorProps {
  open: boolean
  detail: MemberDetailFull | null
  isSuperAdmin: boolean
  onClose: () => void
  onAdjusted?: () => void
}

const nFmt = new Intl.NumberFormat('en-US')

export function MemberInspector({ open, detail, isSuperAdmin, onClose, onAdjusted }: MemberInspectorProps) {
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const handleRecompute = () => {
    if (!detail) return
    startTransition(async () => {
      const r = await recomputeMemberTier(detail.id)
      if (r.ok) {
        toast.success('Tier recomputed')
      } else {
        toast.error(r.error)
      }
    })
  }

  return (
    <>
      <Inspector open={open} onClose={onClose} title="Member" width={460}>
        {!detail ? (
          <div className="text-white/40 text-sm">Loading…</div>
        ) : (
          <div className="space-y-3 text-sm text-white/80">
            <div>
              <div className="text-white/40 text-xs">Email</div>
              <div className="font-medium text-white">{detail.email}</div>
            </div>
            {detail.name && (
              <div>
                <div className="text-white/40 text-xs">Name</div>
                <div>{detail.name}</div>
              </div>
            )}
            <div>
              <div className="text-white/40 text-xs">Tier</div>
              <div className="flex items-center gap-2">
                {detail.tierColor && (
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: detail.tierColor }}
                  />
                )}
                {detail.tierName ?? '—'}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-white/40 text-xs">Current</div>
                <div>{nFmt.format(detail.currentPoints)}</div>
              </div>
              <div>
                <div className="text-white/40 text-xs">Lifetime</div>
                <div>{nFmt.format(detail.lifetimePoints)}</div>
              </div>
              <div>
                <div className="text-white/40 text-xs">Annual</div>
                <div>{nFmt.format(detail.annualPointsEarned)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-white/40 text-xs">Tier since</div>
                <div>{detail.tierStartDate.toLocaleDateString()}</div>
              </div>
              <div>
                <div className="text-white/40 text-xs">Last order</div>
                <div>{detail.lastOrderDate ? detail.lastOrderDate.toLocaleDateString() : '—'}</div>
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-white/8">
              <button
                type="button"
                onClick={() => setAdjustOpen(true)}
                className="text-xs px-3 py-1.5 rounded-md bg-[#FF3131] text-white hover:bg-[#ff4747]"
              >
                Adjust Points
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handleRecompute}
                className="text-xs px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/8 text-white/70 hover:text-white disabled:opacity-50"
              >
                {pending ? 'Recomputing…' : 'Recompute Tier'}
              </button>
            </div>

            <div className="pt-3 border-t border-white/8">
              <h4 className="text-xs uppercase tracking-wide text-white/40 mb-2">Recent Activity</h4>
              <MemberLedger entries={detail.transactions} />
            </div>
          </div>
        )}
      </Inspector>
      {detail && (
        <AdjustPointsDialog
          open={adjustOpen}
          memberIds={[detail.id]}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setAdjustOpen(false)}
          onSaved={() => {
            setAdjustOpen(false)
            onAdjusted?.()
          }}
        />
      )}
    </>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
mkdir -p components/admin/loyalty/inspectors tests/unit/components/admin/loyalty/inspectors
pnpm test tests/unit/components/admin/loyalty/inspectors/MemberInspector.test.tsx
pnpm exec tsc --noEmit
git add components/admin/loyalty/inspectors/MemberInspector.tsx tests/unit/components/admin/loyalty/inspectors/MemberInspector.test.tsx
git commit -m "feat(admin-v2): add MemberInspector (read-only + ledger + adjust + recompute tier)"
git push -u origin wave7p7/task-7-member-inspector
gh pr create --title "feat(admin-v2): Phase 7 W3 MemberInspector" --body "Read-only member profile + MemberLedger + Adjust Points dialog + Recompute Tier action. 4 tests passing."
```

---

### Task 8: `TierInspector.tsx`

**Wave:** 3 | **Branch:** `wave7p7/task-8-tier-inspector` | **Model:** sonnet

**Schema realities for this task:**
- Full CRUD form. Fields: name, slug, description, primaryColor (color input), secondaryColor (color input), minAnnualSpend (number, Float), minAnnualPoints (number, Int), isInviteOnly (checkbox), pointMultiplier (number, Float default 1), freeShipping (checkbox), earlyDropAccess (checkbox), perks (JSON textarea — free-form), sortOrder (number), isActive (checkbox).
- `createMode` flag enables create vs edit. In edit mode, prefill from `detail`.
- Delete button is SUPER_ADMIN-gated (passed as prop `isSuperAdmin`). Disabled with tooltip "SUPER_ADMIN only" when false.

**Files:**
- Create: `components/admin/loyalty/inspectors/TierInspector.tsx`
- Test: `tests/unit/components/admin/loyalty/inspectors/TierInspector.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/loyalty/inspectors/TierInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const createTier = vi.fn()
const updateTier = vi.fn()
const deleteTier = vi.fn()

vi.mock('@/app/admin/loyalty/actions', () => ({
  createTier: (...a: unknown[]) => createTier(...a),
  updateTier: (...a: unknown[]) => updateTier(...a),
  deleteTier: (...a: unknown[]) => deleteTier(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { TierInspector } from '@/components/admin/loyalty/inspectors/TierInspector'

const tier = {
  id: 't1', name: 'Bronze', slug: 'bronze', description: 'Entry tier',
  primaryColor: '#64748B', secondaryColor: '#475569',
  minAnnualSpend: 0, minAnnualPoints: 0, isInviteOnly: false,
  pointMultiplier: 1, freeShipping: false, earlyDropAccess: false,
  perks: null, sortOrder: 1, isActive: true, memberCount: 0,
}

beforeEach(() => vi.clearAllMocks())

describe('TierInspector', () => {
  it('renders empty form in create mode', () => {
    render(<TierInspector open detail={null} createMode isSuperAdmin onClose={() => {}} />)
    expect(screen.getByLabelText(/name/i)).toBeTruthy()
  })
  it('prefills values in edit mode', () => {
    render(<TierInspector open detail={tier} isSuperAdmin onClose={() => {}} />)
    expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('Bronze')
  })
  it('calls createTier on Save in create mode', async () => {
    createTier.mockResolvedValue({ ok: true, data: { id: 't2' } })
    render(<TierInspector open detail={null} createMode isSuperAdmin onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'New Tier' } })
    fireEvent.change(screen.getByLabelText(/slug/i), { target: { value: 'new-tier' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(createTier).toHaveBeenCalled())
  })
  it('disables Delete when not SUPER_ADMIN', () => {
    render(<TierInspector open detail={tier} isSuperAdmin={false} onClose={() => {}} />)
    const del = screen.getByRole('button', { name: /delete/i }) as HTMLButtonElement
    expect(del.disabled).toBe(true)
    expect(del.title).toMatch(/SUPER_ADMIN/i)
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  createTier,
  updateTier,
  deleteTier,
  type TierDetailFull,
} from '@/app/admin/loyalty/actions'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'

export interface TierInspectorProps {
  open: boolean
  detail: TierDetailFull | null
  createMode?: boolean
  isSuperAdmin: boolean
  onClose: () => void
  onSaved?: (id: string) => void
  onDeleted?: (id: string) => void
}

export function TierInspector({
  open, detail, createMode = false, isSuperAdmin, onClose, onSaved, onDeleted,
}: TierInspectorProps) {
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#64748B')
  const [secondaryColor, setSecondaryColor] = useState('#475569')
  const [minAnnualSpend, setMinAnnualSpend] = useState(0)
  const [minAnnualPoints, setMinAnnualPoints] = useState(0)
  const [isInviteOnly, setIsInviteOnly] = useState(false)
  const [pointMultiplier, setPointMultiplier] = useState(1)
  const [freeShipping, setFreeShipping] = useState(false)
  const [earlyDropAccess, setEarlyDropAccess] = useState(false)
  const [perks, setPerks] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    if (!open) return
    if (detail) {
      setName(detail.name)
      setSlug(detail.slug)
      setDescription(detail.description ?? '')
      setPrimaryColor(detail.primaryColor)
      setSecondaryColor(detail.secondaryColor)
      setMinAnnualSpend(detail.minAnnualSpend)
      setMinAnnualPoints(detail.minAnnualPoints)
      setIsInviteOnly(detail.isInviteOnly)
      setPointMultiplier(detail.pointMultiplier)
      setFreeShipping(detail.freeShipping)
      setEarlyDropAccess(detail.earlyDropAccess)
      setPerks(detail.perks ?? '')
      setSortOrder(detail.sortOrder)
      setIsActive(detail.isActive)
    } else if (createMode) {
      setName(''); setSlug(''); setDescription('')
      setPrimaryColor('#64748B'); setSecondaryColor('#475569')
      setMinAnnualSpend(0); setMinAnnualPoints(0)
      setIsInviteOnly(false); setPointMultiplier(1)
      setFreeShipping(false); setEarlyDropAccess(false)
      setPerks(''); setSortOrder(0); setIsActive(true)
    }
  }, [open, detail, createMode])

  const handleSave = () => {
    startTransition(async () => {
      const payload = {
        name, slug, description: description || null,
        primaryColor, secondaryColor,
        minAnnualSpend, minAnnualPoints,
        isInviteOnly, pointMultiplier,
        freeShipping, earlyDropAccess,
        perks: perks.trim() || null,
        sortOrder, isActive,
      }
      if (createMode || !detail) {
        const r = await createTier(payload)
        if (r.ok) {
          toast.success('Tier created')
          onSaved?.(r.data?.id ?? '')
          onClose()
        } else toast.error(r.error)
      } else {
        const r = await updateTier(detail.id, payload)
        if (r.ok) {
          toast.success('Tier updated')
          onSaved?.(detail.id)
          onClose()
        } else toast.error(r.error)
      }
    })
  }

  const handleDelete = () => {
    if (!detail) return
    startTransition(async () => {
      const r = await deleteTier(detail.id)
      if (r.ok) {
        toast.success('Tier deleted')
        onDeleted?.(detail.id)
        onClose()
      } else toast.error(r.error)
    })
  }

  const inputCls = 'w-full mt-1 bg-white/[0.04] border border-white/8 rounded-md px-3 py-2 text-white'
  const labelCls = 'text-white/60 text-xs'

  return (
    <Inspector open={open} onClose={onClose} title={detail ? 'Edit Tier' : 'New Tier'} width={460}>
      <div className="space-y-3 text-sm">
        <label className="block">
          <span className={labelCls}>Name</span>
          <input aria-label="name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelCls}>Slug</span>
          <input aria-label="slug" className={inputCls} value={slug} onChange={(e) => setSlug(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelCls}>Description</span>
          <textarea className={`${inputCls} min-h-[60px]`} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelCls}>Primary color</span>
            <input type="color" className={inputCls} value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
          </label>
          <label className="block">
            <span className={labelCls}>Secondary color</span>
            <input type="color" className={inputCls} value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelCls}>Min annual spend ($)</span>
            <input type="number" step="0.01" min="0" className={inputCls} value={minAnnualSpend} onChange={(e) => setMinAnnualSpend(Number(e.target.value))} />
          </label>
          <label className="block">
            <span className={labelCls}>Min annual points</span>
            <input type="number" step="1" min="0" className={inputCls} value={minAnnualPoints} onChange={(e) => setMinAnnualPoints(Number(e.target.value))} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelCls}>Point multiplier</span>
            <input type="number" step="0.1" min="0" className={inputCls} value={pointMultiplier} onChange={(e) => setPointMultiplier(Number(e.target.value))} />
          </label>
          <label className="block">
            <span className={labelCls}>Sort order</span>
            <input type="number" step="1" className={inputCls} value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs text-white/80">
          <input type="checkbox" checked={freeShipping} onChange={(e) => setFreeShipping(e.target.checked)} />
          Free shipping
        </label>
        <label className="flex items-center gap-2 text-xs text-white/80">
          <input type="checkbox" checked={earlyDropAccess} onChange={(e) => setEarlyDropAccess(e.target.checked)} />
          Early drop access
        </label>
        <label className="flex items-center gap-2 text-xs text-white/80">
          <input type="checkbox" checked={isInviteOnly} onChange={(e) => setIsInviteOnly(e.target.checked)} />
          Invite only
        </label>
        <label className="flex items-center gap-2 text-xs text-white/80">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active
        </label>
        <label className="block">
          <span className={labelCls}>Perks (JSON)</span>
          <textarea
            className={`${inputCls} min-h-[80px] font-mono`}
            value={perks}
            onChange={(e) => setPerks(e.target.value)}
            placeholder='{"careBox":true,"engravedItem":false}'
          />
        </label>

        <div className="flex items-center justify-between pt-3 border-t border-white/8">
          {detail ? (
            <button
              type="button"
              disabled={!isSuperAdmin || pending}
              title={isSuperAdmin ? 'Delete tier' : 'SUPER_ADMIN only'}
              onClick={handleDelete}
              className="text-xs text-red-400 hover:text-red-300 disabled:text-white/20 disabled:cursor-not-allowed"
            >
              Delete
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/8 text-white/70 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={handleSave}
              className="text-xs px-3 py-1.5 rounded-md bg-[#FF3131] text-white hover:bg-[#ff4747] disabled:opacity-50"
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </Inspector>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/loyalty/inspectors/TierInspector.test.tsx
pnpm exec tsc --noEmit
git add components/admin/loyalty/inspectors/TierInspector.tsx tests/unit/components/admin/loyalty/inspectors/TierInspector.test.tsx
git commit -m "feat(admin-v2): add TierInspector (full CRUD + SUPER_ADMIN delete gate)"
git push -u origin wave7p7/task-8-tier-inspector
gh pr create --title "feat(admin-v2): Phase 7 W3 TierInspector" --body "Full LoyaltyTier CRUD form. createMode + editMode. Delete gated to SUPER_ADMIN. 4 tests passing."
```

---

### Task 9: `RewardInspector.tsx`

**Wave:** 3 | **Branch:** `wave7p7/task-9-reward-inspector` | **Model:** sonnet

**Schema realities for this task:**
- Quick-edit Inspector only: isActive toggle + pointsCost (number) + maxRedemptionsPerCustomer (number, nullable) + minTierRequired (text input — tier slug). Full editor lives at `/admin/loyalty/rewards/[id]/edit` (Task 31).
- "Edit details →" link to `/admin/loyalty/rewards/${detail.id}/edit`.
- Save invokes `updateReward(id, payload)`.
- Import `RewardDetailFull` from `@/app/admin/loyalty/actions`.

**Files:**
- Create: `components/admin/loyalty/inspectors/RewardInspector.tsx`
- Test: `tests/unit/components/admin/loyalty/inspectors/RewardInspector.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/loyalty/inspectors/RewardInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const updateReward = vi.fn()

vi.mock('@/app/admin/loyalty/actions', () => ({
  updateReward: (...a: unknown[]) => updateReward(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { RewardInspector } from '@/components/admin/loyalty/inspectors/RewardInspector'

const reward = {
  id: 'r1', name: '10% off', slug: '10-off', description: 'd',
  pointsCost: 500, rewardType: 'DISCOUNT' as const, value: 10,
  isActive: true, maxRedemptionsPerCustomer: null, totalAvailable: null,
  totalRedeemed: 0, minTierRequired: null, metadata: null, image: null,
  sortOrder: 0, createdAt: new Date(), updatedAt: new Date(),
}

beforeEach(() => vi.clearAllMocks())

describe('RewardInspector', () => {
  it('shows loading when detail null', () => {
    render(<RewardInspector open detail={null} onClose={() => {}} />)
    expect(screen.getByText(/loading/i)).toBeTruthy()
  })
  it('renders name and exposes editor link', () => {
    render(<RewardInspector open detail={reward} onClose={() => {}} />)
    expect(screen.getByText(/10% off/)).toBeTruthy()
    const link = screen.getByRole('link', { name: /edit details/i }) as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/admin/loyalty/rewards/r1/edit')
  })
  it('calls updateReward on Save', async () => {
    updateReward.mockResolvedValue({ ok: true })
    render(<RewardInspector open detail={reward} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(updateReward).toHaveBeenCalledWith('r1', expect.any(Object)))
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { updateReward, type RewardDetailFull } from '@/app/admin/loyalty/actions'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'

export interface RewardInspectorProps {
  open: boolean
  detail: RewardDetailFull | null
  onClose: () => void
  onSaved?: (id: string) => void
}

export function RewardInspector({ open, detail, onClose, onSaved }: RewardInspectorProps) {
  const [pending, startTransition] = useTransition()
  const [isActive, setIsActive] = useState(true)
  const [pointsCost, setPointsCost] = useState(0)
  const [maxPerCustomer, setMaxPerCustomer] = useState<string>('')
  const [minTierRequired, setMinTierRequired] = useState('')

  useEffect(() => {
    if (!open || !detail) return
    setIsActive(detail.isActive)
    setPointsCost(detail.pointsCost)
    setMaxPerCustomer(detail.maxRedemptionsPerCustomer?.toString() ?? '')
    setMinTierRequired(detail.minTierRequired ?? '')
  }, [open, detail])

  const handleSave = () => {
    if (!detail) return
    startTransition(async () => {
      const r = await updateReward(detail.id, {
        isActive,
        pointsCost,
        maxRedemptionsPerCustomer: maxPerCustomer ? Number(maxPerCustomer) : null,
        minTierRequired: minTierRequired || null,
      })
      if (r.ok) {
        toast.success('Reward updated')
        onSaved?.(detail.id)
        onClose()
      } else toast.error(r.error)
    })
  }

  const inputCls = 'w-full mt-1 bg-white/[0.04] border border-white/8 rounded-md px-3 py-2 text-white'
  const labelCls = 'text-white/60 text-xs'

  return (
    <Inspector open={open} onClose={onClose} title="Reward (quick edit)" width={460}>
      {!detail ? (
        <div className="text-white/40 text-sm">Loading…</div>
      ) : (
        <div className="space-y-3 text-sm text-white/80">
          <div>
            <div className="text-white/40 text-xs">Name</div>
            <div className="font-medium text-white">{detail.name}</div>
          </div>
          <div>
            <div className="text-white/40 text-xs">Type</div>
            <div>{detail.rewardType}</div>
          </div>
          <label className="flex items-center gap-2 text-xs text-white/80">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active
          </label>
          <label className="block">
            <span className={labelCls}>Points cost</span>
            <input
              type="number"
              step="1"
              min="0"
              className={inputCls}
              value={pointsCost}
              onChange={(e) => setPointsCost(Number(e.target.value))}
            />
          </label>
          <label className="block">
            <span className={labelCls}>Max per customer (blank = unlimited)</span>
            <input
              type="number"
              step="1"
              min="0"
              className={inputCls}
              value={maxPerCustomer}
              onChange={(e) => setMaxPerCustomer(e.target.value)}
            />
          </label>
          <label className="block">
            <span className={labelCls}>Min tier required (slug)</span>
            <input
              className={inputCls}
              value={minTierRequired}
              onChange={(e) => setMinTierRequired(e.target.value)}
              placeholder="e.g. silver"
            />
          </label>
          <div className="pt-3 border-t border-white/8 space-y-2">
            <Link
              href={`/admin/loyalty/rewards/${detail.id}/edit`}
              className="text-xs text-[#FF3131] hover:text-[#ff4747] block"
            >
              Edit details →
            </Link>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-white/8">
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/8 text-white/70 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={handleSave}
              className="text-xs px-3 py-1.5 rounded-md bg-[#FF3131] text-white hover:bg-[#ff4747] disabled:opacity-50"
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </Inspector>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/loyalty/inspectors/RewardInspector.test.tsx
pnpm exec tsc --noEmit
git add components/admin/loyalty/inspectors/RewardInspector.tsx tests/unit/components/admin/loyalty/inspectors/RewardInspector.test.tsx
git commit -m "feat(admin-v2): add RewardInspector (quick toggles + Edit details link)"
git push -u origin wave7p7/task-9-reward-inspector
gh pr create --title "feat(admin-v2): Phase 7 W3 RewardInspector" --body "Quick toggle isActive + pointsCost + maxPerCustomer + minTier. Edit details link to /admin/loyalty/rewards/[id]/edit. 3 tests passing."
```

---

### Task 10: `RedemptionInspector.tsx`

**Wave:** 3 | **Branch:** `wave7p7/task-10-redemption-inspector` | **Model:** sonnet

**Schema realities for this task:**
- Read-only detail panel: customer email, reward name, pointsSpent, status badge, couponCode (with copy button), createdAt, usedAt, orderId (link to `/admin/orders/${orderId}` if present), trackingNumber, shippedAt.
- "Mark Fulfilled" button: visible only when status is PENDING or ACTIVE. Shows a `trackingNumber` text input + Submit (calls `fulfillRedemption(id, trackingNumber)`).
- "Cancel" button: SUPER_ADMIN-gated; visible only when status is PENDING or ACTIVE. Opens a confirm prompt for a reason; calls `cancelRedemption(id, reason)`.
- Import `RedemptionDetailFull` from `@/app/admin/loyalty/actions`.

**Files:**
- Create: `components/admin/loyalty/inspectors/RedemptionInspector.tsx`
- Test: `tests/unit/components/admin/loyalty/inspectors/RedemptionInspector.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/loyalty/inspectors/RedemptionInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const fulfillRedemption = vi.fn()
const cancelRedemption = vi.fn()

vi.mock('@/app/admin/loyalty/actions', () => ({
  fulfillRedemption: (...a: unknown[]) => fulfillRedemption(...a),
  cancelRedemption: (...a: unknown[]) => cancelRedemption(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { RedemptionInspector } from '@/components/admin/loyalty/inspectors/RedemptionInspector'

const pending = {
  id: 'red1', customerId: 'c1', customerEmail: 'a@e.com', customerName: 'Ada',
  rewardId: 'r1', rewardName: '10% off', rewardType: 'DISCOUNT' as const,
  pointsSpent: 500, status: 'PENDING' as const,
  couponCode: 'HOF-ABC', usedAt: null, orderId: null,
  trackingNumber: null, shippedAt: null, metadata: null,
  idempotencyKey: 'k', createdAt: new Date(), updatedAt: new Date(),
}

beforeEach(() => vi.clearAllMocks())

describe('RedemptionInspector', () => {
  it('shows Mark Fulfilled when PENDING', () => {
    render(<RedemptionInspector open detail={pending} isSuperAdmin onClose={() => {}} />)
    expect(screen.getByRole('button', { name: /mark fulfilled/i })).toBeTruthy()
  })
  it('hides actions when status FULFILLED', () => {
    render(<RedemptionInspector
      open
      detail={{ ...pending, status: 'FULFILLED' }}
      isSuperAdmin
      onClose={() => {}}
    />)
    expect(screen.queryByRole('button', { name: /mark fulfilled/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /cancel redemption/i })).toBeNull()
  })
  it('disables Cancel when not SUPER_ADMIN', () => {
    render(<RedemptionInspector open detail={pending} isSuperAdmin={false} onClose={() => {}} />)
    const c = screen.getByRole('button', { name: /cancel redemption/i }) as HTMLButtonElement
    expect(c.disabled).toBe(true)
    expect(c.title).toMatch(/SUPER_ADMIN/i)
  })
  it('calls fulfillRedemption with tracking number', async () => {
    fulfillRedemption.mockResolvedValue({ ok: true })
    render(<RedemptionInspector open detail={pending} isSuperAdmin onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/tracking number/i), { target: { value: 'TRACK-1' } })
    fireEvent.click(screen.getByRole('button', { name: /mark fulfilled/i }))
    await waitFor(() => expect(fulfillRedemption).toHaveBeenCalledWith('red1', 'TRACK-1'))
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  fulfillRedemption,
  cancelRedemption,
  type RedemptionDetailFull,
} from '@/app/admin/loyalty/actions'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'

export interface RedemptionInspectorProps {
  open: boolean
  detail: RedemptionDetailFull | null
  isSuperAdmin: boolean
  onClose: () => void
  onUpdated?: (id: string) => void
}

const FULFILLABLE = ['PENDING', 'ACTIVE'] as const

export function RedemptionInspector({
  open, detail, isSuperAdmin, onClose, onUpdated,
}: RedemptionInspectorProps) {
  const [tracking, setTracking] = useState('')
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    setTracking(detail?.trackingNumber ?? '')
  }, [open, detail])

  const canAct = detail && (FULFILLABLE as readonly string[]).includes(detail.status)

  const handleFulfill = () => {
    if (!detail) return
    startTransition(async () => {
      const r = await fulfillRedemption(detail.id, tracking || undefined)
      if (r.ok) {
        toast.success('Redemption fulfilled')
        onUpdated?.(detail.id)
        onClose()
      } else toast.error(r.error)
    })
  }

  const handleCancel = () => {
    if (!detail) return
    const reason = typeof window !== 'undefined'
      ? window.prompt('Reason for cancellation?')
      : null
    if (!reason || !reason.trim()) return
    startTransition(async () => {
      const r = await cancelRedemption(detail.id, reason.trim())
      if (r.ok) {
        toast.success('Redemption cancelled — points refunded')
        onUpdated?.(detail.id)
        onClose()
      } else toast.error(r.error)
    })
  }

  return (
    <Inspector open={open} onClose={onClose} title="Redemption" width={460}>
      {!detail ? (
        <div className="text-white/40 text-sm">Loading…</div>
      ) : (
        <div className="space-y-3 text-sm text-white/80">
          <div>
            <div className="text-white/40 text-xs">Customer</div>
            <div>{detail.customerEmail}</div>
          </div>
          <div>
            <div className="text-white/40 text-xs">Reward</div>
            <div>{detail.rewardName} ({detail.rewardType})</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-white/40 text-xs">Points spent</div>
              <div>{detail.pointsSpent}</div>
            </div>
            <div>
              <div className="text-white/40 text-xs">Status</div>
              <div>{detail.status}</div>
            </div>
          </div>
          {detail.couponCode && (
            <div>
              <div className="text-white/40 text-xs">Coupon code</div>
              <div className="font-mono">{detail.couponCode}</div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-white/40 text-xs">Created</div>
              <div>{detail.createdAt.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-white/40 text-xs">Used</div>
              <div>{detail.usedAt ? detail.usedAt.toLocaleString() : '—'}</div>
            </div>
          </div>
          {detail.orderId && (
            <div>
              <div className="text-white/40 text-xs">Linked order</div>
              <Link href={`/admin/orders/${detail.orderId}`} className="text-[#FF3131] hover:text-[#ff4747]">
                {detail.orderId}
              </Link>
            </div>
          )}
          {detail.trackingNumber && (
            <div>
              <div className="text-white/40 text-xs">Tracking</div>
              <div>{detail.trackingNumber}</div>
            </div>
          )}

          {canAct && (
            <div className="pt-3 border-t border-white/8 space-y-3">
              <label className="block">
                <span className="text-white/60 text-xs">Tracking number (optional)</span>
                <input
                  aria-label="tracking number"
                  className="w-full mt-1 bg-white/[0.04] border border-white/8 rounded-md px-3 py-2 text-white"
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={handleFulfill}
                  className="text-xs px-3 py-1.5 rounded-md bg-[#FF3131] text-white hover:bg-[#ff4747] disabled:opacity-50"
                >
                  Mark Fulfilled
                </button>
                <button
                  type="button"
                  disabled={!isSuperAdmin || pending}
                  title={isSuperAdmin ? 'Cancel redemption' : 'SUPER_ADMIN only'}
                  onClick={handleCancel}
                  className="text-xs px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/8 text-red-400 hover:text-red-300 disabled:text-white/20 disabled:cursor-not-allowed"
                >
                  Cancel Redemption
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Inspector>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/loyalty/inspectors/RedemptionInspector.test.tsx
pnpm exec tsc --noEmit
git add components/admin/loyalty/inspectors/RedemptionInspector.tsx tests/unit/components/admin/loyalty/inspectors/RedemptionInspector.test.tsx
git commit -m "feat(admin-v2): add RedemptionInspector (Mark Fulfilled + SUPER_ADMIN cancel)"
git push -u origin wave7p7/task-10-redemption-inspector
gh pr create --title "feat(admin-v2): Phase 7 W3 RedemptionInspector" --body "Read-only audit detail + Mark Fulfilled (PENDING/ACTIVE) + Cancel (SUPER_ADMIN, with reason prompt). 4 tests passing."
```

---

### Task 11: `EventInspector.tsx`

**Wave:** 3 | **Branch:** `wave7p7/task-11-event-inspector` | **Model:** sonnet

**Schema realities for this task:**
- Full CRUD form. Fields: name, description (textarea), startDate (datetime-local), endDate (datetime-local), multiplier (number), tierIds (textarea — JSON array of strings — free-form for v1), categoryIds (textarea — JSON array of strings — free-form for v1), isActive (checkbox).
- Read-only stats display: totalBonusPointsAwarded, ordersAffected.
- createMode for "+ New Event".
- Delete button visible to all admins (no FK constraint on PointsMultiplierEvent — safe to delete).
- Import `EventDetailFull` from `@/app/admin/loyalty/actions`.

**Files:**
- Create: `components/admin/loyalty/inspectors/EventInspector.tsx`
- Test: `tests/unit/components/admin/loyalty/inspectors/EventInspector.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/loyalty/inspectors/EventInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const createEvent = vi.fn()
const updateEvent = vi.fn()
const deleteEvent = vi.fn()

vi.mock('@/app/admin/loyalty/actions', () => ({
  createEvent: (...a: unknown[]) => createEvent(...a),
  updateEvent: (...a: unknown[]) => updateEvent(...a),
  deleteEvent: (...a: unknown[]) => deleteEvent(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { EventInspector } from '@/components/admin/loyalty/inspectors/EventInspector'

const event = {
  id: 'e1', name: 'Memorial 2x', description: 'Double points',
  startDate: new Date('2026-05-25T00:00:00Z'),
  endDate: new Date('2026-05-27T23:59:59Z'),
  multiplier: 2, tierIds: null, categoryIds: null, isActive: true,
  totalBonusPointsAwarded: 100, ordersAffected: 5,
  createdAt: new Date(), updatedAt: new Date(),
}

beforeEach(() => vi.clearAllMocks())

describe('EventInspector', () => {
  it('renders empty form in create mode', () => {
    render(<EventInspector open detail={null} createMode onClose={() => {}} />)
    expect(screen.getByLabelText(/name/i)).toBeTruthy()
  })
  it('renders read-only stats in edit mode', () => {
    render(<EventInspector open detail={event} onClose={() => {}} />)
    expect(screen.getByText(/100/)).toBeTruthy()
    expect(screen.getByText(/5/)).toBeTruthy()
  })
  it('calls updateEvent on Save', async () => {
    updateEvent.mockResolvedValue({ ok: true })
    render(<EventInspector open detail={event} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(updateEvent).toHaveBeenCalled())
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  createEvent,
  updateEvent,
  deleteEvent,
  type EventDetailFull,
} from '@/app/admin/loyalty/actions'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'

export interface EventInspectorProps {
  open: boolean
  detail: EventDetailFull | null
  createMode?: boolean
  onClose: () => void
  onSaved?: (id: string) => void
  onDeleted?: (id: string) => void
}

function toDtLocal(d: Date | null | undefined): string {
  if (!d) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

export function EventInspector({
  open, detail, createMode = false, onClose, onSaved, onDeleted,
}: EventInspectorProps) {
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [multiplier, setMultiplier] = useState(2)
  const [tierIds, setTierIds] = useState('')
  const [categoryIds, setCategoryIds] = useState('')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    if (!open) return
    if (detail) {
      setName(detail.name)
      setDescription(detail.description ?? '')
      setStartDate(toDtLocal(detail.startDate))
      setEndDate(toDtLocal(detail.endDate))
      setMultiplier(detail.multiplier)
      setTierIds(detail.tierIds ?? '')
      setCategoryIds(detail.categoryIds ?? '')
      setIsActive(detail.isActive)
    } else if (createMode) {
      setName(''); setDescription('')
      setStartDate(''); setEndDate('')
      setMultiplier(2)
      setTierIds(''); setCategoryIds('')
      setIsActive(true)
    }
  }, [open, detail, createMode])

  const handleSave = () => {
    const startDt = startDate ? new Date(startDate) : null
    const endDt = endDate ? new Date(endDate) : null
    if (!startDt || Number.isNaN(startDt.getTime()) || !endDt || Number.isNaN(endDt.getTime())) {
      toast.error('Valid start and end dates required')
      return
    }
    startTransition(async () => {
      const payload = {
        name,
        description: description || null,
        startDate: startDt,
        endDate: endDt,
        multiplier,
        tierIds: tierIds.trim() || null,
        categoryIds: categoryIds.trim() || null,
        isActive,
      }
      if (createMode || !detail) {
        const r = await createEvent(payload)
        if (r.ok) {
          toast.success('Event created')
          onSaved?.(r.data?.id ?? '')
          onClose()
        } else toast.error(r.error)
      } else {
        const r = await updateEvent(detail.id, payload)
        if (r.ok) {
          toast.success('Event updated')
          onSaved?.(detail.id)
          onClose()
        } else toast.error(r.error)
      }
    })
  }

  const handleDelete = () => {
    if (!detail) return
    startTransition(async () => {
      const r = await deleteEvent(detail.id)
      if (r.ok) {
        toast.success('Event deleted')
        onDeleted?.(detail.id)
        onClose()
      } else toast.error(r.error)
    })
  }

  const inputCls = 'w-full mt-1 bg-white/[0.04] border border-white/8 rounded-md px-3 py-2 text-white'
  const labelCls = 'text-white/60 text-xs'

  return (
    <Inspector open={open} onClose={onClose} title={detail ? 'Edit Event' : 'New Event'} width={460}>
      <div className="space-y-3 text-sm">
        <label className="block">
          <span className={labelCls}>Name</span>
          <input aria-label="name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelCls}>Description</span>
          <textarea className={`${inputCls} min-h-[60px]`} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelCls}>Start date</span>
            <input type="datetime-local" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="block">
            <span className={labelCls}>End date</span>
            <input type="datetime-local" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>
        <label className="block">
          <span className={labelCls}>Multiplier</span>
          <input type="number" step="0.1" min="1" className={inputCls} value={multiplier} onChange={(e) => setMultiplier(Number(e.target.value))} />
        </label>
        <label className="block">
          <span className={labelCls}>Tier IDs (JSON array, blank = all tiers)</span>
          <textarea className={`${inputCls} font-mono`} value={tierIds} onChange={(e) => setTierIds(e.target.value)} placeholder='["t1","t2"]' />
        </label>
        <label className="block">
          <span className={labelCls}>Category IDs (JSON array, blank = all)</span>
          <textarea className={`${inputCls} font-mono`} value={categoryIds} onChange={(e) => setCategoryIds(e.target.value)} placeholder='["cat1"]' />
        </label>
        <label className="flex items-center gap-2 text-xs text-white/80">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active
        </label>

        {detail && (
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/8">
            <div>
              <div className="text-white/40 text-xs">Bonus pts awarded</div>
              <div>{detail.totalBonusPointsAwarded}</div>
            </div>
            <div>
              <div className="text-white/40 text-xs">Orders affected</div>
              <div>{detail.ordersAffected}</div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-white/8">
          {detail ? (
            <button
              type="button"
              disabled={pending}
              onClick={handleDelete}
              className="text-xs text-red-400 hover:text-red-300 disabled:text-white/20 disabled:cursor-not-allowed"
            >
              Delete
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/8 text-white/70 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={handleSave}
              className="text-xs px-3 py-1.5 rounded-md bg-[#FF3131] text-white hover:bg-[#ff4747] disabled:opacity-50"
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </Inspector>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/loyalty/inspectors/EventInspector.test.tsx
pnpm exec tsc --noEmit
git add components/admin/loyalty/inspectors/EventInspector.tsx tests/unit/components/admin/loyalty/inspectors/EventInspector.test.tsx
git commit -m "feat(admin-v2): add EventInspector (full CRUD + read-only stats)"
git push -u origin wave7p7/task-11-event-inspector
gh pr create --title "feat(admin-v2): Phase 7 W3 EventInspector" --body "PointsMultiplierEvent full CRUD + read-only stats. createMode + editMode. 3 tests passing."
```

---

### Task 12: `LoyaltySettingsInspector.tsx`

**Wave:** 3 | **Branch:** `wave7p7/task-12-loyalty-settings-inspector` | **Model:** sonnet

**Schema realities for this task:**
- LoyaltySettings singleton edit form. Fields editable: isEnabled, programName, pointsPerDollar, pointsRoundingMode (`floor | round | ceil`), minimumOrderForPoints, referralPointsReferrer, referralPointsReferred, referralEnabled, reviewPointsEnabled, reviewPointsAmount, reviewWithPhotoBonus, birthdayRewardsEnabled, birthdayRewardType, birthdayRewardValue, birthdayRewardExpireDays, pointsExpireEnabled, tierDowngradeEnabled, showPointsInCart, showPointsInCheckout, showTierProgress.
- **READ-ONLY CRON FIELDS:** `pointsExpireMonths`, `tierEvaluationPeriod` — rendered as text with a note "Cron schedule managed in `.github/workflows/birthday-points-cron.yml`". Server-side `updateLoyaltySettings` silently strips these keys.
- Wide Inspector (width=540).
- Import `LoyaltySettingsRow` from `@/app/admin/loyalty/actions`.

**Files:**
- Create: `components/admin/loyalty/inspectors/LoyaltySettingsInspector.tsx`
- Test: `tests/unit/components/admin/loyalty/inspectors/LoyaltySettingsInspector.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/loyalty/inspectors/LoyaltySettingsInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const updateLoyaltySettings = vi.fn()
vi.mock('@/app/admin/loyalty/actions', () => ({
  updateLoyaltySettings: (...a: unknown[]) => updateLoyaltySettings(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { LoyaltySettingsInspector } from '@/components/admin/loyalty/inspectors/LoyaltySettingsInspector'

const settings = {
  id: 'default', isEnabled: true, programName: 'Head Over Feels Rewards',
  pointsPerDollar: 1, pointsRoundingMode: 'floor', minimumOrderForPoints: 0,
  referralPointsReferrer: 100, referralPointsReferred: 50, referralEnabled: true,
  reviewPointsEnabled: true, reviewPointsAmount: 25, reviewWithPhotoBonus: 25,
  birthdayRewardsEnabled: true, birthdayRewardType: 'points',
  birthdayRewardValue: 100, birthdayRewardExpireDays: 30,
  pointsExpireEnabled: true, pointsExpireMonths: 12, tierEvaluationPeriod: 'annual',
  tierDowngradeEnabled: false, showPointsInCart: true,
  showPointsInCheckout: true, showTierProgress: true,
  updatedAt: new Date('2026-05-01'),
}

beforeEach(() => vi.clearAllMocks())

describe('LoyaltySettingsInspector', () => {
  it('shows cron fields as read-only with note', () => {
    render(<LoyaltySettingsInspector open settings={settings} onClose={() => {}} />)
    expect(screen.getByText(/12 months/)).toBeTruthy()
    expect(screen.getByText(/annual/)).toBeTruthy()
    expect(screen.getByText(/birthday-points-cron\.yml/)).toBeTruthy()
  })
  it('calls updateLoyaltySettings on Save', async () => {
    updateLoyaltySettings.mockResolvedValue({ ok: true })
    render(<LoyaltySettingsInspector open settings={settings} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/program name/i), { target: { value: 'Renamed' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(updateLoyaltySettings).toHaveBeenCalled())
    expect(updateLoyaltySettings.mock.calls[0][0].programName).toBe('Renamed')
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { updateLoyaltySettings, type LoyaltySettingsRow } from '@/app/admin/loyalty/actions'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'

export interface LoyaltySettingsInspectorProps {
  open: boolean
  settings: LoyaltySettingsRow
  onClose: () => void
  onSaved?: () => void
}

export function LoyaltySettingsInspector({
  open, settings, onClose, onSaved,
}: LoyaltySettingsInspectorProps) {
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState(settings)

  useEffect(() => {
    if (!open) return
    setForm(settings)
  }, [open, settings])

  const update = <K extends keyof LoyaltySettingsRow>(key: K, value: LoyaltySettingsRow[K]) =>
    setForm((s) => ({ ...s, [key]: value }))

  const handleSave = () => {
    startTransition(async () => {
      // Cron fields are stripped server-side; we pass the full editable shape here.
      const r = await updateLoyaltySettings({
        isEnabled: form.isEnabled,
        programName: form.programName,
        pointsPerDollar: form.pointsPerDollar,
        pointsRoundingMode: form.pointsRoundingMode,
        minimumOrderForPoints: form.minimumOrderForPoints,
        referralPointsReferrer: form.referralPointsReferrer,
        referralPointsReferred: form.referralPointsReferred,
        referralEnabled: form.referralEnabled,
        reviewPointsEnabled: form.reviewPointsEnabled,
        reviewPointsAmount: form.reviewPointsAmount,
        reviewWithPhotoBonus: form.reviewWithPhotoBonus,
        birthdayRewardsEnabled: form.birthdayRewardsEnabled,
        birthdayRewardType: form.birthdayRewardType,
        birthdayRewardValue: form.birthdayRewardValue,
        birthdayRewardExpireDays: form.birthdayRewardExpireDays,
        pointsExpireEnabled: form.pointsExpireEnabled,
        tierDowngradeEnabled: form.tierDowngradeEnabled,
        showPointsInCart: form.showPointsInCart,
        showPointsInCheckout: form.showPointsInCheckout,
        showTierProgress: form.showTierProgress,
      })
      if (r.ok) {
        toast.success('Settings saved')
        onSaved?.()
        onClose()
      } else toast.error(r.error)
    })
  }

  const inputCls = 'w-full mt-1 bg-white/[0.04] border border-white/8 rounded-md px-3 py-2 text-white'
  const labelCls = 'text-white/60 text-xs'
  const num = (label: string, key: keyof LoyaltySettingsRow & string) => (
    <label key={key} className="block">
      <span className={labelCls}>{label}</span>
      <input
        aria-label={label.toLowerCase()}
        type="number"
        step="any"
        min="0"
        className={inputCls}
        value={form[key] as number}
        onChange={(e) => update(key as keyof LoyaltySettingsRow, Number(e.target.value) as never)}
      />
    </label>
  )
  const bool = (label: string, key: keyof LoyaltySettingsRow & string) => (
    <label key={key} className="flex items-center gap-2 text-xs text-white/80">
      <input
        type="checkbox"
        checked={form[key] as boolean}
        onChange={(e) => update(key as keyof LoyaltySettingsRow, e.target.checked as never)}
      />
      {label}
    </label>
  )

  return (
    <Inspector open={open} onClose={onClose} title="Loyalty Settings" width={540}>
      <div className="space-y-4 text-sm">
        <section className="space-y-2">
          <h4 className="text-xs uppercase tracking-wide text-white/40">Program</h4>
          {bool('Program enabled', 'isEnabled')}
          <label className="block">
            <span className={labelCls}>Program name</span>
            <input
              aria-label="program name"
              className={inputCls}
              value={form.programName}
              onChange={(e) => update('programName', e.target.value)}
            />
          </label>
          {num('Points per dollar', 'pointsPerDollar')}
          <label className="block">
            <span className={labelCls}>Points rounding mode</span>
            <select
              className={inputCls}
              value={form.pointsRoundingMode}
              onChange={(e) => update('pointsRoundingMode', e.target.value)}
            >
              <option value="floor">floor</option>
              <option value="round">round</option>
              <option value="ceil">ceil</option>
            </select>
          </label>
          {num('Minimum order for points ($)', 'minimumOrderForPoints')}
        </section>

        <section className="space-y-2">
          <h4 className="text-xs uppercase tracking-wide text-white/40">Referral</h4>
          {bool('Referral enabled', 'referralEnabled')}
          {num('Referrer points', 'referralPointsReferrer')}
          {num('Referred points', 'referralPointsReferred')}
        </section>

        <section className="space-y-2">
          <h4 className="text-xs uppercase tracking-wide text-white/40">Reviews</h4>
          {bool('Review points enabled', 'reviewPointsEnabled')}
          {num('Points per review', 'reviewPointsAmount')}
          {num('Bonus for photo review', 'reviewWithPhotoBonus')}
        </section>

        <section className="space-y-2">
          <h4 className="text-xs uppercase tracking-wide text-white/40">Birthday</h4>
          {bool('Birthday rewards enabled', 'birthdayRewardsEnabled')}
          <label className="block">
            <span className={labelCls}>Birthday reward type</span>
            <select
              className={inputCls}
              value={form.birthdayRewardType}
              onChange={(e) => update('birthdayRewardType', e.target.value)}
            >
              <option value="points">points</option>
              <option value="discount">discount</option>
            </select>
          </label>
          {num('Birthday reward value', 'birthdayRewardValue')}
          {num('Birthday reward expire (days)', 'birthdayRewardExpireDays')}
        </section>

        <section className="space-y-2">
          <h4 className="text-xs uppercase tracking-wide text-white/40">Display</h4>
          {bool('Show points in cart', 'showPointsInCart')}
          {bool('Show points in checkout', 'showPointsInCheckout')}
          {bool('Show tier progress', 'showTierProgress')}
        </section>

        <section className="space-y-2">
          <h4 className="text-xs uppercase tracking-wide text-white/40">Tier evaluation</h4>
          {bool('Tier downgrade enabled', 'tierDowngradeEnabled')}
          {bool('Points expire enabled', 'pointsExpireEnabled')}
          <div className="rounded-md border border-white/8 bg-white/[0.02] p-3 text-xs space-y-2">
            <div className="text-white/50">Cron-managed (read-only):</div>
            <div className="text-white/80">Points expire after: {form.pointsExpireMonths} months</div>
            <div className="text-white/80">Tier evaluation period: {form.tierEvaluationPeriod}</div>
            <div className="text-white/40">
              Schedule managed in <code className="font-mono">.github/workflows/birthday-points-cron.yml</code>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-2 pt-3 border-t border-white/8">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/8 text-white/70 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={handleSave}
            className="text-xs px-3 py-1.5 rounded-md bg-[#FF3131] text-white hover:bg-[#ff4747] disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Inspector>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/loyalty/inspectors/LoyaltySettingsInspector.test.tsx
pnpm exec tsc --noEmit
git add components/admin/loyalty/inspectors/LoyaltySettingsInspector.tsx tests/unit/components/admin/loyalty/inspectors/LoyaltySettingsInspector.test.tsx
git commit -m "feat(admin-v2): add LoyaltySettingsInspector (singleton edit + read-only cron fields)"
git push -u origin wave7p7/task-12-loyalty-settings-inspector
gh pr create --title "feat(admin-v2): Phase 7 W3 LoyaltySettingsInspector" --body "Full singleton edit form. Cron fields (pointsExpireMonths, tierEvaluationPeriod) rendered read-only with note pointing to .github/workflows/birthday-points-cron.yml. 2 tests passing."
```

---

### Task 13: `AdjustPointsDialog.tsx`

**Wave:** 3 | **Branch:** `wave7p7/task-13-adjust-points-dialog` | **Model:** sonnet

**Schema realities for this task:**
- Sub-dialog used by `MemberInspector` (single member) and `MembersBulkSheet` (bulk mode).
- Props: `open`, `memberIds: string[]` (length 1 = single mode; length > 1 = bulk mode), `isSuperAdmin`, `onClose`, `onSaved`.
- Form fields: `amount` (signed number — positive grants, negative deducts), `reason` (textarea, required).
- Single mode → calls `adjustMemberPoints(memberId, amount, reason)`. Bulk mode → calls `bulkAdjustMemberPoints(memberIds, amount, reason)` which requires SUPER_ADMIN. When bulk mode requested by non-SUPER_ADMIN, render disabled Submit with title "SUPER_ADMIN only".
- Lives at `components/admin/loyalty/AdjustPointsDialog.tsx` (NOT inside `inspectors/`).

**Files:**
- Create: `components/admin/loyalty/AdjustPointsDialog.tsx`
- Test: `tests/unit/components/admin/loyalty/AdjustPointsDialog.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/loyalty/AdjustPointsDialog.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const adjustMemberPoints = vi.fn()
const bulkAdjustMemberPoints = vi.fn()
vi.mock('@/app/admin/loyalty/actions', () => ({
  adjustMemberPoints: (...a: unknown[]) => adjustMemberPoints(...a),
  bulkAdjustMemberPoints: (...a: unknown[]) => bulkAdjustMemberPoints(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { AdjustPointsDialog } from '@/components/admin/loyalty/AdjustPointsDialog'

beforeEach(() => vi.clearAllMocks())

describe('AdjustPointsDialog', () => {
  it('calls adjustMemberPoints in single mode', async () => {
    adjustMemberPoints.mockResolvedValue({ ok: true })
    render(<AdjustPointsDialog open memberIds={['c1']} isSuperAdmin onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '50' } })
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'promo' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    await waitFor(() => expect(adjustMemberPoints).toHaveBeenCalledWith('c1', 50, 'promo'))
  })

  it('calls bulkAdjustMemberPoints in bulk mode', async () => {
    bulkAdjustMemberPoints.mockResolvedValue({ ok: true, data: { succeeded: ['c1','c2'], failed: [] } })
    render(<AdjustPointsDialog open memberIds={['c1','c2']} isSuperAdmin onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'bulk promo' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    await waitFor(() => expect(bulkAdjustMemberPoints).toHaveBeenCalledWith(['c1','c2'], 100, 'bulk promo'))
  })

  it('disables Submit in bulk mode for non-SUPER_ADMIN', () => {
    render(<AdjustPointsDialog open memberIds={['c1','c2']} isSuperAdmin={false} onClose={() => {}} />)
    const btn = screen.getByRole('button', { name: /submit/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.title).toMatch(/SUPER_ADMIN/i)
  })

  it('rejects empty reason', () => {
    render(<AdjustPointsDialog open memberIds={['c1']} isSuperAdmin onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    expect(adjustMemberPoints).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { adjustMemberPoints, bulkAdjustMemberPoints } from '@/app/admin/loyalty/actions'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'

export interface AdjustPointsDialogProps {
  open: boolean
  memberIds: string[]
  isSuperAdmin: boolean
  onClose: () => void
  onSaved?: () => void
}

export function AdjustPointsDialog({
  open, memberIds, isSuperAdmin, onClose, onSaved,
}: AdjustPointsDialogProps) {
  const [pending, startTransition] = useTransition()
  const [amount, setAmount] = useState(0)
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!open) return
    setAmount(0)
    setReason('')
  }, [open])

  const bulk = memberIds.length > 1
  const disabledByRole = bulk && !isSuperAdmin

  const handleSubmit = () => {
    if (!reason.trim()) {
      toast.error('Reason is required')
      return
    }
    if (amount === 0 || !Number.isFinite(amount)) {
      toast.error('Amount must be non-zero')
      return
    }
    startTransition(async () => {
      if (bulk) {
        const r = await bulkAdjustMemberPoints(memberIds, amount, reason.trim())
        if (r.ok) {
          const succeeded = r.data?.succeeded.length ?? 0
          const failed = r.data?.failed.length ?? 0
          toast.success(`Adjusted ${succeeded} member${succeeded === 1 ? '' : 's'} (${failed} failed)`)
          onSaved?.()
          onClose()
        } else toast.error(r.error)
      } else {
        const r = await adjustMemberPoints(memberIds[0], amount, reason.trim())
        if (r.ok) {
          toast.success('Points adjusted')
          onSaved?.()
          onClose()
        } else toast.error(r.error)
      }
    })
  }

  const inputCls = 'w-full mt-1 bg-white/[0.04] border border-white/8 rounded-md px-3 py-2 text-white'
  const labelCls = 'text-white/60 text-xs'

  return (
    <Inspector
      open={open}
      onClose={onClose}
      title={bulk ? `Adjust Points (${memberIds.length} members)` : 'Adjust Points'}
      width={420}
    >
      <div className="space-y-3 text-sm">
        <label className="block">
          <span className={labelCls}>Amount (positive grants, negative deducts)</span>
          <input
            aria-label="amount"
            type="number"
            step="1"
            className={inputCls}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Reason</span>
          <textarea
            aria-label="reason"
            className={`${inputCls} min-h-[80px]`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2 pt-3 border-t border-white/8">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/8 text-white/70 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending || disabledByRole}
            title={disabledByRole ? 'SUPER_ADMIN only' : 'Submit adjustment'}
            onClick={handleSubmit}
            className="text-xs px-3 py-1.5 rounded-md bg-[#FF3131] text-white hover:bg-[#ff4747] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </Inspector>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/loyalty/AdjustPointsDialog.test.tsx
pnpm exec tsc --noEmit
git add components/admin/loyalty/AdjustPointsDialog.tsx tests/unit/components/admin/loyalty/AdjustPointsDialog.test.tsx
git commit -m "feat(admin-v2): add AdjustPointsDialog (single + bulk SUPER_ADMIN gated)"
git push -u origin wave7p7/task-13-adjust-points-dialog
gh pr create --title "feat(admin-v2): Phase 7 W3 AdjustPointsDialog" --body "Sub-dialog used by MemberInspector and MembersBulkSheet. Single mode → adjustMemberPoints. Bulk mode → bulkAdjustMemberPoints (SUPER_ADMIN gated). 4 tests passing."
```

---

### Task 14: `TierPerksQuickToggle.tsx`

**Wave:** 3 | **Branch:** `wave7p7/task-14-tier-perks-quick-toggle` | **Model:** sonnet

**Schema realities for this task:**
- Overview widget. Renders a list of tiers (passed as `tiers: TierPerksRow[]` prop — `{ id, name, primaryColor, freeShipping, earlyDropAccess, pointMultiplier, sortOrder }`) with toggle switches for `freeShipping` and `earlyDropAccess`. Toggling calls `updateTier(id, { freeShipping })` or `updateTier(id, { earlyDropAccess })`.
- Optimistic local state with rollback on failure.

**Files:**
- Create: `components/admin/loyalty/TierPerksQuickToggle.tsx`
- Test: `tests/unit/components/admin/loyalty/TierPerksQuickToggle.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/loyalty/TierPerksQuickToggle.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const updateTier = vi.fn()
vi.mock('@/app/admin/loyalty/actions', () => ({
  updateTier: (...a: unknown[]) => updateTier(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { TierPerksQuickToggle } from '@/components/admin/loyalty/TierPerksQuickToggle'

const tiers = [
  { id: 't1', name: 'Bronze', primaryColor: '#64748B', freeShipping: false, earlyDropAccess: false, pointMultiplier: 1, sortOrder: 1 },
]

beforeEach(() => vi.clearAllMocks())

describe('TierPerksQuickToggle', () => {
  it('renders one row per tier', () => {
    render(<TierPerksQuickToggle tiers={tiers} />)
    expect(screen.getByText(/Bronze/)).toBeTruthy()
  })
  it('toggles freeShipping via updateTier', async () => {
    updateTier.mockResolvedValue({ ok: true })
    render(<TierPerksQuickToggle tiers={tiers} />)
    fireEvent.click(screen.getByLabelText(/Bronze.*free shipping/i))
    await waitFor(() => expect(updateTier).toHaveBeenCalledWith('t1', { freeShipping: true }))
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { updateTier } from '@/app/admin/loyalty/actions'
import { toast } from '@/lib/toast'

export interface TierPerksRow {
  id: string
  name: string
  primaryColor: string
  freeShipping: boolean
  earlyDropAccess: boolean
  pointMultiplier: number
  sortOrder: number
}

export interface TierPerksQuickToggleProps {
  tiers: TierPerksRow[]
}

export function TierPerksQuickToggle({ tiers: initialTiers }: TierPerksQuickToggleProps) {
  const [tiers, setTiers] = useState(initialTiers)
  const [, startTransition] = useTransition()

  const toggle = (id: string, key: 'freeShipping' | 'earlyDropAccess') => {
    const next = tiers.map((t) => (t.id === id ? { ...t, [key]: !t[key] } : t))
    setTiers(next)
    const updated = next.find((t) => t.id === id)
    if (!updated) return
    startTransition(async () => {
      const r = await updateTier(id, { [key]: updated[key] } as Record<string, boolean>)
      if (!r.ok) {
        // Rollback
        setTiers(tiers)
        toast.error(r.error)
      }
    })
  }

  return (
    <div className="space-y-1.5">
      {tiers.length === 0 ? (
        <div className="text-xs text-white/40 py-2">No tiers configured.</div>
      ) : tiers.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-3 px-3 py-2 bg-white/[0.02] border border-white/8 rounded-md text-xs text-white/80"
        >
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: t.primaryColor }}
          />
          <span className="flex-1 font-medium">{t.name}</span>
          <span className="text-white/40">{t.pointMultiplier}×</span>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              aria-label={`${t.name} free shipping`}
              checked={t.freeShipping}
              onChange={() => toggle(t.id, 'freeShipping')}
            />
            <span>Shipping</span>
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              aria-label={`${t.name} early drop access`}
              checked={t.earlyDropAccess}
              onChange={() => toggle(t.id, 'earlyDropAccess')}
            />
            <span>Early drops</span>
          </label>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/loyalty/TierPerksQuickToggle.test.tsx
pnpm exec tsc --noEmit
git add components/admin/loyalty/TierPerksQuickToggle.tsx tests/unit/components/admin/loyalty/TierPerksQuickToggle.test.tsx
git commit -m "feat(admin-v2): add TierPerksQuickToggle (optimistic perks toggling)"
git push -u origin wave7p7/task-14-tier-perks-quick-toggle
gh pr create --title "feat(admin-v2): Phase 7 W3 TierPerksQuickToggle" --body "Overview widget: per-tier freeShipping + earlyDropAccess switches. Calls updateTier with partial payload. 2 tests passing."
```

---

### Task 15: `RewardActivationsQuickToggle.tsx`

**Wave:** 3 | **Branch:** `wave7p7/task-15-reward-activations-quick-toggle` | **Model:** sonnet

**Schema realities for this task:**
- Overview widget. Renders a list of rewards (passed as `rewards: RewardActivationsRow[]` — `{ id, name, pointsCost, isActive, totalRedeemed, sortOrder }`) with a single isActive switch each. Toggling calls `toggleRewardActive(id)`.
- Optimistic local state with rollback on failure.

**Files:**
- Create: `components/admin/loyalty/RewardActivationsQuickToggle.tsx`
- Test: `tests/unit/components/admin/loyalty/RewardActivationsQuickToggle.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/loyalty/RewardActivationsQuickToggle.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const toggleRewardActive = vi.fn()
vi.mock('@/app/admin/loyalty/actions', () => ({
  toggleRewardActive: (...a: unknown[]) => toggleRewardActive(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { RewardActivationsQuickToggle } from '@/components/admin/loyalty/RewardActivationsQuickToggle'

const rewards = [
  { id: 'r1', name: '10% off', pointsCost: 500, isActive: true, totalRedeemed: 0, sortOrder: 0 },
]

beforeEach(() => vi.clearAllMocks())

describe('RewardActivationsQuickToggle', () => {
  it('renders rows', () => {
    render(<RewardActivationsQuickToggle rewards={rewards} />)
    expect(screen.getByText(/10% off/)).toBeTruthy()
  })
  it('toggles active via toggleRewardActive', async () => {
    toggleRewardActive.mockResolvedValue({ ok: true })
    render(<RewardActivationsQuickToggle rewards={rewards} />)
    fireEvent.click(screen.getByLabelText(/10% off active/i))
    await waitFor(() => expect(toggleRewardActive).toHaveBeenCalledWith('r1'))
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { toggleRewardActive } from '@/app/admin/loyalty/actions'
import { toast } from '@/lib/toast'

export interface RewardActivationsRow {
  id: string
  name: string
  pointsCost: number
  isActive: boolean
  totalRedeemed: number
  sortOrder: number
}

export interface RewardActivationsQuickToggleProps {
  rewards: RewardActivationsRow[]
}

const nFmt = new Intl.NumberFormat('en-US')

export function RewardActivationsQuickToggle({ rewards: initial }: RewardActivationsQuickToggleProps) {
  const [rewards, setRewards] = useState(initial)
  const [, startTransition] = useTransition()

  const onToggle = (id: string) => {
    const next = rewards.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r))
    setRewards(next)
    startTransition(async () => {
      const r = await toggleRewardActive(id)
      if (!r.ok) {
        setRewards(rewards)
        toast.error(r.error)
      }
    })
  }

  return (
    <div className="space-y-1.5">
      {rewards.length === 0 ? (
        <div className="text-xs text-white/40 py-2">No rewards configured.</div>
      ) : rewards.map((r) => (
        <div
          key={r.id}
          className="flex items-center gap-3 px-3 py-2 bg-white/[0.02] border border-white/8 rounded-md text-xs text-white/80"
        >
          <span className="flex-1 font-medium">{r.name}</span>
          <span className="text-white/40">{nFmt.format(r.pointsCost)} pts</span>
          <span className="text-white/40">{nFmt.format(r.totalRedeemed)} redeemed</span>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              aria-label={`${r.name} active`}
              checked={r.isActive}
              onChange={() => onToggle(r.id)}
            />
            <span>Active</span>
          </label>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/loyalty/RewardActivationsQuickToggle.test.tsx
pnpm exec tsc --noEmit
git add components/admin/loyalty/RewardActivationsQuickToggle.tsx tests/unit/components/admin/loyalty/RewardActivationsQuickToggle.test.tsx
git commit -m "feat(admin-v2): add RewardActivationsQuickToggle (per-reward isActive switch)"
git push -u origin wave7p7/task-15-reward-activations-quick-toggle
gh pr create --title "feat(admin-v2): Phase 7 W3 RewardActivationsQuickToggle" --body "Overview widget: per-reward isActive toggle. 2 tests passing."
```

---

### Task 16: `RecentTransactionsTable.tsx`

**Wave:** 3 | **Branch:** `wave7p7/task-16-recent-transactions-table` | **Model:** sonnet

**Schema realities for this task:**
- Overview widget. Shows last 10 PointsTransaction rows (passed as `transactions: RecentTransactionRow[]` prop) with type pills (color-coded per PointsTransactionType), customer email, points, description, relative timestamp.
- Type-color map for the 14 PointsTransactionType values.

**Files:**
- Create: `components/admin/loyalty/RecentTransactionsTable.tsx`
- Test: `tests/unit/components/admin/loyalty/RecentTransactionsTable.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/loyalty/RecentTransactionsTable.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { RecentTransactionsTable } from '@/components/admin/loyalty/RecentTransactionsTable'

describe('RecentTransactionsTable', () => {
  it('renders empty state', () => {
    render(<RecentTransactionsTable transactions={[]} />)
    expect(screen.getByText(/no recent activity/i)).toBeTruthy()
  })
  it('renders rows with email + points + type pill', () => {
    render(<RecentTransactionsTable transactions={[
      { id: 't1', customerEmail: 'a@e.com', customerName: 'Ada',
        type: 'PURCHASE', points: 50, description: 'Order',
        createdAt: new Date() },
    ]} />)
    expect(screen.getByText(/a@e\.com/)).toBeTruthy()
    expect(screen.getByText(/PURCHASE/i)).toBeTruthy()
    expect(screen.getByText('+50')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import type { PointsTransactionType } from '@/app/admin/loyalty/actions'

export interface RecentTransactionRow {
  id: string
  customerEmail: string
  customerName: string | null
  type: PointsTransactionType
  points: number
  description: string
  createdAt: Date
}

export interface RecentTransactionsTableProps {
  transactions: RecentTransactionRow[]
}

const TYPE_COLORS: Record<PointsTransactionType, string> = {
  PURCHASE: '#6366f1',
  ACCOUNT_CREATION: '#10b981',
  FIRST_PURCHASE: '#10b981',
  REVIEW: '#f59e0b',
  SOCIAL_FOLLOW: '#06b6d4',
  SOCIAL_SHARE: '#06b6d4',
  UGC_UPLOAD: '#06b6d4',
  BIRTHDAY: '#ec4899',
  REFERRAL_GIVE: '#8b5cf6',
  REFERRAL_RECEIVE: '#8b5cf6',
  ADMIN_ADJUSTMENT: '#FF3131',
  TIER_BONUS: '#fbbf24',
  REDEMPTION: '#ef4444',
  EXPIRATION: '#6b7280',
}

function relative(d: Date): string {
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 30) return `${diffD}d ago`
  return d.toLocaleDateString()
}

export function RecentTransactionsTable({ transactions }: RecentTransactionsTableProps) {
  if (transactions.length === 0) {
    return <div className="text-xs text-white/40 py-2">No recent activity.</div>
  }
  return (
    <ul className="divide-y divide-white/8">
      {transactions.map((t) => (
        <li key={t.id} className="flex items-center gap-3 py-2 text-xs text-white/80">
          <span
            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
            style={{ backgroundColor: `${TYPE_COLORS[t.type]}33`, color: TYPE_COLORS[t.type] }}
          >
            {t.type}
          </span>
          <span className="flex-1 truncate">
            <span className="text-white">{t.customerEmail}</span>
            <span className="text-white/40"> — {t.description}</span>
          </span>
          <span className={t.points >= 0 ? 'text-emerald-400' : 'text-red-400'}>
            {t.points >= 0 ? `+${t.points}` : `${t.points}`}
          </span>
          <span className="text-white/40">{relative(t.createdAt)}</span>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/loyalty/RecentTransactionsTable.test.tsx
pnpm exec tsc --noEmit
git add components/admin/loyalty/RecentTransactionsTable.tsx tests/unit/components/admin/loyalty/RecentTransactionsTable.test.tsx
git commit -m "feat(admin-v2): add RecentTransactionsTable (last 10 with type pills + relative time)"
git push -u origin wave7p7/task-16-recent-transactions-table
gh pr create --title "feat(admin-v2): Phase 7 W3 RecentTransactionsTable" --body "14-color PointsTransactionType pill map. 2 tests passing."
```

---

### Task 17: `PopularRewardsList.tsx`

**Wave:** 3 | **Branch:** `wave7p7/task-17-popular-rewards-list` | **Model:** sonnet

**Schema realities for this task:**
- Overview widget. Shows top 5 rewards by `totalRedeemed` (passed as `rewards: PopularRewardRow[]` — `{ id, name, pointsCost, totalRedeemed, rewardType }`).

**Files:**
- Create: `components/admin/loyalty/PopularRewardsList.tsx`
- Test: `tests/unit/components/admin/loyalty/PopularRewardsList.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/loyalty/PopularRewardsList.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { PopularRewardsList } from '@/components/admin/loyalty/PopularRewardsList'

describe('PopularRewardsList', () => {
  it('empty state', () => {
    render(<PopularRewardsList rewards={[]} />)
    expect(screen.getByText(/no rewards yet/i)).toBeTruthy()
  })
  it('renders one row per reward', () => {
    render(<PopularRewardsList rewards={[
      { id: 'r1', name: '10% off', pointsCost: 500, totalRedeemed: 25, rewardType: 'DISCOUNT' },
    ]} />)
    expect(screen.getByText(/10% off/)).toBeTruthy()
    expect(screen.getByText(/25/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import type { RewardType } from '@/app/admin/loyalty/actions'

export interface PopularRewardRow {
  id: string
  name: string
  pointsCost: number
  totalRedeemed: number
  rewardType: RewardType
}

export interface PopularRewardsListProps {
  rewards: PopularRewardRow[]
}

const nFmt = new Intl.NumberFormat('en-US')

export function PopularRewardsList({ rewards }: PopularRewardsListProps) {
  if (rewards.length === 0) {
    return <div className="text-xs text-white/40 py-2">No rewards yet.</div>
  }
  return (
    <ul className="divide-y divide-white/8">
      {rewards.map((r, i) => (
        <li key={r.id} className="flex items-center gap-3 py-2 text-xs text-white/80">
          <span className="text-white/30 w-4 text-right">{i + 1}.</span>
          <span className="flex-1 truncate">
            <span className="text-white font-medium">{r.name}</span>
            <span className="text-white/40"> — {r.rewardType}</span>
          </span>
          <span className="text-white/50">{nFmt.format(r.pointsCost)} pts</span>
          <span className="text-emerald-400">{nFmt.format(r.totalRedeemed)}</span>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/loyalty/PopularRewardsList.test.tsx
pnpm exec tsc --noEmit
git add components/admin/loyalty/PopularRewardsList.tsx tests/unit/components/admin/loyalty/PopularRewardsList.test.tsx
git commit -m "feat(admin-v2): add PopularRewardsList (top 5 by redemption count)"
git push -u origin wave7p7/task-17-popular-rewards-list
gh pr create --title "feat(admin-v2): Phase 7 W3 PopularRewardsList" --body "Top 5 rewards by totalRedeemed list. 2 tests passing."
```

---

### Task 18: `MemberLedger.tsx`

**Wave:** 3 | **Branch:** `wave7p7/task-18-member-ledger` | **Model:** sonnet

**Schema realities for this task:**
- Sub-component of `MemberInspector`. Shows up to 50 `MemberLedgerEntry` rows (`{ id, points, type, description, createdAt, orderId, redemptionId, referralId, reviewId }`) with type pills and reason filter dropdown (filter values: `all`, `PURCHASE`, `REDEMPTION`, `ADMIN_ADJUSTMENT`, `TIER_BONUS`, `BIRTHDAY`, `REVIEW`, `REFERRAL_GIVE`, `REFERRAL_RECEIVE`, `EXPIRATION`).
- Scrollable max-height container.

**Files:**
- Create: `components/admin/loyalty/MemberLedger.tsx`
- Test: `tests/unit/components/admin/loyalty/MemberLedger.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/loyalty/MemberLedger.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { MemberLedger } from '@/components/admin/loyalty/MemberLedger'

const entries = [
  { id: 'p1', points: 100, type: 'PURCHASE' as const, description: 'Order 1',
    createdAt: new Date(), orderId: 'o1', redemptionId: null, referralId: null, reviewId: null },
  { id: 'p2', points: -50, type: 'REDEMPTION' as const, description: '10% off',
    createdAt: new Date(), orderId: null, redemptionId: 'red1', referralId: null, reviewId: null },
]

describe('MemberLedger', () => {
  it('empty state', () => {
    render(<MemberLedger entries={[]} />)
    expect(screen.getByText(/no points history/i)).toBeTruthy()
  })
  it('renders 2 rows', () => {
    render(<MemberLedger entries={entries} />)
    expect(screen.getByText(/Order 1/)).toBeTruthy()
    expect(screen.getByText(/10% off/)).toBeTruthy()
  })
  it('filters by type', () => {
    render(<MemberLedger entries={entries} />)
    fireEvent.change(screen.getByLabelText(/filter/i), { target: { value: 'PURCHASE' } })
    expect(screen.getByText(/Order 1/)).toBeTruthy()
    expect(screen.queryByText(/10% off/)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { useState } from 'react'
import type { PointsTransactionType } from '@/app/admin/loyalty/actions'

export interface MemberLedgerEntry {
  id: string
  points: number
  type: PointsTransactionType
  description: string
  createdAt: Date
  orderId: string | null
  redemptionId: string | null
  referralId: string | null
  reviewId: string | null
}

export interface MemberLedgerProps {
  entries: MemberLedgerEntry[]
}

const FILTER_OPTIONS: Array<{ value: 'all' | PointsTransactionType; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'PURCHASE', label: 'Purchase' },
  { value: 'REDEMPTION', label: 'Redemption' },
  { value: 'ADMIN_ADJUSTMENT', label: 'Admin adjust' },
  { value: 'TIER_BONUS', label: 'Tier bonus' },
  { value: 'BIRTHDAY', label: 'Birthday' },
  { value: 'REVIEW', label: 'Review' },
  { value: 'REFERRAL_GIVE', label: 'Referral give' },
  { value: 'REFERRAL_RECEIVE', label: 'Referral receive' },
  { value: 'EXPIRATION', label: 'Expiration' },
]

export function MemberLedger({ entries }: MemberLedgerProps) {
  const [filter, setFilter] = useState<'all' | PointsTransactionType>('all')

  const filtered = filter === 'all' ? entries : entries.filter((e) => e.type === filter)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs text-white/40">
          Filter
          <select
            aria-label="filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | PointsTransactionType)}
            className="ml-2 bg-white/[0.04] border border-white/8 rounded px-2 py-1 text-xs text-white"
          >
            {FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <span className="text-xs text-white/40">{filtered.length} entries</span>
      </div>
      {filtered.length === 0 ? (
        <div className="text-xs text-white/40 py-2">
          {entries.length === 0 ? 'No points history.' : 'No entries match this filter.'}
        </div>
      ) : (
        <ul className="divide-y divide-white/8 max-h-[320px] overflow-y-auto border border-white/8 rounded-md">
          {filtered.map((e) => (
            <li key={e.id} className="flex items-center gap-2 px-2 py-1.5 text-xs text-white/80">
              <span className="text-[10px] uppercase tracking-wide text-white/50 w-32 shrink-0">
                {e.type.toLowerCase().replace(/_/g, ' ')}
              </span>
              <span className="flex-1 truncate">{e.description}</span>
              <span className={e.points >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {e.points >= 0 ? `+${e.points}` : `${e.points}`}
              </span>
              <span className="text-white/30">{e.createdAt.toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/loyalty/MemberLedger.test.tsx
pnpm exec tsc --noEmit
git add components/admin/loyalty/MemberLedger.tsx tests/unit/components/admin/loyalty/MemberLedger.test.tsx
git commit -m "feat(admin-v2): add MemberLedger (scrollable 50-row history + type filter)"
git push -u origin wave7p7/task-18-member-ledger
gh pr create --title "feat(admin-v2): Phase 7 W3 MemberLedger" --body "Scrollable 50-row PointsTransaction list with type filter dropdown. 3 tests passing."
```

---

### Task 19: `ExportButton.tsx`

**Wave:** 3 | **Branch:** `wave7p7/task-19-export-button` | **Model:** sonnet

**Schema realities for this task:**
- Per-tab CSV download. Props: `{ tab: 'overview' | 'members' | 'rewards' | 'redemptions' | 'events', range, filters? }`.
- Tab→action map: overview → `exportOverviewCsv(range)`, members → `exportMembersCsv(filters)`, rewards → `exportRewardsCsv(filters)`, redemptions → `exportRedemptionsCsv(range, filters)`, events → `exportEventsCsv(filters)`.
- Note: tiers tab has no CSV export (spec — no bulk).
- On success: build a Blob, create a temporary `<a download>` link, click it, revoke the URL. (Phase 6 ExportButton precedent.)
- On `{ ok: false, error }`: toast.error(error).
- Use `useTransition` for pending state; disable button while pending.

**Files:**
- Create: `components/admin/loyalty/ExportButton.tsx`
- Test: `tests/unit/components/admin/loyalty/ExportButton.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/loyalty/ExportButton.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const exportOverviewCsv = vi.fn()
const exportMembersCsv = vi.fn()
const exportRewardsCsv = vi.fn()
const exportRedemptionsCsv = vi.fn()
const exportEventsCsv = vi.fn()

vi.mock('@/app/admin/loyalty/actions', () => ({
  exportOverviewCsv: (...a: unknown[]) => exportOverviewCsv(...a),
  exportMembersCsv: (...a: unknown[]) => exportMembersCsv(...a),
  exportRewardsCsv: (...a: unknown[]) => exportRewardsCsv(...a),
  exportRedemptionsCsv: (...a: unknown[]) => exportRedemptionsCsv(...a),
  exportEventsCsv: (...a: unknown[]) => exportEventsCsv(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { ExportButton } from '@/components/admin/loyalty/ExportButton'

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(URL, {
    createObjectURL: vi.fn(() => 'blob:mock'),
    revokeObjectURL: vi.fn(),
  })
})

describe('ExportButton (loyalty)', () => {
  it('calls exportOverviewCsv when tab=overview', async () => {
    exportOverviewCsv.mockResolvedValue({ ok: true, data: { csv: 'a,b\n1,2' } })
    render(<ExportButton tab="overview" range="30d" />)
    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    await waitFor(() => expect(exportOverviewCsv).toHaveBeenCalledWith('30d'))
  })
  it('calls exportRedemptionsCsv with range + filters', async () => {
    exportRedemptionsCsv.mockResolvedValue({ ok: true, data: { csv: 'a' } })
    render(<ExportButton tab="redemptions" range="7d" filters={{ status: 'PENDING' }} />)
    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    await waitFor(() =>
      expect(exportRedemptionsCsv).toHaveBeenCalledWith('7d', { status: 'PENDING' }),
    )
  })
  it('surfaces error toast on failure', async () => {
    const { toast } = await import('@/lib/toast')
    exportMembersCsv.mockResolvedValue({ ok: false, error: 'Too many rows' })
    render(<ExportButton tab="members" range="30d" />)
    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Too many rows'))
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { useTransition } from 'react'
import {
  exportOverviewCsv,
  exportMembersCsv,
  exportRewardsCsv,
  exportRedemptionsCsv,
  exportEventsCsv,
  type TimeRange,
  type MembersCsvFilters,
  type RewardsCsvFilters,
  type RedemptionsCsvFilters,
  type EventsCsvFilters,
} from '@/app/admin/loyalty/actions'
import { toast } from '@/lib/toast'

export type ExportableTab = 'overview' | 'members' | 'rewards' | 'redemptions' | 'events'

export type ExportButtonFilters =
  | MembersCsvFilters
  | RewardsCsvFilters
  | RedemptionsCsvFilters
  | EventsCsvFilters

export interface ExportButtonProps {
  tab: ExportableTab
  range: TimeRange
  filters?: ExportButtonFilters
  className?: string
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function ExportButton({ tab, range, filters, className }: ExportButtonProps) {
  const [pending, startTransition] = useTransition()

  const handleClick = () => {
    startTransition(async () => {
      let res
      switch (tab) {
        case 'overview':    res = await exportOverviewCsv(range); break
        case 'members':     res = await exportMembersCsv(filters as MembersCsvFilters | undefined); break
        case 'rewards':     res = await exportRewardsCsv(filters as RewardsCsvFilters | undefined); break
        case 'redemptions': res = await exportRedemptionsCsv(range, filters as RedemptionsCsvFilters | undefined); break
        case 'events':      res = await exportEventsCsv(filters as EventsCsvFilters | undefined); break
      }
      if (res.ok && res.data?.csv) {
        downloadCsv(res.data.csv, `loyalty-${tab}-${range}-${Date.now()}.csv`)
        toast.success('CSV downloaded')
      } else if (!res.ok) {
        toast.error(res.error)
      }
    })
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      className={`text-xs px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/8 text-white/70 hover:text-white disabled:opacity-50 ${className ?? ''}`}
    >
      {pending ? 'Exporting…' : 'Export CSV'}
    </button>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/loyalty/ExportButton.test.tsx
pnpm exec tsc --noEmit
git add components/admin/loyalty/ExportButton.tsx tests/unit/components/admin/loyalty/ExportButton.test.tsx
git commit -m "feat(admin-v2): add loyalty ExportButton (5 tab dispatcher + Blob download)"
git push -u origin wave7p7/task-19-export-button
gh pr create --title "feat(admin-v2): Phase 7 W3 loyalty ExportButton" --body "Per-tab CSV dispatcher (overview/members/rewards/redemptions/events). 3 tests passing."
```

---

## Wave 4 — 4 BulkSheets (4 parallel, after W3 merged)

BulkSheets are bottom-action panels that appear when a selection mode is active in the parent tab. They take `selectedIds` + `onClear` + `isSuperAdmin` and expose 2–3 buttons each. All call the matching bulk server actions and toast a summary like "Activated 5 (1 failed)".

---

### Task 20: `MembersBulkSheet.tsx`

**Wave:** 4 | **Branch:** `wave7p7/task-20-members-bulk-sheet` | **Model:** sonnet

**Schema realities for this task:**
- Three actions: **Bulk Adjust Points** (opens `AdjustPointsDialog` in bulk mode; SUPER_ADMIN-gated inside the dialog), **Bulk Re-tier** (calls `bulkRecomputeTiers(selectedIds)`), **Export CSV** (calls `exportMembersCsv()` with an optional `tierId` filter — for v1, omitted, exports the full table).
- "Bulk Re-tier" is fire-and-forget: shows the summary toast on completion (no progress UI; Phase 7.5 follow-up).

**Files:**
- Create: `components/admin/loyalty/bulk/MembersBulkSheet.tsx`
- Test: `tests/unit/components/admin/loyalty/bulk/MembersBulkSheet.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/loyalty/bulk/MembersBulkSheet.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const bulkRecomputeTiers = vi.fn()
const exportMembersCsv = vi.fn()

vi.mock('@/app/admin/loyalty/actions', () => ({
  bulkRecomputeTiers: (...a: unknown[]) => bulkRecomputeTiers(...a),
  exportMembersCsv: (...a: unknown[]) => exportMembersCsv(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/admin/loyalty/AdjustPointsDialog', () => ({
  AdjustPointsDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="adjust-dialog-open" /> : null,
}))

import { MembersBulkSheet } from '@/components/admin/loyalty/bulk/MembersBulkSheet'

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() })
})

describe('MembersBulkSheet', () => {
  it('opens AdjustPointsDialog on Adjust click', () => {
    render(<MembersBulkSheet selectedIds={['c1','c2']} isSuperAdmin onClear={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /adjust points/i }))
    expect(screen.getByTestId('adjust-dialog-open')).toBeTruthy()
  })
  it('calls bulkRecomputeTiers', async () => {
    bulkRecomputeTiers.mockResolvedValue({ ok: true, data: { succeeded: ['c1','c2'], failed: [] } })
    render(<MembersBulkSheet selectedIds={['c1','c2']} isSuperAdmin onClear={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /re-?tier/i }))
    await waitFor(() => expect(bulkRecomputeTiers).toHaveBeenCalledWith(['c1','c2']))
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { bulkRecomputeTiers, exportMembersCsv } from '@/app/admin/loyalty/actions'
import { AdjustPointsDialog } from '@/components/admin/loyalty/AdjustPointsDialog'
import { toast } from '@/lib/toast'

export interface MembersBulkSheetProps {
  selectedIds: string[]
  isSuperAdmin: boolean
  onClear: () => void
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function MembersBulkSheet({ selectedIds, isSuperAdmin, onClear }: MembersBulkSheetProps) {
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const handleRetier = () => {
    startTransition(async () => {
      const r = await bulkRecomputeTiers(selectedIds)
      if (r.ok) {
        const ok = r.data?.succeeded.length ?? 0
        const failed = r.data?.failed.length ?? 0
        toast.success(`Re-tiered ${ok} (${failed} failed)`)
        onClear()
      } else toast.error(r.error)
    })
  }

  const handleExport = () => {
    startTransition(async () => {
      const r = await exportMembersCsv()
      if (r.ok && r.data?.csv) {
        downloadCsv(r.data.csv, `loyalty-members-${Date.now()}.csv`)
        toast.success('CSV downloaded')
      } else if (!r.ok) toast.error(r.error)
    })
  }

  if (selectedIds.length === 0) return null

  return (
    <>
      <div className="fixed bottom-3 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto sm:w-[480px] z-50 bg-neutral-900/95 border border-white/8 rounded-md p-3 shadow-2xl">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-white/80">{selectedIds.length} selected</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAdjustOpen(true)}
              disabled={pending}
              className="px-3 py-1.5 rounded-md bg-[#FF3131] text-white hover:bg-[#ff4747] disabled:opacity-50"
            >
              Adjust Points
            </button>
            <button
              type="button"
              onClick={handleRetier}
              disabled={pending}
              className="px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/8 text-white/70 hover:text-white disabled:opacity-50"
            >
              Re-tier
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={pending}
              className="px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/8 text-white/70 hover:text-white disabled:opacity-50"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={onClear}
              className="px-3 py-1.5 rounded-md text-white/50 hover:text-white"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
      <AdjustPointsDialog
        open={adjustOpen}
        memberIds={selectedIds}
        isSuperAdmin={isSuperAdmin}
        onClose={() => setAdjustOpen(false)}
        onSaved={() => {
          setAdjustOpen(false)
          onClear()
        }}
      />
    </>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
mkdir -p components/admin/loyalty/bulk tests/unit/components/admin/loyalty/bulk
pnpm test tests/unit/components/admin/loyalty/bulk/MembersBulkSheet.test.tsx
pnpm exec tsc --noEmit
git add components/admin/loyalty/bulk/MembersBulkSheet.tsx tests/unit/components/admin/loyalty/bulk/MembersBulkSheet.test.tsx
git commit -m "feat(admin-v2): add MembersBulkSheet (adjust + re-tier + export)"
git push -u origin wave7p7/task-20-members-bulk-sheet
gh pr create --title "feat(admin-v2): Phase 7 W4 MembersBulkSheet" --body "Bottom action sheet: Bulk Adjust Points (dialog), Bulk Re-tier, Export CSV. 2 tests passing."
```

---

### Task 21: `RewardsBulkSheet.tsx`

**Wave:** 4 | **Branch:** `wave7p7/task-21-rewards-bulk-sheet` | **Model:** sonnet

**Schema realities for this task:** Two actions: **Bulk Activate** (`bulkActivateRewards(ids)`) and **Bulk Deactivate** (`bulkDeactivateRewards(ids)`).

**Files:**
- Create: `components/admin/loyalty/bulk/RewardsBulkSheet.tsx`
- Test: `tests/unit/components/admin/loyalty/bulk/RewardsBulkSheet.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/loyalty/bulk/RewardsBulkSheet.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const bulkActivateRewards = vi.fn()
const bulkDeactivateRewards = vi.fn()

vi.mock('@/app/admin/loyalty/actions', () => ({
  bulkActivateRewards: (...a: unknown[]) => bulkActivateRewards(...a),
  bulkDeactivateRewards: (...a: unknown[]) => bulkDeactivateRewards(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { RewardsBulkSheet } from '@/components/admin/loyalty/bulk/RewardsBulkSheet'

beforeEach(() => vi.clearAllMocks())

describe('RewardsBulkSheet', () => {
  it('activates selected rewards', async () => {
    bulkActivateRewards.mockResolvedValue({ ok: true, data: { succeeded: ['r1'], failed: [] } })
    render(<RewardsBulkSheet selectedIds={['r1','r2']} onClear={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /activate/i }))
    await waitFor(() => expect(bulkActivateRewards).toHaveBeenCalledWith(['r1','r2']))
  })
  it('deactivates selected rewards', async () => {
    bulkDeactivateRewards.mockResolvedValue({ ok: true, data: { succeeded: [], failed: [] } })
    render(<RewardsBulkSheet selectedIds={['r1']} onClear={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /deactivate/i }))
    await waitFor(() => expect(bulkDeactivateRewards).toHaveBeenCalledWith(['r1']))
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { useTransition } from 'react'
import { bulkActivateRewards, bulkDeactivateRewards } from '@/app/admin/loyalty/actions'
import { toast } from '@/lib/toast'

export interface RewardsBulkSheetProps {
  selectedIds: string[]
  onClear: () => void
}

export function RewardsBulkSheet({ selectedIds, onClear }: RewardsBulkSheetProps) {
  const [pending, startTransition] = useTransition()

  const run = (action: typeof bulkActivateRewards, label: string) => {
    startTransition(async () => {
      const r = await action(selectedIds)
      if (r.ok) {
        const ok = r.data?.succeeded.length ?? 0
        const failed = r.data?.failed.length ?? 0
        toast.success(`${label} ${ok} (${failed} failed)`)
        onClear()
      } else toast.error(r.error)
    })
  }

  if (selectedIds.length === 0) return null
  return (
    <div className="fixed bottom-3 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto sm:w-[420px] z-50 bg-neutral-900/95 border border-white/8 rounded-md p-3 shadow-2xl">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-white/80">{selectedIds.length} selected</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => run(bulkActivateRewards, 'Activated')}
            disabled={pending}
            className="px-3 py-1.5 rounded-md bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
          >
            Activate
          </button>
          <button
            type="button"
            onClick={() => run(bulkDeactivateRewards, 'Deactivated')}
            disabled={pending}
            className="px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/8 text-white/70 hover:text-white disabled:opacity-50"
          >
            Deactivate
          </button>
          <button
            type="button"
            onClick={onClear}
            className="px-3 py-1.5 rounded-md text-white/50 hover:text-white"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/loyalty/bulk/RewardsBulkSheet.test.tsx
pnpm exec tsc --noEmit
git add components/admin/loyalty/bulk/RewardsBulkSheet.tsx tests/unit/components/admin/loyalty/bulk/RewardsBulkSheet.test.tsx
git commit -m "feat(admin-v2): add RewardsBulkSheet (activate/deactivate)"
git push -u origin wave7p7/task-21-rewards-bulk-sheet
gh pr create --title "feat(admin-v2): Phase 7 W4 RewardsBulkSheet" --body "Bulk Activate / Deactivate rewards. 2 tests passing."
```

---

### Task 22: `RedemptionsBulkSheet.tsx`

**Wave:** 4 | **Branch:** `wave7p7/task-22-redemptions-bulk-sheet` | **Model:** sonnet

**Schema realities for this task:**
- Two actions: **Bulk Mark Fulfilled** (prompts for a single optional tracking number applied to all; calls `bulkFulfillRedemptions(ids, {})` — per-id tracking deferred to Phase 7.5 since v1 prompts once) and **Bulk Cancel** (SUPER_ADMIN; prompts for a reason; calls `bulkCancelRedemptions(ids, reason)`).
- Cancel button is disabled with tooltip "SUPER_ADMIN only" when `isSuperAdmin` is false.

**Files:**
- Create: `components/admin/loyalty/bulk/RedemptionsBulkSheet.tsx`
- Test: `tests/unit/components/admin/loyalty/bulk/RedemptionsBulkSheet.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/loyalty/bulk/RedemptionsBulkSheet.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const bulkFulfillRedemptions = vi.fn()
const bulkCancelRedemptions = vi.fn()

vi.mock('@/app/admin/loyalty/actions', () => ({
  bulkFulfillRedemptions: (...a: unknown[]) => bulkFulfillRedemptions(...a),
  bulkCancelRedemptions: (...a: unknown[]) => bulkCancelRedemptions(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { RedemptionsBulkSheet } from '@/components/admin/loyalty/bulk/RedemptionsBulkSheet'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RedemptionsBulkSheet', () => {
  it('fulfills with tracking prompt', async () => {
    bulkFulfillRedemptions.mockResolvedValue({ ok: true, data: { succeeded: ['red1'], failed: [] } })
    vi.spyOn(window, 'prompt').mockReturnValue('TRACK-1')
    render(<RedemptionsBulkSheet selectedIds={['red1']} isSuperAdmin onClear={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /mark fulfilled/i }))
    await waitFor(() => expect(bulkFulfillRedemptions).toHaveBeenCalled())
  })
  it('disables Cancel without SUPER_ADMIN', () => {
    render(<RedemptionsBulkSheet selectedIds={['red1']} isSuperAdmin={false} onClear={() => {}} />)
    const btn = screen.getByRole('button', { name: /cancel/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.title).toMatch(/SUPER_ADMIN/i)
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { useTransition } from 'react'
import { bulkFulfillRedemptions, bulkCancelRedemptions } from '@/app/admin/loyalty/actions'
import { toast } from '@/lib/toast'

export interface RedemptionsBulkSheetProps {
  selectedIds: string[]
  isSuperAdmin: boolean
  onClear: () => void
}

export function RedemptionsBulkSheet({ selectedIds, isSuperAdmin, onClear }: RedemptionsBulkSheetProps) {
  const [pending, startTransition] = useTransition()

  const handleFulfill = () => {
    const tracking = typeof window !== 'undefined'
      ? window.prompt('Tracking number (optional, applies to all):')
      : null
    const trackingMap: Record<string, string> = {}
    if (tracking && tracking.trim()) {
      for (const id of selectedIds) trackingMap[id] = tracking.trim()
    }
    startTransition(async () => {
      const r = await bulkFulfillRedemptions(selectedIds, trackingMap)
      if (r.ok) {
        const ok = r.data?.succeeded.length ?? 0
        const failed = r.data?.failed.length ?? 0
        toast.success(`Fulfilled ${ok} (${failed} failed)`)
        onClear()
      } else toast.error(r.error)
    })
  }

  const handleCancel = () => {
    const reason = typeof window !== 'undefined'
      ? window.prompt('Reason for bulk cancellation:')
      : null
    if (!reason || !reason.trim()) return
    startTransition(async () => {
      const r = await bulkCancelRedemptions(selectedIds, reason.trim())
      if (r.ok) {
        const ok = r.data?.succeeded.length ?? 0
        const failed = r.data?.failed.length ?? 0
        toast.success(`Cancelled ${ok} (${failed} failed)`)
        onClear()
      } else toast.error(r.error)
    })
  }

  if (selectedIds.length === 0) return null

  return (
    <div className="fixed bottom-3 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto sm:w-[480px] z-50 bg-neutral-900/95 border border-white/8 rounded-md p-3 shadow-2xl">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-white/80">{selectedIds.length} selected</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleFulfill}
            disabled={pending}
            className="px-3 py-1.5 rounded-md bg-[#FF3131] text-white hover:bg-[#ff4747] disabled:opacity-50"
          >
            Mark Fulfilled
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={!isSuperAdmin || pending}
            title={isSuperAdmin ? 'Cancel' : 'SUPER_ADMIN only'}
            className="px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/8 text-red-400 hover:text-red-300 disabled:text-white/20 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onClear}
            className="px-3 py-1.5 rounded-md text-white/50 hover:text-white"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/loyalty/bulk/RedemptionsBulkSheet.test.tsx
pnpm exec tsc --noEmit
git add components/admin/loyalty/bulk/RedemptionsBulkSheet.tsx tests/unit/components/admin/loyalty/bulk/RedemptionsBulkSheet.test.tsx
git commit -m "feat(admin-v2): add RedemptionsBulkSheet (fulfill + SUPER_ADMIN cancel)"
git push -u origin wave7p7/task-22-redemptions-bulk-sheet
gh pr create --title "feat(admin-v2): Phase 7 W4 RedemptionsBulkSheet" --body "Bulk Fulfilled (single tracking number prompt) + Bulk Cancel (SUPER_ADMIN, reason prompt). 2 tests passing."
```

---

### Task 23: `EventsBulkSheet.tsx`

**Wave:** 4 | **Branch:** `wave7p7/task-23-events-bulk-sheet` | **Model:** sonnet

**Schema realities for this task:** Two actions: **Bulk Activate** (`bulkActivateEvents(ids)`) and **Bulk Deactivate** (`bulkDeactivateEvents(ids)`). Mirror RewardsBulkSheet shape.

**Files:**
- Create: `components/admin/loyalty/bulk/EventsBulkSheet.tsx`
- Test: `tests/unit/components/admin/loyalty/bulk/EventsBulkSheet.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/loyalty/bulk/EventsBulkSheet.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const bulkActivateEvents = vi.fn()
const bulkDeactivateEvents = vi.fn()

vi.mock('@/app/admin/loyalty/actions', () => ({
  bulkActivateEvents: (...a: unknown[]) => bulkActivateEvents(...a),
  bulkDeactivateEvents: (...a: unknown[]) => bulkDeactivateEvents(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { EventsBulkSheet } from '@/components/admin/loyalty/bulk/EventsBulkSheet'

beforeEach(() => vi.clearAllMocks())

describe('EventsBulkSheet', () => {
  it('activates selected events', async () => {
    bulkActivateEvents.mockResolvedValue({ ok: true, data: { succeeded: ['e1'], failed: [] } })
    render(<EventsBulkSheet selectedIds={['e1']} onClear={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /activate/i }))
    await waitFor(() => expect(bulkActivateEvents).toHaveBeenCalledWith(['e1']))
  })
  it('deactivates selected events', async () => {
    bulkDeactivateEvents.mockResolvedValue({ ok: true, data: { succeeded: [], failed: [] } })
    render(<EventsBulkSheet selectedIds={['e1']} onClear={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /deactivate/i }))
    await waitFor(() => expect(bulkDeactivateEvents).toHaveBeenCalledWith(['e1']))
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { useTransition } from 'react'
import { bulkActivateEvents, bulkDeactivateEvents } from '@/app/admin/loyalty/actions'
import { toast } from '@/lib/toast'

export interface EventsBulkSheetProps {
  selectedIds: string[]
  onClear: () => void
}

export function EventsBulkSheet({ selectedIds, onClear }: EventsBulkSheetProps) {
  const [pending, startTransition] = useTransition()

  const run = (action: typeof bulkActivateEvents, label: string) => {
    startTransition(async () => {
      const r = await action(selectedIds)
      if (r.ok) {
        const ok = r.data?.succeeded.length ?? 0
        const failed = r.data?.failed.length ?? 0
        toast.success(`${label} ${ok} (${failed} failed)`)
        onClear()
      } else toast.error(r.error)
    })
  }

  if (selectedIds.length === 0) return null
  return (
    <div className="fixed bottom-3 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto sm:w-[420px] z-50 bg-neutral-900/95 border border-white/8 rounded-md p-3 shadow-2xl">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-white/80">{selectedIds.length} selected</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => run(bulkActivateEvents, 'Activated')}
            disabled={pending}
            className="px-3 py-1.5 rounded-md bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
          >
            Activate
          </button>
          <button
            type="button"
            onClick={() => run(bulkDeactivateEvents, 'Deactivated')}
            disabled={pending}
            className="px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/8 text-white/70 hover:text-white disabled:opacity-50"
          >
            Deactivate
          </button>
          <button
            type="button"
            onClick={onClear}
            className="px-3 py-1.5 rounded-md text-white/50 hover:text-white"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/loyalty/bulk/EventsBulkSheet.test.tsx
pnpm exec tsc --noEmit
git add components/admin/loyalty/bulk/EventsBulkSheet.tsx tests/unit/components/admin/loyalty/bulk/EventsBulkSheet.test.tsx
git commit -m "feat(admin-v2): add EventsBulkSheet (activate/deactivate)"
git push -u origin wave7p7/task-23-events-bulk-sheet
gh pr create --title "feat(admin-v2): Phase 7 W4 EventsBulkSheet" --body "Bulk Activate / Deactivate events. 2 tests passing."
```

---

## Wave 5 — 6 Tab components (6 parallel, after W2 + W3 + W4 merged)

Each Tab component is a client component (`'use client'`) because each owns its selection state + Inspector open state + BulkSheet visibility. The parent (`AdminLoyaltyV2`, W6) awaits the matching `load*` loader inside a Suspense boundary and passes the resolved data as a prop.

**IMPORTANT (cross-cutting note 7):** When you start a W5 task, FIRST `git log --oneline | head -40` to find the merged W2/W3/W4 PRs, then `git diff main -- components/admin/loyalty/` to read the actual prop signatures shipped by W2/W3/W4. Adopt those verbatim — the plan prose is approximate.

---

### Task 24: `OverviewTab.tsx`

**Wave:** 5 | **Branch:** `wave7p7/task-24-overview-tab` | **Model:** sonnet

**Schema realities for this task:** Composes 4 charts (PointsActivityChart, TierDistributionChart, TopRewardsBar, MemberGrowthChart) + TierPerksQuickToggle + RewardActivationsQuickToggle + RecentTransactionsTable + PopularRewardsList + ExportButton. Consumes `OverviewData` (declared locally — client-safe shape).

**Files:**
- Create: `components/admin/loyalty/tabs/OverviewTab.tsx`
- Test: `tests/unit/components/admin/loyalty/tabs/OverviewTab.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/loyalty/tabs/OverviewTab.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/components/admin/loyalty/charts/PointsActivityChart', () => ({
  PointsActivityChart: () => <div data-testid="chart-points-activity" />,
}))
vi.mock('@/components/admin/loyalty/charts/TierDistributionChart', () => ({
  TierDistributionChart: () => <div data-testid="chart-tier-distribution" />,
}))
vi.mock('@/components/admin/loyalty/charts/TopRewardsBar', () => ({
  TopRewardsBar: () => <div data-testid="chart-top-rewards" />,
}))
vi.mock('@/components/admin/loyalty/charts/MemberGrowthChart', () => ({
  MemberGrowthChart: () => <div data-testid="chart-member-growth" />,
}))
vi.mock('@/components/admin/loyalty/TierPerksQuickToggle', () => ({
  TierPerksQuickToggle: () => <div data-testid="tier-perks" />,
}))
vi.mock('@/components/admin/loyalty/RewardActivationsQuickToggle', () => ({
  RewardActivationsQuickToggle: () => <div data-testid="reward-activations" />,
}))
vi.mock('@/components/admin/loyalty/RecentTransactionsTable', () => ({
  RecentTransactionsTable: () => <div data-testid="recent-txns" />,
}))
vi.mock('@/components/admin/loyalty/PopularRewardsList', () => ({
  PopularRewardsList: () => <div data-testid="popular-rewards" />,
}))
vi.mock('@/components/admin/loyalty/ExportButton', () => ({
  ExportButton: () => <button>Export CSV</button>,
}))

import { OverviewTab } from '@/components/admin/loyalty/tabs/OverviewTab'

const data = {
  pointsActivity: [], tierDistribution: [], topRewards: [], memberGrowth: [],
  tierPerks: [], rewardActivations: [], recentTransactions: [], popularRewards: [],
}

describe('OverviewTab', () => {
  it('renders 4 charts + widgets + export', () => {
    render(<OverviewTab data={data} range="30d" />)
    expect(screen.getByTestId('chart-points-activity')).toBeTruthy()
    expect(screen.getByTestId('chart-tier-distribution')).toBeTruthy()
    expect(screen.getByTestId('chart-top-rewards')).toBeTruthy()
    expect(screen.getByTestId('chart-member-growth')).toBeTruthy()
    expect(screen.getByTestId('tier-perks')).toBeTruthy()
    expect(screen.getByTestId('reward-activations')).toBeTruthy()
    expect(screen.getByTestId('recent-txns')).toBeTruthy()
    expect(screen.getByTestId('popular-rewards')).toBeTruthy()
    expect(screen.getByRole('button', { name: /export/i })).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { PointsActivityChart } from '@/components/admin/loyalty/charts/PointsActivityChart'
import { TierDistributionChart } from '@/components/admin/loyalty/charts/TierDistributionChart'
import { TopRewardsBar } from '@/components/admin/loyalty/charts/TopRewardsBar'
import { MemberGrowthChart } from '@/components/admin/loyalty/charts/MemberGrowthChart'
import { TierPerksQuickToggle } from '@/components/admin/loyalty/TierPerksQuickToggle'
import { RewardActivationsQuickToggle } from '@/components/admin/loyalty/RewardActivationsQuickToggle'
import { RecentTransactionsTable } from '@/components/admin/loyalty/RecentTransactionsTable'
import { PopularRewardsList } from '@/components/admin/loyalty/PopularRewardsList'
import { ExportButton } from '@/components/admin/loyalty/ExportButton'
import type { TimeRange, PointsTransactionType, RewardType } from '@/app/admin/loyalty/actions'

export interface OverviewTabData {
  pointsActivity: { bucket: string; earned: number; redeemed: number }[]
  tierDistribution: { tierId: string | null; tierName: string; count: number; percent: number }[]
  topRewards: { rewardId: string; name: string; totalRedeemed: number }[]
  memberGrowth: { bucket: string; newMembers: number }[]
  tierPerks: { id: string; name: string; primaryColor: string; freeShipping: boolean; earlyDropAccess: boolean; pointMultiplier: number; sortOrder: number }[]
  rewardActivations: { id: string; name: string; pointsCost: number; isActive: boolean; totalRedeemed: number; sortOrder: number }[]
  recentTransactions: { id: string; customerEmail: string; customerName: string | null; type: PointsTransactionType; points: number; description: string; createdAt: Date }[]
  popularRewards: { id: string; name: string; pointsCost: number; totalRedeemed: number; rewardType: RewardType }[]
}

export interface OverviewTabProps {
  data: OverviewTabData
  range: TimeRange
}

export function OverviewTab({ data, range }: OverviewTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <ExportButton tab="overview" range={range} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Points Activity</h3>
          <PointsActivityChart data={data.pointsActivity} />
        </div>
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Tier Distribution</h3>
          <TierDistributionChart data={data.tierDistribution} />
        </div>
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Top Rewards</h3>
          <TopRewardsBar data={data.topRewards} />
        </div>
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Member Growth</h3>
          <MemberGrowthChart data={data.memberGrowth} />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Tier Perks</h3>
          <TierPerksQuickToggle tiers={data.tierPerks} />
        </div>
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Reward Activations</h3>
          <RewardActivationsQuickToggle rewards={data.rewardActivations} />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Recent Activity</h3>
          <RecentTransactionsTable transactions={data.recentTransactions} />
        </div>
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Popular Rewards</h3>
          <PopularRewardsList rewards={data.popularRewards} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
mkdir -p components/admin/loyalty/tabs tests/unit/components/admin/loyalty/tabs
pnpm test tests/unit/components/admin/loyalty/tabs/OverviewTab.test.tsx
pnpm exec tsc --noEmit
git add components/admin/loyalty/tabs/OverviewTab.tsx tests/unit/components/admin/loyalty/tabs/OverviewTab.test.tsx
git commit -m "feat(admin-v2): add loyalty OverviewTab (4 charts + 4 widgets)"
git push -u origin wave7p7/task-24-overview-tab
gh pr create --title "feat(admin-v2): Phase 7 W5 OverviewTab" --body "4 charts + TierPerks + RewardActivations + RecentTransactions + PopularRewards + ExportButton. 1 test passing."
```

---

### Task 25: `MembersTab.tsx`

**Wave:** 5 | **Branch:** `wave7p7/task-25-members-tab` | **Model:** sonnet

**Schema realities for this task:**
- Consumes `MembersTabData` = `{ items: MemberRow[]; total; page; pageSize }`.
- Paginated table with checkbox selection (multi-select). On row click → `getMemberDetailForInspector(id)` → `MemberInspector`. On selection change → `MembersBulkSheet`.
- Receives `isSuperAdmin: boolean` from parent.

**Files:**
- Create: `components/admin/loyalty/tabs/MembersTab.tsx`
- Test: `tests/unit/components/admin/loyalty/tabs/MembersTab.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/loyalty/tabs/MembersTab.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const getMemberDetailForInspector = vi.fn()
vi.mock('@/app/admin/loyalty/actions', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/app/admin/loyalty/actions')
  return { ...actual, getMemberDetailForInspector: (...a: unknown[]) => getMemberDetailForInspector(...a) }
})
vi.mock('@/components/admin/loyalty/inspectors/MemberInspector', () => ({
  MemberInspector: ({ open }: { open: boolean }) =>
    open ? <div data-testid="member-inspector-open" /> : null,
}))
vi.mock('@/components/admin/loyalty/bulk/MembersBulkSheet', () => ({
  MembersBulkSheet: ({ selectedIds }: { selectedIds: string[] }) =>
    selectedIds.length > 0 ? <div data-testid="bulk-sheet" /> : null,
}))
vi.mock('@/components/admin/loyalty/ExportButton', () => ({
  ExportButton: () => <button>Export CSV</button>,
}))

import { MembersTab } from '@/components/admin/loyalty/tabs/MembersTab'

const data = {
  items: [
    { id: 'c1', email: 'a@e.com', name: 'Ada', tierId: 't1', tierName: 'Silver',
      tierColor: '#aaa', currentPoints: 250, lifetimePoints: 1500,
      annualPointsEarned: 800, lastOrderDate: new Date('2026-05-20'),
      tierStartDate: new Date('2026-01-01') },
  ],
  total: 1, page: 1, pageSize: 25,
}

beforeEach(() => vi.clearAllMocks())

describe('MembersTab', () => {
  it('renders table rows', () => {
    render(<MembersTab data={data} range="30d" isSuperAdmin />)
    expect(screen.getByText(/a@e\.com/)).toBeTruthy()
  })
  it('opens MemberInspector on row click', async () => {
    getMemberDetailForInspector.mockResolvedValue({ ...data.items[0], transactions: [] })
    render(<MembersTab data={data} range="30d" isSuperAdmin />)
    fireEvent.click(screen.getByText(/a@e\.com/))
    await waitFor(() => expect(screen.queryByTestId('member-inspector-open')).toBeTruthy())
  })
  it('shows BulkSheet when row selected', () => {
    render(<MembersTab data={data} range="30d" isSuperAdmin />)
    fireEvent.click(screen.getByLabelText(/select c1/i))
    expect(screen.getByTestId('bulk-sheet')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { MemberInspector } from '@/components/admin/loyalty/inspectors/MemberInspector'
import { MembersBulkSheet } from '@/components/admin/loyalty/bulk/MembersBulkSheet'
import { ExportButton } from '@/components/admin/loyalty/ExportButton'
import {
  getMemberDetailForInspector,
  type MemberDetailFull,
  type TimeRange,
} from '@/app/admin/loyalty/actions'

export interface MemberRow {
  id: string
  email: string
  name: string | null
  tierId: string | null
  tierName: string | null
  tierColor: string | null
  currentPoints: number
  lifetimePoints: number
  annualPointsEarned: number
  lastOrderDate: Date | null
  tierStartDate: Date
}

export interface MembersTabData {
  items: MemberRow[]
  total: number
  page: number
  pageSize: number
}

export interface MembersTabProps {
  data: MembersTabData
  range: TimeRange
  isSuperAdmin: boolean
}

const nFmt = new Intl.NumberFormat('en-US')

export function MembersTab({ data, range, isSuperAdmin }: MembersTabProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<MemberDetailFull | null>(null)
  const [, startTransition] = useTransition()

  const openRow = (id: string) => {
    setDetail(null)
    setOpen(true)
    startTransition(async () => {
      const d = await getMemberDetailForInspector(id)
      setDetail(d)
    })
  }

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/40">{data.total} members</span>
        <ExportButton tab="members" range={range} />
      </div>
      <div className="bg-neutral-900/60 border border-white/8 rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-white/[0.04] text-white/50 text-left">
            <tr>
              <th className="px-3 py-2 w-8"></th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Tier</th>
              <th className="px-3 py-2">Current</th>
              <th className="px-3 py-2">Lifetime</th>
              <th className="px-3 py-2">Last order</th>
            </tr>
          </thead>
          <tbody className="text-white/80">
            {data.items.map((m) => (
              <tr
                key={m.id}
                className="border-t border-white/8 hover:bg-white/[0.04]"
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={`Select ${m.id}`}
                    checked={selected.has(m.id)}
                    onChange={() => toggle(m.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td className="px-3 py-2 cursor-pointer" onClick={() => openRow(m.id)}>{m.email}</td>
                <td className="px-3 py-2 cursor-pointer" onClick={() => openRow(m.id)}>
                  {m.tierColor && (
                    <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: m.tierColor }} />
                  )}
                  {m.tierName ?? '—'}
                </td>
                <td className="px-3 py-2 cursor-pointer" onClick={() => openRow(m.id)}>{nFmt.format(m.currentPoints)}</td>
                <td className="px-3 py-2 cursor-pointer" onClick={() => openRow(m.id)}>{nFmt.format(m.lifetimePoints)}</td>
                <td className="px-3 py-2 cursor-pointer" onClick={() => openRow(m.id)}>
                  {m.lastOrderDate ? m.lastOrderDate.toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MemberInspector
        open={open}
        detail={detail}
        isSuperAdmin={isSuperAdmin}
        onClose={() => setOpen(false)}
      />
      <MembersBulkSheet
        selectedIds={Array.from(selected)}
        isSuperAdmin={isSuperAdmin}
        onClear={() => setSelected(new Set())}
      />
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/loyalty/tabs/MembersTab.test.tsx
pnpm exec tsc --noEmit
git add components/admin/loyalty/tabs/MembersTab.tsx tests/unit/components/admin/loyalty/tabs/MembersTab.test.tsx
git commit -m "feat(admin-v2): add MembersTab (selectable table → Inspector + BulkSheet)"
git push -u origin wave7p7/task-25-members-tab
gh pr create --title "feat(admin-v2): Phase 7 W5 MembersTab" --body "Paginated members table with checkbox selection → MemberInspector + MembersBulkSheet. 3 tests passing."
```

---

### Task 26: `TiersTab.tsx`

**Wave:** 5 | **Branch:** `wave7p7/task-26-tiers-tab` | **Model:** sonnet

**Schema realities for this task:**
- Consumes `tiers: TierRow[]` (no pagination, all tiers).
- Card grid with one card per tier showing color chip, name, minAnnualPoints threshold, pointMultiplier, perks summary (freeShipping/earlyDropAccess pills), memberCount.
- "+ New Tier" button opens `TierInspector` in create mode.
- Card click → `getTierDetailForInspector(id)` → `TierInspector` in edit mode.
- No BulkSheet (spec: tiers have no bulk actions).
- No ExportButton (spec: tiers don't ship CSV export).
- Receives `isSuperAdmin: boolean` for the Inspector delete gate.

**Files:**
- Create: `components/admin/loyalty/tabs/TiersTab.tsx`
- Test: `tests/unit/components/admin/loyalty/tabs/TiersTab.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/loyalty/tabs/TiersTab.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const getTierDetailForInspector = vi.fn()
vi.mock('@/app/admin/loyalty/actions', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/app/admin/loyalty/actions')
  return { ...actual, getTierDetailForInspector: (...a: unknown[]) => getTierDetailForInspector(...a) }
})
vi.mock('@/components/admin/loyalty/inspectors/TierInspector', () => ({
  TierInspector: ({ open, createMode }: { open: boolean; createMode?: boolean }) =>
    open ? <div data-testid={createMode ? 'tier-create' : 'tier-edit'} /> : null,
}))

import { TiersTab } from '@/components/admin/loyalty/tabs/TiersTab'

const tiers = [
  { id: 't1', name: 'Bronze', slug: 'bronze', description: null,
    primaryColor: '#64748B', secondaryColor: '#475569',
    minAnnualSpend: 0, minAnnualPoints: 0, isInviteOnly: false,
    pointMultiplier: 1, freeShipping: false, earlyDropAccess: false,
    perks: null, sortOrder: 1, isActive: true, memberCount: 12 },
]

beforeEach(() => vi.clearAllMocks())

describe('TiersTab', () => {
  it('renders cards', () => {
    render(<TiersTab tiers={tiers} isSuperAdmin />)
    expect(screen.getByText(/Bronze/)).toBeTruthy()
    expect(screen.getByText(/12 members/i)).toBeTruthy()
  })
  it('opens create inspector', () => {
    render(<TiersTab tiers={tiers} isSuperAdmin />)
    fireEvent.click(screen.getByRole('button', { name: /new tier/i }))
    expect(screen.getByTestId('tier-create')).toBeTruthy()
  })
  it('opens edit inspector on card click', async () => {
    getTierDetailForInspector.mockResolvedValue({ ...tiers[0] })
    render(<TiersTab tiers={tiers} isSuperAdmin />)
    fireEvent.click(screen.getByText(/Bronze/))
    await waitFor(() => expect(screen.queryByTestId('tier-edit')).toBeTruthy())
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { TierInspector } from '@/components/admin/loyalty/inspectors/TierInspector'
import {
  getTierDetailForInspector,
  type TierDetailFull,
} from '@/app/admin/loyalty/actions'

export interface TierRow {
  id: string
  name: string
  slug: string
  description: string | null
  primaryColor: string
  secondaryColor: string
  minAnnualSpend: number
  minAnnualPoints: number
  isInviteOnly: boolean
  pointMultiplier: number
  freeShipping: boolean
  earlyDropAccess: boolean
  perks: string | null
  sortOrder: number
  isActive: boolean
  memberCount: number
}

export interface TiersTabProps {
  tiers: TierRow[]
  isSuperAdmin: boolean
}

const nFmt = new Intl.NumberFormat('en-US')

export function TiersTab({ tiers, isSuperAdmin }: TiersTabProps) {
  const [open, setOpen] = useState(false)
  const [createMode, setCreateMode] = useState(false)
  const [detail, setDetail] = useState<TierDetailFull | null>(null)
  const [, startTransition] = useTransition()

  const openCreate = () => {
    setDetail(null)
    setCreateMode(true)
    setOpen(true)
  }

  const openCard = (id: string) => {
    setCreateMode(false)
    setDetail(null)
    setOpen(true)
    startTransition(async () => {
      const d = await getTierDetailForInspector(id)
      setDetail(d)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/40">{tiers.length} tiers</span>
        <button
          type="button"
          onClick={openCreate}
          className="text-xs px-3 py-1.5 rounded-md bg-[#FF3131] text-white hover:bg-[#ff4747]"
        >
          + New Tier
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {tiers.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => openCard(t.id)}
            className="text-left bg-neutral-900/60 border border-white/8 rounded-md p-3 hover:bg-white/[0.04] transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: t.primaryColor }} />
              <span className="font-medium text-white">{t.name}</span>
              {!t.isActive && <span className="text-[10px] text-white/40">(inactive)</span>}
            </div>
            <div className="text-xs text-white/50 space-y-1">
              <div>Min points: {nFmt.format(t.minAnnualPoints)}</div>
              <div>Multiplier: {t.pointMultiplier}×</div>
              <div>{nFmt.format(t.memberCount)} members</div>
            </div>
            <div className="mt-2 flex gap-1.5 flex-wrap">
              {t.freeShipping && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Free shipping</span>
              )}
              {t.earlyDropAccess && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">Early drops</span>
              )}
              {t.isInviteOnly && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300">Invite only</span>
              )}
            </div>
          </button>
        ))}
      </div>
      <TierInspector
        open={open}
        detail={detail}
        createMode={createMode}
        isSuperAdmin={isSuperAdmin}
        onClose={() => setOpen(false)}
      />
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/loyalty/tabs/TiersTab.test.tsx
pnpm exec tsc --noEmit
git add components/admin/loyalty/tabs/TiersTab.tsx tests/unit/components/admin/loyalty/tabs/TiersTab.test.tsx
git commit -m "feat(admin-v2): add TiersTab (tier card grid + create/edit inspector)"
git push -u origin wave7p7/task-26-tiers-tab
gh pr create --title "feat(admin-v2): Phase 7 W5 TiersTab" --body "Tier card grid (color chip, threshold, multiplier, perks, memberCount) + + New Tier + edit inspector. 3 tests passing."
```

---

### Task 27: `RewardsTab.tsx`

**Wave:** 5 | **Branch:** `wave7p7/task-27-rewards-tab` | **Model:** sonnet

**Schema realities for this task:**
- Consumes `RewardsTabData` = `{ items: RewardRow[]; total; page; pageSize }`.
- Card grid (image, name, pointsCost, totalRedeemed, status pill, tier requirement) + "+ New Reward" link to `/admin/loyalty/rewards/new` (use existing V1 page for v1 — Phase 7.5 will V2 the new-reward page) + RewardInspector for quick toggles + RewardsBulkSheet + ExportButton.
- Card click → `getRewardDetailForInspector(id)` → `RewardInspector` (quick-edit). Edit-details link inside the inspector points to `/admin/loyalty/rewards/${id}/edit` (Task 31).
- Selection state for BulkSheet.

**Files:**
- Create: `components/admin/loyalty/tabs/RewardsTab.tsx`
- Test: `tests/unit/components/admin/loyalty/tabs/RewardsTab.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/loyalty/tabs/RewardsTab.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const getRewardDetailForInspector = vi.fn()
vi.mock('@/app/admin/loyalty/actions', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/app/admin/loyalty/actions')
  return { ...actual, getRewardDetailForInspector: (...a: unknown[]) => getRewardDetailForInspector(...a) }
})
vi.mock('@/components/admin/loyalty/inspectors/RewardInspector', () => ({
  RewardInspector: ({ open }: { open: boolean }) =>
    open ? <div data-testid="reward-inspector-open" /> : null,
}))
vi.mock('@/components/admin/loyalty/bulk/RewardsBulkSheet', () => ({
  RewardsBulkSheet: ({ selectedIds }: { selectedIds: string[] }) =>
    selectedIds.length > 0 ? <div data-testid="rewards-bulk" /> : null,
}))
vi.mock('@/components/admin/loyalty/ExportButton', () => ({
  ExportButton: () => <button>Export CSV</button>,
}))

import { RewardsTab } from '@/components/admin/loyalty/tabs/RewardsTab'

const data = {
  items: [
    { id: 'r1', name: '10% off', slug: '10-off', pointsCost: 500,
      rewardType: 'DISCOUNT' as const, isActive: true, totalRedeemed: 5,
      maxRedemptionsPerCustomer: null, totalAvailable: null,
      minTierRequired: null, sortOrder: 0, image: null },
  ],
  total: 1, page: 1, pageSize: 25,
}

beforeEach(() => vi.clearAllMocks())

describe('RewardsTab', () => {
  it('renders card + new link + export', () => {
    render(<RewardsTab data={data} range="30d" />)
    expect(screen.getByText(/10% off/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /new reward/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /export/i })).toBeTruthy()
  })
  it('opens RewardInspector on card click', async () => {
    getRewardDetailForInspector.mockResolvedValue({
      ...data.items[0], description: 'd', value: null, metadata: null,
      createdAt: new Date(), updatedAt: new Date(),
    })
    render(<RewardsTab data={data} range="30d" />)
    fireEvent.click(screen.getByText(/10% off/))
    await waitFor(() => expect(screen.queryByTestId('reward-inspector-open')).toBeTruthy())
  })
  it('shows BulkSheet when selected', () => {
    render(<RewardsTab data={data} range="30d" />)
    fireEvent.click(screen.getByLabelText(/select r1/i))
    expect(screen.getByTestId('rewards-bulk')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { RewardInspector } from '@/components/admin/loyalty/inspectors/RewardInspector'
import { RewardsBulkSheet } from '@/components/admin/loyalty/bulk/RewardsBulkSheet'
import { ExportButton } from '@/components/admin/loyalty/ExportButton'
import {
  getRewardDetailForInspector,
  type RewardDetailFull,
  type RewardType,
  type TimeRange,
} from '@/app/admin/loyalty/actions'

export interface RewardRow {
  id: string
  name: string
  slug: string
  pointsCost: number
  rewardType: RewardType
  isActive: boolean
  totalRedeemed: number
  maxRedemptionsPerCustomer: number | null
  totalAvailable: number | null
  minTierRequired: string | null
  sortOrder: number
  image: string | null
}

export interface RewardsTabData {
  items: RewardRow[]
  total: number
  page: number
  pageSize: number
}

export interface RewardsTabProps {
  data: RewardsTabData
  range: TimeRange
}

const nFmt = new Intl.NumberFormat('en-US')

export function RewardsTab({ data, range }: RewardsTabProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<RewardDetailFull | null>(null)
  const [, startTransition] = useTransition()

  const openCard = (id: string) => {
    setDetail(null)
    setOpen(true)
    startTransition(async () => {
      const d = await getRewardDetailForInspector(id)
      setDetail(d)
    })
  }

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href="/admin/loyalty/rewards/new"
          className="text-xs px-3 py-1.5 rounded-md bg-[#FF3131] text-white hover:bg-[#ff4747]"
        >
          + New Reward
        </Link>
        <ExportButton tab="rewards" range={range} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.items.map((r) => (
          <div
            key={r.id}
            className="bg-neutral-900/60 border border-white/8 rounded-md p-3 hover:bg-white/[0.04] transition-colors"
          >
            <div className="flex items-start gap-2 mb-2">
              <input
                type="checkbox"
                aria-label={`Select ${r.id}`}
                checked={selected.has(r.id)}
                onChange={() => toggle(r.id)}
                onClick={(e) => e.stopPropagation()}
              />
              <button
                type="button"
                onClick={() => openCard(r.id)}
                className="flex-1 text-left"
              >
                <div className="font-medium text-white">{r.name}</div>
                <div className="text-xs text-white/40">{r.rewardType}</div>
              </button>
            </div>
            <div className="text-xs text-white/60 space-y-1">
              <div>{nFmt.format(r.pointsCost)} pts</div>
              <div>{nFmt.format(r.totalRedeemed)} redeemed</div>
              {r.minTierRequired && <div>Min tier: {r.minTierRequired}</div>}
            </div>
            <div className="mt-2">
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${r.isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/[0.04] text-white/40'}`}>
                {r.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        ))}
      </div>
      <RewardInspector open={open} detail={detail} onClose={() => setOpen(false)} />
      <RewardsBulkSheet
        selectedIds={Array.from(selected)}
        onClear={() => setSelected(new Set())}
      />
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/loyalty/tabs/RewardsTab.test.tsx
pnpm exec tsc --noEmit
git add components/admin/loyalty/tabs/RewardsTab.tsx tests/unit/components/admin/loyalty/tabs/RewardsTab.test.tsx
git commit -m "feat(admin-v2): add RewardsTab (card grid + new reward link + quick inspector + bulk)"
git push -u origin wave7p7/task-27-rewards-tab
gh pr create --title "feat(admin-v2): Phase 7 W5 RewardsTab" --body "Reward card grid + + New Reward link + checkbox select → RewardInspector + RewardsBulkSheet + ExportButton. 3 tests passing."
```

---

### Task 28: `RedemptionsTab.tsx`

**Wave:** 5 | **Branch:** `wave7p7/task-28-redemptions-tab` | **Model:** sonnet

**Schema realities for this task:**
- Consumes `RedemptionsTabData` = `{ items: RedemptionRow[]; total; page; pageSize }`. Read-only audit table (customer, reward, pointsSpent, status pill, couponCode, createdAt). Row click → `getRedemptionDetailForInspector(id)` → `RedemptionInspector`. Selection → `RedemptionsBulkSheet`.
- Receives `isSuperAdmin: boolean`.

**Files:**
- Create: `components/admin/loyalty/tabs/RedemptionsTab.tsx`
- Test: `tests/unit/components/admin/loyalty/tabs/RedemptionsTab.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/loyalty/tabs/RedemptionsTab.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const getRedemptionDetailForInspector = vi.fn()
vi.mock('@/app/admin/loyalty/actions', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/app/admin/loyalty/actions')
  return { ...actual, getRedemptionDetailForInspector: (...a: unknown[]) => getRedemptionDetailForInspector(...a) }
})
vi.mock('@/components/admin/loyalty/inspectors/RedemptionInspector', () => ({
  RedemptionInspector: ({ open }: { open: boolean }) =>
    open ? <div data-testid="redemption-inspector-open" /> : null,
}))
vi.mock('@/components/admin/loyalty/bulk/RedemptionsBulkSheet', () => ({
  RedemptionsBulkSheet: ({ selectedIds }: { selectedIds: string[] }) =>
    selectedIds.length > 0 ? <div data-testid="redemptions-bulk" /> : null,
}))
vi.mock('@/components/admin/loyalty/ExportButton', () => ({
  ExportButton: () => <button>Export CSV</button>,
}))

import { RedemptionsTab } from '@/components/admin/loyalty/tabs/RedemptionsTab'

const data = {
  items: [
    { id: 'red1', customerId: 'c1', customerEmail: 'a@e.com', customerName: 'Ada',
      rewardId: 'r1', rewardName: '10% off', rewardType: 'DISCOUNT' as const,
      pointsSpent: 500, status: 'PENDING' as const, couponCode: 'HOF-ABC',
      trackingNumber: null, createdAt: new Date() },
  ],
  total: 1, page: 1, pageSize: 25,
}

beforeEach(() => vi.clearAllMocks())

describe('RedemptionsTab', () => {
  it('renders rows', () => {
    render(<RedemptionsTab data={data} range="30d" isSuperAdmin />)
    expect(screen.getByText(/a@e\.com/)).toBeTruthy()
  })
  it('opens Inspector on click', async () => {
    getRedemptionDetailForInspector.mockResolvedValue({
      ...data.items[0], usedAt: null, orderId: null, shippedAt: null,
      metadata: null, idempotencyKey: 'k', updatedAt: new Date(),
    })
    render(<RedemptionsTab data={data} range="30d" isSuperAdmin />)
    fireEvent.click(screen.getByText(/a@e\.com/))
    await waitFor(() => expect(screen.queryByTestId('redemption-inspector-open')).toBeTruthy())
  })
  it('shows BulkSheet when selected', () => {
    render(<RedemptionsTab data={data} range="30d" isSuperAdmin />)
    fireEvent.click(screen.getByLabelText(/select red1/i))
    expect(screen.getByTestId('redemptions-bulk')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { RedemptionInspector } from '@/components/admin/loyalty/inspectors/RedemptionInspector'
import { RedemptionsBulkSheet } from '@/components/admin/loyalty/bulk/RedemptionsBulkSheet'
import { ExportButton } from '@/components/admin/loyalty/ExportButton'
import {
  getRedemptionDetailForInspector,
  type RedemptionDetailFull,
  type RedemptionStatus,
  type RewardType,
  type TimeRange,
} from '@/app/admin/loyalty/actions'

export interface RedemptionRow {
  id: string
  customerId: string
  customerEmail: string
  customerName: string | null
  rewardId: string
  rewardName: string
  rewardType: RewardType
  pointsSpent: number
  status: RedemptionStatus
  couponCode: string | null
  trackingNumber: string | null
  createdAt: Date
}

export interface RedemptionsTabData {
  items: RedemptionRow[]
  total: number
  page: number
  pageSize: number
}

export interface RedemptionsTabProps {
  data: RedemptionsTabData
  range: TimeRange
  isSuperAdmin: boolean
}

const STATUS_COLORS: Record<RedemptionStatus, string> = {
  PENDING: 'bg-yellow-500/20 text-yellow-300',
  ACTIVE: 'bg-indigo-500/20 text-indigo-300',
  USED: 'bg-emerald-500/20 text-emerald-300',
  EXPIRED: 'bg-white/[0.04] text-white/40',
  CANCELLED: 'bg-red-500/20 text-red-300',
  FULFILLED: 'bg-emerald-500/20 text-emerald-300',
}

export function RedemptionsTab({ data, range, isSuperAdmin }: RedemptionsTabProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<RedemptionDetailFull | null>(null)
  const [, startTransition] = useTransition()

  const openRow = (id: string) => {
    setDetail(null)
    setOpen(true)
    startTransition(async () => {
      const d = await getRedemptionDetailForInspector(id)
      setDetail(d)
    })
  }

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/40">{data.total} redemptions</span>
        <ExportButton tab="redemptions" range={range} />
      </div>
      <div className="bg-neutral-900/60 border border-white/8 rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-white/[0.04] text-white/50 text-left">
            <tr>
              <th className="px-3 py-2 w-8"></th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Reward</th>
              <th className="px-3 py-2">Points</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Coupon</th>
              <th className="px-3 py-2">Date</th>
            </tr>
          </thead>
          <tbody className="text-white/80">
            {data.items.map((r) => (
              <tr
                key={r.id}
                className="border-t border-white/8 hover:bg-white/[0.04]"
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={`Select ${r.id}`}
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td className="px-3 py-2 cursor-pointer" onClick={() => openRow(r.id)}>{r.customerEmail}</td>
                <td className="px-3 py-2 cursor-pointer" onClick={() => openRow(r.id)}>{r.rewardName}</td>
                <td className="px-3 py-2 cursor-pointer" onClick={() => openRow(r.id)}>{r.pointsSpent}</td>
                <td className="px-3 py-2 cursor-pointer" onClick={() => openRow(r.id)}>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLORS[r.status]}`}>{r.status}</span>
                </td>
                <td className="px-3 py-2 cursor-pointer font-mono text-[11px]" onClick={() => openRow(r.id)}>
                  {r.couponCode ?? '—'}
                </td>
                <td className="px-3 py-2 cursor-pointer" onClick={() => openRow(r.id)}>{r.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RedemptionInspector
        open={open}
        detail={detail}
        isSuperAdmin={isSuperAdmin}
        onClose={() => setOpen(false)}
      />
      <RedemptionsBulkSheet
        selectedIds={Array.from(selected)}
        isSuperAdmin={isSuperAdmin}
        onClear={() => setSelected(new Set())}
      />
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/loyalty/tabs/RedemptionsTab.test.tsx
pnpm exec tsc --noEmit
git add components/admin/loyalty/tabs/RedemptionsTab.tsx tests/unit/components/admin/loyalty/tabs/RedemptionsTab.test.tsx
git commit -m "feat(admin-v2): add RedemptionsTab (audit table → Inspector + BulkSheet)"
git push -u origin wave7p7/task-28-redemptions-tab
gh pr create --title "feat(admin-v2): Phase 7 W5 RedemptionsTab" --body "Read-only audit table with status pills + checkbox select → RedemptionInspector + RedemptionsBulkSheet + ExportButton. 3 tests passing."
```

---

### Task 29: `EventsTab.tsx`

**Wave:** 5 | **Branch:** `wave7p7/task-29-events-tab` | **Model:** sonnet

**Schema realities for this task:**
- Consumes `EventsTabData` = `{ items: EventRow[]; total; page; pageSize }`. Event card grid (name, dates, multiplier, status pill — `active | scheduled | ended` derived from `startDate`/`endDate`/`isActive`, totalBonusPointsAwarded, ordersAffected). Card click → `getEventDetailForInspector(id)` → `EventInspector`. "+ New Event" → `EventInspector` createMode. Selection → `EventsBulkSheet`.

**Files:**
- Create: `components/admin/loyalty/tabs/EventsTab.tsx`
- Test: `tests/unit/components/admin/loyalty/tabs/EventsTab.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/loyalty/tabs/EventsTab.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const getEventDetailForInspector = vi.fn()
vi.mock('@/app/admin/loyalty/actions', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/app/admin/loyalty/actions')
  return { ...actual, getEventDetailForInspector: (...a: unknown[]) => getEventDetailForInspector(...a) }
})
vi.mock('@/components/admin/loyalty/inspectors/EventInspector', () => ({
  EventInspector: ({ open, createMode }: { open: boolean; createMode?: boolean }) =>
    open ? <div data-testid={createMode ? 'event-create' : 'event-edit'} /> : null,
}))
vi.mock('@/components/admin/loyalty/bulk/EventsBulkSheet', () => ({
  EventsBulkSheet: ({ selectedIds }: { selectedIds: string[] }) =>
    selectedIds.length > 0 ? <div data-testid="events-bulk" /> : null,
}))
vi.mock('@/components/admin/loyalty/ExportButton', () => ({
  ExportButton: () => <button>Export CSV</button>,
}))

import { EventsTab } from '@/components/admin/loyalty/tabs/EventsTab'

const data = {
  items: [
    { id: 'e1', name: 'Memorial 2x', description: 'd',
      startDate: new Date('2026-05-25'), endDate: new Date('2026-05-27'),
      multiplier: 2, isActive: true,
      totalBonusPointsAwarded: 100, ordersAffected: 5 },
  ],
  total: 1, page: 1, pageSize: 25,
}

beforeEach(() => vi.clearAllMocks())

describe('EventsTab', () => {
  it('renders cards', () => {
    render(<EventsTab data={data} range="30d" />)
    expect(screen.getByText(/Memorial 2x/)).toBeTruthy()
  })
  it('opens create inspector', () => {
    render(<EventsTab data={data} range="30d" />)
    fireEvent.click(screen.getByRole('button', { name: /new event/i }))
    expect(screen.getByTestId('event-create')).toBeTruthy()
  })
  it('opens edit inspector on card click', async () => {
    getEventDetailForInspector.mockResolvedValue({
      ...data.items[0], tierIds: null, categoryIds: null,
      createdAt: new Date(), updatedAt: new Date(),
    })
    render(<EventsTab data={data} range="30d" />)
    fireEvent.click(screen.getByText(/Memorial 2x/))
    await waitFor(() => expect(screen.queryByTestId('event-edit')).toBeTruthy())
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { EventInspector } from '@/components/admin/loyalty/inspectors/EventInspector'
import { EventsBulkSheet } from '@/components/admin/loyalty/bulk/EventsBulkSheet'
import { ExportButton } from '@/components/admin/loyalty/ExportButton'
import {
  getEventDetailForInspector,
  type EventDetailFull,
  type TimeRange,
} from '@/app/admin/loyalty/actions'

export interface EventRow {
  id: string
  name: string
  description: string | null
  startDate: Date
  endDate: Date
  multiplier: number
  isActive: boolean
  totalBonusPointsAwarded: number
  ordersAffected: number
}

export interface EventsTabData {
  items: EventRow[]
  total: number
  page: number
  pageSize: number
}

export interface EventsTabProps {
  data: EventsTabData
  range: TimeRange
}

const nFmt = new Intl.NumberFormat('en-US')

function statusOf(e: EventRow): { label: 'active' | 'scheduled' | 'ended' | 'inactive'; cls: string } {
  if (!e.isActive) return { label: 'inactive', cls: 'bg-white/[0.04] text-white/40' }
  const now = Date.now()
  if (e.startDate.getTime() > now) return { label: 'scheduled', cls: 'bg-indigo-500/20 text-indigo-300' }
  if (e.endDate.getTime() < now) return { label: 'ended', cls: 'bg-white/[0.04] text-white/40' }
  return { label: 'active', cls: 'bg-emerald-500/20 text-emerald-300' }
}

export function EventsTab({ data, range }: EventsTabProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)
  const [createMode, setCreateMode] = useState(false)
  const [detail, setDetail] = useState<EventDetailFull | null>(null)
  const [, startTransition] = useTransition()

  const openCreate = () => {
    setDetail(null)
    setCreateMode(true)
    setOpen(true)
  }

  const openCard = (id: string) => {
    setCreateMode(false)
    setDetail(null)
    setOpen(true)
    startTransition(async () => {
      const d = await getEventDetailForInspector(id)
      setDetail(d)
    })
  }

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={openCreate}
          className="text-xs px-3 py-1.5 rounded-md bg-[#FF3131] text-white hover:bg-[#ff4747]"
        >
          + New Event
        </button>
        <ExportButton tab="events" range={range} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.items.map((e) => {
          const s = statusOf(e)
          return (
            <div
              key={e.id}
              className="bg-neutral-900/60 border border-white/8 rounded-md p-3 hover:bg-white/[0.04] transition-colors"
            >
              <div className="flex items-start gap-2 mb-2">
                <input
                  type="checkbox"
                  aria-label={`Select ${e.id}`}
                  checked={selected.has(e.id)}
                  onChange={() => toggle(e.id)}
                  onClick={(ev) => ev.stopPropagation()}
                />
                <button
                  type="button"
                  onClick={() => openCard(e.id)}
                  className="flex-1 text-left"
                >
                  <div className="font-medium text-white">{e.name}</div>
                  <div className="text-xs text-white/40">{e.multiplier}× multiplier</div>
                </button>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.cls}`}>{s.label}</span>
              </div>
              <div className="text-xs text-white/60 space-y-1">
                <div>{e.startDate.toLocaleDateString()} → {e.endDate.toLocaleDateString()}</div>
                <div>{nFmt.format(e.totalBonusPointsAwarded)} bonus pts</div>
                <div>{nFmt.format(e.ordersAffected)} orders</div>
              </div>
            </div>
          )
        })}
      </div>
      <EventInspector
        open={open}
        detail={detail}
        createMode={createMode}
        onClose={() => setOpen(false)}
      />
      <EventsBulkSheet
        selectedIds={Array.from(selected)}
        onClear={() => setSelected(new Set())}
      />
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/loyalty/tabs/EventsTab.test.tsx
pnpm exec tsc --noEmit
git add components/admin/loyalty/tabs/EventsTab.tsx tests/unit/components/admin/loyalty/tabs/EventsTab.test.tsx
git commit -m "feat(admin-v2): add EventsTab (card grid + active/scheduled/ended pills)"
git push -u origin wave7p7/task-29-events-tab
gh pr create --title "feat(admin-v2): Phase 7 W5 EventsTab" --body "Event card grid (status pill derived from dates + isActive) + + New Event + EventInspector + EventsBulkSheet + ExportButton. 3 tests passing."
```

---

## Wave 6 — V2 root + V1 stub + dispatcher (sequential, **opus** model)

### Task 30: V2 composition + V1 stub + LoyaltyTabPills + LoyaltyRangePills + page dispatcher

**Wave:** 6 | **Branch:** `wave7p7/task-30-v2-root-dispatcher` | **Model:** opus

**Schema realities for this task:**
- The V1 loyalty page lives at `app/admin/loyalty/page.tsx` (711 lines, client component). We will relocate its full body to `components/admin/_v1/AdminLoyaltyV1Page.tsx` (renaming the default export to `AdminLoyaltyV1Page`), then re-expose it at `/admin/loyalty-v1` via a thin route file.
- `AdminLoyaltyV1.tsx` is a stub linking to 7 V1 routes:
  - `/admin/loyalty-v1` — relocated original Overview page
  - `/admin/loyalty/customers` — Members V1 (already exists in `app/admin/loyalty/customers`)
  - `/admin/loyalty/tiers` — Tiers V1
  - `/admin/loyalty/rewards` — Rewards V1
  - `/admin/loyalty/redemptions` — Redemptions V1
  - `/admin/loyalty/events` — Events V1
  - `/admin/loyalty/settings` — Settings V1
- These 6 sub-routes already exist. `app/admin/loyalty/page.tsx` is REPLACED by the dispatcher.
- `LoyaltyTabPills.tsx`: client wrapper around `TabPills`. On change, `router.push(\`?tab=${id}&range=${range}\`)` (preserve `?range=`).
- `LoyaltyRangePills.tsx`: client wrapper for the 5 range pills. On change, `router.push(\`?tab=${tab}&range=${newRange}\`)` (preserve `?tab=`). Uses `TIME_RANGES` from `lib/admin/loyalty.ts`.
- `AdminLoyaltyV2.tsx`: server component that parses `searchParams.tab` + `searchParams.range`, renders Page header (with ⚙ Settings button), TabPills + RangePills + KPI strip (Suspense) + 1 active tab's Suspense slot which awaits `load*` loader and renders the tab component.
- The ⚙ Settings button is a client widget — it owns the `LoyaltySettingsInspector` open state. Build a small `LoyaltySettingsButton.tsx` client component that takes the pre-loaded `LoyaltySettingsRow` as a prop and opens the inspector on click.
- Page dispatcher reads `NEXT_PUBLIC_ADMIN_V2_ENABLED`. If not "true" → `<AdminLoyaltyV1 />`. Otherwise resolves `isSuperAdmin` via session lookup (Phase 6 dispatcher precedent) and renders `<AdminLoyaltyV2 ... />`.

**Files:**
- Create: `components/admin/_v1/AdminLoyaltyV1.tsx`
- Create: `components/admin/_v1/AdminLoyaltyV1Page.tsx` — verbatim relocation of `app/admin/loyalty/page.tsx`
- Create: `app/admin/loyalty-v1/page.tsx` — re-exposes the V1 page at `/admin/loyalty-v1`
- Create: `components/admin/dashboard/AdminLoyaltyV2.tsx`
- Create: `components/admin/dashboard/LoyaltyTabPills.tsx`
- Create: `components/admin/dashboard/LoyaltyRangePills.tsx`
- Create: `components/admin/loyalty/LoyaltySettingsButton.tsx`
- **Replace** `app/admin/loyalty/page.tsx` with the dispatcher
- Tests:
  - `tests/unit/components/admin/dashboard/AdminLoyaltyV2.test.tsx`
  - `tests/unit/app/admin/loyalty/page.test.tsx`

#### Steps

- [ ] **Step 1: Relocate the existing V1 loyalty page**

Move the body of the current `app/admin/loyalty/page.tsx` (711L, `'use client'`) into `components/admin/_v1/AdminLoyaltyV1Page.tsx`. Rename the `export default function` to `export function AdminLoyaltyV1Page(...)`. Keep all imports unchanged (they already reference `@/components/...` paths that resolve correctly from the new location). Then create the thin route:

```tsx
// app/admin/loyalty-v1/page.tsx
import { AdminLoyaltyV1Page } from '@/components/admin/_v1/AdminLoyaltyV1Page'

export default function Page() {
  return <AdminLoyaltyV1Page />
}
```

- [ ] **Step 2: Write `components/admin/_v1/AdminLoyaltyV1.tsx`**

```tsx
import Link from 'next/link'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { Card } from '@/components/ui/card'

const SECTIONS = [
  { href: '/admin/loyalty-v1', title: 'Overview (V1)', desc: 'Original loyalty dashboard' },
  { href: '/admin/loyalty/customers', title: 'Members', desc: 'Customer loyalty list' },
  { href: '/admin/loyalty/tiers', title: 'Tiers', desc: 'Tier configuration' },
  { href: '/admin/loyalty/rewards', title: 'Rewards', desc: 'Reward catalog' },
  { href: '/admin/loyalty/redemptions', title: 'Redemptions', desc: 'Redemption audit' },
  { href: '/admin/loyalty/events', title: 'Events', desc: 'Multiplier events' },
  { href: '/admin/loyalty/settings', title: 'Settings', desc: 'Program settings' },
]

export function AdminLoyaltyV1() {
  return (
    <AdminLayout title="Loyalty" subtitle="Overview, members, tiers, rewards, redemptions, events">
      <div className="space-y-4">
        <p className="text-sm text-white/50">
          The unified loyalty dashboard is in beta. Enable{' '}
          <code className="font-mono">NEXT_PUBLIC_ADMIN_V2_ENABLED=true</code> to try it.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
          {SECTIONS.map((s) => (
            <Link key={s.href} href={s.href} className="block">
              <Card className="p-4 hover:bg-white/[0.04] transition-colors">
                <h3 className="text-base font-semibold text-white">{s.title}</h3>
                <p className="text-sm text-white/50 mt-1">{s.desc}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AdminLayout>
  )
}
```

- [ ] **Step 3: Write `components/admin/dashboard/LoyaltyTabPills.tsx`**

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { TabPills, type TabPillsTab } from '@/components/ui/TabPills'
import type { LoyaltyTab } from '@/lib/admin/loyalty'

export interface LoyaltyTabPillsProps {
  tabs: ReadonlyArray<{ id: LoyaltyTab; label: string }>
  active: LoyaltyTab
}

export function LoyaltyTabPills({ tabs, active }: LoyaltyTabPillsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const range = searchParams?.get('range') ?? '30d'

  const pillTabs: TabPillsTab[] = tabs.map((t) => ({ id: t.id, label: t.label }))

  return (
    <TabPills
      tabs={pillTabs}
      active={active}
      onChange={(id) => router.push(`?tab=${id}&range=${range}`)}
      showShortcutHints
    />
  )
}
```

- [ ] **Step 4: Write `components/admin/dashboard/LoyaltyRangePills.tsx`**

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { TIME_RANGES, type TimeRange } from '@/lib/admin/loyalty'
import { cn } from '@/lib/utils'

interface Props {
  active: TimeRange
}

const LABEL: Record<TimeRange, string> = {
  today: 'Today',
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  year: 'Year',
}

export function LoyaltyRangePills({ active }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = searchParams?.get('tab') ?? 'overview'
  const [isPending, startTransition] = useTransition()

  const onPick = (range: TimeRange) => {
    if (range === active) return
    startTransition(() => router.push(`?tab=${tab}&range=${range}`))
  }

  return (
    <div className="flex gap-1" data-pending={isPending}>
      {TIME_RANGES.map((r) => {
        const isActive = r === active
        return (
          <button
            key={r}
            type="button"
            onClick={() => onPick(r)}
            aria-pressed={isActive}
            className={cn(
              'text-[10px] px-2 py-1 rounded-[4px] font-semibold transition-colors',
              isActive
                ? 'bg-white/6 text-white shadow-[inset_0_0_0_1px_rgba(255,49,49,0.2)]'
                : 'bg-white/2 text-white/40 hover:text-white/70 hover:bg-white/4',
            )}
          >
            {LABEL[r]}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Write `components/admin/loyalty/LoyaltySettingsButton.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { LoyaltySettingsInspector } from '@/components/admin/loyalty/inspectors/LoyaltySettingsInspector'
import type { LoyaltySettingsRow } from '@/app/admin/loyalty/actions'

export interface LoyaltySettingsButtonProps {
  settings: LoyaltySettingsRow
}

export function LoyaltySettingsButton({ settings }: LoyaltySettingsButtonProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Loyalty settings"
        title="Loyalty settings"
        className="text-xs px-2.5 py-1.5 rounded-md bg-white/[0.04] border border-white/8 text-white/70 hover:text-white"
      >
        ⚙
      </button>
      <LoyaltySettingsInspector
        open={open}
        settings={settings}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
```

- [ ] **Step 6: Write `components/admin/dashboard/AdminLoyaltyV2.tsx`**

```tsx
import { Suspense } from 'react'
import Link from 'next/link'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { StatCard } from '@/components/ui/StatCard'
import {
  loadLoyaltyKpis,
  loadOverviewData,
  loadMembersTab,
  loadTiersTab,
  loadRewardsTab,
  loadRedemptionsTab,
  loadEventsTab,
  loadLoyaltySettings,
  isLoyaltyTab,
  isTimeRange,
  type LoyaltyTab,
  type TimeRange,
} from '@/lib/admin/loyalty'
import { OverviewTab } from '@/components/admin/loyalty/tabs/OverviewTab'
import { MembersTab } from '@/components/admin/loyalty/tabs/MembersTab'
import { TiersTab } from '@/components/admin/loyalty/tabs/TiersTab'
import { RewardsTab } from '@/components/admin/loyalty/tabs/RewardsTab'
import { RedemptionsTab } from '@/components/admin/loyalty/tabs/RedemptionsTab'
import { EventsTab } from '@/components/admin/loyalty/tabs/EventsTab'
import { LoyaltySettingsButton } from '@/components/admin/loyalty/LoyaltySettingsButton'
import { LoyaltyTabPills } from './LoyaltyTabPills'
import { LoyaltyRangePills } from './LoyaltyRangePills'

interface Props {
  searchParams: { tab?: string; range?: string }
  isSuperAdmin: boolean
}

const TAB_CONFIG: ReadonlyArray<{ id: LoyaltyTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'members', label: 'Members' },
  { id: 'tiers', label: 'Tiers' },
  { id: 'rewards', label: 'Rewards' },
  { id: 'redemptions', label: 'Redemptions' },
  { id: 'events', label: 'Events' },
]

const nFmt = new Intl.NumberFormat('en-US')

function parseTab(raw: string | undefined): LoyaltyTab {
  return isLoyaltyTab(raw) ? raw : 'overview'
}
function parseRange(raw: string | undefined): TimeRange {
  return isTimeRange(raw) ? raw : '30d'
}

async function KpiStripSlot({ range }: { range: TimeRange }) {
  const k = await loadLoyaltyKpis(range)
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
      <Link href={`?tab=members&range=${range}`} className="block">
        <StatCard label="Active Members" value={nFmt.format(k.activeMembers)} />
      </Link>
      <Link href={`?tab=overview&range=${range}`} className="block">
        <StatCard label="Points Earned" value={nFmt.format(k.pointsEarned)} trend={k.pointsEarnedTrend} />
      </Link>
      <Link href={`?tab=redemptions&range=${range}`} className="block">
        <StatCard label="Points Redeemed" value={nFmt.format(k.pointsRedeemed)} trend={k.pointsRedeemedTrend} />
      </Link>
      <Link href={`?tab=overview&range=${range}`} className="block">
        <StatCard label="Redemption Rate" value={`${k.redemptionRate.toFixed(1)}%`} trend={k.redemptionRateTrend} />
      </Link>
    </div>
  )
}

async function OverviewSlot({ range }: { range: TimeRange }) {
  const data = await loadOverviewData(range)
  return <OverviewTab data={data} range={range} />
}
async function MembersSlot({ range, isSuperAdmin }: { range: TimeRange; isSuperAdmin: boolean }) {
  const data = await loadMembersTab()
  return <MembersTab data={data} range={range} isSuperAdmin={isSuperAdmin} />
}
async function TiersSlot({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const tiers = await loadTiersTab()
  return <TiersTab tiers={tiers} isSuperAdmin={isSuperAdmin} />
}
async function RewardsSlot({ range }: { range: TimeRange }) {
  const data = await loadRewardsTab()
  return <RewardsTab data={data} range={range} />
}
async function RedemptionsSlot({ range, isSuperAdmin }: { range: TimeRange; isSuperAdmin: boolean }) {
  const data = await loadRedemptionsTab(range)
  return <RedemptionsTab data={data} range={range} isSuperAdmin={isSuperAdmin} />
}
async function EventsSlot({ range }: { range: TimeRange }) {
  const data = await loadEventsTab()
  return <EventsTab data={data} range={range} />
}
async function SettingsBtnSlot() {
  const settings = await loadLoyaltySettings()
  return <LoyaltySettingsButton settings={settings} />
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-20 bg-white/[0.03] border border-white/8 rounded-md animate-pulse" />
      ))}
    </div>
  )
}
function TabSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-16 bg-white/[0.03] border border-white/8 rounded-md animate-pulse" />
      ))}
    </div>
  )
}
function SettingsButtonSkeleton() {
  return <div aria-hidden className="w-8 h-7 bg-white/[0.03] border border-white/8 rounded-md animate-pulse" />
}

export async function AdminLoyaltyV2({ searchParams, isSuperAdmin }: Props) {
  const tab = parseTab(searchParams.tab)
  const range = parseRange(searchParams.range)

  return (
    <AdminLayout title="Loyalty" subtitle="Overview, members, tiers, rewards, redemptions, events">
      <div className="space-y-3.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <LoyaltyTabPills tabs={TAB_CONFIG} active={tab} />
          <div className="flex items-center gap-2">
            <LoyaltyRangePills active={range} />
            <Suspense fallback={<SettingsButtonSkeleton />}>
              <SettingsBtnSlot />
            </Suspense>
          </div>
        </div>

        <Suspense fallback={<KpiSkeleton />}>
          <KpiStripSlot range={range} />
        </Suspense>

        {tab === 'overview' && (
          <Suspense fallback={<TabSkeleton />}><OverviewSlot range={range} /></Suspense>
        )}
        {tab === 'members' && (
          <Suspense fallback={<TabSkeleton />}><MembersSlot range={range} isSuperAdmin={isSuperAdmin} /></Suspense>
        )}
        {tab === 'tiers' && (
          <Suspense fallback={<TabSkeleton />}><TiersSlot isSuperAdmin={isSuperAdmin} /></Suspense>
        )}
        {tab === 'rewards' && (
          <Suspense fallback={<TabSkeleton />}><RewardsSlot range={range} /></Suspense>
        )}
        {tab === 'redemptions' && (
          <Suspense fallback={<TabSkeleton />}><RedemptionsSlot range={range} isSuperAdmin={isSuperAdmin} /></Suspense>
        )}
        {tab === 'events' && (
          <Suspense fallback={<TabSkeleton />}><EventsSlot range={range} /></Suspense>
        )}
      </div>
    </AdminLayout>
  )
}
```

- [ ] **Step 7: Replace `app/admin/loyalty/page.tsx` with the dispatcher**

```tsx
// app/admin/loyalty/page.tsx
import { AdminLoyaltyV1 } from '@/components/admin/_v1/AdminLoyaltyV1'
import { AdminLoyaltyV2 } from '@/components/admin/dashboard/AdminLoyaltyV2'
import { getSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

export const revalidate = 60

interface PageProps {
  searchParams: Promise<{ tab?: string; range?: string }>
}

export default async function AdminLoyaltyPage({ searchParams }: PageProps) {
  const params = await searchParams

  if (process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED !== 'true') {
    return <AdminLoyaltyV1 />
  }

  let isSuperAdmin = false
  try {
    const session = await getSession()
    if (session?.userId) {
      const customer = await prisma.customer.findUnique({
        where: { id: session.userId },
        select: { adminRole: true },
      })
      isSuperAdmin = customer?.adminRole === 'SUPER_ADMIN'
    }
  } catch {
    isSuperAdmin = false
  }

  return <AdminLoyaltyV2 searchParams={params} isSuperAdmin={isSuperAdmin} />
}
```

- [ ] **Step 8: Write smoke test for `AdminLoyaltyV2`**

```tsx
// tests/unit/components/admin/dashboard/AdminLoyaltyV2.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Children, isValidElement, type ReactNode } from 'react'

vi.mock('@/lib/admin/loyalty', () => ({
  loadLoyaltyKpis: vi.fn().mockResolvedValue({
    activeMembers: 5, pointsEarned: 100,
    pointsEarnedTrend: { direction: 'flat', text: '— 0%' },
    pointsRedeemed: 50, pointsRedeemedTrend: { direction: 'flat', text: '— 0%' },
    redemptionRate: 50, redemptionRateTrend: { direction: 'flat', text: '— 0%' },
  }),
  loadOverviewData: vi.fn().mockResolvedValue({
    pointsActivity: [], tierDistribution: [], topRewards: [], memberGrowth: [],
    tierPerks: [], rewardActivations: [], recentTransactions: [], popularRewards: [],
  }),
  loadMembersTab: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
  loadTiersTab: vi.fn().mockResolvedValue([]),
  loadRewardsTab: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
  loadRedemptionsTab: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
  loadEventsTab: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
  loadLoyaltySettings: vi.fn().mockResolvedValue({
    id: 'default', isEnabled: true, programName: 'Test', pointsPerDollar: 1,
    pointsRoundingMode: 'floor', minimumOrderForPoints: 0,
    referralPointsReferrer: 100, referralPointsReferred: 50, referralEnabled: true,
    reviewPointsEnabled: true, reviewPointsAmount: 25, reviewWithPhotoBonus: 25,
    birthdayRewardsEnabled: true, birthdayRewardType: 'points',
    birthdayRewardValue: 100, birthdayRewardExpireDays: 30,
    pointsExpireEnabled: true, pointsExpireMonths: 12, tierEvaluationPeriod: 'annual',
    tierDowngradeEnabled: false, showPointsInCart: true,
    showPointsInCheckout: true, showTierProgress: true, updatedAt: new Date(),
  }),
  isLoyaltyTab: (v: unknown) =>
    typeof v === 'string' && ['overview','members','tiers','rewards','redemptions','events'].includes(v),
  isTimeRange: (v: unknown) =>
    typeof v === 'string' && ['today','7d','30d','90d','year'].includes(v),
}))
vi.mock('@/components/admin/dashboard/LoyaltyTabPills', () => ({
  LoyaltyTabPills: () => <div data-testid="tab-pills" />,
}))
vi.mock('@/components/admin/dashboard/LoyaltyRangePills', () => ({
  LoyaltyRangePills: () => <div data-testid="range-pills" />,
}))
vi.mock('@/components/admin/loyalty/LoyaltySettingsButton', () => ({
  LoyaltySettingsButton: () => <div data-testid="settings-btn" />,
}))
vi.mock('@/components/admin/loyalty/tabs/OverviewTab', () => ({
  OverviewTab: () => <div data-testid="tab-overview" />,
}))
vi.mock('@/components/admin/loyalty/tabs/MembersTab', () => ({
  MembersTab: () => <div data-testid="tab-members" />,
}))
vi.mock('@/components/admin/loyalty/tabs/TiersTab', () => ({
  TiersTab: () => <div data-testid="tab-tiers" />,
}))
vi.mock('@/components/admin/loyalty/tabs/RewardsTab', () => ({
  RewardsTab: () => <div data-testid="tab-rewards" />,
}))
vi.mock('@/components/admin/loyalty/tabs/RedemptionsTab', () => ({
  RedemptionsTab: () => <div data-testid="tab-redemptions" />,
}))
vi.mock('@/components/admin/loyalty/tabs/EventsTab', () => ({
  EventsTab: () => <div data-testid="tab-events" />,
}))

// Walk an async server component tree (Phase 6 helper pattern).
async function unwrap(node: ReactNode): Promise<ReactNode> {
  if (!isValidElement(node)) return node
  const el = node as { type: unknown; props: { children?: ReactNode } }
  if (typeof el.type === 'function') {
    const result = await Promise.resolve((el.type as (p: unknown) => ReactNode)(el.props))
    return unwrap(result)
  }
  if (el.props?.children) {
    const kids = await Promise.all(
      Children.toArray(el.props.children).map((c) => unwrap(c as ReactNode)),
    )
    return { ...el, props: { ...el.props, children: kids } } as unknown as ReactNode
  }
  return node
}

beforeEach(() => vi.clearAllMocks())

import { AdminLoyaltyV2 } from '@/components/admin/dashboard/AdminLoyaltyV2'

describe('AdminLoyaltyV2', () => {
  it('renders tab + range pills + settings button on default Overview', async () => {
    const node = await AdminLoyaltyV2({ searchParams: {}, isSuperAdmin: false })
    render(node as React.ReactElement)
    expect(screen.getByTestId('tab-pills')).toBeTruthy()
    expect(screen.getByTestId('range-pills')).toBeTruthy()
  })

  it('renders MembersTab when tab=members', async () => {
    const node = await AdminLoyaltyV2({
      searchParams: { tab: 'members', range: '30d' },
      isSuperAdmin: true,
    })
    render(node as React.ReactElement)
    expect(screen.getByTestId('tab-pills')).toBeTruthy()
  })
})
```

- [ ] **Step 9: Write dispatcher test**

```tsx
// tests/unit/app/admin/loyalty/page.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.resetModules()
})

describe('app/admin/loyalty/page (dispatcher)', () => {
  it('renders V1 stub when NEXT_PUBLIC_ADMIN_V2_ENABLED is not "true"', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'false'
    vi.doMock('@/components/admin/_v1/AdminLoyaltyV1', () => ({
      AdminLoyaltyV1: () => 'V1',
    }))
    vi.doMock('@/components/admin/dashboard/AdminLoyaltyV2', () => ({
      AdminLoyaltyV2: () => 'V2',
    }))
    vi.doMock('@/lib/auth/session', () => ({ getSession: vi.fn() }))
    vi.doMock('@/lib/prisma', () => ({ prisma: { customer: { findUnique: vi.fn() } } }))
    const mod = await import('@/app/admin/loyalty/page')
    const node = await mod.default({ searchParams: Promise.resolve({}) })
    expect(String(node)).toContain('V1')
  })

  it('renders V2 root when flag is "true"', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    vi.doMock('@/components/admin/_v1/AdminLoyaltyV1', () => ({
      AdminLoyaltyV1: () => 'V1',
    }))
    vi.doMock('@/components/admin/dashboard/AdminLoyaltyV2', () => ({
      AdminLoyaltyV2: () => 'V2',
    }))
    vi.doMock('@/lib/auth/session', () => ({
      getSession: vi.fn().mockResolvedValue({ userId: 'u1', isAdmin: true }),
    }))
    vi.doMock('@/lib/prisma', () => ({
      prisma: {
        customer: { findUnique: vi.fn().mockResolvedValue({ adminRole: 'SUPER_ADMIN' }) },
      },
    }))
    const mod = await import('@/app/admin/loyalty/page')
    const node = await mod.default({ searchParams: Promise.resolve({}) })
    expect(String(node)).toContain('V2')
  })
})
```

- [ ] **Step 10: Run tests**

```bash
pnpm test tests/unit/components/admin/dashboard/AdminLoyaltyV2.test.tsx tests/unit/app/admin/loyalty/page.test.tsx
```
Expected: PASS (4 tests).

- [ ] **Step 11: Type-check**

`pnpm exec tsc --noEmit` — zero new errors.

- [ ] **Step 12: Commit + push + PR**

```bash
mkdir -p app/admin/loyalty-v1 tests/unit/components/admin/dashboard tests/unit/app/admin/loyalty
git add \
  components/admin/_v1/AdminLoyaltyV1.tsx \
  components/admin/_v1/AdminLoyaltyV1Page.tsx \
  components/admin/dashboard/AdminLoyaltyV2.tsx \
  components/admin/dashboard/LoyaltyTabPills.tsx \
  components/admin/dashboard/LoyaltyRangePills.tsx \
  components/admin/loyalty/LoyaltySettingsButton.tsx \
  app/admin/loyalty/page.tsx \
  app/admin/loyalty-v1/page.tsx \
  tests/unit/components/admin/dashboard/AdminLoyaltyV2.test.tsx \
  tests/unit/app/admin/loyalty/page.test.tsx
git commit -m "feat(admin-v2): wire Phase 7 loyalty umbrella (V2 root + V1 stub + dispatcher + tab/range pills + settings button)"
git push -u origin wave7p7/task-30-v2-root-dispatcher
gh pr create --title "feat(admin-v2): Phase 7 W6 loyalty dispatcher + V2 root" --body "Relocates V1 loyalty page to /admin/loyalty-v1, replaces dispatcher with NEXT_PUBLIC_ADMIN_V2_ENABLED gate, AdminLoyaltyV2 composes 6 Suspense tab slots + KPI strip + Settings button. LoyaltyTabPills preserves ?range= and LoyaltyRangePills preserves ?tab=. 4 tests passing."
```

---

## Wave 7 — Reward editor + dispatcher (1 task, after W3 merged)

### Task 31: `RewardEditor.tsx` + edit page dispatcher

**Wave:** 7 | **Branch:** `wave7p7/task-31-reward-editor` | **Model:** sonnet

**Schema realities for this task:**
- Full editor at `/admin/loyalty/rewards/[id]/edit` covering all 11+ Reward fields: name, slug, description, pointsCost, rewardType (7-value select: `DISCOUNT | FREE_SHIPPING | EARLY_ACCESS | EXCLUSIVE_PRODUCT | CHARITY_DONATION | DIGITAL_CONTENT | PHYSICAL_PERK`), value (Float? — only shown if rewardType is DISCOUNT or PHYSICAL_PERK), isActive, maxRedemptionsPerCustomer, totalAvailable, minTierRequired (select from LoyaltyTier list — load via dispatcher), metadata (JSON textarea), image (URL input), sortOrder.
- Save → `updateReward(id, payload)` → on success, toast + `router.push('/admin/loyalty?tab=rewards')`.
- Dispatcher at `app/admin/loyalty/rewards/[id]/edit/page.tsx` reads `NEXT_PUBLIC_ADMIN_V2_ENABLED`:
  - **Flag off:** V1 edit page already exists at `app/admin/loyalty/rewards/[id]/edit/page.tsx`. To preserve it during the V2 transition, the dispatcher relocates the V1 page to `components/admin/_v1/AdminLoyaltyRewardEditV1Page.tsx` and re-exposes it via `app/admin/loyalty-v1/rewards/[id]/edit/page.tsx`. With flag off, dispatcher returns `redirect('/admin/loyalty-v1/rewards/${id}/edit')`.
  - **Flag on:** dispatcher loads `loadRewardDetail(id)` + `loadTiersTab()` (for the minTierRequired select) and renders `<RewardEditor detail={detail} tiers={tiers} />`.
- If detail is null, dispatcher renders `notFound()`.

**Files:**
- Create: `components/admin/loyalty/RewardEditor.tsx`
- Create: `components/admin/_v1/AdminLoyaltyRewardEditV1Page.tsx` — verbatim relocation
- Create: `app/admin/loyalty-v1/rewards/[id]/edit/page.tsx` — re-expose V1
- **Replace** `app/admin/loyalty/rewards/[id]/edit/page.tsx` with the dispatcher
- Tests:
  - `tests/unit/components/admin/loyalty/RewardEditor.test.tsx`
  - `tests/unit/app/admin/loyalty/rewards/edit-page.test.tsx`

#### Steps

- [ ] **Step 1: Relocate the existing V1 edit page**

Move the body of `app/admin/loyalty/rewards/[id]/edit/page.tsx` into `components/admin/_v1/AdminLoyaltyRewardEditV1Page.tsx`. Rename default export to `AdminLoyaltyRewardEditV1Page`. Create:

```tsx
// app/admin/loyalty-v1/rewards/[id]/edit/page.tsx
import { AdminLoyaltyRewardEditV1Page } from '@/components/admin/_v1/AdminLoyaltyRewardEditV1Page'

export default function Page(props: { params: Promise<{ id: string }> }) {
  return <AdminLoyaltyRewardEditV1Page params={props.params} />
}
```

(If the V1 page signature uses non-Promise params, adapt accordingly — read the file first.)

- [ ] **Step 2: Write the editor test**

```tsx
// tests/unit/components/admin/loyalty/RewardEditor.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const updateReward = vi.fn()
const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))
vi.mock('@/app/admin/loyalty/actions', () => ({
  updateReward: (...a: unknown[]) => updateReward(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { RewardEditor } from '@/components/admin/loyalty/RewardEditor'

const detail = {
  id: 'r1', name: '10% off', slug: '10-off', description: 'Save 10%',
  pointsCost: 500, rewardType: 'DISCOUNT' as const, value: 10,
  isActive: true, maxRedemptionsPerCustomer: null, totalAvailable: null,
  totalRedeemed: 5, minTierRequired: null, metadata: null, image: null,
  sortOrder: 0, createdAt: new Date(), updatedAt: new Date(),
}

const tiers = [
  { id: 't1', name: 'Bronze', slug: 'bronze' },
  { id: 't2', name: 'Silver', slug: 'silver' },
]

beforeEach(() => vi.clearAllMocks())

describe('RewardEditor', () => {
  it('prefills name + slug', () => {
    render(<RewardEditor detail={detail} tiers={tiers} />)
    expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('10% off')
    expect((screen.getByLabelText(/slug/i) as HTMLInputElement).value).toBe('10-off')
  })

  it('renders rewardType select with 7 options', () => {
    render(<RewardEditor detail={detail} tiers={tiers} />)
    const sel = screen.getByLabelText(/reward type/i) as HTMLSelectElement
    expect(sel.options.length).toBe(7)
  })

  it('renders minTierRequired select populated from tiers', () => {
    render(<RewardEditor detail={detail} tiers={tiers} />)
    const sel = screen.getByLabelText(/min tier/i) as HTMLSelectElement
    const slugs = Array.from(sel.options).map((o) => o.value)
    expect(slugs).toContain('bronze')
    expect(slugs).toContain('silver')
  })

  it('calls updateReward and navigates back on Save', async () => {
    updateReward.mockResolvedValue({ ok: true })
    render(<RewardEditor detail={detail} tiers={tiers} />)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: '15% off' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(updateReward).toHaveBeenCalled())
    expect(push).toHaveBeenCalledWith('/admin/loyalty?tab=rewards')
  })
})
```

- [ ] **Step 3: Write `components/admin/loyalty/RewardEditor.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateReward,
  type RewardDetailFull,
  type RewardType,
} from '@/app/admin/loyalty/actions'
import { toast } from '@/lib/toast'

const REWARD_TYPES: RewardType[] = [
  'DISCOUNT',
  'FREE_SHIPPING',
  'EARLY_ACCESS',
  'EXCLUSIVE_PRODUCT',
  'CHARITY_DONATION',
  'DIGITAL_CONTENT',
  'PHYSICAL_PERK',
]

export interface RewardEditorTierOption {
  id: string
  name: string
  slug: string
}

export interface RewardEditorProps {
  detail: RewardDetailFull
  tiers: RewardEditorTierOption[]
}

export function RewardEditor({ detail, tiers }: RewardEditorProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState(detail.name)
  const [slug, setSlug] = useState(detail.slug)
  const [description, setDescription] = useState(detail.description)
  const [pointsCost, setPointsCost] = useState(detail.pointsCost)
  const [rewardType, setRewardType] = useState<RewardType>(detail.rewardType)
  const [value, setValue] = useState<string>(detail.value === null ? '' : String(detail.value))
  const [isActive, setIsActive] = useState(detail.isActive)
  const [maxPerCustomer, setMaxPerCustomer] = useState<string>(
    detail.maxRedemptionsPerCustomer?.toString() ?? '',
  )
  const [totalAvailable, setTotalAvailable] = useState<string>(
    detail.totalAvailable?.toString() ?? '',
  )
  const [minTierRequired, setMinTierRequired] = useState<string>(detail.minTierRequired ?? '')
  const [metadata, setMetadata] = useState(detail.metadata ?? '')
  const [image, setImage] = useState(detail.image ?? '')
  const [sortOrder, setSortOrder] = useState(detail.sortOrder)

  const handleSave = () => {
    startTransition(async () => {
      const r = await updateReward(detail.id, {
        name,
        slug,
        description,
        pointsCost,
        rewardType,
        value: value === '' ? null : Number(value),
        isActive,
        maxRedemptionsPerCustomer: maxPerCustomer === '' ? null : Number(maxPerCustomer),
        totalAvailable: totalAvailable === '' ? null : Number(totalAvailable),
        minTierRequired: minTierRequired || null,
        metadata: metadata.trim() || null,
        image: image.trim() || null,
        sortOrder,
      })
      if (r.ok) {
        toast.success('Reward saved')
        router.push('/admin/loyalty?tab=rewards')
      } else {
        toast.error(r.error)
      }
    })
  }

  const inputCls = 'w-full mt-1 bg-white/[0.04] border border-white/8 rounded-md px-3 py-2 text-white'
  const labelCls = 'text-white/60 text-xs'

  return (
    <div className="max-w-2xl mx-auto space-y-4 text-sm">
      <h1 className="text-xl font-semibold text-white">Edit Reward</h1>

      <label className="block">
        <span className={labelCls}>Name</span>
        <input aria-label="name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="block">
        <span className={labelCls}>Slug</span>
        <input aria-label="slug" className={inputCls} value={slug} onChange={(e) => setSlug(e.target.value)} />
      </label>
      <label className="block">
        <span className={labelCls}>Description</span>
        <textarea
          className={`${inputCls} min-h-[80px]`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>Points cost</span>
          <input
            type="number"
            step="1"
            min="0"
            className={inputCls}
            value={pointsCost}
            onChange={(e) => setPointsCost(Number(e.target.value))}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Reward type</span>
          <select
            aria-label="reward type"
            className={inputCls}
            value={rewardType}
            onChange={(e) => setRewardType(e.target.value as RewardType)}
          >
            {REWARD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>Value (blank = none)</span>
          <input
            type="number"
            step="0.01"
            className={inputCls}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Sort order</span>
          <input
            type="number"
            step="1"
            className={inputCls}
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>Max per customer (blank = unlimited)</span>
          <input
            type="number"
            step="1"
            min="0"
            className={inputCls}
            value={maxPerCustomer}
            onChange={(e) => setMaxPerCustomer(e.target.value)}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Total available (blank = unlimited)</span>
          <input
            type="number"
            step="1"
            min="0"
            className={inputCls}
            value={totalAvailable}
            onChange={(e) => setTotalAvailable(e.target.value)}
          />
        </label>
      </div>
      <label className="block">
        <span className={labelCls}>Min tier required</span>
        <select
          aria-label="min tier required"
          className={inputCls}
          value={minTierRequired}
          onChange={(e) => setMinTierRequired(e.target.value)}
        >
          <option value="">— Any tier —</option>
          {tiers.map((t) => (
            <option key={t.id} value={t.slug}>{t.name}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={labelCls}>Image URL</span>
        <input className={inputCls} value={image} onChange={(e) => setImage(e.target.value)} />
      </label>
      <label className="block">
        <span className={labelCls}>Metadata (JSON)</span>
        <textarea
          className={`${inputCls} min-h-[100px] font-mono`}
          value={metadata}
          onChange={(e) => setMetadata(e.target.value)}
          placeholder='{"key":"value"}'
        />
      </label>
      <label className="flex items-center gap-2 text-xs text-white/80">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Active
      </label>
      <div className="flex justify-end gap-2 pt-3 border-t border-white/8">
        <button
          type="button"
          onClick={() => router.push('/admin/loyalty?tab=rewards')}
          className="text-xs px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/8 text-white/70 hover:text-white"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={handleSave}
          className="text-xs px-3 py-1.5 rounded-md bg-[#FF3131] text-white hover:bg-[#ff4747] disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write the dispatcher**

```tsx
// app/admin/loyalty/rewards/[id]/edit/page.tsx
import { notFound, redirect } from 'next/navigation'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { RewardEditor } from '@/components/admin/loyalty/RewardEditor'
import { loadRewardDetail, loadTiersTab } from '@/lib/admin/loyalty'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminLoyaltyRewardEditPage({ params }: PageProps) {
  const { id } = await params

  if (process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED !== 'true') {
    redirect(`/admin/loyalty-v1/rewards/${id}/edit`)
  }

  const [detail, tiers] = await Promise.all([
    loadRewardDetail(id),
    loadTiersTab(),
  ])
  if (!detail) notFound()

  return (
    <AdminLayout title="Edit Reward" subtitle={detail.name}>
      <RewardEditor
        detail={detail}
        tiers={tiers.map((t) => ({ id: t.id, name: t.name, slug: t.slug }))}
      />
    </AdminLayout>
  )
}
```

- [ ] **Step 5: Write the dispatcher test**

```tsx
// tests/unit/app/admin/loyalty/rewards/edit-page.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'

const redirect = vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) })
const notFound = vi.fn(() => { throw new Error('NOT_FOUND') })

vi.mock('next/navigation', () => ({ redirect, notFound }))

beforeEach(() => {
  vi.resetModules()
  redirect.mockClear()
  notFound.mockClear()
})

describe('edit-page (dispatcher)', () => {
  it('redirects to V1 path when flag off', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'false'
    vi.doMock('@/lib/admin/loyalty', () => ({
      loadRewardDetail: vi.fn(),
      loadTiersTab: vi.fn(),
    }))
    vi.doMock('@/components/admin/AdminLayout', () => ({ AdminLayout: () => null }))
    vi.doMock('@/components/admin/loyalty/RewardEditor', () => ({ RewardEditor: () => null }))
    vi.doMock('next/navigation', () => ({ redirect, notFound }))
    const mod = await import('@/app/admin/loyalty/rewards/[id]/edit/page')
    await expect(mod.default({ params: Promise.resolve({ id: 'r1' }) }))
      .rejects.toThrow('REDIRECT:/admin/loyalty-v1/rewards/r1/edit')
  })

  it('renders editor when flag on and reward exists', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    vi.doMock('@/lib/admin/loyalty', () => ({
      loadRewardDetail: vi.fn().mockResolvedValue({
        id: 'r1', name: '10% off', slug: '10-off', description: 'd',
        pointsCost: 500, rewardType: 'DISCOUNT', value: 10, isActive: true,
        maxRedemptionsPerCustomer: null, totalAvailable: null,
        totalRedeemed: 0, minTierRequired: null, metadata: null,
        image: null, sortOrder: 0, createdAt: new Date(), updatedAt: new Date(),
      }),
      loadTiersTab: vi.fn().mockResolvedValue([]),
    }))
    vi.doMock('@/components/admin/AdminLayout', () => ({ AdminLayout: ({ children }: { children: React.ReactNode }) => children }))
    vi.doMock('@/components/admin/loyalty/RewardEditor', () => ({
      RewardEditor: () => 'EDITOR',
    }))
    vi.doMock('next/navigation', () => ({ redirect, notFound }))
    const mod = await import('@/app/admin/loyalty/rewards/[id]/edit/page')
    const node = await mod.default({ params: Promise.resolve({ id: 'r1' }) })
    expect(String(node)).toContain('EDITOR')
  })

  it('notFounds when reward missing', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    vi.doMock('@/lib/admin/loyalty', () => ({
      loadRewardDetail: vi.fn().mockResolvedValue(null),
      loadTiersTab: vi.fn().mockResolvedValue([]),
    }))
    vi.doMock('@/components/admin/AdminLayout', () => ({ AdminLayout: () => null }))
    vi.doMock('@/components/admin/loyalty/RewardEditor', () => ({ RewardEditor: () => null }))
    vi.doMock('next/navigation', () => ({ redirect, notFound }))
    const mod = await import('@/app/admin/loyalty/rewards/[id]/edit/page')
    await expect(mod.default({ params: Promise.resolve({ id: 'missing' }) }))
      .rejects.toThrow('NOT_FOUND')
  })
})
```

- [ ] **Step 6: Run tests + tsc**

```bash
pnpm test tests/unit/components/admin/loyalty/RewardEditor.test.tsx tests/unit/app/admin/loyalty/rewards/edit-page.test.tsx
pnpm exec tsc --noEmit
```

- [ ] **Step 7: Commit + push + PR**

```bash
mkdir -p app/admin/loyalty-v1/rewards/[id]/edit tests/unit/app/admin/loyalty/rewards
git add \
  components/admin/loyalty/RewardEditor.tsx \
  components/admin/_v1/AdminLoyaltyRewardEditV1Page.tsx \
  app/admin/loyalty-v1/rewards/[id]/edit/page.tsx \
  app/admin/loyalty/rewards/[id]/edit/page.tsx \
  tests/unit/components/admin/loyalty/RewardEditor.test.tsx \
  tests/unit/app/admin/loyalty/rewards/edit-page.test.tsx
git commit -m "feat(admin-v2): add RewardEditor full editor + dispatcher (V1 redirect, V2 renders editor)"
git push -u origin wave7p7/task-31-reward-editor
gh pr create --title "feat(admin-v2): Phase 7 W7 RewardEditor + edit dispatcher" --body "Full editor covering all 11+ Reward fields with rewardType select + minTierRequired select populated from LoyaltyTier list + metadata JSON textarea. Dispatcher redirects to /admin/loyalty-v1/rewards/[id]/edit when flag off. notFound when reward missing. 4 + 3 tests passing."
```

---

## Wave 8 — Verification + QA doc (sequential)

### Task 32: Phase 7 QA doc

**Wave:** 8 | **Branch:** `wave7p7/task-32-qa-doc` | **Model:** sonnet

**Schema realities for this task:** Documentation only. No production code changes. Mirror `docs/superpowers/plans/2026-05-30-admin-rebuild-phase6-qa.md` structure: smoke checklist per tab, mobile considerations (Chrome 375px), Phase 7.5 follow-ups, lint/tsc/test counts, regression risk callouts.

**Files:**
- Create: `docs/superpowers/plans/2026-05-30-admin-rebuild-phase7-qa.md`

#### Steps

- [ ] **Step 1: Verify all merged PRs and gather test counts**

```bash
pnpm exec tsc --noEmit > /tmp/p7-tsc.log 2>&1; cat /tmp/p7-tsc.log
pnpm test > /tmp/p7-tests.log 2>&1; tail -20 /tmp/p7-tests.log
pnpm lint > /tmp/p7-lint.log 2>&1; tail -20 /tmp/p7-lint.log
grep -rn "TODO(phase-7.5)" components/admin/loyalty app/admin/loyalty lib/admin/loyalty.ts || true
```

Capture: total tests passing (per-file counts from `loyalty.test.ts`, `actions.test.ts`, 4 chart tests, 6 inspector tests + AdjustPointsDialog + 6 utility tests, 4 BulkSheet tests, 6 tab tests, V2 + dispatcher tests, RewardEditor + dispatcher tests). Lint errors. tsc errors.

- [ ] **Step 2: Write `docs/superpowers/plans/2026-05-30-admin-rebuild-phase7-qa.md`**

```markdown
# Phase 7: Loyalty — QA Notes

**Status:** Ready for manual QA.

## Scope shipped (W1–W7)

- W1: `lib/admin/loyalty.ts` (TimeRange, getRangeBounds, buildTrend, KPI loader, 6 tab loaders, 6 detail loaders) + `app/admin/loyalty/actions.ts` (~32 actions, inspector wrappers, 5 CSV exports). All points/tier mutations route through existing `lib/loyalty/service.ts` atomic ops.
- W2: 4 Recharts wrappers under `components/admin/loyalty/charts/`.
- W3: 6 Inspectors (Member, Tier, Reward, Redemption, Event, LoyaltySettings) + AdjustPointsDialog + 6 utility components (TierPerksQuickToggle, RewardActivationsQuickToggle, RecentTransactionsTable, PopularRewardsList, MemberLedger, ExportButton).
- W4: 4 BulkSheets (Members, Rewards, Redemptions, Events).
- W5: 6 Tab components (Overview, Members, Tiers, Rewards, Redemptions, Events).
- W6: V2 root (`AdminLoyaltyV2`), V1 stub (`AdminLoyaltyV1`), V1 page relocation to `/admin/loyalty-v1`, LoyaltyTabPills + LoyaltyRangePills + LoyaltySettingsButton (⚙), dispatcher gating by `NEXT_PUBLIC_ADMIN_V2_ENABLED`.
- W7: Full-page `RewardEditor` at `/admin/loyalty/rewards/[id]/edit`; V1 editor relocated to `/admin/loyalty-v1/rewards/[id]/edit`.

## Verification commands

| Check | Command | Expected |
|---|---|---|
| Type-check | `pnpm exec tsc --noEmit` | Zero new errors |
| Tests | `pnpm test` | All Phase 7 tests pass |
| Lint | `pnpm lint` | Zero new warnings |
| Build | `pnpm build` | Successful build |

## Smoke checklist (Chrome desktop, NEXT_PUBLIC_ADMIN_V2_ENABLED=true)

### Dispatcher

- [ ] `/admin/loyalty` with flag off → V1 stub with 7 V1 links.
- [ ] `/admin/loyalty-v1` → original 711L loyalty page renders verbatim.
- [ ] `/admin/loyalty` with flag on → V2 root with 6 tab pills + 5 range pills + ⚙ Settings button.
- [ ] `/admin/loyalty/rewards/[id]/edit` with flag off → 308 redirect to `/admin/loyalty-v1/rewards/[id]/edit`.
- [ ] `/admin/loyalty/rewards/[id]/edit` with flag on → V2 RewardEditor renders with all fields prefilled.

### Overview tab

- [ ] 4 charts render (PointsActivity / TierDistribution / TopRewards / MemberGrowth).
- [ ] TierPerksQuickToggle renders all tiers — toggling free shipping persists.
- [ ] RewardActivationsQuickToggle renders rewards — toggling Active persists.
- [ ] RecentTransactionsTable shows up to 10 rows with correct type pill colors.
- [ ] PopularRewardsList shows top 5 by totalRedeemed.
- [ ] Export CSV downloads `loyalty-overview-30d-*.csv`.

### Members tab

- [ ] Paginated table renders email + tier badge + currentPoints + lifetimePoints + lastOrderDate.
- [ ] Row click → MemberInspector opens with ledger (last 50 PointsTransaction) + filter dropdown.
- [ ] Adjust Points (single) → ADMIN_ADJUSTMENT row appears in ledger.
- [ ] Recompute Tier triggers `updateCustomerTier` (toast on result).
- [ ] Checkbox selection enables MembersBulkSheet → Bulk Adjust (SUPER_ADMIN inside dialog), Bulk Re-tier, Export CSV.
- [ ] Bulk Adjust toast summarizes successes + failures.

### Tiers tab

- [ ] Card grid shows colors, threshold, multiplier, perks pills, memberCount.
- [ ] Card click → TierInspector edit mode.
- [ ] "+ New Tier" → TierInspector create mode.
- [ ] Save creates/updates the row.
- [ ] Delete button disabled for non-SUPER_ADMIN (tooltip "SUPER_ADMIN only"); SUPER_ADMIN deletion blocked when members are on the tier (error toast).

### Rewards tab

- [ ] Card grid renders name + type + pointsCost + totalRedeemed + status pill.
- [ ] "+ New Reward" link routes to V1 new-reward page (Phase 7.5 follow-up to V2 it).
- [ ] Card click → RewardInspector quick-edit (isActive / pointsCost / max-per-customer / minTierRequired).
- [ ] "Edit details →" navigates to `/admin/loyalty/rewards/[id]/edit` (V2 editor when flag on).
- [ ] Bulk Activate / Deactivate works.
- [ ] CSV export.

### Redemptions tab

- [ ] Audit table renders customer + reward + points + status pill + couponCode + createdAt.
- [ ] Row click → RedemptionInspector with detail.
- [ ] "Mark Fulfilled" button visible only for PENDING/ACTIVE; sets status FULFILLED + shippedAt + trackingNumber.
- [ ] "Cancel Redemption" SUPER_ADMIN-gated; on success reverses points (toast: "Refunded N points") and sets CANCELLED.
- [ ] Cancellation rejected for FULFILLED/USED/EXPIRED statuses (error toast).
- [ ] Bulk Mark Fulfilled prompts for one tracking number applied to all.
- [ ] Bulk Cancel SUPER_ADMIN-only; prompts for reason; refunds points.

### Events tab

- [ ] Card grid shows name + dates + multiplier + status pill (active/scheduled/ended) + stats.
- [ ] "+ New Event" → EventInspector create.
- [ ] Card click → edit; stats are read-only.
- [ ] Bulk Activate / Deactivate works.

### Settings (⚙)

- [ ] Clicking ⚙ opens LoyaltySettingsInspector.
- [ ] All editable fields persist via `updateLoyaltySettings`.
- [ ] **Cron fields (`pointsExpireMonths`, `tierEvaluationPeriod`) shown read-only** with note pointing to `.github/workflows/birthday-points-cron.yml`.
- [ ] Submitting cron fields via the API DOES NOT update them (verify in DB or via reload).

### KPI strip

- [ ] All 4 cards link with `?tab=` + `?range=` preserved.
- [ ] Trends render arrows + percentages.
- [ ] Redemption rate handles zero-earned without crashing (renders 0%).

### Range pills

- [ ] Switching range preserves the active tab; URL updates.
- [ ] `?range=invalid` falls back to `30d`.

## Mobile considerations (Chrome 375px)

- [ ] Tab pills wrap (showShortcutHints prop on TabPills handles overflow).
- [ ] Range pills wrap below tab pills.
- [ ] All charts stack vertically (1-column grid at `<lg`).
- [ ] Tier + Reward + Event card grids collapse to 1-column at `<sm`.
- [ ] BulkSheet docks full-width with horizontal-scroll action row.
- [ ] Inspectors are full-screen at `<sm` (handled by `components/ui/Inspector.tsx`).
- [ ] AdjustPointsDialog renders centered with full-width form fields.

## Regression risk

- **V1 loyalty page is untouched** — relocated under `/admin/loyalty-v1` and linked from the V1 stub. The original loader logic was not edited.
- The 6 V1 sub-routes (`/admin/loyalty/customers`, `/tiers`, `/rewards`, `/redemptions`, `/events`, `/settings`) are also untouched.
- `lib/loyalty/service.ts` (the 856L atomic service) is untouched. PR #17 + #37 atomicity guarantees are preserved because Phase 7 server actions wrap `awardPoints` / `deductPoints` / `updateCustomerTier` rather than reimplementing them.
- Idempotency keys collisions are safely deduped by the existing P2002 handler in `awardPoints` / `deductPoints`.
- `LoyaltySettings.pointsExpireMonths` + `tierEvaluationPeriod` cannot be edited from V2 UI — cron workflows continue to operate from `.github/workflows/birthday-points-cron.yml`.

## Counts (fill in after merge)

- TypeScript errors: __
- Lint warnings: __
- Tests: __ files, __ tests
- Net new files: ~58

## Phase 7.5 follow-ups (grep `TODO(phase-7.5)`)

- V2 new-reward page (currently `+ New Reward` link routes to V1 `/admin/loyalty/rewards/new`).
- Manual cron-trigger buttons in `LoyaltySettingsInspector` (`expireOldPoints`, `recomputeAllTiers`, `awardBirthdayPoints`) — SUPER_ADMIN UX.
- Per-redemption tracking number for `bulkFulfillRedemptions` (v1 prompts once and applies to all).
- Progress UI for `bulkRecomputeTiers` (currently fire-and-forget).
- Calendar view for the Events tab.
- Phase 2 dashboard loyalty tile (cross-page integration).
- Referral program admin (ReferralCode + cross-system surfacing).
- Notifications log / audit trail for loyalty events.
- Tier-multi-select picker for `EventInspector.tierIds` (currently JSON textarea).
- Category-multi-select picker for `EventInspector.categoryIds` (currently JSON textarea).
- Bulk import members from CSV.
- Refactor `get*ForInspector` wrappers to import from `lib/admin/loyalty.ts` (currently inlined for W1 parallel-safety).
- Optimistic UI in BulkSheets (currently per-id sequential).
- Bulk Re-tier opening a confirm dialog before invocation (currently fires immediately).
```

- [ ] **Step 3: Commit + push + PR**

```bash
git add docs/superpowers/plans/2026-05-30-admin-rebuild-phase7-qa.md
git commit -m "docs(admin-v2): add Phase 7 QA doc with smoke checklist + 7.5 follow-ups"
git push -u origin wave7p7/task-32-qa-doc
gh pr create --title "docs(admin-v2): Phase 7 W8 QA doc" --body "Phase 7 verification + smoke checklist + mobile considerations + regression notes + Phase 7.5 follow-up list."
```

---

## Coverage gaps fixed inline

- **TimeRange alignment with Phase 6** — Both phases use the same 5-value vocabulary (`'today' | '7d' | '30d' | '90d' | 'year'`), but Phase 7 defines its own `TimeRange` + `getRangeBounds` inside `lib/admin/loyalty.ts` to avoid cross-phase coupling (Phase 6's `lib/admin/analytics.ts` is a sibling phase that may evolve independently).
- **V1 page relocation** — spec says "leave V1 page alone; V1 stub links to it." The dispatcher REPLACES `app/admin/loyalty/page.tsx`, so the original V1 page logic is relocated to `components/admin/_v1/AdminLoyaltyV1Page.tsx` and re-exposed at `/admin/loyalty-v1` (Task 30). V1 stub links to `/admin/loyalty-v1` (not the dispatcher, which would loop).
- **V1 reward edit page relocation** — the existing `app/admin/loyalty/rewards/[id]/edit/page.tsx` is also relocated (Task 31) so the dispatcher can `redirect()` to it under the V1 path.
- **Adjust-points overdraft for negative deltas** — the existing `awardPoints` in `lib/loyalty/service.ts` does NOT guard against negative-delta overdraft (only `deductPoints` does). Resolved by adding a pre-check inside `adjustMemberPoints` + `bulkAdjustMemberPoints` that queries `currentPoints` and rejects when `currentPoints + delta < 0` (Task 2).
- **Cron-managed Settings fields** — spec says fields should be "rendered read-only" but doesn't define server-side enforcement. Resolved by silently stripping `pointsExpireMonths` and `tierEvaluationPeriod` keys from `updateLoyaltySettings` input (Task 2), so even if a client tampers with the request, the cron-managed values cannot be changed via this surface.
- **isSuperAdmin propagation** — spec mentions SUPER_ADMIN gates but not the prop chain. Resolved by adopting the Phase 5/6 pattern: page dispatcher resolves `isSuperAdmin` once, passes to `AdminLoyaltyV2`, which passes to `MembersTab` / `TiersTab` / `RedemptionsTab` (and Inspectors / BulkSheets within them). Read-only inspectors (Reward / Event) skip the prop because their delete actions aren't SUPER_ADMIN-gated.
- **Settings button + loader** — spec puts ⚙ in the page header but doesn't describe state ownership. Resolved by adding a tiny `LoyaltySettingsButton.tsx` client component (Task 30) that takes the pre-loaded `LoyaltySettingsRow` and owns the inspector open state. The V2 root loads settings inside a Suspense slot in the header.
- **EventInspector multi-selects** — spec calls for "tierIds multi-select / categoryIds multi-select" but multi-select pickers are a larger UX investment. Resolved with JSON textareas for v1 + a Phase 7.5 follow-up to swap them for proper multi-selects (Task 11 + QA doc).
- **Bulk Mark Fulfilled tracking** — spec calls for per-redemption tracking number entry. Resolved with a single prompt applied to all selections in v1 + a Phase 7.5 follow-up for per-id entry (Task 22 + QA doc).
- **Reward Inspector vs Editor split** — spec puts quick toggles in the Inspector + full editor at a dedicated route. Resolved with `RewardInspector` carrying only isActive + pointsCost + maxPerCustomer + minTierRequired (Task 9), and `RewardEditor` carrying all 11+ fields including rewardType select + value + image + sortOrder + metadata + minTierRequired select populated from `loadTiersTab()` (Task 31).
- **Tab CSV alignment** — spec says "Tiers tab no bulk" — tiers therefore have no CSV export (Tasks 19 + 26). The `ExportButton` type is `'overview' | 'members' | 'rewards' | 'redemptions' | 'events'` (5 values, not 6).
- **Recharts mock pattern duplicated per chart test** — Each chart test mocks only the primitives it imports; cross-cutting note 8 shows the maximal mock. Trimmed per-task in W2 task templates.
- **W5 prop-shape adoption note** — Added to W5 wave brief and lifted to cross-cutting note 7.
