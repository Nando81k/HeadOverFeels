'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Navigation } from '@/components/layout/Navigation'
import { useAuth } from '@/lib/auth/context'
import {
  SignOut, CircleNotch, Medal, Sparkle, Gear,
  Confetti, Star, Coins, CalendarBlank, Camera,
} from '@phosphor-icons/react'
import { UserAvatar } from '@/components/ui/UserAvatar'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { calculateTierProgressWithTiers } from '@/lib/loyalty/tier-progress'
import { toast } from '@/lib/toast'
import { RewardsHubSection } from '@/components/profile/RewardsHubSection'
import { ProfileSectionNav, type ProfileSection } from '@/components/profile/ProfileSectionNav'
import { OverviewSection } from '@/components/profile/sections/OverviewSection'
import { ActivitySection } from '@/components/profile/sections/ActivitySection'
import { SettingsSection } from '@/components/profile/sections/SettingsSection'
import { buildTierGradient, resolveTierTheme } from '@/lib/loyalty/tier-theme'

interface PointsTransaction {
  id: string
  points: number
  type: string
  description: string
  createdAt: string
  order?: { orderNumber: string } | null
}

interface Order {
  id: string
  orderNumber: string
  status: string
  total: number
  createdAt: string
  items: {
    productName: string
    quantity: number
  }[]
}

// Storage key for tracking points/tier changes
const LOYALTY_CACHE_KEY = 'hof_loyalty_cache'
const LOYALTY_PENDING_ANIMATION_KEY = 'hof_loyalty_pending_animation'

interface LoyaltyCache {
  points: number
  tierSlug: string
  lastVisit: number
}

interface PendingLoyaltyAnimation {
  orderId: string
  customerId: string | null
  pointsEarned: number
  createdAt: number
}

interface ProfileTierDefinition {
  name: string
  slug: string
  minAnnualPoints: number
  pointMultiplier: number
}

// Tier configuration for labels and benefit copy
const tierConfig: Record<string, { 
  name: string
  emoji: string
  multiplier: number
  benefits: string[]
}> = {
  newcomer: {
    name: 'Newcomer',
    emoji: '👋',
    multiplier: 1.0,
    benefits: [
      'Earn 10 Care Points per $1 spent',
      'Birthday surprise',
      'Early sale access',
    ],
  },
  friend: {
    name: 'Friend',
    emoji: '💙',
    multiplier: 1.25,
    benefits: [
      'Earn 12.5 Care Points per $1 spent (1.25x)',
      'Birthday bonus points',
      'Early access to sales',
      'Free shipping on orders $75+',
    ],
  },
  bestie: {
    name: 'Bestie',
    emoji: '💖',
    multiplier: 1.5,
    benefits: [
      'Earn 15 Care Points per $1 spent (1.5x)',
      'FREE shipping on all orders',
      '24-hour early access to sales',
      'Exclusive Bestie-only products',
    ],
  },
  soulmate: {
    name: 'Soulmate',
    emoji: '💜',
    multiplier: 2.0,
    benefits: [
      'Earn 20 Care Points per $1 spent (2x)',
      'FREE express shipping',
      '48-hour early access to limited drops',
      'Annual surprise gift',
      'Priority support',
    ],
  },
}

const getTierConfig = (slug: string) => tierConfig[slug] || tierConfig.newcomer

const VALID_SECTIONS: ProfileSection[] = ['overview', 'loyalty', 'activity', 'settings']

