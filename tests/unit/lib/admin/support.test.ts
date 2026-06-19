import { describe, it, expect, vi, beforeEach } from 'vitest'

const ticketCount = vi.fn()
const ticketFindMany = vi.fn()
const ticketFindUnique = vi.fn()
const ticketAggregate = vi.fn()
const messageFindMany = vi.fn()
const customerFindUnique = vi.fn()
const orderFindUnique = vi.fn()
const cannedFindMany = vi.fn()
const adminUserFindMany = vi.fn()
const adminUserFindUnique = vi.fn()
const returnFindUnique = vi.fn()
const refundFindFirst = vi.fn()
const chatSessionFindMany = vi.fn()
const chatSessionFindUnique = vi.fn()
const chatMessageFindMany = vi.fn()
const availabilityFindUnique = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    supportTicket: {
      count: ticketCount,
      findMany: ticketFindMany,
      findUnique: ticketFindUnique,
      aggregate: ticketAggregate,
    },
    supportMessage: { findMany: messageFindMany },
    customer: { findUnique: customerFindUnique },
    order: { findUnique: orderFindUnique },
    cannedResponse: { findMany: cannedFindMany },
    adminUser: { findMany: adminUserFindMany, findUnique: adminUserFindUnique },
    return: { findUnique: returnFindUnique },
    refundRecord: { findFirst: refundFindFirst },
    liveChatSession: { findMany: chatSessionFindMany, findUnique: chatSessionFindUnique },
    liveChatMessage: { findMany: chatMessageFindMany },
    adminAvailability: { findUnique: availabilityFindUnique },
  },
}))

// checkRefundEligibility is mocked so loadTicketReturnRefund stays a unit test.
const checkRefundEligibility = vi.fn()
vi.mock('@/lib/support/refund-helpers', () => ({ checkRefundEligibility }))

beforeEach(() => vi.clearAllMocks())

describe('getRangeBounds (support)', () => {
  it('maps 30d to a 30-day window with a previous shift', async () => {
    const { getRangeBounds } = await import('@/lib/admin/support')
    const ref = new Date('2026-06-19T12:00:00Z')
    const b = getRangeBounds('30d', ref)
    const day = 24 * 60 * 60 * 1000
    expect(b.end.getTime()).toBe(ref.getTime())
    expect(b.start.getTime()).toBe(ref.getTime() - 30 * day)
    expect(b.previousEnd.getTime()).toBe(b.start.getTime())
    expect(b.previousStart.getTime()).toBe(b.start.getTime() - 30 * day)
  })

  it('today snaps start to UTC midnight', async () => {
    const { getRangeBounds } = await import('@/lib/admin/support')
    const ref = new Date('2026-06-19T15:30:00Z')
    const b = getRangeBounds('today', ref)
    expect(b.start.toISOString()).toBe('2026-06-19T00:00:00.000Z')
  })
})

describe('buildTrend (support)', () => {
  it('flags new when previous is zero and current positive', async () => {
    const { buildTrend } = await import('@/lib/admin/support')
    expect(buildTrend(5, 0)).toEqual({ direction: 'flat', text: '↑ new' })
  })
  it('computes up percentage', async () => {
    const { buildTrend } = await import('@/lib/admin/support')
    const t = buildTrend(150, 100)
    expect(t.direction).toBe('up')
    expect(t.text).toContain('50.0%')
  })
})

describe('guards', () => {
  it('isSupportTab + isTimeRange', async () => {
    const { isSupportTab, isTimeRange } = await import('@/lib/admin/support')
    expect(isSupportTab('inbox')).toBe(true)
    expect(isSupportTab('nope')).toBe(false)
    expect(isTimeRange('30d')).toBe(true)
    expect(isTimeRange('decade')).toBe(false)
  })
})

describe('resolveAdminUserId', () => {
  it('returns null for a null session id', async () => {
    const { resolveAdminUserId } = await import('@/lib/admin/support')
    expect(await resolveAdminUserId(null)).toBeNull()
  })
  it('maps Customer.id -> email -> AdminUser.id', async () => {
    customerFindUnique.mockResolvedValue({ email: 'agent@hof.com' })
    adminUserFindUnique.mockResolvedValue({ id: 'au1' })
    const { resolveAdminUserId } = await import('@/lib/admin/support')
    const id = await resolveAdminUserId('cust1')
    expect(customerFindUnique).toHaveBeenCalledWith({
      where: { id: 'cust1' },
      select: { email: true },
    })
    expect(adminUserFindUnique).toHaveBeenCalledWith({
      where: { email: 'agent@hof.com' },
      select: { id: true },
    })
    expect(id).toBe('au1')
  })
  it('returns null when no AdminUser matches the email', async () => {
    customerFindUnique.mockResolvedValue({ email: 'nobody@hof.com' })
    adminUserFindUnique.mockResolvedValue(null)
    const { resolveAdminUserId } = await import('@/lib/admin/support')
    expect(await resolveAdminUserId('cust1')).toBeNull()
  })
})

