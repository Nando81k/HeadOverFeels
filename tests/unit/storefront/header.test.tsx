// tests/unit/storefront/header.test.tsx
import * as React from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/shopify/client', () => ({ storefrontFetch: vi.fn() }))

// The header's search dialog uses the app router and the predictive-search
// server action; neither exists in jsdom.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/collections/all',
}))
// The header's account control reads `useCustomerOptional()`; providers in
// these tests get a fake `getSummary`, so the real action must never run.
vi.mock('@/app/(storefront)/_actions/account', () => ({
  getCustomerSummaryAction: vi.fn(async () => ({ status: 'signed-out', customer: null, loyalty: null })),
}))
vi.mock('@/app/(storefront)/_actions/catalog', () => ({
  predictiveSearchAction: vi.fn(async () => ({ products: [], collections: [] })),
}))
// The header reads the cart through `useCartOptional()`; providers in these
// tests get fake actions, so the real Server Actions must never be reached.
vi.mock('@/app/(storefront)/_actions/cart', () => ({
  getCartAction: vi.fn(async () => null),
  addCartLine: vi.fn(),
  updateCartLine: vi.fn(),
  removeCartLine: vi.fn(),
  applyDiscountCode: vi.fn(),
  removeDiscountCode: vi.fn(),
  updateCartNoteAction: vi.fn(),
}))
// The cart drawer (Task 5) may render product images.
vi.mock('next/image', async () => {
  const react = await import('react')
  const nextOnly = new Set(['fill', 'priority', 'quality', 'loader', 'placeholder', 'blurDataURL', 'unoptimized', 'sizes'])
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
  CartProvider,
  useCart,
  type CartActions,
} from '@/components/storefront/cart/CartProvider'
import {
  CustomerProvider,
  type CustomerActions,
} from '@/components/storefront/account/CustomerProvider'
import type { CustomerSummaryState } from '@/app/(storefront)/_actions/account'
import { Header } from '@/components/storefront/layout/Header'
import { HeaderNav } from '@/components/storefront/layout/HeaderNav'
import { MobileMenu } from '@/components/storefront/layout/MobileMenu'
import { normalizeMenu, type RawMenuItem } from '@/lib/shopify/queries/shop'
import shopLayoutFixture from '@/tests/fixtures/shopify/shop-layout.json'
import { normalizeCart, type RawCart } from '@/lib/shopify/queries/cart'
import type { Cart } from '@/lib/shopify/types'
import cartFixture from '@/tests/fixtures/shopify/cart.json'
import { normalizeCustomerSummary, type RawCustomerSummary } from '@/lib/shopify/customer/queries'
import customerFixture from '@/tests/fixtures/shopify/customer/customer.json'

const CART: Cart = normalizeCart(cartFixture.cart as unknown as RawCart)
const CUSTOMER = normalizeCustomerSummary(customerFixture as unknown as RawCustomerSummary)

function summary(status: CustomerSummaryState['status']): CustomerSummaryState {
  return status === 'ready'
    ? { status, customer: CUSTOMER, loyalty: { points: 1240, tierName: 'Gold', nextTierName: null, pointsToNext: null, multiplier: 1.5 } }
    : { status, customer: null, loyalty: null }
}

function customerActions(status: CustomerSummaryState['status']): Partial<CustomerActions> {
  return { getSummary: vi.fn(async () => summary(status)) }
}

/**
 * jsdom implements none of `HTMLDialogElement.showModal/close`, and `MobileMenu`
 * renders inside `Drawer`, which is built on a native `<dialog>`. Same minimal
 * polyfill as tests/unit/storefront/overlays.test.tsx.
 */
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

const MENU = normalizeMenu(shopLayoutFixture.menu.items as unknown as RawMenuItem[], {
  storeDomain: 'tgqucm-qg.myshopify.com',
  primaryDomain: 'https://tgqucm-qg.myshopify.com',
})

function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', { value, configurable: true, writable: true })
}

afterEach(() => {
  cleanup()
  setScrollY(0)
  document.body.className = ''
  document.body.style.overflow = ''
  sessionStorage.clear()
})

/** The `<header>` element (implicit role `banner`) — scopes queries away from the drawer. */
function banner() {
  return within(screen.getByRole('banner'))
}

