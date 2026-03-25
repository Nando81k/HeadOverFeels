'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/context'
import { TIER_HIERARCHY } from '@/lib/loyalty/tier-progress'
import { Sparkle, Gift, Heart, Truck, Lightning, Users, Download, Package, CircleNotch, Lock, CheckCircle, Warning, TrendUp, Medal, X, Copy, Check, Confetti, Star, ArrowRight } from '@phosphor-icons/react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { EarlyAccessDrops } from '@/components/loyalty/EarlyAccessDrops'
import { buildTierGradient, hexToRgba, resolveTierTheme } from '@/lib/loyalty/tier-theme'

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

interface RewardsHubSectionProps {
  embedded?: boolean
  openTierModalSignal?: number
}

interface LoyaltyTierDefinition {
  id: string
  name: string
  slug: string
  minAnnualPoints: number
  pointMultiplier: number
  freeShipping: boolean
  earlyDropAccess: boolean
  perks: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
  sortOrder?: number | null
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

const FALLBACK_TIER_BENEFITS: Record<string, string[]> = {
  newcomer: ['Earn 1x points on purchases', 'Birthday surprise', 'Early sale access'],
  friend: ['Earn 1.25x points on purchases', 'Birthday bonus points', 'Early access to sales', 'Free shipping on orders $75+'],
  bestie: ['Earn 1.5x points on purchases', 'FREE shipping on all orders', '24-hour early access to sales', 'Exclusive Bestie-only products'],
  soulmate: ['Earn 2x points on purchases', 'FREE express shipping', '48-hour early access to limited drops', 'Annual surprise gift', 'Priority support'],
  head: ['Earn 1x points on purchases'],
  heart: ['Earn 1.25x points on purchases'],
  mind: ['Earn 1.5x points on purchases'],
}

const PERK_FLAG_LABELS: Record<string, string> = {
  careBox: 'Annual care box',
  birthdayGift: 'Birthday gift',
  exclusiveEvents: 'Exclusive events access',
  personalStylist: 'Personal stylist session',
  customItems: 'Custom item personalization',
  prioritySupport: 'Priority support',
}

const FALLBACK_TIER_DEFINITIONS: LoyaltyTierDefinition[] = TIER_HIERARCHY.map((tier, index) => ({
  id: `fallback-${tier.slug}`,
  name: tier.name,
  slug: tier.slug,
  minAnnualPoints: tier.minAnnualPoints,
  pointMultiplier: tier.pointMultiplier,
  freeShipping: false,
  earlyDropAccess: false,
  perks: JSON.stringify(FALLBACK_TIER_BENEFITS[tier.slug] || []),
  sortOrder: index,
}))

function formatMultiplier(multiplier: number): string {
  if (!Number.isFinite(multiplier)) return '1'
  if (Number.isInteger(multiplier)) return String(multiplier)
  return multiplier.toFixed(2).replace(/\.?0+$/, '')
}

function humanizePerkKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim()
}

