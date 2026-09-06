// tests/unit/shopify/collection-query.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/shopify/client', () => ({ storefrontFetch: vi.fn() }))

import { storefrontFetch } from '@/lib/shopify/client'
import {
  COLLECTION_PRODUCTS_QUERY,
  getCollectionProducts,
  normalizeCollectionPage,
  toSortArgs,
  type RawCollectionPage,
} from '@/lib/shopify/queries/collection'
import {
  COLLECTIONS_QUERY,
  getCollections,
  normalizeCollections,
  type RawCollectionSummary,
} from '@/lib/shopify/queries/collections'
import collectionFixture from '@/tests/fixtures/shopify/collection-products.json'
import collectionsFixture from '@/tests/fixtures/shopify/collections.json'

const rawCollection = collectionFixture.collection as unknown as RawCollectionPage
const rawCollections = collectionsFixture.collections.nodes as unknown as RawCollectionSummary[]
const mocked = () => vi.mocked(storefrontFetch)

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

beforeEach(() => {
  mocked().mockReset()
})

describe('COLLECTION_PRODUCTS_QUERY', () => {
  it('is the validated document with one copy of each fragment', () => {
    expect(COLLECTION_PRODUCTS_QUERY).toContain('query CollectionProducts(')
    expect(COLLECTION_PRODUCTS_QUERY).toContain('$filters: [ProductFilter!]')
    expect(COLLECTION_PRODUCTS_QUERY).toContain('$sortKey: ProductCollectionSortKeys')
    expect(COLLECTION_PRODUCTS_QUERY).toContain('...ProductCardFields')
    expect(occurrences(COLLECTION_PRODUCTS_QUERY, 'fragment ImageFields on Image')).toBe(1)
    expect(occurrences(COLLECTION_PRODUCTS_QUERY, 'fragment MoneyFields on MoneyV2')).toBe(1)
    expect(occurrences(COLLECTION_PRODUCTS_QUERY, 'fragment ProductCardFields on Product')).toBe(1)
  })
})

describe('normalizeCollectionPage', () => {
  it('maps the collection summary and description', () => {
    const page = normalizeCollectionPage(rawCollection)
    expect(page.collection).toEqual({
      id: 'gid://shopify/Collection/612345678901',
      handle: 'all',
      title: 'All Products',
      descriptionHtml: '<p>Everything currently in the Head Over Feels line.</p>',
      image: {
        url: expect.stringContaining('collection-all.jpg'),
        altText: 'Head Over Feels, all products',
        width: 2400,
        height: 1200,
      },
    })
  })

  it('maps products through toProductCard', () => {
    const page = normalizeCollectionPage(rawCollection)
    expect(page.products.map((p) => p.handle)).toEqual([
      'core-hoodie',
      'drop-01-heavyweight-crew',
      'signature-tee',
      'box-logo-tee',
    ])
    // No edges/nodes leak into the domain object.
    expect(page.products[0]).not.toHaveProperty('images')
    expect(page.products[1].badges).toEqual(['drop', 'new'])
    expect(page.products[2].compareAtPrice).toEqual({ amount: '34.0', currencyCode: 'USD' })
    expect(page.products[2].badges).toEqual(['sale'])
    expect(page.products[3].badges).toEqual(['soldout'])
    expect(page.products[3].hoverImage).toBeNull()
  })

  it('narrows filter types to LIST, PRICE_RANGE and BOOLEAN', () => {
    const page = normalizeCollectionPage(rawCollection)
    expect(page.filters.map((f) => f.type)).toEqual(['LIST', 'PRICE_RANGE', 'LIST', 'BOOLEAN'])
    expect(page.filters[0]).toEqual({
      id: 'filter.v.availability',
      label: 'Availability',
      type: 'LIST',
      values: [
        { id: 'filter.v.availability.1', label: 'In stock', count: 3, input: '{"available":true}' },
        { id: 'filter.v.availability.0', label: 'Out of stock', count: 1, input: '{"available":false}' },
      ],
    })
  })

  it('falls back to LIST for an unknown filter type', () => {
    const weird: RawCollectionPage = {
      ...rawCollection,
      products: {
        ...rawCollection.products,
        filters: [{ id: 'f', label: 'F', type: 'SOMETHING_NEW', values: [] }],
      },
    }
    expect(normalizeCollectionPage(weird).filters[0].type).toBe('LIST')
  })

  it('maps pageInfo', () => {
    expect(normalizeCollectionPage(rawCollection).pageInfo).toEqual({
      hasNextPage: true,
      endCursor: 'eyJsYXN0X2lkIjo4MTIzNDU2Nzg5MDE1LCJsYXN0X3ZhbHVlIjoiNCJ9',
    })
  })
})

