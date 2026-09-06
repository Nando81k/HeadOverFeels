import * as React from 'react'
import { Footer } from '@/components/storefront/layout/Footer'
import { Header } from '@/components/storefront/layout/Header'
import { getShopLayout } from '@/lib/shopify/queries/shop'
import type { ShopLayoutData } from '@/lib/shopify/types'

/**
 * What the shell renders when Shopify cannot be reached — a missing
 * `SHOPIFY_*` env throws a `ShopifyError` before a request is even made, which
 * is the normal state of a CI/preview box with no store credentials.
 *
 * It mirrors the `main-menu` seeded in Task 0 so the chrome is still navigable.
 */
export const FALLBACK_LAYOUT: ShopLayoutData = {
  name: 'Head Over Feels',
  description: null,
  menu: [
    { id: 'fallback-shop', title: 'Shop', url: '/collections/all', items: [] },
    { id: 'fallback-collections', title: 'Collections', url: '/collections', items: [] },
    { id: 'fallback-drops', title: 'Drops', url: '/drops', items: [] },
    { id: 'fallback-loyalty', title: 'Loyalty', url: '/loyalty', items: [] },
    { id: 'fallback-about', title: 'About', url: '/about', items: [] },
  ],
  policies: [],
}

export type LayoutSource = 'shopify' | 'fallback'

/** Warn once per process: every page render would otherwise repeat it. */
let hasWarned = false

async function loadLayout(): Promise<{ layout: ShopLayoutData; source: LayoutSource }> {
  try {
    return { layout: await getShopLayout(), source: 'shopify' }
  } catch (error) {
    if (!hasWarned) {
      hasWarned = true
      // Message only — a ShopifyError can carry request detail, and nothing
      // about the token ever belongs in a log line.
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[storefront] shop layout unavailable, using fallback chrome: ${message}`)
    }
    return { layout: FALLBACK_LAYOUT, source: 'fallback' }
  }
}

export interface StorefrontShellProps {
  children: React.ReactNode
  /** Cart line-item count for the header badge. Wired to the real cart in Phase 3. */
  cartCount?: number
  /** Let the header sit transparently over a hero until the page scrolls. */
  transparentHeader?: boolean
  /** Optional promo strip above the header. */
  announcement?: React.ReactNode
}

/**
 * Chrome for every `app/(storefront)` route: header, page, footer, all inside
 * the `[data-surface="storefront"]` scope that `styles/storefront/base.css`
 * paints. Nav and policies come from Shopify (`getShopLayout()`); any failure
 * degrades to `FALLBACK_LAYOUT` rather than taking the page down with it.
 */
export async function StorefrontShell({
  children,
  cartCount = 0,
  transparentHeader = false,
  announcement,
}: StorefrontShellProps) {
  const { layout, source } = await loadLayout()

  return (
    <div
      data-surface="storefront"
      data-layout-source={source}
      className="flex min-h-screen flex-col bg-bone font-body text-ink"
    >
      <Header
        menu={layout.menu}
        cartCount={cartCount}
        transparent={transparentHeader}
        announcement={announcement}
      />

      <main id="main-content" className="flex-1">
        {children}
      </main>

      <Footer
        menu={layout.menu}
        policies={layout.policies}
        shopName={layout.name || FALLBACK_LAYOUT.name}
      />
    </div>
  )
}
