import { storefrontFetch } from '../client'
import type { CollectionPage, Filter, FilterValue } from '../types'
import {
  CATALOG_REVALIDATE,
  PRODUCT_CARD_FIELDS,
  toImage,
  toProductCard,
  type RawImage,
  type RawProductCard,
} from './fragments'

export const COLLECTION_PRODUCTS_QUERY = `query CollectionProducts($handle: String!, $first: Int!, $after: String, $filters: [ProductFilter!], $sortKey: ProductCollectionSortKeys, $reverse: Boolean) {
  collection(handle: $handle) {
    id
    handle
    title
    descriptionHtml
    image { ...ImageFields }
    products(first: $first, after: $after, filters: $filters, sortKey: $sortKey, reverse: $reverse) {
      filters { id label type values { id label count input } }
      pageInfo { hasNextPage endCursor }
      nodes { ...ProductCardFields }
    }
  }
}

${PRODUCT_CARD_FIELDS}`

// ---------------------------------------------------------------- raw shapes

export type RawFilterValue = { id: string; label: string; count: number; input: string }
export type RawFilter = { id: string; label: string; type: string; values: RawFilterValue[] }

export type RawCollectionPage = {
  id: string
  handle: string
  title: string
  descriptionHtml: string
  image: RawImage | null
  products: {
    filters: RawFilter[] | null
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
    nodes: RawProductCard[]
  }
}

type CollectionProductsResponse = { collection: RawCollectionPage | null }

// ---------------------------------------------------------------- sorting

export type CollectionSort = 'best-selling' | 'newest' | 'price-asc' | 'price-desc' | 'title'

export type SortArgs = {
  sortKey: 'BEST_SELLING' | 'CREATED' | 'PRICE' | 'TITLE'
  reverse: boolean
}

const SORT_ARGS: Record<CollectionSort, SortArgs> = {
  'best-selling': { sortKey: 'BEST_SELLING', reverse: false },
  newest: { sortKey: 'CREATED', reverse: true },
  'price-asc': { sortKey: 'PRICE', reverse: false },
  'price-desc': { sortKey: 'PRICE', reverse: true },
  title: { sortKey: 'TITLE', reverse: false },
}

export function toSortArgs(sort: CollectionSort = 'best-selling'): SortArgs {
  return SORT_ARGS[sort] ?? SORT_ARGS['best-selling']
}

// ---------------------------------------------------------------- normaliser

const FILTER_TYPES = new Set<Filter['type']>(['LIST', 'PRICE_RANGE', 'BOOLEAN'])

function toFilterType(type: string): Filter['type'] {
  return FILTER_TYPES.has(type as Filter['type']) ? (type as Filter['type']) : 'LIST'
}

function toFilterValue(raw: RawFilterValue): FilterValue {
  return { id: raw.id, label: raw.label, count: raw.count, input: raw.input }
}

export function normalizeCollectionPage(raw: RawCollectionPage): CollectionPage {
  return {
    collection: {
      id: raw.id,
      handle: raw.handle,
      title: raw.title,
      descriptionHtml: raw.descriptionHtml,
      image: toImage(raw.image),
      description: null,
      featured: false,
    },
    products: raw.products.nodes.map(toProductCard),
    filters: (raw.products.filters ?? []).map((filter) => ({
      id: filter.id,
      label: filter.label,
      type: toFilterType(filter.type),
      values: filter.values.map(toFilterValue),
    })),
    pageInfo: {
      hasNextPage: raw.products.pageInfo.hasNextPage,
      endCursor: raw.products.pageInfo.endCursor ?? null,
    },
  }
}

/**
 * `FilterValue.input` is a JSON string produced by Shopify and round-tripped
 * through the URL, so it is parsed defensively: anything that is not a JSON
 * object is dropped rather than sent to the API (which would 4xx the request).
 */
function parseProductFilters(filters: string[] | undefined): Record<string, unknown>[] | null {
  if (!filters || filters.length === 0) return null
  const parsed: Record<string, unknown>[] = []
  for (const filter of filters) {
    try {
      const value: unknown = JSON.parse(filter)
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        parsed.push(value as Record<string, unknown>)
      }
    } catch {
      // Ignore malformed filter input.
    }
  }
  return parsed.length > 0 ? parsed : null
}

// ---------------------------------------------------------------- fetcher

export type GetCollectionProductsArgs = {
  handle: string
  first?: number
  after?: string | null
  filters?: string[]
  sort?: CollectionSort
}

export async function getCollectionProducts({
  handle,
  first = 24,
  after,
  filters,
  sort,
}: GetCollectionProductsArgs): Promise<CollectionPage | null> {
  const { sortKey, reverse } = toSortArgs(sort)
  const data = await storefrontFetch<CollectionProductsResponse>(COLLECTION_PRODUCTS_QUERY, {
    variables: {
      handle,
      first,
      after: after ?? null,
      filters: parseProductFilters(filters),
      sortKey,
      reverse,
    },
    tags: ['collections', `collection:${handle}`],
    revalidate: CATALOG_REVALIDATE,
  })
  return data.collection ? normalizeCollectionPage(data.collection) : null
}
