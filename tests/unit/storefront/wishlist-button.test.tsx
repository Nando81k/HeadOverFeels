// tests/unit/storefront/wishlist-button.test.tsx
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/*
 * `WishlistButton` (Phase 4, Task 7) on its own and inside the PDP buy box.
 * Guest mode only: the provider's server paths are covered by
 * wishlist-provider.test.tsx. No `WishlistProvider` → the heart renders nothing,
 * which is what keeps the PDP and card suites independent of it.
 */

vi.mock('server-only', () => ({}))
vi.mock('@/lib/shopify/client', () => ({ storefrontFetch: vi.fn() }))
vi.mock('@/app/(storefront)/_actions/wishlist', () => ({
  getWishlistAction: vi.fn(async () => ({ ok: true, entries: [] })),
  toggleWishlistAction: vi.fn(async () => ({ ok: false, error: 'real action called' })),
  mergeGuestWishlistAction: vi.fn(async () => ({ ok: false, error: 'real action called' })),
  wishlistCardsAction: vi.fn(async () => []),
}))
vi.mock('@/components/storefront/account/useCustomer', () => ({
  useCustomerOptional: () => null,
}))
vi.mock('@/components/storefront/cart/useCart', () => ({
  useCartOptional: () => null,
  useCart: () => {
    throw new Error('useCart must be used inside <CartProvider>')
  },
}))

import { AddToCartPanel } from '@/components/storefront/pdp/AddToCartPanel'
import { WishlistButton } from '@/components/storefront/wishlist/WishlistButton'
import { WishlistProvider } from '@/components/storefront/wishlist/WishlistProvider'
import { normalizeProduct, type RawProductDetail } from '@/lib/shopify/queries/product'
import { WISHLIST_STORAGE_KEY, readGuestWishlist } from '@/lib/storefront/wishlist'
import type { ProductDetail } from '@/lib/shopify/types'
import productFixture from '@/tests/fixtures/shopify/product-by-handle.json'

const product: ProductDetail = normalizeProduct(
  productFixture.product as unknown as RawProductDetail
)
const blackM = product.variants.find((variant) => variant.title === 'M / Black')!

const HOODIE = 'gid://shopify/ProductVariant/45123456789005'

const heart = () => screen.getByRole('button', { name: /wishlist/i })

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('WishlistButton', () => {
  it('renders nothing without a WishlistProvider', () => {
    const { container } = render(<WishlistButton variantId={HOODIE} productHandle="core-hoodie" />)

    expect(container).toBeEmptyDOMElement()
  })

  it('is an unpressed "Save to wishlist" heart when the variant is not saved', async () => {
    render(
      <WishlistProvider>
        <WishlistButton variantId={HOODIE} productHandle="core-hoodie" />
      </WishlistProvider>
    )

    const button = heart()
    expect(button).toHaveAttribute('aria-label', 'Save to wishlist')
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button).toHaveAttribute('type', 'button')
    expect(button).not.toHaveAttribute('data-saved')
    const icon = button.querySelector('svg')
    expect(icon).toHaveAttribute('aria-hidden', 'true')
    expect(icon).toHaveAttribute('fill', 'none')
  })

  it('toggles to a filled, pressed "Remove from wishlist" heart and persists for guests', async () => {
    const user = userEvent.setup()
    render(
      <WishlistProvider>
        <WishlistButton variantId={HOODIE} productHandle="core-hoodie" />
      </WishlistProvider>
    )

    await user.click(heart())

    const button = heart()
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button).toHaveAttribute('aria-label', 'Remove from wishlist')
    expect(button).toHaveAttribute('data-saved')
    expect(button.querySelector('svg')).toHaveAttribute('fill', 'currentColor')
    expect(readGuestWishlist()).toMatchObject([{ variantId: HOODIE, productHandle: 'core-hoodie' }])

    await user.click(button)
    expect(heart()).toHaveAttribute('aria-pressed', 'false')
    expect(window.localStorage.getItem(WISHLIST_STORAGE_KEY)).toBeNull()
  })

  it('reflects a list saved earlier', async () => {
    window.localStorage.setItem(
      WISHLIST_STORAGE_KEY,
      JSON.stringify([{ variantId: HOODIE, productHandle: 'core-hoodie', addedAt: '2026-10-01T00:00:00.000Z' }])
    )
    render(
      <WishlistProvider>
        <WishlistButton variantId={HOODIE} productHandle="core-hoodie" />
      </WishlistProvider>
    )

    await waitFor(() => expect(heart()).toHaveAttribute('aria-pressed', 'true'))
  })
})

describe('AddToCartPanel wishlist heart', () => {
  it('has no heart without a WishlistProvider', () => {
    render(<AddToCartPanel product={product} selected={blackM} complete action={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /wishlist/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add to cart/i })).toBeInTheDocument()
  })

  it('saves the selected variant under the product handle, next to the submit', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <WishlistProvider>
        <AddToCartPanel product={product} selected={blackM} complete action={vi.fn()} />
      </WishlistProvider>
    )

    const buyBox = container.querySelector('[data-buy-box]') as HTMLElement
    const button = within(buyBox).getByRole('button', { name: /save to wishlist/i })
    expect(button).toHaveAttribute('type', 'button')
    // Sits in the same row as the add-to-cart control.
    expect(button.parentElement).toBe(
      within(buyBox).getByRole('button', { name: /add to cart/i }).parentElement
    )

    await user.click(button)

    expect(readGuestWishlist()).toMatchObject([
      { variantId: blackM.id, productHandle: product.handle },
    ])
    expect(within(buyBox).getByRole('button', { name: /remove from wishlist/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('has no heart while nothing is selected', () => {
    render(
      <WishlistProvider>
        <AddToCartPanel product={product} selected={null} complete={false} action={vi.fn()} />
      </WishlistProvider>
    )

    expect(screen.queryByRole('button', { name: /wishlist/i })).not.toBeInTheDocument()
  })
})
