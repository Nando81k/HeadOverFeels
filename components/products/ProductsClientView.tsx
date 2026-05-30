'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AnimatePresence, motion, PanInfo } from 'framer-motion'
import { ArrowRight, Faders, FunnelSimple, X } from '@phosphor-icons/react'
import { Navigation } from '@/components/layout/Navigation'
import { Product } from '@/lib/api/products'
import { ProductCard, ProductCardSkeleton } from '@/components/products/ProductCard'
import { ProductFilters } from '@/components/products/ProductFilters'
import {
  applyProductFilters,
  countActiveFilters,
  deriveAvailableColors,
  deriveAvailableSizes,
  FilterState,
  getDefaultFilterState,
  getPriceBounds,
  isDefaultPriceRange,
  parseFilterStateFromSearchParams,
  serializeFilterStateToSearchParams,
} from '@/components/products/product-filtering'

const SEARCH_SYNC_DEBOUNCE_MS = 250

function arraysEqual(first: string[], second: string[]): boolean {
  if (first.length !== second.length) {
    return false
  }
  return first.every((value, index) => value === second[index])
}

function areFilterStatesEqualExceptSearch(first: FilterState, second: FilterState): boolean {
  return (
    first.priceRange[0] === second.priceRange[0] &&
    first.priceRange[1] === second.priceRange[1] &&
    arraysEqual(first.sizes, second.sizes) &&
    arraysEqual(first.colors, second.colors) &&
    first.inStockOnly === second.inStockOnly &&
    first.sortBy === second.sortBy
  )
}

function formatCategoryName(slug: string): string {
  const categoryNames: Record<string, string> = {
    hoodies: 'Hoodies & Sweatshirts',
    tees: 'T-Shirts',
    tshirts: 'T-Shirts',
    't-shirts': 'T-Shirts',
    tops: 'Tops',
    jackets: 'Jackets',
    bottoms: 'Bottoms',
    accessories: 'Accessories',
  }
  return categoryNames[slug] || slug
}

function getCategoryDescription(slug: string): string {
  const descriptions: Record<string, string> = {
    hoodies:
      'Stay warm in style with premium hoodies and sweatshirts made for comfort and statement fits.',
    tees: 'Essential everyday pieces for a modern streetwear wardrobe.',
    tshirts: 'Essential everyday pieces for a modern streetwear wardrobe.',
    't-shirts': 'Essential everyday pieces for a modern streetwear wardrobe.',
    tops: 'Essential tops designed to layer, style, and repeat.',
    jackets: 'Outerwear built for style and function through every season.',
    bottoms: 'From relaxed joggers to tailored pants, complete the full look.',
    accessories: 'Complete your look with elevated accessories and everyday essentials.',
  }
  return (
    descriptions[slug] ||
    'Discover premium streetwear pieces designed for authentic expression.'
  )
}

interface ProductsClientViewProps {
  initialProducts: Product[]
}

