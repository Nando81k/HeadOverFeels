// components/admin/loyalty/inspectors/RedemptionInspector.tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  fulfillRedemption,
  cancelRedemption,
  type RedemptionDetailFull,
} from '@/app/admin/loyalty/actions'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'

// ─── Status badge styles ──────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  PENDING:   'bg-amber-500/15 text-amber-300 border-amber-500/30',
  ACTIVE:    'bg-sky-500/15 text-sky-300 border-sky-500/30',
  USED:      'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  FULFILLED: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  EXPIRED:   'bg-neutral-500/15 text-neutral-400 border-neutral-500/30',
  CANCELLED: 'bg-red-500/15 text-red-300 border-red-500/30',
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface RedemptionInspectorProps {
  /** Whether the slide-out is open. */
  open: boolean
  /** Redemption to display. `null` means the panel is closed / loading. */
  detail: RedemptionDetailFull | null
  /** Whether the current user has SUPER_ADMIN role (gates Cancel). */
  isSuperAdmin: boolean
  /** Called when the user dismisses the panel. */
  onClose: () => void
  /**
   * Called after any successful mutation so the parent can refresh.
   * Receives the redemption id of the mutated record.
   */
  onMutated?: (id: string) => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FULFILLABLE = new Set(['PENDING', 'ACTIVE'])

function fmt(date: Date | null): string {
  if (!date) return '—'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RedemptionInspector({
  open,
  detail,
  isSuperAdmin,
  onClose,
  onMutated,
}: RedemptionInspectorProps) {
  const [tracking, setTracking] = useState('')
  const [isPending, startTransition] = useTransition()

  // Reset tracking input when a new detail is opened
  useEffect(() => {
    if (open) setTracking(detail?.trackingNumber ?? '')
  }, [open, detail])

  if (!detail) return null

  const canAct = FULFILLABLE.has(detail.status)
  const finalizedTooltip = 'Redemption already finalized'

  const handleFulfill = () => {
    startTransition(async () => {
      const r = await fulfillRedemption(detail.id, tracking || undefined)
      if (r.ok) {
        toast.success('Redemption marked fulfilled')
        onMutated?.(detail.id)
        onClose()
      } else {
        toast.error(r.error ?? 'Failed to fulfil redemption')
      }
    })
  }

  const handleCancel = () => {
    const reason = window.confirm(
      `Cancel this redemption for ${detail.customerEmail}?\n\nPoints will be refunded. Enter a reason in the next prompt.`,
    )
    if (!reason) return

    const reasonText = window.prompt('Reason for cancellation:')
    if (!reasonText || !reasonText.trim()) return

    startTransition(async () => {
      const r = await cancelRedemption(detail.id, reasonText.trim())
      if (r.ok) {
        toast.success('Redemption cancelled — points refunded')
        onMutated?.(detail.id)
        onClose()
      } else {
        toast.error(r.error ?? 'Failed to cancel redemption')
      }
    })
  }

  const badgeCls = STATUS_BADGE[detail.status] ?? 'bg-white/10 text-white/60 border-white/10'

  return (
    <Inspector open={open} onClose={onClose} title={`Redemption — ${detail.rewardName}`} width={480}>
      <div className="space-y-5 text-sm">

        {/* ── Customer & reward header ─────────────────────────────── */}
        <section className="space-y-3 rounded-lg border border-white/8 bg-neutral-900/60 px-4 py-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="col-span-2">
              <div className="text-white/40 mb-0.5">Customer</div>
              <div className="text-white truncate">
                {detail.customerName
                  ? `${detail.customerName} (${detail.customerEmail})`
                  : detail.customerEmail}
              </div>
            </div>
            <div>
              <div className="text-white/40 mb-0.5">Reward</div>
              <div className="text-white">{detail.rewardName}</div>
            </div>
            <div>
              <div className="text-white/40 mb-0.5">Points spent</div>
              <div className="text-white font-semibold">{detail.pointsSpent.toLocaleString()}</div>
            </div>
          </div>
        </section>

        {/* ── Status pill ──────────────────────────────────────────── */}
        <section className="flex items-center gap-3">
          <span className="text-xs font-medium text-white/40 uppercase tracking-wider">Status</span>
          <span
            className={[
              'text-[10px] font-semibold px-2 py-0.5 rounded border',
              badgeCls,
            ].join(' ')}
          >
            {detail.status}
          </span>
        </section>

        {/* ── Coupon code ──────────────────────────────────────────── */}
        {detail.couponCode && (
          <section>
            <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1.5">
              Coupon Code
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-white bg-neutral-900/60 border border-white/8 rounded px-2 py-1 text-xs">
                {detail.couponCode}
              </span>
              <button
                type="button"
                aria-label="Copy coupon code"
                onClick={() => {
                  navigator.clipboard.writeText(detail.couponCode!).then(() =>
                    toast.success('Coupon code copied'),
                  )
                }}
                className="text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                Copy
              </button>
            </div>
          </section>
        )}

        {/* ── Dates grid ───────────────────────────────────────────── */}
        <section className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-white/40 mb-0.5">Created</div>
            <div className="text-white">{fmt(detail.createdAt)}</div>
          </div>
          <div>
            <div className="text-white/40 mb-0.5">Used at</div>
            <div className="text-white">{fmt(detail.usedAt)}</div>
          </div>
          {detail.shippedAt && (
            <div>
              <div className="text-white/40 mb-0.5">Shipped at</div>
              <div className="text-white">{fmt(detail.shippedAt)}</div>
            </div>
          )}
          {detail.trackingNumber && (
            <div>
              <div className="text-white/40 mb-0.5">Tracking #</div>
              <div className="text-white font-mono">{detail.trackingNumber}</div>
            </div>
          )}
        </section>

        {/* ── Linked order ─────────────────────────────────────────── */}
        {detail.orderId && (
          <section>
            <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1.5">
              Linked Order
            </div>
            <Link
              href={`/admin/orders/${detail.orderId}`}
              className="text-xs text-sky-300 hover:text-sky-200 underline font-mono"
            >
              {detail.orderId}
            </Link>
          </section>
        )}

        {/* ── Action buttons ───────────────────────────────────────── */}
        <div className="border-t border-white/8 pt-4 space-y-3">

          {canAct ? (
            /* PENDING / ACTIVE — show tracking input + action buttons */
            <div className="space-y-2">
              <label
                htmlFor="redemption-tracking"
                className="block text-xs font-medium text-white/40 uppercase tracking-wider"
              >
                Tracking Number (optional)
              </label>
              <input
                id="redemption-tracking"
                aria-label="tracking number"
                type="text"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                disabled={isPending}
                placeholder="e.g. 1Z999AA10123456784"
                className={[
                  'w-full rounded-md border border-white/8 bg-neutral-900/60',
                  'px-3 py-2 text-sm text-white placeholder:text-white/20',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
                ].join(' ')}
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleFulfill}
                  disabled={isPending}
                  aria-label="mark fulfilled"
                  className={[
                    'flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60',
                    'bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 disabled:opacity-50 disabled:cursor-not-allowed',
                  ].join(' ')}
                >
                  Mark Fulfilled
                </button>

                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={!isSuperAdmin || isPending}
                  title={
                    !isSuperAdmin
                      ? 'Requires SUPER_ADMIN role'
                      : 'Cancel redemption and refund points'
                  }
                  aria-label="cancel redemption"
                  className={[
                    'flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60',
                    isSuperAdmin
                      ? 'bg-red-500/15 hover:bg-red-500/25 text-red-300 disabled:opacity-50'
                      : 'bg-white/5 text-white/20 cursor-not-allowed',
                  ].join(' ')}
                >
                  Cancel Redemption
                </button>
              </div>
            </div>
          ) : (
            /* USED / EXPIRED / CANCELLED / FULFILLED — finalized notice */
            <p className="text-[11px] text-white/30 text-center">{finalizedTooltip}</p>
          )}
        </div>

      </div>
    </Inspector>
  )
}
