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
 *   — Same pattern as fulfillment PR #94 + marketing PR parallel dispatch.
 */

import { revalidatePath } from 'next/cache'
import type { ExpenseStatus } from '@prisma/client'
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

/**
 * Slim range-bounds helper for actions — only needs current window (not previous-period).
 * A full getRangeBounds with previous-period is in lib/admin/analytics.ts (Task 1).
 */
function getRangeBoundsLocal(range: TimeRange, ref: Date = new Date()): { start: Date; end: Date } {
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
// These are defined here inline for W1 parallel-safety with Task 1.
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

export interface ExpenseCsvFilters {
  categoryId?: string
  status?: ExpenseStatus
  isTaxDeductible?: boolean
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

/** SUPER_ADMIN gate — also rejects if expense is linked to an invoice. */
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
// INSPECTOR DATA WRAPPERS (inline Prisma queries — parallel-safe with Task 1)
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
      id: true, name: true, images: true, price: true, costPrice: true,
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
      productVariant: { select: { costPrice: true, product: { select: { costPrice: true } } } },
    },
  })
  let units = 0, revenue = 0, cost = 0
  for (const i of items) {
    const cp = Number(i.productVariant?.costPrice ?? i.productVariant?.product?.costPrice ?? 0)
    units += i.quantity
    revenue += Number(i.price) * i.quantity
    cost += cp * i.quantity
  }
  const grossMargin = revenue - cost
  return {
    id: p.id,
    name: p.name,
    imageUrl: safeFirstImage(p.images),
    basePrice: Number(p.price ?? 0),
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
// CSV EXPORTS — all capped at 10,000 rows
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
  void range // table is all customers ordered by spend — not range-bounded
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
    select: { id: true, name: true, price: true, costPrice: true },
  })
  if (products.length > CSV_MAX_ROWS) return { ok: false, error: 'Too many rows — narrow the date range' }
  const csv = rowsToCsv(
    ['id', 'name', 'price', 'costPrice'],
    products.map((p) => [p.id, p.name, Number(p.price ?? 0), Number(p.costPrice ?? 0)]),
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
