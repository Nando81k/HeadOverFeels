// tests/unit/storefront/product-card.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// `lib/shopify/queries/product` pulls in `lib/shopify/client`, which imports
// `server-only` — a module that throws outside a React Server environment.
vi.mock('server-only', () => ({}))

/**
 * `next/image` needs a Next runtime (image loader, `fill` layout styles). The
 * mock renders a plain `<img>` that forwards `src`, `alt` and every `data-*`
 * attribute the components rely on, and swallows the Next-only props so React
 * does not warn about unknown DOM attributes.
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
      return react.createElement('img', attrs)
    },
  }
})

import { toProductCard, type RawProductCard } from '@/lib/shopify/queries/fragments'
import { normalizeProduct, type RawProductDetail } from '@/lib/shopify/queries/product'
import type { ProductCardData } from '@/lib/shopify/types'
import { ProductCard, ProductCardSkeleton } from '@/components/storefront/product/ProductCard'
import { ProductGrid } from '@/components/storefront/product/ProductGrid'
import { SwatchDots } from '@/components/storefront/product/SwatchDots'
import collectionFixture from '@/tests/fixtures/shopify/collection-products.json'
import productFixture from '@/tests/fixtures/shopify/product-by-handle.json'

afterEach(cleanup)

// ---------------------------------------------------------------- fixtures

const rawCards = collectionFixture.collection.products.nodes as unknown as RawProductCard[]

/** Recorded fixture → the exact shape the components consume. */
const cards: ProductCardData[] = rawCards.map(toProductCard)

function cardByHandle(handle: string): ProductCardData {
  const found = cards.find((card) => card.handle === handle)
  if (!found) throw new Error(`fixture has no product "${handle}"`)
  return found
}

const hoodie = cardByHandle('core-hoodie') // 2 images, 3 colours, in stock
const tee = cardByHandle('signature-tee') // compare-at 34.00 > 24.00
const soldOut = cardByHandle('box-logo-tee') // availableForSale: false, 1 image

/** The PDP normaliser returns a superset of the card contract. */
const pdpCard: ProductCardData = normalizeProduct(
  productFixture.product as unknown as RawProductDetail
)

// ---------------------------------------------------------------- ProductCard

