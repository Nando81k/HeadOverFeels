// lib/admin/support.ts
//
// Single source of truth for Phase 9 Support admin data shapes + Prisma queries.
// Mirrors lib/admin/customers.ts: TimeRange + getRangeBounds + buildTrend +
// PaginatedResult + KPI loader + tab loader + detail/chat loaders.
//
// Schema adaptations (verified against prisma/schema.prisma):
//   - SupportMessage.message / LiveChatMessage.message are the body columns
//     (mapped to TicketMessageRow.body / ChatMessageRow.body).
//   - SupportMessage.attachments is a JSON string column — parsed defensively.
//   - SupportTicket.firstRespondedAt (new this phase) drives SLA/overdue + KPI.
//   - AdminUser links to a session Customer by EMAIL (no AdminUser.customerId).
//     resolveAdminUserId: Customer.id -> Customer.email -> AdminUser.id.
//   - Return.supportTicketId @unique links a Return to a ticket; RefundRecord
//     has no ticket FK, so we locate refund records via the ticket's orderId.
//   - TimeRange is Phase-9-local — do NOT import from sibling phase files.

import { prisma } from '@/lib/prisma'
import { checkRefundEligibility } from '@/lib/support/refund-helpers'
import type {
  SupportTicketType,
  SupportTicketStatus,
  SupportPriority,
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
// SLA constants (Phase 9.5 makes these configurable)
// ============================================================

export const FIRST_RESPONSE_SLA_HOURS = 4
export const RESOLUTION_SLA_HOURS = 48

// Statuses still considered "active" (open work) — used for overdue + tabs.
const ACTIVE_STATUSES: SupportTicketStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'ESCALATED',
]
const CLOSED_STATUSES: SupportTicketStatus[] = ['RESOLVED', 'CLOSED']

// ============================================================
// Tabs + filters
// ============================================================

export const SUPPORT_TABS = ['inbox', 'mine', 'open', 'escalated', 'resolved'] as const
export type SupportTab = (typeof SUPPORT_TABS)[number]

export function isSupportTab(v: unknown): v is SupportTab {
  return typeof v === 'string' && (SUPPORT_TABS as readonly string[]).includes(v)
}

export function isTimeRange(v: unknown): v is TimeRange {
  return typeof v === 'string' && (TIME_RANGES as readonly string[]).includes(v)
}

export interface SupportFilters {
  search?: string
  type?: SupportTicketType
  priority?: SupportPriority
  page?: number
  pageSize?: number
}

// ============================================================
// Row + KPI shapes
// ============================================================

export interface TicketRow {
  id: string
  ticketNumber: string
  subject: string
  type: SupportTicketType
  status: SupportTicketStatus
  priority: SupportPriority
  customerName: string
  customerEmail: string
  assigneeId: string | null
  assigneeName: string | null
  createdAt: Date
  firstRespondedAt: Date | null
  ageHours: number
  isOverdue: boolean
}

export interface SupportKpiData {
  openCount: number
  unassignedCount: number
  avgFirstResponseHours: number
  avgFirstResponseTrend: TrendData
  avgResolutionHours: number
  resolvedInRange: number
  resolvedInRangeTrend: TrendData
}

// ============================================================
// Detail shapes
// ============================================================

export interface TicketHeaderData {
  id: string
  ticketNumber: string
  subject: string
  type: SupportTicketType
  status: SupportTicketStatus
  priority: SupportPriority
  customerId: string | null
  customerName: string
  customerEmail: string
  orderId: string | null
  orderNumber: string | null
  assigneeId: string | null
  assigneeName: string | null
  createdAt: Date
  firstRespondedAt: Date | null
  resolvedAt: Date | null
  ageHours: number
  isOverdue: boolean
  returnRequested: boolean
  returnApproved: boolean | null
  refundAmount: number | null
}

export interface TicketMessageRow {
  id: string
  body: string
  isInternal: boolean
  senderType: string
  senderName: string
  attachments: string[]
  createdAt: Date
}

