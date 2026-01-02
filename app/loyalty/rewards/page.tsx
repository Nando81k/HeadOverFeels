'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { calculateTierProgress, TIER_HIERARCHY } from '@/lib/loyalty/tier-progress'
import { Sparkle, Gift, Heart, Truck, Lightning, Users, Download, Package, ArrowLeft, CircleNotch, Lock, CheckCircle, Warning, TrendUp, Medal, X, Copy, Check, Confetti, Star, Clock, CalendarBlank } from '@phosphor-icons/react'
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
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-black flex items-center justify-center">
              <Sparkle size={24} weight="fill" className="text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-black">
                Rewards Catalog
              </h1>
              <p className="text-black/60">
                Redeem your Care Points for exclusive rewards
              </p>
            </div>
          </div>

          {/* Points Balance */}
          <div className="bg-white rounded-none border border-black/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-black/60 mb-1">Your Care Points</p>
                <p className="text-3xl font-bold text-black">
                  {customerPoints.toLocaleString()}
                </p>
                {/* Current Tier Button */}
                <button
                  onClick={() => setShowTierModal(true)}
                  className="mt-2 inline-flex items-center gap-2 text-sm text-black hover:bg-black/5 px-3 py-1.5 rounded-none font-medium transition-all duration-200 border border-black/10"
                >
                  <Medal size={16} weight="fill" />
                  {user.loyaltyTier?.name || 'Head'} Tier
                </button>
              </div>
              <div className="text-right">
                <p className="text-sm text-black/60 mb-1">Points Multiplier</p>
                <div className="flex items-center justify-end gap-2">
                  <p className="text-2xl font-bold text-black">
                    {user.loyaltyTier?.pointMultiplier || 1}x
                  </p>
                </div>
                <p className="text-xs text-black/40 mt-1">
                  on every purchase
                </p>
              </div>
            </div>

            {/* Tier Progress or Start Earning Message */}
            {user.loyaltyTier && (() => {
              const tierProgress = calculateTierProgress(
                user.loyaltyTier.slug,
                user.annualPointsEarned ?? 0
              )
              
              // If user has 0 points, show encouraging message
              if ((user.annualPointsEarned ?? 0) === 0 && customerPoints === 0) {
                return (
                  <div className="border-t border-black/10 pt-4">
                    <div className="flex items-center gap-3 bg-black/5 p-4 rounded-none">
                      <div className="w-10 h-10 bg-black/10 rounded-full flex items-center justify-center">
                        <Sparkle size={20} weight="fill" className="text-black/60" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-black">Start earning points today!</p>
                        <p className="text-xs text-black/60">
                          Make your first purchase to earn Care Points and unlock exclusive rewards.
                        </p>
                      </div>
                      <Link
                        href="/products"
                        className="shrink-0 bg-black text-white text-xs font-medium px-4 py-2 hover:bg-black/90 transition-colors"
                      >
                        Shop Now
                      </Link>
                    </div>
                  </div>
                )
              }
              
              return !tierProgress.isMaxTier ? (
                <div className="border-t border-black/10 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TrendUp size={16} weight="bold" className="text-black/60" />
                      <p className="text-xs text-black/60 uppercase tracking-wide">
                        Progress to {tierProgress.nextTier?.name}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowTierModal(true)}
                      className="text-xs text-black hover:bg-black/5 px-3 py-1.5 rounded-none font-medium transition-all duration-200 border border-black/10"
                    >
                      View Details
                    </button>
                  </div>
                  
                  <div className="mb-2">
                    <div className="h-2 bg-black/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-black rounded-full transition-all duration-500"
                        style={{ width: `${tierProgress.progressPercentage}%` }}
                      />
                    </div>
                  </div>
                  
                  <p className="text-sm text-[#6B6B6B]">
                    Earn <span className="font-semibold text-[#1A1A1A]">{tierProgress.pointsNeeded.toLocaleString()}</span> more points to unlock{' '}
                    {tierProgress.nextTier?.pointMultiplier}x points
                  </p>
                </div>
              ) : (
                <div className="border-t border-[#E5DDD5] pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Medal size={20} weight="bold" className="text-[#1A1A1A]" />
                      <p className="text-sm font-medium text-[#1A1A1A]">
                        Max tier reached!
                      </p>
                    </div>
                    <button
                      onClick={() => setShowTierModal(true)}
                      className="text-xs text-[#1A1A1A] hover:bg-[#F5F1EB] px-3 py-1.5 rounded-lg font-medium transition-all duration-200 hover:shadow-sm"
                    >
                      View All Tiers
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>

        {/* Category Filter */}
        <div className="mb-8 overflow-x-auto">
          <div className="flex gap-2 pb-2">
            {categories.map((category) => {
              const Icon = category.icon
              const colors = getCategoryColors(category.value)
              const isSelected = selectedCategory === category.value
              return (
                <button
                  key={category.value}
                  onClick={() => setSelectedCategory(category.value)}
                  className={`flex items-center gap-2 px-4 py-2.5 font-medium transition-all duration-200 whitespace-nowrap border ${
                    isSelected
                      ? `${colors.activeBg} text-white border-transparent`
                      : `bg-white ${colors.iconColor} border-gray-200 hover:border-gray-300`
                  }`}
                >
                  <Icon className="w-4 h-4" weight={isSelected ? 'fill' : 'bold'} />
                  {category.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Rewards Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <CircleNotch size={24} weight="bold" className="animate-spin text-[#6B6B6B]" />
          </div>
        ) : rewards.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-none border border-black/10">
            <Sparkle size={48} weight="fill" className="text-black/10 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-black mb-2">
              No rewards found
            </h3>
            <p className="text-black/60">
              Try selecting a different category
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rewards.map((reward) => {
              const Icon = rewardTypeIcons[reward.rewardType as keyof typeof rewardTypeIcons] || Gift
              const colors = rewardTypeColors[reward.rewardType as keyof typeof rewardTypeColors] || defaultColors
              const canRedeem = reward.canAfford && reward.meetsTierRequirement && reward.isAvailable

              return (
                <div
                  key={reward.id}
                  className={`bg-white border border-gray-200 p-6 transition-all duration-200 hover:shadow-lg hover:border-gray-300 ${
                    !canRedeem ? 'opacity-60' : ''
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 ${colors.iconBg} flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${colors.iconColor}`} weight="fill" />
                    </div>
                    <span className={`px-3 py-1.5 text-xs font-semibold ${colors.badge}`}>
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
                  <div className={`flex items-center gap-2 mb-4 p-3 ${colors.iconBg}`}>
                    <Sparkle size={18} weight="fill" className={colors.iconColor} />
                    <span className={`text-2xl font-bold ${colors.iconColor}`}>
                      {reward.pointsCost.toLocaleString()}
                    </span>
                    <span className="text-sm text-gray-500">points</span>
                  </div>

                  {/* Status Indicators */}
                  {!reward.meetsTierRequirement && reward.minTierRequired && (
                    <div className="flex items-center gap-2 mb-3 text-sm text-amber-600 bg-amber-50 p-2.5">
                      <Lock size={16} weight="bold" />
                      <span>Requires {reward.minTierRequired} tier or higher</span>
                    </div>
                  )}

                  {!reward.canAfford && reward.meetsTierRequirement && (
                    <div className="flex items-center gap-2 mb-3 text-sm text-rose-600 bg-rose-50 p-2.5">
                      <Warning size={16} weight="bold" />
                      <span>Need {(reward.pointsCost - customerPoints).toLocaleString()} more points</span>
                    </div>
                  )}

                  {reward.canAfford && reward.meetsTierRequirement && (
                    <div className="flex items-center gap-2 mb-3 text-sm text-emerald-600 bg-emerald-50 p-2.5">
                      <CheckCircle size={16} weight="fill" />
                      <span className="font-medium">You can redeem this!</span>
                    </div>
                  )}

                  {/* Redeem Button */}
                  <button
                    onClick={() => handleRedeem(reward.id)}
                    disabled={!canRedeem || redeemingRewardId === reward.id}
                    className={`w-full py-3.5 font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
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
        <div className="mt-12 bg-white rounded-none border border-black/10 p-6">
          <h3 className="text-lg font-semibold text-black mb-4">
            How to Earn More Points
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-black/5 rounded-none flex items-center justify-center shrink-0">
                <Gift size={16} weight="bold" className="text-black" />
              </div>
              <div>
                <p className="font-medium text-black mb-1">Make Purchases</p>
                <p className="text-sm text-black/60">
                  Earn 1 point per $1 spent (multiplied by your tier)
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-black/5 rounded-none flex items-center justify-center shrink-0">
                <Users size={16} weight="bold" className="text-black" />
              </div>
              <div>
                <p className="font-medium text-black mb-1">Refer Friends</p>
                <p className="text-sm text-black/60">
                  Get 250 points when they make their first purchase
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-black/5 rounded-none flex items-center justify-center shrink-0">
                <Sparkle size={16} weight="fill" className="text-black" />
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

      {/* Tier Details Modal */}
      {showTierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-none max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-black/10 p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-[#1A1A1A]">Loyalty Tiers</h2>
                <p className="text-sm text-[#6B6B6B] mt-1">
                  Unlock exclusive benefits as you shop
                </p>
              </div>
              <button
                onClick={() => setShowTierModal(false)}
                className="w-10 h-10 flex items-center justify-center rounded-none hover:bg-black/5 transition-colors border border-black/10"
              >
                <X size={20} weight="bold" className="text-black/60" />
              </button>
            </div>

            {/* Tier Cards - Horizontal Layout */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {TIER_HIERARCHY.map((tier, index) => {
                const isCurrentTier = user?.loyaltyTier?.slug === tier.slug
                
                // Pastel colors for emotional health themes
                const tierColors = {
                  head: {
                    bg: 'bg-linear-to-br from-blue-100 to-blue-50',
                    iconBg: 'bg-blue-200/50',
                    iconColor: 'text-blue-600',
                    textColor: 'text-blue-900',
                    mutedText: 'text-blue-700',
                    bullet: 'bg-blue-600',
                    border: 'border-blue-200',
                    badge: 'bg-blue-200 text-blue-800'
                  },
                  heart: {
                    bg: 'bg-linear-to-br from-pink-100 to-pink-50',
                    iconBg: 'bg-pink-200/50',
                    iconColor: 'text-pink-600',
                    textColor: 'text-pink-900',
                    mutedText: 'text-pink-700',
                    bullet: 'bg-pink-600',
                    border: 'border-pink-200',
                    badge: 'bg-pink-200 text-pink-800'
                  },
                  mind: {
                    bg: 'bg-linear-to-br from-green-100 to-green-50',
                    iconBg: 'bg-green-200/50',
                    iconColor: 'text-green-600',
                    textColor: 'text-green-900',
                    mutedText: 'text-green-700',
                    bullet: 'bg-green-600',
                    border: 'border-green-200',
                    badge: 'bg-green-200 text-green-800'
                  },
                  overdrive: {
                    bg: 'bg-linear-to-br from-purple-100 to-purple-50',
                    iconBg: 'bg-purple-200/50',
                    iconColor: 'text-purple-600',
                    textColor: 'text-purple-900',
                    mutedText: 'text-purple-700',
                    bullet: 'bg-purple-600',
                    border: 'border-purple-200',
                    badge: 'bg-purple-200 text-purple-800'
                  }
                }
                
                const colors = tierColors[tier.slug as keyof typeof tierColors]
                const tierBgClass = isCurrentTier
                  ? 'bg-linear-to-br from-[#1A1A1A] to-[#2B2B2B] text-white shadow-lg'
                  : `${colors.bg} border ${colors.border}`

                return (
                  <div
                    key={tier.slug}
                    className={`rounded-xl p-5 ${tierBgClass} transition-all flex flex-col h-full`}
                  >
                    {/* Header */}
                    <div className="mb-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
                        isCurrentTier ? 'bg-white/20' : colors.iconBg
                      }`}>
                        <Medal className={`w-6 h-6 ${isCurrentTier ? 'text-white' : colors.iconColor}`} />
                      </div>
                      <h3 className={`text-xl font-bold mb-1 ${isCurrentTier ? 'text-white' : colors.textColor}`}>
                        {tier.name}
                      </h3>
                      {isCurrentTier && (
                        <span className="inline-block px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium mb-2">
                          Current
                        </span>
                      )}
                      <p className={`text-xs ${isCurrentTier ? 'text-white/75' : colors.mutedText}`}>
                        {tier.minAnnualPoints === 0 
                          ? 'Starting tier'
                          : `${tier.minAnnualPoints.toLocaleString()}+ points/year`
                        }
                      </p>
                    </div>

                    {/* Tier Benefits */}
                    <div className="space-y-2 grow">
                      <div className={`flex items-start gap-2 ${isCurrentTier ? 'text-white' : colors.textColor}`}>
                        <div className={`w-1 h-1 rounded-full mt-1.5 shrink-0 ${isCurrentTier ? 'bg-white' : colors.bullet}`}></div>
                        <p className="text-xs font-medium">
                          {tier.pointMultiplier}x points
                        </p>
                      </div>
                      
                      {tier.slug === 'heart' && (
                        <>
                          <div className={`flex items-start gap-2 ${isCurrentTier ? 'text-white' : colors.textColor}`}>
                            <div className={`w-1 h-1 rounded-full mt-1.5 shrink-0 ${isCurrentTier ? 'bg-white' : colors.bullet}`}></div>
                            <p className="text-xs">Free shipping</p>
                          </div>
                          <div className={`flex items-start gap-2 ${isCurrentTier ? 'text-white' : colors.textColor}`}>
                            <div className={`w-1 h-1 rounded-full mt-1.5 shrink-0 ${isCurrentTier ? 'bg-white' : colors.bullet}`}></div>
                            <p className="text-xs">Birthday bonus</p>
                          </div>
                        </>
                      )}

                      {tier.slug === 'mind' && (
                        <>
                          <div className={`flex items-start gap-2 ${isCurrentTier ? 'text-white' : colors.textColor}`}>
                            <div className={`w-1 h-1 rounded-full mt-1.5 shrink-0 ${isCurrentTier ? 'bg-white' : colors.bullet}`}></div>
                            <p className="text-xs">Free shipping</p>
                          </div>
                          <div className={`flex items-start gap-2 ${isCurrentTier ? 'text-white' : colors.textColor}`}>
                            <div className={`w-1 h-1 rounded-full mt-1.5 shrink-0 ${isCurrentTier ? 'bg-white' : colors.bullet}`}></div>
                            <p className="text-xs">Early drop access</p>
                          </div>
                          <div className={`flex items-start gap-2 ${isCurrentTier ? 'text-white' : colors.textColor}`}>
                            <div className={`w-1 h-1 rounded-full mt-1.5 shrink-0 ${isCurrentTier ? 'bg-white' : colors.bullet}`}></div>
                            <p className="text-xs">Birthday bonus</p>
                          </div>
                          <div className={`flex items-start gap-2 ${isCurrentTier ? 'text-white' : colors.textColor}`}>
                            <div className={`w-1 h-1 rounded-full mt-1.5 shrink-0 ${isCurrentTier ? 'bg-white' : colors.bullet}`}></div>
                            <p className="text-xs">Exclusive rewards</p>
                          </div>
                        </>
                      )}

                      {tier.slug === 'overdrive' && (
                        <>
                          <div className={`flex items-start gap-2 ${isCurrentTier ? 'text-white' : colors.textColor}`}>
                            <div className={`w-1 h-1 rounded-full mt-1.5 shrink-0 ${isCurrentTier ? 'bg-white' : colors.bullet}`}></div>
                            <p className="text-xs">Free shipping</p>
                          </div>
                          <div className={`flex items-start gap-2 ${isCurrentTier ? 'text-white' : colors.textColor}`}>
                            <div className={`w-1 h-1 rounded-full mt-1.5 shrink-0 ${isCurrentTier ? 'bg-white' : colors.bullet}`}></div>
                            <p className="text-xs">Early drop access</p>
                          </div>
                          <div className={`flex items-start gap-2 ${isCurrentTier ? 'text-white' : colors.textColor}`}>
                            <div className={`w-1 h-1 rounded-full mt-1.5 shrink-0 ${isCurrentTier ? 'bg-white' : colors.bullet}`}></div>
                            <p className="text-xs">Birthday bonus</p>
                          </div>
                          <div className={`flex items-start gap-2 ${isCurrentTier ? 'text-white' : colors.textColor}`}>
                            <div className={`w-1 h-1 rounded-full mt-1.5 shrink-0 ${isCurrentTier ? 'bg-white' : colors.bullet}`}></div>
                            <p className="text-xs">Exclusive rewards</p>
                          </div>
                          <div className={`flex items-start gap-2 ${isCurrentTier ? 'text-white' : colors.textColor}`}>
                            <div className={`w-1 h-1 rounded-full mt-1.5 shrink-0 ${isCurrentTier ? 'bg-white' : colors.bullet}`}></div>
                            <p className="text-xs">VIP support</p>
                          </div>
                          <div className={`flex items-start gap-2 ${isCurrentTier ? 'text-white' : colors.textColor}`}>
                            <div className={`w-1 h-1 rounded-full mt-1.5 shrink-0 ${isCurrentTier ? 'bg-white' : colors.bullet}`}></div>
                            <p className="text-xs">Surprise gifts</p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Progress Indicator for Current and Next Tier */}
                    {!isCurrentTier && user?.loyaltyTier && index === TIER_HIERARCHY.findIndex(t => t.slug === user.loyaltyTier?.slug) + 1 && (
                      <div className={`mt-3 pt-3 border-t ${colors.border}`}>
                        <p className={`text-xs ${colors.mutedText} mb-1.5`}>
                          {(tier.minAnnualPoints - (user.annualPointsEarned ?? 0)).toLocaleString()} more points
                        </p>
                        <div className={`h-1.5 ${colors.iconBg} rounded-full overflow-hidden`}>
                          <div
                            className={`h-full bg-linear-to-r ${colors.iconColor.replace('text-', 'from-')} ${colors.bullet.replace('bg-', 'to-')} rounded-full transition-all duration-500`}
                            style={{ 
                              width: `${Math.min(100, ((user.annualPointsEarned ?? 0) / tier.minAnnualPoints) * 100)}%` 
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-black/10 p-6">
              <button
                onClick={() => setShowTierModal(false)}
                className="w-full bg-black text-white py-3 rounded-none font-medium hover:bg-black/90 transition-colors"
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
          <div className="bg-white rounded-none max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-300">
            {/* Success Header */}
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-8 text-center text-white relative overflow-hidden">
              <div className="absolute inset-0 opacity-20">
                <Confetti size={200} weight="fill" className="absolute -top-10 -left-10 rotate-12" />
                <Confetti size={150} weight="fill" className="absolute -bottom-5 -right-5 -rotate-12" />
              </div>
              <div className="relative">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
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
                <div className="mt-4 p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Gift size={18} weight="fill" className="text-amber-600" />
                    <span className="text-sm font-medium text-amber-900">Your Coupon Code</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white px-4 py-3 rounded-lg font-mono text-lg font-bold text-center tracking-wider border border-amber-200">
                      {redemptionResult.redemption.couponCode}
                    </code>
                    <button
                      onClick={() => copyToClipboard(redemptionResult.redemption?.couponCode || '')}
                      className="p-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
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
                className="block w-full bg-black text-white py-3 rounded-none font-medium hover:bg-black/90 transition-colors text-center"
              >
                Shop Now
              </Link>
              <button
                onClick={() => {
                  setShowSuccessModal(false)
                  setRedemptionResult(null)
                  setCopiedCode(false)
                }}
                className="w-full bg-white text-black py-3 rounded-none font-medium border border-black/10 hover:bg-black/5 transition-colors"
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
          <div className="bg-white rounded-none max-w-md w-full overflow-hidden">
            {/* Error Header */}
            <div className="bg-gradient-to-br from-rose-500 to-rose-600 p-6 text-center text-white">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
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
                className="w-full bg-black text-white py-3 rounded-none font-medium hover:bg-black/90 transition-colors"
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
