import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/admin/customers', () => ({
  loadCustomerRisk: vi.fn(),
}))

import { CustomerRiskWidget } from '@/components/admin/customers/detail/CustomerRiskWidget'

beforeEach(() => vi.clearAllMocks())

describe('CustomerRiskWidget', () => {
  it('renders refund/return/chargeback numbers + high-risk badge', async () => {
    const mod = await import('@/lib/admin/customers')
    ;(mod.loadCustomerRisk as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      totalOrders: 10, refundCount: 3, refundRate: 30,
      returnCount: 2, returnRate: 20, chargebackCount: 1,
      avgDaysToReturn: 9.2, isHighRisk: true,
    })
    const node = await CustomerRiskWidget({ customerId: 'c1' })
    render(node as React.ReactElement)
    expect(screen.getByText(/30.0%/)).toBeTruthy()
    expect(screen.getByText(/high risk/i)).toBeTruthy()
  })

  it('does not render badge when isHighRisk is false', async () => {
    const mod = await import('@/lib/admin/customers')
    ;(mod.loadCustomerRisk as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      totalOrders: 10, refundCount: 0, refundRate: 0,
      returnCount: 0, returnRate: 0, chargebackCount: 0,
      avgDaysToReturn: 0, isHighRisk: false,
    })
    const node = await CustomerRiskWidget({ customerId: 'c1' })
    render(node as React.ReactElement)
    expect(screen.queryByText(/high risk/i)).toBeNull()
  })
})
