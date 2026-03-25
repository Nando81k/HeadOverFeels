import type {
  OrderStatus,
  PaymentStatus,
  SupportTicketStatus,
  SupportTicketType,
} from '@prisma/client'
import { ORDER_STATUS_VALUES, PAYMENT_STATUS_VALUES } from '@/lib/orders/admin-order-query'
import {
  hasReviewedHighValueHold,
  HIGH_VALUE_HOLD_THRESHOLD,
} from '@/lib/fulfillment/high-value-hold'

export const FULFILLMENT_QUEUE_TYPES = [
  'FULFILL_ORDER',
  'PAYMENT_EXCEPTION',
  'SHIPPING_EXCEPTION',
  'RETURN_REVIEW',
  'REFUND_REVIEW',
] as const

export type FulfillmentQueueType = (typeof FULFILLMENT_QUEUE_TYPES)[number]

export const FULFILLMENT_BLOCKERS = [
  'ADDRESS_ISSUE',
  'MISSING_CARRIER',
  'INVENTORY_RISK',
  'HIGH_VALUE_HOLD',
] as const
export type FulfillmentBlocker = (typeof FULFILLMENT_BLOCKERS)[number]

export const FULFILLMENT_NEXT_ACTIONS = [
  'BUY_LABEL',
  'FIX_ADDRESS',
  'REQUEST_PAYMENT',
  'REVIEW_HOLD',
  'RESOLVE_TICKET',
  'MARK_SHIPPED',
  'SEND_TRACKING_UPDATE',
  'OPEN_CASE',
] as const
export type FulfillmentNextAction = (typeof FULFILLMENT_NEXT_ACTIONS)[number]

export const FULFILLMENT_BLOCKER_LABELS: Record<FulfillmentBlocker, string> = {
  ADDRESS_ISSUE: 'Address Issue',
  MISSING_CARRIER: 'Missing Carrier',
  INVENTORY_RISK: 'Inventory Risk',
  HIGH_VALUE_HOLD: 'High-value Hold',
}

export const FULFILLMENT_NEXT_ACTION_LABELS: Record<FulfillmentNextAction, string> = {
  BUY_LABEL: 'Buy Label',
  FIX_ADDRESS: 'Fix Address',
  REQUEST_PAYMENT: 'Request Payment',
  REVIEW_HOLD: 'Review Hold',
  RESOLVE_TICKET: 'Resolve Ticket',
  MARK_SHIPPED: 'Mark Shipped',
  SEND_TRACKING_UPDATE: 'Send Tracking Update',
  OPEN_CASE: 'Open Case',
}

const QUEUE_PRECEDENCE: Record<FulfillmentQueueType, number> = {
  REFUND_REVIEW: 0,
  RETURN_REVIEW: 1,
  SHIPPING_EXCEPTION: 2,
  PAYMENT_EXCEPTION: 3,
  FULFILL_ORDER: 4,
}

const TICKET_STATUS_VALUES = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'ESCALATED',
  'RESOLVED',
  'CLOSED',
] as const satisfies readonly SupportTicketStatus[]

const ACTIVE_REFUND_STATUSES = new Set<SupportTicketStatus>([
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'ESCALATED',
])

export const FULFILLMENT_SORT_FIELDS = ['priority', 'createdAt', 'total', 'ageHours'] as const
export type FulfillmentSortField = (typeof FULFILLMENT_SORT_FIELDS)[number]
export type FulfillmentSortDirection = 'asc' | 'desc'

export const FULFILLMENT_AGE_BUCKETS = ['all', 'over24h', 'over72h', 'over168h'] as const
export type FulfillmentAgeBucket = (typeof FULFILLMENT_AGE_BUCKETS)[number]

export type FulfillmentAssignedFilter = 'all' | 'assigned' | 'unassigned'

export type FulfillmentFilterState = {
  search: string
  queueTypes: FulfillmentQueueType[]
  orderStatuses: OrderStatus[]
  paymentStatuses: PaymentStatus[]
  ticketStatuses: SupportTicketStatus[]
  assigned: FulfillmentAssignedFilter
  ageBucket: FulfillmentAgeBucket
  sortBy: FulfillmentSortField
  sortDir: FulfillmentSortDirection
  page: number
  limit: number
}

