import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const {
  verifyAdminMock,
  orderFindUniqueMock,
  orderUpdateMock,
  getFulfillmentAuditLoggerMock,
  auditLogOrderMock,
} = vi.hoisted(() => ({
  verifyAdminMock: vi.fn(),
  orderFindUniqueMock: vi.fn(),
  orderUpdateMock: vi.fn(),
  getFulfillmentAuditLoggerMock: vi.fn(),
  auditLogOrderMock: vi.fn(),
}))

vi.mock('@/lib/auth/admin', () => ({
  verifyAdmin: verifyAdminMock,
}))

vi.mock('@/lib/fulfillment/audit', () => ({
  getFulfillmentAuditLogger: getFulfillmentAuditLoggerMock,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findUnique: orderFindUniqueMock,
      update: orderUpdateMock,
    },
  },
}))

function createRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest
}

describe('PATCH /api/admin/fulfillment/orders/[id]/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getFulfillmentAuditLoggerMock.mockResolvedValue({
      logOrder: auditLogOrderMock,
    })
  })

  it('returns 401 for unauthorized requests', async () => {
    const { PATCH } = await import('@/app/api/admin/fulfillment/orders/[id]/status/route')
    verifyAdminMock.mockResolvedValue(null)

    const response = await PATCH(
      createRequest({ reviewHighValueHold: true }),
      { params: Promise.resolve({ id: 'order-1' }) }
    )

    expect(response.status).toBe(401)
  })

  it('persists high-value hold review marker when requested', async () => {
    const { PATCH } = await import('@/app/api/admin/fulfillment/orders/[id]/status/route')
    verifyAdminMock.mockResolvedValue('admin-1')
    orderFindUniqueMock.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'HOF-1001',
      status: 'PROCESSING',
      paymentStatus: 'PAID',
      trackingNumber: null,
      carrier: null,
      trackingUrl: null,
      internalNotes: 'Manual verification required',
    })
    orderUpdateMock.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'HOF-1001',
      status: 'PROCESSING',
      paymentStatus: 'PAID',
      trackingNumber: null,
      carrier: null,
      trackingUrl: null,
      internalNotes: 'Manual verification required\n[HOLD_REVIEWED] 2026-03-24T15:00:00.000Z',
      shippingAddress: null,
      customer: null,
    })

    const response = await PATCH(
      createRequest({ reviewHighValueHold: true }),
      { params: Promise.resolve({ id: 'order-1' }) }
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(orderUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-1' },
        data: expect.objectContaining({
          internalNotes: expect.stringContaining('[HOLD_REVIEWED]'),
        }),
      })
    )
    expect(auditLogOrderMock).toHaveBeenCalled()
  })
})
