// tests/unit/storefront/loyalty-cart-preview.test.tsx — CartSummary Care Points preview × tier multiplier (Task 6)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('server-only', () => ({}))

const { customer } = vi.hoisted(() => ({
  customer: { current: null as null | { status: string; loyalty: { multiplier?: number } | null } },
}))
vi.mock('@/components/storefront/account/useCustomer', () => ({
  useCustomerOptional: () => customer.current,
}))

import { normalizeCart, type RawCart } from '@/lib/shopify/queries/cart'
import cartFixture from '@/tests/fixtures/shopify/cart.json'
import { CartSummary, carePointsFor } from '@/components/storefront/cart/CartSummary'

const cart = normalizeCart(cartFixture.cart as unknown as RawCart) // estimated total $95.20

beforeEach(() => {
  customer.current = null
})
afterEach(() => cleanup())

describe('carePointsFor', () => {
  it('floors one point per dollar by default and scales by the multiplier', () => {
    expect(carePointsFor(cart)).toBe(95)
    expect(carePointsFor(cart, 1.5)).toBe(142)
    expect(carePointsFor(cart, 2)).toBe(190)
  })

  it('ignores a missing or invalid multiplier', () => {
    expect(carePointsFor(cart, 0)).toBe(95)
    expect(carePointsFor(cart, Number.NaN)).toBe(95)
  })
})

describe('CartSummary Care Points preview', () => {
  it('shows the 1× estimate for guests', () => {
    render(<CartSummary cart={cart} />)
    expect(screen.getByText(/Taxes and shipping/)).toHaveTextContent('Earn 95 Care Points')
  })

  it('multiplies by the tier multiplier once the customer context is ready', () => {
    customer.current = { status: 'ready', loyalty: { multiplier: 1.5 } }
    render(<CartSummary cart={cart} />)
    const note = screen.getByText(/Taxes and shipping/)
    expect(note).toHaveTextContent('Earn 142 Care Points')
    expect(screen.getByText('142').className).toContain('num')
  })

  it('stays at 1× while the context is loading or has no loyalty summary', () => {
    customer.current = { status: 'loading', loyalty: { multiplier: 1.5 } }
    const { unmount } = render(<CartSummary cart={cart} />)
    expect(screen.getByText(/Taxes and shipping/)).toHaveTextContent('Earn 95 Care Points')
    unmount()
    customer.current = { status: 'ready', loyalty: null }
    render(<CartSummary cart={cart} />)
    expect(screen.getByText(/Taxes and shipping/)).toHaveTextContent('Earn 95 Care Points')
  })
})