export type FulfillmentQueueItem = {
  id: string
  queueType: FulfillmentQueueType
  createdAt: string
  ageHours: number
  slaBucket: 'NORMAL' | 'WATCH' | 'RISK' | 'BREACH'
  slaRisk: 'NORMAL' | 'WATCH' | 'RISK' | 'BREACH'
  orderId: string | null
  orderNumber: string | null
  orderStatus: string | null
  paymentStatus: string | null
  total: number | null
  trackingNumber: string | null
  carrier: string | null
  ticketId: string | null
  ticketNumber: string | null
  ticketType: string | null
  ticketStatus: string | null
  ticketSubject: string | null
  customerId: string | null
  customerName: string
  customerEmail: string
  loyaltyTierName: string | null
  currentPoints: number | null
  totalSpent: number | null
  totalOrders: number | null
  assignedToId: string | null
  assignedToName: string | null
  canPurchaseLabel: boolean
  labelEligible: boolean
  isReadyToShip: boolean
  blockers: FulfillmentBlocker[]
  nextAction: FulfillmentNextAction
}

type FulfillmentOrderSource = {
  id: string
  orderNumber: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  total: number
  createdAt: Date | string
  trackingNumber: string | null
  carrier?: string | null
  internalNotes?: string | null
  customerId: string | null
  customerEmail: string
  customerPhone: string | null
  customer?: {
    id: string
    name: string | null
    email: string
    currentPoints: number
    totalSpent: number
    totalOrders: number
    loyaltyTier?: { name: string } | null
  } | null
  shippingAddress?: {
    firstName: string
    lastName: string
    address1?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  } | null
  items?: Array<{
    quantity: number
    productVariant?: {
      inventory: number
    } | null
  }>
}

type FulfillmentTicketSource = {
  id: string
  ticketNumber: string
  type: SupportTicketType
  status: SupportTicketStatus
  subject: string
  customerId: string | null
  customerName: string
  customerEmail: string
  orderId: string | null
  orderNumber: string | null
  returnRequested: boolean
  returnApproved: boolean | null
  refundAmount: number | null
  createdAt: Date | string
  assignedTo?: {
    id: string
    name: string
  } | null
  customer?: {
    id: string
    name: string | null
    email: string
    currentPoints: number
    totalSpent: number
    totalOrders: number
    loyaltyTier?: { name: string } | null
  } | null
  order?: {
    id: string
    status: OrderStatus
    paymentStatus: PaymentStatus
    total: number
    trackingNumber: string | null
    carrier?: string | null
  } | null
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase()
}

function isQueueType(value: string): value is FulfillmentQueueType {
  return FULFILLMENT_QUEUE_TYPES.includes(value as FulfillmentQueueType)
}

function parseCsv(raw: string | null) {
  if (!raw) {
    return []
  }
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value)
}

function getAgeHours(createdAt: Date, now: Date): number {
  const ms = Math.max(0, now.getTime() - createdAt.getTime())
  return Math.floor(ms / (1000 * 60 * 60))
}

function getSlaBucket(ageHours: number): FulfillmentQueueItem['slaBucket'] {
  if (ageHours >= 168) return 'BREACH'
  if (ageHours >= 72) return 'RISK'
  if (ageHours >= 24) return 'WATCH'
  return 'NORMAL'
}

function parseOrderStatuses(raw: string | null): OrderStatus[] {
  const validSet = new Set<OrderStatus>(ORDER_STATUS_VALUES)
  return parseCsv(raw)
    .map((value) => value.toUpperCase())
    .filter((value): value is OrderStatus => validSet.has(value as OrderStatus))
}

function parsePaymentStatuses(raw: string | null): PaymentStatus[] {
  const validSet = new Set<PaymentStatus>(PAYMENT_STATUS_VALUES)
  return parseCsv(raw)
    .map((value) => value.toUpperCase())
    .filter((value): value is PaymentStatus => validSet.has(value as PaymentStatus))
}

