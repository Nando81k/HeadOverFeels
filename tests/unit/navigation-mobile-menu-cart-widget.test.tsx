/* eslint-disable @next/next/no-img-element */
import { render, screen, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Navigation } from '@/components/layout/Navigation'

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

// The legacy chrome no longer owns a cart (Phase 3): both cart entry points
// are plain links to the Shopify-backed /cart page, with no count badge.
describe('Navigation cart links', () => {
  it('links the mobile bottom nav cart tab to /cart without a count badge', async () => {
    render(<Navigation />)

    const nav = screen.getByRole('navigation', { name: 'Mobile navigation' })
    const cartTab = Array.from(nav.querySelectorAll('a')).find(
      (link) => link.getAttribute('href') === '/cart'
    )
    expect(cartTab).toBeTruthy()
    expect(cartTab?.textContent).toBe('Cart')

    // The badge used to appear after mount; make sure it stays gone.
    await waitFor(() => {
      expect(screen.queryByTestId('mobile-nav-cart-count')).toBeNull()
    })
  })

  it('renders the desktop cart control as a link to /cart', () => {
    render(<Navigation />)

    // The mobile tab is also named "Cart" (by its text); the desktop control
    // is the icon-only link named by `aria-label`.
    const cartLinks = screen.getAllByRole('link', { name: 'Cart' })
    const cartLink = cartLinks.find((link) => link.getAttribute('aria-label') === 'Cart')
    expect(cartLink).toBeTruthy()
    expect(cartLink).toHaveAttribute('href', '/cart')
    expect(cartLink?.textContent).toBe('')
    for (const link of cartLinks) expect(link).toHaveAttribute('href', '/cart')
    expect(screen.queryByRole('button', { name: /shopping cart/i })).toBeNull()
    expect(screen.queryByRole('dialog', { name: /cart/i })).toBeNull()
  })
})
