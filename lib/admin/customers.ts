// lib/admin/customers.ts
//
// Single source of truth for Phase 8 customers admin data shapes + Prisma queries.
// Mirrors Phase 6/7 pattern: TimeRange + getRangeBounds + buildTrend + KPI loader +
// tab loader + 9 detail loaders. All list loaders default-filter anonymizedAt: null.
//
// Schema adaptations (verified against prisma/schema.prisma):
//   - Customer.profilePictureUrl (NOT avatarUrl)
//   - CustomerNote.isImportant (NOT importance)
//   - Address.address1/address2/state/firstName/lastName (NOT line1/line2/region/name)
//   - Customer.anonymizedAt DateTime? — NULL = active; non-null = GDPR anonymized
//   - RefundRecord.createdById is the FK for refunds, NOT customerId
//   - Return.customerId is the FK for returns via "ReturnCustomer" relation
//   - SupportTicket.priority is SupportPriority enum (LOW/MEDIUM/HIGH/URGENT)
//   - TimeRange is Phase 8 local — do NOT import from sibling phase files

import { prisma } from '@/lib/prisma'
import type {
  AddressType,
  ReviewStatus,
  SupportTicketStatus,
  SupportTicketType,
  SupportPriority,
  OrderStatus,
  PointsTransactionType,
} from '@prisma/client'

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

  switch (range) {
    case 'today':
      start.setUTCHours(0, 0, 0, 0)
      durationMs = end.getTime() - start.getTime()
      break
    case '7d':
      durationMs = 7 * day
      start.setTime(end.getTime() - durationMs)
      break
    case '30d':
      durationMs = 30 * day
      start.setTime(end.getTime() - durationMs)
      break
    case '90d':
      durationMs = 90 * day
      start.setTime(end.getTime() - durationMs)
      break
    case 'year':
      durationMs = 365 * day
      start.setTime(end.getTime() - durationMs)
      break
  }

  return {
    start,
    end,
    previousStart: new Date(start.getTime() - durationMs),
    previousEnd: new Date(end.getTime() - durationMs),
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
// Pagination
// ============================================================

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

const DEFAULT_PAGE_SIZE = 25

// ============================================================
// Tab + filter shapes
// ============================================================

export const CUSTOMERS_TABS = ['all', 'vip', 'at-risk', 'inactive', 'recent'] as const
export type CustomersTab = (typeof CUSTOMERS_TABS)[number]

export function isCustomersTab(v: unknown): v is CustomersTab {
  return typeof v === 'string' && (CUSTOMERS_TABS as readonly string[]).includes(v)
}

export function isTimeRange(v: unknown): v is TimeRange {
  return typeof v === 'string' && (TIME_RANGES as readonly string[]).includes(v)
}

export interface CustomersFilters {
  search?: string
  tierId?: string
  page?: number
  pageSize?: number
}

// ============================================================
// Row types
// ============================================================

export interface CustomerRow {
  id: string
  email: string
  name: string | null
  currentPoints: number
  totalOrders: number
  totalSpent: number
  lastOrderDate: Date | null
  createdAt: Date
  tierId: string | null
  tierName: string | null
  tierColor: string | null
}

export interface CustomerHeaderData {
  id: string
  email: string
  name: string | null
  phone: string | null
  profilePictureUrl: string | null
  birthday: Date | null
  newsletter: boolean
  smsOptIn: boolean
  currentPoints: number
  lifetimePoints: number
  totalSpent: number
  totalOrders: number
  lastOrderDate: Date | null
  createdAt: Date
  anonymizedAt: Date | null
  isAnonymized: boolean
  tierId: string | null
  tierName: string | null
  tierSlug: string | null
  tierColor: string | null
}

export interface OrderRow {
  id: string
  orderNumber: string
  status: OrderStatus
  total: number
  createdAt: Date
}

export interface CustomerLoyaltyData {
  currentPoints: number
  lifetimePoints: number
  annualPointsEarned: number
  tierStartDate: Date
  tierId: string | null
  tierName: string | null
  tierSlug: string | null
  tierColor: string | null
  transactions: LoyaltyTransactionRow[]
}

export interface LoyaltyTransactionRow {
  id: string
  points: number
  type: PointsTransactionType
  description: string
  createdAt: Date
  orderId: string | null
}

export interface AddressRow {
  id: string
  firstName: string
  lastName: string
  company: string | null
  address1: string
  address2: string | null
  city: string
  state: string
  postalCode: string
  country: string
  isDefault: boolean
  type: AddressType
}

export interface ReviewRow {
  id: string
  rating: number
  status: ReviewStatus
  productId: string
  productName: string
  createdAt: Date
}

export interface SupportTicketRow {
  id: string
  ticketNumber: string
  type: SupportTicketType
  status: SupportTicketStatus
  priority: SupportPriority
  createdAt: Date
}

export interface CustomerNoteRow {
  id: string
  content: string
  authorId: string
  authorName: string
  isImportant: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ActivityEvent {
  id: string
  type: 'order' | 'points' | 'review' | 'ticket'
  label: string
  timestamp: Date
  meta?: string
}

export interface CustomerRiskData {
  totalOrders: number
  refundCount: number
  refundRate: number   // percent 0-100
  returnCount: number
  returnRate: number   // percent 0-100
  chargebackCount: number
  avgDaysToReturn: number
}

// ============================================================
// KPI shape
// ============================================================

export interface CustomersKpiData {
  totalCustomers: number
  newInRange: number
  newInRangeTrend: TrendData
  avgLtv: number
  atRiskCount: number
}

// ============================================================
// KPI loader
// ============================================================

export async function loadCustomersKpis(range: TimeRange): Promise<CustomersKpiData> {
  const { start, end, previousStart, previousEnd } = getRangeBounds(range)
  const now = new Date()
  const day = 24 * 60 * 60 * 1000
  const atRiskCutoff = new Date(now.getTime() - 90 * day)

  const [
    totalCustomers,
    newInRange,
    newInRangePrev,
    atRiskCount,
    avgLtvAgg,
  ] = await Promise.all([
    prisma.customer.count({ where: { anonymizedAt: null } }),
    prisma.customer.count({ where: { anonymizedAt: null, createdAt: { gte: start, lte: end } } }),
    prisma.customer.count({ where: { anonymizedAt: null, createdAt: { gte: previousStart, lte: previousEnd } } }),
    prisma.customer.count({
      where: {
        anonymizedAt: null,
        totalOrders: { gte: 2 },
        lastOrderDate: { lt: atRiskCutoff },
      },
    }),
    prisma.customer.aggregate({
      where: { anonymizedAt: null },
      _avg: { totalSpent: true },
    }),
  ])

  return {
    totalCustomers,
    newInRange,
    newInRangeTrend: buildTrend(newInRange, newInRangePrev),
    avgLtv: Number(avgLtvAgg._avg.totalSpent ?? 0),
    atRiskCount,
  }
}

// ============================================================
// Tab loader
// ============================================================

function buildTabWhere(
  tab: CustomersTab,
  range: TimeRange,
): Record<string, unknown> {
  const now = new Date()
  const day = 24 * 60 * 60 * 1000
  const { start } = getRangeBounds(range)

  switch (tab) {
    case 'all':
      return { anonymizedAt: null }
    case 'vip':
      return { anonymizedAt: null, totalSpent: { gte: 1000 } }
    case 'at-risk': {
      const cutoff = new Date(now.getTime() - 90 * day)
      return {
        anonymizedAt: null,
        totalOrders: { gte: 2 },
        lastOrderDate: { lt: cutoff },
      }
    }
    case 'inactive': {
      const cutoff = new Date(now.getTime() - 180 * day)
      return {
        anonymizedAt: null,
        OR: [{ totalOrders: 0 }, { lastOrderDate: { lt: cutoff } }],
      }
    }
    case 'recent':
      return { anonymizedAt: null, createdAt: { gte: start } }
  }
}

export async function loadCustomersTab(
  tab: CustomersTab,
  range: TimeRange,
  filters: CustomersFilters = {},
): Promise<PaginatedResult<CustomerRow>> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  const baseWhere = buildTabWhere(tab, range)

  // Merge search filter
  const where: Record<string, unknown> = { ...baseWhere }
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
      orderBy: { totalSpent: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        currentPoints: true,
        totalOrders: true,
        totalSpent: true,
        lastOrderDate: true,
        createdAt: true,
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
      currentPoints: c.currentPoints,
      totalOrders: c.totalOrders,
      totalSpent: Number(c.totalSpent ?? 0),
      lastOrderDate: c.lastOrderDate ?? null,
      createdAt: c.createdAt,
      tierId: c.loyaltyTier?.id ?? null,
      tierName: c.loyaltyTier?.name ?? null,
      tierColor: c.loyaltyTier?.primaryColor ?? null,
    })),
    total,
    page,
    pageSize,
  }
}

