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
        { quantity: 2, price: 50, productVariant: { costPrice: 20, product: { costPrice: null } } },
      ])
      .mockResolvedValueOnce([
        { quantity: 1, price: 50, productVariant: { costPrice: 25, product: { costPrice: null } } },
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
      { id: 'p1', name: 'Tee', images: '[]', costPrice: 5, price: 25,
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
    // loadFinancialPeriodGrid internally calls snapshotFindMany + orderAggregate + orderItemFindMany + expenseAggregate
    snapshotFindMany.mockResolvedValue([])
    orderAggregate.mockResolvedValue({ _sum: { total: 0, tax: 0 }, _count: { _all: 0 } })
    expenseAggregate.mockResolvedValue({ _sum: { amount: 0 } })
    snapshotUpsert.mockResolvedValue({})
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
        isTaxDeductible: true, status: 'PAID', paymentMethod: 'card', categoryId: 'cat1' },
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
      id: 'p1', name: 'Tee', images: '["/img.png"]', price: 25, costPrice: 5,
      variants: [{ id: 'v1', costPrice: 5 }],
    })
    orderItemAggregate.mockResolvedValue({
      _sum: { quantity: 12 },
    })
    orderItemFindMany.mockResolvedValue([
      { quantity: 12, price: 25, productVariant: { costPrice: 5, product: { costPrice: 5 } } },
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
