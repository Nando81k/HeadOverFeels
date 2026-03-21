'use client'

import { useEffect, useMemo, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { X, MagnifyingGlass } from '@phosphor-icons/react'
import { SearchInput } from './SearchInput'
import { SearchResults } from './SearchResults'
import { QuickLink, SearchSuggestions } from './SearchSuggestions'
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
    if (normalizedQuery.length < 2) {
      return []
    }

    const seen = new Set<string>()
    const suggestions: string[] = []

    results.forEach((product) => {
      const candidate = product.name.trim()
      if (!candidate) {
        return
      }

      const normalizedCandidate = candidate.toLowerCase()
      if (!normalizedCandidate.includes(normalizedQuery) || seen.has(normalizedCandidate)) {
        return
      }

      seen.add(normalizedCandidate)
      suggestions.push(candidate)
    })

    return suggestions.slice(0, 8)
  }, [query, results])

  const navigationItems = useMemo<SearchNavigationItem[]>(() => {
    if (showResults) {
      const items: SearchNavigationItem[] = results.map((product) => ({
        key: `product:${product.id}`,
        type: 'product',
        product,
      }))

      if (query.trim()) {
        items.push({
          key: 'action:view-all',
          type: 'view-all',
          query: query.trim(),
        })
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
  }, [showResults, results, query, recentSearches, trendingSearches, featuredProducts])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
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
    if (!trimmed) {
      return
    }
    saveRecentSearch(trimmed)
    router.push(`/products?search=${encodeURIComponent(trimmed)}`)
    closeModal()
  }, [closeModal, router, saveRecentSearch])

  const openProduct = useCallback((slug: string) => {
    if (query.trim()) {
      saveRecentSearch(query.trim())
    }
    router.push(`/products/${slug}`)
    closeModal()
  }, [closeModal, query, router, saveRecentSearch])

  const openQuickLink = useCallback((href: string) => {
    router.push(href)
    closeModal()
  }, [closeModal, router])

  const runNavigationItem = useCallback((item: SearchNavigationItem | undefined) => {
    if (!item) {
      return
    }

    switch (item.type) {
      case 'product':
        openProduct(item.product.slug)
        return
      case 'featured':
        openProduct(item.product.slug)
        return
      case 'quick-link':
        openQuickLink(item.href)
        return
      case 'recent':
        executeSearch(item.term)
        return
      case 'trending':
        executeSearch(item.term)
        return
      case 'view-all':
        executeSearch(item.query)
        return
      default:
        return
    }
  }, [executeSearch, openProduct, openQuickLink])

  const handleItemHover = useCallback((itemKey: string) => {
    const nextIndex = navigationItems.findIndex((item) => item.key === itemKey)
    if (nextIndex >= 0) {
      setActiveIndex(nextIndex)
    }
  }, [navigationItems])

  const handleInputKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeModal()
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (navigationItems.length === 0) {
        return
      }

      event.preventDefault()
      setActiveIndex((currentIndex) => {
        if (event.key === 'ArrowDown') {
          return currentIndex >= navigationItems.length - 1 ? 0 : currentIndex + 1
        }
        return currentIndex <= 0 ? navigationItems.length - 1 : currentIndex - 1
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

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="hidden md:flex fixed inset-0 z-[101] flex-col bg-white"
          >
            <div className="border-b border-black/10 bg-white">
              <div className="mx-auto flex w-full max-w-7xl items-start justify-between gap-6 px-8 py-6">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/35">
                    Search
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-black">Find products fast</h2>
                  <div className="mt-5">
                    <SearchInput
                      value={query}
                      onChange={handleQueryChange}
                      onSubmit={() => executeSearch(query)}
                      onSuggestionSelect={executeSearch}
                      onKeyDown={handleInputKeyDown}
                      inputTestId="search-input-desktop"
                      suggestionsTestId="nav-search-autocomplete"
                      isLoading={isLoading}
                      placeholder="Search products, colors, and categories"
                      suggestions={productAutocompleteSuggestions}
                    />
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/10 text-black/45 transition-colors hover:border-black/30 hover:text-black"
                  aria-label="Close search"
                >
                  <X size={18} weight="bold" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              <div className="mx-auto h-full w-full max-w-7xl px-8 py-6">
                {showResults ? (
                  <div className="grid h-full grid-cols-[minmax(0,1fr)_360px] gap-6">
                    <div className="overflow-y-auto pr-1">
                      <SearchResults
                        results={results}
                        query={query}
                        isLoading={isLoading}
                        activeItemKey={activeItemKey}
                        onProductClick={openProduct}
                        onViewAll={() => executeSearch(query)}
                        onItemHover={handleItemHover}
                      />
                    </div>
                    <div className="overflow-y-auto rounded-2xl border border-black/10 bg-black/[0.015] p-3">
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
                    </div>
                  </div>
                ) : (
                  <div className="h-full overflow-y-auto pr-1">
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
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="md:hidden fixed inset-0 z-[101] flex flex-col bg-white"
            data-testid="mobile-search-sheet"
          >
            <div className="border-b border-black/10 px-4 py-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-black text-black">Search</h2>
                <button
                  onClick={closeModal}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 text-black/45"
                  aria-label="Close search"
                >
                  <X size={18} weight="bold" />
                </button>
              </div>

              <div className="relative">
                <MagnifyingGlass
                  size={18}
                  weight="bold"
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-black/35"
                />
                <input
                  value={query}
                  onChange={(event) => handleQueryChange(event.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Search products, colors, and categories"
                  data-testid="search-input-mobile"
                  autoFocus
                  className="w-full rounded-xl border border-black/10 bg-white py-3 pl-11 pr-4 text-sm font-semibold text-black placeholder:text-black/35 focus:border-black/30 focus:outline-none"
                />
                {query.trim().length >= 2 && productAutocompleteSuggestions.length > 0 ? (
                  <div
                    className="mt-3 overflow-hidden rounded-xl border border-black/10 bg-white"
                    data-testid="nav-search-autocomplete-mobile"
                  >
                    <div className="border-b border-black/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-black/45">
                      Suggestions
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {productAutocompleteSuggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => executeSearch(suggestion)}
                          className="flex w-full items-center justify-between border-b border-black/5 px-3 py-2.5 text-left text-sm text-black/75 transition-colors hover:bg-black/[0.03] hover:text-black last:border-b-0"
                        >
                          <span className="truncate">{suggestion}</span>
                          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-black/35">
                            Product
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {showResults ? (
                <SearchResults
                  results={results}
                  query={query}
                  isLoading={isLoading}
                  activeItemKey={activeItemKey}
                  onProductClick={openProduct}
                  onViewAll={() => executeSearch(query)}
                  onItemHover={handleItemHover}
                />
              ) : (
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
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
