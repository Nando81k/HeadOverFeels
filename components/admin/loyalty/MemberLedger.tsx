'use client'

import { useState } from 'react'
import type { PointsTransactionType } from '@/app/admin/loyalty/actions'

export interface MemberLedgerEntry {
  id: string
  points: number
  type: PointsTransactionType
  description: string
  createdAt: Date
  orderId: string | null
  redemptionId: string | null
  referralId: string | null
  reviewId: string | null
}

export interface MemberLedgerProps {
  entries: MemberLedgerEntry[]
  maxHeight?: string
}

type FilterValue = 'all' | PointsTransactionType

const FILTER_OPTIONS: Array<{ value: FilterValue; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'PURCHASE', label: 'Purchase' },
  { value: 'REDEMPTION', label: 'Redemption' },
  { value: 'ADMIN_ADJUSTMENT', label: 'Admin adjust' },
  { value: 'TIER_BONUS', label: 'Tier bonus' },
  { value: 'BIRTHDAY', label: 'Birthday' },
  { value: 'REVIEW', label: 'Review' },
  { value: 'REFERRAL_GIVE', label: 'Referral give' },
  { value: 'REFERRAL_RECEIVE', label: 'Referral receive' },
  { value: 'EXPIRATION', label: 'Expiration' },
]

const TYPE_PILL_COLORS: Partial<Record<PointsTransactionType, string>> = {
  PURCHASE: 'bg-blue-500/20 text-blue-300',
  REDEMPTION: 'bg-purple-500/20 text-purple-300',
  ADMIN_ADJUSTMENT: 'bg-amber-500/20 text-amber-300',
  TIER_BONUS: 'bg-emerald-500/20 text-emerald-300',
  BIRTHDAY: 'bg-pink-500/20 text-pink-300',
  REVIEW: 'bg-cyan-500/20 text-cyan-300',
  REFERRAL_GIVE: 'bg-violet-500/20 text-violet-300',
  REFERRAL_RECEIVE: 'bg-violet-500/20 text-violet-300',
  EXPIRATION: 'bg-red-500/20 text-red-300',
}

const TYPE_LABELS: Partial<Record<PointsTransactionType, string>> = {
  PURCHASE: 'Purchase',
  REDEMPTION: 'Redemption',
  ADMIN_ADJUSTMENT: 'Adjustment',
  TIER_BONUS: 'Tier Bonus',
  BIRTHDAY: 'Birthday',
  REVIEW: 'Review',
  REFERRAL_GIVE: 'Referral',
  REFERRAL_RECEIVE: 'Referral',
  EXPIRATION: 'Expiration',
  ACCOUNT_CREATION: 'Sign-up',
  FIRST_PURCHASE: 'First Order',
  SOCIAL_FOLLOW: 'Social',
  SOCIAL_SHARE: 'Social',
  UGC_UPLOAD: 'UGC',
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}

export function MemberLedger({ entries, maxHeight = '320px' }: MemberLedgerProps) {
  const [filter, setFilter] = useState<FilterValue>('all')

  const visible = entries.slice(0, 50)
  const filtered = filter === 'all' ? visible : visible.filter((e) => e.type === filter)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="flex items-center gap-2 text-xs text-white/50">
          Filter
          <select
            aria-label="filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterValue)}
            className="bg-white/[0.04] border border-white/8 rounded px-2 py-1 text-xs text-white/80 focus:outline-none focus:border-white/20"
          >
            {FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs text-white/40">{filtered.length} entries</span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-white/40 py-4 text-center">
          {entries.length === 0 ? 'No points history.' : 'No entries match this filter.'}
        </p>
      ) : (
        <ul
          className="divide-y divide-white/[0.06] border border-white/8 rounded-md overflow-y-auto"
          style={{ maxHeight }}
        >
          {filtered.map((e) => {
            const pillClass =
              TYPE_PILL_COLORS[e.type] ?? 'bg-white/[0.06] text-white/50'
            const label = TYPE_LABELS[e.type] ?? e.type.toLowerCase().replace(/_/g, ' ')
            const isPositive = e.points >= 0
            return (
              <li
                key={e.id}
                className="flex items-center gap-3 px-3 py-2 text-xs hover:bg-white/[0.02] transition-colors"
              >
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${pillClass}`}
                >
                  {label}
                </span>
                <span className="flex-1 truncate text-white/70">{e.description}</span>
                <span
                  className={`shrink-0 font-mono font-medium tabular-nums ${
                    isPositive ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {isPositive ? `+${e.points}` : `${e.points}`}
                </span>
                <span className="shrink-0 text-white/30">{formatRelativeTime(e.createdAt)}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
