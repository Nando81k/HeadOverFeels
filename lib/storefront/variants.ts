// lib/storefront/variants.ts
//
// PDP variant state lives in the URL: `?<OptionName>=<value>` (Phase 2 plan,
// cross-cutting note 6). Everything here is pure — no React, no I/O — so the
// server page, the links it renders and the tests all agree on one resolution.

import type { SearchParamsLike } from '@/lib/shopify/filters'
import type { ProductDetail, ProductVariant } from '@/lib/shopify/types'

/** Option name -> chosen value, in product option order. */
export type SelectedOptions = Record<string, string>

/** Whether a value can be bought, could be bought, or does not exist at all. */
export type OptionValueAvailability = 'available' | 'soldout' | 'unavailable'

export type SelectVariantResult = {
  selected: ProductVariant | null
  selectedOptions: SelectedOptions
  /** True when every product option has a value — i.e. the selection is buyable. */
  complete: boolean
}

// ---------------------------------------------------------------- internals

/** Option names and values are merchandiser text: compare them leniently. */
function eq(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

function isUrlSearchParams(params: SearchParamsLike): params is URLSearchParams {
  return typeof URLSearchParams !== 'undefined' && params instanceof URLSearchParams
}

/** `SearchParamsLike` -> flat pairs, first value wins for repeated keys. */
function toEntries(params: SearchParamsLike): [string, string][] {
  if (isUrlSearchParams(params)) return Array.from(params.entries())
  if (typeof params !== 'object' || params === null) return []

  const entries: [string, string][] = []
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') entries.push([key, value])
    else if (Array.isArray(value)) {
      const first = value.find((item) => typeof item === 'string')
      if (typeof first === 'string') entries.push([key, first])
    }
  }
  return entries
}

/** The variant's value for `name`, or null when it does not carry that option. */
function valueOf(variant: ProductVariant, name: string): string | null {
  return variant.selectedOptions.find((option) => eq(option.name, name))?.value ?? null
}

/** True when the variant carries every requested option value. */
function matchesOptions(variant: ProductVariant, wanted: SelectedOptions): boolean {
  return Object.entries(wanted).every(([name, value]) => {
    const actual = valueOf(variant, name)
    return actual !== null && eq(actual, value)
  })
}

/** A variant's options keyed by the canonical product option names, in their order. */
function optionsOfVariant(product: ProductDetail, variant: ProductVariant): SelectedOptions {
  const out: SelectedOptions = {}
  for (const option of product.options) {
    const value = valueOf(variant, option.name)
    if (value !== null) out[option.name] = value
  }
  // Options Shopify reports on the variant but not on the product (rare, and
  // harmless): keep them so the URL still round-trips.
  for (const option of variant.selectedOptions) {
    if (!product.options.some((candidate) => eq(candidate.name, option.name))) {
      out[option.name] = option.value
    }
  }
  return out
}

// ------------------------------------------------------------------ selection

/**
 * Resolve `?Size=M&Color=Bone` (option names matched case-insensitively) to a
 * variant.
 *
 * - no params → the first `availableForSale` variant, else the first variant;
 * - partial params → the first variant matching them, preferring an available
 *   one, with the remaining options filled in from that variant;
 * - values that are not option values of the product are ignored.
 */
export function selectVariant(product: ProductDetail, sp: SearchParamsLike): SelectVariantResult {
  const entries = toEntries(sp)

  const requested: SelectedOptions = {}
  for (const option of product.options) {
    const param = entries.find(([key]) => eq(key, option.name))
    if (!param) continue
    const value = option.values.find((candidate) => eq(candidate.name, param[1]))
    if (value) requested[option.name] = value.name
  }

  const candidates = product.variants.filter((variant) => matchesOptions(variant, requested))
  const selected = candidates.find((variant) => variant.availableForSale) ?? candidates[0] ?? null

  const selectedOptions = selected ? optionsOfVariant(product, selected) : requested
  const complete = product.options.every((option) => Boolean(selectedOptions[option.name]))

  return { selected, selectedOptions, complete }
}

/** Selected options as query params, in order, dropping empty values. */
export function selectedOptionsToParams(selectedOptions: SelectedOptions): URLSearchParams {
  const params = new URLSearchParams()
  for (const [name, value] of Object.entries(selectedOptions)) {
    if (typeof value === 'string' && value.length > 0) params.set(name, value)
  }
  return params
}

/**
 * Href for picking `change` while keeping every other selected option — the
 * only way a PDP option control ever navigates.
 */
export function variantHref(
  pathname: string,
  selectedOptions: SelectedOptions,
  change: { name: string; value: string }
): string {
  const next: SelectedOptions = { ...selectedOptions }
  const existing = Object.keys(next).find((key) => eq(key, change.name))
  next[existing ?? change.name] = change.value

  const query = selectedOptionsToParams(next).toString()
  return query.length > 0 ? `${pathname}?${query}` : pathname
}

/**
 * How `value` behaves for `optionName` given everything else already selected:
 * `available` (a matching variant is in stock), `soldout` (it exists but is
 * out of stock) or `unavailable` (no variant combines them).
 */
export function optionValueAvailability(
  product: ProductDetail,
  selectedOptions: SelectedOptions,
  optionName: string,
  value: string
): OptionValueAvailability {
  const others: SelectedOptions = {}
  for (const [name, selected] of Object.entries(selectedOptions)) {
    if (!eq(name, optionName)) others[name] = selected
  }

  const matching = product.variants.filter(
    (variant) => matchesOptions(variant, others) && eq(valueOf(variant, optionName) ?? '', value)
  )

  if (matching.length === 0) return 'unavailable'
  return matching.some((variant) => variant.availableForSale) ? 'available' : 'soldout'
}
