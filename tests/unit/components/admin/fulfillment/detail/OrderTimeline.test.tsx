// tests/unit/components/admin/fulfillment/detail/OrderTimeline.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OrderTimeline } from '@/components/admin/fulfillment/detail/OrderTimeline'
import type { OrderDetailFull } from '@/lib/admin/fulfillment'

const detail: OrderDetailFull = {
  id: 'o1', orderNumber: 'HOF-0001', status: 'DELIVERED', paymentStatus: 'PAID',
  total: 100, subtotal: 90, tax: 5, shipping: 5,
  customerId: 'c1', customerName: 'Ada', customerEmail: 'a@e.com', customerPhone: null,
  trackingNumber: '1Z', trackingUrl: null, carrier: 'UPS',
  shippedAt: new Date('2026-05-03'), deliveredAt: new Date('2026-05-05'), estimatedDelivery: null,
  notes: null, internalNotes: null,
  createdAt: new Date('2026-05-01'), updatedAt: new Date('2026-05-02'),
  shippingAddress: null, billingAddress: null,
  items: [],
  returns: [{ id: 'r1', rmaNumber: 'RMA-100000', status: 'REQUESTED', requestedAt: new Date('2026-05-10') }],
  refunds: [],
}

describe('OrderTimeline', () => {
  it('renders core events in date order', () => {
    render(<OrderTimeline detail={detail} />)
    expect(screen.getByText(/order placed/i)).toBeInTheDocument()
    expect(screen.getByText(/payment received/i)).toBeInTheDocument()
    expect(screen.getByText(/shipped/i)).toBeInTheDocument()
    expect(screen.getByText(/delivered/i)).toBeInTheDocument()
    expect(screen.getByText(/return requested/i)).toBeInTheDocument()
  })

  it('omits shipping when shippedAt is null', () => {
    render(<OrderTimeline detail={{ ...detail, shippedAt: null, deliveredAt: null }} />)
    expect(screen.queryByText(/shipped/i)).toBeNull()
  })
})
