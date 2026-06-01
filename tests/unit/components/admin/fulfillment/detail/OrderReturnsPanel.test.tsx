// tests/unit/components/admin/fulfillment/detail/OrderReturnsPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OrderReturnsPanel } from '@/components/admin/fulfillment/detail/OrderReturnsPanel'
import type { OrderDetailFull } from '@/lib/admin/fulfillment'

const createReturn = vi.fn()
vi.mock('@/app/admin/fulfillment/actions', () => ({
  createReturn: (...a: unknown[]) => createReturn(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const detail: OrderDetailFull = {
  id: 'o1', orderNumber: 'HOF-0001', status: 'DELIVERED', paymentStatus: 'PAID',
  total: 100, subtotal: 90, tax: 5, shipping: 5,
  customerId: 'c1', customerName: 'Ada', customerEmail: 'a@e.com', customerPhone: null,
  trackingNumber: null, trackingUrl: null, carrier: null,
  shippedAt: null, deliveredAt: null, estimatedDelivery: null,
  notes: null, internalNotes: null,
  createdAt: new Date(), updatedAt: new Date(),
  shippingAddress: null, billingAddress: null,
  items: [
    { id: 'i1', productId: 'p1', productVariantId: null, quantity: 2, price: 49.99, productName: 'Tee', productImage: null, sku: null, variantDetails: null },
  ],
  returns: [
    { id: 'r1', rmaNumber: 'RMA-100000', status: 'REQUESTED', requestedAt: new Date('2026-05-10') },
  ],
  refunds: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('OrderReturnsPanel', () => {
  it('lists existing returns with status pills', () => {
    render(<OrderReturnsPanel detail={detail} />)
    expect(screen.getByText('RMA-100000')).toBeInTheDocument()
    expect(screen.getByText('REQUESTED')).toBeInTheDocument()
  })

  it('+ Create Return opens a form', () => {
    render(<OrderReturnsPanel detail={detail} />)
    fireEvent.click(screen.getByRole('button', { name: /\+ create return/i }))
    expect(screen.getByLabelText(/reason/i)).toBeInTheDocument()
  })

  it('submitting the form calls createReturn with selected items', async () => {
    createReturn.mockResolvedValue({ ok: true, data: { rmaNumber: 'RMA-100001', returnId: 'r2' } })
    render(<OrderReturnsPanel detail={detail} />)
    fireEvent.click(screen.getByRole('button', { name: /\+ create return/i }))
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'defective' } })
    fireEvent.change(screen.getByLabelText(/tee/i), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: /submit return/i }))
    await waitFor(() => expect(createReturn).toHaveBeenCalled())
    const args = createReturn.mock.calls[0]
    expect(args[0]).toBe('o1')
    expect(args[1]).toEqual([{ orderItemId: 'i1', quantity: 1, condition: 'UNOPENED' }])
    expect(args[2]).toBe('defective')
  })
})
