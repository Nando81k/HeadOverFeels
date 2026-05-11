'use client'

import type { ReactNode } from 'react'
import { MagnifyingGlass, X } from '@phosphor-icons/react'

interface FilterBarProps {
  /**
   * Search input value. When provided alongside `onSearchChange`, the bar
   * renders a search field on the left.
   */
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  /**
   * Pill toggles, dropdown selects, or any other filter controls. Lay them
   * out yourself; the bar handles spacing + alignment.
   */
  children?: ReactNode
  /**
   * When true, a "Clear" button appears that calls `onClear`. Pass true
   * whenever any filter (other than search) is non-default.
   */
  hasActiveFilters?: boolean
  onClear?: () => void
  /**
   * Whether to make the bar sticky under `AdminHeader`. Default true. Set
   * false on pages where it doesn't make sense (compact list pages).
   */
  sticky?: boolean
  /** Optional secondary slot rendered to the far right (e.g. result count). */
  meta?: ReactNode
  className?: string
}

/**
 * Standard filter container for admin list pages.
 *
 * Wraps a search input + arbitrary filter controls + optional Clear button
 * in the canonical sticky bar styling. Replaces the per-page filter bars
 * that products / orders / customers / redemptions each rebuilt.
 *
 * Example:
 * ```tsx
 * <FilterBar
 *   searchValue={search}
 *   onSearchChange={setSearch}
 *   searchPlaceholder="Search orders by number, email, or customer..."
 *   hasActiveFilters={status !== 'all'}
 *   onClear={() => setStatus('all')}
 *   meta={<span className="text-xs text-white/45">{total} orders</span>}
 * >
 *   <select value={status} onChange={...}>{...}</select>
 * </FilterBar>
 * ```
 */
export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search…',
  children,
  hasActiveFilters,
  onClear,
  sticky = true,
  meta,
  className = '',
}: FilterBarProps) {
  const stickyClass = sticky ? 'sticky top-14 sm:top-16 z-10' : ''

  return (
    <div className={`${stickyClass} bg-neutral-900 border border-white/10 mb-6 sm:mb-8 ${className}`}>
      <div className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Search */}
        {onSearchChange !== undefined && (
          <div className="relative flex-1 min-w-0 sm:max-w-sm">
            <MagnifyingGlass
              size={14}
              weight="bold"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
            />
            <input
              type="search"
              value={searchValue ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-3 h-10 bg-neutral-950 border border-white/15 text-white text-xs placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>
        )}

        {/* Filter controls */}
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}

        {/* Right side: Clear + meta */}
        <div className="flex items-center gap-3 sm:ml-auto">
          {hasActiveFilters && onClear && (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1.5 px-3 h-10 border border-white/15 text-[11px] font-bold uppercase tracking-wider text-white/65 hover:text-white hover:border-white/30 transition-colors"
            >
              <X size={11} weight="bold" />
              Clear
            </button>
          )}
          {meta && <div className="text-xs text-white/45">{meta}</div>}
        </div>
      </div>
    </div>
  )
}
