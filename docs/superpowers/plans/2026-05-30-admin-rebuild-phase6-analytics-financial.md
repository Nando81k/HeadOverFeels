# Phase 6: Analytics + Financial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new V2 /admin/analytics umbrella page with 6 tabs (Overview / Sales / Customers / Products / Financial / Expenses), 10 chart components, 4 Inspectors, 4 utility components, ~14 server actions, gated behind NEXT_PUBLIC_ADMIN_V2_ENABLED, with zero schema migrations.

**Architecture:** Server-rendered V2 page composition mirroring Phase 5 pattern (TabPills + URL-persisted range pill row + KPI strip + per-tab Suspense slots). Page dispatcher gates V1 stub vs V2 by env flag. Zero schema work — reuses Expense, ExpenseCategory, Budget, Invoice, TaxRecord, SalesGoals, FinancialSnapshot (previously unused; lazy-backfilled by loadFinancialPeriodGrid). 10 thin Recharts wrappers in components/admin/analytics/charts/ — Recharts already installed v3.6.0 and dynamic-imported in V1. Reuses Phase 2's getRangeBounds + buildTrend helpers from lib/admin/dashboard.ts.

**Tech Stack:** Next.js 16 App Router, React 19 (RSC + Server Actions + Suspense), TypeScript strict, Prisma 6 + Neon, Tailwind v4 (@theme — direct dark colors only, no `dark:` modifiers), Framer Motion, Phosphor icons, Sonner toasts (via `lib/toast.ts`), class-variance-authority, Recharts v3.6.0 (already installed, dynamic-imported), Vitest 4.1.7 + @testing-library/react + jsdom (Phase 1 harness — Recharts mocked via `vi.mock('recharts')`).

---

## Cross-cutting agent notes (read once, applies to every task)

These are hard-won lessons from Phase 3/4/5. Re-read them whenever you start a new task:

1. **No Prisma in the client bundle.** Client components (`'use client'`) must ONLY use `import type` from `lib/admin/analytics.ts`. Any value-import that needs Prisma data goes through a `'use server'` action wrapper in `app/admin/analytics/actions.ts`. The 4 `get*ForInspector` actions are the canonical wrappers — agents must use these from client code, NOT raw loaders. **PR #92 hotfix is the precedent.**
2. **No `dark:` Tailwind modifiers.** V2 admin is always-dark with no `dark` class on `<html>`. Use direct colors like `bg-neutral-900/60`, `border-white/8`, `text-white/50`, `text-white/30`. **PR #93 hotfix is the precedent.**
3. **`PaginatedResult` shape is `{ items, total, page, pageSize }`** — destructure `.items` (NOT `.rows`). All loaders return this shape.
4. **Vitest 4.1.7 generics: use 1-arg `vi.fn<T>()`** (or zero-arg with `mockResolvedValue`). The two-arg `vi.fn<[Args], Return>()` form from Vitest 1.x triggers TS2558.
5. **`requireAdmin()` has two overloads** in `lib/auth/admin.ts`: `requireAdmin(request)` for API routes (returns customer object) and `requireAdmin()` no-arg for server actions (returns userId string). Use no-arg in actions. `requireAdminRole('SUPER_ADMIN')` for `deleteExpense` (financial-mutation gate).
6. **Wave 1 parallel-safe inline queries.** Wave 1 has data layer (Task 1) + server actions (Task 2) running in parallel. Task 2's `get*ForInspector` wrappers MUST inline their Prisma queries (don't import from `lib/admin/analytics.ts` which is being built simultaneously in Task 1). Phase 4/5 W1 precedents. Refactor deferred to Phase 6.5.
7. **Wave 4 Tab agents adopt verified prop shapes** from merged W2 + W3 PRs, not the plan prose. Phase 4/5 Wave 5 precedents — agents shipped different prop names than the plan prose; tests-as-source-of-truth pattern worked. Read the merged chart, Inspector and utility component prop signatures and adopt them verbatim; the plan prose is approximate.
8. **Recharts mocked in tests** via `vi.mock('recharts')` returning bare divs (jsdom doesn't support canvas). EVERY chart component test (W2) MUST start with the mock. Use this exact pattern:

```ts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  ScatterChart: ({ children }: { children: React.ReactNode }) => <div data-testid="scatter-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  Bar: () => <div data-testid="bar" />,
  Area: () => <div data-testid="area" />,
  Pie: () => <div data-testid="pie" />,
  Scatter: () => <div data-testid="scatter" />,
  Cell: () => <div data-testid="cell" />,
  XAxis: () => null,
  YAxis: () => null,
  ZAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}))
```

Trim the mock to just the primitives each chart imports (keeps tests focused).

---

## Wave summary

| Wave | Tasks | Parallel? | Model | Depends on |
|------|-------|-----------|-------|------------|
| W1   | 1, 2 | 2 parallel | sonnet | none (no schema work) |
| W2   | 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 | 10 parallel | sonnet | W1 |
| W3   | 13, 14, 15, 16, 17, 18, 19, 20 | 8 parallel | sonnet | W1 |
| W4   | 21, 22, 23, 24, 25, 26 | 6 parallel | sonnet | W2 + W3 |
| W5   | 27 | sequential | **opus** | W4 |
| W6   | 28 | sequential | sonnet | W5 |

Total: **28 tasks** across **6 waves**. Branch naming: `wave6p6/task-N-<short-name>`.

---

## Wave 1 — Data layer + server actions (2 parallel)

### Task 1: `lib/admin/analytics.ts` data layer

**Wave:** 1 | **Parallel-safe with:** Task 2 | **Branch:** `wave6p6/task-1-data-layer` | **Model:** sonnet

**Schema realities for this task:**
- `Expense.amount` is Float; `Expense.date` is DateTime; `Expense.categoryId` FK → `ExpenseCategory`; `Expense.status` is `ExpenseStatus` enum (`RECORDED | PENDING_APPROVAL | APPROVED | REJECTED | PAID`); `Expense.isTaxDeductible` defaults false; `Expense.invoiceId` is nullable FK.
- `ExpenseCategory` is a relational table — load via `prisma.expenseCategory.findMany({ where: { isActive: true } })`. It already has 11 seeded categories — do NOT confuse with V1's local TS enum.
- `FinancialSnapshot` is currently unused. `loadFinancialPeriodGrid` lazy-backfills missing rows by reading Orders + Expenses + ProductVariant.costPrice and `upsert`-ing into `(date, periodType)` (unique pair). Batch with `Promise.allSettled` so a single failure doesn't block the response.
- `SalesGoals` is a SINGLETON with `id = "default"`; defaults to `dailyTarget=500 weeklyTarget=3500 monthlyTarget=15000 quarterlyTarget=45000 yearlyTarget=180000`.
- `SalesGoalHistory.period` is a String literal — `"daily" | "weekly" | "monthly" | "quarterly" | "yearly"` — NOT an enum.
- `TaxRecord.period` is `TaxPeriod` enum: `MONTHLY | QUARTERLY | YEARLY`.
- `Order` financial fields: `subtotal`, `shipping`, `tax`, `total`, `discount`, `paymentStatus`. Orders considered "real revenue" use `status IN ('CONFIRMED', 'SHIPPED', 'DELIVERED')` (Phase 2 precedent in `lib/admin/dashboard.ts`).
- Gross margin = sum(OrderItem.price × quantity) − sum(OrderItem.quantity × (variant.costPrice ?? product.costPrice ?? 0)). When both costs are null, treat COGS contribution as 0 (with a `cogsCoveragePct` field surfaced so the UI can warn).
- `Customer` cohort fields: `createdAt`, `loyaltyTierId`, `totalSpent`, `totalOrders`, `avgOrderValue`, `lastOrderDate`.
- **`TimeRange` differs from Phase 2.** Phase 2's `lib/admin/dashboard.ts` exports `TimeRange = 'today' | 'week' | 'month' | 'year'`. Phase 6's spec calls for `'today' | '7d' | '30d' | '90d' | 'year'`. Define a NEW `TimeRange` in `lib/admin/analytics.ts` and a local `getRangeBounds` shim that maps the new range names to the same `{ start, end, previousStart, previousEnd }` shape as Phase 2's helper. **Do not modify `lib/admin/dashboard.ts`** — Phase 2's dashboard still uses its own names.

**Files:**
- Create: `lib/admin/analytics.ts`
- Test: `tests/unit/lib/admin/analytics.test.ts`

#### Steps

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/lib/admin/analytics.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const orderAggregate = vi.fn()
const orderFindMany = vi.fn()
const orderCount = vi.fn()
const orderGroupBy = vi.fn()
const customerCount = vi.fn()
const customerFindMany = vi.fn()
const customerFindUnique = vi.fn()
const productFindMany = vi.fn()
const productFindUnique = vi.fn()
const orderItemAggregate = vi.fn()
const orderItemFindMany = vi.fn()
const expenseAggregate = vi.fn()
const expenseFindMany = vi.fn()
const expenseCount = vi.fn()
const expenseFindUnique = vi.fn()
const expenseGroupBy = vi.fn()
const expenseCategoryFindMany = vi.fn()
const taxRecordFindMany = vi.fn()
const snapshotFindMany = vi.fn()
const snapshotUpsert = vi.fn()
const salesGoalsFindUnique = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      aggregate: orderAggregate,
      findMany: orderFindMany,
      count: orderCount,
      groupBy: orderGroupBy,
    },
    customer: {
      count: customerCount,
      findMany: customerFindMany,
      findUnique: customerFindUnique,
    },
    product: {
      findMany: productFindMany,
      findUnique: productFindUnique,
    },
    orderItem: {
      aggregate: orderItemAggregate,
      findMany: orderItemFindMany,
    },
    expense: {
      aggregate: expenseAggregate,
      findMany: expenseFindMany,
      count: expenseCount,
      findUnique: expenseFindUnique,
      groupBy: expenseGroupBy,
    },
    expenseCategory: { findMany: expenseCategoryFindMany },
    taxRecord: { findMany: taxRecordFindMany },
    financialSnapshot: {
      findMany: snapshotFindMany,
      upsert: snapshotUpsert,
    },
    salesGoals: { findUnique: salesGoalsFindUnique },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getRangeBounds (analytics)', () => {
  it('maps 7d to a 7-day window with previous-period shift', async () => {
    const { getRangeBounds } = await import('@/lib/admin/analytics')
    const ref = new Date('2026-05-31T12:00:00Z')
    const b = getRangeBounds('7d', ref)
    const dayMs = 24 * 60 * 60 * 1000
    expect(b.end.getTime() - b.start.getTime()).toBe(7 * dayMs)
    expect(b.previousEnd.getTime()).toBe(b.end.getTime() - 7 * dayMs)
  })

  it('maps 30d, 90d, year to 30/90/365 day windows', async () => {
    const { getRangeBounds } = await import('@/lib/admin/analytics')
    const ref = new Date('2026-05-31T12:00:00Z')
    const dayMs = 24 * 60 * 60 * 1000
    expect(getRangeBounds('30d', ref).end.getTime() - getRangeBounds('30d', ref).start.getTime()).toBe(30 * dayMs)
    expect(getRangeBounds('90d', ref).end.getTime() - getRangeBounds('90d', ref).start.getTime()).toBe(90 * dayMs)
    expect(getRangeBounds('year', ref).end.getTime() - getRangeBounds('year', ref).start.getTime()).toBe(365 * dayMs)
  })

  it('today snaps start to UTC midnight', async () => {
    const { getRangeBounds } = await import('@/lib/admin/analytics')
    const ref = new Date('2026-05-31T18:00:00Z')
    const b = getRangeBounds('today', ref)
    expect(b.start.toISOString()).toBe('2026-05-31T00:00:00.000Z')
  })
})

describe('loadAnalyticsKpis', () => {
  it('returns revenue, orders, AOV, gross margin with trends', async () => {
    // Current period
    orderAggregate
      .mockResolvedValueOnce({ _sum: { total: 10000 }, _count: { _all: 100 } }) // current
      .mockResolvedValueOnce({ _sum: { total: 8000 }, _count: { _all: 80 } })   // previous
    // Current + previous OrderItems for gross-margin
    orderItemFindMany
      .mockResolvedValueOnce([
        { quantity: 2, price: 50, variant: { costPrice: 20, product: { costPrice: null } } },
      ])
      .mockResolvedValueOnce([
        { quantity: 1, price: 50, variant: { costPrice: 25, product: { costPrice: null } } },
      ])

    const { loadAnalyticsKpis } = await import('@/lib/admin/analytics')
    const k = await loadAnalyticsKpis('30d')
    expect(k.revenue).toBe(10000)
    expect(k.orders).toBe(100)
    expect(k.aov).toBe(100)
    expect(k.grossMarginPct).toBeGreaterThan(0)
    expect(k.revenueTrend.direction).toBe('up')
    expect(k.ordersTrend.direction).toBe('up')
  })

  it('handles zero previous values without dividing by zero', async () => {
    orderAggregate
      .mockResolvedValueOnce({ _sum: { total: 100 }, _count: { _all: 1 } })
      .mockResolvedValueOnce({ _sum: { total: 0 }, _count: { _all: 0 } })
    orderItemFindMany.mockResolvedValue([])
    const { loadAnalyticsKpis } = await import('@/lib/admin/analytics')
    const k = await loadAnalyticsKpis('30d')
    expect(k.revenueTrend.direction).toBe('flat')
    expect(Number.isFinite(k.aov)).toBe(true)
  })
})

describe('loadOverviewData', () => {
  it('returns trend buckets, top products, status donut, goals', async () => {
    orderFindMany.mockResolvedValue([
      { id: 'o1', total: 100, createdAt: new Date('2026-05-30'), status: 'DELIVERED', items: [] },
    ])
    orderGroupBy.mockResolvedValue([{ status: 'DELIVERED', _count: { _all: 1 } }])
    customerCount.mockResolvedValue(5).mockResolvedValueOnce(5).mockResolvedValueOnce(2)
    orderItemFindMany.mockResolvedValue([])
    salesGoalsFindUnique.mockResolvedValue({
      id: 'default', dailyTarget: 500, weeklyTarget: 3500, monthlyTarget: 15000,
      quarterlyTarget: 45000, yearlyTarget: 180000, updatedAt: new Date(),
    })
    const { loadOverviewData } = await import('@/lib/admin/analytics')
    const d = await loadOverviewData('30d')
    expect(d.revenueTrend.length).toBeGreaterThan(0)
    expect(d.statusDonut.length).toBeGreaterThan(0)
    expect(d.goals.dailyTarget).toBe(500)
  })
})

describe('loadSalesData', () => {
  it('returns sales trend + top products', async () => {
    orderFindMany.mockResolvedValue([])
    orderItemFindMany.mockResolvedValue([])
    const { loadSalesData } = await import('@/lib/admin/analytics')
    const d = await loadSalesData('30d')
    expect(d.revenueTrend).toEqual([])
    expect(d.topProducts).toEqual([])
  })
})

describe('loadCustomersData', () => {
  it('returns acquisition trend + cohort + LTV scatter + paginated table', async () => {
    customerFindMany.mockResolvedValue([
      { id: 'c1', email: 'a@e.com', name: 'A', createdAt: new Date('2026-05-30'),
        totalSpent: 100, totalOrders: 1, avgOrderValue: 100, lastOrderDate: new Date('2026-05-30'),
        loyaltyTier: null },
    ])
    customerCount.mockResolvedValue(1)
    orderFindMany.mockResolvedValue([])
    const { loadCustomersData } = await import('@/lib/admin/analytics')
    const d = await loadCustomersData('30d')
    expect(d.acquisitionTrend.length).toBeGreaterThan(0)
    expect(d.cohort.length).toBeGreaterThan(0)
    expect(d.table.items).toHaveLength(1)
    expect(d.table.items[0].email).toBe('a@e.com')
  })
})

describe('loadProductsData', () => {
  it('returns top products + margin scatter + paginated product table', async () => {
    orderItemFindMany.mockResolvedValue([])
    productFindMany.mockResolvedValue([
      { id: 'p1', name: 'Tee', images: '[]', costPrice: 5, basePrice: 25,
        variants: [{ id: 'v1', costPrice: 5, inventory: 10 }] },
    ])
    const { loadProductsData } = await import('@/lib/admin/analytics')
    const d = await loadProductsData('30d')
    expect(d.topProducts).toEqual([])
    expect(d.marginScatter.length).toBeGreaterThan(0)
    expect(d.table.items.length).toBeGreaterThan(0)
  })
})

describe('loadFinancialData', () => {
  it('returns revenue/expense trend + margin trend + tax summary', async () => {
    orderFindMany.mockResolvedValue([])
    expenseFindMany.mockResolvedValue([])
    orderItemFindMany.mockResolvedValue([])
    taxRecordFindMany.mockResolvedValue([
      { id: 't1', period: 'QUARTERLY', year: 2026, quarter: 1, grossRevenue: 10000,
        taxableRevenue: 9000, salesTaxCollected: 800, netIncome: 4000,
        estimatedTaxLiability: 1000, status: 'CALCULATED' },
    ])
    const { loadFinancialData } = await import('@/lib/admin/analytics')
    const d = await loadFinancialData('30d')
    expect(d.revenueExpenseTrend).toEqual([])
    expect(d.marginTrend).toEqual([])
    expect(d.taxSummary).toHaveLength(1)
  })
})

describe('loadExpensesData', () => {
  it('returns category breakdown + monthly bars + paginated table', async () => {
    expenseGroupBy.mockResolvedValue([
      { categoryId: 'cat1', _sum: { amount: 500 } },
    ])
    expenseCategoryFindMany.mockResolvedValue([
      { id: 'cat1', name: 'Marketing', slug: 'marketing', color: '#FF3131', icon: null, isActive: true },
    ])
    expenseFindMany.mockResolvedValue([
      { id: 'e1', amount: 100, date: new Date('2026-05-15'), description: 'FB ads',
        vendor: 'Meta', category: { id: 'cat1', name: 'Marketing', color: '#FF3131' },
        isTaxDeductible: true, status: 'PAID', paymentMethod: 'card' },
    ])
    expenseCount.mockResolvedValue(1)
    const { loadExpensesData } = await import('@/lib/admin/analytics')
    const d = await loadExpensesData('30d')
    expect(d.categoryBreakdown).toHaveLength(1)
    expect(d.categoryBreakdown[0].categoryName).toBe('Marketing')
    expect(d.monthlyBars.length).toBeGreaterThan(0)
    expect(d.table.items[0].description).toBe('FB ads')
  })

  it('filters by categoryId when provided', async () => {
    expenseGroupBy.mockResolvedValue([])
    expenseCategoryFindMany.mockResolvedValue([])
    expenseFindMany.mockResolvedValue([])
    expenseCount.mockResolvedValue(0)
    const { loadExpensesData } = await import('@/lib/admin/analytics')
    await loadExpensesData('30d', { categoryId: 'cat-x' })
    expect(expenseFindMany.mock.calls[0][0].where.categoryId).toBe('cat-x')
  })
})

describe('loadExpenseDetail', () => {
  it('returns null when not found', async () => {
    expenseFindUnique.mockResolvedValue(null)
    const { loadExpenseDetail } = await import('@/lib/admin/analytics')
    expect(await loadExpenseDetail('missing')).toBeNull()
  })

  it('returns full detail with category', async () => {
    expenseFindUnique.mockResolvedValue({
      id: 'e1', amount: 100, date: new Date('2026-05-15'), description: 'FB ads',
      vendor: 'Meta', receiptUrl: null, notes: null, isTaxDeductible: true,
      taxCategory: null, paymentMethod: 'card', isRecurring: false,
      recurringFrequency: null, status: 'PAID', categoryId: 'cat1', invoiceId: null,
      category: { id: 'cat1', name: 'Marketing', slug: 'marketing', color: '#FF3131', icon: null },
      createdAt: new Date(), updatedAt: new Date(),
    })
    const { loadExpenseDetail } = await import('@/lib/admin/analytics')
    const d = await loadExpenseDetail('e1')
    expect(d?.id).toBe('e1')
    expect(d?.category.name).toBe('Marketing')
  })
})

describe('loadCustomerDetail', () => {
  it('returns full customer summary', async () => {
    customerFindUnique.mockResolvedValue({
      id: 'c1', email: 'a@e.com', name: 'A', createdAt: new Date('2026-05-01'),
      totalSpent: 200, totalOrders: 3, avgOrderValue: 67, lastOrderDate: new Date('2026-05-20'),
      loyaltyTier: { id: 'gold', name: 'Gold' },
    })
    const { loadCustomerDetail } = await import('@/lib/admin/analytics')
    const d = await loadCustomerDetail('c1')
    expect(d?.email).toBe('a@e.com')
    expect(d?.loyaltyTierName).toBe('Gold')
  })
})

describe('loadProductFinancialDetail', () => {
  it('returns top-seller summary for range', async () => {
    productFindUnique.mockResolvedValue({
      id: 'p1', name: 'Tee', images: '["/img.png"]', basePrice: 25, costPrice: 5,
      variants: [{ id: 'v1', costPrice: 5 }],
    })
    orderItemAggregate.mockResolvedValue({
      _sum: { quantity: 12 },
    })
    orderItemFindMany.mockResolvedValue([
      { quantity: 12, price: 25, variant: { costPrice: 5, product: { costPrice: 5 } } },
    ])
    const { loadProductFinancialDetail } = await import('@/lib/admin/analytics')
    const d = await loadProductFinancialDetail('p1', '30d')
    expect(d?.name).toBe('Tee')
    expect(d?.unitsSold).toBe(12)
    expect(d?.revenue).toBe(300)
    expect(d?.cost).toBe(60)
    expect(d?.grossMargin).toBe(240)
  })
})

describe('loadFinancialPeriodGrid', () => {
  it('returns existing snapshots when present and lazy-backfills missing months', async () => {
    snapshotFindMany.mockResolvedValue([
      { id: 's1', date: new Date('2026-04-01'), periodType: 'monthly',
        totalRevenue: 10000, totalOrders: 100, avgOrderValue: 100, totalCOGS: 4000,
        totalExpenses: 2000, grossProfit: 6000, grossMargin: 60, netProfit: 4000,
        netMargin: 40, salesTaxCollected: 800, inventoryValue: 0, cashOnHand: null,
        createdAt: new Date() },
    ])
    // Backfill path: when invoked, succeeds
    snapshotUpsert.mockResolvedValue({})
    orderAggregate.mockResolvedValue({ _sum: { total: 0, tax: 0 }, _count: { _all: 0 } })
    orderItemFindMany.mockResolvedValue([])
    expenseAggregate.mockResolvedValue({ _sum: { amount: 0 } })

    const { loadFinancialPeriodGrid } = await import('@/lib/admin/analytics')
    const g = await loadFinancialPeriodGrid('monthly', 12)
    expect(g.length).toBeGreaterThan(0)
  })

  it('tolerates upsert failures (logs and continues)', async () => {
    snapshotFindMany.mockResolvedValue([])
    snapshotUpsert.mockRejectedValue(new Error('db down'))
    orderAggregate.mockResolvedValue({ _sum: { total: 0, tax: 0 }, _count: { _all: 0 } })
    orderItemFindMany.mockResolvedValue([])
    expenseAggregate.mockResolvedValue({ _sum: { amount: 0 } })
    const { loadFinancialPeriodGrid } = await import('@/lib/admin/analytics')
    const g = await loadFinancialPeriodGrid('monthly', 3)
    // Should not throw
    expect(Array.isArray(g)).toBe(true)
  })
})

