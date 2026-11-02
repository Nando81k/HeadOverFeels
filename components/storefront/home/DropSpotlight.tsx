import Link from 'next/link'
import { Reveal } from '@/components/storefront/motion/Reveal'
import { ProductGrid } from '@/components/storefront/product/ProductGrid'
import { Button } from '@/components/storefront/ui/Button'
import { Section } from '@/components/storefront/ui/Section'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'
import type { ProductCardData } from '@/lib/shopify/types'
import { dropCopy, type DropView } from '@/lib/storefront/drops'
import { DropCountdown } from '@/components/storefront/drops/DropCountdown'

export interface DropSpotlightProps {
  products: ProductCardData[]
  /**
   * State of the drop being spotlighted (Phase 5). `null`/omitted keeps the
   * plain "Limited run" copy; `upcoming` swaps in the opening date and a
   * countdown, `live` the closing countdown when there is an end.
   */
  view?: DropView | null
  className?: string
}

/**
 * The one inked band on the home page (design spec §5.4 row `/`), shown only
 * when the `drops` collection actually has products.
 *
 * The cards sit on a bone panel inside the ink section: `ProductCard` paints
 * ink type and `bg-line` placeholders, which would disappear against the ink
 * surface. The state copy and countdown come from `lib/storefront/drops.ts`.
 */
export function DropSpotlight({ products, view = null, className }: DropSpotlightProps) {
  if (products.length === 0) return null

  const copy = view ? dropCopy(view) : null
  const target = view?.state === 'live' ? view.end : view?.start ?? null
  const ticking = Boolean(view && view.nextTransitionIn !== null && view.state !== 'ended' && target)

  return (
    <Section tone="ink" aria-labelledby="home-drop" className={className}>
      <Reveal className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-4">
          <Eyebrow className="text-bone/70">{copy?.eyebrow ?? 'Drop'}</Eyebrow>
          <Display as="h2" id="home-drop" size="lg" className="text-bone">
            Drop 01
          </Display>
          <p className="max-w-md text-sm text-bone/80">
            {copy ? `${copy.headline}${copy.detail ? ` · ${copy.detail}` : ''}` : 'Limited run. Early access for Gold.'}
          </p>
          {ticking && target ? (
            <DropCountdown
              target={target.toISOString()}
              label={view?.state === 'live' ? 'Closes in' : 'Opens in'}
              className="text-bone [&_.text-ink-mute]:text-bone/70"
            />
          ) : null}
        </div>

        <Button asChild variant="signal">
          <Link href="/drops">{view?.state === 'upcoming' ? 'Preview the drop' : 'See the drop'}</Link>
        </Button>
      </Reveal>

      <Reveal variant="zoom" delay={120} data-drop-panel="" className="mt-10 rounded-sharp bg-bone p-4 text-ink">
        <ProductGrid products={products} columns={4} />
      </Reveal>
    </Section>
  )
}
