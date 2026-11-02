import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Reveal } from '@/components/storefront/motion/Reveal'
import { ProductPlaceholder } from '@/components/storefront/ui/ProductPlaceholder'
import { Button } from '@/components/storefront/ui/Button'
import { Section } from '@/components/storefront/ui/Section'
import { Display } from '@/components/storefront/ui/Typography'
import type { CollectionSummary } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'

/** The home page merchandises three collections; anything past that is dropped. */
export const COLLECTION_TILE_LIMIT = 3

export interface CollectionTilesProps {
  collections: CollectionSummary[]
  className?: string
}

/**
 * Three-up collection tiles (design spec §5.4 row `/`). Each tile is one link
 * wrapping the image and the title, so the row is three tab stops.
 *
 * Renders nothing when there is nothing to show — an empty grid with a heading
 * reads as a broken page.
 */
export function CollectionTiles({ collections, className }: CollectionTilesProps) {
  const tiles = collections.slice(0, COLLECTION_TILE_LIMIT)
  if (tiles.length === 0) return null

  return (
    <Section tone="bone" aria-labelledby="home-collections" className={className}>
      <Reveal className="flex items-end justify-between gap-4">
        <Display as="h2" id="home-collections" size="lg">
          Collections
        </Display>
        <Button asChild variant="link">
          <Link href="/collections">All</Link>
        </Button>
      </Reveal>

      <ul className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
        {tiles.map((collection, index) => (
          <Reveal as="li" key={collection.id} delay={index * 90}>
            <Link
              href={`/collections/${collection.handle}`}
              className={cn(
                'group relative block overflow-hidden rounded-sharp',
                'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2'
              )}
            >
              <div className="relative aspect-[4/5] w-full bg-line">
                {collection.image ? (
                  <Image
                    src={collection.image.url}
                    alt={collection.image.altText ?? collection.title}
                    fill
                    sizes="(min-width:768px) 33vw, 100vw"
                    className="object-cover transition-transform duration-[900ms] ease-sf-out motion-safe:group-hover:scale-105"
                  />
                ) : (
                  <ProductPlaceholder seed={collection.handle} tone="rose" />
                )}
                {/* Scrim: the title is bone on whatever photography the merchant uploaded.
                    It deepens on hover so the title and the arrow read over a lighter still. */}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-ink/25 transition-colors duration-sf-slow ease-sf-out group-hover:bg-ink/40"
                />
              </div>

              <span className="absolute bottom-4 left-4 flex items-center gap-3 text-bone">
                <span className="font-display text-2xl font-black uppercase tracking-display transition-transform duration-sf-slow ease-sf-out motion-safe:group-hover:-translate-y-1 [font-stretch:80%]">
                  {collection.title}
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="size-6 -translate-x-2 opacity-0 transition-[transform,opacity] duration-sf-slow ease-sf-out group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
                />
              </span>
            </Link>
          </Reveal>
        ))}
      </ul>
    </Section>
  )
}
