// tests/unit/storefront/pdp.test.tsx
import * as React from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

// `redirect` is a plain spy (the real one throws NEXT_REDIRECT, which React
// would report as an uncaught form-action error here); the no-JS test asserts it.
const redirect = vi.fn()
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  redirect: (...args: unknown[]) => redirect(...args),
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

/**
 * The cart context (T4). Each test sets `cartState.current` to a
 * `CartContextValue`-shaped fake, or `null` for "no provider".
 */
const cartState = vi.hoisted(() => ({
  current: null as import('@/components/storefront/cart/CartProvider').CartContextValue | null,
}))

vi.mock('@/components/storefront/cart/useCart', () => ({
  useCartOptional: () => cartState.current,
  useCart: () => {
    if (!cartState.current) throw new Error('useCart must be used inside <CartProvider>')
    return cartState.current
  },
}))

/** The page imports the Server Action for its no-JS form post. */
vi.mock('@/app/(storefront)/_actions/cart', () => ({
  addCartLineForm: vi.fn(async () => ({ ok: false, error: 'Cart unavailable' })),
}))

import { addCartLineForm } from '@/app/(storefront)/_actions/cart'
import type { CartContextValue } from '@/components/storefront/cart/CartProvider'
import { normalizeCart, type RawCart } from '@/lib/shopify/queries/cart'
import { FREE_SHIPPING_COPY } from '@/lib/storefront/shipping'
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
import cartFixture from '@/tests/fixtures/shopify/cart.json'

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

const liveCart = normalizeCart(cartFixture.cart as unknown as RawCart)
const submitForm = vi.mocked(addCartLineForm)

/** A `CartContextValue` with every method stubbed; `addLine` succeeds. */
function fakeCart(overrides: Partial<CartContextValue> = {}): CartContextValue {
  return {
    cart: liveCart,
    status: 'ready',
    count: liveCart.totalQuantity,
    open: false,
    openDrawer: vi.fn(),
    closeDrawer: vi.fn(),
    pending: false,
    pendingLineId: null,
    error: null,
    warning: null,
    clearMessages: vi.fn(),
    addLine: vi.fn(async () => ({ ok: true as const, cart: liveCart })),
    updateLine: vi.fn(async () => ({ ok: true as const, cart: liveCart })),
    removeLine: vi.fn(async () => ({ ok: true as const, cart: liveCart })),
    applyCode: vi.fn(async () => ({ ok: true as const, cart: liveCart })),
    removeCode: vi.fn(async () => ({ ok: true as const, cart: liveCart })),
    setNote: vi.fn(async () => ({ ok: true as const, cart: liveCart })),
    ...overrides,
  } as CartContextValue
}

/** A promise the test resolves by hand, to observe the pending state. */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

beforeEach(() => {
  vi.clearAllMocks()
  cartState.current = null
  hasEnv.mockReturnValue(true)
  fetchProduct.mockResolvedValue(product)
  fetchRecommendations.mockResolvedValue([])
})

