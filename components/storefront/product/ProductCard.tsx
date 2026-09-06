'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { ProductCardData } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'
import { Badge } from '@/components/storefront/ui/Badge'
import { Button } from '@/components/storefront/ui/Button'
import { Price } from '@/components/storefront/ui/Price'
import { Skeleton } from '@/components/storefront/ui/Skeleton'
import { SwatchDots } from './SwatchDots'

/** Default responsive sizes for a 4-up grid that falls to 3-up then 2-up. */
export const PRODUCT_CARD_SIZES = '(min-width:1280px) 25vw, (min-width:768px) 33vw, 50vw'

export interface ProductCardProps {
  product: ProductCardData
  /** Set on the first row of a grid so the LCP image is not lazy-loaded. */
  priority?: boolean
  sizes?: string
  /** When provided (and the product is in stock) a quick-add button is shown. */
  onQuickAdd?: (productId: string) => void
  className?: string
}

/**
 * Product card (design spec §5.2): 4:5 image, second image on hover/focus,
 * badges, title, price, colour dots, optional quick-add.
 *
 * Exactly one link per card wraps the image and the title, so the card has a
 * single tab stop and the title is its accessible name. The badges and the
 * quick-add button are siblings of that link inside an overlay pinned to the
 * media box — nesting a button inside an anchor is invalid.
 *
 * `'use client'`: the quick-add handler is a function prop.
 */
export function ProductCard({
  product,
  priority = false,
  sizes = PRODUCT_CARD_SIZES,
  onQuickAdd,
  className,
}: ProductCardProps) {
  const { id, handle, title, image, hoverImage, price, compareAtPrice, swatches, badges } = product
  const href = `/products/${handle}`
  const soldOut = badges.includes('soldout') || !product.availableForSale
  const showQuickAdd = Boolean(onQuickAdd) && !soldOut

  return (
    <article
      data-product-handle={handle}
      className={cn('group relative flex flex-col gap-3', className)}
    >
      <div className="relative">
        <Link
          href={href}
          className="block rounded-sharp focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2"
        >
          <div
            data-soldout={soldOut ? '' : undefined}
            className={cn(
              'relative aspect-[4/5] overflow-hidden rounded-sharp bg-line',
              soldOut && 'opacity-60'
            )}
          >
            {image ? (
              <Image
                src={image.url}
                alt={image.altText ?? title}
                fill
                sizes={sizes}
                priority={priority}
                className="object-cover"
              />
            ) : (
              <div aria-hidden="true" className="absolute inset-0 bg-line" />
            )}
            {image && hoverImage ? (
              <Image
                src={hoverImage.url}
                alt=""
                aria-hidden="true"
                data-hover=""
                fill
                sizes={sizes}
                className="absolute inset-0 object-cover opacity-0 transition-opacity duration-sf-base ease-sf-out group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none"
              />
            ) : null}
          </div>
          <h3 className="mt-3 text-sm font-medium text-ink">{title}</h3>
        </Link>

        {/* Pinned to the media box only (same aspect ratio), so the quick-add
            button sits on the image rather than under the title. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 aspect-[4/5]">
          {badges.length > 0 ? (
            <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
              {badges.map((badge) => (
                <Badge key={badge} variant={badge} />
              ))}
            </div>
          ) : null}

          {showQuickAdd && onQuickAdd ? (
            <Button
              size="sm"
              variant="ink"
              aria-label={`Quick add ${title}`}
              onClick={() => onQuickAdd(id)}
              className="pointer-events-auto absolute inset-x-2 bottom-2 transition duration-sf-fast ease-sf-out md:translate-y-1 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 motion-reduce:transition-none"
            >
              Quick add
            </Button>
          ) : null}
        </div>
      </div>

      <Price amount={price} compareAt={compareAtPrice} size="sm" />
      <SwatchDots swatches={swatches} />
    </article>
  )
}

export interface ProductCardSkeletonProps {
  className?: string
}

/** Placeholder with the same rhythm as a real card (image, title, price). */
export function ProductCardSkeleton({ className }: ProductCardSkeletonProps) {
  return (
    <div data-product-card-skeleton="" className={cn('flex flex-col gap-3', className)}>
      <Skeleton className="aspect-[4/5] w-full" />
      <Skeleton className="h-3 w-3/5" />
      <Skeleton className="h-3 w-2/5" />
    </div>
  )
}
