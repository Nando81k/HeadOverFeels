import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReactNode } from 'react'
import ProfilePage from '@/app/profile/page'

const {
  pushMock,
  refreshUserMock,
  signoutMock,
  mockUser,
} = vi.hoisted(() => ({
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
      primaryColor: '#2563EB',
      secondaryColor: '#3730A3',
      freeShipping: false,
      earlyDropAccess: false,
    },
  },
}))

// Mirrors lib/loyalty/tier-progress TIER_HIERARCHY; the Overview loyalty card only renders
// once /api/loyalty/tiers has returned an array of tier definitions.
const MOCK_TIERS = [
  { slug: 'newcomer', name: 'Newcomer', minAnnualPoints: 0, pointMultiplier: 1, primaryColor: '#0A0A0A', secondaryColor: '#404040' },
  { slug: 'friend', name: 'Friend', minAnnualPoints: 1000, pointMultiplier: 1.25, primaryColor: '#2563EB', secondaryColor: '#3730A3' },
  { slug: 'bestie', name: 'Bestie', minAnnualPoints: 3000, pointMultiplier: 1.5, primaryColor: '#DB2777', secondaryColor: '#9D174D' },
  { slug: 'soulmate', name: 'Soulmate', minAnnualPoints: 7500, pointMultiplier: 2, primaryColor: '#7C3AED', secondaryColor: '#4C1D95' },
]

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

// The section nav renders twice (mobile chips + desktop sidebar); both stay in sync,
// so query against the first instance.
const getSectionButton = (name: string) =>
  within(screen.getAllByRole('navigation', { name: 'Profile sections' })[0]).getByRole('button', { name })

describe('ProfilePage sections', () => {
  beforeEach(() => {
    pushMock.mockReset()
    refreshUserMock.mockReset()
    refreshUserMock.mockResolvedValue(undefined)
    signoutMock.mockReset()
    localStorage.clear()
    window.history.pushState({}, '', '/profile')
    // jsdom does not implement scrollIntoView; section changes scroll to the content anchor.
    Element.prototype.scrollIntoView = vi.fn()

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/api/loyalty/tiers')) {
        return {
          ok: true,
          json: async () => MOCK_TIERS,
        } as Response
      }

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

  it('defaults to the Overview section and keeps the Rewards hub lazily unmounted', async () => {
    render(<ProfilePage />)

    await waitFor(() => {
      expect(getSectionButton('Overview').getAttribute('aria-current')).toBe('page')
    })

    expect(getSectionButton('Loyalty').getAttribute('aria-current')).toBeNull()
    expect(screen.queryByTestId('rewards-hub')).toBeNull()
    expect(screen.getByRole('button', { name: /redeem rewards/i })).toBeTruthy()
  })

  it('opens the Loyalty section from the hash and unmounts the Rewards hub after switching back', async () => {
    window.history.pushState({}, '', '/profile#loyalty')

    render(<ProfilePage />)

    await waitFor(() => {
      expect(getSectionButton('Loyalty').getAttribute('aria-current')).toBe('page')
      expect(screen.getByTestId('rewards-hub')).toBeTruthy()
    })

    fireEvent.click(getSectionButton('Overview'))

    expect(window.location.hash).toBe('#overview')
    expect(getSectionButton('Overview').getAttribute('aria-current')).toBe('page')
    // AnimatePresence unmounts after the exit animation — wait for unmount
    await waitFor(() => {
      expect(screen.queryByTestId('rewards-hub')).toBeNull()
    })
  })

  it('updates the hash on section click and switches via the Redeem Rewards CTA', async () => {
    render(<ProfilePage />)

    const redeemCta = await screen.findByRole('button', { name: /redeem rewards/i })
    fireEvent.click(redeemCta)

    expect(window.location.hash).toBe('#loyalty')
    expect(getSectionButton('Loyalty').getAttribute('aria-current')).toBe('page')

    await waitFor(() => {
      expect(screen.getByTestId('rewards-hub')).toBeTruthy()
    })

    fireEvent.click(getSectionButton('Overview'))

    expect(window.location.hash).toBe('#overview')
    expect(getSectionButton('Overview').getAttribute('aria-current')).toBe('page')
  })

  it('shows Bestie as the next tier for a Friend even if lifetime points are high', async () => {
    const originalLifetimePoints = mockUser.lifetimePoints
    const originalAnnualPoints = mockUser.annualPointsEarned
    const originalTier = { ...mockUser.loyaltyTier }

    mockUser.lifetimePoints = 9000
    mockUser.annualPointsEarned = 1450
    mockUser.loyaltyTier = {
      ...mockUser.loyaltyTier,
      slug: 'friend',
      name: 'Friend',
    }

    try {
      render(<ProfilePage />)

      // Progress is driven by annual points (1,450 of Bestie's 3,000), not lifetime points.
      await waitFor(() => {
        expect(
          screen.getByText((_, element) =>
            element?.tagName === 'SPAN' &&
            (element.textContent ?? '').replace(/\s+/g, ' ').trim() === '1,550 pts to Bestie'
          )
        ).toBeTruthy()
      })

      expect(screen.queryByText(/Maximum tier achieved/i)).toBeNull()
    } finally {
      mockUser.lifetimePoints = originalLifetimePoints
      mockUser.annualPointsEarned = originalAnnualPoints
      mockUser.loyaltyTier = originalTier
    }
  })
})
