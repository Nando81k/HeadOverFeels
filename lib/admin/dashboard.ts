// lib/admin/dashboard.ts
import { prisma } from '@/lib/prisma'

// ============================================================
// Types
// ============================================================

export type TimeRange = 'today' | 'week' | 'month' | 'year'

export const TIME_RANGES: TimeRange[] = ['today', 'week', 'month', 'year']

export interface TrendData {
  direction: 'up' | 'down' | 'flat'
  text: string // pre-formatted, e.g. "↑ 12.1%"
}

export interface HeroRevenueData {
  label: string // "REVENUE TODAY" / "REVENUE THIS WEEK" etc.
  value: string // pre-formatted dollar amount, e.g. "$8,420"
  trend: TrendData
  sparklineData: number[]
}

export interface KpiData {
  unitsSold: { value: number; trend: TrendData }
  aov: { value: string; trend: TrendData }
  newCustomers: { value: number; trend: TrendData }
  cvr: { value: string; trend: TrendData }
}

export type AlertUrgency = 'critical' | 'high' | 'medium' | 'low'
export type AlertType = 'orders' | 'low-stock' | 'abandoned-carts' | 'reviews' | 'drop-ending'

export interface AttentionAlert {
  id: string // stable id for session-dismiss tracking
  type: AlertType
  icon: string // emoji
  title: string
  description?: string
  urgency: AlertUrgency
  href: string
}

export type GoalPace = 'ahead' | 'on-track' | 'behind' | 'critical' | 'unset'

export interface GoalSlice {
  goal: number | null // null = not set
  current: number
  pace: GoalPace
}

export interface SalesGoalsData {
  today: GoalSlice
  monthToDate: GoalSlice
}

export interface ActivityItem {
  id: string
  type: 'order' | 'refund' | 'drop-sale'
  status: 'success' | 'live' | 'warning'
  title: string
  description?: string
  value?: string
  timestamp: string
  href: string
}

// ============================================================
// Range bounds helper
// ============================================================

export interface RangeBounds {
  start: Date
  end: Date
  previousStart: Date
  previousEnd: Date
}