describe('toSortArgs', () => {
  it('maps every sort option to a Storefront sortKey/reverse pair', () => {
    expect(toSortArgs('best-selling')).toEqual({ sortKey: 'BEST_SELLING', reverse: false })
    expect(toSortArgs('newest')).toEqual({ sortKey: 'CREATED', reverse: true })
    expect(toSortArgs('price-asc')).toEqual({ sortKey: 'PRICE', reverse: false })
    expect(toSortArgs('price-desc')).toEqual({ sortKey: 'PRICE', reverse: true })
    expect(toSortArgs('title')).toEqual({ sortKey: 'TITLE', reverse: false })
    expect(toSortArgs()).toEqual({ sortKey: 'BEST_SELLING', reverse: false })
  })
})

describe('getCollectionProducts', () => {
  it('defaults first to 24 and tags the collection and the collections list', async () => {
    mocked().mockResolvedValue({ collection: rawCollection })

    const page = await getCollectionProducts({ handle: 'all' })

    const [query, opts] = mocked().mock.calls[0]
    expect(query).toBe(COLLECTION_PRODUCTS_QUERY)
    expect(opts).toMatchObject({
      variables: {
        handle: 'all',
        first: 24,
        after: null,
        filters: null,
        sortKey: 'BEST_SELLING',
        reverse: false,
      },
      tags: ['collections', 'collection:all'],
      revalidate: 300,
    })
    expect(page?.products).toHaveLength(4)
  })

  it('parses FilterValue.input JSON strings into ProductFilter objects', async () => {
    mocked().mockResolvedValue({ collection: rawCollection })

    await getCollectionProducts({
      handle: 'hoodies',
      first: 12,
      after: 'cursor-1',
      sort: 'price-desc',
      filters: ['{"available":true}', '{"variantOption":{"name":"color","value":"Black"}}'],
    })

    expect(mocked().mock.calls[0][1]).toMatchObject({
      variables: {
        handle: 'hoodies',
        first: 12,
        after: 'cursor-1',
        filters: [{ available: true }, { variantOption: { name: 'color', value: 'Black' } }],
        sortKey: 'PRICE',
        reverse: true,
      },
      tags: ['collections', 'collection:hoodies'],
    })
  })

  it('ignores filter strings that are not valid JSON objects', async () => {
    mocked().mockResolvedValue({ collection: rawCollection })

    await getCollectionProducts({ handle: 'all', filters: ['not json', '"a string"', '{"available":false}'] })

    expect(mocked().mock.calls[0][1]).toMatchObject({
      variables: { filters: [{ available: false }] },
    })
  })

  it('returns null when the collection does not exist', async () => {
    mocked().mockResolvedValue({ collection: null })
    await expect(getCollectionProducts({ handle: 'ghost' })).resolves.toBeNull()
  })
})

describe('COLLECTIONS_QUERY / getCollections', () => {
  it('is the validated document with one copy of ImageFields', () => {
    expect(COLLECTIONS_QUERY).toContain('query Collections($first: Int!)')
    expect(COLLECTIONS_QUERY).toContain('sortKey: TITLE')
    expect(occurrences(COLLECTIONS_QUERY, 'fragment ImageFields on Image')).toBe(1)
    expect(COLLECTIONS_QUERY).not.toContain('MoneyFields')
  })

  it('normalizes collection nodes', () => {
    const summaries = normalizeCollections(rawCollections)
    expect(summaries.map((c) => c.handle)).toEqual(['all', 'best-sellers', 'drops', 'hoodies', 'tees'])
    expect(summaries[1].image).toBeNull()
    expect(summaries[0].image?.url).toContain('collection-all.jpg')
  })

  it('fetches 50 collections by default with the collections cache tag', async () => {
    mocked().mockResolvedValue({ collections: { nodes: rawCollections } })

    const result = await getCollections()

    const [query, opts] = mocked().mock.calls[0]
    expect(query).toBe(COLLECTIONS_QUERY)
    expect(opts).toMatchObject({ variables: { first: 50 }, tags: ['collections'], revalidate: 300 })
    expect(result).toHaveLength(5)
  })

  it('honours an explicit page size', async () => {
    mocked().mockResolvedValue({ collections: { nodes: [] } })
    await expect(getCollections(4)).resolves.toEqual([])
    expect(mocked().mock.calls[0][1]).toMatchObject({ variables: { first: 4 } })
  })
})
