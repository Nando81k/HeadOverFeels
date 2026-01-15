'use client'

import { useEffect, useState, useCallback } from 'react'
import { Medal, Sparkle, ArrowUp, Fire } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

interface PointsPreviewProps {
  orderTotal: number
  isSignedIn: boolean
}

interface UserLoyaltyData {
  currentPoints: number
  tierName: string
  tierSlug: string
  pointMultiplier: number
  activeEvent: {
    name: string
    multiplier: number
  } | null
  nextTier: {
    name: string
    pointsNeeded: number
  } | null
}

export function PointsPreview({ orderTotal, isSignedIn }: PointsPreviewProps) {
  const [loyaltyData, setLoyaltyData] = useState<UserLoyaltyData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchLoyaltyData = useCallback(async () => {
    if (!isSignedIn) return
    
    setLoading(true)
    try {
      const res = await fetch('/api/loyalty/me')
      if (res.ok) {
        const data = await res.json()
        setLoyaltyData({
          currentPoints: data.points || 0,
          tierName: data.tierName || 'Friend',
          tierSlug: data.tierSlug || 'friend',
          pointMultiplier: data.pointMultiplier || 1,
          activeEvent: data.activeEvent || null,
          nextTier: data.nextTier || null,
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

  // Calculate points to be earned
  const basePoints = Math.floor(orderTotal)
  const tierMultiplier = loyaltyData?.pointMultiplier || 1
  const eventMultiplier = loyaltyData?.activeEvent?.multiplier || 1
  const totalMultiplier = tierMultiplier * eventMultiplier
  const totalPoints = Math.floor(basePoints * totalMultiplier)
  const bonusPoints = totalPoints - basePoints

  // Check if they'd reach next tier
  const wouldReachNextTier = loyaltyData?.nextTier 
    && (loyaltyData.currentPoints + totalPoints >= (loyaltyData.nextTier.pointsNeeded + loyaltyData.currentPoints))

  if (!isSignedIn) {
    return (
      <div className="bg-linear-to-r from-amber-50 to-orange-50 rounded-lg p-4 border border-amber-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
            <Medal size={20} weight="fill" className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Earn Care Points on this order!</p>
            <p className="text-xs text-gray-600 mt-1">
              <Link href="/signin" className="text-amber-600 font-medium hover:underline">Sign in</Link>
              {' or '}
              <Link href="/signin?mode=signup" className="text-amber-600 font-medium hover:underline">create an account</Link>
              {' to earn '}
              <span className="font-semibold">{basePoints} Care Points</span>
              {' on this purchase!'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-200 rounded-full" />
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-48" />
          </div>
        </div>
      </div>
    )
  }

  const hasBonus = bonusPoints > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg p-4 border ${
        hasBonus
          ? 'bg-linear-to-r from-amber-50 via-orange-50 to-red-50 border-amber-200'
          : 'bg-linear-to-r from-amber-50 to-orange-50 border-amber-100'
      }`}
    >
      {/* Active Multiplier Event Banner */}
      <AnimatePresence>
        {loyaltyData?.activeEvent && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3"
          >
            <div className="bg-linear-to-r from-red-500 to-orange-500 text-white rounded-lg px-3 py-2 flex items-center gap-2">
              <Fire size={18} weight="fill" className="animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wide">
                {loyaltyData.activeEvent.name} — {loyaltyData.activeEvent.multiplier}x Points!
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
          hasBonus ? 'bg-linear-to-br from-amber-400 to-orange-500' : 'bg-amber-100'
        }`}>
          <Medal size={20} weight="fill" className={hasBonus ? 'text-white' : 'text-amber-600'} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900">
              You&apos;ll earn{' '}
              <span className={`font-bold ${hasBonus ? 'text-orange-600' : 'text-amber-600'}`}>
                {totalPoints.toLocaleString()} Care Points
              </span>
            </p>
            {hasBonus && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full"
              >
                <ArrowUp size={10} weight="bold" />
                +{bonusPoints}
              </motion.span>
            )}
          </div>

          {/* Breakdown */}
          <div className="mt-1.5 space-y-0.5 text-xs text-gray-600">
            <div className="flex items-center justify-between">
              <span>Base points (1 per $1)</span>
              <span className="font-medium">{basePoints}</span>
            </div>
            
            {tierMultiplier > 1 && (
              <div className="flex items-center justify-between text-purple-600">
                <span className="flex items-center gap-1">
                  <Sparkle size={12} weight="fill" />
                  {loyaltyData?.tierName} tier bonus ({tierMultiplier}x)
                </span>
                <span className="font-medium">+{Math.floor(basePoints * (tierMultiplier - 1))}</span>
              </div>
            )}
            
            {loyaltyData?.activeEvent && eventMultiplier > 1 && (
              <div className="flex items-center justify-between text-orange-600">
                <span className="flex items-center gap-1">
                  <Fire size={12} weight="fill" />
                  {loyaltyData.activeEvent.name} ({eventMultiplier}x)
                </span>
                <span className="font-medium">
                  +{Math.floor(basePoints * tierMultiplier * (eventMultiplier - 1))}
                </span>
              </div>
            )}
          </div>

          {/* Next Tier Progress */}
          {loyaltyData?.nextTier && (
            <div className="mt-3 pt-2 border-t border-amber-200/50">
              {wouldReachNextTier ? (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs font-medium text-green-600 flex items-center gap-1"
                >
                  <Sparkle size={14} weight="fill" />
                  This purchase unlocks {loyaltyData.nextTier.name} tier! 🎉
                </motion.p>
              ) : (
                <p className="text-xs text-gray-500">
                  {Math.max(0, loyaltyData.nextTier.pointsNeeded - (loyaltyData.currentPoints + totalPoints)).toLocaleString()} more points to reach {loyaltyData.nextTier.name}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Current Balance Footer */}
      <div className="mt-3 pt-2 border-t border-amber-200/30 flex items-center justify-between text-xs">
        <span className="text-gray-500">Current balance: {loyaltyData?.currentPoints.toLocaleString() || 0} pts</span>
        <Link href="/loyalty" className="text-amber-600 font-medium hover:underline">
          View rewards →
        </Link>
      </div>
    </motion.div>
  )
}
