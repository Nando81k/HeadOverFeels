import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { isValidElement, type ReactElement } from 'react'

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/analytics',
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
    expenseCategory: {
      findMany: vi.fn(async () => []),
    },
  },
}))

vi.mock('@/lib/admin/analytics', async () => {
  const actual = await vi.importActual<typeof import('@/lib/admin/analytics')>(
    '@/lib/admin/analytics',
  )
  return {
    ...actual,
    loadAnalyticsKpis: vi.fn(async () => ({
      revenue: 1234,
      revenueTrend: { direction: 'up', text: '↑ 10%' },
      orders: 42,
      ordersTrend: { direction: 'flat', text: '— 0%' },
      aov: 29.4,
      aovTrend: { direction: 'up', text: '↑ 5%' },
      grossMarginPct: 38.5,
      marginTrend: { direction: 'down', text: '↓ 2%' },
    })),
    loadOverviewData: vi.fn(async () => ({
      revenueTrend: [],
      ordersTrend: [],
      acquisitionTrend: [],
      statusDonut: [],
      goals: {
        id: 'default',
        dailyTarget: 0,
        weeklyTarget: 0,
        monthlyTarget: 0,
        quarterlyTarget: 0,
        yearlyTarget: 0,
        updatedAt: new Date(0),
      },
    })),
    loadSalesData: vi.fn(async () => ({ revenueTrend: [], topProducts: [] })),
    loadCustomersData: vi.fn(async () => ({
      acquisitionTrend: [],
      cohort: [],
      ltvScatter: [],
      table: { items: [], total: 0, page: 1, pageSize: 25 },
    })),
    loadProductsData: vi.fn(async () => ({
      topProducts: [],
      marginScatter: [],
      table: { items: [], total: 0, page: 1, pageSize: 25 },
    })),
    loadFinancialData: vi.fn(async () => ({
      revenueExpenseTrend: [],
      marginTrend: [],
      taxSummary: [],
      periodGrid: [],
    })),
    loadExpensesData: vi.fn(async () => ({
      categoryBreakdown: [],
      monthlyBars: [],
      table: { items: [], total: 0, page: 1, pageSize: 25 },
    })),
  }
})

