// tests/unit/storefront/cart-drawer.test.tsx
import * as React from 'react'
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, cleanup, within, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// `lib/shopify/queries/cart` pulls in `lib/shopify/client`, which imports
// `server-only` — a module that throws outside a React Server environment.
vi.mock('server-only', () => ({}))

// The provider's defaults are the Server Actions (cookies, Shopify). Every test
// injects fakes through `actions`; this stub only keeps the real module (and
// `next/headers`) out of the import graph.
vi.mock('@/app/(storefront)/_actions/cart', () => ({
  getCartAction: vi.fn(async () => null),
  addCartLine: vi.fn(),
  updateCartLine: vi.fn(),
  removeCartLine: vi.fn(),
  applyDiscountCode: vi.fn(),
  removeDiscountCode: vi.fn(),
  updateCartNoteAction: vi.fn(),
}))

/** `next/image` needs a Next runtime; render a plain `<img>` (as product-card.test.tsx). */
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

import type { Cart, CartActionResult } from '@/lib/shopify/types'
import { normalizeCart, type RawCart } from '@/lib/shopify/queries/cart'
import cartFixture from '@/tests/fixtures/shopify/cart.json'
import {
  CartProvider,
  type CartActions,
  type CartContextValue,
} from '@/components/storefront/cart/CartProvider'
import { useCart } from '@/components/storefront/cart/useCart'
import {
  CartDrawer,
  CartLineItem,
  CartLines,
  CartSummary,
  CheckoutButtons,
  DiscountCodeForm,
  EmptyCart,
  FreeShippingBar,
  shopPayHref,
} from '@/components/storefront/cart'

const baseCart = normalizeCart(cartFixture.cart as unknown as RawCart)
const [HOODIE, TEE] = baseCart.lines

function cloneCart(): Cart {
  return structuredClone(baseCart)
}

function emptyCart(): Cart {
  return { ...cloneCart(), lines: [], totalQuantity: 0 }
}

/** Fake Server Actions: every mutation resolves with the fixture cart unless overridden. */
function fakeActions(overrides: Partial<CartActions> = {}): CartActions {
  const ok = async (): Promise<CartActionResult> => ({ ok: true, cart: baseCart })
  return {
    getCart: vi.fn(async () => baseCart),
    addLine: vi.fn(ok),
    updateLine: vi.fn(ok),
    removeLine: vi.fn(ok),
    applyCode: vi.fn(ok),
    removeCode: vi.fn(ok),
    setNote: vi.fn(ok),
    ...overrides,
  }
}

/** A promise that never settles: keeps an action in flight (pending state). */
const never = <T,>() => new Promise<T>(() => {})

/** Exposes the live context to the test and opens the drawer on mount. */
let live: CartContextValue | null = null
function Probe({ openOnMount }: { openOnMount: boolean }) {
  const value = useCart()
  React.useEffect(() => {
    live = value
  })
  const { openDrawer } = value
  React.useEffect(() => {
    if (openOnMount) openDrawer()
  }, [openOnMount, openDrawer])
  return null
}

type Setup = {
  /** `undefined` = not seeded (the provider fetches on mount). */
  cart?: Cart | null
  available?: boolean
  actions?: Partial<CartActions>
  open?: boolean
}

function renderInCart(ui: React.ReactNode, setup: Setup = {}) {
  const actions = fakeActions(setup.actions)
  const seeded = 'cart' in setup ? { initialCart: setup.cart } : { initialCart: baseCart }
  const utils = render(
    <CartProvider {...seeded} available={setup.available ?? true} actions={actions}>
      <Probe openOnMount={setup.open ?? false} />
      {ui}
    </CartProvider>
  )
  return { ...utils, actions }
}

function renderDrawer(setup: Setup = {}) {
  return renderInCart(<CartDrawer />, { open: true, ...setup })
}

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

afterEach(() => {
  cleanup()
  live = null
  document.body.className = ''
  document.body.style.overflow = ''
})

