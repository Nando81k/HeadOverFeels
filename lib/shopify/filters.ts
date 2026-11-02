// lib/shopify/filters.ts
//
// Pure mapping between the storefront's URL params and Shopify's `ProductFilter`
// input. No I/O, no React — safe to import from server components, client
// components and route handlers alike.
//
// Param scheme (mirrors Shopify's `FilterValue.id`):
//   filter.v.availability=1|0          -> { available }
//   filter.v.option.<name>=<value>     -> { variantOption: { name, value } }   (repeatable)
//   filter.v.price=<min>-<max>         -> { price: { min?, max? } }            (either side may be empty)
//   filter.p.product_type=<value>      -> { productType }
//   filter.p.vendor=<value>            -> { productVendor }
//   filter.p.tag=<value>               -> { tag }                              (repeatable)
//   filter.p.m.<ns>.<key>=<value>      -> { productMetafield: { namespace, key, value } }
//   filter.v.m.<ns>.<key>=<value>      -> { variantMetafield: { namespace, key, value } }
// Unknown or malformed params are ignored.

import type { FilterValue } from './types'

export type ProductFilter =
  | { available: boolean }
  | { variantOption: { name: string; value: string } }
  | { price: { min?: number; max?: number } }
  | { productType: string }
  | { productVendor: string }
  | { tag: string }
  | { productMetafield: { namespace: string; key: string; value: string } }
  | { variantMetafield: { namespace: string; key: string; value: string } }

/** A single `key=value` pair of the URL scheme above, e.g. `{ key: 'filter.v.option.Size', value: 'M' }`. */
export type ActiveFilter = { key: string; value: string }

/** `URLSearchParams` or a Next.js `searchParams` record. */
export type SearchParamsLike = URLSearchParams | Record<string, string | string[] | undefined>

const FILTER_PREFIX = 'filter.'
const CURSOR_PARAM = 'after'

const AVAILABILITY_KEY = 'filter.v.availability'
const PRICE_KEY = 'filter.v.price'
const PRODUCT_TYPE_KEY = 'filter.p.product_type'
const VENDOR_KEY = 'filter.p.vendor'
const TAG_KEY = 'filter.p.tag'
const OPTION_PREFIX = 'filter.v.option.'
const PRODUCT_METAFIELD_PREFIX = 'filter.p.m.'
const VARIANT_METAFIELD_PREFIX = 'filter.v.m.'

/** Keys that can only hold one value at a time; toggling replaces rather than stacks. */
const SINGLE_VALUE_KEYS = new Set<string>([AVAILABILITY_KEY, PRICE_KEY])

// ---------------------------------------------------------------------------
// small guards
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

/** `undefined` = absent, `null` = present but invalid. */
function asBound(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(num) || num < 0) return null
  return num
}

function metafieldFrom(value: unknown): { namespace: string; key: string; value: string } | null {
  const record = asRecord(value)
  if (!record) return null
  const namespace = nonEmptyString(record.namespace)
  const key = nonEmptyString(record.key)
  const metaValue = nonEmptyString(record.value)
  if (!namespace || !key || !metaValue) return null
  // `.` separates the segments of the URL key, so a dotted namespace/key could not round-trip.
  if (namespace.includes('.') || key.includes('.')) return null
  return { namespace, key, value: metaValue }
}

/**
 * Validates an arbitrary value (typically parsed from `FilterValue.input`) as a
 * `ProductFilter`, returning a freshly built object or `null`.
 */
