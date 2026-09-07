'use client'

import * as React from 'react'
import type { Money } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'
import { Button } from '@/components/storefront/ui/Button'
import { Price } from '@/components/storefront/ui/Price'

export interface StickyBuyBarProps {
  title: string
  price: Money
  compareAt?: Money | null
  /** Mirrors the buy box: no cart action yet, or an incomplete selection. */
  disabled?: boolean
  soldOut?: boolean
  /** Id of the `AddToCartPanel` form this bar jumps to. */
  targetId: string
}

/**
 * Mobile sticky add-to-cart bar (spec §5.3: the mobile bottom nav is gone, the
 * PDP gets this instead). It appears once the buy box has scrolled out of view
 * and sends focus back to it when tapped.
 *
 * It defaults to visible: with no `IntersectionObserver` (SSR, the jsdom stub
 * in tests) the bar is the only add-to-cart affordance on screen, so failing
 * open is the safe direction. `data-state` exposes which way it went.
 */
export function StickyBuyBar({
  title,
  price,
  compareAt = null,
  disabled = false,
  soldOut = false,
  targetId,
}: StickyBuyBarProps) {
  const [visible, setVisible] = React.useState(true)

  React.useEffect(() => {
    const target = document.getElementById(targetId)
    if (!target || typeof IntersectionObserver !== 'function') return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1]
        if (entry) setVisible(!entry.isIntersecting)
      },
      { threshold: 0 }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [targetId])

  const jumpToBuyBox = () => {
    const target = document.getElementById(targetId)
    target?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    const submit = target?.querySelector<HTMLElement>('button[type="submit"]')
    submit?.focus()
  }

  return (
    <div
      data-sticky-buy-bar=""
      data-state={visible ? 'visible' : 'hidden'}
      aria-hidden={visible ? undefined : true}
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 md:hidden',
        'flex items-center justify-between gap-4',
        'border-t border-line bg-paper px-gutter py-3 pb-[env(safe-area-inset-bottom)]',
        'transition-transform duration-sf-base ease-sf-out motion-reduce:transition-none',
        visible ? 'translate-y-0' : 'pointer-events-none translate-y-full'
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-ink">{title}</p>
        <Price amount={price} compareAt={compareAt} size="sm" />
      </div>
      <Button
        size="md"
        variant={soldOut ? 'outline' : 'ink'}
        disabled={disabled || soldOut}
        onClick={jumpToBuyBox}
      >
        {soldOut ? 'Sold out' : 'Add to cart'}
      </Button>
    </div>
  )
}
