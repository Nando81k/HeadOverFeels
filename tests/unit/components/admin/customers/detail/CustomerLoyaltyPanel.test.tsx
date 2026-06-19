import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/admin/customers', () => ({
  loadCustomerLoyalty: vi.fn().mockResolvedValue({
    tierId: 't1', tierName: 'Silver', tierSlug: 'silver', tierColor: '#aaa',
    currentPoints: 250, lifetimePoints: 1500, annualPointsEarned: 800,
    tierStartDate: new Date('2026-01-01'),
    transactions: [
      { id: 'pt1', points: 100, type: 'PURCHASE', description: 'Order HOF-100',
        createdAt: new Date('2026-05-15'), orderId: 'o1' },
    ],
  }),
}))

import { CustomerLoyaltyPanel } from '@/components/admin/customers/detail/CustomerLoyaltyPanel'

beforeEach(() => vi.clearAllMocks())

describe('CustomerLoyaltyPanel', () => {
  it('renders tier badge + balances + ledger', async () => {
    const node = await CustomerLoyaltyPanel({ customerId: 'c1' })
    render(node as React.ReactElement)
    expect(screen.getByText('Silver')).toBeTruthy()
    expect(screen.getByText(/250/)).toBeTruthy()
    expect(screen.getByText(/Order HOF-100/)).toBeTruthy()
  })

  it('renders "View in Loyalty" deep link', async () => {
    const node = await CustomerLoyaltyPanel({ customerId: 'c1' })
    render(node as React.ReactElement)
    const link = screen.getByRole('link', { name: /view in loyalty/i })
    expect(link.getAttribute('href')).toContain('/admin/loyalty')
    expect(link.getAttribute('href')).toContain('member=c1')
  })

  it('renders empty ledger state', async () => {
    const mod = await import('@/lib/admin/customers')
    ;(mod.loadCustomerLoyalty as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      tierId: null, tierName: null, tierSlug: null, tierColor: null,
      currentPoints: 0, lifetimePoints: 0, annualPointsEarned: 0,
      tierStartDate: new Date(), transactions: [],
    })
    const node = await CustomerLoyaltyPanel({ customerId: 'c1' })
    render(node as React.ReactElement)
    expect(screen.getByText(/no points activity/i)).toBeTruthy()
  })
})
