'use client'

import type { RewardType } from '@/app/admin/loyalty/actions'

export interface PopularRewardRow {
  id: string
  name: string
  pointsCost: number
  totalRedeemed: number
  rewardType: RewardType
}

export interface PopularRewardsListProps {
  rewards: PopularRewardRow[]
}

const nFmt = new Intl.NumberFormat('en-US')

export function PopularRewardsList({ rewards }: PopularRewardsListProps) {
  if (rewards.length === 0) {
    return <div className="text-xs text-white/40 py-2">No rewards yet.</div>
  }
  return (
    <ul className="divide-y divide-white/8">
      {rewards.map((r, i) => (
        <li key={r.id} className="flex items-center gap-3 py-2 text-xs text-white/80">
          <span className="text-white/30 w-4 text-right">{i + 1}.</span>
          <span className="flex-1 truncate">
            <span className="text-white font-medium">{r.name}</span>
            <span className="text-white/40"> — {r.rewardType}</span>
          </span>
          <span className="text-white/50">{nFmt.format(r.pointsCost)} pts</span>
          <span className="text-emerald-400">{nFmt.format(r.totalRedeemed)}</span>
        </li>
      ))}
    </ul>
  )
}
