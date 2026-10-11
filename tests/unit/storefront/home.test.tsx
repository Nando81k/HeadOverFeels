// tests/unit/storefront/home.test.tsx
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'

// `lib/shopify/queries/*` reaches `lib/shopify/client`, which imports
// `server-only` — a module that throws outside a React Server environment.
vi.mock('server-only', () => ({}))

/**
 * `next/image` needs a Next runtime. The mock renders a plain `<img>` and
 * re-exposes the Next-only props the home sections rely on as `data-*` so the
 * tests can still assert on `priority`, `fill` and `sizes`.
 */
vi.mock('next/image', async () => {
  const react = await import('react')
  const nextOnly = new Set([
    'src',
    'alt',
    'fill',
    'priority',
    'sizes',
    'quality',
    'loader',
    'placeholder',
    'blurDataURL',
    'unoptimized',
    'loading',
  ])
  return {
    default: (props: Record<string, unknown>) => {
      const attrs: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(props)) {
        if (!nextOnly.has(key)) attrs[key] = value
      }
      attrs.src = typeof props.src === 'string' ? props.src : ''
      attrs.alt = typeof props.alt === 'string' ? props.alt : ''
      if (props.priority) attrs['data-priority'] = ''
      if (props.fill) attrs['data-fill'] = ''
      if (typeof props.sizes === 'string') attrs['data-sizes'] = props.sizes
      return react.createElement('img', attrs)
    },
  }
})

// The newsletter island defaults to the server action, which reaches Prisma.
vi.mock('@/app/(storefront)/_actions/newsletter', () => ({
  subscribeNewsletterAction: vi.fn(async () => ({ status: 'idle', message: '' })),
}))

vi.mock('@/lib/shopify/env', () => ({ hasShopifyEnv: vi.fn(() => true) }))
vi.mock('@/lib/storefront/home-data', () => ({ getHomeData: vi.fn() }))

import { CollectionTiles } from '@/components/storefront/home/CollectionTiles'
import { DropSpotlight } from '@/components/storefront/home/DropSpotlight'
import { Editorial } from '@/components/storefront/home/Editorial'
import { Hero, HERO_IMAGE } from '@/components/storefront/home/Hero'
import { NewsletterSection } from '@/components/storefront/home/NewsletterSection'
import { ProductRail } from '@/components/storefront/home/ProductRail'
import HomePage, { HOME_MARQUEE_DEFAULT, HOME_MARQUEE_DROP } from '@/app/(storefront)/page'
import { hasShopifyEnv } from '@/lib/shopify/env'
import { getHomeData, type HomeData } from '@/lib/storefront/home-data'
import {
  normalizeCollectionPage,
  type RawCollectionPage,
} from '@/lib/shopify/queries/collection'
import { normalizeCollections, type RawCollectionSummary } from '@/lib/shopify/queries/collections'
import collectionsFixture from '@/tests/fixtures/shopify/collections.json'
import collectionProductsFixture from '@/tests/fixtures/shopify/collection-products.json'

// ---------------------------------------------------------------- fixtures

const COLLECTIONS = normalizeCollections(
  collectionsFixture.collections.nodes as unknown as RawCollectionSummary[]
)
const FEATURED = COLLECTIONS.filter((collection) => collection.featured)
const PRODUCTS = normalizeCollectionPage(
  collectionProductsFixture.collection as unknown as RawCollectionPage
).products

const HOME_DATA: HomeData = {
  featuredCollections: FEATURED,
  newIn: PRODUCTS.slice(0, 3),
  bestSellers: PRODUCTS.slice(1, 3),
  drops: PRODUCTS.slice(0, 2),
}

const envMock = vi.mocked(hasShopifyEnv)
const homeDataMock = vi.mocked(getHomeData)

beforeEach(() => {
  vi.clearAllMocks()
  envMock.mockReturnValue(true)
  homeDataMock.mockResolvedValue(HOME_DATA)
})

afterEach(cleanup)

// ---------------------------------------------------------------- Hero