// ============================================================
// Detail loaders
// ============================================================

export async function loadCustomerHeader(id: string): Promise<CustomerHeaderData | null> {
  const c = await prisma.customer.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      profilePictureUrl: true,
      birthday: true,
      newsletter: true,
      smsOptIn: true,
      currentPoints: true,
      lifetimePoints: true,
      totalSpent: true,
      totalOrders: true,
      lastOrderDate: true,
      createdAt: true,
      anonymizedAt: true,
      loyaltyTier: { select: { id: true, name: true, slug: true, primaryColor: true } },
    },
  })
  if (!c) return null
  return {
    id: c.id,
    email: c.email,
    name: c.name ?? null,
    phone: c.phone ?? null,
    profilePictureUrl: c.profilePictureUrl ?? null,
    birthday: c.birthday ?? null,
    newsletter: c.newsletter,
    smsOptIn: c.smsOptIn,
    currentPoints: c.currentPoints,
    lifetimePoints: c.lifetimePoints,
    totalSpent: Number(c.totalSpent ?? 0),
    totalOrders: c.totalOrders,
    lastOrderDate: c.lastOrderDate ?? null,
    createdAt: c.createdAt,
    anonymizedAt: c.anonymizedAt ?? null,
    isAnonymized: c.anonymizedAt !== null,
    tierId: c.loyaltyTier?.id ?? null,
    tierName: c.loyaltyTier?.name ?? null,
    tierSlug: c.loyaltyTier?.slug ?? null,
    tierColor: c.loyaltyTier?.primaryColor ?? null,
  }
}

