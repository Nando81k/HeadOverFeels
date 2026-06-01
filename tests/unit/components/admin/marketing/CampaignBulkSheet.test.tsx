import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/app/admin/marketing/actions', () => ({
  bulkDuplicateCampaigns: vi.fn(async () => ({ ok: true, affected: 2 })),
  bulkDeleteCampaigns: vi.fn(async () => ({ ok: true, affected: 1 })),
}))
const toastWarn = vi.fn()
vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: toastWarn },
}))
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

describe('CampaignBulkSheet', () => {
  it('renders Duplicate and Delete actions', async () => {
    const { CampaignBulkSheet } = await import('@/components/admin/marketing/CampaignBulkSheet')
    render(<CampaignBulkSheet open
      rows={[{ id: 'c1', status: 'DRAFT' }]} onClear={vi.fn()} />)
    expect(screen.getByText('Duplicate')).toBeInTheDocument()
    expect(screen.getByText('Delete drafts')).toBeInTheDocument()
  })

  it('Duplicate calls bulkDuplicateCampaigns', async () => {
    const { CampaignBulkSheet } = await import('@/components/admin/marketing/CampaignBulkSheet')
    const { bulkDuplicateCampaigns } = await import('@/app/admin/marketing/actions')
    render(<CampaignBulkSheet open
      rows={[{ id: 'c1', status: 'DRAFT' }, { id: 'c2', status: 'SENT' }]} onClear={vi.fn()} />)
    fireEvent.click(screen.getByText('Duplicate'))
    await waitFor(() => { expect(bulkDuplicateCampaigns).toHaveBeenCalledWith(['c1', 'c2']) })
  })

  it('Delete drafts warns when selection includes non-DRAFT campaigns', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { CampaignBulkSheet } = await import('@/components/admin/marketing/CampaignBulkSheet')
    render(<CampaignBulkSheet open
      rows={[{ id: 'c1', status: 'DRAFT' }, { id: 'c2', status: 'SENT' }]} onClear={vi.fn()} />)
    fireEvent.click(screen.getByText('Delete drafts'))
    await waitFor(() => { expect(toastWarn).toHaveBeenCalled() })
  })
})
