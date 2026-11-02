// tests/unit/storefront/plp.test.tsx
import * as React from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/shopify/client', () => ({ storefrontFetch: vi.fn() }))

const push = vi.fn()
const NOT_FOUND = 'NEXT_NOT_FOUND'
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  notFound: () => {
    throw new Error(NOT_FOUND)
  },
  redirect: vi.fn(),
}))

vi.mock('@/lib/shopify/env', () => ({ hasShopifyEnv: vi.fn(() => true) }))
vi.mock('@/lib/shopify/queries', () => ({
  getCollectionProducts: vi.fn(),
  getCollections: vi.fn(),
}))
vi.mock('@/app/(storefront)/_actions/catalog', () => ({
  loadMoreCollectionProducts: vi.fn(),
  loadMoreSearchResults: vi.fn(),
}))

vi.mock('next/image', async () => {
  const react = await import('react')
  const nextOnly = new Set([
    'fill',
    'priority',
    'quality',
    'loader',
    'placeholder',
    'blurDataURL',
    'unoptimized',
    'loading',
    'sizes',
  ])
  return {
    default: (props: Record<string, unknown>) => {
      const attrs: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(props)) {
        if (!nextOnly.has(key)) attrs[key] = value
      }
      return react.createElement('img', attrs)
    },
  }
})

import {
  ActiveFilters,
  CollectionHeader,
  FilterRail,
  LoadMoreGrid,
  PlpToolbar,
  SortSelect,
} from '@/components/storefront/collection'
import { hasShopifyEnv } from '@/lib/shopify/env'
import { getCollectionProducts } from '@/lib/shopify/queries'
import {
  normalizeCollectionPage,
  type RawCollectionPage,
} from '@/lib/shopify/queries/collection'
import { SORT_OPTIONS, type PlpContext } from '@/lib/storefront/plp-params'
import type { ActiveFilter } from '@/lib/shopify/filters'
import type { CollectionPage } from '@/lib/shopify/types'
import collectionFixture from '@/tests/fixtures/shopify/collection-products.json'

import CollectionPageRoute from '@/app/(storefront)/collections/[handle]/page'

/** jsdom implements neither `showModal` nor `close` on `<dialog>`. */
beforeAll(() => {
  const proto = window.HTMLDialogElement.prototype
  if (typeof proto.showModal !== 'function') {
    proto.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
  }
  if (typeof proto.close !== 'function') {
    proto.close = function close(this: HTMLDialogElement) {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
  }
})

const PAGE: CollectionPage = normalizeCollectionPage(
  collectionFixture.collection as unknown as RawCollectionPage
)
const PATHNAME = '/collections/all'

function ctx(search = ''): PlpContext {
  return { pathname: PATHNAME, search }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(hasShopifyEnv).mockReturnValue(true)
  vi.mocked(getCollectionProducts).mockResolvedValue(PAGE)
})

afterEach(() => {
  cleanup()
  document.body.className = ''
  document.body.style.overflow = ''
})

/* --------------------------------------------------------------- FilterRail */

