import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const updateTier = vi.fn()
vi.mock('@/app/admin/loyalty/actions', () => ({
  updateTier: (...a: unknown[]) => updateTier(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { TierPerksQuickToggle } from '@/components/admin/loyalty/TierPerksQuickToggle'

const tiers = [
  { id: 't1', name: 'Bronze', primaryColor: '#64748B', freeShipping: false, earlyDropAccess: false, pointMultiplier: 1, sortOrder: 1 },
]

beforeEach(() => vi.clearAllMocks())

describe('TierPerksQuickToggle', () => {
  it('renders one row per tier', () => {
    render(<TierPerksQuickToggle tiers={tiers} />)
    expect(screen.getByText(/Bronze/)).toBeTruthy()
  })
  it('toggles freeShipping via updateTier', async () => {
    updateTier.mockResolvedValue({ ok: true })
    render(<TierPerksQuickToggle tiers={tiers} />)
    fireEvent.click(screen.getByLabelText(/Bronze.*free shipping/i))
    await waitFor(() => expect(updateTier).toHaveBeenCalledWith('t1', { freeShipping: true }))
  })
})
