/**
 * Wishlist UI (Phase 4, Task 7).
 *
 * `WishlistProvider` is mounted once by the storefront layout (no props);
 * `WishlistButton` hides itself where no provider is mounted.
 */
export { WishlistProvider, type WishlistActions, type WishlistProviderProps } from './WishlistProvider'
export {
  useWishlist,
  useWishlistOptional,
  type WishlistContextValue,
  type WishlistStatus,
} from './useWishlist'
export { HeartIcon, WishlistButton, type WishlistButtonProps } from './WishlistButton'
export {
  WishlistCard,
  WishlistGrid,
  WishlistGridSkeleton,
  cardBadge,
  cardHref,
  cardOptionsLabel,
  cardState,
  type WishlistCardProps,
  type WishlistCardState,
  type WishlistGridProps,
} from './WishlistGrid'
export { WishlistPage, CARDS_DEBOUNCE_MS, shareText } from './WishlistPage'