describe('Header', () => {
  it('renders the wordmark as a link home', () => {
    render(<Header menu={MENU} cartCount={0} />)
    expect(banner().getByRole('link', { name: 'Head Over Feels home' })).toHaveAttribute('href', '/')
  })

  it('renders the top-level menu items in the primary nav', () => {
    render(<Header menu={MENU} cartCount={0} />)
    const nav = within(banner().getByRole('navigation', { name: 'Primary' }))

    expect(nav.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/collections/all')
    expect(nav.getByRole('link', { name: /^Drops/ })).toHaveAttribute('href', '/collections/drops')
    expect(nav.getByRole('link', { name: 'Loyalty' })).toHaveAttribute('href', '/loyalty')
    // Items with children are disclosure triggers, not links.
    expect(nav.getByRole('button', { name: 'Collections' })).toBeInTheDocument()
    expect(nav.getByRole('button', { name: 'About' })).toBeInTheDocument()
  })

  it('renders search, account and cart controls', () => {
    render(<Header menu={MENU} cartCount={2} />)
    const header = banner()

    expect(header.getByRole('button', { name: 'Search' })).toBeInTheDocument()
    expect(header.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account')
    expect(header.getByRole('button', { name: 'Cart, 2 items' })).toBeInTheDocument()
  })

  it('shows the item count bubble and singularises the cart label', () => {
    const { rerender } = render(<Header menu={MENU} cartCount={1} />)
    expect(banner().getByRole('button', { name: 'Cart, 1 item' })).toHaveTextContent('1')

    rerender(<Header menu={MENU} cartCount={0} />)
    const empty = banner().getByRole('button', { name: 'Cart, 0 items' })
    expect(empty).toBeInTheDocument()
    expect(empty.querySelector('.num')).toBeNull()
  })

  it('renders the announcement above the header only when given one', () => {
    const { rerender } = render(<Header menu={MENU} cartCount={0} announcement="Free US shipping" />)
    expect(screen.getByText('Free US shipping')).toBeInTheDocument()

    rerender(<Header menu={MENU} cartCount={0} />)
    expect(screen.queryByText('Free US shipping')).toBeNull()
  })

  it('marks itself transparent only when asked', () => {
    const { rerender } = render(<Header menu={MENU} cartCount={0} transparent />)
    expect(screen.getByRole('banner')).toHaveAttribute('data-transparent')

    rerender(<Header menu={MENU} cartCount={0} />)
    expect(screen.getByRole('banner')).not.toHaveAttribute('data-transparent')
  })

  it('sets data-scrolled once the page scrolls past 24px', async () => {
    render(<Header menu={MENU} cartCount={0} transparent />)
    const header = screen.getByRole('banner')
    expect(header).not.toHaveAttribute('data-scrolled')

    setScrollY(30)
    fireEvent.scroll(window)
    await waitFor(() => expect(header).toHaveAttribute('data-scrolled'))

    setScrollY(10)
    fireEvent.scroll(window)
    await waitFor(() => expect(header).not.toHaveAttribute('data-scrolled'))
  })

  it('opens the search dialog from the search button', async () => {
    const user = userEvent.setup()
    render(<Header menu={MENU} cartCount={0} />)

    const trigger = banner().getByRole('button', { name: 'Search' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await user.click(trigger)

    const dialog = screen.getByRole('dialog', { name: 'Search' })
    expect(within(dialog).getByLabelText('Search products')).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('opens the mobile drawer from the menu button', async () => {
    const user = userEvent.setup()
    render(<Header menu={MENU} cartCount={0} />)

    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(banner().getByRole('button', { name: 'Open menu' }))

    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/collections/all')
  })
})

describe('Header cart button', () => {
  const noFetch: Partial<CartActions> = { getCart: vi.fn(async () => null) }

  /** Stands in for the drawer's close control without depending on Task 5's markup. */
  function CloseCart() {
    const { closeDrawer } = useCart()
    return (
      <button type="button" onClick={closeDrawer}>
        close cart
      </button>
    )
  }

  it('opens the cart drawer and labels itself from the live count', async () => {
    const user = userEvent.setup()
    render(
      <CartProvider initialCart={CART} actions={noFetch}>
        <Header menu={MENU} cartCount={0} />
        <CloseCart />
      </CartProvider>
    )

    // Live count (2) wins over the SSR fallback (0).
    const trigger = banner().getByRole('button', { name: 'Cart, 2 items' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger.querySelector('[data-cart-badge]')).toHaveTextContent('2')

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await user.click(screen.getByRole('button', { name: 'close cart', hidden: true }))
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows the SSR fallback count while the provider is loading', () => {
    const getCart = () => new Promise<Cart | null>(() => {})
    render(
      <CartProvider actions={{ getCart }}>
        <Header menu={MENU} cartCount={4} />
      </CartProvider>
    )
    expect(banner().getByRole('button', { name: 'Cart, 4 items' })).toHaveTextContent('4')
  })

  it('renders outside a provider with the fallback count and a harmless click', async () => {
    const user = userEvent.setup()
    render(<Header menu={MENU} cartCount={3} />)

    const trigger = banner().getByRole('button', { name: 'Cart, 3 items' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('Header account control', () => {
  it('links to the login route while the customer summary is loading', () => {
    const getSummary = () => new Promise<CustomerSummaryState>(() => {})
    render(
      <CustomerProvider actions={{ getSummary }}>
        <Header menu={MENU} cartCount={0} />
      </CustomerProvider>
    )
    expect(banner().getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account/login')
  })

  it.each(['signed-out', 'unavailable'] as const)('links to the login route when %s', async (status) => {
    render(
      <CustomerProvider actions={customerActions(status)}>
        <Header menu={MENU} cartCount={0} />
      </CustomerProvider>
    )
    await waitFor(() =>
      expect(banner().getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account/login')
    )
    expect(banner().queryByRole('button', { name: /account menu/i })).toBeNull()
  })

  it('sends an expired session through the refresh route with the current path', async () => {
    render(
      <CustomerProvider actions={customerActions('expired')}>
        <Header menu={MENU} cartCount={0} />
      </CustomerProvider>
    )
    await waitFor(() =>
      expect(banner().getByRole('link', { name: 'Account' })).toHaveAttribute(
        'href',
        '/account/refresh?return_to=%2Fcollections%2Fall'
      )
    )
  })

  it('shows the initials chip and name once signed in, with a menu', async () => {
    const user = userEvent.setup()
    render(
      <CustomerProvider actions={customerActions('ready')}>
        <Header menu={MENU} cartCount={0} />
      </CustomerProvider>
    )
    const trigger = await banner().findByRole('button', { name: 'Account menu, Nando Alvarez' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger.querySelector('[data-initials]')).toHaveTextContent('NA')
    expect(trigger).toHaveTextContent('Nando')
    expect(banner().queryByRole('link', { name: 'Account' })).toBeNull()

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const menu = within(banner().getByRole('menu'))
    expect(menu.getByRole('menuitem', { name: 'Overview' })).toHaveAttribute('href', '/account')
    expect(menu.getByRole('menuitem', { name: 'Orders' })).toHaveAttribute('href', '/account/orders')
    expect(menu.getByRole('menuitem', { name: 'Care Points' })).toHaveAttribute('href', '/loyalty')
    expect(menu.getByRole('menuitem', { name: 'Wishlist' })).toHaveAttribute('href', '/wishlist')

    const signOut = menu.getByRole('menuitem', { name: 'Sign out' })
    expect(signOut).toHaveAttribute('type', 'submit')
    const form = signOut.closest('form')
    expect(form).toHaveAttribute('method', 'post')
    expect(form).toHaveAttribute('action', '/account/logout')
  })

  it('moves focus with the arrow keys and closes on Escape', async () => {
    const user = userEvent.setup()
    render(
      <CustomerProvider actions={customerActions('ready')}>
        <Header menu={MENU} cartCount={0} />
      </CustomerProvider>
    )
    const trigger = await banner().findByRole('button', { name: 'Account menu, Nando Alvarez' })
    trigger.focus()
    await user.keyboard('{Enter}')

    const menu = within(banner().getByRole('menu'))
    await waitFor(() => expect(menu.getByRole('menuitem', { name: 'Overview' })).toHaveFocus())
    await user.keyboard('{ArrowDown}')
    expect(menu.getByRole('menuitem', { name: 'Orders' })).toHaveFocus()
    await user.keyboard('{End}')
    expect(menu.getByRole('menuitem', { name: 'Sign out' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(menu.getByRole('menuitem', { name: 'Overview' })).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(banner().queryByRole('menu')).toBeNull()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()
  })

  it('closes the menu on an outside click', async () => {
    const user = userEvent.setup()
    render(
      <CustomerProvider actions={customerActions('ready')}>
        <Header menu={MENU} cartCount={0} />
        <p>outside</p>
      </CustomerProvider>
    )
    const trigger = await banner().findByRole('button', { name: 'Account menu, Nando Alvarez' })
    await user.click(trigger)
    expect(banner().getByRole('menu')).toBeInTheDocument()

    await user.click(screen.getByText('outside'))
    expect(banner().queryByRole('menu')).toBeNull()
  })

  it('gives the mobile drawer the signed-in rows', async () => {
    const user = userEvent.setup()
    render(
      <CustomerProvider actions={customerActions('ready')}>
        <Header menu={MENU} cartCount={0} />
      </CustomerProvider>
    )
    await banner().findByRole('button', { name: 'Account menu, Nando Alvarez' })
    await user.click(banner().getByRole('button', { name: 'Open menu' }))

    const dialog = within(screen.getByRole('dialog'))
    const account = within(dialog.getByRole('navigation', { name: 'Account' }))
    expect(account.getByText('Nando Alvarez')).toBeInTheDocument()
    expect(account.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/account')
    expect(account.getByRole('link', { name: 'Orders' })).toHaveAttribute('href', '/account/orders')
    expect(account.getByRole('link', { name: 'Care Points' })).toHaveAttribute('href', '/loyalty')
    expect(account.getByRole('link', { name: 'Wishlist' })).toHaveAttribute('href', '/wishlist')
    expect(account.getByRole('button', { name: 'Sign out' }).closest('form')).toHaveAttribute(
      'action',
      '/account/logout'
    )
  })

  it('points the mobile drawer footer at the login route when signed out', async () => {
    const user = userEvent.setup()
    render(
      <CustomerProvider actions={customerActions('signed-out')}>
        <Header menu={MENU} cartCount={0} />
      </CustomerProvider>
    )
    await waitFor(() =>
      expect(banner().getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account/login')
    )
    await user.click(banner().getByRole('button', { name: 'Open menu' }))
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account/login')
    expect(dialog.queryByRole('navigation', { name: 'Account' })).toBeNull()
  })
})

describe('HeaderNav', () => {
  it('flags the Drops item with a signal dot', () => {
    render(<HeaderNav items={MENU} />)
    const drops = screen.getByRole('link', { name: /^Drops/ })
    expect(drops.querySelector('[data-drop-dot]')).toHaveClass('bg-signal')
    expect(screen.getByRole('link', { name: 'Loyalty' }).querySelector('[data-drop-dot]')).toBeNull()
  })

  it('opens the flyout on hover and closes it after the leave delay', async () => {
    const user = userEvent.setup()
    render(<HeaderNav items={MENU} />)
    const trigger = screen.getByRole('button', { name: 'Collections' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await user.hover(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    const panel = document.getElementById(trigger.getAttribute('aria-controls') ?? '')
    expect(panel).not.toBeNull()
    expect(within(panel as HTMLElement).getByRole('link', { name: 'Hoodies' })).toHaveAttribute(
      'href',
      '/collections/hoodies'
    )

    await user.unhover(trigger)
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'))
  })

  it('opens the flyout when the trigger takes focus', async () => {
    render(<HeaderNav items={MENU} />)
    const trigger = screen.getByRole('button', { name: 'About' })

    fireEvent.focus(trigger)
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'))
    expect(screen.getByRole('link', { name: 'Journal' })).toHaveAttribute(
      'href',
      'https://journal.headoverfeels.com'
    )
  })

  it('toggles the flyout on click', () => {
    render(<HeaderNav items={MENU} />)
    const trigger = screen.getByRole('button', { name: 'Collections' })

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes the flyout on Escape', () => {
    render(<HeaderNav items={MENU} />)
    const trigger = screen.getByRole('button', { name: 'Collections' })

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('MobileMenu', () => {
  const noop = () => {}

  it('renders nothing visible while closed', () => {
    render(<MobileMenu open={false} onOpenChange={noop} items={MENU} />)
    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open')
  })

  it('lists leaf items as links and parents as accordion rows', () => {
    const { container } = render(<MobileMenu open onOpenChange={noop} items={MENU} />)
    const dialog = within(screen.getByRole('dialog'))

    expect(dialog.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/collections/all')
    expect(dialog.getByRole('link', { name: /^Drops/ })).toHaveAttribute(
      'href',
      '/collections/drops'
    )

    const details = container.querySelectorAll('details')
    expect(details).toHaveLength(2)
    expect(dialog.getByText('Collections').closest('summary')).not.toBeNull()
    expect(dialog.getByRole('link', { name: 'Best Sellers' })).toHaveAttribute(
      'href',
      '/collections/best-sellers'
    )
  })

  it('links to the account and search pages in the footer', () => {
    render(<MobileMenu open onOpenChange={noop} items={MENU} />)
    const dialog = within(screen.getByRole('dialog'))

    expect(dialog.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account')
    expect(dialog.getByRole('link', { name: 'Search' })).toHaveAttribute('href', '/search')
  })

  it('renders the account rows and a sign-out form when given a customer', () => {
    render(
      <MobileMenu
        open
        onOpenChange={noop}
        items={MENU}
        customer={{ name: 'Nando Alvarez', initials: 'NA' }}
      />
    )
    const nav = within(screen.getByRole('navigation', { name: 'Account' }))
    expect(nav.getByText('NA')).toBeInTheDocument()
    expect(nav.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/account')
    expect(nav.getByRole('button', { name: 'Sign out' })).toHaveAttribute('type', 'submit')
  })

  it('honours a custom account href and closes when a link is followed', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      <MobileMenu open onOpenChange={onOpenChange} items={MENU} accountHref="/account/orders" />
    )
    const dialog = within(screen.getByRole('dialog'))

    expect(dialog.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account/orders')

    await user.click(dialog.getByRole('link', { name: 'Shop' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
