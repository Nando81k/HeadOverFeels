// tests/unit/storefront/pdp.test.tsx
import * as React from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// `lib/shopify/client` imports `server-only`, which throws outside a React
// Server environment.
vi.mock('server-only', () => ({}))

/** `next/image` needs a Next runtime; a plain `<img>` keeps the assertions honest. */
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
      return react.createElement('img', attrs)
    },
  }
})

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))

vi.mock('@/lib/shopify/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/shopify/env')>()),
  hasShopifyEnv: vi.fn(() => true),
}))

vi.mock('@/lib/shopify/queries/product', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/shopify/queries/product')>()),
  getProduct: vi.fn(),
}))

vi.mock('@/lib/shopify/queries/recommendations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/shopify/queries/recommendations')>()),
  getRecommendations: vi.fn(async () => []),
}))

import { hasShopifyEnv } from '@/lib/shopify/env'
import { toProductCard, type RawProductCard } from '@/lib/shopify/queries/fragments'
import { getProduct, normalizeProduct, type RawProductDetail } from '@/lib/shopify/queries/product'
import { getRecommendations } from '@/lib/shopify/queries/recommendations'
import type { ProductCardData, ProductDetail } from '@/lib/shopify/types'
import { AddToCartPanel } from '@/components/storefront/pdp/AddToCartPanel'
import { DetailsAccordion } from '@/components/storefront/pdp/DetailsAccordion'
import { Gallery } from '@/components/storefront/pdp/Gallery'
import { RecommendationsRail } from '@/components/storefront/pdp/RecommendationsRail'
import { StickyBuyBar } from '@/components/storefront/pdp/StickyBuyBar'
import { VariantSelector } from '@/components/storefront/pdp/VariantSelector'
import ProductPage, { generateMetadata } from '@/app/(storefront)/products/[handle]/page'
import DropPage, { generateMetadata as dropMetadata } from '@/app/(storefront)/drops/[handle]/page'
import collectionFixture from '@/tests/fixtures/shopify/collection-products.json'
import productFixture from '@/tests/fixtures/shopify/product-by-handle.json'

/** jsdom implements none of the `<dialog>` methods the overlay primitives use. */
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

const hasEnv = vi.mocked(hasShopifyEnv)
const fetchProduct = vi.mocked(getProduct)
const fetchRecommendations = vi.mocked(getRecommendations)

const product: ProductDetail = normalizeProduct(
  productFixture.product as unknown as RawProductDetail
)
const variant = (title: string) => {
  const found = product.variants.find((v) => v.title === title)
  if (!found) throw new Error(`fixture has no variant "${title}"`)
  return found
}
const blackM = variant('M / Black') // available, compare-at 110
const blackS = variant('S / Black') // sold out

const cards: ProductCardData[] = (
  collectionFixture.collection.products.nodes as unknown as RawProductCard[]
).map(toProductCard)

const PATHNAME = '/products/core-hoodie'

beforeEach(() => {
  vi.clearAllMocks()
  hasEnv.mockReturnValue(true)
  fetchProduct.mockResolvedValue(product)
  fetchRecommendations.mockResolvedValue([])
})

afterEach(() => {
  cleanup()
  document.body.className = ''
  document.body.style.overflow = ''
})

// ------------------------------------------------------------------- Gallery

