'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MagnifyingGlass, X, CircleNotch } from '@phosphor-icons/react'
import { productApi, Product } from '@/lib/api/products'
import ProductImage from '@/components/ui/ProductImage'
import { getPrimaryImageWithFallback } from '@/lib/commerce/product-placeholders'
import { motion, AnimatePresence } from 'framer-motion'

interface ModernSearchBarProps {
  placeholder?: string
  className?: string
  onSearch?: (query: string) => void
  autoFocus?: boolean
  onClose?: () => void
}

const RECENT_SEARCHES_KEY = 'headoverfeels_recent_searches'
const MAX_RECENT_SEARCHES = 5
const DEBOUNCE_DELAY = 400

const POPULAR_SEARCHES = [
  'hoodies',
  'limited edition',
  'streetwear',
  't-shirts',
  'new arrivals',
]

function getPrimaryColorContext(product: Product): { color?: string; colorHex?: string } | null {
  const withHex = product.variants.find((variant) => variant.colorHex)
  if (withHex) {
    return {
      color: withHex.color,
      colorHex: withHex.colorHex,
    }
  }

  const withLabel = product.variants.find((variant) => variant.color)
  if (withLabel) {
    return {
      color: withLabel.color,
    }
  }

  return null
}

export function ModernSearchBar({
  placeholder = 'Search products...',
  className = '',
  onSearch,
  autoFocus = false,
  onClose,
}: ModernSearchBarProps) {
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [productResults, setProductResults] = useState<Product[]>([])
  const [bestSellers, setBestSellers] = useState<Product[]>([])
  const [isSearching, setIsSearching] = useState(false)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()

  // Load recent searches on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
      setRecentSearches(stored ? JSON.parse(stored) : [])
    } catch (error) {
      console.error('Failed to load recent searches:', error)
    }
  }, [])

  // Load best sellers on mount
  useEffect(() => {
    const fetchBestSellers = async () => {
      try {
        const response = await productApi.getAll({ 
          isActive: true,
          isFeatured: true,
          limit: 8
        })
        if (response.data) {
          setBestSellers(response.data.data)
        }
      } catch (error) {
        console.error('Failed to load best sellers:', error)
      }
    }
    fetchBestSellers()
  }, [])

  // Search products with debounce
  const searchProducts = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return
    
    setIsSearching(true)
    try {
      const response = await productApi.getAll({ 
        isActive: true,
        search: searchQuery,
        limit: 50
      })
      
      if (response.data) {
        setProductResults(response.data.data.slice(0, 8))
      } else {
        setProductResults([])
      }
    } catch (error) {
      console.error('Search error:', error)
      setProductResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Debounced search effect
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (query.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchProducts(query)
      }, DEBOUNCE_DELAY)
    } else {
      setProductResults([])
      setIsSearching(false)
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [query, searchProducts])

  // Save search to recent searches
  const saveRecentSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return

    try {
      const trimmedQuery = searchQuery.trim()
      const updated = [
        trimmedQuery,
        ...recentSearches.filter((s) => s !== trimmedQuery),
      ].slice(0, MAX_RECENT_SEARCHES)

      setRecentSearches(updated)
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
    } catch (error) {
      console.error('Failed to save recent search:', error)
    }
  }, [recentSearches])

  // Clear recent searches
  const clearRecentSearches = useCallback(() => {
    setRecentSearches([])
    localStorage.removeItem(RECENT_SEARCHES_KEY)
  }, [])

  // Handle search submission
  const handleSearch = useCallback((searchQuery: string) => {
    const trimmedQuery = searchQuery.trim()
    if (!trimmedQuery) return

    saveRecentSearch(trimmedQuery)
    setShowDropdown(false)
    setQuery('')

    if (onSearch) {
      onSearch(trimmedQuery)
    } else {
      router.push(`/products?search=${encodeURIComponent(trimmedQuery)}`)
    }
    
    onClose?.()
  }, [onSearch, router, saveRecentSearch, onClose])

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSearch(query)
  }

  // Handle suggestion click
  const handleSuggestionClick = (searchQuery: string) => {
    setQuery(searchQuery)
    handleSearch(searchQuery)
  }

  // Handle input focus
  const handleFocus = () => {
    setIsFocused(true)
    setShowDropdown(true)
  }

  // Handle input blur
  const handleBlur = () => {
    setIsFocused(false)
    setTimeout(() => setShowDropdown(false), 150)
  }

  // Handle clear button
  const handleClear = () => {
    setQuery('')
    setProductResults([])
    inputRef.current?.focus()
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false)
        onClose?.()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Handle ESC key to close dropdown
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowDropdown(false)
        setQuery('')
        inputRef.current?.blur()
        onClose?.()
      }
    }

    document.addEventListener('keydown', handleEscKey)
    return () => document.removeEventListener('keydown', handleEscKey)
  }, [onClose])

  return (
    <div className={`relative w-full ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <MagnifyingGlass 
            size={22}
            weight="bold"
            className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${
              isFocused ? 'text-black' : 'text-black/40'
            }`}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            autoFocus={autoFocus}
            spellCheck="false"
            className={`
              w-full pl-14 pr-14 py-4 sm:py-5
              border-b-2 rounded-none
              focus:outline-none transition-all duration-300
              text-lg sm:text-xl font-medium tracking-wide
              placeholder:text-black/30 bg-transparent
              ${isFocused 
                ? 'border-black' 
                : 'border-black/20'
              }
            `}
          />
          <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {isSearching && (
              <CircleNotch size={22} weight="bold" className="text-black animate-spin" />
            )}
            {query && !isSearching && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 text-black/40 hover:text-black transition-colors"
                aria-label="Clear search"
              >
                <X size={20} weight="bold" />
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Dropdown Results */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="absolute top-full left-0 right-0 mt-6 bg-white rounded-2xl shadow-2xl z-50 max-h-[65vh] overflow-y-auto border border-black/5"
          >
            {/* PRODUCT RESULTS SECTION */}
            {query.trim().length >= 2 && productResults.length > 0 && (
              <div>
                <div className="px-6 pt-5 pb-3">
                  <p className="text-xs font-medium tracking-widest uppercase text-black/40">
                    Products
                  </p>
                </div>
                <div className="px-3 pb-4">
                  {productResults.slice(0, 6).map((product) => {
                    const colorContext = getPrimaryColorContext(product)
                    const imageUrl = getPrimaryImageWithFallback({
                      images: product.images,
                      productName: product.name,
                      productSlug: product.slug,
                      color: colorContext?.color,
                      colorHex: colorContext?.colorHex,
                    })

                    const variantPrices = product.variants?.map(v => v.price).filter((p): p is number => p !== null && p !== undefined) || []
                    const price = variantPrices.length > 0 ? Math.min(...variantPrices) : (typeof product.price === 'number' ? product.price : 0)

                    return (
                      <Link
                        key={product.id}
                        href={`/products/${product.slug}`}
                        onClick={() => { saveRecentSearch(query); onClose?.() }}
                        className="flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-black/5 transition-all group"
                      >
                        <div className="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-black/5">
                          <ProductImage 
                            src={imageUrl} 
                            alt={product.name} 
                            productSlug={product.slug}
                            color={colorContext?.color}
                            colorHex={colorContext?.colorHex}
                            width={64} 
                            height={64} 
                            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300" 
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-black truncate group-hover:text-black/70 transition-colors">
                            {product.name}
                          </p>
                          <p className="text-sm font-bold text-black/60 mt-0.5">
                            ${price.toFixed(2)}
                          </p>
                        </div>
                        <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-xs font-medium text-black/40">View →</span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
                {productResults.length > 6 && (
                  <div className="px-6 pb-5">
                    <button
                      onClick={() => handleSearch(query)}
                      className="w-full py-3 text-sm font-semibold text-black bg-black/5 hover:bg-black/10 rounded-xl transition-colors"
                    >
                      View all {productResults.length} results
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* NO RESULTS */}
            {query.trim().length >= 2 && !isSearching && productResults.length === 0 && (
              <div className="px-6 py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-black/5 flex items-center justify-center mx-auto mb-4">
                  <MagnifyingGlass size={24} weight="bold" className="text-black/30" />
                </div>
                <p className="text-base font-semibold text-black">No results found</p>
                <p className="text-sm text-black/50 mt-1">Try searching for something else</p>
              </div>
            )}

            {/* BEST SELLERS - When no query */}
            {query.trim().length < 2 && bestSellers.length > 0 && (
              <div>
                <div className="px-6 pt-5 pb-3">
                  <p className="text-xs font-medium tracking-widest uppercase text-black/40">
                    Popular Products
                  </p>
                </div>
                <div className="px-4 pb-4">
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {bestSellers.slice(0, 8).map((product) => {
                      const colorContext = getPrimaryColorContext(product)
                      const imageUrl = getPrimaryImageWithFallback({
                        images: product.images,
                        productName: product.name,
                        productSlug: product.slug,
                        color: colorContext?.color,
                        colorHex: colorContext?.colorHex,
                      })

                      const variantPrices = product.variants?.map(v => v.price).filter((p): p is number => p !== null && p !== undefined) || []
                      const price = variantPrices.length > 0 ? Math.min(...variantPrices) : (typeof product.price === 'number' ? product.price : 0)

                      return (
                        <Link 
                          key={product.id} 
                          href={`/products/${product.slug}`} 
                          onClick={() => onClose?.()} 
                          className="group"
                        >
                          <div className="aspect-square rounded-xl overflow-hidden bg-black/5 mb-2">
                            <ProductImage 
                              src={imageUrl} 
                              alt={product.name} 
                              productSlug={product.slug}
                              color={colorContext?.color}
                              colorHex={colorContext?.colorHex}
                              width={120} 
                              height={120} 
                              className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300" 
                            />
                          </div>
                          <p className="text-xs font-medium text-black truncate group-hover:text-black/70 transition-colors">
                            {product.name}
                          </p>
                          <p className="text-xs font-semibold text-black/50">${price.toFixed(2)}</p>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* RECENT SEARCHES */}
            {query.trim().length < 2 && recentSearches.length > 0 && (
              <div className="border-t border-black/5">
                <div className="flex items-center justify-between px-6 pt-4 pb-2">
                  <p className="text-xs font-medium tracking-widest uppercase text-black/40">
                    Recent Searches
                  </p>
                  <button 
                    onClick={clearRecentSearches} 
                    className="text-xs font-medium text-black/40 hover:text-black transition-colors"
                  >
                    Clear all
                  </button>
                </div>
                <div className="px-4 pb-4 flex flex-wrap gap-2">
                  {recentSearches.slice(0, 5).map((search, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => handleSuggestionClick(search)} 
                      className="px-4 py-2 text-sm font-medium text-black/70 bg-black/5 hover:bg-black/10 rounded-full transition-colors"
                    >
                      {search}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* TRENDING SEARCHES */}
            {query.trim().length < 2 && POPULAR_SEARCHES.some((s) => !recentSearches.includes(s)) && (
              <div className="border-t border-black/5">
                <div className="px-6 pt-4 pb-2">
                  <p className="text-xs font-medium tracking-widest uppercase text-black/40">
                    Trending
                  </p>
                </div>
                <div className="px-4 pb-5 flex flex-wrap gap-2">
                  {POPULAR_SEARCHES.filter((s) => !recentSearches.includes(s)).slice(0, 5).map((search, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => handleSuggestionClick(search)} 
                      className="px-4 py-2 text-sm font-medium text-black/70 bg-black/5 hover:bg-black/10 rounded-full transition-colors"
                    >
                      {search}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
