'use client'

import type { CartLine } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'
import { CartLineItem } from './CartLineItem'
import { useCart } from './useCart'

export interface CartLinesProps {
  lines: CartLine[]
  variant?: 'drawer' | 'page'
  className?: string
}

/** The cart's lines as a list; the line being mutated (`pendingLineId`) is dimmed. */
export function CartLines({ lines, variant = 'drawer', className }: CartLinesProps) {
  const { pendingLineId } = useCart()

  return (
    <ul aria-label="Cart items" className={cn('flex flex-col', className)}>
      {lines.map((line) => (
        <li key={line.id}>
          <CartLineItem line={line} variant={variant} pending={pendingLineId === line.id} />
        </li>
      ))}
    </ul>
  )
}
