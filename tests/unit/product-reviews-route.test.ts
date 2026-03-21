import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    review: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}))

function createRequest(url: string) {
  return {
    nextUrl: new URL(url),
  } as NextRequest
}

describe('GET /api/products/[id]/reviews', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('applies rating, verified, and hasMedia filters with pagination', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { GET } = await import('@/app/api/products/[id]/reviews/route')

    vi.mocked(prisma.review.findMany).mockResolvedValue([
      {
        id: 'rev-1',
        rating: 4,
        title: 'Solid hoodie',
        comment: 'Great quality',
        images: JSON.stringify(['https://cdn.test/rev-1.jpg']),
        customerName: 'Taylor',
        isVerified: true,
        helpfulCount: 3,
        notHelpfulCount: 0,
        createdAt: new Date('2026-03-20T12:00:00.000Z'),
      },
    ] as never)
    vi.mocked(prisma.review.count).mockResolvedValue(3)
    vi.mocked(prisma.review.groupBy).mockResolvedValue([
      { rating: 5, _count: { rating: 6 } },
      { rating: 4, _count: { rating: 4 } },
      { rating: 3, _count: { rating: 2 } },
    ] as never)

    const request = createRequest(
      'http://localhost/api/products/prod-1/reviews?page=2&limit=2&sortBy=helpful&verified=true&rating=4&hasMedia=true'
    )

    const response = await GET(request, { params: Promise.resolve({ id: 'prod-1' }) })
    const body = await response.json()

    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          productId: 'prod-1',
          status: 'APPROVED',
          isVerified: true,
          rating: 4,
          AND: [{ images: { not: null } }, { NOT: { images: '' } }],
        }),
        skip: 2,
        take: 2,
        orderBy: [{ helpfulCount: 'desc' }, { createdAt: 'desc' }],
      })
    )
    expect(prisma.review.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          productId: 'prod-1',
          status: 'APPROVED',
          isVerified: true,
          rating: 4,
        }),
      })
    )
    expect(prisma.review.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId: 'prod-1', status: 'APPROVED' },
      })
    )

    expect(response.status).toBe(200)
    expect(body.pagination.page).toBe(2)
    expect(body.pagination.limit).toBe(2)
    expect(body.pagination.totalCount).toBe(3)
    expect(body.pagination.hasNextPage).toBe(false)
    expect(body.stats.totalReviews).toBe(12)
  })

  it('returns 400 for invalid rating filters', async () => {
    const { GET } = await import('@/app/api/products/[id]/reviews/route')

    const request = createRequest(
      'http://localhost/api/products/prod-1/reviews?rating=9'
    )

    const response = await GET(request, { params: Promise.resolve({ id: 'prod-1' }) })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('Invalid rating filter')
  })
})
