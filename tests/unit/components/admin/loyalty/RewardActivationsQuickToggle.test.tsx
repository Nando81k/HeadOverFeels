import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const toggleRewardActive = vi.fn()
vi.mock('@/app/admin/loyalty/actions', () => ({
  toggleRewardActive: (...a: unknown[]) => toggleRewardActive(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { RewardActivationsQuickToggle } from '@/components/admin/loyalty/RewardActivationsQuickToggle'

const rewards = [
  { id: 'r1', name: '10% off', pointsCost: 500, isActive: true, totalRedeemed: 0, sortOrder: 0 },
]

beforeEach(() => vi.clearAllMocks())

describe('RewardActivationsQuickToggle', () => {
  it('renders rows', () => {
    render(<RewardActivationsQuickToggle rewards={rewards} />)
    expect(screen.getByText(/10% off/)).toBeTruthy()
  })
  it('toggles active via toggleRewardActive', async () => {
    toggleRewardActive.mockResolvedValue({ ok: true })
    render(<RewardActivationsQuickToggle rewards={rewards} />)
    fireEvent.click(screen.getByLabelText(/10% off active/i))
    await waitFor(() => expect(toggleRewardActive).toHaveBeenCalledWith('r1'))
  })
})