function parseTicketStatuses(raw: string | null): SupportTicketStatus[] {
  const validSet = new Set<SupportTicketStatus>(TICKET_STATUS_VALUES)
  return parseCsv(raw)
    .map((value) => value.toUpperCase())
    .filter((value): value is SupportTicketStatus => validSet.has(value as SupportTicketStatus))
}

function parsePage(raw: string | null): number {
  const page = Number.parseInt(raw ?? '', 10)
  if (!Number.isFinite(page) || page < 1) {
    return 1
  }
  return page
}

function parseLimit(raw: string | null): number {
  const limit = Number.parseInt(raw ?? '', 10)
  if (!Number.isFinite(limit) || limit < 1) {
    return 25
  }
  return Math.min(limit, 100)
}

function parseAssigned(raw: string | null): FulfillmentAssignedFilter {
  if (raw === 'assigned' || raw === 'unassigned') {
    return raw
  }
  return 'all'
}

function parseAgeBucket(raw: string | null): FulfillmentAgeBucket {
  if (raw && FULFILLMENT_AGE_BUCKETS.includes(raw as FulfillmentAgeBucket)) {
    return raw as FulfillmentAgeBucket
  }
  return 'all'
}

function parseSortBy(raw: string | null): FulfillmentSortField {
  if (raw && FULFILLMENT_SORT_FIELDS.includes(raw as FulfillmentSortField)) {
    return raw as FulfillmentSortField
  }
  return 'priority'
}

function parseSortDir(raw: string | null): FulfillmentSortDirection {
  return raw === 'asc' ? 'asc' : 'desc'
}

function getOrderQueueType(order: FulfillmentOrderSource): FulfillmentQueueType | null {
  const missingTracking = !order.trackingNumber || order.trackingNumber.trim().length === 0

  if (order.status === 'CONFIRMED' || order.status === 'PROCESSING') {
    if (order.paymentStatus === 'PAID' && missingTracking) {
      return 'FULFILL_ORDER'
    }
  }

  return null
}

function getTicketQueueType(ticket: FulfillmentTicketSource): FulfillmentQueueType | null {
  if (ticket.type === 'REFUND' && ACTIVE_REFUND_STATUSES.has(ticket.status)) {
    return 'REFUND_REVIEW'
  }

  if (ticket.returnRequested && ticket.returnApproved === null && ticket.status !== 'CLOSED') {
    return 'RETURN_REVIEW'
  }

  if (ticket.type === 'SHIPPING_ISSUE' && ticket.status !== 'CLOSED') {
    return 'SHIPPING_EXCEPTION'
  }

  return null
}

function hasAddressIssue(order: FulfillmentOrderSource): boolean {
  const address = order.shippingAddress
  if (!address) return true

  const required = [address.firstName, address.lastName, address.address1, address.city, address.state, address.postalCode, address.country]
  return required.some((value) => !value || value.trim().length === 0)
}

function hasInventoryRisk(order: FulfillmentOrderSource): boolean {
  if (!order.items || order.items.length === 0) {
    return false
  }

  return order.items.some((item) => {
    const inventory = item.productVariant?.inventory
    if (typeof inventory !== 'number') {
      return false
    }
    return inventory < item.quantity
  })
}

function deriveOrderBlockers(order: FulfillmentOrderSource): FulfillmentBlocker[] {
  const blockers: FulfillmentBlocker[] = []

  if (hasAddressIssue(order)) {
    blockers.push('ADDRESS_ISSUE')
  }
  if (hasInventoryRisk(order)) {
    blockers.push('INVENTORY_RISK')
  }
  const holdAlreadyReviewed = hasReviewedHighValueHold(order.internalNotes)

  if (order.total >= HIGH_VALUE_HOLD_THRESHOLD && !holdAlreadyReviewed) {
    blockers.push('HIGH_VALUE_HOLD')
  }
  if (order.trackingNumber && (!order.carrier || order.carrier.trim().length === 0) && order.status !== 'DELIVERED') {
    blockers.push('MISSING_CARRIER')
  }

  return blockers
}

