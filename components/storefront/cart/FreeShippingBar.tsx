import type { Money } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'
import { formatMoney } from '@/lib/storefront/money'
import { freeShippingProgress } from '@/lib/storefront/shipping'

export interface FreeShippingBarProps {
  /** Cart subtotal (before cart-level discounts), as Shopify reports it. */
  subtotal: Money
  className?: string
}

/**
 * "$13.00 away from free US shipping" / "✓ You've unlocked free US shipping",
 * over a thin progress rail. Threshold and maths live in `lib/storefront/shipping`.
 */
export function FreeShippingBar({ subtotal, className }: FreeShippingBarProps) {
  const { remaining, ratio, unlocked } = freeShippingProgress(subtotal)
  const percent = Math.round(ratio * 100)

  return (
    <div data-free-shipping="" className={cn('flex flex-col gap-2 text-xs text-ink', className)}>
      {unlocked ? (
        <p className="font-medium text-ok">✓ You&apos;ve unlocked free US shipping</p>
      ) : (
        <p>
          <b className="num font-semibold">
            {formatMoney({ amount: String(remaining), currencyCode: subtotal.currencyCode })}
          </b>{' '}
          away from free US shipping
        </p>
      )}
      <div
        role="progressbar"
        aria-label="Progress toward free US shipping"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1 overflow-hidden rounded-pill bg-line"
      >
        <div
          className={cn(
            'h-full transition-[width] duration-sf-base ease-sf-out motion-reduce:transition-none',
            unlocked ? 'bg-ok' : 'bg-ink'
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
