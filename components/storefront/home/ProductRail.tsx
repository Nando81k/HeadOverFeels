import Link from 'next/link'
import { ProductCard } from '@/components/storefront/product/ProductCard'
import { Button } from '@/components/storefront/ui/Button'
import { Container } from '@/components/storefront/ui/Container'
import { Section } from '@/components/storefront/ui/Section'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'
import type { ProductCardData } from '@/lib/shopify/types'

/** Cards in a rail are narrower than grid cards, so they need their own `sizes`. */
const RAIL_CARD_SIZES = '(min-width:1024px) 23vw, (min-width:640px) 40vw, 70vw'

export interface ProductRailProps {
  title: string
  /** Where the "shop all" link goes — usually the collection behind the rail. */
  href: string
  hrefLabel?: string
  products: ProductCardData[]
  eyebrow?: string
  className?: string
}

/** Stable heading id so the section can be labelled without a client hook. */
function railId(title: string): string {
  return `home-rail-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`
}

/**
 * Horizontally scrolling product rail (design spec §5.4 row `/`): "New in" and
 * "Best sellers".
 *
 * The list is full-bleed with its own gutter (`Section bleed` + `px-gutter`) so
 * cards scroll off the viewport edge instead of stopping at the container, and
 * snaps card-by-card. Renders nothing when the collection came back empty.
 */
export function ProductRail({
  title,
  href,
  hrefLabel = 'Shop all',
  products,
  eyebrow,
  className,
}: ProductRailProps) {
  if (products.length === 0) return null

  const headingId = railId(title)

  return (
    <Section tone="bone" bleed aria-labelledby={headingId} className={className}>
      <Container className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          <Display as="h2" id={headingId} size="lg">
            {title}
          </Display>
        </div>
        <Button asChild variant="link">
          <Link href={href}>{hrefLabel}</Link>
        </Button>
      </Container>

      <ul className="mt-8 flex snap-x snap-mandatory gap-3 overflow-x-auto px-gutter [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {products.map((product) => (
          <li key={product.id} className="w-[70vw] shrink-0 snap-start sm:w-[40vw] lg:w-[23%]">
            <ProductCard product={product} sizes={RAIL_CARD_SIZES} />
          </li>
        ))}
      </ul>
    </Section>
  )
}