export interface TicketCustomerContextData {
  customerId: string | null
  customerName: string
  customerEmail: string
  tierName: string | null
  totalSpent: number
  totalOrders: number
  orderId: string | null
  orderNumber: string | null
  orderTotal: number | null
  otherTicketsCount: number
}

export interface TicketReturnRefundData {
  ticketId: string
  returnRequested: boolean
  returnApproved: boolean | null
  returnLabel: string | null
  refundAmount: number | null
  refundReason: string | null
  refundEligible: boolean
  refundEligibilityReason: string | null
  returnId: string | null
  refundRecordId: string | null
}

export interface CannedResponseRow {
  id: string
  title: string
  body: string
  category: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface AgentRow {
  id: string
  name: string
  openTicketCount: number
}

export type TicketActivityKind =
  | 'message'
  | 'internal'
  | 'status'
  | 'assignment'
  | 'return'
  | 'refund'

export interface TicketActivityEvent {
  id: string
  kind: TicketActivityKind
  label: string
  timestamp: Date
  actor: string | null
}

export interface ChatQueueRow {
  id: string
  sessionId: string
  customerName: string
  issueCategory: string | null
  issueSummary: string | null
  waitTime: number | null
  requestedAt: Date
}

export interface ChatMessageRow {
  id: string
  body: string
  senderType: string
  senderName: string
  createdAt: Date
}

export interface ChatSessionData {
  id: string
  sessionId: string
  status: 'WAITING' | 'ACTIVE' | 'CLOSED'
  customerName: string
  customerEmail: string
  issueCategory: string | null
  issueSummary: string | null
  acceptedAt: Date | null
  messages: ChatMessageRow[]
}

export interface AgentAvailabilityData {
  isOnline: boolean
  maxChats: number
  activeChats: number
}

// ============================================================
// Internal helpers
// ============================================================

function hoursBetween(later: Date, earlier: Date): number {
  return (later.getTime() - earlier.getTime()) / (60 * 60 * 1000)
}

function computeOverdue(
  status: SupportTicketStatus,
  firstRespondedAt: Date | null,
  ageHours: number,
): boolean {
  if (!ACTIVE_STATUSES.includes(status)) return false
  if (firstRespondedAt) return false
  return ageHours > FIRST_RESPONSE_SLA_HOURS
}

function parseAttachments(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string')
    return []
  } catch {
    return []
  }
}

// ============================================================
// Admin identity resolution (Customer.id -> AdminUser.id by email)
// ============================================================

export async function resolveAdminUserId(sessionUserId: string | null): Promise<string | null> {
  if (!sessionUserId) return null
  const customer = await prisma.customer.findUnique({
    where: { id: sessionUserId },
    select: { email: true },
  })
  if (!customer?.email) return null
  const admin = await prisma.adminUser.findUnique({
    where: { email: customer.email },
    select: { id: true },
  })
  return admin?.id ?? null
}

// ============================================================
// KPI loader
// ============================================================

