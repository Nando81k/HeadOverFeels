// tests/unit/shopify/sitemap-query.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/shopify/client', () => ({ storefrontFetch: vi.fn() }))

import { storefrontFetch } from '@/lib/shopify/client'
import {
  SITEMAP_COLLECTIONS_QUERY,
  SITEMAP_PRODUCTS_QUERY,
  getSitemapEntries,
} from '@/lib/shopify/queries/sitemap'
import sitemapCollectionsFixture from '@/tests/fixtures/shopify/sitemap-collections.json'
import sitemapProductsFixture from '@/tests/fixtures/shopify/sitemap-products.json'

const mocked = () => vi.mocked(storefrontFetch)

/** Answers each call from the page list registered for that document. */
function respondByDocument(pages: Record<string, unknown[]>): void {
  const cursors: Record<string, number> = {}
  mocked().mockImplementation(async (query: string) => {
    const next = cursors[query] ?? 0
    cursors[query] = next + 1
    const page = pages[query]?.[next]
    if (!page) throw new Error(`unexpected extra fetch for document:\n${query}`)
    return page as never
  })
}

beforeEach(() => {
  mocked().mockReset()
})

describe('sitemap documents', () => {
  it('are the validated documents and carry no product-card fragments', () => {
    expect(SITEMAP_PRODUCTS_QUERY).toContain('query SitemapProducts($first: Int!, $after: String)')
    expect(SITEMAP_PRODUCTS_QUERY).toContain('products(first: $first, after: $after, sortKey: UPDATED_AT)')
    expect(SITEMAP_PRODUCTS_QUERY).toContain('pageInfo { hasNextPage endCursor }')
    expect(SITEMAP_PRODUCTS_QUERY).toContain('nodes { handle updatedAt }')
    expect(SITEMAP_PRODUCTS_QUERY).not.toContain('fragment')

    expect(SITEMAP_COLLECTIONS_QUERY).toContain(
      'query SitemapCollections($first: Int!, $after: String)'
    )
    expect(SITEMAP_COLLECTIONS_QUERY).toContain('collections(first: $first, after: $after)')
    expect(SITEMAP_COLLECTIONS_QUERY).toContain('nodes { handle updatedAt }')
    expect(SITEMAP_COLLECTIONS_QUERY).not.toContain('fragment')
  })
})

describe('getSitemapEntries', () => {
  it('reads one page of each connection with first: 250 and the catalog cache tags', async () => {
    respondByDocument({
      [SITEMAP_PRODUCTS_QUERY]: [sitemapProductsFixture],
      [SITEMAP_COLLECTIONS_QUERY]: [sitemapCollectionsFixture],
    })

    const entries = await getSitemapEntries()

    expect(mocked()).toHaveBeenCalledTimes(2)
    for (const [, opts] of mocked().mock.calls) {
      expect(opts).toMatchObject({
        variables: { first: 250, after: null },
        tags: ['collections', 'products'],
        revalidate: 3600,
      })
    }
    expect(entries.products).toEqual([
      { handle: 'core-hoodie', updatedAt: '2026-09-01T17:20:00Z' },
      { handle: 'drop-01-heavyweight-crew', updatedAt: '2026-09-02T17:20:00Z' },
      { handle: 'signature-tee', updatedAt: '2026-09-03T17:20:00Z' },
      { handle: 'box-logo-tee', updatedAt: '2026-09-04T17:20:00Z' },
    ])
    expect(entries.collections.map((c) => c.handle)).toEqual([
      'all',
      'best-sellers',
      'drops',
      'hoodies',
      'tees',
    ])
    expect(entries.collections[2]).toEqual({ handle: 'drops', updatedAt: '2026-09-02T09:00:00Z' })
  })

  it('follows hasNextPage until the last page and concatenates the nodes', async () => {
    respondByDocument({
      [SITEMAP_PRODUCTS_QUERY]: [
        {
          products: {
            pageInfo: { hasNextPage: true, endCursor: 'cursor-page-1' },
            nodes: [{ handle: 'core-hoodie', updatedAt: '2026-09-01T17:20:00Z' }],
          },
        },
        {
          products: {
            pageInfo: { hasNextPage: false, endCursor: 'cursor-page-2' },
            nodes: [{ handle: 'signature-tee', updatedAt: '2026-09-03T17:20:00Z' }],
          },
        },
      ],
      [SITEMAP_COLLECTIONS_QUERY]: [sitemapCollectionsFixture],
    })

    const entries = await getSitemapEntries()

    const productCalls = mocked().mock.calls.filter(([query]) => query === SITEMAP_PRODUCTS_QUERY)
    expect(productCalls).toHaveLength(2)
    expect(productCalls[0][1]).toMatchObject({ variables: { first: 250, after: null } })
    expect(productCalls[1][1]).toMatchObject({ variables: { first: 250, after: 'cursor-page-1' } })
    expect(entries.products.map((p) => p.handle)).toEqual(['core-hoodie', 'signature-tee'])
  })

  it('returns empty lists when the connections are null', async () => {
    respondByDocument({
      [SITEMAP_PRODUCTS_QUERY]: [{ products: null }],
      [SITEMAP_COLLECTIONS_QUERY]: [{ collections: null }],
    })

    await expect(getSitemapEntries()).resolves.toEqual({ products: [], collections: [] })
  })
})
