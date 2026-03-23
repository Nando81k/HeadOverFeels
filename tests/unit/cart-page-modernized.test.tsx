import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CartPage from '@/app/cart/page'

const { cartState, fetchMock } = vi.hoisted(() => ({
  cartState: {
    items: [] as Array<{
      product: any
      variant: any
      quantity: number
    }>,
    updateQuantity: vi.fn(),
    removeItem: vi.fn(),
    getTotalItems: vi.fn(() => 0),
    getTotalPrice: vi.fn(() => 0),
    getFinalTotal: vi.fn((shipping: number) => ({
      subtotal: 0,
      shipping,
      discount: 0,
      tax: 0,
      total: shipping,
    })),
  },
  fetchMock: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}))

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/components/layout/Navigation', () => ({
  Navigation: () => <div data-testid="navigation" />,
}))

vi.mock('@/components/checkout/CouponInput', () => ({
  CouponInput: () => <div data-testid="coupon-input" />,
}))

vi.mock('@/components/commerce/CommerceEmptyState', () => ({
  CommerceEmptyState: ({ title }: { title: string }) => <div>{title}</div>,
}))

vi.mock('@/components/commerce/SmartDiscoveryRail', () => ({
  SmartDiscoveryRail: ({ title }: { title: string }) => <div>{title}</div>,
}))

vi.mock('@/lib/store/cart', () => ({
  useCartStore: () => cartState,
}))

vi.mock('@/lib/auth/context', () => ({
  useAuth: () => ({ user: null }),
}))

function setCartItems(items: Array<{ product: any; variant: any; quantity: number }>) {
  cartState.items = items
  cartState.getTotalItems.mockImplementation(() => items.reduce((sum, item) => sum + item.quantity, 0))
  cartState.getTotalPrice.mockImplementation(() =>
    items.reduce((sum, item) => sum + (item.variant.price || item.product.price) * item.quantity, 0)
  )
  cartState.getFinalTotal.mockImplementation((shipping: number) => {
    const subtotal = items.reduce((sum, item) => sum + (item.variant.price || item.product.price) * item.quantity, 0)
    const tax = subtotal * 0.08
    return {
      subtotal,
      shipping,
      discount: 0,
      tax,
      total: subtotal + shipping + tax,
    }
  })
}

describe('CartPage modernization behaviors', () => {
  beforeEach(() => {
    vi.useRealTimers()
    cartState.updateQuantity.mockReset()
    cartState.removeItem.mockReset()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: Array.from({ length: 8 }).map((_, index) => ({
          id: `s-${index + 1}`,
          name: `Suggestion ${index + 1}`,
          slug: `suggestion-${index + 1}`,
          price: 10,
          images: '[]',
          isActive: true,
          isFeatured: true,
          variants: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        })),
      }),
    } as Response)
  })

  it('disables checkout when cart has unavailable items', async () => {
    setCartItems([
      {
        product: {
          id: 'p-1',
          name: 'Unavailable Tee',
          slug: 'unavailable-tee',
          price: 30,
          images: '[]',
          isActive: true,
          isFeatured: false,
          variants: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        variant: {
          id: 'v-1',
          sku: 'SKU-1',
          inventory: 0,
          isActive: true,
        },
        quantity: 1,
      },
    ])

    render(<CartPage />)
    await waitFor(() => {
      expect(screen.getByTestId('coupon-input')).toBeTruthy()
    })

    const checkoutButtons = screen.getAllByRole('button', { name: /checkout/i })
    expect(checkoutButtons.length).toBeGreaterThan(0)
    checkoutButtons.forEach((button) => expect(button).toHaveProperty('disabled', true))
  }, 15000)

  it('disables quantity increment button at cap', async () => {
    setCartItems([
      {
        product: {
          id: 'p-2',
          name: 'Limited Hoodie',
          slug: 'limited-hoodie',
          price: 50,
          images: '[]',
          isActive: true,
          isFeatured: false,
          maxQuantity: 5,
          variants: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        variant: {
          id: 'v-2',
          sku: 'SKU-2',
          inventory: 2,
          isActive: true,
        },
        quantity: 2,
      },
    ])

    render(<CartPage />)
    await waitFor(() => {
      expect(screen.getByLabelText('Increase quantity')).toHaveProperty('disabled', true)
    })
  }, 15000)

  it('renders modern empty state when cart is empty', async () => {
    setCartItems([])
    render(<CartPage />)

    await waitFor(() => {
      expect(screen.getByText('Your cart is empty')).toBeTruthy()
    })
  }, 15000)
})
