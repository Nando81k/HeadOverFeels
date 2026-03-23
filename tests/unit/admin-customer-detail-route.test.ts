import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const { prismaMock, requireAdminMock } = vi.hoisted(() => ({
  prismaMock: {
    customer: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  requireAdminMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/auth/admin', () => ({
  requireAdmin: requireAdminMock,
}))

function createRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest
}

describe('PATCH /api/admin/customers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthorized requests', async () => {
    const { PATCH } = await import('@/app/api/admin/customers/[id]/route')
    requireAdminMock.mockRejectedValue(new Error('Unauthorized'))

    const response = await PATCH(createRequest({ name: 'Alice' }), {
      params: Promise.resolve({ id: 'customer-1' }),
    })

    expect(response.status).toBe(401)
  })

  it('validates allowlisted fields and updates customer profile', async () => {
    const { PATCH } = await import('@/app/api/admin/customers/[id]/route')
    requireAdminMock.mockResolvedValue({ id: 'admin-1' })
    prismaMock.customer.findUnique.mockResolvedValue({ id: 'customer-1' })
    prismaMock.customer.update.mockResolvedValue({
      id: 'customer-1',
      email: 'alice@example.com',
      name: 'Alice',
      phone: '123',
      birthday: new Date('2020-02-02T00:00:00.000Z'),
      newsletter: true,
      smsOptIn: false,
      updatedAt: new Date('2026-03-21T10:00:00.000Z'),
    })

    const response = await PATCH(
      createRequest({
        name: ' Alice ',
        phone: ' 123 ',
        birthday: '2020-02-02',
        newsletter: true,
        smsOptIn: false,
        randomField: 'ignored',
      }),
      {
        params: Promise.resolve({ id: 'customer-1' }),
      }
    )

    expect(response.status).toBe(200)
    expect(prismaMock.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'customer-1' },
        data: {
          name: 'Alice',
          phone: '123',
          birthday: new Date('2020-02-02'),
          newsletter: true,
          smsOptIn: false,
        },
      })
    )
  })

  it('rejects invalid birthday values', async () => {
    const { PATCH } = await import('@/app/api/admin/customers/[id]/route')
    requireAdminMock.mockResolvedValue({ id: 'admin-1' })
    prismaMock.customer.findUnique.mockResolvedValue({ id: 'customer-1' })

    const response = await PATCH(createRequest({ birthday: 'not-a-date' }), {
      params: Promise.resolve({ id: 'customer-1' }),
    })

    expect(response.status).toBe(400)
    expect(prismaMock.customer.update).not.toHaveBeenCalled()
  })
})
