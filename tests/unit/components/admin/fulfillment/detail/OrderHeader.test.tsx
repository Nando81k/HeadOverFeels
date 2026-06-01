// tests/unit/components/admin/fulfillment/detail/OrderHeader.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OrderHeader } from '@/components/admin/fulfillment/detail/OrderHeader'
import type { OrderDetailFull } from '@/lib/admin/fulfillment'

const detail: OrderDetailFull = {
  id: 'o1', orderNumber: 'HOF-0001', status: 'PROCESSING', paymentStatus: 'PAID',
  total: 100, subtotal: 90, tax: 5, shipping: 5,
  customerId: 'c1', customerName: 'Ada', customerEmail: 'ada@e.com', customerPhone: null,
  trackingNumber: null, trackingUrl: null, carrier: null,
  shippedAt: null, deliveredAt: null, estimatedDelivery: null,
  notes: null, internalNotes: null,
  createdAt: new Date('2026-05-01'), updatedAt: new Date('2026-05-01'),
  shippingAddress: null, billingAddress: null,
  items: [], returns: [], refunds: [],
}

describe('OrderHeader', () => {
  it('renders order number, status, total, customer link', () => {
    render(<OrderHeader detail={detail} />)
    expect(screen.getByText('HOF-0001')).toBeInTheDocument()
    expect(screen.getByText('PROCESSING')).toBeInTheDocument()
    expect(screen.getByText(/\$100/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ada/i })).toHaveAttribute('href', '/admin/customers/c1')
  })

  it('shows customer email as plain text when customerId is null (guest)', () => {
    render(<OrderHeader detail={{ ...detail, customerId: null, customerName: null }} />)
    expect(screen.queryByRole('link', { name: /ada@e\.com/i })).toBeNull()
    expect(screen.getByText('ada@e.com')).toBeInTheDocument()
  })
})