export async function loadCustomerOrders(
  id: string,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<PaginatedResult<OrderRow>> {
  const skip = (page - 1) * pageSize
  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where: { customerId: id },
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
      },
    }),
    prisma.order.count({ where: { customerId: id } }),
  ])
  return {
    items: rows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      total: Number(o.total ?? 0),
      createdAt: o.createdAt,
    })),
    total,
    page,
    pageSize,
  }
}

export async function loadCustomerLoyalty(id: string): Promise<CustomerLoyaltyData | null> {
  const c = await prisma.customer.findUnique({
    where: { id },
    select: {
      id: true,
      currentPoints: true,
      lifetimePoints: true,
      annualPointsEarned: true,
      tierStartDate: true,
      loyaltyTier: { select: { id: true, name: true, slug: true, primaryColor: true } },
      pointsTransactions: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          points: true,
          type: true,
          description: true,
          createdAt: true,
          orderId: true,
        },
      },
    },
  })
  if (!c) return null
  return {
    currentPoints: c.currentPoints,
    lifetimePoints: c.lifetimePoints,
    annualPointsEarned: c.annualPointsEarned,
    tierStartDate: c.tierStartDate,
    tierId: c.loyaltyTier?.id ?? null,
    tierName: c.loyaltyTier?.name ?? null,
    tierSlug: c.loyaltyTier?.slug ?? null,
    tierColor: c.loyaltyTier?.primaryColor ?? null,
    transactions: c.pointsTransactions.map((t) => ({
      id: t.id,
      points: Number(t.points),
      type: t.type,
      description: t.description,
      createdAt: t.createdAt,
      orderId: t.orderId ?? null,
    })),
  }
}

export async function loadCustomerAddresses(id: string): Promise<AddressRow[]> {
  const rows = await prisma.address.findMany({
    where: { customerId: id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      company: true,
      address1: true,
      address2: true,
      city: true,
      state: true,
      postalCode: true,
      country: true,
      isDefault: true,
      type: true,
    },
  })
  return rows.map((a) => ({
    id: a.id,
    firstName: a.firstName,
    lastName: a.lastName,
    company: a.company ?? null,
    address1: a.address1,
    address2: a.address2 ?? null,
    city: a.city,
    state: a.state,
    postalCode: a.postalCode,
    country: a.country,
    isDefault: a.isDefault,
    type: a.type,
  }))
}

export async function loadCustomerReviews(
  id: string,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<PaginatedResult<ReviewRow>> {
  const skip = (page - 1) * pageSize
  const [rows, total] = await Promise.all([
    prisma.review.findMany({
      where: { customerId: id },
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        rating: true,
        status: true,
        createdAt: true,
        product: { select: { id: true, name: true } },
      },
    }),
    prisma.review.count({ where: { customerId: id } }),
  ])
  return {
    items: rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      status: r.status,
      productId: r.product?.id ?? '',
      productName: r.product?.name ?? 'Unknown',
      createdAt: r.createdAt,
    })),
    total,
    page,
    pageSize,
  }
}

