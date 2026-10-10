import type { Metadata } from 'next'
import { getCartAction } from '@/app/(storefront)/_actions/cart'
import { CatalogUnavailable } from '@/components/storefront/CatalogUnavailable'
import { CartPage } from '@/components/storefront/cart/CartPage'
import { hasShopifyEnv } from '@/lib/shopify/env'

/**
 * The one storefront route that reads the cart cookie while rendering, so it
 * is never cached (Phase 3 plan, cross-cutting note 6).
 */
export const dynamic = 'force-dynamic'

/** Carts are per-visitor and thin; keep them out of the index but follow links. */
export const metadata: Metadata = {
  title: 'Cart',
  robots: { index: false, follow: true },
}

export default async function CartRoute() {
  if (!hasShopifyEnv()) {
    return (
      <CatalogUnavailable
        title="The cart is warming up"
        message="Your cart will be here as soon as the Shopify connection is live."
      />
    )
  }

  const cart = await getCartAction()

  // The layout already mounts the CartProvider; the page seeds it with the
  // cookie's cart so the header badge and the drawer reflect edits made here.
  return <CartPage initialCart={cart} />
}
