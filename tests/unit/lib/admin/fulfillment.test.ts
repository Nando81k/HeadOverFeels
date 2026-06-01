// tests/unit/lib/admin/fulfillment.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const orderFindMany = vi.fn()
const orderCount = vi.fn()
const orderAggregate = vi.fn()
const orderFindUnique = vi.fn()
const returnFindMany = vi.fn()
const returnCount = vi.fn()
const returnFindUnique = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findMany: orderFindMany,
      count: orderCount,
      aggregate: orderAggregate,
      findUnique: orderFindUnique,
    },
    return: {
      findMany: returnFindMany,
      count: returnCount,
      findUnique: returnFindUnique,
    },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('loadFulfillmentKpis', () => {
  it('aggregates four counts', async () => {
    orderCount
      .mockResolvedValueOnce(7)  // needs action
      .mockResolvedValueOnce(3)  // ready to ship
    orderAggregate.mockResolvedValue({ _sum: { total: 1234.5 } })
    returnCount.mockResolvedValueOnce(4)
    const { loadFulfillmentKpis } = await import('@/lib/admin/fulfillment')
    const k = await loadFulfillmentKpis()
    expect(k).toEqual({
      needsActionCount: 7,
      readyToShipCount: 3,
      todaysRevenue: 1234.5,
      returnsPendingCount: 4,
    })
  })

  it('treats null revenue as 0', async () => {
    orderCount.mockResolvedValue(0)
    orderAggregate.mockResolvedValue({ _sum: { total: null } })
    returnCount.mockResolvedValue(0)
    const { loadFulfillmentKpis } = await import('@/lib/admin/fulfillment')
    const k = await loadFulfillmentKpis()
    expect(k.todaysRevenue).toBe(0)
  })
})

describe('loadOrdersTab where clause mapping', () => {
  it('all excludes CANCELLED and REFUNDED', async () => {
    orderFindMany.mockResolvedValue([])
    orderCount.mockResolvedValue(0)
    const { loadOrdersTab } = await import('@/lib/admin/fulfillment')
    await loadOrdersTab('all')
    const where = orderFindMany.mock.calls[0][0].where
    expect(where.status).toEqual({ notIn: ['CANCELLED', 'REFUNDED'] })
  })

  it('needs-action ORs PENDING status with FAILED payment', async () => {
    orderFindMany.mockResolvedValue([])
    orderCount.mockResolvedValue(0)
    const { loadOrdersTab } = await import('@/lib/admin/fulfillment')
    await loadOrdersTab('needs-action')
    const where = orderFindMany.mock.calls[0][0].where
    expect(where.OR).toEqual([
      { status: 'PENDING' },
      { paymentStatus: 'FAILED' },
    ])
  })

  it('processing matches CONFIRMED, PROCESSING', async () => {
    orderFindMany.mockResolvedValue([])
    orderCount.mockResolvedValue(0)
    const { loadOrdersTab } = await import('@/lib/admin/fulfillment')
    await loadOrdersTab('processing')
    expect(orderFindMany.mock.calls[0][0].where.status).toEqual({
      in: ['CONFIRMED', 'PROCESSING'],
    })
  })

  it('shipped matches SHIPPED', async () => {
    orderFindMany.mockResolvedValue([])
    orderCount.mockResolvedValue(0)
    const { loadOrdersTab } = await import('@/lib/admin/fulfillment')
    await loadOrdersTab('shipped')
    expect(orderFindMany.mock.calls[0][0].where.status).toBe('SHIPPED')
  })

  it('delivered matches DELIVERED', async () => {
    orderFindMany.mockResolvedValue([])
    orderCount.mockResolvedValue(0)
    const { loadOrdersTab } = await import('@/lib/admin/fulfillment')
    await loadOrdersTab('delivered')
    expect(orderFindMany.mock.calls[0][0].where.status).toBe('DELIVERED')
  })
})

describe('loadOrdersTab paginated shape', () => {
  it('returns { items, total, page, pageSize }', async () => {
    orderFindMany.mockResolvedValue([
      {
        id: 'o1',
        orderNumber: 'HOF-1',
        customer: { name: 'Ada', email: 'ada@example.com' },
        customerEmail: 'ada@example.com',
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        total: 99.99,
        createdAt: new Date('2026-05-01'),
        trackingNumber: null,
        carrier: null,
        items: [{ id: 'i1' }, { id: 'i2' }],
      },
    ])
    orderCount.mockResolvedValue(1)
    const { loadOrdersTab } = await import('@/lib/admin/fulfillment')
    const r = await loadOrdersTab('all')
    expect(r.items).toHaveLength(1)
    expect(r.items[0]).toMatchObject({
      id: 'o1',
      orderNumber: 'HOF-1',
      customerName: 'Ada',
      customerEmail: 'ada@example.com',
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      totalAmount: 99.99,
      itemCount: 2,
    })
    expect(r.total).toBe(1)
    expect(r.page).toBe(1)
    expect(r.pageSize).toBe(25)
  })
})