describe('FilterRail', () => {
  it('renders one group per Shopify filter, labelled and open', () => {
    const { container } = render(<FilterRail filters={PAGE.filters} active={[]} ctx={ctx()} />)

    const groups = container.querySelectorAll('[data-filter-group]')
    expect(groups).toHaveLength(PAGE.filters.length)
    expect(Array.from(groups).map((group) => group.getAttribute('data-filter-group'))).toEqual([
      'filter.v.availability',
      'filter.v.price',
      'filter.v.option.color',
      'filter.p.m.custom.featured',
    ])
    for (const group of groups) expect(group).toHaveAttribute('open')

    expect(screen.getByText('Availability')).toBeInTheDocument()
    expect(screen.getByText('Color')).toBeInTheDocument()
  })

  it('links each LIST value to its toggled URL and shows the count', () => {
    render(<FilterRail filters={PAGE.filters} active={[]} ctx={ctx('?sort=newest')} />)

    const black = screen.getByRole('link', { name: /black/i })
    expect(black).toHaveAttribute(
      'href',
      '/collections/all?sort=newest&filter.v.option.color=Black'
    )
    expect(within(black).getByText('3')).toBeInTheDocument()
    expect(black).not.toHaveAttribute('aria-current')
  })

  it('marks the applied value as current and links to its removal', () => {
    const active: ActiveFilter[] = [{ key: 'filter.v.option.color', value: 'Black' }]
    render(
      <FilterRail
        filters={PAGE.filters}
        active={active}
        ctx={ctx('?filter.v.option.color=Black')}
      />
    )

    const black = screen.getByRole('link', { name: /black/i })
    expect(black).toHaveAttribute('aria-current', 'true')
    expect(black).toHaveAttribute('href', '/collections/all')
  })

  it('drops the after cursor from every filter link', () => {
    render(<FilterRail filters={PAGE.filters} active={[]} ctx={ctx('?after=abc')} />)

    expect(screen.getByRole('link', { name: /in stock/i })).toHaveAttribute(
      'href',
      '/collections/all?filter.v.availability=1'
    )
  })

  it('renders the BOOLEAN filter as a single toggle link', () => {
    const { container } = render(<FilterRail filters={PAGE.filters} active={[]} ctx={ctx()} />)

    const group = container.querySelector('[data-filter-group="filter.p.m.custom.featured"]')
    expect(group).not.toBeNull()
    const links = group!.querySelectorAll('a')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute(
      'href',
      '/collections/all?filter.p.m.custom.featured=true'
    )
  })

  it('renders the price range as a GET form that preserves the other params', () => {
    const { container } = render(
      <FilterRail
        filters={PAGE.filters}
        active={[{ key: 'filter.v.price', value: '20-50' }]}
        ctx={ctx('?sort=newest&filter.v.option.color=Black&filter.v.price=20-50&after=abc')}
      />
    )

    const form = container.querySelector('form[data-filter-form="price"]') as HTMLFormElement
    expect(form).not.toBeNull()
    expect(form.getAttribute('method')).toBe('get')
    expect(form.getAttribute('action')).toBe(PATHNAME)

    const hidden = Array.from(form.querySelectorAll('input[type="hidden"]')).map((input) => [
      (input as HTMLInputElement).name,
      (input as HTMLInputElement).value,
    ])
    expect(hidden).toEqual([
      ['sort', 'newest'],
      ['filter.v.option.color', 'Black'],
    ])

    expect(screen.getByLabelText('Min')).toHaveValue(20)
    expect(screen.getByLabelText('Max')).toHaveValue(50)
    expect(within(form).getByRole('button', { name: /apply/i })).toHaveAttribute('type', 'submit')
  })

  it('renders nothing when Shopify returned no usable filters', () => {
    const { container } = render(<FilterRail filters={[]} active={[]} ctx={ctx()} />)
    expect(container).toBeEmptyDOMElement()
  })
})

/* ------------------------------------------------------------ ActiveFilters */

