// tests/unit/components/admin/loyalty/bulk/RewardsBulkSheet.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const bulkActivateRewards = vi.fn()
const bulkDeactivateRewards = vi.fn()

vi.mock('@/app/admin/loyalty/actions', () => ({
  bulkActivateRewards: (...a: unknown[]) => bulkActivateRewards(...a),
  bulkDeactivateRewards: (...a: unknown[]) => bulkDeactivateRewards(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { RewardsBulkSheet } from '@/components/admin/loyalty/bulk/RewardsBulkSheet'

beforeEach(() => vi.clearAllMocks())

describe('RewardsBulkSheet', () => {
  it('activates selected rewards', async () => {
    bulkActivateRewards.mockResolvedValue({ ok: true, data: { succeeded: ['r1'], failed: [] } })
    render(<RewardsBulkSheet selectedIds={['r1','r2']} onClear={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /^activate$/i }))
    await waitFor(() => expect(bulkActivateRewards).toHaveBeenCalledWith(['r1','r2']))
  })
  it('deactivates selected rewards', async () => {
    bulkDeactivateRewards.mockResolvedValue({ ok: true, data: { succeeded: [], failed: [] } })
    render(<RewardsBulkSheet selectedIds={['r1']} onClear={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /^deactivate$/i }))
    await waitFor(() => expect(bulkDeactivateRewards).toHaveBeenCalledWith(['r1']))
  })
})
