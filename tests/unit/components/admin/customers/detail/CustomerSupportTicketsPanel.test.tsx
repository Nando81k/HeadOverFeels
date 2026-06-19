import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/admin/customers', () => ({
  loadCustomerSupportTickets: vi.fn().mockResolvedValue({
    items: [
      { id: 'st1', ticketNumber: 'T-100', type: 'REFUND', status: 'OPEN',
        priority: 'HIGH', createdAt: new Date('2026-05-15') },
    ],
    total: 1, page: 1, pageSize: 10,
  }),
}))

import { CustomerSupportTicketsPanel } from '@/components/admin/customers/detail/CustomerSupportTicketsPanel'

beforeEach(() => vi.clearAllMocks())

describe('CustomerSupportTicketsPanel', () => {
  it('renders ticket rows with link', async () => {
    const node = await CustomerSupportTicketsPanel({ customerId: 'c1' })
    render(node as React.ReactElement)
    expect(screen.getByText('T-100')).toBeTruthy()
    expect(screen.getByText('REFUND')).toBeTruthy()
    const link = screen.getByRole('link', { name: /T-100/ })
    expect(link.getAttribute('href')).toBe('/admin/support/st1')
  })

  it('renders empty state', async () => {
    const mod = await import('@/lib/admin/customers')
    ;(mod.loadCustomerSupportTickets as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      items: [], total: 0, page: 1, pageSize: 10,
    })
    const node = await CustomerSupportTicketsPanel({ customerId: 'c1' })
    render(node as React.ReactElement)
    expect(screen.getByText(/no support tickets/i)).toBeTruthy()
  })
})
