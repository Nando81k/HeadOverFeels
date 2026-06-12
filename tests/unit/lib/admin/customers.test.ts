// tests/unit/lib/admin/customers.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const customerCount = vi.fn()
const customerFindMany = vi.fn()
const customerFindUnique = vi.fn()
const customerAggregate = vi.fn()
const customerGroupBy = vi.fn()
const orderFindMany = vi.fn()
const orderCount = vi.fn()
const orderAggregate = vi.fn()
const noteFindMany = vi.fn()
const noteCount = vi.fn()
const addressFindMany = vi.fn()
const reviewFindMany = vi.fn()
const reviewCount = vi.fn()
const ticketFindMany = vi.fn()
const ticketCount = vi.fn()
const pointsTxFindMany = vi.fn()
const returnFindMany = vi.fn()
const returnCount = vi.fn()
const refundFindMany = vi.fn()
const refundCount = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      count: customerCount,
      findMany: customerFindMany,
      findUnique: customerFindUnique,
      aggregate: customerAggregate,
      groupBy: customerGroupBy,
    },
    order: {
      findMany: orderFindMany,
      count: orderCount,
      aggregate: orderAggregate,
    },
    customerNote: { findMany: noteFindMany, count: noteCount },
    address: { findMany: addressFindMany },
    review: { findMany: reviewFindMany, count: reviewCount },
    supportTicket: { findMany: ticketFindMany, count: ticketCount },
    pointsTransaction: { findMany: pointsTxFindMany },
    return: { findMany: returnFindMany, count: returnCount },
    refundRecord: { findMany: refundFindMany, count: refundCount },
  },
}))

beforeEach(() => vi.clearAllMocks())

describe('getRangeBounds (customers)', () => {
  it('maps 30d to 30-day window with previous shift', async () => {
    const { getRangeBounds } = await import('@/lib/admin/customers')
    const ref = new Date('2026-05-31T12:00:00Z')
    const b = getRangeBounds('30d', ref)
    const day = 24 * 60 * 60 * 1000
    expect(b.end.getTime() - b.start.getTime()).toBe(30 * day)
    expect(b.previousEnd.getTime()).toBe(b.end.getTime() - 30 * day)
  })
})

describe('loadCustomersKpis', () => {
  it('returns totalCustomers, newInRange (+trend), avgLtv, atRiskCount', async () => {
    customerCount
      .mockResolvedValueOnce(500) // totalCustomers (snapshot, anonymizedAt: null)
      .mockResolvedValueOnce(40)  // newInRange current
      .mockResolvedValueOnce(25)  // newInRange previous
      .mockResolvedValueOnce(8)   // atRiskCount
    customerAggregate.mockResolvedValueOnce({ _avg: { totalSpent: 175.5 } })
    const { loadCustomersKpis } = await import('@/lib/admin/customers')
    const k = await loadCustomersKpis('30d')
    expect(k.totalCustomers).toBe(500)
    expect(k.newInRange).toBe(40)
    expect(k.avgLtv).toBeCloseTo(175.5, 1)
    expect(k.atRiskCount).toBe(8)
    expect(k.newInRangeTrend.direction).toBe('up')
  })

  it('handles zero avg LTV', async () => {
    customerCount.mockResolvedValue(0)
    customerAggregate.mockResolvedValue({ _avg: { totalSpent: null } })
    const { loadCustomersKpis } = await import('@/lib/admin/customers')
    const k = await loadCustomersKpis('30d')
    expect(k.avgLtv).toBe(0)
  })
})

