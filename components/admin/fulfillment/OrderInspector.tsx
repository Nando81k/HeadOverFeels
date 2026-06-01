'use client'

/**
 * OrderInspector — quick-edit slide-out panel for admin fulfillment orders.
 *
 * Renders a right-anchored Inspector drawer that:
 *  - Displays read-only order summary (order #, customer, total)
 *  - Allows inline editing of: status dropdown, internal notes textarea,
 *    tracking number + carrier inputs
 *  - "Buy label" button triggers purchaseShippingLabel server action
 *  - "Open full detail →" link to /admin/fulfillment/[orderId]
 *
 * Phase 4 Task 6 — OrderInspector:
 *  - Props: open, detail (OrderDetailFull | null), onClose, onSaved
 *  - Status changes are saved immediately on dropdown change
 *  - Notes and tracking have explicit "Save notes" / "Save tracking" buttons
 *  - Toast feedback via lib/toast.ts (Sonner)
 *  - No dark: Tailwind modifiers (V2 always-dark)
 */

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'
import {
  updateOrderStatus,
  saveOrderNotes,
  setTracking,
  purchaseShippingLabel,
} from '@/app/admin/fulfillment/actions'
import type { OrderDetailFull } from '@/lib/admin/fulfillment'

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED'

export interface OrderInspectorProps {
  /** Whether the drawer is open. */
  open: boolean
  /** Order to display and edit. `null` means the panel is closed or loading. */
  detail: OrderDetailFull | null
  /** Called when the user dismisses the panel. */
  onClose: () => void
  /** Called after a successful save so the parent can refresh its list. */
  onSaved?: (orderId: string) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ORDER_STATUSES: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
]

// ─── Component ────────────────────────────────────────────────────────────────