const getSectionFromHash = (hash: string): ProfileSection => {
  const candidate = hash.replace('#', '').toLowerCase()
  return (VALID_SECTIONS as string[]).includes(candidate)
    ? (candidate as ProfileSection)
    : 'overview'
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, loading: authLoading, signout, refreshUser } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [pointsHistory, setPointsHistory] = useState<PointsTransaction[]>([])
  const [loadingPoints, setLoadingPoints] = useState(true)
  
  // Animation states
  const [shouldAnimatePoints, setShouldAnimatePoints] = useState(false)
  const [shouldAnimateTier, setShouldAnimateTier] = useState(false)
  const [previousTierSlug, setPreviousTierSlug] = useState<string | null>(null)
  const [pointsGained, setPointsGained] = useState(0)
  const [showCelebration, setShowCelebration] = useState(false)
  const [showTierUpgradeModal, setShowTierUpgradeModal] = useState(false)
  const [animatedProgress, setAnimatedProgress] = useState(0)
  const [progressAnimationStart, setProgressAnimationStart] = useState<number | null>(null)
  const [displayTierSlug, setDisplayTierSlug] = useState<string | null>(null)
  const [tierTransitionPhase, setTierTransitionPhase] = useState<'idle' | 'filling' | 'celebrating' | 'resetting' | 'complete'>('idle')
  const animationTriggeredRef = useRef(false)
  const tierRefreshAttemptedRef = useRef(false)
  const initialRefreshDoneRef = useRef(false)
  const readyToCheckRef = useRef(false)
  const [activeSection, setActiveSection] = useState<ProfileSection>('overview')
  const [pendingRedemptionCount, setPendingRedemptionCount] = useState(0)
  const [openTierModalSignal] = useState(0)
  const [tierThemeOverrides, setTierThemeOverrides] = useState<Record<string, { primaryColor?: string; secondaryColor?: string }>>({})
  const [tierDefinitions, setTierDefinitions] = useState<ProfileTierDefinition[]>([])
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/signin')
    }
  }, [user, authLoading, router])

  const setSectionAndHash = useCallback((section: ProfileSection) => {
    setActiveSection(section)

    if (typeof window === 'undefined') return
    const nextHash = `#${section}`
    if (window.location.hash === nextHash) return
    const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`
    window.history.replaceState(null, '', nextUrl)

    // Scroll to top of content area on section change
    if (typeof window !== 'undefined') {
      const top = document.getElementById('profile-content-top')
      if (top) {
        top.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }, [])

  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset so same file can be re-selected after removal
    e.target.value = ''

    setAvatarUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: form })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Upload failed')
      }
      await refreshUser()
      toast.success('Profile picture updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setAvatarUploading(false)
    }
  }, [refreshUser])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const syncFromHash = () => {
      setActiveSection(getSectionFromHash(window.location.hash))
    }

    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [])

  useEffect(() => {
    if (!user) return

    const controller = new AbortController()
    const loadTierThemes = async () => {
      try {
        const response = await fetch('/api/loyalty/tiers', {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) return

        const payload = await response.json()
        if (!Array.isArray(payload)) return

        const definitions = payload.flatMap((tier): ProfileTierDefinition[] => {
          if (!tier || typeof tier !== 'object') return []
          const slug = typeof tier.slug === 'string' ? tier.slug.toLowerCase() : null
          if (!slug) return []

          const minAnnualPoints = Number(tier.minAnnualPoints)
          const pointMultiplier = Number(tier.pointMultiplier)

          return [{
            name: typeof tier.name === 'string' && tier.name.trim().length > 0 ? tier.name.trim() : slug,
            slug,
            minAnnualPoints: Number.isFinite(minAnnualPoints) ? Math.max(0, minAnnualPoints) : 0,
            pointMultiplier: Number.isFinite(pointMultiplier) ? Math.max(1, pointMultiplier) : 1,
          }]
        }).sort((a, b) => {
          if (a.minAnnualPoints !== b.minAnnualPoints) {
            return a.minAnnualPoints - b.minAnnualPoints
          }
          return a.slug.localeCompare(b.slug)
        })

        const overrides = payload.reduce<Record<string, { primaryColor?: string; secondaryColor?: string }>>((acc, tier) => {
          if (!tier || typeof tier !== 'object') return acc
          const slug = typeof tier.slug === 'string' ? tier.slug.toLowerCase() : null
          if (!slug) return acc

          acc[slug] = {
            primaryColor: typeof tier.primaryColor === 'string' ? tier.primaryColor : undefined,
            secondaryColor: typeof tier.secondaryColor === 'string' ? tier.secondaryColor : undefined,
          }
          return acc
        }, {})

        setTierDefinitions(definitions)
        setTierThemeOverrides(overrides)
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
      }
    }

    loadTierThemes()
    return () => controller.abort()
  }, [user])

  const getPendingLoyaltyAnimation = useCallback((): PendingLoyaltyAnimation | null => {
    if (!user) return null

    try {
      const raw = localStorage.getItem(LOYALTY_PENDING_ANIMATION_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as PendingLoyaltyAnimation

      if (!parsed || typeof parsed !== 'object') return null
      if (typeof parsed.pointsEarned !== 'number' || parsed.pointsEarned <= 0) return null
      if (typeof parsed.createdAt !== 'number') return null
      if (parsed.customerId && parsed.customerId !== user.id) return null

      // Ignore stale purchase animations older than 7 days.
      if (Date.now() - parsed.createdAt > 7 * 24 * 60 * 60 * 1000) return null

      return parsed
    } catch {
      return null
    }
  }, [user])

  const clearPendingLoyaltyAnimation = useCallback(() => {
    try {
      localStorage.removeItem(LOYALTY_PENDING_ANIMATION_KEY)
    } catch {
      // Ignore storage errors
    }
  }, [])

  // Check for points/tier changes and trigger animations
  const checkForLoyaltyChanges = useCallback(() => {
    if (!user || !user.loyaltyTier || animationTriggeredRef.current) return

    const cacheKey = `${LOYALTY_CACHE_KEY}_${user.id}`
    const cachedData = localStorage.getItem(cacheKey)
    const currentTierSlug = user.loyaltyTier.slug
    const currentPoints = user.currentPoints
    const annualPoints = user.annualPointsEarned ?? 0
    const pendingPoints = getPendingLoyaltyAnimation()?.pointsEarned || 0

    const runPointsAnimation = (pointsDelta: number) => {
      const gained = Math.max(0, pointsDelta)
      const previousAnnualPoints = Math.max(0, annualPoints - gained)
      const previousProgress = calculateTierProgressWithTiers({
        currentTierSlug: user.loyaltyTier?.slug ?? null,
        annualPointsEarned: previousAnnualPoints,
        tiers: tierDefinitions,
      }).progressPercentage

      setPointsGained(gained)
      setProgressAnimationStart(previousProgress)
      setShouldAnimatePoints(true)
      animationTriggeredRef.current = true

      setTimeout(() => {
        setShouldAnimatePoints(false)
        setProgressAnimationStart(null)
      }, 2200)

      toast.success(`+${gained} Points Earned! 🌟`, `You now have ${currentPoints.toLocaleString()} total points.`)
    }

    const runTierAnimation = (fromTierSlug: string, toTierSlug: string, pointsDelta: number) => {
      setPointsGained(Math.max(0, pointsDelta))
      setPreviousTierSlug(fromTierSlug)
      setDisplayTierSlug(fromTierSlug)
      setShouldAnimateTier(true)
      setTierTransitionPhase('filling')
      setProgressAnimationStart(0)
      animationTriggeredRef.current = true

      setAnimatedProgress(0)
      setTimeout(() => setAnimatedProgress(100), 100)
      setTimeout(() => {
        setTierTransitionPhase('celebrating')
        setShowCelebration(true)
      }, 1200)
      setTimeout(() => {
        setTierTransitionPhase('resetting')
        setDisplayTierSlug(toTierSlug)
        setAnimatedProgress(0)
      }, 2500)
      setTimeout(() => {
        setTierTransitionPhase('complete')
        setShowCelebration(false)
      }, 3200)
      setTimeout(() => {
        setShowTierUpgradeModal(true)
      }, 3800)
      setTimeout(() => {
        setShouldAnimateTier(false)
        setProgressAnimationStart(null)
      }, 4200)
    }

    const expectedTierSlug = calculateTierProgressWithTiers({
      annualPointsEarned: annualPoints,
      tiers: tierDefinitions,
    }).currentTier.slug

    if (cachedData) {
      try {
        const cache: LoyaltyCache = JSON.parse(cachedData)

        if (currentTierSlug !== cache.tierSlug) {
          const rawPointsDelta = currentPoints - cache.points
          const pointsDelta = pendingPoints > 0 ? pendingPoints : rawPointsDelta
          runTierAnimation(cache.tierSlug, currentTierSlug, pointsDelta)
          clearPendingLoyaltyAnimation()
        } else if (currentTierSlug !== expectedTierSlug && cache.tierSlug !== expectedTierSlug) {
          if (!tierRefreshAttemptedRef.current) {
            tierRefreshAttemptedRef.current = true

            fetch('/api/loyalty/refresh-tier', { method: 'POST' })
              .then(res => res.json())
              .then(async data => {
                if (data.upgraded && data.newTier) {
                  runTierAnimation(currentTierSlug, data.newTier, pendingPoints)
                  clearPendingLoyaltyAnimation()

                  const newCache: LoyaltyCache = {
                    points: currentPoints,
                    tierSlug: data.newTier,
                    lastVisit: Date.now()
                  }
                  localStorage.setItem(cacheKey, JSON.stringify(newCache))
                  await refreshUser()
                }
              })
              .catch(() => {})
            return
          }
        } else if (currentPoints > cache.points) {
          const rawPointsDelta = currentPoints - cache.points
          const pointsDelta = pendingPoints > 0 ? pendingPoints : rawPointsDelta
          runPointsAnimation(pointsDelta)
          clearPendingLoyaltyAnimation()
        } else if (pendingPoints > 0) {
          runPointsAnimation(pendingPoints)
          clearPendingLoyaltyAnimation()
        }
      } catch {
        // Invalid cache
      }
    } else if (pendingPoints > 0) {
      runPointsAnimation(pendingPoints)
      clearPendingLoyaltyAnimation()
    }

    const newCache: LoyaltyCache = {
      points: user.currentPoints,
      tierSlug: user.loyaltyTier.slug,
      lastVisit: Date.now()
    }
    localStorage.setItem(cacheKey, JSON.stringify(newCache))
  }, [user, getPendingLoyaltyAnimation, clearPendingLoyaltyAnimation, refreshUser, tierDefinitions])

  // Dev mode tier animation trigger
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'T' && e.shiftKey && user?.loyaltyTier) {
        const tiers = ['newcomer', 'friend', 'bestie', 'soulmate']
        const currentIndex = tiers.indexOf(user.loyaltyTier.slug)
        const previousTier = currentIndex > 0 ? tiers[currentIndex - 1] : 'newcomer'
        
        setPreviousTierSlug(previousTier)
        setDisplayTierSlug(previousTier)
        setShouldAnimateTier(true)
        setTierTransitionPhase('filling')
        setPointsGained(100)
        
        setAnimatedProgress(0)
        setTimeout(() => setAnimatedProgress(100), 100)
        setTimeout(() => {
          setTierTransitionPhase('celebrating')
          setShowCelebration(true)
        }, 1200)
        setTimeout(() => {
          setTierTransitionPhase('resetting')
          setDisplayTierSlug(user.loyaltyTier!.slug)
          setAnimatedProgress(0)
        }, 2500)
        setTimeout(() => {
          setTierTransitionPhase('complete')
          setShowCelebration(false)
        }, 3200)
        setTimeout(() => {
          setShowTierUpgradeModal(true)
        }, 3800)
      }
      
      if (e.key === 'R' && e.shiftKey && user) {
        const cacheKey = `${LOYALTY_CACHE_KEY}_${user.id}`
        localStorage.removeItem(cacheKey)
        toast.success('Cache Cleared', 'Refresh the page to test animation')
      }
    }
    
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [user])

  // On mount, refresh user data to get latest points/tier
  useEffect(() => {
    const initializeLoyaltyCheck = async () => {
      if (!user || authLoading || initialRefreshDoneRef.current) return
      
      initialRefreshDoneRef.current = true
      
      // Refresh user data to get the latest points and tier from server
      await refreshUser()
      
      // Mark that we're ready to check - the user state will update and trigger the next effect
      readyToCheckRef.current = true
    }
    
    initializeLoyaltyCheck()
  }, [user, authLoading, refreshUser])

  // After user data updates and we're ready, check for loyalty changes
  useEffect(() => {
    if (user && !authLoading && readyToCheckRef.current && !animationTriggeredRef.current) {
      checkForLoyaltyChanges()
    }
  }, [user, authLoading, checkForLoyaltyChanges])

  const fetchOrders = async () => {
    if (!user) return
    try {
      const response = await fetch('/api/orders', {
        headers: {
          'x-user-email': user.email || '',
          'x-user-admin': user.isAdmin ? 'true' : 'false',
        },
      })
      if (response.ok) {
        const data = await response.json()
        setOrders(data.data || [])
      }
    } catch {
      // Failed to fetch
    } finally {
      setLoadingOrders(false)
    }
  }

  const fetchPointsHistory = async () => {
    if (!user) return
    try {
      const response = await fetch('/api/loyalty/points-history?limit=5')
      if (response.ok) {
        const data = await response.json()
        setPointsHistory(data.data || [])
      }
    } catch {
      // Failed to fetch
    } finally {
      setLoadingPoints(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchOrders()
      fetchPointsHistory()
      fetchPendingRedemptions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const fetchPendingRedemptions = async () => {
    try {
      const res = await fetch('/api/loyalty/redemptions?limit=50')
      if (!res.ok) return
      const data = await res.json()
      const items: { status: string; couponCode: string | null }[] = data.data ?? []
      setPendingRedemptionCount(
        items.filter((r) => r.status === 'PENDING' && !r.couponCode).length
      )
    } catch {
      // silent — badge falls back to 0
    }
  }

  const tierProgress = useMemo(() => {
    if (!user) return null
    return calculateTierProgressWithTiers({
      currentTierSlug: user.loyaltyTier?.slug ?? null,
      annualPointsEarned: user.annualPointsEarned ?? 0,
      tiers: tierDefinitions,
    })
  }, [tierDefinitions, user])

  useEffect(() => {
    if (tierProgress && shouldAnimatePoints && !shouldAnimateTier) {
      const fromProgress = progressAnimationStart ?? tierProgress.progressPercentage
      setAnimatedProgress(fromProgress)
      const timer = setTimeout(() => {
        setAnimatedProgress(tierProgress.progressPercentage)
      }, 220)
      return () => clearTimeout(timer)
    } else if (tierProgress && tierTransitionPhase === 'complete') {
      const timer = setTimeout(() => {
        setAnimatedProgress(tierProgress.progressPercentage)
      }, 300)
      return () => clearTimeout(timer)
    } else if (tierProgress && !shouldAnimateTier && !shouldAnimatePoints) {
      setAnimatedProgress(tierProgress.progressPercentage)
    }
  }, [tierProgress, shouldAnimatePoints, shouldAnimateTier, tierTransitionPhase, progressAnimationStart])

  const handleSignout = async () => {
    await signout()
    router.push('/')
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <CircleNotch size={32} weight="bold" className="animate-spin text-black" />
      </div>
    )
  }

  const tierThemeBySlug = {
    ...tierThemeOverrides,
    ...(user.loyaltyTier?.slug
      ? {
          [user.loyaltyTier.slug.toLowerCase()]: {
            primaryColor: user.loyaltyTier.primaryColor,
            secondaryColor: user.loyaltyTier.secondaryColor,
          },
        }
      : {}),
  }
  const currentThemeSlug = user.loyaltyTier?.slug || tierProgress?.currentTier.slug || 'newcomer'
  const currentTierConfig = getTierConfig((user.loyaltyTier?.slug || currentThemeSlug).toLowerCase())
  const tierDisplayBySlug = tierDefinitions.reduce<Record<string, { name: string; pointMultiplier: number }>>((acc, tier) => {
    acc[tier.slug.toLowerCase()] = {
      name: tier.name,
      pointMultiplier: tier.pointMultiplier,
    }
    return acc
  }, {})
  if (user.loyaltyTier?.slug) {
    tierDisplayBySlug[user.loyaltyTier.slug.toLowerCase()] = {
      name: user.loyaltyTier.name,
      pointMultiplier: user.loyaltyTier.pointMultiplier,
    }
  }
  const resolveTierDisplay = (slug: string | null | undefined) => {
    const normalized = (slug || '').toLowerCase()
    const fromDefinitions = tierDisplayBySlug[normalized]
    if (fromDefinitions) {
      return fromDefinitions
    }
    const fallback = getTierConfig(normalized || 'newcomer')
    return {
      name: fallback.name,
      pointMultiplier: fallback.multiplier,
    }
  }
  const currentTierTheme = resolveTierTheme(currentThemeSlug, tierThemeBySlug[currentThemeSlug.toLowerCase()])

  // Derived values for OverviewSection — current/next tier from the loaded definitions
  const annualPointsEarned = user.annualPointsEarned ?? 0
  const sortedTiers = [...tierDefinitions].sort(
    (a, b) => a.minAnnualPoints - b.minAnnualPoints
  )
  const currentTierIndex = sortedTiers.reduce(
    (acc, tier, idx) => (annualPointsEarned >= tier.minAnnualPoints ? idx : acc),
    -1
  )
  const currentTierForOverview = currentTierIndex >= 0
    ? sortedTiers[currentTierIndex] ?? null
    : (sortedTiers[0] ?? null)
  const nextTierForOverview = currentTierIndex >= 0
    ? (sortedTiers[currentTierIndex + 1] ?? null)
    : null

  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      
      {/* Celebration Overlay */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
          >
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 1, y: 0, x: 0, scale: 0 }}
                animate={{ 
                  opacity: [1, 1, 0],
                  y: [0, -200 - Math.random() * 200],
                  x: [(Math.random() - 0.5) * 400, (Math.random() - 0.5) * 600],
                  scale: [0, 1, 0.5],
                  rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)]
                }}
                transition={{ duration: 2 + Math.random(), delay: Math.random() * 0.5, ease: "easeOut" }}
                className="absolute"
                style={{ top: '50%', left: '50%' }}
              >
                <Confetti 
                  size={24 + Math.random() * 16} 
                  weight="fill" 
                  className={['text-pink-500', 'text-purple-500', 'text-yellow-400', 'text-blue-500', 'text-emerald-500'][Math.floor(Math.random() * 5)]}
                />
              </motion.div>
            ))}
            
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.2, 1], opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-black text-white px-8 py-6 text-center shadow-2xl"
            >
              <motion.div animate={{ rotate: [0, -10, 10, -10, 0] }} transition={{ duration: 0.5, delay: 0.8 }}>
                <Medal size={48} weight="fill" className="mx-auto mb-3 text-yellow-400" />
              </motion.div>
              <h3 className="text-2xl font-black mb-1">TIER UPGRADED!</h3>
              <p className="text-white/70">Welcome to <span className="text-white font-bold">{user?.loyaltyTier?.name}</span></p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Tier Upgrade Modal */}
      <AnimatePresence>
        {showTierUpgradeModal && user?.loyaltyTier && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-100 flex items-center justify-center p-4"
            onClick={() => setShowTierUpgradeModal(false)}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(40)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: -20, x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 800) }}
                  animate={{ 
                    opacity: [0, 1, 1, 0],
                    y: ['-5vh', '105vh'],
                    rotate: [0, 360 * (Math.random() > 0.5 ? 2 : -2)],
                  }}
                  transition={{ duration: 3 + Math.random() * 2, delay: Math.random() * 2, repeat: Infinity, ease: "linear" }}
                  className="absolute"
                >
                  <Confetti 
                    size={16 + Math.random() * 20} 
                    weight="fill" 
                    className={['text-pink-400', 'text-purple-400', 'text-yellow-300', 'text-blue-400', 'text-emerald-400'][Math.floor(Math.random() * 5)]}
                  />
                </motion.div>
              ))}
            </div>
            
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg bg-white shadow-2xl overflow-hidden"
            >
              <div
                className="p-8 text-white text-center relative overflow-hidden"
                style={{ backgroundImage: buildTierGradient(currentTierTheme, 135) }}
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl" />
                
                <motion.div
                  animate={{ y: [0, -10, 0], rotate: [0, -5, 5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="relative z-10 mb-4"
                >
                  <div className="w-24 h-24 mx-auto bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                    <Medal size={56} weight="fill" className="text-yellow-300 drop-shadow-lg" />
                  </div>
                </motion.div>
                
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="relative z-10">
                  <p className="text-white/80 text-sm font-medium uppercase tracking-wider mb-2">🎊 Congratulations! 🎊</p>
                  <h2 className="text-4xl font-black mb-2">You&apos;re Now {currentTierConfig.emoji}</h2>
                  <h3 className="text-5xl font-black tracking-tight">{user.loyaltyTier.name}</h3>
                </motion.div>
              </div>
              
              <div className="p-6">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                  <h4 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
                    <Sparkle size={20} weight="fill" className="text-yellow-500" />
                    Your New Benefits
                  </h4>
                  
                  <div className="space-y-3">
                    {currentTierConfig.benefits.map((benefit, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + index * 0.1 }}
                        className="flex items-start gap-3"
                      >
                        <div
                          className="w-6 h-6 flex items-center justify-center shrink-0 mt-0.5"
                          style={{ backgroundImage: buildTierGradient(currentTierTheme, 135) }}
                        >
                          <Star size={12} weight="fill" className="text-white" />
                        </div>
                        <p className="text-black/80 text-sm">{benefit}</p>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
                
                {pointsGained > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="mt-6 p-4 bg-emerald-50 border border-emerald-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-500 flex items-center justify-center">
                        <Coins size={20} weight="fill" className="text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-emerald-600 font-medium uppercase tracking-wider">Points Earned</p>
                        <p className="text-2xl font-bold text-emerald-700">+{pointsGained.toLocaleString()}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
                
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowTierUpgradeModal(false)}
                  className="w-full mt-6 py-4 text-white font-bold text-lg uppercase tracking-wider"
                  style={{ backgroundImage: buildTierGradient(currentTierTheme, 90) }}
                >
                  Start Earning {currentTierConfig.multiplier}x Points
                </motion.button>
                
                <p className="text-center text-black/40 text-xs mt-4">Click anywhere to close</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sleek Minimal Hero — white bg, tier accent stripe, compact identity row */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative bg-white border-b border-black/8"
      >
        {/* Tier accent stripe */}
        <div
          className="h-[3px] w-full"
          style={{ backgroundColor: currentTierTheme.primaryColor || '#0a0a0a' }}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-5 md:py-6">
          <div className="flex items-center gap-4 md:gap-5">
            {/* Avatar with upload affordance */}
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="relative shrink-0 group"
              aria-label="Change profile picture"
              disabled={avatarUploading}
            >
              <UserAvatar
                src={user.profilePictureUrl}
                name={user.name}
                size={52}
                className="ring-2 ring-black/8"
              />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity">
                {avatarUploading
                  ? <CircleNotch size={18} className="text-white animate-spin" />
                  : <Camera size={18} className="text-white" weight="bold" />}
              </span>
              {!avatarUploading && (
                <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-black ring-2 ring-white flex items-center justify-center">
                  <Camera size={10} className="text-white" weight="bold" />
                </span>
              )}
            </button>

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-3 flex-wrap">
                <h1 className="text-xl lg:text-2xl font-black text-black tracking-tight truncate">
                  {user.name || 'Welcome'}
                </h1>
                <span className="hidden md:inline text-sm text-black/55 truncate">{user.email}</span>
              </div>
              <p className="md:hidden text-xs text-black/55 truncate mt-0.5">{user.email}</p>

              {/* Desktop pills row */}
              <div className="hidden md:flex items-center gap-2 mt-1.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full bg-black/5 text-black/65 text-[10px] font-bold uppercase tracking-wider">
                  <CalendarBlank size={11} weight="bold" />
                  Since {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </span>
                {user.loyaltyTier && (
                  <button
                    type="button"
                    onClick={() => setSectionAndHash('loyalty')}
                    className="inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full bg-black/5 hover:bg-black/10 text-black/75 text-[10px] font-bold uppercase tracking-wider transition-colors"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: currentTierTheme.primaryColor || '#0a0a0a' }}
                    />
                    <Medal size={11} weight="fill" />
                    {user.loyaltyTier.name}
                  </button>
                )}
              </div>
            </div>

            {/* Action icons */}
            <div className="flex items-center gap-1.5 shrink-0">
              {user.isAdmin && (
                <Link
                  href="/admin"
                  aria-label="Admin panel"
                  className="hidden md:inline-flex w-9 h-9 rounded-full bg-black/5 hover:bg-black/10 items-center justify-center transition-colors"
                >
                  <Gear size={14} weight="bold" className="text-black/70" />
                </Link>
              )}
              <button
                type="button"
                onClick={handleSignout}
                aria-label="Sign out"
                className="w-9 h-9 rounded-full bg-black/5 hover:bg-black/10 inline-flex items-center justify-center transition-colors"
              >
                <SignOut size={14} weight="bold" className="text-black/70" />
              </button>
            </div>
          </div>

          {/* Mobile pills row */}
          <div className="md:hidden flex items-center gap-2 mt-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full bg-black/5 text-black/65 text-[10px] font-bold uppercase tracking-wider">
              <CalendarBlank size={11} weight="bold" />
              Since {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </span>
            {user.loyaltyTier && (
              <button
                type="button"
                onClick={() => setSectionAndHash('loyalty')}
                className="inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full bg-black/5 hover:bg-black/10 text-black/75 text-[10px] font-bold uppercase tracking-wider transition-colors"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: currentTierTheme.primaryColor || '#0a0a0a' }}
                />
                <Medal size={11} weight="fill" />
                {user.loyaltyTier.name}
              </button>
            )}
            {user.isAdmin && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full bg-black text-white text-[10px] font-bold uppercase tracking-wider hover:bg-black/85 transition-colors"
              >
                <Gear size={11} weight="bold" />
                Admin
              </Link>
            )}
          </div>
        </div>
      </motion.section>

      {/* Anchor for section-change scroll */}
      <div id="profile-content-top" />

      {/* Mobile section nav — sticky chips */}
      <div className="md:hidden sticky top-16 z-20 bg-white/95 backdrop-blur border-b border-black/8">
        <div className="max-w-7xl mx-auto">
          <ProfileSectionNav
            variant="chips"
            activeSection={activeSection}
            onSectionChange={setSectionAndHash}
            pendingRedemptionCount={pendingRedemptionCount}
          />
        </div>
      </div>

      {/* Sidebar + content layout */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-8 md:py-12 lg:py-14">
        <div className="md:grid md:grid-cols-[200px_1fr] md:gap-8 lg:grid-cols-[220px_1fr] lg:gap-12">
          {/* Desktop sidebar */}
          <aside className="hidden md:block">
            <div className="sticky top-[88px]">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/35 mb-3 px-4">
                Account
              </p>
              <ProfileSectionNav
                variant="sidebar"
                activeSection={activeSection}
                onSectionChange={setSectionAndHash}
                pendingRedemptionCount={pendingRedemptionCount}
              />
            </div>
          </aside>

          {/* Section content */}
          <div className="min-w-0">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={activeSection}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
                {activeSection === 'overview' && (
                  <OverviewSection
                    user={user}
                    orders={orders}
                    pointsHistory={pointsHistory}
                    ordersLoading={loadingOrders}
                    pointsLoading={loadingPoints}
                    currentTier={currentTierForOverview}
                    nextTier={nextTierForOverview}
                    annualPointsEarned={annualPointsEarned}
                    onSectionChange={setSectionAndHash}
                    tierPrimaryColor={currentTierTheme.primaryColor}
                  />
                )}
                {activeSection === 'loyalty' && (
                  <RewardsHubSection embedded openTierModalSignal={openTierModalSignal} />
                )}
                {activeSection === 'activity' && (
                  <ActivitySection
                    orders={orders}
                    pointsHistory={pointsHistory}
                    ordersLoading={loadingOrders}
                    pointsLoading={loadingPoints}
                  />
                )}
                {activeSection === 'settings' && (
                  <SettingsSection
                    user={user}
                    avatarInputRef={avatarInputRef}
                    avatarUploading={avatarUploading}
                    onSignout={handleSignout}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* Hidden file input for avatar upload */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={handleAvatarUpload}
      />
    </div>
  )
}
