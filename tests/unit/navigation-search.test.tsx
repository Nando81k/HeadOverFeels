import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Navigation } from '@/components/layout/Navigation'

const { pushMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: pushMock }),
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
  SearchModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
    isOpen ? (
      <div data-testid="search-modal">
        <button onClick={onClose}>Close mocked search</button>
      </div>
    ) : null
  ),
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

describe('Navigation search triggers', () => {
  beforeEach(() => {
    pushMock.mockReset()
  })

  it('opens search from desktop trigger and closes via modal callback', async () => {
    render(<Navigation />)

    fireEvent.click(screen.getByTestId('nav-search-trigger-desktop'))
    expect(screen.getByTestId('search-modal')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Close mocked search' }))
    await waitFor(() => {
      expect(screen.queryByTestId('search-modal')).toBeNull()
    })
  })

  it('does not render a mobile search trigger', () => {
    render(<Navigation />)

    expect(screen.queryByTestId('nav-search-trigger-mobile')).toBeNull()
  })

  it('supports Cmd/Ctrl + K to open and Escape to close', async () => {
    render(<Navigation />)

    fireEvent.keyDown(document, { key: 'k', metaKey: true })
    expect(screen.getByTestId('search-modal')).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByTestId('search-modal')).toBeNull()
    })
  })
})
