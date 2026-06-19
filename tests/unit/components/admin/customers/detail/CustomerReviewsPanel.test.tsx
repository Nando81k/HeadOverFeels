import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/admin/customers', () => ({
  loadCustomerReviews: vi.fn().mockResolvedValue({
    items: [
      { id: 'r1', productId: 'p1', productName: 'Tee', rating: 5,
        status: 'APPROVED', createdAt: new Date('2026-05-15') },
    ],
    total: 1, page: 1, pageSize: 10,
  }),
}))

import { CustomerReviewsPanel } from '@/components/admin/customers/detail/CustomerReviewsPanel'

beforeEach(() => vi.clearAllMocks())

describe('CustomerReviewsPanel', () => {
  it('renders review rows with stars + status + link', async () => {
    const node = await CustomerReviewsPanel({ customerId: 'c1' })
    render(node as React.ReactElement)
    expect(screen.getByText('Tee')).toBeTruthy()
    expect(screen.getByText('APPROVED')).toBeTruthy()
    const link = screen.getByRole('link', { name: /tee/i })
    expect(link.getAttribute('href')).toBe('/admin/reviews/r1')
  })

  it('renders empty state', async () => {
    const mod = await import('@/lib/admin/customers')
    ;(mod.loadCustomerReviews as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      items: [], total: 0, page: 1, pageSize: 10,
    })
    const node = await CustomerReviewsPanel({ customerId: 'c1' })
    render(node as React.ReactElement)
    expect(screen.getByText(/no reviews/i)).toBeTruthy()
  })
})
