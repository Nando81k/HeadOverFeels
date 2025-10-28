'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, X, Clock, TrendingUp, Loader2 } from 'lucide-react'
import { productApi, Product } from '@/lib/api/products'
import ProductImage from '@/components/ui/ProductImage'
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
const DEBOUNCE_DELAY = 300

// Popular search terms
const POPULAR_SEARCHES = [
  'hoodies',
  'limited edition',
  'streetwear',
  't-shirts',
  'drops',
]

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
          limit: 6
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
        setProductResults(response.data.data.slice(0, 6))
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
    // Delay hiding dropdown to allow click events
    setTimeout(() => {
      setShowDropdown(false)
    }, 200)
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
    <div className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="relative z-50">
        <div className="relative">
          <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-200 ${
            isFocused ? 'text-[#FF3131]' : 'text-gray-400'
          }`} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className={`
              w-full pl-12 pr-12 py-4
              border-2 rounded-2xl
              focus:outline-none
              transition-all duration-300
              text-base font-medium
              placeholder:text-gray-400
              ${isFocused 
                ? 'border-[#FF3131] shadow-2xl shadow-red-100/50 bg-white scale-[1.02]' 
                : 'border-gray-200 shadow-lg bg-white hover:border-gray-300'
              }
            `}
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {isSearching && (
              <Loader2 className="w-5 h-5 text-[#FF3131] animate-spin" />
            )}
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Enhanced Suggestions Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ 
              duration: 0.3,
              ease: [0.4, 0, 0.2, 1]
            }}
            className="absolute top-full left-0 right-0 mt-4 bg-white border-2 border-gray-200 rounded-2xl shadow-2xl shadow-gray-200/50 z-50 overflow-hidden max-h-[600px] overflow-y-auto backdrop-blur-sm"
          >
            {/* Product Results */}
            {query.trim().length >= 2 && productResults.length > 0 && (
              <div className="border-b border-gray-100">
                <div className="px-5 py-4 bg-gradient-to-r from-red-50/50 to-white border-b border-red-100">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-[#FF3131]" />
                    <span className="text-sm font-bold text-gray-900">Search Results</span>
                    <span className="px-2 py-0.5 text-xs font-semibold bg-[#FF3131] text-white rounded-full">
                      {productResults.length}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 divide-y divide-gray-100">
                  {productResults.map((product) => {
                    // Parse images
                    let imageUrl = '/placeholder-product.jpg'
                    try {
                      let images
                      if (typeof product.images === 'string') {
                        images = JSON.parse(product.images)
                      } else {
                        images = product.images
                      }
                      if (images && images.length > 0) {
                        imageUrl = typeof images[0] === 'string' ? images[0] : images[0]?.url
                      }
                    } catch {
                      // Use placeholder
                    }

                    // Calculate price: check variant prices first, then fall back to product price
                    const variantPrices = product.variants?.map(v => v.price).filter((p): p is number => p !== null && p !== undefined) || []
                    const price = variantPrices.length > 0 
                      ? Math.min(...variantPrices) 
                      : (typeof product.price === 'number' ? product.price : 0)

                    return (
                      <Link
                        key={product.id}
                        href={`/products/${product.slug}`}
                        onClick={() => {
                          saveRecentSearch(query)
                          onClose?.()
                        }}
                        className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-all duration-200 group"
                      >
                        {/* Product Image */}
                        <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                          <ProductImage
                            src={imageUrl}
                            alt={product.name}
                            width={64}
                            height={64}
                            className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-300"
                          />
                          {product.isLimitedEdition && (
                            <div className="absolute top-1 right-1 bg-[#FF3131] text-white px-1 py-0.5 rounded text-[8px] font-bold">
                              Ltd
                            </div>
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="flex-grow min-w-0">
                          <h4 className="font-semibold text-sm text-gray-900 truncate group-hover:text-[#FF3131] transition-colors">
                            {product.name}
                          </h4>
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {product.description}
                          </p>
                        </div>

                        {/* Price */}
                        <div className="text-right flex-shrink-0">
                          <span className="text-base font-bold text-[#FF3131]">
                            ${price.toFixed(2)}
                          </span>
                          {product.variants && product.variants.length > 1 && (
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {product.variants.length} variants
                            </p>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
                {productResults.length === 6 && (
                  <button
                    onClick={() => handleSearch(query)}
                    className="w-full py-4 text-sm font-bold text-[#FF3131] hover:bg-red-50 transition-all duration-200 border-t border-gray-100 hover:border-red-100"
                  >
                    View all results for &ldquo;{query}&rdquo; →
                  </button>
                )}
              </div>
            )}

            {/* No Results Message */}
            {query.trim().length >= 2 && !isSearching && productResults.length === 0 && (
              <div className="px-5 py-12 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-red-50 to-orange-50 mb-4">
                  <Search className="w-10 h-10 text-[#FF3131]" />
                </div>
                <p className="text-gray-900 font-bold text-lg mb-2">No products found</p>
                <p className="text-sm text-gray-500">
                  We couldn&apos;t find any products matching &ldquo;{query}&rdquo;
                </p>
                <p className="text-sm text-gray-400 mt-2">Try searching with different keywords</p>
              </div>
            )}

            {/* Best Sellers - Show when search is empty */}
            {query.trim().length < 2 && bestSellers.length > 0 && (
              <div className="border-b border-gray-100">
                <div className="px-5 py-4 bg-gradient-to-r from-amber-50/50 to-white border-b border-amber-100">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#FF3131]" />
                    <span className="text-sm font-bold text-gray-900">Best Sellers</span>
                    <span className="px-2 py-0.5 text-xs font-semibold bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-full">
                      Featured
                    </span>
                  </div>
                </div>
                {/* Horizontal scrollable container */}
                <div className="px-5 py-4 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400">
                  <div className="flex gap-4 pb-2">
                    {bestSellers.map((product) => {
                      // Parse images
                      let imageUrl = '/placeholder-product.jpg'
                      try {
                        let images
                        if (typeof product.images === 'string') {
                          images = JSON.parse(product.images)
                        } else {
                          images = product.images
                        }
                        if (images && images.length > 0) {
                          imageUrl = typeof images[0] === 'string' ? images[0] : images[0]?.url
                        }
                      } catch {
                        // Use placeholder
                      }

                      // Calculate price: check variant prices first, then fall back to product price
                      const variantPrices = product.variants?.map(v => v.price).filter((p): p is number => p !== null && p !== undefined) || []
                      const price = variantPrices.length > 0 
                        ? Math.min(...variantPrices) 
                        : (typeof product.price === 'number' ? product.price : 0)

                      return (
                        <Link
                          key={product.id}
                          href={`/products/${product.slug}`}
                          onClick={() => {
                            onClose?.()
                          }}
                          className="flex-shrink-0 w-[180px] group"
                        >
                          {/* Product Card */}
                          <div className="bg-white rounded-xl border-2 border-gray-100 hover:border-[#FF3131] transition-all duration-200 overflow-hidden hover:shadow-lg">
                            {/* Product Image */}
                            <div className="relative w-full aspect-square bg-gray-100">
                              <ProductImage
                                src={imageUrl}
                                alt={product.name}
                                width={180}
                                height={180}
                                className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-300"
                              />
                              {product.isLimitedEdition && (
                                <div className="absolute top-2 right-2 bg-[#FF3131] text-white px-2 py-1 rounded text-[10px] font-bold">
                                  LIMITED
                                </div>
                              )}
                            </div>

                            {/* Product Info */}
                            <div className="p-3">
                              <h4 className="font-semibold text-sm text-gray-900 truncate group-hover:text-[#FF3131] transition-colors">
                                {product.name}
                              </h4>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-base font-bold text-[#FF3131]">
                                  ${price.toFixed(2)}
                                </span>
                                {product.variants && product.variants.length > 1 && (
                                  <span className="text-[10px] text-gray-400">
                                    {product.variants.length} variants
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Recent Searches */}
            {query.trim().length < 2 && recentSearches.length > 0 && (
              <div className="border-b border-gray-100">
                <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-blue-50/30 to-white border-b border-blue-100">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#FF3131]" />
                    <span className="text-sm font-bold text-gray-900">Recent Searches</span>
                  </div>
                  <button
                    onClick={clearRecentSearches}
                    className="text-xs font-bold text-gray-400 hover:text-[#FF3131] transition-colors duration-200 px-3 py-1 rounded-full hover:bg-red-50"
                  >
                    Clear All
                  </button>
                </div>
                {recentSearches.map((search, index) => (
                  <button
                    key={`recent-${index}`}
                    onClick={() => handleSuggestionClick(search)}
                    className="w-full text-left px-5 py-3.5 hover:bg-blue-50/50 flex items-center gap-3 transition-all duration-200 group border-b border-gray-50 last:border-0"
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                      <Clock className="w-4 h-4 text-gray-400 group-hover:text-[#FF3131] transition-colors" />
                    </div>
                    <span className="text-gray-700 font-medium group-hover:text-gray-900 transition-colors flex-1">{search}</span>
                    <span className="text-gray-400 group-hover:text-gray-600 text-xs">→</span>
                  </button>
                ))}
              </div>
            )}

            {/* Popular Searches */}
            {query.trim().length < 2 && POPULAR_SEARCHES.some((s) => !recentSearches.includes(s)) && (
              <div>
                <div className="flex items-center gap-2 px-5 py-4 bg-gradient-to-r from-purple-50/30 to-white text-sm font-bold text-gray-900 border-b border-purple-100">
                  <TrendingUp className="w-4 h-4 text-[#FF3131]" />
                  <span>Trending Searches</span>
                  <span className="px-2 py-0.5 text-xs font-semibold bg-purple-100 text-purple-700 rounded-full ml-auto">
                    Hot
                  </span>
                </div>
                {POPULAR_SEARCHES.filter((s) => !recentSearches.includes(s)).map((search, index) => (
                  <button
                    key={`popular-${index}`}
                    onClick={() => handleSuggestionClick(search)}
                    className="w-full text-left px-5 py-3.5 hover:bg-purple-50/50 flex items-center gap-3 transition-all duration-200 group border-b border-gray-50 last:border-0"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 group-hover:from-purple-200 group-hover:to-pink-200 flex items-center justify-center transition-colors">
                      <TrendingUp className="w-4 h-4 text-[#FF3131]" />
                    </div>
                    <span className="text-gray-700 font-medium group-hover:text-gray-900 transition-colors flex-1">{search}</span>
                    <span className="text-gray-400 group-hover:text-gray-600 text-xs">→</span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
