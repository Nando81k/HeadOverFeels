import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const { verifyAdminMock, orderFindManyMock, ticketFindManyMock } = vi.hoisted(() => ({
  verifyAdminMock: vi.fn(),
  orderFindManyMock: vi.fn(),
  ticketFindManyMock: vi.fn(),
}))

vi.mock('@/lib/auth/admin', () => ({
  verifyAdmin: verifyAdminMock,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findMany: orderFindManyMock,
    },
    supportTicket: {
      findMany: ticketFindManyMock,
    },
  },
}))

function createRequest(url: string): NextRequest {
  return { url } as unknown as NextRequest
}

describe('GET /api/admin/fulfillment/queue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 for non-admin requests', async () => {
    const { GET } = await import('@/app/api/admin/fulfillment/queue/route')
    verifyAdminMock.mockResolvedValue(null)

    const response = await GET(createRequest('http://localhost/api/admin/fulfillment/queue'))
    expect(response.status).toBe(401)
  })

  it('returns derived queue payload for admin requests', async () => {
    const { GET } = await import('@/app/api/admin/fulfillment/queue/route')
    verifyAdminMock.mockResolvedValue('admin-1')

    orderFindManyMock.mockResolvedValue([
      {
        id: 'order-1',
        orderNumber: 'HOF-1001',
        status: 'PROCESSING',
        paymentStatus: 'PAID',
        total: 95,
        createdAt: new Date('2026-03-22T10:00:00.000Z'),
        trackingNumber: null,
        customerId: 'customer-1',
        customerEmail: 'a@example.com',
        customerPhone: null,
        customer: {
          id: 'customer-1',
          name: 'Alex',
          email: 'a@example.com',
          currentPoints: 50,
          totalSpent: 200,
          totalOrders: 3,
          loyaltyTier: { name: 'Mind' },
        },
        shippingAddress: {
          firstName: 'Alex',
          lastName: 'Mills',
        },
      },
    ])
    ticketFindManyMock.mockResolvedValue([])

    const response = await GET(
      createRequest('http://localhost/api/admin/fulfillment/queue?page=1&limit=20&queueTypes=FULFILL_ORDER')
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data).toHaveLength(1)
    expect(payload.data[0]).toMatchObject({
      queueType: 'FULFILL_ORDER',
      orderNumber: 'HOF-1001',
      nextAction: 'FIX_ADDRESS',
    })
    expect(payload.counts.byType.FULFILL_ORDER).toBe(1)
    expect(orderFindManyMock).toHaveBeenCalled()
    expect(ticketFindManyMock).toHaveBeenCalled()
  })
})
