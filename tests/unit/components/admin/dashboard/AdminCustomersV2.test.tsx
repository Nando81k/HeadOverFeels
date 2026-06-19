import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/customers',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/auth/context', () => ({
  useAuth: () => ({ user: { id: '1', isAdmin: true, name: 'Admin', adminRole: 'ADMIN' } }),
}))

vi.mock('@/lib/admin/customers', () => ({
  loadCustomersKpis: vi.fn().mockResolvedValue({
    totalCustomers: 10, newInRange: 2,
    newInRangeTrend: { direction: 'flat', text: '— 0%' },
    avgLtv: 100, atRiskCount: 0,
  }),
  loadCustomersTab: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
  isCustomersTab: (v: unknown) =>
    typeof v === 'string' && ['all', 'vip', 'at-risk', 'inactive', 'recent'].includes(v),
  isTimeRange: (v: unknown) =>
    typeof v === 'string' && ['today', '7d', '30d', '90d', 'year'].includes(v),
}))

vi.mock('@/components/admin/dashboard/CustomersTabPills', () => ({
  CustomersTabPills: () => <div data-testid="tab-pills" />,
}))
vi.mock('@/components/admin/dashboard/CustomersRangePills', () => ({
  CustomersRangePills: () => <div data-testid="range-pills" />,
}))
vi.mock('@/components/admin/customers/CustomersListClient', () => ({
  CustomersListClient: () => <div data-testid="list-client" />,
}))

beforeEach(() => vi.clearAllMocks())

import { AdminCustomersV2 } from '@/components/admin/dashboard/AdminCustomersV2'

describe('AdminCustomersV2', () => {
  it('renders tab + range pills on default All tab', async () => {
    const node = await AdminCustomersV2({ searchParams: {}, isSuperAdmin: false })
    render(node as React.ReactElement)
    expect(screen.getByTestId('tab-pills')).toBeTruthy()
    expect(screen.getByTestId('range-pills')).toBeTruthy()
  })

  it('renders list client for vip tab', async () => {
    const node = await AdminCustomersV2({
      searchParams: { tab: 'vip', range: '30d' },
      isSuperAdmin: true,
    })
    render(node as React.ReactElement)
    expect(screen.getByTestId('tab-pills')).toBeTruthy()
  })
})
