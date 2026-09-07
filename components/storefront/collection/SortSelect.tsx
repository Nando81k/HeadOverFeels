'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  SORT_FORM_OMIT,
  buildPlpHref,
  type PlpContext,
  type SortOption,
} from '@/lib/storefront/plp-params'
import { Select } from '@/components/storefront/ui/Select'
import { cn } from '@/lib/storefront/cn'
import { HiddenParams } from './FilterGroup'

export interface SortSelectProps {
  /** Current sort value; must be one of `options`. */
  value: string
  options: SortOption[]
  ctx: PlpContext
  /** Accessible name of the control. Defaults to `Sort`. */
  label?: string
  className?: string
}

/**
 * Native `<select>` that navigates on change (spec §5.4).
 *
 * It lives inside a real `<form method="get">` carrying the rest of the URL as
 * hidden fields, so sorting still works without JavaScript — the `<noscript>`
 * submit button is the fallback affordance. With JS, `onChange` pushes the
 * href `buildPlpHref` computes and the form never submits.
 */
export function SortSelect({
  value,
  options,
  ctx,
  label = 'Sort',
  className,
}: SortSelectProps) {
  const router = useRouter()

  return (
    <form
      method="get"
      action={ctx.pathname}
      data-sort-form=""
      className={cn('flex items-end gap-2', className)}
    >
      <HiddenParams search={ctx.search} omit={SORT_FORM_OMIT} />
      <Select
        label={label}
        name="sort"
        value={value}
        options={options}
        onChange={(event) => router.push(buildPlpHref(ctx, { sort: event.target.value }))}
        wrapperClassName="flex-row items-center gap-3"
        className="h-11 w-auto min-w-44"
      />
      <noscript>
        <button
          type="submit"
          className="h-11 rounded-sharp border border-ink px-4 text-xs font-semibold uppercase tracking-eyebrow text-ink"
        >
          Apply
        </button>
      </noscript>
    </form>
  )
}