export async function loadCustomerSupportTickets(
  id: string,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<PaginatedResult<SupportTicketRow>> {
  const skip = (page - 1) * pageSize
  const [rows, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where: { customerId: id },
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ticketNumber: true,
        type: true,
        status: true,
        priority: true,
        createdAt: true,
      },
    }),
    prisma.supportTicket.count({ where: { customerId: id } }),
  ])
  return {
    items: rows.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      type: t.type,
      status: t.status,
      priority: t.priority,
      createdAt: t.createdAt,
    })),
    total,
    page,
    pageSize,
  }
}

export async function loadCustomerNotes(id: string): Promise<CustomerNoteRow[]> {
  const rows = await prisma.customerNote.findMany({
    where: { customerId: id },
    orderBy: [{ isImportant: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      content: true,
      authorId: true,
      authorName: true,
      isImportant: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  return rows.map((n) => ({
    id: n.id,
    content: n.content,
    authorId: n.authorId,
    authorName: n.authorName,
    isImportant: n.isImportant,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  }))
}

export async function loadCustomerActivity(
  id: string,
  limit = 30,
): Promise<ActivityEvent[]> {
  const [orders, points, reviews, tickets] = await Promise.all([
    prisma.order.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, orderNumber: true, createdAt: true, total: true },
    }),
    prisma.pointsTransaction.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, points: true, type: true, description: true, createdAt: true },
    }),
    prisma.review.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, rating: true, createdAt: true },
    }),
    prisma.supportTicket.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, ticketNumber: true, type: true, createdAt: true },
    }),
  ])

  const events: ActivityEvent[] = [
    ...orders.map((o): ActivityEvent => ({
      id: `order-${o.id}`,
      type: 'order',
      label: `Order ${o.orderNumber}`,
      timestamp: o.createdAt,
      meta: `$${Number(o.total ?? 0).toFixed(2)}`,
    })),
    ...points.map((p): ActivityEvent => ({
      id: `points-${p.id}`,
      type: 'points',
      label: p.description,
      timestamp: p.createdAt,
      meta: `${Number(p.points) > 0 ? '+' : ''}${Number(p.points)} pts`,
    })),
    ...reviews.map((r): ActivityEvent => ({
      id: `review-${r.id}`,
      type: 'review',
      label: `Reviewed — ${r.rating}★`,
      timestamp: r.createdAt,
    })),
    ...tickets.map((t): ActivityEvent => ({
      id: `ticket-${t.id}`,
      type: 'ticket',
      label: `Support ticket ${t.ticketNumber}`,
      timestamp: t.createdAt,
      meta: t.type,
    })),
  ]

  // Sort descending by timestamp and trim to limit
  return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit)
}

export async function loadCustomerRisk(id: string): Promise<CustomerRiskData> {
  const customer = await prisma.customer.findUnique({
    where: { id },
    select: { id: true, totalOrders: true },
  })

  const totalOrders = customer?.totalOrders ?? 0

  const [refundCount, chargebackCount, returnCount, returnRows] = await Promise.all([
    prisma.refundRecord.count({ where: { createdById: id } }),
    prisma.refundRecord.count({
      where: { createdById: id, reason: { contains: 'chargeback', mode: 'insensitive' } },
    }),
    prisma.return.count({ where: { customerId: id } }),
    prisma.return.findMany({
      where: { customerId: id },
      select: {
        id: true,
        createdAt: true,
        order: { select: { createdAt: true } },
      },
    }),
  ])

  // avgDaysToReturn: average of (return.createdAt - order.createdAt) in days
  let avgDaysToReturn = 0
  if (returnRows.length > 0) {
    const day = 24 * 60 * 60 * 1000
    const totalDays = returnRows.reduce((sum, r) => {
      const diff = r.createdAt.getTime() - (r.order?.createdAt?.getTime() ?? r.createdAt.getTime())
      return sum + diff / day
    }, 0)
    avgDaysToReturn = totalDays / returnRows.length
  }

  const refundRate = totalOrders === 0 ? 0 : (refundCount / totalOrders) * 100
  const returnRate = totalOrders === 0 ? 0 : (returnCount / totalOrders) * 100

  return {
    totalOrders,
    refundCount,
    refundRate,
    returnCount,
    returnRate,
    chargebackCount,
    avgDaysToReturn,
  }
}
