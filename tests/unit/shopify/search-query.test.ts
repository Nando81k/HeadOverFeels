// tests/unit/shopify/search-query.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/shopify/client', () => ({ storefrontFetch: vi.fn() }))

import { storefrontFetch } from '@/lib/shopify/client'
import {
  RECOMMENDATIONS_QUERY,
  getRecommendations,
} from '@/lib/shopify/queries/recommendations'
import {
  PREDICTIVE_SEARCH_QUERY,
  SEARCH_QUERY,
  getPredictiveSearch,
  getSearchResults,
  normalizeSearchPage,
  toSearchSortArgs,
  type RawSearchPage,
  type SearchSort,
} from '@/lib/shopify/queries/search'
import predictiveSearchFixture from '@/tests/fixtures/shopify/predictive-search.json'
import recommendationsFixture from '@/tests/fixtures/shopify/recommendations.json'
import searchResultsFixture from '@/tests/fixtures/shopify/search-results.json'

const rawSearch = searchResultsFixture as unknown as RawSearchPage
const mocked = () => vi.mocked(storefrontFetch)

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

beforeEach(() => {
  mocked().mockReset()
})

describe('PREDICTIVE_SEARCH_QUERY', () => {
  it('is the validated document with one copy of each fragment', () => {
    expect(PREDICTIVE_SEARCH_QUERY).toContain('query PredictiveSearch($q: String!)')
    expect(PREDICTIVE_SEARCH_QUERY).toContain('predictiveSearch(query: $q, limit: 6, types: [PRODUCT, COLLECTION])')
    expect(occurrences(PREDICTIVE_SEARCH_QUERY, 'fragment ProductCardFields on Product')).toBe(1)
    expect(occurrences(PREDICTIVE_SEARCH_QUERY, 'fragment ImageFields on Image')).toBe(1)
    expect(occurrences(PREDICTIVE_SEARCH_QUERY, 'fragment MoneyFields on MoneyV2')).toBe(1)
  })
})

describe('getPredictiveSearch', () => {
  it.each(['', ' ', 'a', ' a '])('returns an empty suggestion without fetching for %o', async (q) => {
    await expect(getPredictiveSearch(q)).resolves.toEqual({ products: [], collections: [] })
    expect(mocked()).not.toHaveBeenCalled()
  })

  it('trims the query and fetches uncached with the search tag', async () => {
    mocked().mockResolvedValue(predictiveSearchFixture)

    const result = await getPredictiveSearch('  hoodie  ')

    const [query, opts] = mocked().mock.calls[0]
    expect(query).toBe(PREDICTIVE_SEARCH_QUERY)
    expect(opts).toMatchObject({ variables: { q: 'hoodie' }, tags: ['search'], revalidate: false })
    expect(result.products.map((p) => p.handle)).toEqual(['core-hoodie', 'drop-01-heavyweight-crew'])
    expect(result.products[0].price).toEqual({ amount: '88.0', currencyCode: 'USD' })
    expect(result.collections).toEqual([
      {
        id: 'gid://shopify/Collection/612345678904',
        handle: 'hoodies',
        title: 'Hoodies',
        image: null,
        description: null,
        featured: false,
      },
      {
        id: 'gid://shopify/Collection/612345678903',
        handle: 'drops',
        title: 'Drops',
        image: null,
        description: null,
        featured: false,
      },
    ])
  })

  it('returns an empty suggestion when predictiveSearch is null', async () => {
    mocked().mockResolvedValue({ predictiveSearch: null })
    await expect(getPredictiveSearch('hoodie')).resolves.toEqual({ products: [], collections: [] })
  })
})

describe('RECOMMENDATIONS_QUERY / getRecommendations', () => {
  it('is the validated document with one copy of each fragment', () => {
    expect(RECOMMENDATIONS_QUERY).toContain('query Recommendations($handle: String!)')
    expect(RECOMMENDATIONS_QUERY).toContain(
      'productRecommendations(productHandle: $handle, intent: COMPLEMENTARY)'
    )
    expect(occurrences(RECOMMENDATIONS_QUERY, 'fragment ProductCardFields on Product')).toBe(1)
    expect(occurrences(RECOMMENDATIONS_QUERY, 'fragment ImageFields on Image')).toBe(1)
    expect(occurrences(RECOMMENDATIONS_QUERY, 'fragment MoneyFields on MoneyV2')).toBe(1)
  })

  it('returns product cards tagged to the source product', async () => {
    mocked().mockResolvedValue(recommendationsFixture)

    const cards = await getRecommendations('core-hoodie')

    const [query, opts] = mocked().mock.calls[0]
    expect(query).toBe(RECOMMENDATIONS_QUERY)
    expect(opts).toMatchObject({
      variables: { handle: 'core-hoodie' },
      tags: ['product:core-hoodie'],
      revalidate: 300,
    })
    expect(cards.map((c) => c.handle)).toEqual([
      'signature-tee',
      'drop-01-heavyweight-crew',
      'box-logo-tee',
    ])
    expect(cards[0].badges).toEqual(['sale'])
  })

  it('returns an empty array when Shopify has no recommendations', async () => {
    mocked().mockResolvedValue({ productRecommendations: null })
    await expect(getRecommendations('core-hoodie')).resolves.toEqual([])
  })
})

