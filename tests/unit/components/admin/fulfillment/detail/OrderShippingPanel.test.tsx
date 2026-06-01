// tests/unit/components/admin/fulfillment/detail/OrderShippingPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OrderShippingPanel } from '@/components/admin/fulfillment/detail/OrderShippingPanel'
import type { OrderDetailFull } from '@/lib/admin/fulfillment'

const setTracking = vi.fn()
const purchaseShippingLabel = vi.fn()

vi.mock('@/app/admin/fulfillment/actions', () => ({
  setTracking: (...a: unknown[]) => setTracking(...a),
  purchaseShippingLabel: (...a: unknown[]) => purchaseShippingLabel(...a),
}))

vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const detail: OrderDetailFull = {
  id: 'o1', orderNumber: 'HOF-0001', status: 'PROCESSING', paymentStatus: 'PAID',
  total: 100, subtotal: 90, tax: 5, shipping: 5,
  customerId: 'c1', customerName: 'Ada', customerEmail: 'ada@e.com', customerPhone: null,
  trackingNumber: null, trackingUrl: null, carrier: null,
  shippedAt: null, deliveredAt: null, estimatedDelivery: null,
  notes: null, internalNotes: null,
  createdAt: new Date(), updatedAt: new Date(),
  shippingAddress: {
    id: 'a1', firstName: 'Ada', lastName: 'L', address1: '1 St', address2: null,
    city: 'NY', state: 'NY', postalCode: '10001', country: 'US',
  },
  billingAddress: null,
  items: [], returns: [], refunds: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('OrderShippingPanel', () => {
  it('renders the shipping address', () => {
    render(<OrderShippingPanel detail={detail} />)
    expect(screen.getByText('Ada L')).toBeInTheDocument()
    expect(screen.getByText('1 St')).toBeInTheDocument()
    expect(screen.getByText(/NY, NY 10001/)).toBeInTheDocument()
  })

  it('saves tracking + carrier', async () => {
    setTracking.mockResolvedValue({ ok: true })
    render(<OrderShippingPanel detail={detail} />)
    fireEvent.change(screen.getByLabelText(/tracking number/i), { target: { value: '1Z' } })
    fireEvent.change(screen.getByLabelText(/carrier/i), { target: { value: 'UPS' } })
    fireEvent.click(screen.getByRole('button', { name: /save tracking/i }))
    await waitFor(() =>
      expect(setTracking).toHaveBeenCalledWith('o1', { trackingNumber: '1Z', carrier: 'UPS' })
    )
  })

  it('Buy label calls purchaseShippingLabel', async () => {
    purchaseShippingLabel.mockResolvedValue({ ok: true, data: { trackingNumber: 'NEW' } })
    render(<OrderShippingPanel detail={detail} />)
    fireEvent.click(screen.getByRole('button', { name: /buy label/i }))
    await waitFor(() => expect(purchaseShippingLabel).toHaveBeenCalledWith('o1'))
  })

  it('shows empty state when no shipping address', () => {
    render(<OrderShippingPanel detail={{ ...detail, shippingAddress: null }} />)
    expect(screen.getByText(/no shipping address/i)).toBeInTheDocument()
  })
})
