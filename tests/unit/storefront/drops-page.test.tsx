// tests/unit/storefront/drops-page.test.tsx — app/(storefront)/drops/page.tsx (Phase 5, Task 1)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/shopify/client', () => ({ storefrontFetch: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/lib/shopify/env', () => ({ hasShopifyEnv: vi.fn(() => true) }))
vi.mock('@/lib/shopify/queries', () => ({ getCollectionProducts: vi.fn() }))
vi.mock('next/image', async () => {
  const react = await import('react')
  return {
    default: (props: Record<string, unknown>) => {
      const { fill, priority, sizes, ...attrs } = props as Record<string, unknown> & {
        fill?: unknown
        priority?: unknown
        sizes?: unknown
      }
      void fill
      void priority
      void sizes
      return react.createElement('img', attrs)
    },
  }
})

import DropsPage from '@/app/(storefront)/drops/page'
import { hasShopifyEnv } from '@/lib/shopify/env'
import { getCollectionProducts } from '@/lib/shopify/queries'
import { normalizeCollectionPage, type RawCollectionPage } from '@/lib/shopify/queries/collection'
import type { ProductCardData } from '@/lib/shopify/types'
import collectionFixture from '@/tests/fixtures/shopify/collection-products.json'

const PRODUCTS = normalizeCollectionPage(collectionFixture.collection as unknown as RawCollectionPage).products

const envMock = vi.mocked(hasShopifyEnv)
const productsMock = vi.mocked(getCollectionProducts)

const future = new Date(Date.now() + 3 * 86_400_000).toISOString()
const past = new Date(Date.now() - 30 * 86_400_000).toISOString()

function withDrop(product: ProductCardData, handle: string, drop: ProductCardData['drop']): ProductCardData {
  return { ...product, id: `${product.id}-${handle}`, handle, drop }
}

function page(products: ProductCardData[]) {
  return { collection: { handle: 'drops' }, products, filters: [], pageInfo: { hasNextPage: false, endCursor: null } }
}

beforeEach(() => {
  vi.clearAllMocks()
  envMock.mockReturnValue(true)
})

afterEach(cleanup)

describe('app/(storefront)/drops', () => {
  it('renders the catalog notice when unconfigured', async () => {
    envMock.mockReturnValue(false)
    const { container } = render(await DropsPage())

    expect(container.querySelector('[data-catalog="unconfigured"]')).toBeInTheDocument()
    expect(productsMock).not.toHaveBeenCalled()
  })

  it('renders the empty state when the drops collection is empty or missing', async () => {
    productsMock.mockResolvedValue(null as never)
    render(await DropsPage())

    expect(screen.getByRole('status')).toHaveTextContent(/no drops scheduled/i)
    expect(screen.getByRole('link', { name: 'Join the newsletter' })).toHaveAttribute('href', '/#newsletter')
    expect(productsMock).toHaveBeenCalledWith({ handle: 'drops', first: 48 })
  })

  it('groups live, upcoming and past drops, with a countdown for the next one', async () => {
    productsMock.mockResolvedValue(
      page([
        withDrop(PRODUCTS[0], 'live-crew', { start: past, end: null }),
        withDrop(PRODUCTS[1], 'next-tee', { start: future, end: null }),
        withDrop(PRODUCTS[2], 'old-cap', { start: past, end: past }),
      ]) as never
    )
    const { container } = render(await DropsPage())

    const live = container.querySelector('[data-drop-group="drops-live"]') as HTMLElement
    expect(within(live).getByRole('heading', { name: 'Open now' })).toBeInTheDocument()
    expect(live.querySelectorAll('[data-product-handle]')).toHaveLength(1)
    expect(live.querySelector('[data-product-handle="live-crew"]')).toBeInTheDocument()

    const upcoming = container.querySelector('[data-drop-group="drops-upcoming"]') as HTMLElement
    expect(within(upcoming).getByRole('heading', { name: 'Next drops' })).toBeInTheDocument()
    expect(upcoming.querySelector('[data-product-handle="next-tee"]')).toBeInTheDocument()
    expect(upcoming.querySelector('[data-drop-status="upcoming"]')).toBeInTheDocument()
    expect(upcoming.querySelector('[data-drop-countdown]')).toBeInTheDocument()

    const ended = container.querySelector('[data-drop-group="drops-ended"]') as HTMLElement
    expect(ended.querySelector('[data-product-handle="old-cap"]')).toBeInTheDocument()
    expect(screen.getByText('Past drops (1)')).toBeInTheDocument()
  })

  it('shows only the live group when nothing is scheduled or past', async () => {
    productsMock.mockResolvedValue(page(PRODUCTS.slice(0, 2)) as never)
    const { container } = render(await DropsPage())

    expect(container.querySelector('[data-drop-group="drops-live"]')).toBeInTheDocument()
    expect(container.querySelector('[data-drop-group="drops-upcoming"]')).toBeNull()
    expect(container.querySelector('[data-drop-group="drops-ended"]')).toBeNull()
  })
})
