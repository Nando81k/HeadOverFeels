// lib/admin/fulfillment.ts
//
// Single source of truth for Phase 4 fulfillment data shapes and Prisma queries.
// All loaders are pure async functions called from Server Components.
//
// Schema adaptations:
//   - Order has NO paidAt field. We derive "paid at" from updatedAt when paymentStatus
//     transitioned to PAID (best-effort — exact transition timestamp not stored).
//   - OrderItem has NO sku field — derived from productVariant.sku.
//   - paymentStatus is independent of status; needs-action ORs the two.

import { prisma } from '@/lib/prisma'
import type { OrderStatus, PaymentStatus, ReturnStatus, ReturnItemCondition } from '@prisma/client'

// ============================================================
// Tab + filter types
// ============================================================

export const ORDERS_TABS = [
  'all',
  'needs-action',
  'processing',
  'shipped',
  'delivered',
  'returns',
  'archived',
] as const
export type FulfillmentTab = (typeof ORDERS_TABS)[number]
export type OrdersTab = Exclude<FulfillmentTab, 'returns' | 'archived'>

export function isFulfillmentTab(value: unknown): value is FulfillmentTab {
  return typeof value === 'string' && (ORDERS_TABS as readonly string[]).includes(value)
}

export function isOrdersTab(value: unknown): value is OrdersTab {
  return isFulfillmentTab(value) && value !== 'returns' && value !== 'archived'
}

export interface OrdersFilters {
  search?: string
  dateFrom?: Date
  dateTo?: Date
  paymentStatus?: PaymentStatus
  carrier?: string
  hasTracking?: boolean
  page?: number
  pageSize?: number
}

export interface ReturnsFilters {
  status?: ReturnStatus
  page?: number
  pageSize?: number
}

// ============================================================
// Row shapes
// ============================================================

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface OrderRow {
  id: string
  orderNumber: string
  customerName: string | null
  customerEmail: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  totalAmount: number
  createdAt: Date
  trackingNumber: string | null
  carrier: string | null
  itemCount: number
}

export interface ReturnRow {
  id: string
  rmaNumber: string
  orderId: string
  orderNumber: string
  customerName: string | null
  status: ReturnStatus
  requestedAt: Date
  refundAmount: number
}

export interface FulfillmentKpiData {
  needsActionCount: number
  readyToShipCount: number
  todaysRevenue: number
  returnsPendingCount: number
}

export interface CarrierOption {
  value: string
  label: string
}

export interface OrderItemDetail {
  id: string
  productId: string
  productVariantId: string | null
  quantity: number
  price: number
  productName: string
  productImage: string | null
  /** Derived from productVariant.sku — null when no variant */
  sku: string | null
  variantDetails: string | null
}

export interface OrderAddress {
  id: string
  firstName: string
  lastName: string
  address1: string
  address2: string | null
  city: string
  state: string
  postalCode: string
  country: string
}

export interface OrderReturnSummary {
  id: string
  rmaNumber: string
  status: ReturnStatus
  requestedAt: Date
}

export interface OrderRefundSummary {
  id: string
  amount: number
  type: string
  createdAt: Date
}

export interface OrderDetailFull {
  id: string
  orderNumber: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  total: number
  subtotal: number
  tax: number
  shipping: number
  customerId: string | null
  customerName: string | null
  customerEmail: string
  customerPhone: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  carrier: string | null
  shippedAt: Date | null
  deliveredAt: Date | null
  estimatedDelivery: Date | null
  notes: string | null
  internalNotes: string | null
  createdAt: Date
  updatedAt: Date
  shippingAddress: OrderAddress | null
  billingAddress: OrderAddress | null
  items: OrderItemDetail[]
  returns: OrderReturnSummary[]
  refunds: OrderRefundSummary[]
}

export interface ReturnItemDetail {
  id: string
  orderItemId: string
  quantity: number
  condition: ReturnItemCondition
  reason: string | null
  /** Snapshot of the order item at the time of return */
  productName: string
  productImage: string | null
  unitPrice: number
}

export interface ReturnWithItems {
  id: string
  rmaNumber: string
  orderId: string
  orderNumber: string
  customerId: string
  customerName: string | null
  customerEmail: string
  status: ReturnStatus
  reason: string
  internalNotes: string | null
  returnLabel: string | null
  returnTrackingNumber: string | null
  receivedAt: Date | null
  windowExpiresAt: Date
  requestedAt: Date
  decidedAt: Date | null
  items: ReturnItemDetail[]
  refunds: OrderRefundSummary[]
}

// ============================================================
// Constants
// ============================================================

const DEFAULT_PAGE_SIZE = 25

// ============================================================
// Helpers
// ============================================================

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function mapAddress(a: {
  id: string
  firstName: string
  lastName: string
  address1: string
  address2?: string | null
  city: string
  state: string
  postalCode: string
  country: string
} | null): OrderAddress | null {
  if (!a) return null
  return {
    id: a.id,
    firstName: a.firstName,
    lastName: a.lastName,
    address1: a.address1,
    address2: a.address2 ?? null,
    city: a.city,
    state: a.state,
    postalCode: a.postalCode,
    country: a.country,
  }
}

