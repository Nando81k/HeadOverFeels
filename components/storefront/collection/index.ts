/**
 * Public surface of the collection / product-listing components.
 *
 * The collection PLP, `/search` and the home page all import from here:
 * `import { FilterRail, PlpToolbar } from '@/components/storefront/collection'`.
 */

export { CollectionHeader, type CollectionHeaderProps } from './CollectionHeader'
export {
  CollectionTile,
  COLLECTION_TILE_SIZES,
  type CollectionTileProps,
} from './CollectionTile'
export { FilterRail, type FilterRailProps } from './FilterRail'
export { FilterGroup, HiddenParams, type FilterGroupProps } from './FilterGroup'
export { ActiveFilters, type ActiveFiltersProps } from './ActiveFilters'
export { SortSelect, type SortSelectProps } from './SortSelect'
export { PlpToolbar, type PlpToolbarProps } from './PlpToolbar'
export {
  LoadMoreGrid,
  type LoadMoreGridProps,
  type LoadMorePageInfo,
  type LoadMoreSlice,
  type LoadMoreSource,
} from './LoadMoreGrid'
