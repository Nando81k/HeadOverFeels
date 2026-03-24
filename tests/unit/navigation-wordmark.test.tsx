/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react'
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

vi.mock('@/lib/store/cart', () => ({
  useCartStore: (selector: (state: { getTotalItems: () => number }) => number) =>
    selector({ getTotalItems: () => 0 }),
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

describe('Navigation brand wordmark', () => {
  it('renders mobile and desktop wordmarks with red gradient hover classes', () => {
    render(<Navigation />)

    const mobileWordmark = screen.getByTestId('nav-wordmark-mobile')
    const desktopWordmark = screen.getByTestId('nav-wordmark-desktop')

    expect(mobileWordmark.className).toContain('brand-wordmark')
    expect(mobileWordmark.className).toContain('brand-wordmark--hover-red')
    expect(desktopWordmark.className).toContain('brand-wordmark')
    expect(desktopWordmark.className).toContain('brand-wordmark--hover-red')

    expect(mobileWordmark.closest('a')?.getAttribute('href')).toBe('/')
    expect(desktopWordmark.closest('a')?.getAttribute('href')).toBe('/')
  })
})
