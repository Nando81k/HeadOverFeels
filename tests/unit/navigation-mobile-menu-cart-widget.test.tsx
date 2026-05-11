/* eslint-disable @next/next/no-img-element */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Navigation } from '@/components/layout/Navigation'

const { cartState } = vi.hoisted(() => ({
  cartState: { count: 0 },
}))

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
  useCartStore: (selector: (state: { getTotalItems: () => number; items: never[]; updateQuantity: () => void; removeItem: () => void }) => unknown) =>
    selector({ getTotalItems: () => cartState.count, items: [], updateQuantity: () => {}, removeItem: () => {} }),
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

describe('Navigation mobile menu cart widget', () => {
  beforeEach(() => {
    cartState.count = 0
  })

  it('shows cart item count on the hamburger toggle before menu opens', async () => {
    cartState.count = 4
    render(<Navigation />)

    await waitFor(() => {
      expect(screen.getByTestId('nav-mobile-menu-cart-count')).toBeTruthy()
    })

    const widget = screen.getByTestId('nav-mobile-menu-cart-count')
    expect(widget.textContent).toBe('4')
  })

  it('hides cart widget when there are no items', () => {
    cartState.count = 0
    render(<Navigation />)

    expect(screen.queryByTestId('nav-mobile-menu-cart-count')).toBeNull()
  })

  it('hides the widget after opening the mobile menu', async () => {
    cartState.count = 3
    render(<Navigation />)

    await waitFor(() => {
      expect(screen.getByTestId('nav-mobile-menu-cart-count')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Toggle menu' }))
    expect(screen.queryByTestId('nav-mobile-menu-cart-count')).toBeNull()
  })
})
