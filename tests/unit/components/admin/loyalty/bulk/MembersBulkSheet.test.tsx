import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ─── Server action mocks ────────────────────────────────────────────────────

const bulkRecomputeTiers = vi.fn()
const exportMembersCsv = vi.fn()

vi.mock('@/app/admin/loyalty/actions', () => ({
  bulkRecomputeTiers: (...a: unknown[]) => bulkRecomputeTiers(...a),
  exportMembersCsv: (...a: unknown[]) => exportMembersCsv(...a),
}))

vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@/components/admin/loyalty/AdjustPointsDialog', () => ({
  AdjustPointsDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="adjust-dialog-open" /> : null,
}))

// BottomActionSheet renders its children only when open=true, which is derived
// from selectedIds.length > 0 in the component under test.
vi.mock('@/components/ui/BottomActionSheet', () => ({
  BottomActionSheet: ({
    open,
    actions,
    onCancel,
  }: {
    open: boolean
    count: number
    actions: { label: string; onClick: () => void; disabled?: boolean }[]
    onCancel: () => void
  }) =>
    open ? (
      <div data-testid="bottom-sheet">
        {actions.map((a) => (
          <button key={a.label} type="button" onClick={a.onClick} disabled={a.disabled}>
            {a.label}
          </button>
        ))}
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    ) : null,
}))

import { MembersBulkSheet } from '@/components/admin/loyalty/bulk/MembersBulkSheet'

// ─── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  // Silence window.confirm (tests that need it stub it themselves)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  Object.assign(URL, {
    createObjectURL: vi.fn(() => 'blob:mock'),
    revokeObjectURL: vi.fn(),
  })
})

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('MembersBulkSheet', () => {
  it('opens AdjustPointsDialog on Adjust Points click', () => {
    render(<MembersBulkSheet selectedIds={['c1', 'c2']} isSuperAdmin onClear={() => {}} />)
    expect(screen.queryByTestId('adjust-dialog-open')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /adjust points/i }))
    expect(screen.getByTestId('adjust-dialog-open')).toBeTruthy()
  })

  it('calls bulkRecomputeTiers with selectedIds on Re-tier click', async () => {
    bulkRecomputeTiers.mockResolvedValue({
      ok: true,
      data: { succeeded: ['c1', 'c2'], failed: [] },
    })

    render(<MembersBulkSheet selectedIds={['c1', 'c2']} isSuperAdmin onClear={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /re-?tier/i }))

    await waitFor(() => expect(bulkRecomputeTiers).toHaveBeenCalledWith(['c1', 'c2']))
  })

  it('calls exportMembersCsv and triggers download on Export CSV click', async () => {
    exportMembersCsv.mockResolvedValue({ ok: true, data: { csv: 'id,email\nc1,a@b.com' } })

    render(<MembersBulkSheet selectedIds={['c1']} isSuperAdmin={false} onClear={() => {}} />)

    // Spy AFTER render so React's own DOM operations aren't intercepted
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {
      return document.createElement('a')
    })
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {
      return document.createElement('a')
    })

    fireEvent.click(screen.getByRole('button', { name: /export csv/i }))

    await waitFor(() => expect(exportMembersCsv).toHaveBeenCalled())

    appendSpy.mockRestore()
    removeSpy.mockRestore()
  })

  it('renders nothing (no sheet) when selectedIds is empty', () => {
    render(<MembersBulkSheet selectedIds={[]} isSuperAdmin onClear={() => {}} />)
    expect(screen.queryByTestId('bottom-sheet')).toBeNull()
  })
})
