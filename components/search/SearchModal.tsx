'use client'

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from '@phosphor-icons/react'
import { SearchInput } from './SearchInput'
import { SearchResults } from './SearchResults'
import { SearchSuggestions } from './SearchSuggestions'
import { useSearch } from './useSearch'

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const router = useRouter()
  const {
    query,
    setQuery,
    results,
    isLoading,
    recentSearches,
    categories,
    trendingSearches,
    featuredProducts,
    clearRecentSearches,
    removeRecentSearch,
    saveRecentSearch,
  } = useSearch()

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  // Reset query when modal closes
  useEffect(() => {
    if (!isOpen) {
      setQuery('')
    }
  }, [isOpen, setQuery])

  // Handle search submission
  const handleSubmit = useCallback(() => {
    if (query.trim()) {
      saveRecentSearch(query.trim())
      router.push(`/products?search=${encodeURIComponent(query.trim())}`)
      onClose()
    }
  }, [query, saveRecentSearch, router, onClose])

  // Handle clicking a search suggestion
  const handleSuggestionClick = useCallback((search: string) => {
    setQuery(search)
    saveRecentSearch(search)
    router.push(`/products?search=${encodeURIComponent(search)}`)
    onClose()
  }, [setQuery, saveRecentSearch, router, onClose])

  // Handle product click
  const handleProductClick = useCallback(() => {
    if (query.trim()) {
      saveRecentSearch(query.trim())
    }
    onClose()
  }, [query, saveRecentSearch, onClose])

  // Handle view all results
  const handleViewAll = useCallback(() => {
    if (query.trim()) {
      saveRecentSearch(query.trim())
      router.push(`/products?search=${encodeURIComponent(query.trim())}`)
      onClose()
    }
  }, [query, saveRecentSearch, router, onClose])

  const showResults = query.trim().length >= 2

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-100"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Search Panel */}
          <motion.div
            initial={{ y: '-100%' }}
            animate={{ y: 0 }}
            exit={{ y: '-100%' }}
            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            className="relative bg-white min-h-screen md:min-h-0 md:max-h-[85vh] overflow-auto"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2 text-black/50 hover:text-black transition-colors z-10"
              aria-label="Close search"
            >
              <X size={28} weight="light" />
            </button>

            {/* Content */}
            <div className="max-w-5xl mx-auto px-6 py-16 md:py-20">
              {/* Header */}
              <div className="text-center mb-10">
                <h2 className="text-xs font-medium tracking-[0.3em] uppercase text-black/40 mb-8">
                  Search
                </h2>
                
                {/* Search Input */}
                <SearchInput
                  value={query}
                  onChange={setQuery}
                  onSubmit={handleSubmit}
                  isLoading={isLoading}
                />
              </div>

              {/* Results or Suggestions */}
              <div className="mt-12">
                {showResults ? (
                  <SearchResults
                    results={results}
                    query={query}
                    onProductClick={handleProductClick}
                    onViewAll={handleViewAll}
                  />
                ) : (
                  <SearchSuggestions
                    recentSearches={recentSearches}
                    trendingSearches={trendingSearches}
                    categories={categories}
                    featuredProducts={featuredProducts}
                    onSearchClick={handleSuggestionClick}
                    onRemoveRecent={removeRecentSearch}
                    onClearRecent={clearRecentSearches}
                    onClose={onClose}
                  />
                )}
              </div>

              {/* Keyboard hint */}
              <p className="text-center text-xs text-black/30 mt-12">
                Press <kbd className="px-2 py-0.5 bg-black/5 rounded text-[10px] font-medium mx-1">ESC</kbd> to close
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