describe('loadSupportKpis', () => {
  it('aggregates counts + first-response/resolution averages + trends', async () => {
    // Order of Promise.all in impl:
    // openCount, unassignedCount, resolvedInRange, resolvedInRangePrev,
    // frRows (range), resolvedRows (range)
    ticketCount
      .mockResolvedValueOnce(12) // openCount
      .mockResolvedValueOnce(4) // unassignedCount
      .mockResolvedValueOnce(20) // resolvedInRange
      .mockResolvedValueOnce(10) // resolvedInRangePrev
    ticketFindMany
      // first-response rows: firstRespondedAt 2h after createdAt
      .mockResolvedValueOnce([
        { createdAt: new Date('2026-06-10T00:00:00Z'), firstRespondedAt: new Date('2026-06-10T02:00:00Z') },
        { createdAt: new Date('2026-06-11T00:00:00Z'), firstRespondedAt: new Date('2026-06-11T06:00:00Z') },
      ])
      // resolution rows: resolvedAt 24h after createdAt
      .mockResolvedValueOnce([
        { createdAt: new Date('2026-06-10T00:00:00Z'), resolvedAt: new Date('2026-06-11T00:00:00Z') },
      ])

    const { loadSupportKpis } = await import('@/lib/admin/support')
    const kpi = await loadSupportKpis('30d', 'au1')
    expect(kpi.openCount).toBe(12)
    expect(kpi.unassignedCount).toBe(4)
    expect(kpi.resolvedInRange).toBe(20)
    expect(kpi.resolvedInRangeTrend.direction).toBe('up')
    expect(kpi.avgFirstResponseHours).toBeCloseTo(4, 5) // (2 + 6) / 2
    expect(kpi.avgResolutionHours).toBeCloseTo(24, 5)
  })
})

