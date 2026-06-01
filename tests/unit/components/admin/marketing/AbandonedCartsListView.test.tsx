// tests/unit/components/admin/marketing/AbandonedCartsListView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { AbandonedCartRow } from '@/lib/admin/marketing'

vi.mock('@/app/admin/marketing/actions', () => ({
  getAbandonedCartDetailForInspector: vi.fn(async () => ({
    id: 'ac1', customerId: null, customerEmail: 'a@e.com', customerName: null,
    items: [], totalValue: 0, itemCount: 0,
    recoveryEmailSent: false, recoveryEmailSentAt: null,
    recovered: false, recoveredAt: null, recoveryOrderId: null,
    abandonedAt: new Date(), expiresAt: new Date(),
    discountCode: null,
  })),
  sendCartRecoveryEmail: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/components/admin/marketing/MarketingListTable', () => ({
  MarketingListTable: ({ onOpenInspector, onSelect }: {
    onOpenInspector: (id: string) => void
    onSelect: (id: string, c: boolean) => void
  }) => (
    <div data-testid="table">
      <button data-testid="open-inspector" onClick={() => onOpenInspector('ac1')}>Open</button>
      <button data-testid="select-row" onClick={() => onSelect('ac1', true)}>Select</button>
    </div>
  ),
}))
vi.mock('@/components/admin/marketing/MarketingListCardMobile', () => ({
  MarketingListCardMobile: () => <div data-testid="card-mobile" />,
}))
vi.mock('@/components/admin/marketing/AbandonedCartInspector', () => ({
  AbandonedCartInspector: ({ open }: { open: boolean }) =>
    open ? <div data-testid="inspector" /> : null,
}))
vi.mock('@/components/admin/marketing/AbandonedCartBulkSheet', () => ({
  AbandonedCartBulkSheet: ({ open, ids }: { open: boolean; ids: string[] }) =>
    open ? <div data-testid="bulk-sheet">{ids.length}</div> : null,
}))

const rows: AbandonedCartRow[] = [
  { id: 'ac1', customerEmail: 'a@e.com', customerName: null,
    totalValue: 0, itemCount: 0, recovered: false,
    recoveryEmailSent: false, abandonedAt: new Date(),
    expiresAt: new Date(), discountCode: null },
]

beforeEach(() => { vi.clearAllMocks() })

describe('AbandonedCartsListView', () => {
  it('opens inspector', async () => {
    const { AbandonedCartsListView } = await import('@/components/admin/marketing/AbandonedCartsListView')
    render(<AbandonedCartsListView rows={rows} />)
    fireEvent.click(screen.getByTestId('open-inspector'))
    await waitFor(() => { expect(screen.getByTestId('inspector')).toBeInTheDocument() })
  })

  it('shows bulk sheet on selection', async () => {
    const { AbandonedCartsListView } = await import('@/components/admin/marketing/AbandonedCartsListView')
    render(<AbandonedCartsListView rows={rows} />)
    fireEvent.click(screen.getByTestId('select-row'))
    await waitFor(() => { expect(screen.getByTestId('bulk-sheet').textContent).toBe('1') })
  })
})
