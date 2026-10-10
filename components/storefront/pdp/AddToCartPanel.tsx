'use client'

import * as React from 'react'
import type { ProductDetail, ProductVariant } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'
import { toNumber } from '@/lib/storefront/money'
import { FREE_SHIPPING_COPY } from '@/lib/storefront/shipping'
import { useCartOptional } from '@/components/storefront/cart/useCart'
import { Button } from '@/components/storefront/ui/Button'
import { Price } from '@/components/storefront/ui/Price'
import { QuantityStepper } from '@/components/storefront/ui/QuantityStepper'

/** Quantity ceiling when Shopify does not report stock for the variant. */
const DEFAULT_MAX_QUANTITY = 10

/** How long the button reads "Added ✓" after a successful add. */
export const ADDED_FEEDBACK_MS = 2000

/** Shown when the add promise itself rejects (the actions never should). */
const FALLBACK_ERROR = 'Something went wrong updating your cart.'

export interface AddToCartButtonProps {
  /** Renders the "Sold out" label in the outline variant. */
  soldOut?: boolean
  disabled?: boolean
  /** The add is in flight: spinner, `aria-busy`, "Adding…". */
  pending?: boolean
  /** The last add succeeded: "Added ✓". */
  added?: boolean
  /** No cart backend (unconfigured store): disabled, `data-phase="unconfigured"`. */
  unconfigured?: boolean
  /** `submit` in the buy box; the sticky bar uses `button` and submits the form itself. */
  type?: 'submit' | 'button'
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  size?: 'md' | 'lg'
  className?: string
}

/**
 * The add-to-cart control, shared by the buy box and the sticky mobile bar so
 * both derive the same labels: "Sold out" / "Adding…" / "Added ✓" /
 * "Add to cart".
 */
export function AddToCartButton({
  soldOut = false,
  disabled = false,
  pending = false,
  added = false,
  unconfigured = false,
  type = 'submit',
  onClick,
  size = 'lg',
  className,
}: AddToCartButtonProps) {
  let label: React.ReactNode = 'Add to cart'
  if (soldOut) label = 'Sold out'
  else if (pending) label = 'Adding…'
  else if (added)
    label = (
      <>
        Added <span aria-hidden="true">✓</span>
      </>
    )

  return (
    <Button
      type={type}
      size={size}
      variant={soldOut ? 'outline' : 'ink'}
      disabled={disabled || soldOut || unconfigured}
      loading={pending && !soldOut}
      data-phase={unconfigured ? 'unconfigured' : undefined}
      onClick={onClick}
      className={cn('w-full', className)}
    >
      {label}
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
   * No-JS fallback: the Server Action the form posts `variantId` and
   * `quantity` to. With a cart provider mounted (JS on, store configured) the
   * submit is intercepted and goes through `useCart().addLine` instead.
   */
  action?: (formData: FormData) => void | Promise<void>
  /** Form id — the sticky bar submits it. Defaults to `buy-box`. */
  id?: string
}

/**
 * Price, quantity and add-to-cart for the selected variant (spec §5.4).
 *
 * Submit paths:
 * - Cart provider present and not `unavailable` → `onSubmit` prevents the
 *   native post and calls `cart.addLine({ variantId, quantity })` (the
 *   provider opens the drawer). The button shows "Adding…" while that promise
 *   is pending, "Added ✓" for 2s on success, and an alert on `{ ok: false }`.
 * - No provider but an `action` → the form posts to it (React form action, or
 *   a real POST before hydration / without JS).
 * - Provider `unavailable`, or neither → disabled, `data-phase="unconfigured"`.
 */
export function AddToCartPanel({
  product,
  selected,
  complete,
  action,
  id = 'buy-box',
}: AddToCartPanelProps) {
  const cart = useCartOptional()
  const stock = selected?.quantityAvailable ?? 0
  const max = stock > 0 ? stock : DEFAULT_MAX_QUANTITY

  const [quantity, setQuantity] = React.useState(1)
  const [adding, setAdding] = React.useState(false)
  const [added, setAdded] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Switching to a lower-stock variant must not leave an impossible quantity.
  React.useEffect(() => {
    setQuantity((previous) => Math.min(previous, max))
  }, [max])

  // "Added ✓" reverts after a beat; the cleanup also covers unmount.
  React.useEffect(() => {
    if (!added) return
    const timer = setTimeout(() => setAdded(false), ADDED_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [added])

  const price = selected?.price ?? product.price
  const compareAt = selected?.compareAtPrice ?? null
  const soldOut = Boolean(selected && !selected.availableForSale)
  const unconfigured = cart ? cart.status === 'unavailable' : !action
  const intercept = Boolean(cart) && !unconfigured
  const buyable = Boolean(selected) && complete && !soldOut && !unconfigured
  const carePoints = Math.floor(toNumber(price))

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    // The sticky bar calls `requestSubmit()`, which bypasses the disabled
    // button, so every guard lives here too.
    if (!intercept) {
      if (!buyable) event.preventDefault()
      return
    }
    event.preventDefault()
    if (!cart || !selected || !buyable || adding) return

    setError(null)
    setAdded(false)
    setAdding(true)
    cart.addLine({ variantId: selected.id, quantity }).then(
      (result) => {
        setAdding(false)
        if (result.ok) setAdded(true)
        else setError(result.error)
      },
      () => {
        setAdding(false)
        setError(FALLBACK_ERROR)
      }
    )
  }

  return (
    <div data-buy-box="" className="flex flex-col gap-5">
      <Price amount={price} compareAt={compareAt} size="lg" />

      <div className="flex flex-wrap items-center gap-3">
        <QuantityStepper value={quantity} min={1} max={max} onChange={setQuantity} />
      </div>

      <form id={id} action={action} onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input type="hidden" name="variantId" value={selected?.id ?? ''} />
        <input type="hidden" name="quantity" value={String(quantity)} />
        <AddToCartButton
          soldOut={soldOut}
          disabled={!complete || !selected}
          unconfigured={unconfigured && !soldOut}
          pending={adding}
          added={added}
        />
        {error ? (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : null}
      </form>

      <p data-buy-helper="" className="text-xs text-ink-mute">
        {`${FREE_SHIPPING_COPY} · Earn `}
        <span className="num">{carePoints}</span>
        {' Care Points'}
      </p>
    </div>
  )
}
