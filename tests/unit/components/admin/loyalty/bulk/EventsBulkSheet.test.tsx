import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const bulkActivateEvents = vi.fn()
const bulkDeactivateEvents = vi.fn()

vi.mock('@/app/admin/loyalty/actions', () => ({
  bulkActivateEvents: (...a: unknown[]) => bulkActivateEvents(...a),
  bulkDeactivateEvents: (...a: unknown[]) => bulkDeactivateEvents(...a),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { EventsBulkSheet } from '@/components/admin/loyalty/bulk/EventsBulkSheet'

beforeEach(() => vi.clearAllMocks())

describe('EventsBulkSheet', () => {
  it('activates selected events', async () => {
    bulkActivateEvents.mockResolvedValue({ ok: true, data: { succeeded: ['e1'], failed: [] } })
    render(<EventsBulkSheet selectedIds={['e1']} onClear={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /^activate$/i }))
    await waitFor(() => expect(bulkActivateEvents).toHaveBeenCalledWith(['e1']))
  })
  it('deactivates selected events', async () => {
    bulkDeactivateEvents.mockResolvedValue({ ok: true, data: { succeeded: [], failed: [] } })
    render(<EventsBulkSheet selectedIds={['e1']} onClear={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /^deactivate$/i }))
    await waitFor(() => expect(bulkDeactivateEvents).toHaveBeenCalledWith(['e1']))
  })
})
