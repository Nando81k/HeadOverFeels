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
  ArrowUpRight,
  TrendUp,
  Heart,
  Bell
} from '@phosphor-icons/react'

// Animated counter component for smooth number transitions
function AnimatedPoints({ value, previousValue }: { value: number; previousValue: number | null }) {
  const [displayValue, setDisplayValue] = useState(value)
  const [isAnimating, setIsAnimating] = useState(false)
  const [showGain, setShowGain] = useState(false)
  const pointsGained = previousValue !== null && value > previousValue ? value - previousValue : 0
  
  useEffect(() => {
    if (previousValue !== null && value !== previousValue) {
      setIsAnimating(true)
      setShowGain(value > previousValue)
      
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
          requestAnimationFrame(animate)
        } else {
          setIsAnimating(false)
          setTimeout(() => setShowGain(false), 2000)
        }
      }
      
      requestAnimationFrame(animate)
    } else {
      setDisplayValue(value)
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

// Product card component with clickable color variants
interface SearchProductCardProps {
  product: {
    id: string
    name: string
    slug: string
    price: number
    images: string
    variants: Array<{id: string, color?: string, colorHex?: string, images?: string}>
  }
  onSelect: () => void
}

function SearchProductCard({ product, onSelect }: SearchProductCardProps) {
  const [selectedColorHex, setSelectedColorHex] = useState<string | null>(null)
  
  // Get default image
  const getDefaultImage = () => {
    try {
      const images = typeof product.images === 'string' 
        ? JSON.parse(product.images) 
        : product.images
      if (images && images.length > 0) {
        const first = images[0]
        return (typeof first === 'string' ? first : first?.url) || '/placeholder-product.jpg'
      }
    } catch {
      // Keep default
    }
    return '/placeholder-product.jpg'
  }

  // Get unique color variants with their images
  const colorVariants = product.variants
    ?.filter((v) => v.colorHex)
    .reduce((acc: Array<{hex: string, name: string, image: string | null}>, v) => {
      if (v.colorHex && !acc.some(c => c.hex === v.colorHex)) {
        let variantImage: string | null = null
        if (v.images) {
          try {
            const parsed = typeof v.images === 'string' ? JSON.parse(v.images) : v.images
            if (parsed && parsed.length > 0) {
              const first = parsed[0]
              variantImage = (typeof first === 'string' ? first : first?.url) || null
            }
          } catch {
            // No variant image
          }
        }
        acc.push({ hex: v.colorHex, name: v.color || '', image: variantImage })
      }
      return acc
    }, []) || []

  // Get current display image based on selected color
  const currentImage = selectedColorHex 
    ? (colorVariants.find(c => c.hex === selectedColorHex)?.image || getDefaultImage())
    : getDefaultImage()

  return (
    <div 
      className="flex-1 min-w-0 group"
      role="listitem"
    >
      <Link
        href={`/products/${product.slug}${selectedColorHex ? `?color=${encodeURIComponent(selectedColorHex)}` : ''}`}
        onClick={onSelect}
        className="block focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
        aria-label={`${product.name}, $${product.price.toFixed(2)}`}
      >
        <div className="relative aspect-square bg-black/5 mb-2 overflow-hidden">
          <Image
            src={currentImage}
            alt=""
            fill
            className="object-cover transition-all duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
        </div>
        <p className="text-xs font-bold text-black truncate group-hover:text-black/70 transition-colors">
          {product.name}
        </p>
      </Link>
      <div className="flex items-center justify-between mt-1 gap-1">
        <span className="text-xs font-black text-black/50 tabular-nums shrink-0">
          ${product.price.toFixed(2)}
        </span>
        {colorVariants.length > 0 && (
          <div 
            className="flex items-center gap-1" 
            role="radiogroup" 
            aria-label={`Color options for ${product.name}`}
          >
            {colorVariants.slice(0, 4).map((color) => (
              <button
                key={color.hex}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setSelectedColorHex(selectedColorHex === color.hex ? null : color.hex)
                }}
                className={`w-3 h-3 rounded-full border-2 transition-all hover:scale-125 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-1 ${
                  selectedColorHex === color.hex 
                    ? 'border-black scale-110' 
                    : 'border-black/20 hover:border-black/50'
                }`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
                aria-label={`Select ${color.name} color${selectedColorHex === color.hex ? ' (selected)' : ''}`}
                role="radio"
                aria-checked={selectedColorHex === color.hex}
              />
            ))}
            {colorVariants.length > 4 && (
              <span className="text-[8px] text-black/40 ml-0.5">+{colorVariants.length - 4}</span>
            )}
          </div>
        )}
      </div>
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
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{id: string, name: string, slug: string, price: number, images: string, variants: Array<{id: string, color?: string, colorHex?: string, images?: string}>}>>([])
  const [popularProducts, setPopularProducts] = useState<Array<{id: string, name: string, slug: string, price: number, images: string, variants: Array<{id: string, color?: string, colorHex?: string, images?: string}>}>>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showNav, setShowNav] = useState(true)
  const [shopDropdownOpen, setShopDropdownOpen] = useState(false)
  const [userPoints, setUserPoints] = useState<number | null>(null)
  const [previousPoints, setPreviousPoints] = useState<number | null>(null)
  const shopDropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const cartItemCount = useCartStore(state => mounted ? state.getTotalItems() : 0)
  const { user, loading: authLoading } = useAuth()

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0)
    return () => clearTimeout(timer)
  }, [])

  // Keyboard shortcut: Cmd/Ctrl + K to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [searchOpen])

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100)
    }
  }, [searchOpen])

  // Fetch popular products when search opens
  useEffect(() => {
    if (searchOpen && popularProducts.length === 0) {
      // Fetch products - try featured first, fallback to any active products
      fetch('/api/products?limit=5&isActive=true')
        .then(res => res.json())
        .then(data => {
          const products = data.products || data.data || []
          if (products.length > 0) {
            setPopularProducts(products.slice(0, 5))
          }
        })
        .catch((err) => {
          console.error('Failed to fetch popular products:', err)
        })
    }
  }, [searchOpen, popularProducts.length])

  // Live search as user types - search across all products with partial matching
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    
    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        // Use the main products API with search parameter for better partial matching
        const res = await fetch(`/api/products?search=${encodeURIComponent(searchQuery)}&limit=8&isActive=true`)
        const data = await res.json()
        const products = data.products || data.data || []
        if (products.length > 0) {
          setSearchResults(products.slice(0, 5))
        } else {
          // If no results from API, try the search endpoint as fallback
          const searchRes = await fetch(`/api/products/search?q=${encodeURIComponent(searchQuery)}&limit=5`)
          const searchData = await searchRes.json()
          setSearchResults(searchData.products || [])
        }
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    let lastScroll = 0
    let ticking = false

    const onScroll = () => {
      const current = window.scrollY || 0

      if (mobileMenuOpen || searchOpen) {
        setShowNav(true)
        lastScroll = current
        return
      }

      // Check if we're on mobile (< 768px)
      const isMobile = window.innerWidth < 768
      
      // On mobile, always show the nav (sticky behavior)
      if (isMobile) {
        setShowNav(true)
        lastScroll = current
        return
      }

      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (current > lastScroll && current > 80) {
            setShowNav(false)
          } else {
            setShowNav(true)
          }
          lastScroll = current
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    // Also listen for resize to handle orientation changes
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [mobileMenuOpen, searchOpen])

  const fetchUserPoints = useCallback(async () => {
    try {
      const response = await fetch('/api/loyalty/me')
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
    if (user && mounted) {
      void fetchUserPoints()
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

  // Handle search submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/products?search=${encodeURIComponent(searchQuery.trim())}`)
      setSearchOpen(false)
      setSearchQuery('')
    }
  }

  const navLinks = [
    { href: '/collections', label: 'Collections' },
    { href: '/about', label: 'About' },
  ]

  const isActive = (href: string) => pathname === href
  const isShopActive = pathname === '/products' || pathname.startsWith('/products?')

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
              {user && userPoints !== null && (
                <Link
                  href="/loyalty/rewards"
                  className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-black/5 hover:bg-black hover:text-white text-black transition-all duration-200"
                  title="View Rewards"
                >
                  <Trophy size={14} weight="fill" />
                  <AnimatedPoints value={userPoints} previousValue={previousPoints} />
                  <span className="text-[9px] font-bold uppercase tracking-wider opacity-50">pts</span>
                </Link>
              )}
              
              {/* Search Trigger - Clean minimal style (Desktop) */}
              <button
                onClick={() => setSearchOpen(true)}
                className="hidden lg:flex items-center justify-center w-10 h-10 text-black/40 hover:text-black hover:bg-black/5 transition-all duration-200"
                aria-label="Search"
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

              {/* Profile / Sign In (Desktop) */}
              {!authLoading && (
                user ? (
                  <Link
                    href="/profile"
                    className="hidden lg:flex p-2 text-black/50 hover:text-black hover:bg-black/5 transition-all duration-200"
                    aria-label="Profile"
                  >
                    <UserCircle size={20} weight="fill" />
                  </Link>
                ) : (
                  <Link
                    href="/signin"
                    className="hidden lg:flex items-center gap-2 px-4 py-2 bg-black text-white text-[11px] font-black uppercase tracking-widest hover:bg-black/90 transition-all duration-200"
                  >
                    Sign In
                  </Link>
                )
              )}

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

      {/* Search Overlay - 55% Height Dropdown Style */}
      <AnimatePresence>
        {searchOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              onClick={() => {
                setSearchOpen(false)
                setSearchQuery('')
                setSearchResults([])
              }}
            />
            
            {/* Search Panel */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-0 left-0 right-0 z-50 bg-white shadow-2xl"
              style={{ maxHeight: '55vh' }}
            >
              {/* Search Header */}
              <div className="border-b border-black/10">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
                  <div className="flex items-center gap-4">
                    {/* Search Input */}
                    <div className="flex-1 relative">
                      <MagnifyingGlass 
                        size={20} 
                        weight="bold" 
                        className="absolute left-0 top-1/2 -translate-y-1/2 text-black/30" 
                      />
                      <form onSubmit={handleSearch}>
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search products..."
                          className="w-full pl-8 pr-4 py-2 text-xl md:text-2xl font-bold text-black placeholder:text-black/30 bg-transparent outline-none"
                          autoComplete="off"
                        />
                      </form>
                      {isSearching && (
                        <div className="absolute right-0 top-1/2 -translate-y-1/2">
                          <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    
                    {/* Close Button */}
                    <button
                      onClick={() => {
                        setSearchOpen(false)
                        setSearchQuery('')
                        setSearchResults([])
                      }}
                      className="w-10 h-10 flex items-center justify-center text-black/40 hover:text-black hover:bg-black/5 transition-all"
                      aria-label="Close search"
                    >
                      <X size={20} weight="bold" />
                    </button>
                  </div>
                  
                  {/* Keyboard hint */}
                  <p className="mt-2 text-[10px] text-black/30 uppercase tracking-wider">
                    Press Enter to search • ESC to close
                  </p>
                </div>
              </div>

              {/* Search Content */}
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(55vh - 110px)' }}>
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
                  
                  {/* Live Search Results */}
                  {searchQuery.trim() && searchResults.length > 0 && (
                    <div className="mb-8">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/30 mb-4">
                        Suggestions
                      </p>
                      <div className="space-y-1">
                        {searchResults.map((product) => {
                          let imageUrl = '/placeholder-product.jpg'
                          try {
                            const images = typeof product.images === 'string' 
                              ? JSON.parse(product.images) 
                              : product.images
                            if (images && images.length > 0) {
                              const first = images[0]
                              imageUrl = (typeof first === 'string' ? first : first?.url) || imageUrl
                            }
                          } catch {
                            // Keep default placeholder
                          }

                          // Get unique colors from variants
                          const colors = product.variants
                            ?.filter((v: { colorHex?: string }) => v.colorHex)
                            .reduce((acc: Array<{hex: string, name: string}>, v: { colorHex?: string, color?: string }) => {
                              if (v.colorHex && !acc.some(c => c.hex === v.colorHex)) {
                                acc.push({ hex: v.colorHex, name: v.color || '' })
                              }
                              return acc
                            }, [])
                            .slice(0, 4) || []

                          return (
                            <Link
                              key={product.id}
                              href={`/products/${product.slug}`}
                              onClick={() => {
                                setSearchOpen(false)
                                setSearchQuery('')
                                setSearchResults([])
                              }}
                              className="flex items-center gap-4 p-3 hover:bg-black/5 transition-colors group"
                            >
                              <div className="relative w-14 h-14 bg-black/5 shrink-0 overflow-hidden">
                                <Image
                                  src={imageUrl}
                                  alt={product.name}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-black truncate group-hover:text-black/70 transition-colors">
                                  {product.name}
                                </p>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-sm font-black text-black/50 tabular-nums">
                                    ${product.price.toFixed(2)}
                                  </span>
                                  {colors && colors.length > 0 && (
                                    <div className="flex items-center gap-1">
                                      {colors.map((color: {hex: string, name: string}) => (
                                        <span
                                          key={color.hex}
                                          className="w-3 h-3 rounded-full border border-black/10"
                                          style={{ backgroundColor: color.hex }}
                                          title={color.name}
                                        />
                                      ))}
                                      {product.variants && product.variants.filter((v: { colorHex?: string }) => v.colorHex).length > 4 && (
                                        <span className="text-[10px] text-black/40">
                                          +{product.variants.filter((v: { colorHex?: string }) => v.colorHex).length - 4}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <ArrowUpRight size={16} weight="bold" className="text-black/20 group-hover:text-black transition-colors shrink-0" />
                            </Link>
                          )
                        })}
                      </div>
                      
                      {/* View all results */}
                      <button
                        onClick={() => {
                          router.push(`/products?search=${encodeURIComponent(searchQuery)}`)
                          setSearchOpen(false)
                          setSearchQuery('')
                          setSearchResults([])
                        }}
                        className="mt-3 w-full py-3 text-xs font-black uppercase tracking-wider text-black/50 hover:text-black hover:bg-black/5 border border-black/10 transition-all"
                      >
                        View all results for &quot;{searchQuery}&quot;
                      </button>
                    </div>
                  )}
                  
                  {/* No results message */}
                  {searchQuery.trim() && !isSearching && searchResults.length === 0 && (
                    <div className="mb-8 text-center py-8">
                      <p className="text-sm text-black/40">No products found for &quot;{searchQuery}&quot;</p>
                      <p className="text-xs text-black/30 mt-1">Try a different search term</p>
                    </div>
                  )}
                  
                  {/* Default Content - Horizontal Layout */}
                  {!searchQuery.trim() && (
                    <div className="space-y-6">
                      {/* Trending Searches - Horizontal Pills */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <TrendUp size={14} weight="bold" className="text-black/30" />
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/30">
                            Trending Searches
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2" role="list" aria-label="Trending search terms">
                          {['Hoodies', 'Graphic Tees', 'New Arrivals', 'Best Sellers', 'Limited Drops', 'Accessories'].map((term) => (
                            <button
                              key={term}
                              onClick={() => {
                                router.push(`/products?search=${encodeURIComponent(term)}`)
                                setSearchOpen(false)
                                setSearchQuery('')
                              }}
                              className="px-4 py-2 text-xs font-bold text-black/60 border border-black/10 hover:border-black hover:text-black hover:bg-black/5 transition-all focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
                              role="listitem"
                            >
                              {term}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Popular Products - Horizontal Row */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Fire size={14} weight="fill" className="text-orange-500" />
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/30">
                            Popular Products
                          </p>
                        </div>
                        
                        {popularProducts.length === 0 ? (
                          <div className="flex gap-4" role="list" aria-label="Loading popular products">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <div key={i} className="flex-1 min-w-0 animate-pulse" role="listitem" aria-hidden="true">
                                <div className="aspect-square bg-black/10 mb-2" />
                                <div className="h-3 bg-black/10 w-3/4 mb-1" />
                                <div className="h-3 bg-black/10 w-1/2" />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex gap-4" role="list" aria-label="Popular products">
                            {popularProducts.slice(0, 5).map((product) => (
                              <SearchProductCard 
                                key={product.id} 
                                product={product} 
                                onSelect={() => {
                                  setSearchOpen(false)
                                  setSearchQuery('')
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
              <div className="sticky top-0 bg-white border-b border-black/5 px-5 py-4 flex items-center justify-between safe-area-inset-top">
                <span className="text-xs font-black uppercase tracking-widest text-black">Menu</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 -mr-2 text-black/50 hover:text-black transition-colors"
                >
                  <X size={24} weight="bold" />
                </button>
              </div>
              
              <div className="px-5 py-6 space-y-6 pb-safe">
                {/* User Section - Show points if logged in */}
                {user && userPoints !== null && (
                  <Link
                    href="/loyalty/rewards"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between p-4 bg-black text-white relative overflow-hidden group"
                  >
                    <AnimatePresence>
                      {previousPoints !== null && userPoints > previousPoints && (
                        <motion.div
                          initial={{ x: '-100%', opacity: 0 }}
                          animate={{ x: '200%', opacity: [0, 0.3, 0] }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 1.5 }}
                          className="absolute inset-0 w-1/2 bg-linear-to-r from-transparent via-white/20 to-transparent skew-x-12"
                        />
                      )}
                    </AnimatePresence>
                    <div className="flex items-center gap-3">
                      <motion.div 
                        className="w-10 h-10 bg-white/10 flex items-center justify-center"
                        animate={previousPoints !== null && userPoints > previousPoints ? {
                          scale: [1, 1.2, 1],
                          rotate: [0, -10, 10, 0]
                        } : {}}
                        transition={{ duration: 0.5 }}
                      >
                        <Trophy size={20} weight="fill" />
                      </motion.div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">Your Rewards</p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xl font-black tabular-nums">
                            <AnimatedPoints value={userPoints} previousValue={previousPoints} />
                          </span>
                          <span className="text-sm font-bold text-white/50">pts</span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight size={16} weight="bold" className="text-white/30 group-hover:text-white/70 transition-colors" />
                  </Link>
                )}
                
                {/* Quick Actions - Cart, Wishlist & Notifications */}
                <div className="grid grid-cols-3 gap-2">
                  <Link
                    href="/cart"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex flex-col items-center justify-center gap-1.5 p-4 bg-black text-white text-xs font-black uppercase tracking-wider"
                  >
                    <div className="relative">
                      <Bag size={20} weight="bold" />
                      {cartItemCount > 0 && (
                        <span className="absolute -top-1 -right-2 bg-white text-black text-[9px] font-black px-1 min-w-4 h-4 flex items-center justify-center">
                          {cartItemCount > 9 ? '9+' : cartItemCount}
                        </span>
                      )}
                    </div>
                    Cart
                  </Link>
                  <Link
                    href="/wishlist"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex flex-col items-center justify-center gap-1.5 p-4 border border-black text-black text-xs font-black uppercase tracking-wider hover:bg-black hover:text-white transition-colors"
                  >
                    <Heart size={20} weight="bold" />
                    Wishlist
                  </Link>
                  {user && (
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false)
                        // Open notification center after menu closes
                        setTimeout(() => {
                          const notificationBtn = document.querySelector('[aria-label*="Notifications"]') as HTMLButtonElement
                          if (notificationBtn) notificationBtn.click()
                        }, 350)
                      }}
                      className="flex flex-col items-center justify-center gap-1.5 p-4 border border-black text-black text-xs font-black uppercase tracking-wider hover:bg-black hover:text-white transition-colors"
                    >
                      <Bell size={20} weight="bold" />
                      Alerts
                    </button>
                  )}
                  {!user && (
                    <Link
                      href="/signin"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex flex-col items-center justify-center gap-1.5 p-4 border border-black text-black text-xs font-black uppercase tracking-wider hover:bg-black hover:text-white transition-colors"
                    >
                      <UserCircle size={20} weight="bold" />
                      Sign In
                    </Link>
                  )}
                </div>
                
                {/* Shop Section */}
                <div className="space-y-1">
                  <p className="px-1 text-[9px] font-black uppercase tracking-widest text-black/30 mb-3">Shop</p>
                  
                  <Link
                    href="/products"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-4 px-4 py-4 text-sm font-black uppercase tracking-wider transition-all ${
                      isShopActive
                        ? 'bg-black text-white'
                        : 'text-black hover:bg-black/5'
                    }`}
                  >
                    <Bag size={18} weight="bold" />
                    All Products
                  </Link>
                  
                  {/* Categories */}
                  <div className="space-y-0.5">
                    {categories.map((category) => {
                      const Icon = category.icon
                      return (
                        <Link
                          key={category.href}
                          href={category.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-wider text-black/60 hover:text-black hover:bg-black/5 transition-all"
                        >
                          <Icon size={16} weight="bold" />
                          {category.label}
                        </Link>
                      )
                    })}
                  </div>
                </div>
                
                {/* Divider */}
                <div className="h-px bg-black/10" />
                
                {/* Other Nav Links */}
                <div className="space-y-1">
                  {navLinks.map(link => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-4 px-4 py-4 text-sm font-black uppercase tracking-wider transition-all ${
                        isActive(link.href)
                          ? 'bg-black text-white'
                          : 'text-black hover:bg-black/5'
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
                
                {/* Divider */}
                <div className="h-px bg-black/10" />
                
                {/* Profile / Sign In */}
                {!authLoading && (
                  <Link
                    href={user ? "/profile" : "/signin"}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-4 px-4 py-4 text-sm font-black uppercase tracking-wider text-black hover:bg-black/5 transition-all"
                  >
                    <UserCircle size={18} weight={user ? "fill" : "bold"} />
                    {user ? 'My Profile' : 'Sign In'}
                  </Link>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
