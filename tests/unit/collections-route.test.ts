import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    collection: {
      findMany: vi.fn(),
    },
  },
}))

function createRequest(url: string) {
  return {
    url,
  } as NextRequest
}

describe('GET /api/collections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('applies search, featured, and sort query params', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { GET } = await import('@/app/api/collections/route')

    vi.mocked(prisma.collection.findMany).mockResolvedValue([] as never)

    const request = createRequest(
      'http://localhost/api/collections?isActive=true&featured=featured&search=calm&sortBy=productCount'
    )

    const response = await GET(request)
    expect(response.status).toBe(200)

    expect(prisma.collection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          isFeatured: true,
          OR: [
            { name: { contains: 'calm' } },
            { description: { contains: 'calm' } },
          ],
        }),
        orderBy: [
          { products: { _count: 'desc' } },
          { sortOrder: 'asc' },
          { name: 'asc' },
        ],
      })
    )
  })

  it('keeps explicit isFeatured query precedence over featured toggle', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { GET } = await import('@/app/api/collections/route')

    vi.mocked(prisma.collection.findMany).mockResolvedValue([] as never)

    const request = createRequest(
      'http://localhost/api/collections?isFeatured=false&featured=featured&sortBy=name'
    )

    await GET(request)

    expect(prisma.collection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isFeatured: false,
        }),
        orderBy: [
          { name: 'asc' },
          { sortOrder: 'asc' },
        ],
      })
    )
  })

  it('rejects an overly long search query', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { GET } = await import('@/app/api/collections/route')

    const longSearch = 'a'.repeat(121)
    const request = createRequest(`http://localhost/api/collections?search=${longSearch}`)
    const response = await GET(request)

    expect(response.status).toBe(400)
    expect(prisma.collection.findMany).not.toHaveBeenCalled()
  })
})
