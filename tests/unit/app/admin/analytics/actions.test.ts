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
