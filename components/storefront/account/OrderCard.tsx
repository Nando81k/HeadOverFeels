import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Badge, type BadgeProps } from '@/components/storefront/ui/Badge'
import { Price } from '@/components/storefront/ui/Price'
import type { CustomerOrderCard } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'

/**
 * One row of the orders list (Phase 4 plan, Task 5; mockup 03): number,
 * thumbnails, item summary, status pill, date, total and a View link.
 *
 * Server-safe. The route id is the numeric tail of the order gid
 * (`/account/orders/6123456789`); the detail page rebuilds the gid.
 */

const ORDER_GID_PREFIX = 'gid://shopify/Order/'

/** `gid://shopify/Order/6123456789[?…]` → `6123456789`; `null` for anything else. */
export function orderIdFromGid(gid: string): string | null {
  if (!gid.startsWith(ORDER_GID_PREFIX)) return null
  const tail = gid.slice(ORDER_GID_PREFIX.length).split('?')[0]
  return /^\d+$/.test(tail) ? tail : null
}

/** `6123456789` → `gid://shopify/Order/6123456789`; `null` unless the id is all digits. */
export function orderGidFromId(id: string): string | null {
  return /^\d{1,32}$/.test(id) ? `${ORDER_GID_PREFIX}${id}` : null
}

export function orderPath(order: Pick<CustomerOrderCard, 'id'>): string {
  const id = orderIdFromGid(order.id) ?? encodeURIComponent(order.id)
  return `/account/orders/${id}`
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

/** `2026-10-06T15:42:10Z` → `Oct 6, 2026` (UTC, so SSR and hydration agree). Empty when unparsable. */
export function formatOrderDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : DATE_FORMAT.format(date)
}

export const FULFILLMENT_LABEL: Record<CustomerOrderCard['fulfillmentStatus'], string> = {
  UNFULFILLED: 'Processing',
  IN_PROGRESS: 'On its way',
  FULFILLED: 'Shipped',
  CANCELLED: 'Cancelled',
  UNKNOWN: 'Updated',
}

const FULFILLMENT_BADGE: Record<CustomerOrderCard['fulfillmentStatus'], BadgeProps['variant']> = {
  UNFULFILLED: 'neutral',
  IN_PROGRESS: 'drop',
  FULFILLED: 'new',
  CANCELLED: 'soldout',
  UNKNOWN: 'neutral',
}

export function OrderStatusBadge({ status }: { status: CustomerOrderCard['fulfillmentStatus'] }) {
  return (
    <Badge variant={FULFILLMENT_BADGE[status]} data-order-status={status}>
      {FULFILLMENT_LABEL[status]}
    </Badge>
  )
}

const MAX_THUMBS = 3

export interface OrderCardProps {
  order: CustomerOrderCard
  className?: string
}

export function OrderCard({ order, className }: OrderCardProps) {
  const itemCount = order.lineItems.reduce((sum, line) => sum + line.quantity, 0)
  const thumbs = order.lineItems.filter((line) => line.image).slice(0, MAX_THUMBS)
  const titles = order.lineItems.map((line) => line.title)
  const headingId = `order-${orderIdFromGid(order.id) ?? order.number}`

  return (
    <article
      aria-labelledby={headingId}
      data-order-card=""
      className={cn(
        'grid gap-4 border-b border-line py-5',
        'sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <ul aria-hidden="true" className="flex -space-x-2">
          {thumbs.map((line) => (
            <li
              key={line.id}
              className="relative size-12 overflow-hidden rounded-sharp border border-line bg-paper"
            >
              {line.image ? (
                <Image src={line.image.url} alt="" fill sizes="48px" className="object-cover" />
              ) : null}
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-0.5">
          <h3 id={headingId} className="text-sm font-semibold text-ink">
            <span className="sr-only">Order </span>
            <span className="num font-mono tabular-nums">{order.name}</span>
          </h3>
          <p className="text-xs text-ink-mute">{formatOrderDate(order.processedAt)}</p>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="truncate text-sm text-ink-soft">{titles.join(', ')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.fulfillmentStatus} />
          <span className="text-xs text-ink-mute">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-1">
        <Price amount={order.total} size="md" className="font-semibold" />
        <Link
          href={orderPath(order)}
          aria-label={`View order ${order.name}`}
          className={cn(
            'text-xs font-semibold uppercase tracking-eyebrow text-ink underline underline-offset-4 decoration-line-strong',
            'transition-colors duration-sf-fast ease-sf-out hover:text-signal',
            'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2'
          )}
        >
          View
        </Link>
      </div>
    </article>
  )
}