function deriveTicketBlockers(ticket: FulfillmentTicketSource): FulfillmentBlocker[] {
  const blockers: FulfillmentBlocker[] = []

  if (
    ticket.type === 'SHIPPING_ISSUE' &&
    ticket.order &&
    ticket.order.trackingNumber &&
    !ticket.order.carrier &&
    ticket.order.status !== 'DELIVERED'
  ) {
    blockers.push('MISSING_CARRIER')
  }

  return blockers
}

function deriveOrderNextAction(
  queueType: FulfillmentQueueType,
  order: FulfillmentOrderSource,
  blockers: FulfillmentBlocker[]
): FulfillmentNextAction {
  if (queueType === 'PAYMENT_EXCEPTION') {
    return 'REQUEST_PAYMENT'
  }
  if (blockers.includes('ADDRESS_ISSUE')) {
    return 'FIX_ADDRESS'
  }
  if (blockers.includes('HIGH_VALUE_HOLD')) {
    return 'REVIEW_HOLD'
  }

  const hasTracking = Boolean(order.trackingNumber && order.trackingNumber.trim().length > 0)
  if (!hasTracking) {
    return 'BUY_LABEL'
  }
  if (order.status !== 'SHIPPED' && order.status !== 'DELIVERED') {
    return 'MARK_SHIPPED'
  }
  return 'SEND_TRACKING_UPDATE'
}

function deriveTicketNextAction(queueType: FulfillmentQueueType): FulfillmentNextAction {
  if (queueType === 'PAYMENT_EXCEPTION') {
    return 'REQUEST_PAYMENT'
  }
  return 'RESOLVE_TICKET'
}

