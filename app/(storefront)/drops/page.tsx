import type { Metadata } from 'next'
import Link from 'next/link'
import { hasShopifyEnv } from '@/lib/shopify/env'
import { getCollectionProducts } from '@/lib/shopify/queries'
import { CatalogUnavailable } from '@/components/storefront/CatalogUnavailable'
import { ProductGrid } from '@/components/storefront/product/ProductGrid'
import { Button } from '@/components/storefront/ui/Button'
import { Section } from '@/components/storefront/ui/Section'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'

/** Same cadence as the rest of the catalog. */
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Drops',
  description: 'Limited runs from Head Over Feels. When they are gone, they are gone.',
}

/** The Shopify collection every drop product belongs to. */
const DROPS_HANDLE = 'drops'

/**
 * Shown both when the `drops` collection is empty and when Shopify does not
 * have one at all — an unknown handle here is a merchandising state, not a 404
 * (Phase 2 plan, route map row `/drops`).
 */
function NoDrops() {
  return (
    <div className="flex max-w-xl flex-col items-start gap-6">
      <p role="status" className="text-ink-soft">
        No drops scheduled. Join the newsletter to hear first.
      </p>
      <Button asChild variant="outline">
        <Link href="/#newsletter">Join the newsletter</Link>
      </Button>
    </div>
  )
}

export default async function DropsPage() {
  const configured = hasShopifyEnv()
  const page = configured ? await getCollectionProducts({ handle: DROPS_HANDLE, first: 24 }) : null
  const products = page?.products ?? []

  return (
    <>
      <Section tone="ink">
        <div className="flex max-w-3xl flex-col gap-4">
          <Eyebrow className="text-bone/70">Limited runs</Eyebrow>
          <Display as="h1" size="lg">
            Drops
          </Display>
          <p className="text-bone/80">
            Small batches, made once. Sign up to get the window before it opens.
          </p>
        </div>
      </Section>

      {configured ? (
        <Section>{products.length > 0 ? <ProductGrid products={products} /> : <NoDrops />}</Section>
      ) : (
        <CatalogUnavailable />
      )}
    </>
  )
}
