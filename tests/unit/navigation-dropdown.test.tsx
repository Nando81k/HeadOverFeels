/* eslint-disable @next/next/no-img-element */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Navigation } from '@/components/layout/Navigation'

const { pushMock, fetchMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  fetchMock: vi.fn(),
}))

const MOCK_MENU_PRODUCTS = [
  {
    id: 'product_1',
    slug: 'calm-hoodie',
    name: 'Calm Hoodie',
    price: 79,
    compareAtPrice: 99,
    images: '["/assets/Sweatshirt_hoodie_collection.png"]',
    category: { name: 'Hoodies' },
    variants: [
      { color: 'Black', colorHex: '#111111', inventory: 12, isActive: true },
      { color: 'Cream', colorHex: '#F2EBDD', inventory: 8, isActive: true },
    ],
  },
  {
    id: 'product_2',
    slug: 'classic-tee',
    name: 'Classic Tee',
    price: 38,
    compareAtPrice: null,
    images: '["/assets/Tee_tops_collection.png"]',
    category: { name: 'T-Shirts' },
    variants: [
      { color: 'Navy', colorHex: '#1D2E4F', inventory: 14, isActive: true },
    ],
  },
]

const MOCK_CATEGORIES = [
  { id: 'cat_hoodies', name: 'Hoodies', slug: 'hoodies' },
  { id: 'cat_tshirts', name: 'T-Shirts', slug: 'tshirts' },
  { id: 'cat_accessories', name: 'Accessories', slug: 'accessories' },
  { id: 'cat_bottoms', name: 'Bottoms', slug: 'bottoms' },
  { id: 'cat_outerwear', name: 'Outerwear', slug: 'outerwear' },
]

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('framer-motion', async () => {
  const React = await import('react')
  const motion = new Proxy(
    {},
    {
      get: (_, elementName) => {
        const MotionComponent = React.forwardRef<HTMLElement, Record<string, unknown>>(
          ({ children, ...props }, ref) =>
            React.createElement(
              elementName as string,
              { ref, ...(props as Record<string, unknown>) },
              children as ReactNode
            )
        )
        MotionComponent.displayName = `Motion${String(elementName)}`
        return MotionComponent
      },
    }
  )

  return {
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
    motion,
    useReducedMotion: () => false,
  }
})

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

