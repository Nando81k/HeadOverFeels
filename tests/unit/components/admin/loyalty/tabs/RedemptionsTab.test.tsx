import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const getRedemptionDetailForInspector = vi.fn()
vi.mock('@/app/admin/loyalty/actions', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/app/admin/loyalty/actions')
  return { ...actual, getRedemptionDetailForInspector: (...a: unknown[]) => getRedemptionDetailForInspector(...a) }
})
vi.mock('@/components/admin/loyalty/inspectors/RedemptionInspector', () => ({
  RedemptionInspector: ({ open }: { open: boolean }) =>
    open ? <div data-testid="redemption-inspector-open" /> : null,
}))
vi.mock('@/components/admin/loyalty/bulk/RedemptionsBulkSheet', () => ({
  RedemptionsBulkSheet: ({ selectedIds }: { selectedIds: string[] }) =>
    selectedIds.length > 0 ? <div data-testid="redemptions-bulk" /> : null,
}))
vi.mock('@/components/admin/loyalty/ExportButton', () => ({
  ExportButton: () => <button>Export CSV</button>,
}))

import { RedemptionsTab } from '@/components/admin/loyalty/tabs/RedemptionsTab'

const data = {
  items: [
    { id: 'red1', customerId: 'c1', customerEmail: 'a@e.com', customerName: 'Ada',
      rewardId: 'r1', rewardName: '10% off', rewardType: 'DISCOUNT' as const,
      pointsSpent: 500, status: 'PENDING' as const, couponCode: 'HOF-ABC',
      trackingNumber: null, createdAt: new Date() },
  ],
  total: 1, page: 1, pageSize: 25,
}

beforeEach(() => vi.clearAllMocks())

describe('RedemptionsTab', () => {
  it('renders rows', () => {
    render(<RedemptionsTab data={data} range="30d" isSuperAdmin />)
    expect(screen.getByText(/a@e\.com/)).toBeTruthy()
  })
  it('opens Inspector on click', async () => {
    getRedemptionDetailForInspector.mockResolvedValue({
      ...data.items[0], usedAt: null, orderId: null, shippedAt: null,
      metadata: null, idempotencyKey: 'k', updatedAt: new Date(),
    })
    render(<RedemptionsTab data={data} range="30d" isSuperAdmin />)
    fireEvent.click(screen.getByText(/a@e\.com/))
    await waitFor(() => expect(screen.queryByTestId('redemption-inspector-open')).toBeTruthy())
  })
  it('shows BulkSheet when selected', () => {
    render(<RedemptionsTab data={data} range="30d" isSuperAdmin />)
    fireEvent.click(screen.getByLabelText(/select red1/i))
    expect(screen.getByTestId('redemptions-bulk')).toBeTruthy()
  })
})
