'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { CartLine } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'
import { formatMoney } from '@/lib/storefront/money'
import { Badge } from '@/components/storefront/ui/Badge'
import { Price } from '@/components/storefront/ui/Price'
import { QuantityStepper } from '@/components/storefront/ui/QuantityStepper'
import { useCart } from './useCart'

/** Stepper ceiling when neither stock nor a per-order max is known. */
export const DEFAULT_LINE_MAX = 99

/**
 * Highest quantity a line may be stepped to: the lower of tracked stock
 * (`quantityAvailable`, when positive) and the product's `custom.max_per_order`,
 * else `DEFAULT_LINE_MAX`.
 */
export function lineMaxQuantity(line: CartLine): number {
  const caps: number[] = []
  const stock = line.merchandise.quantityAvailable
  if (typeof stock === 'number' && stock > 0) caps.push(stock)
  const maxPerOrder = line.merchandise.product.maxPerOrder
  if (typeof maxPerOrder === 'number' && maxPerOrder > 0) caps.push(maxPerOrder)
  return caps.length > 0 ? Math.min(...caps) : DEFAULT_LINE_MAX
}

/**
 * "Taupe · M": colour first (it is what a shopper scans for), then the rest
 * in Shopify's order; Shopify's placeholder "Default Title" is dropped.
 */
export function formatLineOptions(options: CartLine['merchandise']['selectedOptions']): string {
  const visible = options.filter((option) => option.value !== 'Default Title')
  const isColour = (name: string) => /^colou?r$/i.test(name)
  return [
    ...visible.filter((option) => isColour(option.name)),
    ...visible.filter((option) => !isColour(option.name)),
  ]
    .map((option) => option.value)
    .join(' · ')
}

const SIZES = {
  drawer: { thumb: 'w-[72px]', sizes: '72px', grid: 'grid-cols-[72px_minmax(0,1fr)_auto]' },
  page: { thumb: 'w-24', sizes: '96px', grid: 'grid-cols-[96px_minmax(0,1fr)_auto]' },
} as const

export interface CartLineItemProps {
  line: CartLine
  /** `drawer`: 72px thumbnail. `page`: 96px thumbnail, SKU, per-unit and line total. */
  variant?: 'drawer' | 'page'
  /** A mutation for this line is in flight: dimmed and `aria-busy`. */
  pending?: boolean
  className?: string
}

/**
 * One cart line (mockup screen 01 / states grid): 4:5 thumbnail, title link,
 * options, stepper capped by stock and max-per-order, price, Remove. Sold-out
 * lines swap the stepper for a badge and an inline alert.
 */
export function CartLineItem({ line, variant = 'drawer', pending = false, className }: CartLineItemProps) {
  const { updateLine, removeLine } = useCart()
  const { merchandise, quantity, cost } = line
  const { product } = merchandise
  const title = product.title
  const href = `/products/${product.handle}`
  const image = merchandise.image ?? product.featuredImage
  const options = formatLineOptions(merchandise.selectedOptions)
  const soldOut = !merchandise.availableForSale
  const max = lineMaxQuantity(line)
  const stock = merchandise.quantityAvailable
  const stockCapped = typeof stock === 'number' && stock > 0 && quantity >= stock
  const maxPerOrder = product.maxPerOrder
  const orderCapped = !stockCapped && typeof maxPerOrder === 'number' && maxPerOrder > 0 && quantity >= maxPerOrder
  const size = SIZES[variant]

  return (
    <article
      data-cart-line={line.id}
      data-variant={variant}
      aria-busy={pending || undefined}
      className={cn(
        'grid gap-3.5 border-b border-line py-4 transition-opacity duration-sf-fast ease-sf-out',
        size.grid,
        (soldOut || pending) && 'opacity-60',
        className
      )}
    >
      {/* Duplicate of the title link for pointer users; hidden from AT and the tab order. */}
      <Link href={href} tabIndex={-1} aria-hidden="true" className={cn('block', size.thumb)}>
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-sharp bg-line">
          {image ? (
            <Image src={image.url} alt="" fill sizes={size.sizes} className="object-cover" />
          ) : null}
        </div>
      </Link>

      <div className="flex min-w-0 flex-col gap-0.5">
        <Link
          href={href}
          className="truncate text-sm font-semibold text-ink hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2"
        >
          {title}
        </Link>
        {options || (variant === 'page' && merchandise.sku) ? (
          <p className="text-xs text-ink-mute">
            {options}
            {variant === 'page' && merchandise.sku ? (
              <>
                {options ? ' · ' : null}
                <span className="num">{merchandise.sku}</span>
              </>
            ) : null}
          </p>
        ) : null}
        {variant === 'page' ? (
          <p className="text-xs text-ink-mute">
            <Price amount={cost.perUnit} compareAt={cost.compareAtPerUnit} size="sm" /> each
          </p>
        ) : null}

        <div className="mt-2.5 flex flex-col items-start gap-1.5">
          {soldOut ? (
            <>
              <Badge variant="soldout" />
              <p role="alert" className="text-xs font-medium text-danger">
                Sold out. Remove it to check out.
              </p>
            </>
          ) : (
            <>
              <QuantityStepper
                size="sm"
                min={1}
                max={max}
                value={quantity}
                label={`Quantity, ${title}`}
                onChange={(next) => {
                  void updateLine(line.id, next)
                }}
              />
              {stockCapped ? (
                <p className="text-xs font-medium text-warn">Only {stock} left</p>
              ) : orderCapped ? (
                <p className="text-xs text-ink-mute">Max {maxPerOrder} per order</p>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end justify-between gap-2">
        {variant === 'page' ? (
          <span className="num text-sm font-medium text-ink">{formatMoney(cost.total)}</span>
        ) : (
          <Price amount={cost.perUnit} compareAt={cost.compareAtPerUnit} size="md" className="font-medium" />
        )}
        <button
          type="button"
          aria-label={`Remove ${title}`}
          onClick={() => {
            void removeLine(line.id)
          }}
          className="py-1 text-[11px] uppercase tracking-[0.08em] text-ink-mute underline underline-offset-[3px] transition-colors duration-sf-fast hover:text-ink focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2"
        >
          Remove
        </button>
      </div>
    </article>
  )
}
