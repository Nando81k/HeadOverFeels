# Phase 5: Marketing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new V2 /admin/marketing umbrella page with 5 tabs (Promotions/Popups/Subscribers/Campaigns/Abandoned Carts), full-page editors for Newsletter Campaigns and Popups, all gated behind NEXT_PUBLIC_ADMIN_V2_ENABLED, with zero schema migrations.

**Architecture:** Server-rendered V2 page composition mirroring Phase 2/3/4 pattern (TabPills + KPI strip + filter bar + per-tab Suspense slots). Page dispatcher gates V1 (stub linking to existing V1 pages) vs V2 by env flag at list page AND both editor URLs. Generic MarketingListTable + MarketingListCardMobile with CVA per-tab column variants. All ~40 server actions wrap existing V1 API route logic (zero duplication of newsletter send, popup tracking, etc.). Five Inspectors with different scopes (full edit for Promotion/Popup/Campaign; read-only + unsubscribe/delete for Subscriber; cart contents + 3 action buttons for AbandonedCart).

**Tech Stack:** Next.js 16 App Router, React 19 (RSC + Server Actions + Suspense + useOptimistic), TypeScript strict, Prisma 6 + Neon, Tailwind v4 (@theme — direct dark colors only, no `dark:` modifiers), Framer Motion, Phosphor icons, Sonner toasts (via `lib/toast.ts`), class-variance-authority, Resend (already integrated at `lib/email/resend.ts`), durable EmailQueue from commit 3553baf, Vitest 4.1.7 + @testing-library/react + jsdom (Phase 1 harness).

---

## Cross-cutting agent notes (read once, applies to every task)

These are hard-won lessons from Phase 3/4. Re-read them whenever you start a new task:

1. **No Prisma in the client bundle.** Client components (`'use client'`) must ONLY use `import type` from `lib/admin/marketing.ts`. Any value-import needed by a client component goes through a `'use server'` action wrapper in `app/admin/marketing/actions.ts`. The 5 `get*ForInspector` actions are the canonical wrappers — agents must use these, NOT raw loaders. **PR #92 hotfix is the precedent.**
2. **No `dark:` Tailwind modifiers.** V2 admin is always-dark with no `dark` class on `<html>`. Use direct colors like `bg-neutral-900/60`, `border-white/8`, `text-white/50`, `text-white/30`. **PR #93 hotfix is the precedent.**
3. **`PaginatedResult` shape is `{ items, total, page, pageSize }`** — destructure `.items` (NOT `.rows`). All loaders return this shape.
4. **Vitest 4.1.7 generics: use 1-arg `vi.fn<T>()`** (or zero-arg with `mockResolvedValue`). The two-arg `vi.fn<[Args], Return>()` form from Vitest 1.x triggers TS2558. The Phase 3 `ProductsListView` test still has 4 TS errors from this — don't repeat it.
5. **`requireAdmin()` has two overloads** in `lib/auth/admin.ts`: `requireAdmin(request)` for API routes (returns customer object) and `requireAdmin()` no-arg for server actions (returns userId string). Use no-arg in actions. `requireAdminRole('SUPER_ADMIN')` for `deleteSubscriber` + `bulkDeleteSubscribers` (PII deletion gate).
6. **Wave 1 parallel-safe inline queries.** Wave 1 has data layer (Task 1) + server actions (Task 2) running in parallel. Task 2's `get*ForInspector` wrappers MUST inline their Prisma queries (don't import from `lib/admin/marketing.ts` which is being built simultaneously in Task 1). Phase 4 Wave 2 Task 3 precedent. Refactor deferred to Phase 5.5.
7. **Wave 5 ListView agents adopt verified prop shapes** from merged W3 + W4 PRs, not the plan prose. Phase 4 Wave 5 precedent — agents shipped different prop names than the plan prose; tests-as-source-of-truth pattern worked. Read the merged Inspector + BulkSheet prop signatures and adopt them verbatim; the plan prose is approximate.

---

## Wave summary

| Wave | Tasks | Parallel? | Model | Depends on |
|------|-------|-----------|-------|------------|
| W1   | 1, 2 | 2 parallel | sonnet | none (no schema work) |
| W2   | 3, 4 | 2 parallel | sonnet | W1 |
| W3   | 5, 6, 7, 8, 9 | 5 parallel | sonnet | W1 |
| W4   | 10, 11, 12, 13, 14 | 5 parallel | sonnet | W1 |
| W5   | 15, 16, 17, 18, 19 | 5 parallel | sonnet | W2 + W3 + W4 |
| W6   | 20 | sequential | **opus** | W5 |
| W7   | 21, 22, 23 | 3 parallel | sonnet | W2 + W3 (practically: after W6) |
| W8   | 24 | sequential | sonnet | W6 + W7 |

Total: **24 tasks** across **8 waves**.

---

## Wave 1 — Data layer + server actions (2 parallel)

### Task 1: `lib/admin/marketing.ts` data layer

**Wave:** 1 | **Parallel-safe with:** Task 2 | **Branch:** `wave5p5/task-1-data-layer` | **Model:** sonnet

**Schema realities for this task:**
- `Promotion.code` is nullable String (single code per promotion). `Promotion.productIds`, `Promotion.collectionIds`, `Promotion.customerEmails` are all nullable strings — likely JSON/comma-separated. Surface as `string | null` in the row shape; let the editor parse.
- `Promotion.totalDiscountGiven` is the lifetime $ figure used by the KPI delta. `Promotion.usedCount` is the lifetime redemption count used by the row's "Used" column.
- `PromotionType` enum: `PERCENTAGE | FIXED_AMOUNT | FREE_SHIPPING | BOGO | BUY_X_GET_Y`.
- `MarketingPopup` has FK `promotionId` (nullable). `PopupAnalytics` has `impressions, clicks, dismissals, conversions` per day per variant. The popup conversions 7d KPI sums `conversions` from `PopupAnalytics` rows where `date >= now() - 7 days`.
- `PopupTemplate`: `MODAL | BANNER | SLIDE_IN | FULL_SCREEN | EMAIL_CAPTURE`. `PopupPosition`: 7 values. `PopupTrigger`: `DELAY | SCROLL | EXIT_INTENT | IMMEDIATE`. `PopupFrequency`: `ONCE_PER_SESSION | ONCE_PER_DAY | ONCE_EVER | ALWAYS`.
- `NewsletterSubscriber.isActive` is the boolean we display ("Active"/"Unsubscribed"). `subscriberDeltaPct` KPI compares last 7 days of new subscribers vs the prior 7 days.
- `NewsletterCampaign.audienceFilter` is JSON. `audienceCount` is the snapshot count. `sentCount` + `failedCount` are populated after send. `status` is `DRAFT | QUEUED | SENDING | SENT | FAILED`.
- `AbandonedCart.items` is a String (likely JSON-serialized) — parse with `JSON.parse` defensively (try/catch → `[]`). `AbandonedCart.recovered` boolean. `cartsToRecover` KPI counts `recovered = false AND expiresAt > now()`.
- `EmailQueue` is the durable queue from commit 3553baf — `lib/email/queue.ts` exports `enqueueEmail`. Data layer does NOT touch it (writes happen in actions).

**Files:**
- Create: `lib/admin/marketing.ts`
- Test: `tests/unit/lib/admin/marketing.test.ts`

#### Steps

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/lib/admin/marketing.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const promotionFindMany = vi.fn()
const promotionCount = vi.fn()
const promotionAggregate = vi.fn()
const promotionFindUnique = vi.fn()
const popupFindMany = vi.fn()
const popupCount = vi.fn()
const popupFindUnique = vi.fn()
const popupAnalyticsAggregate = vi.fn()
const subscriberFindMany = vi.fn()
const subscriberCount = vi.fn()
const subscriberFindUnique = vi.fn()
const campaignFindMany = vi.fn()
const campaignCount = vi.fn()
const campaignFindUnique = vi.fn()
const cartFindMany = vi.fn()
const cartCount = vi.fn()
const cartFindUnique = vi.fn()
const deliveryFindMany = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    promotion: { findMany: promotionFindMany, count: promotionCount, aggregate: promotionAggregate, findUnique: promotionFindUnique },
    marketingPopup: { findMany: popupFindMany, count: popupCount, findUnique: popupFindUnique },
    popupAnalytics: { aggregate: popupAnalyticsAggregate },
    newsletterSubscriber: { findMany: subscriberFindMany, count: subscriberCount, findUnique: subscriberFindUnique },
    newsletterCampaign: { findMany: campaignFindMany, count: campaignCount, findUnique: campaignFindUnique },
    newsletterCampaignDelivery: { findMany: deliveryFindMany },
    abandonedCart: { findMany: cartFindMany, count: cartCount, findUnique: cartFindUnique },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('loadMarketingKpis', () => {
  it('aggregates active promotions, popup conversions 7d, subscriber count + delta, carts to recover', async () => {
    promotionCount.mockResolvedValueOnce(3) // activePromotions
    popupAnalyticsAggregate.mockResolvedValueOnce({ _sum: { conversions: 42 } })
    subscriberCount
      .mockResolvedValueOnce(1000) // total active
      .mockResolvedValueOnce(50)   // last 7 days
      .mockResolvedValueOnce(40)   // prior 7 days
    cartCount.mockResolvedValueOnce(7) // cartsToRecover

    const { loadMarketingKpis } = await import('@/lib/admin/marketing')
    const k = await loadMarketingKpis()

    expect(k.activePromotions).toBe(3)
    expect(k.popupConversions7d).toBe(42)
    expect(k.subscriberCount).toBe(1000)
    expect(k.subscriberDeltaPct).toBeCloseTo(25, 0) // (50-40)/40 * 100
    expect(k.cartsToRecover).toBe(7)
  })

  it('treats null conversion sum as 0', async () => {
    promotionCount.mockResolvedValue(0)
    popupAnalyticsAggregate.mockResolvedValue({ _sum: { conversions: null } })
    subscriberCount.mockResolvedValue(0)
    cartCount.mockResolvedValue(0)
    const { loadMarketingKpis } = await import('@/lib/admin/marketing')
    const k = await loadMarketingKpis()
    expect(k.popupConversions7d).toBe(0)
    expect(k.subscriberDeltaPct).toBe(0)
  })
})

describe('loadPromotionsTab', () => {
  it('returns paginated promotion rows', async () => {
    promotionFindMany.mockResolvedValue([
      {
        id: 'p1', name: 'Summer 20', code: 'SUMMER20', type: 'PERCENTAGE',
        value: 20, isActive: true, usedCount: 12, maxUsesTotal: 100,
        startDate: new Date('2026-05-01'), endDate: new Date('2026-06-01'),
        totalDiscountGiven: 1234.5, autoApply: false, stackable: false,
        createdAt: new Date('2026-05-01'),
      },
    ])
    promotionCount.mockResolvedValue(1)
    const { loadPromotionsTab } = await import('@/lib/admin/marketing')
    const r = await loadPromotionsTab()
    expect(r.items).toHaveLength(1)
    expect(r.items[0]).toMatchObject({
      id: 'p1', name: 'Summer 20', code: 'SUMMER20',
      type: 'PERCENTAGE', value: 20, isActive: true,
      usedCount: 12, totalDiscountGiven: 1234.5,
    })
    expect(r.total).toBe(1)
    expect(r.page).toBe(1)
    expect(r.pageSize).toBe(25)
  })

  it('filters by isActive when provided', async () => {
    promotionFindMany.mockResolvedValue([])
    promotionCount.mockResolvedValue(0)
    const { loadPromotionsTab } = await import('@/lib/admin/marketing')
    await loadPromotionsTab({ isActive: true })
    expect(promotionFindMany.mock.calls[0][0].where.isActive).toBe(true)
  })
})

describe('loadPopupsTab', () => {
  it('returns paginated popup rows with last-7d analytics', async () => {
    popupFindMany.mockResolvedValue([
      {
        id: 'pp1', name: 'Welcome modal', template: 'MODAL', position: 'CENTER',
        triggerType: 'DELAY', isActive: true, priority: 1,
        startDate: null, endDate: null, createdAt: new Date('2026-05-01'),
        analytics: [
          { impressions: 100, clicks: 20, conversions: 5, dismissals: 30 },
          { impressions: 200, clicks: 40, conversions: 10, dismissals: 50 },
        ],
      },
    ])
    popupCount.mockResolvedValue(1)
    const { loadPopupsTab } = await import('@/lib/admin/marketing')
    const r = await loadPopupsTab()
    expect(r.items[0]).toMatchObject({
      id: 'pp1', name: 'Welcome modal', template: 'MODAL',
      impressions7d: 300, conversions7d: 15,
    })
  })
})

describe('loadSubscribersTab', () => {
  it('returns paginated subscriber rows', async () => {
    subscriberFindMany.mockResolvedValue([
      {
        id: 's1', email: 'ada@e.com', source: 'popup', sourceDetails: null,
        isActive: true, isVerified: true, createdAt: new Date('2026-05-01'),
        unsubscribedAt: null, utmSource: 'google',
      },
    ])
    subscriberCount.mockResolvedValue(1)
    const { loadSubscribersTab } = await import('@/lib/admin/marketing')
    const r = await loadSubscribersTab()
    expect(r.items[0]).toMatchObject({
      id: 's1', email: 'ada@e.com', source: 'popup', isActive: true, isVerified: true,
    })
  })
})

describe('loadCampaignsTab', () => {
  it('returns paginated campaign rows', async () => {
    campaignFindMany.mockResolvedValue([
      {
        id: 'c1', name: 'May newsletter', subject: 'Hello May',
        status: 'SENT', audienceCount: 1000, sentCount: 990, failedCount: 10,
        sentAt: new Date('2026-05-15'), createdAt: new Date('2026-05-10'),
      },
    ])
    campaignCount.mockResolvedValue(1)
    const { loadCampaignsTab } = await import('@/lib/admin/marketing')
    const r = await loadCampaignsTab()
    expect(r.items[0]).toMatchObject({
      id: 'c1', subject: 'Hello May', status: 'SENT',
      audienceCount: 1000, sentCount: 990, failedCount: 10,
    })
  })

  it('filters by status when provided', async () => {
    campaignFindMany.mockResolvedValue([])
    campaignCount.mockResolvedValue(0)
    const { loadCampaignsTab } = await import('@/lib/admin/marketing')
    await loadCampaignsTab({ status: 'DRAFT' })
    expect(campaignFindMany.mock.calls[0][0].where.status).toBe('DRAFT')
  })
})

describe('loadAbandonedCartsTab', () => {
  it('returns paginated cart rows with parsed item counts', async () => {
    cartFindMany.mockResolvedValue([
      {
        id: 'ac1', customerEmail: 'lost@e.com', customerName: 'Lost',
        items: JSON.stringify([{ id: 'x', quantity: 2 }]),
        totalValue: 89.99, itemCount: 2,
        recovered: false, recoveryEmailSent: false,
        abandonedAt: new Date('2026-05-20'), expiresAt: new Date('2026-06-20'),
        discountCode: null,
      },
    ])
    cartCount.mockResolvedValue(1)
    const { loadAbandonedCartsTab } = await import('@/lib/admin/marketing')
    const r = await loadAbandonedCartsTab()
    expect(r.items[0]).toMatchObject({
      id: 'ac1', customerEmail: 'lost@e.com', totalValue: 89.99,
      itemCount: 2, recovered: false,
    })
  })

  it('only includes non-recovered carts by default', async () => {
    cartFindMany.mockResolvedValue([])
    cartCount.mockResolvedValue(0)
    const { loadAbandonedCartsTab } = await import('@/lib/admin/marketing')
    await loadAbandonedCartsTab()
    expect(cartFindMany.mock.calls[0][0].where.recovered).toBe(false)
  })
})

describe('loadPromotionDetail', () => {
  it('returns null when not found', async () => {
    promotionFindUnique.mockResolvedValue(null)
    const { loadPromotionDetail } = await import('@/lib/admin/marketing')
    expect(await loadPromotionDetail('missing')).toBeNull()
  })

  it('returns full detail with parsed targeting arrays', async () => {
    promotionFindUnique.mockResolvedValue({
      id: 'p1', name: 'Summer 20', description: 'Summer sale', code: 'SUMMER20',
      type: 'PERCENTAGE', value: 20, autoApply: false, stackable: false,
      minimumPurchase: 50, maxUsesTotal: 100, maxUsesPerCustomer: 1,
      usedCount: 12, productIds: null, collectionIds: null, customerEmails: null,
      startDate: new Date('2026-05-01'), endDate: new Date('2026-06-01'),
      isActive: true, maxDiscountPercent: null, excludeFromLoyalty: false,
      totalDiscountGiven: 1234.5, createdAt: new Date('2026-05-01'),
      updatedAt: new Date('2026-05-01'),
    })
    const { loadPromotionDetail } = await import('@/lib/admin/marketing')
    const d = await loadPromotionDetail('p1')
    expect(d?.id).toBe('p1')
    expect(d?.code).toBe('SUMMER20')
    expect(d?.value).toBe(20)
  })
})

describe('loadPopupDetail', () => {
  it('returns full detail with variants and 7-day analytics rollup', async () => {
    popupFindUnique.mockResolvedValue({
      id: 'pp1', name: 'Welcome', template: 'MODAL', position: 'CENTER',
      content: '{}', triggerType: 'DELAY', triggerValue: 3,
      showOnPages: 'all', showToNewVisitors: true, showToReturning: false,
      frequency: 'ONCE_PER_SESSION', startDate: null, endDate: null,
      isActive: true, priority: 1, promotionId: null,
      createdAt: new Date('2026-05-01'), updatedAt: new Date('2026-05-01'),
      variants: [
        { id: 'v1', popupId: 'pp1', name: 'A', content: '{}', weight: 50, isActive: true,
          createdAt: new Date(), updatedAt: new Date() },
      ],
      analytics: [
        { impressions: 100, clicks: 20, dismissals: 30, conversions: 5 },
      ],
    })
    const { loadPopupDetail } = await import('@/lib/admin/marketing')
    const d = await loadPopupDetail('pp1')
    expect(d?.id).toBe('pp1')
    expect(d?.variants).toHaveLength(1)
    expect(d?.analytics7d).toMatchObject({ impressions: 100, conversions: 5 })
  })
})

describe('loadSubscriberDetail', () => {
  it('returns full subscriber detail', async () => {
    subscriberFindUnique.mockResolvedValue({
      id: 's1', email: 'ada@e.com', source: 'popup', sourceDetails: 'modal-A',
      isActive: true, isVerified: true, verifiedAt: new Date('2026-05-01'),
      unsubscribedAt: null, unsubscribeReason: null,
      utmSource: 'google', utmMedium: 'cpc', utmCampaign: 'spring',
      createdAt: new Date('2026-05-01'), updatedAt: new Date('2026-05-01'),
    })
    const { loadSubscriberDetail } = await import('@/lib/admin/marketing')
    const d = await loadSubscriberDetail('s1')
    expect(d?.email).toBe('ada@e.com')
    expect(d?.utmSource).toBe('google')
  })
})

describe('loadCampaignDetail', () => {
  it('returns campaign detail with delivery rollup', async () => {
    campaignFindUnique.mockResolvedValue({
      id: 'c1', name: 'May', subject: 'Hello May', preheader: 'Hi',
      heroImageUrl: null, ctaLabel: 'Shop', ctaUrl: '/shop',
      bodyMarkdown: 'Body', status: 'SENT',
      audienceFilter: { activeOnly: true }, audienceCount: 1000,
      sentCount: 990, failedCount: 10, createdByAdminId: 'a1',
      sentAt: new Date('2026-05-15'), createdAt: new Date('2026-05-10'),
      updatedAt: new Date('2026-05-15'),
    })
    deliveryFindMany.mockResolvedValue([
      { id: 'd1', email: 'a@e.com', status: 'SENT', isTest: true, sentAt: new Date(),
        providerMessageId: 'm1', errorMessage: null },
    ])
    const { loadCampaignDetail } = await import('@/lib/admin/marketing')
    const d = await loadCampaignDetail('c1')
    expect(d?.subject).toBe('Hello May')
    expect(d?.recentTestDeliveries).toHaveLength(1)
  })
})

describe('loadAbandonedCartDetail', () => {
  it('returns cart detail with parsed items', async () => {
    cartFindUnique.mockResolvedValue({
      id: 'ac1', customerId: null, customerEmail: 'lost@e.com', customerName: 'Lost',
      items: JSON.stringify([{ productName: 'Tee', quantity: 2, price: 25 }]),
      totalValue: 50, itemCount: 2,
      recoveryEmailSent: false, recoveryEmailSentAt: null,
      recovered: false, recoveredAt: null, recoveryOrderId: null,
      abandonedAt: new Date('2026-05-20'), expiresAt: new Date('2026-06-20'),
      discountCode: null,
    })
    const { loadAbandonedCartDetail } = await import('@/lib/admin/marketing')
    const d = await loadAbandonedCartDetail('ac1')
    expect(d?.items).toHaveLength(1)
    expect(d?.items[0]).toMatchObject({ productName: 'Tee', quantity: 2, price: 25 })
  })

  it('tolerates malformed items JSON', async () => {
    cartFindUnique.mockResolvedValue({
      id: 'ac2', customerId: null, customerEmail: 'x@e.com', customerName: null,
      items: 'not-json',
      totalValue: 0, itemCount: 0,
      recoveryEmailSent: false, recoveryEmailSentAt: null,
      recovered: false, recoveredAt: null, recoveryOrderId: null,
      abandonedAt: new Date(), expiresAt: new Date(),
      discountCode: null,
    })
    const { loadAbandonedCartDetail } = await import('@/lib/admin/marketing')
    const d = await loadAbandonedCartDetail('ac2')
    expect(d?.items).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/admin/marketing.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/admin/marketing.ts`**

```ts
// lib/admin/marketing.ts
//
// Single source of truth for Phase 5 marketing data shapes and Prisma queries.
// All loaders are pure async functions called from Server Components.
//
// Schema adaptations:
//   - Promotion.code is nullable; surface as string|null on rows.
//   - AbandonedCart.items is a String (likely JSON-serialized); parse defensively.
//   - PopupAnalytics is daily granularity; sum last 7 days for KPI/row figures.

import { prisma } from '@/lib/prisma'
import type {
  PromotionType,
  PopupTemplate,
  PopupPosition,
  PopupTrigger,
  PopupFrequency,
  NewsletterCampaignStatus,
  NewsletterDeliveryStatus,
} from '@prisma/client'

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

export interface PromotionsFilters {
  search?: string
  type?: PromotionType
  isActive?: boolean
  page?: number
  pageSize?: number
}

export interface PopupsFilters {
  search?: string
  template?: PopupTemplate
  isActive?: boolean
  page?: number
  pageSize?: number
}

export interface SubscribersFilters {
  search?: string
  isActive?: boolean
  source?: string
  page?: number
  pageSize?: number
}

export interface CampaignsFilters {
  search?: string
  status?: NewsletterCampaignStatus
  page?: number
  pageSize?: number
}

export interface CartsFilters {
  search?: string
  recovered?: boolean
  hasRecoveryEmail?: boolean
  page?: number
  pageSize?: number
}

// ============================================================
// Row shapes
// ============================================================

export interface PromotionRow {
  id: string
  name: string
  code: string | null
  type: PromotionType
  value: number
  isActive: boolean
  usedCount: number
  maxUsesTotal: number | null
  startDate: Date
  endDate: Date | null
  totalDiscountGiven: number
  autoApply: boolean
  stackable: boolean
  createdAt: Date
}

export interface PopupRow {
  id: string
  name: string
  template: PopupTemplate
  position: PopupPosition
  triggerType: PopupTrigger
  isActive: boolean
  priority: number
  impressions7d: number
  conversions7d: number
  startDate: Date | null
  endDate: Date | null
  createdAt: Date
}

export interface SubscriberRow {
  id: string
  email: string
  source: string
  sourceDetails: string | null
  isActive: boolean
  isVerified: boolean
  createdAt: Date
  unsubscribedAt: Date | null
  utmSource: string | null
}

export interface CampaignRow {
  id: string
  name: string | null
  subject: string
  status: NewsletterCampaignStatus
  audienceCount: number
  sentCount: number
  failedCount: number
  sentAt: Date | null
  createdAt: Date
}

export interface AbandonedCartRow {
  id: string
  customerEmail: string
  customerName: string | null
  totalValue: number
  itemCount: number
  recovered: boolean
  recoveryEmailSent: boolean
  abandonedAt: Date
  expiresAt: Date
  discountCode: string | null
}

// ============================================================
// KPI shape
// ============================================================

export interface MarketingKpiData {
  activePromotions: number
  popupConversions7d: number
  subscriberCount: number
  subscriberDeltaPct: number
  cartsToRecover: number
}

// ============================================================
// Detail shapes
// ============================================================

export interface PromotionDetailFull {
  id: string
  name: string
  description: string | null
  code: string | null
  type: PromotionType
  value: number
  autoApply: boolean
  stackable: boolean
  minimumPurchase: number
  maxUsesTotal: number | null
  maxUsesPerCustomer: number | null
  usedCount: number
  productIds: string | null
  collectionIds: string | null
  customerEmails: string | null
  startDate: Date
  endDate: Date | null
  isActive: boolean
  maxDiscountPercent: number | null
  excludeFromLoyalty: boolean
  totalDiscountGiven: number
  createdAt: Date
  updatedAt: Date
}

export interface PopupVariantDetail {
  id: string
  popupId: string
  name: string
  content: string | null
  weight: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface PopupAnalyticsRollup {
  impressions: number
  clicks: number
  dismissals: number
  conversions: number
}

export interface PopupDetailFull {
  id: string
  name: string
  template: PopupTemplate
  position: PopupPosition
  content: string
  triggerType: PopupTrigger
  triggerValue: number
  showOnPages: string
  showToNewVisitors: boolean
  showToReturning: boolean
  frequency: PopupFrequency
  startDate: Date | null
  endDate: Date | null
  isActive: boolean
  priority: number
  promotionId: string | null
  createdAt: Date
  updatedAt: Date
  variants: PopupVariantDetail[]
  analytics7d: PopupAnalyticsRollup
}

export interface SubscriberDetailFull {
  id: string
  email: string
  source: string
  sourceDetails: string | null
  isActive: boolean
  isVerified: boolean
  verifiedAt: Date | null
  unsubscribedAt: Date | null
  unsubscribeReason: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CampaignDeliveryRow {
  id: string
  email: string
  status: NewsletterDeliveryStatus
  isTest: boolean
  sentAt: Date
  providerMessageId: string | null
  errorMessage: string | null
}

export interface CampaignDetailFull {
  id: string
  name: string | null
  subject: string
  preheader: string
  heroImageUrl: string | null
  ctaLabel: string
  ctaUrl: string
  bodyMarkdown: string
  status: NewsletterCampaignStatus
  audienceFilter: unknown
  audienceCount: number
  sentCount: number
  failedCount: number
  createdByAdminId: string
  sentAt: Date | null
  createdAt: Date
  updatedAt: Date
  recentTestDeliveries: CampaignDeliveryRow[]
}

export interface AbandonedCartItem {
  productName: string
  quantity: number
  price: number
  productImage?: string | null
  variantDetails?: string | null
}

export interface AbandonedCartDetailFull {
  id: string
  customerId: string | null
  customerEmail: string
  customerName: string | null
  items: AbandonedCartItem[]
  totalValue: number
  itemCount: number
  recoveryEmailSent: boolean
  recoveryEmailSentAt: Date | null
  recovered: boolean
  recoveredAt: Date | null
  recoveryOrderId: string | null
  abandonedAt: Date
  expiresAt: Date
  discountCode: string | null
}

// ============================================================
// Helpers
// ============================================================

function sevenDaysAgo(): Date {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d
}

function fourteenDaysAgo(): Date {
  const d = new Date()
  d.setDate(d.getDate() - 14)
  return d
}

function safeParseItems(raw: string | null | undefined): AbandonedCartItem[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.map((it: Record<string, unknown>) => ({
        productName: String(it.productName ?? it.name ?? 'Item'),
        quantity: Number(it.quantity ?? 1),
        price: Number(it.price ?? 0),
        productImage: (it.productImage as string | undefined) ?? null,
        variantDetails: (it.variantDetails as string | undefined) ?? null,
      }))
    }
    return []
  } catch {
    return []
  }
}

// ============================================================
// KPI loader
// ============================================================

export async function loadMarketingKpis(): Promise<MarketingKpiData> {
  const last7 = sevenDaysAgo()
  const prior14 = fourteenDaysAgo()

  const [
    activePromotions,
    popupAgg,
    subscriberCount,
    last7Subs,
    prior7Subs,
    cartsToRecover,
  ] = await Promise.all([
    prisma.promotion.count({ where: { isActive: true } }),
    prisma.popupAnalytics.aggregate({
      where: { date: { gte: last7 } },
      _sum: { conversions: true },
    }),
    prisma.newsletterSubscriber.count({ where: { isActive: true } }),
    prisma.newsletterSubscriber.count({ where: { createdAt: { gte: last7 } } }),
    prisma.newsletterSubscriber.count({
      where: { createdAt: { gte: prior14, lt: last7 } },
    }),
    prisma.abandonedCart.count({
      where: { recovered: false, expiresAt: { gt: new Date() } },
    }),
  ])

  const deltaPct = prior7Subs === 0
    ? (last7Subs > 0 ? 100 : 0)
    : ((last7Subs - prior7Subs) / prior7Subs) * 100

  return {
    activePromotions,
    popupConversions7d: popupAgg._sum.conversions ?? 0,
    subscriberCount,
    subscriberDeltaPct: deltaPct,
    cartsToRecover,
  }
}

// ============================================================
// Tab loaders
// ============================================================

export async function loadPromotionsTab(
  filters: PromotionsFilters = {},
): Promise<PaginatedResult<PromotionRow>> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  const where: Record<string, unknown> = {}
  if (filters.isActive !== undefined) where.isActive = filters.isActive
  if (filters.type) where.type = filters.type
  if (filters.search) {
    const s = filters.search.trim()
    where.OR = [
      { name: { contains: s, mode: 'insensitive' as const } },
      { code: { contains: s, mode: 'insensitive' as const } },
    ]
  }

  const [raw, total] = await Promise.all([
    prisma.promotion.findMany({
      where, orderBy: { createdAt: 'desc' }, skip, take: pageSize,
    }),
    prisma.promotion.count({ where }),
  ])

  const items: PromotionRow[] = raw.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    type: p.type,
    value: Number(p.value),
    isActive: p.isActive,
    usedCount: p.usedCount,
    maxUsesTotal: p.maxUsesTotal ?? null,
    startDate: p.startDate,
    endDate: p.endDate,
    totalDiscountGiven: Number(p.totalDiscountGiven ?? 0),
    autoApply: p.autoApply,
    stackable: p.stackable,
    createdAt: p.createdAt,
  }))
  return { items, total, page, pageSize }
}

export async function loadPopupsTab(
  filters: PopupsFilters = {},
): Promise<PaginatedResult<PopupRow>> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize
  const last7 = sevenDaysAgo()

  const where: Record<string, unknown> = {}
  if (filters.isActive !== undefined) where.isActive = filters.isActive
  if (filters.template) where.template = filters.template
  if (filters.search) {
    where.name = { contains: filters.search.trim(), mode: 'insensitive' as const }
  }

  const [raw, total] = await Promise.all([
    prisma.marketingPopup.findMany({
      where, orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      skip, take: pageSize,
      include: {
        analytics: {
          where: { date: { gte: last7 } },
          select: { impressions: true, clicks: true, conversions: true, dismissals: true },
        },
      },
    }),
    prisma.marketingPopup.count({ where }),
  ])

  const items: PopupRow[] = raw.map((p) => {
    const imp = p.analytics.reduce((s, a) => s + (a.impressions ?? 0), 0)
    const conv = p.analytics.reduce((s, a) => s + (a.conversions ?? 0), 0)
    return {
      id: p.id,
      name: p.name,
      template: p.template,
      position: p.position,
      triggerType: p.triggerType,
      isActive: p.isActive,
      priority: p.priority,
      impressions7d: imp,
      conversions7d: conv,
      startDate: p.startDate,
      endDate: p.endDate,
      createdAt: p.createdAt,
    }
  })
  return { items, total, page, pageSize }
}

export async function loadSubscribersTab(
  filters: SubscribersFilters = {},
): Promise<PaginatedResult<SubscriberRow>> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  const where: Record<string, unknown> = {}
  if (filters.isActive !== undefined) where.isActive = filters.isActive
  if (filters.source) where.source = filters.source
  if (filters.search) {
    where.email = { contains: filters.search.trim(), mode: 'insensitive' as const }
  }

  const [raw, total] = await Promise.all([
    prisma.newsletterSubscriber.findMany({
      where, orderBy: { createdAt: 'desc' }, skip, take: pageSize,
    }),
    prisma.newsletterSubscriber.count({ where }),
  ])

  const items: SubscriberRow[] = raw.map((s) => ({
    id: s.id,
    email: s.email,
    source: s.source,
    sourceDetails: s.sourceDetails ?? null,
    isActive: s.isActive,
    isVerified: s.isVerified,
    createdAt: s.createdAt,
    unsubscribedAt: s.unsubscribedAt,
    utmSource: s.utmSource ?? null,
  }))
  return { items, total, page, pageSize }
}

export async function loadCampaignsTab(
  filters: CampaignsFilters = {},
): Promise<PaginatedResult<CampaignRow>> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  const where: Record<string, unknown> = {}
  if (filters.status) where.status = filters.status
  if (filters.search) {
    const s = filters.search.trim()
    where.OR = [
      { subject: { contains: s, mode: 'insensitive' as const } },
      { name: { contains: s, mode: 'insensitive' as const } },
    ]
  }

  const [raw, total] = await Promise.all([
    prisma.newsletterCampaign.findMany({
      where, orderBy: { createdAt: 'desc' }, skip, take: pageSize,
    }),
    prisma.newsletterCampaign.count({ where }),
  ])

  const items: CampaignRow[] = raw.map((c) => ({
    id: c.id,
    name: c.name ?? null,
    subject: c.subject,
    status: c.status,
    audienceCount: c.audienceCount,
    sentCount: c.sentCount,
    failedCount: c.failedCount,
    sentAt: c.sentAt,
    createdAt: c.createdAt,
  }))
  return { items, total, page, pageSize }
}

export async function loadAbandonedCartsTab(
  filters: CartsFilters = {},
): Promise<PaginatedResult<AbandonedCartRow>> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  const where: Record<string, unknown> = {
    recovered: filters.recovered ?? false,
  }
  if (filters.hasRecoveryEmail !== undefined) {
    where.recoveryEmailSent = filters.hasRecoveryEmail
  }
  if (filters.search) {
    where.customerEmail = {
      contains: filters.search.trim(), mode: 'insensitive' as const,
    }
  }

  const [raw, total] = await Promise.all([
    prisma.abandonedCart.findMany({
      where, orderBy: { abandonedAt: 'desc' }, skip, take: pageSize,
    }),
    prisma.abandonedCart.count({ where }),
  ])

  const items: AbandonedCartRow[] = raw.map((c) => ({
    id: c.id,
    customerEmail: c.customerEmail,
    customerName: c.customerName ?? null,
    totalValue: Number(c.totalValue),
    itemCount: c.itemCount,
    recovered: c.recovered,
    recoveryEmailSent: c.recoveryEmailSent,
    abandonedAt: c.abandonedAt,
    expiresAt: c.expiresAt,
    discountCode: c.discountCode ?? null,
  }))
  return { items, total, page, pageSize }
}

// ============================================================
// Detail loaders
// ============================================================

export async function loadPromotionDetail(id: string): Promise<PromotionDetailFull | null> {
  const p = await prisma.promotion.findUnique({ where: { id } })
  if (!p) return null
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    code: p.code,
    type: p.type,
    value: Number(p.value),
    autoApply: p.autoApply,
    stackable: p.stackable,
    minimumPurchase: Number(p.minimumPurchase ?? 0),
    maxUsesTotal: p.maxUsesTotal ?? null,
    maxUsesPerCustomer: p.maxUsesPerCustomer ?? null,
    usedCount: p.usedCount,
    productIds: p.productIds ?? null,
    collectionIds: p.collectionIds ?? null,
    customerEmails: p.customerEmails ?? null,
    startDate: p.startDate,
    endDate: p.endDate,
    isActive: p.isActive,
    maxDiscountPercent: p.maxDiscountPercent ?? null,
    excludeFromLoyalty: p.excludeFromLoyalty,
    totalDiscountGiven: Number(p.totalDiscountGiven ?? 0),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }
}