describe('ProductCard', () => {
  it('renders one link to /products/<handle> wrapping the image and the title', () => {
    render(<ProductCard product={hoodie} />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)

    const link = links[0]
    expect(link).toHaveAttribute('href', '/products/core-hoodie')
    expect(within(link).getByText('Core Hoodie')).toBeInTheDocument()
    expect(within(link).getAllByRole('img').length).toBeGreaterThan(0)
    expect(link).toHaveAccessibleName(/Core Hoodie/)
  })

  it('marks the article with the product handle and renders the primary image alt text', () => {
    const { container } = render(<ProductCard product={hoodie} />)

    expect(container.querySelector('[data-product-handle="core-hoodie"]')).not.toBeNull()
    expect(screen.getByAltText('Core Hoodie in Black, front')).toBeInTheDocument()
  })

  it('falls back to the title when the image has no alt text', () => {
    render(
      <ProductCard
        product={{ ...hoodie, image: { ...hoodie.image!, altText: null }, hoverImage: null }}
      />
    )

    expect(screen.getByAltText('Core Hoodie')).toBeInTheDocument()
  })

  it('renders the second image with data-hover, transparent until hover/focus', () => {
    const { container } = render(<ProductCard product={hoodie} />)

    const hover = container.querySelector('img[data-hover]')
    expect(hover).not.toBeNull()
    expect(hover).toHaveAttribute('src', hoodie.hoverImage!.url)

    const className = hover!.getAttribute('class') ?? ''
    // Hidden by default at every breakpoint — no `md:` prefix on the base state.
    expect(className.split(/\s+/)).toContain('opacity-0')
    expect(className).toContain('group-hover:opacity-100')
    expect(className).toContain('group-focus-within:opacity-100')
    expect(className).toContain('motion-reduce:transition-none')
  })

  it('renders no hover image when the product has only one image', () => {
    const { container } = render(<ProductCard product={soldOut} />)
    expect(container.querySelector('img[data-hover]')).toBeNull()
  })

  it('renders an aria-hidden placeholder instead of an image when there is none', () => {
    const { container } = render(
      <ProductCard product={{ ...hoodie, image: null, hoverImage: null }} />
    )

    expect(container.querySelectorAll('img')).toHaveLength(0)
    const placeholder = container.querySelector('[aria-hidden="true"].bg-line')
    expect(placeholder).not.toBeNull()
  })

  it('renders the formatted price, and a struck compare-at when the product is on sale', () => {
    const { container } = render(<ProductCard product={tee} />)

    expect(screen.getByText('$24.00')).toBeInTheDocument()
    const strike = container.querySelector('s')
    expect(strike).not.toBeNull()
    expect(strike?.textContent).toBe('$34.00')
  })

  it('renders no compare-at for a product that is not discounted', () => {
    const { container } = render(<ProductCard product={hoodie} />)
    expect(screen.getByText('$88.00')).toBeInTheDocument()
    expect(container.querySelector('s')).toBeNull()
  })

  it('renders a badge for every merchandising flag', () => {
    render(<ProductCard product={tee} />)
    expect(screen.getByText('Sale')).toBeInTheDocument()

    cleanup()
    render(<ProductCard product={cardByHandle('drop-01-heavyweight-crew')} />)
    expect(screen.getByText('Drop')).toBeInTheDocument()
    expect(screen.getByText('New')).toBeInTheDocument()
  })

  it('dims the image frame and marks it data-soldout for a sold-out product', () => {
    const { container } = render(<ProductCard product={soldOut} />)

    expect(screen.getByText('Sold out')).toBeInTheDocument()
    const frame = container.querySelector('[data-soldout]')
    expect(frame).not.toBeNull()
    expect(frame?.getAttribute('class')).toContain('opacity-60')
  })

  it('renders the colour swatches from the normalised product', () => {
    render(<ProductCard product={hoodie} />)

    const list = screen.getByRole('list', { name: 'Colours' })
    const dots = within(list).getAllByRole('listitem')
    expect(dots).toHaveLength(hoodie.swatches.length)
    expect(dots[0]).toHaveAttribute('title', 'Black')
  })

  it('accepts a PDP-normalised product unchanged', () => {
    render(<ProductCard product={pdpCard} />)

    expect(screen.getByRole('link')).toHaveAttribute('href', '/products/core-hoodie')
    expect(screen.getByText('Sale')).toBeInTheDocument()
  })

  it('renders no quick-add button without an onQuickAdd handler', () => {
    render(<ProductCard product={hoodie} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders a quick-add button labelled with the title and calls back with the product id', async () => {
    const onQuickAdd = vi.fn<(productId: string) => void>()
    const user = userEvent.setup()
    render(<ProductCard product={hoodie} onQuickAdd={onQuickAdd} />)

    const button = screen.getByRole('button', { name: 'Quick add Core Hoodie' })
    expect(button).toHaveTextContent('Quick add')
    await user.click(button)

    expect(onQuickAdd).toHaveBeenCalledTimes(1)
    expect(onQuickAdd).toHaveBeenCalledWith(hoodie.id)
  })

  it('keeps the quick-add button outside the link and revealed on pointer devices', () => {
    const { container } = render(<ProductCard product={hoodie} onQuickAdd={vi.fn()} />)

    const button = screen.getByRole('button', { name: 'Quick add Core Hoodie' })
    expect(container.querySelector('a')?.contains(button)).toBe(false)

    const className = button.getAttribute('class') ?? ''
    expect(className).toContain('md:opacity-0')
    expect(className).toContain('md:group-hover:opacity-100')
    expect(className).toContain('motion-reduce:transition-none')
  })

  it('renders no quick-add button for a sold-out product', () => {
    render(<ProductCard product={soldOut} onQuickAdd={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Quick add/ })).toBeNull()
  })
})

// ---------------------------------------------------------------- SwatchDots

