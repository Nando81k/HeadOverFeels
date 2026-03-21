import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReactNode } from 'react'
import ProfilePage from '@/app/profile/page'

const { pushMock, refreshUserMock, signoutMock, mockUser } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshUserMock: vi.fn(async () => undefined),
  signoutMock: vi.fn(async () => undefined),
  mockUser: {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    isAdmin: false,
    currentPoints: 1450,
    annualPointsEarned: 1450,
    lifetimePoints: 2600,
    totalSpent: 320,
    totalOrders: 4,
    newsletter: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    loyaltyTier: {
      slug: 'friend',
      name: 'Friend',
      freeShipping: false,
      earlyDropAccess: false,
    },
  },
}))

vi.mock('next/navigation', () => ({
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

vi.mock('@/components/layout/Navigation', () => ({
  Navigation: () => <nav data-testid="navigation" />,
}))

vi.mock('@/components/profile/RewardsHubSection', () => ({
  RewardsHubSection: ({ embedded = false }: { embedded?: boolean }) => (
    <section data-testid="rewards-hub" data-embedded={embedded ? 'true' : 'false'}>
      Rewards Hub
    </section>
  ),
}))

vi.mock('@/lib/auth/context', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    signout: signoutMock,
    refreshUser: refreshUserMock,
  }),
}))

describe('ProfilePage tabs', () => {
  beforeEach(() => {
    pushMock.mockReset()
    refreshUserMock.mockReset()
    refreshUserMock.mockResolvedValue(undefined)
    signoutMock.mockReset()
    localStorage.clear()
    window.history.pushState({}, '', '/profile')

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/api/orders')) {
        return {
          ok: true,
          json: async () => ({ data: [] }),
        } as Response
      }

      if (url.includes('/api/loyalty/points-history')) {
        return {
          ok: true,
          json: async () => ({ data: [] }),
        } as Response
      }

      return {
        ok: true,
        json: async () => ({ data: [] }),
      } as Response
    }) as unknown as typeof fetch
  })

  it('defaults to Profile tab and keeps Rewards panel lazily unmounted', async () => {
    render(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Profile' })).toBeTruthy()
    })

    expect(screen.getByRole('tab', { name: 'Profile' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Rewards' }).getAttribute('aria-selected')).toBe('false')
    expect(screen.queryByTestId('rewards-hub')).toBeNull()
  })

  it('opens Rewards tab from hash and keeps rewards mounted after switching back', async () => {
    window.history.pushState({}, '', '/profile#rewards')

    render(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Rewards' }).getAttribute('aria-selected')).toBe('true')
      expect(screen.getByTestId('rewards-hub')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Profile' }))

    expect(window.location.hash).toBe('#profile')
    const rewardsPanel = document.getElementById('rewards-panel')
    expect(rewardsPanel?.hidden).toBe(true)
    expect(screen.getByTestId('rewards-hub')).toBeTruthy()
  })

  it('updates hash on tab click and switches via Redeem Rewards CTA', async () => {
    render(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Redeem Rewards' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Redeem Rewards' }))

    expect(window.location.hash).toBe('#rewards')
    expect(screen.getByRole('tab', { name: 'Rewards' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('rewards-hub')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'Profile' }))

    expect(window.location.hash).toBe('#profile')
    expect(screen.getByRole('tab', { name: 'Profile' }).getAttribute('aria-selected')).toBe('true')
  })

  it('supports keyboard tab navigation with arrow keys and Home/End', async () => {
    render(<ProfilePage />)

    const profileTab = await screen.findByRole('tab', { name: 'Profile' })
    profileTab.focus()

    fireEvent.keyDown(profileTab, { key: 'ArrowRight' })

    expect(screen.getByRole('tab', { name: 'Rewards' }).getAttribute('aria-selected')).toBe('true')
    expect(window.location.hash).toBe('#rewards')

    const rewardsTab = screen.getByRole('tab', { name: 'Rewards' })
    rewardsTab.focus()

    fireEvent.keyDown(rewardsTab, { key: 'Home' })
    expect(screen.getByRole('tab', { name: 'Profile' }).getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(profileTab, { key: 'End' })
    expect(screen.getByRole('tab', { name: 'Rewards' }).getAttribute('aria-selected')).toBe('true')
  })
})