function normalizeProductFilter(raw: unknown): ProductFilter | null {
  const record = asRecord(raw)
  if (!record) return null

  if (typeof record.available === 'boolean') return { available: record.available }

  if ('variantOption' in record) {
    const option = asRecord(record.variantOption)
    const name = nonEmptyString(option?.name)
    const value = nonEmptyString(option?.value)
    return name && value ? { variantOption: { name, value } } : null
  }

  if ('price' in record) {
    const price = asRecord(record.price)
    if (!price) return null
    const min = asBound(price.min)
    const max = asBound(price.max)
    if (min === null || max === null) return null
    if (min === undefined && max === undefined) return null
    const range: { min?: number; max?: number } = {}
    if (min !== undefined) range.min = min
    if (max !== undefined) range.max = max
    return { price: range }
  }

  if ('productType' in record) {
    const value = nonEmptyString(record.productType)
    return value ? { productType: value } : null
  }

  if ('productVendor' in record) {
    const value = nonEmptyString(record.productVendor)
    return value ? { productVendor: value } : null
  }

  if ('tag' in record) {
    const value = nonEmptyString(record.tag)
    return value ? { tag: value } : null
  }

  if ('productMetafield' in record) {
    const metafield = metafieldFrom(record.productMetafield)
    return metafield ? { productMetafield: metafield } : null
  }

  if ('variantMetafield' in record) {
    const metafield = metafieldFrom(record.variantMetafield)
    return metafield ? { variantMetafield: metafield } : null
  }

  return null
}

// ---------------------------------------------------------------------------
// primitives
// ---------------------------------------------------------------------------

/** URL pair to Shopify `ProductFilter`; `null` when the key is unknown or the value malformed. */
export function activeToProductFilter(f: ActiveFilter): ProductFilter | null {
  const key = typeof f?.key === 'string' ? f.key : ''
  const value = typeof f?.value === 'string' ? f.value : ''
  if (!key.startsWith(FILTER_PREFIX)) return null

  if (key === AVAILABILITY_KEY) {
    if (value === '1') return { available: true }
    if (value === '0') return { available: false }
    return null
  }

  if (key === PRICE_KEY) {
    const dash = value.indexOf('-')
    if (dash === -1) return null
    return normalizeProductFilter({
      price: { min: value.slice(0, dash).trim(), max: value.slice(dash + 1).trim() },
    })
  }

  if (key === PRODUCT_TYPE_KEY) return normalizeProductFilter({ productType: value })
  if (key === VENDOR_KEY) return normalizeProductFilter({ productVendor: value })
  if (key === TAG_KEY) return normalizeProductFilter({ tag: value })

  if (key.startsWith(OPTION_PREFIX)) {
    // The option name is passed through unchanged - Shopify decides the casing.
    return normalizeProductFilter({
      variantOption: { name: key.slice(OPTION_PREFIX.length), value },
    })
  }

  if (key.startsWith(PRODUCT_METAFIELD_PREFIX)) {
    const parts = key.slice(PRODUCT_METAFIELD_PREFIX.length).split('.')
    if (parts.length !== 2) return null
    return normalizeProductFilter({
      productMetafield: { namespace: parts[0], key: parts[1], value },
    })
  }

  if (key.startsWith(VARIANT_METAFIELD_PREFIX)) {
    const parts = key.slice(VARIANT_METAFIELD_PREFIX.length).split('.')
    if (parts.length !== 2) return null
    return normalizeProductFilter({
      variantMetafield: { namespace: parts[0], key: parts[1], value },
    })
  }

  return null
}

