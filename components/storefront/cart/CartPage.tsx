'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  CartLines,
  CartSummary,
  CheckoutButtons,
  DiscountCodeForm,
  EmptyCart,
  FreeShippingBar,
} from '@/components/storefront/cart'
import { CartNoteForm } from '@/components/storefront/cart/CartNoteForm'
import { useCart } from '@/components/storefront/cart/useCart'
import { Section } from '@/components/storefront/ui/Section'
import { Display } from '@/components/storefront/ui/Typography'
import { cn } from '@/lib/storefront/cn'
import type { Cart } from '@/lib/shopify/types'

/** Text badges, not brand marks: no logos to license, no hex to sneak in. */
const PAYMENT_METHODS = ['VISA', 'MC', 'AMEX', 'APPLE', 'GPAY', 'PAYPAL'] as const

const POLICY_LINKS = [
  { href: '/policies/shipping-policy', label: 'Shipping policy' },
  { href: '/policies/refund-policy', label: 'Returns & refunds' },
] as const

const LINK_CLASS = cn(
  'text-xs font-semibold uppercase tracking-eyebrow text-ink-soft underline underline-offset-4 decoration-line-strong',
  'transition-colors duration-sf-fast ease-sf-out hover:text-ink',
  'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2'
)

const COLUMN_HEAD_CLASS = 'text-[11px] font-semibold uppercase tracking-eyebrow text-ink-mute'

/**
 * The full-page cart (`/cart`, Phase 3 plan Task 7). Reads everything from
 * `useCart()` — the route seeds the provider with the cookie's cart, so this
 * renders the same lines the drawer shows, with room for notes and policies.
 */
export interface CartPageProps {
  /**
   * The cookie's cart as read by the route during render. Seeds the layout's
   * provider on mount so the header badge and the drawer stay in sync with
   * edits made here (no nested provider). `undefined` = render whatever the
   * provider has.
   */
  initialCart?: Cart | null
}

export function CartPage({ initialCart }: CartPageProps = {}) {
  const ctx = useCart()
  const { warning, error, seed } = ctx
  const seeded = React.useRef(false)
  React.useEffect(() => {
    if (initialCart === undefined || seeded.current) return
    seeded.current = true
    seed(initialCart)
  }, [initialCart, seed])
  // On a fresh page load the provider is still `loading` until the seed effect
  // runs; show the server-rendered cart meanwhile so nothing flashes empty.
  const cart = ctx.status === 'loading' && initialCart !== undefined ? initialCart : ctx.cart
  const empty = !cart || cart.lines.length === 0

  return (
    <Section aria-labelledby="cart-page-title">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <Display as="h1" size="lg" id="cart-page-title">
          Your cart
        </Display>
        <Link href="/collections/all" className={LINK_CLASS}>
          Continue shopping
        </Link>
      </div>

      {warning ? (
        <p role="status" className="mb-6 border border-line bg-paper px-4 py-3 text-sm text-ink">
          {warning}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mb-6 border border-danger bg-paper px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {empty ? (
        <EmptyCart />
      ) : (
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-w-0 flex-col gap-8">
            <div>
              {/* Same columns as `CartLineItem variant="page"` (thumb · details with
                  the stepper · line total) so the heads sit over their content. */}
              <div
                aria-hidden="true"
                className="hidden grid-cols-[96px_minmax(0,1fr)_auto] gap-3.5 border-b border-line pb-3 sm:grid"
              >
                <span className={COLUMN_HEAD_CLASS}>Item</span>
                <span className={COLUMN_HEAD_CLASS}>Quantity</span>
                <span className={cn(COLUMN_HEAD_CLASS, 'text-right')}>Total</span>
              </div>
              <CartLines lines={cart.lines} variant="page" />
            </div>
            <CartNoteForm className="max-w-xl" />
          </div>

          <aside
            aria-labelledby="cart-summary-title"
            className="flex flex-col gap-4 rounded-sharp border border-line bg-paper p-5 lg:sticky lg:top-24"
          >
            <Display as="h2" size="md" id="cart-summary-title">
              Summary
            </Display>
            <CartSummary cart={cart} variant="page" />
            <FreeShippingBar subtotal={cart.cost.subtotal} />
            <DiscountCodeForm />
            <CheckoutButtons cart={cart} />

            <ul aria-hidden="true" className="flex flex-wrap gap-1.5" data-payment-icons>
              {PAYMENT_METHODS.map((method) => (
                <li
                  key={method}
                  className="rounded-sharp border border-line px-1.5 py-0.5 text-[10px] font-semibold tracking-eyebrow text-ink-mute"
                >
                  {method}
                </li>
              ))}
            </ul>

            <nav aria-label="Cart policies" className="flex flex-wrap gap-x-4 gap-y-2">
              {POLICY_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className={LINK_CLASS}>
                  {link.label}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </Section>
  )
}
