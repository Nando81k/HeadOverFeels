'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Product } from '@/lib/api/products'

const RECENT_SEARCHES_KEY = 'headoverfeels_recent_searches'
const MAX_RECENT_SEARCHES = 6
const DEBOUNCE_DELAY = 250

export interface UseSearchReturn {
  query: string
  setQuery: (query: string) => void
  results: Product[]
  isLoading: boolean
  recentSearches: string[]
  trendingSearches: string[]
  featuredProducts: Product[]
  clearRecentSearches: () => void
  removeRecentSearch: (search: string) => void
  handleSearch: (searchQuery?: string) => void
  saveRecentSearch: (searchQuery: string) => void
}

const TRENDING_SEARCHES = [
  'hoodies',
  'graphic tees',
  'new arrivals',
  'best sellers',
  'accessories',
]

function normalizeProductsResponse(payload: unknown): Product[] {
  if (!payload || typeof payload !== 'object') {
    return []
  }

  const record = payload as Record<string, unknown>

  if (Array.isArray(record.data)) {
    return record.data as Product[]
  }

  if (Array.isArray(record.products)) {
    return record.products as Product[]
  }

  const nestedData = record.data
  if (nestedData && typeof nestedData === 'object') {
    const nestedRecord = nestedData as Record<string, unknown>
    if (Array.isArray(nestedRecord.data)) {
      return nestedRecord.data as Product[]
    }
    if (Array.isArray(nestedRecord.products)) {
      return nestedRecord.products as Product[]
    }
  }

  return []
}

export function useSearch(): UseSearchReturn {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestAbortRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)

  const saveRecentSearch = useCallback((searchQuery: string) => {
    const trimmed = searchQuery.trim()
    if (!trimmed) {
      return
    }

    try {
      const updated = [
        trimmed,
        ...recentSearches.filter((existing) => existing.toLowerCase() !== trimmed.toLowerCase()),
      ].slice(0, MAX_RECENT_SEARCHES)

      setRecentSearches(updated)
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
    } catch (error) {
      console.error('Failed to save recent search:', error)
    }
  }, [recentSearches])

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([])
    localStorage.removeItem(RECENT_SEARCHES_KEY)
  }, [])

  const removeRecentSearch = useCallback((search: string) => {
    const updated = recentSearches.filter((entry) => entry !== search)
    setRecentSearches(updated)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
  }, [recentSearches])

  const searchProducts = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim()
    if (trimmed.length < 2) {
      setResults([])
      setIsLoading(false)
      requestAbortRef.current?.abort()
      return
    }

    requestAbortRef.current?.abort()
    const controller = new AbortController()
    requestAbortRef.current = controller

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setIsLoading(true)

    try {
      const params = new URLSearchParams({
        search: trimmed,
        isActive: 'true',
        limit: '8',
      })
      const response = await fetch(`/api/products?${params.toString()}`, {
        signal: controller.signal,
      })

      const payload = await response.json()
      const products = normalizeProductsResponse(payload).slice(0, 8)

      if (requestIdRef.current === requestId) {
        setResults(products)
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      if (requestIdRef.current === requestId) {
        setResults([])
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false)
      }
    }
  }, [])

  const fetchFeaturedProducts = useCallback(async () => {
    try {
      const featuredResponse = await fetch('/api/products?isActive=true&isFeatured=true&limit=6')
      const featuredPayload = await featuredResponse.json()
      const featured = normalizeProductsResponse(featuredPayload).slice(0, 6)

      if (featured.length > 0) {
        setFeaturedProducts(featured)
        return
      }

      const fallbackResponse = await fetch('/api/products?isActive=true&limit=6')
      const fallbackPayload = await fallbackResponse.json()
      setFeaturedProducts(normalizeProductsResponse(fallbackPayload).slice(0, 6))
    } catch (error) {
      console.error('Failed to fetch featured products:', error)
      setFeaturedProducts([])
    }
  }, [])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT_SEARCHES))
        }
      }
    } catch (error) {
      console.error('Failed to load recent searches:', error)
    }
  }, [])

  useEffect(() => {
    void fetchFeaturedProducts()
  }, [fetchFeaturedProducts])

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (query.trim().length < 2) {
      requestAbortRef.current?.abort()
      setResults([])
      setIsLoading(false)
      return
    }

    debounceTimerRef.current = setTimeout(() => {
      void searchProducts(query)
    }, DEBOUNCE_DELAY)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [query, searchProducts])

  useEffect(() => {
    return () => {
      requestAbortRef.current?.abort()
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  const handleSearch = useCallback((searchQuery?: string) => {
    const candidate = (searchQuery ?? query).trim()
    if (candidate) {
      saveRecentSearch(candidate)
    }
  }, [query, saveRecentSearch])

  return {
    query,
    setQuery,
    results,
    isLoading,
    recentSearches,
    trendingSearches: TRENDING_SEARCHES,
    featuredProducts,
    clearRecentSearches,
    removeRecentSearch,
    handleSearch,
    saveRecentSearch,
  }
}
