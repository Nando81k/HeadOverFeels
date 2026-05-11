'use client'

import { useEffect, useState, useCallback } from 'react'
import { Medal, Sparkle, ArrowUpRight } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { calculateCheckoutLoyaltyPreview, roundMoney, type CheckoutTierInfo } from '@/lib/checkout/insights'
import { useTierAccent } from '@/lib/loyalty/use-tier-accent'

interface PointsPreviewProps {
  pointsEligibleAmount?: number
  orderTotal?: number
  isSignedIn: boolean
  activePromotionText?: string | null
  totalSavings?: number
}

interface UserLoyaltyData {
  currentPoints: number
  annualPointsEarned: number
  tierName: string
  tierSlug: string
  pointMultiplier: number
  tiers: CheckoutTierInfo[]
  activeEvent: {
    name: string
    multiplier: number
  } | null
}

export function PointsPreview({
  pointsEligibleAmount,
  orderTotal,
  isSignedIn,
  activePromotionText,
  totalSavings = 0,
}: PointsPreviewProps) {
  const tierAccent = useTierAccent()
  const [loyaltyData, setLoyaltyData] = useState<UserLoyaltyData | null>(null)
  const [loading, setLoading] = useState(false)

  const previewAmount = Math.max(0, pointsEligibleAmount ?? orderTotal ?? 0)

  const fetchLoyaltyData = useCallback(async () => {
    if (!isSignedIn) return

    setLoading(true)
    try {
      const res = await fetch('/api/loyalty/me')
      if (res.ok) {
        const data = await res.json()
        setLoyaltyData({
          currentPoints: data.points || 0,
          annualPointsEarned: data.annualPointsEarned || 0,
          tierName: data.tierName || 'Newcomer',
          tierSlug: data.tierSlug || 'newcomer',
          pointMultiplier: data.pointMultiplier || 1,
          tiers: Array.isArray(data.tiers) ? data.tiers : [],
          activeEvent: data.activeEvent || null,
        })
      }
    } catch (error) {
      console.error('Failed to fetch loyalty data:', error)
    } finally {
      setLoading(false)
    }
  }, [isSignedIn])

  useEffect(() => {
    fetchLoyaltyData()
  }, [fetchLoyaltyData])

  const loyaltyPreview = calculateCheckoutLoyaltyPreview({
    orderTotal: previewAmount,
    currentPoints: loyaltyData?.currentPoints ?? 0,
    annualPointsEarned: loyaltyData?.annualPointsEarned ?? 0,
    pointMultiplier: loyaltyData?.pointMultiplier ?? 1,
    activeEventMultiplier: loyaltyData?.activeEvent?.multiplier ?? 1,
    currentTierSlug: loyaltyData?.tierSlug,
    tiers: loyaltyData?.tiers,
  })

  if (!isSignedIn) {
    return (
      <div className="rounded-lg border border-black/10 bg-black/[0.02] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-white">
            <Medal size={18} weight="fill" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-black">Earn Care Points on this order</p>
            <p className="mt-1 text-xs text-black/60">
              <Link href="/signin" className="font-semibold text-black underline underline-offset-2">
                Sign in
              </Link>
              {' or '}
              <Link href="/signin?mode=signup" className="font-semibold text-black underline underline-offset-2">
                create an account
              </Link>
              {' to earn '}
              <span className="font-semibold text-black">{loyaltyPreview.basePoints.toLocaleString()} points</span>.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-black/10 bg-black/[0.02] p-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-black/10" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 rounded bg-black/10" />
            <div className="h-3 w-56 rounded bg-black/10" />
          </div>
        </div>
      </div>
    )
  }

  const hasMultiplierBonus = loyaltyPreview.eventBonusPoints > 0 || loyaltyPreview.tierBonusPoints > 0

  // Tier-progress bar — shows how this purchase nudges the customer toward
  // the next tier without spending a full row on the points number.
  const nextTier = loyaltyPreview.nextTierAfterPurchase
  const pointsToNext = loyaltyPreview.pointsToNextTierAfterPurchase
  const progressPct = nextTier
    ? Math.max(
        0,
        Math.min(
          100,
          ((nextTier.minAnnualPoints - pointsToNext) / nextTier.minAnnualPoints) * 100
        )
      )
    : 100

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ borderLeftColor: tierAccent.accent }}
      className="border-l-2 border-y border-r border-black/10 bg-black/2 px-3 py-2.5 space-y-2"
    >
      {/* Line 1 — points earned + bonus chip + savings/promo inline. */}
      <div className="flex items-center gap-2 text-[12px] leading-tight">
        <Medal
          size={14}
          weight="fill"
          className="shrink-0"
          style={{ color: tierAccent.accent }}
        />
        <p className="min-w-0 flex-1 truncate text-black">
          <span className="font-black" style={{ color: tierAccent.accentDark }}>
            +{loyaltyPreview.totalPoints.toLocaleString()}
          </span>
          <span className="text-black/55"> Care Points</span>
        </p>
        {hasMultiplierBonus ? (
          <span
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-white shrink-0"
            style={{ backgroundColor: tierAccent.accent }}
          >
            <ArrowUpRight size={9} weight="bold" />
            +{(loyaltyPreview.eventBonusPoints + loyaltyPreview.tierBonusPoints).toLocaleString()}
          </span>
        ) : null}
      </div>

      {/* Line 2 — tier progress bar with inline label. Replaces the old
          three text rows ("Tier after", "X points to reach", "Balance"). */}
      {nextTier ? (
        <div>
          <div className="flex items-baseline justify-between gap-2 text-[10px] uppercase tracking-[0.12em]">
            <span className="text-black/60">
              {loyaltyPreview.willUpgradeTier ? (
                <span className="font-black" style={{ color: tierAccent.accentDark }}>
                  ↑ {loyaltyPreview.projectedTier.name}
                </span>
              ) : (
                <>
                  <span className="text-black/40">Tier ·</span>{' '}
                  <span className="font-black text-black">{loyaltyPreview.projectedTier.name}</span>
                </>
              )}
            </span>
            <span className="text-black/45 tabular-nums">
              {pointsToNext.toLocaleString()} → {nextTier.name}
            </span>
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden bg-black/8">
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${progressPct}%`, backgroundColor: tierAccent.accent }}
            />
          </div>
        </div>
      ) : (
        <p className="text-[10px] uppercase tracking-[0.12em] text-black/55">
          <span className="font-black text-black">{loyaltyPreview.projectedTier.name}</span>
          {' · max tier reached'}
        </p>
      )}

      {/* Line 3 — balance + view rewards. Single row. */}
      <div className="flex items-center justify-between gap-2 text-[10px]">
        <span className="text-black/45 tabular-nums">
          Bal · {loyaltyPreview.projectedCurrentPoints.toLocaleString()} pts
        </span>
        <div className="flex items-center gap-2">
          {(activePromotionText || totalSavings > 0) ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-black/55">
              <Sparkle size={9} weight="fill" />
              {totalSavings > 0 ? `Save $${roundMoney(totalSavings).toFixed(2)}` : activePromotionText}
            </span>
          ) : null}
          <Link
            href="/profile#rewards"
            className="text-[10px] font-black uppercase tracking-[0.12em] underline underline-offset-2"
            style={{ color: tierAccent.accentDark }}
          >
            Rewards
          </Link>
        </div>
      </div>
    </motion.div>
  )
}
