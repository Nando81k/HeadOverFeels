import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const {
  verifyAdminMock,
  customerFindUniqueMock,
  loyaltyTierFindUniqueMock,
  transactionMock,
  txPointsCreateMock,
  txCustomerUpdateMock,
  customerUpdateMock,
  getFulfillmentAuditLoggerMock,
  auditLogCustomerMock,
} = vi.hoisted(() => ({
  verifyAdminMock: vi.fn(),
  customerFindUniqueMock: vi.fn(),
  loyaltyTierFindUniqueMock: vi.fn(),
  transactionMock: vi.fn(),
  txPointsCreateMock: vi.fn(),
  txCustomerUpdateMock: vi.fn(),
  customerUpdateMock: vi.fn(),
  getFulfillmentAuditLoggerMock: vi.fn(),
  auditLogCustomerMock: vi.fn(),
}))

vi.mock('@/lib/auth/admin', () => ({
  verifyAdmin: verifyAdminMock,
}))

vi.mock('@/lib/fulfillment/audit', () => ({
  getFulfillmentAuditLogger: getFulfillmentAuditLoggerMock,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      findUnique: customerFindUniqueMock,
      update: customerUpdateMock,
    },
    loyaltyTier: {
      findUnique: loyaltyTierFindUniqueMock,
    },
    $transaction: transactionMock,
  },
}))

function createRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest
}

describe('POST /api/admin/fulfillment/customers/[id]/loyalty', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getFulfillmentAuditLoggerMock.mockResolvedValue({
      logCustomer: auditLogCustomerMock,
    })
  })

  it('returns 401 for non-admin request', async () => {
    const { POST } = await import('@/app/api/admin/fulfillment/customers/[id]/loyalty/route')
    verifyAdminMock.mockResolvedValue(null)

    const response = await POST(
      createRequest({ action: 'adjustPoints', points: 50 }),
      { params: Promise.resolve({ id: 'customer-1' }) }
    )

    expect(response.status).toBe(401)
  })

  it('adjusts points and returns updated balance', async () => {
    const { POST } = await import('@/app/api/admin/fulfillment/customers/[id]/loyalty/route')
    verifyAdminMock.mockResolvedValue('admin-1')
    customerFindUniqueMock.mockResolvedValue({
      id: 'customer-1',
      email: 'customer@example.com',
      currentPoints: 120,
      loyaltyTierId: 'tier-1',
    })
    transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        pointsTransaction: {
          create: txPointsCreateMock,
        },
        customer: {
          update: txCustomerUpdateMock,
        },
      })
    )
    txPointsCreateMock.mockResolvedValue({
      id: 'tx-1',
    })
    txCustomerUpdateMock.mockResolvedValue({
      id: 'customer-1',
      currentPoints: 170,
    })

    const response = await POST(
      createRequest({ action: 'adjustPoints', points: 50, reason: 'Support goodwill' }),
      { params: Promise.resolve({ id: 'customer-1' }) }
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      success: true,
      currentPoints: 170,
    })
    expect(txPointsCreateMock).toHaveBeenCalled()
    expect(txCustomerUpdateMock).toHaveBeenCalled()
    expect(auditLogCustomerMock).toHaveBeenCalled()
  })

  it('changes tier and returns updated tier payload', async () => {
    const { POST } = await import('@/app/api/admin/fulfillment/customers/[id]/loyalty/route')
    verifyAdminMock.mockResolvedValue('admin-1')
    customerFindUniqueMock.mockResolvedValue({
      id: 'customer-1',
      email: 'customer@example.com',
      currentPoints: 500,
      loyaltyTierId: 'tier-1',
    })
    loyaltyTierFindUniqueMock.mockResolvedValue({
      id: 'tier-2',
      name: 'Friend',
    })
    customerUpdateMock.mockResolvedValue({
      id: 'customer-1',
      loyaltyTier: {
        id: 'tier-2',
        name: 'Friend',
        pointMultiplier: 1.25,
      },
    })

    const response = await POST(
      createRequest({ action: 'changeTier', tierId: 'tier-2' }),
      { params: Promise.resolve({ id: 'customer-1' }) }
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      success: true,
      loyaltyTier: {
        id: 'tier-2',
        name: 'Friend',
      },
    })
    expect(customerUpdateMock).toHaveBeenCalled()
    expect(auditLogCustomerMock).toHaveBeenCalled()
  })
})