describe('SwatchDots', () => {
  it('renders nothing when there are no swatches', () => {
    const { container } = render(<SwatchDots swatches={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('titles each dot with the colour name and paints it with the swatch colour', () => {
    const { container } = render(<SwatchDots swatches={hoodie.swatches} />)

    const dots = within(screen.getByRole('list', { name: 'Colours' })).getAllByRole('listitem')
    expect(dots.map((dot) => dot.getAttribute('title'))).toEqual(['Black', 'Taupe', 'Bone'])
    expect(dots[0]).toHaveStyle({ backgroundColor: hoodie.swatches[0].color! })
    // A colour without an admin swatch falls back to the neutral token.
    expect(dots[2]?.getAttribute('class')).toContain('bg-line')
    expect(container.querySelectorAll('li')).toHaveLength(3)
  })

  it('shows at most four dots and a "+N" overflow item', () => {
    const swatches = ['Black', 'Taupe', 'Bone', 'Rose', 'Olive', 'Slate'].map((name) => ({
      name,
      color: null,
    }))
    render(<SwatchDots swatches={swatches} />)

    const items = within(screen.getByRole('list', { name: 'Colours' })).getAllByRole('listitem')
    expect(items).toHaveLength(5)
    expect(items.filter((item) => item.hasAttribute('title'))).toHaveLength(4)
    expect(items[4]).toHaveTextContent('+2')
  })

  it('honours a custom max', () => {
    const swatches = ['Black', 'Taupe', 'Bone'].map((name) => ({ name, color: null }))
    render(<SwatchDots swatches={swatches} max={2} />)

    const items = within(screen.getByRole('list', { name: 'Colours' })).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[2]).toHaveTextContent('+1')
  })
})

// ---------------------------------------------------------------- ProductGrid

describe('ProductGrid', () => {
  it('renders one card per product', () => {
    const { container } = render(<ProductGrid products={cards} />)

    expect(container.querySelectorAll('[data-product-handle]')).toHaveLength(cards.length)
    expect(screen.getAllByRole('link')).toHaveLength(cards.length)
  })

  it('maps columns=4 to the responsive grid classes', () => {
    const { container } = render(<ProductGrid products={cards} />)
    const grid = container.querySelector('div.grid')
    const className = grid?.getAttribute('class') ?? ''

    expect(className).toContain('grid-cols-2')
    expect(className).toContain('md:grid-cols-3')
    expect(className).toContain('xl:grid-cols-4')
  })

  it('maps columns=2 and columns=3', () => {
    const { container, rerender } = render(<ProductGrid products={cards} columns={2} />)
    let className = container.querySelector('div.grid')?.getAttribute('class') ?? ''
    expect(className).toContain('grid-cols-2')
    expect(className).not.toContain('md:grid-cols-3')

    rerender(<ProductGrid products={cards} columns={3} />)
    className = container.querySelector('div.grid')?.getAttribute('class') ?? ''
    expect(className).toContain('md:grid-cols-3')
    expect(className).not.toContain('xl:grid-cols-4')
  })

  it('renders skeletonCount skeleton cards while loading, and no product cards', () => {
    const { container } = render(<ProductGrid products={cards} loading skeletonCount={6} />)

    expect(container.querySelectorAll('[data-product-card-skeleton]')).toHaveLength(6)
    expect(container.querySelectorAll('[data-product-handle]')).toHaveLength(0)
  })

  it('defaults to eight skeletons', () => {
    const { container } = render(<ProductGrid products={[]} loading />)
    expect(container.querySelectorAll('[data-product-card-skeleton]')).toHaveLength(8)
  })

  it('announces the empty state when there is nothing to show', () => {
    render(<ProductGrid products={[]} />)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Nothing here yet.')
    expect(status.getAttribute('class')).toContain('col-span-full')
  })

  it('accepts a custom empty message', () => {
    render(<ProductGrid products={[]} emptyMessage={<span>No matches for that filter.</span>} />)
    expect(screen.getByRole('status')).toHaveTextContent('No matches for that filter.')
  })

  it('does not render the empty state while loading', () => {
    render(<ProductGrid products={[]} loading />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('forwards onQuickAdd to every in-stock card', async () => {
    const onQuickAdd = vi.fn<(productId: string) => void>()
    const user = userEvent.setup()
    render(<ProductGrid products={cards} onQuickAdd={onQuickAdd} />)

    const buttons = screen.getAllByRole('button', { name: /^Quick add / })
    // Every product except the sold-out one gets a quick-add.
    expect(buttons).toHaveLength(cards.length - 1)

    await user.click(screen.getByRole('button', { name: 'Quick add Core Hoodie' }))
    expect(onQuickAdd).toHaveBeenCalledWith(hoodie.id)
  })
})

describe('ProductCardSkeleton', () => {
  it('renders an aspect-4/5 block plus two text bars, all decorative', () => {
    const { container } = render(<ProductCardSkeleton />)

    const skeletons = container.querySelectorAll('[data-skeleton]')
    expect(skeletons).toHaveLength(3)
    expect(skeletons[0].getAttribute('class')).toContain('aspect-[4/5]')
    expect(container.querySelector('[data-product-card-skeleton]')).not.toBeNull()
    skeletons.forEach((node) => expect(node).toHaveAttribute('aria-hidden', 'true'))
  })
})
