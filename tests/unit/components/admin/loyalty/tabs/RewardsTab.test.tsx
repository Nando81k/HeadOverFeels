import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const getRewardDetailForInspector = vi.fn()
vi.mock('@/app/admin/loyalty/actions', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/app/admin/loyalty/actions')
  return { ...actual, getRewardDetailForInspector: (...a: unknown[]) => getRewardDetailForInspector(...a) }
})
vi.mock('@/components/admin/loyalty/inspectors/RewardInspector', () => ({
  RewardInspector: ({ open }: { open: boolean }) =>
    open ? <div data-testid="reward-inspector-open" /> : null,
}))
vi.mock('@/components/admin/loyalty/bulk/RewardsBulkSheet', () => ({
  RewardsBulkSheet: ({ selectedIds }: { selectedIds: string[] }) =>
    selectedIds.length > 0 ? <div data-testid="rewards-bulk" /> : null,
}))
vi.mock('@/components/admin/loyalty/ExportButton', () => ({
  ExportButton: () => <button>Export CSV</button>,
}))

import { RewardsTab } from '@/components/admin/loyalty/tabs/RewardsTab'

const data = {
  items: [
    {
      id: 'r1',
      name: '10% off',
      slug: '10-off',
      pointsCost: 500,
      rewardType: 'DISCOUNT' as const,
      isActive: true,
      totalRedeemed: 5,
      maxRedemptionsPerCustomer: null,
      totalAvailable: null,
      minTierRequired: null,
      sortOrder: 0,
      image: null,
    },
  ],
  total: 1,
  page: 1,
  pageSize: 25,
}

beforeEach(() => vi.clearAllMocks())

describe('RewardsTab', () => {
  it('renders card + new link + export', () => {
    render(<RewardsTab data={data} range="30d" />)
    expect(screen.getByText(/10% off/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /new reward/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /export/i })).toBeTruthy()
  })

  it('opens RewardInspector on card click', async () => {
    getRewardDetailForInspector.mockResolvedValue({
      ...data.items[0],
      description: 'd',
      value: null,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    render(<RewardsTab data={data} range="30d" />)
    fireEvent.click(screen.getByText(/10% off/))
    await waitFor(() => expect(screen.queryByTestId('reward-inspector-open')).toBeTruthy())
  })

  it('shows BulkSheet when selected', () => {
    render(<RewardsTab data={data} range="30d" />)
    fireEvent.click(screen.getByLabelText(/select r1/i))
    expect(screen.getByTestId('rewards-bulk')).toBeTruthy()
  })
})