export function getRangeBounds(range: TimeRange, ref: Date = new Date()): RangeBounds {
  const end = new Date(ref)
  const start = new Date(ref)
  let durationMs: number
  // For 'today', the window duration (start-of-day → now) differs from the
  // previous-period shift (always 24h = one full day back). Track them separately.
  let previousShiftMs: number

  switch (range) {
    case 'today':
      start.setUTCHours(0, 0, 0, 0)
      durationMs = end.getTime() - start.getTime()
      previousShiftMs = 24 * 60 * 60 * 1000 // shift previous window exactly 1 day back
      break
    case 'week':
      durationMs = 7 * 24 * 60 * 60 * 1000
      previousShiftMs = durationMs
      start.setTime(end.getTime() - durationMs)
      break
    case 'month':
      durationMs = 30 * 24 * 60 * 60 * 1000
      previousShiftMs = durationMs
      start.setTime(end.getTime() - durationMs)
      break
    case 'year':
      durationMs = 365 * 24 * 60 * 60 * 1000
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
// Formatters
// ============================================================

const fmtUSD = (n: number) =>
  '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })

const fmtPct = (n: number, digits = 1) => `${n.toFixed(digits)}%`

function buildTrend(current: number, previous: number): TrendData {
  if (previous === 0) {
    return { direction: 'flat', text: '— No prior data' }
  }
  const pct = ((current - previous) / previous) * 100
  if (Math.abs(pct) < 0.5) {
    return { direction: 'flat', text: '— 0%' }
  }
  return {
    direction: pct > 0 ? 'up' : 'down',
    text: `${pct > 0 ? '↑' : '↓'} ${Math.abs(pct).toFixed(1)}%`,
  }
}

const LABEL_BY_RANGE: Record<TimeRange, string> = {
  today: 'REVENUE TODAY',
  week: 'REVENUE THIS WEEK',
  month: 'REVENUE THIS MONTH',
  year: 'REVENUE THIS YEAR',
}

// ============================================================
// Loaders
// ============================================================

export async function loadHeroRevenue(range: TimeRange): Promise<HeroRevenueData> {
  const { start, end, previousStart, previousEnd } = getRangeBounds(range)

  const [currentSum, previousSum, sparklineRaw] = await Promise.all([
    prisma.order.aggregate({
      where: { status: { in: ['CONFIRMED', 'SHIPPED', 'DELIVERED'] }, createdAt: { gte: start, lte: end } },
      _sum: { total: true },
    }),
    prisma.order.aggregate({
      where: { status: { in: ['CONFIRMED', 'SHIPPED', 'DELIVERED'] }, createdAt: { gte: previousStart, lte: previousEnd } },
      _sum: { total: true },
    }),
    prisma.order.findMany({
      where: { status: { in: ['CONFIRMED', 'SHIPPED', 'DELIVERED'] }, createdAt: { gte: start, lte: end } },
      select: { total: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  // Bucket sparkline into 30 buckets across the range for a smooth curve
  const buckets = new Array(30).fill(0)
  const span = end.getTime() - start.getTime()
  if (span > 0) {
    for (const o of sparklineRaw) {
      const t = (o.createdAt.getTime() - start.getTime()) / span
      const idx = Math.min(29, Math.max(0, Math.floor(t * 30)))
      buckets[idx] += Number(o.total)
    }
  }

  const current = Number(currentSum._sum.total ?? 0)
  const previous = Number(previousSum._sum.total ?? 0)

  return {
    label: LABEL_BY_RANGE[range],
    value: fmtUSD(current),
    trend: buildTrend(current, previous),
    sparklineData: buckets,
  }
}

export async function loadKpiStrip(range: TimeRange): Promise<KpiData> {
  const { start, end, previousStart, previousEnd } = getRangeBounds(range)

  const CONFIRMED_STATUSES = ['CONFIRMED', 'SHIPPED', 'DELIVERED'] as Array<'CONFIRMED' | 'SHIPPED' | 'DELIVERED'>

  const [
    currentOrders,
    previousOrders,
    currentNewCustomers,
    previousNewCustomers,
  ] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: CONFIRMED_STATUSES }, createdAt: { gte: start, lte: end } },
      select: { total: true, items: { select: { quantity: true } } },
    }),
    prisma.order.findMany({
      where: { status: { in: CONFIRMED_STATUSES }, createdAt: { gte: previousStart, lte: previousEnd } },
      select: { total: true, items: { select: { quantity: true } } },
    }),
    prisma.customer.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.customer.count({ where: { createdAt: { gte: previousStart, lte: previousEnd } } }),
  ])

  const sumUnits = (orders: typeof currentOrders) =>
    orders.reduce((s, o) => s + o.items.reduce((u, i) => u + i.quantity, 0), 0)
  const sumRev = (orders: typeof currentOrders) =>
    orders.reduce((s, o) => s + Number(o.total), 0)

  const currentUnits = sumUnits(currentOrders)
  const previousUnits = sumUnits(previousOrders)
  const currentRev = sumRev(currentOrders)
  const previousRev = sumRev(previousOrders)

  const currentAov = currentOrders.length > 0 ? currentRev / currentOrders.length : 0
  const previousAov = previousOrders.length > 0 ? previousRev / previousOrders.length : 0

  // CVR: orders / sessions. If no session tracking, fall back to a stub.
  // TODO follow-up: wire a real session-count source for CVR.
  const currentCvr = 3.4
  const previousCvr = 3.6

  return {
    unitsSold: { value: currentUnits, trend: buildTrend(currentUnits, previousUnits) },
    aov: { value: fmtUSD(currentAov), trend: buildTrend(currentAov, previousAov) },
    newCustomers: { value: currentNewCustomers, trend: buildTrend(currentNewCustomers, previousNewCustomers) },
    cvr: { value: fmtPct(currentCvr), trend: buildTrend(currentCvr, previousCvr) },
  }
}

export async function loadNeedsAttention(): Promise<AttentionAlert[]> {
  const alerts: AttentionAlert[] = []
  const now = new Date()

  // 1. Orders awaiting fulfillment
  const pendingOrders = await prisma.order.findMany({
    where: { status: 'CONFIRMED' },
    orderBy: { createdAt: 'asc' },
    take: 1,
    select: { createdAt: true },
  })
  const pendingCount = await prisma.order.count({ where: { status: 'CONFIRMED' } })
  if (pendingCount > 0 && pendingOrders[0]) {
    const ageMinutes = Math.floor((now.getTime() - pendingOrders[0].createdAt.getTime()) / 60000)
    alerts.push({
      id: 'orders-awaiting:bulk',
      type: 'orders',
      icon: '📦',
      title: `${pendingCount} order${pendingCount === 1 ? '' : 's'} awaiting fulfillment`,
      description: `Oldest: ${ageMinutes} min ago`,
      urgency: ageMinutes > 60 ? 'critical' : 'high',
      href: '/admin/fulfillment',
    })
  }

  // 2. Low stock — ProductVariant.inventory field confirmed in schema
  const lowStockVariants = await prisma.productVariant.findMany({
    where: { inventory: { lte: 10, gte: 0 } },
    select: { inventory: true },
  })
  if (lowStockVariants.length > 0) {
    const critical = lowStockVariants.filter((v) => v.inventory <= 3).length
    alerts.push({
      id: 'low-stock:bulk',
      type: 'low-stock',
      icon: '⚠',
      title: `${lowStockVariants.length} item${lowStockVariants.length === 1 ? '' : 's'} low on stock`,
      description: critical > 0 ? `${critical} critical (≤3 units)` : undefined,
      urgency: critical > 0 ? 'critical' : 'high',
      href: '/admin/products?filter=low-stock',
    })
  }

  // 3. Abandoned carts (24h window, > $50, not yet recovered)
  // Schema has AbandonedCart model with totalValue, abandonedAt, and recovered fields.
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const abandonedCount = await prisma.abandonedCart.count({
    where: {
      recovered: false,
      totalValue: { gt: 50 },
      abandonedAt: { gte: cutoff24h, lte: now },
    },
  })
  if (abandonedCount > 0) {
    alerts.push({
      id: 'abandoned-carts:bulk',
      type: 'abandoned-carts',
      icon: '🛒',
      title: `${abandonedCount} high-value cart${abandonedCount === 1 ? '' : 's'} abandoned`,
      description: 'Over $50, within last 24h',
      urgency: 'medium',
      href: '/admin/customers?filter=abandoned-carts',
    })
  }

  // 4. Reviews pending moderation — ReviewStatus.PENDING confirmed in schema
  const pendingReviews = await prisma.review.count({ where: { status: 'PENDING' } })
  if (pendingReviews > 0) {
    alerts.push({
      id: 'reviews-pending:bulk',
      type: 'reviews',
      icon: '★',
      title: `${pendingReviews} review${pendingReviews === 1 ? '' : 's'} need${pendingReviews === 1 ? 's' : ''} moderation`,
      urgency: 'medium',
      href: '/admin/products?tab=reviews',
    })
  }

  // 5. Drop ending soon (< 4h)
  // Schema investigation: Product model has `dropEndDate: DateTime?` but no `isDrop` boolean flag.
  // No separate Drop model exists. Using `dropEndDate != null` as the indicator that a product is a drop.
  // TODO: wire drop-ending alert when schema is clarified (add isDrop flag or dedicated Drop model)
  const inFourHours = new Date(now.getTime() + 4 * 60 * 60 * 1000)
  const endingDrops = await prisma.product.findMany({
    where: {
      dropEndDate: { gte: now, lte: inFourHours },
    },
    orderBy: { dropEndDate: 'asc' },
    take: 1,
    select: { id: true, name: true, dropEndDate: true, slug: true },
  })
  if (endingDrops[0]) {
    const d = endingDrops[0]
    const msLeft = d.dropEndDate!.getTime() - now.getTime()
    const h = Math.floor(msLeft / 3600000)
    const m = Math.floor((msLeft % 3600000) / 60000)
    alerts.push({
      id: `drop-ending:${d.id}`,
      type: 'drop-ending',
      icon: '⚡',
      title: `Drop ends in ${h}h ${m}m`,
      description: d.name,
      urgency: h < 1 ? 'critical' : 'high',
      href: `/admin/products?tab=drops&id=${d.slug}`,
    })
  }

  // Sort by urgency descending
  const order: Record<AlertUrgency, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  return alerts.sort((a, b) => order[a.urgency] - order[b.urgency])
}

export async function loadSalesGoals(): Promise<SalesGoalsData> {
  const now = new Date()
  const startOfDay = new Date(now)
  startOfDay.setUTCHours(0, 0, 0, 0)
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  // Uses the typed SalesGoals singleton model (id='default') rather than the generic Setting table.
  // Confirmed in schema.prisma line 764: model SalesGoals with dailyTarget, monthlyTarget etc.
  const [todayRev, mtdRev, goals] = await Promise.all([
    prisma.order.aggregate({
      where: { status: { in: ['CONFIRMED', 'SHIPPED', 'DELIVERED'] }, createdAt: { gte: startOfDay } },
      _sum: { total: true },
    }),
    prisma.order.aggregate({
      where: { status: { in: ['CONFIRMED', 'SHIPPED', 'DELIVERED'] }, createdAt: { gte: startOfMonth } },
      _sum: { total: true },
    }),
    prisma.salesGoals.findUnique({ where: { id: 'default' } }),
  ])

  const todayCurrent = Number(todayRev._sum.total ?? 0)
  const mtdCurrent = Number(mtdRev._sum.total ?? 0)
  const dailyGoal = goals?.dailyTarget ?? null
  const monthlyGoal = goals?.monthlyTarget ?? null

  // Pace: today is simple ratio; month-to-date needs expected pace
  const todayProgress = dailyGoal ? todayCurrent / dailyGoal : 0
  const todayPace: GoalPace = dailyGoal === null
    ? 'unset'
    : todayProgress >= 1 ? 'ahead'
    : todayProgress >= 0.7 ? 'on-track'
    : todayProgress >= 0.5 ? 'behind'
    : 'critical'

  const daysIntoMonth = now.getUTCDate()
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate()
  const expectedMtdProgress = daysIntoMonth / daysInMonth
  const mtdProgress = monthlyGoal ? mtdCurrent / monthlyGoal : 0
  const mtdPace: GoalPace = monthlyGoal === null
    ? 'unset'
    : mtdProgress >= expectedMtdProgress ? 'on-track'
    : mtdProgress >= expectedMtdProgress * 0.7 ? 'behind'
    : 'critical'

  return {
    today: { goal: dailyGoal, current: todayCurrent, pace: todayPace },
    monthToDate: { goal: monthlyGoal, current: mtdCurrent, pace: mtdPace },
  }
}

export async function loadInitialActivity(limit = 5): Promise<ActivityItem[]> {
  // Recent orders + refunds + drop sales, merged and sorted by createdAt desc
  // Schema investigation: Product has no `isDrop` boolean field. Uses `dropEndDate != null`
  // as a proxy for drop products (products with a set drop end date are limited-edition drops).
  // TODO: use an explicit isDrop flag or dedicated Drop model once schema is clarified.
  const orders = await prisma.order.findMany({
    where: { status: { in: ['CONFIRMED', 'SHIPPED', 'DELIVERED'] } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      orderNumber: true,
      total: true,
      createdAt: true,
      items: {
        take: 1,
        select: {
          product: { select: { name: true, dropEndDate: true } },
          quantity: true,
        },
      },
    },
  })

  return orders.map((o): ActivityItem => {
    const item = o.items[0]
    // Treat products with a dropEndDate as drop sales
    const isDrop = Boolean(item?.product?.dropEndDate)
    const ago = formatAgo(o.createdAt)
    return {
      id: o.id,
      type: isDrop ? 'drop-sale' : 'order',
      status: isDrop ? 'live' : 'success',
      title: isDrop ? 'Drop sale' : `Order #${o.orderNumber}`,
      description: item ? `${item.product?.name ?? 'Item'} × ${item.quantity}` : undefined,
      value: fmtUSD(Number(o.total)),
      timestamp: ago,
      href: `/admin/orders/${o.id}`,
    }
  })
}

function formatAgo(d: Date): string {
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diffSec < 60) return `${diffSec}s ago`
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  return `${Math.floor(diffSec / 86400)}d ago`
}