describe('ActiveFilters', () => {
  it('renders nothing when no filter is applied', () => {
    const { container } = render(<ActiveFilters filters={PAGE.filters} active={[]} ctx={ctx()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a removal chip per pair using the Shopify label, plus clear all', () => {
    const active: ActiveFilter[] = [
      { key: 'filter.v.option.color', value: 'Black' },
      { key: 'filter.v.availability', value: '1' },
    ]
    render(
      <ActiveFilters
        filters={PAGE.filters}
        active={active}
        ctx={ctx('?filter.v.option.color=Black&filter.v.availability=1&sort=newest')}
      />
    )

    const black = screen.getByRole('link', { name: /black/i })
    expect(black).toHaveAttribute(
      'href',
      '/collections/all?filter.v.availability=1&sort=newest'
    )
    expect(screen.getByRole('link', { name: /in stock/i })).toHaveAttribute(
      'href',
      '/collections/all?filter.v.option.color=Black&sort=newest'
    )
    expect(screen.getByRole('link', { name: /clear all/i })).toHaveAttribute(
      'href',
      '/collections/all?sort=newest'
    )
  })

  it('falls back to a readable range for a price pair with no matching value', () => {
    render(
      <ActiveFilters
        filters={PAGE.filters}
        active={[{ key: 'filter.v.price', value: '20-50' }]}
        ctx={ctx('?filter.v.price=20-50')}
      />
    )

    expect(screen.getByRole('link', { name: /20 – 50/ })).toHaveAttribute(
      'href',
      '/collections/all'
    )
  })
})

/* --------------------------------------------------------------- SortSelect */

describe('SortSelect', () => {
  it('navigates to the sorted href on change', async () => {
    const user = userEvent.setup()
    render(<SortSelect value="best-selling" options={SORT_OPTIONS} ctx={ctx('?after=abc')} />)

    const select = screen.getByLabelText('Sort')
    expect(select).toHaveValue('best-selling')

    await user.selectOptions(select, 'price-asc')

    expect(push).toHaveBeenCalledWith('/collections/all?sort=price-asc')
  })

  it('degrades to a GET form carrying the other params', () => {
    const { container } = render(
      <SortSelect
        value="newest"
        options={SORT_OPTIONS}
        ctx={ctx('?sort=newest&filter.p.tag=drop&after=abc')}
      />
    )

    const form = container.querySelector('form[data-sort-form]') as HTMLFormElement
    expect(form.getAttribute('method')).toBe('get')
    expect(form.getAttribute('action')).toBe(PATHNAME)

    const hidden = Array.from(form.querySelectorAll('input[type="hidden"]')).map((input) => [
      (input as HTMLInputElement).name,
      (input as HTMLInputElement).value,
    ])
    expect(hidden).toEqual([['filter.p.tag', 'drop']])
  })
})

/* --------------------------------------------------------------- PlpToolbar */

describe('PlpToolbar', () => {
  it('shows the result count with the given noun', () => {
    render(
      <PlpToolbar
        total={12}
        noun="results"
        sort="relevance"
        sortOptions={SORT_OPTIONS}
        ctx={ctx()}
        filters={PAGE.filters}
        active={[]}
      />
    )
    expect(screen.getByText('12 results')).toBeInTheDocument()
  })

  it('defaults the noun to products and singularises a count of one', () => {
    render(
      <PlpToolbar
        total={1}
        sort="best-selling"
        sortOptions={SORT_OPTIONS}
        ctx={ctx()}
        filters={PAGE.filters}
        active={[]}
      />
    )
    expect(screen.getByText('1 product')).toBeInTheDocument()
  })

  it('opens the filters drawer and closes it again from "Show results"', async () => {
    const user = userEvent.setup()
    render(
      <PlpToolbar
        sort="best-selling"
        sortOptions={SORT_OPTIONS}
        ctx={ctx()}
        filters={PAGE.filters}
        active={[]}
      />
    )

    const trigger = screen.getByRole('button', { name: /filters/i })
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')

    const dialog = document.querySelector('dialog') as HTMLDialogElement
    expect(dialog.hasAttribute('open')).toBe(false)

    await user.click(trigger)
    expect(dialog.hasAttribute('open')).toBe(true)
    expect(within(dialog).getByText('Filters')).toBeInTheDocument()
    expect(dialog.querySelector('[data-filter-rail]')).not.toBeNull()

    await user.click(within(dialog).getByRole('button', { name: /show results/i }))
    await waitFor(() => expect(dialog.hasAttribute('open')).toBe(false))
  })
})

/* ------------------------------------------------------------- LoadMoreGrid */

describe('LoadMoreGrid', () => {
  const half = PAGE.products.slice(0, 2)
  const rest = PAGE.products.slice(2)

  it('renders the first page and a Load more button while a cursor remains', () => {
    render(
      <LoadMoreGrid
        initialProducts={half}
        initialPageInfo={{ hasNextPage: true, endCursor: 'c1' }}
        source={{ kind: 'collection', handle: 'all', filters: [] }}
        loader={vi.fn()}
      />
    )

    expect(screen.getAllByRole('article')).toHaveLength(2)
    expect(screen.getByText('Showing 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument()
  })

  it('appends the next page from the injected loader and hides the button at the end', async () => {
    const user = userEvent.setup()
    let resolve: (slice: {
      products: typeof rest
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
    }) => void = () => {}
    const loader = vi.fn(
      (after: string) =>
        new Promise<{
          products: typeof rest
          pageInfo: { hasNextPage: boolean; endCursor: string | null }
        }>((res) => {
          expect(after).toBe('c1')
          resolve = res
        })
    )

    render(
      <LoadMoreGrid
        initialProducts={half}
        initialPageInfo={{ hasNextPage: true, endCursor: 'c1' }}
        source={{ kind: 'collection', handle: 'all', filters: [] }}
        loader={loader}
      />
    )

    await user.click(screen.getByRole('button', { name: /load more/i }))
    expect(loader).toHaveBeenCalledWith('c1')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /load more/i })).toHaveAttribute(
        'aria-busy',
        'true'
      )
    )

    resolve({ products: rest, pageInfo: { hasNextPage: false, endCursor: null } })

    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(4))
    expect(screen.getByText('Showing 4')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
  })

  it('shows no button when there is no next page', () => {
    render(
      <LoadMoreGrid
        initialProducts={half}
        initialPageInfo={{ hasNextPage: false, endCursor: null }}
        source={{ kind: 'collection', handle: 'all', filters: [] }}
      />
    )
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
  })

  it('renders the empty message instead of a caption when there are no products', () => {
    render(
      <LoadMoreGrid
        initialProducts={[]}
        initialPageInfo={{ hasNextPage: false, endCursor: null }}
        source={{ kind: 'collection', handle: 'all', filters: [] }}
        emptyMessage="Nothing matches those filters."
      />
    )
    expect(screen.getByRole('status')).toHaveTextContent('Nothing matches those filters.')
    expect(screen.queryByText(/showing/i)).not.toBeInTheDocument()
  })
})