export function ProductsClientView({ initialProducts }: ProductsClientViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParamsString = searchParams.toString()

  const categorySlug = searchParams.get('category') || ''

  const [showFilters, setShowFilters] = useState(false)

  const priceBounds = useMemo(() => getPriceBounds(initialProducts), [initialProducts])

  const filters = useMemo(
    () =>
      parseFilterStateFromSearchParams(
        new URLSearchParams(searchParamsString),
        priceBounds
      ),
    [searchParamsString, priceBounds]
  )

  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const filtersRef = useRef(filters)
  useEffect(() => {
    filtersRef.current = filters
  })

  const replaceUrlFromFilters = useCallback(
    (nextFilters: FilterState, options?: { clearCategory?: boolean }) => {
      const params = serializeFilterStateToSearchParams(
        new URLSearchParams(searchParamsString),
        nextFilters,
        priceBounds
      )

      if (options?.clearCategory) {
        params.delete('category')
      }

      const nextQuery = params.toString()
      const currentQuery = searchParamsString

      if (nextQuery === currentQuery) {
        return
      }

      const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname
      router.replace(nextUrl, { scroll: false })
    },
    [pathname, priceBounds, router, searchParamsString]
  )

  const syncFiltersToUrl = useCallback(
    (nextFilters: FilterState, options?: { debounceSearch?: boolean; clearCategory?: boolean }) => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
        syncTimeoutRef.current = null
      }

      if (options?.debounceSearch) {
        syncTimeoutRef.current = setTimeout(() => {
          replaceUrlFromFilters(nextFilters, { clearCategory: options.clearCategory })
          syncTimeoutRef.current = null
        }, SEARCH_SYNC_DEBOUNCE_MS)
        return
      }

      replaceUrlFromFilters(nextFilters, { clearCategory: options?.clearCategory })
    },
    [replaceUrlFromFilters]
  )

  const handleFilterChange = useCallback(
    (nextFilters: FilterState) => {
      const previousFilters = filtersRef.current
      const shouldDebounceSearch =
        previousFilters.search !== nextFilters.search &&
        areFilterStatesEqualExceptSearch(previousFilters, nextFilters)

      syncFiltersToUrl(nextFilters, { debounceSearch: shouldDebounceSearch })
    },
    [syncFiltersToUrl]
  )

  const categories = useMemo(() => {
    const seen = new Set<string>()
    const cats: Array<{ id: string; name: string; slug: string }> = []
    initialProducts.forEach((p) => {
      if (p.category && !seen.has(p.category.slug)) {
        seen.add(p.category.slug)
        cats.push(p.category)
      }
    })
    return cats.sort((a, b) => a.name.localeCompare(b.name))
  }, [initialProducts])

  const scopedProducts = useMemo(() => {
    if (!categorySlug) {
      return initialProducts
    }
    return initialProducts.filter((product) => product.category?.slug === categorySlug)
  }, [categorySlug, initialProducts])

  const availableSizes = useMemo(() => deriveAvailableSizes(scopedProducts), [scopedProducts])
  const availableColors = useMemo(() => deriveAvailableColors(scopedProducts), [scopedProducts])
  const searchSuggestions = useMemo(() => {
    const seen = new Set<string>()
    const suggestions: string[] = []

    scopedProducts.forEach((product) => {
      const candidate = product.name.trim()
      if (!candidate) {
        return
      }
      const normalized = candidate.toLowerCase()
      if (seen.has(normalized)) {
        return
      }
      seen.add(normalized)
      suggestions.push(candidate)
    })

    return suggestions.slice(0, 12)
  }, [scopedProducts])

  const filteredProducts = useMemo(
    () => applyProductFilters(initialProducts, filters, categorySlug || undefined),
    [categorySlug, filters, initialProducts]
  )

  const activeFilterCount =
    countActiveFilters(filters, priceBounds) + (categorySlug ? 1 : 0)

  const hasActiveFilters = activeFilterCount > 0

  const clearAllFilters = useCallback(() => {
    const nextFilters = getDefaultFilterState(priceBounds)
    syncFiltersToUrl(nextFilters, { clearCategory: true })
  }, [priceBounds, syncFiltersToUrl])

  const clearCategoryChip = useCallback(() => {
    const params = new URLSearchParams(searchParamsString)
    params.delete('category')

    const nextQuery = params.toString()
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname
    router.replace(nextUrl, { scroll: false })
  }, [pathname, router, searchParamsString])

  const handleCategoryChange = useCallback(
    (slug: string | null) => {
      const params = new URLSearchParams(searchParamsString)
      if (slug) {
        params.set('category', slug)
      } else {
        params.delete('category')
      }
      const nextQuery = params.toString()
      const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname
      router.replace(nextUrl, { scroll: false })
    },
    [pathname, router, searchParamsString]
  )

  const removeSize = useCallback(
    (size: string) => {
      handleFilterChange({
        ...filters,
        sizes: filters.sizes.filter((value) => value !== size),
      })
    },
    [filters, handleFilterChange]
  )

  const removeColor = useCallback(
    (colorKey: string) => {
      handleFilterChange({
        ...filters,
        colors: filters.colors.filter((value) => value !== colorKey),
      })
    },
    [filters, handleFilterChange]
  )

  const removeSearch = useCallback(() => {
    handleFilterChange({ ...filters, search: '' })
  }, [filters, handleFilterChange])

  const removePrice = useCallback(() => {
    handleFilterChange({
      ...filters,
      priceRange: [priceBounds.min, priceBounds.max],
    })
  }, [filters, handleFilterChange, priceBounds.max, priceBounds.min])

  const removeInStock = useCallback(() => {
    handleFilterChange({
      ...filters,
      inStockOnly: false,
    })
  }, [filters, handleFilterChange])

  const removeSort = useCallback(() => {
    handleFilterChange({
      ...filters,
      sortBy: 'newest',
    })
  }, [filters, handleFilterChange])

  const colorLabelByKey = useMemo(
    () => new Map(availableColors.map((option) => [option.key, option.label.toUpperCase()])),
    [availableColors]
  )

  const pageTitle = categorySlug ? formatCategoryName(categorySlug) : 'All Products'
  const pageDescription = getCategoryDescription(categorySlug)

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      <section className="relative min-h-[260px] bg-white pb-8 pt-20 sm:min-h-[360px] sm:pb-10 sm:pt-24 lg:min-h-[420px] lg:pb-14 lg:pt-32">
        <div className="mx-auto flex max-w-7xl flex-col justify-center px-4 sm:px-6 lg:px-12">
          {categorySlug ? (
            <Link
              href="/products"
              className="mb-3 inline-flex w-fit items-center gap-2 text-xs text-black/60 transition-colors hover:text-black sm:text-sm"
            >
              <span>←</span>
              <span>All Products</span>
            </Link>
          ) : null}

          <h1 className="mb-3 max-w-3xl text-3xl font-black tracking-tight text-black sm:text-5xl lg:text-7xl">
            {pageTitle}
          </h1>

          <p className="mb-5 max-w-2xl text-base leading-relaxed text-black/65 sm:text-xl lg:text-2xl">
            {pageDescription}
          </p>

          <p className="text-xs uppercase tracking-[0.16em] text-black/50 sm:text-sm">
            {`${filteredProducts.length} ${filteredProducts.length === 1 ? 'Product' : 'Products'}`}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-3 pb-8 sm:px-6 sm:pb-10 lg:px-12 lg:pb-14">
        <div className="sticky top-[72px] z-30 border-y border-black/10 bg-white/95 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3 px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              className="inline-flex items-center gap-2 rounded-full border border-black bg-black px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-black/90 active:scale-[0.97]"
              data-testid="products-filter-trigger"
            >
              <FunnelSimple size={16} weight="bold" />
              Filters
              {activeFilterCount > 0 ? (
                <span
                  className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-bold text-black"
                  data-testid="products-active-count"
                >
                  {activeFilterCount}
                </span>
              ) : null}
            </button>

            <p
              className="ml-auto text-xs font-semibold uppercase tracking-[0.12em] text-black/55 sm:text-sm"
              data-testid="products-result-count"
            >
              {`${filteredProducts.length} results`}
            </p>
          </div>

          {hasActiveFilters ? (
            <div
              className="flex flex-wrap items-center gap-2 border-t border-black/10 px-3 py-3 sm:px-4 lg:px-6"
              data-testid="products-active-chips"
            >
              {categorySlug ? (
                <button
                  type="button"
                  onClick={clearCategoryChip}
                  className="inline-flex items-center gap-1 rounded-full border border-black/20 bg-black/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-black"
                  data-testid="filter-chip-category"
                >
                  Category: {formatCategoryName(categorySlug)}
                  <X size={12} weight="bold" />
                </button>
              ) : null}

              {filters.search.trim() ? (
                <button
                  type="button"
                  onClick={removeSearch}
                  className="inline-flex items-center gap-1 rounded-full border border-black/20 bg-black/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-black"
                  data-testid="filter-chip-search"
                >
                  Search: {filters.search.trim()}
                  <X size={12} weight="bold" />
                </button>
              ) : null}

              {filters.sizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => removeSize(size)}
                  className="inline-flex items-center gap-1 rounded-full border border-black/20 bg-black/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-black"
                  data-testid={`filter-chip-size-${size}`}
                >
                  Size: {size}
                  <X size={12} weight="bold" />
                </button>
              ))}

              {filters.colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => removeColor(color)}
                  className="inline-flex items-center gap-1 rounded-full border border-black/20 bg-black/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-black"
                  data-testid={`filter-chip-color-${color}`}
                >
                  Color: {colorLabelByKey.get(color) || color.toUpperCase()}
                  <X size={12} weight="bold" />
                </button>
              ))}

              {!isDefaultPriceRange(filters.priceRange, priceBounds) ? (
                <button
                  type="button"
                  onClick={removePrice}
                  className="inline-flex items-center gap-1 rounded-full border border-black/20 bg-black/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-black"
                  data-testid="filter-chip-price"
                >
                  Price: ${filters.priceRange[0]} - ${filters.priceRange[1]}
                  <X size={12} weight="bold" />
                </button>
              ) : null}

              {filters.inStockOnly ? (
                <button
                  type="button"
                  onClick={removeInStock}
                  className="inline-flex items-center gap-1 rounded-full border border-black/20 bg-black/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-black"
                  data-testid="filter-chip-instock"
                >
                  In Stock
                  <X size={12} weight="bold" />
                </button>
              ) : null}

              {filters.sortBy !== 'newest' ? (
                <button
                  type="button"
                  onClick={removeSort}
                  className="inline-flex items-center gap-1 rounded-full border border-black/20 bg-black/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-black"
                  data-testid="filter-chip-sort"
                >
                  Sorted
                  <X size={12} weight="bold" />
                </button>
              ) : null}

              <button
                type="button"
                onClick={clearAllFilters}
                className="ml-auto text-xs font-semibold uppercase tracking-[0.12em] text-black/55 transition-colors hover:text-black"
                data-testid="clear-all-filters"
              >
                Clear all
              </button>
            </div>
          ) : null}
        </div>

        <AnimatePresence>
          {showFilters ? (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-60 bg-black/55 backdrop-blur-sm"
                onClick={() => setShowFilters(false)}
              />

              <motion.aside
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                className="fixed inset-y-0 right-0 z-61 hidden w-[420px] max-w-[92vw] border-l border-black/10 bg-white lg:flex lg:flex-col"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-black/10 px-6 py-5">
                  <div>
                    <h2 className="text-xl font-black tracking-tight text-black">Filters</h2>
                    <p className="text-xs uppercase tracking-[0.12em] text-black/45">
                      {activeFilterCount} active
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFilters(false)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-black/65 transition-colors hover:border-black/25 hover:text-black"
                    aria-label="Close filters"
                  >
                    <X size={18} weight="bold" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5">
                  <ProductFilters
                    filters={filters}
                    availableSizes={availableSizes}
                    availableColors={availableColors}
                    searchSuggestions={searchSuggestions}
                    priceBounds={priceBounds}
                    categories={categories}
                    selectedCategory={categorySlug || undefined}
                    onFilterChange={handleFilterChange}
                    onClearAll={clearAllFilters}
                    onCategoryChange={handleCategoryChange}
                  />
                </div>
              </motion.aside>

              <motion.aside
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 320 }}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.45 }}
                onDragEnd={(_, info: PanInfo) => {
                  if (info.offset.y > 120 || info.velocity.y > 550) {
                    setShowFilters(false)
                  }
                }}
                className="fixed inset-x-0 bottom-0 z-61 h-[92vh] rounded-t-3xl border-t border-black/10 bg-white lg:hidden"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex justify-center pb-2 pt-3">
                  <div className="h-1.5 w-12 rounded-full bg-black/20" />
                </div>

                <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-black">Filters</h2>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-black/45">
                      {activeFilterCount} active
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFilters(false)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-black/65 transition-colors hover:border-black/25 hover:text-black"
                    aria-label="Close filters"
                  >
                    <X size={18} weight="bold" />
                  </button>
                </div>

                <div className="h-[calc(92vh-84px)] overflow-y-auto px-5 py-5">
                  <ProductFilters
                    filters={filters}
                    availableSizes={availableSizes}
                    availableColors={availableColors}
                    searchSuggestions={searchSuggestions}
                    priceBounds={priceBounds}
                    categories={categories}
                    selectedCategory={categorySlug || undefined}
                    onFilterChange={handleFilterChange}
                    onClearAll={clearAllFilters}
                    onCategoryChange={handleCategoryChange}
                  />
                </div>
              </motion.aside>
            </>
          ) : null}
        </AnimatePresence>

        <div className="pt-6 sm:pt-8">
          {filteredProducts.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <div className="mx-auto max-w-md">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-black/5">
                  <Faders size={30} weight="bold" className="text-black/40" />
                </div>
                <h3 className="mb-3 text-2xl font-black text-black">No products found</h3>
                <p className="mb-6 text-black/65">
                  Try removing a filter chip or reset all filters to broaden your results.
                </p>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-black/90"
                >
                  Clear all filters
                  <ArrowRight size={15} weight="bold" />
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4 lg:gap-6">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ProductsLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-white px-4 pt-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4 lg:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
