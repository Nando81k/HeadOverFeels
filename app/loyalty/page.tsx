'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TierBadge } from '@/components/loyalty/TierBadge'
import { TierUpgradeModal, useTierUpgradeDetection } from '@/components/loyalty/TierUpgradeModal'
import { Sparkle, TrendUp, Gift, Crown, ArrowRight, Calendar, ArrowLeft, CircleNotch, Medal, Users } from '@phosphor-icons/react'

type TierSlug = 'bronze' | 'silver' | 'gold' | 'platinum'

interface TierData {
  id: string
  name: string
  slug: TierSlug
  minAnnualSpend: number
  pointMultiplier: number
  freeShipping: boolean
  earlyDropAccess: boolean
  perks: string[]
  sortOrder: number
}

interface LoyaltyData {
  currentTier: TierData
  nextTier: TierData | null
  points: number
  annualSpend: number
  recentActivity: Array<{
    id: string
    description: string
    points: number
    createdAt: string
    type: 'earned' | 'spent'
  }>
  availableRewardsCount: number
}

export default function LoyaltyDashboardPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [dashboardData, setDashboardData] = useState<LoyaltyData | null>(null)
  const [loading, setLoading] = useState(true)
  const { showModal, setShowModal, newTierData, previousTierData } = useTierUpgradeDetection()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/signin?redirect=/loyalty')
      return
    }

    if (user) {
      fetchLoyaltyData()
    }
  }, [user, authLoading, router])

  async function fetchLoyaltyData() {
    try {
      const response = await fetch('/api/loyalty/me')
      if (response.ok) {
        const data = await response.json()
        setDashboardData(data)
      }
    } catch (error) {
      console.error('Failed to fetch loyalty data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <CircleNotch size={32} weight="bold" className="animate-spin text-black" />
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-black/60">Failed to load loyalty data</p>
        </div>
      </div>
    )
  }

  const loyaltyData = dashboardData

  // Calculate progress percentage
  const progressPercentage = loyaltyData.nextTier 
    ? Math.min(100, (loyaltyData.annualSpend / loyaltyData.nextTier.minAnnualSpend) * 100)
    : 100

  return (
    <div className="min-h-screen bg-white pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 text-black/60 hover:text-black transition-colors mb-6 group"
        >
          <ArrowLeft size={20} weight="bold" className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Profile</span>
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-black flex items-center justify-center">
              <Crown size={24} weight="fill" className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-black">Loyalty Program</h1>
              <p className="text-black/60">Welcome back! Here&apos;s your loyalty overview.</p>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Points */}
          <div className="bg-white border border-black/10 p-6">
            <div className="flex items-center gap-2 mb-2">
              <Sparkle size={20} weight="fill" className="text-black" />
              <p className="text-sm text-black/60 uppercase tracking-wide">Care Points</p>
            </div>
            <p className="text-4xl font-black text-black mb-4">
              {loyaltyData.points.toLocaleString()}
            </p>
            <Link
              href="/loyalty/rewards"
              className="block w-full py-2 bg-black text-white text-center font-semibold hover:bg-black/90 transition-colors"
            >
              Browse Rewards
            </Link>
          </div>

          {/* Current Tier */}
          <div className="bg-white border border-black/10 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Medal size={20} weight="fill" className="text-black" />
                <p className="text-sm text-black/60 uppercase tracking-wide">Your Tier</p>
              </div>
              <Link
                href="/loyalty/tiers"
                className="text-xs text-black/60 hover:text-black font-medium"
              >
                View All
              </Link>
            </div>
            <TierBadge 
              tier={loyaltyData.currentTier?.slug || 'bronze'} 
              size="lg" 
              className="mb-2" 
            />
            <p className="text-2xl font-bold text-black">
              {loyaltyData.currentTier?.pointMultiplier || 1}x Points
            </p>
            <p className="text-sm text-black/60">On all purchases</p>
          </div>

          {/* Annual Spend */}
          <div className="bg-white border border-black/10 p-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendUp size={20} weight="bold" className="text-black" />
              <p className="text-sm text-black/60 uppercase tracking-wide">Annual Spend</p>
            </div>
            <p className="text-4xl font-black text-black">
              ${loyaltyData.annualSpend.toLocaleString()}
            </p>
            {loyaltyData.nextTier && (
              <p className="text-sm text-black/60 mt-2">
                ${(loyaltyData.nextTier.minAnnualSpend - loyaltyData.annualSpend).toLocaleString()} to {loyaltyData.nextTier.name}
              </p>
            )}
          </div>
        </div>

        {/* Progress to Next Tier */}
        {loyaltyData.nextTier && (
          <div className="bg-white border border-black/10 p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-black mb-1">Progress to Next Tier</h2>
                <p className="text-black/60">
                  You&apos;re on your way to <span className="font-semibold">{loyaltyData.nextTier.name}</span>!
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-black">{Math.round(progressPercentage)}%</p>
                <p className="text-xs text-black/60">Complete</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="h-3 bg-black/10 overflow-hidden">
                <div
                  className="h-full bg-black transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-sm text-black/60">
                <span>$0</span>
                <span>${loyaltyData.nextTier?.minAnnualSpend?.toLocaleString() ?? '0'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-black/5">
                <p className="text-2xl font-bold text-black">
                  {loyaltyData.nextTier?.pointMultiplier ?? 1}x
                </p>
                <p className="text-xs text-black/60 mt-1">Points Multiplier</p>
              </div>
              {loyaltyData.nextTier?.freeShipping && (
                <div className="text-center p-4 bg-black/5">
                  <p className="text-2xl font-bold text-black">✓</p>
                  <p className="text-xs text-black/60 mt-1">Free Shipping</p>
                </div>
              )}
              {loyaltyData.nextTier?.earlyDropAccess && (
                <div className="text-center p-4 bg-black/5">
                  <p className="text-2xl font-bold text-black">✓</p>
                  <p className="text-xs text-black/60 mt-1">Early Drop Access</p>
                </div>
              )}
              {(loyaltyData.nextTier?.perks?.length ?? 0) > 0 && (
                <div className="text-center p-4 bg-black/5">
                  <p className="text-2xl font-bold text-black">
                    +{loyaltyData.nextTier?.perks?.length ?? 0}
                  </p>
                  <p className="text-xs text-black/60 mt-1">Special Perks</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Link
            href="/loyalty/rewards"
            className="bg-white border border-black/10 p-6 hover:border-black/30 transition-all text-left group"
          >
            <Gift size={32} weight="bold" className="text-black mb-4" />
            <h3 className="text-lg font-bold text-black mb-1">Redeem Rewards</h3>
            <p className="text-black/60 text-sm mb-3">{loyaltyData.availableRewardsCount} rewards available</p>
            <div className="flex items-center text-black font-semibold group-hover:translate-x-1 transition-transform text-sm">
              Browse Catalog <ArrowRight size={14} weight="bold" className="ml-1" />
            </div>
          </Link>

          <Link
            href="/loyalty/history"
            className="bg-white border border-black/10 p-6 hover:border-black/30 transition-all text-left group"
          >
            <Calendar size={32} weight="bold" className="text-black mb-4" />
            <h3 className="text-lg font-bold text-black mb-1">Redemption History</h3>
            <p className="text-black/60 text-sm mb-3">View past redemptions</p>
            <div className="flex items-center text-black font-semibold group-hover:translate-x-1 transition-transform text-sm">
              View History <ArrowRight size={14} weight="bold" className="ml-1" />
            </div>
          </Link>

          <Link
            href="/loyalty/points"
            className="bg-white border border-black/10 p-6 hover:border-black/30 transition-all text-left group"
          >
            <TrendUp size={32} weight="bold" className="text-black mb-4" />
            <h3 className="text-lg font-bold text-black mb-1">Points History</h3>
            <p className="text-black/60 text-sm mb-3">Track your activity</p>
            <div className="flex items-center text-black font-semibold group-hover:translate-x-1 transition-transform text-sm">
              View Points <ArrowRight size={14} weight="bold" className="ml-1" />
            </div>
          </Link>

          <Link
            href="/loyalty/referrals"
            className="bg-white border border-black/10 p-6 hover:border-black/30 transition-all text-left group"
          >
            <Users size={32} weight="bold" className="text-black mb-4" />
            <h3 className="text-lg font-bold text-black mb-1">Refer Friends</h3>
            <p className="text-black/60 text-sm mb-3">Earn bonus points</p>
            <div className="flex items-center text-black font-semibold group-hover:translate-x-1 transition-transform text-sm">
              Share Code <ArrowRight size={14} weight="bold" className="ml-1" />
            </div>
          </Link>
        </div>

        {/* Recent Activity */}
        {loyaltyData.recentActivity.length > 0 && (
          <div className="bg-white border border-black/10 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-black">Recent Activity</h2>
              <Link
                href="/loyalty/points"
                className="text-sm text-black/60 hover:text-black font-medium"
              >
                View All →
              </Link>
            </div>
            <div className="space-y-4">
              {loyaltyData.recentActivity.slice(0, 5).map((activity) => (
                <div key={activity.id} className="flex items-center justify-between py-3 border-b border-black/10 last:border-0">
                  <div className="flex items-center gap-3">
                    <div
                      className={`
                        w-10 h-10 flex items-center justify-center
                        ${activity.type === 'earned' ? 'bg-green-100' : 'bg-black/5'}
                      `}
                    >
                      {activity.type === 'earned' ? (
                        <TrendUp size={20} weight="bold" className="text-green-600" />
                      ) : (
                        <Gift size={20} weight="bold" className="text-black" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-black">{activity.description}</p>
                      <p className="text-xs text-black/60">
                        {new Date(activity.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <p
                    className={`
                      text-lg font-bold
                      ${activity.type === 'earned' ? 'text-green-600' : 'text-black'}
                    `}
                  >
                    {activity.type === 'earned' ? '+' : '-'}
                    {activity.points.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tier Upgrade Modal */}
      {newTierData && (
        <TierUpgradeModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          newTier={newTierData}
          previousTier={previousTierData}
        />
      )}
    </div>
  )
}
