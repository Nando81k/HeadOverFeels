'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useCartStore } from '@/lib/store/cart'
import { useAuth } from '@/lib/auth/context'
import { WishlistIcon } from '@/components/wishlist/WishlistIcon'
import { NotificationCenter } from '@/components/notifications/NotificationCenter'
import { SearchModal } from '@/components/search'
import { 
  Bag, 
  MagnifyingGlass, 
  UserCircle, 
  List, 
  X, 
  Trophy, 
  CaretRight,
  TShirt, 
  Hoodie, 
  Watch,
  Sparkle,
  ArrowRight,
  Fire,
  TrendUp,
  Heart,
  Bell,
  Star,
  Crown,
  SignOut,
  Gear,
  Package,
  Gift,
  Lightning
} from '@phosphor-icons/react'
import { calculateTierProgressFromPoints, getTierFromPoints } from '@/lib/loyalty/tier-progress'

// Animated counter component for smooth number transitions
function AnimatedPoints({ value, previousValue }: { value: number; previousValue: number | null }) {
  const [displayValue, setDisplayValue] = useState(value)
  const [isAnimating, setIsAnimating] = useState(false)
  const [showGain, setShowGain] = useState(false)
  const pointsGained = previousValue !== null && value > previousValue ? value - previousValue : 0
  
  useEffect(() => {
    let animationFrame: number | null = null
    let gainHideTimer: ReturnType<typeof setTimeout> | null = null

    if (previousValue !== null && value !== previousValue) {
      const startValue = previousValue
      const endValue = value
      const duration = 1500
      const startTime = Date.now()
      
      const animate = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)
        const easeOutExpo = 1 - Math.pow(2, -10 * progress)
        const currentValue = Math.round(startValue + (endValue - startValue) * easeOutExpo)
        
        setDisplayValue(currentValue)
        
        if (progress < 1) {
          animationFrame = requestAnimationFrame(animate)
        } else {
          setIsAnimating(false)
          gainHideTimer = setTimeout(() => setShowGain(false), 2000)
        }
      }
      
      animationFrame = requestAnimationFrame(() => {
        setIsAnimating(true)
        setShowGain(value > previousValue)
        animate()
      })
    } else {
      animationFrame = requestAnimationFrame(() => {
        setDisplayValue(value)
      })
    }

    return () => {
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame)
      }
      if (gainHideTimer !== null) {
        clearTimeout(gainHideTimer)
      }
    }
  }, [value, previousValue])
  
  return (
    <div className="relative flex items-center">
      <motion.span 
        className="text-xs font-black tabular-nums tracking-wide"
        animate={isAnimating ? { 
          scale: [1, 1.15, 1],
          color: ['currentColor', '#10b981', 'currentColor']
        } : {}}
        transition={{ duration: 0.3 }}
      >
        {displayValue.toLocaleString()}
      </motion.span>
      
      <AnimatePresence>
        {showGain && pointsGained > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 0, scale: 0.5 }}
            animate={{ opacity: 1, y: -16, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.8 }}
            transition={{ duration: 0.5 }}
            className="absolute -top-1 left-full ml-1 flex items-center gap-0.5 text-[10px] font-black text-emerald-500 whitespace-nowrap"
          >
            <Sparkle size={8} weight="fill" />
            +{pointsGained}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const NAV_POINTS_CACHE_KEY = 'hof_nav_points_cache'

