'use client'

import { useEffect, useState, useCallback, useRef, useMemo, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Navigation } from '@/components/layout/Navigation'
import { useAuth } from '@/lib/auth/context'
import { 
  User, Package, SignOut, CircleNotch, Medal, Sparkle, Gift,
  ArrowRight, Gear, ClockCounterClockwise, ShoppingBag, Star, Coins, 
  Confetti, Heart, CalendarBlank, Envelope, Crown
} from '@phosphor-icons/react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { calculateTierProgressFromPoints } from '@/lib/loyalty/tier-progress'
import { toast } from '@/lib/toast'
import { RewardsHubSection } from '@/components/profile/RewardsHubSection'
import { LoyaltyTierMeter } from '@/components/profile/LoyaltyTierMeter'

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

// Tier configuration with colors
const tierConfig: Record<string, { 
  name: string
  gradient: string
  iconBg: string
  progressBg: string
  progressFill: string
  badge: string
  glow: string
  emoji: string
  multiplier: number
  benefits: string[]
}> = {
  newcomer: {
    name: 'Newcomer',
    gradient: 'from-slate-400 via-slate-500 to-slate-600',
    iconBg: 'bg-slate-400/30',
    progressBg: 'bg-slate-400/30',
    progressFill: 'bg-slate-300',
    badge: 'bg-slate-400/30',
    glow: 'shadow-slate-500/50',
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
    gradient: 'from-blue-500 via-blue-600 to-indigo-700',
    iconBg: 'bg-blue-400/30',
    progressBg: 'bg-blue-400/30',
    progressFill: 'bg-blue-300',
    badge: 'bg-blue-400/30',
    glow: 'shadow-blue-500/50',
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
    gradient: 'from-pink-500 via-rose-500 to-pink-600',
    iconBg: 'bg-pink-400/30',
    progressBg: 'bg-pink-400/30',
    progressFill: 'bg-pink-300',
    badge: 'bg-pink-400/30',
    glow: 'shadow-pink-500/50',
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
    gradient: 'from-purple-500 via-violet-500 to-purple-700',
    iconBg: 'bg-purple-400/30',
    progressBg: 'bg-purple-400/30',
    progressFill: 'bg-purple-300',
    badge: 'bg-purple-400/30',
    glow: 'shadow-purple-500/50',
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

type ProfileTab = 'profile' | 'rewards'

const PROFILE_TAB_ORDER: ProfileTab[] = ['profile', 'rewards']

const getProfileTabFromHash = (hash: string): ProfileTab => {
  return hash.replace('#', '').toLowerCase() === 'rewards' ? 'rewards' : 'profile'
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
  const [activeTab, setActiveTab] = useState<ProfileTab>('profile')
  const [hasLoadedRewards, setHasLoadedRewards] = useState(false)
  const [openTierModalSignal, setOpenTierModalSignal] = useState(0)
  const tabButtonRefs = useRef<Record<ProfileTab, HTMLButtonElement | null>>({
    profile: null,
    rewards: null,
  })

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/signin')
    }
  }, [user, authLoading, router])

  const setTabAndHash = useCallback((tab: ProfileTab) => {
    setActiveTab(tab)
    if (tab === 'rewards') {
      setHasLoadedRewards(true)
    }

    if (typeof window === 'undefined') return
    const nextHash = `#${tab}`
    if (window.location.hash === nextHash) return
    const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`
    window.history.replaceState(null, '', nextUrl)
  }, [])

  const handleViewBenefits = useCallback(() => {
    setTabAndHash('rewards')
    setOpenTierModalSignal((signal) => signal + 1)
  }, [setTabAndHash])

  const handleTabKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>, currentTab: ProfileTab) => {
    const currentIndex = PROFILE_TAB_ORDER.indexOf(currentTab)
    let nextTab: ProfileTab | null = null

    if (event.key === 'ArrowRight') {
      nextTab = PROFILE_TAB_ORDER[(currentIndex + 1) % PROFILE_TAB_ORDER.length]
    } else if (event.key === 'ArrowLeft') {
      nextTab = PROFILE_TAB_ORDER[(currentIndex - 1 + PROFILE_TAB_ORDER.length) % PROFILE_TAB_ORDER.length]
    } else if (event.key === 'Home') {
      nextTab = PROFILE_TAB_ORDER[0]
    } else if (event.key === 'End') {
      nextTab = PROFILE_TAB_ORDER[PROFILE_TAB_ORDER.length - 1]
    }

    if (!nextTab) return

    event.preventDefault()
    setTabAndHash(nextTab)
    tabButtonRefs.current[nextTab]?.focus()
  }, [setTabAndHash])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const syncFromHash = () => {
      const tabFromHash = getProfileTabFromHash(window.location.hash)
      setActiveTab(tabFromHash)
      if (tabFromHash === 'rewards') {
        setHasLoadedRewards(true)
      }
    }

    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [])

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
      const previousProgress = calculateTierProgressFromPoints(previousAnnualPoints).progressPercentage

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

    let expectedTierSlug = 'newcomer'
    if (annualPoints >= 7500) expectedTierSlug = 'soulmate'
    else if (annualPoints >= 3000) expectedTierSlug = 'bestie'
    else if (annualPoints >= 1000) expectedTierSlug = 'friend'

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
  }, [user, getPendingLoyaltyAnimation, clearPendingLoyaltyAnimation, refreshUser])

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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const tierProgress = useMemo(() => {
    if (!user) return null
    // Use lifetime points for tier calculation (tiers never reset)
    const pointsForTier = user.lifetimePoints || user.annualPointsEarned || 0
    return calculateTierProgressFromPoints(pointsForTier)
  }, [user])

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

  // Use calculated tier from lifetimePoints, not database tier (tiers never reset)
  const calculatedTierSlug = tierProgress?.currentTier.slug || 'newcomer'
  const currentTierConfig = getTierConfig(calculatedTierSlug)
  const previousTierConfig = previousTierSlug ? getTierConfig(previousTierSlug) : null
  const activeTierSlug = displayTierSlug || calculatedTierSlug
  const activeTierConfig = getTierConfig(activeTierSlug)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DELIVERED': return 'bg-emerald-500'
      case 'SHIPPED': return 'bg-violet-500'
      case 'PROCESSING': return 'bg-blue-500'
      default: return 'bg-black/40'
    }
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'PURCHASE': return <ShoppingBag size={16} weight="bold" className="text-emerald-600" />
      case 'REVIEW': return <Star size={16} weight="fill" className="text-amber-500" />
      case 'REDEMPTION': return <Gift size={16} weight="bold" className="text-purple-600" />
      default: return <Sparkle size={16} weight="fill" className="text-blue-600" />
    }
  }

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
              <div className={`bg-linear-to-br ${currentTierConfig.gradient} p-8 text-white text-center relative overflow-hidden`}>
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
                        <div className={`w-6 h-6 bg-linear-to-br ${currentTierConfig.gradient} flex items-center justify-center shrink-0 mt-0.5`}>
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
                  className={`w-full mt-6 py-4 bg-linear-to-r ${currentTierConfig.gradient} text-white font-bold text-lg uppercase tracking-wider`}
                >
                  Start Earning {currentTierConfig.multiplier}x Points
                </motion.button>
                
                <p className="text-center text-black/40 text-xs mt-4">Click anywhere to close</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editorial Hero Section */}
      <section className="pt-20 md:pt-24 pb-8 md:pb-12 px-4 sm:px-8 border-b border-black/10">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 lg:gap-8"
          >
            <div className="flex-1 min-w-0 space-y-4">
              {/* User Info */}
              <div className="flex items-start gap-3 md:gap-4">
                <div className="w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 bg-black flex items-center justify-center shrink-0">
                  <User size={24} weight="bold" className="text-white md:hidden" />
                  <User size={30} weight="bold" className="text-white hidden md:block" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] md:text-xs font-medium text-black/50 uppercase tracking-wider mb-0.5 md:mb-1">My Account</p>
                  <h1 className="text-xl md:text-2xl lg:text-3xl font-black text-black tracking-tight leading-tight break-words whitespace-normal">
                    {user.name || 'Welcome'}
                  </h1>
                  <p className="text-xs md:text-sm text-black/60 mt-0.5 md:mt-1 break-all whitespace-normal">{user.email}</p>
                </div>
              </div>

              {/* Action Buttons - Full width on mobile */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {user.isAdmin && (
                  <Link
                    href="/admin"
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-black text-white text-xs font-bold uppercase tracking-wider hover:bg-black/80 transition-colors"
                  >
                    <Gear size={14} weight="bold" />
                    Admin
                  </Link>
                )}
                <button
                  onClick={handleSignout}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 border-2 border-black text-black text-xs font-bold uppercase tracking-wider hover:bg-black hover:text-white transition-colors"
                >
                  <SignOut size={14} weight="bold" />
                  Sign Out
                </button>
              </div>
            </div>

            {user.loyaltyTier && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: tierTransitionPhase === 'celebrating' ? [1, 1.01, 1] : 1,
                }}
                transition={{ delay: 0.1, scale: { duration: 0.6 } }}
                className={`relative overflow-hidden text-white w-full lg:w-[760px] xl:w-[840px] shrink-0 transition-all duration-500 ${
                  tierTransitionPhase === 'celebrating' ? `shadow-2xl ${currentTierConfig.glow}` : ''
                }`}
              >
                <motion.div
                  initial={{ opacity: 1 }}
                  animate={{ opacity: tierTransitionPhase === 'resetting' || tierTransitionPhase === 'complete' ? 0 : 1 }}
                  transition={{ duration: 0.8 }}
                  className={`absolute inset-0 bg-linear-to-br ${previousTierConfig?.gradient || activeTierConfig.gradient}`}
                />
                <motion.div
                  initial={{ opacity: shouldAnimateTier ? 0 : 1 }}
                  animate={{ opacity: tierTransitionPhase === 'resetting' || tierTransitionPhase === 'complete' ? 1 : (shouldAnimateTier ? 0 : 1) }}
                  transition={{ duration: 0.8 }}
                  className={`absolute inset-0 bg-linear-to-br ${currentTierConfig.gradient}`}
                />

                <motion.div
                  animate={tierTransitionPhase === 'celebrating' ? { scale: [1, 1.5, 1], opacity: [0.1, 0.3, 0.1] } : {}}
                  transition={{ duration: 2 }}
                  className="absolute top-0 right-0 w-32 md:w-56 h-32 md:h-56 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"
                />
                <motion.div
                  className="absolute bottom-0 left-0 w-24 md:w-40 h-24 md:h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl"
                />

                <AnimatePresence>
                  {tierTransitionPhase === 'celebrating' && (
                    <motion.div
                      initial={{ x: '-100%', opacity: 0 }}
                      animate={{ x: '200%', opacity: [0, 0.5, 0] }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1.5 }}
                      className="absolute inset-0 w-1/2 bg-linear-to-r from-transparent via-white/30 to-transparent skew-x-12"
                    />
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {tierTransitionPhase === 'resetting' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 0.8, 0] }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.6 }}
                      className="absolute inset-0 bg-white"
                    />
                  )}
                </AnimatePresence>

                <div className="relative p-3 md:p-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2 md:gap-4">
                      <motion.div
                        animate={tierTransitionPhase === 'celebrating' ? { rotate: [0, -15, 15, -10, 10, 0], scale: [1, 1.3, 1] } : {}}
                        transition={{ duration: 0.8 }}
                        className={`w-10 h-10 md:w-12 md:h-12 ${activeTierConfig.iconBg} backdrop-blur-sm flex items-center justify-center shrink-0`}
                      >
                        <Crown size={18} weight="fill" className="text-white md:hidden" />
                        <Crown size={22} weight="fill" className="text-white hidden md:block" />
                      </motion.div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] md:text-xs font-medium uppercase tracking-wider text-white/70 mb-0.5">Loyalty Tier</p>
                        <AnimatePresence mode="wait">
                          <motion.h2
                            key={activeTierSlug}
                            initial={{ opacity: 0, y: 20, scale: 0.8 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.8 }}
                            transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
                            className="text-lg md:text-xl font-black"
                          >
                            {displayTierSlug ? getTierConfig(displayTierSlug).name : user.loyaltyTier.name}
                          </motion.h2>
                        </AnimatePresence>
                        <AnimatePresence mode="wait">
                          <motion.p
                            key={activeTierSlug}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-white/80 mt-0.5 text-[11px] md:text-xs"
                          >
                            Earning {displayTierSlug ? getTierConfig(displayTierSlug).multiplier : currentTierConfig.multiplier}x points
                          </motion.p>
                        </AnimatePresence>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <div className={`${activeTierConfig.iconBg} backdrop-blur-sm px-2 py-1.5`}>
                          <p className="text-[9px] uppercase tracking-wider text-white/70">Multiplier</p>
                          <p className="text-sm md:text-base font-black">
                            {displayTierSlug ? getTierConfig(displayTierSlug).multiplier : currentTierConfig.multiplier}x
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleViewBenefits}
                          className="bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/90 focus-visible:ring-offset-1 focus-visible:ring-offset-black/10"
                        >
                          View Benefits
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      <motion.div
                        animate={shouldAnimatePoints || tierTransitionPhase === 'celebrating' ? { scale: [1, 1.05, 1] } : {}}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className={`${activeTierConfig.iconBg} backdrop-blur-sm p-2.5 md:p-3 relative`}
                      >
                        <AnimatePresence>
                          {(shouldAnimatePoints || shouldAnimateTier) && pointsGained > 0 && (
                            <motion.div
                              initial={{ opacity: 1, y: 0 }}
                              animate={{ opacity: 0, y: -30 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 1.5, delay: 1 }}
                              className="absolute top-1 right-2 text-[10px] md:text-xs font-bold text-green-300"
                            >
                              +{pointsGained.toLocaleString()}
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <p className="text-[10px] uppercase tracking-wider text-white/70 mb-0.5">Available</p>
                        <motion.p
                          animate={shouldAnimatePoints ? { scale: [1, 1.1, 1] } : {}}
                          transition={{ duration: 0.4, delay: 0.5 }}
                          className="text-base md:text-xl font-black"
                        >
                          {user.currentPoints.toLocaleString()}
                        </motion.p>
                      </motion.div>

                      <div className={`${activeTierConfig.iconBg} backdrop-blur-sm p-2.5 md:p-3`}>
                        <p className="text-[10px] uppercase tracking-wider text-white/70 mb-0.5">Total Spent</p>
                        <p className="text-base md:text-xl font-black">${user.totalSpent.toFixed(0)}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setTabAndHash('rewards')}
                        className="col-span-2 md:col-span-1 flex items-center justify-center gap-1.5 bg-white text-black px-2.5 md:px-3 py-2.5 md:py-3 font-bold uppercase tracking-wider text-[11px] hover:bg-white/90 transition-colors"
                      >
                        Redeem Rewards
                        <ArrowRight size={14} weight="bold" />
                      </button>
                    </div>

                    {tierProgress && (
                      <LoyaltyTierMeter
                        className="w-full"
                        compact
                        isMaxTier={tierProgress.isMaxTier}
                        nextTierName={tierProgress.nextTier?.name}
                        pointsNeeded={tierProgress.pointsNeeded}
                        progressPercentage={animatedProgress}
                        title={
                          tierTransitionPhase === 'filling' || tierTransitionPhase === 'celebrating'
                            ? 'Leveling up'
                            : `Next: ${tierProgress.nextTier?.name || 'Next Tier'}`
                        }
                        statusLabel={
                          tierTransitionPhase === 'filling'
                            ? 'Progressing...'
                            : tierTransitionPhase === 'celebrating'
                              ? 'Level up'
                              : `${tierProgress.pointsNeeded.toLocaleString()} pts`
                        }
                        isAnimating={
                          shouldAnimatePoints ||
                          tierTransitionPhase === 'filling' ||
                          tierTransitionPhase === 'celebrating'
                        }
                        showShimmer={shouldAnimatePoints || tierTransitionPhase === 'filling'}
                      />
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </section>

      <section className="sticky top-16 md:top-[72px] z-30 border-b border-black/10 bg-white/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3">
          <div
            role="tablist"
            aria-label="Profile sections"
            className="inline-flex items-center rounded-full border border-black/15 bg-black/[0.02] p-1"
          >
            {PROFILE_TAB_ORDER.map((tab) => {
              const isTabActive = activeTab === tab
              const label = tab === 'profile' ? 'Profile' : 'Rewards'
              const Icon = tab === 'profile' ? User : Gift
              const tabId = `${tab}-tab`
              const panelId = `${tab}-panel`

              return (
                <button
                  key={tab}
                  id={tabId}
                  ref={(node) => {
                    tabButtonRefs.current[tab] = node
                  }}
                  type="button"
                  role="tab"
                  aria-selected={isTabActive}
                  aria-controls={panelId}
                  tabIndex={isTabActive ? 0 : -1}
                  data-state={isTabActive ? 'active' : 'inactive'}
                  onClick={() => setTabAndHash(tab)}
                  onKeyDown={(event) => handleTabKeyDown(event, tab)}
                  className={`relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs md:text-sm font-bold uppercase tracking-wider transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${
                    isTabActive
                      ? 'bg-black text-white shadow-sm'
                      : 'text-black/65 hover:text-black'
                  }`}
                >
                  <Icon size={14} weight={isTabActive ? 'fill' : 'bold'} />
                  <span>{label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <div
        id="profile-panel"
        role="tabpanel"
        aria-labelledby="profile-tab"
        hidden={activeTab !== 'profile'}
        className={activeTab === 'profile' ? 'block' : 'hidden'}
      >

      {/* Stats Grid */}
      <section className="py-6 md:py-8 px-4 sm:px-8 border-b border-black/10">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
          >
            <div className="border border-black/10 p-4 md:p-6">
              <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                <CalendarBlank size={16} weight="bold" className="text-black/40 md:hidden" />
                <CalendarBlank size={20} weight="bold" className="text-black/40 hidden md:block" />
                <p className="text-[10px] md:text-xs uppercase tracking-wider text-black/50">Member Since</p>
              </div>
              <p className="text-lg md:text-2xl lg:text-3xl font-black text-black">
                {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </p>
            </div>
            <div className="border border-black/10 p-4 md:p-6">
              <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                <Package size={16} weight="bold" className="text-black/40 md:hidden" />
                <Package size={20} weight="bold" className="text-black/40 hidden md:block" />
                <p className="text-[10px] md:text-xs uppercase tracking-wider text-black/50">Total Orders</p>
              </div>
              <p className="text-lg md:text-2xl lg:text-3xl font-black text-black">{user.totalOrders || orders.length}</p>
            </div>
            <div className="border border-black/10 p-4 md:p-6">
              <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                <Sparkle size={16} weight="bold" className="text-black/40 md:hidden" />
                <Sparkle size={20} weight="bold" className="text-black/40 hidden md:block" />
                <p className="text-[10px] md:text-xs uppercase tracking-wider text-black/50">Lifetime Pts</p>
              </div>
              <p className="text-lg md:text-2xl lg:text-3xl font-black text-black">{user.lifetimePoints?.toLocaleString() || 0}</p>
            </div>
            <div className="border border-black/10 p-4 md:p-6">
              <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                <Envelope size={16} weight="bold" className="text-black/40 md:hidden" />
                <Envelope size={20} weight="bold" className="text-black/40 hidden md:block" />
                <p className="text-[10px] md:text-xs uppercase tracking-wider text-black/50">Newsletter</p>
              </div>
              <p className="text-lg md:text-2xl lg:text-3xl font-black text-black">{user.newsletter ? 'Yes' : 'No'}</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Two Column Layout: Points History + Recent Orders */}
      <section className="py-8 md:py-12 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
            
            {/* Points History */}
            {user.loyaltyTier && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-center justify-between mb-4 md:mb-6">
                  <h2 className="text-xl md:text-2xl lg:text-3xl font-black text-black flex items-center gap-2 md:gap-3">
                    <ClockCounterClockwise size={22} weight="bold" className="md:hidden" />
                    <ClockCounterClockwise size={28} weight="bold" className="hidden md:block" />
                    Points History
                  </h2>
                  <Link
                    href="/loyalty/history"
                    className="text-xs md:text-sm font-bold uppercase tracking-wider text-black/60 hover:text-black transition-colors flex items-center gap-1 md:gap-2"
                  >
                    View All
                    <ArrowRight size={14} className="md:hidden" />
                    <ArrowRight size={16} className="hidden md:block" />
                  </Link>
                </div>
                
                {loadingPoints ? (
                  <div className="flex items-center justify-center py-12 md:py-16 border border-black/10">
                    <CircleNotch size={24} weight="bold" className="animate-spin text-black/30" />
                  </div>
                ) : pointsHistory.length === 0 ? (
                  <div className="text-center py-12 md:py-16 border border-black/10">
                    <Coins size={32} weight="light" className="text-black/20 mx-auto mb-3 md:hidden" />
                    <Coins size={40} weight="light" className="text-black/20 mx-auto mb-3 hidden md:block" />
                    <p className="text-black/50 font-medium text-sm md:text-base">No points activity yet</p>
                    <p className="text-xs md:text-sm text-black/40 mt-1">Start shopping to earn points!</p>
                  </div>
                ) : (
                  <div className="border border-black/10 divide-y divide-black/10">
                    {pointsHistory.slice(0, 5).map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-4 md:p-5 hover:bg-black/2 transition-colors">
                        <div className="flex items-center gap-3 md:gap-4 min-w-0">
                          <div className="w-8 h-8 md:w-10 md:h-10 bg-black/5 flex items-center justify-center shrink-0">
                            {getTransactionIcon(tx.type)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-black text-sm md:text-base truncate">{tx.description}</p>
                            <p className="text-xs md:text-sm text-black/50">
                              {new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                        </div>
                        <span className={`text-base md:text-lg font-black shrink-0 ml-2 ${tx.points > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {tx.points > 0 ? '+' : ''}{tx.points}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
            
            {/* Recent Orders */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className={!user.loyaltyTier ? 'lg:col-span-2' : ''}
            >
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <h2 className="text-xl md:text-2xl lg:text-3xl font-black text-black flex items-center gap-2 md:gap-3">
                  <Package size={22} weight="bold" className="md:hidden" />
                  <Package size={28} weight="bold" className="hidden md:block" />
                  Recent Orders
                </h2>
                {orders.length > 0 && (
                  <Link
                    href="/orders"
                    className="text-xs md:text-sm font-bold uppercase tracking-wider text-black/60 hover:text-black transition-colors flex items-center gap-1 md:gap-2"
                  >
                    View All
                    <ArrowRight size={14} className="md:hidden" />
                    <ArrowRight size={16} className="hidden md:block" />
                  </Link>
                )}
              </div>
              
              {loadingOrders ? (
                <div className="flex items-center justify-center py-12 md:py-16 border border-black/10">
                  <CircleNotch size={24} weight="bold" className="animate-spin text-black/30" />
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-12 md:py-16 border border-black/10">
                  <ShoppingBag size={32} weight="light" className="text-black/20 mx-auto mb-3 md:hidden" />
                  <ShoppingBag size={40} weight="light" className="text-black/20 mx-auto mb-3 hidden md:block" />
                  <p className="text-black/50 font-medium mb-4 text-sm md:text-base">No orders yet</p>
                  <Link
                    href="/products"
                    className="inline-flex items-center gap-2 bg-black text-white px-5 md:px-6 py-2.5 md:py-3 font-bold uppercase tracking-wider text-sm hover:bg-black/80 transition-colors"
                  >
                    Start Shopping
                    <ArrowRight size={16} />
                  </Link>
                </div>
              ) : (
                <div className="border border-black/10 divide-y divide-black/10">
                  {orders.slice(0, 5).map((order) => (
                    <Link
                      key={order.id}
                      href={`/order/track/${order.id}`}
                      className="flex items-center justify-between p-4 md:p-5 hover:bg-black/2 transition-colors group"
                    >
                      <div className="flex items-center gap-3 md:gap-4 min-w-0">
                        <div className={`w-2.5 h-2.5 md:w-3 md:h-3 ${getStatusColor(order.status)} shrink-0`} />
                        <div className="min-w-0">
                          <p className="font-bold text-black text-sm md:text-base">Order #{order.orderNumber}</p>
                          <p className="text-xs md:text-sm text-black/50 truncate max-w-[150px] md:max-w-xs">
                            {order.items.slice(0, 2).map(i => i.productName).join(', ')}
                            {order.items.length > 2 && ` +${order.items.length - 2}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-2 md:gap-4 shrink-0">
                        <div>
                          <p className="font-black text-black text-sm md:text-base">${order.total.toFixed(2)}</p>
                          <p className="text-xs md:text-sm text-black/50">
                            {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                        <ArrowRight size={16} className="text-black/30 group-hover:text-black transition-colors hidden md:block" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="py-8 md:py-12 px-4 sm:px-8 border-t border-black/10 bg-black/2">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-xl md:text-2xl lg:text-3xl font-black text-black mb-6 md:mb-8">Quick Actions</h2>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
          >
            <Link
              href="/products"
              className="flex items-center justify-center gap-2 md:gap-3 bg-black text-white py-4 md:py-5 font-bold uppercase tracking-wider text-xs md:text-sm hover:bg-black/80 transition-colors"
            >
              <ShoppingBag size={18} weight="bold" />
              Shop Now
            </Link>
            <Link
              href="/wishlist"
              className="flex items-center justify-center gap-2 md:gap-3 border-2 border-black text-black py-4 md:py-5 font-bold uppercase tracking-wider text-xs md:text-sm hover:bg-black hover:text-white transition-colors"
            >
              <Heart size={18} weight="bold" />
              Wishlist
            </Link>
            <div
              className="flex items-center justify-center gap-2 md:gap-3 border-2 border-black/30 text-black/40 py-4 md:py-5 font-bold uppercase tracking-wider text-xs md:text-sm cursor-not-allowed"
              title="Avatar customization coming soon!"
            >
              <User size={18} weight="bold" />
              Coming Soon
            </div>
            <Link
              href="/collections"
              className="flex items-center justify-center gap-2 md:gap-3 border-2 border-black text-black py-4 md:py-5 font-bold uppercase tracking-wider text-xs md:text-sm hover:bg-black hover:text-white transition-colors"
            >
              <Star size={18} weight="bold" />
              Collections
            </Link>
          </motion.div>
        </div>
      </section>
      </div>

      <div
        id="rewards-panel"
        role="tabpanel"
        aria-labelledby="rewards-tab"
        hidden={activeTab !== 'rewards'}
        className={activeTab === 'rewards' ? 'block' : 'hidden'}
      >
        {hasLoadedRewards && <RewardsHubSection embedded openTierModalSignal={openTierModalSignal} />}
      </div>
    </div>
  )
}
