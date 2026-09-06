/* eslint-disable @next/next/no-img-element */
import { render, screen, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Navigation } from '@/components/layout/Navigation'

type MockCartItem = {
  quantity: number
  variant: { price: number }
  product: { price: number }
}

const { cartState } = vi.hoisted(() => ({
  cartState: { items: [] as MockCartItem[] },
}))

// MiniCart derives a subtotal from `items` even while closed, so each item needs a priced variant/product.
const makeCartItem = (quantity: number): MockCartItem => ({
  quantity,
  variant: { price: 40 },
  product: { price: 40 },
})

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: ReactNode
    [key: string]: unknown
  }) => <a href={href} {...props}>{children}</a>,
}))

vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    ...props
  }: {
    src: string
    alt: string
    [key: string]: unknown
  }) => <img src={src} alt={alt} {...props} />,
}))

vi.mock('@/components/search', () => ({
  SearchModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="search-modal" /> : null),
}))

vi.mock('@/lib/store/cart', () => ({
  useCartStore: (
    selector: (state: {
      getTotalItems: () => number
      items: MockCartItem[]
      updateQuantity: () => void
      removeItem: () => void
    }) => unknown
  ) =>
    selector({
      getTotalItems: () => cartState.items.reduce((total, item) => total + item.quantity, 0),
      items: cartState.items,
      updateQuantity: () => {},
      removeItem: () => {},
    }),
}))

vi.mock('@/lib/auth/context', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    signout: vi.fn(),
  }),
}))

vi.mock('@/components/wishlist/WishlistIcon', () => ({
  WishlistIcon: () => <div data-testid="wishlist-icon" />,
}))

vi.mock('@/components/notifications/NotificationCenter', () => ({
  NotificationCenter: () => <div data-testid="notification-center" />,
}))

describe('Navigation mobile cart badge', () => {
  beforeEach(() => {
    cartState.items = []
  })

  it('shows the cart item count on the mobile bottom nav cart tab once mounted', async () => {
    cartState.items = [makeCartItem(3), makeCartItem(1)]
    render(<Navigation />)

    // The badge is suppressed until after mount to avoid SSR hydration mismatches
    await waitFor(() => {
      expect(screen.getByTestId('mobile-nav-cart-count')).toBeTruthy()
    })

    expect(screen.getByTestId('mobile-nav-cart-count').textContent).toBe('4')
  })

  it('hides the cart badge when there are no items', () => {
    render(<Navigation />)

    expect(screen.queryByTestId('mobile-nav-cart-count')).toBeNull()
  })
})
