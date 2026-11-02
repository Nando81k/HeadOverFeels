'use client'

import * as React from 'react'
import type { Money } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'
import { useCartOptional } from '@/components/storefront/cart/useCart'
import { Price } from '@/components/storefront/ui/Price'
import { ADDED_FEEDBACK_MS, AddToCartButton } from './AddToCartPanel'

export interface StickyBuyBarProps {
  title: string
  price: Money
  compareAt?: Money | null
  /** Mirrors the buy box: incomplete option selection. */
  disabled?: boolean
  soldOut?: boolean
  /** Forces the "Adding…" state (otherwise read from the cart context). */
  pending?: boolean
  /** Forces the "Added ✓" state (otherwise derived from its own submits). */
  added?: boolean
  /** Forces the unconfigured state (otherwise `cart.status === 'unavailable'`). */
  unavailable?: boolean
  /** Id of the `AddToCartPanel` form this bar submits. */
  targetId: string
}

/**
 * Mobile sticky add-to-cart bar (spec §5.3: the mobile bottom nav is gone, the
 * PDP gets this instead). It appears once the buy box has scrolled out of view.
 *
 * Tapping it submits the buy-box form (`requestSubmit()`), so the panel's own
 * `onSubmit` does the add — one code path, same guards. When the target is not
 * a form it falls back to scrolling to it and focusing its submit button.
 *
 * State mirroring: the bar is a sibling of the panel, not a child, so it reads
 * the cart context itself. "Adding…" is `cart.pending`; "Added ✓" is a local
 * 2s flag set when `cart.pending` goes true → false with no `cart.error`
 * after this bar's own submit. The `pending` / `added` / `unavailable` props
 * override the derived values.
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
  pending: pendingProp,
  added: addedProp,
  unavailable: unavailableProp,
  targetId,
}: StickyBuyBarProps) {
  const cart = useCartOptional()
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

  const cartPending = cart?.pending ?? false
  const cartError = cart?.error ?? null

  // Did this bar start the add that is (or was just) in flight?
  const [awaiting, setAwaiting] = React.useState(false)
  const [justAdded, setJustAdded] = React.useState(false)
  const [lastPending, setLastPending] = React.useState(cartPending)

  // Adjust state while rendering (React docs, "storing information from
  // previous renders"): react to the pending true → false edge.
  if (lastPending !== cartPending) {
    setLastPending(cartPending)
    if (!cartPending && awaiting) {
      setAwaiting(false)
      if (!cartError) setJustAdded(true)
    }
  }

  React.useEffect(() => {
    if (!justAdded) return
    const timer = setTimeout(() => setJustAdded(false), ADDED_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [justAdded])

  const pending = pendingProp ?? cartPending
  const added = addedProp ?? justAdded
  const unavailable = unavailableProp ?? cart?.status === 'unavailable'

  const submitBuyBox = () => {
    const target = document.getElementById(targetId)
    if (target instanceof HTMLFormElement) {
      setJustAdded(false)
      setAwaiting(true)
      target.requestSubmit()
      return
    }
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
      <AddToCartButton
        type="button"
        size="md"
        className="w-auto"
        soldOut={soldOut}
        disabled={disabled}
        unconfigured={unavailable && !soldOut}
        pending={pending}
        added={added}
        onClick={submitBuyBox}
      />
    </div>
  )
}