/** Shopify `ProductFilter` to URL pair; `null` when the filter is empty or unknown. */
export function productFilterToActive(pf: ProductFilter): ActiveFilter | null {
  const filter = normalizeProductFilter(pf)
  if (!filter) return null

  if ('available' in filter) {
    return { key: AVAILABILITY_KEY, value: filter.available ? '1' : '0' }
  }
  if ('variantOption' in filter) {
    return {
      key: `${OPTION_PREFIX}${filter.variantOption.name}`,
      value: filter.variantOption.value,
    }
  }
  if ('price' in filter) {
    const min = filter.price.min === undefined ? '' : String(filter.price.min)
    const max = filter.price.max === undefined ? '' : String(filter.price.max)
    return { key: PRICE_KEY, value: `${min}-${max}` }
  }
  if ('productType' in filter) return { key: PRODUCT_TYPE_KEY, value: filter.productType }
  if ('productVendor' in filter) return { key: VENDOR_KEY, value: filter.productVendor }
  if ('tag' in filter) return { key: TAG_KEY, value: filter.tag }
  if ('productMetafield' in filter) {
    const { namespace, key, value } = filter.productMetafield
    return { key: `${PRODUCT_METAFIELD_PREFIX}${namespace}.${key}`, value }
  }
  const { namespace, key, value } = filter.variantMetafield
  return { key: `${VARIANT_METAFIELD_PREFIX}${namespace}.${key}`, value }
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

function isUrlSearchParams(params: SearchParamsLike): params is URLSearchParams {
  return typeof URLSearchParams !== 'undefined' && params instanceof URLSearchParams
}

function toEntries(params: SearchParamsLike): [string, string][] {
  if (isUrlSearchParams(params)) return Array.from(params.entries())
  const entries: [string, string][] = []
  const record = asRecord(params)
  if (!record) return entries
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'string') entries.push([key, value])
    else if (Array.isArray(value)) {
      for (const item of value) if (typeof item === 'string') entries.push([key, item])
    }
  }
  return entries
}

/**
 * Reads every recognised `filter.*` param, in URL order, ignoring unknown keys
 * and malformed values. Duplicated identical pairs are collapsed.
 */
export function parseFilterParams(params: SearchParamsLike): {
  productFilters: ProductFilter[]
  active: ActiveFilter[]
} {
  const productFilters: ProductFilter[] = []
  const active: ActiveFilter[] = []
  const seen = new Set<string>()

  for (const [key, value] of toEntries(params)) {
    if (!key.startsWith(FILTER_PREFIX)) continue
    const pair = `${key} ${value}`
    if (seen.has(pair)) continue
    const filter = activeToProductFilter({ key, value })
    if (!filter) continue
    seen.add(pair)
    productFilters.push(filter)
    active.push({ key, value })
  }

  return { productFilters, active }
}

/** Shopify `FilterValue` (whose `input` is a JSON string) to a URL pair. */
export function filterValueToActive(value: FilterValue): ActiveFilter | null {
  const input: unknown = value?.input
  let raw: unknown = null

  if (typeof input === 'string') {
    if (input.trim().length === 0) return null
    try {
      raw = JSON.parse(input)
    } catch {
      return null
    }
  } else if (typeof input === 'object' && input !== null) {
    raw = input
  } else {
    return null
  }

  const filter = normalizeProductFilter(raw)
  return filter ? productFilterToActive(filter) : null
}

/** True when the URL already carries the pair this `FilterValue` maps to. */
export function isFilterValueActive(active: ActiveFilter[], value: FilterValue): boolean {
  const target = filterValueToActive(value)
  if (!target) return false
  return active.some((entry) => entry.key === target.key && entry.value === target.value)
}

/**
 * Returns a NEW `URLSearchParams` with the pair added when absent and removed
 * when present. Repeatable keys (`filter.v.option.*`, `filter.p.tag`) stack;
 * single-valued keys (availability, price) are replaced. The `after` cursor is
 * always dropped because the result set changes.
 */
export function toggleFilterParam(params: URLSearchParams, f: ActiveFilter): URLSearchParams {
  const next = new URLSearchParams()
  const present = params.getAll(f.key).includes(f.value)
  const single = SINGLE_VALUE_KEYS.has(f.key)

  for (const [key, value] of params.entries()) {
    if (key === CURSOR_PARAM) continue
    if (key === f.key) {
      if (present && value === f.value) continue
      if (!present && single) continue
      next.append(key, value)
      continue
    }
    next.append(key, value)
  }

  if (!present) next.append(f.key, f.value)
  return next
}

/** Returns a NEW `URLSearchParams` without any `filter.*` param and without `after`. */
export function clearFilterParams(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams()
  for (const [key, value] of params.entries()) {
    if (key === CURSOR_PARAM || key.startsWith(FILTER_PREFIX)) continue
    next.append(key, value)
  }
  return next
}
