// components/admin/fulfillment/detail/OrderPaymentPanel.tsx
'use client'

import { useState } from 'react'
import { RefundDialog } from './RefundDialog'
import type { OrderDetailFull, OrderRefundSummary } from '@/lib/admin/fulfillment'

interface OrderPaymentPanelProps {
  detail: OrderDetailFull
  /** Optional callback for parent to react after refund is created */
  onRefundClick?: () => void
}

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  PAID:     'bg-emerald-500/15 text-emerald-300',
  PENDING:  'bg-amber-500/15 text-amber-300',
  FAILED:   'bg-rose-500/15 text-rose-300',
  REFUNDED: 'bg-sky-500/15 text-sky-300',
}

export function OrderPaymentPanel({ detail, onRefundClick }: OrderPaymentPanelProps) {
  const [refundOpen, setRefundOpen] = useState(false)

  const pillStyle =
    PAYMENT_STATUS_STYLES[detail.paymentStatus] ?? 'bg-neutral-500/15 text-white/60'

  function handleRefundClick() {
    setRefundOpen(true)
    onRefundClick?.()
  }

  return (
    <section className="border border-white/8 rounded-md p-4 bg-neutral-900/60 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Payment</h2>
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${pillStyle}`}>
          {detail.paymentStatus}
        </span>
      </div>

      <dl className="space-y-1.5 text-sm">
        <Row label="Subtotal" value={detail.subtotal} />
        <Row label="Shipping" value={detail.shipping} />
        <Row label="Tax"      value={detail.tax} />
        <div className="border-t border-white/8 pt-1.5">
          <Row label="Total" value={detail.total} bold />
        </div>
      </dl>

      {detail.refunds.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-white/50 uppercase tracking-wide">Refund History</p>
          <ul className="space-y-1">
            {detail.refunds.map((r) => (
              <RefundRow key={r.id} refund={r} />
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={handleRefundClick}
        className="text-xs bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 px-3 py-1.5 rounded transition-colors"
      >
        Refund
      </button>

      <RefundDialog
        open={refundOpen}
        orderId={detail.id}
        maxAmount={detail.total}
        onClose={() => setRefundOpen(false)}
      />
    </section>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Row({
  label,
  value,
  bold = false,
}: {
  label: string
  value: number
  bold?: boolean
}) {
  return (
    <div className="flex justify-between">
      <dt className={bold ? 'text-white font-medium' : 'text-white/60'}>{label}</dt>
      <dd className={`tabular-nums ${bold ? 'text-white font-semibold' : 'text-white/70'}`}>
        ${value.toFixed(2)}
      </dd>
    </div>
  )
}

function RefundRow({ refund }: { refund: OrderRefundSummary }) {
  const date = refund.createdAt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <li className="flex items-center justify-between text-xs text-white/70">
      <span className="flex items-center gap-2">
        <span className="font-tabular-nums">${refund.amount.toFixed(2)}</span>
        <span className="text-white/40">{date}</span>
      </span>
      <span className="text-white/50">{refund.type}</span>
    </li>
  )
}
