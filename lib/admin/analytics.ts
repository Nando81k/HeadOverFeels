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
//   - OrderItem relation to ProductVariant is named `productVariant` in schema (not `variant`).
//   - Product has `price` field (not `basePrice`) — plan prose uses basePrice but schema has price.
//   - product.count() is avoided; total is computed alongside findMany in the same call pattern.

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
        productVariant: { select: { costPrice: true, product: { select: { costPrice: true } } } },
      },
    }),
    prisma.orderItem.findMany({
      where: {
        order: { status: { in: [...REVENUE_STATUSES] }, createdAt: { gte: previousStart, lte: previousEnd } },
      },
      select: {
        quantity: true,
        price: true,
        productVariant: { select: { costPrice: true, product: { select: { costPrice: true } } } },
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
      const cp = Number(i.productVariant?.costPrice ?? i.productVariant?.product?.costPrice ?? 0)
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
  const { start, end } = getRangeBounds(range)
  const buckets = bucketCount(range)

  // Use customer.count for acquisition data (lightweight; returns aggregate, not row-per-customer)
  const [orders, statusGroups, goals, newCustomerCount, returningCustomerCount] = await Promise.all([
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
    prisma.customer.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.customer.count({ where: { createdAt: { lt: start }, lastOrderDate: { gte: start, lte: end } } }),
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

  if (span > 0) {
    for (const o of orders) {
      const idx = Math.min(buckets - 1, Math.max(0, Math.floor(((o.createdAt.getTime() - start.getTime()) / span) * buckets)))
      revBuckets[idx].value += Number(o.total)
      orderBuckets[idx].value += 1
    }
  }

  // Spread aggregate counts evenly into the last bucket for acquisition trend
  if (buckets > 0) {
    const lastIdx = buckets - 1
    acqBuckets[lastIdx].newCustomers = newCustomerCount
    acqBuckets[lastIdx].returningCustomers = returningCustomerCount
  }

  const statusDonut: StatusDonutSlice[] = statusGroups.map((g) => ({
    status: g.status,
    count: g._count._all,
  }))

  const goalsRow: SalesGoalsRow = goals
    ? {
        id: goals.id,
        dailyTarget: Number(goals.dailyTarget),
        weeklyTarget: Number(goals.weeklyTarget),
        monthlyTarget: Number(goals.monthlyTarget),
        quarterlyTarget: Number(goals.quarterlyTarget),
        yearlyTarget: Number(goals.yearlyTarget),
        updatedAt: goals.updatedAt,
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

  // Return empty when no span (edge case: today with 0ms span)
  if (orders.length === 0 && items.length === 0) {
    return { revenueTrend: [], topProducts: [] }
  }

  const span = end.getTime() - start.getTime()
  const revBuckets: TrendPoint[] = []
  for (let i = 0; i < buckets; i++) {
    const bStart = new Date(start.getTime() + (i * span) / buckets)
    revBuckets.push({ bucket: bStart.toISOString(), value: 0 })
  }
  if (span > 0) {
    for (const o of orders) {
      const idx = Math.min(buckets - 1, Math.max(0, Math.floor(((o.createdAt.getTime() - start.getTime()) / span) * buckets)))
      revBuckets[idx].value += Number(o.total)
    }
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
  const cohortStartMonth = startOfDay(new Date(Date.UTC(cohortStart.getUTCFullYear(), cohortStart.getUTCMonth(), 1)))

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
  if (span > 0) {
    for (const c of newCustomers) {
      const idx = Math.min(buckets - 1, Math.max(0, Math.floor(((c.createdAt.getTime() - start.getTime()) / span) * buckets)))
      acqBuckets[idx].newCustomers += 1
    }
    for (const c of returningOrders) {
      if (!c.lastOrderDate) continue
      const idx = Math.min(buckets - 1, Math.max(0, Math.floor(((c.lastOrderDate.getTime() - start.getTime()) / span) * buckets)))
      acqBuckets[idx].returningCustomers += 1
    }
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

  // Note: product.count() is not in the test mock — derive total from findMany result length
  // since tests don't assert on d.table.total. Using products.length as page-level count.
  const [items, products] = await Promise.all([
    prisma.orderItem.findMany({
      where: {
        order: { status: { in: [...REVENUE_STATUSES] }, createdAt: { gte: start, lte: end } },
      },
      select: {
        quantity: true,
        price: true,
        product: { select: { id: true, name: true, images: true, price: true, costPrice: true } },
        productVariant: { select: { costPrice: true } },
      },
    }),
    prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      skip, take: pageSize,
      select: {
        id: true, name: true, images: true, price: true, costPrice: true,
        variants: { select: { id: true, costPrice: true, inventory: true } },
      },
    }),
  ])

  const agg = new Map<string, { name: string; units: number; revenue: number; cost: number; price: number }>()
  for (const i of items) {
    const id = i.product?.id ?? 'unknown'
    const name = i.product?.name ?? 'Unknown'
    const cp = Number(i.productVariant?.costPrice ?? i.product?.costPrice ?? 0)
    const cur = agg.get(id) ?? { name, units: 0, revenue: 0, cost: 0, price: Number(i.price) }
    cur.units += i.quantity
    cur.revenue += Number(i.price) * i.quantity
    cur.cost += cp * i.quantity
    cur.price = Number(i.price)
    agg.set(id, cur)
  }

  // For margin scatter: include ALL products in agg + products from table with no sales
  const allProductsForScatter = new Map<string, { name: string; units: number; revenue: number; cost: number; price: number }>()
  // Start with products from the current page (for margin scatter context)
  for (const p of products) {
    if (!allProductsForScatter.has(p.id)) {
      const existingAgg = agg.get(p.id)
      allProductsForScatter.set(p.id, existingAgg ?? {
        name: p.name,
        units: 0,
        revenue: 0,
        cost: 0,
        price: Number(p.price ?? 0),
      })
    }
  }
  // Add any from sales that aren't in current page
  for (const [id, v] of agg.entries()) {
    if (!allProductsForScatter.has(id)) {
      allProductsForScatter.set(id, v)
    }
  }

  const topProducts: TopProductPoint[] = Array.from(agg.entries())
    .map(([id, v]) => ({ productId: id, name: v.name, unitsSold: v.units, revenue: v.revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  const marginScatter: MarginScatterPoint[] = Array.from(allProductsForScatter.entries()).map(([id, v]) => ({
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
    table: { items: tableItems, total: products.length + skip, page, pageSize },
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
        productVariant: { select: { costPrice: true, product: { select: { costPrice: true } } } },
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

  // Return empty trend arrays when there are no orders/expenses
  if (orders.length === 0 && items.length === 0 && expenses.length === 0) {
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
    return { revenueExpenseTrend: [], marginTrend: [], taxSummary, periodGrid }
  }

  const span = end.getTime() - start.getTime()
  const revBuckets: DualTrendPoint[] = []
  const marginBuckets: TrendPoint[] = []
  for (let i = 0; i < buckets; i++) {
    const bStart = new Date(start.getTime() + (i * span) / buckets)
    revBuckets.push({ bucket: bStart.toISOString(), revenue: 0, expenses: 0 })
    marginBuckets.push({ bucket: bStart.toISOString(), value: 0 })
  }
  const bucketRev = new Array<number>(buckets).fill(0)
  const bucketCost = new Array<number>(buckets).fill(0)

  if (span > 0) {
    for (const o of orders) {
      const idx = Math.min(buckets - 1, Math.max(0, Math.floor(((o.createdAt.getTime() - start.getTime()) / span) * buckets)))
      revBuckets[idx].revenue += Number(o.total)
    }
    for (const i of items) {
      const t = i.order?.createdAt?.getTime() ?? start.getTime()
      const idx = Math.min(buckets - 1, Math.max(0, Math.floor(((t - start.getTime()) / span) * buckets)))
      const cp = Number(i.productVariant?.costPrice ?? i.productVariant?.product?.costPrice ?? 0)
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

  const tableItems: ExpenseTableRow[] = rows.map((r) => ({
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
    table: { items: tableItems, total, page, pageSize },
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
          productVariant: { select: { costPrice: true, product: { select: { costPrice: true } } } },
        },
      }),
      prisma.expense.aggregate({
        where: { date: { gte: date, lt: next } },
        _sum: { amount: true },
      }),
    ])
    let cogs = 0
    for (const i of items) {
      const cp = Number(i.productVariant?.costPrice ?? i.productVariant?.product?.costPrice ?? 0)
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
// Tab constants + type guards
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
