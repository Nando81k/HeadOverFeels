import * as React from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { filterValueToActive, isFilterValueActive, type ActiveFilter } from '@/lib/shopify/filters'
import type { Filter } from '@/lib/shopify/types'
import { buildPlpHref, fallbackFilterLabel, type PlpContext } from '@/lib/storefront/plp-params'
import { cn } from '@/lib/storefront/cn'

export interface ActiveFiltersProps {
  /** The `Filter[]` Shopify returned, used to look up each pair's human label. */
  filters: Filter[]
  active: ActiveFilter[]
  ctx: PlpContext
  className?: string
}

/** `{ 'filter.v.option.color Black': 'Black' }` — the label Shopify shows for a pair. */
function labelIndex(filters: Filter[], active: ActiveFilter[]): Map<string, string> {
  const index = new Map<string, string>()
  for (const filter of filters) {
    for (const value of filter.values) {
      if (!isFilterValueActive(active, value)) continue
      const pair = filterValueToActive(value)
      if (pair) index.set(`${pair.key} ${pair.value}`, value.label)
    }
  }
  return index
}

/**
 * The row of removable chips above the grid (spec §5.4).
 *
 * Labels come from Shopify's own `FilterValue.label` where one exists; a pair
 * with no matching value — a price range typed into the min/max form — falls
 * back to a rendered range so it can still be removed.
 *
 * Renders nothing when no filter is applied.
 */
export function ActiveFilters({ filters, active, ctx, className }: ActiveFiltersProps) {
  if (active.length === 0) return null
  const labels = labelIndex(filters, active)

  return (
    <div
      data-active-filters=""
      className={cn('flex flex-wrap items-center gap-2', className)}
    >
      {active.map((entry) => (
        <Link
          key={`${entry.key}-${entry.value}`}
          href={buildPlpHref(ctx, { toggle: entry })}
          className={cn(
            'inline-flex items-center gap-2 rounded-pill border border-line-strong bg-paper',
            'px-3 py-1.5 text-xs font-semibold uppercase tracking-eyebrow text-ink',
            'transition-colors duration-sf-fast ease-sf-out hover:bg-rose-tint',
            'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2'
          )}
        >
          <span>{labels.get(`${entry.key} ${entry.value}`) ?? fallbackFilterLabel(entry)}</span>
          <X aria-hidden="true" className="size-3.5" />
          <span className="sr-only">Remove filter</span>
        </Link>
      ))}

      <Link
        href={buildPlpHref(ctx, { clear: true })}
        className={cn(
          'text-xs font-semibold uppercase tracking-eyebrow text-ink-soft underline underline-offset-4',
          'transition-colors duration-sf-fast ease-sf-out hover:text-ink',
          'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2'
        )}
      >
        Clear all
      </Link>
    </div>
  )
}