function parseTierPerks(rawPerks: string | null): string[] {
  if (!rawPerks) return []

  let parsed: unknown = rawPerks
  if (typeof rawPerks === 'string') {
    try {
      parsed = JSON.parse(rawPerks)
    } catch {
      return rawPerks
        .split('\n')
        .map((value) => value.trim())
        .filter(Boolean)
    }
  }

  if (Array.isArray(parsed)) {
    return parsed
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (parsed && typeof parsed === 'object') {
    const entries = Object.entries(parsed as Record<string, unknown>)
    return entries.flatMap(([key, value]) => {
      if (typeof value === 'boolean') {
        return value ? [PERK_FLAG_LABELS[key] || humanizePerkKey(key)] : []
      }
      if (typeof value === 'string' && value.trim().length > 0) {
        return [value.trim()]
      }
      return []
    })
  }

  return []
}

function buildTierBenefits(tier: LoyaltyTierDefinition): string[] {
  const benefits = new Set<string>()
  benefits.add(`Earn ${formatMultiplier(tier.pointMultiplier)}x points on purchases`)

  if (tier.freeShipping) {
    benefits.add('Free shipping benefit')
  }
  if (tier.earlyDropAccess) {
    benefits.add('Early drop access')
  }

  for (const perk of parseTierPerks(tier.perks)) {
    benefits.add(perk)
  }

  if (benefits.size === 0 || benefits.size === 1) {
    for (const fallback of FALLBACK_TIER_BENEFITS[tier.slug] || []) {
      benefits.add(fallback)
    }
  }

  return Array.from(benefits)
}

function normalizeTierDefinitions(payload: unknown): LoyaltyTierDefinition[] {
  if (!Array.isArray(payload)) return []

  const normalized = payload.flatMap((rawTier): LoyaltyTierDefinition[] => {
    if (!rawTier || typeof rawTier !== 'object') return []
    const tier = rawTier as Record<string, unknown>

    const slug = typeof tier.slug === 'string' ? tier.slug.toLowerCase() : ''
    if (!slug) return []

    const minAnnualPoints = Number(tier.minAnnualPoints)
    const pointMultiplier = Number(tier.pointMultiplier)

    return [{
      id: typeof tier.id === 'string' ? tier.id : `tier-${slug}`,
      name: typeof tier.name === 'string' ? tier.name : slug,
      slug,
      minAnnualPoints: Number.isFinite(minAnnualPoints) ? minAnnualPoints : 0,
      pointMultiplier: Number.isFinite(pointMultiplier) ? pointMultiplier : 1,
      freeShipping: Boolean(tier.freeShipping),
      earlyDropAccess: Boolean(tier.earlyDropAccess),
      perks: typeof tier.perks === 'string' ? tier.perks : null,
      primaryColor: typeof tier.primaryColor === 'string' ? tier.primaryColor : null,
      secondaryColor: typeof tier.secondaryColor === 'string' ? tier.secondaryColor : null,
      sortOrder: typeof tier.sortOrder === 'number' ? tier.sortOrder : null,
    }]
  })

  return normalized.sort((a, b) => {
    const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER
    const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER
    if (orderA !== orderB) return orderA - orderB
    if (a.minAnnualPoints !== b.minAnnualPoints) return a.minAnnualPoints - b.minAnnualPoints
    return a.name.localeCompare(b.name)
  })
}

export function RewardsHubSection({ embedded = false, openTierModalSignal = 0 }: RewardsHubSectionProps) {
  const { user, loading: authLoading, refreshUser } = useAuth()
  const [rewards, setRewards] = useState<Reward[]>([])
  const [customerPoints, setCustomerPoints] = useState(0)
  const [tierDefinitions, setTierDefinitions] = useState<LoyaltyTierDefinition[]>(FALLBACK_TIER_DEFINITIONS)
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
    fetchRewards()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory])

  useEffect(() => {
    if (openTierModalSignal > 0) {
      setShowTierModal(true)
    }
  }, [openTierModalSignal])

  useEffect(() => {
    const controller = new AbortController()

    const fetchTierDefinitions = async () => {
      try {
        const response = await fetch('/api/loyalty/tiers', {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) return

        const data = await response.json()
        const normalizedTiers = normalizeTierDefinitions(data)
        if (normalizedTiers.length > 0) {
          setTierDefinitions(normalizedTiers)
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        console.error('Failed to fetch loyalty tiers:', error)
      }
    }

    fetchTierDefinitions()

    return () => controller.abort()
  }, [])

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

  if (authLoading) {
    return (
      <div className="py-16 flex items-center justify-center">
        <CircleNotch size={32} weight="bold" className="animate-spin text-black" />
      </div>
    )
  }
  if (!user) return null

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

  const annualPointsEarned = user.annualPointsEarned ?? 0
  const currentTierSlug = user.loyaltyTier?.slug?.toLowerCase() || ''
  const currentTierIndexFromSlug = currentTierSlug
    ? tierDefinitions.findIndex((tier) => tier.slug === currentTierSlug)
    : -1
  const inferredTierIndex = tierDefinitions.reduce((highestIndex, tier, index) => {
    return annualPointsEarned >= tier.minAnnualPoints ? index : highestIndex
  }, 0)
  const currentTierIndex = currentTierIndexFromSlug >= 0 ? currentTierIndexFromSlug : inferredTierIndex

  return (
    <section
      id="rewards"
      className={embedded ? 'bg-white' : 'border-t border-black/10 bg-white'}
    >

      {/* Hero Section - Editorial Style */}
      <section className={`relative bg-white ${embedded ? 'pt-6 md:pt-8 lg:pt-10 pb-2 md:pb-6' : 'pt-10 md:pt-12 lg:pt-14 pb-4 md:pb-8'}`}>
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-12">
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-5xl lg:text-7xl font-black text-black tracking-tight mb-2 md:mb-4">
              Rewards
            </h2>
            <p className="text-sm md:text-xl lg:text-2xl text-black/70 leading-relaxed">
              Turn your Care Points into exclusive perks and discounts.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className={`max-w-7xl mx-auto px-4 md:px-6 lg:px-12 ${embedded ? 'py-4 md:py-6 lg:py-8' : 'py-4 md:py-8 lg:py-12'}`}>
        {/* Early Access Drops Section */}
        <div className="mb-8 md:mb-12">
          <EarlyAccessDrops 
            currentPoints={customerPoints} 
            onPointsChange={(newPoints) => {
              setCustomerPoints(newPoints)
              fetchRewards() // Refresh rewards to update points display
            }} 
          />
        </div>

        {/* Category Filter - Matching Products Page Style */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 md:mb-8 pb-4 md:pb-6 border-b border-black/5 gap-2">
          {/* Categories - Wrap on mobile */}
          <div className="flex flex-wrap gap-1.5 md:gap-2">
            {categories.map((category) => {
              const Icon = category.icon
              const isSelected = selectedCategory === category.value
              return (
                <button
                  key={category.value}
                  onClick={() => setSelectedCategory(category.value)}
                  className={`flex items-center gap-1.5 md:gap-2 px-3 py-2 md:px-5 md:py-3 text-[10px] md:text-sm font-bold transition-all uppercase tracking-wider ${
                    isSelected
                      ? 'bg-black text-white shadow-lg'
                      : 'bg-white text-black/70 border border-black/10 hover:border-black/30 hover:text-black'
                  }`}
                >
                  <Icon size={14} weight={isSelected ? 'fill' : 'bold'} className="md:hidden shrink-0" />
                  <Icon size={18} weight={isSelected ? 'fill' : 'bold'} className="hidden md:block shrink-0" />
                  <span className="hidden sm:inline">{category.label}</span>
                  <span className="sm:hidden">{category.label.split(' ')[0]}</span>
                </button>
              )
            })}
          </div>

          {/* Results Count */}
          <span className="text-xs md:text-sm text-black/50 font-medium tracking-wide hidden lg:block">
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
          <div className="text-center py-12 md:py-20 px-4 md:px-6">
            <div className="max-w-md mx-auto">
              <div className="w-14 h-14 md:w-20 md:h-20 mx-auto mb-4 md:mb-6 bg-black/5 flex items-center justify-center">
                <Sparkle size={28} weight="fill" className="text-black/20 md:hidden" />
                <Sparkle size={40} weight="fill" className="text-black/20 hidden md:block" />
              </div>
              <h3 className="text-xl md:text-2xl font-black text-black mb-2 md:mb-3">No rewards found</h3>
              <p className="text-sm md:text-base text-black/70 mb-4 md:mb-6">Try selecting a different category.</p>
              <button
                onClick={() => setSelectedCategory('all')}
                className="inline-flex items-center gap-2 px-4 py-2.5 md:px-6 md:py-3 bg-black text-white font-bold text-xs md:text-sm uppercase tracking-wider hover:bg-black/90 transition-all"
              >
                View All Rewards
                <ArrowRight size={14} weight="bold" className="md:hidden" />
                <ArrowRight size={16} weight="bold" className="hidden md:block" />
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6 lg:gap-8">
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
                  className={`group bg-white border border-black/10 p-4 md:p-6 transition-all duration-300 hover:shadow-xl hover:border-black/20 hover:-translate-y-1 overflow-hidden ${
                    !canRedeem ? 'opacity-60' : ''
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4 md:mb-6">
                    <div className={`w-10 h-10 md:w-14 md:h-14 ${colors.iconBg} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 md:w-7 md:h-7 ${colors.iconColor}`} weight="fill" />
                    </div>
                    <span className={`px-2 py-1 md:px-3 md:py-1.5 text-[9px] md:text-xs font-bold uppercase tracking-wider ${colors.badge}`}>
                      {rewardTypeLabels[reward.rewardType as keyof typeof rewardTypeLabels]}
                    </span>
                  </div>

                  {/* Content */}
                  <h3 className="text-base md:text-xl font-black text-black mb-1 md:mb-2 tracking-tight line-clamp-2">
                    {reward.name}
                  </h3>
                  <p className="text-xs md:text-sm text-black/60 mb-4 md:mb-6 leading-relaxed line-clamp-2 min-h-8 md:min-h-12">
                    {reward.description}
                  </p>

                  {/* Points Cost */}
                  <div className={`flex items-center gap-2 md:gap-3 mb-4 md:mb-6 p-3 md:p-4 ${colors.bg} border ${colors.border}`}>
                    <Sparkle size={16} weight="fill" className={`${colors.iconColor} md:hidden`} />
                    <Sparkle size={20} weight="fill" className={`${colors.iconColor} hidden md:block`} />
                    <div>
                      <span className={`text-xl md:text-3xl font-black ${colors.iconColor}`}>
                        {reward.pointsCost.toLocaleString()}
                      </span>
                      <span className="text-xs md:text-sm text-black/50 ml-1 md:ml-2">pts</span>
                    </div>
                  </div>

                  {/* Status Indicators */}
                  {!reward.meetsTierRequirement && reward.minTierRequired && (
                    <div className="flex items-center gap-1.5 md:gap-2 mb-3 md:mb-4 text-xs md:text-sm text-amber-700 bg-amber-50 border border-amber-200 p-2 md:p-3">
                      <Lock size={14} weight="bold" className="shrink-0" />
                      <span>Requires <span className="font-bold">{reward.minTierRequired}</span></span>
                    </div>
                  )}

                  {!reward.canAfford && reward.meetsTierRequirement && (
                    <div className="flex items-center gap-1.5 md:gap-2 mb-3 md:mb-4 text-xs md:text-sm text-rose-700 bg-rose-50 border border-rose-200 p-2 md:p-3">
                      <Warning size={14} weight="bold" className="shrink-0" />
                      <span>Need <span className="font-bold">{(reward.pointsCost - customerPoints).toLocaleString()}</span> more</span>
                    </div>
                  )}

                  {canRedeem && (
                    <div className="flex items-center gap-1.5 md:gap-2 mb-3 md:mb-4 text-xs md:text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 p-2 md:p-3">
                      <CheckCircle size={14} weight="fill" className="shrink-0" />
                      <span className="font-bold">Available!</span>
                    </div>
                  )}

                  {/* Redeem Button */}
                  <button
                    onClick={() => handleRedeem(reward.id)}
                    disabled={!canRedeem || redeemingRewardId === reward.id}
                    className={`w-full py-3 md:py-4 font-bold uppercase tracking-wider text-xs md:text-sm transition-all flex items-center justify-center gap-2 ${
                      canRedeem
                        ? 'bg-black text-white hover:bg-black/90 shadow-lg hover:shadow-xl'
                        : 'bg-black/10 text-black/40 cursor-not-allowed'
                    }`}
                  >
                    {redeemingRewardId === reward.id ? (
                      <>
                        <CircleNotch size={16} weight="bold" className="animate-spin" />
                        <span className="hidden sm:inline">Redeeming...</span>
                        <span className="sm:hidden">...</span>
                      </>
                    ) : canRedeem ? (
                      <>
                        <span className="hidden sm:inline">Redeem Now</span>
                        <span className="sm:hidden">Redeem</span>
                        <ArrowRight size={14} weight="bold" />
                      </>
                    ) : (
                      <span className="hidden sm:inline">Cannot Redeem</span>
                    )}
                    {!canRedeem && redeemingRewardId !== reward.id && (
                      <span className="sm:hidden">Locked</span>
                    )}
                  </button>

                  {/* Redemption Count */}
                  {reward._count.redemptions > 0 && (
                    <p className="text-[10px] md:text-xs text-black/40 text-center mt-3 md:mt-4 font-medium">
                      <Users size={10} weight="bold" className="inline mr-1" />
                      {reward._count.redemptions.toLocaleString()} redeemed
                    </p>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}

        {/* How to Earn Section */}
        <section className="mt-12 md:mt-20 pt-10 md:pt-16 border-t border-black/5">
          <div className="text-center mb-8 md:mb-12">
            <span className="text-[9px] md:text-[10px] font-medium tracking-[0.3em] text-black/40 uppercase block mb-2 md:mb-4">
              Maximize Your Rewards
            </span>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-black tracking-tight">
              How to Earn More
            </h2>
          </div>

          <div className="grid grid-cols-3 gap-3 md:grid-cols-3 md:gap-8">
            <div className="text-center">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-black mx-auto mb-3 md:mb-6 flex items-center justify-center">
                <Gift size={20} weight="fill" className="text-white md:hidden" />
                <Gift size={28} weight="fill" className="text-white hidden md:block" />
              </div>
              <h3 className="text-xs md:text-lg font-black text-black mb-1 md:mb-2">Purchases</h3>
              <p className="text-[10px] md:text-base text-black/60 hidden md:block">
                Earn 1 point per $1 spent, multiplied by your current tier level.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-black mx-auto mb-3 md:mb-6 flex items-center justify-center">
                <Users size={20} weight="fill" className="text-white md:hidden" />
                <Users size={28} weight="fill" className="text-white hidden md:block" />
              </div>
              <h3 className="text-xs md:text-lg font-black text-black mb-1 md:mb-2">Referrals</h3>
              <p className="text-[10px] md:text-base text-black/60 hidden md:block">
                Get 250 bonus points when a friend makes their first purchase.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-black mx-auto mb-3 md:mb-6 flex items-center justify-center">
                <Sparkle size={20} weight="fill" className="text-white md:hidden" />
                <Sparkle size={28} weight="fill" className="text-white hidden md:block" />
              </div>
              <h3 className="text-xs md:text-lg font-black text-black mb-1 md:mb-2">Events</h3>
              <p className="text-[10px] md:text-base text-black/60 hidden md:block">
                Earn bonus points during your birthday and special promotions.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-8 md:mt-12">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 md:gap-3 px-5 py-3 md:px-8 md:py-4 bg-black text-white font-bold text-xs md:text-sm uppercase tracking-wider hover:bg-black/90 transition-all shadow-lg"
            >
              Start Shopping
              <ArrowRight size={14} weight="bold" className="md:hidden" />
              <ArrowRight size={18} weight="bold" className="hidden md:block" />
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
              <div className="sticky top-0 bg-white border-b border-black/5 px-4 md:px-6 py-3 md:py-5 flex items-center justify-between z-10">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-9 h-9 md:w-12 md:h-12 bg-black flex items-center justify-center">
                    <Medal size={18} weight="fill" className="text-white md:hidden" />
                    <Medal size={24} weight="fill" className="text-white hidden md:block" />
                  </div>
                  <div>
                    <h2 className="text-lg md:text-2xl font-black text-black tracking-tight">Loyalty Tiers</h2>
                    <p className="text-xs md:text-sm text-black/50 hidden md:block">Unlock exclusive benefits as you shop</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTierModal(false)}
                  className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center hover:bg-black/5 transition-colors"
                >
                  <X size={18} weight="bold" className="text-black/60" />
                </button>
              </div>

              {/* Tier Cards */}
              <div className="p-4 md:p-6">
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
                  {tierDefinitions.map((tier, index) => {
                    const isCurrentTier = index === currentTierIndex
                    const isCompletedTier = index < currentTierIndex
                    const isNextTier = index === currentTierIndex + 1
                    const tierTheme = resolveTierTheme(tier.slug, {
                      primaryColor: tier.primaryColor || undefined,
                      secondaryColor: tier.secondaryColor || undefined,
                    })
                    const tierBenefits = buildTierBenefits(tier)
                    const previousTierMinPoints = tierDefinitions[index - 1]?.minAnnualPoints ?? 0
                    const pointsNeededForTier = Math.max(0, tier.minAnnualPoints - annualPointsEarned)
                    const progressRange = Math.max(1, tier.minAnnualPoints - previousTierMinPoints)
                    const tierProgress = Math.min(
                      100,
                      Math.max(0, ((annualPointsEarned - previousTierMinPoints) / progressRange) * 100)
                    )

                    return (
                      <div
                        key={tier.slug}
                        className={`p-3 md:p-5 transition-all flex flex-col h-full relative overflow-hidden ${
                          isCurrentTier
                            ? 'text-white shadow-xl'
                            : 'bg-white border hover:shadow-lg'
                        }`}
                        style={
                          isCurrentTier
                            ? {
                                backgroundImage: buildTierGradient(tierTheme, 135),
                                boxShadow: `0 18px 36px -22px ${hexToRgba(tierTheme.secondaryColor, 0.7)}`,
                              }
                            : { borderColor: hexToRgba(tierTheme.primaryColor, 0.22) }
                        }
                      >
                        {isCurrentTier && (
                          <div className="absolute top-0 right-0 w-16 md:w-20 h-16 md:h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-xl" />
                        )}

                        <div className="relative">
                          <div className="mb-2 md:mb-4">
                            <div
                              className="w-9 h-9 md:w-12 md:h-12 flex items-center justify-center mb-2 md:mb-3"
                              style={{
                                backgroundColor: isCurrentTier
                                  ? 'rgba(255, 255, 255, 0.2)'
                                  : hexToRgba(tierTheme.primaryColor, 0.14),
                              }}
                            >
                              <Medal className={`w-4 h-4 md:w-6 md:h-6 ${isCurrentTier ? 'text-white' : 'text-black/60'}`} weight="fill" />
                            </div>
                            <div className="flex items-center gap-1 md:gap-2 mb-0.5 md:mb-1 flex-wrap">
                              <h3 className={`text-sm md:text-xl font-black ${isCurrentTier ? 'text-white' : 'text-black'}`}>
                                {tier.name}
                              </h3>
                              {isCurrentTier && (
                                <span className="px-1.5 py-0.5 bg-white/20 text-[8px] md:text-[10px] font-bold uppercase tracking-wide">
                                  Now
                                </span>
                              )}
                              {isCompletedTier && (
                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[8px] md:text-[10px] font-bold uppercase tracking-wide">
                                  ✓
                                </span>
                              )}
                            </div>
                            <p className={`text-[10px] md:text-xs ${isCurrentTier ? 'text-white/70' : 'text-black/50'}`}>
                              {tier.minAnnualPoints === 0 ? 'Start' : `${tier.minAnnualPoints.toLocaleString()}+ pts`}
                            </p>
                          </div>

                          <div
                            className="inline-flex items-center gap-1 md:gap-1.5 px-2 py-1 md:px-3 md:py-1.5 mb-2 md:mb-4"
                            style={{
                              backgroundColor: isCurrentTier
                                ? 'rgba(255, 255, 255, 0.2)'
                                : hexToRgba(tierTheme.primaryColor, 0.14),
                            }}
                          >
                            <Sparkle size={10} weight="fill" className={`${isCurrentTier ? 'text-white' : 'text-black/60'} md:hidden`} />
                            <Sparkle size={14} weight="fill" className={`${isCurrentTier ? 'text-white' : 'text-black/60'} hidden md:block`} />
                            <span className={`text-[10px] md:text-sm font-black ${isCurrentTier ? 'text-white' : 'text-black'}`}>
                              {formatMultiplier(tier.pointMultiplier)}x
                            </span>
                          </div>

                          <div className="space-y-1 md:space-y-2 grow">
                            {tierBenefits.slice(0, 3).map((benefit, benefitIndex) => (
                              <div key={benefitIndex} className={`flex items-start gap-1.5 md:gap-2 text-[10px] md:text-xs ${isCurrentTier ? 'text-white/80' : 'text-black/60'}`}>
                                <CheckCircle size={12} weight="fill" className={`${isCurrentTier ? 'text-white' : 'text-emerald-500'} shrink-0 mt-0.5`} />
                                <span className="line-clamp-2">{benefit}</span>
                              </div>
                            ))}
                            {tierBenefits.length > 3 && (
                              <p className={`text-[9px] md:text-[10px] ${isCurrentTier ? 'text-white/60' : 'text-black/40'}`}>
                                +{tierBenefits.length - 3} more
                              </p>
                            )}
                          </div>

                          {isNextTier && user?.loyaltyTier && (
                            <div className="mt-2 md:mt-4 pt-2 md:pt-4 border-t border-black/10">
                              <div className="flex items-center justify-between text-[10px] md:text-xs mb-1 md:mb-2">
                                <span className="text-black/50 flex items-center gap-1">
                                  <TrendUp size={10} weight="bold" />
                                  Progress
                                </span>
                                <span className="text-black font-bold">
                                  {pointsNeededForTier.toLocaleString()}
                                </span>
                              </div>
                              <div className="h-1.5 md:h-2 bg-black/10 overflow-hidden">
                                <div
                                  className="h-full transition-all duration-500"
                                  style={{
                                    width: `${tierProgress}%`,
                                    backgroundImage: buildTierGradient(tierTheme, 90),
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
              <div className="sticky bottom-0 bg-white border-t border-black/5 px-4 md:px-6 py-3 md:py-4">
                <button
                  onClick={() => setShowTierModal(false)}
                  className="w-full bg-black text-white py-3 md:py-4 font-bold text-xs md:text-sm uppercase tracking-wider hover:bg-black/90 transition-colors"
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
              <div className="bg-linear-to-br from-emerald-500 to-emerald-600 p-5 md:p-8 text-center text-white relative overflow-hidden">
                <div className="absolute inset-0 opacity-20">
                  <Confetti size={200} weight="fill" className="absolute -top-10 -left-10 rotate-12 hidden md:block" />
                  <Confetti size={150} weight="fill" className="absolute -bottom-5 -right-5 -rotate-12 hidden md:block" />
                </div>
                <div className="relative">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-white/20 flex items-center justify-center mx-auto mb-3 md:mb-4">
                    <CheckCircle size={28} weight="fill" className="text-white md:hidden" />
                    <CheckCircle size={40} weight="fill" className="text-white hidden md:block" />
                  </div>
                  <h2 className="text-xl md:text-2xl font-black mb-1 md:mb-2">Reward Redeemed!</h2>
                  <p className="text-white/90 text-sm md:text-base line-clamp-1">
                    You&apos;ve redeemed {redemptionResult.reward?.name}
                  </p>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 md:p-6">
                <div className="flex items-center justify-between py-2 md:py-3 border-b border-black/10">
                  <span className="text-xs md:text-sm text-black/60">Points Spent</span>
                  <span className="font-bold text-black text-sm md:text-base">
                    -{redemptionResult.redemption?.pointsSpent.toLocaleString()} pts
                  </span>
                </div>

                <div className="flex items-center justify-between py-2 md:py-3 border-b border-black/10">
                  <span className="text-xs md:text-sm text-black/60">New Balance</span>
                  <span className="font-bold text-black text-sm md:text-base">
                    {redemptionResult.newPointsBalance?.toLocaleString()} pts
                  </span>
                </div>

                {redemptionResult.redemption?.couponCode && (
                  <div className="mt-3 md:mt-4 p-3 md:p-4 bg-amber-50 border border-amber-200">
                    <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                      <Gift size={14} weight="fill" className="text-amber-600 md:hidden" />
                      <Gift size={18} weight="fill" className="text-amber-600 hidden md:block" />
                      <span className="text-xs md:text-sm font-bold text-amber-900">Coupon Code</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white px-3 py-2 md:px-4 md:py-3 font-mono text-sm md:text-lg font-black text-center tracking-wider border border-amber-200">
                        {redemptionResult.redemption.couponCode}
                      </code>
                      <button
                        onClick={() => copyToClipboard(redemptionResult.redemption?.couponCode || '')}
                        className="p-2 md:p-3 bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                        title="Copy to clipboard"
                      >
                        {copiedCode ? <Check size={16} weight="bold" className="md:hidden" /> : <Copy size={16} weight="bold" className="md:hidden" />}
                        {copiedCode ? <Check size={20} weight="bold" className="hidden md:block" /> : <Copy size={20} weight="bold" className="hidden md:block" />}
                      </button>
                    </div>
                    <p className="text-[10px] md:text-xs text-amber-700 mt-2 text-center">
                      Use at checkout
                    </p>
                  </div>
                )}

                {redemptionResult.reward?.value && (
                  <div className="mt-3 md:mt-4 flex items-center gap-2 text-xs md:text-sm text-black/60">
                    <Star size={14} weight="fill" className="text-amber-500" />
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
              <div className="p-4 md:p-6 pt-0 space-y-2 md:space-y-3">
                <Link
                  href="/products"
                  className="block w-full bg-black text-white py-3 md:py-4 font-bold text-xs md:text-sm uppercase tracking-wider hover:bg-black/90 transition-colors text-center"
                >
                  Shop Now
                </Link>
                <button
                  onClick={() => {
                    setShowSuccessModal(false)
                    setRedemptionResult(null)
                    setCopiedCode(false)
                  }}
                  className="w-full bg-white text-black py-3 md:py-4 font-bold text-xs md:text-sm uppercase tracking-wider border border-black/10 hover:bg-black/5 transition-colors"
                >
                  Continue
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
              <div className="bg-linear-to-br from-rose-500 to-rose-600 p-4 md:p-6 text-center text-white">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-white/20 flex items-center justify-center mx-auto mb-2 md:mb-3">
                  <Warning size={24} weight="fill" className="text-white md:hidden" />
                  <Warning size={32} weight="fill" className="text-white hidden md:block" />
                </div>
                <h2 className="text-lg md:text-xl font-black mb-1">Failed</h2>
                <p className="text-white/90 text-xs md:text-sm">{errorMessage}</p>
              </div>

              <div className="p-4 md:p-6">
                <button
                  onClick={() => {
                    setShowErrorModal(false)
                    setErrorMessage('')
                  }}
                  className="w-full bg-black text-white py-3 md:py-4 font-bold text-xs md:text-sm uppercase tracking-wider hover:bg-black/90 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
