// tests/unit/storefront/collections-index.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/shopify/client', () => ({ storefrontFetch: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
  redirect: vi.fn(),
}))

vi.mock('@/lib/shopify/env', () => ({ hasShopifyEnv: vi.fn(() => true) }))
vi.mock('@/lib/shopify/queries', () => ({
  getCollections: vi.fn(),
  getCollectionProducts: vi.fn(),
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

import { redirect } from 'next/navigation'
import { hasShopifyEnv } from '@/lib/shopify/env'
import { getCollectionProducts, getCollections } from '@/lib/shopify/queries'
import {
  normalizeCollectionPage,
  type RawCollectionPage,
} from '@/lib/shopify/queries/collection'
import {
  normalizeCollections,
  type RawCollectionSummary,
} from '@/lib/shopify/queries/collections'
import type { CollectionSummary } from '@/lib/shopify/types'
import collectionFixture from '@/tests/fixtures/shopify/collection-products.json'
import collectionsFixture from '@/tests/fixtures/shopify/collections.json'

import CollectionsIndexPage from '@/app/(storefront)/collections/page'
import ProductsAliasPage from '@/app/(storefront)/products/page'
import DropsPage from '@/app/(storefront)/drops/page'

const FIXTURE_COLLECTIONS = normalizeCollections(
  collectionsFixture.collections.nodes as unknown as RawCollectionSummary[]
)

/** Shopify's automatic theme collection; the fixture has no reason to carry it. */
const FRONTPAGE: CollectionSummary = {
  id: 'gid://shopify/Collection/612345678900',
  handle: 'frontpage',
  title: 'Home page',
  image: null,
  description: null,
  featured: false,
}

const COLLECTION_PAGE = normalizeCollectionPage(
  collectionFixture.collection as unknown as RawCollectionPage
)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(hasShopifyEnv).mockReturnValue(true)
  vi.mocked(getCollections).mockResolvedValue([FRONTPAGE, ...FIXTURE_COLLECTIONS])
  vi.mocked(getCollectionProducts).mockResolvedValue(COLLECTION_PAGE)
})

afterEach(() => {
  cleanup()
})

describe('app/(storefront)/collections', () => {
  it('renders a tile per collection, linked by handle, minus frontpage', async () => {
    const { container } = render(await CollectionsIndexPage())

    expect(screen.getByRole('heading', { level: 1, name: 'Collections' })).toBeInTheDocument()

    const tiles = container.querySelectorAll('[data-collection-handle]')
    expect(Array.from(tiles).map((tile) => tile.getAttribute('data-collection-handle'))).toEqual([
      'all',
      'best-sellers',
      'drops',
      'hoodies',
      'tees',
    ])
    expect(screen.queryByText('Home page')).not.toBeInTheDocument()

    expect(screen.getByRole('link', { name: /hoodies/i })).toHaveAttribute(
      'href',
      '/collections/hoodies'
    )
  })

  it('renders an empty state when Shopify returns nothing', async () => {
    vi.mocked(getCollections).mockResolvedValue([])

    render(await CollectionsIndexPage())

    expect(screen.getByRole('status')).toHaveTextContent(/no collections yet/i)
  })

  it('renders the unconfigured notice without fetching', async () => {
    vi.mocked(hasShopifyEnv).mockReturnValue(false)

    const { container } = render(await CollectionsIndexPage())

    expect(container.querySelector('[data-catalog="unconfigured"]')).not.toBeNull()
    expect(getCollections).not.toHaveBeenCalled()
  })
})

describe('app/(storefront)/products', () => {
  it('redirects to the catch-all collection', () => {
    ProductsAliasPage()
    expect(redirect).toHaveBeenCalledWith('/collections/all')
  })
})

describe('app/(storefront)/drops', () => {
  it('renders the drops header and a grid of the collection products', async () => {
    render(await DropsPage())

    expect(screen.getByRole('heading', { level: 1, name: 'Drops' })).toBeInTheDocument()
    expect(screen.getByText('Limited runs')).toBeInTheDocument()
    expect(getCollectionProducts).toHaveBeenCalledWith({ handle: 'drops', first: 24 })
    expect(screen.getAllByRole('article')).toHaveLength(COLLECTION_PAGE.products.length)
    expect(screen.queryByText(/no drops scheduled/i)).not.toBeInTheDocument()
  })

  it('renders the empty state when the collection has no products', async () => {
    vi.mocked(getCollectionProducts).mockResolvedValue({ ...COLLECTION_PAGE, products: [] })

    render(await DropsPage())

    expect(screen.getByRole('status')).toHaveTextContent(
      'No drops scheduled. Join the newsletter to hear first.'
    )
    expect(screen.getByRole('link', { name: /newsletter/i })).toHaveAttribute(
      'href',
      '/#newsletter'
    )
  })

  it('renders the empty state — not a 404 — when Shopify has no drops collection', async () => {
    vi.mocked(getCollectionProducts).mockResolvedValue(null)

    render(await DropsPage())

    expect(screen.getByRole('status')).toHaveTextContent(/no drops scheduled/i)
  })

  it('renders the unconfigured notice without fetching', async () => {
    vi.mocked(hasShopifyEnv).mockReturnValue(false)

    const { container } = render(await DropsPage())

    expect(container.querySelector('[data-catalog="unconfigured"]')).not.toBeNull()
    expect(getCollectionProducts).not.toHaveBeenCalled()
  })
})