describe('loadSalesGoalsForInspector', () => {
  it('returns defaults when no row exists', async () => {
    salesGoalsFindUnique.mockResolvedValue(null)
    const { loadSalesGoalsForInspector } = await import('@/lib/admin/analytics')
    const g = await loadSalesGoalsForInspector()
    expect(g.dailyTarget).toBe(500)
    expect(g.monthlyTarget).toBe(15000)
  })

  it('returns existing singleton', async () => {
    salesGoalsFindUnique.mockResolvedValue({
      id: 'default', dailyTarget: 750, weeklyTarget: 5000, monthlyTarget: 20000,
      quarterlyTarget: 60000, yearlyTarget: 240000, updatedAt: new Date('2026-05-01'),
    })
    const { loadSalesGoalsForInspector } = await import('@/lib/admin/analytics')
    const g = await loadSalesGoalsForInspector()
    expect(g.dailyTarget).toBe(750)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/admin/analytics.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/admin/analytics.ts`**

```ts
// lib/admin/analytics.ts
//
// Single source of truth for Phase 6 analytics + financial data shapes and Prisma queries.
// All loaders are pure async functions called from Server Components.
//
// Schema adaptations:
//   - TimeRange is Phase 6 specific: 'today' | '7d' | '30d' | '90d' | 'year'
//     (Phase 2's lib/admin/dashboard.ts uses different names — do not import its TimeRange.)
//   - FinancialSnapshot was unused before Phase 6; loadFinancialPeriodGrid lazy-backfills.
//   - Gross margin: variant.costPrice falls back to product.costPrice falls back to 0.

import { prisma } from '@/lib/prisma'
import type { ExpenseStatus, TaxPeriod, TaxRecordStatus } from '@prisma/client'

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
// Pagination + filters
// ============================================================

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

const DEFAULT_PAGE_SIZE = 25

export interface ExpenseFilters {
  search?: string
  categoryId?: string
  status?: ExpenseStatus
  isTaxDeductible?: boolean
  page?: number
  pageSize?: number
}

// ============================================================
// Trend type + helper
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
// Row + chart point shapes
// ============================================================

export interface TrendPoint {
  bucket: string // ISO date
  value: number
}

export interface DualTrendPoint {
  bucket: string
  revenue: number
  expenses: number
}

export interface AcquisitionPoint {
  bucket: string
  newCustomers: number
  returningCustomers: number
}

export interface StatusDonutSlice {
  status: string
  count: number
}

export interface TopProductPoint {
  productId: string
  name: string
  unitsSold: number
  revenue: number
}

export interface MarginScatterPoint {
  productId: string
  name: string
  price: number
  marginPct: number
  unitsSold: number
}

export interface CategoryBreakdownSlice {
  categoryId: string
  categoryName: string
  color: string
  amount: number
}

export interface MonthlyExpenseBar {
  month: string // YYYY-MM
  amount: number
}

export interface CohortCell {
  signupMonth: string // YYYY-MM
  orderBucket: '1' | '2-3' | '4-5' | '6+'
  count: number
}

// ============================================================
// KPI shape
// ============================================================

export interface AnalyticsKpiData {
  revenue: number
  revenueTrend: TrendData
  orders: number
  ordersTrend: TrendData
  aov: number
  aovTrend: TrendData
  grossMarginPct: number
  marginTrend: TrendData
}

// ============================================================
// Tab data shapes
// ============================================================

export interface SalesGoalsRow {
  id: string
  dailyTarget: number
  weeklyTarget: number
  monthlyTarget: number
  quarterlyTarget: number
  yearlyTarget: number
  updatedAt: Date
}

export interface OverviewData {
  revenueTrend: TrendPoint[]
  ordersTrend: TrendPoint[]
  acquisitionTrend: AcquisitionPoint[]
  statusDonut: StatusDonutSlice[]
  goals: SalesGoalsRow
}

export interface SalesData {
  revenueTrend: TrendPoint[]
  topProducts: TopProductPoint[]
}

export interface CustomerTableRow {
  id: string
  email: string
  name: string | null
  createdAt: Date
  totalSpent: number
  totalOrders: number
  avgOrderValue: number
  lastOrderDate: Date | null
  loyaltyTierName: string | null
}

export interface CustomersData {
  acquisitionTrend: AcquisitionPoint[]
  cohort: CohortCell[]
  ltvScatter: MarginScatterPoint[] // reuse scatter shape (totalSpent × orderCount mapping)
  table: PaginatedResult<CustomerTableRow>
}

export interface ProductTableRow {
  id: string
  name: string
  unitsSold: number
  revenue: number
  cost: number
  grossMargin: number
  marginPct: number
  imageUrl: string | null
}

export interface ProductsData {
  topProducts: TopProductPoint[]
  marginScatter: MarginScatterPoint[]
  table: PaginatedResult<ProductTableRow>
}

export interface TaxSummaryRow {
  id: string
  period: TaxPeriod
  year: number
  quarter: number | null
  month: number | null
  grossRevenue: number
  salesTaxCollected: number
  netIncome: number
  estimatedTaxLiability: number
  status: TaxRecordStatus
}

export interface FinancialSnapshotRow {
  id: string
  date: Date
  periodType: string
  totalRevenue: number
  totalOrders: number
  avgOrderValue: number
  totalCOGS: number
  totalExpenses: number
  grossProfit: number
  grossMargin: number
  netProfit: number
  netMargin: number
  salesTaxCollected: number
  inventoryValue: number
  cashOnHand: number | null
}

export interface FinancialData {
  revenueExpenseTrend: DualTrendPoint[]
  marginTrend: TrendPoint[]
  taxSummary: TaxSummaryRow[]
  periodGrid: FinancialSnapshotRow[]
}

export interface ExpenseTableRow {
  id: string
  amount: number
  date: Date
  description: string
  vendor: string | null
  categoryId: string
  categoryName: string
  categoryColor: string
  isTaxDeductible: boolean
  status: ExpenseStatus
  paymentMethod: string | null
}

export interface ExpensesData {
  categoryBreakdown: CategoryBreakdownSlice[]
  monthlyBars: MonthlyExpenseBar[]
  table: PaginatedResult<ExpenseTableRow>
}

// ============================================================
// Detail shapes
// ============================================================

export interface ExpenseDetailFull {
  id: string
  amount: number
  date: Date
  description: string
  vendor: string | null
  receiptUrl: string | null
  notes: string | null
  isTaxDeductible: boolean
  taxCategory: string | null
  paymentMethod: string | null
  isRecurring: boolean
  recurringFrequency: string | null
  status: ExpenseStatus
  invoiceId: string | null
  category: {
    id: string
    name: string
    slug: string
    color: string
    icon: string | null
  }
  createdAt: Date
  updatedAt: Date
}

export interface CustomerDetailFull {
  id: string
  email: string
  name: string | null
  createdAt: Date
  totalSpent: number
  totalOrders: number
  avgOrderValue: number
  lastOrderDate: Date | null
  loyaltyTierName: string | null
}

export interface ProductFinancialDetailFull {
  id: string
  name: string
  imageUrl: string | null
  basePrice: number
  unitsSold: number
  revenue: number
  cost: number
  grossMargin: number
  marginPct: number
  rangeStart: Date
  rangeEnd: Date
}

// ============================================================
// Helpers
// ============================================================

const REVENUE_STATUSES = ['CONFIRMED', 'SHIPPED', 'DELIVERED'] as const

function startOfDay(d: Date): Date {
  const n = new Date(d)
  n.setUTCHours(0, 0, 0, 0)
  return n
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function isoMonth(d: Date): string {
  return d.toISOString().slice(0, 7)
}

function safeFirstImage(images: string | null | undefined): string | null {
  if (!images) return null
  try {
    const arr = JSON.parse(images)
    if (Array.isArray(arr) && arr.length > 0) return String(arr[0])
    return null
  } catch {
    return null
  }
}

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

export async function loadAnalyticsKpis(range: TimeRange): Promise<AnalyticsKpiData> {
  const { start, end, previousStart, previousEnd } = getRangeBounds(range)

  const [curOrders, prevOrders, curItems, prevItems] = await Promise.all([
    prisma.order.aggregate({
      where: { status: { in: [...REVENUE_STATUSES] }, createdAt: { gte: start, lte: end } },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where: { status: { in: [...REVENUE_STATUSES] }, createdAt: { gte: previousStart, lte: previousEnd } },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.orderItem.findMany({
      where: {
        order: { status: { in: [...REVENUE_STATUSES] }, createdAt: { gte: start, lte: end } },
      },
      select: {
        quantity: true,
        price: true,
        variant: { select: { costPrice: true, product: { select: { costPrice: true } } } },
      },
    }),
    prisma.orderItem.findMany({
      where: {
        order: { status: { in: [...REVENUE_STATUSES] }, createdAt: { gte: previousStart, lte: previousEnd } },
      },
      select: {
        quantity: true,
        price: true,
        variant: { select: { costPrice: true, product: { select: { costPrice: true } } } },
      },
    }),
  ])

  const revenue = Number(curOrders._sum.total ?? 0)
  const prevRevenue = Number(prevOrders._sum.total ?? 0)
  const orders = curOrders._count._all
  const prevOrdersCount = prevOrders._count._all
  const aov = orders > 0 ? revenue / orders : 0
  const prevAov = prevOrdersCount > 0 ? prevRevenue / prevOrdersCount : 0

  const margin = (items: typeof curItems) => {
    let rev = 0, cost = 0
    for (const i of items) {
      const cp = Number(i.variant?.costPrice ?? i.variant?.product?.costPrice ?? 0)
      rev += Number(i.price) * i.quantity
      cost += cp * i.quantity
    }
    return rev === 0 ? 0 : ((rev - cost) / rev) * 100
  }
  const grossMarginPct = margin(curItems)
  const prevMarginPct = margin(prevItems)

  return {
    revenue,
    revenueTrend: buildTrend(revenue, prevRevenue),
    orders,
    ordersTrend: buildTrend(orders, prevOrdersCount),
    aov,
    aovTrend: buildTrend(aov, prevAov),
    grossMarginPct,
    marginTrend: buildTrend(grossMarginPct, prevMarginPct),
  }
}

// ============================================================
// Tab: Overview
// ============================================================

export async function loadOverviewData(range: TimeRange): Promise<OverviewData> {
  const { start, end, previousStart, previousEnd } = getRangeBounds(range)
  const buckets = bucketCount(range)

  const [orders, statusGroups, goals, newCustomers, returningCustomers] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: [...REVENUE_STATUSES] }, createdAt: { gte: start, lte: end } },
      select: { id: true, total: true, createdAt: true, customerId: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.order.groupBy({
      by: ['status'],
      where: { createdAt: { gte: start, lte: end } },
      _count: { _all: true },
    }),
    prisma.salesGoals.findUnique({ where: { id: 'default' } }),
    prisma.customer.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { id: true, createdAt: true },
    }),
    prisma.customer.findMany({
      where: { createdAt: { lt: start }, lastOrderDate: { gte: start, lte: end } },
      select: { id: true, lastOrderDate: true },
    }),
  ])

  const revBuckets: TrendPoint[] = []
  const orderBuckets: TrendPoint[] = []
  const acqBuckets: AcquisitionPoint[] = []
  const span = end.getTime() - start.getTime()
  for (let i = 0; i < buckets; i++) {
    const bStart = new Date(start.getTime() + (i * span) / buckets)
    revBuckets.push({ bucket: bStart.toISOString(), value: 0 })
    orderBuckets.push({ bucket: bStart.toISOString(), value: 0 })
    acqBuckets.push({ bucket: bStart.toISOString(), newCustomers: 0, returningCustomers: 0 })
  }
  for (const o of orders) {
    const idx = Math.min(buckets - 1, Math.max(0, Math.floor(((o.createdAt.getTime() - start.getTime()) / span) * buckets)))
    revBuckets[idx].value += Number(o.total)
    orderBuckets[idx].value += 1
  }
  for (const c of newCustomers) {
    const idx = Math.min(buckets - 1, Math.max(0, Math.floor(((c.createdAt.getTime() - start.getTime()) / span) * buckets)))
    acqBuckets[idx].newCustomers += 1
  }
  for (const c of returningCustomers) {
    if (!c.lastOrderDate) continue
    const idx = Math.min(buckets - 1, Math.max(0, Math.floor(((c.lastOrderDate.getTime() - start.getTime()) / span) * buckets)))
    acqBuckets[idx].returningCustomers += 1
  }

  const statusDonut: StatusDonutSlice[] = statusGroups.map((g) => ({
    status: g.status,
    count: g._count._all,
  }))

  const goalsRow: SalesGoalsRow = goals ?? {
    id: 'default',
    dailyTarget: 500,
    weeklyTarget: 3500,
    monthlyTarget: 15000,
    quarterlyTarget: 45000,
    yearlyTarget: 180000,
    updatedAt: new Date(0),
  }

  // Silence unused locals when previous range not needed in Overview
  void previousStart; void previousEnd

  return {
    revenueTrend: revBuckets,
    ordersTrend: orderBuckets,
    acquisitionTrend: acqBuckets,
    statusDonut,
    goals: goalsRow,
  }
}

// ============================================================
// Tab: Sales
// ============================================================

export async function loadSalesData(range: TimeRange): Promise<SalesData> {
  const { start, end } = getRangeBounds(range)
  const buckets = bucketCount(range)

  const [orders, items] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: [...REVENUE_STATUSES] }, createdAt: { gte: start, lte: end } },
      select: { id: true, total: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.orderItem.findMany({
      where: {
        order: { status: { in: [...REVENUE_STATUSES] }, createdAt: { gte: start, lte: end } },
      },
      select: {
        quantity: true,
        price: true,
        product: { select: { id: true, name: true } },
      },
    }),
  ])

  const revBuckets: TrendPoint[] = []
  const span = end.getTime() - start.getTime()
  for (let i = 0; i < buckets; i++) {
    const bStart = new Date(start.getTime() + (i * span) / buckets)
    revBuckets.push({ bucket: bStart.toISOString(), value: 0 })
  }
  for (const o of orders) {
    const idx = Math.min(buckets - 1, Math.max(0, Math.floor(((o.createdAt.getTime() - start.getTime()) / span) * buckets)))
    revBuckets[idx].value += Number(o.total)
  }

  const byProduct = new Map<string, TopProductPoint>()
  for (const i of items) {
    const id = i.product?.id ?? 'unknown'
    const name = i.product?.name ?? 'Unknown product'
    const prev = byProduct.get(id) ?? { productId: id, name, unitsSold: 0, revenue: 0 }
    prev.unitsSold += i.quantity
    prev.revenue += Number(i.price) * i.quantity
    byProduct.set(id, prev)
  }
  const topProducts = Array.from(byProduct.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  return { revenueTrend: revBuckets, topProducts }
}

// ============================================================
// Tab: Customers
// ============================================================

export async function loadCustomersData(
  range: TimeRange,
  filters: { page?: number; pageSize?: number } = {},
): Promise<CustomersData> {
  const { start, end } = getRangeBounds(range)
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  const cohortStart = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000)
  const cohortStartMonth = startOfDay(new Date(cohortStart.getFullYear(), cohortStart.getMonth(), 1))

  const [customers, total, allForCohort, newCustomers, returningOrders] = await Promise.all([
    prisma.customer.findMany({
      where: {},
      orderBy: { totalSpent: 'desc' },
      skip, take: pageSize,
      select: {
        id: true, email: true, name: true, createdAt: true,
        totalSpent: true, totalOrders: true, avgOrderValue: true, lastOrderDate: true,
        loyaltyTier: { select: { name: true } },
      },
    }),
    prisma.customer.count(),
    prisma.customer.findMany({
      where: { createdAt: { gte: cohortStartMonth } },
      select: { id: true, createdAt: true, totalOrders: true },
    }),
    prisma.customer.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { id: true, createdAt: true },
    }),
    prisma.customer.findMany({
      where: { createdAt: { lt: start }, lastOrderDate: { gte: start, lte: end } },
      select: { id: true, lastOrderDate: true, totalSpent: true, totalOrders: true },
    }),
  ])

  const buckets = bucketCount(range)
  const span = end.getTime() - start.getTime()
  const acqBuckets: AcquisitionPoint[] = []
  for (let i = 0; i < buckets; i++) {
    const bStart = new Date(start.getTime() + (i * span) / buckets)
    acqBuckets.push({ bucket: bStart.toISOString(), newCustomers: 0, returningCustomers: 0 })
  }
  for (const c of newCustomers) {
    const idx = Math.min(buckets - 1, Math.max(0, Math.floor(((c.createdAt.getTime() - start.getTime()) / span) * buckets)))
    acqBuckets[idx].newCustomers += 1
  }
  for (const c of returningOrders) {
    if (!c.lastOrderDate) continue
    const idx = Math.min(buckets - 1, Math.max(0, Math.floor(((c.lastOrderDate.getTime() - start.getTime()) / span) * buckets)))
    acqBuckets[idx].returningCustomers += 1
  }

  const bucketize = (orders: number): CohortCell['orderBucket'] => {
    if (orders <= 1) return '1'
    if (orders <= 3) return '2-3'
    if (orders <= 5) return '4-5'
    return '6+'
  }
  const cohortMap = new Map<string, CohortCell>()
  for (const c of allForCohort) {
    const month = isoMonth(c.createdAt)
    const ob = bucketize(c.totalOrders ?? 0)
    const key = `${month}::${ob}`
    const cur = cohortMap.get(key) ?? { signupMonth: month, orderBucket: ob, count: 0 }
    cur.count += 1
    cohortMap.set(key, cur)
  }
  const cohort = Array.from(cohortMap.values())

  const ltvScatter: MarginScatterPoint[] = customers.map((c) => ({
    productId: c.id,
    name: c.email,
    price: Number(c.totalSpent ?? 0),
    marginPct: c.totalOrders ?? 0,
    unitsSold: c.totalOrders ?? 0,
  }))

  return {
    acquisitionTrend: acqBuckets,
    cohort,
    ltvScatter,
    table: {
      items: customers.map((c) => ({
        id: c.id,
        email: c.email,
        name: c.name ?? null,
        createdAt: c.createdAt,
        totalSpent: Number(c.totalSpent ?? 0),
        totalOrders: c.totalOrders ?? 0,
        avgOrderValue: Number(c.avgOrderValue ?? 0),
        lastOrderDate: c.lastOrderDate ?? null,
        loyaltyTierName: c.loyaltyTier?.name ?? null,
      })),
      total,
      page,
      pageSize,
    },
  }
}

// ============================================================
// Tab: Products
// ============================================================

export async function loadProductsData(
  range: TimeRange,
  filters: { page?: number; pageSize?: number } = {},
): Promise<ProductsData> {
  const { start, end } = getRangeBounds(range)
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  const [items, products, total] = await Promise.all([
    prisma.orderItem.findMany({
      where: {
        order: { status: { in: [...REVENUE_STATUSES] }, createdAt: { gte: start, lte: end } },
      },
      select: {
        quantity: true,
        price: true,
        product: { select: { id: true, name: true, images: true, basePrice: true, costPrice: true } },
        variant: { select: { costPrice: true } },
      },
    }),
    prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      skip, take: pageSize,
      select: {
        id: true, name: true, images: true, basePrice: true, costPrice: true,
        variants: { select: { id: true, costPrice: true, inventory: true } },
      },
    }),
    prisma.product.count(),
  ])

  const agg = new Map<string, { name: string; units: number; revenue: number; cost: number; price: number }>()
  for (const i of items) {
    const id = i.product?.id ?? 'unknown'
    const name = i.product?.name ?? 'Unknown'
    const cp = Number(i.variant?.costPrice ?? i.product?.costPrice ?? 0)
    const cur = agg.get(id) ?? { name, units: 0, revenue: 0, cost: 0, price: Number(i.price) }
    cur.units += i.quantity
    cur.revenue += Number(i.price) * i.quantity
    cur.cost += cp * i.quantity
    cur.price = Number(i.price)
    agg.set(id, cur)
  }
  const topProducts: TopProductPoint[] = Array.from(agg.entries())
    .map(([id, v]) => ({ productId: id, name: v.name, unitsSold: v.units, revenue: v.revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
  const marginScatter: MarginScatterPoint[] = Array.from(agg.entries()).map(([id, v]) => ({
    productId: id,
    name: v.name,
    price: v.price,
    marginPct: v.revenue === 0 ? 0 : ((v.revenue - v.cost) / v.revenue) * 100,
    unitsSold: v.units,
  }))

  const tableItems: ProductTableRow[] = products.map((p) => {
    const a = agg.get(p.id)
    const cost = a?.cost ?? 0
    const revenue = a?.revenue ?? 0
    const grossMargin = revenue - cost
    return {
      id: p.id,
      name: p.name,
      unitsSold: a?.units ?? 0,
      revenue,
      cost,
      grossMargin,
      marginPct: revenue === 0 ? 0 : (grossMargin / revenue) * 100,
      imageUrl: safeFirstImage(p.images),
    }
  })

  return {
    topProducts,
    marginScatter,
    table: { items: tableItems, total, page, pageSize },
  }
}

// ============================================================
// Tab: Financial
// ============================================================

export async function loadFinancialData(range: TimeRange): Promise<FinancialData> {
  const { start, end } = getRangeBounds(range)
  const buckets = bucketCount(range)

  const [orders, items, expenses, taxRecords, periodGrid] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: [...REVENUE_STATUSES] }, createdAt: { gte: start, lte: end } },
      select: { id: true, total: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.orderItem.findMany({
      where: {
        order: { status: { in: [...REVENUE_STATUSES] }, createdAt: { gte: start, lte: end } },
      },
      select: {
        quantity: true,
        price: true,
        order: { select: { createdAt: true } },
        variant: { select: { costPrice: true, product: { select: { costPrice: true } } } },
      },
    }),
    prisma.expense.findMany({
      where: { date: { gte: start, lte: end } },
      select: { amount: true, date: true },
    }),
    prisma.taxRecord.findMany({
      orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
      take: 4,
    }),
    loadFinancialPeriodGrid('monthly', 12),
  ])

  const span = end.getTime() - start.getTime()
  const revBuckets: DualTrendPoint[] = []
  const marginBuckets: TrendPoint[] = []
  for (let i = 0; i < buckets; i++) {
    const bStart = new Date(start.getTime() + (i * span) / buckets)
    revBuckets.push({ bucket: bStart.toISOString(), revenue: 0, expenses: 0 })
    marginBuckets.push({ bucket: bStart.toISOString(), value: 0 })
  }
  const bucketRev = new Array(buckets).fill(0)
  const bucketCost = new Array(buckets).fill(0)
  for (const o of orders) {
    const idx = Math.min(buckets - 1, Math.max(0, Math.floor(((o.createdAt.getTime() - start.getTime()) / span) * buckets)))
    revBuckets[idx].revenue += Number(o.total)
  }
  for (const i of items) {
    const t = i.order?.createdAt?.getTime() ?? start.getTime()
    const idx = Math.min(buckets - 1, Math.max(0, Math.floor(((t - start.getTime()) / span) * buckets)))
    const cp = Number(i.variant?.costPrice ?? i.variant?.product?.costPrice ?? 0)
    bucketRev[idx] += Number(i.price) * i.quantity
    bucketCost[idx] += cp * i.quantity
  }
  for (const e of expenses) {
    const idx = Math.min(buckets - 1, Math.max(0, Math.floor(((e.date.getTime() - start.getTime()) / span) * buckets)))
    revBuckets[idx].expenses += Number(e.amount)
  }
  for (let i = 0; i < buckets; i++) {
    marginBuckets[i].value = bucketRev[i] === 0 ? 0 : ((bucketRev[i] - bucketCost[i]) / bucketRev[i]) * 100
  }

  const taxSummary: TaxSummaryRow[] = taxRecords.map((t) => ({
    id: t.id,
    period: t.period,
    year: t.year,
    quarter: t.quarter ?? null,
    month: t.month ?? null,
    grossRevenue: Number(t.grossRevenue ?? 0),
    salesTaxCollected: Number(t.salesTaxCollected ?? 0),
    netIncome: Number(t.netIncome ?? 0),
    estimatedTaxLiability: Number(t.estimatedTaxLiability ?? 0),
    status: t.status,
  }))

  return { revenueExpenseTrend: revBuckets, marginTrend: marginBuckets, taxSummary, periodGrid }
}

// ============================================================
// Tab: Expenses
// ============================================================

export async function loadExpensesData(
  range: TimeRange,
  filters: ExpenseFilters = {},
): Promise<ExpensesData> {
  const { start, end } = getRangeBounds(range)
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  const where: Record<string, unknown> = { date: { gte: start, lte: end } }
  if (filters.categoryId) where.categoryId = filters.categoryId
  if (filters.status) where.status = filters.status
  if (filters.isTaxDeductible !== undefined) where.isTaxDeductible = filters.isTaxDeductible
  if (filters.search) {
    where.OR = [
      { description: { contains: filters.search, mode: 'insensitive' as const } },
      { vendor: { contains: filters.search, mode: 'insensitive' as const } },
    ]
  }

  const [byCategory, categories, rows, total] = await Promise.all([
    prisma.expense.groupBy({
      by: ['categoryId'],
      where,
      _sum: { amount: true },
    }),
    prisma.expenseCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true, color: true },
    }),
    prisma.expense.findMany({
      where, orderBy: { date: 'desc' }, skip, take: pageSize,
      select: {
        id: true, amount: true, date: true, description: true, vendor: true,
        categoryId: true, isTaxDeductible: true, status: true, paymentMethod: true,
        category: { select: { id: true, name: true, color: true } },
      },
    }),
    prisma.expense.count({ where }),
  ])

  const catMap = new Map(categories.map((c) => [c.id, c]))
  const categoryBreakdown: CategoryBreakdownSlice[] = byCategory.map((g) => {
    const cat = catMap.get(g.categoryId)
    return {
      categoryId: g.categoryId,
      categoryName: cat?.name ?? 'Uncategorized',
      color: cat?.color ?? '#6B7280',
      amount: Number(g._sum.amount ?? 0),
    }
  })

  // Monthly bars: bucket all expenses in window by YYYY-MM
  const monthly = new Map<string, number>()
  for (const r of rows) {
    const m = isoMonth(r.date)
    monthly.set(m, (monthly.get(m) ?? 0) + Number(r.amount))
  }
  const monthlyBars: MonthlyExpenseBar[] = Array.from(monthly.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, amount]) => ({ month, amount }))

  const items: ExpenseTableRow[] = rows.map((r) => ({
    id: r.id,
    amount: Number(r.amount),
    date: r.date,
    description: r.description,
    vendor: r.vendor ?? null,
    categoryId: r.categoryId,
    categoryName: r.category?.name ?? 'Uncategorized',
    categoryColor: r.category?.color ?? '#6B7280',
    isTaxDeductible: r.isTaxDeductible,
    status: r.status,
    paymentMethod: r.paymentMethod ?? null,
  }))

  return {
    categoryBreakdown,
    monthlyBars,
    table: { items, total, page, pageSize },
  }
}

// ============================================================
// Detail loaders
// ============================================================

export async function loadExpenseDetail(id: string): Promise<ExpenseDetailFull | null> {
  const e = await prisma.expense.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
    },
  })
  if (!e) return null
  return {
    id: e.id,
    amount: Number(e.amount),
    date: e.date,
    description: e.description,
    vendor: e.vendor ?? null,
    receiptUrl: e.receiptUrl ?? null,
    notes: e.notes ?? null,
    isTaxDeductible: e.isTaxDeductible,
    taxCategory: e.taxCategory ?? null,
    paymentMethod: e.paymentMethod ?? null,
    isRecurring: e.isRecurring,
    recurringFrequency: e.recurringFrequency ?? null,
    status: e.status,
    invoiceId: e.invoiceId ?? null,
    category: {
      id: e.category.id,
      name: e.category.name,
      slug: e.category.slug,
      color: e.category.color,
      icon: e.category.icon ?? null,
    },
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }
}

export async function loadCustomerDetail(id: string): Promise<CustomerDetailFull | null> {
  const c = await prisma.customer.findUnique({
    where: { id },
    select: {
      id: true, email: true, name: true, createdAt: true,
      totalSpent: true, totalOrders: true, avgOrderValue: true, lastOrderDate: true,
      loyaltyTier: { select: { name: true } },
    },
  })
  if (!c) return null
  return {
    id: c.id,
    email: c.email,
    name: c.name ?? null,
    createdAt: c.createdAt,
    totalSpent: Number(c.totalSpent ?? 0),
    totalOrders: c.totalOrders ?? 0,
    avgOrderValue: Number(c.avgOrderValue ?? 0),
    lastOrderDate: c.lastOrderDate ?? null,
    loyaltyTierName: c.loyaltyTier?.name ?? null,
  }
}

export async function loadProductFinancialDetail(
  id: string,
  range: TimeRange,
): Promise<ProductFinancialDetailFull | null> {
  const { start, end } = getRangeBounds(range)
  const p = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true, name: true, images: true, basePrice: true, costPrice: true,
      variants: { select: { id: true, costPrice: true } },
    },
  })
  if (!p) return null

  const items = await prisma.orderItem.findMany({
    where: {
      productId: id,
      order: { status: { in: [...REVENUE_STATUSES] }, createdAt: { gte: start, lte: end } },
    },
    select: {
      quantity: true,
      price: true,
      variant: { select: { costPrice: true, product: { select: { costPrice: true } } } },
    },
  })

  let units = 0, revenue = 0, cost = 0
  for (const i of items) {
    const cp = Number(i.variant?.costPrice ?? i.variant?.product?.costPrice ?? 0)
    units += i.quantity
    revenue += Number(i.price) * i.quantity
    cost += cp * i.quantity
  }
  const grossMargin = revenue - cost
  return {
    id: p.id,
    name: p.name,
    imageUrl: safeFirstImage(p.images),
    basePrice: Number(p.basePrice ?? 0),
    unitsSold: units,
    revenue,
    cost,
    grossMargin,
    marginPct: revenue === 0 ? 0 : (grossMargin / revenue) * 100,
    rangeStart: start,
    rangeEnd: end,
  }
}

// ============================================================
// Financial period grid (lazy backfill)
// ============================================================

export async function loadFinancialPeriodGrid(
  periodType: 'monthly' = 'monthly',
  count = 12,
): Promise<FinancialSnapshotRow[]> {
  const now = new Date()
  const periods: Date[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    periods.push(d)
  }

  const existing = await prisma.financialSnapshot.findMany({
    where: {
      periodType,
      date: { in: periods },
    },
  })
  const existingByIso = new Map(existing.map((s) => [s.date.toISOString(), s]))

  const missing = periods.filter((p) => !existingByIso.has(p.toISOString()))
  if (missing.length > 0) {
    await Promise.allSettled(missing.map((d) => backfillSnapshot(d, periodType)))
    // Re-read after backfill
    const after = await prisma.financialSnapshot.findMany({
      where: { periodType, date: { in: periods } },
    })
    for (const s of after) existingByIso.set(s.date.toISOString(), s)
  }

  return periods
    .map((p) => existingByIso.get(p.toISOString()))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .map((s) => ({
      id: s.id,
      date: s.date,
      periodType: s.periodType,
      totalRevenue: Number(s.totalRevenue ?? 0),
      totalOrders: s.totalOrders ?? 0,
      avgOrderValue: Number(s.avgOrderValue ?? 0),
      totalCOGS: Number(s.totalCOGS ?? 0),
      totalExpenses: Number(s.totalExpenses ?? 0),
      grossProfit: Number(s.grossProfit ?? 0),
      grossMargin: Number(s.grossMargin ?? 0),
      netProfit: Number(s.netProfit ?? 0),
      netMargin: Number(s.netMargin ?? 0),
      salesTaxCollected: Number(s.salesTaxCollected ?? 0),
      inventoryValue: Number(s.inventoryValue ?? 0),
      cashOnHand: s.cashOnHand === null ? null : Number(s.cashOnHand),
    }))
}

async function backfillSnapshot(date: Date, periodType: string): Promise<void> {
  try {
    const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
    const [orderAgg, items, expAgg] = await Promise.all([
      prisma.order.aggregate({
        where: { status: { in: [...REVENUE_STATUSES] }, createdAt: { gte: date, lt: next } },
        _sum: { total: true, tax: true },
        _count: { _all: true },
      }),
      prisma.orderItem.findMany({
        where: { order: { status: { in: [...REVENUE_STATUSES] }, createdAt: { gte: date, lt: next } } },
        select: {
          quantity: true,
          price: true,
          variant: { select: { costPrice: true, product: { select: { costPrice: true } } } },
        },
      }),
      prisma.expense.aggregate({
        where: { date: { gte: date, lt: next } },
        _sum: { amount: true },
      }),
    ])
    let cogs = 0, rev = 0
    for (const i of items) {
      const cp = Number(i.variant?.costPrice ?? i.variant?.product?.costPrice ?? 0)
      rev += Number(i.price) * i.quantity
      cogs += cp * i.quantity
    }
    const totalRevenue = Number(orderAgg._sum.total ?? 0)
    const totalOrders = orderAgg._count._all
    const totalExpenses = Number(expAgg._sum.amount ?? 0)
    const grossProfit = totalRevenue - cogs
    const grossMargin = totalRevenue === 0 ? 0 : (grossProfit / totalRevenue) * 100
    const netProfit = grossProfit - totalExpenses
    const netMargin = totalRevenue === 0 ? 0 : (netProfit / totalRevenue) * 100
    await prisma.financialSnapshot.upsert({
      where: { date_periodType: { date, periodType } },
      create: {
        date, periodType,
        totalRevenue, totalOrders,
        avgOrderValue: totalOrders === 0 ? 0 : totalRevenue / totalOrders,
        totalCOGS: cogs, totalExpenses,
        grossProfit, grossMargin, netProfit, netMargin,
        salesTaxCollected: Number(orderAgg._sum.tax ?? 0),
      },
      update: {},
    })
  } catch (err) {
    console.error(`[loadFinancialPeriodGrid] backfill failed for ${date.toISOString()} (${periodType}):`, err)
  }
}