describe('SEARCH_QUERY', () => {
  it('is the validated document with one copy of each fragment', () => {
    expect(SEARCH_QUERY).toContain(
      'query SearchProducts($q: String!, $first: Int!, $after: String, $filters: [ProductFilter!], $sortKey: SearchSortKeys, $reverse: Boolean)'
    )
    expect(SEARCH_QUERY).toContain(
      'search(query: $q, first: $first, after: $after, productFilters: $filters, sortKey: $sortKey, reverse: $reverse, types: [PRODUCT], unavailableProducts: LAST)'
    )
    expect(SEARCH_QUERY).toContain('totalCount')
    expect(SEARCH_QUERY).toContain('productFilters { id label type values { id label count input } }')
    expect(SEARCH_QUERY).toContain('nodes { ... on Product { ...ProductCardFields } }')
    expect(occurrences(SEARCH_QUERY, 'fragment ProductCardFields on Product')).toBe(1)
    expect(occurrences(SEARCH_QUERY, 'fragment ImageFields on Image')).toBe(1)
    expect(occurrences(SEARCH_QUERY, 'fragment MoneyFields on MoneyV2')).toBe(1)
  })
})

describe('toSearchSortArgs', () => {
  it('maps every search sort option to a Storefront sortKey/reverse pair', () => {
    expect(toSearchSortArgs('relevance')).toEqual({ sortKey: 'RELEVANCE', reverse: false })
    expect(toSearchSortArgs('price-asc')).toEqual({ sortKey: 'PRICE', reverse: false })
    expect(toSearchSortArgs('price-desc')).toEqual({ sortKey: 'PRICE', reverse: true })
  })

  it('falls back to relevance for a missing or unknown sort', () => {
    expect(toSearchSortArgs()).toEqual({ sortKey: 'RELEVANCE', reverse: false })
    expect(toSearchSortArgs('nonsense' as SearchSort)).toEqual({ sortKey: 'RELEVANCE', reverse: false })
  })
})

describe('normalizeSearchPage', () => {
  it('maps totalCount, nodes and pageInfo', () => {
    const page = normalizeSearchPage(rawSearch)

    expect(page.totalCount).toBe(3)
    expect(page.products.map((p) => p.handle)).toEqual([
      'core-hoodie',
      'drop-01-heavyweight-crew',
      'signature-tee',
    ])
    expect(page.products[0].price).toEqual({ amount: '88.0', currencyCode: 'USD' })
    expect(page.products[1].badges).toEqual(['drop', 'new'])
    expect(page.products[2].compareAtPrice).toEqual({ amount: '34.0', currencyCode: 'USD' })
    // No edges/nodes leak into the domain object.
    expect(page.products[0]).not.toHaveProperty('images')
    expect(page.pageInfo).toEqual({
      hasNextPage: false,
      endCursor: 'eyJsYXN0X2lkIjo4MTIzNDU2Nzg5MDE0LCJsYXN0X3ZhbHVlIjoiMyJ9',
    })
  })

  it('maps productFilters to filters, narrowing the type', () => {
    const page = normalizeSearchPage(rawSearch)

    expect(page.filters.map((f) => f.id)).toEqual([
      'filter.v.availability',
      'filter.v.price',
      'filter.v.option.size',
      'filter.v.option.color',
      'filter.p.product_type',
    ])
    expect(page.filters.map((f) => f.type)).toEqual(['LIST', 'PRICE_RANGE', 'LIST', 'LIST', 'LIST'])
    expect(page.filters[2].values[1]).toEqual({
      id: 'filter.v.option.size.m',
      label: 'M',
      count: 3,
      input: '{"variantOption":{"name":"size","value":"M"}}',
    })
    expect(page.filters[4].values[0].input).toBe('{"productType":"Hoodies"}')
  })

  it('falls back to LIST for an unknown filter type', () => {
    const weird: RawSearchPage = {
      search: {
        ...rawSearch.search!,
        productFilters: [{ id: 'f', label: 'F', type: 'SOMETHING_NEW', values: [] }],
      },
    }
    expect(normalizeSearchPage(weird).filters[0].type).toBe('LIST')
  })

  it('returns the empty page when search is null', () => {
    expect(normalizeSearchPage({ search: null })).toEqual({
      products: [],
      filters: [],
      pageInfo: { hasNextPage: false, endCursor: null },
      totalCount: 0,
    })
  })
})

describe('getSearchResults', () => {
  it.each(['', '   '])('returns the empty page without fetching for %o', async (q) => {
    await expect(getSearchResults({ q })).resolves.toEqual({
      products: [],
      filters: [],
      pageInfo: { hasNextPage: false, endCursor: null },
      totalCount: 0,
    })
    expect(mocked()).not.toHaveBeenCalled()
  })

  it('trims the query, defaults first to 24 and fetches uncached with the search tag', async () => {
    mocked().mockResolvedValue(rawSearch)

    const page = await getSearchResults({ q: '  hoodie  ' })

    const [query, opts] = mocked().mock.calls[0]
    expect(query).toBe(SEARCH_QUERY)
    expect(opts).toMatchObject({
      variables: {
        q: 'hoodie',
        first: 24,
        after: null,
        filters: null,
        sortKey: 'RELEVANCE',
        reverse: false,
      },
      tags: ['search'],
      revalidate: false,
    })
    expect(page.totalCount).toBe(3)
    expect(page.products).toHaveLength(3)
  })

  it('passes typed ProductFilter objects, the cursor and the sort through', async () => {
    mocked().mockResolvedValue(rawSearch)

    await getSearchResults({
      q: 'hoodie',
      first: 12,
      after: 'cursor-1',
      filters: [{ available: true }, { variantOption: { name: 'size', value: 'M' } }],
      sort: 'price-desc',
    })

    expect(mocked().mock.calls[0][1]).toMatchObject({
      variables: {
        q: 'hoodie',
        first: 12,
        after: 'cursor-1',
        filters: [{ available: true }, { variantOption: { name: 'size', value: 'M' } }],
        sortKey: 'PRICE',
        reverse: true,
      },
      tags: ['search'],
      revalidate: false,
    })
  })
})
