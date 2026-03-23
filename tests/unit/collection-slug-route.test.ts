import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    collection: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

function createRequest(url: string) {
  return {
    url,
  } as NextRequest
}

const baseCollection = {
  id: 'collection-1',
  name: 'Calm Essentials',
  slug: 'calm-essentials',
  description: 'A calm edit',
  image: '/collections/calm.jpg',
  isFeatured: true,
  sortOrder: 0,
  _count: {
    products: 2,
  },
  products: [
    {
      sortOrder: 0,
      product: {
        id: 'product-1',
        name: 'Calm Hoodie',
        slug: 'calm-hoodie',
        description: 'Soft and heavy',
        price: 98,
        compareAtPrice: 120,
        images: '[]',
        isActive: true,
        isFeatured: false,
        variants: [
          {
            id: 'variant-1',
            sku: 'SKU-1',
            size: 'M',
            color: 'Navy',
            colorHex: '#1B2A4A',
            inventory: 6,
            isActive: true,
          },
        ],
        createdAt: '2026-03-05T00:00:00.000Z',
        updatedAt: '2026-03-05T00:00:00.000Z',
      },
    },
    {
      sortOrder: 1,
      product: {
        id: 'product-2',
        name: 'Calm Tee',
        slug: 'calm-tee',
        description: 'Lightweight',
        price: 44,
        compareAtPrice: null,
        images: '[]',
        isActive: true,
        isFeatured: false,
        variants: [
          {
            id: 'variant-2',
            sku: 'SKU-2',
            size: 'L',
            color: 'Black',
            colorHex: '#000000',
            inventory: 0,
            isActive: true,
          },
        ],
        createdAt: '2026-03-10T00:00:00.000Z',
        updatedAt: '2026-03-10T00:00:00.000Z',
      },
    },
  ],
}

describe('GET /api/collections/slug/[slug]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('applies detail filters and returns canonical metadata', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { GET } = await import('@/app/api/collections/slug/[slug]/route')

    vi.mocked(prisma.collection.findFirst).mockResolvedValueOnce({ id: 'collection-1' } as never)
    vi.mocked(prisma.collection.findUnique).mockResolvedValue(baseCollection as never)

    const request = createRequest(
      'http://localhost/api/collections/slug/calm-essentials?search=hoodie&sortBy=priceDesc&inStock=true'
    )

    const response = await GET(request, { params: Promise.resolve({ slug: 'calm-essentials' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.products).toHaveLength(1)
    expect(body.products[0].slug).toBe('calm-hoodie')
    expect(body.filters).toEqual({
      search: 'hoodie',
      sortBy: 'priceDesc',
      inStock: true,
    })
    expect(body.meta).toEqual({
      requestedSlug: 'calm-essentials',
      resolvedSlug: 'calm-essentials',
      isCanonical: true,
    })
  })

  it('resolves legacy name-shaped slugs to canonical slug metadata', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { GET } = await import('@/app/api/collections/slug/[slug]/route')

    vi.mocked(prisma.collection.findFirst)
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce(null as never)
    vi.mocked(prisma.collection.findMany).mockResolvedValueOnce([
      {
        id: 'collection-1',
        slug: 'calm-essentials',
        name: 'Calm Essentials',
      },
    ] as never)
    vi.mocked(prisma.collection.findUnique).mockResolvedValueOnce(baseCollection as never)

    const request = createRequest('http://localhost/api/collections/slug/Calm%20Essentials')
    const response = await GET(request, { params: Promise.resolve({ slug: 'Calm Essentials' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.meta.resolvedSlug).toBe('calm-essentials')
    expect(body.meta.isCanonical).toBe(false)
  })

  it('returns 404 when no active collection can be resolved', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { GET } = await import('@/app/api/collections/slug/[slug]/route')

    vi.mocked(prisma.collection.findFirst)
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce(null as never)
    vi.mocked(prisma.collection.findMany).mockResolvedValueOnce([] as never)

    const request = createRequest('http://localhost/api/collections/slug/missing')
    const response = await GET(request, { params: Promise.resolve({ slug: 'missing' }) })

    expect(response.status).toBe(404)
    expect(prisma.collection.findUnique).not.toHaveBeenCalled()
  })
})
