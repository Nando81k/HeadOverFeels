import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const {
  verifyAdminMock,
  supportTicketFindUniqueMock,
  customerFindUniqueMock,
  transactionMock,
  txSupportMessageCreateMock,
  txSupportTicketUpdateMock,
  getFulfillmentAuditLoggerMock,
  auditLogSupportTicketMock,
} = vi.hoisted(() => ({
  verifyAdminMock: vi.fn(),
  supportTicketFindUniqueMock: vi.fn(),
  customerFindUniqueMock: vi.fn(),
  transactionMock: vi.fn(),
  txSupportMessageCreateMock: vi.fn(),
  txSupportTicketUpdateMock: vi.fn(),
  getFulfillmentAuditLoggerMock: vi.fn(),
  auditLogSupportTicketMock: vi.fn(),
}))

vi.mock('@/lib/auth/admin', () => ({
  verifyAdmin: verifyAdminMock,
}))

vi.mock('@/lib/fulfillment/audit', () => ({
  getFulfillmentAuditLogger: getFulfillmentAuditLoggerMock,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    supportTicket: {
      findUnique: supportTicketFindUniqueMock,
    },
    customer: {
      findUnique: customerFindUniqueMock,
    },
    $transaction: transactionMock,
  },
}))

function createRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest
}

describe('POST /api/admin/fulfillment/tickets/[id]/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getFulfillmentAuditLoggerMock.mockResolvedValue({
      logSupportTicket: auditLogSupportTicketMock,
    })
  })

  it('returns 401 for unauthorized request', async () => {
    const { POST } = await import('@/app/api/admin/fulfillment/tickets/[id]/messages/route')
    verifyAdminMock.mockResolvedValue(null)

    const response = await POST(
      createRequest({ message: 'Internal update', isInternal: true }),
      { params: Promise.resolve({ id: 'ticket-1' }) }
    )

    expect(response.status).toBe(401)
  })

  it('creates an internal note and updates status when nextStatus provided', async () => {
    const { POST } = await import('@/app/api/admin/fulfillment/tickets/[id]/messages/route')
    verifyAdminMock.mockResolvedValue('admin-1')
    supportTicketFindUniqueMock.mockResolvedValue({
      id: 'ticket-1',
      ticketNumber: 'TKT-1001',
      status: 'OPEN',
    })
    customerFindUniqueMock.mockResolvedValue({
      id: 'admin-1',
      name: 'Admin User',
      email: 'admin@example.com',
    })
    transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        supportMessage: {
          create: txSupportMessageCreateMock,
        },
        supportTicket: {
          update: txSupportTicketUpdateMock,
        },
      })
    )
    txSupportMessageCreateMock.mockResolvedValue({
      id: 'msg-1',
      message: 'Internal update',
      isInternal: true,
      senderType: 'admin',
      senderId: 'admin-1',
      senderName: 'Admin User',
      createdAt: new Date('2026-03-23T10:00:00.000Z'),
    })
    txSupportTicketUpdateMock.mockResolvedValue({
      id: 'ticket-1',
      status: 'IN_PROGRESS',
    })

    const response = await POST(
      createRequest({ message: 'Internal update', isInternal: true, nextStatus: 'IN_PROGRESS' }),
      { params: Promise.resolve({ id: 'ticket-1' }) }
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      success: true,
      statusUpdated: true,
      message: {
        id: 'msg-1',
      },
    })
    expect(txSupportMessageCreateMock).toHaveBeenCalled()
    expect(txSupportTicketUpdateMock).toHaveBeenCalled()
    expect(auditLogSupportTicketMock).toHaveBeenCalled()
  })
})
