import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { CustomerInspector } from '@/components/admin/analytics/inspectors/CustomerInspector'

const customer = {
  id: 'c1', email: 'a@e.com', name: 'Ada',
  createdAt: new Date('2026-01-01'),
  totalSpent: 250, totalOrders: 4, avgOrderValue: 62.5,
  lastOrderDate: new Date('2026-05-20'),
  loyaltyTierName: 'Gold',
}

describe('CustomerInspector', () => {
  it('renders read-only customer summary', () => {
    render(<CustomerInspector open detail={customer} onClose={() => {}} />)
    expect(screen.getByText(/a@e.com/i)).toBeTruthy()
    expect(screen.getByText(/Gold/)).toBeTruthy()
  })
  it('exposes link to customer profile', () => {
    render(<CustomerInspector open detail={customer} onClose={() => {}} />)
    const link = screen.getByRole('link', { name: /customer profile/i }) as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/admin/customers/c1')
  })
  it('renders loading state when detail is null', () => {
    render(<CustomerInspector open detail={null} onClose={() => {}} />)
    expect(screen.getByText(/loading/i)).toBeTruthy()
  })
})