describe('loadSupportTab where-clauses', () => {
  beforeEach(() => {
    ticketFindMany.mockResolvedValue([])
    ticketCount.mockResolvedValue(0)
  })

  it('inbox => status OPEN + assignedToId null', async () => {
    const { loadSupportTab } = await import('@/lib/admin/support')
    await loadSupportTab('inbox', '30d', {}, 'au1')
    const where = ticketFindMany.mock.calls[0][0].where
    expect(where.status).toBe('OPEN')
    expect(where.assignedToId).toBeNull()
  })

  it('mine => assignedToId = currentAdminId + status NOT IN resolved/closed', async () => {
    const { loadSupportTab } = await import('@/lib/admin/support')
    await loadSupportTab('mine', '30d', {}, 'au1')
    const where = ticketFindMany.mock.calls[0][0].where
    expect(where.assignedToId).toBe('au1')
    expect(where.status).toEqual({ notIn: ['RESOLVED', 'CLOSED'] })
  })

  it('mine with null admin => matches nothing (assignedToId __never__)', async () => {
    const { loadSupportTab } = await import('@/lib/admin/support')
    const res = await loadSupportTab('mine', '30d', {}, null)
    expect(res.items).toEqual([])
    expect(res.total).toBe(0)
    expect(ticketFindMany).not.toHaveBeenCalled()
  })

  it('open => status IN active set', async () => {
    const { loadSupportTab } = await import('@/lib/admin/support')
    await loadSupportTab('open', '30d', {}, 'au1')
    const where = ticketFindMany.mock.calls[0][0].where
    expect(where.status).toEqual({
      in: ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'ESCALATED'],
    })
  })

  it('escalated => status ESCALATED', async () => {
    const { loadSupportTab } = await import('@/lib/admin/support')
    await loadSupportTab('escalated', '30d', {}, 'au1')
    expect(ticketFindMany.mock.calls[0][0].where.status).toBe('ESCALATED')
  })

  it('resolved => status IN RESOLVED/CLOSED + resolvedAt in range', async () => {
    const { loadSupportTab } = await import('@/lib/admin/support')
    await loadSupportTab('resolved', '30d', {}, 'au1')
    const where = ticketFindMany.mock.calls[0][0].where
    expect(where.status).toEqual({ in: ['RESOLVED', 'CLOSED'] })
    expect(where.resolvedAt.gte).toBeInstanceOf(Date)
    expect(where.resolvedAt.lte).toBeInstanceOf(Date)
  })

  it('applies search + type + priority filters', async () => {
    const { loadSupportTab } = await import('@/lib/admin/support')
    await loadSupportTab('open', '30d', { search: 'abc', type: 'REFUND', priority: 'HIGH' }, 'au1')
    const where = ticketFindMany.mock.calls[0][0].where
    expect(where.type).toBe('REFUND')
    expect(where.priority).toBe('HIGH')
    expect(where.OR).toEqual([
      { subject: { contains: 'abc', mode: 'insensitive' } },
      { ticketNumber: { contains: 'abc', mode: 'insensitive' } },
      { customerEmail: { contains: 'abc', mode: 'insensitive' } },
    ])
  })

  it('maps rows + computes isOverdue (no first response, aged past SLA, active)', async () => {
    const old = new Date(Date.now() - 10 * 60 * 60 * 1000) // 10h ago
    ticketFindMany.mockResolvedValue([
      {
        id: 't1',
        ticketNumber: 'TKT-2026-000001',
        subject: 'Help',
        type: 'GENERAL',
        status: 'OPEN',
        priority: 'MEDIUM',
        customerName: 'Jane',
        customerEmail: 'jane@x.com',
        assignedToId: null,
        assignedTo: null,
        createdAt: old,
        firstRespondedAt: null,
      },
    ])
    ticketCount.mockResolvedValue(1)
    const { loadSupportTab } = await import('@/lib/admin/support')
    const res = await loadSupportTab('inbox', '30d', {}, 'au1')
    expect(res.items[0].isOverdue).toBe(true)
    expect(res.items[0].ageHours).toBeGreaterThanOrEqual(10)
    expect(res.items[0].assigneeName).toBeNull()
  })

  it('not overdue once a first response exists', async () => {
    const old = new Date(Date.now() - 10 * 60 * 60 * 1000)
    ticketFindMany.mockResolvedValue([
      {
        id: 't2',
        ticketNumber: 'TKT-2026-000002',
        subject: 'Hi',
        type: 'GENERAL',
        status: 'OPEN',
        priority: 'LOW',
        customerName: 'Bob',
        customerEmail: 'bob@x.com',
        assignedToId: 'au1',
        assignedTo: { name: 'Agent A' },
        createdAt: old,
        firstRespondedAt: new Date(old.getTime() + 60 * 60 * 1000),
      },
    ])
    ticketCount.mockResolvedValue(1)
    const { loadSupportTab } = await import('@/lib/admin/support')
    const res = await loadSupportTab('inbox', '30d', {}, 'au1')
    expect(res.items[0].isOverdue).toBe(false)
    expect(res.items[0].assigneeName).toBe('Agent A')
  })
})

describe('loadTicketHeader', () => {
  it('returns null when missing', async () => {
    ticketFindUnique.mockResolvedValue(null)
    const { loadTicketHeader } = await import('@/lib/admin/support')
    expect(await loadTicketHeader('nope')).toBeNull()
  })
  it('maps core fields + overdue + refundAmount', async () => {
    const created = new Date(Date.now() - 6 * 60 * 60 * 1000)
    ticketFindUnique.mockResolvedValue({
      id: 't1',
      ticketNumber: 'TKT-2026-000001',
      subject: 'S',
      type: 'REFUND',
      status: 'OPEN',
      priority: 'HIGH',
      customerId: 'c1',
      customerName: 'Jane',
      customerEmail: 'jane@x.com',
      orderId: 'o1',
      orderNumber: 'HOF-1001',
      assignedToId: null,
      assignedTo: null,
      createdAt: created,
      firstRespondedAt: null,
      resolvedAt: null,
      returnRequested: true,
      returnApproved: null,
      refundAmount: 42.5,
    })
    const { loadTicketHeader } = await import('@/lib/admin/support')
    const h = await loadTicketHeader('t1')
    expect(h?.isOverdue).toBe(true)
    expect(h?.refundAmount).toBe(42.5)
    expect(h?.orderNumber).toBe('HOF-1001')
    expect(h?.returnRequested).toBe(true)
  })
})

