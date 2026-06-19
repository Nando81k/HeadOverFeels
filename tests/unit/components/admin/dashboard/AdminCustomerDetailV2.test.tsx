import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const notFoundMock = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND')
})
vi.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
}))

vi.mock('@/lib/admin/customers', () => ({
  loadCustomerHeader: vi.fn(),
}))

vi.mock('@/components/admin/AdminLayout', () => ({
  AdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('@/components/admin/customers/detail/CustomerHeader', () => ({
  CustomerHeader: () => <div data-testid="header" />,
}))
vi.mock('@/components/admin/customers/detail/CustomerOrdersPanel', () => ({
  CustomerOrdersPanel: () => <div data-testid="orders" />,
}))
vi.mock('@/components/admin/customers/detail/CustomerLoyaltyPanel', () => ({
  CustomerLoyaltyPanel: () => <div data-testid="loyalty" />,
}))
vi.mock('@/components/admin/customers/detail/CustomerReviewsPanel', () => ({
  CustomerReviewsPanel: () => <div data-testid="reviews" />,
}))
vi.mock('@/components/admin/customers/detail/CustomerActivityTimeline', () => ({
  CustomerActivityTimeline: () => <div data-testid="activity" />,
}))
vi.mock('@/components/admin/customers/detail/CustomerAddressesPanel', () => ({
  CustomerAddressesPanel: () => <div data-testid="addresses" />,
}))
vi.mock('@/components/admin/customers/detail/CustomerNotesPanel', () => ({
  CustomerNotesPanel: () => <div data-testid="notes" />,
}))
vi.mock('@/components/admin/customers/detail/CustomerSupportTicketsPanel', () => ({
  CustomerSupportTicketsPanel: () => <div data-testid="support" />,
}))
vi.mock('@/components/admin/customers/detail/CustomerRiskWidget', () => ({
  CustomerRiskWidget: () => <div data-testid="risk" />,
}))

beforeEach(() => vi.clearAllMocks())

import { AdminCustomerDetailV2 } from '@/components/admin/dashboard/AdminCustomerDetailV2'

describe('AdminCustomerDetailV2', () => {
  it('renders header + 8 widget slots when header loads', async () => {
    const mod = await import('@/lib/admin/customers')
    ;(mod.loadCustomerHeader as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'c1',
      email: 'ada@e.com',
      name: 'Ada',
      phone: null,
      profilePictureUrl: null,
      birthday: null,
      newsletter: false,
      smsOptIn: false,
      tierId: null,
      tierName: null,
      tierSlug: null,
      tierColor: null,
      currentPoints: 0,
      lifetimePoints: 0,
      totalSpent: 0,
      totalOrders: 0,
      lastOrderDate: null,
      createdAt: new Date(),
      isAnonymized: false,
      anonymizedAt: null,
    })
    const node = await AdminCustomerDetailV2({ customerId: 'c1', isSuperAdmin: false })
    render(node as React.ReactElement)
    expect(screen.getByTestId('header')).toBeTruthy()
    expect(screen.getByTestId('orders')).toBeTruthy()
    expect(screen.getByTestId('loyalty')).toBeTruthy()
    expect(screen.getByTestId('addresses')).toBeTruthy()
    expect(screen.getByTestId('notes')).toBeTruthy()
    expect(screen.getByTestId('risk')).toBeTruthy()
  })

  it('calls notFound when header is null', async () => {
    const mod = await import('@/lib/admin/customers')
    ;(mod.loadCustomerHeader as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    await expect(
      AdminCustomerDetailV2({ customerId: 'missing', isSuperAdmin: false }),
    ).rejects.toThrow(/NEXT_NOT_FOUND/)
  })
})
