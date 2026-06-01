// tests/unit/components/admin/marketing/PopupsListView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { PopupRow } from '@/lib/admin/marketing'

vi.mock('@/app/admin/marketing/actions', () => ({
  getPopupDetailForInspector: vi.fn(async () => ({
    id: 'pp1', name: 'Welcome', template: 'MODAL', position: 'CENTER',
    content: '{}', triggerType: 'DELAY', triggerValue: 3,
    showOnPages: 'all', showToNewVisitors: true, showToReturning: false,
    frequency: 'ONCE_PER_SESSION', startDate: null, endDate: null,
    isActive: true, priority: 0, promotionId: null,
    createdAt: new Date(), updatedAt: new Date(),
    variants: [],
    analytics7d: { impressions: 0, clicks: 0, dismissals: 0, conversions: 0 },
  })),
  togglePopupActive: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/components/admin/marketing/MarketingListTable', () => ({
  MarketingListTable: ({ onOpenInspector, onSelect }: {
    onOpenInspector: (id: string) => void
    onSelect: (id: string, checked: boolean) => void
  }) => (
    <div data-testid="table">
      <button data-testid="open-inspector" onClick={() => onOpenInspector('pp1')}>Open</button>
      <button data-testid="select-row" onClick={() => onSelect('pp1', true)}>Select</button>
    </div>
  ),
}))
vi.mock('@/components/admin/marketing/MarketingListCardMobile', () => ({
  MarketingListCardMobile: () => <div data-testid="card-mobile" />,
}))
vi.mock('@/components/admin/marketing/PopupInspector', () => ({
  PopupInspector: ({ open, detail }: { open: boolean; detail: unknown }) =>
    open ? <div data-testid="inspector">{detail ? 'loaded' : 'loading'}</div> : null,
}))
vi.mock('@/components/admin/marketing/PopupBulkSheet', () => ({
  PopupBulkSheet: ({ open, ids }: { open: boolean; ids: string[] }) =>
    open ? <div data-testid="bulk-sheet">{ids.length}</div> : null,
}))

const rows: PopupRow[] = [
  { id: 'pp1', name: 'Welcome', template: 'MODAL', position: 'CENTER',
    triggerType: 'DELAY', isActive: true, priority: 0,
    impressions7d: 0, conversions7d: 0,
    startDate: null, endDate: null, createdAt: new Date() },
]

beforeEach(() => { vi.clearAllMocks() })

describe('PopupsListView', () => {
  it('opens inspector and loads detail', async () => {
    const { PopupsListView } = await import('@/components/admin/marketing/PopupsListView')
    render(<PopupsListView rows={rows} />)
    fireEvent.click(screen.getByTestId('open-inspector'))
    await waitFor(() => {
      expect(screen.getByTestId('inspector').textContent).toBe('loaded')
    })
  })

  it('shows bulk sheet when row selected', async () => {
    const { PopupsListView } = await import('@/components/admin/marketing/PopupsListView')
    render(<PopupsListView rows={rows} />)
    fireEvent.click(screen.getByTestId('select-row'))
    await waitFor(() => { expect(screen.getByTestId('bulk-sheet')).toBeInTheDocument() })
  })
})
