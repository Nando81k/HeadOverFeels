import * as React from 'react'
import { formatOrderDate } from '@/components/storefront/account/OrderCard'
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/storefront/cn'
import { formatMoney } from '@/lib/storefront/money'

/**
 * Orders placed before the move to Shopify, read from the legacy Prisma
 * `Order` table by `customerEmail` (case-insensitive) and shown read-only
 * (Phase 4 plan, decision 20a; mockup 03). Nothing links anywhere: these
 * orders have no Shopify counterpart and no live tracking.
 *
 * Server component with a Prisma read, so it is deliberately left out of the
 * `components/storefront/account` barrel. `loadEarlierOrders` and
 * `EarlierOrdersList` are exported separately so the page and tests can use
 * the data and the markup on their own.
 */

export type EarlierOrderItem = {
  id: string
  productName: string
  quantity: number
  productImage: string | null
  variantDetails: string | null
}

export type EarlierOrder = {
  id: string
  orderNumber: string
  /** ISO timestamp. */
  createdAt: string
  status: string
  total: number
  items: EarlierOrderItem[]
}

/** Legacy orders were charged in USD. */
const LEGACY_CURRENCY = 'USD'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
}

export function legacyStatusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status.charAt(0) + status.slice(1).toLowerCase()
}

/** Newest first, with items. Any database failure reads as "no earlier orders". */
export async function loadEarlierOrders(email: string, limit = 20): Promise<EarlierOrder[]> {
  try {
    const rows = await prisma.order.findMany({
      where: { customerEmail: { equals: email, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        status: true,
        total: true,
        items: {
          select: { id: true, productName: true, quantity: true, productImage: true, variantDetails: true },
        },
      },
    })
    return rows.map((row) => ({
      id: row.id,
      orderNumber: row.orderNumber,
      createdAt: row.createdAt.toISOString(),
      status: String(row.status),
      total: row.total,
      items: row.items,
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[storefront] earlier orders unavailable: ${message}`)
    return []
  }
}

export interface EarlierOrdersListProps {
  orders: EarlierOrder[]
  /** `strip` is the overview's compact version; `full` is the orders page section. */
  variant?: 'strip' | 'full'
  id?: string
  className?: string
}

export function EarlierOrdersList({ orders, variant = 'full', id, className }: EarlierOrdersListProps) {
  if (orders.length === 0) return null
  const headingId = `${id ?? 'earlier-orders'}-title`

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      data-earlier-orders={variant}
      className={cn('flex flex-col gap-3', className)}
    >
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="text-xs font-semibold uppercase tracking-eyebrow text-ink-mute">
          Earlier orders
        </h2>
        <p className="text-xs text-ink-mute">
          Placed before our move to Shopify. Read-only — for help with one of these, contact us.
        </p>
      </div>
      <ul className="border-t border-line">
        {orders.map((order) => (
          <li
            key={order.id}
            className={cn(
              'grid gap-x-4 gap-y-1 border-b border-line py-3 text-sm',
              'sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-baseline'
            )}
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="flex flex-wrap items-baseline gap-x-3">
                <span className="num font-mono tabular-nums font-semibold text-ink">{order.orderNumber}</span>
                <span className="text-xs text-ink-mute">{formatOrderDate(order.createdAt)}</span>
              </p>
              {variant === 'full' && order.items.length > 0 ? (
                <p className="truncate text-xs text-ink-soft">
                  {order.items.map((item) => `${item.productName} × ${item.quantity}`).join(', ')}
                </p>
              ) : null}
            </div>
            <span className="text-xs text-ink-soft">{legacyStatusLabel(order.status)}</span>
            <span data-order-total="" className="num font-mono tabular-nums font-semibold text-ink sm:text-right">
              {formatMoney({ amount: String(order.total), currencyCode: LEGACY_CURRENCY })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export interface EarlierOrdersProps extends Omit<EarlierOrdersListProps, 'orders'> {
  /** The signed-in customer's email (`CustomerSession.email`). */
  email: string
  limit?: number
}

/** Loads and renders; `null` when the customer has no legacy orders. */
export async function EarlierOrders({ email, limit, ...props }: EarlierOrdersProps) {
  const orders = await loadEarlierOrders(email, limit)
  return <EarlierOrdersList orders={orders} {...props} />
}
