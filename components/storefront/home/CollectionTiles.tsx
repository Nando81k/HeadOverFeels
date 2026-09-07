import Image from 'next/image'
import Link from 'next/link'
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
      <div className="flex items-end justify-between gap-4">
        <Display as="h2" id="home-collections" size="lg">
          Collections
        </Display>
        <Button asChild variant="link">
          <Link href="/collections">All</Link>
        </Button>
      </div>

      <ul className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
        {tiles.map((collection) => (
          <li key={collection.id}>
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
                    className="object-cover transition-transform duration-sf-slow ease-sf-out motion-safe:group-hover:scale-105"
                  />
                ) : null}
                {/* Scrim: the title is bone on whatever photography the merchant uploaded. */}
                <div aria-hidden="true" className="absolute inset-0 bg-ink/25" />
              </div>

              <span className="absolute bottom-4 left-4 font-display text-2xl font-black uppercase tracking-display text-bone [font-stretch:80%]">
                {collection.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  )
}
