// tests/unit/components/admin/fulfillment/detail/OrderNotesPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OrderNotesPanel } from '@/components/admin/fulfillment/detail/OrderNotesPanel'
import type { OrderDetailFull } from '@/lib/admin/fulfillment'

const saveOrderNotes = vi.fn()
vi.mock('@/app/admin/fulfillment/actions', () => ({
  saveOrderNotes: (...a: unknown[]) => saveOrderNotes(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const detail: OrderDetailFull = {
  id: 'o1', orderNumber: 'HOF-0001', status: 'PROCESSING', paymentStatus: 'PAID',
  total: 100, subtotal: 90, tax: 5, shipping: 5,
  customerId: 'c1', customerName: 'Ada', customerEmail: 'a@e.com', customerPhone: null,
  trackingNumber: null, trackingUrl: null, carrier: null,
  shippedAt: null, deliveredAt: null, estimatedDelivery: null,
  notes: 'Customer wants gift wrap',
  internalNotes: 'High-value — review hold',
  createdAt: new Date(), updatedAt: new Date(),
  shippingAddress: null, billingAddress: null,
  items: [], returns: [], refunds: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('OrderNotesPanel', () => {
  it('renders existing notes', () => {
    render(<OrderNotesPanel detail={detail} />)
    expect(screen.getByDisplayValue('Customer wants gift wrap')).toBeInTheDocument()
    expect(screen.getByDisplayValue('High-value — review hold')).toBeInTheDocument()
  })

  it('saves internal notes independently', async () => {
    saveOrderNotes.mockResolvedValue({ ok: true })
    render(<OrderNotesPanel detail={detail} />)
    fireEvent.change(screen.getByLabelText(/internal notes/i), { target: { value: 'updated internal' } })
    fireEvent.click(screen.getByRole('button', { name: /save internal/i }))
    await waitFor(() =>
      expect(saveOrderNotes).toHaveBeenCalledWith('o1', { internalNotes: 'updated internal' })
    )
  })

  it('saves customer notes independently', async () => {
    saveOrderNotes.mockResolvedValue({ ok: true })
    render(<OrderNotesPanel detail={detail} />)
    fireEvent.change(screen.getByLabelText(/customer notes/i), { target: { value: 'new customer note' } })
    fireEvent.click(screen.getByRole('button', { name: /save customer/i }))
    await waitFor(() =>
      expect(saveOrderNotes).toHaveBeenCalledWith('o1', { notes: 'new customer note' })
    )
  })
})