// ============================================================
// KPIs
// ============================================================

export async function loadFulfillmentKpis(): Promise<FulfillmentKpiData> {
  const today = startOfToday()
  const [needsActionCount, readyToShipCount, revenueAgg, returnsPendingCount] = await Promise.all([
    prisma.order.count({
      where: {
        OR: [{ status: 'PENDING' }, { paymentStatus: 'FAILED' }],
      },
    }),
    prisma.order.count({
      where: { status: { in: ['CONFIRMED', 'PROCESSING'] } },
    }),
    prisma.order.aggregate({
      where: { createdAt: { gte: today }, paymentStatus: 'PAID' },
      _sum: { total: true },
    }),
    prisma.return.count({
      where: { status: { in: ['REQUESTED', 'APPROVED'] } },
    }),
  ])
  return {
    needsActionCount,
    readyToShipCount,
    todaysRevenue: revenueAgg._sum.total ?? 0,
    returnsPendingCount,
  }
}

// ============================================================
// Per-tab loaders
// ============================================================

function buildOrdersWhere(tab: FulfillmentTab, filters: OrdersFilters): Record<string, unknown> {
  const where: Record<string, unknown> = {}

  if (tab === 'all') {
    where.status = { notIn: ['CANCELLED', 'REFUNDED'] }
  } else if (tab === 'needs-action') {
    where.OR = [{ status: 'PENDING' }, { paymentStatus: 'FAILED' }]
  } else if (tab === 'processing') {
    where.status = { in: ['CONFIRMED', 'PROCESSING'] }
  } else if (tab === 'shipped') {
    where.status = 'SHIPPED'
  } else if (tab === 'delivered') {
    where.status = 'DELIVERED'
  } else if (tab === 'archived') {
    where.status = { in: ['CANCELLED', 'REFUNDED'] }
  }

  if (filters.search) {
    const s = filters.search.trim()
    const orList = [
      { orderNumber: { contains: s, mode: 'insensitive' as const } },
      { customerEmail: { contains: s, mode: 'insensitive' as const } },
      { trackingNumber: { contains: s, mode: 'insensitive' as const } },
    ]
    if (where.OR) {
      // merge: AND together pre-existing OR with the search OR
      where.AND = [{ OR: where.OR }, { OR: orList }]
      delete where.OR
    } else {
      where.OR = orList
    }
  }

  if (filters.paymentStatus) where.paymentStatus = filters.paymentStatus
  if (filters.carrier) where.carrier = filters.carrier
  if (filters.hasTracking === true) where.trackingNumber = { not: null }
  if (filters.hasTracking === false) where.trackingNumber = null
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: filters.dateTo } : {}),
    }
  }

  return where
}

async function runOrdersQuery(
  where: Record<string, unknown>,
  filters: OrdersFilters,
): Promise<PaginatedResult<OrderRow>> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  const [raw, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        customer: { select: { name: true, email: true } },
        items: { select: { id: true } },
      },
    }),
    prisma.order.count({ where }),
  ])

  const items: OrderRow[] = raw.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customer?.name ?? null,
    customerEmail: o.customerEmail,
    status: o.status,
    paymentStatus: o.paymentStatus,
    totalAmount: Number(o.total),
    createdAt: o.createdAt,
    trackingNumber: o.trackingNumber,
    carrier: o.carrier,
    itemCount: o.items.length,
  }))

  return { items, total, page, pageSize }
}

export async function loadOrdersTab(
  tab: OrdersTab,
  filters: OrdersFilters = {},
): Promise<PaginatedResult<OrderRow>> {
  const where = buildOrdersWhere(tab, filters)
  return runOrdersQuery(where, filters)
}

export async function loadArchivedTab(
  filters: OrdersFilters = {},
): Promise<PaginatedResult<OrderRow>> {
  const where = buildOrdersWhere('archived', filters)
  return runOrdersQuery(where, filters)
}

export async function loadReturnsTab(
  filters: ReturnsFilters = {},
): Promise<PaginatedResult<ReturnRow>> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  const where: Record<string, unknown> = {}
  if (filters.status) where.status = filters.status

  const [raw, total] = await Promise.all([
    prisma.return.findMany({
      where,
      orderBy: { requestedAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        order: { select: { orderNumber: true } },
        customer: { select: { name: true } },
        refunds: { select: { amount: true } },
      },
    }),
    prisma.return.count({ where }),
  ])

  const items: ReturnRow[] = raw.map((r) => ({
    id: r.id,
    rmaNumber: r.rmaNumber,
    orderId: r.orderId,
    orderNumber: r.order?.orderNumber ?? '',
    customerName: r.customer?.name ?? null,
    status: r.status,
    requestedAt: r.requestedAt,
    refundAmount: r.refunds.reduce((s, x) => s + Number(x.amount), 0),
  }))
  return { items, total, page, pageSize }
}