export async function loadPopupDetail(id: string): Promise<PopupDetailFull | null> {
  const last7 = sevenDaysAgo()
  const p = await prisma.marketingPopup.findUnique({
    where: { id },
    include: {
      variants: { orderBy: { createdAt: 'asc' } },
      analytics: { where: { date: { gte: last7 } } },
    },
  })
  if (!p) return null

  const rollup: PopupAnalyticsRollup = p.analytics.reduce(
    (acc, a) => ({
      impressions: acc.impressions + (a.impressions ?? 0),
      clicks: acc.clicks + (a.clicks ?? 0),
      dismissals: acc.dismissals + (a.dismissals ?? 0),
      conversions: acc.conversions + (a.conversions ?? 0),
    }),
    { impressions: 0, clicks: 0, dismissals: 0, conversions: 0 },
  )

  return {
    id: p.id,
    name: p.name,
    template: p.template,
    position: p.position,
    content: p.content,
    triggerType: p.triggerType,
    triggerValue: p.triggerValue,
    showOnPages: p.showOnPages,
    showToNewVisitors: p.showToNewVisitors,
    showToReturning: p.showToReturning,
    frequency: p.frequency,
    startDate: p.startDate,
    endDate: p.endDate,
    isActive: p.isActive,
    priority: p.priority,
    promotionId: p.promotionId ?? null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    variants: p.variants.map((v) => ({
      id: v.id, popupId: v.popupId, name: v.name, content: v.content ?? null,
      weight: v.weight, isActive: v.isActive,
      createdAt: v.createdAt, updatedAt: v.updatedAt,
    })),
    analytics7d: rollup,
  }
}

export async function loadSubscriberDetail(id: string): Promise<SubscriberDetailFull | null> {
  const s = await prisma.newsletterSubscriber.findUnique({ where: { id } })
  if (!s) return null
  return {
    id: s.id,
    email: s.email,
    source: s.source,
    sourceDetails: s.sourceDetails ?? null,
    isActive: s.isActive,
    isVerified: s.isVerified,
    verifiedAt: s.verifiedAt,
    unsubscribedAt: s.unsubscribedAt,
    unsubscribeReason: s.unsubscribeReason ?? null,
    utmSource: s.utmSource ?? null,
    utmMedium: s.utmMedium ?? null,
    utmCampaign: s.utmCampaign ?? null,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }
}

export async function loadCampaignDetail(id: string): Promise<CampaignDetailFull | null> {
  const c = await prisma.newsletterCampaign.findUnique({ where: { id } })
  if (!c) return null
  const recent = await prisma.newsletterCampaignDelivery.findMany({
    where: { campaignId: id, isTest: true },
    orderBy: { sentAt: 'desc' },
    take: 10,
  })
  return {
    id: c.id,
    name: c.name ?? null,
    subject: c.subject,
    preheader: c.preheader,
    heroImageUrl: c.heroImageUrl ?? null,
    ctaLabel: c.ctaLabel,
    ctaUrl: c.ctaUrl,
    bodyMarkdown: c.bodyMarkdown,
    status: c.status,
    audienceFilter: c.audienceFilter,
    audienceCount: c.audienceCount,
    sentCount: c.sentCount,
    failedCount: c.failedCount,
    createdByAdminId: c.createdByAdminId,
    sentAt: c.sentAt,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    recentTestDeliveries: recent.map((d) => ({
      id: d.id, email: d.email, status: d.status, isTest: d.isTest,
      sentAt: d.sentAt, providerMessageId: d.providerMessageId ?? null,
      errorMessage: d.errorMessage ?? null,
    })),
  }
}

export async function loadAbandonedCartDetail(id: string): Promise<AbandonedCartDetailFull | null> {
  const c = await prisma.abandonedCart.findUnique({ where: { id } })
  if (!c) return null
  return {
    id: c.id,
    customerId: c.customerId ?? null,
    customerEmail: c.customerEmail,
    customerName: c.customerName ?? null,
    items: safeParseItems(c.items),
    totalValue: Number(c.totalValue),
    itemCount: c.itemCount,
    recoveryEmailSent: c.recoveryEmailSent,
    recoveryEmailSentAt: c.recoveryEmailSentAt,
    recovered: c.recovered,
    recoveredAt: c.recoveredAt,
    recoveryOrderId: c.recoveryOrderId ?? null,
    abandonedAt: c.abandonedAt,
    expiresAt: c.expiresAt,
    discountCode: c.discountCode ?? null,
  }
}

// ============================================================
// Tab constants
// ============================================================

export const MARKETING_TABS = [
  'promotions',
  'popups',
  'subscribers',
  'campaigns',
  'carts',
] as const
export type MarketingTab = (typeof MARKETING_TABS)[number]

export function isMarketingTab(v: unknown): v is MarketingTab {
  return typeof v === 'string' && (MARKETING_TABS as readonly string[]).includes(v)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/lib/admin/marketing.test.ts`
Expected: PASS — 13 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add lib/admin/marketing.ts tests/unit/lib/admin/marketing.test.ts
git commit -m "feat(admin-v2): add marketing data layer with KPI + 5 tab loaders + 5 detail loaders"
git push -u origin wave5p5/task-1-data-layer
gh pr create --title "feat(admin-v2): Phase 5 W1 marketing data layer" --body "Adds lib/admin/marketing.ts: KPI loader (active promotions, popup conversions 7d, subscriber count with weekly delta, carts to recover) plus 5 tab loaders returning PaginatedResult<RowShape> and 5 detail loaders returning *DetailFull|null. Includes defensive JSON parsing for AbandonedCart.items. 13 tests passing."
```

---

### Task 2: `app/admin/marketing/actions.ts` server actions

**Wave:** 1 | **Parallel-safe with:** Task 1 | **Branch:** `wave5p5/task-2-server-actions` | **Model:** sonnet

**Schema realities for this task:**
- `requireAdmin()` no-arg returns the admin's userId (Customer.id) string. Use that for `createdByAdminId` on campaigns and as the `createdById` on any audit-style writes.
- `requireAdminRole('SUPER_ADMIN')` is the PII deletion gate for `deleteSubscriber` and `bulkDeleteSubscribers`.
- `lib/email/queue.ts` exports `enqueueEmail({ type, recipient, payload })`. Use this for `sendCartRecoveryEmail` and `sendCampaignTest` — never call Resend directly.
- `Promotion.code` UNIQUE constraint can collide. `suggestPromotionCode` generates a random 8-char alphanumeric without writing. `createPromotion` and `generateCartRecoveryCode` retry on P2002 up to 5 times.
- `generateCartRecoveryCode` writes inside `$transaction`: creates a `Promotion` (FIXED_AMOUNT discount, scoped to `customerEmails: cart.customerEmail`, single use), then writes `AbandonedCart.discountCode` with the generated code.
- `markCartRecovered` only requires `requireAdmin()`. Sets `recovered: true, recoveredAt: now()`. Does NOT clear `discountCode`.
- `duplicateCampaign` copies the source campaign with `status = DRAFT, sentAt = null, sentCount = 0, failedCount = 0` and a `name` of `"Copy of <subject>"`.
- `deleteCampaign` returns `{ ok: false, error }` if `status !== 'DRAFT'`. Same for `bulkDeleteCampaigns` — silently skip non-drafts and report `affected` as the drafts-only count.
- **PARALLEL-SAFETY (note #6):** `get*ForInspector` actions inline their Prisma queries — do NOT import loaders from `@/lib/admin/marketing` (that module is being built simultaneously in Task 1).
- `revalidatePath('/admin/marketing')` after every mutation. Editor saves additionally revalidate the editor URL.

**Files:**
- Create: `app/admin/marketing/actions.ts`
- Test: `tests/unit/app/admin/marketing/actions.test.ts`

#### Steps

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/app/admin/marketing/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const requireAdmin = vi.fn(async () => 'admin-1')
const requireAdminRole = vi.fn(async () => 'admin-1')
const revalidatePath = vi.fn()
const enqueueEmail = vi.fn(async () => ({ id: 'q1' }))

const promotionCreate = vi.fn()
const promotionUpdate = vi.fn()
const promotionUpdateMany = vi.fn()
const promotionDeleteMany = vi.fn()
const promotionFindUnique = vi.fn()
const promotionDelete = vi.fn()
const popupUpdate = vi.fn()
const popupUpdateMany = vi.fn()
const popupDelete = vi.fn()
const popupDeleteMany = vi.fn()
const popupCreate = vi.fn()
const popupFindUnique = vi.fn()
const subscriberUpdate = vi.fn()
const subscriberUpdateMany = vi.fn()
const subscriberDeleteMany = vi.fn()
const subscriberDelete = vi.fn()
const subscriberFindMany = vi.fn()
const subscriberFindUnique = vi.fn()
const campaignCreate = vi.fn()
const campaignUpdate = vi.fn()
const campaignDelete = vi.fn()
const campaignDeleteMany = vi.fn()
const campaignFindUnique = vi.fn()
const campaignFindMany = vi.fn()
const cartUpdate = vi.fn()
const cartUpdateMany = vi.fn()
const cartFindUnique = vi.fn()
const cartFindMany = vi.fn()
const variantCreate = vi.fn()
const variantUpdate = vi.fn()
const variantDelete = vi.fn()
const transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn({
  promotion: { create: promotionCreate },
  abandonedCart: { update: cartUpdate },
}))

vi.mock('@/lib/auth/admin', () => ({
  requireAdmin: () => requireAdmin(),
  requireAdminRole: (r: string) => requireAdminRole(r),
}))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/email/queue', () => ({ enqueueEmail }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    promotion: {
      create: promotionCreate, update: promotionUpdate, updateMany: promotionUpdateMany,
      deleteMany: promotionDeleteMany, findUnique: promotionFindUnique, delete: promotionDelete,
    },
    marketingPopup: {
      create: popupCreate, update: popupUpdate, updateMany: popupUpdateMany,
      delete: popupDelete, deleteMany: popupDeleteMany, findUnique: popupFindUnique,
    },
    popupVariant: { create: variantCreate, update: variantUpdate, delete: variantDelete },
    newsletterSubscriber: {
      update: subscriberUpdate, updateMany: subscriberUpdateMany,
      deleteMany: subscriberDeleteMany, delete: subscriberDelete,
      findMany: subscriberFindMany, findUnique: subscriberFindUnique,
    },
    newsletterCampaign: {
      create: campaignCreate, update: campaignUpdate, delete: campaignDelete,
      deleteMany: campaignDeleteMany, findUnique: campaignFindUnique, findMany: campaignFindMany,
    },
    abandonedCart: {
      update: cartUpdate, updateMany: cartUpdateMany,
      findUnique: cartFindUnique, findMany: cartFindMany,
    },
    $transaction: transaction,
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Promotions ────────────────────────────────────────────────────────────────

describe('createPromotion', () => {
  it('writes a row and revalidates', async () => {
    promotionCreate.mockResolvedValue({ id: 'p1' })
    const { createPromotion } = await import('@/app/admin/marketing/actions')
    const r = await createPromotion({
      name: 'Summer 20', type: 'PERCENTAGE', value: 20,
      code: 'SUMMER20', startDate: new Date(), isActive: true,
    })
    expect(r).toEqual({ ok: true, data: { id: 'p1' } })
    expect(revalidatePath).toHaveBeenCalledWith('/admin/marketing')
  })

  it('retries on unique collision up to 5 times', async () => {
    let calls = 0
    promotionCreate.mockImplementation(async () => {
      calls += 1
      if (calls < 3) {
        const err = new Error('unique') as Error & { code?: string }
        err.code = 'P2002'
        throw err
      }
      return { id: 'p1' }
    })
    const { createPromotion } = await import('@/app/admin/marketing/actions')
    const r = await createPromotion({
      name: 'X', type: 'PERCENTAGE', value: 10,
      code: 'DUPE', startDate: new Date(), isActive: true,
    })
    expect(r.ok).toBe(true)
    expect(calls).toBe(3)
  })
})

describe('togglePromotionActive', () => {
  it('flips isActive', async () => {
    promotionFindUnique.mockResolvedValue({ id: 'p1', isActive: true })
    promotionUpdate.mockResolvedValue({ id: 'p1', isActive: false })
    const { togglePromotionActive } = await import('@/app/admin/marketing/actions')
    const r = await togglePromotionActive('p1')
    expect(r.ok).toBe(true)
    expect(promotionUpdate).toHaveBeenCalledWith({
      where: { id: 'p1' }, data: { isActive: false },
    })
  })
})

describe('suggestPromotionCode', () => {
  it('returns an 8-char alphanumeric without writing', async () => {
    const { suggestPromotionCode } = await import('@/app/admin/marketing/actions')
    const r = await suggestPromotionCode()
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data?.code).toMatch(/^[A-Z0-9]{8}$/)
    }
    expect(promotionCreate).not.toHaveBeenCalled()
  })
})

describe('checkPromotionCodeUnique', () => {
  it('returns unique=true when no row matches', async () => {
    promotionFindUnique.mockResolvedValue(null)
    const { checkPromotionCodeUnique } = await import('@/app/admin/marketing/actions')
    const r = await checkPromotionCodeUnique('NEW')
    expect(r).toEqual({ ok: true, data: { unique: true } })
  })

  it('returns unique=false when a row exists', async () => {
    promotionFindUnique.mockResolvedValue({ id: 'p1' })
    const { checkPromotionCodeUnique } = await import('@/app/admin/marketing/actions')
    const r = await checkPromotionCodeUnique('TAKEN')
    expect(r).toEqual({ ok: true, data: { unique: false } })
  })
})

describe('bulkActivatePromotions', () => {
  it('returns affected count', async () => {
    promotionUpdateMany.mockResolvedValue({ count: 3 })
    const { bulkActivatePromotions } = await import('@/app/admin/marketing/actions')
    const r = await bulkActivatePromotions(['p1', 'p2', 'p3'])
    expect(r).toEqual({ ok: true, affected: 3 })
  })

  it('rejects empty selection', async () => {
    const { bulkActivatePromotions } = await import('@/app/admin/marketing/actions')
    const r = await bulkActivatePromotions([])
    expect(r.ok).toBe(false)
  })
})

// ─── Popups ────────────────────────────────────────────────────────────────────

describe('togglePopupActive', () => {
  it('flips isActive', async () => {
    popupFindUnique.mockResolvedValue({ id: 'pp1', isActive: false })
    popupUpdate.mockResolvedValue({ id: 'pp1', isActive: true })
    const { togglePopupActive } = await import('@/app/admin/marketing/actions')
    const r = await togglePopupActive('pp1')
    expect(r.ok).toBe(true)
  })
})

describe('duplicatePopup', () => {
  it('creates a new popup with " (copy)" suffix and isActive=false', async () => {
    popupFindUnique.mockResolvedValue({
      id: 'pp1', name: 'Welcome', template: 'MODAL', position: 'CENTER',
      content: '{}', triggerType: 'DELAY', triggerValue: 3,
      showOnPages: 'all', showToNewVisitors: true, showToReturning: true,
      frequency: 'ONCE_PER_SESSION', startDate: null, endDate: null,
      isActive: true, priority: 1, promotionId: null,
    })
    popupCreate.mockResolvedValue({ id: 'pp2' })
    const { duplicatePopup } = await import('@/app/admin/marketing/actions')
    const r = await duplicatePopup('pp1')
    expect(r).toEqual({ ok: true, data: { id: 'pp2' } })
    expect(popupCreate.mock.calls[0][0].data.name).toBe('Welcome (copy)')
    expect(popupCreate.mock.calls[0][0].data.isActive).toBe(false)
  })
})

// ─── Subscribers ──────────────────────────────────────────────────────────────

describe('unsubscribeSubscriber', () => {
  it('sets isActive=false + unsubscribedAt', async () => {
    subscriberUpdate.mockResolvedValue({ id: 's1', isActive: false })
    const { unsubscribeSubscriber } = await import('@/app/admin/marketing/actions')
    const r = await unsubscribeSubscriber('s1')
    expect(r.ok).toBe(true)
    expect(subscriberUpdate.mock.calls[0][0].data.isActive).toBe(false)
    expect(subscriberUpdate.mock.calls[0][0].data.unsubscribedAt).toBeInstanceOf(Date)
  })
})

describe('deleteSubscriber', () => {
  it('requires SUPER_ADMIN', async () => {
    subscriberDelete.mockResolvedValue({ id: 's1' })
    const { deleteSubscriber } = await import('@/app/admin/marketing/actions')
    await deleteSubscriber('s1')
    expect(requireAdminRole).toHaveBeenCalledWith('SUPER_ADMIN')
  })
})

describe('bulkExportSubscribersCsv', () => {
  it('returns CSV string with email,source,isActive,createdAt columns', async () => {
    subscriberFindMany.mockResolvedValue([
      { id: 's1', email: 'a@e.com', source: 'popup', isActive: true,
        createdAt: new Date('2026-05-01') },
      { id: 's2', email: 'b@e.com', source: 'footer', isActive: false,
        createdAt: new Date('2026-05-02') },
    ])
    const { bulkExportSubscribersCsv } = await import('@/app/admin/marketing/actions')
    const r = await bulkExportSubscribersCsv(['s1', 's2'])
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data?.csv).toContain('email,source,isActive,createdAt')
      expect(r.data?.csv).toContain('a@e.com,popup,true')
      expect(r.data?.csv).toContain('b@e.com,footer,false')
    }
  })
})

// ─── Campaigns ────────────────────────────────────────────────────────────────

describe('createCampaignDraft', () => {
  it('records createdByAdminId from requireAdmin', async () => {
    requireAdmin.mockResolvedValueOnce('admin-7')
    campaignCreate.mockResolvedValue({ id: 'c1' })
    const { createCampaignDraft } = await import('@/app/admin/marketing/actions')
    await createCampaignDraft({
      subject: 'Hi', preheader: 'P', ctaLabel: 'Shop', ctaUrl: '/',
      bodyMarkdown: 'Body', audienceFilter: { activeOnly: true },
    })
    expect(campaignCreate.mock.calls[0][0].data.createdByAdminId).toBe('admin-7')
    expect(campaignCreate.mock.calls[0][0].data.status).toBe('DRAFT')
  })
})

describe('duplicateCampaign', () => {
  it('clones source with status=DRAFT and "Copy of" prefix', async () => {
    campaignFindUnique.mockResolvedValue({
      id: 'c1', name: 'May', subject: 'Hello May', preheader: 'Hi',
      heroImageUrl: null, ctaLabel: 'Shop', ctaUrl: '/',
      bodyMarkdown: 'Body', audienceFilter: { activeOnly: true },
    })
    campaignCreate.mockResolvedValue({ id: 'c2' })
    const { duplicateCampaign } = await import('@/app/admin/marketing/actions')
    const r = await duplicateCampaign('c1')
    expect(r).toEqual({ ok: true, data: { id: 'c2' } })
    expect(campaignCreate.mock.calls[0][0].data.status).toBe('DRAFT')
    expect(campaignCreate.mock.calls[0][0].data.name).toBe('Copy of Hello May')
    expect(campaignCreate.mock.calls[0][0].data.sentCount).toBe(0)
  })
})

describe('deleteCampaign', () => {
  it('refuses to delete non-DRAFT campaigns', async () => {
    campaignFindUnique.mockResolvedValue({ id: 'c1', status: 'SENT' })
    const { deleteCampaign } = await import('@/app/admin/marketing/actions')
    const r = await deleteCampaign('c1')
    expect(r.ok).toBe(false)
  })

  it('deletes DRAFT campaigns', async () => {
    campaignFindUnique.mockResolvedValue({ id: 'c1', status: 'DRAFT' })
    campaignDelete.mockResolvedValue({ id: 'c1' })
    const { deleteCampaign } = await import('@/app/admin/marketing/actions')
    const r = await deleteCampaign('c1')
    expect(r.ok).toBe(true)
  })
})

describe('sendCampaignTest', () => {
  it('enqueues a test email via EmailQueue', async () => {
    campaignFindUnique.mockResolvedValue({
      id: 'c1', subject: 'Hi', preheader: 'P', heroImageUrl: null,
      ctaLabel: 'Shop', ctaUrl: '/', bodyMarkdown: 'B',
    })
    const { sendCampaignTest } = await import('@/app/admin/marketing/actions')
    const r = await sendCampaignTest('c1', 'tester@e.com')
    expect(r.ok).toBe(true)
    expect(enqueueEmail).toHaveBeenCalledWith(expect.objectContaining({
      type: 'newsletter-campaign-test',
      recipient: 'tester@e.com',
    }))
  })
})

describe('queueCampaignSend', () => {
  it('moves DRAFT campaign to QUEUED', async () => {
    campaignFindUnique.mockResolvedValue({ id: 'c1', status: 'DRAFT' })
    campaignUpdate.mockResolvedValue({ id: 'c1', status: 'QUEUED' })
    const { queueCampaignSend } = await import('@/app/admin/marketing/actions')
    const r = await queueCampaignSend('c1')
    expect(r.ok).toBe(true)
    expect(campaignUpdate.mock.calls[0][0].data.status).toBe('QUEUED')
  })

  it('refuses non-DRAFT', async () => {
    campaignFindUnique.mockResolvedValue({ id: 'c1', status: 'SENT' })
    const { queueCampaignSend } = await import('@/app/admin/marketing/actions')
    const r = await queueCampaignSend('c1')
    expect(r.ok).toBe(false)
  })
})

// ─── Abandoned Carts ──────────────────────────────────────────────────────────

describe('sendCartRecoveryEmail', () => {
  it('enqueues + flips recoveryEmailSent', async () => {
    cartFindUnique.mockResolvedValue({
      id: 'ac1', customerEmail: 'lost@e.com', customerName: 'Lost',
      items: '[]', totalValue: 0, discountCode: null,
    })
    cartUpdate.mockResolvedValue({ id: 'ac1' })
    const { sendCartRecoveryEmail } = await import('@/app/admin/marketing/actions')
    const r = await sendCartRecoveryEmail('ac1')
    expect(r.ok).toBe(true)
    expect(enqueueEmail).toHaveBeenCalled()
    expect(cartUpdate.mock.calls[0][0].data.recoveryEmailSent).toBe(true)
  })
})

describe('generateCartRecoveryCode', () => {
  it('creates a Promotion in transaction and writes discountCode', async () => {
    cartFindUnique.mockResolvedValue({
      id: 'ac1', customerEmail: 'lost@e.com', totalValue: 100,
    })
    promotionCreate.mockResolvedValue({ id: 'pNew' })
    cartUpdate.mockResolvedValue({ id: 'ac1' })
    const { generateCartRecoveryCode } = await import('@/app/admin/marketing/actions')
    const r = await generateCartRecoveryCode('ac1')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data?.code).toMatch(/^[A-Z0-9]{8}$/)
      expect(r.data?.promotionId).toBe('pNew')
    }
    expect(transaction).toHaveBeenCalled()
  })
})

describe('markCartRecovered', () => {
  it('sets recovered=true + recoveredAt', async () => {
    cartUpdate.mockResolvedValue({ id: 'ac1' })
    const { markCartRecovered } = await import('@/app/admin/marketing/actions')
    const r = await markCartRecovered('ac1')
    expect(r.ok).toBe(true)
    expect(cartUpdate.mock.calls[0][0].data.recovered).toBe(true)
  })
})

// ─── Inspector wrappers ───────────────────────────────────────────────────────

describe('getPromotionDetailForInspector', () => {
  it('returns inline-loaded detail or null', async () => {
    promotionFindUnique.mockResolvedValue(null)
    const { getPromotionDetailForInspector } = await import('@/app/admin/marketing/actions')
    expect(await getPromotionDetailForInspector('missing')).toBeNull()
  })
})

