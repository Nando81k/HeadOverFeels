'use client'

import { useEffect, useState, useCallback } from 'react'
import { Medal, Sparkle, ArrowUpRight, Fire } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { calculateCheckoutLoyaltyPreview, roundMoney, type CheckoutTierInfo } from '@/lib/checkout/insights'

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-black/10 bg-black/[0.02] p-4"
    >
      {(activePromotionText || totalSavings > 0) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {activePromotionText ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-black/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-black/80">
              <Sparkle size={10} weight="fill" />
              {activePromotionText}
            </span>
          ) : null}
          {totalSavings > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              Saving ${roundMoney(totalSavings).toFixed(2)}
            </span>
          ) : null}
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-white">
          <Medal size={18} weight="fill" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-black">
              You&apos;ll earn{' '}
              <span className="font-black">{loyaltyPreview.totalPoints.toLocaleString()} Care Points</span>
            </p>
            {hasMultiplierBonus ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-black px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                <ArrowUpRight size={10} weight="bold" />
                +{(loyaltyPreview.eventBonusPoints + loyaltyPreview.tierBonusPoints).toLocaleString()}
              </span>
            ) : null}
          </div>

          <div className="mt-1.5 space-y-1 text-xs text-black/60">
            <div className="flex items-center justify-between">
              <span>Base points (1 per $1 on order total)</span>
              <span className="font-semibold text-black">{loyaltyPreview.basePoints.toLocaleString()}</span>
            </div>

            {loyaltyPreview.eventBonusPoints > 0 && loyaltyData?.activeEvent ? (
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1">
                  <Fire size={12} weight="fill" />
                  {loyaltyData.activeEvent.name} bonus
                </span>
                <span className="font-semibold text-black">+{loyaltyPreview.eventBonusPoints.toLocaleString()}</span>
              </div>
            ) : null}

            {loyaltyPreview.tierBonusPoints > 0 ? (
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1">
                  <Sparkle size={12} weight="fill" />
                  {loyaltyPreview.currentTier.name} tier bonus
                </span>
                <span className="font-semibold text-black">+{loyaltyPreview.tierBonusPoints.toLocaleString()}</span>
              </div>
            ) : null}
          </div>

          <div className="mt-3 border-t border-black/10 pt-2.5">
            {loyaltyPreview.willUpgradeTier ? (
              <p className="text-xs font-semibold text-black">
                Tier after purchase: {loyaltyPreview.projectedTier.name}
                <span className="ml-1 text-black/60">
                  (up from {loyaltyPreview.currentTier.name})
                </span>
              </p>
            ) : (
              <p className="text-xs text-black/70">
                Tier after purchase: <span className="font-semibold text-black">{loyaltyPreview.projectedTier.name}</span>
              </p>
            )}

            {loyaltyPreview.nextTierAfterPurchase ? (
              <p className="mt-1 text-xs text-black/50">
                {loyaltyPreview.pointsToNextTierAfterPurchase.toLocaleString()} points to reach{' '}
                {loyaltyPreview.nextTierAfterPurchase.name}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {loyaltyData?.activeEvent ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 border-t border-black/10 pt-2.5"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-black/70">
              Active event: {loyaltyData.activeEvent.name} ({loyaltyData.activeEvent.multiplier}x)
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="mt-3 border-t border-black/10 pt-2.5 flex items-center justify-between text-xs">
        <span className="text-black/50">
          Balance after order: {loyaltyPreview.projectedCurrentPoints.toLocaleString()} pts
        </span>
        <Link href="/loyalty" className="font-semibold text-black underline underline-offset-2">
          View rewards
        </Link>
      </div>
    </motion.div>
  )
}
