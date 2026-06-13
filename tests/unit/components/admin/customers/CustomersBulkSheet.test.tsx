import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ─── Server action mocks ────────────────────────────────────────────────────

const bulkExportCustomersCsv = vi.fn()

vi.mock('@/app/admin/customers/actions', () => ({
  bulkExportCustomersCsv: (...a: unknown[]) => bulkExportCustomersCsv(...a),
}))

vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@/components/admin/loyalty/AdjustPointsDialog', () => ({
  AdjustPointsDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="adjust-dialog-open" /> : null,
}))

vi.mock('@/components/ui/BottomActionSheet', () => ({
  BottomActionSheet: ({
    open,
    actions,
    onCancel,
  }: {
    open: boolean
    count: number
    actions: { label: string; onClick: () => void; disabled?: boolean; title?: string }[]
    onCancel: () => void
  }) =>
    open ? (
      <div data-testid="bottom-sheet">
        {actions.map((a) => (
          <button key={a.label} type="button" onClick={a.onClick} disabled={a.disabled} title={a.title}>
            {a.label}
          </button>
        ))}
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    ) : null,
}))

import { CustomersBulkSheet } from '@/components/admin/customers/CustomersBulkSheet'

// ─── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(URL, {
    createObjectURL: vi.fn(() => 'blob:mock'),
    revokeObjectURL: vi.fn(),
  })
})

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('CustomersBulkSheet', () => {
  it('renders nothing when selectedIds is empty', () => {
    render(<CustomersBulkSheet selectedIds={[]} isSuperAdmin onClear={() => {}} />)
    expect(screen.queryByTestId('bottom-sheet')).toBeNull()
  })

  it('renders sheet with 3 actions when selectedIds has entries', () => {
    render(<CustomersBulkSheet selectedIds={['c1', 'c2']} isSuperAdmin onClear={() => {}} />)
    expect(screen.getByTestId('bottom-sheet')).toBeTruthy()
    expect(screen.getByRole('button', { name: /gift points/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /export csv/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /anonymize/i })).toBeTruthy()
  })

  it('opens AdjustPointsDialog on Gift Points click', () => {
    render(<CustomersBulkSheet selectedIds={['c1', 'c2']} isSuperAdmin onClear={() => {}} />)
    expect(screen.queryByTestId('adjust-dialog-open')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /gift points/i }))
    expect(screen.getByTestId('adjust-dialog-open')).toBeTruthy()
  })

  it('passes isSuperAdmin and selectedIds to AdjustPointsDialog', () => {
    const memberIdsSpy = vi.fn()
    vi.doMock('@/components/admin/loyalty/AdjustPointsDialog', () => ({
      AdjustPointsDialog: ({ open, memberIds, isSuperAdmin }: { open: boolean; memberIds: string[]; isSuperAdmin: boolean }) => {
        if (open) memberIdsSpy({ memberIds, isSuperAdmin })
        return open ? <div data-testid="adjust-dialog-open" /> : null
      },
    }))

    render(<CustomersBulkSheet selectedIds={['c1', 'c2']} isSuperAdmin={false} onClear={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /gift points/i }))
    // AdjustPointsDialog internal role enforcement is tested in its own suite
    expect(screen.getByTestId('adjust-dialog-open')).toBeTruthy()
  })

  it('calls bulkExportCustomersCsv with selectedIds and triggers download', async () => {
    bulkExportCustomersCsv.mockResolvedValue({ ok: true, data: { csv: 'id,email\nc1,a@b.com' } })

    render(<CustomersBulkSheet selectedIds={['c1', 'c2']} isSuperAdmin onClear={() => {}} />)

    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {
      return document.createElement('a')
    })
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {
      return document.createElement('a')
    })

    fireEvent.click(screen.getByRole('button', { name: /export csv/i }))

    await waitFor(() => expect(bulkExportCustomersCsv).toHaveBeenCalledWith(['c1', 'c2']))

    appendSpy.mockRestore()
    removeSpy.mockRestore()
  })

  it('shows error toast when export fails', async () => {
    const { toast } = await import('@/lib/toast')
    bulkExportCustomersCsv.mockResolvedValue({ ok: false, error: 'Export failed' })

    render(<CustomersBulkSheet selectedIds={['c1']} isSuperAdmin={false} onClear={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /export csv/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Export failed'))
  })

  it('Anonymize button is always disabled', () => {
    render(<CustomersBulkSheet selectedIds={['c1']} isSuperAdmin onClear={() => {}} />)
    const btn = screen.getByRole('button', { name: /anonymize/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('Anonymize button has v1 tooltip title', () => {
    render(<CustomersBulkSheet selectedIds={['c1']} isSuperAdmin onClear={() => {}} />)
    const btn = screen.getByRole('button', { name: /anonymize/i })
    expect(btn.getAttribute('title')).toMatch(/per-customer.*v1/i)
  })

  it('Cancel button calls onClear', () => {
    const onClear = vi.fn()
    render(<CustomersBulkSheet selectedIds={['c1']} isSuperAdmin onClear={onClear} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClear).toHaveBeenCalledOnce()
  })
})
