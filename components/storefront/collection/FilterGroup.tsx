import * as React from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import {
  filterValueToActive,
  isFilterValueActive,
  type ActiveFilter,
} from '@/lib/shopify/filters'
import type { Filter, FilterValue } from '@/lib/shopify/types'
import {
  PRICE_FORM_OMIT,
  activePriceRange,
  buildPlpHref,
  searchEntries,
  type PlpContext,
} from '@/lib/storefront/plp-params'
import { Button } from '@/components/storefront/ui/Button'
import { Input } from '@/components/storefront/ui/Input'
import { cn } from '@/lib/storefront/cn'

/**
 * Re-emits the current query string as hidden fields so a `<form method="get">`
 * does not wipe the rest of the URL state when it submits (the browser replaces
 * the whole query string with the form's own fields).
 */
export function HiddenParams({ search, omit = [] }: { search: string; omit?: string[] }) {
  const skip = new Set(omit)
  return (
    <>
      {searchEntries(search)
        .filter(([key]) => !skip.has(key))
        .map(([key, value], index) => (
          <input key={`${key}-${index}`} type="hidden" name={key} value={value} readOnly />
        ))}
    </>
  )
}

/** The checkbox-looking box in front of a filter link. Purely decorative. */
function FilterBox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-filter-box=""
      data-checked={checked ? '' : undefined}
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-sharp border',
        'transition-colors duration-sf-fast ease-sf-out',
        checked ? 'border-ink bg-ink text-bone' : 'border-line-strong bg-paper text-transparent'
      )}
    >
      <Check className="size-3.5" strokeWidth={3} />
    </span>
  )
}

function FilterValueLink({
  value,
  active,
  ctx,
}: {
  value: FilterValue
  active: ActiveFilter[]
  ctx: PlpContext
}) {
  const toggle = filterValueToActive(value)
  if (!toggle) return null
  const checked = isFilterValueActive(active, value)

  return (
    <Link
      href={buildPlpHref(ctx, { toggle })}
      aria-current={checked ? 'true' : undefined}
      data-filter-value={value.id}
      className={cn(
        'flex items-center gap-3 rounded-sharp py-1.5 text-sm',
        'transition-colors duration-sf-fast ease-sf-out',
        'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2',
        checked ? 'text-ink' : 'text-ink-soft hover:text-ink'
      )}
    >
      <FilterBox checked={checked} />
      <span className="min-w-0 flex-1">{value.label}</span>
      <span className="num text-xs text-ink-mute">{value.count}</span>
    </Link>
  )
}

export interface FilterGroupProps {
  filter: Filter
  active: ActiveFilter[]
  ctx: PlpContext
  className?: string
}

/**
 * One Shopify filter, rendered by type (spec §5.4 `/collections/[handle]`).
 *
 * Server-safe: every control is a `<Link>` or a plain `<form method="get">`, so
 * filtering works with JavaScript disabled and each state is a real URL.
 *
 * - `LIST` — one link per value, checkbox-styled, with its result count.
 * - `PRICE_RANGE` — a GET form posting `min`/`max` (folded back into
 *   `filter.v.price` by `parsePlpParams`), carrying the rest of the URL in
 *   hidden fields.
 * - `BOOLEAN` — a single link that toggles the filter's one value.
 */
export function FilterGroup({ filter, active, ctx, className }: FilterGroupProps) {
  if (filter.values.length === 0) return null

  return (
    <details
      open
      data-filter-group={filter.id}
      className={cn('border-b border-line py-4 last:border-b-0', className)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold uppercase tracking-eyebrow text-ink">
        {filter.label}
      </summary>

      <div className="pt-3">
        {filter.type === 'PRICE_RANGE' ? (
          <PriceRangeForm active={active} ctx={ctx} />
        ) : (
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {(filter.type === 'BOOLEAN' ? filter.values.slice(0, 1) : filter.values).map(
              (value) => (
                <li key={value.id}>
                  <FilterValueLink value={value} active={active} ctx={ctx} />
                </li>
              )
            )}
          </ul>
        )}
      </div>
    </details>
  )
}

function PriceRangeForm({ active, ctx }: { active: ActiveFilter[]; ctx: PlpContext }) {
  const { min, max } = activePriceRange(active)

  return (
    <form
      method="get"
      action={ctx.pathname}
      data-filter-form="price"
      className="flex flex-col gap-3"
    >
      <HiddenParams search={ctx.search} omit={PRICE_FORM_OMIT} />
      <div className="flex items-end gap-2">
        <Input
          label="Min"
          name="min"
          type="number"
          min={0}
          step="1"
          inputMode="numeric"
          defaultValue={min}
          className="h-11"
          wrapperClassName="flex-1"
        />
        <Input
          label="Max"
          name="max"
          type="number"
          min={0}
          step="1"
          inputMode="numeric"
          defaultValue={max}
          className="h-11"
          wrapperClassName="flex-1"
        />
      </div>
      <Button type="submit" variant="outline" size="sm" className="self-start">
        Apply
      </Button>
    </form>
  )
}
