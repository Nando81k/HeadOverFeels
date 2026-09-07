import Link from 'next/link'
import { ProductGrid } from '@/components/storefront/product/ProductGrid'
import { Button } from '@/components/storefront/ui/Button'
import { Section } from '@/components/storefront/ui/Section'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'
import type { ProductCardData } from '@/lib/shopify/types'

export interface DropSpotlightProps {
  products: ProductCardData[]
  className?: string
}

/**
 * The one inked band on the home page (design spec §5.4 row `/`), shown only
 * when the `drops` collection actually has products.
 *
 * The cards sit on a bone panel inside the ink section: `ProductCard` paints
 * ink type and `bg-line` placeholders, which would disappear against the ink
 * surface. Phase 5 adds the countdown state machine around this block.
 */
export function DropSpotlight({ products, className }: DropSpotlightProps) {
  if (products.length === 0) return null

  return (
    <Section tone="ink" aria-labelledby="home-drop" className={className}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-4">
          <Eyebrow className="text-bone/70">Drop</Eyebrow>
          <Display as="h2" id="home-drop" size="lg" className="text-bone">
            Drop 01
          </Display>
          <p className="max-w-md text-sm text-bone/80">Limited run. Early access for Gold.</p>
        </div>

        <Button asChild variant="signal">
          <Link href="/drops">See the drop</Link>
        </Button>
      </div>

      <div data-drop-panel="" className="mt-10 rounded-sharp bg-bone p-4 text-ink">
        <ProductGrid products={products} columns={4} />
      </div>
    </Section>
  )
}
