/* eslint-disable @next/next/no-img-element */
import { render, screen, within } from '@testing-library/react'
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
  useCartStore: (selector: (state: { getTotalItems: () => number; items: never[]; updateQuantity: () => void; removeItem: () => void }) => unknown) =>
    selector({ getTotalItems: () => 0, items: [], updateQuantity: () => {}, removeItem: () => {} }),
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
  it('renders mobile and desktop logo groups with face icons and image wordmark', () => {
    render(<Navigation />)

    const mobileWordmark = screen.getByTestId('nav-wordmark-mobile') as HTMLImageElement
    const desktopWordmark = screen.getByTestId('nav-wordmark-desktop') as HTMLImageElement

    expect(mobileWordmark.getAttribute('alt')).toBe('Head Over Feels')
    expect(mobileWordmark.getAttribute('src')).toContain('/assets/head-over-feels-wordmark.png')
    expect(desktopWordmark.getAttribute('alt')).toBe('Head Over Feels')
    expect(desktopWordmark.getAttribute('src')).toContain('/assets/head-over-feels-wordmark.png')

    const mobileLink = mobileWordmark.closest('a')
    const desktopLink = desktopWordmark.closest('a')

    expect(mobileLink?.getAttribute('href')).toBe('/')
    expect(desktopLink?.getAttribute('href')).toBe('/')

    const mobileFaces = within(mobileLink as HTMLElement).getAllByRole('img', { name: 'Head Over Feels Logo' })
    const desktopFaces = within(desktopLink as HTMLElement).getAllByRole('img', { name: 'Head Over Feels Logo' })

    expect(mobileFaces).toHaveLength(2)
    expect(desktopFaces).toHaveLength(2)

    mobileFaces.forEach((faceImage) => {
      expect((faceImage as HTMLImageElement).getAttribute('src')).toContain('/assets/head-over-feels-logo.png')
    })
    desktopFaces.forEach((faceImage) => {
      expect((faceImage as HTMLImageElement).getAttribute('src')).toContain('/assets/head-over-feels-logo.png')
    })
  })
})
