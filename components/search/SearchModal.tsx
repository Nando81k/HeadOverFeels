'use client'

import { useEffect, useMemo, useCallback, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { X, MagnifyingGlass, CircleNotch, Clock, TrendUp, ArrowUpRight } from '@phosphor-icons/react'
import { SearchResults } from './SearchResults'
import { QuickLink, SearchSuggestions } from './SearchSuggestions'
import { SearchProductCard } from './SearchProductCard'
import { useSearch } from './useSearch'
import { Product } from '@/lib/api/products'

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
}

type SearchNavigationItem =
  | { key: `product:${string}`; type: 'product'; product: Product }
  | { key: 'action:view-all'; type: 'view-all'; query: string }
  | { key: `quick:${string}`; type: 'quick-link'; href: string }
  | { key: `recent:${string}`; type: 'recent'; term: string }
  | { key: `trending:${string}`; type: 'trending'; term: string }
  | { key: `featured:${string}`; type: 'featured'; product: Product }

const QUICK_LINKS: QuickLink[] = [
  { label: 'All Products', href: '/products', description: 'Browse the full catalog' },
  { label: 'Collections', href: '/collections', description: 'Shop by curated collection' },
  { label: 'Hoodies', href: '/products?category=hoodies', description: 'Explore heavyweight comfort' },
  { label: 'T-Shirts', href: '/products?category=tshirts', description: 'Find everyday essentials' },
  { label: 'Accessories', href: '/products?category=accessories', description: 'Complete the fit' },
]

function makeTermKey(value: string): string {
  return value.trim().toLowerCase()
}