const categories = [
  { href: '/products?category=hoodies', label: 'Hoodies', icon: Hoodie, description: 'Cozy essentials' },
  { href: '/products?category=tshirts', label: 'T-Shirts', icon: TShirt, description: 'Everyday basics' },
  { href: '/products?category=accessories', label: 'Accessories', icon: Watch, description: 'Complete your look' },
]

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const showNav = true
  const [shopDropdownOpen, setShopDropdownOpen] = useState(false)
  const [userPoints, setUserPoints] = useState<number | null>(null)
  const [previousPoints, setPreviousPoints] = useState<number | null>(null)
  
  // Tier animation states for cycling through tiers when skipping
  const [displayedTierSlug, setDisplayedTierSlug] = useState<string | null>(null)
  const [isTierAnimating, setIsTierAnimating] = useState(false)
  const previousTierSlugRef = useRef<string | null>(null)
  
  const shopDropdownRef = useRef<HTMLDivElement>(null)
  const cartItemCount = useCartStore(state => mounted ? state.getTotalItems() : 0)
  const { user, loading: authLoading, signout } = useAuth()

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0)
    return () => clearTimeout(timer)
  }, [])

  // Tier progression animation - cycles through tiers when user skips levels
  useEffect(() => {
    if (!user) return
    
    const tierOrder = ['newcomer', 'friend', 'bestie', 'soulmate']
    // Use lifetime points for tier calculation (more intuitive for users)
    const pointsForTier = user.lifetimePoints || user.annualPointsEarned || 0
    const calculatedTier = getTierFromPoints(pointsForTier)
    const currentTierSlug = calculatedTier.slug
    
    // Initialize displayed tier on first load
    if (previousTierSlugRef.current === null) {
      previousTierSlugRef.current = currentTierSlug
      return
    }
    
    // If tier changed, animate through the progression
    if (currentTierSlug !== previousTierSlugRef.current) {
      const prevIndex = tierOrder.indexOf(previousTierSlugRef.current)
      const currentIndex = tierOrder.indexOf(currentTierSlug)
      
      // Only animate if moving up tiers and skipping at least one
      if (currentIndex > prevIndex && currentIndex - prevIndex > 1) {
        setIsTierAnimating(true)
        
        // Get all tiers to animate through (excluding the previous, including current)
        const tiersToAnimate = tierOrder.slice(prevIndex + 1, currentIndex + 1)
        
        // Animate through each tier with delay
        tiersToAnimate.forEach((tierSlug, index) => {
          setTimeout(() => {
            setDisplayedTierSlug(tierSlug)
            
            // On last tier, stop animating
            if (index === tiersToAnimate.length - 1) {
              setTimeout(() => {
                setIsTierAnimating(false)
              }, 500)
            }
          }, index * 800) // 800ms per tier
        })
      } else {
        // Normal tier change (no skip), just update immediately
        setDisplayedTierSlug(currentTierSlug)
      }
      
      previousTierSlugRef.current = currentTierSlug
    }
  }, [user])

  // Keyboard shortcut: Cmd/Ctrl + K to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [searchOpen])

  const fetchUserPoints = useCallback(async () => {
    try {
      const response = await fetch('/api/loyalty/me', { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json()
        const newPoints = data.points
        
        if (user) {
          const cacheKey = `${NAV_POINTS_CACHE_KEY}_${user.id}`
          const cachedPoints = localStorage.getItem(cacheKey)
          
          if (cachedPoints !== null) {
            const cached = parseInt(cachedPoints, 10)
            if (!isNaN(cached) && cached !== newPoints) {
              setPreviousPoints(cached)
            }
          }
          
          localStorage.setItem(cacheKey, newPoints.toString())
        }
        
        setUserPoints(newPoints)
      }
    } catch (error) {
      console.error('Failed to fetch user points:', error)
    }
  }, [user])

  useEffect(() => {
    if (!user || !mounted) return

    const timeoutId = window.setTimeout(() => {
      void fetchUserPoints()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [user, mounted, pathname, fetchUserPoints])

  useEffect(() => {
    if (!user || !mounted) return

    const refreshPoints = () => {
      void fetchUserPoints()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshPoints()
      }
    }

    window.addEventListener('focus', refreshPoints)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('hof:loyalty-updated', refreshPoints as EventListener)

    return () => {
      window.removeEventListener('focus', refreshPoints)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('hof:loyalty-updated', refreshPoints as EventListener)
    }
  }, [user, mounted, fetchUserPoints])

  // Close shop dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (shopDropdownRef.current && !shopDropdownRef.current.contains(e.target as Node)) {
        setShopDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const navLinks = [
    { href: '/collections', label: 'Collections' },
    { href: '/about', label: 'About' },
  ]

  const isActive = (href: string) => pathname === href
  const isShopActive = pathname === '/products' || pathname.startsWith('/products?')
  const displayedUserPoints = userPoints ?? user?.currentPoints ?? 0

  return (
    <>
      <nav 
        className={`bg-white/98 backdrop-blur-xl fixed top-0 left-0 right-0 z-50 border-b border-black/5 transform transition-transform duration-300 ${showNav ? 'translate-y-0' : '-translate-y-full'}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 md:h-18">
          
            {/* Left - Mobile Logo + Desktop Navigation */}
            <div className="flex items-center gap-4">
              {/* Mobile & Tablet Logo - Left side */}
              <Link 
                href="/" 
                className="lg:hidden flex items-center gap-1.5 sm:gap-2 transition-all duration-300 hover:opacity-80"
              >
                <Image
                  src="/assets/head-over-feels-logo.png"
                  alt="Head Over Feels Logo"
                  width={32}
                  height={32}
                  className="object-contain w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10"
                />
                <span 
                  className="text-sm sm:text-base md:text-lg whitespace-nowrap" 
                  style={{ 
                    fontFamily: 'var(--font-logo)',
                    WebkitTextStroke: '1.5px #1A1A1A',
                    WebkitTextFillColor: 'transparent',
                    paintOrder: 'stroke fill'
                  }}
                >
                  Head Over Feels
                </span>
                <Image
                  src="/assets/head-over-feels-logo.png"
                  alt="Head Over Feels Logo"
                  width={32}
                  height={32}
                  className="object-contain w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10"
                />
              </Link>
              
              {/* Desktop Navigation Links */}
              <div className="hidden lg:flex items-center gap-8">
              {/* Shop Dropdown */}
              <div 
                ref={shopDropdownRef}
                className="relative"
                onMouseEnter={() => setShopDropdownOpen(true)}
                onMouseLeave={() => setShopDropdownOpen(false)}
              >
                <button
                  onClick={() => setShopDropdownOpen(!shopDropdownOpen)}
                  className={`flex items-center gap-1.5 text-xs font-black uppercase tracking-widest transition-colors duration-200 ${
                    isShopActive ? 'text-black' : 'text-black/50 hover:text-black'
                  }`}
                >
                  Shop
                  <CaretRight 
                    size={10} 
                    weight="bold" 
                    className={`transition-transform duration-200 ${shopDropdownOpen ? 'rotate-90' : ''}`}
                  />
                </button>
                
                {/* Modern Dropdown Menu */}
                <AnimatePresence>
                  {shopDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute top-full left-0 pt-3 z-50"
                    >
                      <div className="absolute -top-3 left-0 w-full h-3" />
                      <div className="w-72 bg-white border border-black/10 shadow-2xl shadow-black/10 overflow-hidden">
                        {/* Featured Link */}
                        <Link
                          href="/products"
                          onClick={() => setShopDropdownOpen(false)}
                          className="flex items-center justify-between p-4 bg-black text-white group"
                        >
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Browse</span>
                            <p className="text-sm font-black uppercase tracking-wide mt-0.5">All Products</p>
                          </div>
                          <ArrowRight size={16} weight="bold" className="opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                        </Link>
                        
                        {/* Categories */}
                        <div className="p-2">
                          <p className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-black/30">Categories</p>
                          
                          {categories.map((category) => {
                            const Icon = category.icon
                            return (
                              <Link
                                key={category.href}
                                href={category.href}
                                onClick={() => setShopDropdownOpen(false)}
                                className="flex items-center gap-3 px-3 py-3 text-sm group hover:bg-black/3 transition-colors"
                              >
                                <span className="w-9 h-9 bg-black/5 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors">
                                  <Icon size={18} weight="bold" />
                                </span>
                                <div className="flex-1">
                                  <p className="text-xs font-bold text-black uppercase tracking-wide">{category.label}</p>
                                  <p className="text-[10px] text-black/40">{category.description}</p>
                                </div>
                                <CaretRight size={12} weight="bold" className="text-black/20 group-hover:text-black/50 transition-colors" />
                              </Link>
                            )
                          })}
                        </div>

                        {/* Promo Banner */}
                        <div className="mx-2 mb-2 p-3 bg-linear-to-r from-black/5 to-black/0 border-l-2 border-black">
                          <div className="flex items-center gap-2">
                            <Fire size={14} weight="fill" className="text-orange-500" />
                            <p className="text-[10px] font-bold uppercase tracking-wider text-black/70">New Drops Weekly</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-xs font-black uppercase tracking-widest transition-colors duration-200 ${
                    isActive(link.href)
                      ? 'text-black'
                      : 'text-black/50 hover:text-black'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              </div>
            </div>

            {/* Center - Logo (Desktop only, centered) */}
            <Link 
              href="/" 
              className="hidden lg:flex absolute left-1/2 -translate-x-1/2 items-center gap-2 xl:gap-3 transition-all duration-300 hover:opacity-80"
            >
              <Image
                src="/assets/head-over-feels-logo.png"
                alt="Head Over Feels Logo"
                width={60}
                height={60}
                className="object-contain w-12 h-12 xl:w-16 xl:h-16"
              />
              <span 
                className="text-xl xl:text-2xl 2xl:text-3xl whitespace-nowrap" 
                style={{ 
                  fontFamily: 'var(--font-logo)',
                  WebkitTextStroke: '1.5px #1A1A1A',
                  WebkitTextFillColor: 'transparent',
                  paintOrder: 'stroke fill'
                }}
              >
                Head Over Feels
              </span>
              <Image
                src="/assets/head-over-feels-logo.png"
                alt="Head Over Feels Logo"
                width={60}
                height={60}
                className="object-contain w-12 h-12 xl:w-16 xl:h-16"
              />
            </Link>

            {/* Right - Icons + Mobile Menu Toggle */}
            <div className="flex items-center gap-0.5">
              {/* Rewards - Pill style (Desktop) */}
              {user && (
                <Link
                  href="/profile#rewards"
                  className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-black/5 hover:bg-black hover:text-white text-black transition-all duration-200"
                  title="View Profile & Rewards"
                >
                  <Trophy size={14} weight="fill" />
                  <AnimatedPoints value={displayedUserPoints} previousValue={previousPoints} />
                  <span className="text-[9px] font-bold uppercase tracking-wider opacity-50">pts</span>
                </Link>
              )}
              
              {/* Search Trigger - Clean minimal style (Desktop) */}
              <button
                onClick={() => setSearchOpen(true)}
                className="hidden lg:flex items-center justify-center w-10 h-10 text-black/40 hover:text-black hover:bg-black/5 transition-all duration-200"
                aria-label="Search"
                data-testid="nav-search-trigger-desktop"
              >
                <MagnifyingGlass size={18} weight="bold" />
              </button>

              {/* Notifications - Desktop only */}
              <div className="hidden lg:flex items-center">
                {user && <NotificationCenter />}
              </div>

              {/* Wishlist - Desktop only */}
              <div className="hidden lg:flex items-center">
                <WishlistIcon />
              </div>
              
              {/* Cart - Desktop only */}
              <Link
                href="/cart"
                className="hidden lg:flex relative p-2 text-black/50 hover:text-black hover:bg-black/5 transition-all duration-200"
                aria-label="Shopping cart"
              >
                <Bag size={20} weight="bold" />
                {cartItemCount > 0 && (
                  <span className="absolute top-0 right-0 bg-black text-white text-[9px] font-black h-4 min-w-4 px-1 flex items-center justify-center">
                    {cartItemCount > 9 ? '9+' : cartItemCount}
                  </span>
                )}
              </Link>

              {/* Sign In (Desktop) */}
              {!authLoading && (
                !user && (
                  <Link
                    href="/signin"
                    className="hidden lg:flex items-center gap-2 px-4 py-2 bg-black text-white text-[11px] font-black uppercase tracking-widest hover:bg-black/90 transition-all duration-200"
                  >
                    Sign In
                  </Link>
                )
              )}

              {/* Search Trigger - Mobile */}
              <button
                onClick={() => setSearchOpen(true)}
                className="lg:hidden p-2 text-black/60 hover:text-black transition-colors"
                aria-label="Search"
                data-testid="nav-search-trigger-mobile"
              >
                <MagnifyingGlass size={20} weight="bold" />
              </button>

              {/* Mobile Menu Toggle - Right side on mobile and tablet */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 -mr-2 ml-2 text-black/60 hover:text-black transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X size={20} weight="bold" /> : <List size={20} weight="bold" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Mobile Menu - Full Screen Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/20 z-40"
              onClick={() => setMobileMenuOpen(false)}
            />
            
            {/* Menu Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="lg:hidden fixed inset-0 w-full bg-[#F6F1EE] z-50 overflow-y-auto"
            >
              {/* Header */}
              <div className="sticky top-0 bg-[#F6F1EE] border-b border-black/5 px-5 py-4 flex items-center justify-between safe-area-inset-top z-10">
                <span className="text-xs font-black uppercase tracking-widest text-black">Menu</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 -mr-2 text-black/50 hover:text-black transition-colors"
                >
                  <X size={24} weight="bold" />
                </button>
              </div>
              
              <div className="px-4 py-5 space-y-5 pb-safe">
                
                {/* User Loyalty Tier Card - For signed in users */}
                {user && userPoints !== null && (() => {
                  // Use lifetime points for tier calculation (more intuitive for users)
                  // Fall back to annual points if lifetime is 0
                  const pointsForTier = user.lifetimePoints || user.annualPointsEarned || 0
                  const tierProgress = calculateTierProgressFromPoints(pointsForTier)
                  const actualTierSlug = tierProgress.currentTier.slug
                  
                  // Use displayed tier for visual animation, actual tier for data
                  const animatedTierSlug = displayedTierSlug || actualTierSlug
                  
                  const tierIcons: Record<string, typeof Star> = {
                    newcomer: Star,
                    friend: Heart,
                    bestie: Crown,
                    soulmate: Sparkle,
                  }
                  
                  // Tier names for display during animation
                  const tierNames: Record<string, string> = {
                    newcomer: 'Newcomer',
                    friend: 'Friend',
                    bestie: 'Bestie',
                    soulmate: 'Soulmate',
                  }
                  
                  // Tier colors matching profile and rewards pages
                  const tierColors: Record<string, { gradient: string; iconBg: string; progressBg: string; progressFill: string }> = {
                    newcomer: {
                      gradient: 'from-slate-400 via-slate-500 to-slate-600',
                      iconBg: 'bg-slate-400/30',
                      progressBg: 'bg-slate-400/30',
                      progressFill: 'bg-slate-300',
                    },
                    friend: {
                      gradient: 'from-blue-500 via-blue-600 to-indigo-700',
                      iconBg: 'bg-blue-400/30',
                      progressBg: 'bg-blue-400/30',
                      progressFill: 'bg-blue-300',
                    },
                    bestie: {
                      gradient: 'from-pink-500 via-rose-500 to-pink-600',
                      iconBg: 'bg-pink-400/30',
                      progressBg: 'bg-pink-400/30',
                      progressFill: 'bg-pink-300',
                    },
                    soulmate: {
                      gradient: 'from-purple-500 via-violet-500 to-purple-700',
                      iconBg: 'bg-purple-400/30',
                      progressBg: 'bg-purple-400/30',
                      progressFill: 'bg-purple-300',
                    },
                  }
                  
                  // Use animated tier for visuals
                  const TierIcon = tierIcons[animatedTierSlug] || Star
                  const colors = tierColors[animatedTierSlug] || tierColors.newcomer
                  const displayTierName = tierNames[animatedTierSlug] || 'Newcomer'
                  
                  return (
                    <motion.div 
                      className={`text-white p-4 space-y-4 shadow-lg relative overflow-hidden`}
                      animate={{
                        background: isTierAnimating ? undefined : undefined,
                      }}
                      style={{
                        backgroundImage: `linear-gradient(to bottom right, var(--tw-gradient-stops))`,
                      }}
                    >
                      {/* Animated gradient background */}
                      <motion.div
                        key={animatedTierSlug}
                        initial={isTierAnimating ? { opacity: 0, scale: 1.1 } : false}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4 }}
                        className={`absolute inset-0 bg-gradient-to-br ${colors.gradient}`}
                      />
                      
                      {/* Decorative elements */}
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
                      
                      {/* Tier Header */}
                      <div className="flex items-center justify-between relative">
                        <div className="flex items-center gap-3">
                          <motion.div 
                            key={`icon-${animatedTierSlug}`}
                            initial={isTierAnimating ? { scale: 0, rotate: -180 } : false}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                            className={`w-10 h-10 ${colors.iconBg} flex items-center justify-center`}
                          >
                            <TierIcon size={20} weight="fill" />
                          </motion.div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                              {isTierAnimating ? 'Leveling Up!' : 'Your Tier'}
                            </p>
                            <motion.p 
                              key={`name-${animatedTierSlug}`}
                              initial={isTierAnimating ? { opacity: 0, y: 10 } : false}
                              animate={{ opacity: 1, y: 0 }}
                              className="text-base font-black uppercase tracking-wide"
                            >
                              {displayTierName}
                            </motion.p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">Points</p>
                          <div className="flex items-center gap-1">
                            <motion.span 
                              className="text-xl font-black tabular-nums"
                              animate={previousPoints !== null && userPoints > previousPoints ? {
                                scale: [1, 1.15, 1],
                              } : {}}
                            >
                              <AnimatedPoints value={userPoints} previousValue={previousPoints} />
                            </motion.span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Animating indicator */}
                      {isTierAnimating && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex items-center justify-center gap-2 py-2 relative"
                        >
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          >
                            <Sparkle size={16} weight="fill" className="text-amber-300" />
                          </motion.div>
                          <span className="text-xs font-bold text-white/80">Tier upgrade in progress...</span>
                        </motion.div>
                      )}
                      
                      {/* Progress to next tier - always show accurate data */}
                      {!tierProgress.isMaxTier && tierProgress.nextTier && tierProgress.pointsNeeded > 0 && (
                        <motion.div 
                          className="space-y-2 relative"
                          initial={isTierAnimating ? { opacity: 0 } : false}
                          animate={{ opacity: 1 }}
                          transition={{ delay: isTierAnimating ? 0.3 : 0 }}
                        >
                          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                            <span className="text-white/60">Progress to {tierProgress.nextTier.name}</span>
                            <span className="text-white/80">{Math.round(tierProgress.progressPercentage)}%</span>
                          </div>
                          <div className={`h-1.5 ${colors.progressBg} overflow-hidden rounded-full`}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${tierProgress.progressPercentage}%` }}
                              transition={{ duration: 0.8, ease: 'easeOut' }}
                              className={`h-full ${colors.progressFill} rounded-full`}
                            />
                          </div>
                          <p className="text-[10px] text-white/50">
                            {tierProgress.pointsNeeded.toLocaleString()} pts needed
                          </p>
                        </motion.div>
                      )}
                      
                      {tierProgress.isMaxTier && (
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white/70 relative">
                          <Sparkle size={12} weight="fill" className="text-amber-300" />
                          Max tier achieved!
                        </div>
                      )}
                      
                      {/* Quick tier perks */}
                      <div className="flex flex-wrap gap-3 pt-1 relative">
                        {user.loyaltyTier?.freeShipping && (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/80">
                            <Package size={12} weight="bold" />
                            Free Shipping
                          </div>
                        )}
                        {user.loyaltyTier?.earlyDropAccess && (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/80">
                            <Lightning size={12} weight="bold" />
                            Early Access
                          </div>
                        )}
                        {tierProgress.currentTier.pointMultiplier > 1 && (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/80">
                            <TrendUp size={12} weight="bold" />
                            {tierProgress.currentTier.pointMultiplier}x Points
                          </div>
                        )}
                      </div>
                      
                      {/* View Rewards Link */}
                      <Link
                        href="/profile#rewards"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center justify-between pt-3 border-t border-white/20 group relative"
                      >
                        <span className="text-xs font-bold uppercase tracking-wider text-white/80 group-hover:text-white transition-colors">
                          View Rewards
                        </span>
                        <ArrowRight size={14} weight="bold" className="text-white/60 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                      </Link>
                    </motion.div>
                  )
                })()}
                
                {/* Guest Sign In CTA */}
                {!user && !authLoading && (
                  <Link
                    href="/signin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between p-4 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 text-white group shadow-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/10 flex items-center justify-center">
                        <UserCircle size={20} weight="bold" />
                      </div>
                      <div>
                        <p className="text-sm font-black uppercase tracking-wide">Sign In</p>
                        <p className="text-[10px] font-medium text-white/50">Earn rewards on every order</p>
                      </div>
                    </div>
                    <ArrowRight size={16} weight="bold" className="text-white/40 group-hover:text-white transition-colors" />
                  </Link>
                )}
                
                {/* Primary Actions - Cart & Wishlist */}
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/cart"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 p-4 bg-black text-white"
                  >
                    <div className="relative">
                      <Bag size={20} weight="bold" />
                      {cartItemCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 bg-white text-black text-[9px] font-black w-4 h-4 flex items-center justify-center">
                          {cartItemCount > 9 ? '9+' : cartItemCount}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider">Cart</p>
                      {cartItemCount > 0 && (
                        <p className="text-[10px] font-medium text-white/50">{cartItemCount} item{cartItemCount !== 1 ? 's' : ''}</p>
                      )}
                    </div>
                  </Link>
                  <Link
                    href="/wishlist"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 p-4 border border-black text-black hover:bg-black hover:text-white transition-colors"
                  >
                    <Heart size={20} weight="bold" />
                    <p className="text-xs font-black uppercase tracking-wider">Wishlist</p>
                  </Link>
                </div>
                
                {/* Shop Section */}
                <div className="space-y-1 bg-white p-1">
                  <p className="px-3 pt-2 text-[9px] font-black uppercase tracking-widest text-black/30">Shop</p>
                  
                  <Link
                    href="/products"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-4 py-3.5 transition-all ${
                      isShopActive
                        ? 'bg-black text-white'
                        : 'text-black hover:bg-black/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Bag size={18} weight="bold" />
                      <span className="text-sm font-black uppercase tracking-wider">All Products</span>
                    </div>
                    <CaretRight size={14} weight="bold" className="opacity-40" />
                  </Link>
                  
                  {/* Categories */}
                  {categories.map((category) => {
                    const Icon = category.icon
                    return (
                      <Link
                        key={category.href}
                        href={category.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center justify-between px-4 py-3 text-black/70 hover:text-black hover:bg-black/5 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <Icon size={16} weight="bold" />
                          <span className="text-xs font-bold uppercase tracking-wider">{category.label}</span>
                        </div>
                        <CaretRight size={12} weight="bold" className="opacity-30" />
                      </Link>
                    )
                  })}
                </div>
                
                {/* Navigation Links */}
                <div className="space-y-1 bg-white p-1">
                  <p className="px-3 pt-2 text-[9px] font-black uppercase tracking-widest text-black/30">Explore</p>
                  
                  {navLinks.map(link => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-4 py-3.5 transition-all ${
                        isActive(link.href)
                          ? 'bg-black text-white'
                          : 'text-black hover:bg-black/5'
                      }`}
                    >
                      <span className="text-sm font-black uppercase tracking-wider">{link.label}</span>
                      <CaretRight size={14} weight="bold" className="opacity-40" />
                    </Link>
                  ))}
                </div>
                
                {/* Account Section - For signed in users */}
                {user && (
                  <div className="space-y-1 bg-white p-1">
                    <p className="px-3 pt-2 text-[9px] font-black uppercase tracking-widest text-black/30">Account</p>
                    
                    <Link
                      href="/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-between px-4 py-3.5 text-black hover:bg-black/5 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <UserCircle size={18} weight="fill" />
                        <span className="text-sm font-black uppercase tracking-wider">My Profile</span>
                      </div>
                      <CaretRight size={14} weight="bold" className="opacity-40" />
                    </Link>
                    
                    <Link
                      href="/orders"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-between px-4 py-3 text-black/70 hover:text-black hover:bg-black/5 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <Package size={16} weight="bold" />
                        <span className="text-xs font-bold uppercase tracking-wider">My Orders</span>
                      </div>
                      <CaretRight size={12} weight="bold" className="opacity-30" />
                    </Link>
                    
                    <Link
                      href="/profile#rewards"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-between px-4 py-3 text-black/70 hover:text-black hover:bg-black/5 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <Gift size={16} weight="bold" />
                        <span className="text-xs font-bold uppercase tracking-wider">Rewards</span>
                      </div>
                      <CaretRight size={12} weight="bold" className="opacity-30" />
                    </Link>
                    
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false)
                        setTimeout(() => {
                          const notificationBtn = document.querySelector('[aria-label*="Notifications"]') as HTMLButtonElement
                          if (notificationBtn) notificationBtn.click()
                        }, 350)
                      }}
                      className="w-full flex items-center justify-between px-4 py-3 text-black/70 hover:text-black hover:bg-black/5 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <Bell size={16} weight="bold" />
                        <span className="text-xs font-bold uppercase tracking-wider">Notifications</span>
                      </div>
                      <CaretRight size={12} weight="bold" className="opacity-30" />
                    </button>
                    
                    <Link
                      href="/profile/notifications"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-between px-4 py-3 text-black/70 hover:text-black hover:bg-black/5 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <Gear size={16} weight="bold" />
                        <span className="text-xs font-bold uppercase tracking-wider">Settings</span>
                      </div>
                      <CaretRight size={12} weight="bold" className="opacity-30" />
                    </Link>
                  </div>
                )}
                
                {/* Footer - Sign Out or Help */}
                <div className="pt-2">
                  {user ? (
                    <button
                      onClick={async () => {
                        setMobileMenuOpen(false)
                        await signout()
                        router.push('/')
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-black/50 hover:text-black hover:bg-black/5 transition-all"
                    >
                      <SignOut size={16} weight="bold" />
                      <span className="text-xs font-bold uppercase tracking-wider">Sign Out</span>
                    </button>
                  ) : (
                    <Link
                      href="/contact"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-center gap-2 px-4 py-3.5 text-black/50 hover:text-black hover:bg-black/5 transition-all"
                    >
                      <span className="text-xs font-bold uppercase tracking-wider">Need Help?</span>
                    </Link>
                  )}
                </div>
                
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
