'use client'

import { useState, useEffect } from 'react'
import { MagnifyingGlass, X, SlidersHorizontal, Check, Sparkle, Package, CurrencyDollar } from '@phosphor-icons/react'

interface ProductFiltersProps {
  onFilterChange: (filters: FilterState) => void
  initialFilters?: FilterState
}

export interface FilterState {
  search: string
  priceRange: [number, number]
  sizes: string[]
  inStockOnly: boolean
  sortBy: string
}

const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL']
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First', icon: Sparkle },
  { value: 'price-asc', label: 'Price: Low → High', icon: CurrencyDollar },
  { value: 'price-desc', label: 'Price: High → Low', icon: CurrencyDollar },
  { value: 'name', label: 'Name: A → Z', icon: null },
]

const DEFAULT_FILTERS: FilterState = {
  search: '',
  priceRange: [0, 500],
  sizes: [],
  inStockOnly: false,
  sortBy: 'newest',
}

export function ProductFilters({ onFilterChange, initialFilters }: ProductFiltersProps) {
  const [filters, setFilters] = useState<FilterState>(initialFilters || DEFAULT_FILTERS)

  // Sync with parent's filter state when it changes
  useEffect(() => {
    if (initialFilters) {
      setFilters(initialFilters)
    }
  }, [initialFilters])

  const updateFilters = (updates: Partial<FilterState>) => {
    const newFilters = { ...filters, ...updates }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const toggleSize = (size: string) => {
    const newSizes = filters.sizes.includes(size)
      ? filters.sizes.filter(s => s !== size)
      : [...filters.sizes, size]
    updateFilters({ sizes: newSizes })
  }

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS)
    onFilterChange(DEFAULT_FILTERS)
  }

  const hasActiveFilters = filters.search || 
    filters.sizes.length > 0 || 
    filters.inStockOnly || 
    filters.priceRange[1] < 500

  const activeFilterCount = [
    filters.search,
    filters.sizes.length > 0,
    filters.inStockOnly,
    filters.priceRange[1] < 500
  ].filter(Boolean).length

  return (
    <div className="space-y-8">
      {/* Search - Premium Style */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-xs font-bold text-black/50 uppercase tracking-[0.2em]">
          <MagnifyingGlass size={14} weight="bold" />
          Search
        </label>
        <div className="relative group">
          <input
            type="text"
            placeholder="What are you looking for?"
            value={filters.search}
            onChange={(e) => updateFilters({ search: e.target.value })}
            className="w-full px-4 py-3.5 bg-black/[0.02] border-0 border-b-2 border-black/10 focus:border-black focus:bg-white text-black placeholder-black/30 transition-all duration-300 text-sm"
          />
          {filters.search && (
            <button
              onClick={() => updateFilters({ search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-black/30 hover:text-black transition-colors"
            >
              <X size={16} weight="bold" />
            </button>
          )}
        </div>
      </div>

      {/* Sort By - Card Style */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-xs font-bold text-black/50 uppercase tracking-[0.2em]">
          <SlidersHorizontal size={14} weight="bold" />
          Sort By
        </label>
        <div className="grid grid-cols-1 gap-2">
          {SORT_OPTIONS.map(option => {
            const isSelected = filters.sortBy === option.value
            return (
              <button
                key={option.value}
                onClick={() => updateFilters({ sortBy: option.value })}
                className={`flex items-center justify-between px-4 py-3 text-left transition-all duration-200 ${
                  isSelected 
                    ? 'bg-black text-white' 
                    : 'bg-black/[0.02] text-black/70 hover:bg-black/[0.05] hover:text-black'
                }`}
              >
                <span className="text-sm font-medium">{option.label}</span>
                {isSelected && <Check size={16} weight="bold" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-black/10 to-transparent" />

      {/* Price Range - Modern Slider */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs font-bold text-black/50 uppercase tracking-[0.2em]">
            <CurrencyDollar size={14} weight="bold" />
            Price Range
          </label>
          <span className="text-sm font-bold text-black">
            ${filters.priceRange[0]} – ${filters.priceRange[1]}
          </span>
        </div>
        <div className="relative pt-2 pb-1">
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-black/10 -translate-y-1/2" />
          <div 
            className="absolute top-1/2 left-0 h-1 bg-black -translate-y-1/2 transition-all duration-150"
            style={{ width: `${(filters.priceRange[1] / 500) * 100}%` }}
          />
          <input
            type="range"
            min="0"
            max="500"
            step="10"
            value={filters.priceRange[1]}
            onChange={(e) => updateFilters({ 
              priceRange: [0, parseInt(e.target.value)] 
            })}
            className="relative w-full h-5 bg-transparent appearance-none cursor-pointer z-10
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-5
              [&::-webkit-slider-thumb]:h-5
              [&::-webkit-slider-thumb]:bg-black
              [&::-webkit-slider-thumb]:border-2
              [&::-webkit-slider-thumb]:border-white
              [&::-webkit-slider-thumb]:shadow-md
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:transition-transform
              [&::-webkit-slider-thumb]:hover:scale-110
              [&::-moz-range-thumb]:w-5
              [&::-moz-range-thumb]:h-5
              [&::-moz-range-thumb]:bg-black
              [&::-moz-range-thumb]:border-2
              [&::-moz-range-thumb]:border-white
              [&::-moz-range-thumb]:shadow-md
              [&::-moz-range-thumb]:cursor-pointer"
          />
        </div>
        <div className="flex justify-between text-xs text-black/40">
          <span>$0</span>
          <span>$500+</span>
        </div>
      </div>

      {/* Sizes - Pill Style */}
      <div className="space-y-4">
        <label className="flex items-center gap-2 text-xs font-bold text-black/50 uppercase tracking-[0.2em]">
          <Package size={14} weight="bold" />
          Sizes
        </label>
        <div className="flex flex-wrap gap-2">
          {SIZES.map(size => {
            const isSelected = filters.sizes.includes(size)
            return (
              <button
                key={size}
                onClick={() => toggleSize(size)}
                className={`relative px-4 py-2.5 min-w-[52px] font-bold text-sm transition-all duration-200 ${
                  isSelected
                    ? 'bg-black text-white shadow-lg shadow-black/20 scale-105'
                    : 'bg-black/[0.02] text-black/60 hover:bg-black/[0.06] hover:text-black'
                }`}
              >
                {size}
                {isSelected && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-white border-2 border-black rounded-full flex items-center justify-center">
                    <Check size={10} weight="bold" className="text-black" />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* In Stock Toggle - Switch Style */}
      <div className="space-y-3">
        <button
          onClick={() => updateFilters({ inStockOnly: !filters.inStockOnly })}
          className={`w-full flex items-center justify-between px-4 py-4 transition-all duration-200 ${
            filters.inStockOnly 
              ? 'bg-green-50 border-l-4 border-green-500' 
              : 'bg-black/[0.02] border-l-4 border-transparent hover:bg-black/[0.04]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-6 rounded-full relative transition-colors duration-200 ${
              filters.inStockOnly ? 'bg-green-500' : 'bg-black/20'
            }`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-200 ${
                filters.inStockOnly ? 'left-5' : 'left-1'
              }`} />
            </div>
            <span className={`text-sm font-medium transition-colors ${
              filters.inStockOnly ? 'text-green-700' : 'text-black/60'
            }`}>
              In Stock Only
            </span>
          </div>
          {filters.inStockOnly && (
            <span className="text-xs font-bold text-green-600 uppercase tracking-wider">Active</span>
          )}
        </button>
      </div>

      {/* Clear Filters - Accent Button */}
      {hasActiveFilters && (
        <div className="pt-4 border-t border-black/5">
          <button
            onClick={clearFilters}
            className="group w-full flex items-center justify-center gap-3 px-4 py-4 bg-black/[0.02] hover:bg-red-50 text-black/60 hover:text-red-600 transition-all duration-200"
          >
            <X size={18} weight="bold" className="transition-transform group-hover:rotate-90" />
            <span className="text-sm font-bold uppercase tracking-wider">
              Clear {activeFilterCount} Filter{activeFilterCount > 1 ? 's' : ''}
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
