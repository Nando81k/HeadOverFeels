'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { calculateTierProgress, TIER_HIERARCHY } from '@/lib/loyalty/tier-progress'
import { Sparkle, Gift, Heart, Truck, Lightning, Users, Download, Package, ArrowLeft, CircleNotch, Lock, CheckCircle, Warning, TrendUp, Medal, X, Copy, Check, Confetti, Star } from '@phosphor-icons/react'
import Link from 'next/link'

interface Reward {
  id: string
  name: string
  slug: string
  description: string | null
  pointsCost: number
  rewardType: string
  value: number | null
  isActive: boolean
  minTierRequired: string | null
  image: string | null
  canAfford: boolean
  meetsTierRequirement: boolean
  isMaxedOut: boolean
  isAvailable: boolean
  _count: {
    redemptions: number
  }
}

interface RedemptionResult {
  success: boolean
  redemption?: {
    id: string
    pointsSpent: number
    status: string
    couponCode: string | null
    createdAt: string
  }
  reward?: {
    name: string
    type: string
    value: number | null
  }
  newPointsBalance?: number
  error?: string
}

const rewardTypeIcons = {
  DISCOUNT: Gift,
  FREE_SHIPPING: Truck,
  EARLY_ACCESS: Lightning,
  EXCLUSIVE_PRODUCT: Sparkle,
  CHARITY_DONATION: Heart,
  DIGITAL_CONTENT: Download,
  PHYSICAL_PERK: Package,
}

const rewardTypeLabels = {
  DISCOUNT: 'Discount',
  FREE_SHIPPING: 'Shipping',
  EARLY_ACCESS: 'Early Access',
  EXCLUSIVE_PRODUCT: 'Exclusive',
  CHARITY_DONATION: 'Charity',
  DIGITAL_CONTENT: 'Digital',
  PHYSICAL_PERK: 'Physical Perk',
}

// Colorful reward category styling
const rewardTypeColors = {
  DISCOUNT: {
    bg: 'bg-emerald-50',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700',
    gradient: 'from-emerald-500 to-teal-600',
    ring: 'ring-emerald-500',
    activeBg: 'bg-emerald-600',
    hoverBg: 'hover:bg-emerald-50',
  },
  FREE_SHIPPING: {
    bg: 'bg-sky-50',
    iconBg: 'bg-sky-100',
    iconColor: 'text-sky-600',
    border: 'border-sky-200',
    badge: 'bg-sky-100 text-sky-700',
    gradient: 'from-sky-500 to-blue-600',
    ring: 'ring-sky-500',
    activeBg: 'bg-sky-600',
    hoverBg: 'hover:bg-sky-50',
  },
  EARLY_ACCESS: {
    bg: 'bg-violet-50',
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
    border: 'border-violet-200',
    badge: 'bg-violet-100 text-violet-700',
    gradient: 'from-violet-500 to-purple-600',
    ring: 'ring-violet-500',
    activeBg: 'bg-violet-600',
    hoverBg: 'hover:bg-violet-50',
  },
  EXCLUSIVE_PRODUCT: {
    bg: 'bg-amber-50',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
    gradient: 'from-amber-500 to-orange-600',
    ring: 'ring-amber-500',
    activeBg: 'bg-amber-600',
    hoverBg: 'hover:bg-amber-50',
  },
  CHARITY_DONATION: {
    bg: 'bg-rose-50',
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-600',
    border: 'border-rose-200',
    badge: 'bg-rose-100 text-rose-700',
    gradient: 'from-rose-500 to-pink-600',
    ring: 'ring-rose-500',
    activeBg: 'bg-rose-600',
    hoverBg: 'hover:bg-rose-50',
  },
  DIGITAL_CONTENT: {
    bg: 'bg-indigo-50',
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
    border: 'border-indigo-200',
    badge: 'bg-indigo-100 text-indigo-700',
    gradient: 'from-indigo-500 to-blue-600',
    ring: 'ring-indigo-500',
    activeBg: 'bg-indigo-600',
    hoverBg: 'hover:bg-indigo-50',
  },
  PHYSICAL_PERK: {
    bg: 'bg-orange-50',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
    border: 'border-orange-200',
    badge: 'bg-orange-100 text-orange-700',
    gradient: 'from-orange-500 to-red-600',
    ring: 'ring-orange-500',
    activeBg: 'bg-orange-600',
    hoverBg: 'hover:bg-orange-50',
  },
}

