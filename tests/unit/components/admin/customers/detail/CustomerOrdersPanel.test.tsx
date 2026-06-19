import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/admin/customers', () => ({
  loadCustomerOrders: vi.fn().mockResolvedValue({
    items: [
      { id: 'o1', orderNumber: 'HOF-100', status: 'DELIVERED', total: 99.5,
        createdAt: new Date('2026-05-15') },
    ],
    total: 1, page: 1, pageSize: 10,
  }),
}))

import { CustomerOrdersPanel } from '@/components/admin/customers/detail/CustomerOrdersPanel'

beforeEach(() => vi.clearAllMocks())

describe('CustomerOrdersPanel', () => {
  it('renders order rows with links', async () => {
    const node = await CustomerOrdersPanel({ customerId: 'c1', page: 1 })
    render(node as React.ReactElement)
    expect(screen.getByText('HOF-100')).toBeTruthy()
    const link = screen.getByRole('link', { name: /HOF-100/ })
    expect(link.getAttribute('href')).toBe('/admin/fulfillment/o1')
  })

  it('renders empty state when no orders', async () => {
    const mod = await import('@/lib/admin/customers')
    ;(mod.loadCustomerOrders as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      items: [], total: 0, page: 1, pageSize: 10,
    })
    const node = await CustomerOrdersPanel({ customerId: 'c1', page: 1 })
    render(node as React.ReactElement)
    expect(screen.getByText(/no orders/i)).toBeTruthy()
  })
})
