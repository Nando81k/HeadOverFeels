// tests/unit/storefront/analytics-island.test.tsx — Analytics, ViewItem, CheckoutButtons tracking (Phase 5, Task 4)
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('server-only', () => ({}))

const pathname = vi.hoisted(() => ({ current: '/' }))
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }))
// `next/script` needs the Next runtime; a plain `<script>` keeps the assertions honest.
vi.mock('next/script', () => ({
  default: ({ children, strategy, ...props }: React.ScriptHTMLAttributes<HTMLScriptElement> & { strategy?: string }) => {
    void strategy
    return React.createElement('script', { ...props, 'data-strategy': strategy }, children)
  },
}))

import { Analytics } from '@/components/storefront/analytics/Analytics'
import { CheckoutButtons } from '@/components/storefront/cart/CheckoutButtons'
import { ViewItem } from '@/components/storefront/pdp/ViewItem'
import { normalizeCart, type RawCart } from '@/lib/shopify/queries/cart'
import cartFixture from '@/tests/fixtures/shopify/cart.json'

type DataLayerWindow = Window & { dataLayer?: unknown[] }
const layer = () => (window as DataLayerWindow).dataLayer ?? []

beforeEach(() => {
  delete (window as DataLayerWindow).dataLayer
  pathname.current = '/'
})

afterEach(cleanup)

describe('Analytics', () => {
  it('tracks a page_view on mount and on each pathname change, with no gtag by default', () => {
    const { container, rerender } = render(<Analytics measurementId={null} />)

    expect(layer()).toEqual([{ event: 'page_view', path: '/', title: '' }])
    expect(container.querySelector('script')).toBeNull()

    pathname.current = '/collections/all'
    rerender(<Analytics measurementId={null} />)
    expect(layer()).toHaveLength(2)
    expect(layer()[1]).toMatchObject({ event: 'page_view', path: '/collections/all' })
  })

  it('loads gtag with send_page_view off when a measurement id is set', () => {
    const { container } = render(<Analytics measurementId="G-TEST123" />)

    const scripts = container.querySelectorAll('script')
    expect(scripts).toHaveLength(2)
    expect(scripts[0]).toHaveAttribute('src', 'https://www.googletagmanager.com/gtag/js?id=G-TEST123')
    expect(scripts[1].textContent).toContain(`gtag('config', "G-TEST123", { send_page_view: false })`)
  })
})

describe('ViewItem', () => {
  it('tracks view_item once, and drop_view for a drop', () => {
    const props = { handle: 'drop-01', title: 'Drop 01', price: { amount: '120.0', currencyCode: 'USD' } }
    const { rerender } = render(<ViewItem {...props} variantId="gid://shopify/ProductVariant/1" dropState="live" />)

    expect(layer()).toEqual([
      {
        event: 'view_item',
        handle: 'drop-01',
        title: 'Drop 01',
        price: 120,
        currency: 'USD',
        variantId: 'gid://shopify/ProductVariant/1',
        dropState: 'live',
      },
      { event: 'drop_view', handle: 'drop-01', state: 'live' },
    ])

    // A variant swap on the same product is not another view.
    rerender(<ViewItem {...props} variantId="gid://shopify/ProductVariant/2" dropState="live" />)
    expect(layer()).toHaveLength(2)
  })
})

describe('CheckoutButtons tracking', () => {
  const cart = normalizeCart(cartFixture.cart as unknown as RawCart)

  it('tracks begin_checkout when a checkout link is followed', () => {
    render(<CheckoutButtons cart={cart} />)

    fireEvent.click(screen.getByRole('link', { name: /checkout ·/i }))

    expect(layer()).toEqual([
      {
        event: 'begin_checkout',
        value: Number(cart.cost.total.amount),
        currency: cart.cost.total.currencyCode,
        items: cart.totalQuantity,
      },
    ])
  })

  it('tracks nothing for a blocked checkout', () => {
    render(<CheckoutButtons cart={{ ...cart, lines: [], totalQuantity: 0 }} />)

    fireEvent.click(screen.getByRole('link', { name: /checkout ·/i }))

    expect(layer()).toEqual([])
  })
})
