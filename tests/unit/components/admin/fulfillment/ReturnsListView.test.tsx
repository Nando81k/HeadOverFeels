// tests/unit/components/admin/fulfillment/ReturnsListView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ReturnsListView } from '@/components/admin/fulfillment/ReturnsListView'
import type { ReturnRow } from '@/lib/admin/fulfillment'

const getReturnDetailForInspector = vi.fn()
vi.mock('@/app/admin/fulfillment/actions', () => ({
  getReturnDetailForInspector: (...a: unknown[]) => getReturnDetailForInspector(...a),
  approveReturn: vi.fn(),
  rejectReturn: vi.fn(),
}))

vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const rows: ReturnRow[] = [
  { id: 'r1', rmaNumber: 'RMA-100000', orderId: 'o1', orderNumber: 'HOF-1', customerName: 'Ada', status: 'REQUESTED', requestedAt: new Date('2026-05-15'), refundAmount: 49.99 },
  { id: 'r2', rmaNumber: 'RMA-100001', orderId: 'o2', orderNumber: 'HOF-2', customerName: null, status: 'APPROVED', requestedAt: new Date('2026-05-16'), refundAmount: 30 },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ReturnsListView', () => {
  it('renders rows', () => {
    render(<ReturnsListView rows={rows} />)
    expect(screen.getByText('RMA-100000')).toBeInTheDocument()
    expect(screen.getByText('RMA-100001')).toBeInTheDocument()
  })

  it('opens inspector on action click', async () => {
    getReturnDetailForInspector.mockResolvedValue({
      id: 'r1', rmaNumber: 'RMA-100000', orderId: 'o1', orderNumber: 'HOF-1',
      customerId: 'c1', customerName: 'Ada', customerEmail: 'a@e.com',
      status: 'REQUESTED', reason: 'wrong size', internalNotes: null,
      returnLabel: null, returnTrackingNumber: null, receivedAt: null,
      windowExpiresAt: new Date(), requestedAt: new Date(), decidedAt: null,
      items: [], refunds: [],
    })
    render(<ReturnsListView rows={rows} />)
    fireEvent.click(screen.getAllByLabelText(/open return/i)[0])
    await waitFor(() => expect(getReturnDetailForInspector).toHaveBeenCalledWith('r1'))
  })

  it('renders empty state', () => {
    render(<ReturnsListView rows={[]} />)
    expect(screen.getByText(/no returns/i)).toBeInTheDocument()
  })
})
