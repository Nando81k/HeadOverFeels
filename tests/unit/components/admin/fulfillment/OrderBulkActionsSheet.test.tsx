// tests/unit/components/admin/fulfillment/OrderBulkActionsSheet.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OrderBulkActionsSheet } from '@/components/admin/fulfillment/OrderBulkActionsSheet'

const bulkMarkShipped = vi.fn()
const bulkPurchaseLabels = vi.fn()
const bulkSendTrackingEmail = vi.fn()
const bulkExportCsv = vi.fn()

vi.mock('@/app/admin/fulfillment/actions', () => ({
  bulkMarkShipped: (...a: unknown[]) => bulkMarkShipped(...a),
  bulkPurchaseLabels: (...a: unknown[]) => bulkPurchaseLabels(...a),
  bulkSendTrackingEmail: (...a: unknown[]) => bulkSendTrackingEmail(...a),
  bulkExportCsv: (...a: unknown[]) => bulkExportCsv(...a),
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
  // jsdom URL.createObjectURL
  Object.defineProperty(window.URL, 'createObjectURL', { writable: true, value: vi.fn(() => 'blob:fake') })
  Object.defineProperty(window.URL, 'revokeObjectURL', { writable: true, value: vi.fn() })
})

describe('OrderBulkActionsSheet', () => {
  it('renders 4 actions when open', () => {
    render(<OrderBulkActionsSheet open={true} orderIds={['o1', 'o2']} onClear={() => {}} />)
    expect(screen.getByRole('button', { name: /mark shipped/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /print labels/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send tracking/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument()
  })

  it('Mark Shipped prompts for tracking per order', async () => {
    bulkMarkShipped.mockResolvedValue({ ok: true, affected: 2 })
    const onClear = vi.fn()
    const promptSpy = vi.spyOn(window, 'prompt').mockImplementation(() => '1Z-PROMPTED')
    render(<OrderBulkActionsSheet open={true} orderIds={['o1', 'o2']} onClear={onClear} />)
    fireEvent.click(screen.getByRole('button', { name: /mark shipped/i }))
    await waitFor(() => expect(bulkMarkShipped).toHaveBeenCalled())
    expect(promptSpy).toHaveBeenCalledTimes(2)
    const callArgs = bulkMarkShipped.mock.calls[0]
    expect(callArgs[0]).toEqual(['o1', 'o2'])
    expect(callArgs[1].o1.trackingNumber).toBe('1Z-PROMPTED')
    expect(onClear).toHaveBeenCalled()
    promptSpy.mockRestore()
  })

  it('Print Labels calls bulkPurchaseLabels', async () => {
    bulkPurchaseLabels.mockResolvedValue({ ok: true, affected: 1 })
    render(<OrderBulkActionsSheet open={true} orderIds={['o1']} onClear={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /print labels/i }))
    await waitFor(() => expect(bulkPurchaseLabels).toHaveBeenCalledWith(['o1']))
  })

  it('Send Tracking calls bulkSendTrackingEmail', async () => {
    bulkSendTrackingEmail.mockResolvedValue({ ok: true, affected: 1 })
    render(<OrderBulkActionsSheet open={true} orderIds={['o1']} onClear={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /send tracking/i }))
    await waitFor(() => expect(bulkSendTrackingEmail).toHaveBeenCalledWith(['o1']))
  })

  it('Export CSV triggers download of returned csv', async () => {
    bulkExportCsv.mockResolvedValue({ ok: true, data: { csv: 'h\nv' } })
    render(<OrderBulkActionsSheet open={true} orderIds={['o1']} onClear={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /export csv/i }))
    await waitFor(() => expect(bulkExportCsv).toHaveBeenCalledWith(['o1']))
    expect(window.URL.createObjectURL).toHaveBeenCalled()
  })
})
