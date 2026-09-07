import * as React from 'react'
import type { ActiveFilter } from '@/lib/shopify/filters'
import type { Filter } from '@/lib/shopify/types'
import type { PlpContext } from '@/lib/storefront/plp-params'
import { cn } from '@/lib/storefront/cn'
import { FilterGroup } from './FilterGroup'

export interface FilterRailProps {
  filters: Filter[]
  active: ActiveFilter[]
  ctx: PlpContext
  className?: string
}

/**
 * The column of Shopify filters: one `FilterGroup` per `Filter`.
 *
 * Server-safe (links and GET forms only), so the PLP renders it twice — once in
 * the desktop `<aside>` and once inside the mobile `Drawer` of `PlpToolbar` —
 * without shipping any extra behaviour to the client.
 */
export function FilterRail({ filters, active, ctx, className }: FilterRailProps) {
  const usable = filters.filter((filter) => filter.values.length > 0)
  if (usable.length === 0) return null

  return (
    <div data-filter-rail="" className={cn('flex flex-col', className)}>
      {usable.map((filter) => (
        <FilterGroup key={filter.id} filter={filter} active={active} ctx={ctx} />
      ))}
    </div>
  )
}