export function OrderInspector({ open, detail, onClose, onSaved }: OrderInspectorProps) {
  const [pending, startTransition] = useTransition()

  // Form state — synced from `detail` prop when it changes
  const [status, setStatus] = useState<OrderStatus>('PENDING')
  const [internalNotes, setInternalNotes] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [carrier, setCarrier] = useState('')

  // Sync form when detail changes.
  // Phase 3 pattern: useEffect with setState. Phase 4.5 will convert to key={detail?.id} resets.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!detail) return
    setStatus((detail.status as OrderStatus) ?? 'PENDING')
    setInternalNotes(detail.internalNotes ?? '')
    setTrackingNumber(detail.trackingNumber ?? '')
    setCarrier(detail.carrier ?? '')
  }, [detail])
  /* eslint-enable react-hooks/set-state-in-effect */

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleStatusChange(next: OrderStatus) {
    setStatus(next)
    startTransition(async () => {
      const r = await updateOrderStatus(detail!.id, next)
      if (r.ok) {
        toast.success('Status updated')
        onSaved?.(detail!.id)
      } else {
        toast.error((r as { ok: false; error: string }).error ?? 'Failed to update status')
      }
    })
  }

  function handleSaveNotes() {
    startTransition(async () => {
      const r = await saveOrderNotes(detail!.id, { internalNotes })
      if (r.ok) {
        toast.success('Notes saved')
        onSaved?.(detail!.id)
      } else {
        toast.error((r as { ok: false; error: string }).error ?? 'Failed to save notes')
      }
    })
  }

  function handleSaveTracking() {
    startTransition(async () => {
      const r = await setTracking(detail!.id, { trackingNumber, carrier })
      if (r.ok) {
        toast.success('Tracking saved')
        onSaved?.(detail!.id)
      } else {
        toast.error((r as { ok: false; error: string }).error ?? 'Failed to save tracking')
      }
    })
  }

  function handleBuyLabel() {
    startTransition(async () => {
      const r = await purchaseShippingLabel(detail!.id)
      if (r.ok) {
        const tn = r.data?.trackingNumber
        toast.success(tn ? `Label purchased — tracking ${tn}` : 'Label purchased')
        if (tn) setTrackingNumber(tn)
        onSaved?.(detail!.id)
      } else {
        toast.error((r as { ok: false; error: string }).error ?? 'Failed to purchase label')
      }
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Inspector
      open={open}
      onClose={onClose}
      title={detail?.orderNumber}
      width={440}
    >
      {detail && (
        <div className="space-y-5 text-sm">
          {/* ── Read-only header summary ─────────────────────────────── */}
          <section className="space-y-1 pb-4 border-b border-white/10">
            <p className="text-white/70">{detail.customerName ?? '—'}</p>
            <p className="text-xs text-white/50">{detail.customerEmail}</p>
            <p className="text-white/80 mt-1">
              Total:{' '}
              <span className="font-semibold text-white">
                ${detail.total.toFixed(2)}
              </span>
            </p>
          </section>

          {/* ── Status dropdown ──────────────────────────────────────── */}
          <section className="space-y-2">
            <label
              htmlFor="order-inspector-status"
              className="block text-xs font-medium uppercase tracking-wider text-white/50"
            >
              Status
            </label>
            <select
              id="order-inspector-status"
              aria-label="Status"
              value={status}
              onChange={(e) => handleStatusChange(e.target.value as OrderStatus)}
              disabled={pending}
              className={[
                'w-full rounded-lg border border-white/10 bg-neutral-900/60',
                'px-3 py-2 text-sm text-white',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
                pending ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </section>

          {/* ── Internal notes ───────────────────────────────────────── */}
          <section className="space-y-2">
            <label
              htmlFor="order-inspector-notes"
              className="block text-xs font-medium uppercase tracking-wider text-white/50"
            >
              Internal notes
            </label>
            <textarea
              id="order-inspector-notes"
              aria-label="Internal notes"
              rows={4}
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              disabled={pending}
              className={[
                'w-full rounded-lg border border-white/10 bg-neutral-900/60',
                'px-3 py-2 text-sm text-white placeholder:text-white/30',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60 resize-y',
                pending ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
            />
            <button
              type="button"
              onClick={handleSaveNotes}
              disabled={pending}
              className={[
                'rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-white/70',
                'hover:text-white hover:border-white/20 transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
                pending ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
            >
              Save notes
            </button>
          </section>

          {/* ── Tracking + carrier ───────────────────────────────────── */}
          <section className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-white/50">
              Shipping
            </p>

            <div className="space-y-1.5">
              <label
                htmlFor="order-inspector-tracking"
                className="block text-xs text-white/40"
              >
                Tracking number
              </label>
              <input
                id="order-inspector-tracking"
                aria-label="Tracking number"
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                disabled={pending}
                placeholder="e.g. 1Z999AA10123456784"
                className={[
                  'w-full rounded-lg border border-white/10 bg-neutral-900/60',
                  'px-3 py-2 text-sm text-white placeholder:text-white/25',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
                  pending ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="order-inspector-carrier"
                className="block text-xs text-white/40"
              >
                Carrier
              </label>
              <input
                id="order-inspector-carrier"
                aria-label="Carrier"
                type="text"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                disabled={pending}
                placeholder="e.g. UPS, FedEx, USPS"
                className={[
                  'w-full rounded-lg border border-white/10 bg-neutral-900/60',
                  'px-3 py-2 text-sm text-white placeholder:text-white/25',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
                  pending ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleSaveTracking}
                disabled={pending}
                className={[
                  'rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-white/70',
                  'hover:text-white hover:border-white/20 transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
                  pending ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
              >
                Save tracking
              </button>
              <button
                type="button"
                onClick={handleBuyLabel}
                disabled={pending}
                className={[
                  'rounded-lg px-3 py-1.5 text-xs font-medium',
                  'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25',
                  'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60',
                  pending ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
              >
                Buy label
              </button>
            </div>
          </section>

          {/* ── Open full detail link ─────────────────────────────────── */}
          <div className="pt-2 border-t border-white/10">
            <Link
              href={`/admin/fulfillment/${detail.id}`}
              className="block text-center text-xs text-sky-300 hover:text-sky-200 underline underline-offset-2 transition-colors"
            >
              Open full detail →
            </Link>
          </div>
        </div>
      )}
    </Inspector>
  )
}
