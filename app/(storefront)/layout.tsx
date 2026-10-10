import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { CartProvider } from '@/components/storefront/cart/CartProvider'
import { StorefrontShell } from '@/components/storefront/layout/StorefrontShell'
import { hasShopifyEnv } from '@/lib/shopify/env'
import { FREE_SHIPPING_COPY } from '@/lib/storefront/shipping'

/**
 * Storefront-wide defaults. `template` lets every page set only its own title;
 * `metadataBase` makes the relative OG/canonical URLs the pages emit absolute.
 *
 * The base URL is inlined here rather than taken from `lib/storefront/seo.ts`
 * (`siteUrl()`), which Task 7 adds — swap this for that helper once it lands.
 */
export const metadata: Metadata = {
  title: {
    default: 'Head Over Feels',
    template: '%s · Head Over Feels',
  },
  description:
    'Heavyweight streetwear, honest fits, small runs. Earn Care Points on every order.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'https://headoverfeels.com'),
}

/**
 * Route-group layout for the rebuilt storefront. It nests inside the root
 * `app/layout.tsx` (html/body/Providers), which is left untouched.
 *
 * `CartProvider` loads the cart on the client after mount, so this layout never
 * reads the cart cookie and catalog pages stay ISR-cacheable. Without Shopify
 * env it stays `unavailable` and never calls the cart actions.
 */
export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return (
    <CartProvider available={hasShopifyEnv()}>
      <StorefrontShell announcement={FREE_SHIPPING_COPY}>{children}</StorefrontShell>
    </CartProvider>
  )
}
