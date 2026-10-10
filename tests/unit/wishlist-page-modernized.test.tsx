import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WishlistPage from '@/app/wishlist/page'

const {
  syncWithServerMock,
  removeFromWishlistMock,
  pushMock,
  toastMock,
  fetchMock,
  wishlistPayloadRef,
} = vi.hoisted(() => ({
  syncWithServerMock: vi.fn(),
  removeFromWishlistMock: vi.fn(),
  pushMock: vi.fn(),
  toastMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  fetchMock: vi.fn(),
  wishlistPayloadRef: {
    current: [] as unknown[],
  },
}))

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}))

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/components/layout/Navigation', () => ({
  Navigation: () => <div data-testid="navigation" />,
}))

vi.mock('@/components/commerce/CommerceEmptyState', () => ({
  CommerceEmptyState: ({ title }: { title: string }) => <div>{title}</div>,
}))

vi.mock('@/components/commerce/SmartDiscoveryRail', () => ({
  SmartDiscoveryRail: ({ title }: { title: string }) => <div>{title}</div>,
}))

vi.mock('@/lib/store/wishlist', () => ({
  useWishlistStore: () => ({
    syncWithServer: syncWithServerMock,
    removeFromWishlist: removeFromWishlistMock,
  }),
}))

vi.mock('@/lib/toast', () => ({
  toast: toastMock,
}))

function createWishlistItem(id: string, withVariant = true) {
  return {
    id,
    productId: `product-${id}`,
    createdAt: '2026-03-21T12:00:00.000Z',
    product: {
      id: `product-${id}`,
      name: `Product ${id}`,
      slug: `product-${id}`,
      price: 80,
      images: '[]',
      isActive: true,
    },
    productVariant: withVariant
      ? {
          id: `variant-${id}`,
          sku: `SKU-${id}`,
          inventory: 4,
          isActive: true,
        }
      : null,
  }
}

describe('WishlistPage modernization behaviors', () => {
  beforeEach(() => {
    syncWithServerMock.mockReset()
    removeFromWishlistMock.mockReset()
    pushMock.mockReset()
    toastMock.success.mockReset()
    toastMock.error.mockReset()
    toastMock.info.mockReset()
    fetchMock.mockReset()

    syncWithServerMock.mockResolvedValue(undefined)
    wishlistPayloadRef.current = [createWishlistItem('1')]

    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url === '/api/wishlist') {
        return {
          ok: true,
          json: async () => ({ data: wishlistPayloadRef.current }),
        } as Response
      }

      if (url.startsWith('/api/products?')) {
        return {
          ok: true,
          json: async () => ({ data: [] }),
        } as Response
      }

      if (url.startsWith('/api/products/')) {
        return {
          ok: true,
          json: async () => ({
            id: 'product-2',
            name: 'Product 2',
            slug: 'product-2',
            price: 100,
            images: '[]',
            isActive: true,
            isFeatured: false,
            variants: [
              { id: 'v-2a', sku: 'V-2A', inventory: 2, isActive: true },
              { id: 'v-2b', sku: 'V-2B', inventory: 3, isActive: true },
            ],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          }),
        } as Response
      }

      return {
        ok: true,
        json: async () => ({}),
      } as Response
    })
  })

  it('quick add opens the product page instead of a local cart', async () => {
    render(<WishlistPage />)

    await screen.findByText('Product 1')
    fireEvent.click(screen.getByRole('button', { name: 'Add to Cart' }))

    expect(pushMock).toHaveBeenCalledTimes(1)
    expect(pushMock).toHaveBeenCalledWith('/products/product-1')
    // No product-detail lookups: variant resolution now happens on the PDP.
    expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith('/api/products/'))).toBe(false)
  })

  it('bulk action opens the first available item', async () => {
    const unavailable = createWishlistItem('1', true)
    unavailable.productVariant!.inventory = 0
    wishlistPayloadRef.current = [unavailable, createWishlistItem('2', false)]

    render(<WishlistPage />)
    await screen.findByText('Product 1')
    await screen.findByText('Product 2')

    fireEvent.click(screen.getByRole('button', { name: 'Shop Available' }))

    expect(pushMock).toHaveBeenCalledWith('/products/product-2')
    expect(toastMock.success).not.toHaveBeenCalled()
  })

  it('disables the bulk action when nothing is available', async () => {
    const unavailable = createWishlistItem('1', true)
    unavailable.productVariant!.inventory = 0
    wishlistPayloadRef.current = [unavailable]

    render(<WishlistPage />)
    await screen.findByText('Product 1')

    expect(screen.getByRole('button', { name: 'Shop Available' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add to Cart' })).toBeDisabled()
  })

  it('renders modern empty state when wishlist has no items', async () => {
    wishlistPayloadRef.current = []
    render(<WishlistPage />)

    await waitFor(() => {
      expect(screen.getByText('Your wishlist is empty')).toBeTruthy()
    })
  })
})
