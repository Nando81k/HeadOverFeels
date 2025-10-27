'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Clock, TrendingUp } from 'lucide-react'

interface SearchBarProps {
  placeholder?: string
  className?: string
  onSearch?: (query: string) => void
  autoFocus?: boolean
  showSuggestions?: boolean
}

interface SearchSuggestion {
  query: string
  type: 'recent' | 'popular'
}

const RECENT_SEARCHES_KEY = 'headoverfeels_recent_searches'
const MAX_RECENT_SEARCHES = 5

// Popular search terms - could be fetched from API
const POPULAR_SEARCHES = [
  'hoodies',
  'limited edition',
  'streetwear',
  't-shirts',
  'drops',
]

export function SearchBar({
  placeholder = 'Search products...',
  className = '',
  onSearch,
  autoFocus = false,
  showSuggestions = true,
}: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    // Initialize from localStorage
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Failed to load recent searches:', error)
      return []
    }
  })
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

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
      // Navigate to search results page
      router.push(`/products?search=${encodeURIComponent(trimmedQuery)}`)
    }
  }, [onSearch, router, saveRecentSearch])

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
    if (showSuggestions) {
      setShowDropdown(true)
    }
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
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Prepare suggestions
  const suggestions: SearchSuggestion[] = []
  if (showSuggestions && showDropdown) {
    // Add recent searches
    recentSearches.forEach((search) => {
      suggestions.push({ query: search, type: 'recent' })
    })

    // Add popular searches that aren't in recent
    POPULAR_SEARCHES.forEach((search) => {
      if (!recentSearches.includes(search)) {
        suggestions.push({ query: search, type: 'popular' })
      }
    })
  }

  return (
    <div className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
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
              w-full pl-10 pr-10 py-2 
              border border-gray-300 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent
              transition-all duration-200
              ${isFocused ? 'shadow-lg' : 'shadow-sm'}
            `}
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </form>

      {/* Suggestions Dropdown */}
      {showSuggestions && showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden"
        >
          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <div className="border-b border-gray-100">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Clock className="w-4 h-4" />
                  <span>Recent Searches</span>
                </div>
                <button
                  onClick={clearRecentSearches}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Clear
                </button>
              </div>
              {recentSearches.map((search, index) => (
                <button
                  key={`recent-${index}`}
                  onClick={() => handleSuggestionClick(search)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                >
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">{search}</span>
                </button>
              ))}
            </div>
          )}

          {/* Popular Searches */}
          {POPULAR_SEARCHES.some((s) => !recentSearches.includes(s)) && (
            <div>
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 text-sm font-medium text-gray-700">
                <TrendingUp className="w-4 h-4" />
                <span>Popular Searches</span>
              </div>
              {POPULAR_SEARCHES.filter((s) => !recentSearches.includes(s)).map((search, index) => (
                <button
                  key={`popular-${index}`}
                  onClick={() => handleSuggestionClick(search)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                >
                  <TrendingUp className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">{search}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
