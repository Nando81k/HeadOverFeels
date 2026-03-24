'use client'

import { useState, useEffect, useCallback, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useCartStore } from '@/lib/store/cart'
import { useAuth } from '@/lib/auth/context'
import { WishlistIcon } from '@/components/wishlist/WishlistIcon'
import { NotificationCenter } from '@/components/notifications/NotificationCenter'
import { SearchModal } from '@/components/search'
import {
  NAV_CATEGORY_LINKS,
  NAV_FEATURED_LINKS,
  resolveNavCategoryLink,
  type NavResolvedCategory,
} from '@/components/layout/navigation-menu-config'
import { 
  Bag, 
  MagnifyingGlass, 
  UserCircle, 
  List, 
  X, 
  Trophy, 
  CaretRight,
  Sparkle,
  ArrowRight,
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
import { calculateTierProgressWithTiers, getTierFromPoints } from '@/lib/loyalty/tier-progress'
import { buildTierGradient, hexToRgba, resolveTierTheme } from '@/lib/loyalty/tier-theme'
import { getPrimaryImageWithFallback, parseImageList, resolveColorHex } from '@/lib/commerce/product-placeholders'

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
        className="text-sm font-black tabular-nums tracking-wide"
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
            className="absolute -top-1 left-full ml-1 flex items-center gap-0.5 text-xs font-black text-emerald-500 whitespace-nowrap"
          >
            <Sparkle size={10} weight="fill" />
            +{pointsGained}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const NAV_POINTS_CACHE_KEY = 'hof_nav_points_cache'
const SHOP_DROPDOWN_OPEN_DELAY_MS = 90
const SHOP_DROPDOWN_CLOSE_DELAY_MS = 130

interface NavTierDefinition {
  name: string
  slug: string
  minAnnualPoints: number
  pointMultiplier: number
  primaryColor?: string | null
  secondaryColor?: string | null
}

interface NavShopColorSwatch {
  label: string
  hex: string
}

interface NavApiCategoryRecord {
  id: string
  name: string
  slug: string
}

interface NavShopProduct {
  id: string
  slug: string
  name: string
  price: number
  compareAtPrice: number | null
  images: unknown
  inStock: boolean
  categoryName: string | null
  colors: NavShopColorSwatch[]
}

const USD_CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

function formatCurrency(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '$0.00'
  return USD_CURRENCY_FORMATTER.format(value)
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function formatMultiplier(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '1'
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(2).replace(/\.?0+$/, '')
}

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const shouldReduceMotion = useReducedMotion()
  const [mounted, setMounted] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const showNav = true
  const [shopDropdownOpen, setShopDropdownOpen] = useState(false)
  const [shopDropdownPinned, setShopDropdownPinned] = useState(false)
  const [shopMenuFocusTarget, setShopMenuFocusTarget] = useState<'first' | 'last' | null>(null)
  const [shopMenuProducts, setShopMenuProducts] = useState<NavShopProduct[]>([])
  const [shopMenuProductsLoading, setShopMenuProductsLoading] = useState(false)
  const [shopMenuProductsLoaded, setShopMenuProductsLoaded] = useState(false)
  const [shopMenuCategories, setShopMenuCategories] = useState<NavResolvedCategory[]>(NAV_CATEGORY_LINKS)
  const [shopMenuCategoriesLoading, setShopMenuCategoriesLoading] = useState(false)
  const [shopMenuCategoriesLoaded, setShopMenuCategoriesLoaded] = useState(false)
  const [userPoints, setUserPoints] = useState<number | null>(null)
  const [previousPoints, setPreviousPoints] = useState<number | null>(null)
  const [loyaltyTiers, setLoyaltyTiers] = useState<NavTierDefinition[]>([])
  
  // Tier animation states for cycling through tiers when skipping
  const [displayedTierSlug, setDisplayedTierSlug] = useState<string | null>(null)
  const [isTierAnimating, setIsTierAnimating] = useState(false)
  const previousTierSlugRef = useRef<string | null>(null)
  
  const shopDropdownRef = useRef<HTMLDivElement>(null)
  const shopDropdownTriggerRef = useRef<HTMLButtonElement>(null)
  const shopDropdownPanelRef = useRef<HTMLDivElement>(null)
  const shopMenuFirstItemRef = useRef<HTMLAnchorElement>(null)
  const shopMenuLastItemRef = useRef<HTMLAnchorElement>(null)
  const shopDropdownOpenTimerRef = useRef<number | null>(null)
  const shopDropdownCloseTimerRef = useRef<number | null>(null)
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

  const clearShopDropdownTimers = useCallback(() => {
    if (shopDropdownOpenTimerRef.current !== null) {
      window.clearTimeout(shopDropdownOpenTimerRef.current)
      shopDropdownOpenTimerRef.current = null
    }

    if (shopDropdownCloseTimerRef.current !== null) {
      window.clearTimeout(shopDropdownCloseTimerRef.current)
      shopDropdownCloseTimerRef.current = null
    }
  }, [])

  const getShopMenuItems = useCallback(() => {
    const menuRoot =
      shopDropdownPanelRef.current ??
      document.getElementById('nav-shop-mega-menu')
    if (!menuRoot) {
      return [] as HTMLElement[]
    }
    return Array.from(
      menuRoot.querySelectorAll<HTMLElement>('[data-shop-menu-item="true"]')
    )
  }, [])

  const closeShopDropdown = useCallback((options?: { returnFocus?: boolean }) => {
    clearShopDropdownTimers()
    setShopDropdownOpen(false)
    setShopDropdownPinned(false)
    setShopMenuFocusTarget(null)

    if (options?.returnFocus) {
      window.setTimeout(() => {
        shopDropdownTriggerRef.current?.focus()
      }, 0)
    }
  }, [clearShopDropdownTimers])

  const openShopDropdownWithDelay = useCallback(() => {
    clearShopDropdownTimers()
    if (shopDropdownPinned || shopDropdownOpen) {
      return
    }

    shopDropdownOpenTimerRef.current = window.setTimeout(() => {
      setShopDropdownOpen(true)
    }, SHOP_DROPDOWN_OPEN_DELAY_MS)
  }, [clearShopDropdownTimers, shopDropdownOpen, shopDropdownPinned])

  const closeShopDropdownWithDelay = useCallback(() => {
    clearShopDropdownTimers()
    if (shopDropdownPinned) {
      return
    }

    shopDropdownCloseTimerRef.current = window.setTimeout(() => {
      setShopDropdownOpen(false)
    }, SHOP_DROPDOWN_CLOSE_DELAY_MS)
  }, [clearShopDropdownTimers, shopDropdownPinned])

  const openShopDropdownFromKeyboard = useCallback((focusTarget: 'first' | 'last') => {
    clearShopDropdownTimers()
    setShopDropdownPinned(true)
    setShopDropdownOpen(true)
    setShopMenuFocusTarget(focusTarget)
  }, [clearShopDropdownTimers])

  const handleShopTriggerClick = useCallback(() => {
    clearShopDropdownTimers()
    setShopDropdownPinned((isPinned) => {
      const nextPinned = !isPinned
      setShopDropdownOpen(nextPinned)
      if (!nextPinned) {
        setShopMenuFocusTarget(null)
      }
      return nextPinned
    })
  }, [clearShopDropdownTimers])

  const handleShopTriggerKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault()
      openShopDropdownFromKeyboard('first')
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      openShopDropdownFromKeyboard('last')
      return
    }

    if (event.key === 'Escape' && shopDropdownOpen) {
      event.preventDefault()
      closeShopDropdown({ returnFocus: true })
    }
  }, [closeShopDropdown, openShopDropdownFromKeyboard, shopDropdownOpen])

  const handleShopDropdownKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeShopDropdown({ returnFocus: true })
      return
    }

    if (event.key !== 'Tab') {
      return
    }

    const items = getShopMenuItems()
    if (items.length === 0) {
      return
    }

    const firstItem = items[0]
    const lastItem = items[items.length - 1]
    const activeElement = document.activeElement

    if (!event.shiftKey && activeElement === lastItem) {
      closeShopDropdown()
      return
    }

    if (event.shiftKey && activeElement === firstItem) {
      closeShopDropdown()
    }
  }, [closeShopDropdown, getShopMenuItems])

  useEffect(() => {
    if (!shopDropdownOpen || !shopMenuFocusTarget) {
      return
    }

    const focusWithRetry = (attempt: number): number | null => {
      const targetFromRef =
        shopMenuFocusTarget === 'first'
          ? shopMenuFirstItemRef.current
          : shopMenuLastItemRef.current

      if (targetFromRef) {
        targetFromRef.focus()
        setShopMenuFocusTarget(null)
        return null
      }

      const items = getShopMenuItems()
      if (items.length === 0 && attempt < 2) {
        return window.setTimeout(() => focusWithRetry(attempt + 1), 16)
      }

      if (items.length > 0) {
        const targetItem = shopMenuFocusTarget === 'first' ? items[0] : items[items.length - 1]
        targetItem.focus()
      }

      setShopMenuFocusTarget(null)
      return null
    }

    const focusTimeout = window.setTimeout(() => {
      focusWithRetry(0)
    }, 0)

    return () => window.clearTimeout(focusTimeout)
  }, [getShopMenuItems, shopDropdownOpen, shopMenuFocusTarget])

  useEffect(() => {
    return () => {
      clearShopDropdownTimers()
    }
  }, [clearShopDropdownTimers])

  useEffect(() => {
    if (!shopDropdownOpen) {
      return
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeShopDropdown({ returnFocus: true })
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [closeShopDropdown, shopDropdownOpen])

  const fetchShopMenuProducts = useCallback(async () => {
    if (shopMenuProductsLoading || shopMenuProductsLoaded) {
      return
    }

    setShopMenuProductsLoading(true)

    try {
      const response = await fetch('/api/products?isActive=true&limit=18', { cache: 'no-store' })
      if (!response.ok) {
        return
      }

      const payload = await response.json() as { data?: unknown; products?: unknown }
      const rawProducts = Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(payload.products)
          ? payload.products
          : []

      const normalizedProducts = rawProducts.flatMap((candidate): NavShopProduct[] => {
        if (!candidate || typeof candidate !== 'object') return []
        const source = candidate as Record<string, unknown>

        const id = typeof source.id === 'string' ? source.id.trim() : ''
        const slug = typeof source.slug === 'string' ? source.slug.trim() : ''
        const name = typeof source.name === 'string' ? source.name.trim() : ''
        if (!id || !slug || !name) {
          return []
        }

        const basePrice = toFiniteNumber(source.price)
        if (basePrice === null || basePrice <= 0) {
          return []
        }

        const compareAtPrice = toFiniteNumber(source.compareAtPrice)
        const variants = Array.isArray(source.variants) ? source.variants : []
        const colorsByKey = new Map<string, NavShopColorSwatch>()
        const variantPriceCandidates: number[] = []
        let hasInStockVariant = false
        let preferredImageSource: unknown = source.images

        variants.forEach((variantCandidate) => {
          if (!variantCandidate || typeof variantCandidate !== 'object') return
          const variant = variantCandidate as Record<string, unknown>

          const isActive = variant.isActive !== false
          if (!isActive) {
            return
          }

          const inventory = toFiniteNumber(variant.inventory) ?? 0
          if (inventory > 0) {
            hasInStockVariant = true
            if (parseImageList(preferredImageSource).length === 0 && parseImageList(variant.images).length > 0) {
              preferredImageSource = variant.images
            }
          }

          const variantPrice = toFiniteNumber(variant.price)
          if (variantPrice !== null && variantPrice > 0) {
            variantPriceCandidates.push(variantPrice)
          }

          const colorLabel = typeof variant.color === 'string' ? variant.color.trim() : ''
          const colorHex = resolveColorHex(
            typeof variant.colorHex === 'string' ? variant.colorHex : null,
            colorLabel || null
          )

          if (!colorHex) return

          const normalizedLabel = colorLabel || 'Color'
          const key = `${normalizedLabel.toLowerCase()}__${colorHex}`
          if (!colorsByKey.has(key)) {
            colorsByKey.set(key, { label: normalizedLabel, hex: colorHex })
          }
        })

        const lowestVariantPrice = variantPriceCandidates.length > 0
          ? Math.min(...variantPriceCandidates)
          : null
        const resolvedPrice = lowestVariantPrice !== null ? Math.min(basePrice, lowestVariantPrice) : basePrice
        const category = source.category && typeof source.category === 'object'
          ? (source.category as { name?: unknown }).name
          : null

        return [{
          id,
          slug,
          name,
          price: resolvedPrice,
          compareAtPrice: compareAtPrice && compareAtPrice > resolvedPrice ? compareAtPrice : null,
          images: preferredImageSource,
          inStock: variants.length === 0 || hasInStockVariant,
          categoryName: typeof category === 'string' ? category : null,
          colors: Array.from(colorsByKey.values()).slice(0, 5),
        }]
      })

      const prioritizedProducts = [
        ...normalizedProducts.filter((product) => product.inStock),
        ...normalizedProducts.filter((product) => !product.inStock),
      ]

      setShopMenuProducts(prioritizedProducts.slice(0, 8))
    } catch (error) {
      console.error('Failed to load shop menu products:', error)
    } finally {
      setShopMenuProductsLoading(false)
      setShopMenuProductsLoaded(true)
    }
  }, [shopMenuProductsLoaded, shopMenuProductsLoading])

  const fetchShopMenuCategories = useCallback(async () => {
    if (shopMenuCategoriesLoading || shopMenuCategoriesLoaded) {
      return
    }

    setShopMenuCategoriesLoading(true)

    try {
      const response = await fetch('/api/categories', { cache: 'no-store' })
      if (!response.ok) {
        return
      }

      const payload = await response.json()
      const rawCategories = Array.isArray(payload) ? payload : []

      const normalizedCategories = rawCategories.flatMap((candidate): NavResolvedCategory[] => {
        if (!candidate || typeof candidate !== 'object') {
          return []
        }

        const source = candidate as Partial<NavApiCategoryRecord>
        const id = typeof source.id === 'string' ? source.id.trim() : ''
        const name = typeof source.name === 'string' ? source.name.trim() : ''
        const slug = typeof source.slug === 'string' ? source.slug.trim() : ''
        if (!id || !slug) {
          return []
        }

        return [resolveNavCategoryLink({ id, name, slug })]
      })

      if (normalizedCategories.length > 0) {
        setShopMenuCategories(normalizedCategories)
      }
    } catch (error) {
      console.error('Failed to load shop menu categories:', error)
    } finally {
      setShopMenuCategoriesLoading(false)
      setShopMenuCategoriesLoaded(true)
    }
  }, [shopMenuCategoriesLoaded, shopMenuCategoriesLoading])

  useEffect(() => {
    if (!shopDropdownOpen) {
      return
    }

    if (!shopMenuProductsLoaded && !shopMenuProductsLoading) {
      void fetchShopMenuProducts()
    }

    if (!shopMenuCategoriesLoaded && !shopMenuCategoriesLoading) {
      void fetchShopMenuCategories()
    }
  }, [
    fetchShopMenuCategories,
    fetchShopMenuProducts,
    shopDropdownOpen,
    shopMenuCategoriesLoaded,
    shopMenuCategoriesLoading,
    shopMenuProductsLoaded,
    shopMenuProductsLoading,
  ])

  useEffect(() => {
    if (!mobileMenuOpen || shopMenuCategoriesLoaded || shopMenuCategoriesLoading) {
      return
    }

    void fetchShopMenuCategories()
  }, [fetchShopMenuCategories, mobileMenuOpen, shopMenuCategoriesLoaded, shopMenuCategoriesLoading])

  const fetchUserPoints = useCallback(async () => {
    try {
      const response = await fetch('/api/loyalty/me', { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json()
        const newPoints = data.points

        if (Array.isArray(data?.tiers)) {
          const normalizedTiers = data.tiers.flatMap((tier: unknown): NavTierDefinition[] => {
            if (!tier || typeof tier !== 'object') return []
            const source = tier as Record<string, unknown>
            const slug = typeof source.slug === 'string' ? source.slug.trim().toLowerCase() : ''
            if (!slug) return []

            const minAnnualPoints = Number(source.minAnnualPoints)
            const pointMultiplier = Number(source.pointMultiplier)
            const primaryColor = typeof source.primaryColor === 'string' ? source.primaryColor.trim() : null
            const secondaryColor = typeof source.secondaryColor === 'string' ? source.secondaryColor.trim() : null

            return [{
              name: typeof source.name === 'string' && source.name.trim().length > 0 ? source.name.trim() : slug,
              slug,
              minAnnualPoints: Number.isFinite(minAnnualPoints) ? Math.max(0, minAnnualPoints) : 0,
              pointMultiplier: Number.isFinite(pointMultiplier) ? Math.max(1, pointMultiplier) : 1,
              primaryColor: primaryColor && primaryColor.length > 0 ? primaryColor : null,
              secondaryColor: secondaryColor && secondaryColor.length > 0 ? secondaryColor : null,
            }]
          }).sort((a, b) => a.minAnnualPoints - b.minAnnualPoints)

          setLoyaltyTiers(normalizedTiers)
        }
        
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
        closeShopDropdown()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [closeShopDropdown])

  const navLinks = [
    { href: '/collections', label: 'Collections' },
    { href: '/about', label: 'About' },
  ]

  const isActive = (href: string) => pathname === href
  const isShopActive = pathname === '/products' || pathname.startsWith('/products?')
  const displayedUserPoints = userPoints ?? user?.currentPoints ?? 0
  const shopMenuGridProducts = shopMenuProducts.slice(0, 4)
  const displayedShopCategories = shopMenuCategories.length > 0 ? shopMenuCategories : NAV_CATEGORY_LINKS

  return (
    <>
      <nav 
        className={`bg-white/98 backdrop-blur-xl fixed top-0 left-0 right-0 z-50 border-b border-black/5 transform transition-transform duration-300 ${showNav ? 'translate-y-0' : '-translate-y-full'}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-[4.5rem] md:h-[5rem]">
          
            {/* Left - Mobile Logo + Desktop Navigation */}
            <div className="flex items-center gap-5">
              {/* Mobile & Tablet Logo - Left side */}
              <Link 
                href="/" 
                className="brand-wordmark-link group lg:hidden flex items-center gap-2.5 sm:gap-3 transition-transform duration-300"
              >
                <Image
                  src="/assets/head-over-feels-logo.png"
                  alt="Head Over Feels Logo"
                  width={44}
                  height={44}
                  className="object-contain w-10 h-10 sm:w-12 sm:h-12 md:w-12 md:h-12"
                />
                <span data-testid="nav-wordmark-mobile" className="brand-wordmark brand-wordmark--hover-red text-lg sm:text-xl md:text-2xl whitespace-nowrap">
                  Head Over Feels
                </span>
                <Image
                  src="/assets/head-over-feels-logo.png"
                  alt="Head Over Feels Logo"
                  width={44}
                  height={44}
                  className="object-contain w-10 h-10 sm:w-12 sm:h-12 md:w-12 md:h-12"
                />
              </Link>
              
              {/* Desktop Navigation Links */}
              <div className="hidden lg:flex items-center gap-10">
              {/* Shop Dropdown */}
              <div 
                ref={shopDropdownRef}
                className="relative"
                data-testid="nav-shop-dropdown"
                onMouseEnter={openShopDropdownWithDelay}
                onMouseLeave={closeShopDropdownWithDelay}
              >
                <button
                  ref={shopDropdownTriggerRef}
                  id="nav-shop-trigger"
                  data-testid="nav-shop-trigger"
                  type="button"
                  onClick={handleShopTriggerClick}
                  onKeyDown={handleShopTriggerKeyDown}
                  aria-expanded={shopDropdownOpen}
                  aria-controls="nav-shop-mega-menu"
                  aria-haspopup="menu"
                  className={`flex items-center gap-2 text-sm font-black uppercase tracking-widest transition-colors duration-200 ${
                    isShopActive ? 'text-black' : 'text-black/50 hover:text-black'
                  }`}
                >
                  Shop
                  <CaretRight 
                    size={12} 
                    weight="bold" 
                    className={`transition-transform duration-200 ${shopDropdownOpen ? 'rotate-90' : ''}`}
                  />
                </button>
                
                {/* Modern Mega Menu */}
                <AnimatePresence>
                  {shopDropdownOpen && (
                    <motion.div
                      id="nav-shop-mega-menu"
                      ref={shopDropdownPanelRef}
                      data-testid="nav-shop-menu"
                      role="menu"
                      aria-labelledby="nav-shop-trigger"
                      onKeyDown={handleShopDropdownKeyDown}
                      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.985 }}
                      animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.985 }}
                      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
                      className="absolute top-full left-0 z-50"
                    >
                      <span
                        data-testid="nav-shop-menu-connector"
                        aria-hidden="true"
                        className="absolute -top-[7px] left-7 h-3.5 w-3.5 rotate-45 border-l border-t border-black/10 bg-white"
                      />
                      <div className="w-[58rem] max-w-[calc(100vw-2rem)] overflow-hidden border border-black/10 bg-white shadow-xl shadow-black/8">
                        <div className="grid grid-cols-12">
                          <div className="col-span-5 border-r border-black/8 p-5">
                            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-black/40">
                              Featured
                            </p>
                            <div className="space-y-2.5">
                              {NAV_FEATURED_LINKS.map((featuredLink, index) => {
                                const Icon = featuredLink.icon
                                return (
                                  <Link
                                    key={featuredLink.href}
                                    href={featuredLink.href}
                                    role="menuitem"
                                    data-shop-menu-item="true"
                                    ref={index === 0 ? shopMenuFirstItemRef : undefined}
                                    autoFocus={index === 0 && shopMenuFocusTarget === 'first'}
                                    onClick={() => closeShopDropdown()}
                                    className="group block border border-black/10 px-3.5 py-3 transition-colors hover:bg-black hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40 transition-colors group-hover:text-white/60">
                                          {featuredLink.eyebrow}
                                        </p>
                                        <p className="mt-1 text-sm font-black uppercase tracking-wide">{featuredLink.label}</p>
                                        <p className="mt-1 text-xs text-black/60 transition-colors group-hover:text-white/75">
                                          {featuredLink.description}
                                        </p>
                                      </div>
                                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center bg-black/5 transition-colors group-hover:bg-white/15">
                                        <Icon size={15} weight="bold" />
                                      </span>
                                    </div>
                                  </Link>
                                )
                              })}
                            </div>
                          </div>

                          <div className="col-span-7 p-5">
                            <div className="mb-3 flex items-center justify-between">
                              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">
                                Categories
                              </p>
                              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/35">
                                Quick Browse
                              </span>
                            </div>
                            {shopMenuCategoriesLoading ? (
                              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                                Updating categories...
                              </p>
                            ) : null}
                            <div data-testid="desktop-shop-categories" className="space-y-1.5">
                              {displayedShopCategories.map((category) => {
                                const Icon = category.icon
                                return (
                                  <Link
                                    key={category.id}
                                    href={category.href}
                                    role="menuitem"
                                    data-shop-menu-item="true"
                                    onClick={() => closeShopDropdown()}
                                    className="group flex items-center gap-3 border border-transparent px-3 py-3 transition-colors hover:border-black/10 hover:bg-black/3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                                  >
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-black/5 transition-colors group-hover:bg-black group-hover:text-white">
                                      <Icon size={18} weight="bold" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-black uppercase tracking-wide text-black">{category.label}</p>
                                      <p className="mt-0.5 text-xs text-black/55">{category.description}</p>
                                    </div>
                                    <ArrowRight size={14} weight="bold" className="text-black/30 transition-transform group-hover:translate-x-0.5 group-hover:text-black/70" />
                                  </Link>
                                )
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-black/8 px-5 py-4">
                          <div className="mb-3 flex items-center justify-between">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40">
                              Shop Right Now
                            </p>
                            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/35">
                              Real Products
                            </span>
                          </div>

                          {shopMenuProductsLoading ? (
                            <div className="grid grid-cols-4 gap-3">
                              {[0, 1, 2, 3].map((skeleton) => (
                                <div key={`shop-grid-skeleton-${skeleton}`} className="animate-pulse border border-black/10 p-2.5">
                                  <div className="mb-2 h-24 bg-black/10" />
                                  <div className="space-y-1.5">
                                    <div className="h-2.5 w-3/4 bg-black/10" />
                                    <div className="h-2.5 w-1/2 bg-black/8" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : shopMenuGridProducts.length > 0 ? (
                            <div className="grid grid-cols-4 gap-3">
                              {shopMenuGridProducts.map((product) => {
                                const primaryColor = product.colors[0]
                                const imageUrl = getPrimaryImageWithFallback({
                                  images: product.images,
                                  productName: product.name,
                                  productSlug: product.slug,
                                  color: primaryColor?.label ?? null,
                                  colorHex: primaryColor?.hex ?? null,
                                })

                                return (
                                  <Link
                                    key={`shop-grid-product-${product.id}`}
                                    href={`/products/${product.slug}`}
                                    role="menuitem"
                                    data-shop-menu-item="true"
                                    onClick={() => closeShopDropdown()}
                                    className="group border border-black/10 p-2.5 transition-colors hover:border-black/20 hover:bg-black/[0.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                                  >
                                    <div className="relative mb-2 h-24 w-full overflow-hidden bg-black/5">
                                      <Image
                                        src={imageUrl}
                                        alt={product.name}
                                        fill
                                        sizes="(min-width: 1024px) 180px, 120px"
                                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <p className="line-clamp-2 text-xs font-black uppercase tracking-[0.08em] text-black/90">
                                        {product.name}
                                      </p>
                                      <div className="flex items-center gap-1.5 text-xs">
                                        <span className="font-black text-black/85">{formatCurrency(product.price)}</span>
                                        {product.compareAtPrice && product.compareAtPrice > product.price ? (
                                          <span className="font-semibold text-black/45 line-through">
                                            {formatCurrency(product.compareAtPrice)}
                                          </span>
                                        ) : null}
                                      </div>
                                      {product.colors.length > 0 ? (
                                        <div className="flex items-center gap-1 pt-0.5">
                                          {product.colors.slice(0, 4).map((color) => (
                                            <span
                                              key={`${product.id}-${color.hex}-${color.label}`}
                                              title={color.label}
                                              className="h-2.5 w-2.5 rounded-full border border-black/20"
                                              style={{ backgroundColor: color.hex }}
                                            />
                                          ))}
                                          {product.colors.length > 4 ? (
                                            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-black/40">
                                              +{product.colors.length - 4}
                                            </span>
                                          ) : null}
                                        </div>
                                      ) : (
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                                          {product.categoryName || 'Apparel'}
                                        </p>
                                      )}
                                    </div>
                                  </Link>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="border border-dashed border-black/15 p-3 text-xs text-black/50">
                              We couldn&apos;t load product previews. Use View all products below.
                            </div>
                          )}
                        </div>

                        <div className="border-t border-black/8 bg-black/[0.02] px-5 py-3.5">
                          <Link
                            href="/products"
                            role="menuitem"
                            data-shop-menu-item="true"
                            ref={shopMenuLastItemRef}
                            autoFocus={shopMenuFocusTarget === 'last'}
                            onClick={() => closeShopDropdown()}
                            className="group inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-black/80 transition-colors hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                          >
                            View all products
                            <ArrowRight size={16} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
                          </Link>
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
                  className={`text-sm font-black uppercase tracking-widest transition-colors duration-200 ${
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
              className="brand-wordmark-link group hidden lg:flex absolute left-1/2 -translate-x-1/2 items-center gap-3 xl:gap-4 transition-transform duration-300"
            >
              <Image
                src="/assets/head-over-feels-logo.png"
                alt="Head Over Feels Logo"
                width={72}
                height={72}
                className="object-contain w-16 h-16 xl:w-[5rem] xl:h-[5rem]"
              />
              <span data-testid="nav-wordmark-desktop" className="brand-wordmark brand-wordmark--hover-red text-[2.25rem] xl:text-[2.9rem] 2xl:text-[3.4rem] whitespace-nowrap">
                Head Over Feels
              </span>
              <Image
                src="/assets/head-over-feels-logo.png"
                alt="Head Over Feels Logo"
                width={72}
                height={72}
                className="object-contain w-16 h-16 xl:w-[5rem] xl:h-[5rem]"
              />
            </Link>

            {/* Right - Icons + Mobile Menu Toggle */}
            <div className="flex items-center gap-1">
              {/* Rewards - Pill style (Desktop) */}
              {user && (
                <Link
                  href="/profile#rewards"
                  className="hidden lg:flex items-center gap-2.5 px-4 py-2 bg-black/5 hover:bg-black hover:text-white text-black transition-all duration-200"
                  title="View Profile & Rewards"
                >
                  <Trophy size={16} weight="fill" />
                  <AnimatedPoints value={displayedUserPoints} previousValue={previousPoints} />
                  <span className="text-[11px] font-bold uppercase tracking-wider opacity-50">pts</span>
                </Link>
              )}
              
              {/* Search Trigger - Clean minimal style (Desktop) */}
              <button
                onClick={() => setSearchOpen(true)}
                className="hidden lg:flex items-center justify-center w-11 h-11 text-black/40 hover:text-black hover:bg-black/5 transition-all duration-200"
                aria-label="Search"
                data-testid="nav-search-trigger-desktop"
              >
                <MagnifyingGlass size={20} weight="bold" />
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
                className="hidden lg:flex relative p-2.5 text-black/50 hover:text-black hover:bg-black/5 transition-all duration-200"
                aria-label="Shopping cart"
              >
                <Bag size={22} weight="bold" />
                {cartItemCount > 0 && (
                  <span className="absolute top-0 right-0 bg-black text-white text-[10px] font-black h-[18px] min-w-[18px] px-1 flex items-center justify-center">
                    {cartItemCount > 9 ? '9+' : cartItemCount}
                  </span>
                )}
              </Link>

              {/* Sign In (Desktop) */}
              {!authLoading && (
                !user && (
                  <Link
                    href="/signin"
                    className="hidden lg:flex items-center gap-2 px-5 py-2.5 bg-black text-white text-xs font-black uppercase tracking-widest hover:bg-black/90 transition-all duration-200"
                  >
                    Sign In
                  </Link>
                )
              )}

              {/* Search Trigger - Mobile */}
              <button
                onClick={() => setSearchOpen(true)}
                className="lg:hidden p-2.5 text-black/60 hover:text-black transition-colors"
                aria-label="Search"
                data-testid="nav-search-trigger-mobile"
              >
                <MagnifyingGlass size={22} weight="bold" />
              </button>

              {/* Mobile Menu Toggle - Right side on mobile and tablet */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2.5 -mr-2 ml-2.5 text-black/60 hover:text-black transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X size={22} weight="bold" /> : <List size={22} weight="bold" />}
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
              className="lg:hidden fixed inset-0 w-full bg-white z-50 overflow-y-auto"
            >
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-black/8 px-5 py-[1.125rem] flex items-center justify-between safe-area-inset-top z-10">
                <span className="text-sm font-black uppercase tracking-widest text-black">Menu</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2.5 -mr-2 text-black/50 hover:text-black transition-colors"
                >
                  <X size={26} weight="bold" />
                </button>
              </div>
              
              <div className="px-4 py-4 space-y-4 pb-safe">
                
                {/* User Loyalty Tier Card - For signed in users */}
                {user && userPoints !== null && (() => {
                  const tierProgress = calculateTierProgressWithTiers({
                    currentTierSlug: user.loyaltyTier?.slug ?? null,
                    annualPointsEarned: user.annualPointsEarned ?? 0,
                    tiers: loyaltyTiers,
                  })
                  const actualTierSlug = (user.loyaltyTier?.slug || tierProgress.currentTier.slug).toLowerCase()
                  const displayMultiplier = user.loyaltyTier?.pointMultiplier ?? tierProgress.currentTier.pointMultiplier
                  
                  // Use displayed tier for visual animation, actual tier for data
                  const animatedTierSlug = (displayedTierSlug || actualTierSlug).toLowerCase()
                  
                  const tierIcons: Record<string, typeof Star> = {
                    newcomer: Star,
                    friend: Heart,
                    bestie: Crown,
                    soulmate: Sparkle,
                  }
                  
                  const tierNames: Record<string, string> = {
                    newcomer: 'Newcomer',
                    friend: 'Friend',
                    bestie: 'Bestie',
                    soulmate: 'Soulmate',
                  }
                  loyaltyTiers.forEach((tier) => {
                    tierNames[tier.slug.toLowerCase()] = tier.name
                  })
                  if (user.loyaltyTier?.slug && user.loyaltyTier?.name) {
                    tierNames[user.loyaltyTier.slug.toLowerCase()] = user.loyaltyTier.name
                  }
                  
                  // Use animated tier for visuals
                  const TierIcon = tierIcons[animatedTierSlug] || Star
                  const displayTierName = tierNames[animatedTierSlug] || tierProgress.currentTier.name || 'Tier'
                  const tierThemeBySlug = loyaltyTiers.reduce<Record<string, { primaryColor?: string; secondaryColor?: string }>>((acc, tier) => {
                    acc[tier.slug] = {
                      primaryColor: tier.primaryColor ?? undefined,
                      secondaryColor: tier.secondaryColor ?? undefined,
                    }
                    return acc
                  }, {})
                  if (user.loyaltyTier?.slug) {
                    tierThemeBySlug[user.loyaltyTier.slug.toLowerCase()] = {
                      primaryColor: user.loyaltyTier.primaryColor,
                      secondaryColor: user.loyaltyTier.secondaryColor,
                    }
                  }
                  const activeTierTheme = resolveTierTheme(animatedTierSlug, tierThemeBySlug[animatedTierSlug])
                  const iconBadgeColor = hexToRgba(activeTierTheme.primaryColor, 0.22)
                  const progressTrackColor = hexToRgba(activeTierTheme.primaryColor, 0.26)
                  const progressFillColor = hexToRgba(activeTierTheme.primaryColor, 0.94)
                  const cardShadow = `0 22px 36px -24px ${hexToRgba(activeTierTheme.secondaryColor, 0.78)}`
                  
                  return (
                    <motion.div 
                      className="relative overflow-hidden rounded-xl border border-black/10 p-3 text-white shadow-sm"
                      style={{ boxShadow: cardShadow }}
                    >
                      {/* Animated gradient background */}
                      <motion.div
                        key={animatedTierSlug}
                        initial={isTierAnimating ? { opacity: 0, scale: 1.1 } : false}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4 }}
                        className="absolute inset-0"
                        style={{ backgroundImage: buildTierGradient(activeTierTheme, 135) }}
                      />
                      <div className="absolute inset-0 bg-black/10" />
                      
                      {/* Decorative elements */}
                      <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
                      <div className="absolute bottom-0 left-0 h-20 w-20 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2" />
                      
                      {/* Tier Header */}
                      <div className="relative flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <motion.div 
                            key={`icon-${animatedTierSlug}`}
                            initial={isTierAnimating ? { scale: 0, rotate: -180 } : false}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                            style={{ backgroundColor: iconBadgeColor }}
                          >
                            <TierIcon size={16} weight="fill" />
                          </motion.div>
                          <div className="min-w-0">
                            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/70">
                              {isTierAnimating ? 'Leveling Up!' : 'Your Tier'}
                            </p>
                            <motion.p 
                              key={`name-${animatedTierSlug}`}
                              initial={isTierAnimating ? { opacity: 0, y: 10 } : false}
                              animate={{ opacity: 1, y: 0 }}
                              className="truncate text-sm font-black uppercase tracking-[0.08em]"
                            >
                              {displayTierName}
                            </motion.p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/70">Points</p>
                          <div className="flex items-center gap-1">
                            <motion.span 
                              className="text-base font-black tabular-nums"
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
                          className="relative flex items-center justify-center gap-2 py-1.5"
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
                          className="relative mt-2.5 space-y-1.5"
                          initial={isTierAnimating ? { opacity: 0 } : false}
                          animate={{ opacity: 1 }}
                          transition={{ delay: isTierAnimating ? 0.3 : 0 }}
                        >
                          <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.14em]">
                            <span className="text-white/70">Progress to {tierProgress.nextTier.name}</span>
                            <span className="text-white/80">{Math.round(tierProgress.progressPercentage)}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: progressTrackColor }}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${tierProgress.progressPercentage}%` }}
                              transition={{ duration: 0.8, ease: 'easeOut' }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: progressFillColor }}
                            />
                          </div>
                          <p className="text-[10px] text-white/70">
                            {tierProgress.pointsNeeded.toLocaleString()} pts needed
                          </p>
                        </motion.div>
                      )}
                      
                      {tierProgress.isMaxTier && (
                        <div className="relative mt-2.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/85">
                          <Sparkle size={12} weight="fill" className="text-amber-300" />
                          Max tier achieved!
                        </div>
                      )}
                      
                      {/* Quick tier perks */}
                      <div className="relative mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
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
                        {displayMultiplier > 1 && (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/80">
                            <TrendUp size={12} weight="bold" />
                            {formatMultiplier(displayMultiplier)}x Points
                          </div>
                        )}
                      </div>
                      
                      {/* View Profile + Rewards Link */}
                      <Link
                        href="/profile"
                        onClick={() => setMobileMenuOpen(false)}
                        className="relative mt-2.5 flex items-center justify-between border-t border-white/25 pt-2.5 group"
                      >
                        <span className="text-xs font-bold uppercase tracking-wider text-white/80 group-hover:text-white transition-colors">
                          Open Profile & Rewards
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
                    className="flex items-center justify-between p-4 border border-black/15 bg-black text-white group shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/15 flex items-center justify-center">
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

                {/* Quick Links */}
                <div className="space-y-1 bg-white p-1">
                  <p className="px-3 pt-2 text-[9px] font-black uppercase tracking-widest text-black/30">Quick Access</p>
                  {NAV_FEATURED_LINKS.map((featured) => {
                    const Icon = featured.icon
                    const isFeaturedActive =
                      featured.href === '/products'
                        ? isShopActive
                        : isActive(featured.href)

                    return (
                      <Link
                        key={featured.href}
                        href={featured.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center justify-between px-4 py-3.5 transition-all ${
                          isFeaturedActive ? 'bg-black text-white' : 'text-black hover:bg-black/5'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon size={16} weight="bold" />
                          <div className="min-w-0">
                            <p className="text-sm font-black uppercase tracking-wider leading-none">{featured.label}</p>
                            <p className={`mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${isFeaturedActive ? 'text-white/60' : 'text-black/40'}`}>
                              {featured.eyebrow}
                            </p>
                          </div>
                        </div>
                        <CaretRight size={14} weight="bold" className="opacity-40" />
                      </Link>
                    )
                  })}
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
                  <div data-testid="mobile-shop-categories">
                    {displayedShopCategories.map((category) => {
                      const Icon = category.icon
                      return (
                        <Link
                          key={category.id}
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
                        <Trophy size={18} weight="fill" />
                        <span className="text-sm font-black uppercase tracking-wider">Profile & Rewards</span>
                      </div>
                      <CaretRight size={14} weight="bold" className="opacity-40" />
                    </Link>
                    
                    <Link
                      href="/profile#rewards"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-between px-4 py-3 text-black/70 hover:text-black hover:bg-black/5 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <Gift size={16} weight="bold" />
                        <span className="text-xs font-bold uppercase tracking-wider">Redeem Rewards</span>
                      </div>
                      <CaretRight size={12} weight="bold" className="opacity-30" />
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
                        <span className="text-xs font-bold uppercase tracking-wider">Open Notifications</span>
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
                        <span className="text-xs font-bold uppercase tracking-wider">Notifications & Preferences</span>
                      </div>
                      <CaretRight size={12} weight="bold" className="opacity-30" />
                    </Link>

                    {user.isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center justify-between px-4 py-3 text-black/70 hover:text-black hover:bg-black/5 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <Gear size={16} weight="bold" />
                          <span className="text-xs font-bold uppercase tracking-wider">Admin Dashboard</span>
                        </div>
                        <CaretRight size={12} weight="bold" className="opacity-30" />
                      </Link>
                    )}
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