describe('getCampaignDetailForInspector', () => {
  it('returns inline-loaded detail', async () => {
    campaignFindUnique.mockResolvedValue({
      id: 'c1', subject: 'Hi', preheader: 'P', heroImageUrl: null,
      ctaLabel: 'Shop', ctaUrl: '/', bodyMarkdown: 'B', status: 'DRAFT',
      audienceFilter: {}, audienceCount: 0, sentCount: 0, failedCount: 0,
      createdByAdminId: 'admin', sentAt: null,
      createdAt: new Date(), updatedAt: new Date(), name: null,
    })
    const { getCampaignDetailForInspector } = await import('@/app/admin/marketing/actions')
    const d = await getCampaignDetailForInspector('c1')
    expect(d?.subject).toBe('Hi')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/app/admin/marketing/actions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `app/admin/marketing/actions.ts`**

```ts
// app/admin/marketing/actions.ts
'use server'

/**
 * Phase 5 — Admin Marketing Server Actions (~40 actions across 5 domains).
 *
 * All actions go through requireAdmin() (no-arg overload, returns userId string).
 * deleteSubscriber + bulkDeleteSubscribers use requireAdminRole('SUPER_ADMIN') (PII gate).
 * All mutations call revalidatePath('/admin/marketing').
 *
 * PARALLEL-SAFETY NOTE:
 *   get*ForInspector actions inline their Prisma queries (rather than importing
 *   from lib/admin/marketing.ts) because Task 1 (which builds that module) is
 *   executing in parallel on a separate branch. After both Wave 1 PRs merge,
 *   a Phase 5.5 follow-up can refactor to import the shared loaders.
 */

import { revalidatePath } from 'next/cache'
import type {
  PromotionType,
  PopupTemplate,
  PopupPosition,
  PopupTrigger,
  PopupFrequency,
  NewsletterCampaignStatus,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin, requireAdminRole } from '@/lib/auth/admin'
import { enqueueEmail } from '@/lib/email/queue'

// ============================================================
// Return types (mirror Phase 3/4 shapes)
// ============================================================

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

export type BulkResult =
  | { ok: true; affected: number }
  | { ok: false; error: string }

// ============================================================
// Inline detail shapes (parallel-safe replacements for Task 1 types)
// ============================================================

export interface PromotionDetailFull {
  id: string
  name: string
  description: string | null
  code: string | null
  type: PromotionType
  value: number
  autoApply: boolean
  stackable: boolean
  minimumPurchase: number
  maxUsesTotal: number | null
  maxUsesPerCustomer: number | null
  usedCount: number
  productIds: string | null
  collectionIds: string | null
  customerEmails: string | null
  startDate: Date
  endDate: Date | null
  isActive: boolean
  maxDiscountPercent: number | null
  excludeFromLoyalty: boolean
  totalDiscountGiven: number
  createdAt: Date
  updatedAt: Date
}

export interface PopupVariantDetail {
  id: string
  popupId: string
  name: string
  content: string | null
  weight: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface PopupAnalyticsRollup {
  impressions: number
  clicks: number
  dismissals: number
  conversions: number
}

export interface PopupDetailFull {
  id: string
  name: string
  template: PopupTemplate
  position: PopupPosition
  content: string
  triggerType: PopupTrigger
  triggerValue: number
  showOnPages: string
  showToNewVisitors: boolean
  showToReturning: boolean
  frequency: PopupFrequency
  startDate: Date | null
  endDate: Date | null
  isActive: boolean
  priority: number
  promotionId: string | null
  createdAt: Date
  updatedAt: Date
  variants: PopupVariantDetail[]
  analytics7d: PopupAnalyticsRollup
}

export interface SubscriberDetailFull {
  id: string
  email: string
  source: string
  sourceDetails: string | null
  isActive: boolean
  isVerified: boolean
  verifiedAt: Date | null
  unsubscribedAt: Date | null
  unsubscribeReason: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CampaignDeliveryRow {
  id: string
  email: string
  status: 'SENT' | 'FAILED'
  isTest: boolean
  sentAt: Date
  providerMessageId: string | null
  errorMessage: string | null
}

export interface CampaignDetailFull {
  id: string
  name: string | null
  subject: string
  preheader: string
  heroImageUrl: string | null
  ctaLabel: string
  ctaUrl: string
  bodyMarkdown: string
  status: NewsletterCampaignStatus
  audienceFilter: unknown
  audienceCount: number
  sentCount: number
  failedCount: number
  createdByAdminId: string
  sentAt: Date | null
  createdAt: Date
  updatedAt: Date
  recentTestDeliveries: CampaignDeliveryRow[]
}

export interface AbandonedCartItem {
  productName: string
  quantity: number
  price: number
  productImage?: string | null
  variantDetails?: string | null
}

export interface AbandonedCartDetailFull {
  id: string
  customerId: string | null
  customerEmail: string
  customerName: string | null
  items: AbandonedCartItem[]
  totalValue: number
  itemCount: number
  recoveryEmailSent: boolean
  recoveryEmailSentAt: Date | null
  recovered: boolean
  recoveredAt: Date | null
  recoveryOrderId: string | null
  abandonedAt: Date
  expiresAt: Date
  discountCode: string | null
}

// ============================================================
// Input types
// ============================================================

export interface CreatePromotionInput {
  name: string
  description?: string | null
  type: PromotionType
  value: number
  code?: string | null
  autoApply?: boolean
  stackable?: boolean
  minimumPurchase?: number
  maxUsesTotal?: number | null
  maxUsesPerCustomer?: number | null
  productIds?: string | null
  collectionIds?: string | null
  customerEmails?: string | null
  startDate: Date
  endDate?: Date | null
  isActive: boolean
  maxDiscountPercent?: number | null
  excludeFromLoyalty?: boolean
}

export type UpdatePromotionInput = Partial<CreatePromotionInput>

export interface CreatePopupInput {
  name: string
  template: PopupTemplate
  position: PopupPosition
  content: string
  triggerType: PopupTrigger
  triggerValue?: number
  showOnPages?: string
  showToNewVisitors?: boolean
  showToReturning?: boolean
  frequency: PopupFrequency
  startDate?: Date | null
  endDate?: Date | null
  isActive: boolean
  priority?: number
  promotionId?: string | null
}

export type UpdatePopupInput = Partial<CreatePopupInput>

export interface CreatePopupVariantInput {
  name: string
  content?: string | null
  weight: number
  isActive: boolean
}

export type UpdatePopupVariantInput = Partial<CreatePopupVariantInput>

export interface CreateCampaignDraftInput {
  name?: string | null
  subject: string
  preheader: string
  heroImageUrl?: string | null
  ctaLabel: string
  ctaUrl: string
  bodyMarkdown: string
  audienceFilter: unknown
}

export type UpdateCampaignDraftInput = Partial<CreateCampaignDraftInput>

// ============================================================
// Helpers
// ============================================================

function revalidateMarketing(extraPath?: string) {
  revalidatePath('/admin/marketing')
  if (extraPath) revalidatePath(extraPath)
}

function rejectEmpty(ids: string[]): BulkResult | null {
  if (ids.length === 0) return { ok: false, error: 'No items selected' }
  return null
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function randomCode(len = 8): string {
  let s = ''
  for (let i = 0; i < len; i++) {
    s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return s
}

function safeParseItems(raw: string | null | undefined): AbandonedCartItem[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.map((it: Record<string, unknown>) => ({
        productName: String(it.productName ?? it.name ?? 'Item'),
        quantity: Number(it.quantity ?? 1),
        price: Number(it.price ?? 0),
        productImage: (it.productImage as string | undefined) ?? null,
        variantDetails: (it.variantDetails as string | undefined) ?? null,
      }))
    }
    return []
  } catch {
    return []
  }
}

function sevenDaysAgo(): Date {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d
}

// ============================================================
// PROMOTIONS
// ============================================================

export async function createPromotion(
  input: CreatePromotionInput,
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin()
  let attempts = 0
  while (attempts < 5) {
    try {
      const row = await prisma.promotion.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          type: input.type,
          value: input.value,
          code: input.code ?? null,
          autoApply: input.autoApply ?? false,
          stackable: input.stackable ?? false,
          minimumPurchase: input.minimumPurchase ?? 0,
          maxUsesTotal: input.maxUsesTotal ?? null,
          maxUsesPerCustomer: input.maxUsesPerCustomer ?? null,
          productIds: input.productIds ?? null,
          collectionIds: input.collectionIds ?? null,
          customerEmails: input.customerEmails ?? null,
          startDate: input.startDate,
          endDate: input.endDate ?? null,
          isActive: input.isActive,
          maxDiscountPercent: input.maxDiscountPercent ?? null,
          excludeFromLoyalty: input.excludeFromLoyalty ?? false,
        },
        select: { id: true },
      })
      revalidateMarketing()
      return { ok: true, data: { id: row.id } }
    } catch (err) {
      const e = err as { code?: string }
      if (e?.code === 'P2002') {
        attempts += 1
        continue
      }
      return { ok: false, error: 'Failed to create promotion' }
    }
  }
  return { ok: false, error: 'Code collision — please pick a different code' }
}

export async function updatePromotion(
  id: string, input: UpdatePromotionInput,
): Promise<ActionResult> {
  await requireAdmin()
  await prisma.promotion.update({ where: { id }, data: input })
  revalidateMarketing()
  return { ok: true }
}

export async function deletePromotion(id: string): Promise<ActionResult> {
  await requireAdmin()
  await prisma.promotion.delete({ where: { id } })
  revalidateMarketing()
  return { ok: true }
}

export async function togglePromotionActive(id: string): Promise<ActionResult> {
  await requireAdmin()
  const p = await prisma.promotion.findUnique({ where: { id }, select: { isActive: true } })
  if (!p) return { ok: false, error: 'Promotion not found' }
  await prisma.promotion.update({ where: { id }, data: { isActive: !p.isActive } })
  revalidateMarketing()
  return { ok: true }
}

export async function suggestPromotionCode(): Promise<ActionResult<{ code: string }>> {
  await requireAdmin()
  return { ok: true, data: { code: randomCode(8) } }
}

export async function checkPromotionCodeUnique(
  code: string,
): Promise<ActionResult<{ unique: boolean }>> {
  await requireAdmin()
  const existing = await prisma.promotion.findUnique({ where: { code } })
  return { ok: true, data: { unique: existing === null } }
}

export async function bulkActivatePromotions(ids: string[]): Promise<BulkResult> {
  const guard = rejectEmpty(ids); if (guard) return guard
  await requireAdmin()
  const r = await prisma.promotion.updateMany({
    where: { id: { in: ids } }, data: { isActive: true },
  })
  revalidateMarketing()
  return { ok: true, affected: r.count }
}

export async function bulkDeactivatePromotions(ids: string[]): Promise<BulkResult> {
  const guard = rejectEmpty(ids); if (guard) return guard
  await requireAdmin()
  const r = await prisma.promotion.updateMany({
    where: { id: { in: ids } }, data: { isActive: false },
  })
  revalidateMarketing()
  return { ok: true, affected: r.count }
}

export async function bulkDeletePromotions(ids: string[]): Promise<BulkResult> {
  const guard = rejectEmpty(ids); if (guard) return guard
  await requireAdmin()
  const r = await prisma.promotion.deleteMany({ where: { id: { in: ids } } })
  revalidateMarketing()
  return { ok: true, affected: r.count }
}

export async function getPromotionDetailForInspector(
  id: string,
): Promise<PromotionDetailFull | null> {
  await requireAdmin()
  const p = await prisma.promotion.findUnique({ where: { id } })
  if (!p) return null
  return {
    id: p.id, name: p.name, description: p.description ?? null, code: p.code,
    type: p.type, value: Number(p.value), autoApply: p.autoApply, stackable: p.stackable,
    minimumPurchase: Number(p.minimumPurchase ?? 0),
    maxUsesTotal: p.maxUsesTotal ?? null,
    maxUsesPerCustomer: p.maxUsesPerCustomer ?? null,
    usedCount: p.usedCount,
    productIds: p.productIds ?? null, collectionIds: p.collectionIds ?? null,
    customerEmails: p.customerEmails ?? null,
    startDate: p.startDate, endDate: p.endDate, isActive: p.isActive,
    maxDiscountPercent: p.maxDiscountPercent ?? null,
    excludeFromLoyalty: p.excludeFromLoyalty,
    totalDiscountGiven: Number(p.totalDiscountGiven ?? 0),
    createdAt: p.createdAt, updatedAt: p.updatedAt,
  }
}

// ============================================================
// POPUPS
// ============================================================

export async function createPopup(input: CreatePopupInput): Promise<ActionResult<{ id: string }>> {
  await requireAdmin()
  const row = await prisma.marketingPopup.create({
    data: {
      name: input.name, template: input.template, position: input.position,
      content: input.content, triggerType: input.triggerType,
      triggerValue: input.triggerValue ?? 3,
      showOnPages: input.showOnPages ?? 'all',
      showToNewVisitors: input.showToNewVisitors ?? true,
      showToReturning: input.showToReturning ?? true,
      frequency: input.frequency,
      startDate: input.startDate ?? null, endDate: input.endDate ?? null,
      isActive: input.isActive, priority: input.priority ?? 0,
      promotionId: input.promotionId ?? null,
    },
    select: { id: true },
  })
  revalidateMarketing()
  return { ok: true, data: { id: row.id } }
}

export async function updatePopup(id: string, input: UpdatePopupInput): Promise<ActionResult> {
  await requireAdmin()
  await prisma.marketingPopup.update({ where: { id }, data: input })
  revalidateMarketing(`/admin/marketing/popups/${id}/edit`)
  return { ok: true }
}

export async function deletePopup(id: string): Promise<ActionResult> {
  await requireAdmin()
  await prisma.marketingPopup.delete({ where: { id } })
  revalidateMarketing()
  return { ok: true }
}

export async function togglePopupActive(id: string): Promise<ActionResult> {
  await requireAdmin()
  const p = await prisma.marketingPopup.findUnique({ where: { id }, select: { isActive: true } })
  if (!p) return { ok: false, error: 'Popup not found' }
  await prisma.marketingPopup.update({ where: { id }, data: { isActive: !p.isActive } })
  revalidateMarketing()
  return { ok: true }
}

export async function duplicatePopup(id: string): Promise<ActionResult<{ id: string }>> {
  await requireAdmin()
  const p = await prisma.marketingPopup.findUnique({ where: { id } })
  if (!p) return { ok: false, error: 'Popup not found' }
  const row = await prisma.marketingPopup.create({
    data: {
      name: `${p.name} (copy)`, template: p.template, position: p.position,
      content: p.content, triggerType: p.triggerType, triggerValue: p.triggerValue,
      showOnPages: p.showOnPages, showToNewVisitors: p.showToNewVisitors,
      showToReturning: p.showToReturning, frequency: p.frequency,
      startDate: null, endDate: null,
      isActive: false, priority: p.priority, promotionId: p.promotionId,
    },
    select: { id: true },
  })
  revalidateMarketing()
  return { ok: true, data: { id: row.id } }
}

export async function createPopupVariant(
  popupId: string, input: CreatePopupVariantInput,
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin()
  const row = await prisma.popupVariant.create({
    data: {
      popupId, name: input.name, content: input.content ?? null,
      weight: input.weight, isActive: input.isActive,
    },
    select: { id: true },
  })
  revalidateMarketing(`/admin/marketing/popups/${popupId}/edit`)
  return { ok: true, data: { id: row.id } }
}

export async function updatePopupVariant(
  variantId: string, input: UpdatePopupVariantInput,
): Promise<ActionResult> {
  await requireAdmin()
  await prisma.popupVariant.update({ where: { id: variantId }, data: input })
  revalidateMarketing()
  return { ok: true }
}

export async function deletePopupVariant(variantId: string): Promise<ActionResult> {
  await requireAdmin()
  await prisma.popupVariant.delete({ where: { id: variantId } })
  revalidateMarketing()
  return { ok: true }
}

export async function bulkActivatePopups(ids: string[]): Promise<BulkResult> {
  const guard = rejectEmpty(ids); if (guard) return guard
  await requireAdmin()
  const r = await prisma.marketingPopup.updateMany({
    where: { id: { in: ids } }, data: { isActive: true },
  })
  revalidateMarketing()
  return { ok: true, affected: r.count }
}

export async function bulkDeactivatePopups(ids: string[]): Promise<BulkResult> {
  const guard = rejectEmpty(ids); if (guard) return guard
  await requireAdmin()
  const r = await prisma.marketingPopup.updateMany({
    where: { id: { in: ids } }, data: { isActive: false },
  })
  revalidateMarketing()
  return { ok: true, affected: r.count }
}

export async function bulkDuplicatePopups(ids: string[]): Promise<BulkResult> {
  const guard = rejectEmpty(ids); if (guard) return guard
  await requireAdmin()
  let affected = 0
  for (const id of ids) {
    const r = await duplicatePopup(id)
    if (r.ok) affected += 1
  }
  revalidateMarketing()
  return { ok: true, affected }
}

export async function bulkDeletePopups(ids: string[]): Promise<BulkResult> {
  const guard = rejectEmpty(ids); if (guard) return guard
  await requireAdmin()
  const r = await prisma.marketingPopup.deleteMany({ where: { id: { in: ids } } })
  revalidateMarketing()
  return { ok: true, affected: r.count }
}

export async function getPopupDetailForInspector(
  id: string,
): Promise<PopupDetailFull | null> {
  await requireAdmin()
  const last7 = sevenDaysAgo()
  const p = await prisma.marketingPopup.findUnique({
    where: { id },
    include: {
      variants: { orderBy: { createdAt: 'asc' } },
      analytics: { where: { date: { gte: last7 } } },
    },
  })
  if (!p) return null
  const rollup: PopupAnalyticsRollup = p.analytics.reduce(
    (acc, a) => ({
      impressions: acc.impressions + (a.impressions ?? 0),
      clicks: acc.clicks + (a.clicks ?? 0),
      dismissals: acc.dismissals + (a.dismissals ?? 0),
      conversions: acc.conversions + (a.conversions ?? 0),
    }),
    { impressions: 0, clicks: 0, dismissals: 0, conversions: 0 },
  )
  return {
    id: p.id, name: p.name, template: p.template, position: p.position,
    content: p.content, triggerType: p.triggerType, triggerValue: p.triggerValue,
    showOnPages: p.showOnPages, showToNewVisitors: p.showToNewVisitors,
    showToReturning: p.showToReturning, frequency: p.frequency,
    startDate: p.startDate, endDate: p.endDate, isActive: p.isActive,
    priority: p.priority, promotionId: p.promotionId ?? null,
    createdAt: p.createdAt, updatedAt: p.updatedAt,
    variants: p.variants.map((v) => ({
      id: v.id, popupId: v.popupId, name: v.name, content: v.content ?? null,
      weight: v.weight, isActive: v.isActive,
      createdAt: v.createdAt, updatedAt: v.updatedAt,
    })),
    analytics7d: rollup,
  }
}

// ============================================================
// SUBSCRIBERS
// ============================================================

export async function unsubscribeSubscriber(id: string): Promise<ActionResult> {
  await requireAdmin()
  await prisma.newsletterSubscriber.update({
    where: { id },
    data: { isActive: false, unsubscribedAt: new Date() },
  })
  revalidateMarketing()
  return { ok: true }
}

export async function deleteSubscriber(id: string): Promise<ActionResult> {
  await requireAdminRole('SUPER_ADMIN')
  await prisma.newsletterSubscriber.delete({ where: { id } })
  revalidateMarketing()
  return { ok: true }
}

export async function bulkUnsubscribeSubscribers(ids: string[]): Promise<BulkResult> {
  const guard = rejectEmpty(ids); if (guard) return guard
  await requireAdmin()
  const r = await prisma.newsletterSubscriber.updateMany({
    where: { id: { in: ids } },
    data: { isActive: false, unsubscribedAt: new Date() },
  })
  revalidateMarketing()
  return { ok: true, affected: r.count }
}

export async function bulkExportSubscribersCsv(
  ids: string[],
): Promise<ActionResult<{ csv: string }>> {
  const guard = rejectEmpty(ids); if (guard) return guard as ActionResult<{ csv: string }>
  await requireAdmin()
  const rows = await prisma.newsletterSubscriber.findMany({
    where: { id: { in: ids } },
    select: { id: true, email: true, source: true, isActive: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  const header = 'email,source,isActive,createdAt'
  const lines = rows.map((r) =>
    [r.email, r.source, r.isActive, r.createdAt.toISOString()].join(','),
  )
  return { ok: true, data: { csv: [header, ...lines].join('\n') } }
}

export async function bulkDeleteSubscribers(ids: string[]): Promise<BulkResult> {
  const guard = rejectEmpty(ids); if (guard) return guard
  await requireAdminRole('SUPER_ADMIN')
  const r = await prisma.newsletterSubscriber.deleteMany({ where: { id: { in: ids } } })
  revalidateMarketing()
  return { ok: true, affected: r.count }
}

export async function getSubscriberDetailForInspector(
  id: string,
): Promise<SubscriberDetailFull | null> {
  await requireAdmin()
  const s = await prisma.newsletterSubscriber.findUnique({ where: { id } })
  if (!s) return null
  return {
    id: s.id, email: s.email, source: s.source, sourceDetails: s.sourceDetails ?? null,
    isActive: s.isActive, isVerified: s.isVerified, verifiedAt: s.verifiedAt,
    unsubscribedAt: s.unsubscribedAt, unsubscribeReason: s.unsubscribeReason ?? null,
    utmSource: s.utmSource ?? null, utmMedium: s.utmMedium ?? null,
    utmCampaign: s.utmCampaign ?? null,
    createdAt: s.createdAt, updatedAt: s.updatedAt,
  }
}

// ============================================================
// CAMPAIGNS
// ============================================================

export async function createCampaignDraft(
  input: CreateCampaignDraftInput,
): Promise<ActionResult<{ id: string }>> {
  const adminId = await requireAdmin()
  const row = await prisma.newsletterCampaign.create({
    data: {
      name: input.name ?? null,
      subject: input.subject, preheader: input.preheader,
      heroImageUrl: input.heroImageUrl ?? null,
      ctaLabel: input.ctaLabel, ctaUrl: input.ctaUrl,
      bodyMarkdown: input.bodyMarkdown,
      status: 'DRAFT',
      audienceFilter: input.audienceFilter as import('@prisma/client').Prisma.InputJsonValue,
      audienceCount: 0, sentCount: 0, failedCount: 0,
      createdByAdminId: typeof adminId === 'string' ? adminId : 'unknown',
    },
    select: { id: true },
  })
  revalidateMarketing()
  return { ok: true, data: { id: row.id } }
}

export async function updateCampaignDraft(
  id: string, input: UpdateCampaignDraftInput,
): Promise<ActionResult> {
  await requireAdmin()
  await prisma.newsletterCampaign.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.subject !== undefined ? { subject: input.subject } : {}),
      ...(input.preheader !== undefined ? { preheader: input.preheader } : {}),
      ...(input.heroImageUrl !== undefined ? { heroImageUrl: input.heroImageUrl } : {}),
      ...(input.ctaLabel !== undefined ? { ctaLabel: input.ctaLabel } : {}),
      ...(input.ctaUrl !== undefined ? { ctaUrl: input.ctaUrl } : {}),
      ...(input.bodyMarkdown !== undefined ? { bodyMarkdown: input.bodyMarkdown } : {}),
      ...(input.audienceFilter !== undefined
        ? { audienceFilter: input.audienceFilter as import('@prisma/client').Prisma.InputJsonValue }
        : {}),
    },
  })
  revalidateMarketing(`/admin/marketing/campaigns/${id}/edit`)
  return { ok: true }
}

export async function duplicateCampaign(id: string): Promise<ActionResult<{ id: string }>> {
  const adminId = await requireAdmin()
  const src = await prisma.newsletterCampaign.findUnique({ where: { id } })
  if (!src) return { ok: false, error: 'Campaign not found' }
  const row = await prisma.newsletterCampaign.create({
    data: {
      name: `Copy of ${src.subject}`,
      subject: src.subject, preheader: src.preheader,
      heroImageUrl: src.heroImageUrl, ctaLabel: src.ctaLabel,
      ctaUrl: src.ctaUrl, bodyMarkdown: src.bodyMarkdown,
      status: 'DRAFT',
      audienceFilter: src.audienceFilter as import('@prisma/client').Prisma.InputJsonValue,
      audienceCount: 0, sentCount: 0, failedCount: 0,
      createdByAdminId: typeof adminId === 'string' ? adminId : 'unknown',
    },
    select: { id: true },
  })
  revalidateMarketing()
  return { ok: true, data: { id: row.id } }
}

export async function deleteCampaign(id: string): Promise<ActionResult> {
  await requireAdmin()
  const c = await prisma.newsletterCampaign.findUnique({ where: { id }, select: { status: true } })
  if (!c) return { ok: false, error: 'Campaign not found' }
  if (c.status !== 'DRAFT') return { ok: false, error: 'Only DRAFT campaigns can be deleted' }
  await prisma.newsletterCampaign.delete({ where: { id } })
  revalidateMarketing()
  return { ok: true }
}

export async function queueCampaignSend(id: string): Promise<ActionResult> {
  await requireAdmin()
  const c = await prisma.newsletterCampaign.findUnique({ where: { id }, select: { status: true } })
  if (!c) return { ok: false, error: 'Campaign not found' }
  if (c.status !== 'DRAFT') return { ok: false, error: 'Only DRAFT campaigns can be queued' }
  await prisma.newsletterCampaign.update({ where: { id }, data: { status: 'QUEUED' } })
  revalidateMarketing(`/admin/marketing/campaigns/${id}/edit`)
  return { ok: true }
}

export async function sendCampaignTest(
  id: string, email: string,
): Promise<ActionResult> {
  await requireAdmin()
  const c = await prisma.newsletterCampaign.findUnique({ where: { id } })
  if (!c) return { ok: false, error: 'Campaign not found' }
  await enqueueEmail({
    type: 'newsletter-campaign-test',
    recipient: email,
    payload: {
      campaignId: id, subject: c.subject, preheader: c.preheader,
      heroImageUrl: c.heroImageUrl, ctaLabel: c.ctaLabel, ctaUrl: c.ctaUrl,
      bodyMarkdown: c.bodyMarkdown,
    },
  })
  revalidateMarketing(`/admin/marketing/campaigns/${id}/edit`)
  return { ok: true }
}

export async function previewCampaignAudience(
  id: string,
): Promise<ActionResult<{ count: number }>> {
  await requireAdmin()
  const c = await prisma.newsletterCampaign.findUnique({
    where: { id }, select: { audienceFilter: true },
  })
  if (!c) return { ok: false, error: 'Campaign not found' }
  // Audience filter is JSON; apply common keys (activeOnly).
  const f = (c.audienceFilter ?? {}) as Record<string, unknown>
  const where: Record<string, unknown> = {}
  if (f.activeOnly === true) where.isActive = true
  if (typeof f.source === 'string') where.source = f.source
  const count = await prisma.newsletterSubscriber.count({ where })
  return { ok: true, data: { count } }
}

export async function bulkDuplicateCampaigns(ids: string[]): Promise<BulkResult> {
  const guard = rejectEmpty(ids); if (guard) return guard
  await requireAdmin()
  let affected = 0
  for (const id of ids) {
    const r = await duplicateCampaign(id)
    if (r.ok) affected += 1
  }
  revalidateMarketing()
  return { ok: true, affected }
}

export async function bulkDeleteCampaigns(ids: string[]): Promise<BulkResult> {
  const guard = rejectEmpty(ids); if (guard) return guard
  await requireAdmin()
  const r = await prisma.newsletterCampaign.deleteMany({
    where: { id: { in: ids }, status: 'DRAFT' },
  })
  revalidateMarketing()
  return { ok: true, affected: r.count }
}

export async function getCampaignDetailForInspector(
  id: string,
): Promise<CampaignDetailFull | null> {
  await requireAdmin()
  const c = await prisma.newsletterCampaign.findUnique({ where: { id } })
  if (!c) return null
  const recent = await prisma.newsletterCampaignDelivery.findMany({
    where: { campaignId: id, isTest: true },
    orderBy: { sentAt: 'desc' },
    take: 10,
  })
  return {
    id: c.id, name: c.name ?? null, subject: c.subject, preheader: c.preheader,
    heroImageUrl: c.heroImageUrl ?? null, ctaLabel: c.ctaLabel, ctaUrl: c.ctaUrl,
    bodyMarkdown: c.bodyMarkdown, status: c.status,
    audienceFilter: c.audienceFilter, audienceCount: c.audienceCount,
    sentCount: c.sentCount, failedCount: c.failedCount,
    createdByAdminId: c.createdByAdminId,
    sentAt: c.sentAt, createdAt: c.createdAt, updatedAt: c.updatedAt,
    recentTestDeliveries: recent.map((d) => ({
      id: d.id, email: d.email, status: d.status, isTest: d.isTest,
      sentAt: d.sentAt, providerMessageId: d.providerMessageId ?? null,
      errorMessage: d.errorMessage ?? null,
    })),
  }
}

// ============================================================
// ABANDONED CARTS
// ============================================================

export async function sendCartRecoveryEmail(cartId: string): Promise<ActionResult> {
  await requireAdmin()
  const c = await prisma.abandonedCart.findUnique({ where: { id: cartId } })
  if (!c) return { ok: false, error: 'Cart not found' }
  await enqueueEmail({
    type: 'abandoned-cart-recovery',
    recipient: c.customerEmail,
    payload: {
      cartId: c.id, customerName: c.customerName,
      items: safeParseItems(c.items), totalValue: Number(c.totalValue),
      discountCode: c.discountCode,
    },
  })
  await prisma.abandonedCart.update({
    where: { id: cartId },
    data: { recoveryEmailSent: true, recoveryEmailSentAt: new Date() },
  })
  revalidateMarketing()
  return { ok: true }
}

export async function generateCartRecoveryCode(
  cartId: string,
): Promise<ActionResult<{ code: string; promotionId: string }>> {
  const adminId = await requireAdmin()
  void adminId
  const cart = await prisma.abandonedCart.findUnique({ where: { id: cartId } })
  if (!cart) return { ok: false, error: 'Cart not found' }

  let attempts = 0
  while (attempts < 5) {
    const code = randomCode(8)
    try {
      const result = await prisma.$transaction(async (tx: {
        promotion: { create: (args: unknown) => Promise<{ id: string }> }
        abandonedCart: { update: (args: unknown) => Promise<unknown> }
      }) => {
        const promo = await tx.promotion.create({
          data: {
            name: `Cart recovery ${code}`,
            type: 'FIXED_AMOUNT' as PromotionType,
            value: 10,
            code,
            autoApply: false,
            stackable: false,
            customerEmails: cart.customerEmail,
            startDate: new Date(),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            isActive: true,
            maxUsesTotal: 1,
            maxUsesPerCustomer: 1,
          },
        })
        await tx.abandonedCart.update({
          where: { id: cartId },
          data: { discountCode: code },
        })
        return { promotionId: promo.id }
      })
      revalidateMarketing()
      return { ok: true, data: { code, promotionId: result.promotionId } }
    } catch (err) {
      const e = err as { code?: string }
      if (e?.code === 'P2002') {
        attempts += 1
        continue
      }
      return { ok: false, error: 'Failed to generate recovery code' }
    }
  }
  return { ok: false, error: 'Could not generate a unique code' }
}

export async function markCartRecovered(cartId: string): Promise<ActionResult> {
  await requireAdmin()
  await prisma.abandonedCart.update({
    where: { id: cartId },
    data: { recovered: true, recoveredAt: new Date() },
  })
  revalidateMarketing()
  return { ok: true }
}

export async function bulkSendRecoveryEmails(cartIds: string[]): Promise<BulkResult> {
  const guard = rejectEmpty(cartIds); if (guard) return guard
  await requireAdmin()
  let affected = 0
  for (const id of cartIds) {
    const r = await sendCartRecoveryEmail(id)
    if (r.ok) affected += 1
  }
  revalidateMarketing()
  return { ok: true, affected }
}

export async function bulkGenerateRecoveryCodes(cartIds: string[]): Promise<BulkResult> {
  const guard = rejectEmpty(cartIds); if (guard) return guard
  await requireAdmin()
  let affected = 0
  for (const id of cartIds) {
    const r = await generateCartRecoveryCode(id)
    if (r.ok) affected += 1
  }
  revalidateMarketing()
  return { ok: true, affected }
}

export async function bulkMarkCartsRecovered(cartIds: string[]): Promise<BulkResult> {
  const guard = rejectEmpty(cartIds); if (guard) return guard
  await requireAdmin()
  const r = await prisma.abandonedCart.updateMany({
    where: { id: { in: cartIds } },
    data: { recovered: true, recoveredAt: new Date() },
  })
  revalidateMarketing()
  return { ok: true, affected: r.count }
}

export async function getAbandonedCartDetailForInspector(
  id: string,
): Promise<AbandonedCartDetailFull | null> {
  await requireAdmin()
  const c = await prisma.abandonedCart.findUnique({ where: { id } })
  if (!c) return null
  return {
    id: c.id, customerId: c.customerId ?? null,
    customerEmail: c.customerEmail, customerName: c.customerName ?? null,
    items: safeParseItems(c.items),
    totalValue: Number(c.totalValue), itemCount: c.itemCount,
    recoveryEmailSent: c.recoveryEmailSent, recoveryEmailSentAt: c.recoveryEmailSentAt,
    recovered: c.recovered, recoveredAt: c.recoveredAt,
    recoveryOrderId: c.recoveryOrderId ?? null,
    abandonedAt: c.abandonedAt, expiresAt: c.expiresAt,
    discountCode: c.discountCode ?? null,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/app/admin/marketing/actions.test.ts`
Expected: PASS — 18 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add app/admin/marketing/actions.ts tests/unit/app/admin/marketing/actions.test.ts
git commit -m "feat(admin-v2): add ~40 marketing server actions (promotions, popups, subscribers, campaigns, carts)"
git push -u origin wave5p5/task-2-server-actions
gh pr create --title "feat(admin-v2): Phase 5 W1 marketing server actions" --body "Adds app/admin/marketing/actions.ts with ~40 server actions across 5 domains. requireAdmin() for all; requireAdminRole('SUPER_ADMIN') for deleteSubscriber + bulkDeleteSubscribers (PII gate). Inline get*ForInspector wrappers for parallel-safe dispatch (Task 1 builds the shared loaders simultaneously; refactor deferred to Phase 5.5). Email side effects route through the durable EmailQueue. generateCartRecoveryCode creates a Promotion + writes AbandonedCart.discountCode inside a transaction with retry-on-collision. 18 tests passing."
```

---

## Wave 2 — Generic list primitives (2 parallel, after W1 merged)

### Task 3: `MarketingListTable.tsx` (generic, CVA-driven variants)

**Wave:** 2 | **Parallel-safe with:** Task 4 | **Branch:** `wave5p5/task-3-list-table` | **Model:** sonnet

**Schema realities for this task:**
- Generic table with CVA `variant: 'promotions' | 'popups' | 'subscribers' | 'campaigns' | 'carts'` prop that maps to a column set.
- Type the `rows` prop as a discriminated union: `{ variant: 'promotions'; rows: PromotionRow[] } | { variant: 'popups'; rows: PopupRow[] } | ...`.
- `import type` only from `@/lib/admin/marketing` — no Prisma in client bundle.
- No `dark:` modifiers. Use `bg-neutral-900/60`, `border-white/8`, `text-white/50`.
- Sticky header (`sticky top-0 z-10 bg-neutral-950`).
- Per-row checkbox + select-all in header. ⋯ button calls `onOpenInspector(id)`.

**Files:**
- Create: `components/admin/marketing/MarketingListTable.tsx`
- Test: `tests/unit/components/admin/marketing/MarketingListTable.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/marketing/MarketingListTable.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MarketingListTable } from '@/components/admin/marketing/MarketingListTable'
import type {
  PromotionRow, PopupRow, SubscriberRow, CampaignRow, AbandonedCartRow,
} from '@/lib/admin/marketing'

const promo: PromotionRow = {
  id: 'p1', name: 'Summer 20', code: 'SUMMER20', type: 'PERCENTAGE',
  value: 20, isActive: true, usedCount: 12, maxUsesTotal: 100,
  startDate: new Date('2026-05-01'), endDate: new Date('2026-06-01'),
  totalDiscountGiven: 1234.5, autoApply: false, stackable: false,
  createdAt: new Date('2026-05-01'),
}

const popup: PopupRow = {
  id: 'pp1', name: 'Welcome modal', template: 'MODAL', position: 'CENTER',
  triggerType: 'DELAY', isActive: true, priority: 1,
  impressions7d: 300, conversions7d: 15,
  startDate: null, endDate: null, createdAt: new Date('2026-05-01'),
}

const sub: SubscriberRow = {
  id: 's1', email: 'ada@e.com', source: 'popup', sourceDetails: null,
  isActive: true, isVerified: true, createdAt: new Date('2026-05-01'),
  unsubscribedAt: null, utmSource: 'google',
}

const campaign: CampaignRow = {
  id: 'c1', name: 'May newsletter', subject: 'Hello May',
  status: 'SENT', audienceCount: 1000, sentCount: 990, failedCount: 10,
  sentAt: new Date('2026-05-15'), createdAt: new Date('2026-05-10'),
}

const cart: AbandonedCartRow = {
  id: 'ac1', customerEmail: 'lost@e.com', customerName: 'Lost',
  totalValue: 89.99, itemCount: 2, recovered: false,
  recoveryEmailSent: false, abandonedAt: new Date('2026-05-20'),
  expiresAt: new Date('2026-06-20'), discountCode: null,
}

describe('MarketingListTable promotions variant', () => {
  it('renders promotion columns', () => {
    render(
      <MarketingListTable
        variant="promotions"
        rows={[promo]}
        selected={new Set()}
        onSelect={vi.fn()}
        onOpenInspector={vi.fn()}
      />,
    )
    expect(screen.getByText('Summer 20')).toBeInTheDocument()
    expect(screen.getByText('SUMMER20')).toBeInTheDocument()
    expect(screen.getByText(/12/)).toBeInTheDocument() // usedCount
  })

  it('calls onOpenInspector when ⋯ clicked', () => {
    const onOpenInspector = vi.fn()
    render(
      <MarketingListTable
        variant="promotions"
        rows={[promo]}
        selected={new Set()}
        onSelect={vi.fn()}
        onOpenInspector={onOpenInspector}
      />,
    )
    fireEvent.click(screen.getByTestId('row-actions-p1'))
    expect(onOpenInspector).toHaveBeenCalledWith('p1')
  })
})

describe('MarketingListTable popups variant', () => {
  it('renders popup columns with 7-day impressions/conversions', () => {
    render(
      <MarketingListTable
        variant="popups"
        rows={[popup]}
        selected={new Set()}
        onSelect={vi.fn()}
        onOpenInspector={vi.fn()}
      />,
    )
    expect(screen.getByText('Welcome modal')).toBeInTheDocument()
    expect(screen.getByText('MODAL')).toBeInTheDocument()
    expect(screen.getByText('300')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
  })
})

describe('MarketingListTable subscribers variant', () => {
  it('renders subscriber columns', () => {
    render(
      <MarketingListTable
        variant="subscribers"
        rows={[sub]}
        selected={new Set()}
        onSelect={vi.fn()}
        onOpenInspector={vi.fn()}
      />,
    )
    expect(screen.getByText('ada@e.com')).toBeInTheDocument()
    expect(screen.getByText('popup')).toBeInTheDocument()
  })
})

describe('MarketingListTable campaigns variant', () => {
  it('renders campaign columns including status pill', () => {
    render(
      <MarketingListTable
        variant="campaigns"
        rows={[campaign]}
        selected={new Set()}
        onSelect={vi.fn()}
        onOpenInspector={vi.fn()}
      />,
    )
    expect(screen.getByText('Hello May')).toBeInTheDocument()
    expect(screen.getByText('SENT')).toBeInTheDocument()
    expect(screen.getByText(/990/)).toBeInTheDocument()
  })
})

describe('MarketingListTable carts variant', () => {
  it('renders cart columns', () => {
    render(
      <MarketingListTable
        variant="carts"
        rows={[cart]}
        selected={new Set()}
        onSelect={vi.fn()}
        onOpenInspector={vi.fn()}
      />,
    )
    expect(screen.getByText('lost@e.com')).toBeInTheDocument()
    expect(screen.getByText(/\$89\.99/)).toBeInTheDocument()
  })
})

describe('MarketingListTable common behavior', () => {
  it('renders loading skeleton when loading=true', () => {
    render(
      <MarketingListTable
        variant="promotions"
        rows={[]}
        selected={new Set()}
        onSelect={vi.fn()}
        onOpenInspector={vi.fn()}
        loading
      />,
    )
    expect(screen.getAllByTestId('marketing-list-skeleton-row').length).toBeGreaterThan(0)
  })

  it('renders empty state when rows is empty and not loading', () => {
    render(
      <MarketingListTable
        variant="promotions"
        rows={[]}
        selected={new Set()}
        onSelect={vi.fn()}
        onOpenInspector={vi.fn()}
      />,
    )
    expect(screen.getByText(/no promotions/i)).toBeInTheDocument()
  })

  it('select-all toggles every row via onSelectAll', () => {
    const onSelectAll = vi.fn()
    render(
      <MarketingListTable
        variant="promotions"
        rows={[promo]}
        selected={new Set()}
        onSelect={vi.fn()}
        onSelectAll={onSelectAll}
        onOpenInspector={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('marketing-select-all'))
    expect(onSelectAll).toHaveBeenCalledWith(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/marketing/MarketingListTable.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/marketing/MarketingListTable.tsx`**

```tsx
'use client'

/**
 * MarketingListTable — generic desktop list table for all 5 marketing tabs.
 *
 * One component, 5 variants. CVA drives column sets and status pill colors
 * per variant. Props are a discriminated union over `variant + rows`.
 *
 * Hidden on mobile (`hidden md:block`). Mobile uses MarketingListCardMobile.
 *
 * Phase 5 Task 3.
 */

import type {
  PromotionRow, PopupRow, SubscriberRow, CampaignRow, AbandonedCartRow,
} from '@/lib/admin/marketing'

// ─── Types ────────────────────────────────────────────────────────────────────

type Variant = 'promotions' | 'popups' | 'subscribers' | 'campaigns' | 'carts'

type RowsProp =
  | { variant: 'promotions'; rows: PromotionRow[] }
  | { variant: 'popups'; rows: PopupRow[] }
  | { variant: 'subscribers'; rows: SubscriberRow[] }
  | { variant: 'campaigns'; rows: CampaignRow[] }
  | { variant: 'carts'; rows: AbandonedCartRow[] }

type CommonProps = {
  selected: Set<string>
  onSelect: (id: string, checked: boolean) => void
  onSelectAll?: (checked: boolean) => void
  onOpenInspector: (id: string) => void
  loading?: boolean
  skeletonRows?: number
}

export type MarketingListTableProps = RowsProp & CommonProps

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCurrency(n: number): string {
  return `$${n.toFixed(2)}`
}

// ─── Status pill maps ─────────────────────────────────────────────────────────

const ACTIVE_PILL = 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
const INACTIVE_PILL = 'bg-white/5 text-white/40 border border-white/10'

const CAMPAIGN_STATUS_PILL: Record<string, string> = {
  DRAFT:   'bg-white/8 text-white/60 border border-white/15',
  QUEUED:  'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  SENDING: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
  SENT:    'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  FAILED:  'bg-rose-500/15 text-rose-300 border border-rose-500/30',
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${active ? ACTIVE_PILL : INACTIVE_PILL}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-white/[0.04]" data-testid="marketing-list-skeleton-row">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-3 w-20 bg-white/5 animate-pulse rounded" />
        </td>
      ))}
    </tr>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

const EMPTY_LABEL: Record<Variant, string> = {
  promotions:  'No promotions yet.',
  popups:      'No popups yet.',
  subscribers: 'No subscribers yet.',
  campaigns:   'No campaigns yet.',
  carts:       'No abandoned carts to recover.',
}

// ─── Column headers per variant ───────────────────────────────────────────────

const HEADERS: Record<Variant, string[]> = {
  promotions:  ['Name', 'Code', 'Type', 'Value', 'Used', 'Status', 'Start'],
  popups:      ['Name', 'Template', 'Position', 'Impressions 7d', 'Conv 7d', 'Status'],
  subscribers: ['Email', 'Source', 'UTM', 'Status', 'Signed up'],
  campaigns:   ['Subject', 'Status', 'Audience', 'Sent', 'Failed', 'Sent at'],
  carts:       ['Customer', 'Items', 'Value', 'Email sent', 'Code', 'Abandoned'],
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MarketingListTable(props: MarketingListTableProps) {
  const {
    variant, selected, onSelect, onSelectAll, onOpenInspector,
    loading = false, skeletonRows = 8,
  } = props

  const headers = HEADERS[variant]
  const colCount = headers.length + 2 // checkbox + actions
  const rowsLen = props.rows.length

  return (
    <div className="hidden md:block bg-neutral-900/60 border border-white/8 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-neutral-950 border-b border-white/8">
          <tr>
            <th className="px-3 py-2 w-10 text-left">
              <input
                type="checkbox"
                data-testid="marketing-select-all"
                onChange={(e) => onSelectAll?.(e.currentTarget.checked)}
                className="accent-emerald-500"
              />
            </th>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 text-left text-[11px] uppercase tracking-wider text-white/40 font-medium">
                {h}
              </th>
            ))}
            <th className="px-3 py-2 w-10" />
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: skeletonRows }).map((_, i) => (
                <SkeletonRow key={i} cols={colCount} />
              ))
            : rowsLen === 0
            ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-10 text-center text-sm text-white/40">
                    {EMPTY_LABEL[variant]}
                  </td>
                </tr>
              )
            : variant === 'promotions'
            ? props.rows.map((r) => (
                <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-3 py-3">
                    <input type="checkbox" checked={selected.has(r.id)}
                      onChange={(e) => onSelect(r.id, e.currentTarget.checked)}
                      className="accent-emerald-500" />
                  </td>
                  <td className="px-3 py-3 text-white">{r.name}</td>
                  <td className="px-3 py-3 font-mono text-xs text-white/70">{r.code ?? '—'}</td>
                  <td className="px-3 py-3 text-white/60 text-xs">{r.type}</td>
                  <td className="px-3 py-3 tabular-nums">{r.value}{r.type === 'PERCENTAGE' ? '%' : ''}</td>
                  <td className="px-3 py-3 tabular-nums text-white/70">{r.usedCount}{r.maxUsesTotal ? `/${r.maxUsesTotal}` : ''}</td>
                  <td className="px-3 py-3"><StatusPill active={r.isActive} /></td>
                  <td className="px-3 py-3 text-white/50 text-xs">{formatDate(r.startDate)}</td>
                  <td className="px-3 py-3 text-right">
                    <button data-testid={`row-actions-${r.id}`}
                      onClick={() => onOpenInspector(r.id)}
                      className="text-white/40 hover:text-white">⋯</button>
                  </td>
                </tr>
              ))
            : variant === 'popups'
            ? props.rows.map((r) => (
                <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-3 py-3">
                    <input type="checkbox" checked={selected.has(r.id)}
                      onChange={(e) => onSelect(r.id, e.currentTarget.checked)}
                      className="accent-emerald-500" />
                  </td>
                  <td className="px-3 py-3 text-white">{r.name}</td>
                  <td className="px-3 py-3 text-white/60 text-xs">{r.template}</td>
                  <td className="px-3 py-3 text-white/60 text-xs">{r.position}</td>
                  <td className="px-3 py-3 tabular-nums">{r.impressions7d}</td>
                  <td className="px-3 py-3 tabular-nums">{r.conversions7d}</td>
                  <td className="px-3 py-3"><StatusPill active={r.isActive} /></td>
                  <td className="px-3 py-3 text-right">
                    <button data-testid={`row-actions-${r.id}`}
                      onClick={() => onOpenInspector(r.id)}
                      className="text-white/40 hover:text-white">⋯</button>
                  </td>
                </tr>
              ))
            : variant === 'subscribers'
            ? props.rows.map((r) => (
                <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-3 py-3">
                    <input type="checkbox" checked={selected.has(r.id)}
                      onChange={(e) => onSelect(r.id, e.currentTarget.checked)}
                      className="accent-emerald-500" />
                  </td>
                  <td className="px-3 py-3 text-white">{r.email}</td>
                  <td className="px-3 py-3 text-white/60 text-xs">{r.source}</td>
                  <td className="px-3 py-3 text-white/40 text-xs">{r.utmSource ?? '—'}</td>
                  <td className="px-3 py-3"><StatusPill active={r.isActive} /></td>
                  <td className="px-3 py-3 text-white/50 text-xs">{formatDate(r.createdAt)}</td>
                  <td className="px-3 py-3 text-right">
                    <button data-testid={`row-actions-${r.id}`}
                      onClick={() => onOpenInspector(r.id)}
                      className="text-white/40 hover:text-white">⋯</button>
                  </td>
                </tr>
              ))
            : variant === 'campaigns'
            ? props.rows.map((r) => (
                <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-3 py-3">
                    <input type="checkbox" checked={selected.has(r.id)}
                      onChange={(e) => onSelect(r.id, e.currentTarget.checked)}
                      className="accent-emerald-500" />
                  </td>
                  <td className="px-3 py-3 text-white">{r.subject}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${CAMPAIGN_STATUS_PILL[r.status] ?? INACTIVE_PILL}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 tabular-nums">{r.audienceCount}</td>
                  <td className="px-3 py-3 tabular-nums">{r.sentCount}</td>
                  <td className="px-3 py-3 tabular-nums text-rose-300/80">{r.failedCount}</td>
                  <td className="px-3 py-3 text-white/50 text-xs">{r.sentAt ? formatDate(r.sentAt) : '—'}</td>
                  <td className="px-3 py-3 text-right">
                    <button data-testid={`row-actions-${r.id}`}
                      onClick={() => onOpenInspector(r.id)}
                      className="text-white/40 hover:text-white">⋯</button>
                  </td>
                </tr>
              ))
            : props.rows.map((r) => (
                <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-3 py-3">
                    <input type="checkbox" checked={selected.has(r.id)}
                      onChange={(e) => onSelect(r.id, e.currentTarget.checked)}
                      className="accent-emerald-500" />
                  </td>
                  <td className="px-3 py-3 text-white">{r.customerName ?? r.customerEmail}</td>
                  <td className="px-3 py-3 tabular-nums">{r.itemCount}</td>
                  <td className="px-3 py-3 tabular-nums">{formatCurrency(r.totalValue)}</td>
                  <td className="px-3 py-3 text-xs text-white/50">{r.recoveryEmailSent ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-3 font-mono text-xs text-white/70">{r.discountCode ?? '—'}</td>
                  <td className="px-3 py-3 text-white/50 text-xs">{formatDate(r.abandonedAt)}</td>
                  <td className="px-3 py-3 text-right">
                    <button data-testid={`row-actions-${r.id}`}
                      onClick={() => onOpenInspector(r.id)}
                      className="text-white/40 hover:text-white">⋯</button>
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/marketing/MarketingListTable.test.tsx`
Expected: PASS — 10 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/marketing/MarketingListTable.tsx tests/unit/components/admin/marketing/MarketingListTable.test.tsx
git commit -m "feat(admin-v2): add generic MarketingListTable with 5 variants"
git push -u origin wave5p5/task-3-list-table
gh pr create --title "feat(admin-v2): Phase 5 W2 generic MarketingListTable" --body "Adds a single desktop table component driven by a CVA-style variant prop covering promotions/popups/subscribers/campaigns/carts. Discriminated union on (variant, rows) ensures column-rendering type safety. Sticky header, per-row checkbox, ⋯ → onOpenInspector, loading skeleton, per-variant empty state."
```

---

### Task 4: `MarketingListCardMobile.tsx` (generic, swipe + long-press)

**Wave:** 2 | **Parallel-safe with:** Task 3 | **Branch:** `wave5p5/task-4-list-card-mobile` | **Model:** sonnet

**Schema realities for this task:**
- Same 5 variants as Task 3 with same discriminated-union prop shape.
- `onContextMenu` triggers long-press (mobile Safari fires it on long-press).
- `SwipeableRow` from `@/components/ui/SwipeableRow` provides swipe-left quick action.
- Per-variant swipe action:
  - `promotions` → Activate (calls `onQuickAction(id)`)
  - `popups` → Activate
  - `subscribers` → Unsubscribe
  - `campaigns` → NO swipe action (campaigns don't have a sensible 1-click quick action)
  - `carts` → Send Recovery

**Files:**
- Create: `components/admin/marketing/MarketingListCardMobile.tsx`
- Test: `tests/unit/components/admin/marketing/MarketingListCardMobile.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/marketing/MarketingListCardMobile.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MarketingListCardMobile } from '@/components/admin/marketing/MarketingListCardMobile'
import type { PromotionRow, CampaignRow } from '@/lib/admin/marketing'

vi.mock('@/components/ui/SwipeableRow', () => ({
  SwipeableRow: ({ children, rightActions }: {
    children: React.ReactNode
    rightActions?: Array<{ label: string; onClick: () => void }>
  }) => (
    <div data-testid="swipeable">
      {children}
      {rightActions?.map((a) => (
        <button key={a.label} data-testid={`swipe-action-${a.label}`} onClick={a.onClick}>
          {a.label}
        </button>
      ))}
    </div>
  ),
}))

const promo: PromotionRow = {
  id: 'p1', name: 'Summer 20', code: 'SUMMER20', type: 'PERCENTAGE',
  value: 20, isActive: false, usedCount: 12, maxUsesTotal: 100,
  startDate: new Date('2026-05-01'), endDate: null,
  totalDiscountGiven: 0, autoApply: false, stackable: false,
  createdAt: new Date('2026-05-01'),
}

const campaign: CampaignRow = {
  id: 'c1', name: 'May', subject: 'Hello May',
  status: 'DRAFT', audienceCount: 0, sentCount: 0, failedCount: 0,
  sentAt: null, createdAt: new Date(),
}

describe('MarketingListCardMobile promotions variant', () => {
  it('renders promotion name and shows Activate swipe action', () => {
    render(
      <MarketingListCardMobile
        variant="promotions"
        row={promo}
        selected={false}
        onLongPress={vi.fn()}
        onEdit={vi.fn()}
        onQuickAction={vi.fn()}
      />,
    )
    expect(screen.getByText('Summer 20')).toBeInTheDocument()
    expect(screen.getByTestId('swipe-action-Activate')).toBeInTheDocument()
  })

  it('fires onLongPress on contextmenu', () => {
    const onLongPress = vi.fn()
    render(
      <MarketingListCardMobile
        variant="promotions"
        row={promo}
        selected={false}
        onLongPress={onLongPress}
        onEdit={vi.fn()}
        onQuickAction={vi.fn()}
      />,
    )
    fireEvent.contextMenu(screen.getByTestId('marketing-card-p1'))
    expect(onLongPress).toHaveBeenCalledWith('p1')
  })

  it('fires onQuickAction when swipe action clicked', () => {
    const onQuickAction = vi.fn()
    render(
      <MarketingListCardMobile
        variant="promotions"
        row={promo}
        selected={false}
        onLongPress={vi.fn()}
        onEdit={vi.fn()}
        onQuickAction={onQuickAction}
      />,
    )
    fireEvent.click(screen.getByTestId('swipe-action-Activate'))
    expect(onQuickAction).toHaveBeenCalledWith('p1')
  })
})

describe('MarketingListCardMobile campaigns variant', () => {
  it('does NOT render any swipe action for campaigns', () => {
    render(
      <MarketingListCardMobile
        variant="campaigns"
        row={campaign}
        selected={false}
        onLongPress={vi.fn()}
        onEdit={vi.fn()}
        onQuickAction={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('swipe-action-Activate')).toBeNull()
    expect(screen.queryByTestId('swipe-action-Unsubscribe')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/marketing/MarketingListCardMobile.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/marketing/MarketingListCardMobile.tsx`**

```tsx
'use client'

/**
 * MarketingListCardMobile — mobile card for all 5 marketing tabs.
 *
 * One component, 5 variants. Long-press (onContextMenu) → multi-select.
 * Swipe-left → per-variant quick action (Activate / Unsubscribe / Send Recovery).
 * Campaigns have no swipe action.
 *
 * Phase 5 Task 4.
 */

import { PencilSimple } from '@phosphor-icons/react/dist/ssr'
import { SwipeableRow } from '@/components/ui/SwipeableRow'
import type {
  PromotionRow, PopupRow, SubscriberRow, CampaignRow, AbandonedCartRow,
} from '@/lib/admin/marketing'

// ─── Types ────────────────────────────────────────────────────────────────────

type RowProp =
  | { variant: 'promotions'; row: PromotionRow }
  | { variant: 'popups'; row: PopupRow }
  | { variant: 'subscribers'; row: SubscriberRow }
  | { variant: 'campaigns'; row: CampaignRow }
  | { variant: 'carts'; row: AbandonedCartRow }

type CommonProps = {
  selected: boolean
  onLongPress: (id: string) => void
  onEdit: (id: string) => void
  /** Per-variant quick action. No-op when variant=campaigns. */
  onQuickAction: (id: string) => void
}

export type MarketingListCardMobileProps = RowProp & CommonProps

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d)
}

// ─── Swipe action label per variant ───────────────────────────────────────────

function quickActionLabel(variant: RowProp['variant']): string | null {
  switch (variant) {
    case 'promotions':  return 'Activate'
    case 'popups':      return 'Activate'
    case 'subscribers': return 'Unsubscribe'
    case 'campaigns':   return null
    case 'carts':       return 'Send Recovery'
  }
}

// ─── Per-variant body renderer ────────────────────────────────────────────────

function CardBody(props: RowProp) {
  switch (props.variant) {
    case 'promotions': return (
      <>
        <p className="text-sm font-semibold text-white truncate">{props.row.name}</p>
        <p className="text-[11px] text-white/40 mt-0.5">
          {props.row.code ?? '—'} · {props.row.type} · {props.row.value}{props.row.type === 'PERCENTAGE' ? '%' : ''}
        </p>
      </>
    )
    case 'popups': return (
      <>
        <p className="text-sm font-semibold text-white truncate">{props.row.name}</p>
        <p className="text-[11px] text-white/40 mt-0.5">
          {props.row.template} · {props.row.conversions7d}/{props.row.impressions7d} (7d)
        </p>
      </>
    )
    case 'subscribers': return (
      <>
        <p className="text-sm font-semibold text-white truncate">{props.row.email}</p>
        <p className="text-[11px] text-white/40 mt-0.5">
          {props.row.source} · {formatDate(props.row.createdAt)}
        </p>
      </>
    )
    case 'campaigns': return (
      <>
        <p className="text-sm font-semibold text-white truncate">{props.row.subject}</p>
        <p className="text-[11px] text-white/40 mt-0.5">
          {props.row.status} · {props.row.sentCount}/{props.row.audienceCount}
        </p>
      </>
    )
    case 'carts': return (
      <>
        <p className="text-sm font-semibold text-white truncate">
          {props.row.customerName ?? props.row.customerEmail}
        </p>
        <p className="text-[11px] text-white/40 mt-0.5">
          {props.row.itemCount} item{props.row.itemCount === 1 ? '' : 's'} · {formatCurrency(props.row.totalValue)}
        </p>
      </>
    )
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MarketingListCardMobile(props: MarketingListCardMobileProps) {
  const { variant, selected, onLongPress, onEdit, onQuickAction } = props
  const id = props.row.id
  const label = quickActionLabel(variant)

  const card = (
    <article
      data-testid={`marketing-card-${id}`}
      onContextMenu={(e) => {
        e.preventDefault()
        onLongPress(id)
      }}
      className={[
        'relative px-4 py-3 border-b border-white/5 last:border-0 bg-neutral-900/60 transition-colors',
        selected ? 'border-l-2 border-l-emerald-500 ring-1 ring-emerald-500/30 bg-emerald-500/5' : '',
      ].filter(Boolean).join(' ')}
    >
      <CardBody {...props} />
      <button
        aria-label="Edit"
        onClick={() => onEdit(id)}
        className="absolute right-3 top-3 text-white/40 hover:text-white"
      >
        <PencilSimple size={16} weight="bold" />
      </button>
    </article>
  )

  if (!label) {
    return <div className="md:hidden">{card}</div>
  }

  return (
    <SwipeableRow
      rightActions={[{ label, onClick: () => onQuickAction(id) }]}
      className="md:hidden"
    >
      {card}
    </SwipeableRow>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/marketing/MarketingListCardMobile.test.tsx`
Expected: PASS — 4 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/marketing/MarketingListCardMobile.tsx tests/unit/components/admin/marketing/MarketingListCardMobile.test.tsx
git commit -m "feat(admin-v2): add generic MarketingListCardMobile with per-variant swipe action"
git push -u origin wave5p5/task-4-list-card-mobile
gh pr create --title "feat(admin-v2): Phase 5 W2 generic MarketingListCardMobile" --body "Adds a single mobile-card component covering all 5 marketing tabs. Long-press (onContextMenu) drives multi-select. Per-variant swipe-left quick action: Activate (promotions/popups), Unsubscribe (subscribers), Send Recovery (carts). Campaigns intentionally have no swipe action."
```

---

## Wave 3 — Inspectors (5 parallel, after W1 merged)

### Task 5: `PromotionInspector.tsx`

**Wave:** 3 | **Parallel-safe with:** 6, 7, 8, 9 | **Branch:** `wave5p5/task-5-promotion-inspector` | **Model:** sonnet

**Schema realities for this task:**
- Uses `import type` from `@/lib/admin/marketing` and value-imports from `@/app/admin/marketing/actions` only.
- 5 type options for the type select. The Suggest button calls `suggestPromotionCode` (server action returning `{ code }`); it does NOT write — clicking sets the input value only.
- `checkPromotionCodeUnique` runs on blur of the code input — shows a small "Taken" hint if `unique: false`.
- Inspector is full-edit: name, type, value, code + Suggest, minimum purchase, max uses total, start/end dates, isActive, autoApply toggles.
- All saves go through `updatePromotion(id, partial)`. `togglePromotionActive(id)` flips on the explicit toggle.

**Files:**
- Create: `components/admin/marketing/PromotionInspector.tsx`
- Test: `tests/unit/components/admin/marketing/PromotionInspector.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/marketing/PromotionInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/app/admin/marketing/actions', () => ({
  updatePromotion: vi.fn(async () => ({ ok: true })),
  togglePromotionActive: vi.fn(async () => ({ ok: true })),
  suggestPromotionCode: vi.fn(async () => ({ ok: true, data: { code: 'SUGG1234' } })),
  checkPromotionCodeUnique: vi.fn(async () => ({ ok: true, data: { unique: true } })),
}))
vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('@/components/ui/Inspector', () => ({
  Inspector: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="inspector">{children}</div> : null,
}))

const detail = {
  id: 'p1', name: 'Summer 20', description: null, code: 'SUMMER20',
  type: 'PERCENTAGE' as const, value: 20, autoApply: false, stackable: false,
  minimumPurchase: 50, maxUsesTotal: 100, maxUsesPerCustomer: 1, usedCount: 12,
  productIds: null, collectionIds: null, customerEmails: null,
  startDate: new Date('2026-05-01'), endDate: new Date('2026-06-01'),
  isActive: true, maxDiscountPercent: null, excludeFromLoyalty: false,
  totalDiscountGiven: 1234.5,
  createdAt: new Date('2026-05-01'), updatedAt: new Date('2026-05-01'),
}

beforeEach(() => { vi.clearAllMocks() })

describe('PromotionInspector', () => {
  it('renders empty when detail is null', async () => {
    const { PromotionInspector } = await import('@/components/admin/marketing/PromotionInspector')
    render(<PromotionInspector open detail={null} onClose={vi.fn()} />)
    expect(screen.queryByTestId('inspector')).toBeInTheDocument()
  })

  it('renders form fields with detail values', async () => {
    const { PromotionInspector } = await import('@/components/admin/marketing/PromotionInspector')
    render(<PromotionInspector open detail={detail} onClose={vi.fn()} />)
    expect(screen.getByDisplayValue('Summer 20')).toBeInTheDocument()
    expect(screen.getByDisplayValue('SUMMER20')).toBeInTheDocument()
  })

  it('Suggest button populates code field via suggestPromotionCode', async () => {
    const { PromotionInspector } = await import('@/components/admin/marketing/PromotionInspector')
    render(<PromotionInspector open detail={detail} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Suggest'))
    await waitFor(() => {
      expect((screen.getByLabelText(/code/i) as HTMLInputElement).value).toBe('SUGG1234')
    })
  })

  it('Save calls updatePromotion with edited values', async () => {
    const { PromotionInspector } = await import('@/components/admin/marketing/PromotionInspector')
    const { updatePromotion } = await import('@/app/admin/marketing/actions')
    render(<PromotionInspector open detail={detail} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Spring 25' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => {
      expect(updatePromotion).toHaveBeenCalledWith('p1', expect.objectContaining({ name: 'Spring 25' }))
    })
  })

  it('Activate toggle flips isActive via togglePromotionActive', async () => {
    const { PromotionInspector } = await import('@/components/admin/marketing/PromotionInspector')
    const { togglePromotionActive } = await import('@/app/admin/marketing/actions')
    render(<PromotionInspector open detail={detail} onClose={vi.fn()} />)
    fireEvent.click(screen.getByLabelText(/active/i))
    await waitFor(() => {
      expect(togglePromotionActive).toHaveBeenCalledWith('p1')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/marketing/PromotionInspector.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/marketing/PromotionInspector.tsx`**

```tsx
'use client'

/**
 * PromotionInspector — quick-edit drawer for a single promotion.
 * Full edit scope per Phase 5 spec.
 */

import { useEffect, useState, useTransition } from 'react'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'
import {
  updatePromotion,
  togglePromotionActive,
  suggestPromotionCode,
  checkPromotionCodeUnique,
  type PromotionDetailFull,
} from '@/app/admin/marketing/actions'

export interface PromotionInspectorProps {
  open: boolean
  detail: PromotionDetailFull | null
  onClose: () => void
  onSaved?: (id: string) => void
}

const TYPES = ['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING', 'BOGO', 'BUY_X_GET_Y'] as const

function toLocalDate(d: Date | null): string {
  if (!d) return ''
  return d.toISOString().slice(0, 10)
}

export function PromotionInspector({ open, detail, onClose, onSaved }: PromotionInspectorProps) {
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [type, setType] = useState<typeof TYPES[number]>('PERCENTAGE')
  const [value, setValue] = useState(0)
  const [code, setCode] = useState('')
  const [codeTaken, setCodeTaken] = useState(false)
  const [minimumPurchase, setMinimumPurchase] = useState(0)
  const [maxUsesTotal, setMaxUsesTotal] = useState<number | ''>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [autoApply, setAutoApply] = useState(false)
  const [isActive, setIsActive] = useState(true)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!detail) return
    setName(detail.name)
    setType(detail.type as typeof TYPES[number])
    setValue(detail.value)
    setCode(detail.code ?? '')
    setMinimumPurchase(detail.minimumPurchase)
    setMaxUsesTotal(detail.maxUsesTotal ?? '')
    setStartDate(toLocalDate(detail.startDate))
    setEndDate(toLocalDate(detail.endDate))
    setAutoApply(detail.autoApply)
    setIsActive(detail.isActive)
    setCodeTaken(false)
  }, [detail])
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleSuggest() {
    startTransition(async () => {
      const r = await suggestPromotionCode()
      if (r.ok && r.data) {
        setCode(r.data.code)
        setCodeTaken(false)
      }
    })
  }

  function handleCheckCode() {
    if (!code || code === (detail?.code ?? '')) return
    startTransition(async () => {
      const r = await checkPromotionCodeUnique(code)
      if (r.ok && r.data) setCodeTaken(!r.data.unique)
    })
  }

  function handleToggle() {
    if (!detail) return
    startTransition(async () => {
      const r = await togglePromotionActive(detail.id)
      if (r.ok) {
        setIsActive(!isActive)
        toast.success(isActive ? 'Deactivated' : 'Activated')
        onSaved?.(detail.id)
      } else {
        toast.error('Failed to toggle')
      }
    })
  }

  function handleSave() {
    if (!detail) return
    startTransition(async () => {
      const r = await updatePromotion(detail.id, {
        name, type, value, code: code || null,
        minimumPurchase,
        maxUsesTotal: maxUsesTotal === '' ? null : Number(maxUsesTotal),
        startDate: startDate ? new Date(startDate) : detail.startDate,
        endDate: endDate ? new Date(endDate) : null,
        autoApply, isActive,
      })
      if (r.ok) {
        toast.success('Saved')
        onSaved?.(detail.id)
      } else {
        toast.error('Failed to save')
      }
    })
  }

  return (
    <Inspector open={open} onClose={onClose} title={detail?.name ?? 'Promotion'}>
      {!detail ? (
        <div className="p-6 text-sm text-white/40">Loading…</div>
      ) : (
        <div className="p-4 space-y-3 text-sm">
          <label className="block">
            <span className="block text-[11px] uppercase text-white/40 mb-1">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white" />
          </label>
          <label className="block">
            <span className="block text-[11px] uppercase text-white/40 mb-1">Type</span>
            <select value={type} onChange={(e) => setType(e.target.value as typeof TYPES[number])}
              className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white">
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-[11px] uppercase text-white/40 mb-1">Value</span>
            <input type="number" value={value} onChange={(e) => setValue(Number(e.target.value))}
              className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white" />
          </label>
          <label className="block">
            <span className="block text-[11px] uppercase text-white/40 mb-1">Code</span>
            <div className="flex gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                onBlur={handleCheckCode}
                className="flex-1 bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white font-mono" />
              <button type="button" onClick={handleSuggest}
                className="px-3 py-1.5 text-xs bg-white/8 border border-white/15 rounded text-white">
                Suggest
              </button>
            </div>
            {codeTaken && <p className="text-[11px] text-rose-300 mt-1">Taken</p>}
          </label>
          <label className="block">
            <span className="block text-[11px] uppercase text-white/40 mb-1">Minimum purchase</span>
            <input type="number" value={minimumPurchase}
              onChange={(e) => setMinimumPurchase(Number(e.target.value))}
              className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white" />
          </label>
          <label className="block">
            <span className="block text-[11px] uppercase text-white/40 mb-1">Max uses total</span>
            <input type="number" value={maxUsesTotal}
              onChange={(e) => setMaxUsesTotal(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="block text-[11px] uppercase text-white/40 mb-1">Starts</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white" />
            </label>
            <label>
              <span className="block text-[11px] uppercase text-white/40 mb-1">Ends</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white" />
            </label>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={autoApply}
              onChange={(e) => setAutoApply(e.target.checked)}
              className="accent-emerald-500" />
            <span className="text-white/70 text-sm">Auto-apply at checkout</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isActive}
              onChange={handleToggle}
              className="accent-emerald-500" />
            <span className="text-white/70 text-sm">Active</span>
          </label>
          <div className="pt-3 border-t border-white/8 flex justify-end">
            <button onClick={handleSave} disabled={pending}
              className="px-4 py-1.5 text-sm bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded hover:bg-emerald-500/30 disabled:opacity-50">
              Save
            </button>
          </div>
        </div>
      )}
    </Inspector>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/marketing/PromotionInspector.test.tsx`
Expected: PASS — 5 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/marketing/PromotionInspector.tsx tests/unit/components/admin/marketing/PromotionInspector.test.tsx
git commit -m "feat(admin-v2): add PromotionInspector with full-edit form + Suggest"
git push -u origin wave5p5/task-5-promotion-inspector
gh pr create --title "feat(admin-v2): Phase 5 W3 PromotionInspector" --body "Drawer-based full-edit inspector for promotions. Suggest button calls suggestPromotionCode (no write); checkPromotionCodeUnique runs on blur. Save calls updatePromotion; Active toggle calls togglePromotionActive."
```

---

### Task 6: `PopupInspector.tsx`

**Wave:** 3 | **Parallel-safe with:** 5, 7, 8, 9 | **Branch:** `wave5p5/task-6-popup-inspector` | **Model:** sonnet

**Schema realities for this task:**
- Edit fields: name, template, position, trigger type + value, frequency, content textarea, isActive toggle.
- "Open editor →" link goes to `/admin/marketing/popups/[id]/edit` (Task 22 implements that page; this task just renders the Link).
- Template enum: 5 values. Position enum: 7 values. Trigger enum: 4 values. Frequency enum: 4 values.
- Uses `updatePopup(id, partial)` and `togglePopupActive(id)`.

**Files:**
- Create: `components/admin/marketing/PopupInspector.tsx`
- Test: `tests/unit/components/admin/marketing/PopupInspector.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/marketing/PopupInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/app/admin/marketing/actions', () => ({
  updatePopup: vi.fn(async () => ({ ok: true })),
  togglePopupActive: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('@/components/ui/Inspector', () => ({
  Inspector: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="inspector">{children}</div> : null,
}))
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    <a href={href}>{children}</a>,
}))

const detail = {
  id: 'pp1', name: 'Welcome', template: 'MODAL' as const, position: 'CENTER' as const,
  content: '{}', triggerType: 'DELAY' as const, triggerValue: 3,
  showOnPages: 'all', showToNewVisitors: true, showToReturning: false,
  frequency: 'ONCE_PER_SESSION' as const,
  startDate: null, endDate: null,
  isActive: true, priority: 1, promotionId: null,
  createdAt: new Date(), updatedAt: new Date(),
  variants: [],
  analytics7d: { impressions: 0, clicks: 0, dismissals: 0, conversions: 0 },
}

beforeEach(() => { vi.clearAllMocks() })

describe('PopupInspector', () => {
  it('renders empty when detail is null', async () => {
    const { PopupInspector } = await import('@/components/admin/marketing/PopupInspector')
    render(<PopupInspector open detail={null} onClose={vi.fn()} />)
    expect(screen.queryByTestId('inspector')).toBeInTheDocument()
  })

  it('renders all top-level fields', async () => {
    const { PopupInspector } = await import('@/components/admin/marketing/PopupInspector')
    render(<PopupInspector open detail={detail} onClose={vi.fn()} />)
    expect(screen.getByDisplayValue('Welcome')).toBeInTheDocument()
    expect(screen.getByDisplayValue('MODAL')).toBeInTheDocument()
    expect(screen.getByDisplayValue('CENTER')).toBeInTheDocument()
  })

  it('Save calls updatePopup', async () => {
    const { PopupInspector } = await import('@/components/admin/marketing/PopupInspector')
    const { updatePopup } = await import('@/app/admin/marketing/actions')
    render(<PopupInspector open detail={detail} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Welcome v2' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => {
      expect(updatePopup).toHaveBeenCalledWith('pp1', expect.objectContaining({ name: 'Welcome v2' }))
    })
  })

  it('Active toggle calls togglePopupActive', async () => {
    const { PopupInspector } = await import('@/components/admin/marketing/PopupInspector')
    const { togglePopupActive } = await import('@/app/admin/marketing/actions')
    render(<PopupInspector open detail={detail} onClose={vi.fn()} />)
    fireEvent.click(screen.getByLabelText(/active/i))
    await waitFor(() => {
      expect(togglePopupActive).toHaveBeenCalledWith('pp1')
    })
  })

  it('renders Open editor → link to /admin/marketing/popups/pp1/edit', async () => {
    const { PopupInspector } = await import('@/components/admin/marketing/PopupInspector')
    render(<PopupInspector open detail={detail} onClose={vi.fn()} />)
    const link = screen.getByText(/open editor/i).closest('a')
    expect(link).toHaveAttribute('href', '/admin/marketing/popups/pp1/edit')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/marketing/PopupInspector.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/marketing/PopupInspector.tsx`**

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'
import {
  updatePopup, togglePopupActive,
  type PopupDetailFull,
} from '@/app/admin/marketing/actions'

export interface PopupInspectorProps {
  open: boolean
  detail: PopupDetailFull | null
  onClose: () => void
  onSaved?: (id: string) => void
}

const TEMPLATES = ['MODAL', 'BANNER', 'SLIDE_IN', 'FULL_SCREEN', 'EMAIL_CAPTURE'] as const
const POSITIONS = ['TOP', 'BOTTOM', 'CENTER', 'BOTTOM_RIGHT', 'BOTTOM_LEFT', 'TOP_RIGHT', 'TOP_LEFT'] as const
const TRIGGERS = ['DELAY', 'SCROLL', 'EXIT_INTENT', 'IMMEDIATE'] as const
const FREQUENCIES = ['ONCE_PER_SESSION', 'ONCE_PER_DAY', 'ONCE_EVER', 'ALWAYS'] as const

export function PopupInspector({ open, detail, onClose, onSaved }: PopupInspectorProps) {
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [template, setTemplate] = useState<typeof TEMPLATES[number]>('MODAL')
  const [position, setPosition] = useState<typeof POSITIONS[number]>('CENTER')
  const [triggerType, setTriggerType] = useState<typeof TRIGGERS[number]>('DELAY')
  const [triggerValue, setTriggerValue] = useState(3)
  const [frequency, setFrequency] = useState<typeof FREQUENCIES[number]>('ONCE_PER_SESSION')
  const [content, setContent] = useState('')
  const [isActive, setIsActive] = useState(true)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!detail) return
    setName(detail.name)
    setTemplate(detail.template as typeof TEMPLATES[number])
    setPosition(detail.position as typeof POSITIONS[number])
    setTriggerType(detail.triggerType as typeof TRIGGERS[number])
    setTriggerValue(detail.triggerValue)
    setFrequency(detail.frequency as typeof FREQUENCIES[number])
    setContent(detail.content)
    setIsActive(detail.isActive)
  }, [detail])
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleToggle() {
    if (!detail) return
    startTransition(async () => {
      const r = await togglePopupActive(detail.id)
      if (r.ok) {
        setIsActive(!isActive)
        toast.success(isActive ? 'Deactivated' : 'Activated')
        onSaved?.(detail.id)
      } else { toast.error('Failed to toggle') }
    })
  }

  function handleSave() {
    if (!detail) return
    startTransition(async () => {
      const r = await updatePopup(detail.id, {
        name, template, position, triggerType, triggerValue, frequency, content, isActive,
      })
      if (r.ok) { toast.success('Saved'); onSaved?.(detail.id) }
      else { toast.error('Failed to save') }
    })
  }

  return (
    <Inspector open={open} onClose={onClose} title={detail?.name ?? 'Popup'}>
      {!detail ? (
        <div className="p-6 text-sm text-white/40">Loading…</div>
      ) : (
        <div className="p-4 space-y-3 text-sm">
          <label className="block">
            <span className="block text-[11px] uppercase text-white/40 mb-1">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="block text-[11px] uppercase text-white/40 mb-1">Template</span>
              <select value={template} onChange={(e) => setTemplate(e.target.value as typeof TEMPLATES[number])}
                className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white">
                {TEMPLATES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label>
              <span className="block text-[11px] uppercase text-white/40 mb-1">Position</span>
              <select value={position} onChange={(e) => setPosition(e.target.value as typeof POSITIONS[number])}
                className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white">
                {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="block text-[11px] uppercase text-white/40 mb-1">Trigger</span>
              <select value={triggerType} onChange={(e) => setTriggerType(e.target.value as typeof TRIGGERS[number])}
                className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white">
                {TRIGGERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label>
              <span className="block text-[11px] uppercase text-white/40 mb-1">Trigger value</span>
              <input type="number" value={triggerValue}
                onChange={(e) => setTriggerValue(Number(e.target.value))}
                className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white" />
            </label>
          </div>
          <label className="block">
            <span className="block text-[11px] uppercase text-white/40 mb-1">Frequency</span>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value as typeof FREQUENCIES[number])}
              className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white">
              {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-[11px] uppercase text-white/40 mb-1">Content (JSON)</span>
            <textarea value={content} onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white font-mono text-xs" />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isActive}
              onChange={handleToggle}
              className="accent-emerald-500" />
            <span className="text-white/70 text-sm">Active</span>
          </label>
          <div className="pt-2 border-t border-white/8 flex items-center justify-between">
            <Link href={`/admin/marketing/popups/${detail.id}/edit`}
              className="text-xs text-emerald-300 hover:text-emerald-200">
              Open editor →
            </Link>
            <button onClick={handleSave} disabled={pending}
              className="px-4 py-1.5 text-sm bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded hover:bg-emerald-500/30 disabled:opacity-50">
              Save
            </button>
          </div>
        </div>
      )}
    </Inspector>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/marketing/PopupInspector.test.tsx`
Expected: PASS — 5 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/marketing/PopupInspector.tsx tests/unit/components/admin/marketing/PopupInspector.test.tsx
git commit -m "feat(admin-v2): add PopupInspector with quick edit + link to full editor"
git push -u origin wave5p5/task-6-popup-inspector
gh pr create --title "feat(admin-v2): Phase 5 W3 PopupInspector" --body "Quick-edit drawer for popups: name, template, position, trigger, frequency, content, isActive. Open editor → link routes to the dedicated full editor page (Task 22)."
```

---

### Task 7: `SubscriberInspector.tsx`

**Wave:** 3 | **Parallel-safe with:** 5, 6, 8, 9 | **Branch:** `wave5p5/task-7-subscriber-inspector` | **Model:** sonnet

**Schema realities for this task:**
- Read-only profile view: email, source, sourceDetails, signup date, verified status, UTM source/medium/campaign, unsubscribed-at.
- Two action buttons: Unsubscribe + Delete.
- Delete button must be visually disabled when the current admin is NOT SUPER_ADMIN. The actual auth gate is enforced on the server (deleteSubscriber calls requireAdminRole), but the UI should disable the button to prevent confusion. Pass `isSuperAdmin` as a prop (set by the orchestrator from the V2 root).
- Both actions call back through `onSaved(id)` so the parent can close the inspector + refresh.

**Files:**
- Create: `components/admin/marketing/SubscriberInspector.tsx`
- Test: `tests/unit/components/admin/marketing/SubscriberInspector.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/marketing/SubscriberInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/app/admin/marketing/actions', () => ({
  unsubscribeSubscriber: vi.fn(async () => ({ ok: true })),
  deleteSubscriber: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('@/components/ui/Inspector', () => ({
  Inspector: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="inspector">{children}</div> : null,
}))

const detail = {
  id: 's1', email: 'ada@e.com', source: 'popup', sourceDetails: 'modal-A',
  isActive: true, isVerified: true,
  verifiedAt: new Date('2026-05-01'),
  unsubscribedAt: null, unsubscribeReason: null,
  utmSource: 'google', utmMedium: 'cpc', utmCampaign: 'spring',
  createdAt: new Date('2026-05-01'), updatedAt: new Date('2026-05-01'),
}

beforeEach(() => { vi.clearAllMocks() })

describe('SubscriberInspector', () => {
  it('renders email + source + UTM as read-only', async () => {
    const { SubscriberInspector } = await import('@/components/admin/marketing/SubscriberInspector')
    render(<SubscriberInspector open detail={detail} isSuperAdmin={false} onClose={vi.fn()} />)
    expect(screen.getByText('ada@e.com')).toBeInTheDocument()
    expect(screen.getByText('popup')).toBeInTheDocument()
    expect(screen.getByText('google')).toBeInTheDocument()
  })

  it('Unsubscribe button calls unsubscribeSubscriber', async () => {
    const { SubscriberInspector } = await import('@/components/admin/marketing/SubscriberInspector')
    const { unsubscribeSubscriber } = await import('@/app/admin/marketing/actions')
    render(<SubscriberInspector open detail={detail} isSuperAdmin={false} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Unsubscribe'))
    await waitFor(() => {
      expect(unsubscribeSubscriber).toHaveBeenCalledWith('s1')
    })
  })

  it('Delete is disabled when isSuperAdmin=false', async () => {
    const { SubscriberInspector } = await import('@/components/admin/marketing/SubscriberInspector')
    render(<SubscriberInspector open detail={detail} isSuperAdmin={false} onClose={vi.fn()} />)
    const btn = screen.getByText('Delete') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('Delete calls deleteSubscriber when isSuperAdmin=true', async () => {
    const { SubscriberInspector } = await import('@/components/admin/marketing/SubscriberInspector')
    const { deleteSubscriber } = await import('@/app/admin/marketing/actions')
    render(<SubscriberInspector open detail={detail} isSuperAdmin onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Delete'))
    await waitFor(() => {
      expect(deleteSubscriber).toHaveBeenCalledWith('s1')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/marketing/SubscriberInspector.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/marketing/SubscriberInspector.tsx`**

```tsx
'use client'

import { useTransition } from 'react'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'
import {
  unsubscribeSubscriber, deleteSubscriber,
  type SubscriberDetailFull,
} from '@/app/admin/marketing/actions'

export interface SubscriberInspectorProps {
  open: boolean
  detail: SubscriberDetailFull | null
  isSuperAdmin: boolean
  onClose: () => void
  onSaved?: (id: string) => void
}

function formatDate(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
      <span className="text-[11px] uppercase text-white/40">{label}</span>
      <span className="text-sm text-white">{value}</span>
    </div>
  )
}

export function SubscriberInspector({
  open, detail, isSuperAdmin, onClose, onSaved,
}: SubscriberInspectorProps) {
  const [pending, startTransition] = useTransition()

  function handleUnsubscribe() {
    if (!detail) return
    startTransition(async () => {
      const r = await unsubscribeSubscriber(detail.id)
      if (r.ok) { toast.success('Unsubscribed'); onSaved?.(detail.id) }
      else { toast.error('Failed to unsubscribe') }
    })
  }

  function handleDelete() {
    if (!detail) return
    if (!window.confirm(`Permanently delete ${detail.email}?`)) return
    startTransition(async () => {
      const r = await deleteSubscriber(detail.id)
      if (r.ok) { toast.success('Deleted'); onSaved?.(detail.id) }
      else { toast.error('Failed to delete') }
    })
  }

  return (
    <Inspector open={open} onClose={onClose} title={detail?.email ?? 'Subscriber'}>
      {!detail ? (
        <div className="p-6 text-sm text-white/40">Loading…</div>
      ) : (
        <div className="p-4 text-sm space-y-3">
          <div className="bg-neutral-900/60 border border-white/8 rounded p-3">
            <Row label="Email" value={detail.email} />
            <Row label="Source" value={detail.source} />
            <Row label="Source details" value={detail.sourceDetails ?? '—'} />
            <Row label="Signed up" value={formatDate(detail.createdAt)} />
            <Row label="Verified" value={detail.isVerified ? 'Yes' : 'No'} />
            <Row label="Status" value={detail.isActive ? 'Active' : 'Unsubscribed'} />
            <Row label="Unsubscribed at" value={formatDate(detail.unsubscribedAt)} />
            <Row label="UTM source" value={detail.utmSource ?? '—'} />
            <Row label="UTM medium" value={detail.utmMedium ?? '—'} />
            <Row label="UTM campaign" value={detail.utmCampaign ?? '—'} />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleUnsubscribe} disabled={pending || !detail.isActive}
              className="flex-1 px-3 py-1.5 text-sm bg-white/8 border border-white/15 rounded text-white disabled:opacity-40">
              Unsubscribe
            </button>
            <button onClick={handleDelete} disabled={pending || !isSuperAdmin}
              title={isSuperAdmin ? 'Permanently delete subscriber' : 'SUPER_ADMIN required'}
              className="flex-1 px-3 py-1.5 text-sm bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded disabled:opacity-40">
              Delete
            </button>
          </div>
        </div>
      )}
    </Inspector>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/marketing/SubscriberInspector.test.tsx`
Expected: PASS — 4 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/marketing/SubscriberInspector.tsx tests/unit/components/admin/marketing/SubscriberInspector.test.tsx
git commit -m "feat(admin-v2): add SubscriberInspector with read-only profile + unsubscribe/delete"
git push -u origin wave5p5/task-7-subscriber-inspector
gh pr create --title "feat(admin-v2): Phase 5 W3 SubscriberInspector" --body "Read-only profile (email, source, UTM, signup date, verified). Unsubscribe button + SUPER_ADMIN-gated Delete button (UI disabled, server enforces requireAdminRole)."
```

---

### Task 8: `CampaignInspector.tsx`

**Wave:** 3 | **Parallel-safe with:** 5, 6, 7, 9 | **Branch:** `wave5p5/task-8-campaign-inspector` | **Model:** sonnet

**Schema realities for this task:**
- Read-only summary: subject, status pill, audience count, sent count, failed count, sentAt.
- Buttons: Duplicate, Delete (DRAFT only — disabled otherwise), "Open editor →" link.
- Uses `duplicateCampaign`, `deleteCampaign`. Campaign status enum: `DRAFT | QUEUED | SENDING | SENT | FAILED`.

**Files:**
- Create: `components/admin/marketing/CampaignInspector.tsx`
- Test: `tests/unit/components/admin/marketing/CampaignInspector.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/marketing/CampaignInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/app/admin/marketing/actions', () => ({
  duplicateCampaign: vi.fn(async () => ({ ok: true, data: { id: 'c2' } })),
  deleteCampaign: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('@/components/ui/Inspector', () => ({
  Inspector: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="inspector">{children}</div> : null,
}))
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    <a href={href}>{children}</a>,
}))

const draft = {
  id: 'c1', name: 'May', subject: 'Hello May', preheader: 'Hi',
  heroImageUrl: null, ctaLabel: 'Shop', ctaUrl: '/',
  bodyMarkdown: 'Body', status: 'DRAFT' as const,
  audienceFilter: {}, audienceCount: 100, sentCount: 0, failedCount: 0,
  createdByAdminId: 'a1', sentAt: null,
  createdAt: new Date(), updatedAt: new Date(),
  recentTestDeliveries: [],
}

const sent = { ...draft, status: 'SENT' as const, sentCount: 100, sentAt: new Date() }

beforeEach(() => { vi.clearAllMocks() })

describe('CampaignInspector', () => {
  it('renders subject + audience + sent counts', async () => {
    const { CampaignInspector } = await import('@/components/admin/marketing/CampaignInspector')
    render(<CampaignInspector open detail={sent} onClose={vi.fn()} />)
    expect(screen.getByText('Hello May')).toBeInTheDocument()
    expect(screen.getByText('SENT')).toBeInTheDocument()
    expect(screen.getByText(/100/)).toBeInTheDocument()
  })

  it('Duplicate calls duplicateCampaign', async () => {
    const { CampaignInspector } = await import('@/components/admin/marketing/CampaignInspector')
    const { duplicateCampaign } = await import('@/app/admin/marketing/actions')
    render(<CampaignInspector open detail={sent} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Duplicate'))
    await waitFor(() => {
      expect(duplicateCampaign).toHaveBeenCalledWith('c1')
    })
  })

  it('Delete is disabled for non-DRAFT', async () => {
    const { CampaignInspector } = await import('@/components/admin/marketing/CampaignInspector')
    render(<CampaignInspector open detail={sent} onClose={vi.fn()} />)
    const btn = screen.getByText('Delete') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('Delete is enabled + calls deleteCampaign for DRAFT', async () => {
    const { CampaignInspector } = await import('@/components/admin/marketing/CampaignInspector')
    const { deleteCampaign } = await import('@/app/admin/marketing/actions')
    render(<CampaignInspector open detail={draft} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Delete'))
    await waitFor(() => {
      expect(deleteCampaign).toHaveBeenCalledWith('c1')
    })
  })

  it('renders Open editor → link to /admin/marketing/campaigns/c1/edit', async () => {
    const { CampaignInspector } = await import('@/components/admin/marketing/CampaignInspector')
    render(<CampaignInspector open detail={draft} onClose={vi.fn()} />)
    const link = screen.getByText(/open editor/i).closest('a')
    expect(link).toHaveAttribute('href', '/admin/marketing/campaigns/c1/edit')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/marketing/CampaignInspector.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/marketing/CampaignInspector.tsx`**

```tsx
'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'
import {
  duplicateCampaign, deleteCampaign,
  type CampaignDetailFull,
} from '@/app/admin/marketing/actions'

export interface CampaignInspectorProps {
  open: boolean
  detail: CampaignDetailFull | null
  onClose: () => void
  onSaved?: (id: string) => void
}

const STATUS_PILL: Record<string, string> = {
  DRAFT:   'bg-white/8 text-white/60',
  QUEUED:  'bg-amber-500/15 text-amber-300',
  SENDING: 'bg-sky-500/15 text-sky-300',
  SENT:    'bg-emerald-500/15 text-emerald-300',
  FAILED:  'bg-rose-500/15 text-rose-300',
}

function formatDate(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' })
}

export function CampaignInspector({ open, detail, onClose, onSaved }: CampaignInspectorProps) {
  const [pending, startTransition] = useTransition()

  function handleDuplicate() {
    if (!detail) return
    startTransition(async () => {
      const r = await duplicateCampaign(detail.id)
      if (r.ok) { toast.success('Duplicated'); onSaved?.(detail.id) }
      else { toast.error('Failed to duplicate') }
    })
  }

  function handleDelete() {
    if (!detail) return
    if (!window.confirm('Delete this draft campaign?')) return
    startTransition(async () => {
      const r = await deleteCampaign(detail.id)
      if (r.ok) { toast.success('Deleted'); onSaved?.(detail.id) }
      else { toast.error('Failed to delete') }
    })
  }

  const isDraft = detail?.status === 'DRAFT'

  return (
    <Inspector open={open} onClose={onClose} title={detail?.subject ?? 'Campaign'}>
      {!detail ? (
        <div className="p-6 text-sm text-white/40">Loading…</div>
      ) : (
        <div className="p-4 space-y-3 text-sm">
          <div>
            <h3 className="text-base font-semibold text-white">{detail.subject}</h3>
            <p className="text-[11px] text-white/50 mt-1">{detail.preheader}</p>
          </div>
          <div className="bg-neutral-900/60 border border-white/8 rounded p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase text-white/40">Status</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_PILL[detail.status] ?? 'bg-white/8 text-white/40'}`}>
                {detail.status}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Audience</span>
              <span className="tabular-nums text-white">{detail.audienceCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Sent</span>
              <span className="tabular-nums text-white">{detail.sentCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Failed</span>
              <span className="tabular-nums text-rose-300">{detail.failedCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Sent at</span>
              <span className="text-white/70 text-xs">{formatDate(detail.sentAt)}</span>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleDuplicate} disabled={pending}
              className="flex-1 px-3 py-1.5 text-sm bg-white/8 border border-white/15 rounded text-white disabled:opacity-40">
              Duplicate
            </button>
            <button onClick={handleDelete} disabled={pending || !isDraft}
              title={isDraft ? 'Delete draft' : 'Only DRAFT campaigns can be deleted'}
              className="flex-1 px-3 py-1.5 text-sm bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded disabled:opacity-40">
              Delete
            </button>
          </div>
          <div className="pt-2 border-t border-white/8">
            <Link href={`/admin/marketing/campaigns/${detail.id}/edit`}
              className="text-xs text-emerald-300 hover:text-emerald-200">
              Open editor →
            </Link>
          </div>
        </div>
      )}
    </Inspector>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/marketing/CampaignInspector.test.tsx`
Expected: PASS — 5 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/marketing/CampaignInspector.tsx tests/unit/components/admin/marketing/CampaignInspector.test.tsx
git commit -m "feat(admin-v2): add CampaignInspector with read-only summary + duplicate/delete"
git push -u origin wave5p5/task-8-campaign-inspector
gh pr create --title "feat(admin-v2): Phase 5 W3 CampaignInspector" --body "Read-only summary (subject, status pill, audience, sent, failed). Duplicate button calls duplicateCampaign. Delete button gated to DRAFT campaigns only. Open editor → link routes to the dedicated full editor page (Task 21)."
```

---

### Task 9: `AbandonedCartInspector.tsx`

**Wave:** 3 | **Parallel-safe with:** 5, 6, 7, 8 | **Branch:** `wave5p5/task-9-cart-inspector` | **Model:** sonnet

**Schema realities for this task:**
- `detail.items` is `AbandonedCartItem[]` (parsed by `lib/admin/marketing.ts`). Each item has productName, quantity, price, productImage?, variantDetails?.
- 3 action buttons:
  - Send Recovery Email → `sendCartRecoveryEmail(cartId)`. Disabled if `recoveryEmailSent` already true.
  - Generate One-Time Code → `generateCartRecoveryCode(cartId)`. Shows the generated code after success.
  - Mark Recovered → `markCartRecovered(cartId)`. Disabled if `recovered` already true.
- Display `discountCode` if already set on the cart.

**Files:**
- Create: `components/admin/marketing/AbandonedCartInspector.tsx`
- Test: `tests/unit/components/admin/marketing/AbandonedCartInspector.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/marketing/AbandonedCartInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/app/admin/marketing/actions', () => ({
  sendCartRecoveryEmail: vi.fn(async () => ({ ok: true })),
  generateCartRecoveryCode: vi.fn(async () => ({ ok: true, data: { code: 'NEWCODE1', promotionId: 'pNew' } })),
  markCartRecovered: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('@/components/ui/Inspector', () => ({
  Inspector: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="inspector">{children}</div> : null,
}))

const detail = {
  id: 'ac1', customerId: null,
  customerEmail: 'lost@e.com', customerName: 'Lost Shopper',
  items: [
    { productName: 'Tee', quantity: 2, price: 25, productImage: null, variantDetails: 'M / Black' },
    { productName: 'Hat', quantity: 1, price: 15, productImage: null, variantDetails: null },
  ],
  totalValue: 65, itemCount: 3,
  recoveryEmailSent: false, recoveryEmailSentAt: null,
  recovered: false, recoveredAt: null, recoveryOrderId: null,
  abandonedAt: new Date('2026-05-20'), expiresAt: new Date('2026-06-20'),
  discountCode: null,
}

beforeEach(() => { vi.clearAllMocks() })

describe('AbandonedCartInspector', () => {
  it('renders customer info + parsed items', async () => {
    const { AbandonedCartInspector } = await import('@/components/admin/marketing/AbandonedCartInspector')
    render(<AbandonedCartInspector open detail={detail} onClose={vi.fn()} />)
    expect(screen.getByText('Lost Shopper')).toBeInTheDocument()
    expect(screen.getByText('Tee')).toBeInTheDocument()
    expect(screen.getByText('Hat')).toBeInTheDocument()
  })

  it('Send Recovery Email calls sendCartRecoveryEmail', async () => {
    const { AbandonedCartInspector } = await import('@/components/admin/marketing/AbandonedCartInspector')
    const { sendCartRecoveryEmail } = await import('@/app/admin/marketing/actions')
    render(<AbandonedCartInspector open detail={detail} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText(/send recovery/i))
    await waitFor(() => {
      expect(sendCartRecoveryEmail).toHaveBeenCalledWith('ac1')
    })
  })

  it('Generate Code shows the returned code', async () => {
    const { AbandonedCartInspector } = await import('@/components/admin/marketing/AbandonedCartInspector')
    render(<AbandonedCartInspector open detail={detail} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText(/generate.*code/i))
    await waitFor(() => {
      expect(screen.getByText('NEWCODE1')).toBeInTheDocument()
    })
  })

  it('Mark Recovered calls markCartRecovered', async () => {
    const { AbandonedCartInspector } = await import('@/components/admin/marketing/AbandonedCartInspector')
    const { markCartRecovered } = await import('@/app/admin/marketing/actions')
    render(<AbandonedCartInspector open detail={detail} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText(/mark recovered/i))
    await waitFor(() => {
      expect(markCartRecovered).toHaveBeenCalledWith('ac1')
    })
  })

  it('Send Recovery Email is disabled when recoveryEmailSent already true', async () => {
    const { AbandonedCartInspector } = await import('@/components/admin/marketing/AbandonedCartInspector')
    render(<AbandonedCartInspector open detail={{ ...detail, recoveryEmailSent: true }} onClose={vi.fn()} />)
    const btn = screen.getByText(/send recovery/i) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/marketing/AbandonedCartInspector.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/marketing/AbandonedCartInspector.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'
import {
  sendCartRecoveryEmail, generateCartRecoveryCode, markCartRecovered,
  type AbandonedCartDetailFull,
} from '@/app/admin/marketing/actions'

export interface AbandonedCartInspectorProps {
  open: boolean
  detail: AbandonedCartDetailFull | null
  onClose: () => void
  onSaved?: (id: string) => void
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function formatDate(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function AbandonedCartInspector({
  open, detail, onClose, onSaved,
}: AbandonedCartInspectorProps) {
  const [pending, startTransition] = useTransition()
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)

  function handleSendRecovery() {
    if (!detail) return
    startTransition(async () => {
      const r = await sendCartRecoveryEmail(detail.id)
      if (r.ok) { toast.success('Recovery email queued'); onSaved?.(detail.id) }
      else { toast.error('Failed to send') }
    })
  }

  function handleGenerateCode() {
    if (!detail) return
    startTransition(async () => {
      const r = await generateCartRecoveryCode(detail.id)
      if (r.ok && r.data) {
        setGeneratedCode(r.data.code)
        toast.success('Code generated')
        onSaved?.(detail.id)
      } else { toast.error('Failed to generate code') }
    })
  }

  function handleMarkRecovered() {
    if (!detail) return
    startTransition(async () => {
      const r = await markCartRecovered(detail.id)
      if (r.ok) { toast.success('Marked recovered'); onSaved?.(detail.id) }
      else { toast.error('Failed to mark recovered') }
    })
  }

  return (
    <Inspector open={open} onClose={onClose} title={detail?.customerEmail ?? 'Abandoned cart'}>
      {!detail ? (
        <div className="p-6 text-sm text-white/40">Loading…</div>
      ) : (
        <div className="p-4 space-y-3 text-sm">
          <div className="bg-neutral-900/60 border border-white/8 rounded p-3">
            <p className="text-white font-semibold">{detail.customerName ?? detail.customerEmail}</p>
            <p className="text-[11px] text-white/40 mt-1">{detail.customerEmail}</p>
            <p className="text-[11px] text-white/40">
              Abandoned {formatDate(detail.abandonedAt)} · Expires {formatDate(detail.expiresAt)}
            </p>
          </div>

          <div className="bg-neutral-900/60 border border-white/8 rounded">
            <div className="px-3 py-2 border-b border-white/8 text-[11px] uppercase text-white/40">
              {detail.itemCount} item{detail.itemCount === 1 ? '' : 's'} · {formatCurrency(detail.totalValue)}
            </div>
            <ul className="divide-y divide-white/[0.04]">
              {detail.items.map((it, i) => (
                <li key={i} className="px-3 py-2 flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm">{it.productName}</p>
                    {it.variantDetails && (
                      <p className="text-[11px] text-white/40">{it.variantDetails}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-white tabular-nums">{formatCurrency(it.price)}</p>
                    <p className="text-[11px] text-white/40">x{it.quantity}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {(detail.discountCode || generatedCode) && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded p-3">
              <p className="text-[11px] uppercase text-emerald-300/70 mb-1">Recovery code</p>
              <p className="font-mono text-lg text-emerald-200">{generatedCode ?? detail.discountCode}</p>
            </div>
          )}

          <div className="space-y-2 pt-2">
            <button onClick={handleSendRecovery}
              disabled={pending || detail.recoveryEmailSent}
              className="w-full px-3 py-2 text-sm bg-white/8 border border-white/15 rounded text-white disabled:opacity-40">
              {detail.recoveryEmailSent ? 'Recovery email sent ✓' : 'Send Recovery Email'}
            </button>
            <button onClick={handleGenerateCode} disabled={pending}
              className="w-full px-3 py-2 text-sm bg-white/8 border border-white/15 rounded text-white disabled:opacity-40">
              Generate One-Time Code
            </button>
            <button onClick={handleMarkRecovered}
              disabled={pending || detail.recovered}
              className="w-full px-3 py-2 text-sm bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded disabled:opacity-40">
              {detail.recovered ? 'Recovered ✓' : 'Mark Recovered'}
            </button>
          </div>
        </div>
      )}
    </Inspector>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/marketing/AbandonedCartInspector.test.tsx`
Expected: PASS — 5 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/marketing/AbandonedCartInspector.tsx tests/unit/components/admin/marketing/AbandonedCartInspector.test.tsx
git commit -m "feat(admin-v2): add AbandonedCartInspector with cart contents + 3 action buttons"
git push -u origin wave5p5/task-9-cart-inspector
gh pr create --title "feat(admin-v2): Phase 5 W3 AbandonedCartInspector" --body "Cart contents preview (items from AbandonedCartDetailFull.items) + customer info + 3 action buttons: Send Recovery Email, Generate One-Time Code (displays returned code), Mark Recovered."
```

---

## Wave 4 — BulkSheets (5 parallel, after W1 merged)

### Task 10: `PromotionBulkSheet.tsx`

**Wave:** 4 | **Parallel-safe with:** 11, 12, 13, 14 | **Branch:** `wave5p5/task-10-promotion-bulk-sheet` | **Model:** sonnet

**Schema realities for this task:**
- 3 actions: Activate / Deactivate / Delete.
- Wraps `bulkActivatePromotions`, `bulkDeactivatePromotions`, `bulkDeletePromotions`.
- Uses `BottomActionSheet` from `@/components/ui/BottomActionSheet`.

**Files:**
- Create: `components/admin/marketing/PromotionBulkSheet.tsx`
- Test: `tests/unit/components/admin/marketing/PromotionBulkSheet.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/marketing/PromotionBulkSheet.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/app/admin/marketing/actions', () => ({
  bulkActivatePromotions: vi.fn(async () => ({ ok: true, affected: 2 })),
  bulkDeactivatePromotions: vi.fn(async () => ({ ok: true, affected: 2 })),
  bulkDeletePromotions: vi.fn(async () => ({ ok: true, affected: 2 })),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/ui/BottomActionSheet', () => ({
  BottomActionSheet: ({ actions, open }: {
    open: boolean
    actions: Array<{ label: string; onClick: () => void }>
  }) => open ? (
    <div data-testid="bulk-sheet">
      {actions.map((a) => (
        <button key={a.label} onClick={a.onClick}>{a.label}</button>
      ))}
    </div>
  ) : null,
}))

beforeEach(() => { vi.clearAllMocks() })

describe('PromotionBulkSheet', () => {
  it('renders Activate / Deactivate / Delete actions', async () => {
    const { PromotionBulkSheet } = await import('@/components/admin/marketing/PromotionBulkSheet')
    render(<PromotionBulkSheet open ids={['p1', 'p2']} onClear={vi.fn()} />)
    expect(screen.getByText('Activate')).toBeInTheDocument()
    expect(screen.getByText('Deactivate')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('Activate calls bulkActivatePromotions', async () => {
    const { PromotionBulkSheet } = await import('@/components/admin/marketing/PromotionBulkSheet')
    const { bulkActivatePromotions } = await import('@/app/admin/marketing/actions')
    render(<PromotionBulkSheet open ids={['p1', 'p2']} onClear={vi.fn()} />)
    fireEvent.click(screen.getByText('Activate'))
    await waitFor(() => {
      expect(bulkActivatePromotions).toHaveBeenCalledWith(['p1', 'p2'])
    })
  })

  it('Delete calls bulkDeletePromotions after confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { PromotionBulkSheet } = await import('@/components/admin/marketing/PromotionBulkSheet')
    const { bulkDeletePromotions } = await import('@/app/admin/marketing/actions')
    render(<PromotionBulkSheet open ids={['p1', 'p2']} onClear={vi.fn()} />)
    fireEvent.click(screen.getByText('Delete'))
    await waitFor(() => {
      expect(bulkDeletePromotions).toHaveBeenCalledWith(['p1', 'p2'])
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/marketing/PromotionBulkSheet.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/marketing/PromotionBulkSheet.tsx`**

```tsx
'use client'

import { useTransition } from 'react'
import { Check, Prohibit, Trash } from '@phosphor-icons/react/dist/ssr'
import { BottomActionSheet } from '@/components/ui/BottomActionSheet'
import { toast } from '@/lib/toast'
import {
  bulkActivatePromotions, bulkDeactivatePromotions, bulkDeletePromotions,
} from '@/app/admin/marketing/actions'

export interface PromotionBulkSheetProps {
  open: boolean
  ids: string[]
  onClear: () => void
}

export function PromotionBulkSheet({ open, ids, onClear }: PromotionBulkSheetProps) {
  const [, startTransition] = useTransition()

  function run(fn: (ids: string[]) => Promise<{ ok: boolean; affected?: number; error?: string }>, label: string) {
    startTransition(async () => {
      try {
        const r = await fn(ids)
        if (r.ok) {
          toast.success(`${r.affected} ${label}`)
          onClear()
        } else {
          toast.error(r.error ?? 'Failed')
        }
      } catch { toast.error('Unexpected error') }
    })
  }

  return (
    <BottomActionSheet
      open={open}
      count={ids.length}
      onCancel={onClear}
      actions={[
        { label: 'Activate', icon: <Check size={14} weight="bold" />,
          onClick: () => run(bulkActivatePromotions, 'activated') },
        { label: 'Deactivate', icon: <Prohibit size={14} weight="bold" />,
          onClick: () => run(bulkDeactivatePromotions, 'deactivated') },
        { label: 'Delete', icon: <Trash size={14} weight="bold" />,
          onClick: () => {
            if (window.confirm(`Delete ${ids.length} promotion${ids.length === 1 ? '' : 's'}?`)) {
              run(bulkDeletePromotions, 'deleted')
            }
          } },
      ]}
    />
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/marketing/PromotionBulkSheet.test.tsx`
Expected: PASS — 3 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/marketing/PromotionBulkSheet.tsx tests/unit/components/admin/marketing/PromotionBulkSheet.test.tsx
git commit -m "feat(admin-v2): add PromotionBulkSheet (activate/deactivate/delete)"
git push -u origin wave5p5/task-10-promotion-bulk-sheet
gh pr create --title "feat(admin-v2): Phase 5 W4 PromotionBulkSheet" --body "Bottom action sheet wiring 3 bulk promotion actions through the corresponding server actions, with toast feedback and confirm prompt on delete."
```

---

### Task 11: `PopupBulkSheet.tsx`

**Wave:** 4 | **Parallel-safe with:** 10, 12, 13, 14 | **Branch:** `wave5p5/task-11-popup-bulk-sheet` | **Model:** sonnet

**Schema realities for this task:**
- 4 actions: Activate / Deactivate / Duplicate / Delete.
- Wraps `bulkActivatePopups`, `bulkDeactivatePopups`, `bulkDuplicatePopups`, `bulkDeletePopups`.

**Files:**
- Create: `components/admin/marketing/PopupBulkSheet.tsx`
- Test: `tests/unit/components/admin/marketing/PopupBulkSheet.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/marketing/PopupBulkSheet.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/app/admin/marketing/actions', () => ({
  bulkActivatePopups: vi.fn(async () => ({ ok: true, affected: 2 })),
  bulkDeactivatePopups: vi.fn(async () => ({ ok: true, affected: 2 })),
  bulkDuplicatePopups: vi.fn(async () => ({ ok: true, affected: 2 })),
  bulkDeletePopups: vi.fn(async () => ({ ok: true, affected: 2 })),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/ui/BottomActionSheet', () => ({
  BottomActionSheet: ({ actions, open }: {
    open: boolean; actions: Array<{ label: string; onClick: () => void }>
  }) => open ? (
    <div data-testid="bulk-sheet">
      {actions.map((a) => <button key={a.label} onClick={a.onClick}>{a.label}</button>)}
    </div>
  ) : null,
}))

beforeEach(() => { vi.clearAllMocks() })

describe('PopupBulkSheet', () => {
  it('renders all 4 actions', async () => {
    const { PopupBulkSheet } = await import('@/components/admin/marketing/PopupBulkSheet')
    render(<PopupBulkSheet open ids={['p1']} onClear={vi.fn()} />)
    expect(screen.getByText('Activate')).toBeInTheDocument()
    expect(screen.getByText('Deactivate')).toBeInTheDocument()
    expect(screen.getByText('Duplicate')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('Duplicate calls bulkDuplicatePopups', async () => {
    const { PopupBulkSheet } = await import('@/components/admin/marketing/PopupBulkSheet')
    const { bulkDuplicatePopups } = await import('@/app/admin/marketing/actions')
    render(<PopupBulkSheet open ids={['p1']} onClear={vi.fn()} />)
    fireEvent.click(screen.getByText('Duplicate'))
    await waitFor(() => { expect(bulkDuplicatePopups).toHaveBeenCalledWith(['p1']) })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/marketing/PopupBulkSheet.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/marketing/PopupBulkSheet.tsx`**

```tsx
'use client'

import { useTransition } from 'react'
import { Check, Prohibit, Copy, Trash } from '@phosphor-icons/react/dist/ssr'
import { BottomActionSheet } from '@/components/ui/BottomActionSheet'
import { toast } from '@/lib/toast'
import {
  bulkActivatePopups, bulkDeactivatePopups, bulkDuplicatePopups, bulkDeletePopups,
} from '@/app/admin/marketing/actions'

export interface PopupBulkSheetProps {
  open: boolean
  ids: string[]
  onClear: () => void
}

export function PopupBulkSheet({ open, ids, onClear }: PopupBulkSheetProps) {
  const [, startTransition] = useTransition()

  function run(fn: (ids: string[]) => Promise<{ ok: boolean; affected?: number; error?: string }>, label: string) {
    startTransition(async () => {
      try {
        const r = await fn(ids)
        if (r.ok) { toast.success(`${r.affected} ${label}`); onClear() }
        else { toast.error(r.error ?? 'Failed') }
      } catch { toast.error('Unexpected error') }
    })
  }

  return (
    <BottomActionSheet
      open={open}
      count={ids.length}
      onCancel={onClear}
      actions={[
        { label: 'Activate', icon: <Check size={14} weight="bold" />,
          onClick: () => run(bulkActivatePopups, 'activated') },
        { label: 'Deactivate', icon: <Prohibit size={14} weight="bold" />,
          onClick: () => run(bulkDeactivatePopups, 'deactivated') },
        { label: 'Duplicate', icon: <Copy size={14} weight="bold" />,
          onClick: () => run(bulkDuplicatePopups, 'duplicated') },
        { label: 'Delete', icon: <Trash size={14} weight="bold" />,
          onClick: () => {
            if (window.confirm(`Delete ${ids.length} popup${ids.length === 1 ? '' : 's'}?`)) {
              run(bulkDeletePopups, 'deleted')
            }
          } },
      ]}
    />
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/marketing/PopupBulkSheet.test.tsx`
Expected: PASS — 2 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/marketing/PopupBulkSheet.tsx tests/unit/components/admin/marketing/PopupBulkSheet.test.tsx
git commit -m "feat(admin-v2): add PopupBulkSheet (activate/deactivate/duplicate/delete)"
git push -u origin wave5p5/task-11-popup-bulk-sheet
gh pr create --title "feat(admin-v2): Phase 5 W4 PopupBulkSheet" --body "4-action bulk sheet for popups."
```

---

### Task 12: `SubscriberBulkSheet.tsx`

**Wave:** 4 | **Parallel-safe with:** 10, 11, 13, 14 | **Branch:** `wave5p5/task-12-subscriber-bulk-sheet` | **Model:** sonnet

**Schema realities for this task:**
- 3 actions: Unsubscribe / Export CSV / Delete (SUPER_ADMIN-gated).
- CSV download via Blob + `a.download` (Phase 4 OrderBulkActionsSheet precedent).
- Delete button disabled when `isSuperAdmin=false` (also enforced server-side).

**Files:**
- Create: `components/admin/marketing/SubscriberBulkSheet.tsx`
- Test: `tests/unit/components/admin/marketing/SubscriberBulkSheet.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/marketing/SubscriberBulkSheet.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/app/admin/marketing/actions', () => ({
  bulkUnsubscribeSubscribers: vi.fn(async () => ({ ok: true, affected: 2 })),
  bulkExportSubscribersCsv: vi.fn(async () => ({ ok: true, data: { csv: 'email,source\na@e.com,popup' } })),
  bulkDeleteSubscribers: vi.fn(async () => ({ ok: true, affected: 2 })),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/ui/BottomActionSheet', () => ({
  BottomActionSheet: ({ actions, open }: {
    open: boolean
    actions: Array<{ label: string; onClick: () => void; disabled?: boolean }>
  }) => open ? (
    <div data-testid="bulk-sheet">
      {actions.map((a) => (
        <button key={a.label} onClick={a.onClick} disabled={a.disabled}>{a.label}</button>
      ))}
    </div>
  ) : null,
}))

beforeEach(() => { vi.clearAllMocks() })

describe('SubscriberBulkSheet', () => {
  it('renders 3 actions', async () => {
    const { SubscriberBulkSheet } = await import('@/components/admin/marketing/SubscriberBulkSheet')
    render(<SubscriberBulkSheet open ids={['s1']} isSuperAdmin={false} onClear={vi.fn()} />)
    expect(screen.getByText('Unsubscribe')).toBeInTheDocument()
    expect(screen.getByText('Export CSV')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('Delete is disabled when isSuperAdmin=false', async () => {
    const { SubscriberBulkSheet } = await import('@/components/admin/marketing/SubscriberBulkSheet')
    render(<SubscriberBulkSheet open ids={['s1']} isSuperAdmin={false} onClear={vi.fn()} />)
    expect((screen.getByText('Delete') as HTMLButtonElement).disabled).toBe(true)
  })

  it('Export CSV triggers download via blob', async () => {
    const { SubscriberBulkSheet } = await import('@/components/admin/marketing/SubscriberBulkSheet')
    const createObjectURL = vi.fn(() => 'blob:abc')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(window, 'URL', {
      value: { createObjectURL, revokeObjectURL }, configurable: true,
    })
    render(<SubscriberBulkSheet open ids={['s1']} isSuperAdmin onClear={vi.fn()} />)
    fireEvent.click(screen.getByText('Export CSV'))
    await waitFor(() => { expect(createObjectURL).toHaveBeenCalled() })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/marketing/SubscriberBulkSheet.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/marketing/SubscriberBulkSheet.tsx`**

```tsx
'use client'

import { useTransition } from 'react'
import { Prohibit, DownloadSimple, Trash } from '@phosphor-icons/react/dist/ssr'
import { BottomActionSheet } from '@/components/ui/BottomActionSheet'
import { toast } from '@/lib/toast'
import {
  bulkUnsubscribeSubscribers, bulkExportSubscribersCsv, bulkDeleteSubscribers,
} from '@/app/admin/marketing/actions'

export interface SubscriberBulkSheetProps {
  open: boolean
  ids: string[]
  isSuperAdmin: boolean
  onClear: () => void
}

export function SubscriberBulkSheet({
  open, ids, isSuperAdmin, onClear,
}: SubscriberBulkSheetProps) {
  const [, startTransition] = useTransition()

  function handleUnsubscribe() {
    startTransition(async () => {
      try {
        const r = await bulkUnsubscribeSubscribers(ids)
        if (r.ok) { toast.success(`${r.affected} unsubscribed`); onClear() }
        else { toast.error(r.error ?? 'Failed') }
      } catch { toast.error('Unexpected error') }
    })
  }

  function handleExport() {
    startTransition(async () => {
      try {
        const r = await bulkExportSubscribersCsv(ids)
        if (!r.ok) { toast.error(r.error); return }
        const csv = r.data?.csv ?? ''
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `subscribers-${Date.now()}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        toast.success('CSV downloaded')
      } catch { toast.error('Unexpected error') }
    })
  }

  function handleDelete() {
    if (!window.confirm(`Permanently delete ${ids.length} subscriber${ids.length === 1 ? '' : 's'}?`)) return
    startTransition(async () => {
      try {
        const r = await bulkDeleteSubscribers(ids)
        if (r.ok) { toast.success(`${r.affected} deleted`); onClear() }
        else { toast.error(r.error ?? 'Failed') }
      } catch { toast.error('Unexpected error') }
    })
  }

  return (
    <BottomActionSheet
      open={open}
      count={ids.length}
      onCancel={onClear}
      actions={[
        { label: 'Unsubscribe', icon: <Prohibit size={14} weight="bold" />, onClick: handleUnsubscribe },
        { label: 'Export CSV', icon: <DownloadSimple size={14} weight="bold" />, onClick: handleExport },
        { label: 'Delete', icon: <Trash size={14} weight="bold" />,
          onClick: handleDelete, disabled: !isSuperAdmin },
      ]}
    />
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/marketing/SubscriberBulkSheet.test.tsx`
Expected: PASS — 3 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/marketing/SubscriberBulkSheet.tsx tests/unit/components/admin/marketing/SubscriberBulkSheet.test.tsx
git commit -m "feat(admin-v2): add SubscriberBulkSheet (unsubscribe/export csv/delete)"
git push -u origin wave5p5/task-12-subscriber-bulk-sheet
gh pr create --title "feat(admin-v2): Phase 5 W4 SubscriberBulkSheet" --body "3-action bulk sheet for subscribers; Delete gated to SUPER_ADMIN; CSV export via blob + a.download."
```

---

### Task 13: `CampaignBulkSheet.tsx`

**Wave:** 4 | **Parallel-safe with:** 10, 11, 12, 14 | **Branch:** `wave5p5/task-13-campaign-bulk-sheet` | **Model:** sonnet

**Schema realities for this task:**
- 2 actions: Duplicate / Delete drafts.
- `bulkDeleteCampaigns` silently filters to DRAFT-only on the server; client emits a warning toast if any selected row has `status !== 'DRAFT'`.
- To detect non-drafts, the orchestrator passes the full selected rows (not just ids). Type the prop as `rows: Array<{ id: string; status: NewsletterCampaignStatus }>`.

**Files:**
- Create: `components/admin/marketing/CampaignBulkSheet.tsx`
- Test: `tests/unit/components/admin/marketing/CampaignBulkSheet.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/marketing/CampaignBulkSheet.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/app/admin/marketing/actions', () => ({
  bulkDuplicateCampaigns: vi.fn(async () => ({ ok: true, affected: 2 })),
  bulkDeleteCampaigns: vi.fn(async () => ({ ok: true, affected: 1 })),
}))
const toastWarn = vi.fn()
vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: toastWarn },
}))
vi.mock('@/components/ui/BottomActionSheet', () => ({
  BottomActionSheet: ({ actions, open }: {
    open: boolean; actions: Array<{ label: string; onClick: () => void }>
  }) => open ? (
    <div data-testid="bulk-sheet">
      {actions.map((a) => <button key={a.label} onClick={a.onClick}>{a.label}</button>)}
    </div>
  ) : null,
}))

beforeEach(() => { vi.clearAllMocks() })

describe('CampaignBulkSheet', () => {
  it('renders Duplicate and Delete actions', async () => {
    const { CampaignBulkSheet } = await import('@/components/admin/marketing/CampaignBulkSheet')
    render(<CampaignBulkSheet open
      rows={[{ id: 'c1', status: 'DRAFT' }]} onClear={vi.fn()} />)
    expect(screen.getByText('Duplicate')).toBeInTheDocument()
    expect(screen.getByText('Delete drafts')).toBeInTheDocument()
  })

  it('Duplicate calls bulkDuplicateCampaigns', async () => {
    const { CampaignBulkSheet } = await import('@/components/admin/marketing/CampaignBulkSheet')
    const { bulkDuplicateCampaigns } = await import('@/app/admin/marketing/actions')
    render(<CampaignBulkSheet open
      rows={[{ id: 'c1', status: 'DRAFT' }, { id: 'c2', status: 'SENT' }]} onClear={vi.fn()} />)
    fireEvent.click(screen.getByText('Duplicate'))
    await waitFor(() => { expect(bulkDuplicateCampaigns).toHaveBeenCalledWith(['c1', 'c2']) })
  })

  it('Delete drafts warns when selection includes non-DRAFT campaigns', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { CampaignBulkSheet } = await import('@/components/admin/marketing/CampaignBulkSheet')
    render(<CampaignBulkSheet open
      rows={[{ id: 'c1', status: 'DRAFT' }, { id: 'c2', status: 'SENT' }]} onClear={vi.fn()} />)
    fireEvent.click(screen.getByText('Delete drafts'))
    await waitFor(() => { expect(toastWarn).toHaveBeenCalled() })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/marketing/CampaignBulkSheet.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/marketing/CampaignBulkSheet.tsx`**

```tsx
'use client'

import { useTransition } from 'react'
import type { NewsletterCampaignStatus } from '@prisma/client'
import { Copy, Trash } from '@phosphor-icons/react/dist/ssr'
import { BottomActionSheet } from '@/components/ui/BottomActionSheet'
import { toast } from '@/lib/toast'
import {
  bulkDuplicateCampaigns, bulkDeleteCampaigns,
} from '@/app/admin/marketing/actions'

export interface CampaignBulkSheetProps {
  open: boolean
  rows: Array<{ id: string; status: NewsletterCampaignStatus }>
  onClear: () => void
}

export function CampaignBulkSheet({ open, rows, onClear }: CampaignBulkSheetProps) {
  const [, startTransition] = useTransition()
  const ids = rows.map((r) => r.id)
  const hasNonDraft = rows.some((r) => r.status !== 'DRAFT')

  function handleDuplicate() {
    startTransition(async () => {
      try {
        const r = await bulkDuplicateCampaigns(ids)
        if (r.ok) { toast.success(`${r.affected} duplicated`); onClear() }
        else { toast.error(r.error ?? 'Failed') }
      } catch { toast.error('Unexpected error') }
    })
  }

  function handleDelete() {
    if (hasNonDraft) {
      toast.warning('Only DRAFT campaigns will be deleted; SENT/QUEUED/SENDING rows are skipped.')
    }
    if (!window.confirm(`Delete ${rows.length} campaign${rows.length === 1 ? '' : 's'} (drafts only)?`)) return
    startTransition(async () => {
      try {
        const r = await bulkDeleteCampaigns(ids)
        if (r.ok) { toast.success(`${r.affected} deleted`); onClear() }
        else { toast.error(r.error ?? 'Failed') }
      } catch { toast.error('Unexpected error') }
    })
  }

  return (
    <BottomActionSheet
      open={open}
      count={rows.length}
      onCancel={onClear}
      actions={[
        { label: 'Duplicate', icon: <Copy size={14} weight="bold" />, onClick: handleDuplicate },
        { label: 'Delete drafts', icon: <Trash size={14} weight="bold" />, onClick: handleDelete },
      ]}
    />
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/marketing/CampaignBulkSheet.test.tsx`
Expected: PASS — 3 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/marketing/CampaignBulkSheet.tsx tests/unit/components/admin/marketing/CampaignBulkSheet.test.tsx
git commit -m "feat(admin-v2): add CampaignBulkSheet (duplicate/delete drafts) with non-DRAFT warning"
git push -u origin wave5p5/task-13-campaign-bulk-sheet
gh pr create --title "feat(admin-v2): Phase 5 W4 CampaignBulkSheet" --body "2-action bulk sheet for campaigns. Emits a warning toast when the selection includes non-DRAFT rows (server silently filters)."
```

---

### Task 14: `AbandonedCartBulkSheet.tsx`

**Wave:** 4 | **Parallel-safe with:** 10, 11, 12, 13 | **Branch:** `wave5p5/task-14-cart-bulk-sheet` | **Model:** sonnet

**Schema realities for this task:**
- 3 actions: Send Recovery / Generate Codes / Mark Recovered.
- Wraps `bulkSendRecoveryEmails`, `bulkGenerateRecoveryCodes`, `bulkMarkCartsRecovered`.

**Files:**
- Create: `components/admin/marketing/AbandonedCartBulkSheet.tsx`
- Test: `tests/unit/components/admin/marketing/AbandonedCartBulkSheet.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/marketing/AbandonedCartBulkSheet.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/app/admin/marketing/actions', () => ({
  bulkSendRecoveryEmails: vi.fn(async () => ({ ok: true, affected: 2 })),
  bulkGenerateRecoveryCodes: vi.fn(async () => ({ ok: true, affected: 2 })),
  bulkMarkCartsRecovered: vi.fn(async () => ({ ok: true, affected: 2 })),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/ui/BottomActionSheet', () => ({
  BottomActionSheet: ({ actions, open }: {
    open: boolean; actions: Array<{ label: string; onClick: () => void }>
  }) => open ? (
    <div data-testid="bulk-sheet">
      {actions.map((a) => <button key={a.label} onClick={a.onClick}>{a.label}</button>)}
    </div>
  ) : null,
}))

beforeEach(() => { vi.clearAllMocks() })

describe('AbandonedCartBulkSheet', () => {
  it('renders 3 actions', async () => {
    const { AbandonedCartBulkSheet } = await import('@/components/admin/marketing/AbandonedCartBulkSheet')
    render(<AbandonedCartBulkSheet open ids={['ac1']} onClear={vi.fn()} />)
    expect(screen.getByText('Send Recovery')).toBeInTheDocument()
    expect(screen.getByText('Generate Codes')).toBeInTheDocument()
    expect(screen.getByText('Mark Recovered')).toBeInTheDocument()
  })

  it('Send Recovery calls bulkSendRecoveryEmails', async () => {
    const { AbandonedCartBulkSheet } = await import('@/components/admin/marketing/AbandonedCartBulkSheet')
    const { bulkSendRecoveryEmails } = await import('@/app/admin/marketing/actions')
    render(<AbandonedCartBulkSheet open ids={['ac1', 'ac2']} onClear={vi.fn()} />)
    fireEvent.click(screen.getByText('Send Recovery'))
    await waitFor(() => { expect(bulkSendRecoveryEmails).toHaveBeenCalledWith(['ac1', 'ac2']) })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/marketing/AbandonedCartBulkSheet.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/marketing/AbandonedCartBulkSheet.tsx`**

```tsx
'use client'

import { useTransition } from 'react'
import { EnvelopeSimple, Ticket, Check } from '@phosphor-icons/react/dist/ssr'
import { BottomActionSheet } from '@/components/ui/BottomActionSheet'
import { toast } from '@/lib/toast'
import {
  bulkSendRecoveryEmails, bulkGenerateRecoveryCodes, bulkMarkCartsRecovered,
} from '@/app/admin/marketing/actions'

export interface AbandonedCartBulkSheetProps {
  open: boolean
  ids: string[]
  onClear: () => void
}

export function AbandonedCartBulkSheet({ open, ids, onClear }: AbandonedCartBulkSheetProps) {
  const [, startTransition] = useTransition()

  function run(fn: (ids: string[]) => Promise<{ ok: boolean; affected?: number; error?: string }>, label: string) {
    startTransition(async () => {
      try {
        const r = await fn(ids)
        if (r.ok) { toast.success(`${r.affected} ${label}`); onClear() }
        else { toast.error(r.error ?? 'Failed') }
      } catch { toast.error('Unexpected error') }
    })
  }

  return (
    <BottomActionSheet
      open={open}
      count={ids.length}
      onCancel={onClear}
      actions={[
        { label: 'Send Recovery', icon: <EnvelopeSimple size={14} weight="bold" />,
          onClick: () => run(bulkSendRecoveryEmails, 'recovery emails queued') },
        { label: 'Generate Codes', icon: <Ticket size={14} weight="bold" />,
          onClick: () => run(bulkGenerateRecoveryCodes, 'codes generated') },
        { label: 'Mark Recovered', icon: <Check size={14} weight="bold" />,
          onClick: () => run(bulkMarkCartsRecovered, 'marked recovered') },
      ]}
    />
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/marketing/AbandonedCartBulkSheet.test.tsx`
Expected: PASS — 2 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/marketing/AbandonedCartBulkSheet.tsx tests/unit/components/admin/marketing/AbandonedCartBulkSheet.test.tsx
git commit -m "feat(admin-v2): add AbandonedCartBulkSheet (send recovery/generate codes/mark recovered)"
git push -u origin wave5p5/task-14-cart-bulk-sheet
gh pr create --title "feat(admin-v2): Phase 5 W4 AbandonedCartBulkSheet" --body "3-action bulk sheet wiring per-cart recovery server actions."
```

---

## Wave 5 — ListViews (5 parallel, after W2 + W3 + W4 merged)

> **Cross-cutting agent note (#7):** Read the merged W3 Inspector prop signatures and W4 BulkSheet prop signatures from the actual files (not the plan prose) and adopt them verbatim. Tests-as-source-of-truth — if the merged Inspector exports `PromotionInspectorProps { open, detail, onClose, onSaved? }`, use those exact prop names here.

### Task 15: `PromotionsListView.tsx` orchestrator

**Wave:** 5 | **Parallel-safe with:** 16, 17, 18, 19 | **Branch:** `wave5p5/task-15-promotions-list-view` | **Model:** sonnet

**Schema realities for this task:**
- Wires `MarketingListTable variant="promotions"` + `MarketingListCardMobile variant="promotions"` + `PromotionInspector` + `PromotionBulkSheet`.
- Uses `getPromotionDetailForInspector` server action (NOT raw loader from `lib/admin/marketing.ts`).
- Manages selectedIds Set + inspectorOpen + inspectorDetail state. Long-press on mobile card toggles selection.
- Mobile quick action (`onQuickAction`) calls `togglePromotionActive(id)`.

**Files:**
- Create: `components/admin/marketing/PromotionsListView.tsx`
- Test: `tests/unit/components/admin/marketing/PromotionsListView.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/marketing/PromotionsListView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { PromotionRow } from '@/lib/admin/marketing'

vi.mock('@/app/admin/marketing/actions', () => ({
  getPromotionDetailForInspector: vi.fn(async () => ({
    id: 'p1', name: 'Summer', description: null, code: 'SUMMER',
    type: 'PERCENTAGE', value: 20, autoApply: false, stackable: false,
    minimumPurchase: 0, maxUsesTotal: null, maxUsesPerCustomer: null, usedCount: 0,
    productIds: null, collectionIds: null, customerEmails: null,
    startDate: new Date(), endDate: null,
    isActive: true, maxDiscountPercent: null, excludeFromLoyalty: false,
    totalDiscountGiven: 0, createdAt: new Date(), updatedAt: new Date(),
  })),
  togglePromotionActive: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/components/admin/marketing/MarketingListTable', () => ({
  MarketingListTable: ({ onOpenInspector, onSelect }: {
    onOpenInspector: (id: string) => void
    onSelect: (id: string, checked: boolean) => void
  }) => (
    <div data-testid="table">
      <button data-testid="open-inspector" onClick={() => onOpenInspector('p1')}>Open</button>
      <button data-testid="select-row" onClick={() => onSelect('p1', true)}>Select</button>
    </div>
  ),
}))
vi.mock('@/components/admin/marketing/MarketingListCardMobile', () => ({
  MarketingListCardMobile: () => <div data-testid="card-mobile" />,
}))
vi.mock('@/components/admin/marketing/PromotionInspector', () => ({
  PromotionInspector: ({ open, detail }: { open: boolean; detail: unknown }) =>
    open ? <div data-testid="inspector">{detail ? 'loaded' : 'loading'}</div> : null,
}))
vi.mock('@/components/admin/marketing/PromotionBulkSheet', () => ({
  PromotionBulkSheet: ({ open, ids }: { open: boolean; ids: string[] }) =>
    open ? <div data-testid="bulk-sheet">{ids.length}</div> : null,
}))

const rows: PromotionRow[] = [
  { id: 'p1', name: 'Summer', code: 'SUMMER', type: 'PERCENTAGE', value: 20,
    isActive: true, usedCount: 0, maxUsesTotal: null,
    startDate: new Date(), endDate: null, totalDiscountGiven: 0,
    autoApply: false, stackable: false, createdAt: new Date() },
]

beforeEach(() => { vi.clearAllMocks() })

describe('PromotionsListView', () => {
  it('renders table and mobile card list', async () => {
    const { PromotionsListView } = await import('@/components/admin/marketing/PromotionsListView')
    render(<PromotionsListView rows={rows} />)
    expect(screen.getByTestId('table')).toBeInTheDocument()
  })

  it('opens inspector when row action clicked + loads detail', async () => {
    const { PromotionsListView } = await import('@/components/admin/marketing/PromotionsListView')
    render(<PromotionsListView rows={rows} />)
    fireEvent.click(screen.getByTestId('open-inspector'))
    await waitFor(() => {
      expect(screen.getByTestId('inspector').textContent).toBe('loaded')
    })
  })

  it('shows bulk sheet when selection > 0', async () => {
    const { PromotionsListView } = await import('@/components/admin/marketing/PromotionsListView')
    render(<PromotionsListView rows={rows} />)
    fireEvent.click(screen.getByTestId('select-row'))
    await waitFor(() => { expect(screen.getByTestId('bulk-sheet')).toBeInTheDocument() })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/marketing/PromotionsListView.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/marketing/PromotionsListView.tsx`**

```tsx
'use client'

import { useCallback, useState, useTransition } from 'react'
import type { PromotionRow } from '@/lib/admin/marketing'
import {
  getPromotionDetailForInspector, togglePromotionActive,
  type PromotionDetailFull,
} from '@/app/admin/marketing/actions'
import { toast } from '@/lib/toast'
import { MarketingListTable } from './MarketingListTable'
import { MarketingListCardMobile } from './MarketingListCardMobile'
import { PromotionInspector } from './PromotionInspector'
import { PromotionBulkSheet } from './PromotionBulkSheet'

export interface PromotionsListViewProps {
  rows: PromotionRow[]
  loading?: boolean
  onRefresh?: () => void
}

function withAdded(s: Set<string>, id: string) { const n = new Set(s); n.add(id); return n }
function withRemoved(s: Set<string>, id: string) { const n = new Set(s); n.delete(id); return n }

export function PromotionsListView({ rows, loading = false, onRefresh }: PromotionsListViewProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [inspectorDetail, setInspectorDetail] = useState<PromotionDetailFull | null>(null)
  const [, startTransition] = useTransition()

  const handleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? withAdded(prev, id) : withRemoved(prev, id)))
  }, [])

  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectedIds(checked ? new Set(rows.map((r) => r.id)) : new Set())
  }, [rows])

  const openInspector = useCallback((id: string) => {
    setInspectorOpen(true)
    setInspectorDetail(null)
    startTransition(async () => {
      const d = await getPromotionDetailForInspector(id)
      setInspectorDetail(d)
    })
  }, [])

  const closeInspector = useCallback(() => {
    setInspectorOpen(false)
    setInspectorDetail(null)
  }, [])

  const handleSaved = useCallback(() => {
    setInspectorOpen(false)
    setInspectorDetail(null)
    onRefresh?.()
  }, [onRefresh])

  const handleQuickActivate = useCallback(async (id: string) => {
    const r = await togglePromotionActive(id)
    if (r.ok) toast.success('Toggled')
    else toast.error('Failed to toggle')
  }, [])

  const handleClear = useCallback(() => {
    setSelectedIds(new Set())
    onRefresh?.()
  }, [onRefresh])

  return (
    <>
      <MarketingListTable
        variant="promotions" rows={rows}
        selected={selectedIds}
        onSelect={handleSelect} onSelectAll={handleSelectAll}
        onOpenInspector={openInspector}
        loading={loading}
      />
      <div className="md:hidden space-y-2" data-testid="promotions-mobile">
        {rows.map((r) => (
          <MarketingListCardMobile key={r.id}
            variant="promotions" row={r}
            selected={selectedIds.has(r.id)}
            onLongPress={(id) => handleSelect(id, !selectedIds.has(id))}
            onEdit={openInspector}
            onQuickAction={handleQuickActivate}
          />
        ))}
      </div>
      <PromotionInspector
        open={inspectorOpen}
        detail={inspectorDetail}
        onClose={closeInspector}
        onSaved={handleSaved}
      />
      <PromotionBulkSheet
        open={selectedIds.size > 0}
        ids={Array.from(selectedIds)}
        onClear={handleClear}
      />
    </>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/marketing/PromotionsListView.test.tsx`
Expected: PASS — 3 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/marketing/PromotionsListView.tsx tests/unit/components/admin/marketing/PromotionsListView.test.tsx
git commit -m "feat(admin-v2): add PromotionsListView orchestrator"
git push -u origin wave5p5/task-15-promotions-list-view
gh pr create --title "feat(admin-v2): Phase 5 W5 PromotionsListView" --body "Wires MarketingListTable + MarketingListCardMobile + PromotionInspector + PromotionBulkSheet. Uses getPromotionDetailForInspector server action to keep Prisma out of the client bundle."
```

---

### Task 16: `PopupsListView.tsx` orchestrator

**Wave:** 5 | **Parallel-safe with:** 15, 17, 18, 19 | **Branch:** `wave5p5/task-16-popups-list-view` | **Model:** sonnet

**Schema realities for this task:**
- Wires popup variants of the generic list primitives + `PopupInspector` + `PopupBulkSheet`.
- Mobile quick action calls `togglePopupActive(id)`.
- Uses `getPopupDetailForInspector` server action.

**Files:**
- Create: `components/admin/marketing/PopupsListView.tsx`
- Test: `tests/unit/components/admin/marketing/PopupsListView.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/marketing/PopupsListView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { PopupRow } from '@/lib/admin/marketing'

vi.mock('@/app/admin/marketing/actions', () => ({
  getPopupDetailForInspector: vi.fn(async () => ({
    id: 'pp1', name: 'Welcome', template: 'MODAL', position: 'CENTER',
    content: '{}', triggerType: 'DELAY', triggerValue: 3,
    showOnPages: 'all', showToNewVisitors: true, showToReturning: false,
    frequency: 'ONCE_PER_SESSION', startDate: null, endDate: null,
    isActive: true, priority: 0, promotionId: null,
    createdAt: new Date(), updatedAt: new Date(),
    variants: [],
    analytics7d: { impressions: 0, clicks: 0, dismissals: 0, conversions: 0 },
  })),
  togglePopupActive: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/components/admin/marketing/MarketingListTable', () => ({
  MarketingListTable: ({ onOpenInspector, onSelect }: {
    onOpenInspector: (id: string) => void
    onSelect: (id: string, checked: boolean) => void
  }) => (
    <div data-testid="table">
      <button data-testid="open-inspector" onClick={() => onOpenInspector('pp1')}>Open</button>
      <button data-testid="select-row" onClick={() => onSelect('pp1', true)}>Select</button>
    </div>
  ),
}))
vi.mock('@/components/admin/marketing/MarketingListCardMobile', () => ({
  MarketingListCardMobile: () => <div data-testid="card-mobile" />,
}))
vi.mock('@/components/admin/marketing/PopupInspector', () => ({
  PopupInspector: ({ open, detail }: { open: boolean; detail: unknown }) =>
    open ? <div data-testid="inspector">{detail ? 'loaded' : 'loading'}</div> : null,
}))
vi.mock('@/components/admin/marketing/PopupBulkSheet', () => ({
  PopupBulkSheet: ({ open, ids }: { open: boolean; ids: string[] }) =>
    open ? <div data-testid="bulk-sheet">{ids.length}</div> : null,
}))

const rows: PopupRow[] = [
  { id: 'pp1', name: 'Welcome', template: 'MODAL', position: 'CENTER',
    triggerType: 'DELAY', isActive: true, priority: 0,
    impressions7d: 0, conversions7d: 0,
    startDate: null, endDate: null, createdAt: new Date() },
]

beforeEach(() => { vi.clearAllMocks() })

describe('PopupsListView', () => {
  it('opens inspector and loads detail', async () => {
    const { PopupsListView } = await import('@/components/admin/marketing/PopupsListView')
    render(<PopupsListView rows={rows} />)
    fireEvent.click(screen.getByTestId('open-inspector'))
    await waitFor(() => {
      expect(screen.getByTestId('inspector').textContent).toBe('loaded')
    })
  })

  it('shows bulk sheet when row selected', async () => {
    const { PopupsListView } = await import('@/components/admin/marketing/PopupsListView')
    render(<PopupsListView rows={rows} />)
    fireEvent.click(screen.getByTestId('select-row'))
    await waitFor(() => { expect(screen.getByTestId('bulk-sheet')).toBeInTheDocument() })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/marketing/PopupsListView.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/marketing/PopupsListView.tsx`**

```tsx
'use client'

import { useCallback, useState, useTransition } from 'react'
import type { PopupRow } from '@/lib/admin/marketing'
import {
  getPopupDetailForInspector, togglePopupActive,
  type PopupDetailFull,
} from '@/app/admin/marketing/actions'
import { toast } from '@/lib/toast'
import { MarketingListTable } from './MarketingListTable'
import { MarketingListCardMobile } from './MarketingListCardMobile'
import { PopupInspector } from './PopupInspector'
import { PopupBulkSheet } from './PopupBulkSheet'

export interface PopupsListViewProps {
  rows: PopupRow[]
  loading?: boolean
  onRefresh?: () => void
}

function withAdded(s: Set<string>, id: string) { const n = new Set(s); n.add(id); return n }
function withRemoved(s: Set<string>, id: string) { const n = new Set(s); n.delete(id); return n }

export function PopupsListView({ rows, loading = false, onRefresh }: PopupsListViewProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [inspectorDetail, setInspectorDetail] = useState<PopupDetailFull | null>(null)
  const [, startTransition] = useTransition()

  const handleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? withAdded(prev, id) : withRemoved(prev, id)))
  }, [])
  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectedIds(checked ? new Set(rows.map((r) => r.id)) : new Set())
  }, [rows])
  const openInspector = useCallback((id: string) => {
    setInspectorOpen(true); setInspectorDetail(null)
    startTransition(async () => {
      const d = await getPopupDetailForInspector(id)
      setInspectorDetail(d)
    })
  }, [])
  const closeInspector = useCallback(() => {
    setInspectorOpen(false); setInspectorDetail(null)
  }, [])
  const handleSaved = useCallback(() => {
    setInspectorOpen(false); setInspectorDetail(null); onRefresh?.()
  }, [onRefresh])
  const handleQuickActivate = useCallback(async (id: string) => {
    const r = await togglePopupActive(id)
    if (r.ok) toast.success('Toggled')
    else toast.error('Failed to toggle')
  }, [])
  const handleClear = useCallback(() => {
    setSelectedIds(new Set()); onRefresh?.()
  }, [onRefresh])

  return (
    <>
      <MarketingListTable
        variant="popups" rows={rows}
        selected={selectedIds}
        onSelect={handleSelect} onSelectAll={handleSelectAll}
        onOpenInspector={openInspector}
        loading={loading}
      />
      <div className="md:hidden space-y-2" data-testid="popups-mobile">
        {rows.map((r) => (
          <MarketingListCardMobile key={r.id}
            variant="popups" row={r}
            selected={selectedIds.has(r.id)}
            onLongPress={(id) => handleSelect(id, !selectedIds.has(id))}
            onEdit={openInspector}
            onQuickAction={handleQuickActivate}
          />
        ))}
      </div>
      <PopupInspector
        open={inspectorOpen}
        detail={inspectorDetail}
        onClose={closeInspector}
        onSaved={handleSaved}
      />
      <PopupBulkSheet
        open={selectedIds.size > 0}
        ids={Array.from(selectedIds)}
        onClear={handleClear}
      />
    </>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/marketing/PopupsListView.test.tsx`
Expected: PASS — 2 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/marketing/PopupsListView.tsx tests/unit/components/admin/marketing/PopupsListView.test.tsx
git commit -m "feat(admin-v2): add PopupsListView orchestrator"
git push -u origin wave5p5/task-16-popups-list-view
gh pr create --title "feat(admin-v2): Phase 5 W5 PopupsListView" --body "Wires generic list primitives + PopupInspector + PopupBulkSheet."
```

---

### Task 17: `SubscribersListView.tsx` orchestrator

**Wave:** 5 | **Parallel-safe with:** 15, 16, 18, 19 | **Branch:** `wave5p5/task-17-subscribers-list-view` | **Model:** sonnet

**Schema realities for this task:**
- Wires subscriber variants + `SubscriberInspector` + `SubscriberBulkSheet`.
- Accepts `isSuperAdmin: boolean` prop and forwards to both Inspector + BulkSheet.
- Mobile quick action calls `unsubscribeSubscriber(id)`.
- Uses `getSubscriberDetailForInspector` server action.

**Files:**
- Create: `components/admin/marketing/SubscribersListView.tsx`
- Test: `tests/unit/components/admin/marketing/SubscribersListView.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/marketing/SubscribersListView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { SubscriberRow } from '@/lib/admin/marketing'

vi.mock('@/app/admin/marketing/actions', () => ({
  getSubscriberDetailForInspector: vi.fn(async () => ({
    id: 's1', email: 'a@e.com', source: 'popup', sourceDetails: null,
    isActive: true, isVerified: true, verifiedAt: new Date(),
    unsubscribedAt: null, unsubscribeReason: null,
    utmSource: null, utmMedium: null, utmCampaign: null,
    createdAt: new Date(), updatedAt: new Date(),
  })),
  unsubscribeSubscriber: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/components/admin/marketing/MarketingListTable', () => ({
  MarketingListTable: ({ onOpenInspector }: { onOpenInspector: (id: string) => void }) =>
    <div data-testid="table"><button data-testid="open-inspector" onClick={() => onOpenInspector('s1')}>Open</button></div>,
}))
vi.mock('@/components/admin/marketing/MarketingListCardMobile', () => ({
  MarketingListCardMobile: () => <div data-testid="card-mobile" />,
}))
vi.mock('@/components/admin/marketing/SubscriberInspector', () => ({
  SubscriberInspector: ({ open, isSuperAdmin }: { open: boolean; isSuperAdmin: boolean }) =>
    open ? <div data-testid="inspector">{isSuperAdmin ? 'super' : 'normal'}</div> : null,
}))
vi.mock('@/components/admin/marketing/SubscriberBulkSheet', () => ({
  SubscriberBulkSheet: ({ open, isSuperAdmin }: { open: boolean; isSuperAdmin: boolean }) =>
    open ? <div data-testid="bulk-sheet">{isSuperAdmin ? 'super' : 'normal'}</div> : null,
}))

const rows: SubscriberRow[] = [
  { id: 's1', email: 'a@e.com', source: 'popup', sourceDetails: null,
    isActive: true, isVerified: true, createdAt: new Date(),
    unsubscribedAt: null, utmSource: null },
]

beforeEach(() => { vi.clearAllMocks() })

describe('SubscribersListView', () => {
  it('forwards isSuperAdmin prop to inspector', async () => {
    const { SubscribersListView } = await import('@/components/admin/marketing/SubscribersListView')
    render(<SubscribersListView rows={rows} isSuperAdmin />)
    fireEvent.click(screen.getByTestId('open-inspector'))
    await waitFor(() => {
      expect(screen.getByTestId('inspector').textContent).toBe('super')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/marketing/SubscribersListView.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/marketing/SubscribersListView.tsx`**

```tsx
'use client'

import { useCallback, useState, useTransition } from 'react'
import type { SubscriberRow } from '@/lib/admin/marketing'
import {
  getSubscriberDetailForInspector, unsubscribeSubscriber,
  type SubscriberDetailFull,
} from '@/app/admin/marketing/actions'
import { toast } from '@/lib/toast'
import { MarketingListTable } from './MarketingListTable'
import { MarketingListCardMobile } from './MarketingListCardMobile'
import { SubscriberInspector } from './SubscriberInspector'
import { SubscriberBulkSheet } from './SubscriberBulkSheet'

export interface SubscribersListViewProps {
  rows: SubscriberRow[]
  isSuperAdmin: boolean
  loading?: boolean
  onRefresh?: () => void
}

function withAdded(s: Set<string>, id: string) { const n = new Set(s); n.add(id); return n }
function withRemoved(s: Set<string>, id: string) { const n = new Set(s); n.delete(id); return n }

export function SubscribersListView({
  rows, isSuperAdmin, loading = false, onRefresh,
}: SubscribersListViewProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [inspectorDetail, setInspectorDetail] = useState<SubscriberDetailFull | null>(null)
  const [, startTransition] = useTransition()

  const handleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? withAdded(prev, id) : withRemoved(prev, id)))
  }, [])
  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectedIds(checked ? new Set(rows.map((r) => r.id)) : new Set())
  }, [rows])
  const openInspector = useCallback((id: string) => {
    setInspectorOpen(true); setInspectorDetail(null)
    startTransition(async () => {
      const d = await getSubscriberDetailForInspector(id)
      setInspectorDetail(d)
    })
  }, [])
  const closeInspector = useCallback(() => {
    setInspectorOpen(false); setInspectorDetail(null)
  }, [])
  const handleSaved = useCallback(() => {
    setInspectorOpen(false); setInspectorDetail(null); onRefresh?.()
  }, [onRefresh])
  const handleQuickUnsubscribe = useCallback(async (id: string) => {
    const r = await unsubscribeSubscriber(id)
    if (r.ok) toast.success('Unsubscribed')
    else toast.error('Failed')
  }, [])
  const handleClear = useCallback(() => {
    setSelectedIds(new Set()); onRefresh?.()
  }, [onRefresh])

  return (
    <>
      <MarketingListTable
        variant="subscribers" rows={rows}
        selected={selectedIds}
        onSelect={handleSelect} onSelectAll={handleSelectAll}
        onOpenInspector={openInspector}
        loading={loading}
      />
      <div className="md:hidden space-y-2" data-testid="subscribers-mobile">
        {rows.map((r) => (
          <MarketingListCardMobile key={r.id}
            variant="subscribers" row={r}
            selected={selectedIds.has(r.id)}
            onLongPress={(id) => handleSelect(id, !selectedIds.has(id))}
            onEdit={openInspector}
            onQuickAction={handleQuickUnsubscribe}
          />
        ))}
      </div>
      <SubscriberInspector
        open={inspectorOpen}
        detail={inspectorDetail}
        isSuperAdmin={isSuperAdmin}
        onClose={closeInspector}
        onSaved={handleSaved}
      />
      <SubscriberBulkSheet
        open={selectedIds.size > 0}
        ids={Array.from(selectedIds)}
        isSuperAdmin={isSuperAdmin}
        onClear={handleClear}
      />
    </>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/marketing/SubscribersListView.test.tsx`
Expected: PASS — 1 test passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/marketing/SubscribersListView.tsx tests/unit/components/admin/marketing/SubscribersListView.test.tsx
git commit -m "feat(admin-v2): add SubscribersListView orchestrator"
git push -u origin wave5p5/task-17-subscribers-list-view
gh pr create --title "feat(admin-v2): Phase 5 W5 SubscribersListView" --body "Forwards isSuperAdmin from V2 root through to Inspector + BulkSheet for the PII Delete gate."
```

---

### Task 18: `CampaignsListView.tsx` orchestrator

**Wave:** 5 | **Parallel-safe with:** 15, 16, 17, 19 | **Branch:** `wave5p5/task-18-campaigns-list-view` | **Model:** sonnet

**Schema realities for this task:**
- Wires campaign variants + `CampaignInspector` + `CampaignBulkSheet`.
- `CampaignBulkSheet` requires `rows: { id; status }[]` (NOT just ids) so the warning toast can fire.
- No mobile swipe action — pass a no-op `onQuickAction` (the mobile card will not render the swipe action because the variant returns null).
- Uses `getCampaignDetailForInspector` server action.

**Files:**
- Create: `components/admin/marketing/CampaignsListView.tsx`
- Test: `tests/unit/components/admin/marketing/CampaignsListView.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/marketing/CampaignsListView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { CampaignRow } from '@/lib/admin/marketing'

vi.mock('@/app/admin/marketing/actions', () => ({
  getCampaignDetailForInspector: vi.fn(async () => ({
    id: 'c1', name: null, subject: 'Hello', preheader: 'P',
    heroImageUrl: null, ctaLabel: 'Shop', ctaUrl: '/', bodyMarkdown: 'B',
    status: 'DRAFT', audienceFilter: {}, audienceCount: 0,
    sentCount: 0, failedCount: 0, createdByAdminId: 'a',
    sentAt: null, createdAt: new Date(), updatedAt: new Date(),
    recentTestDeliveries: [],
  })),
}))
vi.mock('@/components/admin/marketing/MarketingListTable', () => ({
  MarketingListTable: ({ onOpenInspector, onSelect }: {
    onOpenInspector: (id: string) => void
    onSelect: (id: string, c: boolean) => void
  }) => (
    <div data-testid="table">
      <button data-testid="open-inspector" onClick={() => onOpenInspector('c1')}>Open</button>
      <button data-testid="select-row" onClick={() => onSelect('c1', true)}>Select</button>
    </div>
  ),
}))
vi.mock('@/components/admin/marketing/MarketingListCardMobile', () => ({
  MarketingListCardMobile: () => <div data-testid="card-mobile" />,
}))
vi.mock('@/components/admin/marketing/CampaignInspector', () => ({
  CampaignInspector: ({ open }: { open: boolean }) =>
    open ? <div data-testid="inspector" /> : null,
}))
vi.mock('@/components/admin/marketing/CampaignBulkSheet', () => ({
  CampaignBulkSheet: ({ open, rows }: { open: boolean; rows: Array<{ id: string }> }) =>
    open ? <div data-testid="bulk-sheet">{rows.length}</div> : null,
}))

const rows: CampaignRow[] = [
  { id: 'c1', name: null, subject: 'Hello', status: 'DRAFT',
    audienceCount: 0, sentCount: 0, failedCount: 0,
    sentAt: null, createdAt: new Date() },
]

beforeEach(() => { vi.clearAllMocks() })

describe('CampaignsListView', () => {
  it('opens inspector', async () => {
    const { CampaignsListView } = await import('@/components/admin/marketing/CampaignsListView')
    render(<CampaignsListView rows={rows} />)
    fireEvent.click(screen.getByTestId('open-inspector'))
    await waitFor(() => { expect(screen.getByTestId('inspector')).toBeInTheDocument() })
  })

  it('passes full rows (id + status) to CampaignBulkSheet', async () => {
    const { CampaignsListView } = await import('@/components/admin/marketing/CampaignsListView')
    render(<CampaignsListView rows={rows} />)
    fireEvent.click(screen.getByTestId('select-row'))
    await waitFor(() => { expect(screen.getByTestId('bulk-sheet').textContent).toBe('1') })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/marketing/CampaignsListView.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/marketing/CampaignsListView.tsx`**

```tsx
'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import type { CampaignRow } from '@/lib/admin/marketing'
import {
  getCampaignDetailForInspector,
  type CampaignDetailFull,
} from '@/app/admin/marketing/actions'
import { MarketingListTable } from './MarketingListTable'
import { MarketingListCardMobile } from './MarketingListCardMobile'
import { CampaignInspector } from './CampaignInspector'
import { CampaignBulkSheet } from './CampaignBulkSheet'

export interface CampaignsListViewProps {
  rows: CampaignRow[]
  loading?: boolean
  onRefresh?: () => void
}

function withAdded(s: Set<string>, id: string) { const n = new Set(s); n.add(id); return n }
function withRemoved(s: Set<string>, id: string) { const n = new Set(s); n.delete(id); return n }

export function CampaignsListView({ rows, loading = false, onRefresh }: CampaignsListViewProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [inspectorDetail, setInspectorDetail] = useState<CampaignDetailFull | null>(null)
  const [, startTransition] = useTransition()

  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.has(r.id)).map((r) => ({ id: r.id, status: r.status })),
    [rows, selectedIds],
  )

  const handleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? withAdded(prev, id) : withRemoved(prev, id)))
  }, [])
  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectedIds(checked ? new Set(rows.map((r) => r.id)) : new Set())
  }, [rows])
  const openInspector = useCallback((id: string) => {
    setInspectorOpen(true); setInspectorDetail(null)
    startTransition(async () => {
      const d = await getCampaignDetailForInspector(id)
      setInspectorDetail(d)
    })
  }, [])
  const closeInspector = useCallback(() => {
    setInspectorOpen(false); setInspectorDetail(null)
  }, [])
  const handleSaved = useCallback(() => {
    setInspectorOpen(false); setInspectorDetail(null); onRefresh?.()
  }, [onRefresh])
  const handleClear = useCallback(() => {
    setSelectedIds(new Set()); onRefresh?.()
  }, [onRefresh])

  return (
    <>
      <MarketingListTable
        variant="campaigns" rows={rows}
        selected={selectedIds}
        onSelect={handleSelect} onSelectAll={handleSelectAll}
        onOpenInspector={openInspector}
        loading={loading}
      />
      <div className="md:hidden space-y-2" data-testid="campaigns-mobile">
        {rows.map((r) => (
          <MarketingListCardMobile key={r.id}
            variant="campaigns" row={r}
            selected={selectedIds.has(r.id)}
            onLongPress={(id) => handleSelect(id, !selectedIds.has(id))}
            onEdit={openInspector}
            onQuickAction={() => { /* no swipe action for campaigns */ }}
          />
        ))}
      </div>
      <CampaignInspector
        open={inspectorOpen}
        detail={inspectorDetail}
        onClose={closeInspector}
        onSaved={handleSaved}
      />
      <CampaignBulkSheet
        open={selectedIds.size > 0}
        rows={selectedRows}
        onClear={handleClear}
      />
    </>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/marketing/CampaignsListView.test.tsx`
Expected: PASS — 2 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/marketing/CampaignsListView.tsx tests/unit/components/admin/marketing/CampaignsListView.test.tsx
git commit -m "feat(admin-v2): add CampaignsListView orchestrator"
git push -u origin wave5p5/task-18-campaigns-list-view
gh pr create --title "feat(admin-v2): Phase 5 W5 CampaignsListView" --body "Passes selectedRows (id + status) to CampaignBulkSheet so it can warn on non-DRAFT selections."
```

---

### Task 19: `AbandonedCartsListView.tsx` orchestrator

**Wave:** 5 | **Parallel-safe with:** 15, 16, 17, 18 | **Branch:** `wave5p5/task-19-carts-list-view` | **Model:** sonnet

**Schema realities for this task:**
- Wires cart variants + `AbandonedCartInspector` + `AbandonedCartBulkSheet`.
- Mobile quick action calls `sendCartRecoveryEmail(id)`.
- Uses `getAbandonedCartDetailForInspector` server action.

**Files:**
- Create: `components/admin/marketing/AbandonedCartsListView.tsx`
- Test: `tests/unit/components/admin/marketing/AbandonedCartsListView.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/marketing/AbandonedCartsListView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { AbandonedCartRow } from '@/lib/admin/marketing'

vi.mock('@/app/admin/marketing/actions', () => ({
  getAbandonedCartDetailForInspector: vi.fn(async () => ({
    id: 'ac1', customerId: null, customerEmail: 'a@e.com', customerName: null,
    items: [], totalValue: 0, itemCount: 0,
    recoveryEmailSent: false, recoveryEmailSentAt: null,
    recovered: false, recoveredAt: null, recoveryOrderId: null,
    abandonedAt: new Date(), expiresAt: new Date(),
    discountCode: null,
  })),
  sendCartRecoveryEmail: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/components/admin/marketing/MarketingListTable', () => ({
  MarketingListTable: ({ onOpenInspector, onSelect }: {
    onOpenInspector: (id: string) => void
    onSelect: (id: string, c: boolean) => void
  }) => (
    <div data-testid="table">
      <button data-testid="open-inspector" onClick={() => onOpenInspector('ac1')}>Open</button>
      <button data-testid="select-row" onClick={() => onSelect('ac1', true)}>Select</button>
    </div>
  ),
}))
vi.mock('@/components/admin/marketing/MarketingListCardMobile', () => ({
  MarketingListCardMobile: () => <div data-testid="card-mobile" />,
}))
vi.mock('@/components/admin/marketing/AbandonedCartInspector', () => ({
  AbandonedCartInspector: ({ open }: { open: boolean }) =>
    open ? <div data-testid="inspector" /> : null,
}))
vi.mock('@/components/admin/marketing/AbandonedCartBulkSheet', () => ({
  AbandonedCartBulkSheet: ({ open, ids }: { open: boolean; ids: string[] }) =>
    open ? <div data-testid="bulk-sheet">{ids.length}</div> : null,
}))

const rows: AbandonedCartRow[] = [
  { id: 'ac1', customerEmail: 'a@e.com', customerName: null,
    totalValue: 0, itemCount: 0, recovered: false,
    recoveryEmailSent: false, abandonedAt: new Date(),
    expiresAt: new Date(), discountCode: null },
]

beforeEach(() => { vi.clearAllMocks() })

describe('AbandonedCartsListView', () => {
  it('opens inspector', async () => {
    const { AbandonedCartsListView } = await import('@/components/admin/marketing/AbandonedCartsListView')
    render(<AbandonedCartsListView rows={rows} />)
    fireEvent.click(screen.getByTestId('open-inspector'))
    await waitFor(() => { expect(screen.getByTestId('inspector')).toBeInTheDocument() })
  })

  it('shows bulk sheet on selection', async () => {
    const { AbandonedCartsListView } = await import('@/components/admin/marketing/AbandonedCartsListView')
    render(<AbandonedCartsListView rows={rows} />)
    fireEvent.click(screen.getByTestId('select-row'))
    await waitFor(() => { expect(screen.getByTestId('bulk-sheet').textContent).toBe('1') })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/marketing/AbandonedCartsListView.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/marketing/AbandonedCartsListView.tsx`**

```tsx
'use client'

import { useCallback, useState, useTransition } from 'react'
import type { AbandonedCartRow } from '@/lib/admin/marketing'
import {
  getAbandonedCartDetailForInspector, sendCartRecoveryEmail,
  type AbandonedCartDetailFull,
} from '@/app/admin/marketing/actions'
import { toast } from '@/lib/toast'
import { MarketingListTable } from './MarketingListTable'
import { MarketingListCardMobile } from './MarketingListCardMobile'
import { AbandonedCartInspector } from './AbandonedCartInspector'
import { AbandonedCartBulkSheet } from './AbandonedCartBulkSheet'

export interface AbandonedCartsListViewProps {
  rows: AbandonedCartRow[]
  loading?: boolean
  onRefresh?: () => void
}

function withAdded(s: Set<string>, id: string) { const n = new Set(s); n.add(id); return n }
function withRemoved(s: Set<string>, id: string) { const n = new Set(s); n.delete(id); return n }

export function AbandonedCartsListView({
  rows, loading = false, onRefresh,
}: AbandonedCartsListViewProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [inspectorDetail, setInspectorDetail] = useState<AbandonedCartDetailFull | null>(null)
  const [, startTransition] = useTransition()

  const handleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? withAdded(prev, id) : withRemoved(prev, id)))
  }, [])
  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectedIds(checked ? new Set(rows.map((r) => r.id)) : new Set())
  }, [rows])
  const openInspector = useCallback((id: string) => {
    setInspectorOpen(true); setInspectorDetail(null)
    startTransition(async () => {
      const d = await getAbandonedCartDetailForInspector(id)
      setInspectorDetail(d)
    })
  }, [])
  const closeInspector = useCallback(() => {
    setInspectorOpen(false); setInspectorDetail(null)
  }, [])
  const handleSaved = useCallback(() => {
    setInspectorOpen(false); setInspectorDetail(null); onRefresh?.()
  }, [onRefresh])
  const handleQuickSendRecovery = useCallback(async (id: string) => {
    const r = await sendCartRecoveryEmail(id)
    if (r.ok) toast.success('Recovery queued')
    else toast.error('Failed')
  }, [])
  const handleClear = useCallback(() => {
    setSelectedIds(new Set()); onRefresh?.()
  }, [onRefresh])

  return (
    <>
      <MarketingListTable
        variant="carts" rows={rows}
        selected={selectedIds}
        onSelect={handleSelect} onSelectAll={handleSelectAll}
        onOpenInspector={openInspector}
        loading={loading}
      />
      <div className="md:hidden space-y-2" data-testid="carts-mobile">
        {rows.map((r) => (
          <MarketingListCardMobile key={r.id}
            variant="carts" row={r}
            selected={selectedIds.has(r.id)}
            onLongPress={(id) => handleSelect(id, !selectedIds.has(id))}
            onEdit={openInspector}
            onQuickAction={handleQuickSendRecovery}
          />
        ))}
      </div>
      <AbandonedCartInspector
        open={inspectorOpen}
        detail={inspectorDetail}
        onClose={closeInspector}
        onSaved={handleSaved}
      />
      <AbandonedCartBulkSheet
        open={selectedIds.size > 0}
        ids={Array.from(selectedIds)}
        onClear={handleClear}
      />
    </>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/marketing/AbandonedCartsListView.test.tsx`
Expected: PASS — 2 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/marketing/AbandonedCartsListView.tsx tests/unit/components/admin/marketing/AbandonedCartsListView.test.tsx
git commit -m "feat(admin-v2): add AbandonedCartsListView orchestrator"
git push -u origin wave5p5/task-19-carts-list-view
gh pr create --title "feat(admin-v2): Phase 5 W5 AbandonedCartsListView" --body "Wires generic primitives + AbandonedCartInspector + AbandonedCartBulkSheet."
```

---

## Wave 6 — V2 root + page dispatcher (sequential, opus model)

### Task 20: V1 stub + `AdminMarketingV2` + `MarketingTabPills` + page dispatcher

**Wave:** 6 | **Parallel-safe with:** none | **Branch:** `wave5p5/task-20-admin-marketing-v2` | **Model:** opus

**Schema realities for this task:**
- V1 has no `/admin/marketing` page today (only `/admin/promotions`, `/admin/popups`, `/admin/newsletter`, `/admin/abandoned-carts`). V1 stub renders a short message + 4 cards linking out.
- 5 tabs: `promotions | popups | subscribers | campaigns | carts`.
- KPI strip = 4 cards: Active Promotions (warning when 0) · Popup conversions 7d · Subscribers (with +N this week delta) · Carts to recover (warning when > 5). Each card is `<Link href="?tab=...">`.
- FilterBar is a placeholder for Phase 5.5 (`<div>Filter bar — Phase 5.5</div>`).
- Page exports `revalidate = 60`.
- Dispatcher uses `process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED === 'true'`.
- For `SubscribersListView` the root must compute `isSuperAdmin` from the current admin session and pass it down. Use `requireAdmin()` no-arg to get the userId, then look up the admin role via `lib/auth/admin.ts`'s `getAdminRole(userId)` helper (or read `prisma.customer.findUnique({ where: { id }, select: { adminRole: true } })` inline if no helper exists).

**Files:**
- Create: `components/admin/_v1/AdminMarketingV1.tsx` (V1 stub linking to existing pages)
- Create: `components/admin/dashboard/AdminMarketingV2.tsx`
- Create: `components/admin/dashboard/MarketingTabPills.tsx`
- Create: `app/admin/marketing/page.tsx` (dispatcher)
- Test: `tests/unit/components/admin/dashboard/AdminMarketingV2.test.tsx`
- Test: `tests/unit/app/admin/marketing/page.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing V2 root test**

```tsx
// tests/unit/components/admin/dashboard/AdminMarketingV2.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/admin/marketing', () => ({
  loadMarketingKpis: vi.fn(async () => ({
    activePromotions: 3, popupConversions7d: 42,
    subscriberCount: 1000, subscriberDeltaPct: 12,
    cartsToRecover: 7,
  })),
  loadPromotionsTab: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 25 })),
  loadPopupsTab: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 25 })),
  loadSubscribersTab: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 25 })),
  loadCampaignsTab: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 25 })),
  loadAbandonedCartsTab: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 25 })),
  isMarketingTab: (s: unknown) => typeof s === 'string' &&
    ['promotions', 'popups', 'subscribers', 'campaigns', 'carts'].includes(s),
}))

vi.mock('@/lib/auth/admin', () => ({
  requireAdmin: vi.fn(async () => 'admin-1'),
  getAdminRole: vi.fn(async () => 'SUPER_ADMIN'),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: { findUnique: vi.fn(async () => ({ adminRole: 'SUPER_ADMIN' })) },
  },
}))

vi.mock('@/components/admin/AdminLayout', () => ({
  AdminLayout: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div><h1>{title}</h1>{children}</div>
  ),
}))

vi.mock('@/components/admin/marketing/PromotionsListView', () => ({
  PromotionsListView: () => <div data-testid="promotions-list" />,
}))
vi.mock('@/components/admin/marketing/PopupsListView', () => ({
  PopupsListView: () => <div data-testid="popups-list" />,
}))
vi.mock('@/components/admin/marketing/SubscribersListView', () => ({
  SubscribersListView: () => <div data-testid="subscribers-list" />,
}))
vi.mock('@/components/admin/marketing/CampaignsListView', () => ({
  CampaignsListView: () => <div data-testid="campaigns-list" />,
}))
vi.mock('@/components/admin/marketing/AbandonedCartsListView', () => ({
  AbandonedCartsListView: () => <div data-testid="carts-list" />,
}))
vi.mock('@/components/admin/dashboard/MarketingTabPills', () => ({
  MarketingTabPills: () => <div data-testid="tab-pills" />,
}))

describe('AdminMarketingV2', () => {
  it('renders Marketing title', async () => {
    const { AdminMarketingV2 } = await import('@/components/admin/dashboard/AdminMarketingV2')
    render(await AdminMarketingV2({ searchParams: {} }))
    expect(screen.getByText('Marketing')).toBeInTheDocument()
  })

  it('renders PromotionsListView for default tab', async () => {
    const { AdminMarketingV2 } = await import('@/components/admin/dashboard/AdminMarketingV2')
    render(await AdminMarketingV2({ searchParams: {} }))
    expect(screen.getByTestId('promotions-list')).toBeInTheDocument()
  })

  it('renders SubscribersListView when tab=subscribers', async () => {
    const { AdminMarketingV2 } = await import('@/components/admin/dashboard/AdminMarketingV2')
    render(await AdminMarketingV2({ searchParams: { tab: 'subscribers' } }))
    expect(screen.getByTestId('subscribers-list')).toBeInTheDocument()
  })

  it('renders CampaignsListView when tab=campaigns', async () => {
    const { AdminMarketingV2 } = await import('@/components/admin/dashboard/AdminMarketingV2')
    render(await AdminMarketingV2({ searchParams: { tab: 'campaigns' } }))
    expect(screen.getByTestId('campaigns-list')).toBeInTheDocument()
  })

  it('renders AbandonedCartsListView when tab=carts', async () => {
    const { AdminMarketingV2 } = await import('@/components/admin/dashboard/AdminMarketingV2')
    render(await AdminMarketingV2({ searchParams: { tab: 'carts' } }))
    expect(screen.getByTestId('carts-list')).toBeInTheDocument()
  })

  it('renders PopupsListView when tab=popups', async () => {
    const { AdminMarketingV2 } = await import('@/components/admin/dashboard/AdminMarketingV2')
    render(await AdminMarketingV2({ searchParams: { tab: 'popups' } }))
    expect(screen.getByTestId('popups-list')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/dashboard/AdminMarketingV2.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/_v1/AdminMarketingV1.tsx` (V1 stub)**

```tsx
import Link from 'next/link'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { Card } from '@/components/ui/card'

const SECTIONS = [
  { href: '/admin/promotions',       title: 'Promotions',      desc: 'Discount codes, BOGO, free shipping' },
  { href: '/admin/popups',           title: 'Popups',          desc: 'Modals, banners, email capture' },
  { href: '/admin/newsletter',       title: 'Newsletter',      desc: 'Subscribers, campaigns, delivery' },
  { href: '/admin/abandoned-carts',  title: 'Abandoned Carts', desc: 'Recovery emails and discount codes' },
]

export function AdminMarketingV1() {
  return (
    <AdminLayout title="Marketing" subtitle="Promotions, popups, subscribers, campaigns, carts">
      <div className="space-y-4">
        <p className="text-sm text-white/50">
          The unified marketing dashboard is in beta. Enable <code className="font-mono">NEXT_PUBLIC_ADMIN_V2_ENABLED=true</code> to try it.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

- [ ] **Step 4: Write `components/admin/dashboard/MarketingTabPills.tsx`**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { TabPills, type TabPillsTab } from '@/components/ui/TabPills'
import type { MarketingTab } from '@/lib/admin/marketing'

interface MarketingTabPillsProps {
  tabs: ReadonlyArray<{ id: MarketingTab; label: string }>
  active: MarketingTab
}

export function MarketingTabPills({ tabs, active }: MarketingTabPillsProps) {
  const router = useRouter()
  const pillTabs: TabPillsTab[] = tabs.map((t) => ({ id: t.id, label: t.label }))
  return (
    <TabPills
      tabs={pillTabs}
      active={active}
      onChange={(id) => router.push(`?tab=${id}`)}
      showShortcutHints
    />
  )
}
```

- [ ] **Step 5: Write `components/admin/dashboard/AdminMarketingV2.tsx`**

```tsx
import { Suspense } from 'react'
import Link from 'next/link'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { StatCard } from '@/components/ui/StatCard'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth/admin'
import {
  loadMarketingKpis,
  loadPromotionsTab,
  loadPopupsTab,
  loadSubscribersTab,
  loadCampaignsTab,
  loadAbandonedCartsTab,
  isMarketingTab,
  type MarketingTab,
} from '@/lib/admin/marketing'
import { PromotionsListView } from '@/components/admin/marketing/PromotionsListView'
import { PopupsListView } from '@/components/admin/marketing/PopupsListView'
import { SubscribersListView } from '@/components/admin/marketing/SubscribersListView'
import { CampaignsListView } from '@/components/admin/marketing/CampaignsListView'
import { AbandonedCartsListView } from '@/components/admin/marketing/AbandonedCartsListView'
import { MarketingTabPills } from './MarketingTabPills'

interface Props {
  searchParams: { tab?: string }
}

const TAB_CONFIG: ReadonlyArray<{ id: MarketingTab; label: string }> = [
  { id: 'promotions',  label: 'Promotions' },
  { id: 'popups',      label: 'Popups' },
  { id: 'subscribers', label: 'Subscribers' },
  { id: 'campaigns',   label: 'Campaigns' },
  { id: 'carts',       label: 'Abandoned Carts' },
]

function parseTab(raw: string | undefined): MarketingTab {
  return isMarketingTab(raw) ? raw : 'promotions'
}

async function resolveIsSuperAdmin(): Promise<boolean> {
  try {
    const userId = await requireAdmin()
    if (typeof userId !== 'string') return false
    const c = await prisma.customer.findUnique({
      where: { id: userId }, select: { adminRole: true },
    })
    return c?.adminRole === 'SUPER_ADMIN'
  } catch {
    return false
  }
}

// ─── Slot wrappers ────────────────────────────────────────────────────────────

async function KpiStripSlot() {
  const k = await loadMarketingKpis()
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
      <Link href="?tab=promotions" className="block">
        <StatCard
          label="Active Promotions"
          value={k.activePromotions}
          variant={k.activePromotions === 0 ? 'warning' : 'default'}
        />
      </Link>
      <Link href="?tab=popups" className="block">
        <StatCard label="Popup Conv (7d)" value={k.popupConversions7d} />
      </Link>
      <Link href="?tab=subscribers" className="block">
        <StatCard
          label="Subscribers"
          value={k.subscriberCount}
          delta={k.subscriberDeltaPct ? `${k.subscriberDeltaPct > 0 ? '+' : ''}${k.subscriberDeltaPct.toFixed(0)}%` : undefined}
        />
      </Link>
      <Link href="?tab=carts" className="block">
        <StatCard
          label="Carts to Recover"
          value={k.cartsToRecover}
          variant={k.cartsToRecover > 5 ? 'warning' : 'default'}
        />
      </Link>
    </div>
  )
}

async function PromotionsSlot() {
  const r = await loadPromotionsTab()
  return <PromotionsListView rows={r.items} />
}

async function PopupsSlot() {
  const r = await loadPopupsTab()
  return <PopupsListView rows={r.items} />
}

async function SubscribersSlot({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const r = await loadSubscribersTab()
  return <SubscribersListView rows={r.items} isSuperAdmin={isSuperAdmin} />
}

async function CampaignsSlot() {
  const r = await loadCampaignsTab()
  return <CampaignsListView rows={r.items} />
}

async function CartsSlot() {
  const r = await loadAbandonedCartsTab()
  return <AbandonedCartsListView rows={r.items} />
}

function ListSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-12 bg-white/[0.03] border border-white/8 rounded-md animate-pulse" />
      ))}
    </div>
  )
}

function KpiStripSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-20 bg-white/[0.03] border border-white/8 rounded-md animate-pulse" />
      ))}
    </div>
  )
}

export async function AdminMarketingV2({ searchParams }: Props) {
  const tab = parseTab(searchParams.tab)
  const isSuperAdmin = await resolveIsSuperAdmin()

  return (
    <AdminLayout title="Marketing" subtitle="Promotions, popups, subscribers, campaigns, carts">
      <div className="space-y-3.5">
        <MarketingTabPills tabs={TAB_CONFIG} active={tab} />

        <Suspense fallback={<KpiStripSkeleton />}>
          <KpiStripSlot />
        </Suspense>

        {/* TODO(phase-5.5): real filter bar (search, type/template/status filters, date range) */}
        <div className="text-xs text-white/40 mb-4">Filter bar — Phase 5.5</div>

        {tab === 'promotions' ? (
          <Suspense fallback={<ListSkeleton />}><PromotionsSlot /></Suspense>
        ) : tab === 'popups' ? (
          <Suspense fallback={<ListSkeleton />}><PopupsSlot /></Suspense>
        ) : tab === 'subscribers' ? (
          <Suspense fallback={<ListSkeleton />}><SubscribersSlot isSuperAdmin={isSuperAdmin} /></Suspense>
        ) : tab === 'campaigns' ? (
          <Suspense fallback={<ListSkeleton />}><CampaignsSlot /></Suspense>
        ) : (
          <Suspense fallback={<ListSkeleton />}><CartsSlot /></Suspense>
        )}
      </div>
    </AdminLayout>
  )
}
```

- [ ] **Step 6: Write the failing dispatcher test**

```tsx
// tests/unit/app/admin/marketing/page.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/marketing',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/admin/dashboard/AdminMarketingV2', () => ({
  AdminMarketingV2: () => <div data-testid="v2">V2 marketing</div>,
}))
vi.mock('@/components/admin/_v1/AdminMarketingV1', () => ({
  AdminMarketingV1: () => <div data-testid="v1">V1 marketing</div>,
}))

beforeEach(() => { vi.resetModules() })

describe('admin/marketing/page dispatcher', () => {
  it('renders V1 when flag is false', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'false'
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/marketing/page')
    render(await mod.default({ searchParams: Promise.resolve({}) }))
    expect(screen.getByTestId('v1')).toBeInTheDocument()
  })

  it('renders V2 when flag is true', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/marketing/page')
    render(await mod.default({ searchParams: Promise.resolve({}) }))
    expect(screen.getByTestId('v2')).toBeInTheDocument()
  })

  it('passes searchParams through to V2', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    const v2Spy = vi.fn(() => <div data-testid="v2-with-params" />)
    vi.doMock('@/components/admin/dashboard/AdminMarketingV2', () => ({
      AdminMarketingV2: v2Spy,
    }))
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/marketing/page')
    render(await mod.default({ searchParams: Promise.resolve({ tab: 'subscribers' }) }))
    expect(screen.getByTestId('v2-with-params')).toBeInTheDocument()
    expect(v2Spy).toHaveBeenCalledWith(
      expect.objectContaining({ searchParams: { tab: 'subscribers' } }),
      undefined,
    )
  })
})
```

- [ ] **Step 7: Write `app/admin/marketing/page.tsx` dispatcher**

```tsx
import { AdminMarketingV1 } from '@/components/admin/_v1/AdminMarketingV1'
import { AdminMarketingV2 } from '@/components/admin/dashboard/AdminMarketingV2'

export const revalidate = 60

interface PageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function AdminMarketingPage({ searchParams }: PageProps) {
  const params = await searchParams
  if (process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED === 'true') {
    return <AdminMarketingV2 searchParams={params} />
  }
  return <AdminMarketingV1 />
}
```

- [ ] **Step 8: Run both tests**

```bash
pnpm test tests/unit/components/admin/dashboard/AdminMarketingV2.test.tsx tests/unit/app/admin/marketing/page.test.tsx
```

Expected: PASS — 6 + 3 = 9 tests.

- [ ] **Step 9: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 10: Commit + push + PR**

```bash
git add components/admin/_v1/AdminMarketingV1.tsx components/admin/dashboard/AdminMarketingV2.tsx components/admin/dashboard/MarketingTabPills.tsx app/admin/marketing/page.tsx tests/unit/components/admin/dashboard/AdminMarketingV2.test.tsx tests/unit/app/admin/marketing/page.test.tsx
git commit -m "feat(admin-v2): add AdminMarketingV2 root + tab pills + V1 stub + page dispatcher"
git push -u origin wave5p5/task-20-admin-marketing-v2
gh pr create --title "feat(admin-v2): Phase 5 W6 AdminMarketingV2 root + dispatcher" --body "Adds V1 stub (links to existing /admin/promotions, /admin/popups, /admin/newsletter, /admin/abandoned-carts) and V2 root with 5-tab Suspense composition (TabPills + 4 KPI cards + filter bar placeholder + per-tab slot). Page dispatcher gates on NEXT_PUBLIC_ADMIN_V2_ENABLED. Resolves isSuperAdmin from the current session and forwards it to SubscribersListView."
```

---

## Wave 7 — Editors + editor dispatchers (3 parallel, after W6)

### Task 21: `CampaignEditor.tsx`

**Wave:** 7 | **Parallel-safe with:** 22, 23 | **Branch:** `wave5p5/task-21-campaign-editor` | **Model:** sonnet

**Schema realities for this task:**
- Lives at `components/admin/marketing/editor/CampaignEditor.tsx`.
- Fields: name, subject, preheader, heroImageUrl, ctaLabel, ctaUrl, bodyMarkdown, audienceFilter sidebar (activeOnly + source + customerMode).
- Buttons: Save Draft → `updateCampaignDraft(id, partial)`. Queue Send → `queueCampaignSend(id)`. Send Test → `sendCampaignTest(id, email)` with a delivery log table sourced from `detail.recentTestDeliveries`. Preview Audience → `previewCampaignAudience(id)` shows the count inline.
- Live Preview pane = right-side panel rendering subject + preheader + heroImageUrl + bodyMarkdown (as plain text — markdown preview-only, no parsing required for V1 — `pre className="whitespace-pre-wrap"`).
- Page renders inside `<AdminLayout>`; the editor itself is a client component that takes `detail: CampaignDetailFull` and `campaignId: string`.

**Files:**
- Create: `components/admin/marketing/editor/CampaignEditor.tsx`
- Test: `tests/unit/components/admin/marketing/editor/CampaignEditor.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/marketing/editor/CampaignEditor.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/app/admin/marketing/actions', () => ({
  updateCampaignDraft: vi.fn(async () => ({ ok: true })),
  queueCampaignSend: vi.fn(async () => ({ ok: true })),
  sendCampaignTest: vi.fn(async () => ({ ok: true })),
  previewCampaignAudience: vi.fn(async () => ({ ok: true, data: { count: 42 } })),
}))
vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const detail = {
  id: 'c1', name: 'May', subject: 'Hello May', preheader: 'Hi',
  heroImageUrl: null, ctaLabel: 'Shop', ctaUrl: '/',
  bodyMarkdown: 'Body text',
  status: 'DRAFT' as const,
  audienceFilter: { activeOnly: true },
  audienceCount: 0, sentCount: 0, failedCount: 0,
  createdByAdminId: 'a', sentAt: null,
  createdAt: new Date(), updatedAt: new Date(),
  recentTestDeliveries: [
    { id: 'd1', email: 'tester@e.com', status: 'SENT' as const, isTest: true,
      sentAt: new Date(), providerMessageId: 'm1', errorMessage: null },
  ],
}

beforeEach(() => { vi.clearAllMocks() })

describe('CampaignEditor', () => {
  it('renders all editable fields with initial values', async () => {
    const { CampaignEditor } = await import('@/components/admin/marketing/editor/CampaignEditor')
    render(<CampaignEditor detail={detail} campaignId="c1" />)
    expect(screen.getByDisplayValue('Hello May')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Hi')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Body text')).toBeInTheDocument()
  })

  it('Save Draft calls updateCampaignDraft', async () => {
    const { CampaignEditor } = await import('@/components/admin/marketing/editor/CampaignEditor')
    const { updateCampaignDraft } = await import('@/app/admin/marketing/actions')
    render(<CampaignEditor detail={detail} campaignId="c1" />)
    fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: 'Updated subject' } })
    fireEvent.click(screen.getByText('Save Draft'))
    await waitFor(() => {
      expect(updateCampaignDraft).toHaveBeenCalledWith('c1', expect.objectContaining({ subject: 'Updated subject' }))
    })
  })

  it('Send Test calls sendCampaignTest with email', async () => {
    const { CampaignEditor } = await import('@/components/admin/marketing/editor/CampaignEditor')
    const { sendCampaignTest } = await import('@/app/admin/marketing/actions')
    render(<CampaignEditor detail={detail} campaignId="c1" />)
    fireEvent.change(screen.getByPlaceholderText(/test email/i), { target: { value: 'qa@e.com' } })
    fireEvent.click(screen.getByText('Send Test'))
    await waitFor(() => {
      expect(sendCampaignTest).toHaveBeenCalledWith('c1', 'qa@e.com')
    })
  })

  it('Queue Send calls queueCampaignSend', async () => {
    const { CampaignEditor } = await import('@/components/admin/marketing/editor/CampaignEditor')
    const { queueCampaignSend } = await import('@/app/admin/marketing/actions')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<CampaignEditor detail={detail} campaignId="c1" />)
    fireEvent.click(screen.getByText('Queue Send'))
    await waitFor(() => { expect(queueCampaignSend).toHaveBeenCalledWith('c1') })
  })

  it('Preview Audience shows the returned count', async () => {
    const { CampaignEditor } = await import('@/components/admin/marketing/editor/CampaignEditor')
    render(<CampaignEditor detail={detail} campaignId="c1" />)
    fireEvent.click(screen.getByText(/preview audience/i))
    await waitFor(() => {
      expect(screen.getByText(/42 subscribers/i)).toBeInTheDocument()
    })
  })

  it('renders recent test deliveries in delivery log', async () => {
    const { CampaignEditor } = await import('@/components/admin/marketing/editor/CampaignEditor')
    render(<CampaignEditor detail={detail} campaignId="c1" />)
    expect(screen.getByText('tester@e.com')).toBeInTheDocument()
  })

  it('renders live preview pane with subject + body', async () => {
    const { CampaignEditor } = await import('@/components/admin/marketing/editor/CampaignEditor')
    render(<CampaignEditor detail={detail} campaignId="c1" />)
    expect(screen.getByTestId('campaign-live-preview')).toHaveTextContent('Hello May')
    expect(screen.getByTestId('campaign-live-preview')).toHaveTextContent('Body text')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/marketing/editor/CampaignEditor.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/marketing/editor/CampaignEditor.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { toast } from '@/lib/toast'
import {
  updateCampaignDraft, queueCampaignSend, sendCampaignTest, previewCampaignAudience,
  type CampaignDetailFull,
} from '@/app/admin/marketing/actions'

export interface CampaignEditorProps {
  detail: CampaignDetailFull
  campaignId: string
}

interface AudienceFilterShape {
  activeOnly?: boolean
  source?: string
  customerMode?: 'all' | 'subscribers-only'
}

function parseAudienceFilter(raw: unknown): AudienceFilterShape {
  if (raw && typeof raw === 'object') return raw as AudienceFilterShape
  return {}
}

export function CampaignEditor({ detail, campaignId }: CampaignEditorProps) {
  const [pending, startTransition] = useTransition()

  const [name, setName] = useState(detail.name ?? '')
  const [subject, setSubject] = useState(detail.subject)
  const [preheader, setPreheader] = useState(detail.preheader)
  const [heroImageUrl, setHeroImageUrl] = useState(detail.heroImageUrl ?? '')
  const [ctaLabel, setCtaLabel] = useState(detail.ctaLabel)
  const [ctaUrl, setCtaUrl] = useState(detail.ctaUrl)
  const [bodyMarkdown, setBodyMarkdown] = useState(detail.bodyMarkdown)
  const [audience, setAudience] = useState<AudienceFilterShape>(parseAudienceFilter(detail.audienceFilter))
  const [testEmail, setTestEmail] = useState('')
  const [audienceCount, setAudienceCount] = useState<number | null>(null)

  function handleSaveDraft() {
    startTransition(async () => {
      const r = await updateCampaignDraft(campaignId, {
        name: name || null, subject, preheader,
        heroImageUrl: heroImageUrl || null,
        ctaLabel, ctaUrl, bodyMarkdown,
        audienceFilter: audience,
      })
      if (r.ok) toast.success('Draft saved')
      else toast.error('Failed to save')
    })
  }

  function handleQueueSend() {
    if (!window.confirm('Queue this campaign for send?')) return
    startTransition(async () => {
      const r = await queueCampaignSend(campaignId)
      if (r.ok) toast.success('Queued')
      else toast.error('Failed to queue')
    })
  }

  function handleSendTest() {
    if (!testEmail) { toast.error('Enter a test email'); return }
    startTransition(async () => {
      const r = await sendCampaignTest(campaignId, testEmail)
      if (r.ok) toast.success(`Test sent to ${testEmail}`)
      else toast.error('Failed to send test')
    })
  }

  function handlePreviewAudience() {
    startTransition(async () => {
      const r = await previewCampaignAudience(campaignId)
      if (r.ok && r.data) setAudienceCount(r.data.count)
      else toast.error('Failed to preview audience')
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* ── Composer ──────────────────────────────────────────────── */}
      <div className="lg:col-span-2 space-y-3 bg-neutral-900/60 border border-white/8 rounded-lg p-4">
        <h2 className="text-base font-semibold text-white">Composer</h2>
        <label className="block">
          <span className="block text-[11px] uppercase text-white/40 mb-1">Internal name</span>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white" />
        </label>
        <label className="block">
          <span className="block text-[11px] uppercase text-white/40 mb-1">Subject</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white" />
        </label>
        <label className="block">
          <span className="block text-[11px] uppercase text-white/40 mb-1">Preheader</span>
          <input value={preheader} onChange={(e) => setPreheader(e.target.value)}
            className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white" />
        </label>
        <label className="block">
          <span className="block text-[11px] uppercase text-white/40 mb-1">Hero image URL</span>
          <input value={heroImageUrl} onChange={(e) => setHeroImageUrl(e.target.value)}
            className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="block text-[11px] uppercase text-white/40 mb-1">CTA label</span>
            <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)}
              className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white" />
          </label>
          <label>
            <span className="block text-[11px] uppercase text-white/40 mb-1">CTA URL</span>
            <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)}
              className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white" />
          </label>
        </div>
        <label className="block">
          <span className="block text-[11px] uppercase text-white/40 mb-1">Body (markdown)</span>
          <textarea value={bodyMarkdown} onChange={(e) => setBodyMarkdown(e.target.value)}
            rows={10}
            className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white font-mono text-sm" />
        </label>

        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/8">
          <button onClick={handleSaveDraft} disabled={pending}
            className="px-3 py-1.5 text-sm bg-white/8 border border-white/15 rounded text-white disabled:opacity-40">
            Save Draft
          </button>
          <button onClick={handleQueueSend} disabled={pending}
            className="px-3 py-1.5 text-sm bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded disabled:opacity-40">
            Queue Send
          </button>
          <input placeholder="Test email" value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white text-sm flex-1 min-w-[200px]" />
          <button onClick={handleSendTest} disabled={pending}
            className="px-3 py-1.5 text-sm bg-white/8 border border-white/15 rounded text-white disabled:opacity-40">
            Send Test
          </button>
        </div>

        {detail.recentTestDeliveries.length > 0 && (
          <div className="pt-3 border-t border-white/8">
            <h3 className="text-[11px] uppercase text-white/40 mb-2">Recent test deliveries</h3>
            <ul className="space-y-1 text-xs">
              {detail.recentTestDeliveries.map((d) => (
                <li key={d.id} className="flex justify-between text-white/70">
                  <span className="font-mono">{d.email}</span>
                  <span className={d.status === 'SENT' ? 'text-emerald-300' : 'text-rose-300'}>{d.status}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Sidebar (audience + preview) ──────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="bg-neutral-900/60 border border-white/8 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">Audience</h3>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={audience.activeOnly === true}
              onChange={(e) => setAudience({ ...audience, activeOnly: e.target.checked })}
              className="accent-emerald-500" />
            <span className="text-white/70">Active subscribers only</span>
          </label>
          <label className="block">
            <span className="block text-[11px] uppercase text-white/40 mb-1">Source filter</span>
            <input value={audience.source ?? ''}
              onChange={(e) => setAudience({ ...audience, source: e.target.value })}
              placeholder="popup, footer, …"
              className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white text-sm" />
          </label>
          <button onClick={handlePreviewAudience} disabled={pending}
            className="w-full px-3 py-1.5 text-xs bg-white/8 border border-white/15 rounded text-white disabled:opacity-40">
            Preview Audience
          </button>
          {audienceCount !== null && (
            <p className="text-xs text-white/60">{audienceCount} subscribers</p>
          )}
        </div>

        <div data-testid="campaign-live-preview"
          className="bg-neutral-900/60 border border-white/8 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-white mb-2">Live preview</h3>
          {heroImageUrl && (
            <div className="text-[11px] text-white/40 break-all mb-2">{heroImageUrl}</div>
          )}
          <p className="text-base text-white font-semibold">{subject}</p>
          <p className="text-xs text-white/50 mt-1">{preheader}</p>
          <pre className="text-sm text-white/80 mt-3 whitespace-pre-wrap font-sans">{bodyMarkdown}</pre>
          {ctaLabel && ctaUrl && (
            <a href={ctaUrl} className="mt-3 inline-block px-3 py-1.5 bg-white text-neutral-900 text-xs font-semibold rounded">
              {ctaLabel}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/marketing/editor/CampaignEditor.test.tsx`
Expected: PASS — 7 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/marketing/editor/CampaignEditor.tsx tests/unit/components/admin/marketing/editor/CampaignEditor.test.tsx
git commit -m "feat(admin-v2): add CampaignEditor (composer + audience sidebar + live preview)"
git push -u origin wave5p5/task-21-campaign-editor
gh pr create --title "feat(admin-v2): Phase 5 W7 CampaignEditor" --body "Full-page editor for newsletter campaigns: composer (name, subject, preheader, hero, CTA, body), audience sidebar (activeOnly + source + preview), live preview pane, Save Draft + Queue Send + Send Test buttons. Recent test deliveries log sourced from detail.recentTestDeliveries."
```

---

### Task 22: `PopupEditor.tsx`

**Wave:** 7 | **Parallel-safe with:** 21, 23 | **Branch:** `wave5p5/task-22-popup-editor` | **Model:** sonnet

**Schema realities for this task:**
- Lives at `components/admin/marketing/editor/PopupEditor.tsx`.
- Sections:
  1. Basics (name, template, position)
  2. Trigger (type + value)
  3. Frequency
  4. Content (primary content textarea + variants list with CRUD)
  5. Targeting (showOnPages, showToNewVisitors, showToReturning)
  6. Schedule (startDate, endDate)
  7. Activation (isActive + priority + Save / Activate footer)
- Variant CRUD: list `detail.variants` with `weight`, `isActive`, `content`. "+ Add variant" button calls `createPopupVariant(popupId, input)`. Each row has Save (`updatePopupVariant`) + Delete (`deletePopupVariant`).
- Save button calls `updatePopup(id, partial)`. Activate button calls `togglePopupActive(id)`.

**Files:**
- Create: `components/admin/marketing/editor/PopupEditor.tsx`
- Test: `tests/unit/components/admin/marketing/editor/PopupEditor.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/marketing/editor/PopupEditor.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/app/admin/marketing/actions', () => ({
  updatePopup: vi.fn(async () => ({ ok: true })),
  togglePopupActive: vi.fn(async () => ({ ok: true })),
  createPopupVariant: vi.fn(async () => ({ ok: true, data: { id: 'v2' } })),
  updatePopupVariant: vi.fn(async () => ({ ok: true })),
  deletePopupVariant: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const detail = {
  id: 'pp1', name: 'Welcome', template: 'MODAL' as const, position: 'CENTER' as const,
  content: '{"title":"Welcome"}',
  triggerType: 'DELAY' as const, triggerValue: 3,
  showOnPages: 'all', showToNewVisitors: true, showToReturning: false,
  frequency: 'ONCE_PER_SESSION' as const,
  startDate: null, endDate: null,
  isActive: false, priority: 0, promotionId: null,
  createdAt: new Date(), updatedAt: new Date(),
  variants: [
    { id: 'v1', popupId: 'pp1', name: 'A', content: '{}', weight: 50, isActive: true,
      createdAt: new Date(), updatedAt: new Date() },
  ],
  analytics7d: { impressions: 0, clicks: 0, dismissals: 0, conversions: 0 },
}

beforeEach(() => { vi.clearAllMocks() })

describe('PopupEditor', () => {
  it('renders all 7 sections', async () => {
    const { PopupEditor } = await import('@/components/admin/marketing/editor/PopupEditor')
    render(<PopupEditor detail={detail} popupId="pp1" />)
    expect(screen.getByText('Basics')).toBeInTheDocument()
    expect(screen.getByText('Trigger')).toBeInTheDocument()
    expect(screen.getByText('Frequency')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
    expect(screen.getByText('Targeting')).toBeInTheDocument()
    expect(screen.getByText('Schedule')).toBeInTheDocument()
    expect(screen.getByText('Activation')).toBeInTheDocument()
  })

  it('Save calls updatePopup', async () => {
    const { PopupEditor } = await import('@/components/admin/marketing/editor/PopupEditor')
    const { updatePopup } = await import('@/app/admin/marketing/actions')
    render(<PopupEditor detail={detail} popupId="pp1" />)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Welcome v2' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => {
      expect(updatePopup).toHaveBeenCalledWith('pp1', expect.objectContaining({ name: 'Welcome v2' }))
    })
  })

  it('Activate calls togglePopupActive', async () => {
    const { PopupEditor } = await import('@/components/admin/marketing/editor/PopupEditor')
    const { togglePopupActive } = await import('@/app/admin/marketing/actions')
    render(<PopupEditor detail={detail} popupId="pp1" />)
    fireEvent.click(screen.getByText(/^activate/i))
    await waitFor(() => { expect(togglePopupActive).toHaveBeenCalledWith('pp1') })
  })

  it('renders existing variants', async () => {
    const { PopupEditor } = await import('@/components/admin/marketing/editor/PopupEditor')
    render(<PopupEditor detail={detail} popupId="pp1" />)
    expect(screen.getByDisplayValue('A')).toBeInTheDocument()
  })

  it('Add variant calls createPopupVariant', async () => {
    const { PopupEditor } = await import('@/components/admin/marketing/editor/PopupEditor')
    const { createPopupVariant } = await import('@/app/admin/marketing/actions')
    render(<PopupEditor detail={detail} popupId="pp1" />)
    fireEvent.click(screen.getByText(/\+ Add variant/i))
    await waitFor(() => { expect(createPopupVariant).toHaveBeenCalled() })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/marketing/editor/PopupEditor.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/marketing/editor/PopupEditor.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { toast } from '@/lib/toast'
import {
  updatePopup, togglePopupActive,
  createPopupVariant, updatePopupVariant, deletePopupVariant,
  type PopupDetailFull, type PopupVariantDetail,
} from '@/app/admin/marketing/actions'

export interface PopupEditorProps {
  detail: PopupDetailFull
  popupId: string
}

const TEMPLATES = ['MODAL', 'BANNER', 'SLIDE_IN', 'FULL_SCREEN', 'EMAIL_CAPTURE'] as const
const POSITIONS = ['TOP', 'BOTTOM', 'CENTER', 'BOTTOM_RIGHT', 'BOTTOM_LEFT', 'TOP_RIGHT', 'TOP_LEFT'] as const
const TRIGGERS = ['DELAY', 'SCROLL', 'EXIT_INTENT', 'IMMEDIATE'] as const
const FREQUENCIES = ['ONCE_PER_SESSION', 'ONCE_PER_DAY', 'ONCE_EVER', 'ALWAYS'] as const

function toLocalDate(d: Date | null): string {
  if (!d) return ''
  return d.toISOString().slice(0, 10)
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-neutral-900/60 border border-white/8 rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {children}
    </section>
  )
}

export function PopupEditor({ detail, popupId }: PopupEditorProps) {
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState(detail.name)
  const [template, setTemplate] = useState<typeof TEMPLATES[number]>(detail.template as typeof TEMPLATES[number])
  const [position, setPosition] = useState<typeof POSITIONS[number]>(detail.position as typeof POSITIONS[number])
  const [triggerType, setTriggerType] = useState<typeof TRIGGERS[number]>(detail.triggerType as typeof TRIGGERS[number])
  const [triggerValue, setTriggerValue] = useState(detail.triggerValue)
  const [frequency, setFrequency] = useState<typeof FREQUENCIES[number]>(detail.frequency as typeof FREQUENCIES[number])
  const [content, setContent] = useState(detail.content)
  const [showOnPages, setShowOnPages] = useState(detail.showOnPages)
  const [showToNewVisitors, setShowToNewVisitors] = useState(detail.showToNewVisitors)
  const [showToReturning, setShowToReturning] = useState(detail.showToReturning)
  const [startDate, setStartDate] = useState(toLocalDate(detail.startDate))
  const [endDate, setEndDate] = useState(toLocalDate(detail.endDate))
  const [isActive, setIsActive] = useState(detail.isActive)
  const [priority, setPriority] = useState(detail.priority)
  const [variants, setVariants] = useState<PopupVariantDetail[]>(detail.variants)

  function handleSave() {
    startTransition(async () => {
      const r = await updatePopup(popupId, {
        name, template, position, triggerType, triggerValue, frequency, content,
        showOnPages, showToNewVisitors, showToReturning,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isActive, priority,
      })
      if (r.ok) toast.success('Saved')
      else toast.error('Failed to save')
    })
  }

  function handleActivateToggle() {
    startTransition(async () => {
      const r = await togglePopupActive(popupId)
      if (r.ok) {
        setIsActive(!isActive)
        toast.success(isActive ? 'Deactivated' : 'Activated')
      } else toast.error('Failed')
    })
  }

  function handleAddVariant() {
    startTransition(async () => {
      const r = await createPopupVariant(popupId, { name: 'New variant', weight: 50, isActive: true })
      if (r.ok && r.data) {
        const now = new Date()
        setVariants((prev) => [...prev, {
          id: r.data!.id, popupId, name: 'New variant', content: null,
          weight: 50, isActive: true, createdAt: now, updatedAt: now,
        }])
        toast.success('Variant added')
      } else toast.error('Failed to add variant')
    })
  }

  function handleSaveVariant(v: PopupVariantDetail) {
    startTransition(async () => {
      const r = await updatePopupVariant(v.id, {
        name: v.name, content: v.content, weight: v.weight, isActive: v.isActive,
      })
      if (r.ok) toast.success('Variant saved')
      else toast.error('Failed to save variant')
    })
  }

  function handleDeleteVariant(id: string) {
    if (!window.confirm('Delete this variant?')) return
    startTransition(async () => {
      const r = await deletePopupVariant(id)
      if (r.ok) {
        setVariants((prev) => prev.filter((v) => v.id !== id))
        toast.success('Variant deleted')
      } else toast.error('Failed to delete')
    })
  }

  return (
    <div className="space-y-4">
      <Section title="Basics">
        <label className="block">
          <span className="block text-[11px] uppercase text-white/40 mb-1">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="block text-[11px] uppercase text-white/40 mb-1">Template</span>
            <select value={template} onChange={(e) => setTemplate(e.target.value as typeof TEMPLATES[number])}
              className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white">
              {TEMPLATES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label>
            <span className="block text-[11px] uppercase text-white/40 mb-1">Position</span>
            <select value={position} onChange={(e) => setPosition(e.target.value as typeof POSITIONS[number])}
              className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white">
              {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
        </div>
      </Section>

      <Section title="Trigger">
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="block text-[11px] uppercase text-white/40 mb-1">Type</span>
            <select value={triggerType} onChange={(e) => setTriggerType(e.target.value as typeof TRIGGERS[number])}
              className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white">
              {TRIGGERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label>
            <span className="block text-[11px] uppercase text-white/40 mb-1">Value</span>
            <input type="number" value={triggerValue}
              onChange={(e) => setTriggerValue(Number(e.target.value))}
              className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white" />
          </label>
        </div>
      </Section>

      <Section title="Frequency">
        <select value={frequency} onChange={(e) => setFrequency(e.target.value as typeof FREQUENCIES[number])}
          className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white">
          {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </Section>

      <Section title="Content">
        <label className="block">
          <span className="block text-[11px] uppercase text-white/40 mb-1">Primary content (JSON)</span>
          <textarea value={content} onChange={(e) => setContent(e.target.value)}
            rows={5}
            className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white font-mono text-xs" />
        </label>
        <div className="pt-2 border-t border-white/8">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[11px] uppercase text-white/40">Variants (A/B)</h4>
            <button onClick={handleAddVariant} disabled={pending}
              className="text-xs text-emerald-300 hover:text-emerald-200">+ Add variant</button>
          </div>
          {variants.length === 0 && (
            <p className="text-xs text-white/40">No A/B variants. Add one to split traffic.</p>
          )}
          <ul className="space-y-2">
            {variants.map((v, i) => (
              <li key={v.id} className="bg-neutral-900 border border-white/8 rounded p-2 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <input value={v.name}
                    onChange={(e) => setVariants((prev) => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                    className="col-span-1 bg-neutral-900 border border-white/8 rounded px-2 py-1 text-white text-xs" />
                  <input type="number" value={v.weight}
                    onChange={(e) => setVariants((prev) => prev.map((x, j) => j === i ? { ...x, weight: Number(e.target.value) } : x))}
                    className="col-span-1 bg-neutral-900 border border-white/8 rounded px-2 py-1 text-white text-xs" />
                  <label className="flex items-center gap-2 text-xs text-white/60">
                    <input type="checkbox" checked={v.isActive}
                      onChange={(e) => setVariants((prev) => prev.map((x, j) => j === i ? { ...x, isActive: e.target.checked } : x))}
                      className="accent-emerald-500" />
                    Active
                  </label>
                </div>
                <textarea value={v.content ?? ''}
                  onChange={(e) => setVariants((prev) => prev.map((x, j) => j === i ? { ...x, content: e.target.value } : x))}
                  rows={3}
                  className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1 text-white font-mono text-xs" />
                <div className="flex gap-2">
                  <button onClick={() => handleSaveVariant(v)} disabled={pending}
                    className="text-xs px-2 py-1 bg-white/8 border border-white/15 rounded text-white">Save</button>
                  <button onClick={() => handleDeleteVariant(v.id)} disabled={pending}
                    className="text-xs px-2 py-1 bg-rose-500/15 border border-rose-500/30 rounded text-rose-300">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section title="Targeting">
        <label className="block">
          <span className="block text-[11px] uppercase text-white/40 mb-1">Show on pages (URL pattern or &quot;all&quot;)</span>
          <input value={showOnPages} onChange={(e) => setShowOnPages(e.target.value)}
            className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white" />
        </label>
        <div className="flex gap-3 text-sm text-white/70">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showToNewVisitors}
              onChange={(e) => setShowToNewVisitors(e.target.checked)}
              className="accent-emerald-500" />
            New visitors
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showToReturning}
              onChange={(e) => setShowToReturning(e.target.checked)}
              className="accent-emerald-500" />
            Returning visitors
          </label>
        </div>
      </Section>

      <Section title="Schedule">
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="block text-[11px] uppercase text-white/40 mb-1">Starts</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white" />
          </label>
          <label>
            <span className="block text-[11px] uppercase text-white/40 mb-1">Ends</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white" />
          </label>
        </div>
      </Section>

      <Section title="Activation">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input type="checkbox" checked={isActive}
              onChange={handleActivateToggle}
              className="accent-emerald-500" />
            Active
          </label>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <span>Priority</span>
            <input type="number" value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="w-16 bg-neutral-900 border border-white/8 rounded px-2 py-1 text-white" />
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-white/8">
          <button onClick={handleSave} disabled={pending}
            className="px-3 py-1.5 text-sm bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded disabled:opacity-40">
            Save
          </button>
          <button onClick={handleActivateToggle} disabled={pending}
            className="px-3 py-1.5 text-sm bg-white/8 border border-white/15 rounded text-white disabled:opacity-40">
            {isActive ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      </Section>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/admin/marketing/editor/PopupEditor.test.tsx`
Expected: PASS — 5 tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add components/admin/marketing/editor/PopupEditor.tsx tests/unit/components/admin/marketing/editor/PopupEditor.test.tsx
git commit -m "feat(admin-v2): add PopupEditor with 7 sections + A/B variant CRUD"
git push -u origin wave5p5/task-22-popup-editor
gh pr create --title "feat(admin-v2): Phase 5 W7 PopupEditor" --body "7-section editor: Basics, Trigger, Frequency, Content (primary + A/B variants CRUD), Targeting, Schedule, Activation. Variants list calls createPopupVariant / updatePopupVariant / deletePopupVariant."
```

---

### Task 23: Editor dispatcher pages

**Wave:** 7 | **Parallel-safe with:** 21, 22 | **Branch:** `wave5p5/task-23-editor-dispatchers` | **Model:** sonnet

**Schema realities for this task:**
- Two dispatcher pages with the same V1/V2 gate pattern:
  - `app/admin/marketing/campaigns/[id]/edit/page.tsx` → V1 redirects to `/admin/newsletter`; V2 loads `loadCampaignDetail(id)` and renders `<CampaignEditor>` inside `<AdminLayout>`.
  - `app/admin/marketing/popups/[id]/edit/page.tsx` → V1 redirects to `/admin/popups/[id]`; V2 loads `loadPopupDetail(id)` and renders `<PopupEditor>`.
- V1 redirect uses `redirect()` from `next/navigation`.
- V2 path renders `notFound()` from `next/navigation` when the detail loader returns null.
- Each page has `revalidate = 60`.
- Test each dispatcher with `vi.resetModules()` + `vi.doMock` (Phase 4 Task 13 precedent).

**Files:**
- Create: `app/admin/marketing/campaigns/[id]/edit/page.tsx`
- Create: `app/admin/marketing/popups/[id]/edit/page.tsx`
- Test: `tests/unit/app/admin/marketing/campaigns/[id]/edit/page.test.tsx`
- Test: `tests/unit/app/admin/marketing/popups/[id]/edit/page.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing campaign-edit dispatcher test**

```tsx
// tests/unit/app/admin/marketing/campaigns/[id]/edit/page.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'

const redirect = vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) })
const notFound = vi.fn(() => { throw new Error('NOT_FOUND') })

vi.mock('next/navigation', () => ({ redirect, notFound }))

vi.mock('@/lib/admin/marketing', () => ({
  loadCampaignDetail: vi.fn(async (id: string) => id === 'c1' ? {
    id: 'c1', name: null, subject: 'Hi', preheader: 'P',
    heroImageUrl: null, ctaLabel: 'Shop', ctaUrl: '/', bodyMarkdown: 'B',
    status: 'DRAFT', audienceFilter: {}, audienceCount: 0,
    sentCount: 0, failedCount: 0, createdByAdminId: 'a',
    sentAt: null, createdAt: new Date(), updatedAt: new Date(),
    recentTestDeliveries: [],
  } : null),
}))

vi.mock('@/components/admin/AdminLayout', () => ({
  AdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('@/components/admin/marketing/editor/CampaignEditor', () => ({
  CampaignEditor: () => <div data-testid="campaign-editor" />,
}))

beforeEach(() => {
  vi.resetModules()
  redirect.mockClear()
  notFound.mockClear()
})

describe('campaigns/[id]/edit dispatcher', () => {
  it('redirects to /admin/newsletter when V2 disabled', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'false'
    const mod = await import('@/app/admin/marketing/campaigns/[id]/edit/page')
    await expect(mod.default({ params: Promise.resolve({ id: 'c1' }) })).rejects.toThrow(/REDIRECT:\/admin\/newsletter/)
  })

  it('renders CampaignEditor when V2 enabled and detail exists', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/marketing/campaigns/[id]/edit/page')
    render(await mod.default({ params: Promise.resolve({ id: 'c1' }) }))
    expect(screen.getByTestId('campaign-editor')).toBeInTheDocument()
  })

  it('calls notFound when detail is null', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    const mod = await import('@/app/admin/marketing/campaigns/[id]/edit/page')
    await expect(mod.default({ params: Promise.resolve({ id: 'missing' }) })).rejects.toThrow('NOT_FOUND')
  })
})
```

- [ ] **Step 2: Write the failing popup-edit dispatcher test**

```tsx
// tests/unit/app/admin/marketing/popups/[id]/edit/page.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'

const redirect = vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) })
const notFound = vi.fn(() => { throw new Error('NOT_FOUND') })

vi.mock('next/navigation', () => ({ redirect, notFound }))

vi.mock('@/lib/admin/marketing', () => ({
  loadPopupDetail: vi.fn(async (id: string) => id === 'pp1' ? {
    id: 'pp1', name: 'Welcome', template: 'MODAL', position: 'CENTER',
    content: '{}', triggerType: 'DELAY', triggerValue: 3,
    showOnPages: 'all', showToNewVisitors: true, showToReturning: false,
    frequency: 'ONCE_PER_SESSION', startDate: null, endDate: null,
    isActive: true, priority: 0, promotionId: null,
    createdAt: new Date(), updatedAt: new Date(),
    variants: [],
    analytics7d: { impressions: 0, clicks: 0, dismissals: 0, conversions: 0 },
  } : null),
}))

vi.mock('@/components/admin/AdminLayout', () => ({
  AdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('@/components/admin/marketing/editor/PopupEditor', () => ({
  PopupEditor: () => <div data-testid="popup-editor" />,
}))

beforeEach(() => {
  vi.resetModules()
  redirect.mockClear()
  notFound.mockClear()
})

describe('popups/[id]/edit dispatcher', () => {
  it('redirects to /admin/popups/[id] when V2 disabled', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'false'
    const mod = await import('@/app/admin/marketing/popups/[id]/edit/page')
    await expect(mod.default({ params: Promise.resolve({ id: 'pp1' }) })).rejects.toThrow(/REDIRECT:\/admin\/popups\/pp1/)
  })

  it('renders PopupEditor when V2 enabled', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    const { render, screen } = await import('@testing-library/react')
    const mod = await import('@/app/admin/marketing/popups/[id]/edit/page')
    render(await mod.default({ params: Promise.resolve({ id: 'pp1' }) }))
    expect(screen.getByTestId('popup-editor')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `pnpm test tests/unit/app/admin/marketing/campaigns tests/unit/app/admin/marketing/popups`
Expected: FAIL — module not found.

- [ ] **Step 4: Write `app/admin/marketing/campaigns/[id]/edit/page.tsx`**

```tsx
import { redirect, notFound } from 'next/navigation'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { loadCampaignDetail } from '@/lib/admin/marketing'
import { CampaignEditor } from '@/components/admin/marketing/editor/CampaignEditor'

export const revalidate = 60

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CampaignEditorPage({ params }: PageProps) {
  const { id } = await params
  if (process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED !== 'true') {
    redirect('/admin/newsletter')
  }
  const detail = await loadCampaignDetail(id)
  if (!detail) notFound()
  return (
    <AdminLayout title="Campaign editor" subtitle={detail.subject}>
      <CampaignEditor detail={detail} campaignId={id} />
    </AdminLayout>
  )
}
```

- [ ] **Step 5: Write `app/admin/marketing/popups/[id]/edit/page.tsx`**

```tsx
import { redirect, notFound } from 'next/navigation'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { loadPopupDetail } from '@/lib/admin/marketing'
import { PopupEditor } from '@/components/admin/marketing/editor/PopupEditor'

export const revalidate = 60

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PopupEditorPage({ params }: PageProps) {
  const { id } = await params
  if (process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED !== 'true') {
    redirect(`/admin/popups/${id}`)
  }
  const detail = await loadPopupDetail(id)
  if (!detail) notFound()
  return (
    <AdminLayout title="Popup editor" subtitle={detail.name}>
      <PopupEditor detail={detail} popupId={id} />
    </AdminLayout>
  )
}
```

- [ ] **Step 6: Run both tests to verify they pass**

Run: `pnpm test tests/unit/app/admin/marketing/campaigns tests/unit/app/admin/marketing/popups`
Expected: PASS — 3 + 2 = 5 tests.

- [ ] **Step 7: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 8: Commit + push + PR**

```bash
git add app/admin/marketing/campaigns/[id]/edit/page.tsx app/admin/marketing/popups/[id]/edit/page.tsx tests/unit/app/admin/marketing/campaigns tests/unit/app/admin/marketing/popups
git commit -m "feat(admin-v2): add editor dispatcher pages for campaigns + popups"
git push -u origin wave5p5/task-23-editor-dispatchers
gh pr create --title "feat(admin-v2): Phase 5 W7 editor dispatchers" --body "Two dispatcher pages gating CampaignEditor + PopupEditor on NEXT_PUBLIC_ADMIN_V2_ENABLED. V1 path redirects to legacy V1 surface (/admin/newsletter, /admin/popups/[id]); V2 path loads detail + renders editor inside AdminLayout, calling notFound() when detail is null."
```

---

## Wave 8 — Verification + QA doc (sequential, 1 task)

### Task 24: Verification + QA doc

**Wave:** 8 | **Parallel-safe with:** none | **Branch:** `wave5p5/task-24-verification-qa` | **Model:** sonnet

**Schema realities for this task:**
- This task does NOT change application code. It runs the full quality sweep and ships a QA doc.
- QA doc lives at `docs/superpowers/plans/2026-05-30-admin-rebuild-phase5-qa.md` and follows the Phase 4 QA doc structure.
- Quality sweep:
  1. `pnpm exec tsc --noEmit` — record total errors; compare to baseline from `git checkout main && pnpm exec tsc --noEmit | wc -l`.
  2. `pnpm test` (full suite) — capture pass/fail counts.
  3. `pnpm exec eslint . --max-warnings=0` on touched files only.
  4. `grep -RIn 'TODO(phase-5.5)\|TODO(phase-5\.5)\|@todo' app/admin/marketing components/admin/marketing lib/admin/marketing.ts` to enumerate the deferred follow-ups.
  5. Manual smoke checklist with `NEXT_PUBLIC_ADMIN_V2_ENABLED=true` against `pnpm dev`.

**Files:**
- Create: `docs/superpowers/plans/2026-05-30-admin-rebuild-phase5-qa.md`

#### Steps

- [ ] **Step 1: Run typecheck and capture errors**

```bash
pnpm exec tsc --noEmit 2>&1 | tee /tmp/phase5-tsc.txt
wc -l /tmp/phase5-tsc.txt
```

Compare to baseline (run on `main` before Phase 5 was merged). Record the delta.

- [ ] **Step 2: Run full test suite**

```bash
pnpm test 2>&1 | tee /tmp/phase5-test.txt
```

Expected: all Phase 5 test files pass; no new regressions in pre-existing suites.

- [ ] **Step 3: Run eslint on touched files**

```bash
pnpm exec eslint \
  lib/admin/marketing.ts \
  app/admin/marketing \
  components/admin/marketing \
  components/admin/dashboard/AdminMarketingV2.tsx \
  components/admin/dashboard/MarketingTabPills.tsx \
  components/admin/_v1/AdminMarketingV1.tsx \
  --max-warnings=0
```

Expected: zero warnings/errors.

- [ ] **Step 4: Enumerate Phase 5.5 follow-ups**

```bash
grep -RIn 'phase-5.5\|phase-5\.5\|TODO(phase-5\.5)' \
  app/admin/marketing \
  components/admin/marketing \
  lib/admin/marketing.ts
```

Capture the list; it will populate the "Phase 5.5 follow-ups" section of the QA doc.

- [ ] **Step 5: Manual smoke checklist (with NEXT_PUBLIC_ADMIN_V2_ENABLED=true)**

Run `NEXT_PUBLIC_ADMIN_V2_ENABLED=true pnpm dev` and confirm each item:

- [ ] `/admin/marketing` renders with tab=promotions by default
- [ ] All 5 tabs switch via TabPills (`?tab=popups`, `?tab=subscribers`, `?tab=campaigns`, `?tab=carts`)
- [ ] KPI strip shows 4 cards; Active Promotions card is amber when count = 0; Carts to Recover card is amber when > 5
- [ ] Each KPI card is clickable and navigates to its tab
- [ ] Promotion inspector opens via ⋯; Save persists; Suggest populates the code; Activate toggle works
- [ ] Popup inspector opens; "Open editor →" link routes to `/admin/marketing/popups/[id]/edit`
- [ ] Subscriber inspector opens; Unsubscribe works; Delete is disabled when not SUPER_ADMIN
- [ ] Campaign inspector opens; Duplicate works; Delete is disabled on non-DRAFT; "Open editor →" routes to `/admin/marketing/campaigns/[id]/edit`
- [ ] Abandoned cart inspector opens; Send Recovery → toast + EmailQueue row; Generate Code → displays code; Mark Recovered flips state
- [ ] Bulk: multi-select via checkbox → bottom sheet appears; each per-tab BulkSheet wires its actions and clears selection on success
- [ ] Mobile: long-press selects; swipe-left fires per-variant quick action (no swipe action on campaigns)
- [ ] `/admin/marketing/campaigns/[id]/edit` renders CampaignEditor; Save Draft persists; Send Test enqueues an email; Queue Send moves status to QUEUED; Preview Audience shows count
- [ ] `/admin/marketing/popups/[id]/edit` renders PopupEditor; Save persists; Activate toggles; Add variant creates a row; Save variant persists; Delete variant removes it
- [ ] With `NEXT_PUBLIC_ADMIN_V2_ENABLED=false`: `/admin/marketing` shows V1 stub with 4 links; `/admin/marketing/campaigns/[id]/edit` redirects to `/admin/newsletter`; `/admin/marketing/popups/[id]/edit` redirects to `/admin/popups/[id]`

- [ ] **Step 6: Write `docs/superpowers/plans/2026-05-30-admin-rebuild-phase5-qa.md`**

```markdown
# Phase 5 — Marketing QA Doc

## Summary

Phase 5 ships a new `/admin/marketing` umbrella page (5 tabs) + 2 full-page editors, all gated behind `NEXT_PUBLIC_ADMIN_V2_ENABLED`. Zero schema migrations; ~40 server actions wrap existing V1 logic.

## Verification matrix

| Check | Result |
|---|---|
| `pnpm exec tsc --noEmit` | <fill in: N total errors; +0 vs baseline> |
| `pnpm test` | <fill in: P passing / F failing> |
| `pnpm exec eslint` on touched files | <fill in> |

## Smoke checklist (with V2 flag on)

(All items from Step 5 above, with date + tester initials when run.)

- [ ] `/admin/marketing` default tab
- [ ] 5 tab switches
- [ ] KPI strip variant + click-through
- [ ] PromotionInspector: open, Save, Suggest, Activate toggle
- [ ] PopupInspector: open, "Open editor →" link
- [ ] SubscriberInspector: Unsubscribe, Delete-disabled-for-non-SUPER_ADMIN
- [ ] CampaignInspector: Duplicate, Delete-DRAFT-only, "Open editor →" link
- [ ] AbandonedCartInspector: Send Recovery, Generate Code, Mark Recovered
- [ ] Bulk sheets: each per-tab sheet wires correctly
- [ ] Mobile long-press + swipe per variant
- [ ] CampaignEditor: Save Draft, Send Test, Queue Send, Preview Audience
- [ ] PopupEditor: all 7 sections + variant CRUD
- [ ] V1 stub (flag off): 4 link cards
- [ ] Editor V1 redirects (flag off)

## Mobile considerations

- All Inspectors slide up full-screen on `< md` (Phase 3/4 Inspector behavior).
- BottomActionSheet attaches to bottom safe-area on mobile.
- Long-press multi-select uses `onContextMenu`; iOS Safari fires this on long-press.
- Swipe-left actions are per-variant (no swipe on campaigns).

## Phase 5.5 follow-ups (deferred)

- Bulk promotion code generation (`PromotionCode[]` child table)
- Auto-cron recovery emails on carts > 1h old
- UTM attribution beyond `NewsletterSubscriber.utmSource`
- Visual popup builder (drag-drop content blocks)
- Promotion segmentation beyond `customerEmails` array
- Resend webhook integration for open/click tracking
- Configurable return-window per popup template
- Loyalty offer crossover tab (Phase 7 owns this)
- Refactor: replace inline Prisma in `get*ForInspector` actions with imports from `lib/admin/marketing.ts` (parallel-safety scaffolding from W1 Task 2)
- Real filter bar on `AdminMarketingV2` (search, type/template/status filters, date range)

## Regression risk assessment

- **Low risk:** V1 surfaces (`/admin/promotions`, `/admin/popups`, `/admin/newsletter`, `/admin/abandoned-carts`) are untouched — only the new `/admin/marketing` umbrella + 2 editor URLs are net-new.
- **Medium risk:** EmailQueue receives 2 new `type` values (`newsletter-campaign-test`, `abandoned-cart-recovery`). Confirm `lib/email/queue.ts` SENDER_MAP either handles these or fails gracefully (lands in FAILED with `lastError` set).
- **Low risk:** `generateCartRecoveryCode` writes a new Promotion + updates AbandonedCart in a transaction; retry-on-collision up to 5 attempts. Worst case = transient error returned to UI.
- **Zero risk:** No schema changes; no migrations; no Prisma client regeneration required.
```

- [ ] **Step 7: Commit + push + PR**

```bash
git add docs/superpowers/plans/2026-05-30-admin-rebuild-phase5-qa.md
git commit -m "docs: add Phase 5 QA doc with smoke checklist + 5.5 follow-ups"
git push -u origin wave5p5/task-24-verification-qa
gh pr create --title "docs(admin-v2): Phase 5 W8 QA doc" --body "Verification + QA doc for Phase 5 (Marketing). Includes the verification matrix (tsc/test/eslint counts), full smoke checklist, mobile considerations, enumerated Phase 5.5 follow-ups, and regression risk assessment."
```

---

## Coverage gaps fixed inline

- **Spec calls for "Promotion code generation single field + Suggest button"** but did not specify `checkPromotionCodeUnique` as a separate UX step. Task 5 adds an on-blur uniqueness check with a small "Taken" hint, matching the V1 promotion editor UX.
- **Spec calls for "Bulk delete drafts only" on Campaigns** without specifying client-side warning. Task 13 emits a `toast.warning` when the selection includes non-DRAFT rows (the server silently filters; this prevents user confusion).
- **Spec calls for "Active Inspector workflow" on Abandoned Carts** but didn't specify display of an already-generated code. Task 9 displays `detail.discountCode` (existing code) AND the newly-generated code from `generateCartRecoveryCode` so admins can recall a code from the previous session.
- **Spec calls for `isSuperAdmin` gating on subscriber delete** but didn't specify where the value is computed. Task 20 (V2 root) resolves it via `prisma.customer.findUnique({ where: { id: userId }, select: { adminRole: true } })` and forwards through the SubscribersListView prop tree.
- **Spec lists ~38–40 actions** without nailing exact name spellings. Task 2's test file is the canonical source — agents in W3/W4/W5/W7 should `import` from `@/app/admin/marketing/actions` by exactly the names defined in Task 2's implementation file.
- **Spec calls for "no swipe action on campaigns"** — Task 4 (MarketingListCardMobile) returns `null` from `quickActionLabel('campaigns')` and renders the card without SwipeableRow wrapping. Task 18 (CampaignsListView) still has to pass an `onQuickAction` prop because of the discriminated-union type; it passes a no-op.

## Type consistency walk

Forward type references resolve cleanly:

- `PromotionRow / PopupRow / SubscriberRow / CampaignRow / AbandonedCartRow` are exported by Task 1 (`lib/admin/marketing.ts`) and consumed by Tasks 3, 4, 15-19 via `import type`.
- `PromotionDetailFull / PopupDetailFull / SubscriberDetailFull / CampaignDetailFull / AbandonedCartDetailFull` are exported by both Task 1 (`lib/admin/marketing.ts`) and Task 2 (`app/admin/marketing/actions.ts`) — the latter is the canonical source for client components per the parallel-safety note. Tasks 5-9 (Inspectors), 21-22 (Editors), 15-19 (ListViews) all import from the actions file.
- `MarketingTab` + `isMarketingTab` are exported by Task 1 and consumed by Task 20 (V2 root + tab pills).
- `PopupVariantDetail` and `PopupAnalyticsRollup` are exported by both Task 1 and Task 2; Task 22 (PopupEditor) imports from the actions file.
- `AbandonedCartItem` is exported by both Task 1 and Task 2; Task 9 (Inspector) and Task 19 (ListView orchestrator pass-through) import from the actions file.
- `ActionResult<T>` / `BulkResult` are exported by Task 2 and consumed by all subsequent client components.
- `MarketingListTableProps` (discriminated union) is exported by Task 3 and consumed by Tasks 15-19.
- `MarketingListCardMobileProps` (discriminated union) is exported by Task 4 and consumed by Tasks 15-19.
- Inspector props (`PromotionInspectorProps`, etc.) are exported by Tasks 5-9 and consumed by Tasks 15-19. Per cross-cutting note #7, agents in W5 should re-read the merged Inspector files for the actual prop names and adopt them verbatim; the plan prose is approximate.
- BulkSheet props are exported by Tasks 10-14 and consumed by Tasks 15-19.

## End of plan