afterEach(() => {
  vi.useRealTimers()
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
  const buyBox = (container: HTMLElement) =>
    container.querySelector<HTMLFormElement>('form#buy-box') as HTMLFormElement
  const addButton = () => screen.getByRole('button', { name: /add to cart|adding|added/i })

  it('shows the selected variant price and its compare-at', () => {
    render(<AddToCartPanel product={product} selected={blackM} complete />)

    expect(screen.getByText('$88.00')).toBeInTheDocument()
    expect(screen.getByText('$110.00')).toBeInTheDocument()
  })

  it('keeps the variant and quantity hidden inputs for the no-JS post', async () => {
    const user = userEvent.setup()
    cartState.current = fakeCart()
    const { container } = render(
      <AddToCartPanel product={product} selected={blackM} complete action={vi.fn()} />
    )

    const field = (name: string) =>
      container.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.value
    expect(field('variantId')).toBe(blackM.id)
    expect(field('quantity')).toBe('1')

    await user.click(screen.getByRole('button', { name: /increase quantity/i }))
    expect(field('quantity')).toBe('2')
  })

  it('adds through the cart provider and prevents the native form post', async () => {
    const user = userEvent.setup()
    const cart = fakeCart()
    cartState.current = cart
    const action = vi.fn()
    render(<AddToCartPanel product={product} selected={blackM} complete action={action} />)

    const button = addButton()
    expect(button).toBeEnabled()
    expect(button).not.toHaveAttribute('data-phase')

    await user.click(screen.getByRole('button', { name: /increase quantity/i }))
    await user.click(button)

    expect(cart.addLine).toHaveBeenCalledTimes(1)
    expect(cart.addLine).toHaveBeenCalledWith({ variantId: blackM.id, quantity: 2 })
    await screen.findByRole('button', { name: /added/i })
    expect(action).not.toHaveBeenCalled()
  })

  it('is disabled and flagged unconfigured when the cart is unavailable', () => {
    cartState.current = fakeCart({ status: 'unavailable' })
    render(<AddToCartPanel product={product} selected={blackM} complete action={vi.fn()} />)

    const button = addButton()
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('data-phase', 'unconfigured')
  })

  it('is disabled and flagged unconfigured with neither a provider nor an action', () => {
    const { container } = render(<AddToCartPanel product={product} selected={blackM} complete />)

    const button = addButton()
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('data-phase', 'unconfigured')
    expect(buyBox(container)).toBeInTheDocument()
  })

  it('posts the form to the action when there is no provider', async () => {
    const action = vi.fn()
    const { container } = render(
      <AddToCartPanel product={product} selected={blackM} complete action={action} />
    )

    expect(addButton()).toBeEnabled()
    expect(addButton()).not.toHaveAttribute('data-phase')
    fireEvent.submit(buyBox(container))

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    const formData = action.mock.calls[0]?.[0] as FormData
    expect(formData.get('variantId')).toBe(blackM.id)
    expect(formData.get('quantity')).toBe('1')
  })

  it('shows "Adding…" with aria-busy while the add is in flight', async () => {
    const pending = deferred<Awaited<ReturnType<CartContextValue['addLine']>>>()
    const cart = fakeCart({ addLine: vi.fn(() => pending.promise) })
    cartState.current = cart
    const { container } = render(<AddToCartPanel product={product} selected={blackM} complete />)

    fireEvent.submit(buyBox(container))

    const button = screen.getByRole('button', { name: /adding…/i })
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toBeDisabled()

    // A second submit while adding is ignored.
    fireEvent.submit(buyBox(container))
    expect(cart.addLine).toHaveBeenCalledTimes(1)

    await act(async () => pending.resolve({ ok: true, cart: liveCart }))
    expect(screen.getByRole('button', { name: /added/i })).not.toHaveAttribute('aria-busy')
  })

  it('reads "Added ✓" for two seconds after a successful add', async () => {
    vi.useFakeTimers()
    cartState.current = fakeCart()
    const { container } = render(<AddToCartPanel product={product} selected={blackM} complete />)

    await act(async () => {
      fireEvent.submit(buyBox(container))
    })
    expect(addButton()).toHaveTextContent('Added ✓')

    act(() => vi.advanceTimersByTime(1999))
    expect(addButton()).toHaveTextContent('Added ✓')

    act(() => vi.advanceTimersByTime(1))
    expect(addButton()).toHaveTextContent('Add to cart')
  })

  it('clears the "Added" timer on unmount', async () => {
    vi.useFakeTimers()
    cartState.current = fakeCart()
    const { container, unmount } = render(
      <AddToCartPanel product={product} selected={blackM} complete />
    )

    await act(async () => {
      fireEvent.submit(buyBox(container))
    })
    expect(vi.getTimerCount()).toBeGreaterThan(0)

    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('renders the add error as an alert and dismisses it on the next submit', async () => {
    const cart = fakeCart({
      addLine: vi.fn(async () => ({ ok: false as const, error: 'Only 2 left in stock.' })),
    })
    cartState.current = cart
    const { container } = render(<AddToCartPanel product={product} selected={blackM} complete />)

    await act(async () => {
      fireEvent.submit(buyBox(container))
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Only 2 left in stock.')
    expect(addButton()).toHaveTextContent('Add to cart')

    const next = deferred<Awaited<ReturnType<CartContextValue['addLine']>>>()
    vi.mocked(cart.addLine).mockImplementationOnce(() => next.promise)
    fireEvent.submit(buyBox(container))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await act(async () => next.resolve({ ok: true, cart: liveCart }))
  })

  it('renders a disabled sold-out button for an unavailable variant', () => {
    const cart = fakeCart()
    cartState.current = cart
    const { container } = render(
      <AddToCartPanel product={product} selected={blackS} complete action={vi.fn()} />
    )

    const button = screen.getByRole('button', { name: /sold out/i })
    expect(button).toBeDisabled()
    expect(button).not.toHaveAttribute('data-phase')
    expect(screen.queryByRole('button', { name: /add to cart/i })).not.toBeInTheDocument()

    fireEvent.submit(buyBox(container))
    expect(cart.addLine).not.toHaveBeenCalled()
  })

  it('is disabled while the option selection is incomplete', () => {
    const cart = fakeCart()
    cartState.current = cart
    const { container } = render(
      <AddToCartPanel product={product} selected={null} complete={false} action={vi.fn()} />
    )

    const button = screen.getByRole('button', { name: /add to cart/i })
    expect(button).toBeDisabled()
    expect(button).not.toHaveAttribute('data-phase')

    fireEvent.submit(buyBox(container))
    expect(cart.addLine).not.toHaveBeenCalled()
  })

  it('shows the shipping and Care Points helper line', () => {
    const { container } = render(<AddToCartPanel product={product} selected={blackM} complete />)

    expect(container.querySelector('[data-buy-helper]')?.textContent).toBe(
      `${FREE_SHIPPING_COPY} · Earn 88 Care Points`
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
    expect(container.textContent).toContain(FREE_SHIPPING_COPY)
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
  const stickyButton = (container: HTMLElement) => {
    const bar = container.querySelector<HTMLElement>('[data-sticky-buy-bar]') as HTMLElement
    return within(bar).getByRole('button')
  }

  it('defaults to visible and is hidden from the desktop layout', () => {
    const { container } = render(
      <StickyBuyBar title={product.title} price={blackM.price} targetId="buy-box" />
    )

    const bar = container.querySelector('[data-sticky-buy-bar]')
    expect(bar).toHaveAttribute('data-state', 'visible')
    expect(bar?.className).toContain('md:hidden')
  })

  it('submits the buy-box form with requestSubmit', async () => {
    const user = userEvent.setup()
    const cart = fakeCart()
    cartState.current = cart
    const { container } = render(
      <>
        <AddToCartPanel product={product} selected={blackM} complete action={vi.fn()} />
        <StickyBuyBar title={product.title} price={blackM.price} targetId="buy-box" />
      </>
    )

    const form = container.querySelector<HTMLFormElement>('form#buy-box') as HTMLFormElement
    const requestSubmit = vi.spyOn(form, 'requestSubmit')

    await user.click(stickyButton(container))

    expect(requestSubmit).toHaveBeenCalledTimes(1)
    expect(cart.addLine).toHaveBeenCalledWith({ variantId: blackM.id, quantity: 1 })
  })

  it('falls back to focusing the buy box when the target is not a form', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <>
        <div id="buy-box">
          <button type="submit">Buy box button</button>
        </div>
        <StickyBuyBar title={product.title} price={blackM.price} targetId="buy-box" />
      </>
    )

    await user.click(stickyButton(container))

    expect(screen.getByRole('button', { name: 'Buy box button' })).toHaveFocus()
  })

  it('mirrors the pending, added and unavailable props', () => {
    const { container, rerender } = render(
      <StickyBuyBar title={product.title} price={blackM.price} targetId="buy-box" pending />
    )
    expect(stickyButton(container)).toHaveTextContent('Adding…')
    expect(stickyButton(container)).toHaveAttribute('aria-busy', 'true')

    rerender(<StickyBuyBar title={product.title} price={blackM.price} targetId="buy-box" added />)
    expect(stickyButton(container)).toHaveTextContent('Added ✓')

    rerender(
      <StickyBuyBar title={product.title} price={blackM.price} targetId="buy-box" unavailable />
    )
    expect(stickyButton(container)).toBeDisabled()
    expect(stickyButton(container)).toHaveAttribute('data-phase', 'unconfigured')
  })

  it('is unconfigured when the cart provider is unavailable', () => {
    cartState.current = fakeCart({ status: 'unavailable' })
    const { container } = render(
      <StickyBuyBar title={product.title} price={blackM.price} targetId="buy-box" />
    )

    expect(stickyButton(container)).toBeDisabled()
    expect(stickyButton(container)).toHaveAttribute('data-phase', 'unconfigured')
  })

  it('mirrors the cart pending state and shows "Added ✓" for 2s after its own submit', async () => {
    vi.useFakeTimers()
    cartState.current = fakeCart()
    // A fresh element per render: an identical element would bail out.
    const ui = () => (
      <>
        <form id="buy-box" onSubmit={(event) => event.preventDefault()} />
        <StickyBuyBar title={product.title} price={blackM.price} targetId="buy-box" />
      </>
    )
    const { container, rerender } = render(ui())

    fireEvent.click(stickyButton(container))

    cartState.current = fakeCart({ pending: true })
    rerender(ui())
    expect(stickyButton(container)).toHaveTextContent('Adding…')
    expect(stickyButton(container)).toHaveAttribute('aria-busy', 'true')

    cartState.current = fakeCart({ pending: false })
    rerender(ui())
    expect(stickyButton(container)).toHaveTextContent('Added ✓')

    act(() => vi.advanceTimersByTime(2000))
    expect(stickyButton(container)).toHaveTextContent('Add to cart')
  })

  it('does not show "Added" when the add fails', () => {
    cartState.current = fakeCart()
    // A fresh element per render: an identical element would bail out.
    const ui = () => (
      <>
        <form id="buy-box" onSubmit={(event) => event.preventDefault()} />
        <StickyBuyBar title={product.title} price={blackM.price} targetId="buy-box" />
      </>
    )
    const { container, rerender } = render(ui())

    fireEvent.click(stickyButton(container))
    cartState.current = fakeCart({ pending: true })
    rerender(ui())
    cartState.current = fakeCart({ pending: false, error: 'Something went wrong.' })
    rerender(ui())

    expect(stickyButton(container)).toHaveTextContent('Add to cart')
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

  it('posts the buy box to addCartLineForm without a cart provider (no-JS path)', async () => {
    const { container } = render(await call('core-hoodie', { Size: 'M', Color: 'Black' }))

    const form = container.querySelector<HTMLFormElement>('form#buy-box')
    expect(form).toBeInTheDocument()
    fireEvent.submit(form as HTMLFormElement)

    await waitFor(() => expect(submitForm).toHaveBeenCalledTimes(1))
    const [prev, formData] = submitForm.mock.calls[0] as unknown as [unknown, FormData]
    expect(prev).toBeNull()
    expect(formData.get('variantId')).toBe(blackM.id)
    expect(formData.get('quantity')).toBe('1')
    // Without JS the cart page is the confirmation.
    await waitFor(() => expect(redirect).toHaveBeenCalledWith('/cart'))
  })

  it('enables the sticky bar for a buyable variant and disables it when sold out', async () => {
    const { container } = render(await call('core-hoodie', { Size: 'M', Color: 'Black' }))
    const bar = container.querySelector<HTMLElement>('[data-sticky-buy-bar]') as HTMLElement
    expect(within(bar).getByRole('button', { name: /add to cart/i })).toBeEnabled()

    cleanup()
    const soldOut = render(await call('core-hoodie', { Size: 'S', Color: 'Black' }))
    const soldOutBar = soldOut.container.querySelector<HTMLElement>(
      '[data-sticky-buy-bar]'
    ) as HTMLElement
    expect(within(soldOutBar).getByRole('button', { name: /sold out/i })).toBeDisabled()
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
