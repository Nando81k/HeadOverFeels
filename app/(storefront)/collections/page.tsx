import type { Metadata } from 'next'
import { hasShopifyEnv } from '@/lib/shopify/env'
import { getCollections } from '@/lib/shopify/queries'
import { CatalogUnavailable } from '@/components/storefront/CatalogUnavailable'
import { CollectionTile } from '@/components/storefront/collection'
import { Section } from '@/components/storefront/ui/Section'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'

/** Collections change with merchandising, not with traffic. */
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Collections',
  description: 'Every Head Over Feels collection, from core staples to limited drops.',
}

/**
 * Shopify's automatic `frontpage` collection is a theme fixture, not a
 * customer-facing category, so it never appears in the index.
 */
const HIDDEN_HANDLES = new Set(['frontpage'])

/** Number of tiles rendered eagerly (roughly the first row above the fold). */
const PRIORITY_TILES = 3

export default async function CollectionsIndexPage() {
  const configured = hasShopifyEnv()
  const collections = configured
    ? (await getCollections()).filter((collection) => !HIDDEN_HANDLES.has(collection.handle))
    : []

  return (
    <>
      <Section>
        <div className="flex max-w-3xl flex-col gap-4">
          <Eyebrow>Shop</Eyebrow>
          <Display as="h1" size="lg">
            Collections
          </Display>
          <p className="text-ink-soft">
            Core staples, seasonal cuts and limited drops — every category in one place.
          </p>
        </div>
      </Section>

      {configured ? (
        <Section>
          {collections.length > 0 ? (
            <div className="grid grid-cols-1 gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {collections.map((collection, index) => (
                <CollectionTile
                  key={collection.id}
                  collection={collection}
                  priority={index < PRIORITY_TILES}
                />
              ))}
            </div>
          ) : (
            <p role="status" className="text-ink-mute">
              No collections yet. Check back soon.
            </p>
          )}
        </Section>
      ) : (
        <CatalogUnavailable />
      )}
    </>
  )
}
