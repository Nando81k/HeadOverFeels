// tests/unit/shopify/search-query.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/shopify/client', () => ({ storefrontFetch: vi.fn() }))

import { storefrontFetch } from '@/lib/shopify/client'
import {
  RECOMMENDATIONS_QUERY,
  getRecommendations,
} from '@/lib/shopify/queries/recommendations'
import { PREDICTIVE_SEARCH_QUERY, getPredictiveSearch } from '@/lib/shopify/queries/search'
import predictiveSearchFixture from '@/tests/fixtures/shopify/predictive-search.json'
import recommendationsFixture from '@/tests/fixtures/shopify/recommendations.json'

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
      { id: 'gid://shopify/Collection/612345678904', handle: 'hoodies', title: 'Hoodies', image: null },
      { id: 'gid://shopify/Collection/612345678903', handle: 'drops', title: 'Drops', image: null },
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