describe('loadTicketMessages', () => {
  it('maps message->body + parses attachments JSON', async () => {
    messageFindMany.mockResolvedValue([
      {
        id: 'm1',
        message: 'hello',
        isInternal: false,
        senderType: 'customer',
        senderName: 'Jane',
        attachments: '["https://a.png","https://b.png"]',
        createdAt: new Date(),
      },
      {
        id: 'm2',
        message: 'note',
        isInternal: true,
        senderType: 'admin',
        senderName: 'Agent',
        attachments: null,
        createdAt: new Date(),
      },
    ])
    const { loadTicketMessages } = await import('@/lib/admin/support')
    const rows = await loadTicketMessages('t1')
    expect(messageFindMany.mock.calls[0][0].orderBy).toEqual({ createdAt: 'asc' })
    expect(rows[0].body).toBe('hello')
    expect(rows[0].attachments).toEqual(['https://a.png', 'https://b.png'])
    expect(rows[1].attachments).toEqual([])
  })
})

describe('loadTicketCustomerContext', () => {
  it('returns null when ticket missing', async () => {
    ticketFindUnique.mockResolvedValue(null)
    const { loadTicketCustomerContext } = await import('@/lib/admin/support')
    expect(await loadTicketCustomerContext('x')).toBeNull()
  })
  it('assembles customer snapshot + order + other ticket count', async () => {
    ticketFindUnique.mockResolvedValue({
      customerId: 'c1',
      customerName: 'Jane',
      customerEmail: 'jane@x.com',
      orderId: 'o1',
      orderNumber: 'HOF-1001',
      customer: {
        totalSpent: 300,
        totalOrders: 4,
        loyaltyTier: { name: 'Gold' },
      },
      order: { total: 80 },
    })
    ticketCount.mockResolvedValue(2) // other tickets
    const { loadTicketCustomerContext } = await import('@/lib/admin/support')
    const ctx = await loadTicketCustomerContext('t1')
    expect(ctx?.tierName).toBe('Gold')
    expect(ctx?.totalSpent).toBe(300)
    expect(ctx?.orderTotal).toBe(80)
    expect(ctx?.otherTicketsCount).toBe(2)
    // other-ticket count excludes this ticket + scoped to customer
    const where = ticketCount.mock.calls[0][0].where
    expect(where.customerId).toBe('c1')
    expect(where.id).toEqual({ not: 't1' })
  })
})

describe('loadTicketReturnRefund', () => {
  it('returns null when ticket missing', async () => {
    ticketFindUnique.mockResolvedValue(null)
    const { loadTicketReturnRefund } = await import('@/lib/admin/support')
    expect(await loadTicketReturnRefund('x')).toBeNull()
  })
  it('assembles return/refund + eligibility from helper', async () => {
    ticketFindUnique.mockResolvedValue({
      id: 't1',
      orderId: 'o1',
      returnRequested: true,
      returnApproved: null,
      returnLabel: null,
      refundAmount: null,
      refundReason: null,
    })
    returnFindUnique.mockResolvedValue({ id: 'r1' })
    refundFindFirst.mockResolvedValue({ id: 'rr1' })
    checkRefundEligibility.mockResolvedValue({ eligible: true, reason: undefined })
    const { loadTicketReturnRefund } = await import('@/lib/admin/support')
    const d = await loadTicketReturnRefund('t1')
    expect(checkRefundEligibility).toHaveBeenCalledWith('o1')
    expect(d?.refundEligible).toBe(true)
    expect(d?.returnId).toBe('r1')
    expect(d?.refundRecordId).toBe('rr1')
  })
  it('eligibility false when no order linked (no helper call)', async () => {
    ticketFindUnique.mockResolvedValue({
      id: 't1',
      orderId: null,
      returnRequested: false,
      returnApproved: null,
      returnLabel: null,
      refundAmount: null,
      refundReason: null,
    })
    returnFindUnique.mockResolvedValue(null)
    const { loadTicketReturnRefund } = await import('@/lib/admin/support')
    const d = await loadTicketReturnRefund('t1')
    expect(checkRefundEligibility).not.toHaveBeenCalled()
    expect(d?.refundEligible).toBe(false)
    expect(d?.returnId).toBeNull()
    expect(d?.refundRecordId).toBeNull()
  })
})

describe('canned responses loaders', () => {
  it('loadCannedResponses filters active only', async () => {
    cannedFindMany.mockResolvedValue([])
    const { loadCannedResponses } = await import('@/lib/admin/support')
    await loadCannedResponses()
    expect(cannedFindMany.mock.calls[0][0].where).toEqual({ isActive: true })
  })
  it('loadAllCannedResponses has no active filter', async () => {
    cannedFindMany.mockResolvedValue([])
    const { loadAllCannedResponses } = await import('@/lib/admin/support')
    await loadAllCannedResponses()
    expect(cannedFindMany.mock.calls[0][0].where).toBeUndefined()
  })
})