// ============================================================
// Order detail
// ============================================================

export async function loadOrderDetail(id: string): Promise<OrderDetailFull | null> {
  const o = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      shippingAddress: true,
      billingAddress: true,
      items: {
        include: { productVariant: { select: { sku: true } } },
      },
      returns: {
        select: { id: true, rmaNumber: true, status: true, requestedAt: true },
        orderBy: { requestedAt: 'desc' },
      },
      refundRecords: {
        select: { id: true, amount: true, type: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!o) return null

  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    paymentStatus: o.paymentStatus,
    total: Number(o.total),
    subtotal: Number(o.subtotal),
    tax: Number(o.tax),
    shipping: Number(o.shipping),
    customerId: o.customer?.id ?? null,
    customerName: o.customer?.name ?? null,
    customerEmail: o.customerEmail,
    customerPhone: o.customerPhone,
    trackingNumber: o.trackingNumber,
    trackingUrl: o.trackingUrl,
    carrier: o.carrier,
    shippedAt: o.shippedAt,
    deliveredAt: o.deliveredAt,
    estimatedDelivery: o.estimatedDelivery,
    notes: o.notes,
    internalNotes: o.internalNotes,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    shippingAddress: mapAddress(o.shippingAddress),
    billingAddress: mapAddress(o.billingAddress),
    items: o.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      productVariantId: it.productVariantId,
      quantity: it.quantity,
      price: Number(it.price),
      productName: it.productName,
      productImage: it.productImage,
      sku: it.productVariant?.sku ?? null,
      variantDetails: it.variantDetails,
    })),
    returns: o.returns.map((r) => ({
      id: r.id,
      rmaNumber: r.rmaNumber,
      status: r.status,
      requestedAt: r.requestedAt,
    })),
    refunds: o.refundRecords.map((r) => ({
      id: r.id,
      amount: Number(r.amount),
      type: r.type,
      createdAt: r.createdAt,
    })),
  }
}

// ============================================================
// Return detail
// ============================================================

export async function loadReturnDetail(id: string): Promise<ReturnWithItems | null> {
  const r = await prisma.return.findUnique({
    where: { id },
    include: {
      order: { select: { orderNumber: true } },
      customer: { select: { name: true, email: true } },
      items: {
        include: {
          orderItem: { select: { productName: true, productImage: true, price: true } },
        },
      },
      refunds: { select: { id: true, amount: true, type: true, createdAt: true } },
    },
  })
  if (!r) return null
  return {
    id: r.id,
    rmaNumber: r.rmaNumber,
    orderId: r.orderId,
    orderNumber: r.order?.orderNumber ?? '',
    customerId: r.customerId,
    customerName: r.customer?.name ?? null,
    customerEmail: r.customer?.email ?? '',
    status: r.status,
    reason: r.reason,
    internalNotes: r.internalNotes,
    returnLabel: r.returnLabel,
    returnTrackingNumber: r.returnTrackingNumber,
    receivedAt: r.receivedAt,
    windowExpiresAt: r.windowExpiresAt,
    requestedAt: r.requestedAt,
    decidedAt: r.decidedAt,
    items: r.items.map((it) => ({
      id: it.id,
      orderItemId: it.orderItemId,
      quantity: it.quantity,
      condition: it.condition,
      reason: it.reason,
      productName: it.orderItem.productName,
      productImage: it.orderItem.productImage,
      unitPrice: Number(it.orderItem.price),
    })),
    refunds: r.refunds.map((x) => ({
      id: x.id,
      amount: Number(x.amount),
      type: x.type,
      createdAt: x.createdAt,
    })),
  }
}

// ============================================================
// Carriers (cached 24h)
// ============================================================

const STATIC_CARRIERS = ['USPS', 'UPS', 'FedEx', 'DHL']

interface CarrierCacheEntry {
  value: CarrierOption[]
  expiresAt: number
}
const carrierCache = new Map<'carriers', CarrierCacheEntry>()

export async function loadCarriers(): Promise<CarrierOption[]> {
  const now = Date.now()
  const cached = carrierCache.get('carriers')
  if (cached && cached.expiresAt > now) return cached.value

  const rows = await prisma.order.findMany({
    where: { carrier: { not: null } },
    select: { carrier: true },
    distinct: ['carrier'],
  })
  const dbCarriers = rows
    .map((r) => r.carrier!)
    .filter((c): c is string => typeof c === 'string' && c.length > 0)

  const set = new Set<string>([...STATIC_CARRIERS, ...dbCarriers])
  const options: CarrierOption[] = Array.from(set).map((value) => ({ value, label: value }))

  carrierCache.set('carriers', { value: options, expiresAt: now + 24 * 60 * 60 * 1000 })
  return options
}