describe('CartDrawer', () => {
  it('renders nothing outside a CartProvider', () => {
    const { container } = render(<CartDrawer />)
    expect(container).toBeEmptyDOMElement()
  })

  it('is a dialog named with the cart count', () => {
    renderDrawer()
    expect(screen.getByRole('dialog', { name: 'Cart (2)' })).toBeInTheDocument()
  })

  it('follows the context open state and closes through it', async () => {
    const user = userEvent.setup()
    renderDrawer()
    expect(live?.open).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(live?.open).toBe(false)
  })

  it('renders shipping bar, lines and discount in the body; summary and buttons in the footer', () => {
    renderDrawer()
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('progressbar')).toBeInTheDocument()
    const items = within(dialog).getByRole('list', { name: 'Cart items' })
    expect(within(items).getAllByRole('listitem')).toHaveLength(2)
    expect(within(dialog).getByText('Have a code?')).toBeInTheDocument()
    expect(within(dialog).getByText('Estimated total')).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: /Checkout/ })).toBeInTheDocument()
  })

  it('shows two skeleton rows while the cart loads, and no footer', () => {
    renderDrawer({ cart: undefined, actions: { getCart: () => never<Cart | null>() } })
    expect(live?.status).toBe('loading')
    expect(document.querySelectorAll('[data-cart-skeleton]')).toHaveLength(2)
    expect(screen.queryByText('Estimated total')).not.toBeInTheDocument()
  })

  it('shows short copy when the cart is unavailable', () => {
    renderDrawer({ available: false, cart: undefined })
    expect(screen.getByText('Cart unavailable')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Checkout/ })).not.toBeInTheDocument()
  })

  it('renders the empty state with no footer when the cart has no lines', () => {
    renderDrawer({ cart: emptyCart() })
    expect(screen.getByRole('dialog', { name: 'Cart (0)' })).toBeInTheDocument()
    expect(screen.getByText('Your cart is empty.')).toBeInTheDocument()
    expect(screen.queryByText('Estimated total')).not.toBeInTheDocument()
  })

  it('closes when a link inside it is followed', async () => {
    const user = userEvent.setup()
    renderDrawer({ cart: emptyCart() })
    expect(live?.open).toBe(true)
    // jsdom cannot navigate; stop the anchor's default action after React has seen the click.
    const block = (event: Event) => event.preventDefault()
    document.addEventListener('click', block)
    await user.click(screen.getByRole('link', { name: 'Shop new arrivals' }))
    document.removeEventListener('click', block)
    expect(live?.open).toBe(false)
  })

  it('renders the empty state when there is no cart yet', () => {
    renderDrawer({ cart: null })
    expect(screen.getByText('Your cart is empty.')).toBeInTheDocument()
  })

  it('marks the body aria-busy while a mutation is pending and dims the affected line', async () => {
    const user = userEvent.setup()
    renderDrawer({ actions: { updateLine: () => never<CartActionResult>() } })
    const body = document.querySelector('[data-cart-body]')
    expect(body).not.toHaveAttribute('aria-busy', 'true')

    const lineItems = () =>
      within(screen.getByRole('list', { name: 'Cart items' })).getAllByRole('listitem')
    const [hoodieItem] = lineItems()
    await user.click(within(hoodieItem).getByRole('button', { name: 'Increase quantity' }))

    await waitFor(() => expect(body).toHaveAttribute('aria-busy', 'true'))
    const [hoodie, tee] = lineItems().map((li) => li.firstElementChild)
    expect(hoodie).toHaveAttribute('aria-busy', 'true')
    expect(hoodie?.className).toContain('opacity-60')
    expect(tee).not.toHaveAttribute('aria-busy')
  })

  it('renders a warning as role="status"', async () => {
    renderDrawer({
      actions: { addLine: async () => ({ ok: true, cart: baseCart, warning: 'Max 2 per order' }) },
    })
    await act(async () => {
      await live?.addLine({ variantId: HOODIE.merchandise.id })
    })
    expect(screen.getByRole('status')).toHaveTextContent('Max 2 per order')
  })

  it('renders an error as role="alert" with a dismiss button that clears it', async () => {
    const user = userEvent.setup()
    renderDrawer({
      actions: {
        removeLine: async () => ({ ok: false, error: 'Something went wrong updating your cart.' }),
      },
    })
    await user.click(screen.getByRole('button', { name: 'Remove Core Hoodie' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong updating your cart.'
    )
    await user.click(screen.getByRole('button', { name: 'Dismiss message' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(live?.error).toBeNull()
  })
})

describe('CartLineItem', () => {
  it('renders the image, title link, options and price', () => {
    renderInCart(<CartLineItem line={HOODIE} />)
    const link = screen.getByRole('link', { name: 'Core Hoodie' })
    expect(link).toHaveAttribute('href', '/products/core-hoodie')
    const img = document.querySelector('img')
    expect(img).toHaveAttribute('src', HOODIE.merchandise.image?.url)
    expect(img?.closest('a')).toHaveAttribute('href', '/products/core-hoodie')
    expect(screen.getByText('Taupe · M')).toBeInTheDocument()
    expect(screen.getByText('$88.00')).toBeInTheDocument()
  })

  it('shows the compare-at price on a sale line', () => {
    renderInCart(<CartLineItem line={TEE} />)
    expect(screen.getByText('$24.00')).toBeInTheDocument()
    expect(screen.getByLabelText('Original price')).toHaveTextContent('$34.00')
  })

  it('stepper calls updateLine with the new quantity', async () => {
    const user = userEvent.setup()
    const { actions } = renderInCart(<CartLineItem line={HOODIE} />)
    await user.click(screen.getByRole('button', { name: 'Increase quantity' }))
    expect(actions.updateLine).toHaveBeenCalledWith({ lineId: HOODIE.id, quantity: 2 })
  })

  it('disables + at maxPerOrder', () => {
    const line = structuredClone(HOODIE)
    line.quantity = 2
    renderInCart(<CartLineItem line={line} />)
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled()
    expect(screen.getByText('Max 2 per order')).toBeInTheDocument()
  })

  it('disables + at quantityAvailable and says how many are left', () => {
    renderInCart(<CartLineItem line={TEE} />)
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled()
    expect(screen.getByText('Only 1 left').className).toContain('text-warn')
  })

  it('caps at 99 when neither stock nor a max is known', () => {
    const line = structuredClone(TEE)
    line.merchandise.quantityAvailable = null
    line.quantity = 99
    renderInCart(<CartLineItem line={line} />)
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled()
    expect(screen.queryByText(/left/)).not.toBeInTheDocument()
  })

  it('Remove calls removeLine', async () => {
    const user = userEvent.setup()
    const { actions } = renderInCart(<CartLineItem line={HOODIE} />)
    await user.click(screen.getByRole('button', { name: 'Remove Core Hoodie' }))
    expect(actions.removeLine).toHaveBeenCalledWith({ lineId: HOODIE.id })
  })

  it('dims an unavailable line, badges it sold out and alerts', () => {
    const line = structuredClone(HOODIE)
    line.merchandise.availableForSale = false
    renderInCart(<CartLineItem line={line} />)
    const item = document.querySelector('[data-cart-line]') as HTMLElement
    expect(item.className).toContain('opacity-60')
    expect(screen.getByText('Sold out')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Sold out. Remove it to check out.')
    expect(screen.queryByRole('group', { name: /Quantity/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Core Hoodie' })).toBeInTheDocument()
  })

  it('pending prop dims the line and sets aria-busy', () => {
    renderInCart(<CartLineItem line={HOODIE} pending />)
    const item = document.querySelector('[data-cart-line]') as HTMLElement
    expect(item).toHaveAttribute('aria-busy', 'true')
    expect(item.className).toContain('opacity-60')
  })

  it('page variant shows the SKU and the line total', () => {
    const line = structuredClone(HOODIE)
    line.quantity = 2
    line.cost.total = { amount: '176.0', currencyCode: 'USD' }
    renderInCart(<CartLineItem line={line} variant="page" />)
    expect(screen.getByText('HOF-CH-TPE-M')).toBeInTheDocument()
    expect(screen.getByText('$176.00')).toBeInTheDocument()
  })
})

describe('CartLines', () => {
  it('renders a list item per line', () => {
    renderInCart(<CartLines lines={baseCart.lines} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })
})

describe('FreeShippingBar', () => {
  it('shows how far away free shipping is', () => {
    render(<FreeShippingBar subtotal={{ amount: '62.0', currencyCode: 'USD' }} />)
    expect(screen.getByText(/away from free US shipping/)).toHaveTextContent(
      '$13.00 away from free US shipping'
    )
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '83')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
    expect(bar).toHaveAccessibleName()
  })

  it('shows the unlocked state at or over the threshold', () => {
    render(<FreeShippingBar subtotal={baseCart.cost.subtotal} />)
    const unlocked = screen.getByText("✓ You've unlocked free US shipping")
    expect(unlocked.className).toContain('text-ok')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  })
})

describe('DiscountCodeForm', () => {
  it('submits applyCode with the trimmed code and clears the input on success', async () => {
    const user = userEvent.setup()
    const { actions } = renderInCart(<DiscountCodeForm />)
    const input = screen.getByLabelText('Discount code')
    expect(input).toHaveAttribute('name', 'code')
    await user.type(input, ' welcome10 ')
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    expect(actions.applyCode).toHaveBeenCalledWith({ code: 'welcome10' })
    await waitFor(() => expect(input).toHaveValue(''))
  })

  it('shows a discount error inline as role="alert" and keeps the input', async () => {
    const user = userEvent.setup()
    renderInCart(<DiscountCodeForm />, {
      actions: {
        applyCode: async ({ code }) => ({
          ok: false,
          error: `${code} isn't valid for this cart.`,
          cart: baseCart,
        }),
      },
    })
    const input = screen.getByLabelText('Discount code')
    await user.type(input, 'WELCOME50')
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "WELCOME50 isn't valid for this cart."
    )
    expect(input).toHaveValue('WELCOME50')
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('renders applicable codes as chips that remove via removeCode', async () => {
    const user = userEvent.setup()
    const { actions } = renderInCart(<DiscountCodeForm />)
    expect(screen.getByText('GOLD15')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove discount GOLD15' }))
    expect(actions.removeCode).toHaveBeenCalledWith({ code: 'GOLD15' })
  })

  it('compact renders a "Have a code?" disclosure', () => {
    renderInCart(<DiscountCodeForm compact />)
    const details = document.querySelector('details') as HTMLElement
    expect(details).not.toBeNull()
    expect(within(details).getByText('Have a code?')).toBeInTheDocument()
    expect(within(details).getByLabelText('Discount code')).toBeInTheDocument()
  })
})

describe('CartSummary', () => {
  it('renders subtotal, discount, estimated total and the Care Points note', () => {
    render(<CartSummary cart={baseCart} />)
    expect(screen.getByText('Subtotal')).toBeInTheDocument()
    expect(screen.getByText('$112.00')).toBeInTheDocument()
    expect(screen.getByText('GOLD15')).toBeInTheDocument()
    expect(screen.getByText('−$16.80')).toBeInTheDocument()
    expect(screen.getByText('Estimated total').closest('div')?.className).toContain(
      'font-semibold'
    )
    expect(screen.getByText('$95.20')).toBeInTheDocument()
    const note = screen.getByText(/Taxes and shipping calculated at checkout/)
    expect(note).toHaveTextContent(
      'Taxes and shipping calculated at checkout · Earn 95 Care Points'
    )
    expect(within(note).getByText('95').className).toContain('num')
  })

  it('omits the discount row when the cart has no discount', () => {
    const cart = { ...cloneCart(), discountCodes: [], cost: { ...baseCart.cost, discount: null } }
    render(<CartSummary cart={cart} />)
    expect(screen.queryByText(/−\$/)).not.toBeInTheDocument()
  })
})

describe('CheckoutButtons', () => {
  it('links Checkout to checkoutUrl and Shop Pay with payment=shop_pay', () => {
    render(<CheckoutButtons cart={baseCart} />)
    const checkout = screen.getByRole('link', { name: /Checkout/ })
    expect(checkout).toHaveAttribute('href', baseCart.checkoutUrl)
    expect(checkout).toHaveAttribute('rel', 'noopener')
    expect(checkout).toHaveTextContent('Checkout · $95.20')
    const shopPay = screen.getByRole('link', { name: 'Buy with Shop Pay' })
    expect(shopPay).toHaveAttribute('href', `${baseCart.checkoutUrl}&payment=shop_pay`)
    expect(shopPay.className).toContain('bg-shoppay')
    expect(screen.getByText('Secure checkout by Shopify')).toBeInTheDocument()
  })

  it('shopPayHref picks the right separator', () => {
    expect(shopPayHref('https://x.test/cart/c/abc')).toBe(
      'https://x.test/cart/c/abc?payment=shop_pay'
    )
    expect(shopPayHref('https://x.test/cart/c/abc?key=1')).toBe(
      'https://x.test/cart/c/abc?key=1&payment=shop_pay'
    )
  })

  it('disables checkout while any line is unavailable', () => {
    const cart = cloneCart()
    cart.lines[1].merchandise.availableForSale = false
    render(<CheckoutButtons cart={cart} />)
    const checkout = screen.getByText(/Checkout ·/).closest('a') as HTMLAnchorElement
    expect(checkout).not.toHaveAttribute('href')
    expect(checkout).toHaveAttribute('aria-disabled', 'true')
    expect(checkout.className).toContain('pointer-events-none')
  })

  it('disables checkout for an empty cart', () => {
    render(<CheckoutButtons cart={emptyCart()} />)
    const checkout = screen.getByText(/Checkout ·/).closest('a') as HTMLAnchorElement
    expect(checkout).not.toHaveAttribute('href')
    expect(checkout).toHaveAttribute('aria-disabled', 'true')
  })
})

describe('EmptyCart', () => {
  it('points at new arrivals and the drop', () => {
    render(<EmptyCart />)
    expect(screen.getByText('Your cart is empty.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Shop new arrivals' })).toHaveAttribute(
      'href',
      '/collections/all'
    )
    expect(screen.getByRole('link', { name: 'See the drop' })).toHaveAttribute('href', '/drops')
  })
})