describe('loadCustomersTab', () => {
  it('returns paginated CustomerRow list with default anonymizedAt: null filter', async () => {
    customerFindMany.mockResolvedValue([
      { id: 'c1', email: 'a@e.com', name: 'Ada', currentPoints: 250,
        totalOrders: 3, totalSpent: 450, lastOrderDate: new Date('2026-05-20'),
        loyaltyTier: { id: 't1', name: 'Silver', primaryColor: '#aaa' },
        createdAt: new Date('2026-01-15') },
    ])
    customerCount.mockResolvedValue(1)
    const { loadCustomersTab } = await import('@/lib/admin/customers')
    const r = await loadCustomersTab('all', '30d')
    expect(r.items).toHaveLength(1)
    expect(r.items[0].email).toBe('a@e.com')
    expect(customerFindMany.mock.calls[0][0].where.anonymizedAt).toBeNull()
  })

  it('vip tab filters totalSpent >= 1000', async () => {
    customerFindMany.mockResolvedValue([])
    customerCount.mockResolvedValue(0)
    const { loadCustomersTab } = await import('@/lib/admin/customers')
    await loadCustomersTab('vip', '30d')
    const where = customerFindMany.mock.calls[0][0].where
    expect(where.totalSpent).toEqual({ gte: 1000 })
  })

  it('at-risk tab filters totalOrders >= 2 + lastOrderDate < 90d ago', async () => {
    customerFindMany.mockResolvedValue([])
    customerCount.mockResolvedValue(0)
    const { loadCustomersTab } = await import('@/lib/admin/customers')
    await loadCustomersTab('at-risk', '30d')
    const where = customerFindMany.mock.calls[0][0].where
    expect(where.totalOrders).toEqual({ gte: 2 })
    expect(where.lastOrderDate.lt).toBeInstanceOf(Date)
  })

  it('recent tab filters createdAt >= range start', async () => {
    customerFindMany.mockResolvedValue([])
    customerCount.mockResolvedValue(0)
    const { loadCustomersTab } = await import('@/lib/admin/customers')
    await loadCustomersTab('recent', '7d')
    const where = customerFindMany.mock.calls[0][0].where
    expect(where.createdAt.gte).toBeInstanceOf(Date)
  })
})