export async function loadSupportKpis(
  range: TimeRange,
  _currentAdminId: string | null,
): Promise<SupportKpiData> {
  const { start, end, previousStart, previousEnd } = getRangeBounds(range)

  const [
    openCount,
    unassignedCount,
    resolvedInRange,
    resolvedInRangePrev,
    firstResponseRows,
    resolutionRows,
  ] = await Promise.all([
    prisma.supportTicket.count({ where: { status: { in: ACTIVE_STATUSES } } }),
    prisma.supportTicket.count({ where: { status: 'OPEN', assignedToId: null } }),
    prisma.supportTicket.count({
      where: { status: { in: CLOSED_STATUSES }, resolvedAt: { gte: start, lte: end } },
    }),
    prisma.supportTicket.count({
      where: {
        status: { in: CLOSED_STATUSES },
        resolvedAt: { gte: previousStart, lte: previousEnd },
      },
    }),
    prisma.supportTicket.findMany({
      where: { firstRespondedAt: { gte: start, lte: end } },
      select: { createdAt: true, firstRespondedAt: true },
    }),
    prisma.supportTicket.findMany({
      where: { status: { in: CLOSED_STATUSES }, resolvedAt: { gte: start, lte: end } },
      select: { createdAt: true, resolvedAt: true },
    }),
  ])

  // Average first-response hours (current range).
  let avgFirstResponseHours = 0
  if (firstResponseRows.length > 0) {
    const total = firstResponseRows.reduce(
      (sum, t) => sum + (t.firstRespondedAt ? hoursBetween(t.firstRespondedAt, t.createdAt) : 0),
      0,
    )
    avgFirstResponseHours = total / firstResponseRows.length
  }

  // Average first-response hours for the previous range (for the trend).
  const previousFirstResponseRows =
    (await prisma.supportTicket.findMany({
      where: { firstRespondedAt: { gte: previousStart, lte: previousEnd } },
      select: { createdAt: true, firstRespondedAt: true },
    })) ?? []
  let avgFirstResponseHoursPrev = 0
  if (previousFirstResponseRows.length > 0) {
    const total = previousFirstResponseRows.reduce(
      (sum, t) => sum + (t.firstRespondedAt ? hoursBetween(t.firstRespondedAt, t.createdAt) : 0),
      0,
    )
    avgFirstResponseHoursPrev = total / previousFirstResponseRows.length
  }

  // Average resolution hours (current range).
  let avgResolutionHours = 0
  if (resolutionRows.length > 0) {
    const total = resolutionRows.reduce(
      (sum, t) => sum + (t.resolvedAt ? hoursBetween(t.resolvedAt, t.createdAt) : 0),
      0,
    )
    avgResolutionHours = total / resolutionRows.length
  }

  return {
    openCount,
    unassignedCount,
    avgFirstResponseHours,
    // Lower is better, but buildTrend is direction-agnostic — UI colors by metric.
    avgFirstResponseTrend: buildTrend(avgFirstResponseHours, avgFirstResponseHoursPrev),
    avgResolutionHours,
    resolvedInRange,
    resolvedInRangeTrend: buildTrend(resolvedInRange, resolvedInRangePrev),
  }
}

// ============================================================
// Tab loader
// ============================================================

function buildTabWhere(
  tab: SupportTab,
  range: TimeRange,
  currentAdminId: string | null,
): Record<string, unknown> {
  switch (tab) {
    case 'inbox':
      return { status: 'OPEN', assignedToId: null }
    case 'mine':
      // currentAdminId guaranteed non-null by the caller's short-circuit.
      return { assignedToId: currentAdminId, status: { notIn: CLOSED_STATUSES } }
    case 'open':
      return { status: { in: ACTIVE_STATUSES } }
    case 'escalated':
      return { status: 'ESCALATED' }
    case 'resolved': {
      const { start, end } = getRangeBounds(range)
      return { status: { in: CLOSED_STATUSES }, resolvedAt: { gte: start, lte: end } }
    }
  }
}

