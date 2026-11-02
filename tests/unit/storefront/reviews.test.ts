// tests/unit/storefront/reviews.test.ts — lib/storefront/reviews.ts (Phase 5, Task 2)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { prisma, cache, bridge, orders } = vi.hoisted(() => ({
  prisma: {
    review: { groupBy: vi.fn(), findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    product: { findUnique: vi.fn() },
  },
  cache: { calls: [] as { keyParts?: string[]; options?: Record<string, unknown> }[] },
  bridge: { resolveCustomer: vi.fn() },
  orders: { getCustomerOrders: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ prisma }))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown, keyParts?: string[], options?: Record<string, unknown>) => {
    cache.calls.push({ keyParts, options })
    return fn
  },
}))
vi.mock('@/lib/loyalty/shopify-bridge', () => bridge)
vi.mock('@/lib/shopify/customer/queries', () => orders)

import type { CustomerSession } from '@/lib/shopify/customer/session'
import {
  authorDisplayName,
  createReview,
  EMPTY_SUMMARY,
  getHomeReviews,
  getReviewSummary,
  hasPurchased,
  listReviews,
  ReviewError,
  REVIEWS_REVALIDATE,
  reviewsTag,
  toReviewItem,
} from '@/lib/storefront/reviews'

const SESSION: CustomerSession = {
  tokens: { accessToken: 'token-1', refreshToken: 'rt', idToken: 'id', expiresAt: Date.now() + 3_600_000 },
  customerId: 'gid://shopify/Customer/1',
  email: 'nando@example.com',
  firstName: 'Nando',
  lastName: 'Rodriguez',
}

const row = (overrides: Partial<Parameters<typeof toReviewItem>[0]> = {}) => ({
  id: 'r1',
  rating: 5,
  title: 'Heavy in the best way',
  comment: 'The fleece is thick and the fit is honest. Sized up once and it was right.',
  customerName: 'Nando Rodriguez',
  isVerified: true,
  createdAt: new Date('2026-10-01T12:00:00Z'),
  adminReply: null,
  helpfulCount: 2,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  cache.calls.length = 0
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('authorDisplayName', () => {
  it('shortens to first name and last initial', () => {
    expect(authorDisplayName('Nando Rodriguez')).toBe('Nando R.')
    expect(authorDisplayName('nando')).toBe('Nando')
    expect(authorDisplayName('  ')).toBe('Customer')
    expect(authorDisplayName(null)).toBe('Customer')
  })
})

describe('toReviewItem', () => {
  it('maps the row and clamps the rating', () => {
    const item = toReviewItem(row({ rating: 9 }))
    expect(item).toMatchObject({ id: 'r1', rating: 5, authorName: 'Nando R.', isVerified: true, helpfulCount: 2 })
    expect(item.createdAt).toBe('2026-10-01T12:00:00.000Z')
  })
})

describe('getReviewSummary', () => {
  it('aggregates approved reviews by rating under a per-handle cache tag', async () => {
    prisma.review.groupBy.mockResolvedValue([
      { rating: 5, _count: { _all: 3 } },
      { rating: 4, _count: { _all: 1 } },
    ])
    const summary = await getReviewSummary('core-hoodie')
    expect(summary).toEqual({
      handle: 'core-hoodie',
      average: 4.75,
      count: 4,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 3 },
    })
    expect(prisma.review.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productHandle: 'core-hoodie', status: 'APPROVED' } })
    )
    expect(cache.calls[0]).toEqual({
      keyParts: ['reviews-summary', 'core-hoodie'],
      options: { revalidate: REVIEWS_REVALIDATE, tags: [reviewsTag('core-hoodie')] },
    })
  })

  it('returns the empty summary when the database is unreachable', async () => {
    prisma.review.groupBy.mockRejectedValue(new Error('ECONNREFUSED'))
    await expect(getReviewSummary('core-hoodie')).resolves.toEqual(EMPTY_SUMMARY('core-hoodie'))
    expect(console.warn).toHaveBeenCalled()
  })
})

describe('listReviews', () => {
  it('returns one page with a cursor when there are more', async () => {
    prisma.review.findMany.mockResolvedValue([row({ id: 'r1' }), row({ id: 'r2' }), row({ id: 'r3' })])
    prisma.review.count.mockResolvedValue(7)
    const page = await listReviews('core-hoodie', { limit: 2 })
    expect(page.items.map((item) => item.id)).toEqual(['r1', 'r2'])
    expect(page.nextCursor).toBe('r2')
    expect(page.total).toBe(7)
    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })
    )
    expect(cache.calls).toHaveLength(1)
  })

  it('serves later pages live (no cache) with the cursor skipped', async () => {
    prisma.review.findMany.mockResolvedValue([row({ id: 'r3' })])
    prisma.review.count.mockResolvedValue(3)
    const page = await listReviews('core-hoodie', { cursor: 'r2', limit: 2, sort: 'highest' })
    expect(page.nextCursor).toBeNull()
    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: 'r2' },
        skip: 1,
        orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      })
    )
    expect(cache.calls).toHaveLength(0)
  })

  it('degrades to an empty page on failure', async () => {
    prisma.review.findMany.mockRejectedValue(new Error('down'))
    prisma.review.count.mockResolvedValue(0)
    await expect(listReviews('core-hoodie')).resolves.toEqual({ items: [], nextCursor: null, total: 0 })
  })
})

