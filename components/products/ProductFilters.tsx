'use client'

import { useMemo, useState } from 'react'
import { Check, MagnifyingGlass, Package, Palette, SlidersHorizontal, X } from '@phosphor-icons/react'
import {
  ColorOption,
  FilterState,
  PriceBounds,
  ProductSortBy,
} from '@/components/products/product-filtering'

interface ProductFiltersProps {
  filters: FilterState
  availableSizes: string[]
  availableColors: ColorOption[]
  searchSuggestions: string[]
  priceBounds: PriceBounds
  onFilterChange: (filters: FilterState) => void
  onClearAll: () => void
}

const SORT_OPTIONS: Array<{ value: ProductSortBy; label: string }> = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'name', label: 'Name: A to Z' },
]

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function sanitizeHexColor(value: string | null): string | null {
  if (!value) {
    return null
  }

  const hex = value.trim()
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) {
    return hex
  }

  return null
}

function createPricePresets(bounds: PriceBounds): Array<{ label: string; range: [number, number] }> {
  const presets: Array<{ label: string; range: [number, number] }> = []

  const under50: [number, number] = [bounds.min, Math.min(50, bounds.max)]
  if (under50[0] <= under50[1]) {
    presets.push({ label: 'Under $50', range: under50 })
  }

  const between50And100: [number, number] = [Math.max(bounds.min, 50), Math.min(bounds.max, 100)]
  if (between50And100[0] <= between50And100[1]) {
    presets.push({ label: '$50 - $100', range: between50And100 })
  }

  const between100And150: [number, number] = [Math.max(bounds.min, 100), Math.min(bounds.max, 150)]
  if (between100And150[0] <= between100And150[1]) {
    presets.push({ label: '$100 - $150', range: between100And150 })
  }

  const over150: [number, number] = [Math.max(bounds.min, 150), bounds.max]
  if (over150[0] <= over150[1]) {
    presets.push({ label: '$150+', range: over150 })
  }

  return presets
}