export async function loadSupportTab(
  tab: SupportTab,
  range: TimeRange,
  filters: SupportFilters,
  currentAdminId: string | null,
): Promise<PaginatedResult<TicketRow>> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  // "mine" with no resolved admin can never match — short-circuit.
  if (tab === 'mine' && !currentAdminId) {
    return { items: [], total: 0, page, pageSize }
  }

  const where: Record<string, unknown> = { ...buildTabWhere(tab, range, currentAdminId) }
  if (filters.type) where.type = filters.type
  if (filters.priority) where.priority = filters.priority
  if (filters.search) {
    where.OR = [
      { subject: { contains: filters.search, mode: 'insensitive' as const } },
      { ticketNumber: { contains: filters.search, mode: 'insensitive' as const } },
      { customerEmail: { contains: filters.search, mode: 'insensitive' as const } },
    ]
  }

  const [rows, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        type: true,
        status: true,
        priority: true,
        customerName: true,
        customerEmail: true,
        assignedToId: true,
        assignedTo: { select: { name: true } },
        createdAt: true,
        firstRespondedAt: true,
      },
    }),
    prisma.supportTicket.count({ where }),
  ])

  const now = Date.now()
  return {
    items: rows.map((t): TicketRow => {
      const ageHours = (now - t.createdAt.getTime()) / (60 * 60 * 1000)
      return {
        id: t.id,
        ticketNumber: t.ticketNumber,
        subject: t.subject,
        type: t.type,
        status: t.status,
        priority: t.priority,
        customerName: t.customerName,
        customerEmail: t.customerEmail,
        assigneeId: t.assignedToId ?? null,
        assigneeName: t.assignedTo?.name ?? null,
        createdAt: t.createdAt,
        firstRespondedAt: t.firstRespondedAt ?? null,
        ageHours,
        isOverdue: computeOverdue(t.status, t.firstRespondedAt ?? null, ageHours),
      }
    }),
    total,
    page,
    pageSize,
  }
}

// ============================================================
// Detail loaders
// ============================================================

export async function loadTicketHeader(id: string): Promise<TicketHeaderData | null> {
  const t = await prisma.supportTicket.findUnique({
    where: { id },
    select: {
      id: true,
      ticketNumber: true,
      subject: true,
      type: true,
      status: true,
      priority: true,
      customerId: true,
      customerName: true,
      customerEmail: true,
      orderId: true,
      orderNumber: true,
      assignedToId: true,
      assignedTo: { select: { name: true } },
      createdAt: true,
      firstRespondedAt: true,
      resolvedAt: true,
      returnRequested: true,
      returnApproved: true,
      refundAmount: true,
    },
  })
  if (!t) return null
  const ageHours = (Date.now() - t.createdAt.getTime()) / (60 * 60 * 1000)
  return {
    id: t.id,
    ticketNumber: t.ticketNumber,
    subject: t.subject,
    type: t.type,
    status: t.status,
    priority: t.priority,
    customerId: t.customerId ?? null,
    customerName: t.customerName,
    customerEmail: t.customerEmail,
    orderId: t.orderId ?? null,
    orderNumber: t.orderNumber ?? null,
    assigneeId: t.assignedToId ?? null,
    assigneeName: t.assignedTo?.name ?? null,
    createdAt: t.createdAt,
    firstRespondedAt: t.firstRespondedAt ?? null,
    resolvedAt: t.resolvedAt ?? null,
    ageHours,
    isOverdue: computeOverdue(t.status, t.firstRespondedAt ?? null, ageHours),
    returnRequested: t.returnRequested,
    returnApproved: t.returnApproved ?? null,
    refundAmount: t.refundAmount ?? null,
  }
}

export async function loadTicketMessages(ticketId: string): Promise<TicketMessageRow[]> {
  const rows = await prisma.supportMessage.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      message: true,
      isInternal: true,
      senderType: true,
      senderName: true,
      attachments: true,
      createdAt: true,
    },
  })
  return rows.map((m) => ({
    id: m.id,
    body: m.message,
    isInternal: m.isInternal,
    senderType: m.senderType,
    senderName: m.senderName,
    attachments: parseAttachments(m.attachments),
    createdAt: m.createdAt,
  }))
}

export async function loadTicketCustomerContext(
  ticketId: string,
): Promise<TicketCustomerContextData | null> {
  const t = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: {
      customerId: true,
      customerName: true,
      customerEmail: true,
      orderId: true,
      orderNumber: true,
      customer: {
        select: {
          totalSpent: true,
          totalOrders: true,
          loyaltyTier: { select: { name: true } },
        },
      },
      order: { select: { total: true } },
    },
  })
  if (!t) return null

  let otherTicketsCount = 0
  if (t.customerId) {
    otherTicketsCount = await prisma.supportTicket.count({
      where: { customerId: t.customerId, id: { not: ticketId } },
    })
  }

  return {
    customerId: t.customerId ?? null,
    customerName: t.customerName,
    customerEmail: t.customerEmail,
    tierName: t.customer?.loyaltyTier?.name ?? null,
    totalSpent: Number(t.customer?.totalSpent ?? 0),
    totalOrders: t.customer?.totalOrders ?? 0,
    orderId: t.orderId ?? null,
    orderNumber: t.orderNumber ?? null,
    orderTotal: t.order ? Number(t.order.total ?? 0) : null,
    otherTicketsCount,
  }
}

