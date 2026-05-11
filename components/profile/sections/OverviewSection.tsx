'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { CalendarBlank, Package, Sparkle, Envelope, ArrowRight, Medal, ClockCounterClockwise } from '@phosphor-icons/react'
import {
  ActivityRow,
  buildFeed,
  type OrderItem,
  type PointsTransactionItem,
} from './activity-shared'
import type { ProfileSection } from '@/components/profile/ProfileSectionNav'

interface TierLite {
  name: string
  slug: string
  pointMultiplier: number
  minAnnualPoints: number
}

interface User {
  createdAt: Date | string
  newsletter: boolean
  totalOrders: number
  lifetimePoints: number
  currentPoints: number
}

interface OverviewSectionProps {
  user: User
  orders: OrderItem[]
  pointsHistory: PointsTransactionItem[]
  ordersLoading: boolean
  pointsLoading: boolean
  currentTier: TierLite | null
  nextTier: TierLite | null
  annualPointsEarned: number
  onSectionChange: (section: ProfileSection) => void
  tierPrimaryColor?: string
}

function formatMultiplier(multiplier: number): string {
  if (!Number.isFinite(multiplier)) return '1'
  if (Number.isInteger(multiplier)) return String(multiplier)
  return multiplier.toFixed(2).replace(/\.?0+$/, '')
}

export function OverviewSection({
  user,
  orders,
  pointsHistory,
  ordersLoading,
  pointsLoading,
  currentTier,
  nextTier,
  annualPointsEarned,
  onSectionChange,
  tierPrimaryColor,
}: OverviewSectionProps) {
  const feed = buildFeed(orders, pointsHistory)
  const recentItems = feed.slice(0, 3)
  const isLoadingActivity = ordersLoading || pointsLoading
  const progressPct = nextTier
    ? Math.min(100, Math.max(0, (annualPointsEarned / Math.max(1, nextTier.minAnnualPoints)) * 100))
    : 100

  const stats = [
    {
      icon: CalendarBlank,
      label: 'Member Since',
      value: new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    },
    {
      icon: Package,
      label: 'Total Orders',
      value: (user.totalOrders || orders.length).toString(),
    },
    {
      icon: Sparkle,
      label: 'Lifetime Pts',
      value: (user.lifetimePoints ?? 0).toLocaleString(),
    },
    {
      icon: Envelope,
      label: 'Newsletter',
      value: user.newsletter ? 'Active' : 'Off',
    },
  ]

  return (
    <div className="space-y-8 md:space-y-10">
      {/* Stats grid */}
      <section>
        <h2 className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] text-black/40 mb-3 md:mb-4">
          At a glance
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {stats.map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="rounded-2xl bg-black/3 border border-black/8 p-4 md:p-5"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} weight="bold" className="text-black/35" />
                <p className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-black/45">
                  {label}
                </p>
              </div>
              <p className="text-base md:text-xl font-black text-black tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Loyalty summary card — shares layoutId with the Loyalty section's tier hero */}
      {currentTier && (
        <section>
          <h2 className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] text-black/40 mb-3 md:mb-4">
            Loyalty
          </h2>
          <motion.button
            type="button"
            layoutId="loyalty-tier-hero"
            onClick={() => onSectionChange('loyalty')}
            className="block w-full text-left rounded-2xl bg-black text-white overflow-hidden relative cursor-pointer group"
            whileHover={{ scale: 1.005 }}
            whileTap={{ scale: 0.995 }}
            transition={{ layout: { duration: 0.4, ease: [0.32, 0.72, 0, 1] } }}
          >
            <motion.div layoutId="loyalty-tier-hero-glow" className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
            <div className="relative p-5 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                    <Medal size={20} weight="fill" className="text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60 mb-0.5">
                      Current Tier
                    </p>
                    <p className="text-lg md:text-xl font-black leading-none">
                      {currentTier.name} · {formatMultiplier(currentTier.pointMultiplier)}× pts
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 md:flex-col md:items-end md:text-right">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Available</p>
                  <p className="text-2xl md:text-3xl font-black leading-none tabular-nums">
                    {user.currentPoints.toLocaleString()}
                    <span className="text-xs text-white/55 ml-1 font-medium">pts</span>
                  </p>
                </div>
              </div>

              {nextTier && (
                <div className="mb-5">
                  <div className="flex items-center justify-between text-[10px] md:text-xs text-white/65 font-semibold mb-2">
                    <span>
                      <span className="font-black text-white">
                        {Math.max(0, nextTier.minAnnualPoints - annualPointsEarned).toLocaleString()}
                      </span>{' '}
                      pts to <span className="font-black text-white">{nextTier.name}</span>
                    </span>
                    <span className="text-white/55 tabular-nums">{Math.round(progressPct)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${progressPct}%`,
                        backgroundColor: tierPrimaryColor ?? '#ffffff',
                      }}
                    />
                  </div>
                </div>
              )}

              <span
                className="inline-flex items-center gap-2 px-5 h-10 rounded-full bg-white text-black text-xs font-bold uppercase tracking-wider group-hover:bg-white/90 transition-colors"
              >
                Redeem Rewards
                <ArrowRight size={13} weight="bold" />
              </span>
            </div>
          </motion.button>
        </section>
      )}

      {/* Recent activity preview */}
      <section>
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h2 className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] text-black/40">
            Recent activity
          </h2>
          {feed.length > 0 && (
            <button
              type="button"
              onClick={() => onSectionChange('activity')}
              className="text-xs font-bold uppercase tracking-wider text-black/55 hover:text-black transition-colors flex items-center gap-1"
            >
              View all
              <ArrowRight size={12} weight="bold" />
            </button>
          )}
        </div>

        {isLoadingActivity ? (
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[68px] rounded-2xl bg-black/3 animate-pulse" />
            ))}
          </div>
        ) : recentItems.length === 0 ? (
          <div className="rounded-2xl border border-black/10 p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-black/5 flex items-center justify-center mx-auto mb-3">
              <ClockCounterClockwise size={20} className="text-black/25" />
            </div>
            <p className="text-sm font-bold text-black">No activity yet</p>
            <p className="text-xs text-black/50 mt-1 mb-4">Your orders and points will appear here.</p>
            <Link
              href="/products"
              className="inline-flex items-center gap-1.5 px-4 h-9 rounded-full bg-black text-white text-xs font-bold uppercase tracking-wider hover:bg-black/85 transition-colors"
            >
              Start Shopping
              <ArrowRight size={12} weight="bold" />
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {recentItems.map((item) => (
              <ActivityRow key={item.id} item={item} compact />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
