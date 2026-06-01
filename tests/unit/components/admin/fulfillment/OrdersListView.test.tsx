// tests/unit/components/admin/fulfillment/OrdersListView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OrdersListView } from '@/components/admin/fulfillment/OrdersListView'
import type { OrderRow } from '@/lib/admin/fulfillment'

const getOrderDetailForInspector = vi.fn()
const updateOrderStatus = vi.fn()

vi.mock('@/app/admin/fulfillment/actions', () => ({
  getOrderDetailForInspector: (...a: unknown[]) => getOrderDetailForInspector(...a),
  updateOrderStatus: (...a: unknown[]) => updateOrderStatus(...a),
  saveOrderNotes: vi.fn(),
  setTracking: vi.fn(),
  purchaseShippingLabel: vi.fn(),
  bulkMarkShipped: vi.fn().mockResolvedValue({ ok: true, affected: 1 }),
  bulkPurchaseLabels: vi.fn(),
  bulkSendTrackingEmail: vi.fn(),
  bulkExportCsv: vi.fn(),
}))

vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const rows: OrderRow[] = [
  { id: 'o1', orderNumber: 'HOF-0001', customerName: 'Ada', customerEmail: 'ada@example.com', status: 'PROCESSING', paymentStatus: 'PAID', totalAmount: 49.99, createdAt: new Date('2026-05-01'), trackingNumber: null, carrier: null, itemCount: 1 },
  { id: 'o2', orderNumber: 'HOF-0002', customerName: null, customerEmail: 'g@e.com', status: 'SHIPPED', paymentStatus: 'PAID', totalAmount: 30, createdAt: new Date('2026-05-02'), trackingNumber: '1Z', carrier: 'UPS', itemCount: 2 },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('OrdersListView', () => {
  it('renders rows in the desktop table', () => {
    render(<OrdersListView rows={rows} />)
    // HOF-0001 appears in both desktop table and mobile card list
    const orderNumEls = screen.getAllByText('HOF-0001')
    expect(orderNumEls.length).toBeGreaterThanOrEqual(1)
  })

  it('opening inspector calls getOrderDetailForInspector', async () => {
    getOrderDetailForInspector.mockResolvedValue({
      id: 'o1', orderNumber: 'HOF-0001', status: 'PROCESSING', paymentStatus: 'PAID',
      total: 49.99, subtotal: 49.99, tax: 0, shipping: 0,
      customerId: 'c1', customerName: 'Ada', customerEmail: 'ada@example.com', customerPhone: null,
      trackingNumber: null, trackingUrl: null, carrier: null, shippedAt: null, deliveredAt: null,
      estimatedDelivery: null, notes: null, internalNotes: null,
      createdAt: new Date(), updatedAt: new Date(),
      shippingAddress: null, billingAddress: null, items: [], returns: [], refunds: [],
    })
    render(<OrdersListView rows={rows} />)
    fireEvent.click(screen.getAllByLabelText(/open inspector/i)[0])
    await waitFor(() => expect(getOrderDetailForInspector).toHaveBeenCalledWith('o1'))
  })

  it('checking a row shows the bulk sheet', () => {
    render(<OrdersListView rows={rows} />)
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[1])
    // BottomActionSheet renders "{count} selected" when open
    expect(screen.getByText('1 selected')).toBeInTheDocument()
    // Mark Shipped button appears (may also exist in mobile swipe rows — use getAllByRole)
    const markShippedBtns = screen.getAllByRole('button', { name: /mark shipped/i })
    expect(markShippedBtns.length).toBeGreaterThanOrEqual(1)
  })

  it('select-all toggles all visible rows', () => {
    render(<OrdersListView rows={rows} />)
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    expect(screen.getByText('2 selected')).toBeInTheDocument()
  })
})
