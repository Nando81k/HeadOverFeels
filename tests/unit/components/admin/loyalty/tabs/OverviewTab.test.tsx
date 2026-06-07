import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/components/admin/loyalty/charts/PointsActivityChart', () => ({
  PointsActivityChart: () => <div data-testid="chart-points-activity" />,
}))
vi.mock('@/components/admin/loyalty/charts/TierDistributionChart', () => ({
  TierDistributionChart: () => <div data-testid="chart-tier-distribution" />,
}))
vi.mock('@/components/admin/loyalty/charts/TopRewardsBar', () => ({
  TopRewardsBar: () => <div data-testid="chart-top-rewards" />,
}))
vi.mock('@/components/admin/loyalty/charts/MemberGrowthChart', () => ({
  MemberGrowthChart: () => <div data-testid="chart-member-growth" />,
}))
vi.mock('@/components/admin/loyalty/TierPerksQuickToggle', () => ({
  TierPerksQuickToggle: () => <div data-testid="tier-perks" />,
}))
vi.mock('@/components/admin/loyalty/RewardActivationsQuickToggle', () => ({
  RewardActivationsQuickToggle: () => <div data-testid="reward-activations" />,
}))
vi.mock('@/components/admin/loyalty/RecentTransactionsTable', () => ({
  RecentTransactionsTable: () => <div data-testid="recent-txns" />,
}))
vi.mock('@/components/admin/loyalty/PopularRewardsList', () => ({
  PopularRewardsList: () => <div data-testid="popular-rewards" />,
}))
vi.mock('@/components/admin/loyalty/ExportButton', () => ({
  ExportButton: () => <button>Export CSV</button>,
}))

import { OverviewTab } from '@/components/admin/loyalty/tabs/OverviewTab'

const data = {
  pointsActivity: [], tierDistribution: [], topRewards: [], memberGrowth: [],
  tierPerks: [], rewardActivations: [], recentTransactions: [], popularRewards: [],
}

describe('OverviewTab', () => {
  it('renders 4 charts + widgets + export', () => {
    render(<OverviewTab data={data} range="30d" />)
    expect(screen.getByTestId('chart-points-activity')).toBeTruthy()
    expect(screen.getByTestId('chart-tier-distribution')).toBeTruthy()
    expect(screen.getByTestId('chart-top-rewards')).toBeTruthy()
    expect(screen.getByTestId('chart-member-growth')).toBeTruthy()
    expect(screen.getByTestId('tier-perks')).toBeTruthy()
    expect(screen.getByTestId('reward-activations')).toBeTruthy()
    expect(screen.getByTestId('recent-txns')).toBeTruthy()
    expect(screen.getByTestId('popular-rewards')).toBeTruthy()
    expect(screen.getByRole('button', { name: /export/i })).toBeTruthy()
  })
})