describe('Gallery', () => {
  it('renders a thumb per image, the first one pressed', () => {
    render(<Gallery images={product.images} title={product.title} />)

    const thumbs = screen.getAllByRole('button', { name: /^show image/i })
    expect(thumbs).toHaveLength(product.images.length)
    expect(thumbs[0]).toHaveAttribute('aria-pressed', 'true')
    expect(thumbs[1]).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows the picked image in the main figure', async () => {
    const user = userEvent.setup()
    render(<Gallery images={product.images} title={product.title} />)

    await user.click(screen.getByRole('button', { name: 'Show image 3' }))

    expect(screen.getByRole('button', { name: 'Show image 3' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByAltText(product.images[2].altText!)).toBeInTheDocument()
  })

  it('cycles with the arrow keys and wraps around', () => {
    render(<Gallery images={product.images} title={product.title} />)
    const figure = screen.getByRole('group', { name: /core hoodie gallery/i })

    fireEvent.keyDown(figure, { key: 'ArrowRight' })
    expect(screen.getByRole('button', { name: 'Show image 2' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    fireEvent.keyDown(figure, { key: 'ArrowLeft' })
    fireEvent.keyDown(figure, { key: 'ArrowLeft' })
    expect(
      screen.getByRole('button', { name: `Show image ${product.images.length}` })
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('opens a dialog with the large image from the zoom button', async () => {
    const user = userEvent.setup()
    render(<Gallery images={product.images} title={product.title} />)

    await user.click(screen.getByRole('button', { name: /zoom image/i }))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('data-state', 'open')
    expect(within(dialog).getByAltText(product.images[0].altText!)).toBeInTheDocument()
  })

  it('renders a decorative placeholder when the product has no images', () => {
    const { container } = render(<Gallery images={[]} title="Core Hoodie" />)

    expect(screen.queryAllByRole('button')).toHaveLength(0)
    const placeholder = container.querySelector('[data-gallery="empty"]')
    expect(placeholder).toBeInTheDocument()
    expect(placeholder).toHaveAttribute('aria-hidden', 'true')
  })
})

// ----------------------------------------------------------- VariantSelector

describe('VariantSelector', () => {
  const selected = { Size: 'M', Color: 'Black' }

  it('renders a labelled group per option with the selected value', () => {
    render(
      <VariantSelector product={product} selectedOptions={selected} pathname={PATHNAME} />
    )

    expect(screen.getByText('Color — Black')).toBeInTheDocument()
    expect(screen.getByText('Size — M')).toBeInTheDocument()
  })

  it('renders colour swatches as links carrying the swatch colour', () => {
    render(
      <VariantSelector product={product} selectedOptions={selected} pathname={PATHNAME} />
    )

    const black = screen.getByRole('link', { name: 'Black' })
    expect(black).toHaveAttribute('aria-current', 'true')
    expect(black).toHaveStyle({ backgroundColor: '#1a1a1a' })

    const taupe = screen.getByRole('link', { name: 'Taupe' })
    expect(taupe).toHaveAttribute('href', '/products/core-hoodie?Size=M&Color=Taupe')
    expect(taupe).not.toHaveAttribute('aria-current')
  })

  it('falls back to the variant colour metafield when the option has no swatch', () => {
    // "Bone" has `swatch: null` in the fixture; `custom.color_hex` fills it in.
    render(
      <VariantSelector product={product} selectedOptions={selected} pathname={PATHNAME} />
    )

    expect(screen.getByRole('link', { name: 'Bone' })).toHaveStyle({
      backgroundColor: '#e8e2d9',
    })
  })

  it('renders size chips that keep the other selected options', () => {
    render(
      <VariantSelector product={product} selectedOptions={selected} pathname={PATHNAME} />
    )

    expect(screen.getByRole('link', { name: 'L' })).toHaveAttribute(
      'href',
      '/products/core-hoodie?Size=L&Color=Black'
    )
  })

  it('strikes through a sold-out combination but keeps it navigable', () => {
    render(
      <VariantSelector product={product} selectedOptions={selected} pathname={PATHNAME} />
    )

    // S / Black is the sold-out variant.
    const small = screen.getByRole('link', { name: 'S' })
    expect(small).toHaveAttribute('aria-disabled', 'true')
    expect(small).toHaveAttribute('data-availability', 'soldout')
    expect(small.className).toContain('line-through')
    expect(small).toHaveAttribute('href', '/products/core-hoodie?Size=S&Color=Black')
  })

  it('dims a combination no variant offers', () => {
    const trimmed: ProductDetail = {
      ...product,
      variants: product.variants.filter((v) => v.title !== 'XL / Black'),
    }
    render(
      <VariantSelector product={trimmed} selectedOptions={selected} pathname={PATHNAME} />
    )

    const xl = screen.getByRole('link', { name: 'XL' })
    expect(xl).toHaveAttribute('data-availability', 'unavailable')
    expect(xl).toHaveAttribute('aria-disabled', 'true')
  })
})

// ---------------------------------------------------------- AddToCartPanel

describe('AddToCartPanel', () => {
  it('shows the selected variant price and its compare-at', () => {
    render(<AddToCartPanel product={product} selected={blackM} complete />)

    expect(screen.getByText('$88.00')).toBeInTheDocument()
    expect(screen.getByText('$110.00')).toBeInTheDocument()
  })

  it('is disabled and flagged for Phase 3 without an action', () => {
    const { container } = render(<AddToCartPanel product={product} selected={blackM} complete />)

    const button = screen.getByRole('button', { name: /add to cart/i })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('data-phase', '3')
    expect(container.querySelector('form#buy-box')).toBeInTheDocument()
  })

  it('submits the selected variant and quantity once an action is wired', async () => {
    const user = userEvent.setup()
    const action = vi.fn()
    const { container } = render(
      <AddToCartPanel product={product} selected={blackM} complete action={action} />
    )

    const button = screen.getByRole('button', { name: /add to cart/i })
    expect(button).toBeEnabled()
    expect(button).not.toHaveAttribute('data-phase')
    const field = (name: string) =>
      container.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.value
    expect(field('variantId')).toBe(blackM.id)
    expect(field('quantity')).toBe('1')

    await user.click(screen.getByRole('button', { name: /increase quantity/i }))
    expect(field('quantity')).toBe('2')
  })

  it('renders a disabled sold-out button for an unavailable variant', () => {
    render(<AddToCartPanel product={product} selected={blackS} complete action={vi.fn()} />)

    const button = screen.getByRole('button', { name: /sold out/i })
    expect(button).toBeDisabled()
    expect(screen.queryByRole('button', { name: /add to cart/i })).not.toBeInTheDocument()
  })

  it('is disabled while the option selection is incomplete', () => {
    render(<AddToCartPanel product={product} selected={null} complete={false} action={vi.fn()} />)

    const button = screen.getByRole('button', { name: /add to cart/i })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('data-phase', '3')
  })

  it('shows the shipping and Care Points helper line', () => {
    const { container } = render(<AddToCartPanel product={product} selected={blackM} complete />)

    expect(container.querySelector('[data-buy-helper]')?.textContent).toBe(
      'Free US shipping over $75 · Earn 88 Care Points'
    )
  })

  it('caps the quantity at the variant stock', async () => {
    const user = userEvent.setup()
    render(<AddToCartPanel product={product} selected={variant('S / Taupe')} complete />)

    // quantityAvailable is 4.
    const stepper = screen.getByRole('group', { name: /quantity/i })
    const field = within(stepper).getByRole('textbox')
    expect(field).toHaveValue('1')

    const plus = screen.getByRole('button', { name: /increase quantity/i })
    for (let i = 0; i < 5; i += 1) await user.click(plus)

    expect(field).toHaveValue('4')
    expect(plus).toBeDisabled()
  })
})

// --------------------------------------------------------- DetailsAccordion

describe('DetailsAccordion', () => {
  it('opens the description and renders materials, care and shipping', () => {
    const { container } = render(<DetailsAccordion product={product} />)

    expect(screen.getByText('Description').closest('details')).toHaveAttribute('open')
    expect(screen.getByText(/400gsm brushed-back fleece/i)).toBeInTheDocument()
    expect(screen.getByText('Materials')).toBeInTheDocument()
    expect(screen.getByText('Care')).toBeInTheDocument()
    expect(screen.getByText(/shipping & returns/i)).toBeInTheDocument()
    expect(container.querySelector('a[href="/policies/shipping-policy"]')).toBeInTheDocument()
    expect(container.querySelector('a[href="/policies/refund-policy"]')).toBeInTheDocument()
  })

  it('omits the rows whose metafields are missing', () => {
    render(<DetailsAccordion product={{ ...product, materials: null, careGuide: null }} />)

    expect(screen.queryByText('Materials')).not.toBeInTheDocument()
    expect(screen.queryByText('Care')).not.toBeInTheDocument()
    expect(screen.getByText('Description')).toBeInTheDocument()
  })
})

// ------------------------------------------------------ RecommendationsRail

describe('RecommendationsRail', () => {
  it('renders at most four cards under the default heading', () => {
    const many = [...cards, ...cards].map((card, index) => ({
      ...card,
      id: `${card.id}-${index}`,
      handle: `${card.handle}-${index}`,
    }))

    const { container } = render(<RecommendationsRail products={many} />)

    expect(screen.getByRole('heading', { name: /complete the look/i })).toBeInTheDocument()
    expect(container.querySelectorAll('[data-product-handle]')).toHaveLength(4)
  })

  it('renders nothing without recommendations', () => {
    const { container } = render(<RecommendationsRail products={[]} />)

    expect(container).toBeEmptyDOMElement()
  })
})

// ------------------------------------------------------------ StickyBuyBar

describe('StickyBuyBar', () => {
  it('defaults to visible and is hidden from the desktop layout', () => {
    const { container } = render(
      <StickyBuyBar title={product.title} price={blackM.price} targetId="buy-box" />
    )

    const bar = container.querySelector('[data-sticky-buy-bar]')
    expect(bar).toHaveAttribute('data-state', 'visible')
    expect(bar?.className).toContain('md:hidden')
  })

  it('sends focus to the buy box button', async () => {
    const user = userEvent.setup()
    render(
      <>
        <AddToCartPanel product={product} selected={blackM} complete action={vi.fn()} />
        <StickyBuyBar title={product.title} price={blackM.price} targetId="buy-box" />
      </>
    )

    const [, sticky] = screen.getAllByRole('button', { name: /add to cart/i })
    await user.click(sticky)

    const [panelButton] = screen.getAllByRole('button', { name: /add to cart/i })
    expect(panelButton).toHaveFocus()
  })

  it('shows the sold-out state', () => {
    render(
      <StickyBuyBar title={product.title} price={blackS.price} soldOut targetId="buy-box" />
    )

    expect(screen.getByRole('button', { name: /sold out/i })).toBeDisabled()
  })
})

// -------------------------------------------------------------------- page

describe('app/(storefront)/products/[handle]', () => {
  const call = (handle = 'core-hoodie', sp: Record<string, string> = {}) =>
    ProductPage({ params: Promise.resolve({ handle }), searchParams: Promise.resolve(sp) })

  it('renders the catalog notice when the store has no Storefront credentials', async () => {
    hasEnv.mockReturnValue(false)

    const { container } = render(await call())

    expect(container.querySelector('[data-catalog="unconfigured"]')).toBeInTheDocument()
    expect(fetchProduct).not.toHaveBeenCalled()
  })

  it('calls notFound() for an unknown handle', async () => {
    fetchProduct.mockResolvedValue(null)

    await expect(call('nope')).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('renders the product, its gallery, breadcrumbs and JSON-LD', async () => {
    const { container } = render(await call())

    expect(screen.getByRole('heading', { level: 1, name: 'Core Hoodie' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^show image/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/collections/all')

    const scripts = container.querySelectorAll('script[type="application/ld+json"]')
    expect(scripts).toHaveLength(2)
    const payloads = Array.from(scripts).map((script) => script.innerHTML)
    expect(payloads.join(' ')).toContain('"@type":"Product"')
    expect(payloads.join(' ')).toContain('"@type":"BreadcrumbList"')
  })

  it('preselects the variant named in the URL', async () => {
    const { container } = render(await call('core-hoodie', { Size: 'L', Color: 'Bone' }))

    expect(container.querySelector<HTMLInputElement>('input[name="variantId"]')?.value).toBe(
      variant('L / Bone').id
    )
    expect(screen.getByText('Size — L')).toBeInTheDocument()
  })

  it('keeps the page up when recommendations fail, and renders them when they load', async () => {
    fetchRecommendations.mockRejectedValueOnce(new Error('boom'))
    render(await call())
    expect(screen.queryByRole('heading', { name: /complete the look/i })).not.toBeInTheDocument()

    cleanup()
    fetchRecommendations.mockResolvedValue(cards.slice(0, 2))
    render(await call())
    expect(screen.getByRole('heading', { name: /complete the look/i })).toBeInTheDocument()
  })

  it('builds metadata from the Shopify SEO overrides', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ handle: 'core-hoodie' }),
      searchParams: Promise.resolve({}),
    })

    expect(metadata.title).toBe('Core Hoodie — Head Over Feels')
    expect(metadata.description).toBe(
      'Heavyweight 400gsm fleece hoodie in Black, Taupe and Bone.'
    )
    expect(metadata.alternates?.canonical).toBe(
      'https://headoverfeels.com/products/core-hoodie'
    )
    expect(metadata.openGraph?.images).toBeTruthy()
    expect((metadata.twitter as { card?: string } | null)?.card).toBe('summary_large_image')
  })

  it('falls back to the title and the stripped description', async () => {
    fetchProduct.mockResolvedValue({
      ...product,
      seo: { title: null, description: null },
    })

    const metadata = await generateMetadata({
      params: Promise.resolve({ handle: 'core-hoodie' }),
      searchParams: Promise.resolve({}),
    })

    expect(metadata.title).toBe('Core Hoodie')
    expect(String(metadata.description)).not.toContain('<')
    expect(String(metadata.description).length).toBeLessThanOrEqual(160)
  })

  it('returns a not-found title for an unknown handle', async () => {
    fetchProduct.mockResolvedValue(null)

    const metadata = await generateMetadata({
      params: Promise.resolve({ handle: 'nope' }),
      searchParams: Promise.resolve({}),
    })

    expect(metadata.title).toBe('Not found')
  })
})

describe('app/(storefront)/drops/[handle]', () => {
  it('re-uses the PDP page and metadata', async () => {
    expect(DropPage).toBe(ProductPage)
    expect(dropMetadata).toBe(generateMetadata)

    render(
      await DropPage({
        params: Promise.resolve({ handle: 'core-hoodie' }),
        searchParams: Promise.resolve({}),
      })
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Core Hoodie' })).toBeInTheDocument()
  })
})