describe('getHomeReviews', () => {
  it('returns approved 4★+ reviews with their product handle and name', async () => {
    prisma.review.findMany.mockResolvedValue([
      { ...row(), productHandle: 'core-hoodie', product: { name: 'Core Hoodie' } },
    ])
    const reviews = await getHomeReviews(3)
    expect(reviews[0]).toMatchObject({ id: 'r1', productHandle: 'core-hoodie', productTitle: 'Core Hoodie' })
    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'APPROVED', rating: { gte: 4 }, productHandle: { not: null } },
        take: 3,
      })
    )
  })

  it('returns [] when the database is unreachable (build-time home page)', async () => {
    prisma.review.findMany.mockRejectedValue(new Error('no db'))
    await expect(getHomeReviews()).resolves.toEqual([])
  })
})

describe('hasPurchased', () => {
  it('matches a line-item title across recent orders', async () => {
    orders.getCustomerOrders.mockResolvedValue({
      orders: [{ lineItems: [{ title: 'Core Hoodie' }, { title: 'Cap' }] }],
      hasNextPage: false,
      endCursor: null,
    })
    await expect(hasPurchased(SESSION, 'core hoodie')).resolves.toBe(true)
    await expect(hasPurchased(SESSION, 'Drop 01 Crew')).resolves.toBe(false)
    expect(orders.getCustomerOrders).toHaveBeenCalledWith('token-1', { first: 50 })
  })

  it('is false for a stale token or a failing orders call, without throwing', async () => {
    const stale = { ...SESSION, tokens: { ...SESSION.tokens, expiresAt: Date.now() - 1 } }
    await expect(hasPurchased(stale, 'Core Hoodie')).resolves.toBe(false)
    expect(orders.getCustomerOrders).not.toHaveBeenCalled()
    orders.getCustomerOrders.mockRejectedValue(new Error('401'))
    await expect(hasPurchased(SESSION, 'Core Hoodie')).resolves.toBe(false)
  })
})

describe('createReview', () => {
  beforeEach(() => {
    bridge.resolveCustomer.mockResolvedValue({ id: 'cust-1' })
    prisma.review.findFirst.mockResolvedValue(null)
    prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' })
    orders.getCustomerOrders.mockResolvedValue({ orders: [{ lineItems: [{ title: 'Core Hoodie' }] }] })
    prisma.review.create.mockResolvedValue({ id: 'r-new' })
  })

  it('writes a PENDING review keyed by handle, with the legacy product id and verified flag', async () => {
    const result = await createReview(
      { handle: 'core-hoodie', productTitle: 'Core Hoodie', rating: 5, title: ' Great ', comment: ' Thick fleece, honest fit. ' },
      SESSION
    )
    expect(result).toEqual({ id: 'r-new', status: 'PENDING', isVerified: true })
    expect(prisma.review.create).toHaveBeenCalledWith({
      data: {
        productHandle: 'core-hoodie',
        productId: 'prod-1',
        customerId: 'cust-1',
        rating: 5,
        title: 'Great',
        comment: 'Thick fleece, honest fit.',
        customerName: 'Nando Rodriguez',
        customerEmail: 'nando@example.com',
        isVerified: true,
        status: 'PENDING',
      },
      select: { id: true },
    })
  })

  it('stores a null product id when the handle has no Prisma product', async () => {
    prisma.product.findUnique.mockResolvedValue(null)
    await createReview({ handle: 'new-thing', productTitle: 'New Thing', rating: 4, comment: 'x'.repeat(20) }, SESSION)
    expect(prisma.review.create.mock.calls[0][0].data).toMatchObject({ productId: null, isVerified: false })
  })

  it('refuses a second review for the same product', async () => {
    prisma.review.findFirst.mockResolvedValue({ id: 'r-old' })
    await expect(
      createReview({ handle: 'core-hoodie', productTitle: 'Core Hoodie', rating: 3, comment: 'x'.repeat(20) }, SESSION)
    ).rejects.toMatchObject({ code: 'ALREADY_REVIEWED' })
    expect(prisma.review.create).not.toHaveBeenCalled()
  })

  it('ReviewError carries its code', () => {
    const error = new ReviewError('UNAVAILABLE', 'nope')
    expect(error).toBeInstanceOf(Error)
    expect(error.code).toBe('UNAVAILABLE')
  })
})
