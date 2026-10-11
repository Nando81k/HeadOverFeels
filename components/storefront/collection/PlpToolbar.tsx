'use client'

import * as React from 'react'
import { SlidersHorizontal } from 'lucide-react'
import type { ActiveFilter } from '@/lib/shopify/filters'
import type { Filter } from '@/lib/shopify/types'
import type { PlpContext, SortOption } from '@/lib/storefront/plp-params'
import { Button } from '@/components/storefront/ui/Button'
import { Drawer } from '@/components/storefront/ui/Drawer'
import { cn } from '@/lib/storefront/cn'
import { FilterRail } from './FilterRail'
import { SortSelect } from './SortSelect'

export interface PlpToolbarProps {
  /** Result count when the API gives one (search does, collections do not). */
  total?: number | null
  /** Plural noun for the count — `products` on a PLP, `results` on search. */
  noun?: string
  sort: string
  sortOptions: SortOption[]
  ctx: PlpContext
  filters: Filter[]
  active: ActiveFilter[]
  className?: string
}

/** `3 products` / `1 product` — the trailing `s` is dropped for a single item. */
function countLabel(total: number, noun: string): string {
  const word = total === 1 && noun.endsWith('s') ? noun.slice(0, -1) : noun
  return `${total} ${word}`
}

/**
 * The row above the grid: result count, the mobile "Filters" trigger, sort.
 *
 * A client component only because the mobile `Drawer` is stateful; everything
 * it renders inside the drawer (`FilterRail`) is the same markup the desktop
 * `<aside>` renders on the server, so the two can never drift.
 */
export function PlpToolbar({
  total,
  noun = 'products',
  sort,
  sortOptions,
  ctx,
  filters,
  active,
  className,
}: PlpToolbarProps) {
  const [open, setOpen] = React.useState(false)
  const hasFilters = filters.some((filter) => filter.values.length > 0)

  return (
    <div
      data-plp-toolbar=""
      className={cn(
        'flex flex-wrap items-center justify-between gap-4 border-y border-line py-4',
        className
      )}
    >
      <p className="num text-sm text-ink-soft">
        {typeof total === 'number' ? countLabel(total, noun) : null}
      </p>

      <div className="flex items-center gap-3">
        {hasFilters ? (
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <SlidersHorizontal aria-hidden="true" className="size-4" />
            Filters
          </Button>
        ) : null}

        <SortSelect value={sort} options={sortOptions} ctx={ctx} />
      </div>

      {hasFilters ? (
        <Drawer
          open={open}
          onOpenChange={setOpen}
          title="Filters"
          footer={
            <Button className="w-full" onClick={() => setOpen(false)}>
              Show results
            </Button>
          }
        >
          <FilterRail filters={filters} active={active} ctx={ctx} />
        </Drawer>
      ) : null}
    </div>
  )
}
