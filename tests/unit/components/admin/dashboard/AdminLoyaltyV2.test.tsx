import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { isValidElement, type ReactElement } from 'react'

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/loyalty',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/auth/context', () => ({
  useAuth: () => ({ user: { id: '1', isAdmin: true, name: 'Admin', adminRole: 'ADMIN' } }),
}))

vi.mock('@/lib/auth/admin', () => ({
  requireAdmin: vi.fn(async () => 'admin-1'),
  requireAdminRole: vi.fn(async () => 'admin-1'),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      findUnique: vi.fn(async () => ({ adminRole: 'SUPER_ADMIN' })),
    },
  },
}))

vi.mock('@/lib/admin/loyalty', async () => {
  const actual = await vi.importActual<typeof import('@/lib/admin/loyalty')>(
    '@/lib/admin/loyalty',
  )
  return {
    ...actual,
    loadLoyaltyKpis: vi.fn(async () => ({
      activeMembers: 5,
      pointsEarned: 100,
      pointsEarnedTrend: { direction: 'flat', text: '— 0%' },
      pointsRedeemed: 50,
      pointsRedeemedTrend: { direction: 'flat', text: '— 0%' },
      redemptionRate: 50,
      redemptionRateTrend: { direction: 'flat', text: '— 0%' },
    })),
    loadOverviewData: vi.fn(async () => ({
      pointsActivity: [],
      tierDistribution: [],
      topRewards: [],
      memberGrowth: [],
      tierPerks: [],
      rewardActivations: [],
      recentTransactions: [],
      popularRewards: [],
    })),
    loadMembersTab: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 25 })),
    loadTiersTab: vi.fn(async () => []),
    loadRewardsTab: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 25 })),
    loadRedemptionsTab: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 25 })),
    loadEventsTab: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 25 })),
    loadLoyaltySettings: vi.fn(async () => ({
      id: 'default',
      isEnabled: true,
      programName: 'Test',
      pointsPerDollar: 1,
      pointsRoundingMode: 'floor',
      minimumOrderForPoints: 0,
      referralPointsReferrer: 100,
      referralPointsReferred: 50,
      referralEnabled: true,
      reviewPointsEnabled: true,
      reviewPointsAmount: 25,
      reviewWithPhotoBonus: 25,
      birthdayRewardsEnabled: true,
      birthdayRewardType: 'points',
      birthdayRewardValue: 100,
      birthdayRewardExpireDays: 30,
      pointsExpireEnabled: true,
      pointsExpireMonths: 12,
      tierEvaluationPeriod: 'annual',
      tierDowngradeEnabled: false,
      showPointsInCart: true,
      showPointsInCheckout: true,
      showTierProgress: true,
      updatedAt: new Date(0),
    })),
  }
})

// Stub the tab + settings button components so this stays a focused
// composition smoke test (no chart/inspector trees mounted).
vi.mock('@/components/admin/loyalty/tabs/OverviewTab', () => ({
  OverviewTab: () => <div data-testid="overview-tab">overview</div>,
}))
vi.mock('@/components/admin/loyalty/tabs/MembersTab', () => ({
  MembersTab: ({ isSuperAdmin }: { isSuperAdmin: boolean }) => (
    <div data-testid="members-tab">members super={String(isSuperAdmin)}</div>
  ),
}))
vi.mock('@/components/admin/loyalty/tabs/TiersTab', () => ({
  TiersTab: ({ isSuperAdmin }: { isSuperAdmin: boolean }) => (
    <div data-testid="tiers-tab">tiers super={String(isSuperAdmin)}</div>
  ),
}))
vi.mock('@/components/admin/loyalty/tabs/RewardsTab', () => ({
  RewardsTab: () => <div data-testid="rewards-tab">rewards</div>,
}))
vi.mock('@/components/admin/loyalty/tabs/RedemptionsTab', () => ({
  RedemptionsTab: ({ isSuperAdmin }: { isSuperAdmin: boolean }) => (
    <div data-testid="redemptions-tab">redemptions super={String(isSuperAdmin)}</div>
  ),
}))
vi.mock('@/components/admin/loyalty/tabs/EventsTab', () => ({
  EventsTab: () => <div data-testid="events-tab">events</div>,
}))
vi.mock('@/components/admin/loyalty/LoyaltySettingsButton', () => ({
  LoyaltySettingsButton: () => <div data-testid="settings-btn">settings</div>,
}))

beforeEach(() => {
  process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
  vi.clearAllMocks()
})

/**
 * Recursively look for a React element whose type's name matches `name`.
 * Async server-component children show up as functions whose .name we can match
 * (their Suspense children don't resolve through RTL in jsdom). Same helper
 * used by AdminAnalyticsV2.test.tsx (Phase 6 precedent).
 */
function findChildByTypeName(node: unknown, name: string): ReactElement | null {
  if (!node) return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findChildByTypeName(child, name)
      if (found) return found
    }
    return null
  }
  if (!isValidElement(node)) return null
  const type = node.type as { name?: string; displayName?: string } | string
  const typeName = typeof type === 'string' ? type : type.name ?? type.displayName
  if (typeName === name) return node
  const props = node.props as { children?: unknown }
  return findChildByTypeName(props.children, name)
}