// Default colors for "all" category
const defaultColors = {
  bg: 'bg-gray-50',
  iconBg: 'bg-gray-100',
  iconColor: 'text-gray-600',
  border: 'border-gray-200',
  badge: 'bg-gray-100 text-gray-700',
  gradient: 'from-gray-500 to-gray-600',
  ring: 'ring-gray-500',
  activeBg: 'bg-black',
  hoverBg: 'hover:bg-gray-50',
}

export default function RewardsPage() {
  const router = useRouter()
  const { user, loading: authLoading, refreshUser } = useAuth()
  const [rewards, setRewards] = useState<Reward[]>([])
  const [customerPoints, setCustomerPoints] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showTierModal, setShowTierModal] = useState(false)
  
  // Redemption state
  const [redeemingRewardId, setRedeemingRewardId] = useState<string | null>(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [redemptionResult, setRedemptionResult] = useState<RedemptionResult | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/signin?redirect=/loyalty/rewards')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    fetchRewards()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory])

  const fetchRewards = async () => {
    try {
      const url = selectedCategory === 'all' 
        ? '/api/loyalty/rewards'
        : `/api/loyalty/rewards?category=${selectedCategory}`
      
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setRewards(data.data || [])
        setCustomerPoints(data.customerPoints || 0)
      }
    } catch (error) {
      console.error('Failed to fetch rewards:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRedeem = async (rewardId: string) => {
    setRedeemingRewardId(rewardId)
    
    try {
      const response = await fetch('/api/loyalty/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardId }),
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        setRedemptionResult(data)
        setCustomerPoints(data.newPointsBalance || 0)
        setShowSuccessModal(true)
        // Refresh rewards to update canAfford status
        fetchRewards()
        // Refresh user data to update points in header
        refreshUser()
      } else {
        setErrorMessage(data.error || 'Failed to redeem reward')
        setShowErrorModal(true)
      }
    } catch (error) {
      console.error('Redemption error:', error)
      setErrorMessage('Something went wrong. Please try again.')
      setShowErrorModal(true)
    } finally {
      setRedeemingRewardId(null)
    }
  }

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <CircleNotch size={32} weight="bold" className="animate-spin text-[#1A1A1A]" />
      </div>
    )
  }

  const categories = [
    { value: 'all', label: 'All Rewards', icon: Sparkle },
    { value: 'DISCOUNT', label: 'Discounts', icon: Gift },
    { value: 'FREE_SHIPPING', label: 'Shipping', icon: Truck },
    { value: 'CHARITY_DONATION', label: 'Charity', icon: Heart },
    { value: 'EARLY_ACCESS', label: 'Early Access', icon: Lightning },
    { value: 'EXCLUSIVE_PRODUCT', label: 'Exclusive', icon: Sparkle },
    { value: 'DIGITAL_CONTENT', label: 'Digital', icon: Download },
    { value: 'PHYSICAL_PERK', label: 'Physical', icon: Package },
  ]

  // Helper to get category colors
  const getCategoryColors = (category: string) => {
    if (category === 'all') return defaultColors
    return rewardTypeColors[category as keyof typeof rewardTypeColors] || defaultColors
  }

  return (
    <div className="min-h-screen bg-white pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center">
              <Sparkle size={28} weight="fill" className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-black">
                Rewards Catalog
              </h1>
              <p className="text-black/60">
                Redeem your Care Points for exclusive rewards
              </p>
            </div>
          </div>

          {/* Points Balance Card - Matching Profile Page Style */}
          {user.loyaltyTier && (() => {
            const tierColors: Record<string, { gradient: string; iconBg: string; progressBg: string; progressFill: string; badge: string }> = {
              head: {
                gradient: 'from-blue-500 via-blue-600 to-indigo-700',
                iconBg: 'bg-blue-400/30',
                progressBg: 'bg-blue-400/30',
                progressFill: 'bg-blue-300',
                badge: 'bg-blue-400/30',
              },
              heart: {
                gradient: 'from-pink-500 via-rose-500 to-pink-600',
                iconBg: 'bg-pink-400/30',
                progressBg: 'bg-pink-400/30',
                progressFill: 'bg-pink-300',
                badge: 'bg-pink-400/30',
              },
              mind: {
                gradient: 'from-emerald-500 via-green-500 to-teal-600',
                iconBg: 'bg-emerald-400/30',
                progressBg: 'bg-emerald-400/30',
                progressFill: 'bg-emerald-300',
                badge: 'bg-emerald-400/30',
              },
              overdrive: {
                gradient: 'from-purple-500 via-violet-500 to-purple-700',
                iconBg: 'bg-purple-400/30',
                progressBg: 'bg-purple-400/30',
                progressFill: 'bg-purple-300',
                badge: 'bg-purple-400/30',
              },
            }
            const currentTierColors = tierColors[user.loyaltyTier.slug] || tierColors.head
            const tierProgress = calculateTierProgress(user.loyaltyTier.slug, user.annualPointsEarned ?? 0)
            
            return (
              <div className={`bg-linear-to-br ${currentTierColors.gradient} rounded-2xl p-6 text-white shadow-xl relative overflow-hidden`}>
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl" />
                
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Medal size={24} weight="bold" className="text-white/80" />
                      <div>
                        <span className="text-xs font-medium uppercase tracking-wider text-white/70">Loyalty Tier</span>
                        <h2 className="text-3xl font-bold leading-tight">{user.loyaltyTier.name}</h2>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowTierModal(true)}
                      className={`px-4 py-1.5 ${currentTierColors.badge} backdrop-blur-sm rounded-full text-sm font-semibold hover:bg-white/30 transition-colors`}
                    >
                      {user.loyaltyTier.pointMultiplier}x Points
                    </button>
                  </div>

                  {/* Stats Row */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`flex-1 ${currentTierColors.iconBg} backdrop-blur-sm rounded-xl p-4`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkle size={14} weight="fill" className="text-white/80" />
                        <span className="text-[10px] uppercase tracking-wider text-white/70">Available Points</span>
                      </div>
                      <p className="text-2xl font-bold">{customerPoints.toLocaleString()}</p>
                    </div>
                    <div className={`flex-1 ${currentTierColors.iconBg} backdrop-blur-sm rounded-xl p-4`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Gift size={14} weight="bold" className="text-white/80" />
                        <span className="text-[10px] uppercase tracking-wider text-white/70">Annual Earned</span>
                      </div>
                      <p className="text-2xl font-bold">{(user.annualPointsEarned ?? 0).toLocaleString()}</p>
                    </div>
                    <button
                      onClick={() => setShowTierModal(true)}
                      className="flex items-center justify-center gap-2 bg-white/20 backdrop-blur-sm text-white px-5 py-4 rounded-xl font-medium hover:bg-white/30 transition-colors text-sm whitespace-nowrap"
                    >
                      View Tiers
                      <TrendUp size={16} weight="bold" />
                    </button>
                  </div>

                  {/* Tier Progress */}
                  {(user.annualPointsEarned ?? 0) === 0 && customerPoints === 0 ? (
                    <div className={`${currentTierColors.iconBg} backdrop-blur-sm rounded-xl p-4`}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                          <Sparkle size={20} weight="fill" className="text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">Start earning points today!</p>
                          <p className="text-xs text-white/70">Make purchases to earn Care Points and unlock rewards.</p>
                        </div>
                        <Link
                          href="/products"
                          className="shrink-0 bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
                        >
                          Shop Now
                        </Link>
                      </div>
                    </div>
                  ) : !tierProgress.isMaxTier ? (
                    <div>
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="text-white/70 flex items-center gap-1">
                          <TrendUp size={12} weight="bold" />
                          Next: {tierProgress.nextTier?.name}
                        </span>
                        <span className="text-white/90 font-medium">{tierProgress.pointsNeeded.toLocaleString()} pts away</span>
                      </div>
                      <div className={`h-2 ${currentTierColors.progressBg} rounded-full overflow-hidden`}>
                        <div
                          className={`h-full ${currentTierColors.progressFill} rounded-full transition-all duration-500`}
                          style={{ width: `${tierProgress.progressPercentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-white/70 mt-2">
                        Earn {tierProgress.pointsNeeded.toLocaleString()} more points to unlock {tierProgress.nextTier?.pointMultiplier}x points
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-white/80">
                      <Medal size={16} weight="fill" />
                      <span>You&apos;ve reached the highest tier! 🎉</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </div>



        {/* Category Filter - Horizontal scroll on mobile */}
        <div className="mb-8 -mx-4 sm:mx-0">
          <div className="flex gap-2 px-4 sm:px-0 pb-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
            {categories.map((category) => {
              const Icon = category.icon
              const colors = getCategoryColors(category.value)
              const isSelected = selectedCategory === category.value
              return (
                <button
                  key={category.value}
                  onClick={() => setSelectedCategory(category.value)}
                  className={`flex items-center gap-2 px-4 py-3 sm:py-2.5 rounded-xl font-medium transition-all duration-200 whitespace-nowrap border snap-start active:scale-95 ${
                    isSelected
                      ? `${colors.activeBg} text-white border-transparent shadow-md`
                      : `bg-white ${colors.iconColor} border-gray-200 hover:border-gray-300 hover:shadow-sm`
                  }`}
                >
                  <Icon className="w-4 h-4" weight={isSelected ? 'fill' : 'bold'} />
                  <span className="text-sm sm:text-base">{category.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Rewards Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <CircleNotch size={24} weight="bold" className="animate-spin text-black/40" />
          </div>
        ) : rewards.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-black/10">
            <Sparkle size={48} weight="fill" className="text-black/10 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-black mb-2">
              No rewards found
            </h3>
            <p className="text-black/60">
              Try selecting a different category
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {rewards.map((reward) => {
              const Icon = rewardTypeIcons[reward.rewardType as keyof typeof rewardTypeIcons] || Gift
              const colors = rewardTypeColors[reward.rewardType as keyof typeof rewardTypeColors] || defaultColors
              const canRedeem = reward.canAfford && reward.meetsTierRequirement && reward.isAvailable

              return (
                <div
                  key={reward.id}
                  className={`bg-white rounded-2xl border border-gray-200 p-6 transition-all duration-200 hover:shadow-lg hover:border-gray-300 ${
                    !canRedeem ? 'opacity-60' : ''
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl ${colors.iconBg} flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${colors.iconColor}`} weight="fill" />
                    </div>
                    <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${colors.badge}`}>
                      {rewardTypeLabels[reward.rewardType as keyof typeof rewardTypeLabels]}
                    </span>
                  </div>

                  {/* Content */}
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {reward.name}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4 min-h-10 leading-relaxed">
                    {reward.description}
                  </p>

                  {/* Points Cost */}
                  <div className={`flex items-center gap-2 mb-4 p-3 rounded-xl ${colors.iconBg}`}>
                    <Sparkle size={18} weight="fill" className={colors.iconColor} />
                    <span className={`text-2xl font-bold ${colors.iconColor}`}>
                      {reward.pointsCost.toLocaleString()}
                    </span>
                    <span className="text-sm text-gray-500">points</span>
                  </div>

                  {/* Status Indicators */}
                  {!reward.meetsTierRequirement && reward.minTierRequired && (
                    <div className="flex items-center gap-2 mb-3 text-sm text-amber-600 bg-amber-50 p-2.5 rounded-lg">
                      <Lock size={16} weight="bold" />
                      <span>Requires {reward.minTierRequired} tier or higher</span>
                    </div>
                  )}

                  {!reward.canAfford && reward.meetsTierRequirement && (
                    <div className="flex items-center gap-2 mb-3 text-sm text-rose-600 bg-rose-50 p-2.5 rounded-lg">
                      <Warning size={16} weight="bold" />
                      <span>Need {(reward.pointsCost - customerPoints).toLocaleString()} more points</span>
                    </div>
                  )}

                  {reward.canAfford && reward.meetsTierRequirement && (
                    <div className="flex items-center gap-2 mb-3 text-sm text-emerald-600 bg-emerald-50 p-2.5 rounded-lg">
                      <CheckCircle size={16} weight="fill" />
                      <span className="font-medium">You can redeem this!</span>
                    </div>
                  )}

                  {/* Redeem Button */}
                  <button
                    onClick={() => handleRedeem(reward.id)}
                    disabled={!canRedeem || redeemingRewardId === reward.id}
                    className={`w-full py-3.5 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                      canRedeem
                        ? `${colors.activeBg} text-white hover:shadow-lg hover:opacity-90`
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {redeemingRewardId === reward.id ? (
                      <>
                        <CircleNotch size={18} weight="bold" className="animate-spin" />
                        Redeeming...
                      </>
                    ) : canRedeem ? (
                      'Redeem Now'
                    ) : (
                      'Cannot Redeem'
                    )}
                  </button>

                  {/* Redemption Count */}
                  {reward._count.redemptions > 0 && (
                    <p className="text-xs text-gray-500 text-center mt-3">
                      <Users size={12} weight="bold" className="inline mr-1" />
                      {reward._count.redemptions} {reward._count.redemptions === 1 ? 'redemption' : 'redemptions'}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Info Section */}
        <div className="mt-12 bg-white rounded-2xl border border-black/10 p-6">
          <h3 className="text-lg font-semibold text-black mb-4">
            How to Earn More Points
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-black/5 rounded-xl flex items-center justify-center shrink-0">
                <Gift size={18} weight="bold" className="text-black" />
              </div>
              <div>
                <p className="font-medium text-black mb-1">Make Purchases</p>
                <p className="text-sm text-black/60">
                  Earn 1 point per $1 spent (multiplied by your tier)
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-black/5 rounded-xl flex items-center justify-center shrink-0">
                <Users size={18} weight="bold" className="text-black" />
              </div>
              <div>
                <p className="font-medium text-black mb-1">Refer Friends</p>
                <p className="text-sm text-black/60">
                  Get 250 points when they make their first purchase
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-black/5 rounded-xl flex items-center justify-center shrink-0">
                <Sparkle size={18} weight="fill" className="text-black" />
              </div>
              <div>
                <p className="font-medium text-black mb-1">Special Events</p>
                <p className="text-sm text-black/60">
                  Earn bonus points during birthdays and promotions
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tier Details Modal - Modern Design */}
      {showTierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[#FAF8F5] rounded-3xl max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 bg-[#FAF8F5] border-b border-black/5 px-6 py-5 flex items-center justify-between rounded-t-3xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center">
                  <Medal size={24} weight="fill" className="text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-black">Loyalty Tiers</h2>
                  <p className="text-sm text-black/50">
                    Unlock exclusive benefits as you shop
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTierModal(false)}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-black/5 transition-colors"
              >
                <X size={20} weight="bold" className="text-black/60" />
              </button>
            </div>

            {/* Tier Cards - Matching Profile Page Style */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {TIER_HIERARCHY.map((tier, index) => {
                const isCurrentTier = user?.loyaltyTier?.slug === tier.slug
                const isNextTier = user?.loyaltyTier && index === TIER_HIERARCHY.findIndex(t => t.slug === user.loyaltyTier?.slug) + 1
                
                // Gradient colors matching the profile page loyalty card
                const tierGradients: Record<string, { gradient: string; iconBg: string; progressBg: string; progressFill: string }> = {
                  head: {
                    gradient: 'from-blue-500 via-blue-600 to-indigo-700',
                    iconBg: 'bg-blue-400/30',
                    progressBg: 'bg-blue-400/30',
                    progressFill: 'bg-blue-300',
                  },
                  heart: {
                    gradient: 'from-pink-500 via-rose-500 to-pink-600',
                    iconBg: 'bg-pink-400/30',
                    progressBg: 'bg-pink-400/30',
                    progressFill: 'bg-pink-300',
                  },
                  mind: {
                    gradient: 'from-emerald-500 via-green-500 to-teal-600',
                    iconBg: 'bg-emerald-400/30',
                    progressBg: 'bg-emerald-400/30',
                    progressFill: 'bg-emerald-300',
                  },
                  overdrive: {
                    gradient: 'from-purple-500 via-violet-500 to-purple-700',
                    iconBg: 'bg-purple-400/30',
                    progressBg: 'bg-purple-400/30',
                    progressFill: 'bg-purple-300',
                  }
                }
                
                const gradientColors = tierGradients[tier.slug as keyof typeof tierGradients]

                return (
                  <div
                    key={tier.slug}
                    className={`rounded-2xl p-5 transition-all flex flex-col h-full relative overflow-hidden ${
                      isCurrentTier 
                        ? `bg-linear-to-br ${gradientColors.gradient} text-white shadow-xl ring-2 ring-black/20` 
                        : 'bg-white border border-black/10 hover:shadow-md'
                    }`}
                  >
                    {/* Decorative element for current tier */}
                    {isCurrentTier && (
                      <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-xl" />
                    )}
                    
                    <div className="relative">
                      {/* Header */}
                      <div className="mb-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
                          isCurrentTier ? gradientColors.iconBg : 'bg-black/5'
                        }`}>
                          <Medal className={`w-6 h-6 ${isCurrentTier ? 'text-white' : 'text-black/60'}`} weight="fill" />
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`text-xl font-bold ${isCurrentTier ? 'text-white' : 'text-black'}`}>
                            {tier.name}
                          </h3>
                          {isCurrentTier && (
                            <span className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-semibold uppercase tracking-wide">
                              Current
                            </span>
                          )}
                        </div>
                        <p className={`text-xs ${isCurrentTier ? 'text-white/70' : 'text-black/50'}`}>
                          {tier.minAnnualPoints === 0 
                            ? 'Starting tier'
                            : `${tier.minAnnualPoints.toLocaleString()}+ points/year`
                          }
                        </p>
                      </div>

                      {/* Points Multiplier Badge */}
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg mb-4 ${
                        isCurrentTier ? gradientColors.iconBg : 'bg-black/5'
                      }`}>
                        <Sparkle size={14} weight="fill" className={isCurrentTier ? 'text-white' : 'text-black/60'} />
                        <span className={`text-sm font-bold ${isCurrentTier ? 'text-white' : 'text-black'}`}>
                          {tier.pointMultiplier}x Points
                        </span>
                      </div>

                      {/* Tier Benefits */}
                      <div className="space-y-2 grow">
                        {tier.slug === 'head' && (
                          <div className={`flex items-center gap-2 text-xs ${isCurrentTier ? 'text-white/80' : 'text-black/60'}`}>
                            <CheckCircle size={14} weight="fill" className={isCurrentTier ? 'text-white' : 'text-emerald-500'} />
                            <span>Base point earning</span>
                          </div>
                        )}
                        
                        {tier.slug === 'heart' && (
                          <>
                            <div className={`flex items-center gap-2 text-xs ${isCurrentTier ? 'text-white/80' : 'text-black/60'}`}>
                              <CheckCircle size={14} weight="fill" className={isCurrentTier ? 'text-white' : 'text-emerald-500'} />
                              <span>Free shipping</span>
                            </div>
                            <div className={`flex items-center gap-2 text-xs ${isCurrentTier ? 'text-white/80' : 'text-black/60'}`}>
                              <CheckCircle size={14} weight="fill" className={isCurrentTier ? 'text-white' : 'text-emerald-500'} />
                              <span>Birthday bonus points</span>
                            </div>
                          </>
                        )}

                        {tier.slug === 'mind' && (
                          <>
                            <div className={`flex items-center gap-2 text-xs ${isCurrentTier ? 'text-white/80' : 'text-black/60'}`}>
                              <CheckCircle size={14} weight="fill" className={isCurrentTier ? 'text-white' : 'text-emerald-500'} />
                              <span>Free shipping</span>
                            </div>
                            <div className={`flex items-center gap-2 text-xs ${isCurrentTier ? 'text-white/80' : 'text-black/60'}`}>
                              <CheckCircle size={14} weight="fill" className={isCurrentTier ? 'text-white' : 'text-emerald-500'} />
                              <span>Early drop access</span>
                            </div>
                            <div className={`flex items-center gap-2 text-xs ${isCurrentTier ? 'text-white/80' : 'text-black/60'}`}>
                              <CheckCircle size={14} weight="fill" className={isCurrentTier ? 'text-white' : 'text-emerald-500'} />
                              <span>Exclusive rewards</span>
                            </div>
                          </>
                        )}

                        {tier.slug === 'overdrive' && (
                          <>
                            <div className={`flex items-center gap-2 text-xs ${isCurrentTier ? 'text-white/80' : 'text-black/60'}`}>
                              <CheckCircle size={14} weight="fill" className={isCurrentTier ? 'text-white' : 'text-emerald-500'} />
                              <span>Free shipping</span>
                            </div>
                            <div className={`flex items-center gap-2 text-xs ${isCurrentTier ? 'text-white/80' : 'text-black/60'}`}>
                              <CheckCircle size={14} weight="fill" className={isCurrentTier ? 'text-white' : 'text-emerald-500'} />
                              <span>Early drop access</span>
                            </div>
                            <div className={`flex items-center gap-2 text-xs ${isCurrentTier ? 'text-white/80' : 'text-black/60'}`}>
                              <CheckCircle size={14} weight="fill" className={isCurrentTier ? 'text-white' : 'text-emerald-500'} />
                              <span>VIP support</span>
                            </div>
                            <div className={`flex items-center gap-2 text-xs ${isCurrentTier ? 'text-white/80' : 'text-black/60'}`}>
                              <CheckCircle size={14} weight="fill" className={isCurrentTier ? 'text-white' : 'text-emerald-500'} />
                              <span>Surprise gifts</span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Progress Indicator for Next Tier */}
                      {isNextTier && user?.loyaltyTier && (
                        <div className="mt-4 pt-4 border-t border-black/10">
                          <div className="flex items-center justify-between text-xs mb-2">
                            <span className="text-black/50 flex items-center gap-1">
                              <TrendUp size={12} weight="bold" />
                              Your progress
                            </span>
                            <span className="text-black font-medium">
                              {(tier.minAnnualPoints - (user.annualPointsEarned ?? 0)).toLocaleString()} pts away
                            </span>
                          </div>
                          <div className="h-2 bg-black/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-linear-to-r ${gradientColors.gradient} rounded-full transition-all duration-500`}
                              style={{ 
                                width: `${Math.min(100, ((user.annualPointsEarned ?? 0) / tier.minAnnualPoints) * 100)}%` 
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-[#FAF8F5] border-t border-black/5 px-6 py-4 rounded-b-3xl">
              <button
                onClick={() => setShowTierModal(false)}
                className="w-full bg-black text-white py-3 rounded-xl font-medium hover:bg-black/90 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Redemption Success Modal */}
      {showSuccessModal && redemptionResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-300 shadow-2xl">
            {/* Success Header */}
            <div className="bg-linear-to-br from-emerald-500 to-emerald-600 p-8 text-center text-white relative overflow-hidden rounded-t-2xl">
              <div className="absolute inset-0 opacity-20">
                <Confetti size={200} weight="fill" className="absolute -top-10 -left-10 rotate-12" />
                <Confetti size={150} weight="fill" className="absolute -bottom-5 -right-5 -rotate-12" />
              </div>
              <div className="relative">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={40} weight="fill" className="text-white" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Reward Redeemed!</h2>
                <p className="text-white/90">
                  You&apos;ve successfully redeemed {redemptionResult.reward?.name}
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Points Spent */}
              <div className="flex items-center justify-between py-3 border-b border-black/10">
                <span className="text-black/60">Points Spent</span>
                <span className="font-semibold text-black">
                  -{redemptionResult.redemption?.pointsSpent.toLocaleString()} pts
                </span>
              </div>

              {/* New Balance */}
              <div className="flex items-center justify-between py-3 border-b border-black/10">
                <span className="text-black/60">New Balance</span>
                <span className="font-semibold text-black">
                  {redemptionResult.newPointsBalance?.toLocaleString()} pts
                </span>
              </div>

              {/* Coupon Code (if applicable) */}
              {redemptionResult.redemption?.couponCode && (
                <div className="mt-4 p-4 bg-linear-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Gift size={18} weight="fill" className="text-amber-600" />
                    <span className="text-sm font-medium text-amber-900">Your Coupon Code</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white px-4 py-3 rounded-xl font-mono text-lg font-bold text-center tracking-wider border border-amber-200">
                      {redemptionResult.redemption.couponCode}
                    </code>
                    <button
                      onClick={() => copyToClipboard(redemptionResult.redemption?.couponCode || '')}
                      className="p-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors"
                      title="Copy to clipboard"
                    >
                      {copiedCode ? <Check size={20} weight="bold" /> : <Copy size={20} weight="bold" />}
                    </button>
                  </div>
                  <p className="text-xs text-amber-700 mt-2 text-center">
                    Use this code at checkout to apply your reward
                  </p>
                </div>
              )}

              {/* Reward Value Info */}
              {redemptionResult.reward?.value && (
                <div className="mt-4 flex items-center gap-2 text-sm text-black/60">
                  <Star size={16} weight="fill" className="text-amber-500" />
                  {redemptionResult.reward.type === 'DISCOUNT' && (
                    <span>Save ${redemptionResult.reward.value} on your next order</span>
                  )}
                  {redemptionResult.reward.type === 'FREE_SHIPPING' && (
                    <span>Free shipping on orders over ${redemptionResult.reward.value}</span>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-6 pt-0 space-y-3">
              <Link
                href="/products"
                className="block w-full bg-black text-white py-3 rounded-xl font-medium hover:bg-black/90 transition-colors text-center"
              >
                Shop Now
              </Link>
              <button
                onClick={() => {
                  setShowSuccessModal(false)
                  setRedemptionResult(null)
                  setCopiedCode(false)
                }}
                className="w-full bg-white text-black py-3 rounded-xl font-medium border border-black/10 hover:bg-black/5 transition-colors"
              >
                Continue Browsing Rewards
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
            {/* Error Header */}
            <div className="bg-linear-to-br from-rose-500 to-rose-600 p-6 text-center text-white rounded-t-2xl">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Warning size={32} weight="fill" className="text-white" />
              </div>
              <h2 className="text-xl font-bold mb-1">Redemption Failed</h2>
              <p className="text-white/90 text-sm">
                {errorMessage}
              </p>
            </div>

            {/* Actions */}
            <div className="p-6">
              <button
                onClick={() => {
                  setShowErrorModal(false)
                  setErrorMessage('')
                }}
                className="w-full bg-black text-white py-3 rounded-xl font-medium hover:bg-black/90 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
