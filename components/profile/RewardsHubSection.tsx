'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth/context'
import { TIER_HIERARCHY } from '@/lib/loyalty/tier-progress'
import { Sparkle, Gift, Heart, Truck, Lightning, Users, Download, Package, CircleNotch, Lock, CheckCircle, Warning, TrendUp, Medal, X, Copy, Check, Confetti, Star, ArrowRight, ClockCounterClockwise } from '@phosphor-icons/react'
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

interface MyRedemption {
  id: string
  rewardName: string
  rewardType: string
  pointsSpent: number
  status: string
  couponCode: string | null
  usedAt: string | null
  createdAt: string
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

  // My Redemptions state — eagerly loaded now that we render unified
  const [myRedemptions, setMyRedemptions] = useState<MyRedemption[]>([])
  const [redemptionsLoading, setRedemptionsLoading] = useState(false)
  const [showAllRedemptions, setShowAllRedemptions] = useState(false)

  // Redemption modal state
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

  // Eagerly load redemptions on mount so the unified loyalty page shows them inline
  useEffect(() => {
    fetchRedemptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const fetchRedemptions = useCallback(async () => {
    setRedemptionsLoading(true)
    try {
      const res = await fetch('/api/loyalty/redemptions?limit=50')
      if (res.ok) {
        const data = await res.json()
        setMyRedemptions(data.data || [])
      }
    } catch { /* silent */ } finally {
      setRedemptionsLoading(false)
    }
  }, [])

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
        fetchRedemptions()
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

  const redemptionStatusConfig: Record<string, { label: string; bg: string; text: string }> = {
    PENDING: { label: 'Pending', bg: 'bg-amber-100', text: 'text-amber-800' },
    FULFILLED: { label: 'Fulfilled', bg: 'bg-emerald-100', text: 'text-emerald-800' },
    USED: { label: 'Used', bg: 'bg-blue-100', text: 'text-blue-800' },
    CANCELLED: { label: 'Cancelled', bg: 'bg-gray-100', text: 'text-gray-500' },
    EXPIRED: { label: 'Expired', bg: 'bg-red-100', text: 'text-red-700' },
  }

  return (
    <section
      id="rewards"
      className={embedded ? 'bg-white' : 'border-t border-black/10 bg-white'}
    >

      {/* Loyalty Tier Hero — the "expanded" form of the Overview card (shared layoutId) */}
      {(() => {
        const currentTier = tierDefinitions[currentTierIndex]
        const nextTier = tierDefinitions[currentTierIndex + 1]
        const progressPct = nextTier
          ? Math.min(100, Math.max(0, (annualPointsEarned / Math.max(1, nextTier.minAnnualPoints)) * 100))
          : 100
        const pendingFulfillCount = myRedemptions.filter((r) => r.status === 'PENDING' && !r.couponCode).length
        const tierFill = currentTier?.primaryColor || '#ffffff'

        if (!currentTier) return null

        return (
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-12 pt-6 md:pt-8">
            <motion.div
              layoutId="loyalty-tier-hero"
              className="rounded-2xl bg-black text-white overflow-hidden relative"
              transition={{ layout: { duration: 0.4, ease: [0.32, 0.72, 0, 1] } }}
            >
              <motion.div layoutId="loyalty-tier-hero-glow" className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-12 w-48 h-48 rounded-full bg-white/5 blur-2xl pointer-events-none" />

              <div className="relative p-6 md:p-8 lg:p-10">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 md:gap-8 mb-6 md:mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                      <Medal size={28} weight="fill" className="text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] text-white/60 mb-1">
                        Member Loyalty
                      </p>
                      <h1 className="text-2xl md:text-4xl font-black tracking-tight leading-none">
                        {currentTier.name}
                      </h1>
                      <p className="text-xs md:text-sm text-white/70 mt-1.5">
                        Earning {formatMultiplier(currentTier.pointMultiplier)}× points on every order
                      </p>
                    </div>
                  </div>

                  <div className="md:text-right">
                    <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] text-white/60 mb-1">
                      Available
                    </p>
                    <p className="text-3xl md:text-5xl font-black leading-none tabular-nums">
                      {customerPoints.toLocaleString()}
                      <span className="text-sm md:text-base text-white/55 ml-1.5 font-medium">pts</span>
                    </p>
                  </div>
                </div>

                {/* Tier progress */}
                <div className="mb-5 md:mb-6">
                  <div className="flex items-center justify-between text-[11px] md:text-xs text-white/70 font-semibold mb-2.5">
                    <span>
                      {nextTier ? (
                        <>
                          <span className="font-black text-white">
                            {Math.max(0, nextTier.minAnnualPoints - annualPointsEarned).toLocaleString()}
                          </span>{' '}
                          pts to <span className="font-black text-white">{nextTier.name}</span>
                        </>
                      ) : (
                        <span className="font-black text-white">Top tier reached</span>
                      )}
                    </span>
                    <span className="text-white/55 tabular-nums">{Math.round(progressPct)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/15 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${progressPct}%`, backgroundColor: tierFill }}
                    />
                  </div>
                </div>

                {/* Action chips */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTierModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full bg-white/15 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-white/25 transition-colors"
                  >
                    <TrendUp size={12} weight="bold" />
                    View tiers
                  </button>
                  {pendingFulfillCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          document.getElementById('redemptions-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full bg-amber-400 text-amber-950 text-[11px] font-bold uppercase tracking-wider hover:bg-amber-300 transition-colors"
                    >
                      <ClockCounterClockwise size={12} weight="bold" />
                      {pendingFulfillCount} processing
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )
      })()}

      {/* Your Redemptions — only renders when redemptions exist */}
      {!redemptionsLoading && myRedemptions.length > 0 && (
        <div
          id="redemptions-anchor"
          className={`max-w-7xl mx-auto px-4 md:px-6 lg:px-12 ${embedded ? 'pt-6 md:pt-8' : 'pt-6 md:pt-10'}`}
        >
          <div className="flex items-end justify-between mb-4 md:mb-5">
            <div>
              <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] text-black/40 mb-1">
                Your activity
              </p>
              <h2 className="text-xl md:text-2xl font-black text-black tracking-tight">
                Recent redemptions
              </h2>
            </div>
            {myRedemptions.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllRedemptions((v) => !v)}
                className="text-xs font-bold uppercase tracking-wider text-black/55 hover:text-black transition-colors flex items-center gap-1"
              >
                {showAllRedemptions ? 'Show less' : `Show all ${myRedemptions.length}`}
                <ArrowRight size={12} weight="bold" />
              </button>
            )}
          </div>

          <>
              {/* Summary chips */}
              {(() => {
                const pendingFulfillment = myRedemptions.filter((r) => r.status === 'PENDING' && !r.couponCode).length
                const pendingCoupons = myRedemptions.filter((r) => r.status === 'PENDING' && r.couponCode).length
                const totalSpent = myRedemptions.reduce((sum, r) => sum + r.pointsSpent, 0)
                return (
                  <div className="grid grid-cols-3 gap-2 md:gap-3 mb-5 md:mb-6">
                    <div className="rounded-2xl bg-black/3 border border-black/5 p-3 md:p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-black/45 mb-1">Total</p>
                      <p className="text-lg md:text-2xl font-black text-black leading-none">{myRedemptions.length}</p>
                    </div>
                    <div className={`rounded-2xl border p-3 md:p-4 ${pendingFulfillment > 0 ? 'bg-amber-50 border-amber-200' : 'bg-black/3 border-black/5'}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${pendingFulfillment > 0 ? 'text-amber-700' : 'text-black/45'}`}>Processing</p>
                      <p className={`text-lg md:text-2xl font-black leading-none ${pendingFulfillment > 0 ? 'text-amber-800' : 'text-black'}`}>{pendingFulfillment}</p>
                    </div>
                    <div className="rounded-2xl bg-black/3 border border-black/5 p-3 md:p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-black/45 mb-1">Pts Spent</p>
                      <p className="text-lg md:text-2xl font-black text-black leading-none">{totalSpent.toLocaleString()}</p>
                    </div>
                    <div className="hidden md:block" />
                    <div className="hidden md:block" />
                    {pendingCoupons > 0 && (
                      <div className="col-span-3 md:col-span-1 rounded-2xl bg-blue-50 border border-blue-200 p-3 md:p-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700 mb-1">Active Coupons</p>
                        <p className="text-lg md:text-2xl font-black text-blue-900 leading-none">{pendingCoupons}</p>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Redemption list */}
              <div className="space-y-2.5 md:space-y-3">
                {(showAllRedemptions ? myRedemptions : myRedemptions.slice(0, 5)).map((r) => {
                  const Icon = rewardTypeIcons[r.rewardType as keyof typeof rewardTypeIcons] || Gift
                  const statusConfig = redemptionStatusConfig[r.status] || redemptionStatusConfig.PENDING
                  const isPendingFulfillment = r.status === 'PENDING' && !r.couponCode
                  const hasActiveCoupon = r.status === 'PENDING' && r.couponCode

                  return (
                    <div
                      key={r.id}
                      className={`flex items-start gap-3 md:gap-4 p-3.5 md:p-4 rounded-2xl border transition-all ${
                        isPendingFulfillment
                          ? 'border-amber-200 bg-amber-50'
                          : hasActiveCoupon
                            ? 'border-blue-200 bg-blue-50'
                            : 'border-black/8 bg-white hover:border-black/15'
                      }`}
                    >
                      <div className={`w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center shrink-0 ${
                        isPendingFulfillment ? 'bg-amber-100' : hasActiveCoupon ? 'bg-blue-100' : 'bg-black/5'
                      }`}>
                        <Icon size={18} weight="fill" className={
                          isPendingFulfillment ? 'text-amber-600' : hasActiveCoupon ? 'text-blue-600' : 'text-black/60'
                        } />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-sm font-black text-black leading-tight">{r.rewardName}</p>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${statusConfig.bg} ${statusConfig.text}`}>
                            {statusConfig.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-black/45 mb-1.5">
                          <span>{new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          <span className="text-black/30">·</span>
                          <span className="font-semibold text-black/55">-{r.pointsSpent.toLocaleString()} pts</span>
                        </div>

                        {r.couponCode && (
                          <button
                            onClick={() => copyToClipboard(r.couponCode!)}
                            className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-lg bg-white border border-black/10 hover:border-black/30 transition-colors group"
                          >
                            <code className="text-[11px] font-mono font-bold text-black tracking-wider">{r.couponCode}</code>
                            <Copy size={11} weight="bold" className="text-black/35 group-hover:text-black/70 transition-colors" />
                          </button>
                        )}

                        {isPendingFulfillment && (
                          <p className="text-[11px] text-amber-700 mt-1.5 flex items-center gap-1">
                            <ClockCounterClockwise size={11} weight="bold" />
                            Our team is processing your reward
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
          </>
        </div>
      )}

      {/* Available Rewards — always shown */}
      <div className={`max-w-7xl mx-auto px-4 md:px-6 lg:px-12 ${embedded ? 'py-6 md:py-8 lg:py-10' : 'py-6 md:py-10 lg:py-12'}`}>
        <div className="mb-5 md:mb-7">
          <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] text-black/40 mb-1">
            Use your points
          </p>
          <h2 className="text-xl md:text-2xl font-black text-black tracking-tight">
            Available rewards
          </h2>
        </div>
        {/* Early Access Drops Section */}
        <div className="mb-8 md:mb-12">
          <EarlyAccessDrops
            currentPoints={customerPoints}
            onPointsChange={(newPoints) => {
              setCustomerPoints(newPoints)
              fetchRewards()
            }}
          />
        </div>

        {/* Category Filter — horizontal scroll */}
        <div className="mb-5 md:mb-8 -mx-4 md:mx-0">
          <div className="flex items-center justify-between mb-3 md:mb-4 px-4 md:px-0">
            <h3 className="text-xs md:text-sm font-bold uppercase tracking-wider text-black/50">
              Browse by category
            </h3>
            <span className="text-xs text-black/40 font-medium">
              <span className="font-bold text-black">{rewards.length}</span> {rewards.length === 1 ? 'reward' : 'rewards'}
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 md:px-0 pb-1">
            {categories.map((category) => {
              const Icon = category.icon
              const isSelected = selectedCategory === category.value
              return (
                <button
                  key={category.value}
                  onClick={() => setSelectedCategory(category.value)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs md:text-sm font-semibold rounded-full transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-black text-white shadow-md'
                      : 'bg-white text-black/65 border border-black/10 hover:border-black/30 hover:text-black'
                  }`}
                >
                  <Icon size={14} weight={isSelected ? 'fill' : 'bold'} className="shrink-0" />
                  <span>{category.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Rewards Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <CircleNotch size={48} weight="bold" className="animate-spin text-black mb-4" />
            <p className="text-black/70">Loading rewards...</p>
          </div>
        ) : rewards.length === 0 ? (
          <div className="text-center py-16 md:py-24">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 mx-auto mb-5 bg-black/5 rounded-full flex items-center justify-center">
                <Sparkle size={26} weight="fill" className="text-black/25" />
              </div>
              <h3 className="text-lg md:text-xl font-black text-black mb-2">No rewards in this category</h3>
              <p className="text-sm text-black/55 mb-6">Try a different category to discover more.</p>
              <button
                onClick={() => setSelectedCategory('all')}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-black text-white text-xs font-bold uppercase tracking-wider rounded-full hover:bg-black/85 transition-all"
              >
                View All Rewards
                <ArrowRight size={13} weight="bold" />
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {rewards.map((reward, index) => {
              const Icon = rewardTypeIcons[reward.rewardType as keyof typeof rewardTypeIcons] || Gift
              const canRedeem = reward.canAfford && reward.meetsTierRequirement && reward.isAvailable
              const pointsShort = !reward.canAfford && reward.meetsTierRequirement
                ? reward.pointsCost - customerPoints
                : 0

              return (
                <motion.div
                  key={reward.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.3) }}
                  className={`group relative bg-white rounded-2xl border border-black/8 overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-black/20 hover:-translate-y-0.5 flex flex-col ${
                    !canRedeem ? 'opacity-75' : ''
                  }`}
                >
                  {/* Top: icon + type chip */}
                  <div className="px-4 pt-4 md:px-5 md:pt-5 flex items-center justify-between">
                    <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-black/5 flex items-center justify-center">
                      <Icon size={18} weight="fill" className="text-black/75" />
                    </div>
                    <span className="px-2.5 py-1 text-[9px] md:text-[10px] font-bold uppercase tracking-wider rounded-full bg-black/4 text-black/55">
                      {rewardTypeLabels[reward.rewardType as keyof typeof rewardTypeLabels]}
                    </span>
                  </div>

                  {/* Title + description */}
                  <div className="px-4 md:px-5 pt-3 pb-4 flex-1">
                    <h3 className="text-[15px] md:text-base font-black text-black tracking-tight leading-tight line-clamp-2 mb-1.5">
                      {reward.name}
                    </h3>
                    {reward.description && (
                      <p className="text-xs text-black/55 leading-relaxed line-clamp-2">
                        {reward.description}
                      </p>
                    )}
                  </div>

                  {/* Optional inline status hint */}
                  {!canRedeem && (
                    <div className="mx-4 md:mx-5 mb-3 inline-flex items-center gap-1.5 text-[11px] text-black/55">
                      {!reward.meetsTierRequirement && reward.minTierRequired ? (
                        <>
                          <Lock size={11} weight="bold" />
                          <span>Requires <span className="font-bold capitalize text-black/70">{reward.minTierRequired}</span> tier</span>
                        </>
                      ) : pointsShort > 0 ? (
                        <>
                          <Warning size={11} weight="bold" className="text-amber-500" />
                          <span><span className="font-bold text-black/75">{pointsShort.toLocaleString()}</span> pts short</span>
                        </>
                      ) : (
                        <>
                          <X size={11} weight="bold" />
                          <span>Out of stock</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Footer: points + CTA on one row */}
                  <div className="px-3 pb-3 md:px-3 md:pb-3 mt-auto">
                    <div className="flex items-center justify-between gap-2 bg-black/3 rounded-xl pl-3 pr-1 py-1">
                      <div className="flex items-center gap-1.5">
                        <Sparkle size={14} weight="fill" className="text-black/55" />
                        <span className="text-base md:text-lg font-black text-black leading-none tracking-tight">
                          {reward.pointsCost.toLocaleString()}
                        </span>
                        <span className="text-[10px] md:text-[11px] text-black/45 font-medium">pts</span>
                      </div>
                      <button
                        onClick={() => handleRedeem(reward.id)}
                        disabled={!canRedeem || redeemingRewardId === reward.id}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] md:text-xs font-bold uppercase tracking-wider transition-all active:scale-[0.97] ${
                          canRedeem
                            ? 'bg-black text-white hover:bg-black/85'
                            : 'bg-black/10 text-black/35 cursor-not-allowed'
                        }`}
                      >
                        {redeemingRewardId === reward.id ? (
                          <CircleNotch size={13} weight="bold" className="animate-spin" />
                        ) : canRedeem ? (
                          <>
                            Redeem
                            <ArrowRight size={11} weight="bold" />
                          </>
                        ) : (
                          'Locked'
                        )}
                      </button>
                    </div>

                    {reward._count.redemptions > 0 && (
                      <p className="text-[10px] text-black/35 text-center mt-2 font-medium flex items-center justify-center gap-1">
                        <Users size={9} weight="bold" />
                        {reward._count.redemptions.toLocaleString()} {reward._count.redemptions === 1 ? 'person' : 'people'} redeemed
                      </p>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* How to Earn — modernized cards */}
        <section className="mt-10 md:mt-16 pt-8 md:pt-12 border-t border-black/5">
          <div className="flex items-end justify-between mb-5 md:mb-7">
            <div>
              <p className="text-[10px] font-bold tracking-[0.18em] text-black/40 uppercase mb-1.5">
                Maximize Your Rewards
              </p>
              <h2 className="text-xl md:text-2xl font-black text-black tracking-tight">
                Ways to earn points
              </h2>
            </div>
            <Link
              href="/products"
              className="hidden md:inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-xs font-bold uppercase tracking-wider rounded-full hover:bg-black/85 transition-all active:scale-[0.97]"
            >
              Shop Now
              <ArrowRight size={13} weight="bold" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            {[
              {
                icon: Gift,
                title: 'Make a purchase',
                description: 'Earn 1 point per $1 spent, multiplied by your tier.',
                accent: '1× – 2×',
              },
              {
                icon: Users,
                title: 'Refer a friend',
                description: 'Get 250 bonus points when they make their first purchase.',
                accent: '+250',
              },
              {
                icon: Sparkle,
                title: 'Special events',
                description: 'Bonus points on your birthday and during promotions.',
                accent: '+50',
              },
            ].map(({ icon: ItemIcon, title, description, accent }) => (
              <div
                key={title}
                className="flex items-start gap-3 md:gap-4 p-4 md:p-5 rounded-2xl bg-black/3 border border-black/5 hover:bg-black/5 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center shrink-0">
                  <ItemIcon size={18} weight="fill" className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="text-sm font-black text-black tracking-tight">{title}</h3>
                    <span className="text-[10px] font-bold text-black/45 bg-black/4 px-2 py-0.5 rounded-full">
                      {accent}
                    </span>
                  </div>
                  <p className="text-xs text-black/55 leading-relaxed">{description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile CTA */}
          <div className="md:hidden text-center mt-6">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 px-5 py-3 bg-black text-white text-xs font-bold uppercase tracking-wider rounded-full hover:bg-black/85 transition-all active:scale-[0.97]"
            >
              Start Shopping
              <ArrowRight size={13} weight="bold" />
            </Link>
          </div>
        </section>
      </div>
      {/* end Available Rewards */}

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

                {/* Coupon code — discount / free shipping rewards */}
                {redemptionResult.redemption?.couponCode && (
                  <div className="mt-3 md:mt-4 p-3 md:p-4 bg-amber-50 border border-amber-200">
                    <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                      <Gift size={14} weight="fill" className="text-amber-600 md:hidden" />
                      <Gift size={18} weight="fill" className="text-amber-600 hidden md:block" />
                      <span className="text-xs md:text-sm font-bold text-amber-900">Your Coupon Code</span>
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
                      Apply at checkout · expires in 90 days
                    </p>
                  </div>
                )}

                {/* Processing notice — physical / digital / charity / exclusive rewards */}
                {!redemptionResult.redemption?.couponCode && redemptionResult.redemption?.status === 'PENDING' && (
                  <div className="mt-3 md:mt-4 p-3 md:p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-start gap-2.5">
                      <ClockCounterClockwise size={16} weight="bold" className="text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs md:text-sm font-bold text-blue-900 mb-1">We&apos;re on it!</p>
                        <p className="text-xs text-blue-700 leading-relaxed">
                          Our team will process your reward shortly. Track it in{' '}
                          <button
                            onClick={() => {
                              setShowSuccessModal(false)
                              if (typeof window !== 'undefined') {
                                document.getElementById('redemptions-anchor')?.scrollIntoView({ behavior: 'smooth' })
                              }
                            }}
                            className="font-bold underline underline-offset-2"
                          >
                            My Redemptions
                          </button>
                          .
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {redemptionResult.reward?.value && redemptionResult.reward.type === 'DISCOUNT' && (
                  <div className="mt-3 md:mt-4 flex items-center gap-2 text-xs md:text-sm text-black/60">
                    <Star size={14} weight="fill" className="text-amber-500" />
                    <span>Save ${redemptionResult.reward.value} on your next order</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-4 md:p-6 pt-0 space-y-2 md:space-y-3">
                {redemptionResult.redemption?.couponCode ? (
                  <Link
                    href="/products"
                    className="block w-full bg-black text-white py-3 md:py-4 font-bold text-xs md:text-sm uppercase tracking-wider hover:bg-black/90 transition-colors text-center rounded-xl"
                  >
                    Shop Now
                  </Link>
                ) : (
                  <button
                    onClick={() => {
                      setShowSuccessModal(false)
                      if (typeof window !== 'undefined') {
                        setTimeout(() => {
                          document.getElementById('redemptions-anchor')?.scrollIntoView({ behavior: 'smooth' })
                        }, 50)
                      }
                    }}
                    className="block w-full bg-black text-white py-3 md:py-4 font-bold text-xs md:text-sm uppercase tracking-wider hover:bg-black/90 transition-colors text-center rounded-xl"
                  >
                    View My Redemptions
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowSuccessModal(false)
                    setRedemptionResult(null)
                    setCopiedCode(false)
                  }}
                  className="w-full bg-white text-black py-3 md:py-4 font-bold text-xs md:text-sm uppercase tracking-wider border border-black/10 hover:bg-black/5 transition-colors rounded-xl"
                >
                  Close
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