describe('Hero', () => {
  it('renders the eyebrow, the display headline and the signal word', () => {
    const { container } = render(<Hero />)

    expect(screen.getByText('Fall / Winter 26')).toBeInTheDocument()

    const heading = screen.getByRole('heading', { level: 1, name: /wear what you feel\./i })
    expect(heading).toHaveClass('font-display')

    const signal = container.querySelector('h1 .text-signal')
    expect(signal).not.toBeNull()
    expect(signal).toHaveTextContent('feel.')
  })

  it('renders the brand copy', () => {
    render(<Hero />)

    expect(
      screen.getByText(
        /heavyweight fleece, honest fits, small runs\. earn care points on every order\./i
      )
    ).toBeInTheDocument()
  })

  it('renders one signal CTA to /collections/all and an outline CTA to /drops', () => {
    render(<Hero />)

    const shop = screen.getByRole('link', { name: 'Shop new arrivals' })
    expect(shop).toHaveAttribute('href', '/collections/all')
    expect(shop.className).toContain('bg-signal')

    const drop = screen.getByRole('link', { name: 'Drop 01' })
    expect(drop).toHaveAttribute('href', '/drops')
    expect(drop.className).toContain('border-ink')
  })

  it('renders the default local hero asset as a priority fill image', () => {
    render(<Hero />)

    const image = screen.getByRole('img', { name: HERO_IMAGE.alt })
    expect(image).toHaveAttribute('src', HERO_IMAGE.src)
    expect(HERO_IMAGE.src.startsWith('/assets/')).toBe(true)
    expect(image).toHaveAttribute('data-priority')
    expect(image).toHaveAttribute('data-fill')
    expect(image).toHaveAttribute('data-sizes', '(min-width:1024px) 50vw, 100vw')
    expect(image).toHaveClass('object-cover')
  })

  it('accepts an image override', () => {
    render(<Hero image={{ src: '/assets/Tee_tops_collection.png', alt: 'Tees' }} />)

    expect(screen.getByRole('img', { name: 'Tees' })).toHaveAttribute(
      'src',
      '/assets/Tee_tops_collection.png'
    )
  })
})

// ------------------------------------------------------- CollectionTiles

describe('CollectionTiles', () => {
  it('renders at most three tiles linking to their collection', () => {
    render(<CollectionTiles collections={COLLECTIONS} />)

    const tiles = screen.getAllByRole('listitem')
    expect(tiles).toHaveLength(3)

    for (const [index, tile] of tiles.entries()) {
      const collection = COLLECTIONS[index]
      const link = within(tile).getByRole('link')
      expect(link).toHaveAttribute('href', `/collections/${collection.handle}`)
      expect(within(tile).getByText(collection.title)).toHaveClass('font-display')
    }
  })

  it('renders the section heading and the link to the collections index', () => {
    render(<CollectionTiles collections={FEATURED} />)

    expect(screen.getByRole('heading', { name: 'Collections' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'All' })).toHaveAttribute('href', '/collections')
  })

  it('falls back to a plain surface when a collection has no image', () => {
    const [first] = FEATURED
    render(<CollectionTiles collections={[{ ...first, image: null }]} />)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText(first.title)).toBeInTheDocument()
  })

  it('renders nothing when there are no collections', () => {
    const { container } = render(<CollectionTiles collections={[]} />)

    expect(container).toBeEmptyDOMElement()
  })
})

// ----------------------------------------------------------- ProductRail

describe('ProductRail', () => {
  it('renders the title, the shop-all link and a snapping scroll list', () => {
    const { container } = render(
      <ProductRail title="New in" href="/collections/all?sort=newest" products={PRODUCTS} />
    )

    expect(screen.getByRole('heading', { name: 'New in' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Shop all' })).toHaveAttribute(
      'href',
      '/collections/all?sort=newest'
    )

    // Scoped to the rail's own list: each `ProductCard` brings its own
    // colour-swatch `<ul>`, so a document-wide `listitem` query overcounts.
    const list = container.querySelector('ul')
    expect(list).not.toBeNull()
    expect(list).toHaveClass('overflow-x-auto', 'snap-x', 'snap-mandatory')

    const items = Array.from(list!.children)
    expect(items).toHaveLength(PRODUCTS.length)
    expect(items[0]).toHaveClass('snap-start', 'shrink-0')
  })

  it('renders one product card per product', () => {
    const { container } = render(
      <ProductRail title="Best sellers" href="/collections/best-sellers" products={PRODUCTS} />
    )

    expect(container.querySelectorAll('[data-product-handle]')).toHaveLength(PRODUCTS.length)
    expect(
      screen.getByRole('link', { name: new RegExp(PRODUCTS[0].title, 'i') })
    ).toHaveAttribute('href', `/products/${PRODUCTS[0].handle}`)
  })

  it('accepts a custom link label and an eyebrow', () => {
    render(
      <ProductRail
        title="Best sellers"
        href="/collections/best-sellers"
        hrefLabel="Shop best sellers"
        eyebrow="Most loved"
        products={PRODUCTS.slice(0, 1)}
      />
    )

    expect(screen.getByText('Most loved')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Shop best sellers' })).toBeInTheDocument()
  })

  it('renders nothing without products', () => {
    const { container } = render(
      <ProductRail title="New in" href="/collections/all" products={[]} />
    )

    expect(container).toBeEmptyDOMElement()
  })
})

// --------------------------------------------------------- DropSpotlight

describe('DropSpotlight', () => {
  it('renders the drop copy, the CTA and the products on a legible panel', () => {
    const { container } = render(<DropSpotlight products={PRODUCTS.slice(0, 2)} />)

    // `Drop` also appears as a product badge, so the eyebrow is read from the
    // block that owns the heading.
    const heading = screen.getByRole('heading', { name: 'Drop 01' })
    expect(within(heading.parentElement as HTMLElement).getByText('Drop')).toBeInTheDocument()
    expect(screen.getByText('Limited run. Early access for Gold.')).toBeInTheDocument()

    const cta = screen.getByRole('link', { name: 'See the drop' })
    expect(cta).toHaveAttribute('href', '/drops')
    expect(cta.className).toContain('bg-signal')

    expect(container.querySelectorAll('[data-product-handle]')).toHaveLength(2)
    expect(container.querySelector('[data-drop-panel]')).toHaveClass('bg-bone', 'text-ink')
  })

  it('renders nothing without products', () => {
    const { container } = render(<DropSpotlight products={[]} />)

    expect(container).toBeEmptyDOMElement()
  })
})

// ------------------------------------------------------------- Editorial

describe('Editorial', () => {
  it('renders the brand story split with an image and the about link', () => {
    render(<Editorial />)

    expect(screen.getByText('About')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Made in small runs' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Our story' })).toHaveAttribute('href', '/about')

    const image = screen.getByRole('img')
    expect(image.getAttribute('src')).toMatch(/^\/assets\//)
  })
})

// ------------------------------------------------------ NewsletterSection

describe('NewsletterSection', () => {
  it('renders the newsletter heading and the sign-up form', () => {
    const { container } = render(<NewsletterSection />)

    expect(container.querySelector('#newsletter')).not.toBeNull()
    expect(screen.getByText('Newsletter')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Get the drop first' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join' })).toBeInTheDocument()
  })
})

