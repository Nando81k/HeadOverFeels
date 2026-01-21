'use client'

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import { X, MagnifyingGlass } from '@phosphor-icons/react'
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
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Desktop: Top Panel - slides down from top */}
          <motion.div
            initial={{ y: '-100%' }}
            animate={{ y: 0 }}
            exit={{ y: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="hidden md:block fixed inset-x-0 top-0 z-[100] bg-white max-h-[85vh] overflow-auto shadow-2xl"
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

          {/* Mobile: Bottom Sheet with swipe-to-dismiss */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info: PanInfo) => {
              // Close if dragged down more than 100px or with velocity
              if (info.offset.y > 100 || info.velocity.y > 500) {
                onClose()
              }
            }}
            className="md:hidden fixed inset-x-0 bottom-0 z-[100] bg-white rounded-t-3xl shadow-2xl"
            style={{ 
              height: '90vh',
              maxHeight: '90vh'
            }}
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none">
              <div className="w-12 h-1.5 bg-black/20 rounded-full" />
            </div>

            {/* Header with search input */}
            <div className="sticky top-0 z-10 bg-white px-4 pb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black text-black tracking-tight">Search</h2>
                <button
                  onClick={onClose}
                  className="w-10 h-10 flex items-center justify-center text-black/40 hover:text-black hover:bg-black/5 transition-all rounded-full"
                  aria-label="Close search"
                >
                  <X size={22} weight="bold" />
                </button>
              </div>
              
              {/* Mobile Search Input */}
              <div className="relative">
                <MagnifyingGlass 
                  size={20} 
                  weight="bold" 
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSubmit()
                    }
                  }}
                  placeholder="What are you looking for?"
                  autoFocus
                  className="w-full pl-12 pr-4 py-4 bg-black/[0.03] border-0 text-black placeholder-black/40 text-base rounded-xl focus:outline-none focus:ring-2 focus:ring-black/10"
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-black/30 hover:text-black"
                  >
                    <X size={16} weight="bold" />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Content */}
            <div 
              className="overflow-y-auto touch-pan-y px-4 pb-8"
              style={{ height: 'calc(90vh - 140px)' }}
            >
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

            {/* Search Button - Fixed at bottom */}
            {query.trim() && (
              <div 
                className="sticky bottom-0 p-4 bg-gradient-to-t from-white via-white to-white/90 border-t border-black/5"
                style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
              >
                <button
                  onClick={handleSubmit}
                  className="w-full py-4 bg-black text-white font-bold uppercase tracking-wider text-sm hover:bg-black/90 transition-all shadow-lg rounded-xl flex items-center justify-center gap-2"
                >
                  <MagnifyingGlass size={18} weight="bold" />
                  Search &quot;{query.trim()}&quot;
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
