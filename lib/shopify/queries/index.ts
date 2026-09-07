/**
 * Public surface of the Storefront query layer.
 *
 * Server components import from here: `import { getProduct } from '@/lib/shopify/queries'`.
 * Everything returned is a plain, already-normalised domain object from
 * `lib/shopify/types.ts` — no `edges`/`nodes` ever reach a component.
 */

export { getProduct, normalizeProduct, PRODUCT_BY_HANDLE_QUERY } from './product'
export type { RawProductDetail, RawProductVariant, RawProductDetailOption } from './product'

export {
  COLLECTION_PRODUCTS_QUERY,
  getCollectionProducts,
  normalizeCollectionPage,
  normalizeFilters,
  toFilterType,
  toFilterValue,
  toSortArgs,
} from './collection'
export type {
  CollectionSort,
  GetCollectionProductsArgs,
  RawCollectionPage,
  RawFilter,
  RawFilterValue,
  SortArgs,
} from './collection'

export { COLLECTIONS_QUERY, getCollections, normalizeCollections } from './collections'
export type { RawCollectionSummary } from './collections'

export {
  getPolicy,
  getShopLayout,
  normalizeMenu,
  normalizeShopLayout,
  POLICIES_QUERY,
  SHOP_LAYOUT_QUERY,
} from './shop'
export type { MenuDomains, RawMenuItem, RawPolicies, RawShopLayout } from './shop'

export {
  getPredictiveSearch,
  getSearchResults,
  MIN_SEARCH_LENGTH,
  normalizePredictiveSearch,
  normalizeSearchPage,
  PREDICTIVE_SEARCH_QUERY,
  SEARCH_QUERY,
  toSearchSortArgs,
} from './search'
export type {
  GetSearchResultsArgs,
  RawPredictiveSearch,
  RawSearchPage,
  SearchSort,
  SearchSortArgs,
} from './search'

export {
  getSitemapEntries,
  SITEMAP_COLLECTIONS_QUERY,
  SITEMAP_PRODUCTS_QUERY,
  SITEMAP_REVALIDATE,
} from './sitemap'

export { getRecommendations, normalizeRecommendations, RECOMMENDATIONS_QUERY } from './recommendations'
export type { RawRecommendations } from './recommendations'

export {
  CATALOG_REVALIDATE,
  IMAGE_FIELDS,
  MONEY_FIELDS,
  PRODUCT_CARD_FIELDS,
  toImage,
  toMoney,
  toProductCard,
} from './fragments'
export type { RawImage, RawMoney, RawOption, RawOptionValue, RawProductCard } from './fragments'
