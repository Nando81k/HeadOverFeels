'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/storefront/cn'
import { Drawer } from '@/components/storefront/ui/Drawer'
import { Skeleton } from '@/components/storefront/ui/Skeleton'
import { CartLines } from './CartLines'
import { CartSummary } from './CartSummary'
import { CheckoutButtons } from './CheckoutButtons'
import { DiscountCodeForm } from './DiscountCodeForm'
import { EmptyCart } from './EmptyCart'
import { FreeShippingBar } from './FreeShippingBar'
import { useCartOptional } from './useCart'

function CartMessage({
  tone,
  children,
  onDismiss,
}: {
  tone: 'warn' | 'danger'
  children: React.ReactNode
  onDismiss: () => void
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-2 rounded-sharp px-3 py-2.5 text-xs',
        tone === 'warn' ? 'bg-warn/10 text-warn' : 'bg-danger/10 text-danger'
      )}
    >
      {tone === 'warn' ? (
        <p role="status">{children}</p>
      ) : (
        <p role="alert">{children}</p>
      )}
      <button
        type="button"
        aria-label="Dismiss message"
        onClick={onDismiss}
        className="-m-1 inline-flex size-6 shrink-0 items-center justify-center rounded-sharp hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2"
      >
        <X aria-hidden="true" className="size-3.5" />
      </button>
    </div>
  )
}

function LineSkeleton() {
  return (
    <div data-cart-skeleton="" className="grid grid-cols-[72px_minmax(0,1fr)] gap-3.5 border-b border-line py-4">
      <Skeleton className="aspect-[4/5] w-[72px]" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-3/5" />
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="mt-2 h-9 w-28" />
      </div>
    </div>
  )
}

/**
 * The cart drawer (mockup screens 01–02). Rendered once by the storefront
 * header; open state, cart and messages all come from `CartProvider`, so this
 * renders nothing outside one.
 *
 * Following any link inside the drawer (a product title, the empty-state
 * CTAs) closes it, because the provider — and so the open state — outlives
 * client-side navigation.
 */
export function CartDrawer(): React.JSX.Element | null {
  const ctx = useCartOptional()
  if (!ctx) return null

  const { cart, status, count, open, closeDrawer, pending, error, warning, clearMessages } = ctx
  const lines = cart?.lines ?? []
  const hasLines = status === 'ready' && cart !== null && lines.length > 0

  const closeOnLink = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as Element | null
    if (target?.closest?.('a[href]')) closeDrawer()
  }

  const messages =
    warning || error ? (
      <div className="flex flex-col gap-2">
        {warning ? (
          <CartMessage tone="warn" onDismiss={clearMessages}>
            {warning}
          </CartMessage>
        ) : null}
        {error ? (
          <CartMessage tone="danger" onDismiss={clearMessages}>
            {error}
          </CartMessage>
        ) : null}
      </div>
    ) : null

  let body: React.ReactNode
  if (status === 'loading') {
    body = (
      <>
        <span className="sr-only">Loading your cart…</span>
        <LineSkeleton />
        <LineSkeleton />
      </>
    )
  } else if (status === 'unavailable') {
    body = (
      <div className="flex flex-col gap-2 py-8">
        <p className="text-base font-semibold text-ink">Cart unavailable</p>
        <p className="text-xs text-ink-mute">
          We can&apos;t reach the cart right now. Please try again in a moment.
        </p>
      </div>
    )
  } else if (!hasLines) {
    body = (
      <>
        <EmptyCart />
        {messages}
      </>
    )
  } else {
    body = (
      <>
        <FreeShippingBar subtotal={cart.cost.subtotal} />
        <CartLines lines={lines} />
        <DiscountCodeForm compact />
        {messages}
      </>
    )
  }

  return (
    <Drawer
      side="right"
      open={open}
      onOpenChange={(next) => {
        if (!next) closeDrawer()
      }}
      title={`Cart (${count})`}
      footer={
        hasLines ? (
          // Delegated: closes the drawer when a link inside it is activated.
          <div className="flex flex-col gap-4" onClick={closeOnLink}>
            <CartSummary cart={cart} />
            <CheckoutButtons cart={cart} />
          </div>
        ) : undefined
      }
    >
      <div
        data-cart-body=""
        aria-busy={pending || undefined}
        className="flex flex-col gap-5"
        onClick={closeOnLink}
      >
        {body}
      </div>
    </Drawer>
  )
}
