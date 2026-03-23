import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/auth', () => ({
  auth: vi.fn(),
}))

function createRequest(url: string, headers: Record<string, string> = {}) {
  return {
    url,
    headers: {
      get: (key: string) => headers[key] ?? null,
    },
  } as unknown as NextRequest
}

describe('GET /api/orders admin filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('applies admin filters, sorting, and pagination server-side', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { GET } = await import('@/app/api/orders/route')

    vi.mocked(prisma.order.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.order.count).mockResolvedValue(0)

    const request = createRequest(
      'http://localhost/api/orders?page=1&limit=20&statuses=PROCESSING,SHIPPED&paymentStatus=PAID&minTotal=25&maxTotal=200&dateFrom=2026-03-01&dateTo=2026-03-31&sortBy=total&sortDir=asc&search=alice',
      { 'x-user-admin': 'true' }
    )

    const response = await GET(request)
    expect(response.status).toBe(200)

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['PROCESSING', 'SHIPPED'] },
          paymentStatus: 'PAID',
          total: { gte: 25, lte: 200 },
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
          OR: expect.arrayContaining([
            expect.objectContaining({
              orderNumber: expect.objectContaining({
                contains: 'alice',
              }),
            }),
          ]),
        }),
        orderBy: [{ total: 'asc' }, { createdAt: 'desc' }],
        skip: 0,
        take: 20,
      })
    )

    expect(prisma.order.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['PROCESSING', 'SHIPPED'] },
          paymentStatus: 'PAID',
        }),
      })
    )
  })

  it('keeps non-admin query scoped to customer email and basic status', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { GET } = await import('@/app/api/orders/route')

    vi.mocked(prisma.order.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.order.count).mockResolvedValue(0)

    const request = createRequest(
      'http://localhost/api/orders?status=PENDING&paymentStatus=PAID&minTotal=100&sortBy=total&sortDir=asc',
      {
        'x-user-admin': 'false',
        'x-user-email': 'customer@example.com',
      }
    )

    await GET(request)

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          customerEmail: 'customer@example.com',
          status: 'PENDING',
        }),
      })
    )

    const findManyArgs = vi.mocked(prisma.order.findMany).mock.calls[0]?.[0]
    expect(findManyArgs?.where).not.toHaveProperty('paymentStatus')
    expect(findManyArgs?.where).not.toHaveProperty('total')
  })
})
