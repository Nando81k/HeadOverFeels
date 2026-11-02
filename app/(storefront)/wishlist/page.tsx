import type { Metadata } from 'next'
import { CatalogUnavailable } from '@/components/storefront/CatalogUnavailable'
import { WishlistPage } from '@/components/storefront/wishlist/WishlistPage'
import { hasShopifyEnv } from '@/lib/shopify/env'

/**
 * `/wishlist` (Phase 4, Task 7). The route reads nothing: a guest's entries live
 * in localStorage and a customer's arrive through `WishlistProvider` after
 * mount, so the page itself is static and the card data is looked up on the
 * client with `wishlistCardsAction`.
 */

/** Per-visitor and thin; keep it out of the index but follow links. */
export const metadata: Metadata = {
  title: 'Wishlist',
  robots: { index: false, follow: true },
}

export default function WishlistRoute() {
  if (!hasShopifyEnv()) {
    return (
      <CatalogUnavailable
        title="Your wishlist is warming up"
        message="Saved items will show here as soon as the Shopify connection is live."
      />
    )
  }

  return <WishlistPage />
}
