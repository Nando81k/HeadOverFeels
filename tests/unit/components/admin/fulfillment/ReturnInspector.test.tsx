// tests/unit/components/admin/fulfillment/ReturnInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ReturnInspector } from '@/components/admin/fulfillment/ReturnInspector'
import type { ReturnWithItems } from '@/lib/admin/fulfillment'

const approveReturn = vi.fn()
const rejectReturn = vi.fn()

vi.mock('@/app/admin/fulfillment/actions', () => ({
  approveReturn: (...a: unknown[]) => approveReturn(...a),
  rejectReturn: (...a: unknown[]) => rejectReturn(...a),
}))

vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const ret: ReturnWithItems = {
  id: 'r1',
  rmaNumber: 'RMA-100000',
  orderId: 'o1',
  orderNumber: 'HOF-0001',
  customerId: 'c1',
  customerName: 'Ada',
  customerEmail: 'ada@example.com',
  status: 'REQUESTED',
  reason: 'Wrong size',
  internalNotes: null,
  returnLabel: null,
  returnTrackingNumber: null,
  receivedAt: null,
  windowExpiresAt: new Date('2026-06-30'),
  requestedAt: new Date('2026-05-30'),
  decidedAt: null,
  items: [
    {
      id: 'ri1', orderItemId: 'i1', quantity: 1, condition: 'UNOPENED',
      reason: null, productName: 'Tee', productImage: '/t.jpg', unitPrice: 49.99,
    },
  ],
  refunds: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ReturnInspector', () => {
  it('renders nothing when no detail', () => {
    const { container } = render(<ReturnInspector open={false} detail={null} onClose={() => {}} />)
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('renders RMA, items with condition badges', () => {
    render(<ReturnInspector open={true} detail={ret} onClose={() => {}} />)
    expect(screen.getByText('RMA-100000')).toBeInTheDocument()
    expect(screen.getByText('Tee')).toBeInTheDocument()
    expect(screen.getByText('UNOPENED')).toBeInTheDocument()
  })

  it('Approve calls approveReturn and surfaces label URL', async () => {
    approveReturn.mockResolvedValue({ ok: true, data: { labelUrl: 'http://label.example' } })
    render(<ReturnInspector open={true} detail={ret} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /approve/i }))
    await waitFor(() => expect(approveReturn).toHaveBeenCalledWith('r1'))
    await waitFor(() => expect(screen.getByText(/label.example/)).toBeInTheDocument())
  })

  it('Reject prompts for reason', async () => {
    rejectReturn.mockResolvedValue({ ok: true })
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('past window')
    render(<ReturnInspector open={true} detail={ret} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /reject/i }))
    await waitFor(() => expect(rejectReturn).toHaveBeenCalledWith('r1', 'past window'))
    promptSpy.mockRestore()
  })

  it('Reject does nothing when prompt is cancelled', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null)
    render(<ReturnInspector open={true} detail={ret} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /reject/i }))
    await new Promise((r) => setTimeout(r, 0))
    expect(rejectReturn).not.toHaveBeenCalled()
    promptSpy.mockRestore()
  })
})
