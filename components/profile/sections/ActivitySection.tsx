'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ClockCounterClockwise, ShoppingBag, Sparkle, Gift, ArrowRight } from '@phosphor-icons/react'
import {
  ActivityRow,
  buildFeed,
  type OrderItem,
  type PointsTransactionItem,
} from './activity-shared'

const PAGE_SIZE = 25

interface ActivitySectionProps {
  orders: OrderItem[]
  pointsHistory: PointsTransactionItem[]
  ordersLoading: boolean
  pointsLoading: boolean
}

type FilterKey = 'all' | 'orders' | 'earned' | 'redeemed'

export function ActivitySection({
  orders,
  pointsHistory,
  ordersLoading,
  pointsLoading,
}: ActivitySectionProps) {
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [filter, setFilter] = useState<FilterKey>('all')
  const isLoading = ordersLoading || pointsLoading

  const fullFeed = buildFeed(orders, pointsHistory)
  const filteredFeed = fullFeed.filter((item) => {
    if (filter === 'all') return true
    if (filter === 'orders') return item.kind === 'order'
    if (filter === 'earned') return item.kind === 'points' && item.data.points > 0
    if (filter === 'redeemed') return item.kind === 'points' && item.data.points < 0
    return true
  })

  const visibleItems = filteredFeed.slice(0, visible)
  const hasMore = filteredFeed.length > visibleItems.length

  const filterChips: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: fullFeed.length },
    { key: 'orders', label: 'Orders', count: orders.length },
    {
      key: 'earned',
      label: 'Points Earned',
      count: pointsHistory.filter((p) => p.points > 0).length,
    },
    {
      key: 'redeemed',
      label: 'Redemptions',
      count: pointsHistory.filter((p) => p.points < 0).length,
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[72px] rounded-2xl bg-black/3 animate-pulse" />
        ))}
      </div>
    )
  }

  if (fullFeed.length === 0) {
    return (
      <div className="rounded-2xl border border-black/10 p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mx-auto mb-4">
          <ClockCounterClockwise size={26} className="text-black/25" />
        </div>
        <p className="text-base font-black text-black">No activity yet</p>
        <p className="text-sm text-black/50 mt-1.5 max-w-xs mx-auto">
          Your orders and points transactions will appear here once you start shopping.
        </p>
        <Link
          href="/products"
          className="mt-6 inline-flex items-center gap-2 px-5 h-10 rounded-full bg-black text-white text-xs font-bold uppercase tracking-wider hover:bg-black/85 transition-colors"
        >
          Start Shopping
          <ArrowRight size={13} weight="bold" />
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Filter chips */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {filterChips.map(({ key, label, count }) => {
          const isActive = filter === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setFilter(key)
                setVisible(PAGE_SIZE)
              }}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 h-8 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                isActive
                  ? 'bg-black text-white shadow-sm'
                  : 'bg-white text-black/55 border border-black/10 hover:border-black/30 hover:text-black'
              }`}
            >
              {key === 'orders' && <ShoppingBag size={11} weight="bold" />}
              {key === 'earned' && <Sparkle size={11} weight="fill" />}
              {key === 'redeemed' && <Gift size={11} weight="bold" />}
              <span>{label}</span>
              <span className={`text-[10px] tabular-nums ${isActive ? 'text-white/65' : 'text-black/40'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Feed */}
      {filteredFeed.length === 0 ? (
        <div className="rounded-2xl border border-black/10 p-8 text-center">
          <p className="text-sm text-black/55">Nothing matches that filter.</p>
        </div>
      ) : (
        <div className="space-y-2.5 md:space-y-3">
          {visibleItems.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="inline-flex items-center gap-1.5 px-5 h-10 rounded-full border border-black/15 text-xs font-bold uppercase tracking-wider text-black/70 hover:bg-black/3 hover:text-black hover:border-black/30 transition-colors"
          >
            Load more
            <ArrowRight size={11} weight="bold" />
          </button>
        </div>
      )}
    </div>
  )
}
