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

// Phase 4 (Task 8): the route is admin-only and gates on the `auth_session`
// cookie through `verifyAdmin`; the old `x-user-*` headers are ignored.
vi.mock('@/lib/auth/admin', () => ({
  verifyAdmin: vi.fn(),
}))

function createRequest(url: string, headers: Record<string, string> = {}) {
  return {
    url,
    headers: {
      get: (key: string) => headers[key] ?? null,
    },
    cookies: {
      get: () => undefined,
    },
  } as unknown as NextRequest
}

describe('GET /api/orders (admin-only)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { verifyAdmin } = await import('@/lib/auth/admin')
    vi.mocked(verifyAdmin).mockResolvedValue('admin-1')
  })

  it('applies admin filters, sorting, and pagination server-side', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { GET } = await import('@/app/api/orders/route')

    vi.mocked(prisma.order.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.order.count).mockResolvedValue(0)

    const request = createRequest(
      'http://localhost/api/orders?page=1&limit=20&statuses=PROCESSING,SHIPPED&paymentStatus=PAID&minTotal=25&maxTotal=200&dateFrom=2026-03-01&dateTo=2026-03-31&sortBy=total&sortDir=asc&search=alice'
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

  it('returns 401 and never queries when the caller is not an admin', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { verifyAdmin } = await import('@/lib/auth/admin')
    const { GET } = await import('@/app/api/orders/route')

    vi.mocked(verifyAdmin).mockResolvedValue(null)

    const response = await GET(createRequest('http://localhost/api/orders'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(prisma.order.findMany).not.toHaveBeenCalled()
    expect(prisma.order.count).not.toHaveBeenCalled()
  })

  it('ignores the legacy x-user-admin / x-user-email headers', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { verifyAdmin } = await import('@/lib/auth/admin')
    const { GET } = await import('@/app/api/orders/route')

    // A forged "admin" header does not get past the session check...
    vi.mocked(verifyAdmin).mockResolvedValue(null)
    const forged = await GET(
      createRequest('http://localhost/api/orders', {
        'x-user-admin': 'true',
        'x-user-email': 'anyone@example.com',
      })
    )
    expect(forged.status).toBe(401)
    expect(prisma.order.findMany).not.toHaveBeenCalled()

    // ...and a real admin's query is never narrowed by a client-supplied email.
    vi.mocked(verifyAdmin).mockResolvedValue('admin-1')
    vi.mocked(prisma.order.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.order.count).mockResolvedValue(0)

    await GET(
      createRequest('http://localhost/api/orders?status=PENDING', {
        'x-user-admin': 'false',
        'x-user-email': 'customer@example.com',
      })
    )

    const findManyArgs = vi.mocked(prisma.order.findMany).mock.calls[0]?.[0]
    expect(findManyArgs?.where).not.toHaveProperty('customerEmail')
    expect(findManyArgs?.where).toMatchObject({ status: { in: ['PENDING'] } })
  })

  it('no longer exposes the legacy POST (custom checkout order creation)', async () => {
    const route = await import('@/app/api/orders/route')
    expect('POST' in route).toBe(false)
  })
})
