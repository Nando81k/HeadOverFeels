'use client'

import { useState } from 'react'
import { MagnifyingGlass, X, CaretDown, CaretUp, Faders } from '@phosphor-icons/react'

interface ProductFiltersProps {
  onFilterChange: (filters: FilterState) => void
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
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'name', label: 'Name: A to Z' },
]

export function ProductFilters({ onFilterChange }: ProductFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    priceRange: [0, 500],
    sizes: [],
    inStockOnly: false,
    sortBy: 'newest',
  })

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
    const defaultFilters: FilterState = {
      search: '',
      priceRange: [0, 500],
      sizes: [],
      inStockOnly: false,
      sortBy: 'newest',
    }
    setFilters(defaultFilters)
    onFilterChange(defaultFilters)
  }

  const hasActiveFilters = filters.search || filters.sizes.length > 0 || filters.inStockOnly

  return (
    <div className="space-y-6">
      {/* Search */}
      <div>
        <label className="block text-sm font-bold text-black mb-2">
          Search
        </label>
        <div className="relative">
          <MagnifyingGlass size={16} weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
          <input
            type="text"
            placeholder="Search products..."
            value={filters.search}
            onChange={(e) => updateFilters({ search: e.target.value })}
            className="w-full pl-10 pr-4 py-2 border border-black/10 rounded-none focus:ring-2 focus:ring-black focus:border-transparent bg-white text-black placeholder-black/40"
          />
        </div>
      </div>

      {/* Sort */}
      <div>
        <label className="block text-sm font-bold text-black mb-2">
          Sort By
        </label>
        <select
          value={filters.sortBy}
          onChange={(e) => updateFilters({ sortBy: e.target.value })}
          className="w-full px-4 py-2 border border-black/10 rounded-none focus:ring-2 focus:ring-black focus:border-transparent bg-white text-black"
        >
          {SORT_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Advanced Filters Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2 text-sm font-bold text-black border border-black/10 rounded-none hover:bg-black/5 transition-colors uppercase tracking-wider"
      >
        <div className="flex items-center gap-2">
          <Faders size={16} weight="bold" />
          <span>Advanced Filters</span>
        </div>
        {isExpanded ? (
          <CaretUp size={16} weight="bold" />
        ) : (
          <CaretDown size={16} weight="bold" />
        )}
      </button>

      {/* Collapsible Advanced Filters */}
      {isExpanded && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Price Range */}
          <div>
            <label className="block text-sm font-bold text-black mb-2">
              Price Range
            </label>
            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max="500"
                value={filters.priceRange[1]}
                onChange={(e) => updateFilters({ 
                  priceRange: [0, parseInt(e.target.value)] 
                })}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-black/70">
                <span>${filters.priceRange[0]}</span>
                <span>${filters.priceRange[1]}</span>
              </div>
            </div>
          </div>

          {/* Sizes */}
          <div>
            <label className="block text-sm font-bold text-black mb-2">
              Sizes
            </label>
            <div className="flex flex-wrap gap-2">
              {SIZES.map(size => (
                <button
                  key={size}
                  onClick={() => toggleSize(size)}
                  className={`px-4 py-2 border rounded-none transition-colors text-sm font-bold uppercase tracking-wider ${
                    filters.sizes.includes(size)
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-black border-black/10 hover:border-black'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* In Stock Only */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.inStockOnly}
                onChange={(e) => updateFilters({ inStockOnly: e.target.checked })}
                className="w-4 h-4 text-black border-black/10 rounded-none focus:ring-black"
              />
              <span className="text-sm text-black font-medium">In Stock Only</span>
            </label>
          </div>
        </div>
      )}

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-black border border-black/10 rounded-none hover:bg-black/5 transition-colors uppercase tracking-wider"
        >
          <X size={16} weight="bold" />
          Clear Filters
        </button>
      )}
    </div>
  )
}
