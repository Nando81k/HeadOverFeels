'use client'

import { useCustomerOptional } from '@/components/storefront/account/useCustomer'
import type { Cart } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'
import { formatMoney, toNumber } from '@/lib/storefront/money'

export interface CartSummaryProps {
  cart: Cart
  /** `page` adds the item count to the subtotal label. */
  variant?: 'drawer' | 'page'
  className?: string
}

/**
 * Care Points preview: one point per whole dollar of the estimated total,
 * scaled by the customer's tier multiplier when one is known (Phase 4, Task 6).
 * An absent or nonsensical multiplier means 1×.
 */
export function carePointsFor(cart: Cart, multiplier = 1): number {
  const factor = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1
  return Math.max(0, Math.floor(toNumber(cart.cost.total) * factor))
}

/**
 * The signed-in tier multiplier, once the customer context has loaded; 1
 * otherwise. The summary's loyalty slice is `{ points, tierName, … }` by
 * contract; `multiplier` is an optional extension read defensively so the
 * preview scales as soon as the slice carries it and stays 1× until then.
 */
function useTierMultiplier(): number {
  const customer = useCustomerOptional()
  if (!customer || customer.status !== 'ready' || !customer.loyalty) return 1
  const { multiplier } = customer.loyalty
  return typeof multiplier === 'number' && multiplier > 0 ? multiplier : 1
}

/**
 * Subtotal → cart-level discount → estimated total, then the taxes / Care
 * Points note. Shopify reports one cart-level discount total, so it is shown
 * once with the applicable codes joined as its label.
 */
export function CartSummary({ cart, variant = 'drawer', className }: CartSummaryProps) {
  const { subtotal, total, discount } = cart.cost
  const hasDiscount = discount !== null && toNumber(discount) > 0
  const codes = cart.discountCodes.filter((entry) => entry.applicable).map((entry) => entry.code)
  const multiplier = useTierMultiplier()

  return (
    <div data-cart-summary="" className={cn('flex flex-col gap-3 text-sm text-ink', className)}>
      <dl className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <dt>
            Subtotal
            {variant === 'page' ? (
              <span className="text-ink-mute">
                {' · '}
                <span className="num">{cart.totalQuantity}</span>{' '}
                {cart.totalQuantity === 1 ? 'item' : 'items'}
              </span>
            ) : null}
          </dt>
          <dd className="num">{formatMoney(subtotal)}</dd>
        </div>
        {hasDiscount && discount ? (
          <div className="flex items-center justify-between gap-3 text-ok">
            <dt>{codes.length > 0 ? codes.join(', ') : 'Discount'}</dt>
            <dd className="num">−{formatMoney(discount)}</dd>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3 text-base font-semibold">
          <dt>Estimated total</dt>
          <dd className="num">{formatMoney(total)}</dd>
        </div>
      </dl>
      <p className="text-xs text-ink-mute">
        Taxes and shipping calculated at checkout · Earn{' '}
        <b className="num font-semibold text-ink">{carePointsFor(cart, multiplier)}</b> Care Points
      </p>
    </div>
  )
}
