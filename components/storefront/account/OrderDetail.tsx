import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { FulfillmentTimeline } from '@/components/storefront/account/FulfillmentTimeline'
import { formatOrderDate, OrderStatusBadge } from '@/components/storefront/account/OrderCard'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'
import type { CustomerOrder, Money } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'
import { formatMoney, toNumber } from '@/lib/storefront/money'

/**
 * The order page body (Phase 4 plan, Task 5; mockup 04): breadcrumb, header
 * with status and the Shopify status page link, shipment timeline, items,
 * summary (with discounts and the Care Points earned) and the shipping
 * address. Server-safe — the route passes the order and the points line.
 */

const CRUMB_CLASS = cn(
  'text-ink-mute underline-offset-4 hover:text-ink hover:underline',
  'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2'
)

const MONEY_CLASS = 'num font-mono tabular-nums'

function money(value: Money | null, fallback = '—'): string {
  return value ? formatMoney(value) : fallback
}

/** `−15%` or `−$10.00`; `null` for a discount with no readable value. */
export function formatDiscount(discount: CustomerOrder['discounts'][number]): string | null {
  if (discount.percentage !== null && discount.percentage !== undefined) {
    const pct = Number.isInteger(discount.percentage) ? discount.percentage : discount.percentage.toFixed(1)
    return `−${pct}%`
  }
  if (discount.amount) return `−${formatMoney(discount.amount)}`
  return null
}

function SummaryRow({ label, value, strong = false }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 text-sm', strong && 'font-semibold text-ink')}>
      <dt className={strong ? undefined : 'text-ink-soft'}>{label}</dt>
      <dd className={MONEY_CLASS}>{value}</dd>
    </div>
  )
}

export interface OrderDetailProps {
  order: CustomerOrder
  /** Care Points posted for this order, or `null` to omit the line. */
  pointsEarned: number | null
  className?: string
}

export function OrderDetail({ order, pointsEarned, className }: OrderDetailProps) {
  const shippingFree = order.shipping ? toNumber(order.shipping) === 0 : false
  const discounts = order.discounts.map(formatDiscount).filter((value): value is string => value !== null)

  return (
    <div className={cn('flex flex-col gap-8', className)}>
      <nav aria-label="Breadcrumb" className="text-xs">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/account" className={CRUMB_CLASS}>
              Account
            </Link>
          </li>
          <li aria-hidden="true" className="text-ink-mute">
            /
          </li>
          <li>
            <Link href="/account/orders" className={CRUMB_CLASS}>
              Orders
            </Link>
          </li>
          <li aria-hidden="true" className="text-ink-mute">
            /
          </li>
          <li aria-current="page" className="num font-mono tabular-nums text-ink">
            {order.name}
          </li>
        </ol>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Eyebrow>{formatOrderDate(order.processedAt)}</Eyebrow>
          <Display as="h1" size="md">
            Order <span className="num">{order.name}</span>
          </Display>
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.fulfillmentStatus} />
            {order.financialStatus ? (
              <span className="text-xs text-ink-mute">{order.financialStatus.toLowerCase().replace(/_/g, ' ')}</span>
            ) : null}
          </div>
        </div>
        {order.statusPageUrl ? (
          <a
            href={order.statusPageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'text-xs font-semibold uppercase tracking-eyebrow text-ink underline underline-offset-4 decoration-line-strong',
              'transition-colors duration-sf-fast ease-sf-out hover:text-signal',
              'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2'
            )}
          >
            Order status page
          </a>
        ) : null}
      </header>

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-10">
          <section aria-labelledby="order-shipment-title" className="flex flex-col gap-4">
            <h2 id="order-shipment-title" className="text-xs font-semibold uppercase tracking-eyebrow text-ink-mute">
              Shipment
            </h2>
            <FulfillmentTimeline order={order} />
          </section>

          <section aria-labelledby="order-items-title" className="flex flex-col gap-2">
            <h2 id="order-items-title" className="text-xs font-semibold uppercase tracking-eyebrow text-ink-mute">
              Items
            </h2>
            <ul aria-label="Items" className="border-t border-line">
              {order.lines.map((line) => (
                <li key={line.id} className="grid grid-cols-[64px_minmax(0,1fr)_auto] gap-4 border-b border-line py-4">
                  <div className="relative aspect-[4/5] w-16 overflow-hidden rounded-sharp border border-line bg-paper">
                    {line.image ? (
                      <Image src={line.image.url} alt="" fill sizes="64px" className="object-cover" />
                    ) : null}
                  </div>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="truncate text-sm font-semibold text-ink">{line.title}</p>
                    {line.variantTitle ? <p className="text-xs text-ink-mute">{line.variantTitle}</p> : null}
                    <p className={cn(MONEY_CLASS, 'text-xs text-ink-soft')}>
                      {line.quantity} × {money(line.unitPrice)}
                    </p>
                  </div>
                  <p className={cn(MONEY_CLASS, 'text-sm font-semibold text-ink')}>{money(line.total)}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section
            aria-labelledby="order-summary-title"
            className="flex flex-col gap-3 rounded-sharp border border-line bg-paper p-5"
          >
            <h2 id="order-summary-title" className="text-xs font-semibold uppercase tracking-eyebrow text-ink-mute">
              Summary
            </h2>
            <dl className="flex flex-col gap-2">
              <SummaryRow label="Subtotal" value={money(order.subtotal)} />
              {discounts.map((value, index) => (
                <SummaryRow key={index} label="Discount" value={<span className="text-signal">{value}</span>} />
              ))}
              <SummaryRow label="Shipping" value={shippingFree ? 'Free' : money(order.shipping)} />
              <SummaryRow label="Tax" value={money(order.tax)} />
              <div className="border-t border-line pt-2">
                <SummaryRow label="Total" value={money(order.total)} strong />
              </div>
            </dl>
            {pointsEarned !== null ? (
              <p data-points-earned="" className="border-t border-line pt-3 text-xs text-ink-soft">
                Earned <b className="num font-semibold text-ink">{pointsEarned}</b> Care Points
              </p>
            ) : null}
          </section>

          {order.shippingAddress && order.shippingAddress.length > 0 ? (
            <section
              aria-labelledby="order-address-title"
              className="flex flex-col gap-3 rounded-sharp border border-line bg-paper p-5"
            >
              <h2 id="order-address-title" className="text-xs font-semibold uppercase tracking-eyebrow text-ink-mute">
                Shipping address
              </h2>
              <address className="text-sm not-italic text-ink-soft">
                {order.shippingAddress.map((line, index) => (
                  <span key={index} className="block">
                    {line}
                  </span>
                ))}
              </address>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}
