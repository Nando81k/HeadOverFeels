/**
 * Dynamic sitemap.
 *
 * Handles come from the Shopify Storefront API (`getSitemapEntries()`), not
 * from Prisma — the catalog lives in Shopify as of the Phase 2 rebuild. The
 * static routes are always emitted, so an unconfigured or failing store still
 * produces a valid sitemap rather than a 500.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */

import type { MetadataRoute } from 'next'
import { hasShopifyEnv } from '@/lib/shopify/env'
import { getSitemapEntries } from '@/lib/shopify/queries/sitemap'

// Shopify handles change without a deploy, so the sitemap is never prerendered.
export const dynamic = 'force-dynamic'

/**
 * Read per call, not once at import: this route is `force-dynamic`, so the
 * deployed env is what matters, and tests can vary it.
 */
function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL ?? 'https://headoverfeels.com').replace(/\/+$/, '')
}

/** Shopify's own handles for the four legal pages (`/policies/[handle]`). */
const POLICY_HANDLES = [
  'privacy-policy',
  'terms-of-service',
  'refund-policy',
  'shipping-policy',
] as const

/**
 * Collections that must not get their own entry: `frontpage` is Shopify's
 * hidden default, and `all` is already listed as a static route.
 */
const SKIPPED_COLLECTIONS = new Set(['frontpage', 'all'])

function url(path: string): string {
  return `${baseUrl()}${path}`
}

function staticRoutes(now: Date): MetadataRoute.Sitemap {
  return [
    { url: url('/'), lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: url('/collections'), lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: url('/collections/all'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: url('/drops'), lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: url('/about'), lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: url('/contact'), lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: url('/loyalty'), lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    ...POLICY_HANDLES.map((handle) => ({
      url: url(`/policies/${handle}`),
      lastModified: now,
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    })),
  ]
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const statics = staticRoutes(now)

  // No Storefront tokens (preview envs, a fresh clone) → the static shape is
  // still correct and worth serving.
  if (!hasShopifyEnv()) return statics

  try {
    const { products, collections } = await getSitemapEntries()

    const productRoutes: MetadataRoute.Sitemap = products.map((entry) => ({
      url: url(`/products/${entry.handle}`),
      lastModified: new Date(entry.updatedAt),
      changeFrequency: 'weekly',
      priority: 0.7,
    }))

    const collectionRoutes: MetadataRoute.Sitemap = collections
      .filter((entry) => !SKIPPED_COLLECTIONS.has(entry.handle))
      .map((entry) => ({
        url: url(`/collections/${entry.handle}`),
        lastModified: new Date(entry.updatedAt),
        changeFrequency: 'weekly',
        priority: 0.8,
      }))

    return [...statics, ...productRoutes, ...collectionRoutes]
  } catch (error) {
    // A sitemap is not worth a 500: log and serve what we know.
    console.warn(
      `[sitemap] Shopify entries unavailable, serving static routes only: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
    return statics
  }
}