export async function loadTicketReturnRefund(
  ticketId: string,
): Promise<TicketReturnRefundData | null> {
  const t = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      orderId: true,
      returnRequested: true,
      returnApproved: true,
      returnLabel: true,
      refundAmount: true,
      refundReason: true,
    },
  })
  if (!t) return null

  const linkedReturn = await prisma.return.findUnique({
    where: { supportTicketId: ticketId },
    select: { id: true },
  })

  let refundRecordId: string | null = null
  if (t.orderId) {
    const rr = await prisma.refundRecord.findFirst({
      where: { orderId: t.orderId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })
    refundRecordId = rr?.id ?? null
  }

  let refundEligible = false
  let refundEligibilityReason: string | null = null
  if (t.orderId) {
    const eligibility = await checkRefundEligibility(t.orderId)
    refundEligible = eligibility.eligible
    refundEligibilityReason = eligibility.reason ?? null
  } else {
    refundEligibilityReason = 'No order linked to this ticket'
  }

  return {
    ticketId: t.id,
    returnRequested: t.returnRequested,
    returnApproved: t.returnApproved ?? null,
    returnLabel: t.returnLabel ?? null,
    refundAmount: t.refundAmount ?? null,
    refundReason: t.refundReason ?? null,
    refundEligible,
    refundEligibilityReason,
    returnId: linkedReturn?.id ?? null,
    refundRecordId,
  }
}

export async function loadCannedResponses(): Promise<CannedResponseRow[]> {
  const rows = await prisma.cannedResponse.findMany({
    where: { isActive: true },
    orderBy: [{ category: 'asc' }, { title: 'asc' }],
    select: {
      id: true,
      title: true,
      body: true,
      category: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    category: r.category ?? null,
    isActive: r.isActive,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }))
}

export async function loadAllCannedResponses(): Promise<CannedResponseRow[]> {
  const rows = await prisma.cannedResponse.findMany({
    orderBy: [{ isActive: 'desc' }, { category: 'asc' }, { title: 'asc' }],
    select: {
      id: true,
      title: true,
      body: true,
      category: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    category: r.category ?? null,
    isActive: r.isActive,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }))
}

export async function loadAgentList(): Promise<AgentRow[]> {
  const rows = await prisma.adminUser.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          assignedTickets: {
            where: { status: { in: ACTIVE_STATUSES } },
          },
        },
      },
    },
  })
  return rows.map((a) => ({
    id: a.id,
    name: a.name,
    openTicketCount: a._count.assignedTickets,
  }))
}

