import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { CollectionSummary } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'

export interface CollectionTileProps {
  collection: CollectionSummary
  /** Set on the first row so the LCP image is not lazy-loaded. */
  priority?: boolean
  className?: string
}

/** Default sizes for a 3-up tile grid that falls to 2-up then 1-up. */
export const COLLECTION_TILE_SIZES = '(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw'

/**
 * One collection on `/collections` and the home page tiles (spec §5.4):
 * a 4:5 image with the title and, when Shopify has one, a one-line description.
 *
 * The whole tile is a single link, so it is one tab stop and the title is its
 * accessible name.
 */
export function CollectionTile({ collection, priority = false, className }: CollectionTileProps) {
  const { handle, title, image, description } = collection

  return (
    <article
      data-collection-handle={handle}
      className={cn('group relative flex flex-col gap-3', className)}
    >
      <Link
        href={`/collections/${handle}`}
        className="flex flex-col gap-3 rounded-sharp focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2"
      >
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-sharp bg-rose-tint">
          {image ? (
            <Image
              src={image.url}
              alt={image.altText ?? title}
              fill
              sizes={COLLECTION_TILE_SIZES}
              priority={priority}
              className="object-cover transition-transform duration-sf-slow ease-sf-out group-hover:scale-105"
            />
          ) : null}
        </div>
        <h3 className="font-display text-lg font-black uppercase tracking-display text-ink [font-stretch:80%]">
          {title}
        </h3>
      </Link>
      {description ? (
        <p className="line-clamp-2 text-sm text-ink-soft">{description}</p>
      ) : null}
    </article>
  )
}
