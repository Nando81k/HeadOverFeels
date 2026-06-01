// tests/unit/components/admin/fulfillment/OrderInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OrderInspector } from '@/components/admin/fulfillment/OrderInspector'
import type { OrderDetailFull } from '@/lib/admin/fulfillment'

const updateOrderStatus = vi.fn()
const saveOrderNotes = vi.fn()
const setTracking = vi.fn()
const purchaseShippingLabel = vi.fn()

vi.mock('@/app/admin/fulfillment/actions', () => ({
  updateOrderStatus: (...a: unknown[]) => updateOrderStatus(...a),
  saveOrderNotes: (...a: unknown[]) => saveOrderNotes(...a),
  setTracking: (...a: unknown[]) => setTracking(...a),
  purchaseShippingLabel: (...a: unknown[]) => purchaseShippingLabel(...a),
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const detail: OrderDetailFull = {
  id: 'o1',
  orderNumber: 'HOF-0001',
  status: 'PROCESSING',
  paymentStatus: 'PAID',
  total: 100, subtotal: 90, tax: 5, shipping: 5,
  customerId: 'c1',
  customerName: 'Ada',
  customerEmail: 'ada@example.com',
  customerPhone: null,
  trackingNumber: null,
  trackingUrl: null,
  carrier: null,
  shippedAt: null,
  deliveredAt: null,
  estimatedDelivery: null,
  notes: null,
  internalNotes: 'first note',
  createdAt: new Date('2026-05-01'),
  updatedAt: new Date('2026-05-01'),
  shippingAddress: null,
  billingAddress: null,
  items: [],
  returns: [],
  refunds: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('OrderInspector', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <OrderInspector open={false} detail={null} onClose={() => {}} />
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('renders summary header when open', () => {
    render(<OrderInspector open={true} detail={detail} onClose={() => {}} />)
    expect(screen.getByText('HOF-0001')).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
  })

  it('changing status calls updateOrderStatus', async () => {
    updateOrderStatus.mockResolvedValue({ ok: true })
    render(<OrderInspector open={true} detail={detail} onClose={() => {}} />)
    const select = screen.getByLabelText(/status/i) as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'SHIPPED' } })
    await waitFor(() => expect(updateOrderStatus).toHaveBeenCalledWith('o1', 'SHIPPED'))
  })

  it('saves internal notes', async () => {
    saveOrderNotes.mockResolvedValue({ ok: true })
    render(<OrderInspector open={true} detail={detail} onClose={() => {}} />)
    const textarea = screen.getByLabelText(/internal notes/i) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'updated' } })
    fireEvent.click(screen.getByRole('button', { name: /save notes/i }))
    await waitFor(() =>
      expect(saveOrderNotes).toHaveBeenCalledWith('o1', { internalNotes: 'updated' })
    )
  })

  it('saves tracking + carrier', async () => {
    setTracking.mockResolvedValue({ ok: true })
    render(<OrderInspector open={true} detail={detail} onClose={() => {}} />)
    const tn = screen.getByLabelText(/tracking number/i) as HTMLInputElement
    const carrier = screen.getByLabelText(/carrier/i) as HTMLInputElement
    fireEvent.change(tn, { target: { value: '1Z' } })
    fireEvent.change(carrier, { target: { value: 'UPS' } })
    fireEvent.click(screen.getByRole('button', { name: /save tracking/i }))
    await waitFor(() =>
      expect(setTracking).toHaveBeenCalledWith('o1', { trackingNumber: '1Z', carrier: 'UPS' })
    )
  })

  it('Buy label calls purchaseShippingLabel', async () => {
    purchaseShippingLabel.mockResolvedValue({ ok: true, data: { trackingNumber: 'NEW' } })
    render(<OrderInspector open={true} detail={detail} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /buy label/i }))
    await waitFor(() => expect(purchaseShippingLabel).toHaveBeenCalledWith('o1'))
  })

  it('Open full detail link points to /admin/fulfillment/[orderId]', () => {
    render(<OrderInspector open={true} detail={detail} onClose={() => {}} />)
    const link = screen.getByRole('link', { name: /open full detail/i })
    expect(link).toHaveAttribute('href', '/admin/fulfillment/o1')
  })
})
