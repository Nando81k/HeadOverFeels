// lib/storefront/plp-params.ts
//
// Pure URL-state helpers shared by every product listing page (collection PLP,
// `/search`). No I/O, no React, no `server-only` import — safe from server
// components, client islands and tests alike.
//
// The URL is the state (Phase 2 plan, cross-cutting note 6):
//   ?sort=<CollectionSort|SearchSort>   sort key; absent = the page default
//   ?after=<cursor>                     "load more" cursor; dropped by every patch
//   ?filter.*=…                         Shopify filters, scheme owned by lib/shopify/filters
//   ?q=<query>                          search only; never dropped by a patch
//   ?min=&max=                          the no-JS price form's fields, folded into
//                                       `filter.v.price` on read and on the next href
//
// Server components cannot hand a `URLSearchParams` (or a function) to a client
// component, so every island takes a plain `PlpContext` instead and rebuilds the
// params itself.

import {
  activeToProductFilter,
  clearFilterParams,
  parseFilterParams,
  toggleFilterParam,
  type ActiveFilter,
  type ProductFilter,
  type SearchParamsLike,
} from '@/lib/shopify/filters'
import type { CollectionSort } from '@/lib/shopify/queries/collection'
import type { SearchSort } from '@/lib/shopify/queries/search'

export type { ActiveFilter, ProductFilter, SearchParamsLike }

/** Everything an island needs to rebuild the current URL. Plain data on purpose. */
export type PlpContext = {
  pathname: string
  /** The current query string including its leading `?`, or `''`. */
  search: string
}

export type SortOption<T extends string = string> = { value: T; label: string }

const SORT_PARAM = 'sort'
const CURSOR_PARAM = 'after'
const QUERY_PARAM = 'q'
const PRICE_KEY = 'filter.v.price'
const MIN_PARAM = 'min'
const MAX_PARAM = 'max'

export const SORT_OPTIONS: SortOption<CollectionSort>[] = [
  { value: 'best-selling', label: 'Best selling' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'title', label: 'A–Z' },
]

export const SEARCH_SORT_OPTIONS: SortOption<SearchSort>[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
]

const COLLECTION_SORTS = new Set<string>(SORT_OPTIONS.map((option) => option.value))
const SEARCH_SORTS = new Set<string>(SEARCH_SORT_OPTIONS.map((option) => option.value))

// ---------------------------------------------------------------------------
// reading
// ---------------------------------------------------------------------------

function isUrlSearchParams(params: SearchParamsLike): params is URLSearchParams {
  return typeof URLSearchParams !== 'undefined' && params instanceof URLSearchParams
}

/** Flattens either accepted shape into ordered pairs; array values repeat their key. */
function toEntries(params: SearchParamsLike): [string, string][] {
  if (isUrlSearchParams(params)) return Array.from(params.entries())
  const entries: [string, string][] = []
  if (typeof params !== 'object' || params === null) return entries
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') entries.push([key, value])
    else if (Array.isArray(value)) {
      for (const item of value) if (typeof item === 'string') entries.push([key, item])
    }
  }
  return entries
}

/** First value of a param, or `''`. */
function first(params: SearchParamsLike, key: string): string {
  for (const [entryKey, value] of toEntries(params)) {
    if (entryKey === key) return value
  }
  return ''
}

/** Splits a `PlpContext['search']` (with or without its `?`) into ordered pairs. */
export function searchEntries(search: string): [string, string][] {
  const raw = search.startsWith('?') ? search.slice(1) : search
  if (!raw) return []
  return Array.from(new URLSearchParams(raw).entries())
}

/** `''` or `'?a=b'`; order follows the input's own order. */
export function toSearchString(sp: SearchParamsLike): string {
  const params = new URLSearchParams()
  for (const [key, value] of toEntries(sp)) params.append(key, value)
  const query = params.toString()
  return query ? `?${query}` : ''
}

/** The `min`/`max` pair the price form posts, as a `filter.v.price` value, or `null`. */
function priceValueFrom(params: SearchParamsLike): string | null {
  const min = first(params, MIN_PARAM).trim()
  const max = first(params, MAX_PARAM).trim()
  if (!min && !max) return null
  const value = `${min}-${max}`
  return activeToProductFilter({ key: PRICE_KEY, value }) ? value : null
}

/**
 * `parseFilterParams`, plus the `min`/`max` fold: the no-JS price form submits
 * two plain fields rather than the packed `filter.v.price` value, so they are
 * translated here (replacing any packed value that is still in the URL).
 */
function readFilters(sp: SearchParamsLike): { filters: ProductFilter[]; active: ActiveFilter[] } {
  const { productFilters, active } = parseFilterParams(sp)
  const priceValue = priceValueFrom(sp)
  if (!priceValue) return { filters: productFilters, active }

  const filters: ProductFilter[] = []
  const nextActive: ActiveFilter[] = []
  active.forEach((entry, index) => {
    if (entry.key === PRICE_KEY) return
    nextActive.push(entry)
    filters.push(productFilters[index])
  })

  const priceFilter = activeToProductFilter({ key: PRICE_KEY, value: priceValue })
  if (priceFilter) {
    nextActive.push({ key: PRICE_KEY, value: priceValue })
    filters.push(priceFilter)
  }
  return { filters, active: nextActive }
}