// ------------------------------------------------------------- home page

describe('app/(storefront)/page', () => {
  it('sets a 5 minute revalidate window', async () => {
    const mod = await import('@/app/(storefront)/page')

    expect(mod.revalidate).toBe(300)
    expect(mod.metadata.title).toEqual({ absolute: 'Head Over Feels — Premium streetwear' })
    expect(mod.metadata.description).toEqual(expect.stringMatching(/\w/))
  })

  it('renders the unconfigured notice, hero and newsletter without touching Shopify', async () => {
    envMock.mockReturnValue(false)

    const { container } = render(await HomePage())

    expect(homeDataMock).not.toHaveBeenCalled()
    expect(container.querySelector('[data-catalog="unconfigured"]')).not.toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: /wear what you feel\./i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Get the drop first' })).toBeInTheDocument()
    expect(screen.getAllByText(HOME_MARQUEE_DEFAULT).length).toBeGreaterThan(0)

    expect(screen.queryByRole('heading', { name: 'New in' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Best sellers' })).not.toBeInTheDocument()
    expect(container.querySelectorAll('[data-product-handle]')).toHaveLength(0)
  })

  it('renders the tiles, both rails and the drop spotlight when the store is configured', async () => {
    const { container } = render(await HomePage())

    expect(homeDataMock).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[data-catalog="unconfigured"]')).toBeNull()

    expect(screen.getByRole('heading', { name: 'Collections' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'All' })).toHaveAttribute('href', '/collections')
    expect(
      container.querySelector(`a[href="/collections/${FEATURED[0].handle}"]`)
    ).not.toBeNull()

    expect(screen.getByRole('heading', { name: 'New in' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Best sellers' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Drop 01' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Made in small runs' })).toBeInTheDocument()
  })

  it('switches the marquee to the drop copy when a drop is live', async () => {
    render(await HomePage())

    expect(screen.getAllByText(HOME_MARQUEE_DROP).length).toBeGreaterThan(0)
    expect(screen.queryByText(HOME_MARQUEE_DEFAULT)).not.toBeInTheDocument()
  })

  it('keeps the promo marquee and hides the spotlight when there is no drop', async () => {
    homeDataMock.mockResolvedValue({ ...HOME_DATA, drops: [] })

    render(await HomePage())

    expect(screen.getAllByText(HOME_MARQUEE_DEFAULT).length).toBeGreaterThan(0)
    expect(screen.queryByRole('heading', { name: 'Drop 01' })).not.toBeInTheDocument()
  })

  it('drops a rail whose collection came back empty', async () => {
    homeDataMock.mockResolvedValue({ ...HOME_DATA, bestSellers: [], featuredCollections: [] })

    render(await HomePage())

    expect(screen.getByRole('heading', { name: 'New in' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Best sellers' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Collections' })).not.toBeInTheDocument()
  })
})
