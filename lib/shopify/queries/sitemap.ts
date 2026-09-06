import { storefrontFetch } from '../client'
import type { SitemapEntries, SitemapEntry } from '../types'

/**
 * Handle + `updatedAt` only — the sitemap needs nothing else, so these
 * documents deliberately carry no fragments (a full `ProductCardFields`
 * selection over 250 nodes a page would blow the Storefront cost budget).
 */
export const SITEMAP_PRODUCTS_QUERY = `query SitemapProducts($first: Int!, $after: String) { products(first: $first, after: $after, sortKey: UPDATED_AT) { pageInfo { hasNextPage endCursor } nodes { handle updatedAt } } }`

export const SITEMAP_COLLECTIONS_QUERY = `query SitemapCollections($first: Int!, $after: String) { collections(first: $first, after: $after) { pageInfo { hasNextPage endCursor } nodes { handle updatedAt } } }`

/** Storefront API connection maximum. */
const SITEMAP_PAGE_SIZE = 250

/** Sitemaps are rebuilt hourly, not on the catalog's 5-minute cadence. */
export const SITEMAP_REVALIDATE = 3600

const SITEMAP_TAGS = ['collections', 'products']

/** Hard stop so a mis-reported `hasNextPage` can never loop forever. */
const MAX_PAGES = 100

type RawSitemapConnection = {
  pageInfo: { hasNextPage: boolean; endCursor: string | null }
  nodes: SitemapEntry[]
} | null

type RawSitemapProducts = { products: RawSitemapConnection }
type RawSitemapCollections = { collections: RawSitemapConnection }

function toEntries(nodes: SitemapEntry[] | undefined): SitemapEntry[] {
  return (nodes ?? []).map((node) => ({ handle: node.handle, updatedAt: node.updatedAt }))
}

async function fetchAll<T>(
  query: string,
  select: (data: T) => RawSitemapConnection
): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = []
  let after: string | null = null

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const data: T = await storefrontFetch<T>(query, {
      variables: { first: SITEMAP_PAGE_SIZE, after },
      tags: SITEMAP_TAGS,
      revalidate: SITEMAP_REVALIDATE,
    })
    const connection = select(data)
    if (!connection) break

    entries.push(...toEntries(connection.nodes))
    if (!connection.pageInfo?.hasNextPage || !connection.pageInfo.endCursor) break
    after = connection.pageInfo.endCursor
  }

  return entries
}

/**
 * Every published product and collection handle with its `updatedAt`, for
 * `app/sitemap.ts`. Both connections are paginated to exhaustion.
 */
export async function getSitemapEntries(): Promise<SitemapEntries> {
  const products = await fetchAll<RawSitemapProducts>(SITEMAP_PRODUCTS_QUERY, (d) => d.products)
  const collections = await fetchAll<RawSitemapCollections>(
    SITEMAP_COLLECTIONS_QUERY,
    (d) => d.collections
  )
  return { products, collections }
}
