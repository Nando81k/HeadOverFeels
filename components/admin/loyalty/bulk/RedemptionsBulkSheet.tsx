'use client'

/**
 * RedemptionsBulkSheet
 *
 * Bottom-anchored sheet for bulk actions on selected redemptions.
 *
 * Actions:
 *  1. Mark Fulfilled — prompts for a single optional tracking number applied to all;
 *     calls bulkFulfillRedemptions(ids, trackingMap)
 *  2. Bulk Cancel    — SUPER_ADMIN only; prompts for a reason + confirm;
 *     calls bulkCancelRedemptions(ids, reason)
 *
 * Phase 7 Wave 4 Task 22.
 */

import { useTransition } from 'react'
import { bulkFulfillRedemptions, bulkCancelRedemptions } from '@/app/admin/loyalty/actions'
import { toast } from '@/lib/toast'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface RedemptionsBulkSheetProps {
  /** IDs of currently selected redemptions. */
  selectedIds: string[]
  /** Whether the current admin user has SUPER_ADMIN role. */
  isSuperAdmin: boolean
  /** Called after a successful action or Clear so parent can refresh + clear selection. */
  onClear: () => void
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function RedemptionsBulkSheet({
  selectedIds,
  isSuperAdmin,
  onClear,
}: RedemptionsBulkSheetProps) {
  const [pending, startTransition] = useTransition()

  // ── 1. Mark Fulfilled ──────────────────────────────────────────────────────

  function handleFulfill() {
    const tracking =
      typeof window !== 'undefined'
        ? window.prompt('Tracking number (optional, applies to all):')
        : null

    const trackingMap: Record<string, string> = {}
    if (tracking && tracking.trim()) {
      for (const id of selectedIds) trackingMap[id] = tracking.trim()
    }

    startTransition(async () => {
      try {
        const r = await bulkFulfillRedemptions(selectedIds, trackingMap)
        if (r.ok) {
          const ok = r.data?.succeeded.length ?? 0
          const failed = r.data?.failed.length ?? 0
          toast.success(`Fulfilled ${ok}${failed > 0 ? ` (${failed} failed)` : ''}`)
          onClear()
        } else {
          toast.error(r.error)
        }
      } catch {
        toast.error('An unexpected error occurred.')
      }
    })
  }

  // ── 2. Bulk Cancel (SUPER_ADMIN) ───────────────────────────────────────────

  function handleCancel() {
    const reason =
      typeof window !== 'undefined'
        ? window.prompt('Reason for bulk cancellation:')
        : null
    if (!reason || !reason.trim()) return

    const confirmed =
      typeof window !== 'undefined'
        ? window.confirm(
            `Cancel ${selectedIds.length} redemption${selectedIds.length === 1 ? '' : 's'}? This cannot be undone.`,
          )
        : false
    if (!confirmed) return

    startTransition(async () => {
      try {
        const r = await bulkCancelRedemptions(selectedIds, reason.trim())
        if (r.ok) {
          const ok = r.data?.succeeded.length ?? 0
          const failed = r.data?.failed.length ?? 0
          toast.success(`Cancelled ${ok}${failed > 0 ? ` (${failed} failed)` : ''}`)
          onClear()
        } else {
          toast.error(r.error)
        }
      } catch {
        toast.error('An unexpected error occurred.')
      }
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (selectedIds.length === 0) return null

  return (
    <div className="fixed bottom-3 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto sm:w-[480px] z-50 bg-neutral-900/95 border border-white/8 rounded-md p-3 shadow-2xl">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-white/80">
          {selectedIds.length} selected
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleFulfill}
            disabled={pending}
            className="px-3 py-1.5 rounded-md bg-[#FF3131] text-white hover:bg-[#ff4747] disabled:opacity-50"
          >
            Mark Fulfilled
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={!isSuperAdmin || pending}
            title={isSuperAdmin ? undefined : 'SUPER_ADMIN only'}
            className="px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/8 text-red-400 hover:text-red-300 disabled:text-white/20 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={pending}
            className="px-3 py-1.5 rounded-md text-white/50 hover:text-white"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}
