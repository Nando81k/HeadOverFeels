'use client'

import { PointsActivityChart } from '@/components/admin/loyalty/charts/PointsActivityChart'
import { TierDistributionChart } from '@/components/admin/loyalty/charts/TierDistributionChart'
import { TopRewardsBar } from '@/components/admin/loyalty/charts/TopRewardsBar'
import { MemberGrowthChart } from '@/components/admin/loyalty/charts/MemberGrowthChart'
import { TierPerksQuickToggle } from '@/components/admin/loyalty/TierPerksQuickToggle'
import { RewardActivationsQuickToggle } from '@/components/admin/loyalty/RewardActivationsQuickToggle'
import { RecentTransactionsTable } from '@/components/admin/loyalty/RecentTransactionsTable'
import { PopularRewardsList } from '@/components/admin/loyalty/PopularRewardsList'
import { ExportButton } from '@/components/admin/loyalty/ExportButton'
import type { TimeRange } from '@/app/admin/loyalty/actions'
import type { PointsActivityPoint } from '@/components/admin/loyalty/charts/PointsActivityChart'
import type { TierDistributionPoint } from '@/components/admin/loyalty/charts/TierDistributionChart'
import type { TopRewardPoint } from '@/components/admin/loyalty/charts/TopRewardsBar'
import type { MemberGrowthPoint } from '@/components/admin/loyalty/charts/MemberGrowthChart'
import type { TierPerksRow } from '@/components/admin/loyalty/TierPerksQuickToggle'
import type { RewardActivationsRow } from '@/components/admin/loyalty/RewardActivationsQuickToggle'
import type { RecentTransactionRow } from '@/components/admin/loyalty/RecentTransactionsTable'
import type { PopularRewardRow } from '@/components/admin/loyalty/PopularRewardsList'

export interface OverviewTabData {
  pointsActivity: PointsActivityPoint[]
  tierDistribution: TierDistributionPoint[]
  topRewards: TopRewardPoint[]
  memberGrowth: MemberGrowthPoint[]
  tierPerks: TierPerksRow[]
  rewardActivations: RewardActivationsRow[]
  recentTransactions: RecentTransactionRow[]
  popularRewards: PopularRewardRow[]
}

export interface OverviewTabProps {
  data: OverviewTabData
  range: TimeRange
}

export function OverviewTab({ data, range }: OverviewTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <ExportButton tab="overview" range={range} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Points Activity</h3>
          <PointsActivityChart data={data.pointsActivity} />
        </div>
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Tier Distribution</h3>
          <TierDistributionChart data={data.tierDistribution} />
        </div>
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Top Rewards</h3>
          <TopRewardsBar data={data.topRewards} />
        </div>
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Member Growth</h3>
          <MemberGrowthChart data={data.memberGrowth} />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Tier Perks</h3>
          <TierPerksQuickToggle tiers={data.tierPerks} />
        </div>
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Reward Activations</h3>
          <RewardActivationsQuickToggle rewards={data.rewardActivations} />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Recent Activity</h3>
          <RecentTransactionsTable transactions={data.recentTransactions} />
        </div>
        <div className="bg-neutral-900/60 border border-white/8 rounded-md p-3">
          <h3 className="text-xs uppercase tracking-wide text-white/40 mb-2">Popular Rewards</h3>
          <PopularRewardsList rewards={data.popularRewards} />
        </div>
      </div>
    </div>
  )
}
