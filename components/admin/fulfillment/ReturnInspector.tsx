// components/admin/fulfillment/ReturnInspector.tsx
'use client'

import { useState, useTransition } from 'react'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'
import { approveReturn, rejectReturn, markReturnReceived } from '@/app/admin/fulfillment/actions'
import type { ReturnWithItems } from '@/lib/admin/fulfillment'

// ─── Condition badge styles ───────────────────────────────────────────────────

const CONDITION_BADGE: Record<string, string> = {
  UNOPENED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  USED:     'bg-amber-500/15 text-amber-300 border-amber-500/30',
  DAMAGED:  'bg-red-500/15 text-red-300 border-red-500/30',
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ReturnInspectorProps {
  /** Whether the slide-out is open. */
  open: boolean
  /** Return to display. `null` means the panel is closed / loading. */
  detail: ReturnWithItems | null
  /** Called when the user dismisses the panel. */
  onClose: () => void
  /**
   * Called after any successful mutation so the parent can refresh.
   * Receives the return id of the mutated record.
   */
  onMutated?: (returnId: string) => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ReturnInspector({ open, detail, onClose, onMutated }: ReturnInspectorProps) {
  const [, startTransition] = useTransition()
  const [labelUrl, setLabelUrl] = useState<string | null>(null)

  // When detail changes (new return opened), reset the label URL state.
  // We use a key approach below, so this is stable.

  if (!detail) return null

  const status = detail.status
  const isRequested = status === 'REQUESTED'
  const isApproved  = status === 'APPROVED'
  const isClosed    = status === 'RECEIVED' || status === 'REJECTED' || status === 'REFUNDED'

  const handleApprove = () => {
    startTransition(async () => {
      const r = await approveReturn(detail.id)
      if (r.ok) {
        toast.success('Return approved — label generated')
        if (r.data?.labelUrl) setLabelUrl(r.data.labelUrl)
        onMutated?.(detail.id)
      } else {
        toast.error(r.error ?? 'Failed to approve return')
      }
    })
  }

  const handleReject = () => {
    const reason = window.prompt('Reason for rejecting this return?')
    if (!reason) return
    startTransition(async () => {
      const r = await rejectReturn(detail.id, reason)
      if (r.ok) {
        toast.success('Return rejected')
        onMutated?.(detail.id)
      } else {
        toast.error(r.error ?? 'Failed to reject return')
      }
    })
  }

  const handleMarkReceived = () => {
    startTransition(async () => {
      const r = await markReturnReceived(detail.id)
      if (r.ok) {
        toast.success('Return marked as received')
        onMutated?.(detail.id)
      } else {
        toast.error(r.error ?? 'Failed to mark return received')
      }
    })
  }

  const totalRefundable = detail.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const displayLabelUrl = labelUrl ?? detail.returnLabel

  return (
    <Inspector open={open} onClose={onClose} title={detail.rmaNumber} width={480}>
      <div className="space-y-5 text-sm">

        {/* ── Read-only header ─────────────────────────────────────── */}
        <section className="space-y-3 rounded-lg border border-white/8 bg-neutral-900/60 px-4 py-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-white/40 mb-0.5">Order #</div>
              <div className="font-mono text-white">{detail.orderNumber}</div>
            </div>
            <div>
              <div className="text-white/40 mb-0.5">Requested</div>
              <div className="text-white">{fmt(detail.requestedAt)}</div>
            </div>
            <div className="col-span-2">
              <div className="text-white/40 mb-0.5">Customer</div>
              <div className="text-white truncate">{detail.customerName ?? detail.customerEmail}</div>
            </div>
          </div>
        </section>

        {/* ── Reason ──────────────────────────────────────────────── */}
        <section>
          <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1.5">Reason</div>
          <p className="text-white/80">{detail.reason}</p>
        </section>

        {/* ── Items list table ─────────────────────────────────────── */}
        <section>
          <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">Items</div>
          <div className="space-y-2">
            {detail.items.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-md border border-white/8 bg-neutral-900/40 px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">{item.productName}</div>
                  <div className="text-xs text-white/50 mt-0.5">
                    Qty {item.quantity} · ${item.unitPrice.toFixed(2)}
                    {item.reason && <span className="ml-1">· {item.reason}</span>}
                  </div>
                </div>
                <span
                  className={[
                    'shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded border',
                    CONDITION_BADGE[item.condition] ?? 'bg-white/10 text-white/60 border-white/10',
                  ].join(' ')}
                >
                  {item.condition}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Refund amount ────────────────────────────────────────── */}
        <section>
          <label
            htmlFor="return-refund-amount"
            className="block text-xs font-medium text-white/40 uppercase tracking-wider mb-1.5"
          >
            Refund amount ($)
          </label>
          <input
            id="return-refund-amount"
            type="number"
            step="0.01"
            min="0"
            defaultValue={totalRefundable.toFixed(2)}
            className={[
              'w-full rounded-md border border-white/8 bg-neutral-900/60',
              'px-3 py-2 text-sm text-white placeholder:text-white/30',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
            ].join(' ')}
          />
          <p className="mt-1 text-[11px] text-white/30">
            Use the order detail page to process the actual Stripe refund.
          </p>
        </section>

        {/* ── Return label link ────────────────────────────────────── */}
        {displayLabelUrl && (
          <section>
            <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1.5">Return Label</div>
            <a
              href={displayLabelUrl}
              target="_blank"
              rel="noreferrer"
              className="block text-xs text-sky-300 hover:text-sky-200 underline truncate"
            >
              {displayLabelUrl}
            </a>
          </section>
        )}

        {/* ── Action buttons ───────────────────────────────────────── */}
        <div className="flex flex-col gap-2 border-t border-white/8 pt-4">
          {/* Approve + Reject — only when REQUESTED */}
          {(isRequested || isClosed) && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleApprove}
                disabled={!isRequested}
                aria-label="Approve return"
                className={[
                  'flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60',
                  isRequested
                    ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300'
                    : 'bg-white/5 text-white/20 cursor-not-allowed',
                ].join(' ')}
              >
                Approve
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={!isRequested}
                aria-label="Reject return"
                className={[
                  'flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60',
                  isRequested
                    ? 'bg-red-500/15 hover:bg-red-500/25 text-red-300'
                    : 'bg-white/5 text-white/20 cursor-not-allowed',
                ].join(' ')}
              >
                Reject
              </button>
            </div>
          )}

          {/* Mark Received — only when APPROVED */}
          {isApproved && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleApprove}
                disabled
                aria-label="Approve return"
                className="flex-1 rounded-md px-3 py-2 text-xs font-semibold bg-white/5 text-white/20 cursor-not-allowed"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled
                aria-label="Reject return"
                className="flex-1 rounded-md px-3 py-2 text-xs font-semibold bg-white/5 text-white/20 cursor-not-allowed"
              >
                Reject
              </button>
            </div>
          )}

          {isApproved && (
            <button
              type="button"
              onClick={handleMarkReceived}
              aria-label="Mark return as received"
              className={[
                'w-full rounded-md px-3 py-2 text-xs font-semibold transition-colors',
                'bg-sky-500/15 hover:bg-sky-500/25 text-sky-300',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60',
              ].join(' ')}
            >
              Mark Received
            </button>
          )}
        </div>

      </div>
    </Inspector>
  )
}