describe('Detail loaders', () => {
  it('loadCustomerHeader returns null when missing', async () => {
    customerFindUnique.mockResolvedValue(null)
    const { loadCustomerHeader } = await import('@/lib/admin/customers')
    expect(await loadCustomerHeader('missing')).toBeNull()
  })

  it('loadCustomerHeader returns full header with tier + status', async () => {
    customerFindUnique.mockResolvedValue({
      id: 'c1', email: 'a@e.com', name: 'Ada', phone: '555',
      profilePictureUrl: null, birthday: null, newsletter: true, smsOptIn: false,
      currentPoints: 200, lifetimePoints: 1500,
      totalSpent: 450, totalOrders: 3, lastOrderDate: new Date('2026-05-20'),
      createdAt: new Date('2026-01-15'), anonymizedAt: null,
      loyaltyTier: { id: 't1', name: 'Silver', slug: 'silver', primaryColor: '#aaa' },
    })
    const { loadCustomerHeader } = await import('@/lib/admin/customers')
    const d = await loadCustomerHeader('c1')
    expect(d?.email).toBe('a@e.com')
    expect(d?.tierName).toBe('Silver')
    expect(d?.isAnonymized).toBe(false)
  })

  it('loadCustomerOrders returns paginated rows', async () => {
    orderFindMany.mockResolvedValue([
      { id: 'o1', orderNumber: 'HOF-100', status: 'DELIVERED', total: 99.5,
        createdAt: new Date('2026-05-15') },
    ])
    orderCount.mockResolvedValue(1)
    const { loadCustomerOrders } = await import('@/lib/admin/customers')
    const r = await loadCustomerOrders('c1')
    expect(r.items[0].orderNumber).toBe('HOF-100')
    expect(orderFindMany.mock.calls[0][0].where.customerId).toBe('c1')
  })

  it('loadCustomerLoyalty returns tier + balances + last 10 ledger entries', async () => {
    customerFindUnique.mockResolvedValue({
      id: 'c1', currentPoints: 200, lifetimePoints: 1500, annualPointsEarned: 800,
      tierStartDate: new Date('2026-01-01'),
      loyaltyTier: { id: 't1', name: 'Silver', slug: 'silver', primaryColor: '#aaa' },
      pointsTransactions: [
        { id: 'p1', points: 100, type: 'PURCHASE', description: 'order',
          createdAt: new Date(), orderId: 'o1' },
      ],
    })
    const { loadCustomerLoyalty } = await import('@/lib/admin/customers')
    const d = await loadCustomerLoyalty('c1')
    expect(d?.tierName).toBe('Silver')
    expect(d?.transactions).toHaveLength(1)
  })

  it('loadCustomerAddresses returns rows ordered by isDefault desc', async () => {
    addressFindMany.mockResolvedValue([
      { id: 'a1', firstName: 'Ada', lastName: 'Lovelace', address1: '1 Main',
        address2: null, city: 'NYC', state: 'NY', postalCode: '10001',
        country: 'US', isDefault: true, type: 'SHIPPING', company: null },
    ])
    const { loadCustomerAddresses } = await import('@/lib/admin/customers')
    const rows = await loadCustomerAddresses('c1')
    expect(rows[0].firstName).toBe('Ada')
    expect(rows[0].address1).toBe('1 Main')
    expect(rows[0].state).toBe('NY')
    expect(rows[0].isDefault).toBe(true)
  })

  it('loadCustomerReviews returns paginated rows', async () => {
    reviewFindMany.mockResolvedValue([
      { id: 'r1', rating: 5, status: 'APPROVED', createdAt: new Date(),
        product: { id: 'p1', name: 'Tee' } },
    ])
    reviewCount.mockResolvedValue(1)
    const { loadCustomerReviews } = await import('@/lib/admin/customers')
    const r = await loadCustomerReviews('c1')
    expect(r.items[0].productName).toBe('Tee')
  })

  it('loadCustomerSupportTickets returns paginated rows', async () => {
    ticketFindMany.mockResolvedValue([
      { id: 'st1', ticketNumber: 'T-100', type: 'REFUND', status: 'OPEN',
        priority: 'HIGH', createdAt: new Date() },
    ])
    ticketCount.mockResolvedValue(1)
    const { loadCustomerSupportTickets } = await import('@/lib/admin/customers')
    const r = await loadCustomerSupportTickets('c1')
    expect(r.items[0].ticketNumber).toBe('T-100')
  })

  it('loadCustomerNotes returns rows with isImportant flag', async () => {
    noteFindMany.mockResolvedValue([
      { id: 'n1', content: 'VIP', authorId: 'a1', authorName: 'Admin',
        isImportant: true, createdAt: new Date(), updatedAt: new Date() },
    ])
    const { loadCustomerNotes } = await import('@/lib/admin/customers')
    const r = await loadCustomerNotes('c1')
    expect(r[0].isImportant).toBe(true)
  })

  it('loadCustomerActivity merges + sorts events', async () => {
    orderFindMany.mockResolvedValue([
      { id: 'o1', orderNumber: 'HOF-100', createdAt: new Date('2026-05-10'), total: 50 },
    ])
    pointsTxFindMany.mockResolvedValue([
      { id: 'pt1', points: 50, type: 'PURCHASE', description: 'd',
        createdAt: new Date('2026-05-11') },
    ])
    reviewFindMany.mockResolvedValue([])
    ticketFindMany.mockResolvedValue([])
    const { loadCustomerActivity } = await import('@/lib/admin/customers')
    const events = await loadCustomerActivity('c1', 50)
    expect(events.length).toBeGreaterThanOrEqual(2)
    expect(events[0].timestamp.getTime()).toBeGreaterThanOrEqual(events[1].timestamp.getTime())
  })

  it('loadCustomerRisk computes refund + return + chargeback rates', async () => {
    customerFindUnique.mockResolvedValue({ id: 'c1', totalOrders: 10 })
    refundCount.mockResolvedValueOnce(3) // refunds
    refundCount.mockResolvedValueOnce(1) // chargebacks (reason contains)
    returnCount.mockResolvedValue(2)
    returnFindMany.mockResolvedValue([
      { id: 'rt1', createdAt: new Date('2026-05-10'),
        order: { createdAt: new Date('2026-05-01') } },
    ])
    const { loadCustomerRisk } = await import('@/lib/admin/customers')
    const r = await loadCustomerRisk('c1')
    expect(r.refundRate).toBeCloseTo(30, 1)
    expect(r.returnRate).toBeCloseTo(20, 1)
    expect(r.chargebackCount).toBe(1)
    expect(r.avgDaysToReturn).toBeCloseTo(9, 0)
  })
})

describe('Tab + range constants', () => {
  it('CUSTOMERS_TABS contains 5 values', async () => {
    const { CUSTOMERS_TABS } = await import('@/lib/admin/customers')
    expect(CUSTOMERS_TABS).toEqual(['all', 'vip', 'at-risk', 'inactive', 'recent'])
  })
})