// ============================================================
// Sales goals
// ============================================================

export async function loadSalesGoalsForInspector(): Promise<SalesGoalsRow> {
  const g = await prisma.salesGoals.findUnique({ where: { id: 'default' } })
  return g
    ? {
        id: g.id,
        dailyTarget: Number(g.dailyTarget),
        weeklyTarget: Number(g.weeklyTarget),
        monthlyTarget: Number(g.monthlyTarget),
        quarterlyTarget: Number(g.quarterlyTarget),
        yearlyTarget: Number(g.yearlyTarget),
        updatedAt: g.updatedAt,
      }
    : {
        id: 'default',
        dailyTarget: 500,
        weeklyTarget: 3500,
        monthlyTarget: 15000,
        quarterlyTarget: 45000,
        yearlyTarget: 180000,
        updatedAt: new Date(0),
      }
}

// ============================================================
// Tab constants
// ============================================================

export const ANALYTICS_TABS = [
  'overview',
  'sales',
  'customers',
  'products',
  'financial',
  'expenses',
] as const
export type AnalyticsTab = (typeof ANALYTICS_TABS)[number]

export function isAnalyticsTab(v: unknown): v is AnalyticsTab {
  return typeof v === 'string' && (ANALYTICS_TABS as readonly string[]).includes(v)
}