/* --------------------------------------------------- CollectionHeader + page */

describe('CollectionHeader', () => {
  it('renders the eyebrow, title and description html', () => {
    render(
      <CollectionHeader
        title="Hoodies"
        eyebrow="Collection"
        descriptionHtml="<p>Heavyweight fleece.</p>"
        image={{ url: 'https://cdn.shopify.com/h.jpg', altText: 'Hoodies', width: 10, height: 5 }}
      />
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Hoodies' })).toBeInTheDocument()
    expect(screen.getByText('Collection')).toBeInTheDocument()
    expect(screen.getByText('Heavyweight fleece.')).toBeInTheDocument()
    expect(screen.getByAltText('Hoodies')).toBeInTheDocument()
  })

  it('omits the description block when Shopify has none', () => {
    const { container } = render(<CollectionHeader title="Tees" descriptionHtml="  " />)
    expect(container.querySelector('.prose-sf')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })
})

describe('app/(storefront)/collections/[handle]', () => {
  const route = (handle = 'all', sp: Record<string, string | string[] | undefined> = {}) =>
    CollectionPageRoute({ params: Promise.resolve({ handle }), searchParams: Promise.resolve(sp) })

  it('renders the notice instead of fetching when the store is unconfigured', async () => {
    vi.mocked(hasShopifyEnv).mockReturnValue(false)

    const { container } = render(await route())

    expect(container.querySelector('[data-catalog="unconfigured"]')).not.toBeNull()
    expect(getCollectionProducts).not.toHaveBeenCalled()
  })

  it('calls notFound() for a handle Shopify does not know', async () => {
    vi.mocked(getCollectionProducts).mockResolvedValue(null)
    await expect(route('nope')).rejects.toThrow(NOT_FOUND)
  })

  it('passes the parsed URL state to getCollectionProducts', async () => {
    render(
      await route('all', {
        sort: 'price-asc',
        after: 'cursor-1',
        'filter.v.option.color': 'Black',
      })
    )

    expect(getCollectionProducts).toHaveBeenCalledWith({
      handle: 'all',
      first: 24,
      after: 'cursor-1',
      sort: 'price-asc',
      filters: [{ variantOption: { name: 'color', value: 'Black' } }],
    })
  })

  it('renders the header, the desktop rail, the chips and the grid', async () => {
    const { container } = render(await route('all', { 'filter.v.option.color': 'Black' }))

    expect(screen.getByRole('heading', { level: 1, name: 'All Products' })).toBeInTheDocument()
    expect(screen.getByText('Everything currently in the Head Over Feels line.')).toBeInTheDocument()

    const aside = container.querySelector('aside')
    expect(aside).toHaveClass('hidden')
    expect(aside?.querySelector('[data-filter-rail]')).not.toBeNull()

    expect(container.querySelector('[data-active-filters]')).not.toBeNull()
    expect(screen.getAllByRole('article').length).toBeGreaterThanOrEqual(4)
    expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument()
  })
})
