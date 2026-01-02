'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Product } from '@/lib/api/products'

const RECENT_SEARCHES_KEY = 'headoverfeels_recent_searches'
const MAX_RECENT_SEARCHES = 5
const DEBOUNCE_DELAY = 400

export interface Category {
  id: string
  name: string
  slug: string
}

export interface UseSearchReturn {
  query: string
  setQuery: (query: string) => void
  results: Product[]
  isLoading: boolean
  recentSearches: string[]
  categories: Category[]
  trendingSearches: string[]
  clearRecentSearches: () => void
  removeRecentSearch: (search: string) => void
  handleSearch: (searchQuery?: string) => void
  saveRecentSearch: (searchQuery: string) => void
}

const TRENDING_SEARCHES = [
  'hoodies',
  'limited edition',
  'streetwear',
  't-shirts',
  'new arrivals',
]

export function useSearch(): UseSearchReturn {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
      if (stored) {
        setRecentSearches(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Failed to load recent searches:', error)
    }
  }, [])

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/categories')
        if (response.ok) {
          const data = await response.json()
          setCategories(data)
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error)
      }
    }
    fetchCategories()
  }, [])

  // Search products with debounce
  const searchProducts = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setResults([])
      return
    }

    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        limit: '8',
      })
      const response = await fetch(`/api/products/search?${params}`)
      
      if (response.ok) {
        const data = await response.json()
        setResults(data.data || [])
      } else {
        setResults([])
      }
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Debounced search effect
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (query.trim().length >= 2) {
      setIsLoading(true)
      searchTimeoutRef.current = setTimeout(() => {
        searchProducts(query)
      }, DEBOUNCE_DELAY)
    } else {
      setResults([])
      setIsLoading(false)
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
      const trimmed = searchQuery.trim()
      const updated = [
        trimmed,
        ...recentSearches.filter((s) => s.toLowerCase() !== trimmed.toLowerCase()),
      ].slice(0, MAX_RECENT_SEARCHES)

      setRecentSearches(updated)
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
    } catch (error) {
      console.error('Failed to save recent search:', error)
    }
  }, [recentSearches])

  // Clear all recent searches
  const clearRecentSearches = useCallback(() => {
    setRecentSearches([])
    localStorage.removeItem(RECENT_SEARCHES_KEY)
  }, [])

  // Remove a single recent search
  const removeRecentSearch = useCallback((search: string) => {
    const updated = recentSearches.filter((s) => s !== search)
    setRecentSearches(updated)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
  }, [recentSearches])

  // Handle search submission
  const handleSearch = useCallback((searchQuery?: string) => {
    const q = searchQuery || query
    if (q.trim()) {
      saveRecentSearch(q.trim())
    }
  }, [query, saveRecentSearch])

  return {
    query,
    setQuery,
    results,
    isLoading,
    recentSearches,
    categories,
    trendingSearches: TRENDING_SEARCHES,
    clearRecentSearches,
    removeRecentSearch,
    handleSearch,
    saveRecentSearch,
  }
}
