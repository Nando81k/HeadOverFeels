'use client'

import * as React from 'react'
import type { ProductDetail, ProductVariant } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'
import { toNumber } from '@/lib/storefront/money'
import { Button } from '@/components/storefront/ui/Button'
import { Price } from '@/components/storefront/ui/Price'
import { QuantityStepper } from '@/components/storefront/ui/QuantityStepper'

/** Quantity ceiling when Shopify does not report stock for the variant. */
const DEFAULT_MAX_QUANTITY = 10

/** Free-shipping threshold shown under the button (spec §5.4). */
const FREE_SHIPPING_COPY = 'Free US shipping over $75'

export interface AddToCartButtonProps {
  /** Renders the "Sold out" label in the outline variant. */
  soldOut?: boolean
  disabled?: boolean
  /** Marks the button as waiting for the Phase 3 cart action (`data-phase="3"`). */
  awaitingCart?: boolean
  className?: string
}

/**
 * The submit control of the buy box. Exported on its own so Phase 3 can reuse
 * it inside a `useFormStatus` wrapper without re-deriving the labels.
 */
export function AddToCartButton({
  soldOut = false,
  disabled = false,
  awaitingCart = false,
  className,
}: AddToCartButtonProps) {
  return (
    <Button
      type="submit"
      size="lg"
      variant={soldOut ? 'outline' : 'ink'}
      disabled={disabled || soldOut}
      data-phase={awaitingCart ? '3' : undefined}
      className={cn('w-full', className)}
    >
      {soldOut ? 'Sold out' : 'Add to cart'}
    </Button>
  )
}

export interface AddToCartPanelProps {
  product: ProductDetail
  /** Resolved variant from `selectVariant`; null when nothing matches the URL. */
  selected: ProductVariant | null
  /** True when every option has a value — a partial selection is not buyable. */
  complete: boolean
  /**
   * Phase 3 seam: the cart Server Action. The form posts `variantId` and
   * `quantity`; until it is passed the button renders disabled with
   * `data-phase="3"`.
   */
  action?: (formData: FormData) => void | Promise<void>
  /** Form id — the sticky bar scrolls to it. Defaults to `buy-box`. */
  id?: string
}

/**
 * Price, quantity and add-to-cart for the selected variant (spec §5.4).
 *
 * `'use client'`: the quantity is local state. The form itself is a plain
 * `<form action=…>`, so Phase 3 only has to pass the Server Action in.
 */
export function AddToCartPanel({
  product,
  selected,
  complete,
  action,
  id = 'buy-box',
}: AddToCartPanelProps) {
  const stock = selected?.quantityAvailable ?? 0
  const max = stock > 0 ? stock : DEFAULT_MAX_QUANTITY

  const [quantity, setQuantity] = React.useState(1)

  // Switching to a lower-stock variant must not leave an impossible quantity.
  React.useEffect(() => {
    setQuantity((previous) => Math.min(previous, max))
  }, [max])

  const price = selected?.price ?? product.price
  const compareAt = selected?.compareAtPrice ?? null
  const soldOut = Boolean(selected && !selected.availableForSale)
  const awaitingCart = !action || !complete || !selected
  const carePoints = Math.floor(toNumber(price))

  return (
    <div data-buy-box="" className="flex flex-col gap-5">
      <Price amount={price} compareAt={compareAt} size="lg" />

      <div className="flex flex-wrap items-center gap-3">
        <QuantityStepper value={quantity} min={1} max={max} onChange={setQuantity} />
      </div>

      <form id={id} action={action} className="flex flex-col gap-3">
        <input type="hidden" name="variantId" value={selected?.id ?? ''} />
        <input type="hidden" name="quantity" value={String(quantity)} />
        <AddToCartButton soldOut={soldOut} disabled={awaitingCart} awaitingCart={awaitingCart} />
      </form>

      <p data-buy-helper="" className="text-xs text-ink-mute">
        {`${FREE_SHIPPING_COPY} · Earn `}
        <span className="num">{carePoints}</span>
        {' Care Points'}
      </p>
    </div>
  )
}