describe('loadAgentList', () => {
  it('returns active admins with open-ticket counts', async () => {
    adminUserFindMany.mockResolvedValue([
      { id: 'au1', name: 'Agent A', _count: { assignedTickets: 3 } },
      { id: 'au2', name: 'Agent B', _count: { assignedTickets: 0 } },
    ])
    const { loadAgentList } = await import('@/lib/admin/support')
    const agents = await loadAgentList()
    expect(adminUserFindMany.mock.calls[0][0].where).toEqual({ isActive: true })
    expect(agents[0]).toEqual({ id: 'au1', name: 'Agent A', openTicketCount: 3 })
  })
})

describe('loadTicketActivity', () => {
  it('merges messages + status/assignment/return/refund events sorted desc', async () => {
    const t0 = new Date('2026-06-19T00:00:00Z')
    const t1 = new Date('2026-06-19T01:00:00Z')
    const t2 = new Date('2026-06-19T02:00:00Z')
    ticketFindUnique.mockResolvedValue({
      id: 't1',
      createdAt: t0,
      assignedAt: t1,
      assignedTo: { name: 'Agent A' },
      resolvedAt: t2,
      resolvedBy: 'Agent A',
      returnRequested: true,
      returnApproved: true,
      refundAmount: 10,
    })
    messageFindMany.mockResolvedValue([
      { id: 'm1', isInternal: false, senderType: 'customer', senderName: 'Jane', createdAt: t0 },
      { id: 'm2', isInternal: true, senderType: 'admin', senderName: 'Agent A', createdAt: t1 },
    ])
    const { loadTicketActivity } = await import('@/lib/admin/support')
    const events = await loadTicketActivity('t1', 50)
    // newest first
    expect(events[0].timestamp.getTime()).toBeGreaterThanOrEqual(events[events.length - 1].timestamp.getTime())
    const kinds = events.map((e) => e.kind)
    expect(kinds).toContain('message')
    expect(kinds).toContain('internal')
    expect(kinds).toContain('assignment')
    expect(kinds).toContain('return')
    expect(kinds).toContain('refund')
  })
})

describe('live chat loaders', () => {
  it('loadChatQueue returns WAITING sessions', async () => {
    chatSessionFindMany.mockResolvedValue([
      {
        id: 's1',
        sessionId: 'sess-1',
        customerName: 'Jane',
        issueCategory: 'returns',
        issueSummary: 'wrong size',
        waitTime: 30,
        requestedAt: new Date(),
      },
    ])
    const { loadChatQueue } = await import('@/lib/admin/support')
    const q = await loadChatQueue()
    expect(chatSessionFindMany.mock.calls[0][0].where).toEqual({ status: 'WAITING' })
    expect(q[0].sessionId).toBe('sess-1')
  })

  it('loadChatSession maps session + messages', async () => {
    chatSessionFindUnique.mockResolvedValue({
      id: 's1',
      sessionId: 'sess-1',
      status: 'ACTIVE',
      customerName: 'Jane',
      customerEmail: 'jane@x.com',
      issueCategory: 'returns',
      issueSummary: 'wrong size',
      acceptedAt: new Date(),
      messages: [
        { id: 'cm1', message: 'hi', senderType: 'customer', senderName: 'Jane', createdAt: new Date() },
      ],
    })
    const { loadChatSession } = await import('@/lib/admin/support')
    const s = await loadChatSession('sess-1')
    expect(chatSessionFindUnique.mock.calls[0][0].where).toEqual({ sessionId: 'sess-1' })
    expect(s?.messages[0].body).toBe('hi')
  })

  it('loadChatSession returns null when missing', async () => {
    chatSessionFindUnique.mockResolvedValue(null)
    const { loadChatSession } = await import('@/lib/admin/support')
    expect(await loadChatSession('x')).toBeNull()
  })

  it('loadAgentAvailability returns defaults for null admin', async () => {
    const { loadAgentAvailability } = await import('@/lib/admin/support')
    const a = await loadAgentAvailability(null)
    expect(a).toEqual({ isOnline: false, maxChats: 3, activeChats: 0 })
    expect(availabilityFindUnique).not.toHaveBeenCalled()
  })

  it('loadAgentAvailability reads the row when present', async () => {
    availabilityFindUnique.mockResolvedValue({ isOnline: true, maxChats: 5, activeChats: 2 })
    const { loadAgentAvailability } = await import('@/lib/admin/support')
    const a = await loadAgentAvailability('au1')
    expect(availabilityFindUnique.mock.calls[0][0].where).toEqual({ adminId: 'au1' })
    expect(a).toEqual({ isOnline: true, maxChats: 5, activeChats: 2 })
  })
})
