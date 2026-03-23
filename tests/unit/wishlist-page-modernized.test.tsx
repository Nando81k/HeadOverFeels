import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WishlistPage from '@/app/wishlist/page'

const {
  syncWithServerMock,
  removeFromWishlistMock,
  addItemMock,
  getItemCountMock,
  pushMock,
  toastMock,
  fetchMock,
  wishlistPayloadRef,
} = vi.hoisted(() => ({
  syncWithServerMock: vi.fn(),
  removeFromWishlistMock: vi.fn(),
  addItemMock: vi.fn(),
  getItemCountMock: vi.fn(),
  pushMock: vi.fn(),
  toastMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  fetchMock: vi.fn(),
  wishlistPayloadRef: {
    current: [] as any[],
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

vi.mock('@/lib/store/cart', () => ({
  useCartStore: () => ({
    addItem: addItemMock,
    getItemCount: getItemCountMock,
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
    addItemMock.mockReset()
    getItemCountMock.mockReset()
    pushMock.mockReset()
    toastMock.success.mockReset()
    toastMock.error.mockReset()
    toastMock.info.mockReset()
    fetchMock.mockReset()

    syncWithServerMock.mockResolvedValue(undefined)
    getItemCountMock.mockReturnValue(0)
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

  it('adds a saved-variant wishlist item to cart via quick add', async () => {
    render(<WishlistPage />)

    await screen.findByText('Product 1')
    fireEvent.click(screen.getByRole('button', { name: 'Add to Cart' }))

    await waitFor(() => {
      expect(addItemMock).toHaveBeenCalledTimes(1)
    })
  })

  it('bulk add only adds resolvable available items', async () => {
    wishlistPayloadRef.current = [createWishlistItem('1', true), createWishlistItem('2', false)]

    render(<WishlistPage />)
    await screen.findByText('Product 1')
    await screen.findByText('Product 2')

    fireEvent.click(screen.getByRole('button', { name: 'Add All Available' }))

    await waitFor(() => {
      expect(addItemMock).toHaveBeenCalledTimes(1)
      expect(toastMock.success).toHaveBeenCalled()
    })
  })

  it('renders modern empty state when wishlist has no items', async () => {
    wishlistPayloadRef.current = []
    render(<WishlistPage />)

    await waitFor(() => {
      expect(screen.getByText('Your wishlist is empty')).toBeTruthy()
    })
  })
})
