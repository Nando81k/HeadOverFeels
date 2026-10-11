import { storefrontFetch } from '../client'
import type { ProductFilter } from '../filters'
import type { CollectionSummary, SearchPage, SearchSuggestion } from '../types'
import { normalizeFilters, type RawFilter } from './collection'
import { PRODUCT_CARD_FIELDS, toProductCard, type RawProductCard } from './fragments'

export const PREDICTIVE_SEARCH_QUERY = `query PredictiveSearch($q: String!) {
  predictiveSearch(query: $q, limit: 6, types: [PRODUCT, COLLECTION]) {
    products { ...ProductCardFields }
    collections { id handle title }
  }
}

${PRODUCT_CARD_FIELDS}`

/** Shopify's predictive search ignores anything shorter than this. */
export const MIN_SEARCH_LENGTH = 2

export type RawPredictiveSearch = {
  predictiveSearch: {
    products: RawProductCard[] | null
    collections: { id: string; handle: string; title: string }[] | null
  } | null
}

const EMPTY_SUGGESTION: SearchSuggestion = { products: [], collections: [] }

export function normalizePredictiveSearch(raw: RawPredictiveSearch): SearchSuggestion {
  const result = raw.predictiveSearch
  if (!result) return { products: [], collections: [] }
  const collections: CollectionSummary[] = (result.collections ?? []).map((collection) => ({
    id: collection.id,
    handle: collection.handle,
    title: collection.title,
    image: null,
    description: null,
    featured: false,
  }))
  return { products: (result.products ?? []).map(toProductCard), collections }
}

/**
 * Type-ahead suggestions. Never cached (`revalidate: false`) and never fetched
 * for a query Shopify would reject anyway.
 */
export async function getPredictiveSearch(q: string): Promise<SearchSuggestion> {
  const query = q.trim()
  if (query.length < MIN_SEARCH_LENGTH) return { ...EMPTY_SUGGESTION }

  const data = await storefrontFetch<RawPredictiveSearch>(PREDICTIVE_SEARCH_QUERY, {
    variables: { q: query },
    tags: ['search'],
    revalidate: false,
  })
  return normalizePredictiveSearch(data)
}

// ---------------------------------------------------------------- full search

export const SEARCH_QUERY = `query SearchProducts($q: String!, $first: Int!, $after: String, $filters: [ProductFilter!], $sortKey: SearchSortKeys, $reverse: Boolean) {
  search(query: $q, first: $first, after: $after, productFilters: $filters, sortKey: $sortKey, reverse: $reverse, types: [PRODUCT], unavailableProducts: LAST) {
    totalCount
    productFilters { id label type values { id label count input } }
    pageInfo { hasNextPage endCursor }
    nodes { ... on Product { ...ProductCardFields } }
  }
}

${PRODUCT_CARD_FIELDS}`

export type RawSearchPage = {
  search: {
    totalCount: number
    productFilters: RawFilter[] | null
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
    nodes: RawProductCard[]
  } | null
}

// ---------------------------------------------------------------- sorting

export type SearchSort = 'relevance' | 'price-asc' | 'price-desc'

export type SearchSortArgs = { sortKey: 'RELEVANCE' | 'PRICE'; reverse: boolean }

const SEARCH_SORT_ARGS: Record<SearchSort, SearchSortArgs> = {
  relevance: { sortKey: 'RELEVANCE', reverse: false },
  'price-asc': { sortKey: 'PRICE', reverse: false },
  'price-desc': { sortKey: 'PRICE', reverse: true },
}

export function toSearchSortArgs(sort: SearchSort = 'relevance'): SearchSortArgs {
  return SEARCH_SORT_ARGS[sort] ?? SEARCH_SORT_ARGS.relevance
}

// ---------------------------------------------------------------- normaliser

function emptySearchPage(): SearchPage {
  return {
    products: [],
    filters: [],
    pageInfo: { hasNextPage: false, endCursor: null },
    totalCount: 0,
  }
}

export function normalizeSearchPage(raw: RawSearchPage): SearchPage {
  const result = raw.search
  if (!result) return emptySearchPage()
  return {
    products: (result.nodes ?? []).map(toProductCard),
    filters: normalizeFilters(result.productFilters),
    pageInfo: {
      hasNextPage: result.pageInfo.hasNextPage,
      endCursor: result.pageInfo.endCursor ?? null,
    },
    totalCount: result.totalCount ?? 0,
  }
}

// ---------------------------------------------------------------- fetcher

export type GetSearchResultsArgs = {
  q: string
  first?: number
  after?: string | null
  /** Already-parsed `ProductFilter` objects (see `lib/shopify/filters.ts`). */
  filters?: ProductFilter[]
  sort?: SearchSort
}

/**
 * Full search results (products only). Never cached (`revalidate: false`); an
 * empty query resolves to the empty page without touching the API.
 */
export async function getSearchResults({
  q,
  first = 24,
  after = null,
  filters = [],
  sort,
}: GetSearchResultsArgs): Promise<SearchPage> {
  const query = q.trim()
  if (query.length === 0) return emptySearchPage()

  const { sortKey, reverse } = toSearchSortArgs(sort)
  const data = await storefrontFetch<RawSearchPage>(SEARCH_QUERY, {
    variables: {
      q: query,
      first,
      after,
      filters: filters.length > 0 ? filters : null,
      sortKey,
      reverse,
    },
    tags: ['search'],
    revalidate: false,
  })
  return normalizeSearchPage(data)
}