describe('AdminLoyaltyV2', () => {
  it('renders all 6 tab labels via LoyaltyTabPills', async () => {
    const { AdminLoyaltyV2 } = await import(
      '@/components/admin/dashboard/AdminLoyaltyV2'
    )
    const element = await AdminLoyaltyV2({ searchParams: {}, isSuperAdmin: true })
    render(element)

    expect(screen.getByRole('tab', { name: /Overview/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Members/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Tiers/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Rewards/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Redemptions/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Events/i })).toBeInTheDocument()
  })

  it('renders all 5 range labels via LoyaltyRangePills', async () => {
    const { AdminLoyaltyV2 } = await import(
      '@/components/admin/dashboard/AdminLoyaltyV2'
    )
    const element = await AdminLoyaltyV2({ searchParams: {}, isSuperAdmin: false })
    render(element)

    expect(screen.getByRole('tab', { name: /Today/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^7d$/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^30d$/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^90d$/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Year/i })).toBeInTheDocument()
  })

  it('mounts the OverviewSlot when no tab is given (defaults to overview)', async () => {
    const { AdminLoyaltyV2 } = await import(
      '@/components/admin/dashboard/AdminLoyaltyV2'
    )
    const element = await AdminLoyaltyV2({ searchParams: {}, isSuperAdmin: false })
    expect(findChildByTypeName(element, 'OverviewSlot')).not.toBeNull()
  })

  it('mounts the MembersSlot when tab=members', async () => {
    const { AdminLoyaltyV2 } = await import(
      '@/components/admin/dashboard/AdminLoyaltyV2'
    )
    const element = await AdminLoyaltyV2({
      searchParams: { tab: 'members' },
      isSuperAdmin: true,
    })
    const slot = findChildByTypeName(element, 'MembersSlot')
    expect(slot).not.toBeNull()
    expect((slot as ReactElement).props).toMatchObject({ isSuperAdmin: true })
    expect(findChildByTypeName(element, 'OverviewSlot')).toBeNull()
  })

  it('mounts the TiersSlot when tab=tiers and forwards isSuperAdmin', async () => {
    const { AdminLoyaltyV2 } = await import(
      '@/components/admin/dashboard/AdminLoyaltyV2'
    )
    const element = await AdminLoyaltyV2({
      searchParams: { tab: 'tiers' },
      isSuperAdmin: true,
    })
    const slot = findChildByTypeName(element, 'TiersSlot')
    expect(slot).not.toBeNull()
    expect((slot as ReactElement).props).toMatchObject({ isSuperAdmin: true })
  })

  it('mounts the RewardsSlot when tab=rewards', async () => {
    const { AdminLoyaltyV2 } = await import(
      '@/components/admin/dashboard/AdminLoyaltyV2'
    )
    const element = await AdminLoyaltyV2({
      searchParams: { tab: 'rewards' },
      isSuperAdmin: false,
    })
    expect(findChildByTypeName(element, 'RewardsSlot')).not.toBeNull()
  })

  it('mounts the RedemptionsSlot when tab=redemptions and forwards isSuperAdmin', async () => {
    const { AdminLoyaltyV2 } = await import(
      '@/components/admin/dashboard/AdminLoyaltyV2'
    )
    const element = await AdminLoyaltyV2({
      searchParams: { tab: 'redemptions' },
      isSuperAdmin: true,
    })
    const slot = findChildByTypeName(element, 'RedemptionsSlot')
    expect(slot).not.toBeNull()
    expect((slot as ReactElement).props).toMatchObject({ isSuperAdmin: true })
  })

  it('mounts the EventsSlot when tab=events', async () => {
    const { AdminLoyaltyV2 } = await import(
      '@/components/admin/dashboard/AdminLoyaltyV2'
    )
    const element = await AdminLoyaltyV2({
      searchParams: { tab: 'events' },
      isSuperAdmin: false,
    })
    expect(findChildByTypeName(element, 'EventsSlot')).not.toBeNull()
  })

  it('mounts the KpiStripSlot above the content slot', async () => {
    const { AdminLoyaltyV2 } = await import(
      '@/components/admin/dashboard/AdminLoyaltyV2'
    )
    const element = await AdminLoyaltyV2({ searchParams: {}, isSuperAdmin: false })
    expect(findChildByTypeName(element, 'KpiStripSlot')).not.toBeNull()
  })

  it('mounts the SettingsBtnSlot in the header row', async () => {
    const { AdminLoyaltyV2 } = await import(
      '@/components/admin/dashboard/AdminLoyaltyV2'
    )
    const element = await AdminLoyaltyV2({ searchParams: {}, isSuperAdmin: false })
    expect(findChildByTypeName(element, 'SettingsBtnSlot')).not.toBeNull()
  })

  it('forwards the requested range into the slots', async () => {
    const { AdminLoyaltyV2 } = await import(
      '@/components/admin/dashboard/AdminLoyaltyV2'
    )
    const element = await AdminLoyaltyV2({
      searchParams: { tab: 'redemptions', range: '7d' },
      isSuperAdmin: false,
    })
    const slot = findChildByTypeName(element, 'RedemptionsSlot')
    expect(slot).not.toBeNull()
    expect((slot as ReactElement).props).toMatchObject({ range: '7d' })

    const kpi = findChildByTypeName(element, 'KpiStripSlot')
    expect((kpi as ReactElement).props).toMatchObject({ range: '7d' })
  })

  it('falls back to the overview tab when given an invalid tab value', async () => {
    const { AdminLoyaltyV2 } = await import(
      '@/components/admin/dashboard/AdminLoyaltyV2'
    )
    const element = await AdminLoyaltyV2({
      searchParams: { tab: 'bogus' },
      isSuperAdmin: false,
    })
    expect(findChildByTypeName(element, 'OverviewSlot')).not.toBeNull()
  })

  it('falls back to the 30d range when given an invalid range value', async () => {
    const { AdminLoyaltyV2 } = await import(
      '@/components/admin/dashboard/AdminLoyaltyV2'
    )
    const element = await AdminLoyaltyV2({
      searchParams: { range: 'bogus' },
      isSuperAdmin: false,
    })
    const kpi = findChildByTypeName(element, 'KpiStripSlot')
    expect((kpi as ReactElement).props).toMatchObject({ range: '30d' })
  })
})
