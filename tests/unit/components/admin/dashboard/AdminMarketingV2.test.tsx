import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { isValidElement, type ReactElement } from 'react'

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/marketing',
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

vi.mock('@/lib/admin/marketing', async () => {
  const actual = await vi.importActual<typeof import('@/lib/admin/marketing')>(
    '@/lib/admin/marketing',
  )
  return {
    ...actual,
    loadMarketingKpis: vi.fn(async () => ({
      activePromotions: 3,
      popupConversions7d: 42,
      subscriberCount: 1000,
      subscriberDeltaPct: 12,
      cartsToRecover: 7,
    })),
    loadPromotionsTab: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 25 })),
    loadPopupsTab: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 25 })),
    loadSubscribersTab: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 25 })),
    loadCampaignsTab: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 25 })),
    loadAbandonedCartsTab: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 25 })),
  }
})

// Stub heavy child views so this stays a focused composition smoke test.
vi.mock('@/components/admin/marketing/PromotionsListView', () => ({
  PromotionsListView: ({ rows }: { rows: Array<{ id: string }> }) => (
    <div data-testid="promotions-list-view">promotions rows={rows.length}</div>
  ),
}))
vi.mock('@/components/admin/marketing/PopupsListView', () => ({
  PopupsListView: ({ rows }: { rows: Array<{ id: string }> }) => (
    <div data-testid="popups-list-view">popups rows={rows.length}</div>
  ),
}))
vi.mock('@/components/admin/marketing/SubscribersListView', () => ({
  SubscribersListView: ({ rows, isSuperAdmin }: { rows: Array<{ id: string }>; isSuperAdmin: boolean }) => (
    <div data-testid="subscribers-list-view">
      subscribers rows={rows.length} super={String(isSuperAdmin)}
    </div>
  ),
}))
vi.mock('@/components/admin/marketing/CampaignsListView', () => ({
  CampaignsListView: ({ rows }: { rows: Array<{ id: string }> }) => (
    <div data-testid="campaigns-list-view">campaigns rows={rows.length}</div>
  ),
}))
vi.mock('@/components/admin/marketing/AbandonedCartsListView', () => ({
  AbandonedCartsListView: ({ rows }: { rows: Array<{ id: string }> }) => (
    <div data-testid="carts-list-view">carts rows={rows.length}</div>
  ),
}))

beforeEach(() => {
  process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
  vi.clearAllMocks()
})

/**
 * Recursively look for a React element whose type's name matches `name`.
 * Async server-component children show up as functions whose .name we can match
 * (their Suspense children don't resolve through RTL in jsdom).
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

describe('AdminMarketingV2', () => {
  it('renders all 5 tab labels via MarketingTabPills', async () => {
    const { AdminMarketingV2 } = await import(
      '@/components/admin/dashboard/AdminMarketingV2'
    )
    const element = await AdminMarketingV2({ searchParams: {}, isSuperAdmin: true })
    render(element)

    expect(screen.getByRole('tab', { name: /Promotions/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Popups/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Subscribers/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Campaigns/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Abandoned Carts/i })).toBeInTheDocument()
  })

  it('renders the filter bar placeholder', async () => {
    const { AdminMarketingV2 } = await import(
      '@/components/admin/dashboard/AdminMarketingV2'
    )
    const element = await AdminMarketingV2({ searchParams: {}, isSuperAdmin: false })
    render(element)
    expect(screen.getByText(/Filter bar — Phase 5\.5/)).toBeInTheDocument()
  })

  it('mounts the PromotionsSlot when no tab is given (defaults to promotions)', async () => {
    const { AdminMarketingV2 } = await import(
      '@/components/admin/dashboard/AdminMarketingV2'
    )
    const element = await AdminMarketingV2({ searchParams: {}, isSuperAdmin: false })
    expect(findChildByTypeName(element, 'PromotionsSlot')).not.toBeNull()
  })

  it('mounts the PopupsSlot when tab=popups', async () => {
    const { AdminMarketingV2 } = await import(
      '@/components/admin/dashboard/AdminMarketingV2'
    )
    const element = await AdminMarketingV2({ searchParams: { tab: 'popups' }, isSuperAdmin: false })
    expect(findChildByTypeName(element, 'PopupsSlot')).not.toBeNull()
    expect(findChildByTypeName(element, 'PromotionsSlot')).toBeNull()
  })

  it('mounts the SubscribersSlot when tab=subscribers and forwards isSuperAdmin', async () => {
    const { AdminMarketingV2 } = await import(
      '@/components/admin/dashboard/AdminMarketingV2'
    )
    const element = await AdminMarketingV2({
      searchParams: { tab: 'subscribers' },
      isSuperAdmin: true,
    })
    const slot = findChildByTypeName(element, 'SubscribersSlot')
    expect(slot).not.toBeNull()
    expect((slot as ReactElement).props).toMatchObject({ isSuperAdmin: true })
  })

  it('mounts the CampaignsSlot when tab=campaigns', async () => {
    const { AdminMarketingV2 } = await import(
      '@/components/admin/dashboard/AdminMarketingV2'
    )
    const element = await AdminMarketingV2({
      searchParams: { tab: 'campaigns' },
      isSuperAdmin: false,
    })
    expect(findChildByTypeName(element, 'CampaignsSlot')).not.toBeNull()
  })

  it('mounts the AbandonedCartsSlot when tab=abandoned-carts', async () => {
    const { AdminMarketingV2 } = await import(
      '@/components/admin/dashboard/AdminMarketingV2'
    )
    const element = await AdminMarketingV2({
      searchParams: { tab: 'abandoned-carts' },
      isSuperAdmin: false,
    })
    expect(findChildByTypeName(element, 'AbandonedCartsSlot')).not.toBeNull()
  })

  it('mounts the KpiStripSlot above the content slot', async () => {
    const { AdminMarketingV2 } = await import(
      '@/components/admin/dashboard/AdminMarketingV2'
    )
    const element = await AdminMarketingV2({ searchParams: {}, isSuperAdmin: false })
    expect(findChildByTypeName(element, 'KpiStripSlot')).not.toBeNull()
  })

  it('falls back to the promotions tab when given an invalid tab value', async () => {
    const { AdminMarketingV2 } = await import(
      '@/components/admin/dashboard/AdminMarketingV2'
    )
    const element = await AdminMarketingV2({
      searchParams: { tab: 'bogus' },
      isSuperAdmin: false,
    })
    expect(findChildByTypeName(element, 'PromotionsSlot')).not.toBeNull()
  })
})
