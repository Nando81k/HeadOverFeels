// tests/unit/components/admin/fulfillment/detail/OrderPaymentPanel.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OrderPaymentPanel } from '@/components/admin/fulfillment/detail/OrderPaymentPanel'
import type { OrderDetailFull } from '@/lib/admin/fulfillment'

vi.mock('@/components/admin/fulfillment/detail/RefundDialog', () => ({
  RefundDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="refund-dialog">refund dialog</div> : null,
}))

const detail: OrderDetailFull = {
  id: 'o1', orderNumber: 'HOF-0001', status: 'PROCESSING', paymentStatus: 'PAID',
  total: 100, subtotal: 90, tax: 5, shipping: 5,
  customerId: 'c1', customerName: 'Ada', customerEmail: 'a@e.com', customerPhone: null,
  trackingNumber: null, trackingUrl: null, carrier: null,
  shippedAt: null, deliveredAt: null, estimatedDelivery: null,
  notes: null, internalNotes: null,
  createdAt: new Date(), updatedAt: new Date(),
  shippingAddress: null, billingAddress: null,
  items: [], returns: [], refunds: [],
}

describe('OrderPaymentPanel', () => {
  it('renders subtotal/shipping/tax/total', () => {
    render(<OrderPaymentPanel detail={detail} />)
    expect(screen.getByText('$90.00')).toBeInTheDocument()
    // shipping and tax are both $5.00 — use getAllByText (assert by label comment from plan)
    expect(screen.getAllByText('$5.00')).toHaveLength(2)
    expect(screen.getByText('$100.00')).toBeInTheDocument()
  })

  it('Refund button opens RefundDialog', () => {
    render(<OrderPaymentPanel detail={detail} />)
    fireEvent.click(screen.getByRole('button', { name: /refund/i }))
    expect(screen.getByTestId('refund-dialog')).toBeInTheDocument()
  })

  it('renders payment status pill', () => {
    render(<OrderPaymentPanel detail={detail} />)
    expect(screen.getByText('PAID')).toBeInTheDocument()
  })

  it('renders refund records list when refunds present', () => {
    const detailWithRefunds: OrderDetailFull = {
      ...detail,
      refunds: [
        { id: 'r1', amount: 25, type: 'PARTIAL', createdAt: new Date('2025-01-15') },
      ],
    }
    render(<OrderPaymentPanel detail={detailWithRefunds} />)
    expect(screen.getByText('$25.00')).toBeInTheDocument()
    expect(screen.getByText('PARTIAL')).toBeInTheDocument()
  })

  it('does not render refund records section when no refunds', () => {
    render(<OrderPaymentPanel detail={detail} />)
    expect(screen.queryByText('Refund History')).not.toBeInTheDocument()
  })
})
