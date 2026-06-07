import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const bulkFulfillRedemptions = vi.fn()
const bulkCancelRedemptions = vi.fn()

vi.mock('@/app/admin/loyalty/actions', () => ({
  bulkFulfillRedemptions: (...a: unknown[]) => bulkFulfillRedemptions(...a),
  bulkCancelRedemptions: (...a: unknown[]) => bulkCancelRedemptions(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { RedemptionsBulkSheet } from '@/components/admin/loyalty/bulk/RedemptionsBulkSheet'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RedemptionsBulkSheet', () => {
  it('fulfills with tracking prompt', async () => {
    bulkFulfillRedemptions.mockResolvedValue({ ok: true, data: { succeeded: ['red1'], failed: [] } })
    vi.spyOn(window, 'prompt').mockReturnValue('TRACK-1')
    render(<RedemptionsBulkSheet selectedIds={['red1']} isSuperAdmin onClear={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /mark fulfilled/i }))
    await waitFor(() => expect(bulkFulfillRedemptions).toHaveBeenCalled())
  })
  it('disables Cancel without SUPER_ADMIN', () => {
    render(<RedemptionsBulkSheet selectedIds={['red1']} isSuperAdmin={false} onClear={() => {}} />)
    const btn = screen.getByRole('button', { name: /cancel/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.title).toMatch(/SUPER_ADMIN/i)
  })
})
