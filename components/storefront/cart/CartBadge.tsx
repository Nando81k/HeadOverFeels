'use client'

import * as React from 'react'
import { useCartOptional } from '@/components/storefront/cart/CartProvider'
import { cn } from '@/lib/storefront/cn'

/**
 * The count the header should show: the live cart count once the provider has
 * loaded (or knows the store is unavailable), otherwise the server-rendered
 * `fallbackCount` — while loading, and everywhere outside a `CartProvider`.
 */
export function useCartCount(fallbackCount = 0): number {
  const cart = useCartOptional()
  if (!cart || cart.status === 'loading') return fallbackCount
  return cart.count
}

export interface CartBadgeProps {
  /** SSR count shown until the provider has loaded the cart. */
  fallbackCount?: number
  className?: string
}

/**
 * Signal count bubble for the header's cart button. Hidden at 0 and
 * `aria-hidden` — the button's own label ("Cart, N items") carries the count.
 */
export function CartBadge({ fallbackCount = 0, className }: CartBadgeProps) {
  const count = useCartCount(fallbackCount)
  if (count <= 0) return null

  return (
    <span
      data-cart-badge=""
      aria-hidden="true"
      className={cn(
        'num absolute top-1.5 right-1 min-w-4 rounded-pill px-1',
        'bg-signal text-[10px] leading-4 font-semibold text-signal-ink',
        className
      )}
    >
      {count}
    </span>
  )
}