export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const router = useRouter()
  const desktopInputRef = useRef<HTMLInputElement>(null)
  const mobileInputRef = useRef<HTMLInputElement>(null)

  const {
    query,
    setQuery,
    results,
    isLoading,
    recentSearches,
    trendingSearches,
    featuredProducts,
    clearRecentSearches,
    removeRecentSearch,
    saveRecentSearch,
  } = useSearch()

  const [activeIndex, setActiveIndex] = useState(-1)

  const showResults = query.trim().length >= 2

  const productAutocompleteSuggestions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (normalizedQuery.length < 2) return []

    const seen = new Set<string>()
    const suggestions: string[] = []

    results.forEach((product) => {
      const candidate = product.name.trim()
      if (!candidate) return
      const normalizedCandidate = candidate.toLowerCase()
      if (!normalizedCandidate.includes(normalizedQuery) || seen.has(normalizedCandidate)) return
      seen.add(normalizedCandidate)
      suggestions.push(candidate)
    })

    return suggestions.slice(0, 4)
  }, [query, results])

  const navigationItems = useMemo<SearchNavigationItem[]>(() => {
    if (showResults) {
      const items: SearchNavigationItem[] = results.map((product) => ({
        key: `product:${product.id}` as const,
        type: 'product' as const,
        product,
      }))
      if (query.trim()) {
        items.push({ key: 'action:view-all', type: 'view-all', query: query.trim() })
      }
      return items
    }

    return [
      ...QUICK_LINKS.map((quickLink) => ({
        key: `quick:${quickLink.href}` as const,
        type: 'quick-link' as const,
        href: quickLink.href,
      })),
      ...recentSearches.map((search) => ({
        key: `recent:${makeTermKey(search)}` as const,
        type: 'recent' as const,
        term: search,
      })),
      ...trendingSearches.map((search) => ({
        key: `trending:${makeTermKey(search)}` as const,
        type: 'trending' as const,
        term: search,
      })),
      ...featuredProducts.map((product) => ({
        key: `featured:${product.id}` as const,
        type: 'featured' as const,
        product,
      })),
    ]
  }, [showResults, results, query, recentSearches, trendingSearches, featuredProducts, productAutocompleteSuggestions])

  useEffect(() => {
    if (!isOpen) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Focus the visible input after the open animation starts
  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => {
      desktopInputRef.current?.focus()
      mobileInputRef.current?.focus()
    }, 80)
    return () => clearTimeout(timer)
  }, [isOpen])

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value)
    setActiveIndex(-1)
  }, [setQuery])

  const closeModal = useCallback(() => {
    setQuery('')
    setActiveIndex(-1)
    onClose()
  }, [onClose, setQuery])

  const executeSearch = useCallback((value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    saveRecentSearch(trimmed)
    router.push(`/products?search=${encodeURIComponent(trimmed)}`)
    closeModal()
  }, [closeModal, router, saveRecentSearch])

  const openProduct = useCallback((slug: string) => {
    if (query.trim()) saveRecentSearch(query.trim())
    router.push(`/products/${slug}`)
    closeModal()
  }, [closeModal, query, router, saveRecentSearch])

  const openQuickLink = useCallback((href: string) => {
    router.push(href)
    closeModal()
  }, [closeModal, router])

  const runNavigationItem = useCallback((item: SearchNavigationItem | undefined) => {
    if (!item) return
    switch (item.type) {
      case 'product':
      case 'featured':
        openProduct(item.product.slug)
        return
      case 'quick-link':
        openQuickLink(item.href)
        return
      case 'recent':
      case 'trending':
        executeSearch(item.term)
        return
      case 'view-all':
        executeSearch(item.query)
        return
    }
  }, [executeSearch, openProduct, openQuickLink])

  const handleItemHover = useCallback((itemKey: string) => {
    const nextIndex = navigationItems.findIndex((item) => item.key === itemKey)
    if (nextIndex >= 0) setActiveIndex(nextIndex)
  }, [navigationItems])

  const handleInputKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeModal()
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (navigationItems.length === 0) return
      event.preventDefault()
      setActiveIndex((cur) => {
        if (event.key === 'ArrowDown') return cur >= navigationItems.length - 1 ? 0 : cur + 1
        return cur <= 0 ? navigationItems.length - 1 : cur - 1
      })
      return
    }

    if (event.key === 'Enter') {
      if (activeIndex >= 0) {
        event.preventDefault()
        runNavigationItem(navigationItems[activeIndex])
        return
      }
      if (query.trim()) {
        event.preventDefault()
        executeSearch(query)
      }
    }
  }, [activeIndex, closeModal, executeSearch, navigationItems, query, runNavigationItem])

  const activeItemKey = activeIndex >= 0 ? navigationItems[activeIndex]?.key ?? null : null

  const sharedResults = (autocompleteTestId: string) => (
    <SearchResults
      results={results}
      query={query}
      isLoading={isLoading}
      activeItemKey={activeItemKey}
      autocompleteSuggestions={productAutocompleteSuggestions}
      autocompleteTestId={autocompleteTestId}
      onProductClick={openProduct}
      onViewAll={() => executeSearch(query)}
      onSuggestionClick={executeSearch}
      onItemHover={handleItemHover}
    />
  )

  const sharedSuggestions = (
    <SearchSuggestions
      recentSearches={recentSearches}
      trendingSearches={trendingSearches}
      quickLinks={QUICK_LINKS}
      featuredProducts={featuredProducts}
      activeItemKey={activeItemKey}
      onSearchClick={executeSearch}
      onQuickLinkClick={openQuickLink}
      onProductClick={openProduct}
      onRemoveRecent={removeRecentSearch}
      onClearRecent={clearRecentSearches}
      onItemHover={handleItemHover}
    />
  )

  // Two-column desktop suggestions: left nav panel + right product grid
  const desktopSuggestions = (
    <div className="grid grid-cols-[220px_1fr] divide-x divide-black/6">
      {/* Left — Recent, Trending, Quick Links */}
      <div className="py-4 pr-6 space-y-5">
        {recentSearches.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/30">Recent</p>
              <button
                type="button"
                onClick={clearRecentSearches}
                className="text-[11px] text-black/35 transition-colors hover:text-black"
              >
                Clear all
              </button>
            </div>
            <div className="space-y-0.5">
              {recentSearches.map((search) => {
                const itemKey = `recent:${search.toLowerCase()}`
                const isActive = activeItemKey === itemKey
                return (
                  <div key={search} className="group flex items-center">
                    <button
                      type="button"
                      onClick={() => executeSearch(search)}
                      onMouseEnter={() => handleItemHover(itemKey)}
                      className={`flex flex-1 items-center gap-2.5 py-1.5 text-left transition-colors ${isActive ? 'text-black' : 'text-black/55'}`}
                    >
                      <Clock size={13} weight="bold" className={`shrink-0 ${isActive ? 'text-black/50' : 'text-black/25'}`} />
                      <span className="text-sm truncate">{search}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRecentSearch(search)}
                      className="ml-1 rounded-md p-1 text-black/25 opacity-0 transition-all hover:text-black group-hover:opacity-100"
                      aria-label={`Remove ${search} from recent searches`}
                    >
                      <X size={11} weight="bold" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {trendingSearches.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendUp size={12} weight="bold" className="text-black/30" />
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/30">Trending</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {trendingSearches.map((search) => {
                const itemKey = `trending:${search.toLowerCase()}`
                const isActive = activeItemKey === itemKey
                return (
                  <button
                    key={search}
                    type="button"
                    onClick={() => executeSearch(search)}
                    onMouseEnter={() => handleItemHover(itemKey)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                      isActive
                        ? 'border-black bg-black text-white'
                        : 'border-black/12 bg-black/2 text-black/60 hover:border-black/25 hover:text-black'
                    }`}
                  >
                    {search}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/30 mb-2">Quick Links</p>
          <div className="space-y-0.5">
            {QUICK_LINKS.map((link) => {
              const itemKey = `quick:${link.href}`
              const isActive = activeItemKey === itemKey
              return (
                <button
                  key={link.href}
                  type="button"
                  onClick={() => openQuickLink(link.href)}
                  onMouseEnter={() => handleItemHover(itemKey)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${
                    isActive ? 'bg-black/4' : 'hover:bg-black/3'
                  }`}
                >
                  <ArrowUpRight size={13} weight="bold" className={`shrink-0 ${isActive ? 'text-black/60' : 'text-black/25'}`} />
                  <span className={`text-sm ${isActive ? 'font-semibold text-black' : 'text-black/65'}`}>
                    {link.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Right — Popular Products grid */}
      <div className="py-4 pl-6">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/30 mb-3">Popular Products</p>
        {featuredProducts.length > 0 ? (
          <div className="grid grid-cols-4 gap-3 pb-4">
            {featuredProducts.slice(0, 4).map((product) => {
              const itemKey = `featured:${product.id}`
              return (
                <SearchProductCard
                  key={product.id}
                  product={product}
                  itemKey={itemKey}
                  isActive={activeItemKey === itemKey}
                  onProductClick={openProduct}
                  onItemHover={handleItemHover}
                />
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3 pb-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-black/10 bg-white">
                <div className="aspect-5/6 animate-pulse bg-black/5" />
                <div className="p-3 space-y-2">
                  <div className="h-3.5 w-3/4 animate-pulse rounded-full bg-black/6" />
                  <div className="h-3 w-1/2 animate-pulse rounded-full bg-black/4" />
                  <div className="flex gap-1.5 pt-1">
                    <div className="h-4 w-4 animate-pulse rounded-full bg-black/6" />
                    <div className="h-4 w-4 animate-pulse rounded-full bg-black/4" />
                  </div>
                  <div className="h-4 w-1/4 animate-pulse rounded-full bg-black/6" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Desktop — Bar overlay: sits above the nav, same height and styling */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            className="fixed inset-x-0 top-0 z-101 hidden h-20 items-center border-b border-black/10 bg-white/98 backdrop-blur-xl md:flex"
          >
            <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
              {isLoading ? (
                <CircleNotch size={18} weight="bold" className="shrink-0 animate-spin text-black/35" />
              ) : (
                <MagnifyingGlass size={18} weight="bold" className="shrink-0 text-black/35" />
              )}
              <input
                ref={desktopInputRef}
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Search products, colors, styles..."
                data-testid="search-input-desktop"
                className="flex-1 bg-transparent text-sm font-medium text-black placeholder:text-black/30 outline-none focus-visible:outline-none"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              <div className="flex items-center gap-2">
                {query && (
                  <button
                    onClick={() => handleQueryChange('')}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-black/8 text-black/45 transition-colors hover:bg-black/12 hover:text-black"
                    aria-label="Clear search"
                  >
                    <X size={11} weight="bold" />
                  </button>
                )}
                <div className="mx-1 h-4 w-px bg-black/12" />
                <button
                  onClick={closeModal}
                  className="whitespace-nowrap text-xs font-semibold text-black/40 transition-colors hover:text-black"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>

          {/* Desktop — Results/suggestions panel: drops directly below the bar */}
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="fixed inset-x-0 top-20 z-99 hidden border-b border-black/8 bg-white shadow-xl shadow-black/5 md:block"
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="max-h-[72vh] overflow-y-auto">
                {showResults ? (
                  <div className="max-w-3xl py-3">
                    {sharedResults('nav-search-autocomplete')}
                  </div>
                ) : (
                  desktopSuggestions
                )}
              </div>
            </div>
          </motion.div>

          {/* Desktop — Backdrop: subtle dark wash below the dropdown */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-20 bottom-0 z-97 hidden bg-black/20 md:block"
            onClick={closeModal}
          />

          {/* Mobile — Full-screen backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-100 bg-black/50 backdrop-blur-sm md:hidden"
            onClick={closeModal}
          />

          {/* Mobile — Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed inset-x-0 bottom-0 z-101 flex flex-col rounded-t-2xl bg-white md:hidden"
            style={{ maxHeight: '88vh' }}
            data-testid="mobile-search-sheet"
          >
            {/* Drag handle */}
            <div className="flex shrink-0 justify-center pb-1 pt-3">
              <div className="h-1 w-10 rounded-full bg-black/15" />
            </div>

            {/* Input row */}
            <div className="flex shrink-0 items-center gap-3 border-b border-black/8 px-4 py-3">
              {isLoading ? (
                <CircleNotch size={18} weight="bold" className="shrink-0 animate-spin text-black/35" />
              ) : (
                <MagnifyingGlass size={18} weight="bold" className="shrink-0 text-black/35" />
              )}
              <input
                ref={mobileInputRef}
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Search products, colors, styles..."
                data-testid="search-input-mobile"
                className="flex-1 bg-transparent text-sm font-medium text-black placeholder:text-black/30 outline-none focus-visible:outline-none"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              {query ? (
                <button
                  onClick={() => handleQueryChange('')}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-black/8 text-black/45"
                  aria-label="Clear search"
                >
                  <X size={12} weight="bold" />
                </button>
              ) : (
                <button
                  onClick={closeModal}
                  className="text-xs font-semibold text-black/45 transition-colors hover:text-black"
                  aria-label="Close search"
                >
                  Cancel
                </button>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {showResults ? sharedResults('nav-search-autocomplete-mobile') : sharedSuggestions}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
