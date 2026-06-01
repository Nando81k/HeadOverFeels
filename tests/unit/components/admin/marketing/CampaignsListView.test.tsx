// tests/unit/components/admin/marketing/CampaignsListView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { CampaignRow } from '@/lib/admin/marketing'

vi.mock('@/app/admin/marketing/actions', () => ({
  getCampaignDetailForInspector: vi.fn(async () => ({
    id: 'c1', name: null, subject: 'Hello', preheader: 'P',
    heroImageUrl: null, ctaLabel: 'Shop', ctaUrl: '/', bodyMarkdown: 'B',
    status: 'DRAFT', audienceFilter: {}, audienceCount: 0,
    sentCount: 0, failedCount: 0, createdByAdminId: 'a',
    sentAt: null, createdAt: new Date(), updatedAt: new Date(),
    recentTestDeliveries: [],
  })),
}))
vi.mock('@/components/admin/marketing/MarketingListTable', () => ({
  MarketingListTable: ({ onOpenInspector, onSelect }: {
    onOpenInspector: (id: string) => void
    onSelect: (id: string, c: boolean) => void
  }) => (
    <div data-testid="table">
      <button data-testid="open-inspector" onClick={() => onOpenInspector('c1')}>Open</button>
      <button data-testid="select-row" onClick={() => onSelect('c1', true)}>Select</button>
    </div>
  ),
}))
vi.mock('@/components/admin/marketing/MarketingListCardMobile', () => ({
  MarketingListCardMobile: () => <div data-testid="card-mobile" />,
}))
vi.mock('@/components/admin/marketing/CampaignInspector', () => ({
  CampaignInspector: ({ open }: { open: boolean }) =>
    open ? <div data-testid="inspector" /> : null,
}))
vi.mock('@/components/admin/marketing/CampaignBulkSheet', () => ({
  CampaignBulkSheet: ({ open, rows }: { open: boolean; rows: Array<{ id: string }> }) =>
    open ? <div data-testid="bulk-sheet">{rows.length}</div> : null,
}))

const rows: CampaignRow[] = [
  { id: 'c1', name: null, subject: 'Hello', status: 'DRAFT',
    audienceCount: 0, sentCount: 0, failedCount: 0,
    sentAt: null, createdAt: new Date() },
]

beforeEach(() => { vi.clearAllMocks() })

describe('CampaignsListView', () => {
  it('opens inspector', async () => {
    const { CampaignsListView } = await import('@/components/admin/marketing/CampaignsListView')
    render(<CampaignsListView rows={rows} />)
    fireEvent.click(screen.getByTestId('open-inspector'))
    await waitFor(() => { expect(screen.getByTestId('inspector')).toBeInTheDocument() })
  })

  it('passes full rows (id + status) to CampaignBulkSheet', async () => {
    const { CampaignsListView } = await import('@/components/admin/marketing/CampaignsListView')
    render(<CampaignsListView rows={rows} />)
    fireEvent.click(screen.getByTestId('select-row'))
    await waitFor(() => { expect(screen.getByTestId('bulk-sheet').textContent).toBe('1') })
  })
})