export type PlpParams = {
  sort: CollectionSort
  after: string | null
  filters: ProductFilter[]
  active: ActiveFilter[]
}

/** Collection PLP state. Unknown sorts fall back to `opts.defaultSort` (`best-selling`). */
export function parsePlpParams(
  sp: SearchParamsLike,
  opts?: { defaultSort?: CollectionSort }
): PlpParams {
  const fallback = opts?.defaultSort ?? 'best-selling'
  const raw = first(sp, SORT_PARAM)
  const after = first(sp, CURSOR_PARAM)
  const { filters, active } = readFilters(sp)

  return {
    sort: COLLECTION_SORTS.has(raw) ? (raw as CollectionSort) : fallback,
    after: after || null,
    filters,
    active,
  }
}

export type SearchPlpParams = {
  q: string
  sort: SearchSort
  after: string | null
  filters: ProductFilter[]
  active: ActiveFilter[]
}

/** `/search` state. `q` is trimmed; unknown sorts fall back to `relevance`. */
export function parseSearchParams(sp: SearchParamsLike): SearchPlpParams {
  const raw = first(sp, SORT_PARAM)
  const after = first(sp, CURSOR_PARAM)
  const { filters, active } = readFilters(sp)

  return {
    q: first(sp, QUERY_PARAM).trim(),
    sort: SEARCH_SORTS.has(raw) ? (raw as SearchSort) : 'relevance',
    after: after || null,
    filters,
    active,
  }
}

// ---------------------------------------------------------------------------
// writing
// ---------------------------------------------------------------------------

/** Turns the loose `min`/`max` fields into the packed `filter.v.price` param. */
function foldPriceParams(params: URLSearchParams): URLSearchParams {
  const value = priceValueFrom(params)
  const next = new URLSearchParams()
  for (const [key, entry] of params.entries()) {
    if (key === MIN_PARAM || key === MAX_PARAM) continue
    if (value && key === PRICE_KEY) continue
    next.append(key, entry)
  }
  if (value) next.append(PRICE_KEY, value)
  return next
}

function setPrice(params: URLSearchParams, price: { min?: string; max?: string } | null) {
  const min = (price?.min ?? '').trim()
  const max = (price?.max ?? '').trim()
  const value = min || max ? `${min}-${max}` : ''
  const usable = value && activeToProductFilter({ key: PRICE_KEY, value }) ? value : ''

  const kept = params.getAll(PRICE_KEY)
  if (kept.length > 0) params.delete(PRICE_KEY)
  if (usable) params.append(PRICE_KEY, usable)
}

export type PlpHrefPatch = {
  /** A new sort value, or `null` to fall back to the page default. */
  sort?: string | null
  /** Add the pair when absent, remove it when present. */
  toggle?: ActiveFilter
  /** Drop every `filter.*` param (keeps `q` and `sort`). */
  clear?: boolean
  /** Replace the price range, or `null` to remove it. */
  price?: { min?: string; max?: string } | null
}

/**
 * The href a filter/sort control links to. Every patch drops the `after`
 * cursor (the result set changes) and folds any stray `min`/`max` fields, and
 * `q` always survives.
 */
export function buildPlpHref(ctx: PlpContext, patch: PlpHrefPatch): string {
  let params = foldPriceParams(new URLSearchParams(searchEntries(ctx.search)))
  params.delete(CURSOR_PARAM)

  if (patch.clear) params = clearFilterParams(params)
  if (patch.toggle) params = toggleFilterParam(params, patch.toggle)
  if (patch.price !== undefined) setPrice(params, patch.price)

  if (patch.sort !== undefined) {
    if (patch.sort === null || patch.sort === '') params.delete(SORT_PARAM)
    else params.set(SORT_PARAM, patch.sort)
  }

  params.delete(CURSOR_PARAM)
  const query = params.toString()
  return query ? `${ctx.pathname}?${query}` : ctx.pathname
}

/** True when the pair is present in the URL state. */
export function isActiveFilter(active: ActiveFilter[], filter: ActiveFilter): boolean {
  return active.some((entry) => entry.key === filter.key && entry.value === filter.value)
}

/** The active price range as the price form's two fields. */
export function activePriceRange(active: ActiveFilter[]): { min: string; max: string } {
  const entry = active.find((item) => item.key === PRICE_KEY)
  if (!entry) return { min: '', max: '' }
  const dash = entry.value.indexOf('-')
  if (dash === -1) return { min: '', max: '' }
  return { min: entry.value.slice(0, dash), max: entry.value.slice(dash + 1) }
}

/** Params the price form must not resubmit (it owns them itself). */
export const PRICE_FORM_OMIT = [PRICE_KEY, MIN_PARAM, MAX_PARAM, CURSOR_PARAM]

/** Params the sort form must not resubmit. */
export const SORT_FORM_OMIT = [SORT_PARAM, CURSOR_PARAM]

/** Human-readable fallback for an active pair no `FilterValue` labels. */
export function fallbackFilterLabel(filter: ActiveFilter): string {
  if (filter.key !== PRICE_KEY) return filter.value
  const { min, max } = activePriceRange([filter])
  if (min && max) return `${min} – ${max}`
  if (min) return `From ${min}`
  if (max) return `Up to ${max}`
  return 'Price'
}