describe('loadReturnsTab', () => {
  it('orders by requestedAt desc, returns paginated', async () => {
    returnFindMany.mockResolvedValue([
      {
        id: 'r1',
        rmaNumber: 'RMA-100000',
        orderId: 'o1',
        order: { orderNumber: 'HOF-1' },
        customer: { name: 'Ada' },
        status: 'REQUESTED',
        requestedAt: new Date('2026-05-15'),
        refunds: [{ amount: 49.99 }],
      },
    ])
    returnCount.mockResolvedValue(1)
    const { loadReturnsTab } = await import('@/lib/admin/fulfillment')
    const r = await loadReturnsTab()
    expect(r.items[0]).toMatchObject({
      id: 'r1',
      rmaNumber: 'RMA-100000',
      orderNumber: 'HOF-1',
      customerName: 'Ada',
      status: 'REQUESTED',
      refundAmount: 49.99,
    })
    const orderBy = returnFindMany.mock.calls[0][0].orderBy
    expect(orderBy).toEqual({ requestedAt: 'desc' })
  })
})

describe('loadArchivedTab', () => {
  it('matches CANCELLED + REFUNDED only', async () => {
    orderFindMany.mockResolvedValue([])
    orderCount.mockResolvedValue(0)
    const { loadArchivedTab } = await import('@/lib/admin/fulfillment')
    await loadArchivedTab()
    expect(orderFindMany.mock.calls[0][0].where.status).toEqual({
      in: ['CANCELLED', 'REFUNDED'],
    })
  })
})

describe('loadOrderDetail', () => {
  it('returns null when order not found', async () => {
    orderFindUnique.mockResolvedValue(null)
    const { loadOrderDetail } = await import('@/lib/admin/fulfillment')
    expect(await loadOrderDetail('missing')).toBeNull()
  })

  it('returns full detail with items, addresses, returns', async () => {
    orderFindUnique.mockResolvedValue({
      id: 'o1',
      orderNumber: 'HOF-1',
      status: 'PROCESSING',
      paymentStatus: 'PAID',
      total: 100,
      subtotal: 90,
      tax: 5,
      shipping: 5,
      customerEmail: 'ada@example.com',
      customerPhone: null,
      trackingNumber: null,
      trackingUrl: null,
      carrier: null,
      shippedAt: null,
      deliveredAt: null,
      estimatedDelivery: null,
      notes: null,
      internalNotes: null,
      createdAt: new Date('2026-05-01'),
      updatedAt: new Date('2026-05-02'),
      customer: { id: 'c1', name: 'Ada', email: 'ada@example.com' },
      shippingAddress: { id: 'a1', firstName: 'Ada', lastName: 'L', address1: '1 St', city: 'NY', state: 'NY', postalCode: '10001', country: 'US' },
      billingAddress: null,
      items: [
        {
          id: 'i1', productId: 'p1', productVariantId: 'v1',
          quantity: 1, price: 90, productName: 'Tee', productImage: '/t.jpg',
          variantDetails: null,
          productVariant: { sku: 'TEE-S-RED' },
        },
      ],
      returns: [],
      refundRecords: [],
    })
    const { loadOrderDetail } = await import('@/lib/admin/fulfillment')
    const d = await loadOrderDetail('o1')
    expect(d?.id).toBe('o1')
    expect(d?.items[0].sku).toBe('TEE-S-RED')
    expect(d?.returns).toEqual([])
  })
})

describe('loadCarriers', () => {
  it('returns the static carrier set merged with distinct order carriers', async () => {
    orderFindMany.mockResolvedValue([{ carrier: 'OnTrac' }])
    const { loadCarriers } = await import('@/lib/admin/fulfillment')
    const c = await loadCarriers()
    const values = c.map((x) => x.value)
    expect(values).toContain('USPS')
    expect(values).toContain('UPS')
    expect(values).toContain('FedEx')
    expect(values).toContain('DHL')
    expect(values).toContain('OnTrac')
  })
})
