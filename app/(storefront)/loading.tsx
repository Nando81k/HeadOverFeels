import { Section } from '@/components/storefront/ui/Section'
import { ProductGrid } from '@/components/storefront/product/ProductGrid'

/**
 * Route-group loading UI. Every storefront page is grid-shaped above the fold,
 * so a card skeleton grid is the honest placeholder for all of them.
 */
export default function StorefrontLoading() {
  return (
    <Section aria-busy="true" aria-label="Loading">
      <ProductGrid products={[]} loading skeletonCount={8} />
    </Section>
  )
}
