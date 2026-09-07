import { getCollectionProducts, getCollections } from '@/lib/shopify/queries'
import type { CollectionSummary, ProductCardData } from '@/lib/shopify/types'

/**
 * Everything `app/(storefront)/page.tsx` needs, in one call (Phase 2 plan,
 * "Shared contracts" → `lib/storefront/home-data.ts`).
 *
 * Nothing here is caught: the page only calls `getHomeData()` once
 * `hasShopifyEnv()` is true, so a failure at that point is a real Shopify
 * outage and belongs to `app/(storefront)/error.tsx`. A *missing* collection
 * (an unknown handle → `null` page) is not a failure — the store simply has no
 * `drops` or `best-sellers` yet — and degrades to an empty list.
 */
export type HomeData = {
  featuredCollections: CollectionSummary[]
  newIn: ProductCardData[]
  bestSellers: ProductCardData[]
  drops: ProductCardData[]
}

/** Plumbing collections Shopify creates for itself — never merchandised on the home page. */
const HIDDEN_COLLECTION_HANDLES = new Set(['all', 'frontpage'])

/** How many collections the fallback promotes when nothing is flagged `custom.featured`. */
export const FEATURED_COLLECTION_FALLBACK = 3
/** Products fetched for each home rail. */
export const HOME_RAIL_SIZE = 8
/** Products fetched for the drop spotlight. */
export const HOME_DROP_SIZE = 4

/**
 * Collections flagged `custom.featured` in Shopify admin, minus the plumbing
 * handles; when the merchant has flagged none, the first few real collections
 * so the home page is never a hole. `CollectionTiles` caps what it shows.
 */
export function pickFeaturedCollections(collections: CollectionSummary[]): CollectionSummary[] {
  const eligible = collections.filter(
    (collection) => !HIDDEN_COLLECTION_HANDLES.has(collection.handle)
  )
  const featured = eligible.filter((collection) => collection.featured)

  return featured.length > 0 ? featured : eligible.slice(0, FEATURED_COLLECTION_FALLBACK)
}

export async function getHomeData(): Promise<HomeData> {
  const [collections, newInPage, bestSellersPage, dropsPage] = await Promise.all([
    getCollections(),
    getCollectionProducts({ handle: 'all', sort: 'newest', first: HOME_RAIL_SIZE }),
    getCollectionProducts({ handle: 'best-sellers', first: HOME_RAIL_SIZE }),
    getCollectionProducts({ handle: 'drops', first: HOME_DROP_SIZE }),
  ])

  // A store that never created a `best-sellers` collection still has best
  // sellers — Shopify can sort `all` by them.
  const bestSellers =
    bestSellersPage && bestSellersPage.products.length > 0
      ? bestSellersPage.products
      : ((
          await getCollectionProducts({
            handle: 'all',
            sort: 'best-selling',
            first: HOME_RAIL_SIZE,
          })
        )?.products ?? [])

  return {
    featuredCollections: pickFeaturedCollections(collections),
    newIn: newInPage?.products ?? [],
    bestSellers,
    drops: dropsPage?.products ?? [],
  }
}
