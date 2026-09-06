'use server'

import {
  getCollectionProducts,
  getPredictiveSearch,
  getSearchResults,
  type CollectionSort,
  type SearchSort,
} from '@/lib/shopify/queries'
import type { ProductFilter } from '@/lib/shopify/filters'
import type {
  CollectionPage,
  ProductCardData,
  SearchPage,
  SearchSuggestion,
} from '@/lib/shopify/types'

/**
 * Server actions behind the catalog's client islands (`LoadMore`, `SearchDialog`).
 *
 * They are deliberately thin: parse the little the island can send, delegate to
 * `lib/shopify/queries`, and hand back a plain slice. Nothing here reads env or
 * touches a token — `storefrontFetch` owns both, and an unconfigured store
 * throws there rather than leaking anything into a response.
 */

/** Page size for every "load more" step; matches the first server-rendered page. */
const PAGE_SIZE = 24

/** What a paginating island appends to its grid. */
export type ProductPageSlice = {
  products: ProductCardData[]
  pageInfo: CollectionPage['pageInfo']
}

export type LoadMoreCollectionInput = {
  handle: string
  after: string
  filters?: ProductFilter[]
  sort?: CollectionSort
}

export type LoadMoreSearchInput = {
  q: string
  after: string
  filters?: ProductFilter[]
  sort?: SearchSort
}

/** Fresh object per call — the caller owns the array it gets back. */
function emptySlice(): ProductPageSlice {
  return { products: [], pageInfo: { hasNextPage: false, endCursor: null } }
}

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Next page of a collection PLP. Unknown handle or missing cursor → empty slice. */
export async function loadMoreCollectionProducts(
  input: LoadMoreCollectionInput
): Promise<ProductPageSlice> {
  const handle = trimmed(input?.handle)
  const after = trimmed(input?.after)
  if (!handle || !after) return emptySlice()

  const page: CollectionPage | null = await getCollectionProducts({
    handle,
    after,
    filters: input.filters,
    sort: input.sort,
    first: PAGE_SIZE,
  })
  if (!page) return emptySlice()

  return { products: page.products, pageInfo: page.pageInfo }
}

/** Next page of `/search`. Blank query or missing cursor → empty slice. */
export async function loadMoreSearchResults(
  input: LoadMoreSearchInput
): Promise<ProductPageSlice> {
  const q = trimmed(input?.q)
  const after = trimmed(input?.after)
  if (!q || !after) return emptySlice()

  const page: SearchPage = await getSearchResults({
    q,
    after,
    filters: input.filters,
    sort: input.sort,
    first: PAGE_SIZE,
  })

  return { products: page.products, pageInfo: page.pageInfo }
}

/** Type-ahead suggestions for the header search dialog. */
export async function predictiveSearchAction(q: string): Promise<SearchSuggestion> {
  const query = trimmed(q)
  if (!query) return { products: [], collections: [] }
  return getPredictiveSearch(query)
}