function buildOrderQueueItem(
  order: FulfillmentOrderSource,
  queueType: FulfillmentQueueType,
  now: Date
): FulfillmentQueueItem {
  const createdAt = toDate(order.createdAt)
  const ageHours = getAgeHours(createdAt, now)
  const blockers = deriveOrderBlockers(order)
  const nextAction = deriveOrderNextAction(queueType, order, blockers)
  const isReadyToShip = queueType === 'FULFILL_ORDER' && blockers.length === 0
  const labelEligible = queueType === 'FULFILL_ORDER' && !blockers.includes('ADDRESS_ISSUE') && !blockers.includes('HIGH_VALUE_HOLD')

  const customerName =
    order.customer?.name?.trim() ||
    [order.shippingAddress?.firstName, order.shippingAddress?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    order.customerEmail

  return {
    id: `${queueType}:${order.id}`,
    queueType,
    createdAt: createdAt.toISOString(),
    ageHours,
    slaBucket: getSlaBucket(ageHours),
    slaRisk: getSlaBucket(ageHours),
    orderId: order.id,
    orderNumber: order.orderNumber,
    orderStatus: order.status,
    paymentStatus: order.paymentStatus,
    total: order.total,
    trackingNumber: order.trackingNumber,
    carrier: order.carrier || null,
    ticketId: null,
    ticketNumber: null,
    ticketType: null,
    ticketStatus: null,
    ticketSubject: null,
    customerId: order.customerId,
    customerName,
    customerEmail: order.customer?.email || order.customerEmail,
    loyaltyTierName: order.customer?.loyaltyTier?.name || null,
    currentPoints: order.customer?.currentPoints ?? null,
    totalSpent: order.customer?.totalSpent ?? null,
    totalOrders: order.customer?.totalOrders ?? null,
    assignedToId: null,
    assignedToName: null,
    canPurchaseLabel: labelEligible,
    labelEligible,
    isReadyToShip,
    blockers,
    nextAction,
  }
}

function buildTicketQueueItem(
  ticket: FulfillmentTicketSource,
  queueType: FulfillmentQueueType,
  now: Date
): FulfillmentQueueItem {
  const createdAt = toDate(ticket.createdAt)
  const ageHours = getAgeHours(createdAt, now)
  const blockers = deriveTicketBlockers(ticket)

  return {
    id: `${queueType}:${ticket.id}`,
    queueType,
    createdAt: createdAt.toISOString(),
    ageHours,
    slaBucket: getSlaBucket(ageHours),
    slaRisk: getSlaBucket(ageHours),
    orderId: ticket.orderId || ticket.order?.id || null,
    orderNumber: ticket.orderNumber || null,
    orderStatus: ticket.order?.status || null,
    paymentStatus: ticket.order?.paymentStatus || null,
    total: ticket.order?.total ?? ticket.refundAmount ?? null,
    trackingNumber: ticket.order?.trackingNumber || null,
    carrier: ticket.order?.carrier || null,
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    ticketType: ticket.type,
    ticketStatus: ticket.status,
    ticketSubject: ticket.subject,
    customerId: ticket.customerId,
    customerName: ticket.customer?.name || ticket.customerName,
    customerEmail: ticket.customer?.email || ticket.customerEmail,
    loyaltyTierName: ticket.customer?.loyaltyTier?.name || null,
    currentPoints: ticket.customer?.currentPoints ?? null,
    totalSpent: ticket.customer?.totalSpent ?? null,
    totalOrders: ticket.customer?.totalOrders ?? null,
    assignedToId: ticket.assignedTo?.id || null,
    assignedToName: ticket.assignedTo?.name || null,
    canPurchaseLabel: false,
    labelEligible: false,
    isReadyToShip: false,
    blockers,
    nextAction: deriveTicketNextAction(queueType),
  }
}

function shouldReplaceByPrecedence(
  current: FulfillmentQueueItem,
  incoming: FulfillmentQueueItem
): boolean {
  const currentPriority = QUEUE_PRECEDENCE[current.queueType]
  const incomingPriority = QUEUE_PRECEDENCE[incoming.queueType]
  if (incomingPriority < currentPriority) {
    return true
  }
  if (incomingPriority > currentPriority) {
    return false
  }
  return new Date(incoming.createdAt).getTime() > new Date(current.createdAt).getTime()
}

function matchesSearch(item: FulfillmentQueueItem, normalizedSearch: string) {
  if (!normalizedSearch) {
    return true
  }

  const haystack = [
    item.orderNumber,
    item.ticketNumber,
    item.ticketSubject,
    item.customerName,
    item.customerEmail,
    item.queueType.replace('_', ' '),
    item.orderStatus,
    item.paymentStatus,
    item.ticketStatus,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(normalizedSearch)
}

function matchesAgeBucket(ageHours: number, ageBucket: FulfillmentAgeBucket): boolean {
  if (ageBucket === 'all') return true
  if (ageBucket === 'over24h') return ageHours >= 24
  if (ageBucket === 'over72h') return ageHours >= 72
  return ageHours >= 168
}

function compareItems(
  left: FulfillmentQueueItem,
  right: FulfillmentQueueItem,
  sortBy: FulfillmentSortField,
  sortDir: FulfillmentSortDirection
): number {
  const direction = sortDir === 'asc' ? 1 : -1

  if (sortBy === 'priority') {
    const rankDiff = QUEUE_PRECEDENCE[left.queueType] - QUEUE_PRECEDENCE[right.queueType]
    if (rankDiff !== 0) {
      return rankDiff * direction
    }
    return (left.ageHours - right.ageHours) * -1 * direction
  }

  if (sortBy === 'createdAt') {
    const diff = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    return diff * direction
  }

  if (sortBy === 'ageHours') {
    return (left.ageHours - right.ageHours) * direction
  }

  const leftTotal = left.total ?? 0
  const rightTotal = right.total ?? 0
  return (leftTotal - rightTotal) * direction
}

export function parseFulfillmentFilterState(searchParams: URLSearchParams): FulfillmentFilterState {
  const parsedQueueTypes: FulfillmentQueueType[] = parseCsv(searchParams.get('queueTypes'))
    .map((value) => value.toUpperCase())
    .filter((value): value is FulfillmentQueueType => isQueueType(value))
  const queueTypes: FulfillmentQueueType[] = parsedQueueTypes.length > 0 ? parsedQueueTypes : ['FULFILL_ORDER']

  return {
    search: searchParams.get('search')?.trim() || '',
    queueTypes,
    orderStatuses: parseOrderStatuses(searchParams.get('orderStatuses')),
    paymentStatuses: parsePaymentStatuses(searchParams.get('paymentStatuses')),
    ticketStatuses: parseTicketStatuses(searchParams.get('ticketStatuses')),
    assigned: parseAssigned(searchParams.get('assigned')),
    ageBucket: parseAgeBucket(searchParams.get('ageBucket')),
    sortBy: parseSortBy(searchParams.get('sortBy')),
    sortDir: parseSortDir(searchParams.get('sortDir')),
    page: parsePage(searchParams.get('page')),
    limit: parseLimit(searchParams.get('limit')),
  }
}

export function buildFulfillmentQueueItems(
  orders: FulfillmentOrderSource[],
  tickets: FulfillmentTicketSource[],
  now: Date = new Date()
): FulfillmentQueueItem[] {
  const deduped = new Map<string, FulfillmentQueueItem>()

  const upsert = (item: FulfillmentQueueItem) => {
    const key = item.orderId ? `order:${item.orderId}` : `ticket:${item.ticketId}`
    const existing = deduped.get(key)
    if (!existing || shouldReplaceByPrecedence(existing, item)) {
      deduped.set(key, item)
    }
  }

  for (const order of orders) {
    const queueType = getOrderQueueType(order)
    if (!queueType) {
      continue
    }
    upsert(buildOrderQueueItem(order, queueType, now))
  }

  for (const ticket of tickets) {
    const queueType = getTicketQueueType(ticket)
    if (!queueType) {
      continue
    }
    upsert(buildTicketQueueItem(ticket, queueType, now))
  }

  return Array.from(deduped.values())
}

export function deriveFulfillmentQueueCounts(items: FulfillmentQueueItem[]) {
  return items.reduce(
    (acc, item) => {
      acc.total += 1
      acc.byType[item.queueType] += 1
      return acc
    },
    {
      total: 0,
      byType: {
        FULFILL_ORDER: 0,
        PAYMENT_EXCEPTION: 0,
        SHIPPING_EXCEPTION: 0,
        RETURN_REVIEW: 0,
        REFUND_REVIEW: 0,
      } satisfies Record<FulfillmentQueueType, number>,
    }
  )
}

export function filterAndSortFulfillmentQueueItems(
  items: FulfillmentQueueItem[],
  filters: FulfillmentFilterState
) {
  const normalizedSearch = normalizeSearchValue(filters.search)

  const filtered = items.filter((item) => {
    if (filters.queueTypes.length > 0 && !filters.queueTypes.includes(item.queueType)) {
      return false
    }

    if (filters.orderStatuses.length > 0) {
      if (!item.orderStatus || !filters.orderStatuses.includes(item.orderStatus as OrderStatus)) {
        return false
      }
    }

    if (filters.paymentStatuses.length > 0) {
      if (!item.paymentStatus || !filters.paymentStatuses.includes(item.paymentStatus as PaymentStatus)) {
        return false
      }
    }

    if (filters.ticketStatuses.length > 0) {
      if (!item.ticketStatus || !filters.ticketStatuses.includes(item.ticketStatus as SupportTicketStatus)) {
        return false
      }
    }

    if (filters.assigned === 'assigned' && !item.assignedToId) {
      return false
    }

    if (filters.assigned === 'unassigned' && item.assignedToId) {
      return false
    }

    if (!matchesAgeBucket(item.ageHours, filters.ageBucket)) {
      return false
    }

    return matchesSearch(item, normalizedSearch)
  })

  filtered.sort((left, right) => compareItems(left, right, filters.sortBy, filters.sortDir))
  return filtered
}

export function paginateFulfillmentQueueItems(
  items: FulfillmentQueueItem[],
  page: number,
  limit: number
) {
  const safePage = Math.max(1, page)
  const safeLimit = Math.max(1, limit)
  const offset = (safePage - 1) * safeLimit
  const paged = items.slice(offset, offset + safeLimit)
  const total = items.length
  const pages = Math.max(1, Math.ceil(total / safeLimit))

  return {
    data: paged,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages,
    },
  }
}
