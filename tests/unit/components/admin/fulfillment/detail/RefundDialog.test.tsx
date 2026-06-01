// tests/unit/components/admin/fulfillment/detail/RefundDialog.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RefundDialog } from '@/components/admin/fulfillment/detail/RefundDialog'

const createRefund = vi.fn()
vi.mock('@/app/admin/fulfillment/actions', () => ({
  createRefund: (...a: unknown[]) => createRefund(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RefundDialog', () => {
  it('renders nothing when closed', () => {
    render(<RefundDialog open={false} orderId="o1" maxAmount={100} onClose={() => {}} />)
    expect(screen.queryByText(/refund/i)).toBeNull()
  })

  it('renders amount/type/reason controls when open', () => {
    render(<RefundDialog open={true} orderId="o1" maxAmount={100} onClose={() => {}} />)
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/type/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/reason/i)).toBeInTheDocument()
  })

  it('submitting calls createRefund and closes', async () => {
    createRefund.mockResolvedValue({ ok: true, data: { refundId: 'r1', stripeRefundId: 're_1' } })
    const onClose = vi.fn()
    render(<RefundDialog open={true} orderId="o1" maxAmount={100} onClose={onClose} />)
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '50' } })
    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'PARTIAL' } })
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'damaged' } })
    fireEvent.click(screen.getByRole('button', { name: /submit refund/i }))
    await waitFor(() =>
      expect(createRefund).toHaveBeenCalledWith('o1', {
        amount: 50, type: 'PARTIAL', reason: 'damaged',
      })
    )
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('shows error toast on failure (does NOT close)', async () => {
    createRefund.mockResolvedValue({ ok: false, error: 'stripe failed' })
    const onClose = vi.fn()
    render(<RefundDialog open={true} orderId="o1" maxAmount={100} onClose={onClose} />)
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '50' } })
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: /submit refund/i }))
    await waitFor(() => expect(createRefund).toHaveBeenCalled())
    expect(onClose).not.toHaveBeenCalled()
  })
})
