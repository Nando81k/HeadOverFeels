'use client'

import { useState, useTransition } from 'react'
import { toggleRewardActive } from '@/app/admin/loyalty/actions'
import { toast } from '@/lib/toast'

export interface RewardActivationsRow {
  id: string
  name: string
  pointsCost: number
  isActive: boolean
  totalRedeemed: number
  sortOrder: number
}

export interface RewardActivationsQuickToggleProps {
  rewards: RewardActivationsRow[]
  onChange?: () => void
}

const nFmt = new Intl.NumberFormat('en-US')

export function RewardActivationsQuickToggle({
  rewards: initial,
  onChange,
}: RewardActivationsQuickToggleProps) {
  const [rewards, setRewards] = useState(initial)
  const [, startTransition] = useTransition()

  const onToggle = (id: string) => {
    const prev = rewards
    const next = rewards.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r))
    setRewards(next)
    startTransition(async () => {
      const result = await toggleRewardActive(id)
      if (!result.ok) {
        setRewards(prev)
        toast.error(result.error)
      } else {
        toast.success('Reward updated')
        onChange?.()
      }
    })
  }

  return (
    <div className="space-y-1.5">
      {rewards.length === 0 ? (
        <div className="text-xs text-white/40 py-2">No rewards configured.</div>
      ) : (
        rewards.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-3 px-3 py-2 bg-white/[0.02] border border-white/8 rounded-md text-xs text-white/80"
          >
            <span className="flex-1 font-medium">{r.name}</span>
            <span className="text-white/40">{nFmt.format(r.pointsCost)} pts</span>
            <span className="text-white/40">{nFmt.format(r.totalRedeemed)} redeemed</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                aria-label={`${r.name} active`}
                checked={r.isActive}
                onChange={() => onToggle(r.id)}
                className="rounded"
              />
              <span>Active</span>
            </label>
          </div>
        ))
      )}
    </div>
  )
}
