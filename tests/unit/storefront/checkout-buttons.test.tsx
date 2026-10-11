import * as React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'

// `normalizeCart` lives next to the server-only fetch client.
vi.mock('server-only', () => ({}))
vi.mock('@/lib/shopify/client', () => ({ storefrontFetch: vi.fn() }))
import { render, screen, cleanup } from '@testing-library/react'
import type { Cart } from '@/lib/shopify/types'
import { normalizeCart, type RawCart } from '@/lib/shopify/queries/cart'
import cartFixture from '@/tests/fixtures/shopify/cart.json'
import {
  CheckoutButtons,
  isCheckoutBlocked,
  isSafeCheckoutUrl,
  shopPayHref,
} from '@/components/storefront/cart/CheckoutButtons'

const baseCart: Cart = normalizeCart(cartFixture.cart as unknown as RawCart)
const withUrl = (checkoutUrl: string): Cart => ({ ...baseCart, checkoutUrl })

afterEach(cleanup)

describe('isSafeCheckoutUrl', () => {
  it('accepts Shopify-hosted checkout URLs', () => {
    expect(isSafeCheckoutUrl('https://tgqucm-qg.myshopify.com/cart/c/Z2NwLXVz?key=abc')).toBe(true)
    expect(isSafeCheckoutUrl('https://checkout.shopify.com/checkouts/cn/123')).toBe(true)
    expect(isSafeCheckoutUrl('https://shopify.com/85215183073/checkouts/x')).toBe(true)
  })

  it('accepts the checkout path on a custom storefront domain', () => {
    expect(isSafeCheckoutUrl('https://headoverfeels.com/checkouts/cn/abc')).toBe(true)
    expect(isSafeCheckoutUrl('https://headoverfeels.com/cart/c/abc?key=k')).toBe(true)
  })

  it('rejects other schemes, hosts and malformed values', () => {
    expect(isSafeCheckoutUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeCheckoutUrl('http://tgqucm-qg.myshopify.com/cart/c/abc')).toBe(false)
    expect(isSafeCheckoutUrl('https://evil.example/checkout')).toBe(false)
    expect(isSafeCheckoutUrl('not a url')).toBe(false)
    expect(isSafeCheckoutUrl('')).toBe(false)
  })
})

describe('CheckoutButtons', () => {
  it('links to Shopify checkout and Shop Pay for a valid cart', () => {
    render(<CheckoutButtons cart={baseCart} />)
    const checkout = screen.getByRole('link', { name: /checkout/i })
    expect(checkout).toHaveAttribute('href', baseCart.checkoutUrl)
    expect(screen.getByRole('link', { name: 'Buy with Shop Pay' })).toHaveAttribute(
      'href',
      shopPayHref(baseCart.checkoutUrl)
    )
    expect(isCheckoutBlocked(baseCart)).toBe(false)
  })

  it('disables both links when the checkout URL is not a Shopify checkout', () => {
    const cart = withUrl('javascript:alert(1)')
    render(<CheckoutButtons cart={cart} />)
    expect(isCheckoutBlocked(cart)).toBe(true)
    for (const name of [/checkout/i, 'Buy with Shop Pay']) {
      const link = screen.getByRole('link', { name })
      expect(link).not.toHaveAttribute('href')
      expect(link).toHaveAttribute('aria-disabled', 'true')
    }
  })
})
