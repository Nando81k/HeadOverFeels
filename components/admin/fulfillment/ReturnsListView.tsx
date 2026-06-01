'use client'

/**
 * ReturnsListView — admin returns tab table.
 *
 * Renders a table of ReturnRow entries. Each row shows:
 *   - RMA #
 *   - Order #
 *   - Customer name (or dash)
 *   - Status pill
 *   - Requested date
 *   - Refund amount
 *   - ⋯ action button → opens ReturnInspector
 *
 * Phase 4 Task 10 (Wave 5).
 */

import { useState, useTransition } from 'react'
import { DotsThreeOutline } from '@phosphor-icons/react/dist/ssr'
import { ReturnInspector } from './ReturnInspector'
import { getReturnDetailForInspector } from '@/app/admin/fulfillment/actions'
import type { ReturnRow, ReturnWithItems } from '@/lib/admin/fulfillment'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReturnsListViewProps {
  /** Return rows to display. */
  rows: ReturnRow[]
  /** Show loading skeletons instead of rows. */
  loading?: boolean
  /**
   * Called after a successful mutation inside the inspector so the parent can
   * refresh the list (e.g., re-fetch server data).
   */
  onRefresh?: () => void
}

// ─── Status pill map ──────────────────────────────────────────────────────────

const RETURN_STATUS_PILL: Record<string, string> = {
  REQUESTED: 'bg-amber-500/15 text-amber-300',
  APPROVED:  'bg-sky-500/15 text-sky-300',
  REJECTED:  'bg-red-500/15 text-red-300',
  RECEIVED:  'bg-indigo-500/15 text-indigo-300',
  REFUNDED:  'bg-emerald-500/15 text-emerald-300',
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr aria-hidden className="border-b border-white/[0.04] animate-pulse">
      <td className="px-3 py-2.5"><div className="h-3 w-24 bg-white/5 rounded" /></td>
      <td className="px-3 py-2.5"><div className="h-3 w-16 bg-white/5 rounded" /></td>
      <td className="px-3 py-2.5"><div className="h-3 w-28 bg-white/5 rounded" /></td>
      <td className="px-3 py-2.5"><div className="h-4 w-18 bg-white/5 rounded-full" /></td>
      <td className="px-3 py-2.5"><div className="h-3 w-16 bg-white/5 rounded" /></td>
      <td className="px-3 py-2.5 text-right"><div className="h-3 w-12 bg-white/5 rounded ml-auto" /></td>
      <td className="px-3 py-2.5" />
    </tr>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReturnsListView({ rows, loading = false, onRefresh }: ReturnsListViewProps) {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<ReturnWithItems | null>(null)
  const [, startTransition] = useTransition()

  function openInspector(id: string) {
    setOpen(true)
    startTransition(async () => {
      const d = await getReturnDetailForInspector(id)
      setDetail(d)
    })
  }

  function handleClose() {
    setOpen(false)
    setDetail(null)
  }

  function handleMutated() {
    handleClose()
    onRefresh?.()
  }

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="overflow-hidden border border-white/8 rounded-md bg-neutral-900/60">
        <table className="w-full text-sm" aria-label="Returns loading">
          <thead className="bg-neutral-900/80 border-b border-white/8">
            <tr className="text-left text-xs text-white/50 uppercase tracking-wide">
              <th className="px-3 py-2">RMA #</th>
              <th className="px-3 py-2">Order #</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Requested</th>
              <th className="px-3 py-2 text-right">Refund</th>
              <th className="px-3 py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-white/40 border border-white/8 rounded-md bg-neutral-900/40">
        No returns yet.
      </div>
    )
  }

  // ── Table ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="overflow-hidden border border-white/8 rounded-md bg-neutral-900/60">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900/80 border-b border-white/8">
            <tr className="text-left text-xs text-white/50 uppercase tracking-wide">
              <th className="px-3 py-2">RMA #</th>
              <th className="px-3 py-2">Order #</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Requested</th>
              <th className="px-3 py-2 text-right">Refund</th>
              <th className="px-3 py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                data-testid="return-row"
                className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-3 py-2.5 font-mono text-xs text-white">{r.rmaNumber}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-white/70">{r.orderNumber}</td>
                <td className="px-3 py-2.5 text-white/80">{r.customerName ?? '—'}</td>
                <td className="px-3 py-2.5">
                  <span
                    className={[
                      'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                      RETURN_STATUS_PILL[r.status] ?? 'bg-white/10 text-white/50',
                    ].join(' ')}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-xs text-white/60">
                  {r.requestedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </td>
                <td className="px-3 py-2.5 text-right text-white tabular-nums text-xs">
                  ${r.refundAmount.toFixed(2)}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    type="button"
                    aria-label={`Open return ${r.rmaNumber}`}
                    onClick={() => openInspector(r.id)}
                    className="p-1 rounded hover:bg-white/[0.08] text-white/60 hover:text-white transition-colors"
                  >
                    <DotsThreeOutline size={16} weight="bold" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ReturnInspector
        open={open}
        detail={detail}
        onClose={handleClose}
        onMutated={handleMutated}
      />
    </>
  )
}