describe('Navigation shop dropdown', () => {
  beforeEach(() => {
    pushMock.mockReset()
    fetchMock.mockReset()
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const candidate = input as { url?: string }
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : typeof candidate?.url === 'string'
            ? candidate.url
            : String(input)

      if (url.includes('/api/products?isActive=true&limit=18')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: MOCK_MENU_PRODUCTS }),
        } as Response)
      }

      if (url.includes('/api/categories')) {
        return Promise.resolve({
          ok: true,
          json: async () => MOCK_CATEGORIES,
        } as Response)
      }

      return Promise.resolve({
        ok: false,
        json: async () => ({}),
      } as Response)
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.useRealTimers()
  })

  it('opens on hover and closes on mouse leave with delay', async () => {
    vi.useFakeTimers()
    render(<Navigation />)

    const dropdown = screen.getByTestId('nav-shop-dropdown')
    fireEvent.mouseEnter(dropdown)

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(screen.getByTestId('nav-shop-menu')).toBeTruthy()

    fireEvent.mouseLeave(dropdown)
    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(screen.queryByTestId('nav-shop-menu')).toBeNull()
  })

  it('toggles open and closed on trigger click', async () => {
    render(<Navigation />)

    const trigger = screen.getByTestId('nav-shop-trigger')
    fireEvent.click(trigger)
    expect(screen.getByTestId('nav-shop-menu')).toBeTruthy()

    fireEvent.click(trigger)
    await waitFor(() => {
      expect(screen.queryByTestId('nav-shop-menu')).toBeNull()
    })
  })

  it('closes on outside click', async () => {
    render(<Navigation />)

    fireEvent.click(screen.getByTestId('nav-shop-trigger'))
    expect(screen.getByTestId('nav-shop-menu')).toBeTruthy()

    fireEvent.mouseDown(document.body)
    await waitFor(() => {
      expect(screen.queryByTestId('nav-shop-menu')).toBeNull()
    })
  })

  it('supports Escape close and restores focus to trigger', async () => {
    render(<Navigation />)

    const trigger = screen.getByTestId('nav-shop-trigger') as HTMLButtonElement
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    await screen.findByTestId('nav-shop-menu')

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByTestId('nav-shop-menu')).toBeNull()
      expect(document.activeElement).toBe(trigger)
    })
  })

  it.each([
    { key: 'Enter', focus: 'first' as const },
    { key: ' ', focus: 'first' as const },
    { key: 'ArrowDown', focus: 'first' as const },
    { key: 'ArrowUp', focus: 'last' as const },
  ])('opens via $key and exposes the $focus edge menu item', async ({ key, focus }) => {
    render(<Navigation />)

    const trigger = screen.getByTestId('nav-shop-trigger')
    fireEvent.keyDown(trigger, { key })

    const menu = await screen.findByTestId('nav-shop-menu')
    const items = within(menu).getAllByRole('menuitem')
    expect(items.length).toBeGreaterThan(0)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(focus === 'first' ? items[0] : items[items.length - 1]).toBeTruthy()
  })

  it('renders featured links, category links, and trigger aria attributes', async () => {
    render(<Navigation />)

    const trigger = screen.getByTestId('nav-shop-trigger')
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.getAttribute('aria-controls')).toBe('nav-shop-mega-menu')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(trigger)
    const menu = screen.getByTestId('nav-shop-menu')
    const scoped = within(menu)

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(scoped.getAllByRole('menuitem', { name: /all products/i })[0].getAttribute('href')).toBe('/products')
    expect(scoped.getByRole('menuitem', { name: /collections/i }).getAttribute('href')).toBe('/collections')
    expect(scoped.getByRole('menuitem', { name: /new drops/i }).getAttribute('href')).toBe('/drops')
    expect(scoped.queryByText(/buy now/i)).toBeNull()
    expect(scoped.getByText(/shop right now/i)).toBeTruthy()
    expect(menu.className).toContain('top-full')
    expect(menu.className).not.toContain('pt-5')
    expect(screen.getByTestId('nav-shop-menu-connector')).toBeTruthy()
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/products?isActive=true&limit=18', { cache: 'no-store' })
      expect(fetchMock).toHaveBeenCalledWith('/api/categories', { cache: 'no-store' })
    })

    await waitFor(() => {
      const liveMenu = screen.getByTestId('nav-shop-menu')
      const categoryList = within(liveMenu).getByTestId('desktop-shop-categories')
      const categories = within(categoryList)
      expect(categories.getByRole('menuitem', { name: /hoodies/i }).getAttribute('href')).toContain('/products?category=hoodies')
      expect(categories.getByRole('menuitem', { name: /t-shirts/i }).getAttribute('href')).toContain('/products?category=tshirts')
      expect(categories.getByRole('menuitem', { name: /accessories/i }).getAttribute('href')).toContain('/products?category=accessories')
      expect(categories.getByRole('menuitem', { name: /bottoms/i }).getAttribute('href')).toContain('/products?category=bottoms')
      expect(categories.getByRole('menuitem', { name: /outerwear/i }).getAttribute('href')).toContain('/products?category=outerwear')
    })
    expect(scoped.getByRole('menuitem', { name: /view all products/i }).getAttribute('href')).toBe('/products')
  })

  it('uses dynamic category data in the mobile menu shop category list', async () => {
    render(<Navigation />)

    fireEvent.click(screen.getByRole('button', { name: /toggle menu/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/categories', { cache: 'no-store' })
    })

    const mobileCategoryList = screen.getByTestId('mobile-shop-categories')
    const scoped = within(mobileCategoryList)

    expect(scoped.getByRole('link', { name: /hoodies/i }).getAttribute('href')).toContain('/products?category=hoodies')
    expect(scoped.getByRole('link', { name: /bottoms/i }).getAttribute('href')).toContain('/products?category=bottoms')
    expect(scoped.getByRole('link', { name: /outerwear/i }).getAttribute('href')).toContain('/products?category=outerwear')
  })
})
