import type { Money } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'
import { formatMoney, isOnSale } from '@/lib/storefront/money'

const SIZE_CLASS = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
} as const

export type PriceSize = keyof typeof SIZE_CLASS

export interface PriceProps {
  amount: Money
  /** Only struck through when strictly higher than `amount` in the same currency. */
  compareAt?: Money | null
  className?: string
  size?: PriceSize
}

/**
 * Price display in tabular mono (spec §5.2). The wrapper carries `data-on-sale`
 * so parents (e.g. ProductCard) can style around it without recomputing.
 */
export function Price({ amount, compareAt, className, size = 'md' }: PriceProps) {
  const onSale = isOnSale(amount, compareAt)

  return (
    <span
      className={cn('inline-flex items-baseline gap-2', SIZE_CLASS[size], className)}
      data-on-sale={onSale ? '' : undefined}
    >
      <span className={cn('num font-mono tabular-nums', onSale && 'text-signal')}>
        {formatMoney(amount)}
      </span>
      {onSale && compareAt ? (
        <s className="num font-mono tabular-nums text-ink-mute" aria-label="Original price">
          {formatMoney(compareAt)}
        </s>
      ) : null}
    </span>
  )
}
