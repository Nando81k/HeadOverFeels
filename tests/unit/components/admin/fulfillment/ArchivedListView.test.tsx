// tests/unit/components/admin/fulfillment/ArchivedListView.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ArchivedListView } from '@/components/admin/fulfillment/ArchivedListView'
import type { OrderRow } from '@/lib/admin/fulfillment'

const rows: OrderRow[] = [
  { id: 'o1', orderNumber: 'HOF-X1', customerName: 'Ada', customerEmail: 'a@e.com', status: 'CANCELLED', paymentStatus: 'REFUNDED', totalAmount: 30, createdAt: new Date('2026-04-01'), trackingNumber: null, carrier: null, itemCount: 1 },
  { id: 'o2', orderNumber: 'HOF-X2', customerName: null, customerEmail: 'b@e.com', status: 'REFUNDED', paymentStatus: 'REFUNDED', totalAmount: 60, createdAt: new Date('2026-04-02'), trackingNumber: null, carrier: null, itemCount: 2 },
]

describe('ArchivedListView', () => {
  it('renders archived rows', () => {
    render(<ArchivedListView rows={rows} />)
    expect(screen.getByText('HOF-X1')).toBeInTheDocument()
    expect(screen.getByText('HOF-X2')).toBeInTheDocument()
  })

  it('does not show checkboxes (read-only)', () => {
    render(<ArchivedListView rows={rows} />)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('renders empty state', () => {
    render(<ArchivedListView rows={[]} />)
    expect(screen.getByText(/no archived/i)).toBeInTheDocument()
  })
})
