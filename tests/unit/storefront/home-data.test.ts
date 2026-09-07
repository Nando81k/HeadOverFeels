// tests/unit/storefront/home-data.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// `lib/shopify/queries/*` reaches `lib/shopify/client`, which imports
// `server-only` — a module that throws outside a React Server environment.
vi.mock('server-only', () => ({}))

// The composer is the unit under test; the four fetches it orchestrates are
// stubbed so the assertions are about composition, not about GraphQL.
vi.mock('@/lib/shopify/queries', () => ({
  getCollections: vi.fn(),
  getCollectionProducts: vi.fn(),
}))

import { getCollectionProducts, getCollections } from '@/lib/shopify/queries'
import { normalizeCollections, type RawCollectionSummary } from '@/lib/shopify/queries/collections'
import {
  normalizeCollectionPage,
  type RawCollectionPage,
} from '@/lib/shopify/queries/collection'
import { ShopifyError } from '@/lib/shopify/errors'
import type { CollectionPage, CollectionSummary } from '@/lib/shopify/types'
import { getHomeData } from '@/lib/storefront/home-data'
import collectionsFixture from '@/tests/fixtures/shopify/collections.json'
import collectionProductsFixture from '@/tests/fixtures/shopify/collection-products.json'

// ---------------------------------------------------------------- fixtures

const rawCollections = collectionsFixture.collections.nodes as unknown as RawCollectionSummary[]
const COLLECTIONS: CollectionSummary[] = normalizeCollections(rawCollections)

/** `all`, `best-sellers`, `drops`, `hoodies`, `tees` — the last three featured. */
const FEATURED_HANDLES = COLLECTIONS.filter((c) => c.featured).map((c) => c.handle)

const PAGE: CollectionPage = normalizeCollectionPage(
  collectionProductsFixture.collection as unknown as RawCollectionPage
)

/** A page carrying only the first `count` products of the fixture. */
function pageOf(count: number, handle = 'all'): CollectionPage {
  return {
    ...PAGE,
    collection: { ...PAGE.collection, handle },
    products: PAGE.products.slice(0, count),
  }
}

const collectionsMock = vi.mocked(getCollections)
const productsMock = vi.mocked(getCollectionProducts)

/**
 * Answers `getCollectionProducts` by handle+sort, so a test only states the
 * cases it cares about and everything else comes back as an empty page.
 */
function stubProducts(byHandle: Record<string, CollectionPage | null>) {
  productsMock.mockImplementation(async ({ handle, sort }) => {
    const key = sort === 'best-selling' ? `${handle}:best-selling` : handle
    if (key in byHandle) return byHandle[key]
    if (handle in byHandle) return byHandle[handle]
    return pageOf(0, handle)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  collectionsMock.mockResolvedValue(COLLECTIONS)
  stubProducts({})
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------- tests

describe('getHomeData', () => {
  it('composes the four home fetches with the documented arguments', async () => {
    stubProducts({ all: pageOf(4), 'best-sellers': pageOf(3), drops: pageOf(2) })

    const data = await getHomeData()

    expect(collectionsMock).toHaveBeenCalledTimes(1)
    expect(productsMock).toHaveBeenCalledWith({ handle: 'all', sort: 'newest', first: 8 })
    expect(productsMock).toHaveBeenCalledWith({ handle: 'best-sellers', first: 8 })
    expect(productsMock).toHaveBeenCalledWith({ handle: 'drops', first: 4 })
    expect(data.newIn).toHaveLength(4)
    expect(data.bestSellers).toHaveLength(3)
    expect(data.drops).toHaveLength(2)
  })

  it('runs the four fetches concurrently', async () => {
    let inFlight = 0
    let peak = 0
    const gate = async () => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await Promise.resolve()
      inFlight -= 1
    }
    collectionsMock.mockImplementation(async () => {
      await gate()
      return COLLECTIONS
    })
    productsMock.mockImplementation(async ({ handle }) => {
      await gate()
      return pageOf(1, handle)
    })

    await getHomeData()

    expect(peak).toBeGreaterThan(1)
  })

  it('keeps only featured collections, excluding `all` and `frontpage`', async () => {
    const withFeaturedAll = normalizeCollections([
      ...rawCollections.map((node) =>
        node.handle === 'all' ? { ...node, featured: { value: 'true' } } : node
      ),
      {
        id: 'gid://shopify/Collection/612345678999',
        handle: 'frontpage',
        title: 'Home page',
        description: null,
        image: null,
        featured: { value: 'true' },
      },
    ] as unknown as RawCollectionSummary[])
    collectionsMock.mockResolvedValue(withFeaturedAll)

    const data = await getHomeData()

    expect(data.featuredCollections.map((c) => c.handle)).toEqual(FEATURED_HANDLES)
    expect(data.featuredCollections.every((c) => c.featured)).toBe(true)
  })

  it('falls back to the first three non-`all`/`frontpage` collections when none are featured', async () => {
    collectionsMock.mockResolvedValue(
      COLLECTIONS.map((collection) => ({ ...collection, featured: false }))
    )

    const data = await getHomeData()

    expect(data.featuredCollections.map((c) => c.handle)).toEqual([
      'best-sellers',
      'drops',
      'hoodies',
    ])
  })

  it('returns no featured collections when the store has none to show', async () => {
    collectionsMock.mockResolvedValue([])

    const data = await getHomeData()

    expect(data.featuredCollections).toEqual([])
  })

  it('falls back to `all` sorted best-selling when the best-sellers collection is missing', async () => {
    stubProducts({
      all: pageOf(4),
      'all:best-selling': pageOf(2),
      'best-sellers': null,
    })

    const data = await getHomeData()

    expect(productsMock).toHaveBeenCalledWith({
      handle: 'all',
      sort: 'best-selling',
      first: 8,
    })
    expect(data.bestSellers).toHaveLength(2)
  })

  it('falls back to `all` sorted best-selling when the best-sellers collection is empty', async () => {
    stubProducts({
      all: pageOf(4),
      'all:best-selling': pageOf(3),
      'best-sellers': pageOf(0, 'best-sellers'),
    })

    const data = await getHomeData()

    expect(data.bestSellers).toHaveLength(3)
  })

  it('does not run the best-sellers fallback when the collection has products', async () => {
    stubProducts({ all: pageOf(4), 'best-sellers': pageOf(1, 'best-sellers') })

    await getHomeData()

    expect(productsMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'best-selling' })
    )
  })

  it('degrades a missing collection to an empty product list', async () => {
    stubProducts({ all: null, 'all:best-selling': null, 'best-sellers': null, drops: null })

    const data = await getHomeData()

    expect(data.newIn).toEqual([])
    expect(data.bestSellers).toEqual([])
    expect(data.drops).toEqual([])
  })

  it('propagates a Shopify failure instead of swallowing it', async () => {
    collectionsMock.mockRejectedValue(new ShopifyError('boom'))

    await expect(getHomeData()).rejects.toBeInstanceOf(ShopifyError)
  })
})
