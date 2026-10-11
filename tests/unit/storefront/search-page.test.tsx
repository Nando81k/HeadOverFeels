// tests/unit/storefront/search-page.test.tsx
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/shopify/client', () => ({ storefrontFetch: vi.fn() }))

const getSearchResults = vi.fn()
vi.mock('@/lib/shopify/queries', () => ({
  getSearchResults: (args: unknown) => getSearchResults(args),
}))

const hasShopifyEnv = vi.fn(() => true)
vi.mock('@/lib/shopify/env', () => ({ hasShopifyEnv: () => hasShopifyEnv() }))

/**
 * Task 6 owns `components/storefront/collection`; its islands are stubbed to the
 * documented contract so this test covers the page's own wiring, not theirs.
 * `lib/storefront/plp-params` (also Task 6) is used for real — it is pure, and
 * it *is* the URL contract under test here.
 */
vi.mock('@/components/storefront/collection', () => ({
  PlpToolbar: (props: { total?: number | null; noun?: string; sort: string }) => (
    <div data-testid="plp-toolbar" data-noun={props.noun} data-sort={props.sort}>
      {props.total} {props.noun}
    </div>
  ),
  FilterRail: (props: { filters: { id: string }[] }) => (
    <div data-testid="filter-rail" data-count={props.filters.length} />
  ),
  ActiveFilters: (props: { active: { key: string }[] }) => (
    <div data-testid="active-filters" data-count={props.active.length} />
  ),
  LoadMoreGrid: (props: {
    initialProducts: { id: string; title: string }[]
    source: { kind: string; q?: string }
  }) => (
    <div data-testid="load-more-grid" data-kind={props.source.kind} data-q={props.source.q}>
      {props.initialProducts.map((product) => (
        <article key={product.id}>{product.title}</article>
      ))}
    </div>
  ),
}))

import searchFixture from '@/tests/fixtures/shopify/search-results.json'
import { normalizeSearchPage, type RawSearchPage } from '@/lib/shopify/queries/search'
import SearchPage, { generateMetadata } from '@/app/(storefront)/search/page'
import type { SearchPage as SearchPageData } from '@/lib/shopify/types'

const RESULTS: SearchPageData = normalizeSearchPage(searchFixture as unknown as RawSearchPage)

const EMPTY_RESULTS: SearchPageData = {
  products: [],
  filters: [],
  pageInfo: { hasNextPage: false, endCursor: null },
  totalCount: 0,
}

function props(sp: Record<string, string> = {}) {
  return { searchParams: Promise.resolve(sp) }
}

beforeEach(() => {
  vi.clearAllMocks()
  hasShopifyEnv.mockReturnValue(true)
  getSearchResults.mockResolvedValue(RESULTS)
})

afterEach(() => {
  cleanup()
})

describe('app/(storefront)/search — no query', () => {
  it('renders the search prompt form without touching Shopify', async () => {
    render(await SearchPage(props({})))

    expect(screen.getByRole('heading', { name: /search/i })).toBeInTheDocument()

    const form = screen.getByRole('search')
    expect(form).toHaveAttribute('action', '/search')
    expect(form).toHaveAttribute('method', 'get')

    const input = screen.getByLabelText(/search products/i)
    expect(input).toHaveAttribute('name', 'q')
    expect(input).toHaveAttribute('type', 'search')

    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument()
    expect(getSearchResults).not.toHaveBeenCalled()
  })

  it('treats a whitespace-only query as no query', async () => {
    render(await SearchPage(props({ q: '   ' })))

    expect(screen.getByRole('search')).toBeInTheDocument()
    expect(getSearchResults).not.toHaveBeenCalled()
  })
})

describe('app/(storefront)/search — results', () => {
  it('fetches the first page and renders the count, toolbar, rail and grid', async () => {
    const { container } = render(await SearchPage(props({ q: 'hoodie' })))

    expect(getSearchResults).toHaveBeenCalledWith({
      q: 'hoodie',
      first: 24,
      after: null,
      filters: [],
      sort: 'relevance',
    })

    expect(screen.getByRole('heading', { name: 'Search' })).toBeInTheDocument()

    const count = container.querySelector('.num')?.parentElement
    expect(count?.textContent).toBe('3 results for “hoodie”')
    expect(count).toHaveClass('text-ink-soft')

    expect(screen.getByTestId('plp-toolbar')).toHaveAttribute('data-noun', 'results')
    expect(screen.getByTestId('filter-rail')).toHaveAttribute(
      'data-count',
      String(RESULTS.filters.length)
    )
    expect(screen.getByTestId('active-filters')).toBeInTheDocument()

    const grid = screen.getByTestId('load-more-grid')
    expect(grid).toHaveAttribute('data-kind', 'search')
    expect(grid).toHaveAttribute('data-q', 'hoodie')
    expect(grid.querySelectorAll('article')).toHaveLength(RESULTS.products.length)
  })

  it('passes the cursor and sort from the URL through to the query', async () => {
    render(await SearchPage(props({ q: 'hoodie', sort: 'price-asc', after: 'cursor-1' })))

    expect(getSearchResults).toHaveBeenCalledWith({
      q: 'hoodie',
      first: 24,
      after: 'cursor-1',
      filters: [],
      sort: 'price-asc',
    })
    expect(screen.getByTestId('plp-toolbar')).toHaveAttribute('data-sort', 'price-asc')
  })

  it('says "1 result" when exactly one product matches', async () => {
    getSearchResults.mockResolvedValue({
      ...RESULTS,
      products: RESULTS.products.slice(0, 1),
      totalCount: 1,
    })

    const { container } = render(await SearchPage(props({ q: 'hoodie' })))

    expect(container.querySelector('.num')?.parentElement?.textContent).toBe(
      '1 result for “hoodie”'
    )
  })

  it('offers a way out when nothing matches', async () => {
    getSearchResults.mockResolvedValue(EMPTY_RESULTS)

    render(await SearchPage(props({ q: 'zzzz' })))

    const status = screen.getByRole('status')
    expect(status.textContent).toBe(
      'No results for “zzzz”. Try another search or browse all products.'
    )
    expect(screen.getByRole('link', { name: /shop all/i })).toHaveAttribute(
      'href',
      '/collections/all'
    )
    expect(screen.queryByTestId('load-more-grid')).not.toBeInTheDocument()
    expect(screen.queryByTestId('plp-toolbar')).not.toBeInTheDocument()
  })
})

describe('app/(storefront)/search — unconfigured store', () => {
  it('renders the catalog notice instead of searching', async () => {
    hasShopifyEnv.mockReturnValue(false)

    const { container } = render(await SearchPage(props({ q: 'hoodie' })))

    expect(container.querySelector('[data-catalog="unconfigured"]')).not.toBeNull()
    expect(getSearchResults).not.toHaveBeenCalled()
  })
})

describe('app/(storefront)/search — metadata', () => {
  it('never indexes results but keeps following links', async () => {
    await expect(generateMetadata(props({ q: 'hoodie' }))).resolves.toEqual({
      title: 'Search: hoodie',
      robots: { index: false, follow: true },
    })
  })

  it('falls back to a plain title with no query', async () => {
    await expect(generateMetadata(props({}))).resolves.toEqual({
      title: 'Search',
      robots: { index: false, follow: true },
    })
  })
})
