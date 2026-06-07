// tests/unit/components/admin/loyalty/inspectors/RedemptionInspector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const fulfillRedemption = vi.fn()
const cancelRedemption = vi.fn()

vi.mock('@/app/admin/loyalty/actions', () => ({
  fulfillRedemption: (...a: unknown[]) => fulfillRedemption(...a),
  cancelRedemption: (...a: unknown[]) => cancelRedemption(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { RedemptionInspector } from '@/components/admin/loyalty/inspectors/RedemptionInspector'

const pending = {
  id: 'red1', customerId: 'c1', customerEmail: 'a@e.com', customerName: 'Ada',
  rewardId: 'r1', rewardName: '10% off', rewardType: 'DISCOUNT' as const,
  pointsSpent: 500, status: 'PENDING' as const,
  couponCode: 'HOF-ABC', usedAt: null, orderId: null,
  trackingNumber: null, shippedAt: null, metadata: null,
  idempotencyKey: 'k', createdAt: new Date(), updatedAt: new Date(),
}

beforeEach(() => vi.clearAllMocks())

describe('RedemptionInspector', () => {
  it('shows Mark Fulfilled when PENDING', () => {
    render(<RedemptionInspector open detail={pending} isSuperAdmin onClose={() => {}} />)
    expect(screen.getByRole('button', { name: /mark fulfilled/i })).toBeTruthy()
  })
  it('hides actions when status FULFILLED', () => {
    render(<RedemptionInspector
      open
      detail={{ ...pending, status: 'FULFILLED' }}
      isSuperAdmin
      onClose={() => {}}
    />)
    expect(screen.queryByRole('button', { name: /mark fulfilled/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /cancel redemption/i })).toBeNull()
  })
  it('disables Cancel when not SUPER_ADMIN', () => {
    render(<RedemptionInspector open detail={pending} isSuperAdmin={false} onClose={() => {}} />)
    const c = screen.getByRole('button', { name: /cancel redemption/i }) as HTMLButtonElement
    expect(c.disabled).toBe(true)
    expect(c.title).toMatch(/SUPER_ADMIN/i)
  })
  it('calls fulfillRedemption with tracking number', async () => {
    fulfillRedemption.mockResolvedValue({ ok: true })
    render(<RedemptionInspector open detail={pending} isSuperAdmin onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/tracking number/i), { target: { value: 'TRACK-1' } })
    fireEvent.click(screen.getByRole('button', { name: /mark fulfilled/i }))
    await waitFor(() => expect(fulfillRedemption).toHaveBeenCalledWith('red1', 'TRACK-1'))
  })
})
