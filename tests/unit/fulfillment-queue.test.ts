import { describe, expect, it } from 'vitest'
import {
  buildFulfillmentQueueItems,
  filterAndSortFulfillmentQueueItems,
  parseFulfillmentFilterState,
} from '@/lib/fulfillment/queue'

type QueueOrderSource = Parameters<typeof buildFulfillmentQueueItems>[0][number]
type QueueTicketSource = Parameters<typeof buildFulfillmentQueueItems>[1][number]

function buildOrder(overrides: Partial<QueueOrderSource> = {}): QueueOrderSource {
  return {
    id: 'order-1',
    orderNumber: 'HOF-1001',
    status: 'PROCESSING',
    paymentStatus: 'PAID',
    total: 149,
    createdAt: new Date('2026-03-20T10:00:00.000Z'),
    trackingNumber: null,
    customerId: 'customer-1',
    customerEmail: 'demo@example.com',
    customerPhone: null,
    customer: {
      id: 'customer-1',
      name: 'Taylor',
      email: 'demo@example.com',
      currentPoints: 220,
      totalSpent: 480,
      totalOrders: 6,
      loyaltyTier: { name: 'Friend' },
    },
    shippingAddress: {
      firstName: 'Taylor',
      lastName: 'River',
    },
    ...overrides,
  }
}

function buildTicket(overrides: Partial<QueueTicketSource> = {}): QueueTicketSource {
  return {
    id: 'ticket-1',
    ticketNumber: 'TKT-2026-000123',
    type: 'SHIPPING_ISSUE',
    status: 'OPEN',
    subject: 'Package delayed',
    customerId: 'customer-1',
    customerName: 'Taylor River',
    customerEmail: 'demo@example.com',
    orderId: 'order-1',
    orderNumber: 'HOF-1001',
    returnRequested: false,
    returnApproved: null,
    refundAmount: null,
    createdAt: new Date('2026-03-21T12:00:00.000Z'),
    assignedTo: null,
    customer: {
      id: 'customer-1',
      name: 'Taylor River',
      email: 'demo@example.com',
      currentPoints: 220,
      totalSpent: 480,
      totalOrders: 6,
      loyaltyTier: { name: 'Friend' },
    },
    order: {
      id: 'order-1',
      status: 'PROCESSING',
      paymentStatus: 'PAID',
      total: 149,
      trackingNumber: null,
    },
    ...overrides,
  }
}

describe('fulfillment queue helpers', () => {
  it('defaults queue filter to ready-to-ship lane when queueTypes is not provided', () => {
    const filters = parseFulfillmentFilterState(new URLSearchParams('search='))
    expect(filters.queueTypes).toEqual(['FULFILL_ORDER'])
  })

  it('applies precedence and de-duplicates by order id', () => {
    const orders = [buildOrder()]
    const tickets = [
      buildTicket({ type: 'SHIPPING_ISSUE' }),
      buildTicket({
        id: 'ticket-2',
        ticketNumber: 'TKT-2026-000124',
        type: 'REFUND',
        status: 'IN_PROGRESS',
        subject: 'Refund request',
      }),
    ]

    const items = buildFulfillmentQueueItems(
      orders,
      tickets,
      new Date('2026-03-22T12:00:00.000Z')
    )

    expect(items).toHaveLength(1)
    expect(items[0].queueType).toBe('REFUND_REVIEW')
    expect(items[0].ticketId).toBe('ticket-2')
    expect(items[0].orderId).toBe('order-1')
    expect(items[0].nextAction).toBe('RESOLVE_TICKET')
    expect(Array.isArray(items[0].blockers)).toBe(true)
  })

  it('filters by queue type and age bucket deterministically', () => {
    const orders = [
      buildOrder({
        id: 'order-2',
        orderNumber: 'HOF-1002',
        createdAt: new Date('2026-03-22T10:00:00.000Z'),
      }),
    ]
    const tickets = [buildTicket({ id: 'ticket-3', orderId: null, orderNumber: null })]
    const items = buildFulfillmentQueueItems(
      orders,
      tickets,
      new Date('2026-03-23T12:00:00.000Z')
    )

    const filters = parseFulfillmentFilterState(
      new URLSearchParams('queueTypes=SHIPPING_EXCEPTION&ageBucket=over24h&sortBy=priority')
    )

    const filtered = filterAndSortFulfillmentQueueItems(items, filters)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].queueType).toBe('SHIPPING_EXCEPTION')
    expect(filtered[0].ageHours).toBeGreaterThanOrEqual(24)
    expect(filtered[0].nextAction).toBe('RESOLVE_TICKET')
  })

  it('clears high-value hold blocker after review marker is present', () => {
    const orders = [
      buildOrder({
        id: 'order-hold-reviewed',
        orderNumber: 'HOF-2201',
        total: 650,
        shippingAddress: {
          firstName: 'Taylor',
          lastName: 'River',
          address1: '101 Main St',
          city: 'Austin',
          state: 'TX',
          postalCode: '78701',
          country: 'US',
        },
        internalNotes: '[HOLD_REVIEWED] 2026-03-24T10:30:00.000Z',
      }),
    ]

    const items = buildFulfillmentQueueItems(
      orders,
      [],
      new Date('2026-03-24T12:00:00.000Z')
    )

    expect(items).toHaveLength(1)
    expect(items[0].blockers).not.toContain('HIGH_VALUE_HOLD')
    expect(items[0].nextAction).toBe('BUY_LABEL')
    expect(items[0].labelEligible).toBe(true)
  })
})
