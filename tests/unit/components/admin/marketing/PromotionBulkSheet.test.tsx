// tests/unit/components/admin/marketing/PromotionBulkSheet.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/app/admin/marketing/actions', () => ({
  bulkActivatePromotions: vi.fn(async () => ({ ok: true, affected: 2 })),
  bulkDeactivatePromotions: vi.fn(async () => ({ ok: true, affected: 2 })),
  bulkDeletePromotions: vi.fn(async () => ({ ok: true, affected: 2 })),
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/ui/BottomActionSheet', () => ({
  BottomActionSheet: ({ actions, open }: {
    open: boolean
    actions: Array<{ label: string; onClick: () => void }>
  }) => open ? (
    <div data-testid="bulk-sheet">
      {actions.map((a) => (
        <button key={a.label} onClick={a.onClick}>{a.label}</button>
      ))}
    </div>
  ) : null,
}))

beforeEach(() => { vi.clearAllMocks() })

describe('PromotionBulkSheet', () => {
  it('renders Activate / Deactivate / Delete actions', async () => {
    const { PromotionBulkSheet } = await import('@/components/admin/marketing/PromotionBulkSheet')
    render(<PromotionBulkSheet open ids={['p1', 'p2']} onClear={vi.fn()} />)
    expect(screen.getByText('Activate')).toBeInTheDocument()
    expect(screen.getByText('Deactivate')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('Activate calls bulkActivatePromotions', async () => {
    const { PromotionBulkSheet } = await import('@/components/admin/marketing/PromotionBulkSheet')
    const { bulkActivatePromotions } = await import('@/app/admin/marketing/actions')
    render(<PromotionBulkSheet open ids={['p1', 'p2']} onClear={vi.fn()} />)
    fireEvent.click(screen.getByText('Activate'))
    await waitFor(() => {
      expect(bulkActivatePromotions).toHaveBeenCalledWith(['p1', 'p2'])
    })
  })

  it('Delete calls bulkDeletePromotions after confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { PromotionBulkSheet } = await import('@/components/admin/marketing/PromotionBulkSheet')
    const { bulkDeletePromotions } = await import('@/app/admin/marketing/actions')
    render(<PromotionBulkSheet open ids={['p1', 'p2']} onClear={vi.fn()} />)
    fireEvent.click(screen.getByText('Delete'))
    await waitFor(() => {
      expect(bulkDeletePromotions).toHaveBeenCalledWith(['p1', 'p2'])
    })
  })
})
