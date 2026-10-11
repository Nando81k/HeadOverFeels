import * as React from 'react'
import type { ProductCardData } from '@/lib/shopify/types'
import { ProductCard } from '@/components/storefront/product/ProductCard'
import { Section } from '@/components/storefront/ui/Section'
import { Display } from '@/components/storefront/ui/Typography'

/** Cards shown in the rail; `productRecommendations` returns more than we want. */
const MAX_PRODUCTS = 4

/** Sizes for a 2-up (mobile) / 4-up (desktop) rail. */
const RAIL_SIZES = '(min-width:768px) 25vw, 50vw'

export interface RecommendationsRailProps {
  products: ProductCardData[]
  /** Heading. Defaults to the spec's "Complete the look". */
  title?: string
}

/**
 * "Complete the look" rail under the PDP (spec §5.4). Renders nothing when
 * Shopify has no complementary products yet — the normal answer on a young
 * store.
 */
export function RecommendationsRail({
  products,
  title = 'Complete the look',
}: RecommendationsRailProps) {
  if (products.length === 0) return null

  return (
    <Section aria-label={title}>
      <Display as="h2" size="md">
        {title}
      </Display>
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {products.slice(0, MAX_PRODUCTS).map((product) => (
          <ProductCard key={product.id} product={product} sizes={RAIL_SIZES} />
        ))}
      </div>
    </Section>
  )
}
