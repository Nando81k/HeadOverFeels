// tests/unit/components/admin/marketing/PromotionsListView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { PromotionRow } from '@/lib/admin/marketing'

vi.mock('@/app/admin/marketing/actions', () => ({
  getPromotionDetailForInspector: vi.fn(async () => ({
    id: 'p1', name: 'Summer', description: null, code: 'SUMMER',
    type: 'PERCENTAGE', value: 20, autoApply: false, stackable: false,
    minimumPurchase: 0, maxUsesTotal: null, maxUsesPerCustomer: null, usedCount: 0,
    productIds: null, collectionIds: null, customerEmails: null,
    startDate: new Date(), endDate: null,
    isActive: true, maxDiscountPercent: null, excludeFromLoyalty: false,
    totalDiscountGiven: 0, createdAt: new Date(), updatedAt: new Date(),
  })),
  togglePromotionActive: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/components/admin/marketing/MarketingListTable', () => ({
  MarketingListTable: ({ onOpenInspector, onSelect }: {
    onOpenInspector: (id: string) => void
    onSelect: (id: string, checked: boolean) => void
  }) => (
    <div data-testid="table">
      <button data-testid="open-inspector" onClick={() => onOpenInspector('p1')}>Open</button>
      <button data-testid="select-row" onClick={() => onSelect('p1', true)}>Select</button>
    </div>
  ),
}))
vi.mock('@/components/admin/marketing/MarketingListCardMobile', () => ({
  MarketingListCardMobile: () => <div data-testid="card-mobile" />,
}))
vi.mock('@/components/admin/marketing/PromotionInspector', () => ({
  PromotionInspector: ({ open, detail }: { open: boolean; detail: unknown }) =>
    open ? <div data-testid="inspector">{detail ? 'loaded' : 'loading'}</div> : null,
}))
vi.mock('@/components/admin/marketing/PromotionBulkSheet', () => ({
  PromotionBulkSheet: ({ open, ids }: { open: boolean; ids: string[] }) =>
    open ? <div data-testid="bulk-sheet">{ids.length}</div> : null,
}))

const rows: PromotionRow[] = [
  { id: 'p1', name: 'Summer', code: 'SUMMER', type: 'PERCENTAGE', value: 20,
    isActive: true, usedCount: 0, maxUsesTotal: null,
    startDate: new Date(), endDate: null, totalDiscountGiven: 0,
    autoApply: false, stackable: false, createdAt: new Date() },
]

beforeEach(() => { vi.clearAllMocks() })

describe('PromotionsListView', () => {
  it('renders table and mobile card list', async () => {
    const { PromotionsListView } = await import('@/components/admin/marketing/PromotionsListView')
    render(<PromotionsListView rows={rows} />)
    expect(screen.getByTestId('table')).toBeInTheDocument()
  })

  it('opens inspector when row action clicked + loads detail', async () => {
    const { PromotionsListView } = await import('@/components/admin/marketing/PromotionsListView')
    render(<PromotionsListView rows={rows} />)
    fireEvent.click(screen.getByTestId('open-inspector'))
    await waitFor(() => {
      expect(screen.getByTestId('inspector').textContent).toBe('loaded')
    })
  })

  it('shows bulk sheet when selection > 0', async () => {
    const { PromotionsListView } = await import('@/components/admin/marketing/PromotionsListView')
    render(<PromotionsListView rows={rows} />)
    fireEvent.click(screen.getByTestId('select-row'))
    await waitFor(() => { expect(screen.getByTestId('bulk-sheet')).toBeInTheDocument() })
  })
})
