// tests/unit/storefront/wishlist-page.test.tsx
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/*
 * `/wishlist` (Phase 4, Task 7, mockup board 07): the route, `WishlistPage` and
 * `WishlistGrid`. The real `WishlistProvider` runs in guest mode on top of jsdom
 * localStorage; the Server Actions, the customer context and the cart hook are
 * mocked with their documented contracts.
 */

const { env, actions, customerState, cart } = vi.hoisted(() => ({
  env: { configured: true },
  actions: {
    getWishlistAction: vi.fn(),
    toggleWishlistAction: vi.fn(),
    mergeGuestWishlistAction: vi.fn(),
    wishlistCardsAction: vi.fn(),
  },
  customerState: { current: null as null | { status: string } },
  cart: {
    status: 'ready',
    addLine: vi.fn(),
    openDrawer: vi.fn(),
  },
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/shopify/client', () => ({ storefrontFetch: vi.fn() }))
vi.mock('@/lib/shopify/env', () => ({ hasShopifyEnv: () => env.configured }))
vi.mock('@/app/(storefront)/_actions/wishlist', () => actions)
vi.mock('@/components/storefront/account/useCustomer', () => ({
  useCustomerOptional: () => customerState.current,
}))
vi.mock('@/components/storefront/cart/useCart', () => ({
  useCart: () => cart,
  useCartOptional: () => cart,
}))

vi.mock('next/image', async () => {
  const react = await import('react')
  const nextOnly = new Set(['src', 'alt', 'fill', 'priority', 'sizes', 'quality', 'loader', 'placeholder', 'blurDataURL', 'unoptimized', 'loading'])
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

import WishlistRoute, { metadata } from '@/app/(storefront)/wishlist/page'
import { WishlistGrid, cardState } from '@/components/storefront/wishlist/WishlistGrid'
import { WishlistPage } from '@/components/storefront/wishlist/WishlistPage'
import { WishlistProvider } from '@/components/storefront/wishlist/WishlistProvider'
import {
  normalizeVariantNodes,
  type ProductCardVariant,
  type RawVariantsResponse,
} from '@/lib/shopify/queries/variants'
import { WISHLIST_STORAGE_KEY, readGuestWishlist, type WishlistEntry } from '@/lib/storefront/wishlist'
import variantsFixture from '@/tests/fixtures/shopify/variants.json'

/** Hoodie (addable), crew (on sale), tee (drop-tagged), beanie (sold out). */
const CARDS: ProductCardVariant[] = normalizeVariantNodes(
  (variantsFixture as RawVariantsResponse).nodes
)
const [HOODIE, CREW, TEE, BEANIE] = CARDS
const byId = new Map(CARDS.map((card) => [card.id, card]))

const entry = (card: ProductCardVariant, addedAt: string): WishlistEntry => ({
  variantId: card.id,
  productHandle: card.product.handle,
  addedAt,
})

const ALL: WishlistEntry[] = [
  entry(HOODIE, '2026-10-04T00:00:00.000Z'),
  entry(CREW, '2026-10-03T00:00:00.000Z'),
  entry(TEE, '2026-10-02T00:00:00.000Z'),
  entry(BEANIE, '2026-10-01T00:00:00.000Z'),
]

function seedGuest(entries: WishlistEntry[]) {
  window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(entries))
}

function renderPage() {
  return render(
    <WishlistProvider>
      <WishlistPage />
    </WishlistProvider>
  )
}

const cardFor = (card: ProductCardVariant) =>
  document.querySelector<HTMLElement>(`[data-wishlist-card][data-variant-id="${card.id}"]`)!

beforeEach(() => {
  window.localStorage.clear()
  env.configured = true
  customerState.current = null
  cart.status = 'ready'
  cart.addLine.mockResolvedValue({ ok: true, cart: null })
  actions.getWishlistAction.mockResolvedValue({ ok: true, entries: [] })
  actions.mergeGuestWishlistAction.mockResolvedValue({ ok: true, entries: [] })
  actions.toggleWishlistAction.mockResolvedValue({ ok: true, entries: [] })
  actions.wishlistCardsAction.mockImplementation(async (ids: string[]) =>
    ids.map((id) => byId.get(id)).filter((card): card is ProductCardVariant => Boolean(card))
  )
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ------------------------------------------------------------------ route

describe('app/(storefront)/wishlist', () => {
  it('is noindex and titled', () => {
    expect(metadata.title).toBe('Wishlist')
    expect(metadata.robots).toMatchObject({ index: false })
  })

  it('renders the catalog notice when the store is unconfigured', () => {
    env.configured = false
    render(<WishlistRoute />)

    expect(document.querySelector('[data-catalog="unconfigured"]')).toBeInTheDocument()
    expect(actions.wishlistCardsAction).not.toHaveBeenCalled()
  })

  it('renders the client page (entries come from the provider, nothing is read on the server)', async () => {
    render(
      <WishlistProvider>
        <WishlistRoute />
      </WishlistProvider>
    )

    expect(await screen.findByRole('heading', { level: 1, name: /wishlist/i })).toBeInTheDocument()
    expect(actions.getWishlistAction).not.toHaveBeenCalled()
  })
})

// ------------------------------------------------------------------ states

describe('WishlistPage', () => {
  it('shows the empty state with a way into the catalog and the guest banner', async () => {
    renderPage()

    expect(await screen.findByText(/your wishlist is empty/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /shop/i })).toHaveAttribute('href', '/collections/all')
    const banner = screen.getByText(/sign in to keep this list on every device/i).closest('[data-wishlist-guest]')
    expect(banner).toBeInTheDocument()
    expect(within(banner as HTMLElement).getByRole('link', { name: /sign in/i })).toHaveAttribute(
      'href',
      '/account/login?return_to=/wishlist'
    )
    expect(actions.wishlistCardsAction).not.toHaveBeenCalled()
  })

  it('fetches cards for the saved variants and renders the grid with the right pills and actions', async () => {
    seedGuest(ALL)
    renderPage()

    await screen.findByText('Core Hoodie')
    expect(actions.wishlistCardsAction).toHaveBeenCalledTimes(1)
    expect(actions.wishlistCardsAction).toHaveBeenCalledWith(ALL.map((item) => item.variantId))

    const heading = screen.getByRole('heading', { level: 1, name: /wishlist/i })
    expect(heading).toHaveTextContent('4')

    const cards = document.querySelectorAll('[data-wishlist-card]')
    expect(cards).toHaveLength(4)

    // Hoodie: plain, addable.
    const hoodie = within(cardFor(HOODIE))
    expect(hoodie.getByRole('link', { name: /core hoodie/i })).toHaveAttribute('href', '/products/core-hoodie')
    expect(hoodie.getByText('M / Taupe')).toBeInTheDocument()
    expect(hoodie.getByText('$88.00')).toBeInTheDocument()
    expect(hoodie.getByRole('button', { name: /add to cart/i })).toBeEnabled()
    expect(hoodie.getByRole('button', { name: /remove core hoodie/i })).toBeInTheDocument()
    expect(hoodie.getByRole('img')).toHaveAttribute('alt', 'Core Hoodie in Taupe, front')

    // Crew: on sale.
    const crew = within(cardFor(CREW))
    expect(crew.getByText('Sale')).toBeInTheDocument()
    expect(crew.getByText('$84.00')).toBeInTheDocument()
    expect(crew.getByRole('button', { name: /add to cart/i })).toBeEnabled()

    // Tee: drop-tagged → "Notify me" link to the PDP.
    const tee = within(cardFor(TEE))
    expect(tee.getByText('Drop')).toBeInTheDocument()
    expect(tee.getByRole('link', { name: /notify me/i })).toHaveAttribute('href', `/products/${TEE.product.handle}`)
    expect(tee.queryByRole('button', { name: /add to cart/i })).not.toBeInTheDocument()

    // Beanie: sold out → disabled back-in-stock button, Phase 5.
    const beanie = within(cardFor(BEANIE))
    expect(beanie.getByText('Sold out')).toBeInTheDocument()
    const alert = beanie.getByRole('button', { name: /back in stock alert/i })
    expect(alert).toBeDisabled()
    expect(alert).toHaveAttribute('title', 'Coming in Phase 5')
    expect(beanie.queryByRole('button', { name: /add to cart/i })).not.toBeInTheDocument()
  })

  it('adds a card to the cart through useCart().addLine', async () => {
    const user = userEvent.setup()
    seedGuest([ALL[0]])
    renderPage()

    await user.click(await screen.findByRole('button', { name: /add to cart/i }))

    expect(cart.addLine).toHaveBeenCalledTimes(1)
    expect(cart.addLine.mock.calls[0][0]).toEqual({ variantId: HOODIE.id })
  })

  it('removes a card immediately and from storage via the ×', async () => {
    const user = userEvent.setup()
    seedGuest(ALL)
    renderPage()
    await screen.findByText('Core Hoodie')

    await user.click(within(cardFor(HOODIE)).getByRole('button', { name: /remove core hoodie/i }))

    expect(screen.queryByText('Core Hoodie')).not.toBeInTheDocument()
    expect(document.querySelectorAll('[data-wishlist-card]')).toHaveLength(3)
    expect(readGuestWishlist().map((item) => item.variantId)).toEqual([CREW.id, TEE.id, BEANIE.id])
    // Removing needs no second lookup.
    expect(actions.wishlistCardsAction).toHaveBeenCalledTimes(1)
    expect(actions.toggleWishlistAction).not.toHaveBeenCalled()
  })

  it('"Add all available to cart" adds each addable variant in order and opens the drawer once', async () => {
    const user = userEvent.setup()
    seedGuest(ALL)
    renderPage()
    await screen.findByText('Core Hoodie')

    await user.click(screen.getByRole('button', { name: /add all available to cart/i }))

    await waitFor(() => expect(cart.addLine).toHaveBeenCalledTimes(2))
    expect(cart.addLine.mock.calls.map((call) => call[0].variantId)).toEqual([HOODIE.id, CREW.id])
    expect(cart.addLine.mock.calls.every((call) => call[1]?.open === false)).toBe(true)
    await waitFor(() => expect(cart.openDrawer).toHaveBeenCalledTimes(1))
    // Sequential: the second add only starts after the first settles.
    expect(cart.addLine.mock.invocationCallOrder[0]).toBeLessThan(cart.addLine.mock.invocationCallOrder[1])
  })

  it('hides "Add all" when nothing is addable', async () => {
    seedGuest([ALL[2], ALL[3]])
    renderPage()
    await screen.findByText('Sold out')

    expect(screen.queryByRole('button', { name: /add all available to cart/i })).not.toBeInTheDocument()
  })

  it('shows the merge banner after sign-in and lets it be dismissed', async () => {
    const user = userEvent.setup()
    seedGuest([ALL[0], ALL[1]])
    customerState.current = { status: 'ready' }
    actions.getWishlistAction.mockResolvedValue({ ok: true, entries: [] })
    actions.mergeGuestWishlistAction.mockResolvedValue({ ok: true, entries: [ALL[0], ALL[1]] })
    renderPage()

    const banner = await screen.findByRole('status', { name: /merged/i })
    expect(banner).toHaveTextContent('We merged the 2 items you saved before signing in')
    expect(screen.queryByText(/sign in to keep this list/i)).not.toBeInTheDocument()

    await user.click(within(banner).getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByRole('status', { name: /merged/i })).not.toBeInTheDocument()
  })

  it('notes saved items the catalog no longer has', async () => {
    seedGuest(ALL)
    actions.wishlistCardsAction.mockResolvedValue([HOODIE])
    renderPage()

    await screen.findByText('Core Hoodie')
    expect(document.querySelectorAll('[data-wishlist-card]')).toHaveLength(1)
    expect(screen.getByText(/3 saved items are no longer available/i)).toBeInTheDocument()
  })

  it('shares the list as product links through the clipboard', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn<(text: string) => Promise<void>>(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    seedGuest([ALL[0], ALL[1]])
    renderPage()
    await screen.findByText('Core Hoodie')

    await user.click(screen.getByRole('button', { name: /share list/i }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const text = writeText.mock.calls[0][0]
    expect(text).toContain('/products/core-hoodie')
    expect(text).toContain(`/products/${CREW.product.handle}`)
    expect(await screen.findByText(/copied/i)).toBeInTheDocument()
  })
})

// ------------------------------------------------------------------ grid helpers

describe('WishlistGrid', () => {
  it('classifies cards: sold out beats drop, drop beats addable', () => {
    expect(cardState(HOODIE)).toBe('addable')
    expect(cardState(CREW)).toBe('addable')
    expect(cardState(TEE)).toBe('drop')
    expect(cardState(BEANIE)).toBe('soldout')
    expect(cardState({ ...TEE, availableForSale: false })).toBe('soldout')
  })

  it('marks the pending card busy', async () => {
    render(
      <WishlistGrid
        cards={[HOODIE, CREW]}
        pendingVariantId={CREW.id}
        onRemove={vi.fn()}
        onAddToCart={vi.fn()}
      />
    )

    expect(within(cardFor(CREW)).getByRole('button', { name: /adding/i })).toHaveAttribute('aria-busy', 'true')
    expect(within(cardFor(HOODIE)).getByRole('button', { name: /add to cart/i })).not.toHaveAttribute('aria-busy')
  })

  it('wires remove and add callbacks with the card', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    const onAddToCart = vi.fn()
    render(<WishlistGrid cards={[HOODIE]} onRemove={onRemove} onAddToCart={onAddToCart} />)

    await user.click(screen.getByRole('button', { name: /remove core hoodie/i }))
    await user.click(screen.getByRole('button', { name: /add to cart/i }))

    expect(onRemove).toHaveBeenCalledWith(HOODIE)
    expect(onAddToCart).toHaveBeenCalledWith(HOODIE)
  })

  it('falls back to the product image and skips a default-only option label', () => {
    const noImage: ProductCardVariant = {
      ...HOODIE,
      image: null,
      selectedOptions: [{ name: 'Title', value: 'Default Title' }],
    }
    render(<WishlistGrid cards={[noImage]} onRemove={vi.fn()} onAddToCart={vi.fn()} />)

    expect(screen.getByRole('img')).toHaveAttribute('src', HOODIE.product.featuredImage!.url)
    expect(screen.queryByText('Default Title')).not.toBeInTheDocument()
  })
})