export function ProductFilters({
  filters,
  availableSizes,
  availableColors,
  searchSuggestions,
  priceBounds,
  onFilterChange,
  onClearAll,
}: ProductFiltersProps) {
  const [isSearchFocused, setIsSearchFocused] = useState(false)

  const updateFilters = (updates: Partial<FilterState>) => {
    onFilterChange({ ...filters, ...updates })
  }

  const filteredSearchSuggestions = useMemo(() => {
    const query = filters.search.trim().toLowerCase()
    if (query.length < 1) {
      return []
    }

    const seen = new Set<string>()
    const nextSuggestions: string[] = []

    searchSuggestions.forEach((suggestion) => {
      const trimmed = suggestion.trim()
      if (!trimmed) {
        return
      }

      const normalized = trimmed.toLowerCase()
      if (seen.has(normalized) || !normalized.includes(query)) {
        return
      }

      seen.add(normalized)
      nextSuggestions.push(trimmed)
    })

    return nextSuggestions.slice(0, 8)
  }, [filters.search, searchSuggestions])

  const toggleSize = (size: string) => {
    const nextSizes = filters.sizes.includes(size)
      ? filters.sizes.filter((value) => value !== size)
      : [...filters.sizes, size]

    updateFilters({ sizes: nextSizes })
  }

  const toggleColor = (colorKey: string) => {
    const nextColors = filters.colors.includes(colorKey)
      ? filters.colors.filter((value) => value !== colorKey)
      : [...filters.colors, colorKey]

    updateFilters({ colors: nextColors })
  }

  const [selectedMin, selectedMax] = filters.priceRange
  const minPercent = ((selectedMin - priceBounds.min) / Math.max(priceBounds.max - priceBounds.min, 1)) * 100
  const maxPercent = ((selectedMax - priceBounds.min) / Math.max(priceBounds.max - priceBounds.min, 1)) * 100

  const handleMinPriceChange = (value: number) => {
    const nextMin = clamp(value, priceBounds.min, selectedMax)
    updateFilters({ priceRange: [nextMin, selectedMax] })
  }

  const handleMaxPriceChange = (value: number) => {
    const nextMax = clamp(value, selectedMin, priceBounds.max)
    updateFilters({ priceRange: [selectedMin, nextMax] })
  }

  const pricePresets = createPricePresets(priceBounds)

  return (
    <div className="space-y-8" data-testid="products-filter-panel">
      <section className="space-y-3">
        <label
          htmlFor="products-search-filter"
          className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/55"
        >
          <MagnifyingGlass size={14} weight="bold" />
          Search
        </label>
        <div className="relative">
          <input
            id="products-search-filter"
            type="search"
            value={filters.search}
            placeholder="Search products"
            onChange={(event) => updateFilters({ search: event.target.value })}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            className="h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-sm text-black outline-none transition-colors placeholder:text-black/35 focus:border-black"
          />
          {isSearchFocused && filteredSearchSuggestions.length > 0 ? (
            <div
              className="absolute left-0 right-0 top-[calc(100%+8px)] z-10 overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_12px_28px_rgba(0,0,0,0.08)]"
              data-testid="products-filter-autocomplete-list"
            >
              <div className="border-b border-black/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-black/45">
                Suggestions
              </div>
              <div className="max-h-56 overflow-y-auto">
                {filteredSearchSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      updateFilters({ search: suggestion })
                      setIsSearchFocused(false)
                    }}
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
          {filters.search && (
            <button
              type="button"
              onClick={() => updateFilters({ search: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-black/40 transition-colors hover:text-black"
              aria-label="Clear search filter"
            >
              <X size={16} weight="bold" />
            </button>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <label
          htmlFor="products-sort-filter"
          className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/55"
        >
          <SlidersHorizontal size={14} weight="bold" />
          Sort
        </label>
        <div className="relative">
          <select
            id="products-sort-filter"
            value={filters.sortBy}
            onChange={(event) => updateFilters({ sortBy: event.target.value as ProductSortBy })}
            className="h-11 w-full appearance-none rounded-xl border border-black/15 bg-white px-3 pr-10 text-sm font-medium text-black outline-none transition-colors focus:border-black"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-black/55">▼</span>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/55">Price</p>
          <p className="text-sm font-semibold text-black">
            ${selectedMin} - ${selectedMax}
          </p>
        </div>

        <div className="space-y-3">
          <div className="relative h-10">
            <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-black/10" />
            <div
              className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-black"
              style={{ left: `${minPercent}%`, width: `${Math.max(maxPercent - minPercent, 0)}%` }}
            />

            <input
              type="range"
              min={priceBounds.min}
              max={priceBounds.max}
              step={1}
              value={selectedMin}
              onChange={(event) => handleMinPriceChange(Number(event.target.value))}
              aria-label="Minimum price"
              className="pointer-events-none absolute inset-0 h-10 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-black [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-black"
            />

            <input
              type="range"
              min={priceBounds.min}
              max={priceBounds.max}
              step={1}
              value={selectedMax}
              onChange={(event) => handleMaxPriceChange(Number(event.target.value))}
              aria-label="Maximum price"
              className="pointer-events-none absolute inset-0 h-10 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-black [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-black"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-[0.16em] text-black/45">Min</span>
              <input
                type="number"
                min={priceBounds.min}
                max={selectedMax}
                value={selectedMin}
                onChange={(event) => handleMinPriceChange(Number(event.target.value))}
                className="h-10 w-full rounded-lg border border-black/15 px-3 text-sm text-black outline-none focus:border-black"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-[0.16em] text-black/45">Max</span>
              <input
                type="number"
                min={selectedMin}
                max={priceBounds.max}
                value={selectedMax}
                onChange={(event) => handleMaxPriceChange(Number(event.target.value))}
                className="h-10 w-full rounded-lg border border-black/15 px-3 text-sm text-black outline-none focus:border-black"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            {pricePresets.map((preset) => {
              const isActive =
                filters.priceRange[0] === preset.range[0] &&
                filters.priceRange[1] === preset.range[1]

              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => updateFilters({ priceRange: preset.range })}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? 'border-black bg-black text-white'
                      : 'border-black/15 bg-white text-black/70 hover:border-black/35 hover:text-black'
                  }`}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/55">
          <Package size={14} weight="bold" />
          Sizes
        </p>

        {availableSizes.length === 0 ? (
          <p className="text-sm text-black/45">No size variants available.</p>
        ) : (
          <div className="flex flex-wrap gap-2" data-testid="size-filter-options">
            {availableSizes.map((size) => {
              const isActive = filters.sizes.includes(size)
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => toggleSize(size)}
                  className={`min-w-[48px] rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${
                    isActive
                      ? 'border-black bg-black text-white'
                      : 'border-black/15 bg-white text-black/70 hover:border-black/35 hover:text-black'
                  }`}
                  aria-pressed={isActive}
                  aria-label={`Filter size ${size}`}
                >
                  {size}
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/55">
          <Palette size={14} weight="bold" />
          Colors
        </p>

        {availableColors.length === 0 ? (
          <p className="text-sm text-black/45">No color variants available.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2" data-testid="color-filter-options">
            {availableColors.map((option) => {
              const isActive = filters.colors.includes(option.key)
              const safeHex = sanitizeHexColor(option.hex)
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => toggleColor(option.key)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                    isActive
                      ? 'border-black bg-black text-white'
                      : 'border-black/15 bg-white text-black/75 hover:border-black/35 hover:text-black'
                  }`}
                  aria-pressed={isActive}
                  aria-label={`Filter color ${option.label}`}
                >
                  <span
                    className={`h-4 w-4 rounded-full border ${isActive ? 'border-white/60' : 'border-black/20'}`}
                    style={safeHex ? { backgroundColor: safeHex } : undefined}
                  >
                    {!safeHex && (
                      <span className={`block h-full w-full rounded-full ${isActive ? 'bg-white/40' : 'bg-black/20'}`} />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold uppercase tracking-[0.08em]">{option.label}</span>
                    <span className={`text-[10px] ${isActive ? 'text-white/75' : 'text-black/45'}`}>{option.count}</span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <button
          type="button"
          onClick={() => updateFilters({ inStockOnly: !filters.inStockOnly })}
          className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
            filters.inStockOnly
              ? 'border-black bg-black text-white'
              : 'border-black/15 bg-white text-black hover:border-black/35'
          }`}
          aria-pressed={filters.inStockOnly}
        >
          <span className="text-sm font-semibold uppercase tracking-[0.08em]">In Stock Only</span>
          {filters.inStockOnly ? <Check size={16} weight="bold" /> : null}
        </button>
      </section>

      <button
        type="button"
        onClick={onClearAll}
        className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-black/70 transition-colors hover:border-black/30 hover:text-black"
      >
        Clear all filters
      </button>
    </div>
  )
}

export type { FilterState }
