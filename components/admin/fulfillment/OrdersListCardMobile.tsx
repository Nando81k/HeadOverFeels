// components/admin/fulfillment/OrdersListCardMobile.tsx
'use client'

import { PencilSimple } from '@phosphor-icons/react/dist/ssr'
import { SwipeableRow } from '@/components/ui/SwipeableRow'
import type { OrderRow } from '@/lib/admin/fulfillment'

// ── helpers ────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function statusPill(status: OrderRow['status']) {
  const map: Record<OrderRow['status'], { bg: string; text: string; label: string }> = {
    PENDING:     { bg: 'bg-white/8',          text: 'text-white/50', label: 'Pending' },
    CONFIRMED:   { bg: 'bg-blue-500/15',       text: 'text-blue-400', label: 'Confirmed' },
    PROCESSING:  { bg: 'bg-amber-500/15',      text: 'text-amber-400', label: 'Processing' },
    SHIPPED:     { bg: 'bg-emerald-500/15',    text: 'text-emerald-400', label: 'Shipped' },
    DELIVERED:   { bg: 'bg-emerald-500/20',    text: 'text-emerald-300', label: 'Delivered' },
    CANCELLED:   { bg: 'bg-red-500/15',        text: 'text-red-400', label: 'Cancelled' },
    REFUNDED:    { bg: 'bg-white/8',           text: 'text-white/40', label: 'Refunded' },
  }
  const { bg, text, label } = map[status] ?? { bg: 'bg-white/8', text: 'text-white/40', label: status }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${bg} ${text}`}>
      {label}
    </span>
  )
}

function paymentPill(paymentStatus: OrderRow['paymentStatus']) {
  const map: Record<OrderRow['paymentStatus'], { bg: string; text: string; label: string }> = {
    PENDING:  { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Pending' },
    PAID:     { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Paid' },
    FAILED:   { bg: 'bg-red-500/15', text: 'text-red-400', label: 'Failed' },
    REFUNDED: { bg: 'bg-white/8', text: 'text-white/40', label: 'Refunded' },
  }
  const { bg, text, label } = map[paymentStatus] ?? { bg: 'bg-white/8', text: 'text-white/40', label: paymentStatus }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${bg} ${text}`}>
      {label}
    </span>
  )
}

// ── types ──────────────────────────────────────────────────────────────────

export interface OrdersListCardMobileProps {
  row: OrderRow
  selected: boolean
  /** Called with orderId when long-press / right-click (onContextMenu) fires */
  onLongPress: (orderId: string) => void
  /** Called with orderId when Edit button is tapped */
  onEdit: (orderId: string) => void
  /** Called with orderId when swipe-left "Mark Shipped" action is triggered */
  onMarkShipped: (orderId: string) => void
}

// ── component ──────────────────────────────────────────────────────────────

export function OrdersListCardMobile({
  row,
  selected,
  onLongPress,
  onEdit,
  onMarkShipped,
}: OrdersListCardMobileProps) {
  return (
    <SwipeableRow
      rightActions={[
        {
          label: 'Mark Shipped',
          onClick: () => onMarkShipped(row.id),
        },
      ]}
      className="md:hidden"
    >
      <article
        onContextMenu={(e) => {
          e.preventDefault()
          onLongPress(row.id)
        }}
        className={[
          'relative px-4 py-3 border-b border-white/5 last:border-0 bg-neutral-900/60 transition-colors',
          selected
            ? 'border-l-2 border-l-emerald-500 ring-1 ring-emerald-500/30 bg-emerald-500/5'
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
        data-testid="orders-list-card-mobile"
      >
        {/* Row 1: order number + status pills */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="font-mono text-xs font-semibold text-white">{row.orderNumber}</span>
          <div className="flex items-center gap-1.5">
            {statusPill(row.status)}
            {paymentPill(row.paymentStatus)}
          </div>
        </div>

        {/* Row 2: customer name */}
        <p className="text-sm font-semibold text-white/90 truncate mb-1">
          {row.customerName ?? row.customerEmail}
        </p>

        {/* Row 3: meta info */}
        <p className="text-[11px] text-white/40 mb-2">
          {row.itemCount} item{row.itemCount === 1 ? '' : 's'} · {formatDate(row.createdAt)}
        </p>

        {/* Row 4: total + edit button */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-white tabular-nums">
            {formatCurrency(row.totalAmount)}
          </span>
          <button
            type="button"
            aria-label={`Edit order ${row.orderNumber}`}
            onClick={(e) => {
              e.stopPropagation()
              onEdit(row.id)
            }}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-white/50 hover:text-white transition-colors px-2 py-0.5 rounded hover:bg-white/5"
          >
            <PencilSimple size={11} aria-hidden />
            Edit
          </button>
        </div>
      </article>
    </SwipeableRow>
  )
}
