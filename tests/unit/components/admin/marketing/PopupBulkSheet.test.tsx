// tests/unit/components/admin/marketing/PopupBulkSheet.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/app/admin/marketing/actions', () => ({
  bulkActivatePopups: vi.fn(async () => ({ ok: true, affected: 2 })),
  bulkDeactivatePopups: vi.fn(async () => ({ ok: true, affected: 2 })),
  bulkDuplicatePopups: vi.fn(async () => ({ ok: true, affected: 2 })),
  bulkDeletePopups: vi.fn(async () => ({ ok: true, affected: 2 })),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/ui/BottomActionSheet', () => ({
  BottomActionSheet: ({ actions, open }: {
    open: boolean; actions: Array<{ label: string; onClick: () => void }>
  }) => open ? (
    <div data-testid="bulk-sheet">
      {actions.map((a) => <button key={a.label} onClick={a.onClick}>{a.label}</button>)}
    </div>
  ) : null,
}))

beforeEach(() => { vi.clearAllMocks() })

describe('PopupBulkSheet', () => {
  it('renders all 4 actions', async () => {
    const { PopupBulkSheet } = await import('@/components/admin/marketing/PopupBulkSheet')
    render(<PopupBulkSheet open ids={['p1']} onClear={vi.fn()} />)
    expect(screen.getByText('Activate')).toBeInTheDocument()
    expect(screen.getByText('Deactivate')).toBeInTheDocument()
    expect(screen.getByText('Duplicate')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('Duplicate calls bulkDuplicatePopups', async () => {
    const { PopupBulkSheet } = await import('@/components/admin/marketing/PopupBulkSheet')
    const { bulkDuplicatePopups } = await import('@/app/admin/marketing/actions')
    render(<PopupBulkSheet open ids={['p1']} onClear={vi.fn()} />)
    fireEvent.click(screen.getByText('Duplicate'))
    await waitFor(() => { expect(bulkDuplicatePopups).toHaveBeenCalledWith(['p1']) })
  })
})
