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
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'
import { UserAvatar } from '@/components/ui/UserAvatar'
import {
  NAV_CATEGORY_LINKS,
  NAV_FEATURED_DROP,
  NAV_FEATURED_LINKS,
  resolveNavCategoryLink,
  type NavResolvedCategory,
} from '@/components/layout/navigation-menu-config'
import {
  Bag,
  MagnifyingGlass,
  UserCircle,
  Trophy,
  CaretRight,
  Sparkle,
  ArrowRight,
  Gear,
} from '@phosphor-icons/react'
import { calculateTierProgressWithTiers, getTierFromPoints } from '@/lib/loyalty/tier-progress'
import { buildTierGradient, hexToRgba, resolveTierTheme } from '@/lib/loyalty/tier-theme'
import { getPrimaryImageWithFallback, parseImageList, resolveColorHex } from '@/lib/commerce/product-placeholders'
import { MiniCart } from '@/components/cart/MiniCart'

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
  const [searchOpen, setSearchOpen] = useState(false)
  const [miniCartOpen, setMiniCartOpen] = useState(false)
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
          }).sort((a: NavTierDefinition, b: NavTierDefinition) => a.minAnnualPoints - b.minAnnualPoints)

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
        className="fixed inset-x-0 top-0 z-50 border-b border-black/5 bg-white/98 backdrop-blur-xl lg:sticky lg:top-0"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-[4.5rem] md:h-[5rem]">
          
            {/* Left - Mobile Logo + Desktop Navigation */}
            <div className="flex items-center gap-5">
              {/* Mobile & Tablet Logo - Left side */}
              <Link 
                href="/" 
                className="brand-wordmark-link group lg:hidden -ml-2 sm:-ml-1 flex items-center gap-1 sm:gap-1.5 transition-transform duration-300"
              >
                <Image
                  src="/assets/head-over-feels-logo.png"
                  alt="Head Over Feels Logo"
                  width={72}
                  height={72}
                  className="object-contain w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] md:w-[4.5rem] md:h-[4.5rem]"
                />
                <Image
                  src="/assets/head-over-feels-wordmark.png"
                  alt="Head Over Feels"
                  data-testid="nav-wordmark-mobile"
                  width={819}
                  height={123}
                  sizes="(max-width: 639px) 147px, (max-width: 767px) 176px, 186px"
                  className="h-auto w-[9.2rem] object-contain sm:w-[11rem] md:w-[11.6rem]"
                />
                <Image
                  src="/assets/head-over-feels-logo.png"
                  alt="Head Over Feels Logo"
                  width={72}
                  height={72}
                  className="object-contain w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] md:w-[4.5rem] md:h-[4.5rem]"
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
                      className="absolute top-full left-0 z-50 mt-2"
                    >
                      <div className="w-240 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-6rem)] overflow-y-auto overflow-x-hidden rounded-2xl border border-black/5 bg-white shadow-2xl shadow-black/8">
                        <div className="p-5">
                          {/* Top row: Lifestyle hero + nav links */}
                          <div className="grid grid-cols-2 gap-5">
                            {/* Lifestyle hero — left */}
                            {(() => {
                              const heroImageSrc = NAV_FEATURED_DROP.imageSrc.startsWith('/images/nav/') && shopMenuGridProducts.length > 0
                                ? getPrimaryImageWithFallback({
                                    images: shopMenuGridProducts[0].images,
                                    productName: shopMenuGridProducts[0].name,
                                    productSlug: shopMenuGridProducts[0].slug,
                                    color: shopMenuGridProducts[0].colors[0]?.label ?? null,
                                    colorHex: shopMenuGridProducts[0].colors[0]?.hex ?? null,
                                  })
                                : NAV_FEATURED_DROP.imageSrc

                              return (
                                <Link
                                  href={NAV_FEATURED_DROP.href}
                                  role="menuitem"
                                  data-shop-menu-item="true"
                                  ref={shopMenuFirstItemRef}
                                  autoFocus={shopMenuFocusTarget === 'first'}
                                  onClick={() => closeShopDropdown()}
                                  className="group relative block aspect-square overflow-hidden rounded-xl bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                                >
                                  <Image
                                    src={heroImageSrc}
                                    alt={NAV_FEATURED_DROP.imageAlt}
                                    fill
                                    sizes="(min-width: 1024px) 28rem, 90vw"
                                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                                  />
                                  <div className="absolute inset-0 bg-linear-to-t from-black/65 via-black/15 to-transparent" />

                                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/70 mb-1.5">
                                      {NAV_FEATURED_DROP.eyebrow}
                                    </p>
                                    <h3 className="text-xl font-black tracking-tight leading-[1.05] mb-0.5">
                                      {NAV_FEATURED_DROP.title}
                                    </h3>
                                    <p className="text-xs text-white/80 mb-3">
                                      {NAV_FEATURED_DROP.subtitle}
                                    </p>
                                    <span className="inline-flex items-center gap-1.5 px-3 h-7 rounded-full bg-white text-black text-[10px] font-bold uppercase tracking-wider transition-transform group-hover:translate-x-0.5">
                                      {NAV_FEATURED_DROP.ctaLabel}
                                      <ArrowRight size={11} weight="bold" />
                                    </span>
                                  </div>
                                </Link>
                              )
                            })()}

                            {/* Right column: The Latest + Categories */}
                            <div className="flex flex-col">
                              {/* The Latest */}
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-black/40 mb-2">
                                  The Latest
                                </p>
                                <div>
                                  {NAV_FEATURED_LINKS.map((featuredLink) => {
                                    const Icon = featuredLink.icon
                                    return (
                                      <Link
                                        key={featuredLink.href}
                                        href={featuredLink.href}
                                        role="menuitem"
                                        data-shop-menu-item="true"
                                        onClick={() => closeShopDropdown()}
                                        className="group flex items-center gap-2.5 -mx-2 px-2 py-1.5 rounded-lg transition-colors hover:bg-black/3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                                      >
                                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-black/5 transition-colors group-hover:bg-black/10">
                                          <Icon size={13} weight="bold" className="text-black/70" />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                          <p className="text-[13px] font-black uppercase tracking-wide text-black leading-tight">{featuredLink.label}</p>
                                          <p className="text-[10px] text-black/55 truncate leading-snug">{featuredLink.description}</p>
                                        </div>
                                        <ArrowRight size={12} weight="bold" className="text-black/30 transition-transform group-hover:translate-x-0.5 group-hover:text-black/70" />
                                      </Link>
                                    )
                                  })}
                                </div>
                              </div>

                              <div className="h-px bg-black/5 my-3" />

                              {/* Categories */}
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-black/40">
                                    Categories
                                  </p>
                                  {shopMenuCategoriesLoading ? (
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35">
                                      Updating…
                                    </span>
                                  ) : null}
                                </div>
                                <div data-testid="desktop-shop-categories">
                                  {displayedShopCategories.slice(0, 5).map((category) => {
                                    const Icon = category.icon
                                    return (
                                      <Link
                                        key={category.id}
                                        href={category.href}
                                        role="menuitem"
                                        data-shop-menu-item="true"
                                        onClick={() => closeShopDropdown()}
                                        className="group flex items-center gap-2.5 -mx-2 px-2 py-1.5 rounded-lg transition-colors hover:bg-black/3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                                      >
                                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-black/5 transition-colors group-hover:bg-black/10">
                                          <Icon size={13} weight="bold" className="text-black/70" />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                          <p className="text-[13px] font-black uppercase tracking-wide text-black truncate leading-tight">{category.label}</p>
                                          <p className="text-[10px] text-black/55 truncate leading-snug">{category.description}</p>
                                        </div>
                                        <ArrowRight size={12} weight="bold" className="text-black/30 transition-transform group-hover:translate-x-0.5 group-hover:text-black/70" />
                                      </Link>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Trending Now strip */}
                          <div className="h-px bg-black/5 my-4" />

                          <div className="mb-3 flex items-center justify-between">
                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-black/40">
                              Trending Now
                            </p>
                            <Link
                              href="/products"
                              role="menuitem"
                              data-shop-menu-item="true"
                              ref={shopMenuLastItemRef}
                              autoFocus={shopMenuFocusTarget === 'last'}
                              onClick={() => closeShopDropdown()}
                              className="group inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-black/55 hover:text-black transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                            >
                              View all
                              <ArrowRight size={11} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
                            </Link>
                          </div>

                          {shopMenuProductsLoading ? (
                            <div className="grid grid-cols-4 gap-3">
                              {[0, 1, 2, 3].map((skeleton) => (
                                <div key={`shop-grid-skeleton-${skeleton}`} className="animate-pulse rounded-lg bg-black/2 p-2">
                                  <div className="mb-1.5 aspect-4/3 rounded-md bg-black/10" />
                                  <div className="space-y-1">
                                    <div className="h-2 w-3/4 bg-black/10 rounded" />
                                    <div className="h-2 w-1/2 bg-black/8 rounded" />
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
                                    className="group rounded-lg bg-black/2 p-2 transition-colors hover:bg-black/4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                                  >
                                    <div className="relative mb-1.5 aspect-4/3 w-full overflow-hidden rounded-md bg-black/5">
                                      <Image
                                        src={imageUrl}
                                        alt={product.name}
                                        fill
                                        sizes="(min-width: 1024px) 180px, 120px"
                                        className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                                      />
                                    </div>
                                    <p className="line-clamp-1 text-[11px] font-black uppercase tracking-[0.08em] text-black/90">
                                      {product.name}
                                    </p>
                                    <div className="flex items-center justify-between gap-1.5 mt-0.5">
                                      <span className="text-[11px] font-black text-black/85">{formatCurrency(product.price)}</span>
                                      {product.colors.length > 0 ? (
                                        <div className="flex items-center gap-0.5">
                                          {product.colors.slice(0, 3).map((color) => (
                                            <span
                                              key={`${product.id}-${color.hex}-${color.label}`}
                                              title={color.label}
                                              className="h-2 w-2 rounded-full border border-black/15"
                                              style={{ backgroundColor: color.hex }}
                                            />
                                          ))}
                                          {product.colors.length > 3 ? (
                                            <span className="text-[9px] font-bold text-black/40 ml-0.5">
                                              +{product.colors.length - 3}
                                            </span>
                                          ) : null}
                                        </div>
                                      ) : null}
                                    </div>
                                  </Link>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed border-black/15 p-3 text-xs text-black/50">
                              We couldn&apos;t load product previews. Use View all above.
                            </div>
                          )}
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
              <Image
                src="/assets/head-over-feels-wordmark.png"
                alt="Head Over Feels"
                data-testid="nav-wordmark-desktop"
                width={819}
                height={123}
                sizes="(max-width: 1279px) 220px, 270px"
                className="h-auto w-[13.75rem] object-contain xl:w-[16.9rem]"
              />
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
              <button
                onClick={() => setMiniCartOpen(true)}
                className="hidden lg:flex relative p-2.5 text-black/50 hover:text-black hover:bg-black/5 transition-all duration-200"
                aria-label="Shopping cart"
              >
                <Bag size={22} weight="bold" />
                {cartItemCount > 0 && (
                  <span className="absolute top-0 right-0 bg-black text-white text-[10px] font-black h-[18px] min-w-[18px] px-1 flex items-center justify-center">
                    {cartItemCount > 9 ? '9+' : cartItemCount}
                  </span>
                )}
              </button>

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

              {/* Profile button — mobile only, replaces hamburger */}
              <Link
                href={user ? '/profile' : '/signin'}
                className="relative lg:hidden p-2 -mr-1.5 transition-opacity hover:opacity-75"
                aria-label={user ? 'Profile' : 'Sign in'}
              >
                {user ? (
                  <UserAvatar
                    src={user.profilePictureUrl}
                    name={user.name}
                    size={32}
                    className="ring-2 ring-black/10"
                  />
                ) : (
                  <UserCircle size={28} weight="regular" className="text-black/50" />
                )}
              </Link>

            </div>
          </div>
        </div>
      </nav>
      <div className="h-[4.5rem] md:h-[5rem] lg:hidden" aria-hidden="true" />

      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />


      <MiniCart open={miniCartOpen} onClose={() => setMiniCartOpen(false)} />
      <MobileBottomNav onSearchClick={() => setSearchOpen(true)} />
    </>
  )
}