export function isTimeRange(v: unknown): v is TimeRange {
  return typeof v === 'string' && (TIME_RANGES as readonly string[]).includes(v)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/lib/admin/analytics.test.ts`
Expected: PASS — 18+ tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
git add lib/admin/analytics.ts tests/unit/lib/admin/analytics.test.ts
git commit -m "feat(admin-v2): add analytics data layer with KPI + 6 tab loaders + 3 detail loaders + period grid"
git push -u origin wave6p6/task-1-data-layer
gh pr create --title "feat(admin-v2): Phase 6 W1 analytics data layer" --body "Adds lib/admin/analytics.ts: TimeRange ('today'|'7d'|'30d'|'90d'|'year'), local getRangeBounds, buildTrend, KPI loader (revenue/orders/AOV/grossMargin% with trends), 6 tab loaders (Overview/Sales/Customers/Products/Financial/Expenses), 3 detail loaders, lazy FinancialSnapshot backfill via Promise.allSettled, SalesGoals singleton loader with defaults fallback. 18 tests passing."
```

---

### Task 2: `app/admin/analytics/actions.ts` server actions

**Wave:** 1 | **Parallel-safe with:** Task 1 | **Branch:** `wave6p6/task-2-server-actions` | **Model:** sonnet

**Schema realities for this task:**
- `ExpenseStatus` enum: `RECORDED | PENDING_APPROVAL | APPROVED | REJECTED | PAID`. Default for createExpense is `RECORDED`.
- `deleteExpense` MUST use `requireAdminRole('SUPER_ADMIN')` (financial mutation gate).
- `Expense.invoiceId` FK — if non-null, `deleteExpense` returns `{ ok: false, error: 'Expense linked to invoice; remove from invoice first' }` before attempting delete.
- `updateSalesGoals` must wrap the singleton update AND a `SalesGoalHistory.create()` log row inside `$transaction`. The history row stores the period actuals at the moment of change (use current period's MTD revenue as a reasonable `achieved` value for the monthly snapshot; daily/weekly/quarterly/yearly defaults to 0 — UI displays "logged at change").
- CSV cap = 10,000 rows. Over-cap returns `{ ok: false, error: 'Too many rows — narrow the date range' }`.
- **Inline Prisma queries for `get*ForInspector` (parallel-safe with Task 1).** Re-export type aliases (`ExpenseDetailFull`, `CustomerDetailFull`, `ProductFinancialDetailFull`, `SalesGoalsRow`) from this file so client components can `import type` them.
- `requireAdmin()` no-arg for all CSV exports + getters + create/update; `requireAdminRole('SUPER_ADMIN')` only for `deleteExpense`.

**Files:**
- Create: `app/admin/analytics/actions.ts`
- Test: `tests/unit/app/admin/analytics/actions.test.ts`

#### Steps

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/app/admin/analytics/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const expenseCreate = vi.fn()
const expenseUpdate = vi.fn()
const expenseDelete = vi.fn()
const expenseFindUnique = vi.fn()
const expenseFindMany = vi.fn()
const expenseCount = vi.fn()
const orderFindMany = vi.fn()
const orderItemFindMany = vi.fn()
const customerFindMany = vi.fn()
const customerFindUnique = vi.fn()
const productFindMany = vi.fn()
const productFindUnique = vi.fn()
const taxRecordFindMany = vi.fn()
const snapshotFindMany = vi.fn()
const salesGoalsFindUnique = vi.fn()
const salesGoalsUpsert = vi.fn()
const salesGoalsUpdate = vi.fn()
const salesGoalHistoryCreate = vi.fn()
const txn = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
  cb({
    salesGoals: { update: salesGoalsUpdate, upsert: salesGoalsUpsert },
    salesGoalHistory: { create: salesGoalHistoryCreate },
  }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    expense: {
      create: expenseCreate,
      update: expenseUpdate,
      delete: expenseDelete,
      findUnique: expenseFindUnique,
      findMany: expenseFindMany,
      count: expenseCount,
    },
    order: { findMany: orderFindMany },
    orderItem: { findMany: orderItemFindMany },
    customer: { findMany: customerFindMany, findUnique: customerFindUnique },
    product: { findMany: productFindMany, findUnique: productFindUnique },
    taxRecord: { findMany: taxRecordFindMany },
    financialSnapshot: { findMany: snapshotFindMany },
    salesGoals: { findUnique: salesGoalsFindUnique, upsert: salesGoalsUpsert, update: salesGoalsUpdate },
    salesGoalHistory: { create: salesGoalHistoryCreate },
    $transaction: txn,
  },
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

describe('createExpense', () => {
  it('creates an expense with default RECORDED status', async () => {
    expenseCreate.mockResolvedValue({ id: 'e1' })
    const { createExpense } = await import('@/app/admin/analytics/actions')
    const r = await createExpense({
      categoryId: 'cat1',
      amount: 100,
      date: new Date('2026-05-15'),
      description: 'FB ads',
      vendor: 'Meta',
      paymentMethod: 'card',
      isTaxDeductible: true,
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data?.id).toBe('e1')
    expect(expenseCreate.mock.calls[0][0].data.status).toBe('RECORDED')
  })

  it('rejects negative amounts', async () => {
    const { createExpense } = await import('@/app/admin/analytics/actions')
    const r = await createExpense({
      categoryId: 'cat1',
      amount: -10,
      date: new Date(),
      description: 'x',
    })
    expect(r.ok).toBe(false)
  })

  it('rejects empty description', async () => {
    const { createExpense } = await import('@/app/admin/analytics/actions')
    const r = await createExpense({
      categoryId: 'cat1',
      amount: 10,
      date: new Date(),
      description: '   ',
    })
    expect(r.ok).toBe(false)
  })
})

describe('updateExpense', () => {
  it('only forwards defined fields', async () => {
    expenseUpdate.mockResolvedValue({})
    const { updateExpense } = await import('@/app/admin/analytics/actions')
    await updateExpense('e1', { description: 'updated' })
    const data = expenseUpdate.mock.calls[0][0].data
    expect(data.description).toBe('updated')
    expect(data.amount).toBeUndefined()
  })
})

describe('deleteExpense', () => {
  it('refuses to delete an invoice-linked expense', async () => {
    expenseFindUnique.mockResolvedValue({ id: 'e1', invoiceId: 'inv1' })
    const { deleteExpense } = await import('@/app/admin/analytics/actions')
    const r = await deleteExpense('e1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/invoice/i)
  })

  it('deletes when not linked to invoice', async () => {
    expenseFindUnique.mockResolvedValue({ id: 'e1', invoiceId: null })
    expenseDelete.mockResolvedValue({})
    const { deleteExpense } = await import('@/app/admin/analytics/actions')
    const r = await deleteExpense('e1')
    expect(r.ok).toBe(true)
  })
})

describe('updateSalesGoals', () => {
  it('updates singleton and appends history inside transaction', async () => {
    salesGoalsFindUnique.mockResolvedValue({
      id: 'default', dailyTarget: 500, weeklyTarget: 3500, monthlyTarget: 15000,
      quarterlyTarget: 45000, yearlyTarget: 180000,
    })
    salesGoalsUpsert.mockResolvedValue({})
    salesGoalHistoryCreate.mockResolvedValue({})
    const { updateSalesGoals } = await import('@/app/admin/analytics/actions')
    const r = await updateSalesGoals({
      dailyTarget: 600, weeklyTarget: 4000, monthlyTarget: 18000,
      quarterlyTarget: 50000, yearlyTarget: 200000,
    })
    expect(r.ok).toBe(true)
    expect(txn).toHaveBeenCalled()
    expect(salesGoalsUpsert).toHaveBeenCalled()
    expect(salesGoalHistoryCreate).toHaveBeenCalled()
  })
})

describe('getExpenseDetailForInspector', () => {
  it('returns null on missing', async () => {
    expenseFindUnique.mockResolvedValue(null)
    const { getExpenseDetailForInspector } = await import('@/app/admin/analytics/actions')
    expect(await getExpenseDetailForInspector('missing')).toBeNull()
  })

  it('returns ExpenseDetailFull when present', async () => {
    expenseFindUnique.mockResolvedValue({
      id: 'e1', amount: 100, date: new Date(), description: 'x', vendor: null,
      receiptUrl: null, notes: null, isTaxDeductible: false, taxCategory: null,
      paymentMethod: null, isRecurring: false, recurringFrequency: null,
      status: 'RECORDED', categoryId: 'cat1', invoiceId: null,
      category: { id: 'cat1', name: 'Other', slug: 'other', color: '#000', icon: null },
      createdAt: new Date(), updatedAt: new Date(),
    })
    const { getExpenseDetailForInspector } = await import('@/app/admin/analytics/actions')
    const d = await getExpenseDetailForInspector('e1')
    expect(d?.id).toBe('e1')
    expect(d?.category.name).toBe('Other')
  })
})

describe('exportExpensesCsv', () => {
  it('returns CSV string with header row', async () => {
    expenseCount.mockResolvedValue(1)
    expenseFindMany.mockResolvedValue([
      { id: 'e1', amount: 100, date: new Date('2026-05-15'), description: 'FB',
        vendor: 'Meta', isTaxDeductible: true, status: 'PAID', paymentMethod: 'card',
        category: { name: 'Marketing' } },
    ])
    const { exportExpensesCsv } = await import('@/app/admin/analytics/actions')
    const r = await exportExpensesCsv('30d')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data?.csv).toContain('id,date,description')
      expect(r.data?.csv).toContain('FB')
    }
  })

  it('rejects exports over 10,000 rows', async () => {
    expenseCount.mockResolvedValue(10001)
    const { exportExpensesCsv } = await import('@/app/admin/analytics/actions')
    const r = await exportExpensesCsv('year')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/narrow/i)
  })
})

describe('exportOverviewCsv / exportSalesCsv / exportCustomersCsv / exportProductsCsv / exportFinancialCsv', () => {
  it('each returns ActionResult<{ csv }>', async () => {
    orderFindMany.mockResolvedValue([])
    orderItemFindMany.mockResolvedValue([])
    customerFindMany.mockResolvedValue([])
    productFindMany.mockResolvedValue([])
    taxRecordFindMany.mockResolvedValue([])
    snapshotFindMany.mockResolvedValue([])
    const m = await import('@/app/admin/analytics/actions')
    for (const fn of [m.exportOverviewCsv, m.exportSalesCsv, m.exportCustomersCsv,
                       m.exportProductsCsv, m.exportFinancialCsv]) {
      const r = await fn('30d')
      expect(r.ok).toBe(true)
      if (r.ok) expect(typeof r.data?.csv).toBe('string')
    }
  })
})

describe('getCustomerDetailForInspector + getProductFinancialDetailForInspector + getSalesGoalsForInspector', () => {
  it('Customer wrapper returns null on missing', async () => {
    customerFindUnique.mockResolvedValue(null)
    const { getCustomerDetailForInspector } = await import('@/app/admin/analytics/actions')
    expect(await getCustomerDetailForInspector('missing')).toBeNull()
  })

  it('Product wrapper returns detail', async () => {
    productFindUnique.mockResolvedValue({
      id: 'p1', name: 'Tee', images: '[]', basePrice: 25, costPrice: 5,
      variants: [{ id: 'v1', costPrice: 5 }],
    })
    orderItemFindMany.mockResolvedValue([])
    const { getProductFinancialDetailForInspector } = await import('@/app/admin/analytics/actions')
    const d = await getProductFinancialDetailForInspector('p1', '30d')
    expect(d?.id).toBe('p1')
  })

  it('SalesGoals wrapper returns defaults when no row', async () => {
    salesGoalsFindUnique.mockResolvedValue(null)
    const { getSalesGoalsForInspector } = await import('@/app/admin/analytics/actions')
    const g = await getSalesGoalsForInspector()
    expect(g.dailyTarget).toBe(500)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/app/admin/analytics/actions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `app/admin/analytics/actions.ts`**

```ts
// app/admin/analytics/actions.ts
'use server'

/**
 * Phase 6 — Admin Analytics Server Actions (~14 actions).
 *
 * All actions go through requireAdmin() (no-arg overload, returns userId string).
 * deleteExpense uses requireAdminRole('SUPER_ADMIN') (financial-mutation gate).
 * All mutations call revalidatePath('/admin/analytics').
 *
 * PARALLEL-SAFETY NOTE:
 *   get*ForInspector actions inline their Prisma queries rather than importing
 *   from lib/admin/analytics.ts because Task 1 (which builds that module) is
 *   executing concurrently on a separate branch. After both Wave 1 PRs merge,
 *   a Phase 6.5 follow-up can refactor to import the shared loaders.
 */

import { revalidatePath } from 'next/cache'
import type { ExpenseStatus, TaxPeriod, TaxRecordStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin, requireAdminRole } from '@/lib/auth/admin'

// ============================================================
// Return types
// ============================================================

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

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

const REVENUE_STATUSES = ['CONFIRMED', 'SHIPPED', 'DELIVERED'] as const
const CSV_MAX_ROWS = 10000
const ANALYTICS_PATH = '/admin/analytics'

function revalidateAnalytics() {
  revalidatePath(ANALYTICS_PATH)
}

// ============================================================
// Re-exported detail shapes (so client components can import type)
// ============================================================

export interface ExpenseDetailFull {
  id: string
  amount: number
  date: Date
  description: string
  vendor: string | null
  receiptUrl: string | null
  notes: string | null
  isTaxDeductible: boolean
  taxCategory: string | null
  paymentMethod: string | null
  isRecurring: boolean
  recurringFrequency: string | null
  status: ExpenseStatus
  invoiceId: string | null
  category: { id: string; name: string; slug: string; color: string; icon: string | null }
  createdAt: Date
  updatedAt: Date
}

export interface CustomerDetailFull {
  id: string
  email: string
  name: string | null
  createdAt: Date
  totalSpent: number
  totalOrders: number
  avgOrderValue: number
  lastOrderDate: Date | null
  loyaltyTierName: string | null
}

export interface ProductFinancialDetailFull {
  id: string
  name: string
  imageUrl: string | null
  basePrice: number
  unitsSold: number
  revenue: number
  cost: number
  grossMargin: number
  marginPct: number
  rangeStart: Date
  rangeEnd: Date
}

export interface SalesGoalsRow {
  id: string
  dailyTarget: number
  weeklyTarget: number
  monthlyTarget: number
  quarterlyTarget: number
  yearlyTarget: number
  updatedAt: Date
}

// ============================================================
// Input types
// ============================================================

export interface CreateExpenseInput {
  categoryId: string
  amount: number
  date: Date
  description: string
  vendor?: string | null
  receiptUrl?: string | null
  notes?: string | null
  isTaxDeductible?: boolean
  taxCategory?: string | null
  paymentMethod?: string | null
  isRecurring?: boolean
  recurringFrequency?: string | null
  status?: ExpenseStatus
  invoiceId?: string | null
}

export interface UpdateExpenseInput {
  categoryId?: string
  amount?: number
  date?: Date
  description?: string
  vendor?: string | null
  receiptUrl?: string | null
  notes?: string | null
  isTaxDeductible?: boolean
  taxCategory?: string | null
  paymentMethod?: string | null
  isRecurring?: boolean
  recurringFrequency?: string | null
  status?: ExpenseStatus
}

export interface UpdateSalesGoalsInput {
  dailyTarget: number
  weeklyTarget: number
  monthlyTarget: number
  quarterlyTarget: number
  yearlyTarget: number
}

// ============================================================
// Helpers
// ============================================================

function safeFirstImage(images: string | null | undefined): string | null {
  if (!images) return null
  try {
    const arr = JSON.parse(images)
    if (Array.isArray(arr) && arr.length > 0) return String(arr[0])
    return null
  } catch {
    return null
  }
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
// EXPENSES (CRUD)
// ============================================================

export async function createExpense(
  input: CreateExpenseInput,
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin()
  if (!input.description || input.description.trim().length === 0) {
    return { ok: false, error: 'Description is required' }
  }
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    return { ok: false, error: 'Amount must be a non-negative number' }
  }
  try {
    const e = await prisma.expense.create({
      data: {
        categoryId: input.categoryId,
        amount: input.amount,
        date: input.date,
        description: input.description.trim(),
        vendor: input.vendor ?? null,
        receiptUrl: input.receiptUrl ?? null,
        notes: input.notes ?? null,
        isTaxDeductible: input.isTaxDeductible ?? false,
        taxCategory: input.taxCategory ?? null,
        paymentMethod: input.paymentMethod ?? null,
        isRecurring: input.isRecurring ?? false,
        recurringFrequency: input.recurringFrequency ?? null,
        status: input.status ?? 'RECORDED',
        invoiceId: input.invoiceId ?? null,
      },
    })
    revalidateAnalytics()
    return { ok: true, data: { id: e.id } }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create expense' }
  }
}

export async function updateExpense(
  id: string,
  input: UpdateExpenseInput,
): Promise<ActionResult> {
  await requireAdmin()
  const data: Record<string, unknown> = {}
  if (input.categoryId !== undefined) data.categoryId = input.categoryId
  if (input.amount !== undefined) data.amount = input.amount
  if (input.date !== undefined) data.date = input.date
  if (input.description !== undefined) data.description = input.description.trim()
  if (input.vendor !== undefined) data.vendor = input.vendor
  if (input.receiptUrl !== undefined) data.receiptUrl = input.receiptUrl
  if (input.notes !== undefined) data.notes = input.notes
  if (input.isTaxDeductible !== undefined) data.isTaxDeductible = input.isTaxDeductible
  if (input.taxCategory !== undefined) data.taxCategory = input.taxCategory
  if (input.paymentMethod !== undefined) data.paymentMethod = input.paymentMethod
  if (input.isRecurring !== undefined) data.isRecurring = input.isRecurring
  if (input.recurringFrequency !== undefined) data.recurringFrequency = input.recurringFrequency
  if (input.status !== undefined) data.status = input.status
  try {
    await prisma.expense.update({ where: { id }, data })
    revalidateAnalytics()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update expense' }
  }
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  await requireAdminRole('SUPER_ADMIN')
  const existing = await prisma.expense.findUnique({
    where: { id },
    select: { id: true, invoiceId: true },
  })
  if (!existing) return { ok: false, error: 'Expense not found' }
  if (existing.invoiceId) {
    return { ok: false, error: 'Expense linked to invoice; remove from invoice first' }
  }
  try {
    await prisma.expense.delete({ where: { id } })
    revalidateAnalytics()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete expense' }
  }
}

// ============================================================
// INSPECTOR DATA WRAPPERS (inline Prisma queries — parallel-safe)
// ============================================================

export async function getExpenseDetailForInspector(id: string): Promise<ExpenseDetailFull | null> {
  await requireAdmin()
  const e = await prisma.expense.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
    },
  })
  if (!e) return null
  return {
    id: e.id,
    amount: Number(e.amount),
    date: e.date,
    description: e.description,
    vendor: e.vendor ?? null,
    receiptUrl: e.receiptUrl ?? null,
    notes: e.notes ?? null,
    isTaxDeductible: e.isTaxDeductible,
    taxCategory: e.taxCategory ?? null,
    paymentMethod: e.paymentMethod ?? null,
    isRecurring: e.isRecurring,
    recurringFrequency: e.recurringFrequency ?? null,
    status: e.status,
    invoiceId: e.invoiceId ?? null,
    category: {
      id: e.category.id,
      name: e.category.name,
      slug: e.category.slug,
      color: e.category.color,
      icon: e.category.icon ?? null,
    },
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }
}

export async function getCustomerDetailForInspector(id: string): Promise<CustomerDetailFull | null> {
  await requireAdmin()
  const c = await prisma.customer.findUnique({
    where: { id },
    select: {
      id: true, email: true, name: true, createdAt: true,
      totalSpent: true, totalOrders: true, avgOrderValue: true, lastOrderDate: true,
      loyaltyTier: { select: { name: true } },
    },
  })
  if (!c) return null
  return {
    id: c.id,
    email: c.email,
    name: c.name ?? null,
    createdAt: c.createdAt,
    totalSpent: Number(c.totalSpent ?? 0),
    totalOrders: c.totalOrders ?? 0,
    avgOrderValue: Number(c.avgOrderValue ?? 0),
    lastOrderDate: c.lastOrderDate ?? null,
    loyaltyTierName: c.loyaltyTier?.name ?? null,
  }
}

export async function getProductFinancialDetailForInspector(
  id: string,
  range: TimeRange,
): Promise<ProductFinancialDetailFull | null> {
  await requireAdmin()
  const { start, end } = getRangeBoundsLocal(range)
  const p = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true, name: true, images: true, basePrice: true, costPrice: true,
      variants: { select: { id: true, costPrice: true } },
    },
  })
  if (!p) return null
  const items = await prisma.orderItem.findMany({
    where: {
      productId: id,
      order: { status: { in: [...REVENUE_STATUSES] }, createdAt: { gte: start, lte: end } },
    },
    select: {
      quantity: true,
      price: true,
      variant: { select: { costPrice: true, product: { select: { costPrice: true } } } },
    },
  })
  let units = 0, revenue = 0, cost = 0
  for (const i of items) {
    const cp = Number(i.variant?.costPrice ?? i.variant?.product?.costPrice ?? 0)
    units += i.quantity
    revenue += Number(i.price) * i.quantity
    cost += cp * i.quantity
  }
  const grossMargin = revenue - cost
  return {
    id: p.id,
    name: p.name,
    imageUrl: safeFirstImage(p.images),
    basePrice: Number(p.basePrice ?? 0),
    unitsSold: units,
    revenue,
    cost,
    grossMargin,
    marginPct: revenue === 0 ? 0 : (grossMargin / revenue) * 100,
    rangeStart: start,
    rangeEnd: end,
  }
}

// ============================================================
// SALES GOALS
// ============================================================

export async function getSalesGoalsForInspector(): Promise<SalesGoalsRow> {
  await requireAdmin()
  const g = await prisma.salesGoals.findUnique({ where: { id: 'default' } })
  return g
    ? {
        id: g.id,
        dailyTarget: Number(g.dailyTarget),
        weeklyTarget: Number(g.weeklyTarget),
        monthlyTarget: Number(g.monthlyTarget),
        quarterlyTarget: Number(g.quarterlyTarget),
        yearlyTarget: Number(g.yearlyTarget),
        updatedAt: g.updatedAt,
      }
    : {
        id: 'default',
        dailyTarget: 500,
        weeklyTarget: 3500,
        monthlyTarget: 15000,
        quarterlyTarget: 45000,
        yearlyTarget: 180000,
        updatedAt: new Date(0),
      }
}

export async function updateSalesGoals(
  input: UpdateSalesGoalsInput,
): Promise<ActionResult> {
  await requireAdmin()
  for (const key of ['dailyTarget', 'weeklyTarget', 'monthlyTarget', 'quarterlyTarget', 'yearlyTarget'] as const) {
    const v = input[key]
    if (!Number.isFinite(v) || v < 0) {
      return { ok: false, error: `${key} must be a non-negative number` }
    }
  }
  const now = new Date()
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
  try {
    await prisma.$transaction(async (tx) => {
      await (tx as typeof prisma).salesGoals.upsert({
        where: { id: 'default' },
        update: { ...input },
        create: { id: 'default', ...input },
      })
      await (tx as typeof prisma).salesGoalHistory.create({
        data: {
          salesGoalsId: 'default',
          period: 'monthly',
          periodStart,
          periodEnd,
          target: input.monthlyTarget,
          achieved: 0,
          percentage: 0,
          metGoal: false,
        },
      })
    })
    revalidateAnalytics()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update sales goals' }
  }
}

// ============================================================
// CSV EXPORTS
// ============================================================

export async function exportOverviewCsv(range: TimeRange): Promise<ActionResult<{ csv: string }>> {
  await requireAdmin()
  const { start, end } = getRangeBoundsLocal(range)
  const orders = await prisma.order.findMany({
    where: { status: { in: [...REVENUE_STATUSES] }, createdAt: { gte: start, lte: end } },
    select: { id: true, orderNumber: true, total: true, createdAt: true, status: true },
    orderBy: { createdAt: 'desc' },
    take: CSV_MAX_ROWS + 1,
  })
  if (orders.length > CSV_MAX_ROWS) return { ok: false, error: 'Too many rows — narrow the date range' }
  const csv = rowsToCsv(
    ['id', 'orderNumber', 'createdAt', 'status', 'total'],
    orders.map((o) => [o.id, o.orderNumber, o.createdAt, o.status, Number(o.total)]),
  )
  return { ok: true, data: { csv } }
}

export async function exportSalesCsv(range: TimeRange): Promise<ActionResult<{ csv: string }>> {
  await requireAdmin()
  const { start, end } = getRangeBoundsLocal(range)
  const items = await prisma.orderItem.findMany({
    where: {
      order: { status: { in: [...REVENUE_STATUSES] }, createdAt: { gte: start, lte: end } },
    },
    select: {
      quantity: true,
      price: true,
      product: { select: { id: true, name: true } },
      order: { select: { id: true, orderNumber: true, createdAt: true } },
    },
    take: CSV_MAX_ROWS + 1,
  })
  if (items.length > CSV_MAX_ROWS) return { ok: false, error: 'Too many rows — narrow the date range' }
  const csv = rowsToCsv(
    ['orderId', 'orderNumber', 'createdAt', 'productId', 'productName', 'quantity', 'price'],
    items.map((i) => [
      i.order?.id ?? '', i.order?.orderNumber ?? '', i.order?.createdAt ?? '',
      i.product?.id ?? '', i.product?.name ?? '', i.quantity, Number(i.price),
    ]),
  )
  return { ok: true, data: { csv } }
}

export async function exportCustomersCsv(range: TimeRange): Promise<ActionResult<{ csv: string }>> {
  await requireAdmin()
  void range // table is "all customers ordered by spend" — not range-bounded
  const customers = await prisma.customer.findMany({
    orderBy: { totalSpent: 'desc' },
    take: CSV_MAX_ROWS + 1,
    select: {
      id: true, email: true, name: true, createdAt: true,
      totalSpent: true, totalOrders: true, avgOrderValue: true, lastOrderDate: true,
    },
  })
  if (customers.length > CSV_MAX_ROWS) return { ok: false, error: 'Too many rows — narrow the date range' }
  const csv = rowsToCsv(
    ['id', 'email', 'name', 'createdAt', 'totalSpent', 'totalOrders', 'avgOrderValue', 'lastOrderDate'],
    customers.map((c) => [
      c.id, c.email, c.name ?? '', c.createdAt,
      Number(c.totalSpent ?? 0), c.totalOrders ?? 0,
      Number(c.avgOrderValue ?? 0), c.lastOrderDate ?? '',
    ]),
  )
  return { ok: true, data: { csv } }
}

export async function exportProductsCsv(range: TimeRange): Promise<ActionResult<{ csv: string }>> {
  await requireAdmin()
  void range
  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'desc' },
    take: CSV_MAX_ROWS + 1,
    select: { id: true, name: true, basePrice: true, costPrice: true },
  })
  if (products.length > CSV_MAX_ROWS) return { ok: false, error: 'Too many rows — narrow the date range' }
  const csv = rowsToCsv(
    ['id', 'name', 'basePrice', 'costPrice'],
    products.map((p) => [p.id, p.name, Number(p.basePrice ?? 0), Number(p.costPrice ?? 0)]),
  )
  return { ok: true, data: { csv } }
}

export async function exportFinancialCsv(range: TimeRange): Promise<ActionResult<{ csv: string }>> {
  await requireAdmin()
  void range
  const snapshots = await prisma.financialSnapshot.findMany({
    where: { periodType: 'monthly' },
    orderBy: { date: 'desc' },
    take: CSV_MAX_ROWS + 1,
  })
  if (snapshots.length > CSV_MAX_ROWS) return { ok: false, error: 'Too many rows — narrow the date range' }
  const csv = rowsToCsv(
    ['date', 'totalRevenue', 'totalOrders', 'totalCOGS', 'totalExpenses', 'grossProfit', 'grossMargin', 'netProfit', 'netMargin'],
    snapshots.map((s) => [
      s.date, Number(s.totalRevenue), s.totalOrders, Number(s.totalCOGS),
      Number(s.totalExpenses), Number(s.grossProfit), Number(s.grossMargin),
      Number(s.netProfit), Number(s.netMargin),
    ]),
  )
  return { ok: true, data: { csv } }
}

export interface ExpenseCsvFilters {
  categoryId?: string
  status?: ExpenseStatus
  isTaxDeductible?: boolean
}

export async function exportExpensesCsv(
  range: TimeRange,
  filters: ExpenseCsvFilters = {},
): Promise<ActionResult<{ csv: string }>> {
  await requireAdmin()
  const { start, end } = getRangeBoundsLocal(range)
  const where: Record<string, unknown> = { date: { gte: start, lte: end } }
  if (filters.categoryId) where.categoryId = filters.categoryId
  if (filters.status) where.status = filters.status
  if (filters.isTaxDeductible !== undefined) where.isTaxDeductible = filters.isTaxDeductible
  const count = await prisma.expense.count({ where })
  if (count > CSV_MAX_ROWS) return { ok: false, error: 'Too many rows — narrow the date range' }
  const rows = await prisma.expense.findMany({
    where,
    orderBy: { date: 'desc' },
    take: CSV_MAX_ROWS,
    select: {
      id: true, amount: true, date: true, description: true, vendor: true,
      isTaxDeductible: true, status: true, paymentMethod: true,
      category: { select: { name: true } },
    },
  })
  const csv = rowsToCsv(
    ['id', 'date', 'description', 'vendor', 'category', 'amount', 'status', 'paymentMethod', 'isTaxDeductible'],
    rows.map((r) => [
      r.id, r.date, r.description, r.vendor ?? '',
      r.category?.name ?? '', Number(r.amount), r.status,
      r.paymentMethod ?? '', r.isTaxDeductible,
    ]),
  )
  return { ok: true, data: { csv } }
}

// Re-export the TaxSummaryRow / TaxPeriod / TaxRecordStatus aliases for client tabs.
export type { TaxPeriod, TaxRecordStatus }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/app/admin/analytics/actions.test.ts`
Expected: PASS — 14+ tests passing.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: zero new errors.

- [ ] **Step 6: Commit + push + PR**

```bash
mkdir -p app/admin/analytics tests/unit/app/admin/analytics
git add app/admin/analytics/actions.ts tests/unit/app/admin/analytics/actions.test.ts
git commit -m "feat(admin-v2): add analytics server actions (~14) — expense CRUD, sales goals, 6 CSV exports, inspector wrappers"
git push -u origin wave6p6/task-2-server-actions
gh pr create --title "feat(admin-v2): Phase 6 W1 analytics server actions" --body "Adds app/admin/analytics/actions.ts: createExpense/updateExpense/deleteExpense (SUPER_ADMIN, invoice-link guard), get*ForInspector wrappers (Expense/Customer/Product/SalesGoals — Prisma queries inlined for W1 parallel-safety with Task 1), updateSalesGoals (singleton upsert + SalesGoalHistory inside \$transaction), 6 CSV exports capped at 10,000 rows. 14 tests passing."
```

---

## Wave 2 — 10 chart components (10 parallel, after W1 merged)

All chart components are thin Recharts wrappers in `components/admin/analytics/charts/`. They share a common shape:

- Marked `'use client'` (Recharts needs the browser).
- Props: typed `data` array + optional `height` (default 300) + optional `onPointClick?: (bucket: string) => void` (Phase 6.5 — v1 ships no-op + TODO comment; agents still wire the prop to the chart's `onClick` for forward compatibility).
- Empty-state fallback when `data.length === 0` → renders a centered `<div className="h-[300px] flex items-center justify-center text-white/30 text-xs">No data for this range</div>`.
- `<ResponsiveContainer width="100%" height={height}>` wrapping the chart primitive.
- Always-dark theme: stroke `#FF3131` (accent red) or `#6366f1` (indigo) for primary series; CartesianGrid `stroke="#ffffff14"`; XAxis/YAxis `stroke="#ffffff66"`, font 11; Tooltip `contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff14', borderRadius: 8, fontSize: 12, color: '#fff' }}`.
- Currency formatter: `new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })`.
- Each test file MUST mock `recharts` via `vi.mock('recharts', ...)` (see cross-cutting note 8).

---

### Task 3: `RevenueTrendChart.tsx`

**Wave:** 2 | **Branch:** `wave6p6/task-3-revenue-trend-chart` | **Model:** sonnet

**Schema realities for this task:** This is purely presentational; no Prisma. Consumes `TrendPoint[]` (`{ bucket: string; value: number }[]`) from `lib/admin/analytics.ts`. Do NOT import the type from `lib/admin/analytics.ts` directly because that pulls Prisma into the client bundle — declare the prop type locally with the same shape (`{ bucket: string; value: number }`).

**Files:**
- Create: `components/admin/analytics/charts/RevenueTrendChart.tsx`
- Test: `tests/unit/components/admin/analytics/charts/RevenueTrendChart.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/analytics/charts/RevenueTrendChart.test.tsx
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

import { RevenueTrendChart } from '@/components/admin/analytics/charts/RevenueTrendChart'

describe('RevenueTrendChart', () => {
  it('renders empty state when data is empty', () => {
    render(<RevenueTrendChart data={[]} />)
    expect(screen.getByText(/no data/i)).toBeTruthy()
  })

  it('renders chart container when data is present', () => {
    render(<RevenueTrendChart data={[{ bucket: '2026-05-30', value: 100 }]} />)
    expect(screen.getByTestId('line-chart')).toBeTruthy()
    expect(screen.getByTestId('line')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/admin/analytics/charts/RevenueTrendChart.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/admin/analytics/charts/RevenueTrendChart.tsx`**

```tsx
'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export interface RevenueTrendPoint {
  bucket: string
  value: number
}

export interface RevenueTrendChartProps {
  data: RevenueTrendPoint[]
  height?: number
  /** Phase 6.5 wire-up: chart-point click → range narrow. v1 ships as no-op (TODO). */
  onPointClick?: (bucket: string) => void
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function RevenueTrendChart({ data, height = 300, onPointClick }: RevenueTrendChartProps) {
  // TODO(phase-6.5): wire onPointClick to chart's onClick. Recharts v3 uses
  // <LineChart onClick={(state) => onPointClick?.(state.activeLabel)}>
  void onPointClick

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
          <YAxis stroke="#ffffff66" style={{ fontSize: 11 }} tickFormatter={(v) => fmt.format(Number(v))} />
          <Tooltip
            formatter={(v) => fmt.format(Number(v))}
            contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff14', borderRadius: 8, fontSize: 12, color: '#fff' }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#FF3131"
            strokeWidth={2}
            dot={{ fill: '#FF3131', r: 3 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 4: Verify test passes + tsc + commit + PR**

```bash
mkdir -p components/admin/analytics/charts tests/unit/components/admin/analytics/charts
pnpm test tests/unit/components/admin/analytics/charts/RevenueTrendChart.test.tsx
pnpm exec tsc --noEmit
git add components/admin/analytics/charts/RevenueTrendChart.tsx tests/unit/components/admin/analytics/charts/RevenueTrendChart.test.tsx
git commit -m "feat(admin-v2): add RevenueTrendChart Recharts wrapper for analytics"
git push -u origin wave6p6/task-3-revenue-trend-chart
gh pr create --title "feat(admin-v2): Phase 6 W2 RevenueTrendChart" --body "Thin Recharts LineChart wrapper for revenue-over-time. Dark theme, empty state, onPointClick prop (Phase 6.5 no-op). 2 tests passing."
```

---

### Task 4: `OrdersBarChart.tsx`

**Wave:** 2 | **Branch:** `wave6p6/task-4-orders-bar-chart` | **Model:** sonnet

**Schema realities for this task:** Same as Task 3. Props consume `TrendPoint[]` (`{ bucket: string; value: number }`) representing daily order counts; bars colored indigo.

**Files:**
- Create: `components/admin/analytics/charts/OrdersBarChart.tsx`
- Test: `tests/unit/components/admin/analytics/charts/OrdersBarChart.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/analytics/charts/OrdersBarChart.test.tsx
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

import { OrdersBarChart } from '@/components/admin/analytics/charts/OrdersBarChart'

describe('OrdersBarChart', () => {
  it('renders empty state when data is empty', () => {
    render(<OrdersBarChart data={[]} />)
    expect(screen.getByText(/no data/i)).toBeTruthy()
  })

  it('renders chart when data present', () => {
    render(<OrdersBarChart data={[{ bucket: '2026-05-30', value: 3 }]} />)
    expect(screen.getByTestId('bar-chart')).toBeTruthy()
    expect(screen.getByTestId('bar')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test (FAIL — module not found).**

- [ ] **Step 3: Write `components/admin/analytics/charts/OrdersBarChart.tsx`**

```tsx
'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export interface OrdersBarPoint {
  bucket: string
  value: number
}

export interface OrdersBarChartProps {
  data: OrdersBarPoint[]
  height?: number
  onPointClick?: (bucket: string) => void
}

export function OrdersBarChart({ data, height = 300, onPointClick }: OrdersBarChartProps) {
  void onPointClick // TODO(phase-6.5)
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
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
          <XAxis dataKey="bucket" stroke="#ffffff66" style={{ fontSize: 11 }} />
          <YAxis stroke="#ffffff66" style={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff14', borderRadius: 8, fontSize: 12, color: '#fff' }}
          />
          <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/analytics/charts/OrdersBarChart.test.tsx
pnpm exec tsc --noEmit
git add components/admin/analytics/charts/OrdersBarChart.tsx tests/unit/components/admin/analytics/charts/OrdersBarChart.test.tsx
git commit -m "feat(admin-v2): add OrdersBarChart Recharts wrapper"
git push -u origin wave6p6/task-4-orders-bar-chart
gh pr create --title "feat(admin-v2): Phase 6 W2 OrdersBarChart" --body "BarChart wrapper for daily order count. Dark theme, indigo bars. 2 tests passing."
```

---

### Task 5: `CustomerAcquisitionChart.tsx`

**Wave:** 2 | **Branch:** `wave6p6/task-5-customer-acquisition-chart` | **Model:** sonnet

**Schema realities for this task:** Consumes `AcquisitionPoint[]` (`{ bucket: string; newCustomers: number; returningCustomers: number }`). Stacked AreaChart — new (red) stacked on returning (indigo).

**Files:**
- Create: `components/admin/analytics/charts/CustomerAcquisitionChart.tsx`
- Test: `tests/unit/components/admin/analytics/charts/CustomerAcquisitionChart.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/analytics/charts/CustomerAcquisitionChart.test.tsx
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
  Legend: () => null,
}))

import { CustomerAcquisitionChart } from '@/components/admin/analytics/charts/CustomerAcquisitionChart'

describe('CustomerAcquisitionChart', () => {
  it('renders empty state when data is empty', () => {
    render(<CustomerAcquisitionChart data={[]} />)
    expect(screen.getByText(/no data/i)).toBeTruthy()
  })

  it('renders two stacked areas when data present', () => {
    render(<CustomerAcquisitionChart data={[{ bucket: '2026-05', newCustomers: 5, returningCustomers: 3 }]} />)
    expect(screen.getByTestId('area-chart')).toBeTruthy()
    expect(screen.getAllByTestId('area')).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write `components/admin/analytics/charts/CustomerAcquisitionChart.tsx`**

```tsx
'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export interface AcquisitionPoint {
  bucket: string
  newCustomers: number
  returningCustomers: number
}

export interface CustomerAcquisitionChartProps {
  data: AcquisitionPoint[]
  height?: number
  onPointClick?: (bucket: string) => void
}

export function CustomerAcquisitionChart({ data, height = 300, onPointClick }: CustomerAcquisitionChartProps) {
  void onPointClick
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
          <YAxis stroke="#ffffff66" style={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff14', borderRadius: 8, fontSize: 12, color: '#fff' }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#ffffffaa' }} />
          <Area
            type="monotone"
            dataKey="returningCustomers"
            stackId="1"
            stroke="#6366f1"
            fill="#6366f155"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="newCustomers"
            stackId="1"
            stroke="#FF3131"
            fill="#FF313155"
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
pnpm test tests/unit/components/admin/analytics/charts/CustomerAcquisitionChart.test.tsx
pnpm exec tsc --noEmit
git add components/admin/analytics/charts/CustomerAcquisitionChart.tsx tests/unit/components/admin/analytics/charts/CustomerAcquisitionChart.test.tsx
git commit -m "feat(admin-v2): add CustomerAcquisitionChart (stacked area)"
git push -u origin wave6p6/task-5-customer-acquisition-chart
gh pr create --title "feat(admin-v2): Phase 6 W2 CustomerAcquisitionChart" --body "Stacked AreaChart (new vs returning customers). 2 tests passing."
```

---

### Task 6: `OrderStatusDonut.tsx`

**Wave:** 2 | **Branch:** `wave6p6/task-6-order-status-donut` | **Model:** sonnet

**Schema realities for this task:** Consumes `StatusDonutSlice[]` (`{ status: string; count: number }`). 7 OrderStatus enum values: `PENDING | CONFIRMED | PROCESSING | SHIPPED | DELIVERED | CANCELLED | REFUNDED`. Define a color map keyed by uppercase status.

**Files:**
- Create: `components/admin/analytics/charts/OrderStatusDonut.tsx`
- Test: `tests/unit/components/admin/analytics/charts/OrderStatusDonut.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/analytics/charts/OrderStatusDonut.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ children }: { children?: React.ReactNode }) => <div data-testid="pie">{children}</div>,
  Cell: () => <div data-testid="cell" />,
  Tooltip: () => null,
  Legend: () => null,
}))

import { OrderStatusDonut } from '@/components/admin/analytics/charts/OrderStatusDonut'

describe('OrderStatusDonut', () => {
  it('renders empty state when data is empty', () => {
    render(<OrderStatusDonut data={[]} />)
    expect(screen.getByText(/no data/i)).toBeTruthy()
  })

  it('renders pie + cells when data present', () => {
    render(<OrderStatusDonut data={[{ status: 'DELIVERED', count: 3 }, { status: 'SHIPPED', count: 1 }]} />)
    expect(screen.getByTestId('pie-chart')).toBeTruthy()
    expect(screen.getAllByTestId('cell')).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write `components/admin/analytics/charts/OrderStatusDonut.tsx`**

```tsx
'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export interface StatusDonutSlice {
  status: string
  count: number
}

export interface OrderStatusDonutProps {
  data: StatusDonutSlice[]
  height?: number
}

const COLORS: Record<string, string> = {
  PENDING: '#fbbf24',
  CONFIRMED: '#6366f1',
  PROCESSING: '#8b5cf6',
  SHIPPED: '#06b6d4',
  DELIVERED: '#10b981',
  CANCELLED: '#ef4444',
  REFUNDED: '#f97316',
}

export function OrderStatusDonut({ data, height = 300 }: OrderStatusDonutProps) {
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
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="status"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.status} fill={COLORS[d.status] ?? '#6b7280'} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff14', borderRadius: 8, fontSize: 12, color: '#fff' }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#ffffffaa' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/analytics/charts/OrderStatusDonut.test.tsx
pnpm exec tsc --noEmit
git add components/admin/analytics/charts/OrderStatusDonut.tsx tests/unit/components/admin/analytics/charts/OrderStatusDonut.test.tsx
git commit -m "feat(admin-v2): add OrderStatusDonut PieChart wrapper"
git push -u origin wave6p6/task-6-order-status-donut
gh pr create --title "feat(admin-v2): Phase 6 W2 OrderStatusDonut" --body "Donut PieChart (innerRadius 60). 7 OrderStatus color map. 2 tests passing."
```

---

### Task 7: `TopProductsBar.tsx`

**Wave:** 2 | **Branch:** `wave6p6/task-7-top-products-bar` | **Model:** sonnet

**Schema realities for this task:** Consumes `TopProductPoint[]` (`{ productId: string; name: string; unitsSold: number; revenue: number }`). Horizontal BarChart, top 10 by revenue.

**Files:**
- Create: `components/admin/analytics/charts/TopProductsBar.tsx`
- Test: `tests/unit/components/admin/analytics/charts/TopProductsBar.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/analytics/charts/TopProductsBar.test.tsx
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
  Legend: () => null,
}))

import { TopProductsBar } from '@/components/admin/analytics/charts/TopProductsBar'

describe('TopProductsBar', () => {
  it('empty state on empty data', () => {
    render(<TopProductsBar data={[]} />)
    expect(screen.getByText(/no data/i)).toBeTruthy()
  })
  it('renders horizontal bar chart with data', () => {
    render(<TopProductsBar data={[{ productId: 'p1', name: 'Tee', unitsSold: 10, revenue: 250 }]} />)
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

export interface TopProductPoint {
  productId: string
  name: string
  unitsSold: number
  revenue: number
}

export interface TopProductsBarProps {
  data: TopProductPoint[]
  height?: number
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function TopProductsBar({ data, height = 300 }: TopProductsBarProps) {
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
          <XAxis type="number" stroke="#ffffff66" style={{ fontSize: 11 }} tickFormatter={(v) => fmt.format(Number(v))} />
          <YAxis type="category" dataKey="name" stroke="#ffffff66" style={{ fontSize: 11 }} width={120} />
          <Tooltip
            formatter={(v) => fmt.format(Number(v))}
            contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff14', borderRadius: 8, fontSize: 12, color: '#fff' }}
          />
          <Bar dataKey="revenue" fill="#FF3131" radius={[0, 4, 4, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/analytics/charts/TopProductsBar.test.tsx
pnpm exec tsc --noEmit
git add components/admin/analytics/charts/TopProductsBar.tsx tests/unit/components/admin/analytics/charts/TopProductsBar.test.tsx
git commit -m "feat(admin-v2): add TopProductsBar (horizontal BarChart)"
git push -u origin wave6p6/task-7-top-products-bar
gh pr create --title "feat(admin-v2): Phase 6 W2 TopProductsBar" --body "Horizontal BarChart for top products by revenue. 2 tests passing."
```

---

### Task 8: `MarginScatter.tsx`

**Wave:** 2 | **Branch:** `wave6p6/task-8-margin-scatter` | **Model:** sonnet

**Schema realities for this task:** Consumes `MarginScatterPoint[]` (`{ productId: string; name: string; price: number; marginPct: number; unitsSold: number }`). ScatterChart with price on X-axis, marginPct on Y-axis, unitsSold mapped to dot z-size.

**Files:**
- Create: `components/admin/analytics/charts/MarginScatter.tsx`
- Test: `tests/unit/components/admin/analytics/charts/MarginScatter.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/analytics/charts/MarginScatter.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  ScatterChart: ({ children }: { children: React.ReactNode }) => <div data-testid="scatter-chart">{children}</div>,
  Scatter: () => <div data-testid="scatter" />,
  XAxis: () => null,
  YAxis: () => null,
  ZAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}))

import { MarginScatter } from '@/components/admin/analytics/charts/MarginScatter'

describe('MarginScatter', () => {
  it('empty state', () => {
    render(<MarginScatter data={[]} />)
    expect(screen.getByText(/no data/i)).toBeTruthy()
  })
  it('renders scatter', () => {
    render(<MarginScatter data={[{ productId: 'p1', name: 'Tee', price: 25, marginPct: 50, unitsSold: 10 }]} />)
    expect(screen.getByTestId('scatter-chart')).toBeTruthy()
    expect(screen.getByTestId('scatter')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export interface MarginScatterPoint {
  productId: string
  name: string
  price: number
  marginPct: number
  unitsSold: number
}

export interface MarginScatterProps {
  data: MarginScatterPoint[]
  height?: number
  /** Custom axis labels (e.g. CustomersTab reuses this for LTV scatter). */
  xLabel?: string
  yLabel?: string
}

export function MarginScatter({ data, height = 300, xLabel = 'Price', yLabel = 'Margin %' }: MarginScatterProps) {
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
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
          <XAxis type="number" dataKey="price" name={xLabel} stroke="#ffffff66" style={{ fontSize: 11 }} />
          <YAxis type="number" dataKey="marginPct" name={yLabel} stroke="#ffffff66" style={{ fontSize: 11 }} />
          <ZAxis type="number" dataKey="unitsSold" range={[40, 400]} name="Units" />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff14', borderRadius: 8, fontSize: 12, color: '#fff' }}
          />
          <Scatter data={data} fill="#FF3131" isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/analytics/charts/MarginScatter.test.tsx
pnpm exec tsc --noEmit
git add components/admin/analytics/charts/MarginScatter.tsx tests/unit/components/admin/analytics/charts/MarginScatter.test.tsx
git commit -m "feat(admin-v2): add MarginScatter (ScatterChart) — reusable price × margin %"
git push -u origin wave6p6/task-8-margin-scatter
gh pr create --title "feat(admin-v2): Phase 6 W2 MarginScatter" --body "ScatterChart for product margin and LTV reuse (xLabel/yLabel props). 2 tests passing."
```

---

### Task 9: `RevenueExpenseArea.tsx`

**Wave:** 2 | **Branch:** `wave6p6/task-9-revenue-expense-area` | **Model:** sonnet

**Schema realities for this task:** Consumes `DualTrendPoint[]` (`{ bucket: string; revenue: number; expenses: number }`). Stacked AreaChart.

**Files:**
- Create: `components/admin/analytics/charts/RevenueExpenseArea.tsx`
- Test: `tests/unit/components/admin/analytics/charts/RevenueExpenseArea.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/analytics/charts/RevenueExpenseArea.test.tsx
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
  Legend: () => null,
}))

import { RevenueExpenseArea } from '@/components/admin/analytics/charts/RevenueExpenseArea'

describe('RevenueExpenseArea', () => {
  it('empty state', () => {
    render(<RevenueExpenseArea data={[]} />)
    expect(screen.getByText(/no data/i)).toBeTruthy()
  })
  it('renders 2 areas', () => {
    render(<RevenueExpenseArea data={[{ bucket: '2026-05', revenue: 1000, expenses: 400 }]} />)
    expect(screen.getAllByTestId('area')).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export interface DualTrendPoint {
  bucket: string
  revenue: number
  expenses: number
}

export interface RevenueExpenseAreaProps {
  data: DualTrendPoint[]
  height?: number
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function RevenueExpenseArea({ data, height = 300 }: RevenueExpenseAreaProps) {
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
          <YAxis stroke="#ffffff66" style={{ fontSize: 11 }} tickFormatter={(v) => fmt.format(Number(v))} />
          <Tooltip
            formatter={(v) => fmt.format(Number(v))}
            contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff14', borderRadius: 8, fontSize: 12, color: '#fff' }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#ffffffaa' }} />
          <Area
            type="monotone"
            dataKey="revenue"
            stackId="1"
            stroke="#10b981"
            fill="#10b98155"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="expenses"
            stackId="2"
            stroke="#ef4444"
            fill="#ef444455"
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
pnpm test tests/unit/components/admin/analytics/charts/RevenueExpenseArea.test.tsx
pnpm exec tsc --noEmit
git add components/admin/analytics/charts/RevenueExpenseArea.tsx tests/unit/components/admin/analytics/charts/RevenueExpenseArea.test.tsx
git commit -m "feat(admin-v2): add RevenueExpenseArea (stacked AreaChart)"
git push -u origin wave6p6/task-9-revenue-expense-area
gh pr create --title "feat(admin-v2): Phase 6 W2 RevenueExpenseArea" --body "Stacked AreaChart for revenue vs expenses. 2 tests passing."
```

---

### Task 10: `MarginTrendChart.tsx`

**Wave:** 2 | **Branch:** `wave6p6/task-10-margin-trend-chart` | **Model:** sonnet

**Schema realities for this task:** Consumes `TrendPoint[]` where `value` is a percentage (0-100). LineChart with `%` tick formatter.

**Files:**
- Create: `components/admin/analytics/charts/MarginTrendChart.tsx`
- Test: `tests/unit/components/admin/analytics/charts/MarginTrendChart.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/analytics/charts/MarginTrendChart.test.tsx
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
}))

import { MarginTrendChart } from '@/components/admin/analytics/charts/MarginTrendChart'

describe('MarginTrendChart', () => {
  it('empty state', () => {
    render(<MarginTrendChart data={[]} />)
    expect(screen.getByText(/no data/i)).toBeTruthy()
  })
  it('renders line chart', () => {
    render(<MarginTrendChart data={[{ bucket: '2026-05', value: 55 }]} />)
    expect(screen.getByTestId('line-chart')).toBeTruthy()
    expect(screen.getByTestId('line')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export interface MarginTrendPoint {
  bucket: string
  value: number // percentage 0-100
}

export interface MarginTrendChartProps {
  data: MarginTrendPoint[]
  height?: number
}

export function MarginTrendChart({ data, height = 300 }: MarginTrendChartProps) {
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
          <YAxis stroke="#ffffff66" style={{ fontSize: 11 }} tickFormatter={(v) => `${Number(v).toFixed(0)}%`} />
          <Tooltip
            formatter={(v) => `${Number(v).toFixed(1)}%`}
            contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff14', borderRadius: 8, fontSize: 12, color: '#fff' }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ fill: '#10b981', r: 3 }}
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
pnpm test tests/unit/components/admin/analytics/charts/MarginTrendChart.test.tsx
pnpm exec tsc --noEmit
git add components/admin/analytics/charts/MarginTrendChart.tsx tests/unit/components/admin/analytics/charts/MarginTrendChart.test.tsx
git commit -m "feat(admin-v2): add MarginTrendChart (LineChart, % axis)"
git push -u origin wave6p6/task-10-margin-trend-chart
gh pr create --title "feat(admin-v2): Phase 6 W2 MarginTrendChart" --body "LineChart for margin % over time. 2 tests passing."
```

---

### Task 11: `ExpenseCategoryDonut.tsx`

**Wave:** 2 | **Branch:** `wave6p6/task-11-expense-category-donut` | **Model:** sonnet

**Schema realities for this task:** Consumes `CategoryBreakdownSlice[]` (`{ categoryId: string; categoryName: string; color: string; amount: number }`). The slice's own `color` field comes from the ExpenseCategory table (defaults to `#6B7280`). Use that color directly per slice.

**Files:**
- Create: `components/admin/analytics/charts/ExpenseCategoryDonut.tsx`
- Test: `tests/unit/components/admin/analytics/charts/ExpenseCategoryDonut.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/analytics/charts/ExpenseCategoryDonut.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ children }: { children?: React.ReactNode }) => <div data-testid="pie">{children}</div>,
  Cell: () => <div data-testid="cell" />,
  Tooltip: () => null,
  Legend: () => null,
}))

import { ExpenseCategoryDonut } from '@/components/admin/analytics/charts/ExpenseCategoryDonut'

describe('ExpenseCategoryDonut', () => {
  it('empty state', () => {
    render(<ExpenseCategoryDonut data={[]} />)
    expect(screen.getByText(/no data/i)).toBeTruthy()
  })
  it('renders pie with one cell per slice', () => {
    render(<ExpenseCategoryDonut data={[
      { categoryId: 'cat1', categoryName: 'Marketing', color: '#FF3131', amount: 500 },
      { categoryId: 'cat2', categoryName: 'Hosting', color: '#6366f1', amount: 100 },
    ]} />)
    expect(screen.getAllByTestId('cell')).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export interface CategoryBreakdownSlice {
  categoryId: string
  categoryName: string
  color: string
  amount: number
}

export interface ExpenseCategoryDonutProps {
  data: CategoryBreakdownSlice[]
  height?: number
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function ExpenseCategoryDonut({ data, height = 300 }: ExpenseCategoryDonutProps) {
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
        <PieChart>
          <Pie
            data={data}
            dataKey="amount"
            nameKey="categoryName"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.categoryId} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => fmt.format(Number(v))}
            contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff14', borderRadius: 8, fontSize: 12, color: '#fff' }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#ffffffaa' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/analytics/charts/ExpenseCategoryDonut.test.tsx
pnpm exec tsc --noEmit
git add components/admin/analytics/charts/ExpenseCategoryDonut.tsx tests/unit/components/admin/analytics/charts/ExpenseCategoryDonut.test.tsx
git commit -m "feat(admin-v2): add ExpenseCategoryDonut PieChart"
git push -u origin wave6p6/task-11-expense-category-donut
gh pr create --title "feat(admin-v2): Phase 6 W2 ExpenseCategoryDonut" --body "Donut PieChart using per-slice ExpenseCategory.color. 2 tests passing."
```

---

### Task 12: `ExpenseMonthlyBar.tsx`

**Wave:** 2 | **Branch:** `wave6p6/task-12-expense-monthly-bar` | **Model:** sonnet

**Schema realities for this task:** Consumes `MonthlyExpenseBar[]` (`{ month: string; amount: number }`, where `month` is `YYYY-MM`).

**Files:**
- Create: `components/admin/analytics/charts/ExpenseMonthlyBar.tsx`
- Test: `tests/unit/components/admin/analytics/charts/ExpenseMonthlyBar.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/analytics/charts/ExpenseMonthlyBar.test.tsx
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

import { ExpenseMonthlyBar } from '@/components/admin/analytics/charts/ExpenseMonthlyBar'

describe('ExpenseMonthlyBar', () => {
  it('empty state', () => {
    render(<ExpenseMonthlyBar data={[]} />)
    expect(screen.getByText(/no data/i)).toBeTruthy()
  })
  it('renders bar chart', () => {
    render(<ExpenseMonthlyBar data={[{ month: '2026-05', amount: 1200 }]} />)
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

export interface MonthlyExpenseBar {
  month: string // YYYY-MM
  amount: number
}

export interface ExpenseMonthlyBarProps {
  data: MonthlyExpenseBar[]
  height?: number
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function ExpenseMonthlyBar({ data, height = 300 }: ExpenseMonthlyBarProps) {
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
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
          <XAxis dataKey="month" stroke="#ffffff66" style={{ fontSize: 11 }} />
          <YAxis stroke="#ffffff66" style={{ fontSize: 11 }} tickFormatter={(v) => fmt.format(Number(v))} />
          <Tooltip
            formatter={(v) => fmt.format(Number(v))}
            contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff14', borderRadius: 8, fontSize: 12, color: '#fff' }}
          />
          <Bar dataKey="amount" fill="#ef4444" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/analytics/charts/ExpenseMonthlyBar.test.tsx
pnpm exec tsc --noEmit
git add components/admin/analytics/charts/ExpenseMonthlyBar.tsx tests/unit/components/admin/analytics/charts/ExpenseMonthlyBar.test.tsx
git commit -m "feat(admin-v2): add ExpenseMonthlyBar BarChart"
git push -u origin wave6p6/task-12-expense-monthly-bar
gh pr create --title "feat(admin-v2): Phase 6 W2 ExpenseMonthlyBar" --body "BarChart for monthly expense totals (YYYY-MM bins, red bars). 2 tests passing."
```

---

## Wave 3 — 4 Inspectors + 4 utility components (8 parallel, after W1 merged)

### Task 13: `ExpenseInspector.tsx`

**Wave:** 3 | **Branch:** `wave6p6/task-13-expense-inspector` | **Model:** sonnet

**Schema realities for this task:**
- 11 ExpenseCategory rows are seeded — load via a server action or accept `categories` as a prop from the parent (recommended pattern: pass `categories: { id: string; name: string; color: string }[]` from `ExpensesTab`).
- `Expense.status` enum: 5 values. Default for new expense = `RECORDED`.
- `paymentMethod` is free-form string (cash, card, ach, paypal, etc.). Render as a free-text input + datalist suggestions.
- `deleteExpense` requires SUPER_ADMIN — gate the Delete button. Pass `isSuperAdmin: boolean` from the parent. When false, render the button as `disabled` with a tooltip `title="SUPER_ADMIN only"`.
- Import `ExpenseDetailFull` ONLY from `@/app/admin/analytics/actions` (NOT `@/lib/admin/analytics`) — cross-cutting note 1.
- For create mode (`detail === null && createMode === true`), show empty form. For edit mode (`detail !== null`), prefill values.

**Files:**
- Create: `components/admin/analytics/inspectors/ExpenseInspector.tsx`
- Test: `tests/unit/components/admin/analytics/inspectors/ExpenseInspector.test.tsx`

#### Steps

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/admin/analytics/inspectors/ExpenseInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const createExpense = vi.fn()
const updateExpense = vi.fn()
const deleteExpense = vi.fn()

vi.mock('@/app/admin/analytics/actions', () => ({
  createExpense: (...args: unknown[]) => createExpense(...args),
  updateExpense: (...args: unknown[]) => updateExpense(...args),
  deleteExpense: (...args: unknown[]) => deleteExpense(...args),
}))
vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { ExpenseInspector } from '@/components/admin/analytics/inspectors/ExpenseInspector'

const categories = [
  { id: 'cat1', name: 'Marketing', color: '#FF3131' },
  { id: 'cat2', name: 'Hosting', color: '#6366f1' },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ExpenseInspector', () => {
  it('renders empty form in create mode', () => {
    render(
      <ExpenseInspector
        open
        detail={null}
        createMode
        categories={categories}
        isSuperAdmin
        onClose={() => {}}
        onSaved={() => {}}
      />
    )
    expect(screen.getByLabelText(/description/i)).toBeTruthy()
  })

  it('prefills values in edit mode', () => {
    render(
      <ExpenseInspector
        open
        detail={{
          id: 'e1',
          amount: 100, date: new Date('2026-05-15'),
          description: 'FB ads', vendor: 'Meta',
          receiptUrl: null, notes: null,
          isTaxDeductible: true, taxCategory: null,
          paymentMethod: 'card', isRecurring: false, recurringFrequency: null,
          status: 'PAID', invoiceId: null,
          category: { id: 'cat1', name: 'Marketing', slug: 'marketing', color: '#FF3131', icon: null },
          createdAt: new Date(), updatedAt: new Date(),
        }}
        categories={categories}
        isSuperAdmin
        onClose={() => {}}
        onSaved={() => {}}
      />
    )
    const desc = screen.getByLabelText(/description/i) as HTMLInputElement
    expect(desc.value).toBe('FB ads')
  })

  it('calls createExpense on save in create mode', async () => {
    createExpense.mockResolvedValue({ ok: true, data: { id: 'e2' } })
    const onSaved = vi.fn()
    render(
      <ExpenseInspector
        open
        detail={null}
        createMode
        categories={categories}
        isSuperAdmin
        onClose={() => {}}
        onSaved={onSaved}
      />
    )
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'New' } })
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(createExpense).toHaveBeenCalled())
    expect(onSaved).toHaveBeenCalledWith('e2')
  })

  it('disables Delete when not SUPER_ADMIN', () => {
    render(
      <ExpenseInspector
        open
        detail={{
          id: 'e1', amount: 50, date: new Date(), description: 'x', vendor: null,
          receiptUrl: null, notes: null, isTaxDeductible: false, taxCategory: null,
          paymentMethod: null, isRecurring: false, recurringFrequency: null,
          status: 'RECORDED', invoiceId: null,
          category: { id: 'cat1', name: 'Marketing', slug: 'marketing', color: '#FF3131', icon: null },
          createdAt: new Date(), updatedAt: new Date(),
        }}
        categories={categories}
        isSuperAdmin={false}
        onClose={() => {}}
        onSaved={() => {}}
      />
    )
    const del = screen.getByRole('button', { name: /delete/i }) as HTMLButtonElement
    expect(del.disabled).toBe(true)
    expect(del.title).toMatch(/SUPER_ADMIN/i)
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write `components/admin/analytics/inspectors/ExpenseInspector.tsx`**

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import type { ExpenseDetailFull } from '@/app/admin/analytics/actions'
import {
  createExpense,
  updateExpense,
  deleteExpense,
} from '@/app/admin/analytics/actions'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'

export interface ExpenseCategoryOption {
  id: string
  name: string
  color: string
}

const STATUSES = ['RECORDED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PAID'] as const
type Status = typeof STATUSES[number]

export interface ExpenseInspectorProps {
  open: boolean
  detail: ExpenseDetailFull | null
  createMode?: boolean
  categories: ExpenseCategoryOption[]
  isSuperAdmin: boolean
  onClose: () => void
  onSaved?: (id: string) => void
  onDeleted?: (id: string) => void
}

function toIsoDate(d: Date | null | undefined): string {
  if (!d) return ''
  return new Date(d).toISOString().slice(0, 10)
}

export function ExpenseInspector({
  open,
  detail,
  createMode = false,
  categories,
  isSuperAdmin,
  onClose,
  onSaved,
  onDeleted,
}: ExpenseInspectorProps) {
  const [pending, startTransition] = useTransition()
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState('')
  const [description, setDescription] = useState('')
  const [vendor, setVendor] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [isTaxDeductible, setIsTaxDeductible] = useState(false)
  const [taxCategory, setTaxCategory] = useState('')
  const [notes, setNotes] = useState('')
  const [receiptUrl, setReceiptUrl] = useState('')
  const [status, setStatus] = useState<Status>('RECORDED')

  useEffect(() => {
    if (!open) return
    if (detail) {
      setCategoryId(detail.category.id)
      setAmount(detail.amount)
      setDate(toIsoDate(detail.date))
      setDescription(detail.description)
      setVendor(detail.vendor ?? '')
      setPaymentMethod(detail.paymentMethod ?? '')
      setIsTaxDeductible(detail.isTaxDeductible)
      setTaxCategory(detail.taxCategory ?? '')
      setNotes(detail.notes ?? '')
      setReceiptUrl(detail.receiptUrl ?? '')
      setStatus(detail.status as Status)
    } else if (createMode) {
      setCategoryId(categories[0]?.id ?? '')
      setAmount(0)
      setDate(new Date().toISOString().slice(0, 10))
      setDescription('')
      setVendor('')
      setPaymentMethod('')
      setIsTaxDeductible(false)
      setTaxCategory('')
      setNotes('')
      setReceiptUrl('')
      setStatus('RECORDED')
    }
  }, [open, detail, createMode, categories])

  const handleSave = () => {
    const dateObj = new Date(date)
    if (Number.isNaN(dateObj.getTime())) {
      toast.error('Invalid date')
      return
    }
    startTransition(async () => {
      if (createMode || !detail) {
        const r = await createExpense({
          categoryId,
          amount,
          date: dateObj,
          description,
          vendor: vendor || null,
          paymentMethod: paymentMethod || null,
          isTaxDeductible,
          taxCategory: taxCategory || null,
          notes: notes || null,
          receiptUrl: receiptUrl || null,
          status,
        })
        if (r.ok) {
          toast.success('Expense created')
          onSaved?.(r.data?.id ?? '')
          onClose()
        } else {
          toast.error(r.error)
        }
      } else {
        const r = await updateExpense(detail.id, {
          categoryId,
          amount,
          date: dateObj,
          description,
          vendor: vendor || null,
          paymentMethod: paymentMethod || null,
          isTaxDeductible,
          taxCategory: taxCategory || null,
          notes: notes || null,
          receiptUrl: receiptUrl || null,
          status,
        })
        if (r.ok) {
          toast.success('Expense updated')
          onSaved?.(detail.id)
          onClose()
        } else {
          toast.error(r.error)
        }
      }
    })
  }

  const handleDelete = () => {
    if (!detail) return
    startTransition(async () => {
      const r = await deleteExpense(detail.id)
      if (r.ok) {
        toast.success('Expense deleted')
        onDeleted?.(detail.id)
        onClose()
      } else {
        toast.error(r.error)
      }
    })
  }

  return (
    <Inspector open={open} onClose={onClose} title={detail ? 'Edit Expense' : 'New Expense'} width={460}>
      <div className="space-y-3 text-sm">
        <label className="block">
          <span className="text-white/60 text-xs">Description</span>
          <input
            aria-label="description"
            className="w-full mt-1 bg-white/[0.04] border border-white/8 rounded-md px-3 py-2 text-white"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-white/60 text-xs">Amount</span>
          <input
            aria-label="amount"
            type="number"
            step="0.01"
            className="w-full mt-1 bg-white/[0.04] border border-white/8 rounded-md px-3 py-2 text-white"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </label>
        <label className="block">
          <span className="text-white/60 text-xs">Date</span>
          <input
            type="date"
            className="w-full mt-1 bg-white/[0.04] border border-white/8 rounded-md px-3 py-2 text-white"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-white/60 text-xs">Category</span>
          <select
            className="w-full mt-1 bg-white/[0.04] border border-white/8 rounded-md px-3 py-2 text-white"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-white/60 text-xs">Vendor</span>
          <input
            className="w-full mt-1 bg-white/[0.04] border border-white/8 rounded-md px-3 py-2 text-white"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-white/60 text-xs">Payment Method</span>
          <input
            list="payment-method-list"
            className="w-full mt-1 bg-white/[0.04] border border-white/8 rounded-md px-3 py-2 text-white"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          />
          <datalist id="payment-method-list">
            <option value="card" />
            <option value="cash" />
            <option value="ach" />
            <option value="paypal" />
            <option value="stripe" />
          </datalist>
        </label>
        <label className="flex items-center gap-2 text-white/80 text-xs">
          <input
            type="checkbox"
            checked={isTaxDeductible}
            onChange={(e) => setIsTaxDeductible(e.target.checked)}
          />
          Tax deductible
        </label>
        {isTaxDeductible && (
          <label className="block">
            <span className="text-white/60 text-xs">Tax Category</span>
            <input
              className="w-full mt-1 bg-white/[0.04] border border-white/8 rounded-md px-3 py-2 text-white"
              value={taxCategory}
              onChange={(e) => setTaxCategory(e.target.value)}
            />
          </label>
        )}
        <label className="block">
          <span className="text-white/60 text-xs">Status</span>
          <select
            className="w-full mt-1 bg-white/[0.04] border border-white/8 rounded-md px-3 py-2 text-white"
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-white/60 text-xs">Notes</span>
          <textarea
            className="w-full mt-1 bg-white/[0.04] border border-white/8 rounded-md px-3 py-2 text-white min-h-[60px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-white/60 text-xs">Receipt URL</span>
          <input
            className="w-full mt-1 bg-white/[0.04] border border-white/8 rounded-md px-3 py-2 text-white"
            value={receiptUrl}
            onChange={(e) => setReceiptUrl(e.target.value)}
          />
        </label>

        <div className="flex items-center justify-between pt-3 border-t border-white/8">
          {detail ? (
            <button
              type="button"
              disabled={!isSuperAdmin || pending}
              title={isSuperAdmin ? 'Delete expense' : 'SUPER_ADMIN only'}
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
mkdir -p components/admin/analytics/inspectors tests/unit/components/admin/analytics/inspectors
pnpm test tests/unit/components/admin/analytics/inspectors/ExpenseInspector.test.tsx
pnpm exec tsc --noEmit
git add components/admin/analytics/inspectors/ExpenseInspector.tsx tests/unit/components/admin/analytics/inspectors/ExpenseInspector.test.tsx
git commit -m "feat(admin-v2): add ExpenseInspector (create + edit + SUPER_ADMIN delete gate)"
git push -u origin wave6p6/task-13-expense-inspector
gh pr create --title "feat(admin-v2): Phase 6 W3 ExpenseInspector" --body "Full Expense form. createExpense / updateExpense / deleteExpense (gated). isSuperAdmin disables Delete with tooltip. 4 tests passing."
```

---

### Task 14: `GoalsInspector.tsx`

**Wave:** 3 | **Branch:** `wave6p6/task-14-goals-inspector` | **Model:** sonnet

**Schema realities for this task:**
- SalesGoals is a singleton (id="default"). 5 number inputs: daily/weekly/monthly/quarterly/yearly.
- `updateSalesGoals` server action handles upsert + SalesGoalHistory append inside `$transaction`.
- Show "Last updated" timestamp at the top (read-only).
- Import `SalesGoalsRow` from `@/app/admin/analytics/actions` (not from `@/lib/admin/analytics`).

**Files:**
- Create: `components/admin/analytics/inspectors/GoalsInspector.tsx`
- Test: `tests/unit/components/admin/analytics/inspectors/GoalsInspector.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/analytics/inspectors/GoalsInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const updateSalesGoals = vi.fn()
vi.mock('@/app/admin/analytics/actions', () => ({
  updateSalesGoals: (...a: unknown[]) => updateSalesGoals(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { GoalsInspector } from '@/components/admin/analytics/inspectors/GoalsInspector'

const goals = {
  id: 'default',
  dailyTarget: 500, weeklyTarget: 3500, monthlyTarget: 15000,
  quarterlyTarget: 45000, yearlyTarget: 180000,
  updatedAt: new Date('2026-05-01'),
}

beforeEach(() => vi.clearAllMocks())

describe('GoalsInspector', () => {
  it('shows 5 prefilled target inputs', () => {
    render(<GoalsInspector open goals={goals} onClose={() => {}} onSaved={() => {}} />)
    expect((screen.getByLabelText(/daily target/i) as HTMLInputElement).value).toBe('500')
    expect((screen.getByLabelText(/monthly target/i) as HTMLInputElement).value).toBe('15000')
  })

  it('saves via updateSalesGoals', async () => {
    updateSalesGoals.mockResolvedValue({ ok: true })
    const onSaved = vi.fn()
    render(<GoalsInspector open goals={goals} onClose={() => {}} onSaved={onSaved} />)
    fireEvent.change(screen.getByLabelText(/daily target/i), { target: { value: '600' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(updateSalesGoals).toHaveBeenCalled())
    expect(updateSalesGoals.mock.calls[0][0].dailyTarget).toBe(600)
    expect(onSaved).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import type { SalesGoalsRow } from '@/app/admin/analytics/actions'
import { updateSalesGoals } from '@/app/admin/analytics/actions'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'

export interface GoalsInspectorProps {
  open: boolean
  goals: SalesGoalsRow
  onClose: () => void
  onSaved?: () => void
}

export function GoalsInspector({ open, goals, onClose, onSaved }: GoalsInspectorProps) {
  const [pending, startTransition] = useTransition()
  const [daily, setDaily] = useState(goals.dailyTarget)
  const [weekly, setWeekly] = useState(goals.weeklyTarget)
  const [monthly, setMonthly] = useState(goals.monthlyTarget)
  const [quarterly, setQuarterly] = useState(goals.quarterlyTarget)
  const [yearly, setYearly] = useState(goals.yearlyTarget)

  useEffect(() => {
    if (!open) return
    setDaily(goals.dailyTarget)
    setWeekly(goals.weeklyTarget)
    setMonthly(goals.monthlyTarget)
    setQuarterly(goals.quarterlyTarget)
    setYearly(goals.yearlyTarget)
  }, [open, goals])

  const handleSave = () => {
    startTransition(async () => {
      const r = await updateSalesGoals({
        dailyTarget: daily,
        weeklyTarget: weekly,
        monthlyTarget: monthly,
        quarterlyTarget: quarterly,
        yearlyTarget: yearly,
      })
      if (r.ok) {
        toast.success('Sales goals updated')
        onSaved?.()
        onClose()
      } else {
        toast.error(r.error)
      }
    })
  }

  return (
    <Inspector open={open} onClose={onClose} title="Edit Sales Goals" width={400}>
      <div className="space-y-3 text-sm">
        <p className="text-xs text-white/40">
          Last updated:{' '}
          {goals.updatedAt.getTime() === 0 ? 'never' : goals.updatedAt.toLocaleString()}
        </p>
        {[
          ['Daily target', daily, setDaily, 'daily-target'],
          ['Weekly target', weekly, setWeekly, 'weekly-target'],
          ['Monthly target', monthly, setMonthly, 'monthly-target'],
          ['Quarterly target', quarterly, setQuarterly, 'quarterly-target'],
          ['Yearly target', yearly, setYearly, 'yearly-target'],
        ].map(([label, value, setter, id]) => {
          const setVal = setter as (n: number) => void
          return (
            <label key={id as string} className="block">
              <span className="text-white/60 text-xs">{label as string}</span>
              <input
                id={id as string}
                aria-label={label as string}
                type="number"
                step="1"
                min="0"
                value={value as number}
                onChange={(e) => setVal(Number(e.target.value))}
                className="w-full mt-1 bg-white/[0.04] border border-white/8 rounded-md px-3 py-2 text-white"
              />
            </label>
          )
        })}
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
pnpm test tests/unit/components/admin/analytics/inspectors/GoalsInspector.test.tsx
pnpm exec tsc --noEmit
git add components/admin/analytics/inspectors/GoalsInspector.tsx tests/unit/components/admin/analytics/inspectors/GoalsInspector.test.tsx
git commit -m "feat(admin-v2): add GoalsInspector for SalesGoals singleton"
git push -u origin wave6p6/task-14-goals-inspector
gh pr create --title "feat(admin-v2): Phase 6 W3 GoalsInspector" --body "Edit 5 SalesGoals targets. updateSalesGoals \$transaction. 2 tests passing."
```

---

### Task 15: `CustomerInspector.tsx`

**Wave:** 3 | **Branch:** `wave6p6/task-15-customer-inspector` | **Model:** sonnet

**Schema realities for this task:** Read-only Inspector. Shows email, name, signup date, totalSpent, totalOrders, AOV, loyaltyTierName, lastOrderDate. Has "Open customer profile →" link to `/admin/customers/${id}` (V1 page; Phase 8 will V2 it).

**Files:**
- Create: `components/admin/analytics/inspectors/CustomerInspector.tsx`
- Test: `tests/unit/components/admin/analytics/inspectors/CustomerInspector.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/analytics/inspectors/CustomerInspector.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { CustomerInspector } from '@/components/admin/analytics/inspectors/CustomerInspector'

const customer = {
  id: 'c1', email: 'a@e.com', name: 'Ada',
  createdAt: new Date('2026-01-01'),
  totalSpent: 250, totalOrders: 4, avgOrderValue: 62.5,
  lastOrderDate: new Date('2026-05-20'),
  loyaltyTierName: 'Gold',
}

describe('CustomerInspector', () => {
  it('renders read-only customer summary', () => {
    render(<CustomerInspector open detail={customer} onClose={() => {}} />)
    expect(screen.getByText(/a@e.com/i)).toBeTruthy()
    expect(screen.getByText(/Gold/)).toBeTruthy()
  })
  it('exposes link to customer profile', () => {
    render(<CustomerInspector open detail={customer} onClose={() => {}} />)
    const link = screen.getByRole('link', { name: /customer profile/i }) as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/admin/customers/c1')
  })
  it('renders loading state when detail is null', () => {
    render(<CustomerInspector open detail={null} onClose={() => {}} />)
    expect(screen.getByText(/loading/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import Link from 'next/link'
import type { CustomerDetailFull } from '@/app/admin/analytics/actions'
import { Inspector } from '@/components/ui/Inspector'

export interface CustomerInspectorProps {
  open: boolean
  detail: CustomerDetailFull | null
  onClose: () => void
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })

export function CustomerInspector({ open, detail, onClose }: CustomerInspectorProps) {
  return (
    <Inspector open={open} onClose={onClose} title="Customer" width={400}>
      {!detail ? (
        <div className="text-white/40 text-sm">Loading…</div>
      ) : (
        <div className="space-y-3 text-sm text-white/80">
          <div>
            <div className="text-white/40 text-xs">Email</div>
            <div className="font-medium">{detail.email}</div>
          </div>
          {detail.name && (
            <div>
              <div className="text-white/40 text-xs">Name</div>
              <div>{detail.name}</div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-white/40 text-xs">Total Spent</div>
              <div>{fmt.format(detail.totalSpent)}</div>
            </div>
            <div>
              <div className="text-white/40 text-xs">Orders</div>
              <div>{detail.totalOrders}</div>
            </div>
            <div>
              <div className="text-white/40 text-xs">AOV</div>
              <div>{fmt.format(detail.avgOrderValue)}</div>
            </div>
            <div>
              <div className="text-white/40 text-xs">Loyalty Tier</div>
              <div>{detail.loyaltyTierName ?? '—'}</div>
            </div>
          </div>
          <div>
            <div className="text-white/40 text-xs">Signed Up</div>
            <div>{detail.createdAt.toLocaleDateString()}</div>
          </div>
          <div>
            <div className="text-white/40 text-xs">Last Order</div>
            <div>{detail.lastOrderDate ? detail.lastOrderDate.toLocaleDateString() : '—'}</div>
          </div>
          <div className="pt-3 border-t border-white/8">
            <Link
              href={`/admin/customers/${detail.id}`}
              className="text-xs text-[#FF3131] hover:text-[#ff4747]"
            >
              Open customer profile →
            </Link>
          </div>
        </div>
      )}
    </Inspector>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/analytics/inspectors/CustomerInspector.test.tsx
pnpm exec tsc --noEmit
git add components/admin/analytics/inspectors/CustomerInspector.tsx tests/unit/components/admin/analytics/inspectors/CustomerInspector.test.tsx
git commit -m "feat(admin-v2): add CustomerInspector (read-only summary + profile link)"
git push -u origin wave6p6/task-15-customer-inspector
gh pr create --title "feat(admin-v2): Phase 6 W3 CustomerInspector" --body "Read-only summary. Open profile link. 3 tests passing."
```

---

### Task 16: `ProductInspector.tsx`

**Wave:** 3 | **Branch:** `wave6p6/task-16-product-inspector` | **Model:** sonnet

**Schema realities for this task:** Read-only Inspector. Shows name, image (from images[0]), basePrice, unitsSold (in range), revenue, cost, grossMargin, marginPct. "Open product details →" link to `/admin/products/${id}`.

**Files:**
- Create: `components/admin/analytics/inspectors/ProductInspector.tsx`
- Test: `tests/unit/components/admin/analytics/inspectors/ProductInspector.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/analytics/inspectors/ProductInspector.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ProductInspector } from '@/components/admin/analytics/inspectors/ProductInspector'

const detail = {
  id: 'p1', name: 'Tee',
  imageUrl: null,
  basePrice: 25,
  unitsSold: 10, revenue: 250, cost: 60, grossMargin: 190, marginPct: 76,
  rangeStart: new Date('2026-04-30'), rangeEnd: new Date('2026-05-30'),
}

describe('ProductInspector', () => {
  it('renders product summary', () => {
    render(<ProductInspector open detail={detail} onClose={() => {}} />)
    expect(screen.getByText(/Tee/)).toBeTruthy()
    expect(screen.getByText(/76/)).toBeTruthy()
  })
  it('exposes product details link', () => {
    render(<ProductInspector open detail={detail} onClose={() => {}} />)
    const link = screen.getByRole('link', { name: /product details/i }) as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/admin/products/p1')
  })
  it('loading state on null detail', () => {
    render(<ProductInspector open detail={null} onClose={() => {}} />)
    expect(screen.getByText(/loading/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import Link from 'next/link'
import type { ProductFinancialDetailFull } from '@/app/admin/analytics/actions'
import { Inspector } from '@/components/ui/Inspector'

export interface ProductInspectorProps {
  open: boolean
  detail: ProductFinancialDetailFull | null
  onClose: () => void
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })

export function ProductInspector({ open, detail, onClose }: ProductInspectorProps) {
  return (
    <Inspector open={open} onClose={onClose} title="Product" width={400}>
      {!detail ? (
        <div className="text-white/40 text-sm">Loading…</div>
      ) : (
        <div className="space-y-3 text-sm text-white/80">
          <div className="flex items-start gap-3">
            {detail.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={detail.imageUrl} alt={detail.name} className="w-16 h-16 rounded-md object-cover bg-white/[0.04]" />
            )}
            <div className="flex-1">
              <div className="font-medium text-white">{detail.name}</div>
              <div className="text-white/40 text-xs">Base price: {fmt.format(detail.basePrice)}</div>
            </div>
          </div>
          <div className="text-xs text-white/40">
            Window: {detail.rangeStart.toLocaleDateString()} → {detail.rangeEnd.toLocaleDateString()}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-white/40 text-xs">Units sold</div>
              <div>{detail.unitsSold}</div>
            </div>
            <div>
              <div className="text-white/40 text-xs">Revenue</div>
              <div>{fmt.format(detail.revenue)}</div>
            </div>
            <div>
              <div className="text-white/40 text-xs">Cost</div>
              <div>{fmt.format(detail.cost)}</div>
            </div>
            <div>
              <div className="text-white/40 text-xs">Gross margin</div>
              <div>
                {fmt.format(detail.grossMargin)} ({detail.marginPct.toFixed(1)}%)
              </div>
            </div>
          </div>
          <div className="pt-3 border-t border-white/8">
            <Link
              href={`/admin/products/${detail.id}`}
              className="text-xs text-[#FF3131] hover:text-[#ff4747]"
            >
              Open product details →
            </Link>
          </div>
        </div>
      )}
    </Inspector>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/analytics/inspectors/ProductInspector.test.tsx
pnpm exec tsc --noEmit
git add components/admin/analytics/inspectors/ProductInspector.tsx tests/unit/components/admin/analytics/inspectors/ProductInspector.test.tsx
git commit -m "feat(admin-v2): add ProductInspector (read-only financial summary)"
git push -u origin wave6p6/task-16-product-inspector
gh pr create --title "feat(admin-v2): Phase 6 W3 ProductInspector" --body "Read-only product financial summary + details link. 3 tests passing."
```

---

### Task 17: `LiveFeedSidebar.tsx`

**Wave:** 3 | **Branch:** `wave6p6/task-17-live-feed-sidebar` | **Model:** sonnet

**Schema realities for this task:**
- Polls `/api/admin/sales/recent` every 5 seconds. Endpoint exists (used by V1 `RealTimeSalesFeed`).
- Response shape (verified from V1 client): `{ sales: SaleItem[] }` where `SaleItem = { id, orderNumber, customerName, total, itemCount, createdAt, status }`.
- Mobile: collapsed accordion (controlled via `open` state, default false on `<768px` viewport).
- V2 dark theme: `bg-neutral-900/60`, `border-white/8`, `text-white/80`. NO `dark:` modifiers.

**Files:**
- Create: `components/admin/analytics/LiveFeedSidebar.tsx`
- Test: `tests/unit/components/admin/analytics/LiveFeedSidebar.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/analytics/LiveFeedSidebar.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

import { LiveFeedSidebar } from '@/components/admin/analytics/LiveFeedSidebar'

describe('LiveFeedSidebar', () => {
  it('fetches /api/admin/sales/recent on mount and renders sales', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        sales: [
          { id: 's1', orderNumber: '1001', customerName: 'Ada', total: 50, itemCount: 1,
            createdAt: new Date().toISOString(), status: 'CONFIRMED' },
        ],
      }),
    })
    render(<LiveFeedSidebar />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/sales/recent'))
    await waitFor(() => expect(screen.queryByText(/1001/)).toBeTruthy())
  })

  it('renders empty state when no sales', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ sales: [] }) })
    render(<LiveFeedSidebar />)
    await waitFor(() => expect(screen.queryByText(/no recent/i)).toBeTruthy())
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { useEffect, useState } from 'react'

interface SaleItem {
  id: string
  orderNumber: string
  customerName: string
  total: number
  itemCount: number
  createdAt: string
  status: string
}

export interface LiveFeedSidebarProps {
  refreshIntervalMs?: number
  maxItems?: number
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function LiveFeedSidebar({ refreshIntervalMs = 5000, maxItems = 10 }: LiveFeedSidebarProps) {
  const [sales, setSales] = useState<SaleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fetchOnce = async () => {
      try {
        const res = await fetch('/api/admin/sales/recent')
        if (!res.ok) return
        const json = (await res.json()) as { sales: SaleItem[] }
        if (cancelled) return
        setSales((json.sales ?? []).slice(0, maxItems))
      } catch {
        // network error — keep current sales
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchOnce()
    const id = setInterval(fetchOnce, refreshIntervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [refreshIntervalMs, maxItems])

  return (
    <div className="bg-neutral-900/60 border border-white/8 rounded-md">
      <button
        type="button"
        className="w-full sm:hidden flex items-center justify-between px-3 py-2 text-xs text-white/60"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <span>Live feed</span>
        <span>{expanded ? '−' : '+'}</span>
      </button>
      <div className={`${expanded ? 'block' : 'hidden'} sm:block`}>
        <div className="px-3 py-2 border-b border-white/8 text-xs text-white/40">Live feed</div>
        <ul className="divide-y divide-white/8 max-h-[480px] overflow-y-auto">
          {loading && sales.length === 0 ? (
            <li className="px-3 py-4 text-xs text-white/40">Loading…</li>
          ) : sales.length === 0 ? (
            <li className="px-3 py-4 text-xs text-white/40">No recent sales</li>
          ) : (
            sales.map((s) => (
              <li key={s.id} className="px-3 py-2 text-xs text-white/80 flex items-center justify-between">
                <div>
                  <div className="font-medium">#{s.orderNumber}</div>
                  <div className="text-white/50">{s.customerName} · {s.itemCount} item{s.itemCount === 1 ? '' : 's'}</div>
                </div>
                <div className="text-white">{fmt.format(s.total)}</div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/analytics/LiveFeedSidebar.test.tsx
pnpm exec tsc --noEmit
git add components/admin/analytics/LiveFeedSidebar.tsx tests/unit/components/admin/analytics/LiveFeedSidebar.test.tsx
git commit -m "feat(admin-v2): add LiveFeedSidebar (polls /api/admin/sales/recent, mobile accordion)"
git push -u origin wave6p6/task-17-live-feed-sidebar
gh pr create --title "feat(admin-v2): Phase 6 W3 LiveFeedSidebar" --body "Polls /api/admin/sales/recent every 5s. Mobile collapsed accordion. 2 tests passing."
```

---

### Task 18: `PeriodGridTable.tsx`

**Wave:** 3 | **Branch:** `wave6p6/task-18-period-grid-table` | **Model:** sonnet

**Schema realities for this task:** Consumes `FinancialSnapshotRow[]` (declared locally; do NOT import from `@/lib/admin/analytics` because parent passes pre-loaded data). Columns: period (formatted YYYY-MM) · revenue · COGS · gross profit · expenses · net profit · margin %. Show "—" for null/zero cells. Show a 4-row skeleton when `rows === null` (loading flag — keeps the prop signature explicit).

**Files:**
- Create: `components/admin/analytics/PeriodGridTable.tsx`
- Test: `tests/unit/components/admin/analytics/PeriodGridTable.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/analytics/PeriodGridTable.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { PeriodGridTable } from '@/components/admin/analytics/PeriodGridTable'

describe('PeriodGridTable', () => {
  it('renders empty state when no rows', () => {
    render(<PeriodGridTable rows={[]} />)
    expect(screen.getByText(/no period data/i)).toBeTruthy()
  })

  it('renders skeleton when rows is null (loading)', () => {
    render(<PeriodGridTable rows={null} />)
    expect(screen.getByTestId('period-grid-skeleton')).toBeTruthy()
  })

  it('renders one row per snapshot', () => {
    render(<PeriodGridTable rows={[
      { id: 's1', date: new Date('2026-04-01'), periodType: 'monthly',
        totalRevenue: 10000, totalOrders: 100, avgOrderValue: 100,
        totalCOGS: 4000, totalExpenses: 2000, grossProfit: 6000, grossMargin: 60,
        netProfit: 4000, netMargin: 40, salesTaxCollected: 800,
        inventoryValue: 0, cashOnHand: null },
    ]} />)
    expect(screen.getByText(/2026-04/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

export interface FinancialSnapshotRow {
  id: string
  date: Date
  periodType: string
  totalRevenue: number
  totalOrders: number
  avgOrderValue: number
  totalCOGS: number
  totalExpenses: number
  grossProfit: number
  grossMargin: number
  netProfit: number
  netMargin: number
  salesTaxCollected: number
  inventoryValue: number
  cashOnHand: number | null
}

export interface PeriodGridTableProps {
  /** null = loading, [] = empty */
  rows: FinancialSnapshotRow[] | null
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const dash = (n: number) => (n === 0 ? '—' : fmt.format(n))
const dashPct = (n: number) => (n === 0 ? '—' : `${n.toFixed(1)}%`)

function isoMonth(d: Date) {
  return d.toISOString().slice(0, 7)
}

export function PeriodGridTable({ rows }: PeriodGridTableProps) {
  if (rows === null) {
    return (
      <div data-testid="period-grid-skeleton" className="space-y-2" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 bg-white/[0.03] border border-white/8 rounded-md animate-pulse" />
        ))}
      </div>
    )
  }
  if (rows.length === 0) {
    return <div className="text-xs text-white/40 py-4">No period data yet — backfill in progress.</div>
  }
  return (
    <div className="overflow-x-auto border border-white/8 rounded-md">
      <table className="w-full text-xs text-left">
        <thead className="bg-white/[0.04] text-white/50">
          <tr>
            <th className="px-3 py-2">Period</th>
            <th className="px-3 py-2">Revenue</th>
            <th className="px-3 py-2">COGS</th>
            <th className="px-3 py-2">Gross Profit</th>
            <th className="px-3 py-2">Expenses</th>
            <th className="px-3 py-2">Net Profit</th>
            <th className="px-3 py-2">Margin %</th>
          </tr>
        </thead>
        <tbody className="text-white/80">
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-white/8">
              <td className="px-3 py-2">{isoMonth(r.date)}</td>
              <td className="px-3 py-2">{dash(r.totalRevenue)}</td>
              <td className="px-3 py-2">{dash(r.totalCOGS)}</td>
              <td className="px-3 py-2">{dash(r.grossProfit)}</td>
              <td className="px-3 py-2">{dash(r.totalExpenses)}</td>
              <td className="px-3 py-2">{dash(r.netProfit)}</td>
              <td className="px-3 py-2">{dashPct(r.netMargin)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/analytics/PeriodGridTable.test.tsx
pnpm exec tsc --noEmit
git add components/admin/analytics/PeriodGridTable.tsx tests/unit/components/admin/analytics/PeriodGridTable.test.tsx
git commit -m "feat(admin-v2): add PeriodGridTable (12-month P&L grid)"
git push -u origin wave6p6/task-18-period-grid-table
gh pr create --title "feat(admin-v2): Phase 6 W3 PeriodGridTable" --body "12-month P&L grid. Loading skeleton + empty state + currency dash. 3 tests passing."
```

---

### Task 19: `CohortTable.tsx`

**Wave:** 3 | **Branch:** `wave6p6/task-19-cohort-table` | **Model:** sonnet

**Schema realities for this task:** Consumes `CohortCell[]` (`{ signupMonth: string; orderBucket: '1' | '2-3' | '4-5' | '6+'; count: number }`). Rows are signup months (sorted desc), columns are the 4 order buckets. Cell intensity scales with count using `bg-white/[0.0n]` opacity (computed from `count / maxCount`).

**Files:**
- Create: `components/admin/analytics/CohortTable.tsx`
- Test: `tests/unit/components/admin/analytics/CohortTable.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/analytics/CohortTable.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { CohortTable } from '@/components/admin/analytics/CohortTable'

describe('CohortTable', () => {
  it('empty state', () => {
    render(<CohortTable cells={[]} />)
    expect(screen.getByText(/no cohort/i)).toBeTruthy()
  })
  it('renders one row per signup month + 4 bucket columns', () => {
    render(<CohortTable cells={[
      { signupMonth: '2026-05', orderBucket: '1', count: 5 },
      { signupMonth: '2026-05', orderBucket: '2-3', count: 2 },
    ]} />)
    expect(screen.getByText(/2026-05/)).toBeTruthy()
    expect(screen.getAllByRole('columnheader').length).toBeGreaterThanOrEqual(5)
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

export interface CohortCell {
  signupMonth: string
  orderBucket: '1' | '2-3' | '4-5' | '6+'
  count: number
}

export interface CohortTableProps {
  cells: CohortCell[]
}

const BUCKETS: CohortCell['orderBucket'][] = ['1', '2-3', '4-5', '6+']

export function CohortTable({ cells }: CohortTableProps) {
  if (cells.length === 0) {
    return <div className="text-xs text-white/40 py-4">No cohort data for this window.</div>
  }

  const months = Array.from(new Set(cells.map((c) => c.signupMonth))).sort().reverse()
  const max = Math.max(...cells.map((c) => c.count), 1)
  const lookup = new Map<string, number>()
  for (const c of cells) lookup.set(`${c.signupMonth}::${c.orderBucket}`, c.count)

  return (
    <div className="overflow-x-auto border border-white/8 rounded-md">
      <table className="w-full text-xs text-left">
        <thead className="bg-white/[0.04] text-white/50">
          <tr>
            <th className="px-3 py-2">Signup month</th>
            {BUCKETS.map((b) => (
              <th key={b} className="px-3 py-2 text-center">{b} order{b === '1' ? '' : 's'}</th>
            ))}
          </tr>
        </thead>
        <tbody className="text-white/80">
          {months.map((m) => (
            <tr key={m} className="border-t border-white/8">
              <td className="px-3 py-2">{m}</td>
              {BUCKETS.map((b) => {
                const v = lookup.get(`${m}::${b}`) ?? 0
                const opacity = max === 0 ? 0 : Math.min(0.6, v / max)
                return (
                  <td
                    key={b}
                    className="px-3 py-2 text-center"
                    style={{ backgroundColor: `rgba(255,49,49,${opacity})` }}
                  >
                    {v === 0 ? '—' : v}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/analytics/CohortTable.test.tsx
pnpm exec tsc --noEmit
git add components/admin/analytics/CohortTable.tsx tests/unit/components/admin/analytics/CohortTable.test.tsx
git commit -m "feat(admin-v2): add CohortTable (signup month × order count heat grid)"
git push -u origin wave6p6/task-19-cohort-table
gh pr create --title "feat(admin-v2): Phase 6 W3 CohortTable" --body "Cohort heat grid. Cell opacity scales with count. 2 tests passing."
```

---

### Task 20: `ExportButton.tsx`

**Wave:** 3 | **Branch:** `wave6p6/task-20-export-button` | **Model:** sonnet

**Schema realities for this task:**
- Per-tab CSV download. Props: `{ tab, range, filters? }`. Maps tab name to action: overview → `exportOverviewCsv`, sales → `exportSalesCsv`, customers → `exportCustomersCsv`, products → `exportProductsCsv`, financial → `exportFinancialCsv`, expenses → `exportExpensesCsv(range, filters)`.
- On success: build a Blob, create a temporary `<a download>` link, click it, revoke the URL. (Phase 4/5 BulkExportCsv precedent.)
- On `{ ok: false, error }`: toast.error(error).
- Use `useTransition` for pending state; disable button while pending.

**Files:**
- Create: `components/admin/analytics/ExportButton.tsx`
- Test: `tests/unit/components/admin/analytics/ExportButton.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/analytics/ExportButton.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const exportOverviewCsv = vi.fn()
const exportSalesCsv = vi.fn()
const exportCustomersCsv = vi.fn()
const exportProductsCsv = vi.fn()
const exportFinancialCsv = vi.fn()
const exportExpensesCsv = vi.fn()

vi.mock('@/app/admin/analytics/actions', () => ({
  exportOverviewCsv: (...a: unknown[]) => exportOverviewCsv(...a),
  exportSalesCsv: (...a: unknown[]) => exportSalesCsv(...a),
  exportCustomersCsv: (...a: unknown[]) => exportCustomersCsv(...a),
  exportProductsCsv: (...a: unknown[]) => exportProductsCsv(...a),
  exportFinancialCsv: (...a: unknown[]) => exportFinancialCsv(...a),
  exportExpensesCsv: (...a: unknown[]) => exportExpensesCsv(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { ExportButton } from '@/components/admin/analytics/ExportButton'

beforeEach(() => {
  vi.clearAllMocks()
  const createObjectURL = vi.fn(() => 'blob:mock')
  const revokeObjectURL = vi.fn()
  Object.assign(URL, { createObjectURL, revokeObjectURL })
})

describe('ExportButton', () => {
  it('calls exportOverviewCsv when tab is overview', async () => {
    exportOverviewCsv.mockResolvedValue({ ok: true, data: { csv: 'a,b\n1,2' } })
    render(<ExportButton tab="overview" range="30d" />)
    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    await waitFor(() => expect(exportOverviewCsv).toHaveBeenCalledWith('30d'))
  })

  it('calls exportExpensesCsv with filters', async () => {
    exportExpensesCsv.mockResolvedValue({ ok: true, data: { csv: 'a' } })
    render(<ExportButton tab="expenses" range="30d" filters={{ categoryId: 'cat1' }} />)
    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    await waitFor(() => expect(exportExpensesCsv).toHaveBeenCalledWith('30d', { categoryId: 'cat1' }))
  })

  it('surfaces error toast on failure', async () => {
    const { toast } = await import('@/lib/toast')
    exportSalesCsv.mockResolvedValue({ ok: false, error: 'Too many rows' })
    render(<ExportButton tab="sales" range="year" />)
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
  exportSalesCsv,
  exportCustomersCsv,
  exportProductsCsv,
  exportFinancialCsv,
  exportExpensesCsv,
  type TimeRange,
  type ExpenseCsvFilters,
} from '@/app/admin/analytics/actions'
import { toast } from '@/lib/toast'

export type ExportableTab = 'overview' | 'sales' | 'customers' | 'products' | 'financial' | 'expenses'

export interface ExportButtonProps {
  tab: ExportableTab
  range: TimeRange
  filters?: ExpenseCsvFilters
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
        case 'overview':   res = await exportOverviewCsv(range); break
        case 'sales':      res = await exportSalesCsv(range); break
        case 'customers':  res = await exportCustomersCsv(range); break
        case 'products':   res = await exportProductsCsv(range); break
        case 'financial':  res = await exportFinancialCsv(range); break
        case 'expenses':   res = await exportExpensesCsv(range, filters); break
      }
      if (res.ok && res.data?.csv) {
        downloadCsv(res.data.csv, `analytics-${tab}-${range}-${Date.now()}.csv`)
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
pnpm test tests/unit/components/admin/analytics/ExportButton.test.tsx
pnpm exec tsc --noEmit
git add components/admin/analytics/ExportButton.tsx tests/unit/components/admin/analytics/ExportButton.test.tsx
git commit -m "feat(admin-v2): add ExportButton (tab→action dispatcher + Blob download)"
git push -u origin wave6p6/task-20-export-button
gh pr create --title "feat(admin-v2): Phase 6 W3 ExportButton" --body "Per-tab CSV export client wrapper. Dispatches to one of 6 server actions. Blob download. 3 tests passing."
```

---

## Wave 4 — 6 Tab components (6 parallel, after W2 + W3 merged)

Each Tab component is a server-renderable async function. The parent (`AdminAnalyticsV2`, W5) awaits the matching `load*Data(range)` loader inside a Suspense boundary and passes data as a prop. Tab components are presentational and may compose `'use client'` children (charts, Inspector triggers).

**IMPORTANT (cross-cutting note 7):** When you start a W4 task, FIRST `git log --oneline | head -40` to find the merged W2/W3 PRs, then `git diff main -- components/admin/analytics/` to read the actual prop signatures shipped by Wave 2/3. Adopt those verbatim — the plan prose is approximate.

### Task 21: `OverviewTab.tsx`

**Wave:** 4 | **Branch:** `wave6p6/task-21-overview-tab` | **Model:** sonnet

**Schema realities for this task:** Consumes `OverviewData` from `lib/admin/analytics.ts` (re-declared locally as a client-safe shape). 4 charts in a 2×2 grid: RevenueTrendChart, OrdersBarChart, CustomerAcquisitionChart, OrderStatusDonut. Goals card uses `goals.dailyTarget`/`monthlyTarget` and exposes an "Edit goals" button that opens `GoalsInspector`. ExportButton in the header (tab="overview").

**Files:**
- Create: `components/admin/analytics/tabs/OverviewTab.tsx`
- Test: `tests/unit/components/admin/analytics/tabs/OverviewTab.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/analytics/tabs/OverviewTab.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/components/admin/analytics/charts/RevenueTrendChart', () => ({
  RevenueTrendChart: () => <div data-testid="chart-revenue-trend" />,
}))
vi.mock('@/components/admin/analytics/charts/OrdersBarChart', () => ({
  OrdersBarChart: () => <div data-testid="chart-orders-bar" />,
}))
vi.mock('@/components/admin/analytics/charts/CustomerAcquisitionChart', () => ({
  CustomerAcquisitionChart: () => <div data-testid="chart-acq" />,
}))
vi.mock('@/components/admin/analytics/charts/OrderStatusDonut', () => ({
  OrderStatusDonut: () => <div data-testid="chart-status-donut" />,
}))
vi.mock('@/components/admin/analytics/inspectors/GoalsInspector', () => ({
  GoalsInspector: ({ open }: { open: boolean }) =>
    open ? <div data-testid="goals-inspector-open" /> : null,
}))
vi.mock('@/components/admin/analytics/ExportButton', () => ({
  ExportButton: () => <button>Export CSV</button>,
}))

import { OverviewTab } from '@/components/admin/analytics/tabs/OverviewTab'

const data = {
  revenueTrend: [{ bucket: '2026-05-30', value: 100 }],
  ordersTrend: [{ bucket: '2026-05-30', value: 1 }],
  acquisitionTrend: [{ bucket: '2026-05', newCustomers: 1, returningCustomers: 0 }],
  statusDonut: [{ status: 'DELIVERED', count: 1 }],
  goals: {
    id: 'default', dailyTarget: 500, weeklyTarget: 3500, monthlyTarget: 15000,
    quarterlyTarget: 45000, yearlyTarget: 180000, updatedAt: new Date('2026-05-01'),
  },
}

describe('OverviewTab', () => {
  it('renders 4 charts + goals card + export', () => {
    render(<OverviewTab data={data} range="30d" />)
    expect(screen.getByTestId('chart-revenue-trend')).toBeTruthy()
    expect(screen.getByTestId('chart-orders-bar')).toBeTruthy()
    expect(screen.getByTestId('chart-acq')).toBeTruthy()
    expect(screen.getByTestId('chart-status-donut')).toBeTruthy()
    expect(screen.getByText(/edit goals/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /export/i })).toBeTruthy()
  })

  it('opens GoalsInspector when Edit goals clicked', () => {
    render(<OverviewTab data={data} range="30d" />)
    fireEvent.click(screen.getByText(/edit goals/i))
    expect(screen.getByTestId('goals-inspector-open')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write `components/admin/analytics/tabs/OverviewTab.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { RevenueTrendChart } from '@/components/admin/analytics/charts/RevenueTrendChart'
import { OrdersBarChart } from '@/components/admin/analytics/charts/OrdersBarChart'
import { CustomerAcquisitionChart } from '@/components/admin/analytics/charts/CustomerAcquisitionChart'
import { OrderStatusDonut } from '@/components/admin/analytics/charts/OrderStatusDonut'
import { GoalsInspector } from '@/components/admin/analytics/inspectors/GoalsInspector'
import { ExportButton } from '@/components/admin/analytics/ExportButton'
import type { TimeRange, SalesGoalsRow } from '@/app/admin/analytics/actions'

export interface OverviewTabData {
  revenueTrend: { bucket: string; value: number }[]
  ordersTrend: { bucket: string; value: number }[]
  acquisitionTrend: { bucket: string; newCustomers: number; returningCustomers: number }[]
  statusDonut: { status: string; count: number }[]
  goals: SalesGoalsRow
}

export interface OverviewTabProps {
  data: OverviewTabData
  range: TimeRange
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function OverviewTab({ data, range }: OverviewTabProps) {
  const [goalsOpen, setGoalsOpen] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <ExportButton tab="overview" range={range} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Revenue</h3>
          <RevenueTrendChart data={data.revenueTrend} />
        </div>
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Orders</h3>
          <OrdersBarChart data={data.ordersTrend} />
        </div>
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Customer Acquisition</h3>
          <CustomerAcquisitionChart data={data.acquisitionTrend} />
        </div>
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Order Status</h3>
          <OrderStatusDonut data={data.statusDonut} />
        </div>
      </div>

      <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs uppercase tracking-wide text-white/40">Sales Goals</h3>
          <button
            type="button"
            onClick={() => setGoalsOpen(true)}
            className="text-xs text-[#FF3131] hover:text-[#ff4747]"
          >
            Edit goals
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm text-white/80">
          <div><div className="text-white/40 text-xs">Daily</div>{fmt.format(data.goals.dailyTarget)}</div>
          <div><div className="text-white/40 text-xs">Weekly</div>{fmt.format(data.goals.weeklyTarget)}</div>
          <div><div className="text-white/40 text-xs">Monthly</div>{fmt.format(data.goals.monthlyTarget)}</div>
          <div><div className="text-white/40 text-xs">Quarterly</div>{fmt.format(data.goals.quarterlyTarget)}</div>
          <div><div className="text-white/40 text-xs">Yearly</div>{fmt.format(data.goals.yearlyTarget)}</div>
        </div>
      </div>

      <GoalsInspector open={goalsOpen} goals={data.goals} onClose={() => setGoalsOpen(false)} />
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
mkdir -p components/admin/analytics/tabs tests/unit/components/admin/analytics/tabs
pnpm test tests/unit/components/admin/analytics/tabs/OverviewTab.test.tsx
pnpm exec tsc --noEmit
git add components/admin/analytics/tabs/OverviewTab.tsx tests/unit/components/admin/analytics/tabs/OverviewTab.test.tsx
git commit -m "feat(admin-v2): add OverviewTab (4 charts + goals card)"
git push -u origin wave6p6/task-21-overview-tab
gh pr create --title "feat(admin-v2): Phase 6 W4 OverviewTab" --body "4 charts + SalesGoals card with Edit goals → GoalsInspector. ExportButton. 2 tests passing."
```

---

### Task 22: `SalesTab.tsx`

**Wave:** 4 | **Branch:** `wave6p6/task-22-sales-tab` | **Model:** sonnet

**Schema realities for this task:** Consumes `SalesData` (`{ revenueTrend, topProducts }`) plus a separate `LiveFeedSidebar`. Desktop: 2-column grid (charts left, LiveFeedSidebar right column). Mobile: stacked with LiveFeedSidebar as collapsed accordion (handled inside `LiveFeedSidebar`).

**Files:**
- Create: `components/admin/analytics/tabs/SalesTab.tsx`
- Test: `tests/unit/components/admin/analytics/tabs/SalesTab.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/analytics/tabs/SalesTab.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/components/admin/analytics/charts/RevenueTrendChart', () => ({
  RevenueTrendChart: () => <div data-testid="chart-revenue-trend" />,
}))
vi.mock('@/components/admin/analytics/charts/TopProductsBar', () => ({
  TopProductsBar: () => <div data-testid="chart-top-products" />,
}))
vi.mock('@/components/admin/analytics/LiveFeedSidebar', () => ({
  LiveFeedSidebar: () => <div data-testid="live-feed" />,
}))
vi.mock('@/components/admin/analytics/ExportButton', () => ({
  ExportButton: () => <button>Export CSV</button>,
}))

import { SalesTab } from '@/components/admin/analytics/tabs/SalesTab'

describe('SalesTab', () => {
  it('renders RevenueTrendChart + TopProductsBar + LiveFeedSidebar + export', () => {
    render(<SalesTab data={{ revenueTrend: [], topProducts: [] }} range="30d" />)
    expect(screen.getByTestId('chart-revenue-trend')).toBeTruthy()
    expect(screen.getByTestId('chart-top-products')).toBeTruthy()
    expect(screen.getByTestId('live-feed')).toBeTruthy()
    expect(screen.getByRole('button', { name: /export/i })).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { RevenueTrendChart } from '@/components/admin/analytics/charts/RevenueTrendChart'
import { TopProductsBar } from '@/components/admin/analytics/charts/TopProductsBar'
import { LiveFeedSidebar } from '@/components/admin/analytics/LiveFeedSidebar'
import { ExportButton } from '@/components/admin/analytics/ExportButton'
import type { TimeRange } from '@/app/admin/analytics/actions'

export interface SalesTabData {
  revenueTrend: { bucket: string; value: number }[]
  topProducts: { productId: string; name: string; unitsSold: number; revenue: number }[]
}

export interface SalesTabProps {
  data: SalesTabData
  range: TimeRange
}

export function SalesTab({ data, range }: SalesTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <ExportButton tab="sales" range={range} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 space-y-3">
          <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
            <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Revenue Trend</h3>
            <RevenueTrendChart data={data.revenueTrend} />
          </div>
          <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
            <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Top Products</h3>
            <TopProductsBar data={data.topProducts} />
          </div>
        </div>
        <div className="lg:col-span-1">
          <LiveFeedSidebar />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/analytics/tabs/SalesTab.test.tsx
pnpm exec tsc --noEmit
git add components/admin/analytics/tabs/SalesTab.tsx tests/unit/components/admin/analytics/tabs/SalesTab.test.tsx
git commit -m "feat(admin-v2): add SalesTab (revenue + top products + LiveFeedSidebar)"
git push -u origin wave6p6/task-22-sales-tab
gh pr create --title "feat(admin-v2): Phase 6 W4 SalesTab" --body "2 charts + LiveFeedSidebar (mobile accordion). ExportButton. 1 test passing."
```

---

### Task 23: `CustomersTab.tsx`

**Wave:** 4 | **Branch:** `wave6p6/task-23-customers-tab` | **Model:** sonnet

**Schema realities for this task:** Consumes `CustomersData` (`{ acquisitionTrend, cohort, ltvScatter, table }`). Composes CustomerAcquisitionChart + CohortTable + MarginScatter (used for LTV with xLabel="Total Spent", yLabel="Orders") + paginated customer table. Rows in the table click → open `CustomerInspector` via `getCustomerDetailForInspector(id)`.

**Files:**
- Create: `components/admin/analytics/tabs/CustomersTab.tsx`
- Test: `tests/unit/components/admin/analytics/tabs/CustomersTab.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/analytics/tabs/CustomersTab.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/components/admin/analytics/charts/CustomerAcquisitionChart', () => ({
  CustomerAcquisitionChart: () => <div data-testid="chart-acq" />,
}))
vi.mock('@/components/admin/analytics/charts/MarginScatter', () => ({
  MarginScatter: () => <div data-testid="chart-ltv-scatter" />,
}))
vi.mock('@/components/admin/analytics/CohortTable', () => ({
  CohortTable: () => <div data-testid="cohort-table" />,
}))
vi.mock('@/components/admin/analytics/ExportButton', () => ({
  ExportButton: () => <button>Export CSV</button>,
}))
const getCustomerDetailForInspector = vi.fn()
vi.mock('@/app/admin/analytics/actions', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/app/admin/analytics/actions')
  return { ...actual, getCustomerDetailForInspector: (...a: unknown[]) => getCustomerDetailForInspector(...a) }
})
vi.mock('@/components/admin/analytics/inspectors/CustomerInspector', () => ({
  CustomerInspector: ({ open }: { open: boolean }) =>
    open ? <div data-testid="customer-inspector-open" /> : null,
}))

import { CustomersTab } from '@/components/admin/analytics/tabs/CustomersTab'

const data = {
  acquisitionTrend: [],
  cohort: [],
  ltvScatter: [],
  table: {
    items: [
      { id: 'c1', email: 'a@e.com', name: null,
        createdAt: new Date('2026-05-01'),
        totalSpent: 100, totalOrders: 2, avgOrderValue: 50,
        lastOrderDate: null, loyaltyTierName: null },
    ],
    total: 1, page: 1, pageSize: 25,
  },
}

describe('CustomersTab', () => {
  it('renders charts + cohort + table + export', () => {
    render(<CustomersTab data={data} range="30d" />)
    expect(screen.getByTestId('chart-acq')).toBeTruthy()
    expect(screen.getByTestId('cohort-table')).toBeTruthy()
    expect(screen.getByTestId('chart-ltv-scatter')).toBeTruthy()
    expect(screen.getByText(/a@e\.com/)).toBeTruthy()
  })

  it('opens CustomerInspector on row click', async () => {
    getCustomerDetailForInspector.mockResolvedValue({
      id: 'c1', email: 'a@e.com', name: null,
      createdAt: new Date(), totalSpent: 100, totalOrders: 2, avgOrderValue: 50,
      lastOrderDate: null, loyaltyTierName: null,
    })
    render(<CustomersTab data={data} range="30d" />)
    fireEvent.click(screen.getByText(/a@e\.com/))
    await waitFor(() => expect(screen.queryByTestId('customer-inspector-open')).toBeTruthy())
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { CustomerAcquisitionChart } from '@/components/admin/analytics/charts/CustomerAcquisitionChart'
import { MarginScatter } from '@/components/admin/analytics/charts/MarginScatter'
import { CohortTable } from '@/components/admin/analytics/CohortTable'
import { CustomerInspector } from '@/components/admin/analytics/inspectors/CustomerInspector'
import { ExportButton } from '@/components/admin/analytics/ExportButton'
import {
  getCustomerDetailForInspector,
  type CustomerDetailFull,
  type TimeRange,
} from '@/app/admin/analytics/actions'

export interface CustomerTableRow {
  id: string
  email: string
  name: string | null
  createdAt: Date
  totalSpent: number
  totalOrders: number
  avgOrderValue: number
  lastOrderDate: Date | null
  loyaltyTierName: string | null
}

export interface CustomersTabData {
  acquisitionTrend: { bucket: string; newCustomers: number; returningCustomers: number }[]
  cohort: { signupMonth: string; orderBucket: '1' | '2-3' | '4-5' | '6+'; count: number }[]
  ltvScatter: { productId: string; name: string; price: number; marginPct: number; unitsSold: number }[]
  table: { items: CustomerTableRow[]; total: number; page: number; pageSize: number }
}

export interface CustomersTabProps {
  data: CustomersTabData
  range: TimeRange
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function CustomersTab({ data, range }: CustomersTabProps) {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<CustomerDetailFull | null>(null)
  const [, startTransition] = useTransition()

  const openRow = (id: string) => {
    setDetail(null)
    setOpen(true)
    startTransition(async () => {
      const d = await getCustomerDetailForInspector(id)
      setDetail(d)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <ExportButton tab="customers" range={range} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Acquisition</h3>
          <CustomerAcquisitionChart data={data.acquisitionTrend} />
        </div>
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">LTV (spend × orders)</h3>
          <MarginScatter data={data.ltvScatter} xLabel="Total Spent" yLabel="Orders" />
        </div>
      </div>
      <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
        <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Cohort</h3>
        <CohortTable cells={data.cohort} />
      </div>
      <div className="bg-neutral-900/60 border border-white/8 rounded-md overflow-hidden">
        <h3 className="text-xs uppercase tracking-wide text-white/40 px-3 py-2 border-b border-white/8">
          Top Customers ({data.table.total})
        </h3>
        <table className="w-full text-xs">
          <thead className="bg-white/[0.04] text-white/50 text-left">
            <tr>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Orders</th>
              <th className="px-3 py-2">Spent</th>
              <th className="px-3 py-2">AOV</th>
              <th className="px-3 py-2">Tier</th>
            </tr>
          </thead>
          <tbody className="text-white/80">
            {data.table.items.map((c) => (
              <tr
                key={c.id}
                className="border-t border-white/8 hover:bg-white/[0.04] cursor-pointer"
                onClick={() => openRow(c.id)}
              >
                <td className="px-3 py-2">{c.email}</td>
                <td className="px-3 py-2">{c.totalOrders}</td>
                <td className="px-3 py-2">{fmt.format(c.totalSpent)}</td>
                <td className="px-3 py-2">{fmt.format(c.avgOrderValue)}</td>
                <td className="px-3 py-2">{c.loyaltyTierName ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CustomerInspector open={open} detail={detail} onClose={() => setOpen(false)} />
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/analytics/tabs/CustomersTab.test.tsx
pnpm exec tsc --noEmit
git add components/admin/analytics/tabs/CustomersTab.tsx tests/unit/components/admin/analytics/tabs/CustomersTab.test.tsx
git commit -m "feat(admin-v2): add CustomersTab (acquisition + cohort + LTV + table)"
git push -u origin wave6p6/task-23-customers-tab
gh pr create --title "feat(admin-v2): Phase 6 W4 CustomersTab" --body "Acquisition + LTV scatter + CohortTable + paginated table with row→CustomerInspector. 2 tests passing."
```

---

### Task 24: `ProductsTab.tsx`

**Wave:** 4 | **Branch:** `wave6p6/task-24-products-tab` | **Model:** sonnet

**Schema realities for this task:** Consumes `ProductsData` (`{ topProducts, marginScatter, table }`). Rows → ProductInspector via `getProductFinancialDetailForInspector(id, range)`.

**Files:**
- Create: `components/admin/analytics/tabs/ProductsTab.tsx`
- Test: `tests/unit/components/admin/analytics/tabs/ProductsTab.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/analytics/tabs/ProductsTab.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/components/admin/analytics/charts/TopProductsBar', () => ({
  TopProductsBar: () => <div data-testid="chart-top" />,
}))
vi.mock('@/components/admin/analytics/charts/MarginScatter', () => ({
  MarginScatter: () => <div data-testid="chart-margin-scatter" />,
}))
vi.mock('@/components/admin/analytics/ExportButton', () => ({
  ExportButton: () => <button>Export CSV</button>,
}))
const getProductFinancialDetailForInspector = vi.fn()
vi.mock('@/app/admin/analytics/actions', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/app/admin/analytics/actions')
  return {
    ...actual,
    getProductFinancialDetailForInspector: (...a: unknown[]) => getProductFinancialDetailForInspector(...a),
  }
})
vi.mock('@/components/admin/analytics/inspectors/ProductInspector', () => ({
  ProductInspector: ({ open }: { open: boolean }) =>
    open ? <div data-testid="product-inspector-open" /> : null,
}))

import { ProductsTab } from '@/components/admin/analytics/tabs/ProductsTab'

const data = {
  topProducts: [],
  marginScatter: [],
  table: {
    items: [
      { id: 'p1', name: 'Tee', unitsSold: 5, revenue: 125, cost: 25,
        grossMargin: 100, marginPct: 80, imageUrl: null },
    ],
    total: 1, page: 1, pageSize: 25,
  },
}

describe('ProductsTab', () => {
  it('renders charts + table', () => {
    render(<ProductsTab data={data} range="30d" />)
    expect(screen.getByTestId('chart-top')).toBeTruthy()
    expect(screen.getByTestId('chart-margin-scatter')).toBeTruthy()
    expect(screen.getByText(/Tee/)).toBeTruthy()
  })
  it('opens ProductInspector on row click', async () => {
    getProductFinancialDetailForInspector.mockResolvedValue({
      id: 'p1', name: 'Tee', imageUrl: null, basePrice: 25,
      unitsSold: 5, revenue: 125, cost: 25, grossMargin: 100, marginPct: 80,
      rangeStart: new Date(), rangeEnd: new Date(),
    })
    render(<ProductsTab data={data} range="30d" />)
    fireEvent.click(screen.getByText(/Tee/))
    await waitFor(() => expect(screen.queryByTestId('product-inspector-open')).toBeTruthy())
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { TopProductsBar } from '@/components/admin/analytics/charts/TopProductsBar'
import { MarginScatter } from '@/components/admin/analytics/charts/MarginScatter'
import { ProductInspector } from '@/components/admin/analytics/inspectors/ProductInspector'
import { ExportButton } from '@/components/admin/analytics/ExportButton'
import {
  getProductFinancialDetailForInspector,
  type ProductFinancialDetailFull,
  type TimeRange,
} from '@/app/admin/analytics/actions'

export interface ProductTableRow {
  id: string
  name: string
  unitsSold: number
  revenue: number
  cost: number
  grossMargin: number
  marginPct: number
  imageUrl: string | null
}

export interface ProductsTabData {
  topProducts: { productId: string; name: string; unitsSold: number; revenue: number }[]
  marginScatter: { productId: string; name: string; price: number; marginPct: number; unitsSold: number }[]
  table: { items: ProductTableRow[]; total: number; page: number; pageSize: number }
}

export interface ProductsTabProps {
  data: ProductsTabData
  range: TimeRange
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function ProductsTab({ data, range }: ProductsTabProps) {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<ProductFinancialDetailFull | null>(null)
  const [, startTransition] = useTransition()

  const openRow = (id: string) => {
    setDetail(null)
    setOpen(true)
    startTransition(async () => {
      const d = await getProductFinancialDetailForInspector(id, range)
      setDetail(d)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <ExportButton tab="products" range={range} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Top Products</h3>
          <TopProductsBar data={data.topProducts} />
        </div>
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Margin Distribution</h3>
          <MarginScatter data={data.marginScatter} />
        </div>
      </div>
      <div className="bg-neutral-900/60 border border-white/8 rounded-md overflow-hidden">
        <h3 className="text-xs uppercase tracking-wide text-white/40 px-3 py-2 border-b border-white/8">
          Products ({data.table.total})
        </h3>
        <table className="w-full text-xs">
          <thead className="bg-white/[0.04] text-white/50 text-left">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Units</th>
              <th className="px-3 py-2">Revenue</th>
              <th className="px-3 py-2">Margin</th>
            </tr>
          </thead>
          <tbody className="text-white/80">
            {data.table.items.map((p) => (
              <tr
                key={p.id}
                className="border-t border-white/8 hover:bg-white/[0.04] cursor-pointer"
                onClick={() => openRow(p.id)}
              >
                <td className="px-3 py-2">{p.name}</td>
                <td className="px-3 py-2">{p.unitsSold}</td>
                <td className="px-3 py-2">{fmt.format(p.revenue)}</td>
                <td className="px-3 py-2">{p.marginPct.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ProductInspector open={open} detail={detail} onClose={() => setOpen(false)} />
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/analytics/tabs/ProductsTab.test.tsx
pnpm exec tsc --noEmit
git add components/admin/analytics/tabs/ProductsTab.tsx tests/unit/components/admin/analytics/tabs/ProductsTab.test.tsx
git commit -m "feat(admin-v2): add ProductsTab (top products + margin scatter + table)"
git push -u origin wave6p6/task-24-products-tab
gh pr create --title "feat(admin-v2): Phase 6 W4 ProductsTab" --body "TopProductsBar + MarginScatter + paginated table → ProductInspector. 2 tests passing."
```

---

### Task 25: `FinancialTab.tsx`

**Wave:** 4 | **Branch:** `wave6p6/task-25-financial-tab` | **Model:** sonnet

**Schema realities for this task:** Consumes `FinancialData` (`{ revenueExpenseTrend, marginTrend, taxSummary, periodGrid }`). 2 charts + Tax Summary card (last 4 TaxRecords, read-only) + PeriodGridTable (12 months).

**Files:**
- Create: `components/admin/analytics/tabs/FinancialTab.tsx`
- Test: `tests/unit/components/admin/analytics/tabs/FinancialTab.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/analytics/tabs/FinancialTab.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/components/admin/analytics/charts/RevenueExpenseArea', () => ({
  RevenueExpenseArea: () => <div data-testid="chart-rev-exp" />,
}))
vi.mock('@/components/admin/analytics/charts/MarginTrendChart', () => ({
  MarginTrendChart: () => <div data-testid="chart-margin-trend" />,
}))
vi.mock('@/components/admin/analytics/PeriodGridTable', () => ({
  PeriodGridTable: () => <div data-testid="period-grid" />,
}))
vi.mock('@/components/admin/analytics/ExportButton', () => ({
  ExportButton: () => <button>Export CSV</button>,
}))

import { FinancialTab } from '@/components/admin/analytics/tabs/FinancialTab'

const data = {
  revenueExpenseTrend: [],
  marginTrend: [],
  taxSummary: [
    { id: 't1', period: 'QUARTERLY' as const, year: 2026, quarter: 1, month: null,
      grossRevenue: 10000, salesTaxCollected: 800, netIncome: 4000,
      estimatedTaxLiability: 1000, status: 'CALCULATED' as const },
  ],
  periodGrid: [],
}

describe('FinancialTab', () => {
  it('renders both charts + tax summary + period grid', () => {
    render(<FinancialTab data={data} range="30d" />)
    expect(screen.getByTestId('chart-rev-exp')).toBeTruthy()
    expect(screen.getByTestId('chart-margin-trend')).toBeTruthy()
    expect(screen.getByTestId('period-grid')).toBeTruthy()
    expect(screen.getByText(/Q1 2026/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { RevenueExpenseArea } from '@/components/admin/analytics/charts/RevenueExpenseArea'
import { MarginTrendChart } from '@/components/admin/analytics/charts/MarginTrendChart'
import { PeriodGridTable } from '@/components/admin/analytics/PeriodGridTable'
import { ExportButton } from '@/components/admin/analytics/ExportButton'
import type { TimeRange, TaxPeriod, TaxRecordStatus } from '@/app/admin/analytics/actions'

export interface TaxSummaryRow {
  id: string
  period: TaxPeriod
  year: number
  quarter: number | null
  month: number | null
  grossRevenue: number
  salesTaxCollected: number
  netIncome: number
  estimatedTaxLiability: number
  status: TaxRecordStatus
}

export interface FinancialSnapshotRow {
  id: string
  date: Date
  periodType: string
  totalRevenue: number
  totalOrders: number
  avgOrderValue: number
  totalCOGS: number
  totalExpenses: number
  grossProfit: number
  grossMargin: number
  netProfit: number
  netMargin: number
  salesTaxCollected: number
  inventoryValue: number
  cashOnHand: number | null
}

export interface FinancialTabData {
  revenueExpenseTrend: { bucket: string; revenue: number; expenses: number }[]
  marginTrend: { bucket: string; value: number }[]
  taxSummary: TaxSummaryRow[]
  periodGrid: FinancialSnapshotRow[]
}

export interface FinancialTabProps {
  data: FinancialTabData
  range: TimeRange
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function taxLabel(r: TaxSummaryRow): string {
  if (r.period === 'QUARTERLY' && r.quarter) return `Q${r.quarter} ${r.year}`
  if (r.period === 'MONTHLY' && r.month) return `${r.year}-${String(r.month).padStart(2, '0')}`
  return `${r.year}`
}

export function FinancialTab({ data, range }: FinancialTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <ExportButton tab="financial" range={range} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Revenue vs Expenses</h3>
          <RevenueExpenseArea data={data.revenueExpenseTrend} />
        </div>
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Gross Margin Trend</h3>
          <MarginTrendChart data={data.marginTrend} />
        </div>
      </div>
      <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
        <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Tax Summary (last 4 periods)</h3>
        {data.taxSummary.length === 0 ? (
          <div className="text-xs text-white/40 py-2">No tax records yet.</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-white/50 text-left">
              <tr>
                <th className="py-2">Period</th>
                <th className="py-2">Revenue</th>
                <th className="py-2">Sales Tax</th>
                <th className="py-2">Net Income</th>
                <th className="py-2">Est. Tax</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody className="text-white/80">
              {data.taxSummary.map((t) => (
                <tr key={t.id} className="border-t border-white/8">
                  <td className="py-2">{taxLabel(t)}</td>
                  <td className="py-2">{fmt.format(t.grossRevenue)}</td>
                  <td className="py-2">{fmt.format(t.salesTaxCollected)}</td>
                  <td className="py-2">{fmt.format(t.netIncome)}</td>
                  <td className="py-2">{fmt.format(t.estimatedTaxLiability)}</td>
                  <td className="py-2">{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
        <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">By Period (12-month P&amp;L)</h3>
        <PeriodGridTable rows={data.periodGrid} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/analytics/tabs/FinancialTab.test.tsx
pnpm exec tsc --noEmit
git add components/admin/analytics/tabs/FinancialTab.tsx tests/unit/components/admin/analytics/tabs/FinancialTab.test.tsx
git commit -m "feat(admin-v2): add FinancialTab (revenue/expense + margin trend + tax + period grid)"
git push -u origin wave6p6/task-25-financial-tab
gh pr create --title "feat(admin-v2): Phase 6 W4 FinancialTab" --body "2 charts + Tax Summary (last 4) + PeriodGridTable. ExportButton. 1 test passing."
```

---

### Task 26: `ExpensesTab.tsx`

**Wave:** 4 | **Branch:** `wave6p6/task-26-expenses-tab` | **Model:** sonnet

**Schema realities for this task:**
- Consumes `ExpensesData` + a `categories: { id; name; color }[]` prop (loaded by parent from ExpenseCategory).
- Receives `isSuperAdmin: boolean` from the parent (for ExpenseInspector's Delete gate).
- Rows → ExpenseInspector via `getExpenseDetailForInspector(id)` (edit mode).
- "+ New Expense" button opens ExpenseInspector with `detail={null} createMode`.

**Files:**
- Create: `components/admin/analytics/tabs/ExpensesTab.tsx`
- Test: `tests/unit/components/admin/analytics/tabs/ExpensesTab.test.tsx`

#### Steps

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/admin/analytics/tabs/ExpensesTab.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/components/admin/analytics/charts/ExpenseCategoryDonut', () => ({
  ExpenseCategoryDonut: () => <div data-testid="chart-cat-donut" />,
}))
vi.mock('@/components/admin/analytics/charts/ExpenseMonthlyBar', () => ({
  ExpenseMonthlyBar: () => <div data-testid="chart-monthly-bar" />,
}))
vi.mock('@/components/admin/analytics/ExportButton', () => ({
  ExportButton: () => <button>Export CSV</button>,
}))
const getExpenseDetailForInspector = vi.fn()
vi.mock('@/app/admin/analytics/actions', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/app/admin/analytics/actions')
  return { ...actual, getExpenseDetailForInspector: (...a: unknown[]) => getExpenseDetailForInspector(...a) }
})
vi.mock('@/components/admin/analytics/inspectors/ExpenseInspector', () => ({
  ExpenseInspector: ({ open, createMode }: { open: boolean; createMode?: boolean }) =>
    open ? <div data-testid={createMode ? 'inspector-create' : 'inspector-edit'} /> : null,
}))

import { ExpensesTab } from '@/components/admin/analytics/tabs/ExpensesTab'

const data = {
  categoryBreakdown: [],
  monthlyBars: [],
  table: {
    items: [
      { id: 'e1', amount: 100, date: new Date('2026-05-15'),
        description: 'FB ads', vendor: 'Meta',
        categoryId: 'cat1', categoryName: 'Marketing', categoryColor: '#FF3131',
        isTaxDeductible: true, status: 'PAID' as const, paymentMethod: 'card' },
    ],
    total: 1, page: 1, pageSize: 25,
  },
}
const categories = [{ id: 'cat1', name: 'Marketing', color: '#FF3131' }]

describe('ExpensesTab', () => {
  it('renders charts + new expense button + table', () => {
    render(<ExpensesTab data={data} range="30d" categories={categories} isSuperAdmin={false} />)
    expect(screen.getByTestId('chart-cat-donut')).toBeTruthy()
    expect(screen.getByTestId('chart-monthly-bar')).toBeTruthy()
    expect(screen.getByRole('button', { name: /new expense/i })).toBeTruthy()
    expect(screen.getByText(/FB ads/)).toBeTruthy()
  })

  it('opens create inspector on New Expense click', () => {
    render(<ExpensesTab data={data} range="30d" categories={categories} isSuperAdmin={false} />)
    fireEvent.click(screen.getByRole('button', { name: /new expense/i }))
    expect(screen.getByTestId('inspector-create')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test (FAIL).**

- [ ] **Step 3: Write the component**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { ExpenseCategoryDonut } from '@/components/admin/analytics/charts/ExpenseCategoryDonut'
import { ExpenseMonthlyBar } from '@/components/admin/analytics/charts/ExpenseMonthlyBar'
import { ExpenseInspector } from '@/components/admin/analytics/inspectors/ExpenseInspector'
import { ExportButton } from '@/components/admin/analytics/ExportButton'
import type { ExpenseCategoryOption } from '@/components/admin/analytics/inspectors/ExpenseInspector'
import {
  getExpenseDetailForInspector,
  type ExpenseDetailFull,
  type TimeRange,
} from '@/app/admin/analytics/actions'
import type { ExpenseStatus } from '@prisma/client'

export interface ExpenseTableRow {
  id: string
  amount: number
  date: Date
  description: string
  vendor: string | null
  categoryId: string
  categoryName: string
  categoryColor: string
  isTaxDeductible: boolean
  status: ExpenseStatus
  paymentMethod: string | null
}

export interface ExpensesTabData {
  categoryBreakdown: { categoryId: string; categoryName: string; color: string; amount: number }[]
  monthlyBars: { month: string; amount: number }[]
  table: { items: ExpenseTableRow[]; total: number; page: number; pageSize: number }
}

export interface ExpensesTabProps {
  data: ExpensesTabData
  range: TimeRange
  categories: ExpenseCategoryOption[]
  isSuperAdmin: boolean
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })

export function ExpensesTab({ data, range, categories, isSuperAdmin }: ExpensesTabProps) {
  const [open, setOpen] = useState(false)
  const [createMode, setCreateMode] = useState(false)
  const [detail, setDetail] = useState<ExpenseDetailFull | null>(null)
  const [, startTransition] = useTransition()

  const openCreate = () => {
    setDetail(null)
    setCreateMode(true)
    setOpen(true)
  }

  const openRow = (id: string) => {
    setCreateMode(false)
    setDetail(null)
    setOpen(true)
    startTransition(async () => {
      const d = await getExpenseDetailForInspector(id)
      setDetail(d)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={openCreate}
          className="text-xs px-3 py-1.5 rounded-md bg-[#FF3131] text-white hover:bg-[#ff4747]"
        >
          + New Expense
        </button>
        <ExportButton tab="expenses" range={range} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">By Category</h3>
          <ExpenseCategoryDonut data={data.categoryBreakdown} />
        </div>
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Monthly</h3>
          <ExpenseMonthlyBar data={data.monthlyBars} />
        </div>
      </div>
      <div className="bg-neutral-900/60 border border-white/8 rounded-md overflow-hidden">
        <h3 className="text-xs uppercase tracking-wide text-white/40 px-3 py-2 border-b border-white/8">
          Expenses ({data.table.total})
        </h3>
        <table className="w-full text-xs">
          <thead className="bg-white/[0.04] text-white/50 text-left">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Vendor</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="text-white/80">
            {data.table.items.map((e) => (
              <tr
                key={e.id}
                className="border-t border-white/8 hover:bg-white/[0.04] cursor-pointer"
                onClick={() => openRow(e.id)}
              >
                <td className="px-3 py-2">{e.date.toLocaleDateString()}</td>
                <td className="px-3 py-2">{e.description}</td>
                <td className="px-3 py-2">{e.vendor ?? '—'}</td>
                <td className="px-3 py-2">
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1.5"
                    style={{ backgroundColor: e.categoryColor }}
                  />
                  {e.categoryName}
                </td>
                <td className="px-3 py-2">{fmt.format(e.amount)}</td>
                <td className="px-3 py-2">{e.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ExpenseInspector
        open={open}
        detail={detail}
        createMode={createMode}
        categories={categories}
        isSuperAdmin={isSuperAdmin}
        onClose={() => setOpen(false)}
      />
    </div>
  )
}
```

- [ ] **Step 4: Verify + tsc + commit + PR**

```bash
pnpm test tests/unit/components/admin/analytics/tabs/ExpensesTab.test.tsx
pnpm exec tsc --noEmit
git add components/admin/analytics/tabs/ExpensesTab.tsx tests/unit/components/admin/analytics/tabs/ExpensesTab.test.tsx
git commit -m "feat(admin-v2): add ExpensesTab (donut + monthly bars + paginated table + create/edit Inspector)"
git push -u origin wave6p6/task-26-expenses-tab
gh pr create --title "feat(admin-v2): Phase 6 W4 ExpensesTab" --body "ExpenseCategoryDonut + ExpenseMonthlyBar + paginated table → ExpenseInspector. New Expense button opens create-mode inspector. 2 tests passing."
```

---

## Wave 5 — V2 root + V1 stub + dispatcher (sequential, **opus** model)

### Task 27: V2 composition + V1 stub + AnalyticsTabPills + AnalyticsRangePills + page dispatcher

**Wave:** 5 | **Branch:** `wave6p6/task-27-v2-root-dispatcher` | **Model:** opus

**Schema realities for this task:**
- `AdminAnalyticsV1.tsx` is a stub linking to 6 existing V1 routes: `/admin/analytics-v1` (relocated; see below), `/admin/financial`, `/admin/sales`, `/admin/expenses`, `/admin/goals`, `/admin/live-feed`. The spec calls for relocating `app/admin/analytics/page.tsx` (the V1 page, 595L) to `components/admin/_v1/AdminAnalyticsV1Page.tsx`. We do NOT need to move the route itself — we leave the existing analytics page logic compiled but routed only through the V1 stub via a new `app/admin/analytics-v1/page.tsx` that imports `AdminAnalyticsV1Page` and renders it. The original `app/admin/analytics/page.tsx` is REPLACED by the dispatcher.
- `AnalyticsTabPills.tsx`: client wrapper around `TabPills` primitive. On change, `router.push(\`?tab=${id}&range=${range}\`)` (preserve `?range=`).
- `AnalyticsRangePills.tsx`: client wrapper for the 5 range pills. On change, `router.push(\`?tab=${tab}&range=${newRange}\`)` (preserve `?tab=`). Uses `TIME_RANGES` from `lib/admin/analytics.ts`.
- `AdminAnalyticsV2.tsx`: server component that parses `searchParams.tab` + `searchParams.range`, renders TabPills + RangePills + KPI strip (Suspense) + 1 active tab's Suspense slot which awaits `load*Data(range)` and renders the tab component with `data` + `range` props. ExpensesTab additionally needs `categories` and `isSuperAdmin` props — loaded at the V2 root and passed through.
- Page dispatcher reads `NEXT_PUBLIC_ADMIN_V2_ENABLED`. If not "true" → `<AdminAnalyticsV1 />`. Otherwise resolves `isSuperAdmin` via session lookup (Phase 5 precedent) and renders `<AdminAnalyticsV2 ... />`.

**Files:**
- Create: `components/admin/_v1/AdminAnalyticsV1.tsx`
- Create: `components/admin/_v1/AdminAnalyticsV1Page.tsx` — verbatim relocation of current `app/admin/analytics/page.tsx`
- Create: `app/admin/analytics-v1/page.tsx` — re-exposes the V1 page at `/admin/analytics-v1`
- Create: `components/admin/dashboard/AdminAnalyticsV2.tsx`
- Create: `components/admin/dashboard/AnalyticsTabPills.tsx`
- Create: `components/admin/dashboard/AnalyticsRangePills.tsx`
- **Replace** `app/admin/analytics/page.tsx` with the dispatcher
- Tests:
  - `tests/unit/components/admin/dashboard/AdminAnalyticsV2.test.tsx`
  - `tests/unit/app/admin/analytics/page.test.tsx`

#### Steps

- [ ] **Step 1: Relocate the existing V1 analytics page**

Move the body of `app/admin/analytics/page.tsx` (the current 595-line file) into a new component file `components/admin/_v1/AdminAnalyticsV1Page.tsx`. Wrap the existing default export as `export function AdminAnalyticsV1Page(...)`. Then create a new tiny route `app/admin/analytics-v1/page.tsx`:

```tsx
// app/admin/analytics-v1/page.tsx
import { AdminAnalyticsV1Page } from '@/components/admin/_v1/AdminAnalyticsV1Page'

export const revalidate = 60

export default function Page() {
  return <AdminAnalyticsV1Page />
}
```

- [ ] **Step 2: Write `components/admin/_v1/AdminAnalyticsV1.tsx`**

```tsx
import Link from 'next/link'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { Card } from '@/components/ui/card'

const SECTIONS = [
  { href: '/admin/analytics-v1', title: 'Analytics (V1)', desc: 'Original analytics page' },
  { href: '/admin/financial', title: 'Financial', desc: 'P&L, expenses, taxes' },
  { href: '/admin/sales', title: 'Sales', desc: 'Sales reports' },
  { href: '/admin/expenses', title: 'Expenses', desc: 'Expense ledger' },
  { href: '/admin/goals', title: 'Sales Goals', desc: 'Targets and history' },
  { href: '/admin/live-feed', title: 'Live Feed', desc: 'Real-time sales' },
]

export function AdminAnalyticsV1() {
  return (
    <AdminLayout title="Analytics" subtitle="Overview, sales, customers, products, financial, expenses">
      <div className="space-y-4">
        <p className="text-sm text-white/50">
          The unified analytics dashboard is in beta. Enable{' '}
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

- [ ] **Step 3: Write `components/admin/dashboard/AnalyticsTabPills.tsx`**

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { TabPills, type TabPillsTab } from '@/components/ui/TabPills'
import type { AnalyticsTab } from '@/lib/admin/analytics'

export interface AnalyticsTabPillsProps {
  tabs: ReadonlyArray<{ id: AnalyticsTab; label: string }>
  active: AnalyticsTab
}

export function AnalyticsTabPills({ tabs, active }: AnalyticsTabPillsProps) {
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

- [ ] **Step 4: Write `components/admin/dashboard/AnalyticsRangePills.tsx`**

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { TIME_RANGES, type TimeRange } from '@/lib/admin/analytics'
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

export function AnalyticsRangePills({ active }: Props) {
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

- [ ] **Step 5: Write `components/admin/dashboard/AdminAnalyticsV2.tsx`**

```tsx
import { Suspense } from 'react'
import Link from 'next/link'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { StatCard } from '@/components/ui/StatCard'
import { prisma } from '@/lib/prisma'
import {
  loadAnalyticsKpis,
  loadOverviewData,
  loadSalesData,
  loadCustomersData,
  loadProductsData,
  loadFinancialData,
  loadExpensesData,
  isAnalyticsTab,
  isTimeRange,
  type AnalyticsTab,
  type TimeRange,
} from '@/lib/admin/analytics'
import { OverviewTab } from '@/components/admin/analytics/tabs/OverviewTab'
import { SalesTab } from '@/components/admin/analytics/tabs/SalesTab'
import { CustomersTab } from '@/components/admin/analytics/tabs/CustomersTab'
import { ProductsTab } from '@/components/admin/analytics/tabs/ProductsTab'
import { FinancialTab } from '@/components/admin/analytics/tabs/FinancialTab'
import { ExpensesTab } from '@/components/admin/analytics/tabs/ExpensesTab'
import { AnalyticsTabPills } from './AnalyticsTabPills'
import { AnalyticsRangePills } from './AnalyticsRangePills'

interface Props {
  searchParams: { tab?: string; range?: string }
  isSuperAdmin: boolean
}

const TAB_CONFIG: ReadonlyArray<{ id: AnalyticsTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'sales', label: 'Sales' },
  { id: 'customers', label: 'Customers' },
  { id: 'products', label: 'Products' },
  { id: 'financial', label: 'Financial' },
  { id: 'expenses', label: 'Expenses' },
]

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function parseTab(raw: string | undefined): AnalyticsTab {
  return isAnalyticsTab(raw) ? raw : 'overview'
}
function parseRange(raw: string | undefined): TimeRange {
  return isTimeRange(raw) ? raw : '30d'
}

async function KpiStripSlot({ range }: { range: TimeRange }) {
  const k = await loadAnalyticsKpis(range)
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
      <Link href={`?tab=sales&range=${range}`} className="block">
        <StatCard label="Revenue" value={fmt.format(k.revenue)} trend={k.revenueTrend} />
      </Link>
      <Link href={`?tab=overview&range=${range}`} className="block">
        <StatCard label="Orders" value={k.orders} trend={k.ordersTrend} />
      </Link>
      <Link href={`?tab=sales&range=${range}`} className="block">
        <StatCard label="AOV" value={fmt.format(k.aov)} trend={k.aovTrend} />
      </Link>
      <Link href={`?tab=financial&range=${range}`} className="block">
        <StatCard label="Gross Margin" value={`${k.grossMarginPct.toFixed(1)}%`} trend={k.marginTrend} />
      </Link>
    </div>
  )
}

async function OverviewSlot({ range }: { range: TimeRange }) {
  const data = await loadOverviewData(range)
  return <OverviewTab data={data} range={range} />
}
async function SalesSlot({ range }: { range: TimeRange }) {
  const data = await loadSalesData(range)
  return <SalesTab data={data} range={range} />
}
async function CustomersSlot({ range }: { range: TimeRange }) {
  const data = await loadCustomersData(range)
  return <CustomersTab data={data} range={range} />
}
async function ProductsSlot({ range }: { range: TimeRange }) {
  const data = await loadProductsData(range)
  return <ProductsTab data={data} range={range} />
}
async function FinancialSlot({ range }: { range: TimeRange }) {
  const data = await loadFinancialData(range)
  return <FinancialTab data={data} range={range} />
}
async function ExpensesSlot({ range, isSuperAdmin }: { range: TimeRange; isSuperAdmin: boolean }) {
  const [data, categories] = await Promise.all([
    loadExpensesData(range),
    prisma.expenseCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, color: true },
    }),
  ])
  return <ExpensesTab data={data} range={range} categories={categories} isSuperAdmin={isSuperAdmin} />
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

export async function AdminAnalyticsV2({ searchParams, isSuperAdmin }: Props) {
  const tab = parseTab(searchParams.tab)
  const range = parseRange(searchParams.range)

  return (
    <AdminLayout title="Analytics" subtitle="Overview, sales, customers, products, financial, expenses">
      <div className="space-y-3.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <AnalyticsTabPills tabs={TAB_CONFIG} active={tab} />
          <AnalyticsRangePills active={range} />
        </div>

        <Suspense fallback={<KpiSkeleton />}>
          <KpiStripSlot range={range} />
        </Suspense>

        {tab === 'overview' && (
          <Suspense fallback={<TabSkeleton />}><OverviewSlot range={range} /></Suspense>
        )}
        {tab === 'sales' && (
          <Suspense fallback={<TabSkeleton />}><SalesSlot range={range} /></Suspense>
        )}
        {tab === 'customers' && (
          <Suspense fallback={<TabSkeleton />}><CustomersSlot range={range} /></Suspense>
        )}
        {tab === 'products' && (
          <Suspense fallback={<TabSkeleton />}><ProductsSlot range={range} /></Suspense>
        )}
        {tab === 'financial' && (
          <Suspense fallback={<TabSkeleton />}><FinancialSlot range={range} /></Suspense>
        )}
        {tab === 'expenses' && (
          <Suspense fallback={<TabSkeleton />}><ExpensesSlot range={range} isSuperAdmin={isSuperAdmin} /></Suspense>
        )}
      </div>
    </AdminLayout>
  )
}
```

- [ ] **Step 6: Replace `app/admin/analytics/page.tsx` with the dispatcher**

```tsx
// app/admin/analytics/page.tsx
import { AdminAnalyticsV1 } from '@/components/admin/_v1/AdminAnalyticsV1'
import { AdminAnalyticsV2 } from '@/components/admin/dashboard/AdminAnalyticsV2'
import { getSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

export const revalidate = 60

interface PageProps {
  searchParams: Promise<{ tab?: string; range?: string }>
}

export default async function AdminAnalyticsPage({ searchParams }: PageProps) {
  const params = await searchParams

  if (process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED !== 'true') {
    return <AdminAnalyticsV1 />
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

  return <AdminAnalyticsV2 searchParams={params} isSuperAdmin={isSuperAdmin} />
}
```

- [ ] **Step 7: Write smoke test for `AdminAnalyticsV2`**

```tsx
// tests/unit/components/admin/dashboard/AdminAnalyticsV2.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Children, isValidElement, type ReactNode } from 'react'

vi.mock('@/lib/admin/analytics', () => ({
  loadAnalyticsKpis: vi.fn().mockResolvedValue({
    revenue: 1000, revenueTrend: { direction: 'flat', text: '— 0%' },
    orders: 10, ordersTrend: { direction: 'flat', text: '— 0%' },
    aov: 100, aovTrend: { direction: 'flat', text: '— 0%' },
    grossMarginPct: 50, marginTrend: { direction: 'flat', text: '— 0%' },
  }),
  loadOverviewData: vi.fn().mockResolvedValue({
    revenueTrend: [], ordersTrend: [], acquisitionTrend: [], statusDonut: [],
    goals: { id: 'default', dailyTarget: 500, weeklyTarget: 3500, monthlyTarget: 15000,
      quarterlyTarget: 45000, yearlyTarget: 180000, updatedAt: new Date() },
  }),
  loadSalesData: vi.fn().mockResolvedValue({ revenueTrend: [], topProducts: [] }),
  loadCustomersData: vi.fn().mockResolvedValue({
    acquisitionTrend: [], cohort: [], ltvScatter: [],
    table: { items: [], total: 0, page: 1, pageSize: 25 },
  }),
  loadProductsData: vi.fn().mockResolvedValue({
    topProducts: [], marginScatter: [], table: { items: [], total: 0, page: 1, pageSize: 25 },
  }),
  loadFinancialData: vi.fn().mockResolvedValue({
    revenueExpenseTrend: [], marginTrend: [], taxSummary: [], periodGrid: [],
  }),
  loadExpensesData: vi.fn().mockResolvedValue({
    categoryBreakdown: [], monthlyBars: [], table: { items: [], total: 0, page: 1, pageSize: 25 },
  }),
  isAnalyticsTab: (v: unknown) =>
    typeof v === 'string' && ['overview', 'sales', 'customers', 'products', 'financial', 'expenses'].includes(v),
  isTimeRange: (v: unknown) =>
    typeof v === 'string' && ['today', '7d', '30d', '90d', 'year'].includes(v),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: { expenseCategory: { findMany: vi.fn().mockResolvedValue([]) } },
}))
vi.mock('@/components/admin/dashboard/AnalyticsTabPills', () => ({
  AnalyticsTabPills: () => <div data-testid="tab-pills" />,
}))
vi.mock('@/components/admin/dashboard/AnalyticsRangePills', () => ({
  AnalyticsRangePills: () => <div data-testid="range-pills" />,
}))
vi.mock('@/components/admin/analytics/tabs/OverviewTab', () => ({
  OverviewTab: () => <div data-testid="tab-overview" />,
}))
vi.mock('@/components/admin/analytics/tabs/SalesTab', () => ({
  SalesTab: () => <div data-testid="tab-sales" />,
}))
vi.mock('@/components/admin/analytics/tabs/CustomersTab', () => ({
  CustomersTab: () => <div data-testid="tab-customers" />,
}))
vi.mock('@/components/admin/analytics/tabs/ProductsTab', () => ({
  ProductsTab: () => <div data-testid="tab-products" />,
}))
vi.mock('@/components/admin/analytics/tabs/FinancialTab', () => ({
  FinancialTab: () => <div data-testid="tab-financial" />,
}))
vi.mock('@/components/admin/analytics/tabs/ExpensesTab', () => ({
  ExpensesTab: () => <div data-testid="tab-expenses" />,
}))

// Walk an async server component tree by unwrapping promises returned from
// async functions. (Phase 4/5 helper pattern.)
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

import { AdminAnalyticsV2 } from '@/components/admin/dashboard/AdminAnalyticsV2'

describe('AdminAnalyticsV2', () => {
  it('renders tab pills + range pills + default Overview tab', async () => {
    const node = await AdminAnalyticsV2({ searchParams: {}, isSuperAdmin: false })
    render(node as React.ReactElement)
    expect(screen.getByTestId('tab-pills')).toBeTruthy()
    expect(screen.getByTestId('range-pills')).toBeTruthy()
  })

  it('renders ExpensesTab when tab=expenses', async () => {
    const node = await AdminAnalyticsV2({
      searchParams: { tab: 'expenses', range: '30d' },
      isSuperAdmin: true,
    })
    render(node as React.ReactElement)
    expect(screen.getByTestId('tab-pills')).toBeTruthy()
  })
})
```

- [ ] **Step 8: Write dispatcher test**

```tsx
// tests/unit/app/admin/analytics/page.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.resetModules()
})

describe('app/admin/analytics/page (dispatcher)', () => {
  it('renders V1 stub when NEXT_PUBLIC_ADMIN_V2_ENABLED is not "true"', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'false'
    vi.doMock('@/components/admin/_v1/AdminAnalyticsV1', () => ({
      AdminAnalyticsV1: () => 'V1',
    }))
    vi.doMock('@/components/admin/dashboard/AdminAnalyticsV2', () => ({
      AdminAnalyticsV2: () => 'V2',
    }))
    vi.doMock('@/lib/auth/session', () => ({ getSession: vi.fn() }))
    vi.doMock('@/lib/prisma', () => ({ prisma: { customer: { findUnique: vi.fn() } } }))
    const mod = await import('@/app/admin/analytics/page')
    const node = await mod.default({ searchParams: Promise.resolve({}) })
    expect(String(node)).toContain('V1')
  })

  it('renders V2 root when flag is "true"', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    vi.doMock('@/components/admin/_v1/AdminAnalyticsV1', () => ({
      AdminAnalyticsV1: () => 'V1',
    }))
    vi.doMock('@/components/admin/dashboard/AdminAnalyticsV2', () => ({
      AdminAnalyticsV2: () => 'V2',
    }))
    vi.doMock('@/lib/auth/session', () => ({
      getSession: vi.fn().mockResolvedValue({ userId: 'u1', isAdmin: true }),
    }))
    vi.doMock('@/lib/prisma', () => ({
      prisma: {
        customer: { findUnique: vi.fn().mockResolvedValue({ adminRole: 'SUPER_ADMIN' }) },
      },
    }))
    const mod = await import('@/app/admin/analytics/page')
    const node = await mod.default({ searchParams: Promise.resolve({}) })
    expect(String(node)).toContain('V2')
  })
})
```

- [ ] **Step 9: Run tests**

```bash
pnpm test tests/unit/components/admin/dashboard/AdminAnalyticsV2.test.tsx tests/unit/app/admin/analytics/page.test.tsx
```
Expected: PASS (4 tests).

- [ ] **Step 10: Type-check**

`pnpm exec tsc --noEmit` — zero new errors.

- [ ] **Step 11: Commit + push + PR**

```bash
git add \
  components/admin/_v1/AdminAnalyticsV1.tsx \
  components/admin/_v1/AdminAnalyticsV1Page.tsx \
  components/admin/dashboard/AdminAnalyticsV2.tsx \
  components/admin/dashboard/AnalyticsTabPills.tsx \
  components/admin/dashboard/AnalyticsRangePills.tsx \
  app/admin/analytics/page.tsx \
  app/admin/analytics-v1/page.tsx \
  tests/unit/components/admin/dashboard/AdminAnalyticsV2.test.tsx \
  tests/unit/app/admin/analytics/page.test.tsx
git commit -m "feat(admin-v2): wire Phase 6 analytics umbrella (V2 root + V1 stub + dispatcher + tab/range pills)"
git push -u origin wave6p6/task-27-v2-root-dispatcher
gh pr create --title "feat(admin-v2): Phase 6 W5 analytics dispatcher + V2 root" --body "Relocates V1 analytics page to /admin/analytics-v1, replaces dispatcher with NEXT_PUBLIC_ADMIN_V2_ENABLED gate, AdminAnalyticsV2 composes 6 Suspense tab slots + KPI strip, AnalyticsTabPills preserves ?range= and AnalyticsRangePills preserves ?tab=. 4 tests passing."
```

---

## Wave 6 — Verification + QA doc (sequential)

### Task 28: Phase 6 QA doc

**Wave:** 6 | **Branch:** `wave6p6/task-28-qa-doc` | **Model:** sonnet

**Schema realities for this task:** Documentation only. No production code changes. Mirror `docs/superpowers/plans/2026-05-30-admin-rebuild-phase5-qa.md` structure: smoke checklist per tab, mobile considerations (Chrome 375px), Phase 6.5 follow-ups, lint/tsc/test counts, regression risk callouts.

**Files:**
- Create: `docs/superpowers/plans/2026-05-30-admin-rebuild-phase6-qa.md`

#### Steps

- [ ] **Step 1: Verify all merged PRs and gather test counts**

```bash
pnpm exec tsc --noEmit > /tmp/p6-tsc.log 2>&1; cat /tmp/p6-tsc.log
pnpm test > /tmp/p6-tests.log 2>&1; tail -20 /tmp/p6-tests.log
pnpm lint > /tmp/p6-lint.log 2>&1; tail -20 /tmp/p6-lint.log
grep -rn "TODO(phase-6.5)" components/admin/analytics app/admin/analytics lib/admin/analytics.ts || true
```

Capture: total tests passing (per-file counts from `analytics.test.ts`, `actions.test.ts`, 10 chart tests, 4 inspector tests, 4 utility tests, 6 tab tests, V2 + dispatcher tests). Lint errors. tsc errors.

- [ ] **Step 2: Write `docs/superpowers/plans/2026-05-30-admin-rebuild-phase6-qa.md`**

```markdown
# Phase 6: Analytics + Financial — QA Notes

**Status:** Ready for manual QA.

## Scope shipped (W1–W5)

- W1: `lib/admin/analytics.ts` (TimeRange, getRangeBounds, KPI loader, 6 tab loaders, 3 detail loaders, lazy FinancialSnapshot backfill, SalesGoals helper) + `app/admin/analytics/actions.ts` (~14 actions, inspector wrappers, 6 CSV exports).
- W2: 10 Recharts wrappers under `components/admin/analytics/charts/`.
- W3: 4 Inspectors (Expense, Goals, Customer, Product) + 4 utility components (LiveFeedSidebar, PeriodGridTable, CohortTable, ExportButton).
- W4: 6 Tab components (Overview, Sales, Customers, Products, Financial, Expenses).
- W5: V2 root (`AdminAnalyticsV2`), V1 stub (`AdminAnalyticsV1`), V1 page relocation to `/admin/analytics-v1`, AnalyticsTabPills + AnalyticsRangePills, dispatcher gating by `NEXT_PUBLIC_ADMIN_V2_ENABLED`.

## Verification commands

| Check | Command | Expected |
|---|---|---|
| Type-check | `pnpm exec tsc --noEmit` | Zero new errors |
| Tests | `pnpm test` | All Phase 6 tests pass |
| Lint | `pnpm lint` | Zero new warnings |
| Build | `pnpm build` | Successful build |

## Smoke checklist (Chrome desktop, NEXT_PUBLIC_ADMIN_V2_ENABLED=true)

### Dispatcher
- [ ] `/admin/analytics` with flag off → V1 stub with 6 V1 links.
- [ ] `/admin/analytics-v1` → original 595L analytics page renders verbatim.
- [ ] `/admin/analytics` with flag on → V2 root with 6 tab pills + 5 range pills.

### Overview tab
- [ ] 4 charts render (Revenue trend, Orders bar, Customer acquisition, Status donut).
- [ ] Goals card shows 5 targets and "Edit goals" button.
- [ ] Edit goals → GoalsInspector opens with prefilled values; Save persists and toasts.
- [ ] Export CSV downloads `analytics-overview-30d-*.csv`.

### Sales tab
- [ ] Revenue trend + top products bar render.
- [ ] LiveFeedSidebar polls `/api/admin/sales/recent` every 5s; new sales appear.
- [ ] Mobile: LiveFeedSidebar collapses behind +/− accordion.

### Customers tab
- [ ] Acquisition chart + LTV scatter + Cohort heat-grid render.
- [ ] Customer table row click → CustomerInspector opens with detail; "Open customer profile →" link navigates to `/admin/customers/{id}`.

### Products tab
- [ ] TopProductsBar + MarginScatter render.
- [ ] Product row click → ProductInspector with units/revenue/margin for current range.

### Financial tab
- [ ] RevenueExpenseArea + MarginTrendChart render.
- [ ] Tax Summary card shows last 4 TaxRecord rows (or empty-state message).
- [ ] PeriodGridTable renders 12 months (some may be backfilled on first hit).

### Expenses tab
- [ ] Donut + monthly bars render.
- [ ] "+ New Expense" opens ExpenseInspector in create mode.
- [ ] Row click opens edit mode.
- [ ] SUPER_ADMIN sees enabled Delete; non-SUPER_ADMIN sees disabled Delete with tooltip "SUPER_ADMIN only".
- [ ] Deleting an invoice-linked expense returns the proper error toast.
- [ ] CSV export caps at 10,000 rows (try `?range=year` against seeded data).

### KPI strip
- [ ] All 4 cards link with `?tab=` + `?range=` preserved.
- [ ] Trends render arrows (up/down/flat) and percentages.

### Range pills
- [ ] Switching range preserves the active tab; URL updates.
- [ ] `?range=invalid` falls back to `30d`.

## Mobile considerations (Chrome 375px)

- [ ] Tab pills wrap (showShortcutHints prop on TabPills handles overflow).
- [ ] Range pills wrap below tab pills.
- [ ] All charts vertically stack (1-column grid at `<lg`).
- [ ] LiveFeedSidebar collapses into accordion at `<sm`.
- [ ] PeriodGridTable + CohortTable horizontally scroll within their borders.
- [ ] Inspector slide-out is full-screen at `<sm` (handled by `components/ui/Inspector.tsx`).

## Regression risk

- **V1 analytics page is untouched** — relocated under `/admin/analytics-v1` and linked from the V1 stub. The original loader logic was not edited.
- The other 5 V1 pages (`/admin/financial`, `/admin/sales`, `/admin/expenses`, `/admin/goals`, `/admin/live-feed`) are also untouched.
- `lib/admin/dashboard.ts` (Phase 2's `TimeRange`) is unchanged; Phase 6 defines its own `TimeRange` locally to avoid breakage.
- `FinancialSnapshot` was unused before this phase; lazy backfill is idempotent via `(date, periodType)` unique constraint.

## Counts (fill in after merge)

- TypeScript errors: __
- Lint warnings: __
- Tests: __ files, __ tests
- Net new files: ~46

## Phase 6.5 follow-ups (grep `TODO(phase-6.5)`)

- Wire chart-click → range narrow (currently no-op in 10 chart wrappers).
- Custom date range picker with `?from=`/`?to=` (currently 5 fixed ranges).
- Nightly cron to pre-populate `FinancialSnapshot` (currently lazy backfill on read).
- Refactor `get*ForInspector` wrappers to import from `lib/admin/analytics.ts` (currently inlined for W1 parallel-safety).
- Marketing performance tab cross-over (promotion ROI).
- TaxRecord workflow page (filing/payment lifecycle).
- Expense receipt upload / OCR.
- Budget alerts (warning/critical threshold notifications).
- Real-time chart updates via Socket.IO.
- Cohort retention curves (currently signup × order-count heat grid only).
```

- [ ] **Step 3: Commit + push + PR**

```bash
git add docs/superpowers/plans/2026-05-30-admin-rebuild-phase6-qa.md
git commit -m "docs(admin-v2): add Phase 6 QA doc with smoke checklist and 6.5 follow-ups"
git push -u origin wave6p6/task-28-qa-doc
gh pr create --title "docs(admin-v2): Phase 6 W6 QA doc" --body "Phase 6 verification + smoke checklist + mobile considerations + regression notes + Phase 6.5 follow-up list."
```

---

## Coverage gaps fixed inline

- **TimeRange divergence from Phase 2** — Phase 2's `lib/admin/dashboard.ts` uses `'today' | 'week' | 'month' | 'year'`. Phase 6 spec requires `'today' | '7d' | '30d' | '90d' | 'year'`. Resolved by defining a new `TimeRange` + `getRangeBounds` inside `lib/admin/analytics.ts` (Task 1) and a duplicate `TimeRange` + `getRangeBoundsLocal` in `actions.ts` (Task 2) for parallel-safety with Task 1.
- **V1 page relocation** — spec says "leave V1 page alone; V1 stub links to it." The dispatcher REPLACES `app/admin/analytics/page.tsx`, so the original V1 page logic is relocated to `components/admin/_v1/AdminAnalyticsV1Page.tsx` and re-exposed at `/admin/analytics-v1` (Task 27). V1 stub now links to `/admin/analytics-v1` (not the dispatcher itself, which would loop).
- **ExpenseCategory loading** — spec says "11 category options from ExpenseCategory table (loaded by parent or via separate action)." Resolved by loading `categories` at the V2 root (`ExpensesSlot`) via `prisma.expenseCategory.findMany`, then passing as a prop to `ExpensesTab` → `ExpenseInspector`. This avoids an extra round-trip on every Inspector open.
- **`isSuperAdmin` propagation for ExpenseInspector Delete gate** — spec mentions the SUPER_ADMIN gate but not the prop chain. Resolved by adopting the Phase 5 pattern: page dispatcher resolves `isSuperAdmin` once, passes to `AdminAnalyticsV2`, which passes to `ExpensesTab`, which passes to `ExpenseInspector`.
- **TaxPeriod / TaxRecordStatus type imports for client tabs** — `FinancialTab` is a client component but needs the enums. Re-exported `TaxPeriod` + `TaxRecordStatus` from `app/admin/analytics/actions.ts` (Task 2) so they can be imported via `import type` without pulling Prisma into the client bundle.
- **ExpenseCsvFilters shape** — Spec just says "exportExpensesCsv(range, filters)". Defined `ExpenseCsvFilters` explicitly in Task 2 actions so `ExportButton` and `ExpensesTab` agree on the shape.
- **`PeriodGridTable` loading vs empty distinction** — Spec says "loading skeleton while parent fetches" but parent passes pre-loaded data. Resolved by accepting `rows: FinancialSnapshotRow[] | null` so the parent can pass `null` if it's streaming the data (Suspense fallback uses skeleton; once data resolves, empty array shows the empty-state message).
- **Recharts mock pattern duplicated per chart test** — Each chart test mocks only the primitives it imports; the cross-cutting note 8 shows the maximal mock. Trimmed per-task in W2 task templates to just what each chart needs.
- **W4 prop-shape adoption note** — Added to each W4 task brief and lifted to cross-cutting note 7.
- **`exportCustomersCsv` / `exportProductsCsv` range argument** — Both ignore range (lifetime tables); explicit `void range` documents intent.

