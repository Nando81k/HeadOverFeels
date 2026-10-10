// tests/unit/storefront/cart-page.test.tsx
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import type { Cart, CartActionResult, CartLine } from '@/lib/shopify/types'

/*
 * The `/cart` route and `CartPage`. The cart provider (T4) and the drawer
 * parts (T5) are mocked with their documented contracts so this suite pins
 * the page's own wiring: which cart it seeds, what it renders around the
 * parts, and how the note form saves.
 */

const { env, actions, cartCtx, providerProps } = vi.hoisted(() => ({
  env: { configured: true },
  actions: {
    getCartAction: vi.fn(),
    updateCartNoteAction: vi.fn(),
  },
  cartCtx: {
    current: null as null | {
      cart: Cart | null
      warning: string | null
      error: string | null
      setNote: ReturnType<typeof vi.fn>
    },
  },
  providerProps: { current: null as null | { initialCart?: Cart | null; available?: boolean } },
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/shopify/client', () => ({ storefrontFetch: vi.fn() }))
vi.mock('@/lib/shopify/env', () => ({ hasShopifyEnv: () => env.configured }))

vi.mock('@/app/(storefront)/_actions/cart', () => ({
  getCartAction: actions.getCartAction,
  updateCartNoteAction: actions.updateCartNoteAction,
  addCartLine: vi.fn(),
  addCartLineForm: vi.fn(),
  updateCartLine: vi.fn(),
  removeCartLine: vi.fn(),
  applyDiscountCode: vi.fn(),
  removeDiscountCode: vi.fn(),
}))

// T4 contract: the provider seeds state from `initialCart`; `useCart()` reads it.
vi.mock('@/components/storefront/cart/CartProvider', () => ({
  CartProvider: ({
    children,
    initialCart,
    available,
  }: {
    children: React.ReactNode
    initialCart?: Cart | null
    available?: boolean
  }) => {
    providerProps.current = { initialCart, available }
    return <div data-cart-provider>{children}</div>
  },
}))

vi.mock('@/components/storefront/cart/useCart', () => ({
  useCart: () => {
    if (!cartCtx.current) throw new Error('useCart() outside provider')
    return {
      status: 'ready',
      count: cartCtx.current.cart?.totalQuantity ?? 0,
      open: false,
      openDrawer: vi.fn(),
      closeDrawer: vi.fn(),
      pending: false,
      pendingLineId: null,
      clearMessages: vi.fn(),
      addLine: vi.fn(),
      updateLine: vi.fn(),
      removeLine: vi.fn(),
      applyCode: vi.fn(),
      removeCode: vi.fn(),
      ...cartCtx.current,
    }
  },
  useCartOptional: () => cartCtx.current,
}))

// T5 contract: the parts render from props; stubs expose just enough to assert on.
vi.mock('@/components/storefront/cart', () => ({
  CartLines: ({ lines, variant }: { lines: CartLine[]; variant?: string }) => (
    <ul data-cart-lines={variant}>
      {lines.map((line) => (
        <li key={line.id}>
          <a href={`/products/${line.merchandise.product.handle}`}>
            {line.merchandise.product.title}
          </a>
        </li>
      ))}
    </ul>
  ),
  CartSummary: ({ cart, variant }: { cart: Cart; variant?: string }) => (
    <dl data-cart-summary={variant}>
      <dt>Subtotal</dt>
      <dd>${cart.cost.subtotal.amount}</dd>
      <dt>Estimated total</dt>
      <dd>${cart.cost.total.amount}</dd>
    </dl>
  ),
  FreeShippingBar: ({ subtotal }: { subtotal: { amount: string } }) => (
    <div data-free-shipping={subtotal.amount} />
  ),
  DiscountCodeForm: () => <form aria-label="Discount code" />,
  CheckoutButtons: ({ cart }: { cart: Cart }) => <a href={cart.checkoutUrl}>Checkout</a>,
  EmptyCart: () => <p data-empty-cart>Your cart is empty.</p>,
}))

import CartRoute, { dynamic, metadata } from '@/app/(storefront)/cart/page'
import { CartPage } from '@/components/storefront/cart/CartPage'
import { normalizeCart, type RawCart } from '@/lib/shopify/queries/cart'
import cartFixture from '@/tests/fixtures/shopify/cart.json'

const fixtureCart: Cart = normalizeCart(cartFixture.cart as unknown as RawCart)
const emptyCart: Cart = { ...fixtureCart, lines: [], totalQuantity: 0 }

function provide(cart: Cart | null, extra: Partial<{ warning: string; error: string }> = {}) {
  const setNote = vi.fn<(note: string) => Promise<CartActionResult>>()
  cartCtx.current = {
    cart,
    warning: extra.warning ?? null,
    error: extra.error ?? null,
    setNote,
  }
  return setNote
}

async function renderRoute() {
  const element = await CartRoute()
  return render(element)
}

beforeEach(() => {
  vi.clearAllMocks()
  env.configured = true
  cartCtx.current = null
  providerProps.current = null
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('app/(storefront)/cart/page', () => {
  it('is dynamic and kept out of the index', () => {
    expect(dynamic).toBe('force-dynamic')
    expect(metadata).toMatchObject({ title: 'Cart', robots: { index: false, follow: true } })
  })

  it('renders the catalog notice without reading the cart when unconfigured', async () => {
    env.configured = false

    const { container } = await renderRoute()

    expect(container.querySelector('[data-catalog="unconfigured"]')).not.toBeNull()
    expect(actions.getCartAction).not.toHaveBeenCalled()
    expect(container.querySelector('[data-cart-provider]')).toBeNull()
  })

  it('seeds the provider with the cookie cart', async () => {
    actions.getCartAction.mockResolvedValue(fixtureCart)
    provide(fixtureCart)

    await renderRoute()

    expect(actions.getCartAction).toHaveBeenCalledTimes(1)
    expect(providerProps.current?.initialCart).toBe(fixtureCart)
    expect(screen.getByRole('heading', { level: 1, name: 'Your cart' })).toBeInTheDocument()
  })

  it('seeds a known-empty cart (null) and shows the empty state', async () => {
    actions.getCartAction.mockResolvedValue(null)
    provide(null)

    const { container } = await renderRoute()

    expect(providerProps.current).toEqual({ initialCart: null, available: undefined })
    expect(container.querySelector('[data-empty-cart]')).not.toBeNull()
    expect(container.querySelector('[data-cart-lines]')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Checkout' })).toBeNull()
  })
})

describe('CartPage', () => {
  it('shows EmptyCart for a cart with no lines', () => {
    provide(emptyCart)
    const { container } = render(<CartPage />)

    expect(container.querySelector('[data-empty-cart]')).not.toBeNull()
    expect(screen.queryByLabelText('Order notes')).toBeNull()
    expect(screen.getByRole('link', { name: 'Continue shopping' })).toHaveAttribute(
      'href',
      '/collections/all'
    )
  })

  it('renders lines, summary, checkout and the policy links for a full cart', () => {
    provide(fixtureCart)
    const { container } = render(<CartPage />)

    expect(container.querySelector('[data-cart-lines="page"]')).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Core Hoodie' })).toHaveAttribute(
      'href',
      '/products/' + fixtureCart.lines[0].merchandise.product.handle
    )
    expect(screen.getByRole('link', { name: 'Signature Tee' })).toBeInTheDocument()

    expect(container.querySelector('[data-cart-summary="page"]')).not.toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: 'Summary' })).toBeInTheDocument()
    expect(screen.getByText('$95.2')).toBeInTheDocument()
    expect(container.querySelector('[data-free-shipping="112.0"]')).not.toBeNull()
    expect(screen.getByRole('form', { name: 'Discount code' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Checkout' })).toHaveAttribute(
      'href',
      fixtureCart.checkoutUrl
    )

    const icons = container.querySelector('[data-payment-icons]')
    expect(icons).toHaveAttribute('aria-hidden', 'true')
    expect(icons?.querySelectorAll('li')).toHaveLength(6)

    expect(screen.getByRole('link', { name: 'Shipping policy' })).toHaveAttribute(
      'href',
      '/policies/shipping-policy'
    )
    expect(screen.getByRole('link', { name: 'Returns & refunds' })).toHaveAttribute(
      'href',
      '/policies/refund-policy'
    )
    expect(screen.getByText('Item')).toBeInTheDocument()
    expect(screen.getByText('Quantity')).toBeInTheDocument()
  })

  it('surfaces provider warnings and errors in live regions', () => {
    provide(fixtureCart, { warning: 'Only 1 left', error: 'GOLD99 isn’t valid for this cart.' })
    render(<CartPage />)

    expect(screen.getByRole('alert')).toHaveTextContent('GOLD99 isn’t valid for this cart.')
    expect(screen.getAllByRole('status').some((node) => node.textContent === 'Only 1 left')).toBe(
      true
    )
  })
})

describe('CartNoteForm (via CartPage)', () => {
  it('starts from the cart note and has a 1000 character cap', () => {
    provide({ ...fixtureCart, note: 'Gift wrap please' })
    render(<CartPage />)

    const note = screen.getByLabelText('Order notes')
    expect(note).toHaveValue('Gift wrap please')
    expect(note).toHaveAttribute('maxLength', '1000')
  })

  it('saves on blur when changed, then shows "Saved" briefly', async () => {
    const setNote = provide(fixtureCart)
    setNote.mockResolvedValue({ ok: true, cart: { ...fixtureCart, note: 'Leave at the door' } })
    render(<CartPage />)

    const note = screen.getByLabelText('Order notes')
    fireEvent.change(note, { target: { value: 'Leave at the door  ' } })
    expect(setNote).not.toHaveBeenCalled()

    vi.useFakeTimers()
    await act(async () => {
      fireEvent.blur(note)
    })

    expect(setNote).toHaveBeenCalledTimes(1)
    expect(setNote).toHaveBeenCalledWith('Leave at the door')
    expect(screen.getByText('Saved')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(2500)
    })
    expect(screen.queryByText('Saved')).toBeNull()
  })

  it('does not save on blur when nothing changed', async () => {
    const setNote = provide({ ...fixtureCart, note: 'Same' })
    render(<CartPage />)

    const note = screen.getByLabelText('Order notes')
    await act(async () => {
      fireEvent.blur(note)
    })
    fireEvent.change(note, { target: { value: 'Same ' } })
    await act(async () => {
      fireEvent.blur(note)
    })

    expect(setNote).not.toHaveBeenCalled()
  })

  it('does not claim "Saved" when the save fails', async () => {
    const setNote = provide(fixtureCart)
    setNote.mockResolvedValue({ ok: false, error: 'Something went wrong updating your cart.' })
    render(<CartPage />)

    const note = screen.getByLabelText('Order notes')
    fireEvent.change(note, { target: { value: 'Ring twice' } })
    await act(async () => {
      fireEvent.blur(note)
    })

    await waitFor(() => expect(setNote).toHaveBeenCalledWith('Ring twice'))
    expect(screen.queryByText('Saved')).toBeNull()
  })
})
