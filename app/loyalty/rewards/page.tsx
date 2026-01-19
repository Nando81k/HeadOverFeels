'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Navigation } from '@/components/layout/Navigation'
import { useAuth } from '@/lib/auth/context'
import { calculateTierProgress, TIER_HIERARCHY } from '@/lib/loyalty/tier-progress'
import { Sparkle, Gift, Heart, Truck, Lightning, Users, Download, Package, CircleNotch, Lock, CheckCircle, Warning, TrendUp, Medal, X, Copy, Check, Confetti, Star, ArrowRight } from '@phosphor-icons/react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

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
  FREE_SHIPPING: 'Free Shipping',
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

// Tier configuration with colors and benefits (matching profile page and seeded data)
const tierColors: Record<string, { gradient: string; iconBg: string; progressBg: string; progressFill: string; badge: string; glow: string; emoji: string; benefits: string[] }> = {
  newcomer: {
    gradient: 'from-slate-400 via-slate-500 to-slate-600',
    iconBg: 'bg-slate-400/30',
    progressBg: 'bg-slate-400/30',
    progressFill: 'bg-slate-300',
    badge: 'bg-slate-400/30',
    glow: 'shadow-slate-500/30',
    emoji: '👋',
    benefits: [
      'Earn 10 Care Points per $1 spent',
      'Birthday surprise',
      'Early sale access',
    ],
  },
  friend: {
    gradient: 'from-blue-500 via-blue-600 to-indigo-700',
    iconBg: 'bg-blue-400/30',
    progressBg: 'bg-blue-400/30',
    progressFill: 'bg-blue-300',
    badge: 'bg-blue-400/30',
    glow: 'shadow-blue-500/30',
    emoji: '💙',
    benefits: [
      'Earn 12.5 Care Points per $1 spent (1.25x)',
      'Birthday bonus points',
      'Early access to sales',
      'Free shipping on orders $75+',
    ],
  },
  bestie: {
    gradient: 'from-pink-500 via-rose-500 to-pink-600',
    iconBg: 'bg-pink-400/30',
    progressBg: 'bg-pink-400/30',
    progressFill: 'bg-pink-300',
    badge: 'bg-pink-400/30',
    glow: 'shadow-pink-500/30',
    emoji: '💖',
    benefits: [
      'Earn 15 Care Points per $1 spent (1.5x)',
      'FREE shipping on all orders',
      '24-hour early access to sales',
      'Exclusive Bestie-only products',
    ],
  },
  soulmate: {
    gradient: 'from-purple-500 via-violet-500 to-purple-700',
    iconBg: 'bg-purple-400/30',
    progressBg: 'bg-purple-400/30',
    progressFill: 'bg-purple-300',
    badge: 'bg-purple-400/30',
    glow: 'shadow-purple-500/30',
    emoji: '💜',
    benefits: [
      'Earn 20 Care Points per $1 spent (2x)',
      'FREE express shipping',
      '48-hour early access to limited drops',
      'Annual surprise gift',
      'Priority support',
    ],
  },
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
        fetchRewards()
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <CircleNotch size={32} weight="bold" className="animate-spin text-black" />
      </div>
    )
  }

  const categories = [
    { value: 'all', label: 'All Rewards', icon: Sparkle },
    { value: 'DISCOUNT', label: 'Discounts', icon: Gift },
    { value: 'FREE_SHIPPING', label: 'Shipping', icon: Truck },
    { value: 'EARLY_ACCESS', label: 'Early Access', icon: Lightning },
    { value: 'EXCLUSIVE_PRODUCT', label: 'Exclusive', icon: Sparkle },
    { value: 'CHARITY_DONATION', label: 'Charity', icon: Heart },
    { value: 'DIGITAL_CONTENT', label: 'Digital', icon: Download },
    { value: 'PHYSICAL_PERK', label: 'Physical', icon: Package },
  ]

  const currentTierColors = user.loyaltyTier ? (tierColors[user.loyaltyTier.slug] || tierColors.newcomer) : tierColors.newcomer
  const tierProgress = user.loyaltyTier ? calculateTierProgress(user.loyaltyTier.slug, user.annualPointsEarned ?? 0) : null

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      {/* Hero Section - Editorial Style */}
      <section className="relative bg-white pt-24 lg:pt-32 pb-8">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          {/* Breadcrumb */}
          <Link 
            href="/profile" 
            className="inline-flex items-center gap-2 text-sm text-black/70 hover:text-black transition-colors mb-6 w-fit"
          >
            <span>←</span>
            <span>Back to Profile</span>
          </Link>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            <div className="max-w-2xl">
              <h1 className="text-5xl lg:text-7xl font-black text-black tracking-tight mb-4">
                Rewards
              </h1>
              <p className="text-xl lg:text-2xl text-black/70 leading-relaxed">
                Turn your Care Points into exclusive perks, discounts, and more. The more you shop, the more you earn.
              </p>
            </div>

            {/* Points Balance Card - Tier Colored */}
            {user.loyaltyTier && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`relative bg-linear-to-br ${currentTierColors.gradient} p-6 text-white shadow-2xl ${currentTierColors.glow} w-full lg:w-auto lg:min-w-[340px]`}
              >
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl" />
                
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 ${currentTierColors.iconBg} rounded-lg flex items-center justify-center`}>
                        <Medal size={20} weight="fill" className="text-white" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-white/60 font-medium">Your Tier</p>
                        <p className="text-lg font-bold">{user.loyaltyTier.name}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowTierModal(true)}
                      className={`px-3 py-1.5 ${currentTierColors.badge} rounded-full text-xs font-bold hover:bg-white/30 transition-colors`}
                    >
                      View Benefits
                    </button>
                  </div>

                  <div className={`${currentTierColors.iconBg} rounded-lg p-4 mb-4`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkle size={14} weight="fill" className="text-white/80" />
                      <span className="text-[10px] uppercase tracking-wider text-white/60 font-medium">Available Points</span>
                    </div>
                    <p className="text-4xl font-black">{customerPoints.toLocaleString()}</p>
                  </div>

                  {tierProgress && !tierProgress.isMaxTier && (
                    <div>
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="text-white/60 flex items-center gap-1">
                          <TrendUp size={12} weight="bold" />
                          Next: {tierProgress.nextTier?.name}
                        </span>
                        <span className="text-white/90 font-medium">{tierProgress.pointsNeeded.toLocaleString()} pts away</span>
                      </div>
                      <div className={`h-1.5 ${currentTierColors.progressBg} rounded-full overflow-hidden`}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${tierProgress.progressPercentage}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className={`h-full ${currentTierColors.progressFill} rounded-full`}
                        />
                      </div>
                    </div>
                  )}

                  {tierProgress?.isMaxTier && (
                    <div className="flex items-center gap-2 text-xs text-white/80">
                      <Medal size={14} weight="fill" />
                      <span>You&apos;ve reached the highest tier! 🎉</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-8 lg:py-12">
        {/* Category Filter - Matching Products Page Style */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-black/5">
          {/* Categories - Horizontal scroll */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-2 px-2">
            {categories.map((category) => {
              const Icon = category.icon
              const isSelected = selectedCategory === category.value
              return (
                <button
                  key={category.value}
                  onClick={() => setSelectedCategory(category.value)}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-bold transition-all whitespace-nowrap uppercase tracking-wider ${
                    isSelected
                      ? 'bg-black text-white shadow-lg'
                      : 'bg-white text-black/70 border border-black/10 hover:border-black/30 hover:text-black'
                  }`}
                >
                  <Icon size={18} weight={isSelected ? 'fill' : 'bold'} />
                  <span>{category.label}</span>
                </button>
              )
            })}
          </div>

          {/* Results Count */}
          <span className="text-sm text-black/50 font-medium tracking-wide hidden lg:block">
            <span className="font-bold text-black">{rewards.length}</span> {rewards.length === 1 ? 'reward' : 'rewards'}
          </span>
        </div>

        {/* Rewards Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <CircleNotch size={48} weight="bold" className="animate-spin text-black mb-4" />
            <p className="text-black/70">Loading rewards...</p>
          </div>
        ) : rewards.length === 0 ? (
          <div className="text-center py-20 px-6">
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 mx-auto mb-6 bg-black/5 flex items-center justify-center">
                <Sparkle size={40} weight="fill" className="text-black/20" />
              </div>
              <h3 className="text-2xl font-black text-black mb-3">No rewards found</h3>
              <p className="text-black/70 mb-6">Try selecting a different category to find available rewards.</p>
              <button
                onClick={() => setSelectedCategory('all')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white font-bold uppercase tracking-wider hover:bg-black/90 transition-all"
              >
                View All Rewards
                <ArrowRight size={16} weight="bold" />
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {rewards.map((reward, index) => {
              const Icon = rewardTypeIcons[reward.rewardType as keyof typeof rewardTypeIcons] || Gift
              const colors = rewardTypeColors[reward.rewardType as keyof typeof rewardTypeColors] || defaultColors
              const canRedeem = reward.canAfford && reward.meetsTierRequirement && reward.isAvailable

              return (
                <motion.div
                  key={reward.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={`group bg-white border border-black/10 p-6 transition-all duration-300 hover:shadow-xl hover:border-black/20 hover:-translate-y-1 ${
                    !canRedeem ? 'opacity-60' : ''
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-6">
                    <div className={`w-14 h-14 ${colors.iconBg} flex items-center justify-center`}>
                      <Icon className={`w-7 h-7 ${colors.iconColor}`} weight="fill" />
                    </div>
                    <span className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${colors.badge}`}>
                      {rewardTypeLabels[reward.rewardType as keyof typeof rewardTypeLabels]}
                    </span>
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-black text-black mb-2 tracking-tight">
                    {reward.name}
                  </h3>
                  <p className="text-sm text-black/60 mb-6 leading-relaxed min-h-12">
                    {reward.description}
                  </p>

                  {/* Points Cost */}
                  <div className={`flex items-center gap-3 mb-6 p-4 ${colors.bg} border ${colors.border}`}>
                    <Sparkle size={20} weight="fill" className={colors.iconColor} />
                    <div>
                      <span className={`text-3xl font-black ${colors.iconColor}`}>
                        {reward.pointsCost.toLocaleString()}
                      </span>
                      <span className="text-sm text-black/50 ml-2">points</span>
                    </div>
                  </div>

                  {/* Status Indicators */}
                  {!reward.meetsTierRequirement && reward.minTierRequired && (
                    <div className="flex items-center gap-2 mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 p-3">
                      <Lock size={16} weight="bold" />
                      <span>Requires <span className="font-bold">{reward.minTierRequired}</span> tier</span>
                    </div>
                  )}

                  {!reward.canAfford && reward.meetsTierRequirement && (
                    <div className="flex items-center gap-2 mb-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 p-3">
                      <Warning size={16} weight="bold" />
                      <span>Need <span className="font-bold">{(reward.pointsCost - customerPoints).toLocaleString()}</span> more points</span>
                    </div>
                  )}

                  {canRedeem && (
                    <div className="flex items-center gap-2 mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 p-3">
                      <CheckCircle size={16} weight="fill" />
                      <span className="font-bold">Available to redeem!</span>
                    </div>
                  )}

                  {/* Redeem Button */}
                  <button
                    onClick={() => handleRedeem(reward.id)}
                    disabled={!canRedeem || redeemingRewardId === reward.id}
                    className={`w-full py-4 font-bold uppercase tracking-wider text-sm transition-all flex items-center justify-center gap-2 ${
                      canRedeem
                        ? 'bg-black text-white hover:bg-black/90 shadow-lg hover:shadow-xl'
                        : 'bg-black/10 text-black/40 cursor-not-allowed'
                    }`}
                  >
                    {redeemingRewardId === reward.id ? (
                      <>
                        <CircleNotch size={18} weight="bold" className="animate-spin" />
                        Redeeming...
                      </>
                    ) : canRedeem ? (
                      <>
                        Redeem Now
                        <ArrowRight size={16} weight="bold" />
                      </>
                    ) : (
                      'Cannot Redeem'
                    )}
                  </button>

                  {/* Redemption Count */}
                  {reward._count.redemptions > 0 && (
                    <p className="text-xs text-black/40 text-center mt-4 font-medium">
                      <Users size={12} weight="bold" className="inline mr-1" />
                      {reward._count.redemptions.toLocaleString()} {reward._count.redemptions === 1 ? 'redemption' : 'redemptions'}
                    </p>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}

        {/* How to Earn Section */}
        <section className="mt-20 pt-16 border-t border-black/5">
          <div className="text-center mb-12">
            <span className="text-[10px] font-medium tracking-[0.3em] text-black/40 uppercase block mb-4">
              Maximize Your Rewards
            </span>
            <h2 className="text-3xl lg:text-4xl font-black text-black tracking-tight">
              How to Earn More Points
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-black mx-auto mb-6 flex items-center justify-center">
                <Gift size={28} weight="fill" className="text-white" />
              </div>
              <h3 className="text-lg font-black text-black mb-2">Make Purchases</h3>
              <p className="text-black/60">
                Earn 1 point per $1 spent, multiplied by your current tier level.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-black mx-auto mb-6 flex items-center justify-center">
                <Users size={28} weight="fill" className="text-white" />
              </div>
              <h3 className="text-lg font-black text-black mb-2">Refer Friends</h3>
              <p className="text-black/60">
                Get 250 bonus points when a friend makes their first purchase.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-black mx-auto mb-6 flex items-center justify-center">
                <Sparkle size={28} weight="fill" className="text-white" />
              </div>
              <h3 className="text-lg font-black text-black mb-2">Special Events</h3>
              <p className="text-black/60">
                Earn bonus points during your birthday and special promotions.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-12">
            <Link
              href="/products"
              className="inline-flex items-center gap-3 px-8 py-4 bg-black text-white font-bold uppercase tracking-wider hover:bg-black/90 transition-all shadow-lg"
            >
              Start Shopping
              <ArrowRight size={18} weight="bold" />
            </Link>
          </div>
        </section>
      </div>

      {/* Tier Details Modal */}
      <AnimatePresence>
        {showTierModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowTierModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-black/5 px-6 py-5 flex items-center justify-between z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-black flex items-center justify-center">
                    <Medal size={24} weight="fill" className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-black tracking-tight">Loyalty Tiers</h2>
                    <p className="text-sm text-black/50">Unlock exclusive benefits as you shop</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTierModal(false)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-black/5 transition-colors"
                >
                  <X size={20} weight="bold" className="text-black/60" />
                </button>
              </div>

              {/* Tier Cards */}
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {TIER_HIERARCHY.map((tier, index) => {
                    const currentTierIndex = user?.loyaltyTier ? TIER_HIERARCHY.findIndex(t => t.slug === user.loyaltyTier?.slug) : 0
                    const isCurrentTier = user?.loyaltyTier?.slug === tier.slug
                    const isCompletedTier = index < currentTierIndex
                    const isNextTier = index === currentTierIndex + 1
                    const gradientColors = tierColors[tier.slug as keyof typeof tierColors]

                    return (
                      <div
                        key={tier.slug}
                        className={`p-5 transition-all flex flex-col h-full relative overflow-hidden ${
                          isCurrentTier 
                            ? `bg-linear-to-br ${gradientColors.gradient} text-white shadow-xl` 
                            : 'bg-white border border-black/10 hover:shadow-lg'
                        }`}
                      >
                        {isCurrentTier && (
                          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-xl" />
                        )}
                        
                        <div className="relative">
                          {/* Header */}
                          <div className="mb-4">
                            <div className={`w-12 h-12 flex items-center justify-center mb-3 ${
                              isCurrentTier ? gradientColors.iconBg : 'bg-black/5'
                            }`}>
                              <Medal className={`w-6 h-6 ${isCurrentTier ? 'text-white' : 'text-black/60'}`} weight="fill" />
                            </div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className={`text-xl font-black ${isCurrentTier ? 'text-white' : 'text-black'}`}>
                                {tier.name}
                              </h3>
                              {isCurrentTier && (
                                <span className="px-2 py-0.5 bg-white/20 text-[10px] font-bold uppercase tracking-wide">
                                  Current
                                </span>
                              )}
                              {isCompletedTier && (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wide">
                                  ✓ Completed
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
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 mb-4 ${
                            isCurrentTier ? gradientColors.iconBg : 'bg-black/5'
                          }`}>
                            <Sparkle size={14} weight="fill" className={isCurrentTier ? 'text-white' : 'text-black/60'} />
                            <span className={`text-sm font-black ${isCurrentTier ? 'text-white' : 'text-black'}`}>
                              {tier.pointMultiplier}x Points
                            </span>
                          </div>

                          {/* Tier Benefits */}
                          <div className="space-y-2 grow">
                            {gradientColors.benefits.map((benefit, benefitIndex) => (
                              <div key={benefitIndex} className={`flex items-center gap-2 text-xs ${isCurrentTier ? 'text-white/80' : 'text-black/60'}`}>
                                <CheckCircle size={14} weight="fill" className={isCurrentTier ? 'text-white' : 'text-emerald-500'} />
                                <span>{benefit}</span>
                              </div>
                            ))}
                          </div>

                          {/* Progress Indicator for Next Tier */}
                          {isNextTier && user?.loyaltyTier && (
                            <div className="mt-4 pt-4 border-t border-black/10">
                              <div className="flex items-center justify-between text-xs mb-2">
                                <span className="text-black/50 flex items-center gap-1">
                                  <TrendUp size={12} weight="bold" />
                                  Your progress
                                </span>
                                <span className="text-black font-bold">
                                  {(tier.minAnnualPoints - (user.annualPointsEarned ?? 0)).toLocaleString()} pts away
                                </span>
                              </div>
                              <div className="h-2 bg-black/10 overflow-hidden">
                                <div
                                  className={`h-full bg-linear-to-r ${gradientColors.gradient} transition-all duration-500`}
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
              <div className="sticky bottom-0 bg-white border-t border-black/5 px-6 py-4">
                <button
                  onClick={() => setShowTierModal(false)}
                  className="w-full bg-black text-white py-4 font-bold uppercase tracking-wider hover:bg-black/90 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Redemption Success Modal */}
      <AnimatePresence>
        {showSuccessModal && redemptionResult && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white max-w-md w-full overflow-hidden shadow-2xl"
            >
              {/* Success Header */}
              <div className="bg-linear-to-br from-emerald-500 to-emerald-600 p-8 text-center text-white relative overflow-hidden">
                <div className="absolute inset-0 opacity-20">
                  <Confetti size={200} weight="fill" className="absolute -top-10 -left-10 rotate-12" />
                  <Confetti size={150} weight="fill" className="absolute -bottom-5 -right-5 -rotate-12" />
                </div>
                <div className="relative">
                  <div className="w-16 h-16 bg-white/20 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={40} weight="fill" className="text-white" />
                  </div>
                  <h2 className="text-2xl font-black mb-2">Reward Redeemed!</h2>
                  <p className="text-white/90">
                    You&apos;ve successfully redeemed {redemptionResult.reward?.name}
                  </p>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="flex items-center justify-between py-3 border-b border-black/10">
                  <span className="text-black/60">Points Spent</span>
                  <span className="font-bold text-black">
                    -{redemptionResult.redemption?.pointsSpent.toLocaleString()} pts
                  </span>
                </div>

                <div className="flex items-center justify-between py-3 border-b border-black/10">
                  <span className="text-black/60">New Balance</span>
                  <span className="font-bold text-black">
                    {redemptionResult.newPointsBalance?.toLocaleString()} pts
                  </span>
                </div>

                {redemptionResult.redemption?.couponCode && (
                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Gift size={18} weight="fill" className="text-amber-600" />
                      <span className="text-sm font-bold text-amber-900">Your Coupon Code</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white px-4 py-3 font-mono text-lg font-black text-center tracking-wider border border-amber-200">
                        {redemptionResult.redemption.couponCode}
                      </code>
                      <button
                        onClick={() => copyToClipboard(redemptionResult.redemption?.couponCode || '')}
                        className="p-3 bg-amber-600 text-white hover:bg-amber-700 transition-colors"
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
                  className="block w-full bg-black text-white py-4 font-bold uppercase tracking-wider hover:bg-black/90 transition-colors text-center"
                >
                  Shop Now
                </Link>
                <button
                  onClick={() => {
                    setShowSuccessModal(false)
                    setRedemptionResult(null)
                    setCopiedCode(false)
                  }}
                  className="w-full bg-white text-black py-4 font-bold uppercase tracking-wider border border-black/10 hover:bg-black/5 transition-colors"
                >
                  Continue Browsing
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Modal */}
      <AnimatePresence>
        {showErrorModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white max-w-md w-full overflow-hidden shadow-2xl"
            >
              <div className="bg-linear-to-br from-rose-500 to-rose-600 p-6 text-center text-white">
                <div className="w-14 h-14 bg-white/20 flex items-center justify-center mx-auto mb-3">
                  <Warning size={32} weight="fill" className="text-white" />
                </div>
                <h2 className="text-xl font-black mb-1">Redemption Failed</h2>
                <p className="text-white/90 text-sm">{errorMessage}</p>
              </div>

              <div className="p-6">
                <button
                  onClick={() => {
                    setShowErrorModal(false)
                    setErrorMessage('')
                  }}
                  className="w-full bg-black text-white py-4 font-bold uppercase tracking-wider hover:bg-black/90 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
