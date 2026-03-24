import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const {
  verifyAdminMock,
  supportTicketFindUniqueMock,
  supportTicketFindFirstMock,
  supportTicketFindManyMock,
  orderFindUniqueMock,
  orderFindManyMock,
  customerFindUniqueMock,
  loyaltyTierFindManyMock,
} = vi.hoisted(() => ({
  verifyAdminMock: vi.fn(),
  supportTicketFindUniqueMock: vi.fn(),
  supportTicketFindFirstMock: vi.fn(),
  supportTicketFindManyMock: vi.fn(),
  orderFindUniqueMock: vi.fn(),
  orderFindManyMock: vi.fn(),
  customerFindUniqueMock: vi.fn(),
  loyaltyTierFindManyMock: vi.fn(),
}))

vi.mock('@/lib/auth/admin', () => ({
  verifyAdmin: verifyAdminMock,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    supportTicket: {
      findUnique: supportTicketFindUniqueMock,
      findFirst: supportTicketFindFirstMock,
      findMany: supportTicketFindManyMock,
    },
    order: {
      findUnique: orderFindUniqueMock,
      findMany: orderFindManyMock,
    },
    customer: {
      findUnique: customerFindUniqueMock,
    },
    loyaltyTier: {
      findMany: loyaltyTierFindManyMock,
    },
  },
}))

function createRequest(url: string): NextRequest {
  return { url } as unknown as NextRequest
}

describe('GET /api/admin/fulfillment/context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supportTicketFindUniqueMock.mockResolvedValue(null)
    supportTicketFindFirstMock.mockResolvedValue(null)
    supportTicketFindManyMock.mockResolvedValue([])
    orderFindUniqueMock.mockResolvedValue(null)
    orderFindManyMock.mockResolvedValue([])
    customerFindUniqueMock.mockResolvedValue(null)
    loyaltyTierFindManyMock.mockResolvedValue([])
  })

  it('returns 401 for unauthorized requests', async () => {
    const { GET } = await import('@/app/api/admin/fulfillment/context/route')
    verifyAdminMock.mockResolvedValue(null)

    const response = await GET(createRequest('http://localhost/api/admin/fulfillment/context?orderId=order-1'))
    expect(response.status).toBe(401)
  })

  it('returns context when only orderId is provided', async () => {
    const { GET } = await import('@/app/api/admin/fulfillment/context/route')
    verifyAdminMock.mockResolvedValue('admin-1')
    orderFindUniqueMock.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'HOF-1001',
      status: 'PROCESSING',
      paymentStatus: 'PAID',
      subtotal: 100,
      discount: 5,
      shipping: 10,
      tax: 7,
      total: 112,
      customerId: null,
      createdAt: new Date('2026-03-20T10:00:00.000Z'),
      updatedAt: new Date('2026-03-21T10:00:00.000Z'),
      items: [],
    })
    loyaltyTierFindManyMock.mockResolvedValue([
      {
        id: 'tier-1',
        name: 'Mind',
        pointMultiplier: 1,
        sortOrder: 1,
      },
    ])

    const response = await GET(createRequest('http://localhost/api/admin/fulfillment/context?orderId=order-1'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.order?.id).toBe('order-1')
    expect(payload.fulfillmentReadiness?.hasOrder).toBe(true)
    expect(payload.fulfillmentReadiness?.steps?.length).toBeGreaterThan(0)
    expect(payload.selectedTicket).toBeNull()
    expect(payload.relatedTickets).toEqual([])
    expect(orderFindUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'order-1',
        },
      })
    )
  })

  it('returns context when only ticketId is provided', async () => {
    const { GET } = await import('@/app/api/admin/fulfillment/context/route')
    verifyAdminMock.mockResolvedValue('admin-1')
    supportTicketFindUniqueMock.mockResolvedValue({
      id: 'ticket-1',
      ticketNumber: 'TKT-1001',
      type: 'SHIPPING_ISSUE',
      status: 'OPEN',
      priority: 'HIGH',
      subject: 'Package delayed',
      returnRequested: false,
      returnApproved: null,
      returnLabel: null,
      refundAmount: null,
      refundReason: null,
      resolution: null,
      orderId: null,
      orderNumber: null,
      customerId: null,
      createdAt: new Date('2026-03-22T10:00:00.000Z'),
      updatedAt: new Date('2026-03-22T11:00:00.000Z'),
      assignedTo: null,
      messages: [],
    })

    const response = await GET(createRequest('http://localhost/api/admin/fulfillment/context?ticketId=ticket-1'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.order).toBeNull()
    expect(payload.selectedTicket?.id).toBe('ticket-1')
    expect(supportTicketFindUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'ticket-1',
        },
      })
    )
  })
})
