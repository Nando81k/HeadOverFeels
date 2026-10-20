'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { ProductCardVariant } from '@/lib/shopify/queries/variants'
import { cn } from '@/lib/storefront/cn'
import { Badge } from '@/components/storefront/ui/Badge'
import { Button } from '@/components/storefront/ui/Button'
import { IconButton } from '@/components/storefront/ui/IconButton'
import { Price } from '@/components/storefront/ui/Price'
import { ProductPlaceholder } from '@/components/storefront/ui/ProductPlaceholder'
import { Skeleton } from '@/components/storefront/ui/Skeleton'

/** Same 4-up → 3-up → 2-up rhythm as the catalog grid. */
export const WISHLIST_CARD_SIZES = '(min-width:1280px) 25vw, (min-width:768px) 33vw, 50vw'

const GRID_CLASS = 'grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 xl:grid-cols-4'

/** Shopify's placeholder option on single-variant products. */
const DEFAULT_OPTION_VALUE = 'Default Title'

/** Tag that marks a drop product (same convention as the catalog badges). */
const DROP_TAG = 'drop'

export type WishlistCardState = 'addable' | 'drop' | 'soldout'

/** Sold out wins over drop, drop over plain — the action button follows this. */
export function cardState(card: ProductCardVariant): WishlistCardState {
  if (!card.availableForSale) return 'soldout'
  if (card.product.tags.some((tag) => tag.toLowerCase() === DROP_TAG)) return 'drop'
  return 'addable'
}

/** The one merchandising pill a card shows, if any. */
export function cardBadge(card: ProductCardVariant): 'sale' | 'drop' | 'soldout' | null {
  const state = cardState(card)
  if (state === 'soldout') return 'soldout'
  if (card.compareAtPrice) return 'sale'
  if (state === 'drop') return 'drop'
  return null
}

/** "M / Taupe"; empty for a single-variant product's placeholder option. */
export function cardOptionsLabel(card: ProductCardVariant): string {
  return card.selectedOptions
    .map((option) => option.value)
    .filter((value) => value && value !== DEFAULT_OPTION_VALUE)
    .join(' / ')
}

export function cardHref(card: ProductCardVariant): string {
  return `/products/${card.product.handle}`
}

export interface WishlistCardProps {
  card: ProductCardVariant
  onRemove(card: ProductCardVariant): void
  onAddToCart(card: ProductCardVariant): void
  /** The add for this card is in flight. */
  pending?: boolean
  priority?: boolean
  className?: string
}

/**
 * One saved variant (mockup board 07): image with the remove × and a pill over
 * it, title, options, price, then the one action its state allows — "Add to
 * cart", "Notify me" (drop, links to the PDP) or a disabled "Back in stock alert"
 * (Phase 5).
 *
 * As on `ProductCard`, exactly one link wraps the image and the title; the
 * buttons are siblings in an overlay so no control nests inside the anchor.
 */
export function WishlistCard({
  card,
  onRemove,
  onAddToCart,
  pending = false,
  priority = false,
  className,
}: WishlistCardProps) {
  const { title: productTitle, handle } = card.product
  const image = card.image ?? card.product.featuredImage
  const state = cardState(card)
  const badge = cardBadge(card)
  const options = cardOptionsLabel(card)
  const href = cardHref(card)

  return (
    <li
      data-wishlist-card=""
      data-variant-id={card.id}
      data-product-handle={handle}
      data-state={state}
      className={cn('group relative flex flex-col gap-3', className)}
    >
      <div className="relative">
        <Link
          href={href}
          className="block rounded-sharp focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2"
        >
          <div
            className={cn(
              'relative aspect-[4/5] overflow-hidden rounded-sharp bg-line',
              state === 'soldout' && 'opacity-60'
            )}
          >
            {image ? (
              <Image
                src={image.url}
                alt={image.altText ?? productTitle}
                fill
                sizes={WISHLIST_CARD_SIZES}
                priority={priority}
                className="object-cover transition-transform duration-[900ms] ease-sf-out motion-safe:group-hover:scale-[1.06]"
              />
            ) : (
              <ProductPlaceholder seed={handle} />
            )}
          </div>
          <h3 className="mt-3 text-sm font-medium text-ink">{productTitle}</h3>
        </Link>

        <div className="pointer-events-none absolute inset-x-0 top-0 aspect-[4/5]">
          {badge ? (
            <div className="absolute left-2 top-2">
              <Badge variant={badge} />
            </div>
          ) : null}
          <IconButton
            label={`Remove ${productTitle} from wishlist`}
            variant="ghost"
            onClick={() => onRemove(card)}
            className="pointer-events-auto absolute right-1 top-1 bg-bone/80 text-ink hover:bg-bone"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            >
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </IconButton>
        </div>
      </div>

      {options ? <p className="-mt-2 text-xs text-ink-mute">{options}</p> : null}
      <Price amount={card.price} compareAt={card.compareAtPrice} size="sm" />

      {state === 'addable' ? (
        <Button
          size="sm"
          variant="ink"
          loading={pending}
          onClick={() => onAddToCart(card)}
          className="w-full"
        >
          {pending ? 'Adding…' : 'Add to cart'}
        </Button>
      ) : state === 'drop' ? (
        <Button asChild size="sm" variant="outline" className="w-full">
          <Link href={href}>Notify me</Link>
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled
          title="Coming in Phase 5"
          data-phase="5"
          className="w-full"
        >
          Back in stock alert
        </Button>
      )}
    </li>
  )
}

export interface WishlistGridProps {
  cards: ProductCardVariant[]
  onRemove(card: ProductCardVariant): void
  onAddToCart(card: ProductCardVariant): void
  /** Variant whose add is in flight, if any. */
  pendingVariantId?: string | null
  className?: string
}

/** The saved cards, 4-up (mockup board 07). */
export function WishlistGrid({
  cards,
  onRemove,
  onAddToCart,
  pendingVariantId = null,
  className,
}: WishlistGridProps) {
  return (
    <ul data-wishlist-grid="" className={cn(GRID_CLASS, className)}>
      {cards.map((card, index) => (
        <WishlistCard
          key={card.id}
          card={card}
          onRemove={onRemove}
          onAddToCart={onAddToCart}
          pending={pendingVariantId === card.id}
          priority={index < 4}
        />
      ))}
    </ul>
  )
}

export interface WishlistGridSkeletonProps {
  count?: number
  className?: string
}

/** Placeholders with a card's rhythm (image, title, price, button). */
export function WishlistGridSkeleton({ count = 4, className }: WishlistGridSkeletonProps) {
  return (
    <div data-wishlist-grid-skeleton="" aria-hidden="true" className={cn(GRID_CLASS, className)}>
      {Array.from({ length: Math.max(0, count) }, (_, index) => (
        <div key={index} className="flex flex-col gap-3">
          <Skeleton className="aspect-[4/5] w-full" />
          <Skeleton className="h-3 w-3/5" />
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  )
}