export async function loadTicketActivity(
  ticketId: string,
  limit = 50,
): Promise<TicketActivityEvent[]> {
  const [ticket, messages] = await Promise.all([
    prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        createdAt: true,
        assignedAt: true,
        assignedTo: { select: { name: true } },
        resolvedAt: true,
        resolvedBy: true,
        returnRequested: true,
        returnApproved: true,
        refundAmount: true,
      },
    }),
    prisma.supportMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        isInternal: true,
        senderType: true,
        senderName: true,
        createdAt: true,
      },
    }),
  ])

  if (!ticket) return []

  const events: TicketActivityEvent[] = []

  for (const m of messages) {
    events.push({
      id: `msg-${m.id}`,
      kind: m.isInternal ? 'internal' : 'message',
      label: m.isInternal
        ? `Internal note by ${m.senderName}`
        : `Reply from ${m.senderName} (${m.senderType})`,
      timestamp: m.createdAt,
      actor: m.senderName,
    })
  }

  if (ticket.assignedAt) {
    events.push({
      id: `assign-${ticket.id}`,
      kind: 'assignment',
      label: ticket.assignedTo?.name
        ? `Assigned to ${ticket.assignedTo.name}`
        : 'Assigned',
      timestamp: ticket.assignedAt,
      actor: ticket.assignedTo?.name ?? null,
    })
  }

  if (ticket.returnRequested) {
    events.push({
      id: `return-${ticket.id}`,
      kind: 'return',
      label:
        ticket.returnApproved === true
          ? 'Return approved'
          : ticket.returnApproved === false
            ? 'Return denied'
            : 'Return requested',
      timestamp: ticket.assignedAt ?? ticket.createdAt,
      actor: null,
    })
  }

  if (ticket.refundAmount != null) {
    events.push({
      id: `refund-${ticket.id}`,
      kind: 'refund',
      label: `Refund of $${Number(ticket.refundAmount).toFixed(2)}`,
      timestamp: ticket.resolvedAt ?? ticket.createdAt,
      actor: null,
    })
  }

  if (ticket.resolvedAt) {
    events.push({
      id: `status-${ticket.id}`,
      kind: 'status',
      label: ticket.resolvedBy ? `Resolved by ${ticket.resolvedBy}` : 'Resolved',
      timestamp: ticket.resolvedAt,
      actor: ticket.resolvedBy ?? null,
    })
  }

  return events
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit)
}

// ============================================================
// Live chat loaders
// ============================================================

export async function loadChatQueue(): Promise<ChatQueueRow[]> {
  const rows = await prisma.liveChatSession.findMany({
    where: { status: 'WAITING' },
    orderBy: { requestedAt: 'asc' },
    select: {
      id: true,
      sessionId: true,
      customerName: true,
      issueCategory: true,
      issueSummary: true,
      waitTime: true,
      requestedAt: true,
    },
  })
  return rows.map((s) => ({
    id: s.id,
    sessionId: s.sessionId,
    customerName: s.customerName,
    issueCategory: s.issueCategory ?? null,
    issueSummary: s.issueSummary ?? null,
    waitTime: s.waitTime ?? null,
    requestedAt: s.requestedAt,
  }))
}

export async function loadChatSession(sessionId: string): Promise<ChatSessionData | null> {
  const s = await prisma.liveChatSession.findUnique({
    where: { sessionId },
    select: {
      id: true,
      sessionId: true,
      status: true,
      customerName: true,
      customerEmail: true,
      issueCategory: true,
      issueSummary: true,
      acceptedAt: true,
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          message: true,
          senderType: true,
          senderName: true,
          createdAt: true,
        },
      },
    },
  })
  if (!s) return null
  return {
    id: s.id,
    sessionId: s.sessionId,
    status: s.status,
    customerName: s.customerName,
    customerEmail: s.customerEmail,
    issueCategory: s.issueCategory ?? null,
    issueSummary: s.issueSummary ?? null,
    acceptedAt: s.acceptedAt ?? null,
    messages: s.messages.map((m) => ({
      id: m.id,
      body: m.message,
      senderType: m.senderType,
      senderName: m.senderName,
      createdAt: m.createdAt,
    })),
  }
}

export async function loadAgentAvailability(
  currentAdminId: string | null,
): Promise<AgentAvailabilityData> {
  if (!currentAdminId) {
    return { isOnline: false, maxChats: 3, activeChats: 0 }
  }
  const row = await prisma.adminAvailability.findUnique({
    where: { adminId: currentAdminId },
    select: { isOnline: true, maxChats: true, activeChats: true },
  })
  if (!row) {
    return { isOnline: false, maxChats: 3, activeChats: 0 }
  }
  return {
    isOnline: row.isOnline,
    maxChats: row.maxChats,
    activeChats: row.activeChats,
  }
}