// Stub the tab components so this stays a focused composition smoke test.
vi.mock('@/components/admin/analytics/tabs/OverviewTab', () => ({
  OverviewTab: () => <div data-testid="overview-tab">overview</div>,
}))
vi.mock('@/components/admin/analytics/SalesTab', () => ({
  SalesTab: () => <div data-testid="sales-tab">sales</div>,
}))
vi.mock('@/components/admin/analytics/CustomersTab', () => ({
  CustomersTab: () => <div data-testid="customers-tab">customers</div>,
}))
vi.mock('@/components/admin/analytics/tabs/ProductsTab', () => ({
  ProductsTab: () => <div data-testid="products-tab">products</div>,
}))
vi.mock('@/components/admin/analytics/FinancialTab', () => ({
  FinancialTab: () => <div data-testid="financial-tab">financial</div>,
}))
vi.mock('@/components/admin/analytics/tabs/ExpensesTab', () => ({
  ExpensesTab: ({ isSuperAdmin }: { isSuperAdmin: boolean }) => (
    <div data-testid="expenses-tab">expenses super={String(isSuperAdmin)}</div>
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

describe('AdminAnalyticsV2', () => {
  it('renders all 6 tab labels via AnalyticsTabPills', async () => {
    const { AdminAnalyticsV2 } = await import(
      '@/components/admin/dashboard/AdminAnalyticsV2'
    )
    const element = await AdminAnalyticsV2({ searchParams: {}, isSuperAdmin: true })
    render(element)

    expect(screen.getByRole('tab', { name: /Overview/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Sales/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Customers/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Products/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Financial/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Expenses/i })).toBeInTheDocument()
  })

  it('renders all 5 range labels via AnalyticsRangePills', async () => {
    const { AdminAnalyticsV2 } = await import(
      '@/components/admin/dashboard/AdminAnalyticsV2'
    )
    const element = await AdminAnalyticsV2({ searchParams: {}, isSuperAdmin: false })
    render(element)

    expect(screen.getByRole('tab', { name: /Today/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^7d$/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^30d$/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^90d$/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Year/i })).toBeInTheDocument()
  })

  it('mounts the OverviewSlot when no tab is given (defaults to overview)', async () => {
    const { AdminAnalyticsV2 } = await import(
      '@/components/admin/dashboard/AdminAnalyticsV2'
    )
    const element = await AdminAnalyticsV2({ searchParams: {}, isSuperAdmin: false })
    expect(findChildByTypeName(element, 'OverviewSlot')).not.toBeNull()
  })

  it('mounts the SalesSlot when tab=sales', async () => {
    const { AdminAnalyticsV2 } = await import(
      '@/components/admin/dashboard/AdminAnalyticsV2'
    )
    const element = await AdminAnalyticsV2({
      searchParams: { tab: 'sales' },
      isSuperAdmin: false,
    })
    expect(findChildByTypeName(element, 'SalesSlot')).not.toBeNull()
    expect(findChildByTypeName(element, 'OverviewSlot')).toBeNull()
  })

  it('mounts the CustomersSlot when tab=customers', async () => {
    const { AdminAnalyticsV2 } = await import(
      '@/components/admin/dashboard/AdminAnalyticsV2'
    )
    const element = await AdminAnalyticsV2({
      searchParams: { tab: 'customers' },
      isSuperAdmin: false,
    })
    expect(findChildByTypeName(element, 'CustomersSlot')).not.toBeNull()
  })

  it('mounts the ProductsSlot when tab=products', async () => {
    const { AdminAnalyticsV2 } = await import(
      '@/components/admin/dashboard/AdminAnalyticsV2'
    )
    const element = await AdminAnalyticsV2({
      searchParams: { tab: 'products' },
      isSuperAdmin: false,
    })
    expect(findChildByTypeName(element, 'ProductsSlot')).not.toBeNull()
  })

  it('mounts the FinancialSlot when tab=financial', async () => {
    const { AdminAnalyticsV2 } = await import(
      '@/components/admin/dashboard/AdminAnalyticsV2'
    )
    const element = await AdminAnalyticsV2({
      searchParams: { tab: 'financial' },
      isSuperAdmin: false,
    })
    expect(findChildByTypeName(element, 'FinancialSlot')).not.toBeNull()
  })

  it('mounts the ExpensesSlot when tab=expenses and forwards isSuperAdmin + categories', async () => {
    const { AdminAnalyticsV2 } = await import(
      '@/components/admin/dashboard/AdminAnalyticsV2'
    )
    const element = await AdminAnalyticsV2({
      searchParams: { tab: 'expenses' },
      isSuperAdmin: true,
    })
    const slot = findChildByTypeName(element, 'ExpensesSlot')
    expect(slot).not.toBeNull()
    expect((slot as ReactElement).props).toMatchObject({
      isSuperAdmin: true,
      categories: expect.any(Array),
    })
  })

  it('mounts the KpiStripSlot above the content slot', async () => {
    const { AdminAnalyticsV2 } = await import(
      '@/components/admin/dashboard/AdminAnalyticsV2'
    )
    const element = await AdminAnalyticsV2({ searchParams: {}, isSuperAdmin: false })
    expect(findChildByTypeName(element, 'KpiStripSlot')).not.toBeNull()
  })

  it('forwards the requested range into the slots', async () => {
    const { AdminAnalyticsV2 } = await import(
      '@/components/admin/dashboard/AdminAnalyticsV2'
    )
    const element = await AdminAnalyticsV2({
      searchParams: { tab: 'sales', range: '7d' },
      isSuperAdmin: false,
    })
    const slot = findChildByTypeName(element, 'SalesSlot')
    expect(slot).not.toBeNull()
    expect((slot as ReactElement).props).toMatchObject({ range: '7d' })

    const kpi = findChildByTypeName(element, 'KpiStripSlot')
    expect((kpi as ReactElement).props).toMatchObject({ range: '7d' })
  })

  it('falls back to the overview tab when given an invalid tab value', async () => {
    const { AdminAnalyticsV2 } = await import(
      '@/components/admin/dashboard/AdminAnalyticsV2'
    )
    const element = await AdminAnalyticsV2({
      searchParams: { tab: 'bogus' },
      isSuperAdmin: false,
    })
    expect(findChildByTypeName(element, 'OverviewSlot')).not.toBeNull()
  })

  it('falls back to the 30d range when given an invalid range value', async () => {
    const { AdminAnalyticsV2 } = await import(
      '@/components/admin/dashboard/AdminAnalyticsV2'
    )
    const element = await AdminAnalyticsV2({
      searchParams: { range: 'bogus' },
      isSuperAdmin: false,
    })
    const kpi = findChildByTypeName(element, 'KpiStripSlot')
    expect((kpi as ReactElement).props).toMatchObject({ range: '30d' })
  })
})
